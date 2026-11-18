// Guion automatizado para grabar el video de presentacion (5 min aprox).
// Recorre la app desplegada paso a paso, inyecta un banner estilo clase
// y un resaltado amarillo sobre el elemento activo. El resultado es un
// video .webm en evidencias/presentacion/.
//
// Para correrlo (con los browsers locales de Playwright):
//   node e2e/run-presentacion.mjs
//
// Credenciales (las mismas que se usan en la defensa):
//   e2e@test.com / e2e12345

import { chromium } from '@playwright/test';
import { mkdir, rename, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'evidencias', 'presentacion');
const APP = 'https://presupuesto-estudiantil.vercel.app';
const USER = { email: 'e2e@test.com', password: 'e2e12345' };

await mkdir(OUT_DIR, { recursive: true });

// Despierta el backend de Render (cold start ~30s si estuvo dormido) antes
// de arrancar la grabacion, para que el login no dispare el timeout.
async function despertarBackend() {
    const url = 'https://presupuesto-estudiantil.onrender.com/api/auth/login';
    for (let i = 0; i < 6; i++) {
        try {
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: USER.email, password: USER.password })
            });
            if (r.ok) {
                console.log('[warmup] backend listo');
                return;
            }
        } catch {}
        console.log(`[warmup] esperando backend (${i + 1}/6)...`);
        await new Promise((r) => setTimeout(r, 10000));
    }
    console.warn('[warmup] el backend no respondio a tiempo; igual continuamos');
}
await despertarBackend();

const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1280,800']
});

const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } }
});

const page = await context.newPage();

async function inyectarUI() {
    try {
        await page.addStyleTag({
            content: `
                #presentacion-banner {
                    position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
                    background: linear-gradient(90deg, #1e40af 0%, #6d28d9 100%);
                    color: #fff; padding: 12px 24px;
                    font-family: 'Segoe UI', Roboto, sans-serif;
                    box-shadow: 0 2px 12px rgba(0,0,0,.35);
                    pointer-events: none;
                    border-bottom: 3px solid #000;
                }
                #presentacion-banner .paso {
                    font-size: 11px; letter-spacing: 1.5px;
                    opacity: .85; text-transform: uppercase; font-weight: 600;
                }
                #presentacion-banner .titulo {
                    font-size: 19px; font-weight: 800; line-height: 1.2;
                    margin-top: 2px;
                }
                #presentacion-banner .sub {
                    font-size: 14px; opacity: .95; margin-top: 3px; font-weight: 500;
                }
                .presentacion-highlight {
                    box-shadow: 0 0 0 4px #fde047,
                                0 0 22px 8px rgba(253, 224, 71, .85) !important;
                    border-radius: 6px !important;
                    transition: box-shadow .2s ease-in-out;
                    position: relative; z-index: 2147483646 !important;
                }
                body { padding-top: 90px !important; }
            `
        });
    } catch {
        // Si la pagina aun no cargo, lo volvemos a intentar en el proximo paso.
    }
}

page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
        inyectarUI().catch(() => {});
    }
});

async function narrar(paso, titulo, sub) {
    await inyectarUI();
    await page.evaluate(({ paso, titulo, sub }) => {
        let b = document.getElementById('presentacion-banner');
        if (!b) {
            b = document.createElement('div');
            b.id = 'presentacion-banner';
            document.body.appendChild(b);
        }
        b.innerHTML = `
            <div class="paso">${paso}</div>
            <div class="titulo">${titulo}</div>
            <div class="sub">${sub}</div>
        `;
    }, { paso, titulo, sub });
}

async function destacar(locator, { scroll = true } = {}) {
    try {
        if (scroll) await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await locator.first().evaluate((el) => el.classList.add('presentacion-highlight'));
    } catch {
        // Si el elemento no existe, seguimos sin romper la demo.
    }
}

