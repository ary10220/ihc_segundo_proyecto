import { test, expect } from '@playwright/test';

// Evidencia visual del informe de accesibilidad (docs/accesibilidad/README.md).
const api = 'http://127.0.0.1:4000/api';
const carpeta = 'docs/accesibilidad/capturas';

test('capturas: foco de teclado en fondo claro y oscuro, y resumen de Pagos', async ({ page, request }) => {
  const email = `a11y-capturas-${Date.now()}@test.com`;
  const registro = await request.post(`${api}/auth/register`, { data: { name: 'Capturas', email, password: 'a11y12345' } });
  const { token } = await registro.json();
  const headers = { Authorization: `Bearer ${token}` };
  const ahora = new Date();
  await request.post(`${api}/presupuesto/establecer`, { headers, data: { limite: 1500, mes: ahora.getMonth() + 1, anio: ahora.getFullYear() } });
  await request.post(`${api}/gastos/registrar`, { headers, data: { monto: 40, motivo: 'Fotocopias', tipo: 'gasto', categoria: 'estudio' } });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/login');
  await page.getByPlaceholder('Correo').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${carpeta}/foco-login.png` });

  await page.evaluate((t) => sessionStorage.setItem('token', t), token);
  await page.goto('/pagos');
  await expect(page.getByRole('heading', { level: 2, name: 'Resumen Financiero del Mes' })).toBeVisible();
  await page.screenshot({ path: `${carpeta}/pagos-resumen-h2.png` });

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  // Enlace activo del menú: botón oscuro (tinta) con el anillo de foco alrededor.
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Dashboard' }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${carpeta}/foco-menu-activo.png`, clip: { x: 0, y: 0, width: 1280, height: 120 } });
});
