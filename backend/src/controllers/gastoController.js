const Gasto = require('../models/Gasto');
const Presupuesto = require('../models/Presupuesto');
const PresupuestoCategoria = require('../models/PresupuestoCategoria');
const { Op } = require('sequelize');

// El presupuesto mide lo que se gasta: los ingresos no cuentan como "gastado".
const SOLO_GASTOS = { [Op.ne]: 'ingreso' };

// Tarea 9 - Aviso antes de superar el limite de la categoria.
// Si el gasto haria pasar el limite de su categoria en ese mes, devuelve
// los datos del aviso (cuanto se pasaria) para pedir confirmacion.
// Los ingresos nunca generan aviso. excluirId evita contar dos veces
// el gasto que se esta editando.
async function calcularExcesoCategoria({ userId, tipo, categoria, mes, anio, monto, excluirId }) {
    if (tipo === 'ingreso') return null;

    const limiteCategoria = await PresupuestoCategoria.findOne({
        where: { userId, categoria, mes, anio }
    });
    if (!limiteCategoria) return null;

    const where = {
        userId,
        categoria,
        tipo: { [Op.ne]: 'ingreso' },
        fecha: {
            [Op.gte]: new Date(anio, mes - 1, 1),
            [Op.lt]: new Date(anio, mes, 1)
        }
    };
    if (excluirId !== undefined) where.id = { [Op.ne]: excluirId };

    const gastos = await Gasto.findAll({ where, attributes: ['monto'] });
    const consumido = gastos.reduce((total, item) => total + Number(item.monto), 0);
    const limite = Number(limiteCategoria.limite);
    const exceso = Number((consumido + monto - limite).toFixed(2));

    if (exceso <= 0) return null;

    return {
        requiereConfirmacion: true,
        error: `Este gasto supera el límite de ${categoria} en Bs ${exceso.toFixed(2)}`,
        categoria,
        limite: Number(limite.toFixed(2)),
        consumido: Number(consumido.toFixed(2)),
        montoSolicitado: Number(monto.toFixed(2)),
        exceso
    };
}

async function registrarGasto(req, res) {
    try {
        const { monto, motivo, tipo, categoria, confirmarExceso } = req.body;
        const userId = req.user.id;
        const montoNumerico = Number(monto);

        // Validar los datos recibidos
        if (
            monto === undefined ||
            monto === null ||
            monto === '' ||
            !Number.isFinite(montoNumerico) ||
            montoNumerico <= 0 ||
            !motivo ||
            !String(motivo).trim()
        ) {
            return res.status(400).json({
                error: 'Debes ingresar un monto positivo y un motivo válido'
            });
        }

        // Obtener el mes y año actuales
        const ahora = new Date();
        const mes = ahora.getMonth() + 1;
        const anio = ahora.getFullYear();

        // Buscar el presupuesto del usuario para el mes actual
        const presupuesto = await Presupuesto.findOne({
            where: {
                userId,
                mes,
                anio
            }
        });

        if (!presupuesto) {
            return res.status(400).json({
                error: 'No tienes un presupuesto establecido para el mes actual. Establece tu presupuesto antes de registrar gastos.'
            });
        }

        // Definir el inicio y el final del mes
        const inicioMes = new Date(anio, mes - 1, 1);
        const inicioMesSiguiente = new Date(anio, mes, 1);

        // Obtener los gastos registrados durante el mes actual
        const gastos = await Gasto.findAll({
            where: {
                userId,
                tipo: SOLO_GASTOS,
                fecha: {
                    [Op.gte]: inicioMes,
                    [Op.lt]: inicioMesSiguiente
                }
            },
            attributes: ['monto']
        });

        // Calcular el total gastado
        const gastado = gastos.reduce(
            (total, gasto) => total + Number(gasto.monto),
            0
        );

        const limite = Number(presupuesto.limite);
        const disponible = Number((limite - gastado).toFixed(2));
        const tipoNormalizado = tipo ? String(tipo).toLowerCase().trim() : 'gasto';

        // Validar que el nuevo gasto no supere el saldo disponible.
        // Un ingreso no consume presupuesto, asi que no se compara con el limite.
        if (tipoNormalizado !== 'ingreso' && montoNumerico > disponible) {
            return res.status(400).json({
                error: 'El gasto supera el presupuesto mensual disponible',
                limite: Number(limite.toFixed(2)),
                gastado: Number(gastado.toFixed(2)),
                disponible,
                montoSolicitado: Number(montoNumerico.toFixed(2))
            });
        }

        const categoriaNormalizada = categoria ? String(categoria).toLowerCase().trim() : 'otros';

        // Tarea 9: si supera el limite de la categoria, pedir confirmacion antes de guardar
        if (confirmarExceso !== true) {
            const aviso = await calcularExcesoCategoria({
                userId,
                tipo: tipoNormalizado,
                categoria: categoriaNormalizada,
                mes,
                anio,
                monto: montoNumerico
            });
            if (aviso) return res.status(409).json(aviso);
        }

        // Registrar el gasto si está dentro del presupuesto
        const gasto = await Gasto.create({
            monto: montoNumerico,
            motivo: String(motivo).trim(),
            fecha: ahora,
            userId,
            tipo: tipoNormalizado,
            categoria: categoriaNormalizada
        });

        return res.status(201).json(gasto);

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            error: 'Error al registrar el gasto'
        });
    }
}