async function quitarHighlight() {
    await page.evaluate(() => {
        document.querySelectorAll('.presentacion-highlight').forEach((el) =>
            el.classList.remove('presentacion-highlight')
        );
    });
}

const pausa = (ms) => page.waitForTimeout(ms);

async function tipear(locator, texto, { porLetra = 60 } = {}) {
    await locator.first().click();
    await locator.first().fill('');
    await locator.first().type(texto, { delay: porLetra });
}

async function intentar(fn, etiqueta) {
    try {
        await fn();
    } catch (e) {
        console.warn(`[presentacion] paso omitido: ${etiqueta} -> ${e.message}`);
    }
}

// =====================================================================
// 0 . INTRO
// =====================================================================
await page.goto(APP, { waitUntil: 'domcontentloaded' });
await pausa(1500);
await narrar(
    'Inicio · bienvenida',
    'Presupuesto Estudiantil',
    'Demo guiada de la app desplegada en Vercel · IHC'
);
await pausa(5000);

// =====================================================================
// 1 . LOGIN
// =====================================================================
await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' });
await pausa(1500);
await narrar(
    '1 · iniciar sesion',
    'Entramos con una cuenta de prueba',
    'Correo + contrasena. Sesion NO persistente por defecto (privacidad)'
);
await pausa(4500);

const inputEmail = page.locator('input[type="email"]');
const inputPwd = page.locator('input[type="password"]');
const btnLogin = page.getByRole('button', { name: /iniciar sesi/i });

await destacar(inputEmail);
await pausa(1800);
await tipear(inputEmail, USER.email, { porLetra: 70 });
await pausa(800);
await quitarHighlight();

await destacar(inputPwd);
await pausa(1500);
await tipear(inputPwd, USER.password, { porLetra: 80 });
await pausa(800);
await quitarHighlight();

await narrar(
    '1.1 · dark pattern corregido',
    'El check de "mantener sesion" viene desmarcado',
    'Privacidad por defecto · solo se activa si lo decidis vos'
);
await pausa(5000);

await destacar(btnLogin);
await pausa(1800);
await btnLogin.click();
await page.waitForURL('**/dashboard', { timeout: 60000 });
await quitarHighlight();
await pausa(2000);

// =====================================================================
// 2 . DASHBOARD - PRESUPUESTO MENSUAL
// =====================================================================
await inyectarUI();
await narrar(
    '2 · dashboard',
    'Presupuesto del mes de un solo vistazo',
    'Limite · Gastado · Disponible (periodo mes/anio)'
);
await pausa(4500);

await intentar(async () => {
    const seccionMensual = page.locator('section').filter({
        has: page.getByRole('heading', { name: /presupuesto mensual/i })
    });
    await destacar(seccionMensual);
    await pausa(6500);
    await quitarHighlight();
}, 'resaltar seccion mensual');

// Actualizar el limite mensual
await narrar(
    '2.1 · actualizar limite mensual',
    'Cambiamos el tope del mes y confirmamos',
    'El sistema valida que no sea menor que lo ya gastado'
);
await pausa(4000);

await intentar(async () => {
    const inpLim = page.locator('#limite');
    await destacar(inpLim);
    await pausa(1500);
    await tipear(inpLim, '2500');
    await pausa(800);
    await quitarHighlight();

    const btnGuardar = page
        .getByRole('button', { name: /guardar presupuesto/i });
    await destacar(btnGuardar);
    await pausa(1500);

    // Aceptar el confirm nativo si aparece.
    page.once('dialog', (d) => d.accept().catch(() => {}));
    await btnGuardar.click();
    await pausa(3500);
    await quitarHighlight();
}, 'actualizar limite mensual');

// =====================================================================
// 3 . PRESUPUESTO POR CATEGORIA  (Tarea 5)
// =====================================================================
await narrar(
    '3 · presupuesto por categoria',
    'Cada rubro con su limite y semaforo',
    'Comida · Transporte · Estudio · Otros  (dentro / alerta / excedido)'
);
await pausa(5000);

