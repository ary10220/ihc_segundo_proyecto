// Tarea 10 · ver, exportar y casos de error de Mis datos.
const modelo = () => ({ findAll: jest.fn(), destroy: jest.fn() });
jest.mock('../src/config/database', () => ({ transaction: jest.fn(async (fn) => fn('t')) }));
jest.mock('../src/models/User', () => ({ findByPk: jest.fn() }));
jest.mock('../src/models/Gasto', () => modelo());
jest.mock('../src/models/GastoRecurrente', () => modelo());
jest.mock('../src/models/Presupuesto', () => modelo());
jest.mock('../src/models/PresupuestoCategoria', () => modelo());
jest.mock('../src/models/Meta', () => modelo());
jest.mock('../src/models/MovimientoMeta', () => modelo());

const User = require('../src/models/User');
const Gasto = require('../src/models/Gasto');
const GastoRecurrente = require('../src/models/GastoRecurrente');
const Presupuesto = require('../src/models/Presupuesto');
const PresupuestoCategoria = require('../src/models/PresupuestoCategoria');
const Meta = require('../src/models/Meta');
const MovimientoMeta = require('../src/models/MovimientoMeta');
const {
    verMisDatos,
    exportarMisDatos,
    eliminarCuenta,
    escaparCsv
} = require('../src/controllers/misDatosController');

const usuario = { name: 'Ana', email: 'ana@test.com', createdAt: '2026-10-01' };
const movimientos = Array.from({ length: 7 }, (_, i) => ({
    fecha: `2026-11-1${i}`, tipo: 'gasto', categoria: 'comida', motivo: `M${i}`, monto: 10 + i, estado: 'pendiente'
}));

function respuesta() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.setHeader = jest.fn();
    res.send = jest.fn(() => res);
    return res;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    User.findByPk.mockResolvedValue(usuario);
    Gasto.findAll.mockResolvedValue(movimientos);
    for (const m of [GastoRecurrente, Presupuesto, PresupuestoCategoria, Meta, MovimientoMeta]) {
        m.findAll.mockResolvedValue([{}]);
    }
});

afterEach(() => console.log.mockRestore());

describe('ver mis datos', () => {
    test('muestra la cuenta, los conteos y solo los 5 últimos movimientos', async () => {
        const res = respuesta();

        await verMisDatos({ user: { id: 7 } }, res);

        const cuerpo = res.json.mock.calls[0][0];
        expect(cuerpo.cuenta).toBe(usuario);
        expect(cuerpo.conteos).toEqual({
            movimientos: 7, recurrentes: 1, presupuestos: 1, limitesCategoria: 1, metas: 1, movimientosMetas: 1
        });
        expect(cuerpo.ultimosMovimientos).toHaveLength(5);
        expect(Gasto.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 7 } }));
    });

    test('usuario inexistente responde 404', async () => {
        User.findByPk.mockResolvedValueOnce(null);
        const res = respuesta();

        await verMisDatos({ user: { id: 7 } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('un fallo de base de datos responde 500', async () => {
        Gasto.findAll.mockRejectedValueOnce(new Error('db caida'));
        const res = respuesta();

        await verMisDatos({ user: { id: 7 } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'No pudimos cargar tus datos' });
    });
});

describe('exportar mis datos', () => {
    test('sin formato descarga un JSON con todos los datos', async () => {
        const res = respuesta();

        await exportarMisDatos({ user: { id: 7 }, query: {} }, res);

        expect(res.setHeader).toHaveBeenCalledWith(
            'Content-Disposition', expect.stringMatching(/mis-datos-\d{4}-\d{2}-\d{2}\.json/)
        );
        const cuerpo = res.json.mock.calls[0][0];
        expect(cuerpo.usuario).toBe(usuario);
        expect(cuerpo.movimientos).toHaveLength(7);
        expect(cuerpo.exportadoEl).toBeDefined();
    });

    test('en CSV descarga solo los movimientos', async () => {
        const res = respuesta();

        await exportarMisDatos({ user: { id: 7 }, query: { formato: 'CSV' } }, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
        const lineas = res.send.mock.calls[0][0].split('\n');
        expect(lineas).toHaveLength(8);
        expect(lineas[1]).toBe('2026-11-10,gasto,comida,M0,10.00,pendiente');
    });

    test('un formato desconocido responde 400 sin leer datos', async () => {
        const res = respuesta();

        await exportarMisDatos({ user: { id: 7 }, query: { formato: 'xml' } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(User.findByPk).not.toHaveBeenCalled();
    });

    test('usuario inexistente responde 404', async () => {
        User.findByPk.mockResolvedValueOnce(null);
        const res = respuesta();

        await exportarMisDatos({ user: { id: 7 }, query: { formato: 'json' } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('un fallo de base de datos responde 500', async () => {
        Gasto.findAll.mockRejectedValueOnce(new Error('db caida'));
        const res = respuesta();

        await exportarMisDatos({ user: { id: 7 }, query: { formato: 'csv' } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('eliminar cuenta · errores', () => {
    test('usuario inexistente responde 404', async () => {
        User.findByPk.mockResolvedValueOnce(null);
        const res = respuesta();

        await eliminarCuenta({ user: { id: 7 }, body: { confirmar: true } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(Gasto.destroy).not.toHaveBeenCalled();
    });

    test('si falla la transacción responde 500 y avisa que no se borró nada', async () => {
        User.findByPk.mockResolvedValueOnce({ destroy: jest.fn() });
        Gasto.destroy.mockRejectedValueOnce(new Error('db caida'));
        const res = respuesta();

        await eliminarCuenta({ user: { id: 7 }, body: { confirmar: true } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].error).toMatch(/No se borró nada/);
    });
});

describe('escaparCsv', () => {
    test('deja vacío lo nulo y no altera números negativos', () => {
        expect(escaparCsv(null)).toBe('');
        expect(escaparCsv(undefined)).toBe('');
        expect(escaparCsv('-25')).toBe('-25');
    });
});
