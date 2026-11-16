import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Tarea 9 · Parte A · Cada flujo principal registra sus eventos (lista cerrada, sin datos personales).
const api = 'http://127.0.0.1:4000/api';

type Evento = { evento: string; props: Record<string, unknown> };

async function crearUsuario(request: APIRequestContext, opciones: { presupuesto?: boolean; limiteComida?: number; ingreso?: number } = {}) {
  const email = `analitica-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.com`;
  const password = 'analitica123';
  const registro = await request.post(`${api}/auth/register`, { data: { name: 'Analitica E2E', email, password } });
  expect(registro.ok(), await registro.text()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await registro.json()).token}` };
  const ahora = new Date();
  const mes = ahora.getMonth() + 1;
  const anio = ahora.getFullYear();
  if (opciones.presupuesto !== false) {
    const r = await request.post(`${api}/presupuesto/establecer`, { headers, data: { limite: 10_000, mes, anio } });
    expect(r.ok(), await r.text()).toBeTruthy();
  }
  if (opciones.limiteComida) {
    const r = await request.post(`${api}/presupuesto-categoria/establecer`, {
      headers, data: { categoria: 'comida', limite: opciones.limiteComida, mes, anio },
    });
    expect(r.ok(), await r.text()).toBeTruthy();
  }
  if (opciones.ingreso) {
    const r = await request.post(`${api}/gastos/registrar`, {
      headers, data: { monto: opciones.ingreso, motivo: 'Mesada E2E', tipo: 'ingreso', categoria: 'otros' },
    });
    expect(r.ok(), await r.text()).toBeTruthy();
  }
  return { email, password };
}

async function eventos(page: Page): Promise<Evento[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('eventos') || '[]'));
}

const nombres = async (page: Page) => (await eventos(page)).map((e) => e.evento);

async function limpiar(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.removeItem('eventos'));
}

async function iniciarSesion(page: Page, email: string, password: string) {
  await page.getByPlaceholder('Correo').fill(email);
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('iniciar sesión: rechazo por credenciales y luego éxito, sin guardar el correo', async ({ page, request }) => {
  const usuario = await crearUsuario(request);
  await limpiar(page);

  await iniciarSesion(page, usuario.email, 'clave-incorrecta');
  await expect(page.getByRole('alert')).toBeVisible();
  await iniciarSesion(page, usuario.email, usuario.password);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const registrados = await eventos(page);
  expect(registrados.map((e) => e.evento)).toEqual(['login_iniciado', 'login_rechazado', 'login_iniciado', 'login_exitoso']);
  expect(registrados[1].props).toEqual({ motivo: 'credenciales' });
  expect(JSON.stringify(registrados)).not.toContain(usuario.email);
});

test('registrar movimiento y aviso de límite: embudo completo sin motivo ni monto', async ({ page, request }) => {
  const usuario = await crearUsuario(request, { limiteComida: 100 });
  await limpiar(page);
  await iniciarSesion(page, usuario.email, usuario.password);
  await page.getByRole('link', { name: 'Gastos' }).click();
  const selects = page.locator('section').first().locator('select');

  // Error que frena la tarea: motivo solo con números
  await page.getByPlaceholder('Monto').fill('20');
  await page.getByPlaceholder('Motivo').fill('12345');
  await page.getByRole('button', { name: 'Registrar Gasto' }).click();
  await expect(page.getByRole('alert')).toContainText('no solo números');

  // Aviso cancelado y luego confirmado
  await page.getByPlaceholder('Motivo').fill('Cena privada del grupo');
  await page.getByPlaceholder('Monto').fill('150');
  await selects.nth(1).selectOption('comida');
  await page.getByRole('button', { name: 'Registrar Gasto' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Registrar Gasto' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Guardar igual' }).click();
  await expect(page.getByRole('status')).toContainText('Gasto registrado correctamente');

  const registrados = await eventos(page);
  expect(registrados.map((e) => e.evento).filter((n) => !n.startsWith('login_'))).toEqual([
    'movimiento_iniciado',
    'movimiento_rechazado',
    'movimiento_iniciado',
    'aviso_limite_mostrado',
    'aviso_limite_cancelado',
    'movimiento_iniciado',
    'aviso_limite_mostrado',
    'aviso_limite_confirmado',
    'movimiento_guardado',
  ]);
  expect(registrados.find((e) => e.evento === 'movimiento_rechazado')?.props.motivo).toBe('motivo_numerico');
  expect(registrados.find((e) => e.evento === 'movimiento_guardado')?.props).toEqual({ tipo: 'gasto', categoria: 'comida', supera_limite: true });
  const crudo = JSON.stringify(registrados);
  expect(crudo).not.toContain('Cena privada');
  expect(crudo).not.toContain('150');
});

test('búsqueda sin resultados registra solo qué filtros se usaron, una vez', async ({ page, request }) => {
  const usuario = await crearUsuario(request);
  await limpiar(page);
  await iniciarSesion(page, usuario.email, usuario.password);
  await page.getByRole('link', { name: 'Gastos' }).click();

  await page.getByPlaceholder('Buscar por concepto o descripción...').fill('zapatos rojos');
  await expect(page.getByText('No se encontraron movimientos con los filtros seleccionados.')).toBeVisible();
  await expect.poll(async () => (await nombres(page)).filter((n) => n === 'busqueda_sin_resultados').length).toBe(1);

  const vacia = (await eventos(page)).find((e) => e.evento === 'busqueda_sin_resultados');
  expect(vacia?.props).toEqual({ filtros: 'texto' });
  expect(JSON.stringify(await eventos(page))).not.toContain('zapatos');
});

test('presupuesto mensual: rechazo por límite inválido y luego guardado', async ({ page, request }) => {
  const usuario = await crearUsuario(request, { presupuesto: false });
  await limpiar(page);
  await iniciarSesion(page, usuario.email, usuario.password);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // El input tiene min=0.01: quitamos la validación nativa para probar la del flujo
  await page.locator('#limite').evaluate((el) => el.removeAttribute('min'));
  await page.getByLabel('Establecer límite mensual (Bs)').fill('0');
  await page.getByRole('button', { name: 'Guardar presupuesto' }).click();
  await expect(page.getByRole('alert')).toContainText('mayor que cero');
  await page.getByLabel('Establecer límite mensual (Bs)').fill('800');
  await page.getByRole('button', { name: 'Guardar presupuesto' }).click();
  await expect(page.getByRole('status').first()).toBeVisible();

  await expect.poll(async () => (await nombres(page)).filter((n) => n.startsWith('presupuesto_'))).toEqual([
    'presupuesto_iniciado', 'presupuesto_rechazado', 'presupuesto_iniciado', 'presupuesto_guardado',
  ]);
});

test('metas: crear, asignar y rechazo por fondos insuficientes; el panel muestra los embudos', async ({ page, request }) => {
  const usuario = await crearUsuario(request, { ingreso: 500 });
  await limpiar(page);
  await iniciarSesion(page, usuario.email, usuario.password);
  await page.getByRole('link', { name: 'Metas' }).click();

  await page.getByLabel('Nombre de la meta').fill('Bicicleta secreta');
  await page.getByLabel('Monto objetivo (Bs)').fill('900');
  await page.getByLabel('Fecha objetivo').fill('2027-06-30');
  await page.getByRole('button', { name: 'Crear meta' }).click();
  await expect(page.getByRole('status')).toContainText('creada');

  const tarjeta = page.getByRole('article', { name: 'Meta Bicicleta secreta' });
  await tarjeta.getByLabel('Monto para Bicicleta secreta').fill('100');
  await tarjeta.getByRole('button', { name: 'Asignar' }).click();
  await expect(page.getByRole('status')).toContainText('Asignaste');
  await tarjeta.getByLabel('Monto para Bicicleta secreta').fill('9999');
  await tarjeta.getByRole('button', { name: 'Asignar' }).click();
  await expect(page.getByRole('alert')).toContainText('Fondos insuficientes');

  const registrados = await eventos(page);
  expect(registrados.map((e) => e.evento).filter((n) => n.startsWith('meta_'))).toEqual([
    'meta_creada', 'meta_fondos_asignados', 'meta_rechazada',
  ]);
  expect(registrados.find((e) => e.evento === 'meta_rechazada')?.props).toEqual({ accion: 'asignar', motivo: 'fondos_insuficientes' });
  expect(JSON.stringify(registrados)).not.toContain('Bicicleta');

  // Panel /analitica: embudo por flujo y caída entre pasos
  await page.goto('/analitica');
  const embudoMetas = page.getByRole('region', { name: 'Embudo Metas de ahorro (Tarea 8)' });
  await expect(embudoMetas.getByTestId('conteo-meta_creada')).toHaveText('1');
  await expect(embudoMetas.getByTestId('conteo-meta_fondos_asignados')).toHaveText('1');
  const embudoLogin = page.getByRole('region', { name: 'Embudo Iniciar sesión' });
  await expect(embudoLogin.getByTestId('conteo-login_exitoso')).toHaveText('1');
  await expect(page.getByTestId('mayor-caida')).not.toHaveText('Sin datos suficientes todavía.');
});