await intentar(async () => {
    const seccionCat = page.locator('section').filter({
        has: page.getByRole('heading', { name: /presupuesto por categor/i })
    });
    await destacar(seccionCat);
    await pausa(7000);
    await quitarHighlight();

    await narrar(
        '3.1 · fijar limite a una categoria',
        'Elegimos "Comida" y le ponemos un tope',
        'El semaforo y la barra de avance se actualizan al instante'
    );
    await pausa(4000);

    const selCat = page.locator('#categoria-presupuesto');
    await destacar(selCat);
    await pausa(1500);
    await selCat.selectOption('comida');
    await pausa(800);
    await quitarHighlight();

    const inpLimCat = page.locator('#limite-categoria');
    await destacar(inpLimCat);
    await pausa(1500);
    await tipear(inpLimCat, '400');
    await pausa(800);
    await quitarHighlight();

    const btnCat = seccionCat.getByRole('button', { name: /^guardar$/i });
    await destacar(btnCat);
    await pausa(1500);
    await btnCat.click();
    await pausa(3500);
    await quitarHighlight();

    // Mostrar la tabla actualizada.
    const tabla = seccionCat.locator('table.tabla-categorias');
    await destacar(tabla);
    await pausa(5500);
    await quitarHighlight();
}, 'presupuesto por categoria');

// =====================================================================
// 4 . GASTOS RECURRENTES (desde el dashboard)
// =====================================================================
await narrar(
    '4 · gastos recurrentes',
    'Programamos gastos semanales o mensuales',
    'Se cargan solos y avisan si fallan (ultimoError)'
);
await pausa(5000);

await intentar(async () => {
    const seccionRec = page.locator('#gastos-recurrentes');
    await seccionRec.scrollIntoViewIfNeeded();
    await destacar(seccionRec);
    await pausa(7000);
    await quitarHighlight();

    await narrar(
        '4.1 · cargar un gasto recurrente',
        'Monto, motivo, categoria, frecuencia y primera fecha',
        'Despues aparece en la lista con su proxima ocurrencia'
    );
    await pausa(4500);

    const monto = page.locator('#monto-recurrente');
    await destacar(monto);
    await pausa(1300);
    await tipear(monto, '80');
    await pausa(600);
    await quitarHighlight();

    const motivo = page.locator('#motivo-recurrente');
    await destacar(motivo);
    await pausa(1300);
    await tipear(motivo, 'Internet');
    await pausa(600);
    await quitarHighlight();

    const catRec = page.locator('#categoria-recurrente');
    await destacar(catRec);
    await pausa(1200);
    await catRec.selectOption('otros');
    await pausa(500);
    await quitarHighlight();

    const frec = page.locator('#frecuencia-recurrente');
    await destacar(frec);
    await pausa(1200);
    await frec.selectOption('mensual');
    await pausa(500);
    await quitarHighlight();

    const btnRec = page.getByRole('button', { name: /guardar gasto recurrente/i });
    await destacar(btnRec);
    await pausa(1500);
    await btnRec.click();
    await pausa(3500);
    await quitarHighlight();
}, 'gastos recurrentes');

// =====================================================================
// 5 . PAGINA GASTOS  -  REGISTRAR UN GASTO
// =====================================================================
await narrar(
    '5 · movimientos: ingreso y gasto',
    'Vamos a la seccion Gastos',
    'Monto, motivo, tipo (gasto / ingreso) y categoria'
);
await pausa(4500);

await intentar(async () => {
    const linkGastos = page.getByRole('link', { name: /^gastos$/i });
    await destacar(linkGastos);
    await pausa(1500);
    await linkGastos.click();
    await page.waitForURL('**/gastos', { timeout: 10000 });
    await inyectarUI();
    await quitarHighlight();
    await pausa(2500);
}, 'ir a gastos');

