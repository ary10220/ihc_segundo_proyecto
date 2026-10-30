import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de las pruebas E2E de Presupuesto Estudiantil.
 *
 * - La app corre en http://localhost:5173 (Vite) y la API en http://localhost:4000.
 * - Playwright levanta ambos servidores solo; si ya están abiertos, los reutiliza.
 * - workers: 1 porque las pruebas comparten la misma base de datos.
 */
export default defineConfig({
  testDir: './tests',

  /* Las pruebas no corren en paralelo: comparten usuarios y datos reales. */
  fullyParallel: false,
  workers: 1,

  /* Falla si alguien dejó un test.only olvidado en el código. */
  forbidOnly: !!process.env.CI,

  /* Sin reintentos: si falla, queremos ver el fallo real. */
  retries: 0,

  /* Tiempo máximo por prueba. */
  timeout: 60_000,

  expect: {
    timeout: 10_000,
  },

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:5173',

    /* Guarda la traza cuando una prueba falla por primera vez. */
    trace: 'on-first-retry',

    /* Capturas y video solo si algo sale mal. */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Levanta backend y frontend automáticamente antes de correr las pruebas. */
  webServer: [
    {
      command: 'npm --prefix backend run dev',
      url: 'http://localhost:4000/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm --prefix frontend run dev',
      url: 'http://localhost:5173/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
