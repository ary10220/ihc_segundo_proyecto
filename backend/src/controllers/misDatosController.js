const sequelize = require('../config/database');
const User = require('../models/User');
const Gasto = require('../models/Gasto');
const GastoRecurrente = require('../models/GastoRecurrente');
const Presupuesto = require('../models/Presupuesto');
const PresupuestoCategoria = require('../models/PresupuestoCategoria');
const Meta = require('../models/Meta');
const MovimientoMeta = require('../models/MovimientoMeta');

// Tarea 10 · Mis datos y salida honesta.
// Regla de Presupuesto Estudiantil: al eliminar la cuenta se elimina TODO
// (movimientos, presupuestos y metas). Antes puede descargar sus movimientos.
// Ningun dato de esta app afecta a otra persona, asi que la eliminacion nunca se bloquea.

const COLUMNAS_CSV = ['fecha', 'tipo', 'categoria', 'motivo', 'monto', 'estado'];

function escaparCsv(valor) {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    // Evita inyeccion de formulas al abrir el CSV en Excel.
    const seguro = /^[=+\-@]/.test(texto) && Number.isNaN(Number(texto)) ? `'${texto}` : texto;
    return /[",\n;]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

function movimientosACsv(movimientos) {
    const filas = movimientos.map((m) => [
        m.fecha instanceof Date ? m.fecha.toISOString().slice(0, 10) : String(m.fecha).slice(0, 10),
        m.tipo,
        m.categoria,
        m.motivo,
        Number(m.monto).toFixed(2),
        m.estado
    ].map(escaparCsv).join(','));
    return [COLUMNAS_CSV.join(','), ...filas].join('\n');
}

async function reunirDatos(userId) {
    const where = { userId };
    const [usuario, movimientos, recurrentes, presupuestos, limitesCategoria, metas, movimientosMetas] = await Promise.all([
        User.findByPk(userId, { attributes: ['name', 'email', 'createdAt'] }),
        Gasto.findAll({ where, order: [['fecha', 'DESC']], raw: true }),
        GastoRecurrente.findAll({ where, raw: true }),
        Presupuesto.findAll({ where, order: [['anio', 'DESC'], ['mes', 'DESC']], raw: true }),
        PresupuestoCategoria.findAll({ where, raw: true }),
        Meta.findAll({ where, raw: true }),
        MovimientoMeta.findAll({ where, order: [['createdAt', 'DESC']], raw: true })
    ]);
    return { usuario, movimientos, recurrentes, presupuestos, limitesCategoria, metas, movimientosMetas };
}

// GET /api/mis-datos -> lo que la app guarda del usuario, para verlo en pantalla.
async function verMisDatos(req, res) {
    try {
        const datos = await reunirDatos(req.user.id);
        if (!datos.usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
        return res.json({
            cuenta: datos.usuario,
            conteos: {
                movimientos: datos.movimientos.length,
                recurrentes: datos.recurrentes.length,
                presupuestos: datos.presupuestos.length,
                limitesCategoria: datos.limitesCategoria.length,
                metas: datos.metas.length,
                movimientosMetas: datos.movimientosMetas.length
            },
            ultimosMovimientos: datos.movimientos.slice(0, 5)
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'No pudimos cargar tus datos' });
    }
}

// GET /api/mis-datos/exportar?formato=json|csv
async function exportarMisDatos(req, res) {
    try {
        const formato = String(req.query.formato || 'json').toLowerCase();
        if (!['json', 'csv'].includes(formato)) {
            return res.status(400).json({ error: 'Formato no valido. Usa json o csv.' });
        }
        const datos = await reunirDatos(req.user.id);
        if (!datos.usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

        const fecha = new Date().toISOString().slice(0, 10);
        if (formato === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="mis-movimientos-${fecha}.csv"`);
            return res.send(movimientosACsv(datos.movimientos));
        }
        res.setHeader('Content-Disposition', `attachment; filename="mis-datos-${fecha}.json"`);
        return res.json({ exportadoEl: new Date().toISOString(), ...datos });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'No pudimos preparar la descarga' });
    }
}

// DELETE /api/mis-datos/cuenta  body: { confirmar: true }
async function eliminarCuenta(req, res) {
    const userId = req.user.id;
    if (req.body?.confirmar !== true) {
        return res.status(400).json({
            error: 'Falta confirmar la eliminación.',
            queHacer: 'Confirma en el diálogo «Eliminar mi cuenta» para continuar.'
        });
    }
    try {
        const usuario = await User.findByPk(userId);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

        const eliminados = await sequelize.transaction(async (t) => {
            const where = { userId };
            const opts = { where, transaction: t };
            const conteo = {
                movimientos: await Gasto.destroy(opts),
                recurrentes: await GastoRecurrente.destroy(opts),
                presupuestos: await Presupuesto.destroy(opts),
                limitesCategoria: await PresupuestoCategoria.destroy(opts),
                movimientosMetas: await MovimientoMeta.destroy(opts),
                metas: await Meta.destroy(opts)
            };
            await usuario.destroy({ transaction: t });
            return conteo;
        });

        return res.json({ message: 'Tu cuenta y todos tus datos fueron eliminados.', eliminados });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            error: 'No pudimos eliminar tu cuenta. No se borró nada.',
            queHacer: 'Intenta de nuevo en unos minutos.'
        });
    }
}

module.exports = { verMisDatos, exportarMisDatos, eliminarCuenta, movimientosACsv, escaparCsv };
