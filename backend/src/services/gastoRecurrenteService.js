const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Gasto = require('../models/Gasto');
const GastoRecurrente = require('../models/GastoRecurrente');
const Presupuesto = require('../models/Presupuesto');

function fechaLocalHoy() {
    const ahora = new Date();
    const year = ahora.getFullYear();
    const month = String(ahora.getMonth() + 1).padStart(2, '0');
    const day = String(ahora.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function fechaValida(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return false;
    }
    const fecha = new Date(`${valor}T00:00:00.000Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function siguienteFecha(fechaProgramada, frecuencia) {
    const fecha = new Date(`${fechaProgramada}T12:00:00.000Z`);
    if (frecuencia === 'semanal') {
        fecha.setUTCDate(fecha.getUTCDate() + 7);
    } else {
        const diaOriginal = fecha.getUTCDate();
        fecha.setUTCDate(1);
        fecha.setUTCMonth(fecha.getUTCMonth() + 1);
        const ultimoDia = new Date(Date.UTC(
            fecha.getUTCFullYear(),
            fecha.getUTCMonth() + 1,
            0
        )).getUTCDate();
        fecha.setUTCDate(Math.min(diaOriginal, ultimoDia));
    }
    return fecha.toISOString().slice(0, 10);
}

function rangoMes(fechaProgramada) {
    const [year, month] = fechaProgramada.split('-').map(Number);
    return {
        mes: month,
        anio: year,
        inicio: new Date(year, month - 1, 1),
        fin: new Date(year, month, 1)
    };
}

async function crearOcurrencia(recurrencia, fechaProgramada, transaction) {
    const existente = await Gasto.findOne({
        where: { recurrenciaId: recurrencia.id, fechaProgramada },
        transaction
    });
    if (existente) return { gasto: existente };

    const periodo = rangoMes(fechaProgramada);
    const presupuesto = await Presupuesto.findOne({
        where: {
            userId: recurrencia.userId,
            mes: periodo.mes,
            anio: periodo.anio
        },
        transaction
    });
    if (!presupuesto) {
        return { error: 'Establece un presupuesto mensual para generar este gasto recurrente' };
    }

    const gastosMes = await Gasto.findAll({
        where: {
            userId: recurrencia.userId,
            tipo: { [Op.ne]: 'ingreso' },
            fecha: { [Op.gte]: periodo.inicio, [Op.lt]: periodo.fin }
        },
        attributes: ['monto'],
        transaction
    });
    const gastado = gastosMes.reduce((total, gasto) => total + Number(gasto.monto), 0);
    const disponible = Number(presupuesto.limite) - gastado;
    if (Number(recurrencia.monto) > disponible) {
        return { error: 'El gasto recurrente supera el presupuesto mensual disponible' };
    }

    const gasto = await Gasto.create({
        monto: Number(recurrencia.monto),
        motivo: recurrencia.motivo,
        fecha: new Date(`${fechaProgramada}T12:00:00`),
        userId: recurrencia.userId,
        tipo: 'gasto',
        categoria: recurrencia.categoria,
        recurrenciaId: recurrencia.id,
        fechaProgramada
    }, { transaction });
    return { gasto };
}

async function procesarRecurrenciasVencidas(userId) {
    const hoy = fechaLocalHoy();
    return sequelize.transaction(async (transaction) => {
        const where = {
            activa: true,
            proximaFecha: { [Op.lte]: hoy }
        };
        if (userId !== undefined) where.userId = userId;

        const pendientes = await GastoRecurrente.findAll({
            where,
            order: [['proximaFecha', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        for (const recurrencia of pendientes) {
            let vueltas = 0;
            while (recurrencia.proximaFecha <= hoy && vueltas < 600) {
                const fechaProgramada = recurrencia.proximaFecha;
                const resultado = await crearOcurrencia(
                    recurrencia,
                    fechaProgramada,
                    transaction
                );
                if (resultado.error) {
                    recurrencia.ultimoError = resultado.error;
                    break;
                }
                recurrencia.proximaFecha = siguienteFecha(
                    fechaProgramada,
                    recurrencia.frecuencia
                );
                recurrencia.ultimoError = null;
                vueltas += 1;
            }
            await recurrencia.save({ transaction });
        }
        return pendientes;
    });
}

async function procesarTodasLasRecurrencias() {
    const usuarios = await GastoRecurrente.findAll({
        where: { activa: true },
        attributes: ['userId'],
        group: ['userId']
    });
    for (const usuario of usuarios) {
        await procesarRecurrenciasVencidas(usuario.userId);
    }
}

module.exports = {
    fechaLocalHoy,
    fechaValida,
    siguienteFecha,
    procesarRecurrenciasVencidas,
    procesarTodasLasRecurrencias
};
