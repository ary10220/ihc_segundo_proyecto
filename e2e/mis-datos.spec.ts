import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Tarea 10 · Mis datos y salida honesta (Presupuesto Estudiantil).
// Regla: al eliminar la cuenta se elimina todo (movimientos, presupuestos y metas).
// Antes puede descargar sus movimientos.
const api = 'http://127.0.0.1:4000/api';

async function crearUsuarioConDatos(request: APIRequestContext, sufijo: string) {
  const email = `misdatos-${sufijo}-${Date.now()}@test.com`;
  const password = 'misdatos123';
  const registro = await request.post(`${api}/auth/register`, { data: { name: `MisDatos ${sufijo}`, email, password } });
  expect(registro.ok(), await registro.text()).toBeTruthy();
  const { token } = await registro.json();
  const headers = { Authorization: `Bearer ${token}` };
  const ahora = new Date();
  await request.post(`${api}/presupuesto/establecer`, {
    headers, data: { limite: 2000, mes: ahora.getMonth() + 1, anio: ahora.getFullYear() },
  });
  await request.post(`${api}/gastos/registrar`, { headers, data: { monto: 800, motivo: 'Mesada', tipo: 'ingreso', categoria: 'otros' } });
  await request.post(`${api}/gastos/registrar`, { headers, data: { monto: 35, motivo: 'Almuerzo', tipo: 'gasto', categoria: 'comida' } });
  await request.post(`${api}/metas`, { headers, data: { nombre: 'Laptop', montoObjetivo: 3000, fechaObjetivo: '2027-06-30' } });
  return { email, password, token };
}

async function iniciarSesion(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Correo').fill(email);
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

const eventos = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('eventos') || '[]') as { evento: string; props: Record<string, unknown> }[]);

test('ver y descargar mis datos en JSON y CSV', async ({ page, request }) => {
  const u = await crearUsuarioConDatos(request, 'descarga');
  await iniciarSesion(page, u.email, u.password);
  await page.getByRole('link', { name: 'Mis datos' }).click();
  await expect(page.getByRole('heading', { name: 'Mis datos', exact: true })).toBeVisible();
  await expect(page.getByTestId('conteo-movimientos')).toHaveText('2');
  await expect(page.getByTestId('conteo-metas')).toHaveText('1');

  const [json] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar todo (JSON)' }).click(),
  ]);
  expect(json.suggestedFilename()).toMatch(/^mis-datos-.*\.json$/);
  const datos = JSON.parse(await readFile(await json.path(), 'utf-8'));
  expect(datos.movimientos).toHaveLength(2);
  expect(datos.metas).toHaveLength(1);
  expect(datos.usuario.password).toBeUndefined();

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar movimientos (CSV)' }).click(),
  ]);
  const texto = await readFile(await csv.path(), 'utf-8');
  expect(texto.split('\n')[0]).toBe('fecha,tipo,categoria,motivo,monto,estado');
  expect(texto).toContain('Almuerzo');

  const ev = await eventos(page);
  expect(ev.filter((e) => e.evento === 'datos_descargados').map((e) => e.props.formato)).toEqual(['json', 'csv']);
});

test('confirmación honesta: botones del mismo tamaño y cancelar no borra nada', async ({ page, request }) => {
  const u = await crearUsuarioConDatos(request, 'cancelar');
  await iniciarSesion(page, u.email, u.password);
  await page.goto('/mis-datos');
  await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();

  const dialogo = page.getByRole('alertdialog', { name: '¿Eliminar tu cuenta?' });
  await expect(dialogo).toContainText('2 movimientos');
  await expect(dialogo).toContainText('1 metas de ahorro');
  await expect(dialogo).toContainText('no podrás iniciar sesión');

  const conservar = dialogo.getByRole('button', { name: 'Conservar mi cuenta' });
  const eliminar = dialogo.getByRole('button', { name: 'Eliminar definitivamente' });
  const a = await conservar.boundingBox();
  const b = await eliminar.boundingBox();
  expect(Math.round(a!.width)).toBe(Math.round(b!.width));
  expect(Math.round(a!.height)).toBe(Math.round(b!.height));
  await expect(conservar).toBeFocused();

  await conservar.click();
  await expect(dialogo).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('conteo-movimientos')).toHaveText('2');
});

test('intento bloqueado: si el servidor falla, dice por qué y qué hacer, y no borra nada', async ({ page, request }) => {
  const u = await crearUsuarioConDatos(request, 'bloqueo');
  await iniciarSesion(page, u.email, u.password);
  await page.goto('/mis-datos');
  await page.route('**/api/mis-datos/cuenta', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json',
      body: JSON.stringify({ error: 'No pudimos eliminar tu cuenta. No se borró nada.', queHacer: 'Intenta de nuevo en unos minutos.' }) }));

  await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  const alerta = page.getByRole('alertdialog').getByRole('alert');
  await expect(alerta).toContainText('Por qué: No pudimos eliminar tu cuenta');
  await expect(alerta).toContainText('Qué hacer: Intenta de nuevo');
  await page.unroute('**/api/mis-datos/cuenta');

  const me = await request.get(`${api}/auth/me`, { headers: { Authorization: `Bearer ${u.token}` } });
  expect(me.ok()).toBeTruthy();
  expect((await eventos(page)).some((e) => e.evento === 'eliminacion_bloqueada' && e.props.motivo === 'error_servidor')).toBeTruthy();
});

test('eliminación completa: se borra todo y la cuenta no puede iniciar sesión', async ({ page, request }) => {
  const u = await crearUsuarioConDatos(request, 'eliminar');
  await iniciarSesion(page, u.email, u.password);
  await page.goto('/mis-datos');
  await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toHaveText('Tu cuenta y todos tus datos fueron eliminados.');

  // El token viejo ya no sirve y el login falla.
  const me = await request.get(`${api}/mis-datos`, { headers: { Authorization: `Bearer ${u.token}` } });
  expect(me.status()).toBe(401);
  const login = await request.post(`${api}/auth/login`, { data: { email: u.email, password: u.password } });
  expect(login.ok()).toBeFalsy();

  await page.getByPlaceholder('Correo').fill(u.email);
  await page.getByPlaceholder('Contraseña').fill(u.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  // Eventos de inicio y éxito, sin datos personales.
  const ev = await eventos(page);
  const nombres = ev.map((e) => e.evento);
  expect(nombres).toContain('eliminacion_iniciada');
  expect(nombres).toContain('cuenta_eliminada');
  const crudo = JSON.stringify(ev);
  expect(crudo).not.toContain(u.email);
  expect(crudo).not.toContain('Almuerzo');
});
