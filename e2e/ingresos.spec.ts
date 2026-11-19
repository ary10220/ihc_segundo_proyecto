import { test, expect } from '@playwright/test';

// Un ingreso no consume presupuesto: se registra aunque supere el disponible
// y el Dashboard no lo suma como «Gastado».
const api = 'http://127.0.0.1:4000/api';

test('registrar un ingreso no cambia lo gastado ni el disponible del mes', async ({ page, request }) => {
  const email = `ingreso-${Date.now()}@test.com`;
  const registro = await request.post(`${api}/auth/register`, { data: { name: 'Ingreso E2E', email, password: 'ingreso123' } });
  expect(registro.ok(), await registro.text()).toBeTruthy();
  const { token } = await registro.json();
  const headers = { Authorization: `Bearer ${token}` };
  const ahora = new Date();
  await request.post(`${api}/presupuesto/establecer`, {
    headers, data: { limite: 500, mes: ahora.getMonth() + 1, anio: ahora.getFullYear() },
  });
  await request.post(`${api}/gastos/registrar`, { headers, data: { monto: 100, motivo: 'Pasajes', tipo: 'gasto', categoria: 'transporte' } });

  await page.goto('/login');
  await page.evaluate((t) => sessionStorage.setItem('token', t), token);

  // Mesada de Bs 1200: antes se rechazaba porque «superaba» el disponible de Bs 400
  await page.goto('/gastos');
  const respuesta = page.waitForResponse((r) => r.url().endsWith('/api/gastos/registrar') && r.request().method() === 'POST');
  await page.getByPlaceholder('Monto').fill('1200');
  await page.getByPlaceholder('Motivo').fill('Mesada');
  await page.locator('#gasto-tipo').selectOption('ingreso');
  await page.getByRole('button', { name: 'Registrar Gasto' }).click();
  expect((await respuesta).status()).toBe(201);

  await page.goto('/dashboard');
  await expect(page.locator('.resumen-item').filter({ hasText: 'Gastado' })).toContainText('100.00');
  await expect(page.locator('.resumen-item').filter({ hasText: 'Disponible' })).toContainText('400.00');
});
