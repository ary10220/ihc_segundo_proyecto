const {
    establecerPresupuestoCategoria,
    obtenerPresupuestoCategoria
} = require('../src/controllers/presupuestoCategoriaController');

const PresupuestoCategoria = require('../src/models/PresupuestoCategoria');
const Gasto = require('../src/models/Gasto');

jest.mock('../src/models/PresupuestoCategoria');
jest.mock('../src/models/Gasto');

function crearRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };
}

describe('establecerPresupuestoCategoria', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('debe crear un presupuesto por categoria valido', async () => {

        Gasto.findAll.mockResolvedValue([
            { monto: 50 }
        ]);

        PresupuestoCategoria.findOne.mockResolvedValue(null);

        const nuevoPresupuesto = {
            id: 1,
            userId: 1,
            categoria: 'comida',
            mes: 11,
            anio: 2026,
            limite: 300
        };

        PresupuestoCategoria.create.mockResolvedValue(nuevoPresupuesto);

        const req = {
            body: {
                categoria: 'comida',
                limite: 300,
                mes: 11,
                anio: 2026
            },
            user: {
                id: 1
            }
        };

        const res = crearRes();

        await establecerPresupuestoCategoria(req, res);

        expect(res.status).toHaveBeenCalledWith(201);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Presupuesto por categoría establecido correctamente',
            presupuesto: nuevoPresupuesto
        });

        expect(PresupuestoCategoria.create).toHaveBeenCalledWith({
            userId: 1,
            categoria: 'comida',
            limite: 300,
            mes: 11,
            anio: 2026
        });

    });

    test('debe rechazar un limite vacio, en cero o negativo', async () => {

        const casosInvalidos = [
            { categoria: 'comida', limite: 0, mes: 11, anio: 2026 },
            { categoria: 'comida', limite: -50, mes: 11, anio: 2026 },
            { categoria: 'comida', limite: '', mes: 11, anio: 2026 },
            { categoria: '', limite: 300, mes: 11, anio: 2026 },
            { categoria: 'comida', limite: 300, mes: 13, anio: 2026 }
        ];

        for (const body of casosInvalidos) {

            const req = {
                body,
                user: {
                    id: 1
                }
            };

            const res = crearRes();

            await establecerPresupuestoCategoria(req, res);

            expect(res.status).toHaveBeenCalledWith(400);

            expect(res.json).toHaveBeenCalledWith({
                error: 'Debes proporcionar una categoría, un límite positivo, un mes válido y un año válido'
            });

        }

        expect(PresupuestoCategoria.create).not.toHaveBeenCalled();

    });

    test('debe rechazar una categoria que no esta en la lista fija', async () => {

        const req = {
            body: {
                categoria: 'viajes',
                limite: 100,
                mes: 11,
                anio: 2026
            },
            user: {
                id: 1
            }
        };

        const res = crearRes();

        await establecerPresupuestoCategoria(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            error: 'La categoría debe ser una de: otros, comida, transporte, estudio'
        });

        expect(PresupuestoCategoria.create).not.toHaveBeenCalled();

    });

    test('debe rechazar el limite si es menor a lo consumido en la categoria', async () => {

        Gasto.findAll.mockResolvedValue([
            { monto: 120 },
            { monto: 80 }
        ]);

        const req = {
            body: {
                categoria: 'comida',
                limite: 100,
                mes: 11,
                anio: 2026
            },
            user: {
                id: 1
            }
        };

        const res = crearRes();

        await establecerPresupuestoCategoria(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            error: 'El límite no puede ser menor que lo que ya has gastado en esa categoría'
        });

        expect(PresupuestoCategoria.create).not.toHaveBeenCalled();

    });

    test('debe actualizar el presupuesto existente sin crear un duplicado', async () => {

        Gasto.findAll.mockResolvedValue([
            { monto: 100 }
        ]);

        const presupuestoExistente = {
            id: 5,
            userId: 1,
            categoria: 'estudio',
            mes: 11,
            anio: 2026,
            limite: 200,
            save: jest.fn().mockResolvedValue(undefined)
        };

        PresupuestoCategoria.findOne.mockResolvedValue(presupuestoExistente);

        const req = {
            body: {
                categoria: 'Estudio',
                limite: 350,
                mes: 11,
                anio: 2026
            },
            user: {
                id: 1
            }
        };

        const res = crearRes();

        await establecerPresupuestoCategoria(req, res);

        expect(presupuestoExistente.limite).toBe(350);

        expect(presupuestoExistente.save).toHaveBeenCalled();

        expect(PresupuestoCategoria.create).not.toHaveBeenCalled();

        expect(res.status).not.toHaveBeenCalled();

        expect(res.json).toHaveBeenCalledWith({
            message: 'Presupuesto por categoría actualizado correctamente',
            presupuesto: presupuestoExistente
        });

    });

});

describe('obtenerPresupuestoCategoria', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('debe devolver las 4 categorias con limite, consumido y restante', async () => {

        PresupuestoCategoria.findOne.mockImplementation(({ where }) => {
            if (where.categoria === 'comida') {
                return Promise.resolve({
                    id: 1,
                    userId: 1,
                    categoria: 'comida',
                    mes: 11,
                    anio: 2026,
                    limite: 300
                });
            }

            if (where.categoria === 'transporte') {
                return Promise.resolve({
                    id: 2,
                    userId: 1,
                    categoria: 'transporte',
                    mes: 11,
                    anio: 2026,
                    limite: 150
                });
            }

            return Promise.resolve(null);
        });

        Gasto.findAll.mockImplementation(({ where }) => {
            if (where.categoria === 'comida') {
                return Promise.resolve([
                    { monto: 70 },
                    { monto: 50 }
                ]);
            }

            if (where.categoria === 'transporte') {
                return Promise.resolve([
                    { monto: 50 }
                ]);
            }

            if (where.categoria === 'estudio') {
                return Promise.resolve([
                    { monto: 40 }
                ]);
            }

            return Promise.resolve([]);
        });

        const req = {
            query: {
                mes: '11',
                anio: '2026'
            },
            user: {
                id: 1
            }
        };

        const res = crearRes();

        await obtenerPresupuestoCategoria(req, res);

        expect(res.json).toHaveBeenCalledWith({
            mes: 11,
            anio: 2026,
            categorias: [
                {
                    categoria: 'otros',
                    limite: null,
                    consumido: 0,
                    restante: null
                },
                {
                    categoria: 'comida',
                    limite: 300,
                    consumido: 120,
                    restante: 180
                },
                {
                    categoria: 'transporte',
                    limite: 150,
                    consumido: 50,
                    restante: 100
                },
                {
                    categoria: 'estudio',
                    limite: null,
                    consumido: 40,
                    restante: null
                }
            ]
        });

        expect(PresupuestoCategoria.findOne).toHaveBeenCalledWith({
            where: {
                userId: 1,
                categoria: 'comida',
                mes: 11,
                anio: 2026
            }
        });

        expect(Gasto.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: 1,
                    categoria: 'comida'
                })
            })
        );

    });

});