async function obtenerGastos(req, res) {
    try {
        const gastos = await Gasto.findAll({
            where: { userId: req.user.id }
        });
        res.json(gastos);
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            error: 'Error al obtener los gastos'
        });
    }
}


async function eliminarGasto(req, res) {
    try {
        const { id } = req.params;
        const gasto = await Gasto.findByPk(id);
        if (!gasto) {
            return res.status(404).json({
                error: 'Gasto no encontrado'
            });
        }
        if (Number(gasto.userId) !== Number(req.user.id)) {
            return res.status(403).json({
                error: 'No tienes permiso para eliminar este gasto'
            });
        }
        await gasto.destroy();
        res.json({ message: 'Gasto eliminado correctamente' });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            error: 'Error al eliminar el gasto'
        });
    }

}

async function editarGasto(req, res) {
    try {
        const { id } = req.params;
        const { monto, motivo, tipo, categoria, confirmarExceso } = req.body;
        const userId = req.user.id;
        const montoNumerico = Number(monto);

        if (
            monto === undefined ||
            monto === null ||
            monto === '' ||
            !Number.isFinite(montoNumerico) ||
            montoNumerico <= 0 ||
            !motivo ||
            !String(motivo).trim()
        ) {
            return res.status(400).json({
                error: 'Debes ingresar un monto positivo y un motivo válido'
            });
        }

        const gasto = await Gasto.findByPk(id);

        if (!gasto) {
            return res.status(404).json({
                error: 'Gasto no encontrado'
            });
        }

        if (Number(gasto.userId) !== Number(userId)) {
            return res.status(403).json({
                error: 'No tienes permiso para editar este gasto'
            });
        }

        if (gasto.estado.toLowerCase().trim() === 'gastado') {
            return res.status(400).json({
                error: 'No se puede editar este gasto porque ya está pagado'
            });
        }

        // Obtener el mes y año del gasto original
        const fechaGasto = new Date(gasto.fecha);
        const mes = fechaGasto.getMonth() + 1;
        const anio = fechaGasto.getFullYear();

        // Buscar el presupuesto correspondiente al gasto
        const presupuesto = await Presupuesto.findOne({
            where: { userId, mes, anio }
        });

        if (!presupuesto) {
            return res.status(400).json({
                error: 'No existe un presupuesto para el mes del gasto'
            });
        }

        // Definir el período mensual
        const inicioMes = new Date(anio, mes - 1, 1);
        const inicioMesSiguiente = new Date(anio, mes, 1);

        // Consultar los demás gastos del mes, excluyendo el que se edita
        const gastos = await Gasto.findAll({
            where: {
                userId,
                id: { [Op.ne]: gasto.id },
                tipo: SOLO_GASTOS,
                fecha: {
                    [Op.gte]: inicioMes,
                    [Op.lt]: inicioMesSiguiente
                }
            },
            attributes: ['monto']
        });

        const gastadoOtros = gastos.reduce(
            (total, item) => total + Number(item.monto),
            0
        );

        const limite = Number(presupuesto.limite);
        const disponible = Number((limite - gastadoOtros).toFixed(2));
        const tipoFinal = tipo ? String(tipo).toLowerCase().trim() : (gasto.tipo || 'gasto');

        // Validar el nuevo monto sin contar dos veces el gasto original (los ingresos no consumen presupuesto)
        if (tipoFinal !== 'ingreso' && montoNumerico > disponible) {
            return res.status(400).json({
                error: 'La modificación supera el presupuesto mensual disponible',
                limite: Number(limite.toFixed(2)),
                gastadoOtros: Number(gastadoOtros.toFixed(2)),
                disponible,
                montoSolicitado: Number(montoNumerico.toFixed(2))
            });
        }

        // Tarea 9: si la edicion hace pasar el limite de la categoria, pedir confirmacion
        if (confirmarExceso !== true) {
            const aviso = await calcularExcesoCategoria({
                userId,
                tipo: tipo ? String(tipo).toLowerCase().trim() : (gasto.tipo || 'gasto'),
                categoria: categoria ? String(categoria).toLowerCase().trim() : (gasto.categoria || 'otros'),
                mes,
                anio,
                monto: montoNumerico,
                excluirId: gasto.id
            });
            if (aviso) return res.status(409).json(aviso);
        }

        // Actualizar el gasto
        gasto.monto = montoNumerico;
        gasto.motivo = String(motivo).trim();
        if (tipo) gasto.tipo = String(tipo).toLowerCase().trim();
        if (categoria) gasto.categoria = String(categoria).toLowerCase().trim();

        await gasto.save();

        return res.json({
            message: 'Gasto editado correctamente',
            gasto
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            error: 'Error al editar el gasto'
        });
    }
}

