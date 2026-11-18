import { test, request, type Page } from '@playwright/test';
import fs from 'node:fs';

// Clase 23 · Inventario de botones.
// Recorre las pantallas reales de la app, recorta el botón de "acción principal"
// de cada una, lee sus estilos calculados y arma una lámina con todos uno al
// lado del otro: evidencias/clase-23/inventario-botones.png

const API = 'http://localhost:4000/api';
const APP = 'http://localhost:5173';
const SALIDA = 'evidencias/clase-23';

type Muestra = {
  pantalla: string;
  rol: string;
  imagen: string;
  fondo: string;
  texto: string;
  borde: string;
  radio: string;
  alto: string;
  ancho: string;
  peso: string;
  mayusculas: string;
  sombra: string;
};

async function capturar(page: Page, pantalla: string, rol: string, selector: string): Promise<Muestra> {
  const boton = page.locator(selector).first();
  await boton.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0); // sin hover
  const png = await boton.screenshot();
  const estilo = await boton.evaluate((el) => {
    const s = getComputedStyle(el);
    const hex = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return c;
      const [r, g, b, a] = m[1].split(',').map((v) => parseFloat(v));
      if (a === 0) return 'transparente';
      const h = '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      return a !== undefined && a < 1 ? `${h} · ${Math.round(a * 100)}%` : h;
    };
    return {
      fondo: hex(s.backgroundColor),
      texto: hex(s.color),
      borde: s.borderStyle === 'none' || parseFloat(s.borderWidth) === 0 ? 'sin borde' : `${s.borderWidth} ${hex(s.borderColor)}`,
      radio: s.borderRadius,
      alto: `${Math.round(el.getBoundingClientRect().height)}px`,
      ancho: `${Math.round(el.getBoundingClientRect().width)}px`,
      peso: s.fontWeight,
      mayusculas: s.textTransform,
      sombra: s.boxShadow === 'none' ? 'no' : 'sí'
    };
  });
  return { pantalla, rol, imagen: `data:image/png;base64,${png.toString('base64')}`, ...estilo };
}

