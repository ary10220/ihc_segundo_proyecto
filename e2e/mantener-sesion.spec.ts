import { test, expect, request, type APIRequestContext } from '@playwright/test';

// Clase 22 - Patron oscuro corregido (Privacidad por defecto).
// Antes: el token se guardaba SIEMPRE en localStorage, incluso sin que el usuario lo pidiera.
// Fix: checkbox "Mantener sesión iniciada" viene DESMARCADO. Si no se marca,
// el token va solo a sessionStorage y se borra al cerrar el navegador.
// Estas pruebas FALLAN con el antes y PASAN con el despues.

const API = 'http://127.0.0.1:4000/api';

async function registrarUsuario(req: APIRequestContext) {
    const email = `clase22-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.com`;
    const password = 'clase22pwd';
    const r = await req.post(`${API}/auth/register`, { data: { name: 'Clase22', email, password } });
    expect(r.ok()).toBeTruthy();
    return { email, password };
}

test('el checkbox Mantener sesión iniciada viene desmarcado por defecto', async ({ page }) => {
    await page.goto('/login');
    const checkbox = page.getByLabel(/Mantener sesión iniciada/);
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
});

test('si NO se marca "Mantener sesión", el token no queda en localStorage al cerrar', async ({ page, request }) => {
    const u = await registrarUsuario(request);

    await page.goto('/login');
    await page.getByPlaceholder('Correo').fill(u.email);
    await page.getByPlaceholder('Contraseña').fill(u.password);
    // Checkbox queda en false (default)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const storage = await page.evaluate(() => ({
        local: localStorage.getItem('token'),
        session: sessionStorage.getItem('token')
    }));
    // Token va a sessionStorage, NO a localStorage
    expect(storage.session).toBeTruthy();
    expect(storage.local).toBeNull();
});

test('si SE marca "Mantener sesión", el token sí persiste en localStorage', async ({ page, request }) => {
    const u = await registrarUsuario(request);

    await page.goto('/login');
    await page.getByPlaceholder('Correo').fill(u.email);
    await page.getByPlaceholder('Contraseña').fill(u.password);
    await page.getByLabel(/Mantener sesión iniciada/).check();
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const storage = await page.evaluate(() => ({
        local: localStorage.getItem('token'),
        session: sessionStorage.getItem('token')
    }));
    expect(storage.local).toBeTruthy();
    expect(storage.session).toBeTruthy();
});
