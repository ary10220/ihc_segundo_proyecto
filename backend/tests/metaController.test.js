// Metas de ahorro: crear, asignar, retirar y transferir fondos.
// Reglas: solo el dueño mueve fondos, nunca se mueve más de lo que hay
// y los intentos rechazados por falta de fondos quedan registrados.
jest.mock('../src/config/database', () => ({ transaction: jest.fn() }));
jest.mock('../src/models/Meta', () => ({ findOne: jest.fn(), create: jest.fn(), findAll: jest.fn() }));
jest.mock('../src/models/MovimientoMeta', () => ({ findAll: jest.fn(), create: jest.fn() }));
jest.mock('../src/models/Gasto', () => ({ findAll: jest.fn() }));

const sequelize = require('../src/config/database');
const Meta = require('../src/models/Meta');
const MovimientoMeta = require('../src/models/MovimientoMeta');
const Gasto = require('../src/models/Gasto');
const {
    listarMetas,
    crearMeta,
    asignarFondos,
    retirarFondos,
    transferirFondos
} = require('../src/controllers/metaController');

const T = { LOCK: { UPDATE: 'UPDATE' } };

function crearRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
}

function meta(datos) {
    return { save: jest.fn(), ...datos };
}

// Saldo: ingresos 1000, gastos 200 y lo reservado en las metas que devuelva Meta.findAll.
function saldoCon(metas) {
    Gasto.findAll.mockResolvedValue([{ tipo: 'ingreso', monto: 1000 }, { tipo: 'gasto', monto: 200 }]);
    Meta.findAll.mockResolvedValue(metas);
}

beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockImplementation((fn) => fn(T));
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => console.error.mockRestore());

describe('listarMetas', () => {
    test('devuelve saldo, metas ordenadas por id y últimos movimientos', async () => {
        saldoCon([{ id: 3, ahorrado: 100 }, { id: 1, ahorrado: 50 }]);
        MovimientoMeta.findAll.mockResolvedValue([{ id: 9, tipo: 'asignacion' }]);
        const res = crearRes();

        await listarMetas({ user: { id: 7 } }, res);

        const cuerpo = res.json.mock.calls[0][0];
        expect(cuerpo.metas.map((m) => m.id)).toEqual([1, 3]);
        expect(cuerpo.disponible).toBe(650);
        expect(cuerpo.movimientos).toHaveLength(1);
        expect(MovimientoMeta.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 7 }, limit: 50 }));
    });

    test('un fallo de base de datos responde 500 sin detalles internos', async () => {
        Gasto.findAll.mockRejectedValue(new Error('db caída'));
        Meta.findAll.mockResolvedValue([]);
        const res = crearRes();

        await listarMetas({ user: { id: 7 } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error al procesar la meta' });
    });
});

