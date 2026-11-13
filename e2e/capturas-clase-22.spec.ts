import { test } from '@playwright/test';

// Clase 22 - captura del "despues": checkbox DESMARCADO por defecto.
// Para la captura del "antes", ver evidencias/clase-22/antes-prechecked.png
// (se obtiene temporalmente marcando el checkbox con JS para simular el estado pre-fix).

const APP = 'http://localhost:5173';

test('captura despues del fix - checkbox desmarcado por defecto', async ({ page }) => {
    await page.goto(`${APP}/login`);
    // Estado natural: checkbox viene en false.
    await page.screenshot({ path: 'evidencias/clase-22/despues-desmarcado.png', fullPage: true });
});

test('captura antes del fix - simulamos el patron oscuro (checkbox marcado)', async ({ page }) => {
    await page.goto(`${APP}/login`);
    // Simulamos como se veia ANTES: checkbox pre-marcado.
    await page.getByLabel(/Mantener sesión iniciada/).check();
    await page.screenshot({ path: 'evidencias/clase-22/antes-prechecked.png', fullPage: true });
});
