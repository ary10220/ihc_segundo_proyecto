jest.mock('../src/config/database', () => ({
    transaction: jest.fn()
}));
jest.mock('../src/models/Gasto', () => ({
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn()
}));
jest.mock('../src/models/GastoRecurrente', () => ({
    findAll: jest.fn()
}));
jest.mock('../src/models/Presupuesto', () => ({
    findOne: jest.fn()
}));

const sequelize = require('../src/config/database');
const Gasto = require('../src/models/Gasto');
const GastoRecurrente = require('../src/models/GastoRecurrente');
const Presupuesto = require('../src/models/Presupuesto');
const {
    fechaLocalHoy,
    fechaValida,
    siguienteFecha,
    procesarRecurrenciasVencidas,
    procesarTodasLasRecurrencias
} = require('../src/services/gastoRecurrenteService');

describe('gastoRecurrenteService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.transaction.mockImplementation((callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
        Gasto.findOne.mockResolvedValue(null);
        Gasto.findAll.mockResolvedValue([{ monto: '10.00' }]);
        Gasto.create.mockResolvedValue({ id: 20 });
        Presupuesto.findOne.mockResolvedValue({ limite: '100.00' });
    });

    test('valida fecha ISO y suma siete días a la frecuencia semanal', () => {
        expect(fechaValida('2026-11-03')).toBe(true);
        expect(fechaValida('2026-02-30')).toBe(false);
        expect(fechaValida('03/11/2026')).toBe(false);
        expect(siguienteFecha('2026-11-03', 'semanal')).toBe('2026-11-10');
    });

    test('la frecuencia mensual avanza al mes siguiente y ajusta fin de mes', () => {
        expect(siguienteFecha('2026-01-31', 'mensual')).toBe('2026-02-28');
        expect(siguienteFecha('2028-01-31', 'mensual')).toBe('2028-02-29');
    });

    test('crea la ocurrencia vencida dentro del presupuesto y avanza la fecha', async () => {
        const fecha = fechaLocalHoy();
        const recurrencia = {
            id: 4,
            userId: 9,
            monto: '25.00',
            motivo: 'Pasaje',
            categoria: 'transporte',
            frecuencia: 'semanal',
            proximaFecha: fecha,
            ultimoError: null,
            save: jest.fn()
        };
        GastoRecurrente.findAll.mockResolvedValue([recurrencia]);

        await procesarRecurrenciasVencidas(9);

        expect(Gasto.create).toHaveBeenCalledWith(
            expect.objectContaining({
                recurrenciaId: 4,
                fechaProgramada: fecha,
                monto: 25,
                categoria: 'transporte'
            }),
            expect.any(Object)
        );
        expect(recurrencia.proximaFecha).toBe(siguienteFecha(fecha, 'semanal'));
        expect(recurrencia.ultimoError).toBeNull();
    });

    test('no genera una ocurrencia si falta el presupuesto y conserva la fecha vencida', async () => {
        const fecha = fechaLocalHoy();
        const recurrencia = {
            id: 5,
            userId: 9,
            monto: '25.00',
            motivo: 'Pasaje',
            categoria: 'transporte',
            frecuencia: 'mensual',
            proximaFecha: fecha,
            ultimoError: null,
            save: jest.fn()
        };
        GastoRecurrente.findAll.mockResolvedValue([recurrencia]);
        Presupuesto.findOne.mockResolvedValue(null);

        await procesarRecurrenciasVencidas(9);

        expect(Gasto.create).not.toHaveBeenCalled();
        expect(recurrencia.proximaFecha).toBe(fecha);
        expect(recurrencia.ultimoError).toMatch(/presupuesto mensual/i);
    });
});

describe('gastoRecurrenteService · casos límite', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.transaction.mockImplementation((callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
    });

    const recurrenciaDeHoy = (extra = {}) => ({
        id: 8, userId: 9, monto: '300.00', motivo: 'Alquiler', categoria: 'otros',
        frecuencia: 'mensual', proximaFecha: fechaLocalHoy(), ultimoError: null, save: jest.fn(), ...extra
    });

    test('no genera la ocurrencia si supera el presupuesto disponible del mes', async () => {
        const recurrencia = recurrenciaDeHoy();
        GastoRecurrente.findAll.mockResolvedValue([recurrencia]);
        Gasto.findOne.mockResolvedValue(null);
        Presupuesto.findOne.mockResolvedValue({ limite: '500' });
        Gasto.findAll.mockResolvedValue([{ monto: '250' }]); // disponible 250 < 300

        await procesarRecurrenciasVencidas(9);

        expect(Gasto.create).not.toHaveBeenCalled();
        expect(recurrencia.ultimoError).toBe('El gasto recurrente supera el presupuesto mensual disponible');
        expect(recurrencia.save).toHaveBeenCalled();
    });

    test('si la ocurrencia de esa fecha ya existe no la duplica', async () => {
        const recurrencia = recurrenciaDeHoy();
        GastoRecurrente.findAll.mockResolvedValue([recurrencia]);
        Gasto.findOne.mockResolvedValue({ id: 77 });

        await procesarRecurrenciasVencidas(9);

        expect(Gasto.create).not.toHaveBeenCalled();
        expect(recurrencia.proximaFecha).toBe(siguienteFecha(fechaLocalHoy(), 'mensual'));
    });

    test('sin usuario procesa las recurrencias de todos', async () => {
        GastoRecurrente.findAll.mockResolvedValue([]);

        await procesarRecurrenciasVencidas();

        expect(GastoRecurrente.findAll.mock.calls[0][0].where.userId).toBeUndefined();
    });

    test('procesarTodasLasRecurrencias procesa a cada usuario con recurrencias activas', async () => {
        GastoRecurrente.findAll
            .mockResolvedValueOnce([{ userId: 1 }, { userId: 2 }])
            .mockResolvedValue([]);

        await procesarTodasLasRecurrencias();

        expect(GastoRecurrente.findAll).toHaveBeenCalledWith({ where: { activa: true }, attributes: ['userId'], group: ['userId'] });
        const usuarios = GastoRecurrente.findAll.mock.calls.slice(1).map((c) => c[0].where.userId);
        expect(usuarios).toEqual([1, 2]);
    });

    test('fechaValida rechaza valores que no son texto o fechas imposibles', () => {
        expect(fechaValida(20261118)).toBe(false);
        expect(fechaValida('2026-02-30')).toBe(false);
        expect(fechaValida('2026-02-28')).toBe(true);
    });

    test('siguienteFecha mensual ajusta al último día del mes siguiente', () => {
        expect(siguienteFecha('2026-01-31', 'mensual')).toBe('2026-02-28');
    });
});
