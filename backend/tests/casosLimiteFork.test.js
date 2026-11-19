// Casos límite y de error de analítica y presupuesto por categoría
// (lo que no cubren las pruebas de flujo feliz de cada tarea).
jest.mock('../src/models/Evento', () => ({ create: jest.fn(), findAll: jest.fn() }));
jest.mock('../src/models/PresupuestoCategoria', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../src/models/Gasto', () => ({ findAll: jest.fn() }));

const Evento = require('../src/models/Evento');
const PresupuestoCategoria = require('../src/models/PresupuestoCategoria');
const Gasto = require('../src/models/Gasto');
const { registrarEvento, obtenerResumen, obtenerUltimos } = require('../src/controllers/analiticaController');
const {
    calcularEstado,
    establecerPresupuestoCategoria,
    obtenerPresupuestoCategoria
} = require('../src/controllers/presupuestoCategoriaController');

function crearRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('analítica', () => {
    test('props que no son un objeto se guardan vacías', async () => {
        Evento.create.mockImplementation(async (datos) => datos);
        const res = crearRes();

        await registrarEvento({ body: { evento: 'movimiento_iniciado', props: 'texto libre' } }, res);

        expect(Evento.create).toHaveBeenCalledWith(expect.objectContaining({ props: {} }));
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('descarta props nulas o ausentes', async () => {
        Evento.create.mockImplementation(async (datos) => datos);
        const res = crearRes();

        await registrarEvento({ body: { evento: 'movimiento_guardado', props: { tipo: 'Gasto', categoria: null } } }, res);

        expect(Evento.create).toHaveBeenCalledWith(expect.objectContaining({ props: { tipo: 'gasto' } }));
    });

    test('un pedido sin cuerpo responde 400', async () => {
        const res = crearRes();

        await registrarEvento({}, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('si no se puede guardar el evento responde 500', async () => {
        Evento.create.mockRejectedValue(new Error('db caida'));
        const res = crearRes();

        await registrarEvento({ body: { evento: 'movimiento_guardado' } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error al registrar el evento' });
    });

    test('el resumen sin eventos guardados cuenta cero', async () => {
        Evento.findAll.mockResolvedValue([
            { get: (campo) => ({ evento: 'movimiento_iniciado', cantidad: '4' })[campo] }
        ]);
        const res = crearRes();

        await obtenerResumen({}, res);

        expect(res.json).toHaveBeenCalledWith({
            conteos: { movimiento_iniciado: 4 }, iniciados: 4, guardados: 0, porcentajeExito: 0
        });
    });

    test('si falla el resumen responde 500', async () => {
        Evento.findAll.mockRejectedValue(new Error('db caida'));
        const res = crearRes();

        await obtenerResumen({}, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });

    test('últimos eventos: devuelve los 10 más recientes', async () => {
        Evento.findAll.mockResolvedValue([{ id: 1 }]);
        const res = crearRes();

        await obtenerUltimos({}, res);

        expect(Evento.findAll).toHaveBeenCalledWith({ order: [['fecha', 'DESC'], ['id', 'DESC']], limit: 10 });
        expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
    });

    test('últimos eventos: si falla responde 500', async () => {
        Evento.findAll.mockRejectedValue(new Error('db caida'));
        const res = crearRes();

        await obtenerUltimos({}, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('presupuesto por categoría', () => {
    test.each([
        [null, 10, 'sin-limite', 0],
        [0, 10, 'sin-limite', 0],
        [100, 50, 'ok', 50],
        [100, 80, 'alerta', 80],
        [100, 100, 'alerta', 100],
        [100, 130, 'excedido', 130]
    ])('calcularEstado(límite %p, consumido %p) → %s', (limite, consumido, estado, porcentaje) => {
        expect(calcularEstado(limite, consumido)).toEqual({ estado, porcentaje });
    });

    test('una categoría que no es texto responde 400', async () => {
        const res = crearRes();

        await establecerPresupuestoCategoria(
            { user: { id: 7 }, body: { categoria: 5, limite: 100, mes: 11, anio: 2026 } },
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(PresupuestoCategoria.create).not.toHaveBeenCalled();
    });

    test('si falla la base de datos al establecer responde 500', async () => {
        Gasto.findAll.mockRejectedValue(new Error('db caida'));
        const res = crearRes();

        await establecerPresupuestoCategoria(
            { user: { id: 7 }, body: { categoria: 'comida', limite: 100, mes: 11, anio: 2026 } },
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error al establecer el presupuesto por categoría' });
    });

    test.each([
        ['mes fuera de rango', { mes: '13', anio: '2026' }],
        ['mes no numérico', { mes: 'once', anio: '2026' }],
        ['año inválido', { mes: '11', anio: '1999' }]
    ])('consultar con %s responde 400', async (_caso, query) => {
        const res = crearRes();

        await obtenerPresupuestoCategoria({ user: { id: 7 }, query }, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('consultar sin sesión válida responde 500', async () => {
        const res = crearRes();

        await obtenerPresupuestoCategoria({ query: { mes: '11', anio: '2026' } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
