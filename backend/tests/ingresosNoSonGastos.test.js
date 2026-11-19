// Los ingresos no consumen presupuesto: no cuentan como "gastado" ni se comparan con el límite.
jest.mock('../src/models/Presupuesto', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../src/models/Gasto', () => ({ findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() }));
jest.mock('../src/models/PresupuestoCategoria', () => ({ findOne: jest.fn() }));

const { Op } = require('sequelize');
const Presupuesto = require('../src/models/Presupuesto');
const Gasto = require('../src/models/Gasto');
const { establecerPresupuesto, obtenerPresupuesto } = require('../src/controllers/presupuestoController');
const { registrarGasto, editarGasto } = require('../src/controllers/gastoController');

const SOLO_GASTOS = { [Op.ne]: 'ingreso' };

function crearRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
}

const filtroDeTipo = () => Gasto.findAll.mock.calls[0][0].where.tipo;

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => console.log.mockRestore());

describe('el presupuesto solo suma gastos', () => {
    test('consultar el presupuesto excluye los ingresos del «gastado»', async () => {
        Presupuesto.findOne.mockResolvedValue({ limite: 1500 });
        Gasto.findAll.mockResolvedValue([{ monto: 60 }, { monto: 45 }]);
        const res = crearRes();

        await obtenerPresupuesto({ user: { id: 7 }, query: { mes: '11', anio: '2026' } }, res);

        expect(filtroDeTipo()).toEqual(SOLO_GASTOS);
        expect(res.json.mock.calls[0][0]).toMatchObject({ gastado: 105, disponible: 1395 });
    });

    test('guardar el presupuesto compara el límite solo contra los gastos', async () => {
        Gasto.findAll.mockResolvedValue([]);
        Presupuesto.findOne.mockResolvedValue(null);
        Presupuesto.create.mockResolvedValue({ id: 1 });
        const res = crearRes();

        await establecerPresupuesto({ user: { id: 7 }, body: { limite: 500, mes: 11, anio: 2026 } }, res);

        expect(filtroDeTipo()).toEqual(SOLO_GASTOS);
        expect(res.status).toHaveBeenCalledWith(201);
    });
});

describe('registrar y editar', () => {
    test('un ingreso mayor que el disponible se registra igual', async () => {
        Presupuesto.findOne.mockResolvedValue({ limite: 300 });
        Gasto.findAll.mockResolvedValue([{ monto: 250 }]); // disponible 50
        Gasto.create.mockImplementation(async (datos) => datos);
        const res = crearRes();

        await registrarGasto({ user: { id: 7 }, body: { monto: 1200, motivo: 'Mesada', tipo: 'ingreso' } }, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(Gasto.create).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'ingreso', monto: 1200 }));
    });

    test('un gasto se compara con el disponible calculado sin ingresos', async () => {
        Presupuesto.findOne.mockResolvedValue({ limite: 300 });
        Gasto.findAll.mockResolvedValue([{ monto: 250 }]);
        const res = crearRes();

        await registrarGasto({ user: { id: 7 }, body: { monto: 60, motivo: 'Pasajes', tipo: 'gasto' } }, res);

        expect(filtroDeTipo()).toEqual(SOLO_GASTOS);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0]).toMatchObject({ gastado: 250, disponible: 50 });
        expect(Gasto.create).not.toHaveBeenCalled();
    });

    test('editar un ingreso a un monto mayor que el disponible está permitido', async () => {
        const ingreso = { id: 3, userId: 7, estado: 'Pendiente', tipo: 'ingreso', fecha: new Date(), save: jest.fn() };
        Gasto.findByPk.mockResolvedValue(ingreso);
        Presupuesto.findOne.mockResolvedValue({ limite: 300 });
        Gasto.findAll.mockResolvedValue([{ monto: 280 }]);
        const res = crearRes();

        await editarGasto({ user: { id: 7 }, params: { id: '3' }, body: { monto: 2000, motivo: 'Mesada' } }, res);

        expect(filtroDeTipo()).toEqual(SOLO_GASTOS);
        expect(ingreso.save).toHaveBeenCalled();
        expect(ingreso.monto).toBe(2000);
    });

    test('editar un gasto sigue bloqueando si supera el disponible', async () => {
        const gasto = { id: 4, userId: 7, estado: 'Pendiente', tipo: 'gasto', fecha: new Date(), save: jest.fn() };
        Gasto.findByPk.mockResolvedValue(gasto);
        Presupuesto.findOne.mockResolvedValue({ limite: 300 });
        Gasto.findAll.mockResolvedValue([{ monto: 280 }]);
        const res = crearRes();

        await editarGasto({ user: { id: 7 }, params: { id: '4' }, body: { monto: 50, motivo: 'Libro' } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(gasto.save).not.toHaveBeenCalled();
    });
});