await intentar(async () => {
    const inpMonto = page.locator('input[type="number"]').first();
    await destacar(inpMonto);
    await pausa(1500);
    await tipear(inpMonto, '45');
    await pausa(600);
    await quitarHighlight();

    const inpMotivo = page.locator('input[type="text"]').first();
    await destacar(inpMotivo);
    await pausa(1500);
    await tipear(inpMotivo, 'Almuerzo demo');
    await pausa(600);
    await quitarHighlight();

    const selectos = page.locator('select');
    const selTipo = selectos.first();
    await destacar(selTipo);
    await pausa(1400);
    await selTipo.selectOption('gasto').catch(() => {});
    await pausa(500);
    await quitarHighlight();

    const selCategoria = selectos.nth(1);
    await destacar(selCategoria);
    await pausa(1400);
    await selCategoria.selectOption('comida').catch(() => {});
    await pausa(500);
    await quitarHighlight();

    const btnReg = page.getByRole('button', { name: /registrar|guardar/i }).first();
    await destacar(btnReg);
    await pausa(1500);
    await btnReg.click();
    await pausa(3500);
    await quitarHighlight();
}, 'registrar gasto');

// Registrar un ingreso
await narrar(
    '5.1 · tambien registramos un ingreso',
    'Mismo formulario, cambiamos el tipo a "ingreso"',
    'Queda sumado al disponible del mes'
);
await pausa(4500);

await intentar(async () => {
    const inpMonto = page.locator('input[type="number"]').first();
    await destacar(inpMonto);
    await pausa(1200);
    await tipear(inpMonto, '600');
    await pausa(500);
    await quitarHighlight();

    const inpMotivo = page.locator('input[type="text"]').first();
    await destacar(inpMotivo);
    await pausa(1200);
    await tipear(inpMotivo, 'Mesada demo');
    await pausa(500);
    await quitarHighlight();

    const selTipo = page.locator('select').first();
    await destacar(selTipo);
    await pausa(1300);
    await selTipo.selectOption('ingreso').catch(() => {});
    await pausa(500);
    await quitarHighlight();

    const btnReg = page.getByRole('button', { name: /registrar|guardar/i }).first();
    await destacar(btnReg);
    await pausa(1500);
    await btnReg.click();
    await pausa(3000);
    await quitarHighlight();
}, 'registrar ingreso');

// =====================================================================
// 6 . FILTROS
// =====================================================================
await narrar(
    '6 · buscar y filtrar movimientos',
    'Buscador por concepto + chips de filtro rapidos',
    'Todos · Solo gastos · Solo ingresos · Este mes · Estado'
);
await pausa(5000);

await intentar(async () => {
    const buscador = page
        .getByPlaceholder(/buscar/i)
        .or(page.locator('input[type="search"]'))
        .first();
    await destacar(buscador);
    await pausa(1500);
    await tipear(buscador, 'demo', { porLetra: 110 });
    await pausa(2500);
    await quitarHighlight();

    const chipSoloGastos = page.getByRole('button', { name: /solo gastos/i }).first();
    await destacar(chipSoloGastos);
    await pausa(1500);
    await chipSoloGastos.click().catch(() => {});
    await pausa(2500);
    await quitarHighlight();

    const chipSoloIngresos = page.getByRole('button', { name: /solo ingresos/i }).first();
    await destacar(chipSoloIngresos);
    await pausa(1500);
    await chipSoloIngresos.click().catch(() => {});
    await pausa(2500);
    await quitarHighlight();

    const chipTodos = page.getByRole('button', { name: /^todos$/i }).first();
    await destacar(chipTodos);
    await pausa(1500);
    await chipTodos.click().catch(() => {});
    await pausa(1500);
    await quitarHighlight();

    await buscador.fill('').catch(() => {});
    await pausa(1500);
}, 'filtros de gastos');

