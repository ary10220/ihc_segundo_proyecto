import { test, expect, type Page } from '@playwright/test';

/**
 * Flujo principal de Presupuesto Estudiantil.
 *
 * Estructura de la clase: Semilla -> Login -> Crear -> Lo ve en pantalla.
 * Para nuestro caso el "crear" es un gasto, así que la comprobación final es:
 * "Registrar gasto -> el total cambia".
 *
 * Los datos del usuario de prueba los crea `pnpm run seed`.
 */

const USUARIO = {
  email: 'e2e@presupuesto.test',
  password: 'E2e12345',
};

const MONTO = 50;

async function iniciarSesion(page: Page) {
  await page.goto('/login');

  await page.getByLabel('Correo', { exact: true }).fill(USUARIO.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(USUARIO.password);

  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Al autenticarse, la app navega al panel principal.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: 'Gastos' })).toBeVisible();
}

test.describe('Presupuesto Estudiantil', () => {
  test('camino feliz: registrar un gasto y ver el total actualizado', async ({ page }) => {
    await iniciarSesion(page);

    // Esperamos la respuesta real de la API antes de abrir la pantalla de gastos,
    // así sabemos exactamente cuál era el total previo (sin adivinar).
    const respuestaInicial = page.waitForResponse(
      (respuesta) =>
        respuesta.url().includes('/api/gastos/filtrar') &&
        respuesta.request().method() === 'GET'
    );

    await page.getByRole('link', { name: 'Gastos' }).click();
    await expect(page.getByRole('heading', { name: 'Ingresar Gastos' })).toBeVisible();

    const cuerpoInicial = await (await respuestaInicial).json();
    const totalAntes = Number(cuerpoInicial.total);
    const totalEsperado = totalAntes + MONTO;

    const motivo = `Gasto E2E ${Date.now()}`;

    // El formulario se completa por etiqueta accesible, no por CSS ni XPath.
    await page.getByLabel('Monto', { exact: true }).fill(String(MONTO));
    await page.getByLabel('Motivo', { exact: true }).fill(motivo);
    await page.getByLabel('Tipo', { exact: true }).selectOption('gasto');
    await page.getByLabel('Categoría', { exact: true }).selectOption('comida');

    // La pantalla recarga la lista justo después de registrar: esperamos esa respuesta.
    const respuestaTrasRegistrar = page.waitForResponse(
      (respuesta) =>
        respuesta.url().includes('/api/gastos/filtrar') &&
        respuesta.request().method() === 'GET'
    );

    await page.getByRole('button', { name: 'Registrar Gasto' }).click();

    // Lo que el usuario ve: mensaje de éxito.
    await expect(page.getByRole('status')).toHaveText('Gasto registrado correctamente.');

    // Lo que la API confirma: el total subió exactamente lo que registramos.
    const cuerpoFinal = await (await respuestaTrasRegistrar).json();
    expect(Number(cuerpoFinal.total)).toBeCloseTo(totalEsperado, 2);

    // Lo que aparece en pantalla: total actualizado y el movimiento listado.
    await expect(
      page.getByText(`Total filtrado: Bs ${totalEsperado.toFixed(2)}`)
    ).toBeVisible();
    await expect(page.getByText(`Motivo: ${motivo}`)).toBeVisible();

    // Persistencia: al recargar, la sesión y el gasto siguen ahí.
    await page.reload();
    await expect(page).toHaveURL(/\/gastos$/);
    await expect(page.getByText(`Motivo: ${motivo}`)).toBeVisible();
  });

  test('camino alternativo: sin sesión, /gastos redirige al login', async ({ page }) => {
    // Contexto nuevo = localStorage vacío = usuario sin sesión.
    await page.goto('/gastos');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('estado vacío: una búsqueda sin resultados lo informa en pantalla', async ({ page }) => {
    await iniciarSesion(page);

    await page.getByRole('link', { name: 'Gastos' }).click();
    await expect(page.getByRole('heading', { name: 'Ingresar Gastos' })).toBeVisible();

    await page
      .getByPlaceholder('Buscar por concepto o descripción...')
      .fill('sin-resultados-e2e-000');

    await expect(
      page.getByText('No se encontraron movimientos con los filtros seleccionados.')
    ).toBeVisible();
  });
});
