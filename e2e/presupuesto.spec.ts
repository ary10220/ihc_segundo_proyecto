import { test, expect } from '@playwright/test';

const correo = process.env.E2E_EMAIL ?? 'e2e@test.com';
const contrasena = process.env.E2E_PASSWORD ?? 'e2e12345';
const montoPrueba = 1.25;

test('registrar un gasto actualiza el presupuesto y pagarlo cambia su estado', async ({
  page,
  request,
}) => {
  let gastoId: number | undefined;
  let token: string | null = null;

  try {
    await page.goto('/login');
    await page.getByPlaceholder('Correo').fill(correo);
    await page.getByPlaceholder('Contraseña').fill(contrasena);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    token = await page.evaluate(() => localStorage.getItem('token'));

    const totalAntes = page.locator('p').filter({ hasText: 'Total gastado:' });
    await expect(totalAntes).toBeVisible();
    const textoTotalAntes = await totalAntes.innerText();
    const numeroAntes = textoTotalAntes.match(/Bs\s*([\d.]+)/);
    expect(numeroAntes, 'el Dashboard debe mostrar el total gastado').not.toBeNull();
    const totalInicial = Number(numeroAntes![1]);

    const respuestaRegistro = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/gastos/registrar') &&
        response.request().method() === 'POST',
    );

    await page.getByRole('link', { name: 'Gastos' }).click();
    await page.getByPlaceholder('Monto').fill(String(montoPrueba));
    const motivo = `E2E presupuesto ${Date.now()}`;
    await page.getByPlaceholder('Motivo').fill(motivo);
    await page.getByRole('combobox').nth(0).selectOption('gasto');
    await page.getByRole('combobox').nth(1).selectOption('comida');
    await page.getByRole('button', { name: 'Registrar Gasto' }).click();

    const registro = await respuestaRegistro;
    expect(registro.status()).toBe(201);
    const gastoCreado = await registro.json();
    gastoId = gastoCreado.id;
    await expect(page.getByText('Gasto registrado correctamente.')).toBeVisible();

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(
      page.locator('p').filter({ hasText: 'Total gastado:' }),
    ).toContainText((totalInicial + montoPrueba).toFixed(2));

    await page.getByRole('link', { name: 'Pagos' }).click();
    const filaDelGasto = page
      .getByText(`Motivo: ${motivo}`, { exact: true })
      .locator('xpath=..');
    await filaDelGasto
      .getByRole('button', { name: 'Marcar como pagado' })
      .click();
    await expect(filaDelGasto.getByRole('button', { name: 'Pagado' })).toBeDisabled();

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(
      page.locator('p').filter({ hasText: 'Total gastado:' }),
    ).toContainText((totalInicial + montoPrueba).toFixed(2));
  } finally {
    // Elimina solo el gasto creado por esta prueba para que se pueda repetir.
    if (gastoId && token) {
      await request.delete(`http://127.0.0.1:4000/api/gastos/eliminar/${gastoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }
});

test('rechaza un gasto que supera el saldo y conserva el total', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Correo').fill(correo);
  await page.getByPlaceholder('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const totalGastado = page.locator('p').filter({ hasText: 'Total gastado:' });
  const saldoDisponible = page.locator('p').filter({ hasText: 'Saldo disponible:' });
  await expect(totalGastado).toBeVisible();
  await expect(saldoDisponible).toBeVisible();

  const textoTotal = await totalGastado.innerText();
  const totalInicial = Number(textoTotal.match(/Bs\s*([\d.]+)/)?.[1]);
  const textoSaldo = await saldoDisponible.innerText();
  const saldo = Number(textoSaldo.match(/Bs\s*([\d.]+)/)?.[1]);
  expect(Number.isFinite(totalInicial)).toBeTruthy();
  expect(Number.isFinite(saldo)).toBeTruthy();

  await page.getByRole('link', { name: 'Gastos' }).click();
  await page.getByPlaceholder('Monto').fill((saldo + 1).toFixed(2));
  const motivo = `E2E gasto rechazado ${Date.now()}`;
  await page.getByPlaceholder('Motivo').fill(motivo);
  await page.getByRole('combobox').nth(0).selectOption('gasto');
  await page.getByRole('combobox').nth(1).selectOption('comida');

  const respuestaRegistro = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/gastos/registrar') &&
      response.request().method() === 'POST',
  );
  const alerta = page.waitForEvent('dialog');
  await page.getByRole('button', { name: 'Registrar Gasto' }).click();

  const [respuesta, dialog] = await Promise.all([respuestaRegistro, alerta]);
  expect(respuesta.status()).toBe(400);
  expect(dialog.message()).toBe('El gasto supera el presupuesto mensual disponible');
  await dialog.accept();

  await expect(page.getByText(`Motivo: ${motivo}`, { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(totalGastado).toContainText(totalInicial.toFixed(2));
});
