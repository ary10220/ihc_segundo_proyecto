// Reporte de accesibilidad con Lighthouse para todas las pantallas de la app.
//
// Uso (desde la raíz del repo, con la base de datos encendida):
//   pnpm run a11y:lighthouse            -> reporte "despues" en docs/accesibilidad/lighthouse/
//   pnpm run a11y:lighthouse -- antes   -> guarda en docs/accesibilidad/lighthouse/antes/
//
// Si el backend (4000) o el frontend (5173) no están encendidos, el script los levanta
// y los apaga al terminar. Las pantallas privadas se auditan con la cuenta E2E.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';

const root = fileURLToPath(new URL('../', import.meta.url));
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(root, '.playwright-browsers');
const { chromium } = await import('@playwright/test');

const API = 'http://127.0.0.1:4000';
const APP = 'http://127.0.0.1:5173';
const PUERTO_CDP = 9333;
const etapa = process.argv[2] === 'antes' ? 'antes' : 'despues';
const salida = path.join(root, 'docs', 'accesibilidad', 'lighthouse', etapa === 'antes' ? 'antes' : '');

const PANTALLAS = [
  { nombre: 'inicio', ruta: '/' },
  { nombre: 'login', ruta: '/login' },
  { nombre: 'registro', ruta: '/register' },
  { nombre: 'recuperar-contrasena', ruta: '/forgot-password' },
  { nombre: 'dashboard', ruta: '/dashboard', privada: true },
  { nombre: 'gastos', ruta: '/gastos', privada: true },
  { nombre: 'pagos', ruta: '/pagos', privada: true },
  { nombre: 'historial', ruta: '/historial', privada: true },
  { nombre: 'metas', ruta: '/metas', privada: true },
  { nombre: 'mis-datos', ruta: '/mis-datos', privada: true },
  { nombre: 'analitica', ruta: '/analitica' }
];

async function responde(url) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function esperar(url, segundos = 60) {
  for (let i = 0; i < segundos; i += 1) {
    if (await responde(url)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No respondió ${url}`);
}

const procesos = [];
async function asegurarServidor(url, comando, args, cwd) {
  if (await responde(url)) return;
  const proceso = spawn(process.execPath, args, { cwd: path.join(root, cwd), stdio: 'ignore' });
  procesos.push(proceso);
  await esperar(url);
}

async function tokenE2E() {
  const credenciales = {
    email: process.env.E2E_EMAIL ?? 'e2e@test.com',
    password: process.env.E2E_PASSWORD ?? 'e2e12345'
  };
  let r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credenciales)
  });
  if (!r.ok) {
    r = await fetch(`${API}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...credenciales, name: 'Usuario E2E' })
    });
  }
  if (!r.ok) throw new Error(`No se pudo iniciar sesión con la cuenta E2E: ${await r.text()}`);
  return (await r.json()).token;
}

await asegurarServidor(API, 'node', ['server.js'], 'backend');
await asegurarServidor(APP, 'node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], 'frontend');

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-perfil-'));
const navegador = await chromium.launchPersistentContext(perfil, {
  headless: true,
  args: [`--remote-debugging-port=${PUERTO_CDP}`]
});

const resumen = [];
try {
  const token = await tokenE2E();
  const pagina = navegador.pages()[0] ?? (await navegador.newPage());
  await pagina.goto(APP);

  fs.mkdirSync(salida, { recursive: true });
  for (const pantalla of PANTALLAS) {
    // Las públicas se auditan sin sesión (como las ve alguien nuevo); las privadas con sesión.
    await pagina.evaluate(([t, privada]) => {
      sessionStorage.clear();
      if (privada) localStorage.setItem('token', t);
      else localStorage.removeItem('token');
    }, [token, Boolean(pantalla.privada)]);

    const resultado = await lighthouse(`${APP}${pantalla.ruta}`, {
      port: PUERTO_CDP,
      output: 'html', // el HTML ya trae el JSON completo embebido
      onlyCategories: ['accessibility'],
      disableStorageReset: true,
      formFactor: 'desktop',
      screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
      logLevel: 'error'
    });
    fs.writeFileSync(path.join(salida, `${pantalla.nombre}.html`), resultado.report);

    const lhr = resultado.lhr;
    const fallas = Object.values(lhr.audits)
      .filter((a) => a.score === 0 && a.scoreDisplayMode === 'binary')
      .map((a) => ({
        id: a.id,
        titulo: a.title,
        elementos: (a.details?.items ?? []).map((i) => i.node?.snippet ?? i.node?.selector ?? '').slice(0, 10)
      }));
    resumen.push({
      pantalla: pantalla.nombre,
      ruta: pantalla.ruta,
      urlFinal: lhr.finalDisplayedUrl,
      puntaje: Math.round(lhr.categories.accessibility.score * 100),
      fallas
    });
    console.log(`${pantalla.nombre.padEnd(22)} ${String(Math.round(lhr.categories.accessibility.score * 100)).padStart(3)}  ${fallas.map((f) => f.id).join(', ') || 'sin fallas'}`);
  }
  fs.writeFileSync(path.join(salida, 'resumen.json'), JSON.stringify({ fecha: new Date().toISOString(), etapa, resumen }, null, 2) + '\n');
} finally {
  await navegador.close();
  for (const p of procesos) p.kill();
  fs.rmSync(perfil, { recursive: true, force: true });
}
