# Tarea 10 · Mis datos y salida honesta

## Integrantes

- Luis Enrique Franco Moron
- Ariany Claure Cota

Proyecto: **Presupuesto Estudiantil** (FinanzApp). Entrega: lunes 16/11/2026, 23:59.

## La regla de nuestra app

> **Se elimina todo: movimientos, presupuestos y metas. Antes puede descargar sus movimientos.**

En Presupuesto Estudiantil ningún dato afecta a otra persona, así que la eliminación **nunca se bloquea por regla de negocio**. Lo único que puede impedirla es un fallo del servidor, y en ese caso el mensaje dice **por qué** y **qué hacer**, y no se borra nada (todo ocurre en una transacción).

## 1 · Mis datos: ver y descargar

Pantalla nueva **Mis datos** (`/mis-datos`, enlace en la barra de navegación) — `frontend/src/pages/MisDatos.tsx`.

- **Lo que guardamos de ti:** nombre, correo, fecha de creación y cuántos registros hay de cada tipo (movimientos, pagos recurrentes, presupuestos, límites por categoría, metas y movimientos de metas).
- **Descargar todo (JSON):** cuenta + todas las tablas. Nunca incluye la contraseña.
- **Descargar movimientos (CSV):** `fecha,tipo,categoria,motivo,monto,estado`, listo para Excel. Las celdas que empiezan con `=`, `+`, `-` o `@` se neutralizan para evitar inyección de fórmulas.

Backend: `backend/src/controllers/misDatosController.js` y `backend/src/routes/misDatosRoutes.js`.

| Endpoint | Qué hace |
|---|---|
| `GET /api/mis-datos` | Resumen de lo que se guarda |
| `GET /api/mis-datos/exportar?formato=json\|csv` | Descarga |
| `DELETE /api/mis-datos/cuenta` (body `{ confirmar: true }`) | Elimina la cuenta y todo en una transacción |

## 2 · Eliminar la cuenta con la regla de la app

`eliminarCuenta` borra en una sola transacción: `Gasto`, `GastoRecurrente`, `Presupuesto`, `PresupuestoCategoria`, `MovimientoMeta`, `Meta` y el `User`. Si algo falla, se revierte todo.

**Después de eliminarla no puede iniciar sesión:** el usuario ya no existe (`/login` responde 404) y además `authenticateToken` ahora comprueba que la cuenta exista, así que un token emitido antes de eliminarla responde **401**.

## 3 · Confirmación honesta

El diálogo `¿Eliminar tu cuenta?`:

- **Consecuencias explicadas con números reales:** «Se eliminará para siempre: 2 movimientos…, 1 presupuestos…, 1 metas de ahorro y su historial» y «Después no podrás iniciar sesión con este correo».
- **Ofrece descargar antes** (regla de la app) con un botón dentro del mismo diálogo.
- **Botones del mismo tamaño** (`.dialogo-botones`, grid de 2 columnas): **Conservar mi cuenta** y **Eliminar definitivamente**. La E2E compara sus `boundingBox`.
- **Sin culpa:** nada de «¿Seguro que quieres abandonarnos?» ni «Te vamos a extrañar». Textos neutros.
- **Sin pasos de más:** un clic para abrir, un clic para confirmar. No pide escribir «ELIMINAR», ni encuesta de salida, ni correo de confirmación.
- El foco va a **Conservar mi cuenta** (la opción segura) y `Esc` cancela.
- Al terminar, va a `/login` con el aviso «Tu cuenta y todos tus datos fueron eliminados.».

## 4 · Revisión de los seis patrones en toda la app

| Patrón | Qué encontramos | Qué corregimos | Pendiente |
|---|---|---|---|
| **Salida difícil** | No existía forma de eliminar la cuenta ni de llevarse los datos. | Pantalla *Mis datos* con descarga JSON/CSV y eliminación en dos clics. | — |
| **Confirmación con culpa** | El aviso de límite decía «Guardar de todas formas» / «¿Quieres guardarlo de todas formas?», que suena a reproche. | Cambiado a **«Guardar igual»** (`Gastos.tsx`). El diálogo de eliminar cuenta usa textos neutros. | El `window.confirm` al eliminar un gasto dice «¿Estás seguro…? no se puede deshacer»: reemplazar por *Deshacer* durante unos segundos. |
| **Privacidad por defecto** | La sesión se guardaba siempre en `localStorage`. | Corregido en la Clase 22 (checkbox desmarcado). Ahora además *Mis datos* aclara que la analítica es anónima y local. | — |
| **Costos ocultos** | No hay pagos en la app. Revisamos que el *Saldo disponible* descuente lo reservado en metas y lo diga en pantalla. | Nada que corregir. | — |
| **Urgencia falsa** | No hay contadores, ofertas ni «solo hoy». El aviso de límite muestra montos reales. | Nada que corregir. | — |
| **Interferencia de interfaz** (botones desiguales, opción preferida destacada) | En el aviso de límite el botón de confirmar es primario y el de cancelar secundario; el de pagos «Marcar como pagado» actúa sin confirmación ni deshacer. | En el diálogo de eliminar cuenta los dos botones tienen el mismo tamaño. | Igualar los botones del aviso de límite y añadir *Deshacer* a «Marcar como pagado». Reemplazar los `alert()` de Gastos por mensajes en página. |

## 5 · E2E, eventos y evidencia

### Eventos (lista cerrada de la Tarea 9, `frontend/src/utils/analitica.ts`)

| Evento | Cuándo | Props |
|---|---|---|
| `eliminacion_iniciada` | Abre el diálogo (inicio) | — |
| `cuenta_eliminada` | El servidor confirmó (éxito) | — |
| `eliminacion_bloqueada` | El servidor rechazó (bloqueo) | `motivo` de la lista fija |
| `eliminacion_cancelada` | Elige *Conservar mi cuenta* | — |
| `datos_descargados` | Descarga | `formato` (`json`/`csv`), `origen` |

Ninguno guarda correo, nombre, montos ni motivos. El panel `/analitica` muestra el embudo **Eliminar cuenta (Tarea 10)**.

### Pruebas

`e2e/mis-datos.spec.ts`:

| Caso | Resultado |
|---|---|
| Ver y descargar: conteos correctos, JSON con 2 movimientos y 1 meta sin contraseña, CSV con cabecera y el movimiento | ✅ |
| Confirmación honesta: botones del mismo ancho y alto, foco en *Conservar*, cancelar no borra nada | ✅ |
| Intento bloqueado: el servidor responde 500 → se ve «Por qué…» y «Qué hacer…», la cuenta sigue viva, evento `eliminacion_bloqueada` | ✅ |
| Eliminación completa: aviso en `/login`, token viejo → 401, login → falla, eventos de inicio y éxito sin el correo ni el motivo | ✅ |

`backend/tests/misDatos.test.js`: sin `confirmar` no borra y dice qué hacer; confirmado borra todas las tablas y la cuenta; CSV escapa comas y fórmulas.

```bash
pnpm --dir backend exec jest --runInBand
pnpm test:e2e e2e/mis-datos.spec.ts
```

Resultado: backend **48/48**. E2E completa **27/27** (4 nuevas de la Tarea 10).
