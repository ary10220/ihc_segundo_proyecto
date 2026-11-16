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
const Meta = require('../src/models/Meta');
const Presupuesto = require('../src/models/Presupuesto');
const { eliminarCuenta, movimientosACsv, escaparCsv } = require('../src/controllers/misDatosController');

const respuesta = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
};

describe('Tarea 10 · eliminar cuenta', () => {
    beforeEach(() => jest.clearAllMocks());

    test('sin confirmar no borra nada y dice qué hacer', async () => {
        const res = respuesta();
        await eliminarCuenta({ user: { id: 1 }, body: {} }, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].queHacer).toBeDefined();
        expect(Gasto.destroy).not.toHaveBeenCalled();
    });

    test('confirmado borra movimientos, presupuestos, metas y la cuenta', async () => {
        const destroyUsuario = jest.fn();
        User.findByPk.mockResolvedValue({ destroy: destroyUsuario });
        Gasto.destroy.mockResolvedValue(3);
        const res = respuesta();
        await eliminarCuenta({ user: { id: 7 }, body: { confirmar: true } }, res);
        for (const m of [Gasto, Meta, Presupuesto]) {
            expect(m.destroy).toHaveBeenCalledWith({ where: { userId: 7 }, transaction: 't' });
        }
        expect(destroyUsuario).toHaveBeenCalled();
        expect(res.json.mock.calls[0][0].eliminados.movimientos).toBe(3);
    });
});

describe('Tarea 10 · CSV de movimientos', () => {
    test('cabecera y filas con comillas escapadas', () => {
        const csv = movimientosACsv([
            { fecha: new Date('2026-11-10T00:00:00Z'), tipo: 'gasto', categoria: 'comida', motivo: 'Pizza, refresco', monto: '25', estado: 'pagado' }
        ]);
        expect(csv.split('\n')[0]).toBe('fecha,tipo,categoria,motivo,monto,estado');
        expect(csv.split('\n')[1]).toBe('2026-11-10,gasto,comida,"Pizza, refresco",25.00,pagado');
    });

    test('neutraliza fórmulas de Excel', () => {
        expect(escaparCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    });
});
