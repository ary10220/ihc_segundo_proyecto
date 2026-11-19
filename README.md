# Presupuesto Estudiantil (FinanzApp)

App web para que un estudiante universitario con un ingreso pequeño y fijo sepa **cuánto tiene, en qué se le va y cuándo frenar**.

Proyecto 2 de Interacción Humano-Computadora. Es un fork del proyecto de Marcos Guzmán ([ficha original](docs/project-card.md)); desde el commit `962070e` en adelante es trabajo del fork.

**Integrantes:** Ariany Claure · Enrique Franco

## Enlaces

| Qué | Dónde |
|---|---|
| App en la nube | <https://presupuesto-estudiantil.vercel.app/> (API: <https://presupuesto-estudiantil.onrender.com>; la primera carga puede tardar unos segundos mientras Render despierta) |
| Sistema de diseño en Figma | [presentacion_final/IHC.fig](presentacion_final/IHC.fig): en Figma, *Archivo → Importar*. Páginas *1 Estilos*, *2 Componentes* y *3 Pantallas* |
| Tokens y tabla componente ↔ archivo | [docs/tokens-y-componentes.md](docs/tokens-y-componentes.md) · [guía de estilos](docs/guia-estilos-figma.html) |
| Pruebas automatizadas y cobertura | [docs/pruebas-automatizadas.md](docs/pruebas-automatizadas.md) · [reporte de cobertura](docs/cobertura/backend/index.html) |
| Accesibilidad (Lighthouse + axe + contraste AA) | [docs/accesibilidad/README.md](docs/accesibilidad/README.md) |
| Video de la app | [presentacion_final/presupuesto.mp4](presentacion_final/presupuesto.mp4) |
| Informe | [presentacion_final/Informe_Presupuesto_Estudiantil.docx](presentacion_final/Informe_Presupuesto_Estudiantil.docx) · también en la [carpeta de Drive](https://drive.google.com/drive/folders/1USQtgiUW67l5txRU3K5dTD-CO7AmgFDq) |
| Diapositivas | [presentacion_final/Presupuesto Estudiantil.pptx](<presentacion_final/Presupuesto Estudiantil.pptx>) · también en la [carpeta de Drive](https://drive.google.com/drive/folders/1USQtgiUW67l5txRU3K5dTD-CO7AmgFDq) |
| Evidencias por clase y tarea | [evidencias/](evidencias/) |

## Qué hace

- **Presupuesto mensual** y límites por categoría (comida, transporte, estudio, otros) con semáforo: verde, alerta desde el 80 % y excedido.
- **Aviso antes de pasar un límite** al registrar o editar un gasto, con un botón neutro «Guardar igual».
- **Movimientos**: ingresos y gastos, estado pendiente/pagado, filtros rápidos e historial del mes.
- **Gastos recurrentes** semanales o mensuales que se registran solos.
- **Metas de ahorro**: asignar, retirar y transferir fondos entre metas, sin poder gastar más de lo disponible.
- **Mis datos**: ver lo que guarda la app, descargarlo en JSON o CSV y eliminar la cuenta con todos sus datos.
- **Analítica anónima** del embudo principal, sin guardar montos, motivos ni datos personales.

## Tecnologías

| Parte | Stack |
|---|---|
| Frontend (`frontend/`) | React 19, TypeScript, Vite, React Router |
| Backend (`backend/`) | Node.js, Express 5, Sequelize, PostgreSQL, JWT, bcrypt |
| Pruebas | Playwright + axe-core (E2E y accesibilidad), Jest (unitarias), Lighthouse |
| Despliegue | Vercel (frontend) y Render (backend + PostgreSQL) |

## Correr en local

Requisitos: **Node 24**, **PostgreSQL** (probado con la 18) y **pnpm** (solo para las pruebas E2E: `npm install -g pnpm`).

### 1. Base de datos

Crea una base vacía; las tablas las crea el backend al arrancar.

```bash
psql -U postgres -c "CREATE DATABASE presupuesto_estudiantil;"
```

### 2. Backend (puerto 4000)

```bash
cd backend
cp .env.example .env    # en Windows: copy .env.example .env
```

Completa `backend/.env`:

```env
DB_NAME=presupuesto_estudiantil
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_HOST=localhost
DB_PORT=5432
DB_SSL=false
JWT_SECRET=cualquier_texto_largo_y_secreto
```

```bash
npm install
npm run seed     # crea el usuario de prueba
npm start        # http://localhost:4000
```

Debe decir `PostgreSQL conectado correctamente` y `Servidor ejecutandose en http://localhost:4000`.

### 3. Frontend (puerto 5173)

En otra terminal:

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

En local no hace falta `.env`: el frontend usa `http://localhost:4000` por defecto. Entra con el usuario de prueba o crea una cuenta desde «Crear cuenta».

## Pruebas

Con PostgreSQL encendido. Las E2E levantan el backend y el frontend solas.

```bash
# Desde la raíz
pnpm install
pnpm run install:e2e:browser   # una sola vez: descarga Chromium
pnpm run test:e2e              # 46 pruebas E2E (incluye accesibilidad WCAG 2.1 AA)
pnpm run a11y:lighthouse       # reporte Lighthouse de las 11 pantallas -> docs/accesibilidad/lighthouse/

# Backend
cd backend
npm test                       # 144 pruebas unitarias
npm run test:cobertura         # + reporte en docs/cobertura/backend (exige 100 % del código del fork)
```

Detalle de qué cubre cada suite: [docs/pruebas-automatizadas.md](docs/pruebas-automatizadas.md).

## Despliegue

**Backend en Render** (Web Service, carpeta raíz `backend`):

- Build: `npm install` · Start: `npm start`
- Variables: las mismas de `backend/.env` con los datos de la base de Render y `DB_SSL=true`. `PORT` lo pone Render.
- Una vez desplegado, crea el usuario de prueba desde la Shell de Render: `npm run seed`.

**Frontend en Vercel** (carpeta raíz `frontend`):

- `frontend/vercel.json` ya define el build (`vite build`), la salida (`dist`) y la redirección de rutas a `index.html`.
- Variable: `VITE_API_URL=https://<tu-backend>.onrender.com`.

## Estructura

```
backend/    API Express: src/controllers, src/models, src/routes, src/services; tests/ (Jest)
frontend/   App React: src/pages (una por pantalla), src/components, src/index.css (tokens)
e2e/        Pruebas Playwright, axe y script de Lighthouse
docs/       Decisiones, tokens, accesibilidad, cobertura y guion
evidencias/ Evidencias de cada clase y tarea
```
