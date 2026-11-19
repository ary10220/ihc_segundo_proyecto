# Tokens y componentes: Figma ↔ código

Archivo de Figma: **IHC** (páginas *1 Estilos*, *2 Componentes*, *3 Pantallas*).
Código: los tokens viven en `:root` de [`frontend/src/index.css`](../frontend/src/index.css). Fuera de `:root` no hay colores fijos: todo usa `var(--token)`.

## Tokens de color

En Figma son variables de la colección **Tokens** (`color/<nombre>`) y estilos de color con el mismo `<nombre>`. En CSS son `--<nombre>`.

| Token (Figma `color/…` = CSS `--…`) | Valor | Uso |
|---|---|---|
| `bg` | `#f5f5f8` | Fondo de página |
| `surface` | `#ffffff` | Tarjetas, campos, texto sobre fondo oscuro |
| `surface-2` | `#f0f0f6` | Fondo secundario |
| `ink` | `#16182c` | Texto principal, botón principal, paneles oscuros |
| `muted` | `#5c5f75` | Texto secundario |
| `line` | `#e3e3ec` | Bordes y separadores |
| `line-hover` | `#cfcfdd` | Borde de fila al pasar el mouse |
| `border-input` | `#d6d6e2` | Borde de campos y botón secundario |
| `placeholder` | `#6b6e83` | Placeholder de campos |
| `accent-text` | `#4436c7` | Enlaces, antetítulos, foco |
| `accent-soft` | `#ecebfa` | Fondo de acento suave |
| `accent-hover` | `#2a2d4a` | Hover del botón principal |
| `highlight` | `#c9c3ff` | Lavanda (destacados) |
| `accent-border` | = `highlight` | Borde de acento (alias) |
| `label-destacado` | `#2c2a55` | Etiqueta de la métrica destacada |
| `on-dark-muted` | `#b9bbd0` | Texto secundario sobre fondo oscuro |
| `green` / `green-soft` | `#17734f` / `#e3f4ec` | Estado OK / pagado |
| `amber` / `amber-soft` | `#8a5300` / `#fdf0d9` | Estado pendiente / aviso |
| `amber-barra` | `#d4891a` | Barra de progreso en alerta |
| `red` / `red-soft` | `#b42335` / `#fde8eb` | Error, gasto, eliminar |
| `red-border` | `#f2c4cb` | Borde del botón peligro |
| `red-on-dark` | `#ffb3bd` | Saldo negativo sobre fondo oscuro |

Solo en Figma: `black` (`#000000`, íconos) y `check-border` (`#767676`, borde de la casilla nativa).
Solo en código: alias de compatibilidad (`--text-h`, `--text`, `--border`, `--accent`, `--accent-ink`, `--accent-bg`, `--code-bg`) que apuntan a los tokens de arriba con `var(...)`.

## Componentes

Las pantallas (página *3 Pantallas*) usan instancias de los componentes de la sección **03-pantallas-componentes** (página *2 Componentes*). Al cambiar un color en el componente principal, cambia en todas las pantallas.

| Componente Figma | Variantes | Clase CSS (definida en `index.css`) | Archivos que lo usan |
|---|---|---|---|
| `Button` | Primary, Primary-Small, Secondary, Secondary-Small, Danger-Small, Seg, Seg-On, Disabled-Small × Default/Hover | `button`, `.btn`, `.btn-secondary`, `.btn-small`, `.btn-danger`, `.seg`, `.seg.on`, `button:disabled` | `Navbar.tsx`, `Dashboard.tsx`, `Gastos.tsx`, `Pagos.tsx`, `Historial.tsx`, `Metas.tsx`, `Analitica.tsx`, `MisDatos.tsx`, `Home.tsx`, `Login.tsx`, `Register.tsx`, `ForgotPassword.tsx` |
| `Button-Large` | Primary, Secondary × Default/Hover | `.btn-lg` | `Home.tsx` |
| `Button-Chip` | Default, Danger | `.btn-chip` | `Gastos.tsx`, `MisDatos.tsx` |
| `NavLink` | Active, Inactive, Link × Default/Hover | `.mainnav a`, `.mainnav a.active`, enlaces `a` | `Navbar.tsx`, `AuthLayout.tsx` |
| `Icon` / `Icon-Chevron` | ChevronDown, Icon-18 | flecha de `select` (`index.css`, regla `select`) | selectores de `Dashboard.tsx`, `Gastos.tsx`, `Metas.tsx` |

Piezas que en Figma son marcos (no componentes) y en el código son clases: `.chip`, `.badge-estado`, `.progreso`, `.stat`, `.callout`, `.card`, `.form-field`.