describe('crearMeta', () => {
    const body = { nombre: '  Laptop  ', montoObjetivo: '1500.456', fechaObjetivo: '2027-06-01' };

    test('crea la meta con nombre limpio, monto redondeado y ahorro en cero', async () => {
        Meta.create.mockResolvedValue({ id: 1 });
        const res = crearRes();

        await crearMeta({ user: { id: 7 }, body }, res);

        expect(Meta.create).toHaveBeenCalledWith({
            userId: 7, nombre: 'Laptop', montoObjetivo: 1500.46, fechaObjetivo: '2027-06-01', ahorrado: 0
        });
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test.each([
        ['sin nombre', { ...body, nombre: '' }, 'La meta necesita un nombre'],
        ['nombre en blanco', { ...body, nombre: '   ' }, 'La meta necesita un nombre'],
        ['monto vacío', { ...body, montoObjetivo: '' }, 'Debes indicar un monto positivo'],
        ['monto ausente', { ...body, montoObjetivo: undefined }, 'Debes indicar un monto positivo'],
        ['monto nulo', { ...body, montoObjetivo: null }, 'Debes indicar un monto positivo'],
        ['monto no numérico', { ...body, montoObjetivo: 'abc' }, 'Debes indicar un monto positivo'],
        ['monto cero', { ...body, montoObjetivo: 0 }, 'Debes indicar un monto positivo'],
        ['sin fecha', { ...body, fechaObjetivo: '' }, 'Debes indicar una fecha objetivo válida'],
        ['fecha inválida', { ...body, fechaObjetivo: 'mañana' }, 'Debes indicar una fecha objetivo válida']
    ])('rechaza %s con 400 y no crea nada', async (_caso, datos, mensaje) => {
        const res = crearRes();

        await crearMeta({ user: { id: 7 }, body: datos }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: mensaje });
        expect(Meta.create).not.toHaveBeenCalled();
    });
});

describe('asignarFondos', () => {
    test('suma al ahorro de la meta y registra la asignación', async () => {
        const laptop = meta({ id: 2, nombre: 'Laptop', ahorrado: '100' });
        Meta.findOne.mockResolvedValue(laptop);
        saldoCon([laptop]);
        const res = crearRes();

        await asignarFondos({ user: { id: 7 }, params: { id: '2' }, body: { monto: 50 } }, res);

        expect(Meta.findOne).toHaveBeenCalledWith({ where: { id: 2, userId: 7 }, transaction: T, lock: 'UPDATE' });
        expect(laptop.ahorrado).toBe(150);
        expect(laptop.save).toHaveBeenCalledWith({ transaction: T });
        expect(MovimientoMeta.create).toHaveBeenCalledWith(
            expect.objectContaining({ tipo: 'asignacion', monto: 50, metaDestinoId: 2 }),
            { transaction: T }
        );
        expect(res.json).toHaveBeenCalledWith({ message: 'Fondos asignados', meta: laptop });
    });

    test('sin fondos suficientes responde 400 y deja registrado el rechazo', async () => {
        const laptop = meta({ id: 2, nombre: 'Laptop', ahorrado: '700' });
        Meta.findOne.mockResolvedValue(laptop);
        saldoCon([laptop]); // disponible = 1000 - 200 - 700 = 100
        const res = crearRes();

        await asignarFondos({ user: { id: 7 }, params: { id: '2' }, body: { monto: 150 } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Fondos insuficientes: disponible Bs 100.00' });
        expect(laptop.save).not.toHaveBeenCalled();
        expect(MovimientoMeta.create).toHaveBeenCalledWith({
            userId: 7, tipo: 'rechazado', monto: 150, metaOrigenId: null, metaDestinoId: 2,
            detalle: 'Fondos insuficientes: disponible Bs 100.00'
        });
    });

    test('si no se puede guardar el rechazo igual responde el error de fondos', async () => {
        const laptop = meta({ id: 2, nombre: 'Laptop', ahorrado: '800' });
        Meta.findOne.mockResolvedValue(laptop);
        saldoCon([laptop]);
        MovimientoMeta.create.mockRejectedValueOnce(new Error('db caída'));
        const res = crearRes();

        await asignarFondos({ user: { id: 7 }, params: { id: '2' }, body: { monto: 'x1' } }, res);
        expect(res.status).toHaveBeenCalledWith(400); // monto inválido: no es rechazo por fondos

        const res2 = crearRes();
        await asignarFondos({ user: { id: 7 }, params: { id: '2' }, body: { monto: 500 } }, res2);
        expect(res2.status).toHaveBeenCalledWith(400);
        expect(console.error).toHaveBeenCalledWith('No se pudo registrar el rechazo', expect.any(Error));
    });

    test('la meta de otra persona responde 404 y no registra rechazo', async () => {
        Meta.findOne.mockResolvedValue(null);
        const res = crearRes();

        await asignarFondos({ user: { id: 7 }, params: { id: '99' }, body: { monto: 10 } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Meta no encontrada' });
        expect(MovimientoMeta.create).not.toHaveBeenCalled();
    });
});

describe('retirarFondos', () => {
    test('resta del ahorro de la meta y registra el retiro', async () => {
        const viaje = meta({ id: 4, nombre: 'Viaje', ahorrado: '80.5' });
        Meta.findOne.mockResolvedValue(viaje);
        const res = crearRes();

        await retirarFondos({ user: { id: 7 }, params: { id: '4' }, body: { monto: '30.25' } }, res);

        expect(viaje.ahorrado).toBe(50.25);
        expect(MovimientoMeta.create).toHaveBeenCalledWith(
            expect.objectContaining({ tipo: 'retiro', monto: 30.25, metaOrigenId: 4 }),
            { transaction: T }
        );
        expect(res.json).toHaveBeenCalledWith({ message: 'Fondos retirados', meta: viaje });
    });

    test('no deja retirar más de lo ahorrado y registra el rechazo', async () => {
        const viaje = meta({ id: 4, nombre: 'Viaje', ahorrado: '20' });
        Meta.findOne.mockResolvedValue(viaje);
        const res = crearRes();

        await retirarFondos({ user: { id: 7 }, params: { id: '4' }, body: { monto: 25 } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Fondos insuficientes en Viaje: tiene Bs 20.00' });
        expect(MovimientoMeta.create).toHaveBeenCalledWith(
            expect.objectContaining({ tipo: 'rechazado', metaOrigenId: 4, metaDestinoId: null })
        );
    });

    test('un monto inválido responde 400 sin abrir transacción', async () => {
        const res = crearRes();

        await retirarFondos({ user: { id: 7 }, params: { id: '4' }, body: { monto: -5 } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(sequelize.transaction).not.toHaveBeenCalled();
    });
});

describe('transferirFondos', () => {
    test('mueve el monto de una meta a otra y registra la transferencia', async () => {
        const origen = meta({ id: 1, nombre: 'Viaje', ahorrado: '100' });
        const destino = meta({ id: 2, nombre: 'Laptop', ahorrado: '10' });
        Meta.findOne.mockResolvedValueOnce(origen).mockResolvedValueOnce(destino);
        const res = crearRes();

        await transferirFondos({ user: { id: 7 }, body: { origenId: 1, destinoId: 2, monto: 40 } }, res);

        expect(origen.ahorrado).toBe(60);
        expect(destino.ahorrado).toBe(50);
        expect(MovimientoMeta.create).toHaveBeenCalledWith(
            expect.objectContaining({ tipo: 'transferencia', detalle: 'Viaje → Laptop', metaOrigenId: 1, metaDestinoId: 2 }),
            { transaction: T }
        );
        expect(res.json).toHaveBeenCalledWith({ message: 'Transferencia realizada', origen, destino });
    });

    test.each([
        ['sin origen', { destinoId: 2 }],
        ['sin destino', { origenId: 1 }],
        ['la misma meta', { origenId: 1, destinoId: '1' }]
    ])('rechaza %s', async (_caso, ids) => {
        const res = crearRes();

        await transferirFondos({ user: { id: 7 }, body: { ...ids, monto: 10 } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Elige dos metas distintas para transferir' });
    });

    test('no transfiere más de lo que tiene el origen y registra el rechazo', async () => {
        Meta.findOne
            .mockResolvedValueOnce(meta({ id: 1, nombre: 'Viaje', ahorrado: '5' }))
            .mockResolvedValueOnce(meta({ id: 2, nombre: 'Laptop', ahorrado: '0' }));
        const res = crearRes();

        await transferirFondos({ user: { id: 7 }, body: { origenId: 1, destinoId: 2, monto: 6 } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(MovimientoMeta.create).toHaveBeenCalledWith(
            expect.objectContaining({ tipo: 'rechazado', monto: 6, metaOrigenId: 1, metaDestinoId: 2 })
        );
    });

    test('un rechazo sin monto numérico se registra con monto 0', async () => {
        Meta.findOne
            .mockResolvedValueOnce(meta({ id: 1, nombre: 'Viaje', ahorrado: '5' }))
            .mockResolvedValueOnce(meta({ id: 2, nombre: 'Laptop', ahorrado: '0' }));
        const res = crearRes();
        const req = { user: { id: 7 }, body: { origenId: 1, destinoId: 2, monto: 6 } };
        // El monto se valida primero; luego simulamos que el body cambió a un valor no numérico.
        sequelize.transaction.mockImplementationOnce(async (fn) => {
            req.body.monto = 'seis';
            return fn(T);
        });

        await transferirFondos(req, res);

        expect(MovimientoMeta.create).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'rechazado', monto: 0 }));
    });
});
