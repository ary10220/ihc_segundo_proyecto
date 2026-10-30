# Presupuesto Estudiantil — Pruebas E2E

Pruebas de extremo a extremo del flujo principal de **Presupuesto Estudiantil**
(login → registrar gasto → el total cambia) con **Playwright** y **Chromium**.

> Este `package.json` de la raíz es **solo para las pruebas**. El backend y el
> frontend siguen usando `npm` en sus propias carpetas.

---

## Requisitos

| Herramienta | Versión usada |
|---|---|
| Node.js LTS | 22 (`v22.23.4`) |
| pnpm | 12 (`12.16.1`) |
| PostgreSQL | local, base `presupuesto_estudiantil_ihc` |
| Backend | Express en `http://localhost:4000` |
| Frontend | Vite en `http://localhost:5173` |

La primera vez, instalar dependencias y el navegador:

```powershell
pnpm install
pnpm exec playwright install chromium
```

---

## Usuario de prueba

La semilla crea (o actualiza) este usuario:

| Campo | Valor |
|---|---|
| Correo | `e2e@presupuesto.test` |
| Contraseña | `E2e12345` |

También le deja un presupuesto mensual amplio y un presupuesto de categoría
`comida`, para que el registro de gastos nunca falle por falta de saldo.

---

## Cómo ejecutar

### 1. Crear los datos semilla (una sola vez por sesión)

```powershell
pnpm run seed
```

Es **idempotente**: se puede repetir las veces que haga falta sin duplicar
usuarios ni presupuestos.

### 2. Correr las pruebas

```powershell
pnpm test:e2e
```

Playwright **levanta solo** el backend (`:4000`) y el frontend (`:5173`).
Si ya los tenés abiertos en otra terminal, los reutiliza.

### 3. Ver el reporte

```powershell
pnpm run test:e2e:report
```

Las capturas y videos de las pruebas fallidas quedan en `test-results/`, y el
reporte HTML en `playwright-report/` (ambas carpetas están ignoradas por Git).

---

## Qué verifica

| Prueba | Qué comprueba |
|---|---|
| **Camino feliz** | Login con el usuario semilla → abre Gastos → lee el total previo desde la API → registra un gasto de Bs 50 con el motivo indicado → aparece el mensaje *"Gasto registrado correctamente."* → el total sube exactamente Bs 50 → el movimiento aparece en la lista → al recargar (F5) la sesión y el gasto persisten. |
| **Camino alternativo** | Entrar a `/gastos` sin sesión redirige a `/login` (permiso). |
| **Estado vacío** | Una búsqueda sin coincidencias muestra *"No se encontraron movimientos con los filtros seleccionados."* |

Los selectores son **accesibles**: `getByLabel`, `getByRole` y `getByText`.
No se usan selectores CSS ni XPath.

---

## Estructura

```
.
├── playwright.config.ts          # servidores, navegador, reportes
├── tests/
│   └── flujo-principal.spec.ts   # las 3 pruebas
└── backend/
    └── scripts/seed.js           # datos semilla
```

---

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `pnpm` no se reconoce | Abrir una terminal nueva (el instalador agregó `pnpm` al PATH). |
| Error de conexión a PostgreSQL | Verificar que el servicio de PostgreSQL esté corriendo y que `backend/.env` tenga las credenciales correctas. |
| Playwright dice que falta el navegador | `pnpm exec playwright install chromium` |
| El puerto 4000 o 5173 está ocupado | Cerrar el proceso que lo ocupa, o dejar que Playwright reutilice el servidor que ya está abierto. |
| Falla el login | Volver a correr `pnpm run seed` para restaurar el usuario de prueba. |
