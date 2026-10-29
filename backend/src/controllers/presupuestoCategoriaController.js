const PresupuestoCategoria = require('../models/PresupuestoCategoria');
const Gasto = require('../models/Gasto');
const { Op } = require('sequelize');

const CATEGORIAS_VALIDAS = ['otros', 'comida', 'transporte', 'estudio'];

function calcularRangoDelMes(mes, anio) {
    return {
        inicioMes: new Date(anio, mes - 1, 1),
        inicioMesSiguiente: new Date(anio, mes, 1)
    };
}

async function calcularConsumido(userId, categoria, mes, anio) {
    const { inicioMes, inicioMesSiguiente } = calcularRangoDelMes(mes, anio);

    const gastos = await Gasto.findAll({
        where: {
            userId,
            categoria,
            fecha: {
                [Op.gte]: inicioMes,
                [Op.lt]: inicioMesSiguiente
            }
        },
        attributes: ['monto']
    });

    return gastos.reduce(
        (total, gasto) => total + Number(gasto.monto),
        0
    );
}

async function establecerPresupuestoCategoria(req, res) {
    try {
        const { categoria, limite, mes, anio } = req.body;

        const categoriaNormalizada =
            typeof categoria === 'string' ? categoria.trim().toLowerCase() : '';

        if (
            !categoriaNormalizada ||
            limite === undefined ||
            !Number.isFinite(Number(limite)) ||
            Number(limite) <= 0 ||
            !Number.isInteger(Number(mes)) ||
            Number(mes) < 1 ||
            Number(mes) > 12 ||
            !Number.isInteger(Number(anio)) ||
            Number(anio) < 2000
        ) {
            return res.status(400).json({
                error: 'Debes proporcionar una categoría, un límite positivo, un mes válido y un año válido'
            });
        }

        if (!CATEGORIAS_VALIDAS.includes(categoriaNormalizada)) {
            return res.status(400).json({
                error: 'La categoría debe ser una de: otros, comida, transporte, estudio'
            });
        }

        const userId = req.user.id;
        const mesNumero = Number(mes);
        const anioNumero = Number(anio);
        const limiteNumero = Number(limite);

        const consumido = await calcularConsumido(
            userId,
            categoriaNormalizada,
            mesNumero,
            anioNumero
        );

        if (limiteNumero < consumido) {
            return res.status(400).json({
                error: 'El límite no puede ser menor que lo que ya has gastado en esa categoría'
            });
        }

        const presupuesto = await PresupuestoCategoria.findOne({
            where: {
                userId,
                categoria: categoriaNormalizada,
                mes: mesNumero,
                anio: anioNumero
            }
        });

        if (presupuesto) {
            presupuesto.limite = limiteNumero;
            await presupuesto.save();

            return res.json({
                message: 'Presupuesto por categoría actualizado correctamente',
                presupuesto
            });
        }

        const nuevoPresupuesto = await PresupuestoCategoria.create({
            userId,
            categoria: categoriaNormalizada,
            limite: limiteNumero,
            mes: mesNumero,
            anio: anioNumero
        });

        return res.status(201).json({
            message: 'Presupuesto por categoría establecido correctamente',
            presupuesto: nuevoPresupuesto
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al establecer el presupuesto por categoría'
        });
    }
}

async function obtenerPresupuestoCategoria(req, res) {
    try {
        const mes = Number(req.query.mes);
        const anio = Number(req.query.anio);
        const userId = req.user.id;

        if (
            !Number.isInteger(mes) ||
            mes < 1 ||
            mes > 12 ||
            !Number.isInteger(anio) ||
            anio < 2000
        ) {
            return res.status(400).json({
                error: 'Debes indicar un mes y un año válidos'
            });
        }

        const categorias = [];

        for (const categoria of CATEGORIAS_VALIDAS) {
            const presupuesto = await PresupuestoCategoria.findOne({
                where: {
                    userId,
                    categoria,
                    mes,
                    anio
                }
            });

            const consumido = await calcularConsumido(
                userId,
                categoria,
                mes,
                anio
            );

            const consumidoRedondeado = Number(consumido.toFixed(2));

            if (!presupuesto) {
                categorias.push({
                    categoria,
                    limite: null,
                    consumido: consumidoRedondeado,
                    restante: null
                });

                continue;
            }

            const limite = Number(presupuesto.limite);

            categorias.push({
                categoria,
                limite,
                consumido: consumidoRedondeado,
                restante: Number((limite - consumido).toFixed(2))
            });
        }

        return res.json({
            mes,
            anio,
            categorias
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al consultar los presupuestos por categoría'
        });
    }
}

module.exports = {
    CATEGORIAS_VALIDAS,
    establecerPresupuestoCategoria,
    obtenerPresupuestoCategoria
};
