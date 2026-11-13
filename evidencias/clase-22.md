# Clase 22 · Patrones oscuros

**Integrantes:** Franco Enrique · Ariany Claure
**Modalidad:** con IA

## 1. Patrón encontrado

**Tipo (de los seis):** PRIVACIDAD · Privacidad por defecto.

**Dónde:** pantalla **Iniciar sesión** · [frontend/src/pages/Login.tsx:47](../frontend/src/pages/Login.tsx)

**Por qué es un patrón oscuro:**
Al iniciar sesión, el `token` del usuario se guardaba **siempre** en `localStorage`. Eso significa que la sesión **persiste** incluso después de cerrar el navegador, cambiar de usuario en la máquina o prestar la computadora un rato — sin que el usuario lo haya pedido.

- **A quién beneficia:** al sistema (menos fricción, el usuario "no tiene que volver a entrar").
- **Qué no ve el usuario:** que cualquiera que abra el mismo navegador después de él va a estar logueado con su cuenta. En una laptop prestada o una PC compartida (contexto típico de estudiantes) esto es un **riesgo de privacidad real**.

Este patrón ataca directamente **"Privacidad por defecto"** (slide 7): *"Lo que viene marcado protege al usuario. Compartir más es una decisión suya, no del sistema."* La persistencia de sesión es exactamente ese "más" que no se debería dar por defecto.

## 2. Antes

**Captura:** [clase-22/antes-prechecked.png](clase-22/antes-prechecked.png)

**Fragmento de código** ([frontend/src/pages/Login.tsx](../frontend/src/pages/Login.tsx), versión previa):

```tsx
if (response.ok) {
    localStorage.setItem('token', data.token);  // SIEMPRE persiste
    navigate('/dashboard');
}
```

Y en el formulario **no había ningún checkbox** — el usuario no tenía manera de decidir si quería que su sesión se recordara o no. El default silencioso era: sí, recordar siempre.

## 3. Después

**Captura:** [clase-22/despues-desmarcado.png](clase-22/despues-desmarcado.png)

**Commit:** `fix(etica): mantener sesion opcional con checkbox desmarcado por defecto` *(pendiente de aprobación antes de commit)*

**Fragmento de código** ([frontend/src/pages/Login.tsx](../frontend/src/pages/Login.tsx)):

```tsx
const [mantenerSesion, setMantenerSesion] = useState(false);  // desmarcado por defecto

// ... en el JSX:
<label>
    <input
        type="checkbox"
        checked={mantenerSesion}
        onChange={(e) => setMantenerSesion(e.target.checked)}
    />
    Mantener sesión iniciada (solo si usás tu propio dispositivo)
</label>

// ... al login:
if (response.ok) {
    guardarToken(data.token, mantenerSesion);  // sessionStorage si no se marca
    navigate('/dashboard');
}
```

Nueva utilidad ([frontend/src/utils/auth.ts](../frontend/src/utils/auth.ts)):

```ts
export function guardarToken(token: string, mantenerSesion: boolean) {
    sessionStorage.setItem('token', token);
    if (mantenerSesion) {
        localStorage.setItem('token', token);
    } else {
        localStorage.removeItem('token');
    }
}

export function obtenerToken(): string | null {
    return sessionStorage.getItem('token') || localStorage.getItem('token');
}

export function limpiarToken() {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
}
```

Todos los lugares que antes hacían `localStorage.getItem('token')` (Dashboard, Gastos, Historial, Metas, Pagos, ProtectedRoute, Navbar) ahora usan `obtenerToken()` / `limpiarToken()` para seguir funcionando con **cualquiera** de los dos storages.

## 4. Principio aplicado

**Principio:** PRIVACIDAD · **Privacidad por defecto** (slide 7, columna 2).

**Cómo lo cumple el después:**

1. **El default protege al usuario.** El checkbox viene **desmarcado** → el token solo vive en `sessionStorage` → desaparece al cerrar la pestaña. Nadie que abra después el navegador puede entrar con su cuenta.
2. **Compartir más es una decisión suya.** Si el usuario está en su propia PC y quiere la comodidad de no volver a loguearse, **marca el checkbox activamente** → recién ahí el token va a `localStorage`.
3. **El texto explica el alcance.** No dice solo *"Mantener sesión iniciada"* (que sonaría a ventaja neutra), sino *"Mantener sesión iniciada (solo si usás tu propio dispositivo)"* — se le dice al usuario cuándo tiene sentido marcarla.
4. **Es paralelo al ejemplo canónico de la slide.** La slide muestra el `<input type="checkbox" checked>Compartir mi ubicación` → corregido a `<input type="checkbox">Compartir mi ubicación (solo mientras dure el plan)`. Acá cambiamos exactamente lo mismo: quitar el default persistente + explicar el alcance.

## 5. Prueba

**Archivo:** [e2e/mantener-sesion.spec.ts](../e2e/mantener-sesion.spec.ts)

**3 tests** (siguen el ejemplo de la slide 8):

1. `el checkbox Mantener sesión iniciada viene desmarcado por defecto` — verifica que `getByLabel(/Mantener sesión iniciada/).not.toBeChecked()`. **Si alguien vuelve a poner `checked={true}` por default, este test lo avisa.**
2. `si NO se marca "Mantener sesión", el token no queda en localStorage al cerrar` — confirma el comportamiento: `sessionStorage.token` definido, `localStorage.token === null`.
3. `si SE marca "Mantener sesión", el token sí persiste en localStorage` — confirma que el opt-in explícito sí persiste.

**Resultado:**

| Momento | Resultado |
|---|---|
| **Antes del fix** (sin checkbox) | **3 failed** — no existe el label *"Mantener sesión iniciada"*, `getByLabel(...)` no encuentra nada |
| **Después del fix** | **3 passed (8.9 s)** ✅ |

**Comando:**
```bash
pnpm exec playwright test e2e/mantener-sesion.spec.ts --project=chromium
```

**Suite anterior:** `pnpm exec playwright test --project=chromium` → **23 passed, 2 failed**. Los 2 fallos son pre-existentes de `analitica.spec.ts` (bug de contaminación de `localStorage` entre tests de Enrique), **no fueron rotos por este cambio**.

## 6. Otros que encontramos

Patrones que vimos pero no corrigieron hoy:

- **`window.confirm` al eliminar gasto (Gastos.tsx:211):** *"Esta acción no se puede deshacer"* es una confirmación con culpa + salida difícil (Nielsen #3). Lo ideal sería reemplazarlo por un banner con botón **Deshacer** por 5 segundos.
- **Texto *"Guardar de todas formas"* en el aviso de límite (Gastos.tsx):** puede sentirse como "a pesar de que te advertimos". Es menor que el anterior pero se podría neutralizar a *"Guardar igual"*.
- **Botón *"Marcar como pagado"* (Pagos.tsx):** dispara un cambio de estado desde la UI sin confirmación ni deshacer. Consistente aplicar el mismo patrón de Deshacer.
- **`alert()` en varios flujos:** confirmaciones ruidosas que podrían ser toasts discretos.
