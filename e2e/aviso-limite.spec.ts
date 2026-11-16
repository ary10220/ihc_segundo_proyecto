import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Tarea 9 · Parte B · Aviso antes de superar el límite de la categoría.
// Un gasto sin aviso, uno con aviso cancelado (todo igual) y otro confirmado (queda excedido).
const api = 'http://127.0.0.1:4000/api';
const LIMITE_COMIDA = 100;

async function crearUsuarioConLimite(request: APIRequestContext) {
  const email = `aviso-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.com`;
  const password = 'aviso12345';
  const registro = await request.post(`${api}/auth/register`, {
    data: { name: 'Aviso E2E', email, password },
  });
  expect(registro.ok(), await registro.text()).toBeTruthy();
  const { token } = await registro.json();
  const headers = { Authorization: `Bearer ${token}` };

  const ahora = new Date();
  const mes = ahora.getMonth() + 1;
  const anio = ahora.getFullYear();
  const mensual = await request.post(`${api}/presupuesto/establecer`, {
    headers, data: { limite: 10_000, mes, anio },
  });
  expect(mensual.ok(), await mensual.text()).toBeTruthy();
  const categoria = await request.post(`${api}/presupuesto-categoria/establecer`, {
    headers, data: { categoria: 'comida', limite: LIMITE_COMIDA, mes, anio },
  });
  expect(categoria.ok(), await categoria.text()).toBeTruthy();

  const estadoComida = async () => {
    const r = await request.get(`${api}/presupuesto-categoria/obtener?mes=${mes}&anio=${anio}`, { headers });
    const { categorias } = await r.json();
    return categorias.find((c: { categoria: string }) => c.categoria === 'comida');
  };

  return { email, password, estadoComida };
}

async function iniciarSesion(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Correo').fill(email);
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

async function llenarGasto(page: Page, monto: number, motivo: string, tipo = 'gasto') {
  await page.getByPlaceholder('Monto').fill(String(monto));
  await page.getByPlaceholder('Motivo').fill(motivo);
  const selects = page.locator('section').first().locator('select');
  await selects.nth(0).selectOption(tipo);
  await selects.nth(1).selectOption('comida');
  await page.getByRole('button', { name: 'Registrar Gasto' }).click();
}

test('gasto sin aviso, aviso cancelado sin cambios y aviso confirmado que deja la categoría excedida', async ({ page, request }) => {
  const usuario = await crearUsuarioConLimite(request);
  await iniciarSesion(page, usuario.email, usuario.password);
  await page.getByRole('link', { name: 'Gastos' }).click();

  // 1) Gasto dentro del límite: se guarda sin aviso
  await llenarGasto(page, 60, 'Almuerzo semanal');
  await expect(page.getByRole('status')).toContainText('Gasto registrado correctamente');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect((await usuario.estadoComida()).consumido).toBe(60);

  // 2) Gasto que pasaría el límite: aviso con cuánto se pasa; cancelar no cambia nada
  await llenarGasto(page, 70, 'Cena con amigos');
  const aviso = page.getByRole('alertdialog');
  await expect(aviso).toContainText('Te pasarías del límite de comida por Bs 30.00');
  await expect(aviso).toContainText('Ya gastado: Bs 60.00');
  await aviso.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByText('Cena con amigos')).toHaveCount(0);
  const trasCancelar = await usuario.estadoComida();
  expect(trasCancelar.consumido).toBe(60);
  expect(trasCancelar.estado).toBe('ok');

  // 3) Mismo gasto, esta vez confirmado: se guarda y la categoría queda excedida
  await page.getByRole('button', { name: 'Registrar Gasto' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Guardar igual' }).click();
  await expect(page.getByRole('status')).toContainText('Gasto registrado correctamente');
  await expect(page.getByText('Cena con amigos')).toBeVisible();
  const trasConfirmar = await usuario.estadoComida();
  expect(trasConfirmar.consumido).toBe(130);
  expect(trasConfirmar.estado).toBe('excedido');

  // 4) Los ingresos no generan aviso aunque la categoría ya esté excedida
  await llenarGasto(page, 500, 'Beca de comida', 'ingreso');
  await expect(page.getByRole('status')).toContainText('Gasto registrado correctamente');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('editar un gasto que pasaría el límite también pide confirmación', async ({ page, request }) => {
  const usuario = await crearUsuarioConLimite(request);
  await iniciarSesion(page, usuario.email, usuario.password);
  await page.getByRole('link', { name: 'Gastos' }).click();

  await llenarGasto(page, 40, 'Mercado del lunes');
  await expect(page.getByRole('status')).toContainText('Gasto registrado correctamente');

  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByPlaceholder('Monto').fill('150');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  const aviso = page.getByRole('alertdialog');
  await expect(aviso).toContainText('por Bs 50.00');
  await aviso.getByRole('button', { name: 'Cancelar' }).click();
  expect((await usuario.estadoComida()).consumido).toBe(40);
});
