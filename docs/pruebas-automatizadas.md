# Pruebas automatizadas

Dos suites: **E2E con Playwright** (la app completa en Chromium, contra el backend y PostgreSQL reales) y **unitarias con Jest** (lógica del backend, con la base de datos simulada).

## Resultado al 18/11/2026

| Suite | Pruebas | Resultado |
|---|---:|---|
| E2E (Playwright, `e2e/`) | 45 | 45 pasan |
| Unitarias (Jest, `backend/tests/`) | 137 | 137 pasan |
| Cobertura del código del backend que agregó el fork | 435 sentencias · 174 ramas · 48 funciones · 417 líneas | **100 % en las cuatro** |

## Cómo correrlas

Requisitos: Node 24, pnpm y PostgreSQL con la base configurada en `backend/.env`.

```bash
# E2E (levanta solo el backend en :4000 y el frontend en :5173)
pnpm install
pnpm run install:e2e:browser   # una sola vez
pnpm run test:e2e
npx playwright show-report     # reporte HTML de la última corrida

# Unitarias + cobertura
cd backend
npm install
npm test                       # solo las pruebas
npm run test:cobertura         # pruebas + reporte; falla si la cobertura baja de 100 %
```

## Qué cubre la suite E2E

| Archivo | Flujo |
|---|---|
| `presupuesto.spec.ts` | Registrar y pagar un gasto, rechazo por saldo, redirección sin sesión, gastos recurrentes semanales y mensuales por usuario |
| `estado-gastos.spec.ts` | Filtros rápidos Pendientes / Pagados |
| `aviso-limite.spec.ts` | Aviso al pasar el límite por categoría al crear y al editar |
| `metas.spec.ts` | Metas de ahorro: asignar, transferir, retirar, sin fondos y usuario ajeno |
| `mis-datos.spec.ts` | Ver, descargar (JSON/CSV) y eliminar la cuenta; confirmación honesta y error del servidor |
| `mantener-sesion.spec.ts` | «Mantener sesión iniciada» desmarcado por defecto y dónde queda el token |
| `analitica.spec.ts` | Eventos del embudo sin datos personales |
| `accesibilidad.spec.ts` | axe WCAG 2.1 AA en las 11 pantallas, el error de login y el diálogo de eliminar; contraste AA de tokens y foco visible ([informe](accesibilidad/README.md)) |
| `capturas-*.spec.ts` | Capturas de evidencia de las clases 20, 22, 23 y del informe de accesibilidad |

## Cobertura: qué se mide

«El código que agregamos en el fork» son los archivos del backend que **no existían** en el proyecto original (último commit del autor original: `962070e`). Están listados en `collectCoverageFrom` de [`backend/package.json`](../backend/package.json):

- Controladores: `analiticaController`, `gastoRecurrenteController`, `metaController`, `misDatosController`, `presupuestoCategoriaController`
- Servicios: `gastoRecurrenteService`, `metaService`
- Modelos: `Evento`, `GastoRecurrente`, `Meta`, `MovimientoMeta`, `PresupuestoCategoria`
- Rutas: `analiticaRoutes`, `gastoRecurrenteRoutes`, `metaRoutes`, `misDatosRoutes`, `presupuestoCategoriaRoutes`

`coverageThreshold` está en 100 % para sentencias, ramas, funciones y líneas: si alguien agrega código sin prueba, `npm run test:cobertura` falla.

Reporte: abre [`docs/cobertura/backend/index.html`](cobertura/backend/index.html) en el navegador. Resumen en [`coverage-summary.json`](cobertura/backend/coverage-summary.json).

Lo que **no** entra en ese 100 %: los cambios del fork dentro de archivos que ya existían (por ejemplo `gastoController.js`) y el frontend en React. El frontend se valida con la suite E2E, que recorre sus flujos en el navegador.