// =====================================================================
// 7 . PAGOS
// =====================================================================
await narrar(
    '7 · pagos',
    'Lista de pendientes + saldo disponible del mes',
    'Marcamos como pagado desde aca cuando corresponde'
);
await pausa(5000);

await intentar(async () => {
    const linkPagos = page.getByRole('link', { name: /^pagos$/i });
    await destacar(linkPagos);
    await pausa(1500);
    await linkPagos.click();
    await page.waitForURL('**/pagos', { timeout: 10000 });
    await inyectarUI();
    await quitarHighlight();
    await pausa(7000);
}, 'ir a pagos');

// =====================================================================
// 8 . HISTORIAL
// =====================================================================
await narrar(
    '8 · historial del mes',
    'Resumen de todos los movimientos del mes en curso',
    'Filtro por tipo (todos / gastos / ingresos)'
);
await pausa(5000);

await intentar(async () => {
    const linkHist = page.getByRole('link', { name: /^historial$/i });
    await destacar(linkHist);
    await pausa(1500);
    await linkHist.click();
    await page.waitForURL('**/historial', { timeout: 10000 });
    await inyectarUI();
    await quitarHighlight();
    await pausa(7000);
}, 'ir a historial');

// =====================================================================
// 9 . METAS DE AHORRO
// =====================================================================
await narrar(
    '9 · metas de ahorro',
    'Fijamos una meta, asignamos dinero y vemos el progreso',
    'Ingresos · gastos · reservado · disponible'
);
await pausa(5000);

await intentar(async () => {
    const linkMetas = page.getByRole('link', { name: /^metas$/i });
    await destacar(linkMetas);
    await pausa(1500);
    await linkMetas.click();
    await page.waitForURL('**/metas', { timeout: 10000 });
    await inyectarUI();
    await quitarHighlight();
    await pausa(8000);
}, 'ir a metas');

// =====================================================================
// 10 . CIERRE
// =====================================================================
await narrar(
    '10 · cierre',
    'Volvemos al dashboard y cerramos sesion',
    'La sesion termina de forma explicita (buena practica)'
);
await pausa(4500);

await intentar(async () => {
    const linkDash = page.getByRole('link', { name: /^dashboard$/i });
    await destacar(linkDash);
    await pausa(1200);
    await linkDash.click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await inyectarUI();
    await quitarHighlight();
    await pausa(2000);

    const btnLogout = page.getByRole('button', { name: /cerrar sesi/i }).first();
    await destacar(btnLogout);
    await pausa(1500);
    await btnLogout.click();
    await pausa(2500);
    await quitarHighlight();
}, 'logout');

await narrar(
    'fin · gracias',
    'Presupuesto Estudiantil',
    'IHC · Ariany Claure & Luis · demo en vivo'
);
await pausa(5000);

// =====================================================================
// GUARDADO DEL VIDEO
// =====================================================================
const video = page.video();
await context.close();
await browser.close();

let videoFinal = null;
if (video) {
    try {
        videoFinal = await video.path();
    } catch {}
}

if (!videoFinal) {
    const archivos = await readdir(OUT_DIR).catch(() => []);
    const webm = archivos.filter((a) => a.endsWith('.webm'));
    if (webm.length) {
        videoFinal = path.join(OUT_DIR, webm[webm.length - 1]);
    }
}

if (videoFinal) {
    const destino = path.join(OUT_DIR, 'demo-presupuesto.webm');
    try {
        await rename(videoFinal, destino);
        videoFinal = destino;
    } catch {}
    console.log('\n[OK] Video guardado en:');
    console.log('     ' + videoFinal);
    console.log('\n     Convertir a mp4 (si tenes ffmpeg):');
    console.log('     ffmpeg -i "' + videoFinal + '" -c:v libx264 -pix_fmt yuv420p demo-presupuesto.mp4');
} else {
    console.log('\n[AVISO] No se encontro el video. Revisa:', OUT_DIR);
}