async function pagarGasto(req, res) {
    try {
        const { id } = req.params;

        const gasto = await Gasto.findByPk(id);
        if (!gasto) {
            return res.status(404).json({
                error: 'Gasto no encontrado'
            })
        }

        if (Number(gasto.userId) !== Number(req.user.id)) {
            return res.status(403).json({
                error: 'No tienes permiso para pagar este gasto'
            });
        }

        gasto.estado = 'gastado';
        await gasto.save();

        return res.json({
            message: 'Gasto pagado correctamente',
            gasto
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            error: 'Error al marcar el gasto como pagado'
        });

    }

}

async function filtrarGastos(req, res) {
    try {
        const userId = req.user.id;
        const {
            buscar,
            tipo,
            categoria,
            estado,
            periodo,
            desde,
            hasta
        } = req.query;

        const where = {
            userId
        };

        if (buscar && String(buscar).trim()) {
            where.motivo = {
                [Op.iLike]: `%${String(buscar).trim()}%`
            };
        }

        if (tipo && String(tipo).trim() && String(tipo).toLowerCase() !== 'todos') {
            where.tipo = String(tipo).toLowerCase().trim();
        }

        if (categoria && String(categoria).trim() && String(categoria).toLowerCase() !== 'todas' && String(categoria).toLowerCase() !== 'todos') {
            where.categoria = String(categoria).toLowerCase().trim();
        }

        if (estado && String(estado).trim() && String(estado).toLowerCase() !== 'todos') {
            const estadoNormalizado = String(estado).toLowerCase().trim();
            if (estadoNormalizado === 'pagado' || estadoNormalizado === 'gastado') {
                where.estado = {
                    [Op.in]: ['pagado', 'gastado', 'Pagado', 'Gastado']
                };
            } else if (estadoNormalizado === 'pendiente') {
                where.estado = {
                    [Op.in]: ['pendiente', 'Pendiente']
                };
            } else {
                where.estado = estadoNormalizado;
            }
        }

        const ahora = new Date();
        const anioActual = ahora.getFullYear();
        const mesActual = ahora.getMonth();

        if (periodo === 'este_mes') {
            const inicioMes = new Date(anioActual, mesActual, 1);
            const inicioMesSiguiente = new Date(anioActual, mesActual + 1, 1);
            where.fecha = {
                [Op.gte]: inicioMes,
                [Op.lt]: inicioMesSiguiente
            };
        } else if (periodo === 'mes_anterior') {
            const inicioMesAnterior = new Date(anioActual, mesActual - 1, 1);
            const finMesAnterior = new Date(anioActual, mesActual, 1);
            where.fecha = {
                [Op.gte]: inicioMesAnterior,
                [Op.lt]: finMesAnterior
            };
        } else if (desde || hasta) {
            where.fecha = {};
            if (desde) {
                const fechaDesde = new Date(desde);
                fechaDesde.setHours(0, 0, 0, 0);
                where.fecha[Op.gte] = fechaDesde;
            }
            if (hasta) {
                const fechaHasta = new Date(hasta);
                fechaHasta.setHours(23, 59, 59, 999);
                where.fecha[Op.lte] = fechaHasta;
            }
        }

        const movimientos = await Gasto.findAll({
            where,
            order: [['fecha', 'DESC']]
        });

        const total = movimientos.reduce(
            (totalAcumulado, item) => totalAcumulado + Number(item.monto),
            0
        );

        return res.json({
            movimientos,
            total: Number(total.toFixed(2)),
            cantidad: movimientos.length
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            error: 'Error al filtrar los movimientos'
        });
    }
}

async function obtenerHistorialMesActual(req, res) {
    try {
        const userId = req.user.id;
        const ahora = new Date();
        const anio = ahora.getFullYear();
        const mes = ahora.getMonth();

        const inicioMes = new Date(anio, mes, 1, 0, 0, 0, 0);
        const finMes = new Date(anio, mes + 1, 0, 23, 59, 59, 999);

        const movimientos = await Gasto.findAll({
            where: {
                userId,
                fecha: {
                    [Op.gte]: inicioMes,
                    [Op.lte]: finMes
                }
            },
            order: [['fecha', 'DESC']]
        });

        return res.status(200).json(movimientos);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error al consultar movimientos del mes' });
    }
}

module.exports = {
    registrarGasto,
    obtenerGastos,
    eliminarGasto,
    editarGasto,
    pagarGasto,
    filtrarGastos,
    obtenerHistorialMesActual
};