test('inventario de botones para evidencia de clase 23', async ({ page }) => {
  test.setTimeout(90_000);
  fs.mkdirSync(SALIDA, { recursive: true });

  const ts = Date.now();
  const api = await request.newContext();
  const reg = await api.post(`${API}/auth/register`, {
    data: { name: 'Evidencia Clase 23', email: `evid23+${ts}@test.com`, password: 'e2e12345' }
  });
  const { token } = await reg.json();
  const auth = { Authorization: `Bearer ${token}` };

  const ahora = new Date();
  await api.post(`${API}/presupuesto/establecer`, {
    headers: auth,
    data: { limite: 1000, mes: ahora.getMonth() + 1, anio: ahora.getFullYear() }
  });
  await api.post(`${API}/gastos/registrar`, {
    headers: auth,
    data: { monto: 25, motivo: 'Almuerzo', tipo: 'gasto', categoria: 'comida' }
  });
  const pagado = await api.post(`${API}/gastos/registrar`, {
    headers: auth,
    data: { monto: 10, motivo: 'Pasaje', tipo: 'gasto', categoria: 'transporte' }
  });
  await api.put(`${API}/gastos/pagar/${(await pagado.json()).id}`, { headers: auth });

  await page.setViewportSize({ width: 1280, height: 900 });
  const muestras: Muestra[] = [];

  // Pantallas públicas
  await page.goto(`${APP}/`);
  muestras.push(await capturar(page, 'Inicio', 'Primario', 'a.btn:has-text("Registrarse")'));
  muestras.push(await capturar(page, 'Inicio', 'Secundario', 'a.btn:has-text("Iniciar sesión")'));

  await page.goto(`${APP}/login`);
  muestras.push(await capturar(page, 'Login', 'Primario', 'button:has-text("Iniciar sesión")'));

  // Pantallas protegidas (el token vive en sessionStorage, ver utils/auth.ts)
  await page.evaluate((t) => sessionStorage.setItem('token', t), token);

  await page.goto(`${APP}/dashboard`);
  await page.locator('h2#titulo-mensual').waitFor();
  muestras.push(await capturar(page, 'Dashboard', 'Primario', 'button.btn:has-text("Guardar presupuesto")'));
  muestras.push(await capturar(page, 'Dashboard', 'Secundario', 'button.dashboard-logout'));
  muestras.push(await capturar(page, 'Navbar', 'Secundario', 'header button:has-text("Cerrar sesión")'));

  await page.goto(`${APP}/gastos`);
  await page.getByText('Almuerzo').first().waitFor();
  muestras.push(await capturar(page, 'Gastos', 'Primario', 'button:has-text("Registrar Gasto")'));
  muestras.push(await capturar(page, 'Gastos', 'Secundario', 'button:has-text("Editar")'));
  muestras.push(await capturar(page, 'Gastos', 'Peligro', 'button:has-text("Eliminar")'));
  muestras.push(await capturar(page, 'Gastos', 'Filtro activo', 'button.seg.on'));

  await page.goto(`${APP}/pagos`);
  await page.getByText('Almuerzo').first().waitFor();
  muestras.push(await capturar(page, 'Pagos', 'Primario', 'button:has-text("Marcar como pagado")'));
  muestras.push(await capturar(page, 'Pagos', 'Deshabilitado', 'button:disabled:has-text("Pagado")'));

  await page.goto(`${APP}/metas`);
  await page.locator('h2#titulo-nueva').waitFor();
  muestras.push(await capturar(page, 'Metas', 'Primario', 'button:has-text("Crear meta")'));

  await page.goto(`${APP}/mis-datos`);
  muestras.push(await capturar(page, 'Mis datos', 'Peligro', 'button:has-text("Eliminar mi cuenta")'));

  // Lámina: todos los botones uno al lado del otro
  const tarjetas = muestras.map((m) => `
    <figure>
      <figcaption><b>${m.pantalla}</b><span>${m.rol}</span></figcaption>
      <div class="muestra"><img src="${m.imagen}" alt="${m.pantalla}"></div>
      <dl>
        <dt>fondo</dt><dd><i style="background:${m.fondo.split(' ')[0]}"></i>${m.fondo}</dd>
        <dt>texto</dt><dd>${m.texto}</dd>
        <dt>borde</dt><dd>${m.borde}</dd>
        <dt>radio</dt><dd>${m.radio}</dd>
        <dt>tamaño</dt><dd>${m.alto} alto · ${m.ancho} ancho</dd>
        <dt>peso</dt><dd>${m.peso}${m.mayusculas !== 'none' ? ' · ' + m.mayusculas : ''}</dd>
        <dt>sombra</dt><dd>${m.sombra}</dd>
      </dl>
    </figure>`).join('');

  await page.setViewportSize({ width: 1280, height: 400 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 28px; font: 14px/1.4 system-ui, 'Segoe UI', sans-serif; background: #fafafa; color: #1f2328; width: 1224px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    p.sub { margin: 0 0 20px; color: #57606a; }
    .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
    figure { min-width: 0; margin: 0; background: #fff; border: 1px solid #d0d7de; border-radius: 10px; padding: 12px; }
    figcaption { display: flex; justify-content: space-between; gap: 6px; margin-bottom: 8px; }
    figcaption span { color: #57606a; font-size: 12px; }
    .muestra { height: 72px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px dashed #d0d7de; border-radius: 6px; }
    .muestra img { max-width: none; flex: none; } /* escala real: los botones a todo el ancho se ven recortados */
    dl { display: grid; grid-template-columns: 52px 1fr; gap: 2px 6px; margin: 10px 0 0; font: 12px/1.4 ui-monospace, Consolas, monospace; }
    dt { color: #57606a; } dd { margin: 0; overflow-wrap: anywhere; }
    i { display: inline-block; width: 10px; height: 10px; border: 1px solid #0003; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
  </style></head><body>
    <h1>Inventario de botones · Presupuesto Estudiantil</h1>
    <p class="sub">Recortes reales de cada pantalla, a escala 1:1 y sin hover, con los estilos que calcula el navegador.</p>
    <div class="grid">${tarjetas}</div>
  </body></html>`);
  await page.screenshot({ path: `${SALIDA}/inventario-botones.png`, fullPage: true });

  fs.writeFileSync(
    `${SALIDA}/inventario-botones.json`,
    JSON.stringify(muestras.map(({ imagen: _imagen, ...resto }) => resto), null, 2)
  );
});
