const sequelize = require('../config/database');
const Meta = require('../models/Meta');
const MovimientoMeta = require('../models/MovimientoMeta');
const { obtenerSaldo, redondear } = require('../services/metaService');

class ErrorNegocio extends Error {
    constructor(status, mensaje, sinFondos = false) {
        super(mensaje);
        this.status = status;
        this.sinFondos = sinFondos;
    }
}

function validarMonto(monto) {
    const n = Number(monto);
    if (monto === undefined || monto === null || monto === '' || !Number.isFinite(n) || n <= 0) {
        throw new ErrorNegocio(400, 'Debes indicar un monto positivo');
    }
    return redondear(n);
}

// Solo el dueño puede ver o mover fondos de una meta: para otro usuario "no existe".
// Siempre se llama dentro de una transacción y bloquea la fila hasta terminar.
async function buscarMetaPropia(id, userId, transaction) {
    const meta = await Meta.findOne({
        where: { id: Number(id), userId },
        transaction,
        lock: transaction.LOCK.UPDATE
    });
    if (!meta) throw new ErrorNegocio(404, 'Meta no encontrada');
    return meta;
}

// Conserva también los intentos rechazados por falta de fondos.
async function registrarRechazo(userId, monto, detalle, origen, destino) {
    try {
        await MovimientoMeta.create({
            userId,
            tipo: 'rechazado',
            monto: Number(monto) || 0,
            metaOrigenId: origen || null,
            metaDestinoId: destino || null,
            detalle
        });
    } catch (e) {
        console.error('No se pudo registrar el rechazo', e);
    }
}

function responderError(res, error) {
    if (error instanceof ErrorNegocio) return res.status(error.status).json({ error: error.message });
    console.error(error);
    return res.status(500).json({ error: 'Error al procesar la meta' });
}

async function listarMetas(req, res) {
    try {
        const userId = req.user.id;
        const saldo = await obtenerSaldo(userId);
        const movimientos = await MovimientoMeta.findAll({
            where: { userId },
            order: [['createdAt', 'DESC'], ['id', 'DESC']],
            limit: 50
        });
        const metas = [...saldo.metas].sort((a, b) => a.id - b.id);
        return res.json({ ...saldo, metas, movimientos });
    } catch (error) {
        return responderError(res, error);
    }
}

async function crearMeta(req, res) {
    try {
        const { nombre, montoObjetivo, fechaObjetivo } = req.body;
        if (!nombre || !String(nombre).trim()) throw new ErrorNegocio(400, 'La meta necesita un nombre');
        const objetivo = validarMonto(montoObjetivo);
        if (!fechaObjetivo || Number.isNaN(new Date(fechaObjetivo).getTime())) {
            throw new ErrorNegocio(400, 'Debes indicar una fecha objetivo válida');
        }
        const meta = await Meta.create({
            userId: req.user.id,
            nombre: String(nombre).trim(),
            montoObjetivo: objetivo,
            fechaObjetivo,
            ahorrado: 0
        });
        return res.status(201).json({ message: 'Meta creada', meta });
    } catch (error) {
        return responderError(res, error);
    }
}

async function asignarFondos(req, res) {
    const userId = req.user.id;
    try {
        const monto = validarMonto(req.body.monto);
        const meta = await sequelize.transaction(async (t) => {
            const meta = await buscarMetaPropia(req.params.id, userId, t);
            const { disponible } = await obtenerSaldo(userId, t);
            if (monto > disponible) {
                throw new ErrorNegocio(400, `Fondos insuficientes: disponible Bs ${disponible.toFixed(2)}`, true);
            }
            meta.ahorrado = redondear(Number(meta.ahorrado) + monto);
            await meta.save({ transaction: t });
            await MovimientoMeta.create({
                userId, tipo: 'asignacion', monto, metaDestinoId: meta.id,
                detalle: `Asignación a ${meta.nombre}`
            }, { transaction: t });
            return meta;
        });
        return res.json({ message: 'Fondos asignados', meta });
    } catch (error) {
        if (error.sinFondos) await registrarRechazo(userId, req.body.monto, error.message, null, Number(req.params.id));
        return responderError(res, error);
    }
}

async function retirarFondos(req, res) {
    const userId = req.user.id;
    try {
        const monto = validarMonto(req.body.monto);
        const meta = await sequelize.transaction(async (t) => {
            const meta = await buscarMetaPropia(req.params.id, userId, t);
            if (monto > Number(meta.ahorrado)) {
                throw new ErrorNegocio(400, `Fondos insuficientes en ${meta.nombre}: tiene Bs ${Number(meta.ahorrado).toFixed(2)}`, true);
            }
            meta.ahorrado = redondear(Number(meta.ahorrado) - monto);
            await meta.save({ transaction: t });
            await MovimientoMeta.create({
                userId, tipo: 'retiro', monto, metaOrigenId: meta.id,
                detalle: `Retiro de ${meta.nombre}`
            }, { transaction: t });
            return meta;
        });
        return res.json({ message: 'Fondos retirados', meta });
    } catch (error) {
        if (error.sinFondos) await registrarRechazo(userId, req.body.monto, error.message, Number(req.params.id), null);
        return responderError(res, error);
    }
}

async function transferirFondos(req, res) {
    const userId = req.user.id;
    const { origenId, destinoId } = req.body;
    try {
        const monto = validarMonto(req.body.monto);
        if (!origenId || !destinoId || Number(origenId) === Number(destinoId)) {
            throw new ErrorNegocio(400, 'Elige dos metas distintas para transferir');
        }
        const resultado = await sequelize.transaction(async (t) => {
            const origen = await buscarMetaPropia(origenId, userId, t);
            const destino = await buscarMetaPropia(destinoId, userId, t);
            if (monto > Number(origen.ahorrado)) {
                throw new ErrorNegocio(400, `Fondos insuficientes en ${origen.nombre}: tiene Bs ${Number(origen.ahorrado).toFixed(2)}`, true);
            }
            origen.ahorrado = redondear(Number(origen.ahorrado) - monto);
            destino.ahorrado = redondear(Number(destino.ahorrado) + monto);
            await origen.save({ transaction: t });
            await destino.save({ transaction: t });
            await MovimientoMeta.create({
                userId, tipo: 'transferencia', monto, metaOrigenId: origen.id, metaDestinoId: destino.id,
                detalle: `${origen.nombre} → ${destino.nombre}`
            }, { transaction: t });
            return { origen, destino };
        });
        return res.json({ message: 'Transferencia realizada', ...resultado });
    } catch (error) {
        if (error.sinFondos) await registrarRechazo(userId, req.body.monto, error.message, Number(origenId), Number(destinoId));
        return responderError(res, error);
    }
}

module.exports = { listarMetas, crearMeta, asignarFondos, retirarFondos, transferirFondos };
