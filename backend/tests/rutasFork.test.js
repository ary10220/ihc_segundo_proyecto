// Rutas que agregó el fork: cada endpoint existe con su método
// y, salvo la analítica (anónima a propósito), exige sesión.
const { authenticateToken } = require('../src/middleware/authMiddleware');

function rutas(router) {
    return router.stack.map((capa) => ({
        metodo: Object.keys(capa.route.methods)[0].toUpperCase(),
        ruta: capa.route.path,
        conSesion: capa.route.stack.some((s) => s.handle === authenticateToken)
    }));
}

test('metas', () => {
    expect(rutas(require('../src/routes/metaRoutes'))).toEqual([
        { metodo: 'GET', ruta: '/', conSesion: true },
        { metodo: 'POST', ruta: '/', conSesion: true },
        { metodo: 'POST', ruta: '/transferir', conSesion: true },
        { metodo: 'POST', ruta: '/:id/asignar', conSesion: true },
        { metodo: 'POST', ruta: '/:id/retirar', conSesion: true }
    ]);
});

test('mis datos', () => {
    expect(rutas(require('../src/routes/misDatosRoutes'))).toEqual([
        { metodo: 'GET', ruta: '/', conSesion: true },
        { metodo: 'GET', ruta: '/exportar', conSesion: true },
        { metodo: 'DELETE', ruta: '/cuenta', conSesion: true }
    ]);
});

test('gastos recurrentes', () => {
    const lista = rutas(require('../src/routes/gastoRecurrenteRoutes'));
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((r) => r.conSesion)).toBe(true);
});

test('presupuesto por categoría', () => {
    const lista = rutas(require('../src/routes/presupuestoCategoriaRoutes'));
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((r) => r.conSesion)).toBe(true);
});

test('analítica es anónima: no pide sesión ni guarda el usuario', () => {
    expect(rutas(require('../src/routes/analiticaRoutes'))).toEqual([
        { metodo: 'POST', ruta: '/evento', conSesion: false },
        { metodo: 'GET', ruta: '/resumen', conSesion: false },
        { metodo: 'GET', ruta: '/ultimos', conSesion: false }
    ]);
});
