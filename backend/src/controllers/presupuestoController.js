const Presupuesto = require('../models/Presupuesto');
const Gasto = require('../models/Gasto');
const { Op } = require('sequelize');

// El presupuesto mide lo que se gasta: los ingresos no cuentan como "gastado".
const SOLO_GASTOS = { [Op.ne]: 'ingreso' };

async function establecerPresupuesto(req, res) {
    try {
        const { limite, mes, anio } = req.body;
        const userId = req.user.id;

        if (
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
                error: 'Debes proporcionar un límite positivo, un mes válido y un año válido'
            });
        }

        const inicioMes = new Date(Number(anio), Number(mes) - 1, 1);
        const inicioMesSiguiente = new Date(Number(anio), Number(mes), 1);

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

        const gastado = gastos.reduce(
            (total, gasto) => total + Number(gasto.monto),
            0
        );

        if (Number(limite) < gastado) {
            return res.status(400).json({
                error: 'El límite no puede ser menor que lo que ya has gastado en el mes'
            });
        }

        const presupuesto = await Presupuesto.findOne({
            where: { userId, mes: Number(mes), anio: Number(anio) }
        });

        if (presupuesto) {
            presupuesto.limite = Number(limite);
            await presupuesto.save();

            return res.json({
                message: 'Presupuesto mensual actualizado correctamente',
                presupuesto
            });
        }

        const nuevoPresupuesto = await Presupuesto.create({
            userId,
            limite: Number(limite),
            mes: Number(mes),
            anio: Number(anio)
        });

        return res.status(201).json({
            message: 'Presupuesto mensual establecido correctamente',
            presupuesto: nuevoPresupuesto
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al establecer el presupuesto mensual'
        });
    }
}

async function obtenerPresupuesto(req, res) {
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

        const presupuesto = await Presupuesto.findOne({
            where: { userId, mes, anio }
        });

        if (!presupuesto) {
            return res.status(404).json({
                error: 'No existe un presupuesto para ese mes'
            });
        }

        const inicioMes = new Date(anio, mes - 1, 1);
        const inicioMesSiguiente = new Date(anio, mes, 1);

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

        const gastado = gastos.reduce(
            (total, gasto) => total + Number(gasto.monto),
            0
        );

        const limite = Number(presupuesto.limite);

        return res.json({
            presupuesto,
            gastado: Number(gastado.toFixed(2)),
            disponible: Number((limite - gastado).toFixed(2))
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al consultar el presupuesto mensual'
        });
    }
}

module.exports = {
    establecerPresupuesto,
    obtenerPresupuesto
};
