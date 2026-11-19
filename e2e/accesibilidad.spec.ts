import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

// Accesibilidad de toda la app (complementa el reporte de Lighthouse en docs/accesibilidad).
// 1) axe-core con las reglas WCAG 2.1 A y AA (incluye contraste 4.5:1) en cada pantalla,
//    con datos reales cargados y en los estados que cambian la interfaz (error, diálogo).
// 2) Contraste AA de los pares de tokens de color que usa la interfaz.
const api = 'http://127.0.0.1:4000/api';
const REGLAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function usuarioConDatos(request: APIRequestContext) {
  const email = `a11y-${Date.now()}@test.com`;
  const password = 'a11y12345';
  const registro = await request.post(`${api}/auth/register`, { data: { name: 'Usuario A11y', email, password } });
  expect(registro.ok(), await registro.text()).toBeTruthy();
  const { token } = await registro.json();
  const headers = { Authorization: `Bearer ${token}` };
  const ahora = new Date();
  await request.post(`${api}/presupuesto/establecer`, {
    headers, data: { limite: 2000, mes: ahora.getMonth() + 1, anio: ahora.getFullYear() },
  });
  await request.post(`${api}/gastos/registrar`, { headers, data: { monto: 900, motivo: 'Mesada', tipo: 'ingreso', categoria: 'otros' } });
  await request.post(`${api}/gastos/registrar`, { headers, data: { monto: 35, motivo: 'Almuerzo', tipo: 'gasto', categoria: 'comida' } });
  await request.post(`${api}/gastos/registrar`, { headers, data: { monto: 12, motivo: 'Pasaje', tipo: 'gasto', categoria: 'transporte' } });
  await request.post(`${api}/metas`, { headers, data: { nombre: 'Laptop', montoObjetivo: 3000, fechaObjetivo: '2027-06-30' } });
  return { email, password, token };
}

async function sinViolaciones(page: Page, pantalla: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(REGLAS).analyze();
  const resumen = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(resumen, `Violaciones de accesibilidad en ${pantalla}`).toEqual([]);
}

test.describe('pantallas públicas sin sesión', () => {
  for (const [ruta, titulo] of [
    ['/', 'Inicio'],
    ['/login', 'Iniciar sesión'],
    ['/register', 'Registro'],
    ['/forgot-password', 'Recuperar contraseña'],
    ['/analitica', 'Analítica'],
  ]) {
    test(`${titulo} (${ruta}) cumple WCAG 2.1 AA`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.locator('h1').first()).toBeVisible();
      await sinViolaciones(page, titulo);
    });
  }

  test('el mensaje de error del login también cumple WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Correo').fill('nadie@test.com');
    await page.getByPlaceholder('Contraseña').fill('clave-incorrecta');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await sinViolaciones(page, 'Login con error');
  });
});

test.describe('pantallas privadas con datos', () => {
  let token = '';

  test.beforeAll(async ({ request }) => {
    ({ token } = await usuarioConDatos(request));
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate((t) => sessionStorage.setItem('token', t), token);
  });

  for (const [ruta, titulo] of [
    ['/dashboard', 'Dashboard'],
    ['/gastos', 'Gastos'],
    ['/pagos', 'Pagos'],
    ['/historial', 'Historial'],
    ['/metas', 'Metas'],
    ['/mis-datos', 'Mis datos'],
  ]) {
    test(`${titulo} (${ruta}) cumple WCAG 2.1 AA`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await sinViolaciones(page, titulo);
    });
  }

  test('el diálogo «Eliminar mi cuenta» cumple WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/mis-datos');
    await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
    await expect(page.getByRole('alertdialog', { name: '¿Eliminar tu cuenta?' })).toBeVisible();
    await sinViolaciones(page, 'Diálogo eliminar cuenta');
  });
});

// --- Contraste de los tokens (WCAG 1.4.3: 4.5:1 texto normal) -----------------------------
function luminancia(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function tokens() {
  const css = readFileSync(new URL('../frontend/src/index.css', import.meta.url), 'utf-8');
  const raiz = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
  const valores: Record<string, string> = {};
  for (const [, nombre, valor] of raiz.matchAll(/--([\w-]+):\s*([^;]+);/g)) valores[nombre] = valor.trim();
  const resolver = (n: string): string => {
    const v = valores[n];
    const ref = /^var\(--([\w-]+)\)$/.exec(v);
    return ref ? resolver(ref[1]) : v;
  };
  return resolver;
}

// Pares texto / fondo que realmente aparecen en la interfaz.
const PARES_TEXTO: [string, string][] = [
  ['ink', 'surface'], ['ink', 'bg'], ['ink', 'surface-2'], ['ink', 'highlight'], ['ink', 'accent-soft'],
  ['muted', 'surface'], ['muted', 'bg'], ['muted', 'surface-2'],
  ['accent-text', 'surface'], ['accent-text', 'bg'], ['accent-text', 'accent-soft'],
  ['accent-ink', 'accent'], ['accent-ink', 'accent-hover'],
  ['green', 'surface'], ['green', 'green-soft'],
  ['amber', 'surface'], ['amber', 'amber-soft'],
  ['red', 'surface'], ['red', 'red-soft'],
  ['label-destacado', 'highlight'],
  ['surface', 'ink'], ['on-dark-muted', 'ink'], ['highlight', 'ink'], ['red-on-dark', 'ink'],
  ['placeholder', 'surface'],
];

// Indicadores que no son texto (WCAG 1.4.11: 3:1): anillo de foco y borde de campo enfocado.
const PARES_NO_TEXTO: [string, string][] = [
  ['accent-text', 'surface'], ['accent-text', 'bg'], // anillo índigo sobre fondos claros
  ['highlight', 'ink'],                              // anillo lavanda sobre tarjetas oscuras
];

function fallasDeContraste(pares: [string, string][], minimo: number) {
  const color = tokens();
  return pares
    .map(([texto, fondo]) => ({ texto, fondo, ratio: contraste(color(texto), color(fondo)) }))
    .filter((p) => p.ratio < minimo)
    .map((p) => `${p.texto} sobre ${p.fondo}: ${p.ratio.toFixed(2)}:1`);
}

test('los pares de tokens de texto cumplen contraste AA (4.5:1)', () => {
  expect(fallasDeContraste(PARES_TEXTO, 4.5)).toEqual([]);
});

test('el foco y los bordes activos cumplen contraste no textual (3:1)', () => {
  expect(fallasDeContraste(PARES_NO_TEXTO, 3)).toEqual([]);
});

test('el foco de teclado es visible con el anillo índigo y lavanda', async ({ page }) => {
  await page.goto('/login');
  const boton = page.getByRole('button', { name: 'Iniciar sesión' });
  await boton.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const estilo = await boton.evaluate((b) => {
    const s = getComputedStyle(b);
    return { outline: s.outlineStyle, ancho: s.outlineWidth, color: s.outlineColor };
  });
  expect(estilo.outline).toBe('solid');
  expect(estilo.ancho).toBe('3px');
  expect(estilo.color).toBe('rgb(68, 54, 199)');
  // La sombra tiene transición de 150 ms: esperamos a que termine.
  await expect.poll(() => boton.evaluate((b) => getComputedStyle(b).boxShadow)).toBe('rgb(201, 195, 255) 0px 0px 0px 7px');
});
