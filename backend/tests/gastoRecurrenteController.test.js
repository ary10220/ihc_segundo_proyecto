// Gastos recurrentes: crear (y generar el de hoy), listar y desactivar.
jest.mock('../src/models/Gasto', () => ({ findOne: jest.fn() }));
jest.mock('../src/models/GastoRecurrente', () => ({ create: jest.fn(), findAll: jest.fn(), findOne: jest.fn() }));
jest.mock('../src/services/gastoRecurrenteService', () => {
    const real = jest.requireActual('../src/services/gastoRecurrenteService');
    return {
        fechaLocalHoy: jest.fn(() => '2026-11-18'),
        fechaValida: real.fechaValida,
        procesarRecurrenciasVencidas: jest.fn()
    };
});

const Gasto = require('../src/models/Gasto');
const GastoRecurrente = require('../src/models/GastoRecurrente');
const { procesarRecurrenciasVencidas } = require('../src/services/gastoRecurrenteService');
const {
    crearGastoRecurrente,
    obtenerGastosRecurrentes,
    desactivarGastoRecurrente
} = require('../src/controllers/gastoRecurrenteController');

function crearRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
}

const valido = { monto: '45', motivo: '  Internet  ', categoria: ' Estudio ', frecuencia: 'mensual', fechaInicio: '2026-12-01' };

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => console.error.mockRestore());

describe('crearGastoRecurrente', () => {
    test('con fecha futura solo guarda la recurrencia, sin generar gasto', async () => {
        GastoRecurrente.create.mockResolvedValue({ id: 5 });
        const res = crearRes();

        await crearGastoRecurrente({ user: { id: 7 }, body: valido }, res);

        expect(GastoRecurrente.create).toHaveBeenCalledWith({
            userId: 7, monto: 45, motivo: 'Internet', categoria: 'estudio',
            frecuencia: 'mensual', proximaFecha: '2026-12-01', activa: true
        });
        expect(procesarRecurrenciasVencidas).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json.mock.calls[0][0].gastoGenerado).toBeNull();
    });

    test('sin categoría usa «otros»', async () => {
        GastoRecurrente.create.mockResolvedValue({ id: 5 });
        const res = crearRes();

        await crearGastoRecurrente({ user: { id: 7 }, body: { ...valido, categoria: undefined } }, res);

        expect(GastoRecurrente.create).toHaveBeenCalledWith(expect.objectContaining({ categoria: 'otros' }));
    });

    test('si empieza hoy genera el gasto de hoy y lo devuelve', async () => {
        const recurrencia = { id: 5, reload: jest.fn(), destroy: jest.fn(), ultimoError: null };
        GastoRecurrente.create.mockResolvedValue(recurrencia);
        Gasto.findOne.mockResolvedValue({ id: 30, monto: 45 });
        const res = crearRes();

        await crearGastoRecurrente({ user: { id: 7 }, body: { ...valido, fechaInicio: '2026-11-18' } }, res);

        expect(procesarRecurrenciasVencidas).toHaveBeenCalledWith(7);
        expect(Gasto.findOne).toHaveBeenCalledWith({ where: { recurrenciaId: 5, fechaProgramada: '2026-11-18' } });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json.mock.calls[0][0].gastoGenerado).toEqual({ id: 30, monto: 45 });
    });

    test('si el gasto de hoy no cabe en el presupuesto, deshace la recurrencia y explica por qué', async () => {
        const recurrencia = { id: 5, reload: jest.fn(), destroy: jest.fn(), ultimoError: null };
        recurrencia.reload.mockImplementation(async () => {
            recurrencia.ultimoError = 'El gasto recurrente supera el presupuesto mensual disponible';
        });
        GastoRecurrente.create.mockResolvedValue(recurrencia);
        const res = crearRes();

        await crearGastoRecurrente({ user: { id: 7 }, body: { ...valido, fechaInicio: '2026-11-18' } }, res);

        expect(recurrencia.destroy).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'El gasto recurrente supera el presupuesto mensual disponible' });
    });

    test.each([
        ['monto ausente', { monto: undefined }],
        ['monto nulo', { monto: null }],
        ['monto vacío', { monto: '' }],
        ['monto no numérico', { monto: 'diez' }],
        ['monto negativo', { monto: -3 }],
        ['motivo en blanco', { motivo: '   ' }],
        ['sin motivo', { motivo: undefined }],
        ['motivo demasiado largo', { motivo: 'x'.repeat(256) }],
        ['categoría inexistente', { categoria: 'lujos' }],
        ['frecuencia inválida', { frecuencia: 'diaria' }],
        ['fecha con formato inválido', { fechaInicio: '01/12/2026' }],
        ['fecha en el pasado', { fechaInicio: '2026-11-17' }]
    ])('rechaza %s con 400', async (_caso, cambio) => {
        const res = crearRes();

        await crearGastoRecurrente({ user: { id: 7 }, body: { ...valido, ...cambio } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(GastoRecurrente.create).not.toHaveBeenCalled();
    });

    test('un fallo al guardar responde 500', async () => {
        GastoRecurrente.create.mockRejectedValue(new Error('db caída'));
        const res = crearRes();

        await crearGastoRecurrente({ user: { id: 7 }, body: valido }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'No se pudo guardar el gasto recurrente' });
    });
});

describe('obtenerGastosRecurrentes', () => {
    test('procesa las vencidas del usuario y lista solo las suyas', async () => {
        GastoRecurrente.findAll.mockResolvedValue([{ id: 1 }]);
        const res = crearRes();

        await obtenerGastosRecurrentes({ user: { id: 7 } }, res);

        expect(procesarRecurrenciasVencidas).toHaveBeenCalledWith(7);
        expect(GastoRecurrente.findAll).toHaveBeenCalledWith({ where: { userId: 7 }, order: [['proximaFecha', 'ASC']] });
        expect(res.json).toHaveBeenCalledWith({ recurrentes: [{ id: 1 }] });
    });

    test('un fallo responde 500', async () => {
        procesarRecurrenciasVencidas.mockRejectedValueOnce(new Error('db caída'));
        const res = crearRes();

        await obtenerGastosRecurrentes({ user: { id: 7 } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('desactivarGastoRecurrente', () => {
    test('desactiva la recurrencia propia', async () => {
        const recurrencia = { activa: true, save: jest.fn() };
        GastoRecurrente.findOne.mockResolvedValue(recurrencia);
        const res = crearRes();

        await desactivarGastoRecurrente({ user: { id: 7 }, params: { id: '3' } }, res);

        expect(GastoRecurrente.findOne).toHaveBeenCalledWith({ where: { id: '3', userId: 7 } });
        expect(recurrencia.activa).toBe(false);
        expect(recurrencia.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ message: 'Gasto recurrente desactivado correctamente' });
    });

    test('la recurrencia de otra persona responde 404', async () => {
        GastoRecurrente.findOne.mockResolvedValue(null);
        const res = crearRes();

        await desactivarGastoRecurrente({ user: { id: 7 }, params: { id: '3' } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('un fallo responde 500', async () => {
        GastoRecurrente.findOne.mockRejectedValue(new Error('db caída'));
        const res = crearRes();

        await desactivarGastoRecurrente({ user: { id: 7 }, params: { id: '3' } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
