// Clase 21 / Tarea 9 - Analitica de interaccion en todo el producto.
// Los eventos se guardan en el navegador (localStorage), NO en una API.
// Lista cerrada de eventos y de props. Nunca se guarda informacion personal:
// ni nombre, ni correo, ni motivo escrito, ni monto exacto, ni texto buscado.

const CLAVE = 'eventos';

// Lista cerrada: el plan de eventos esta en evidencias/tarea-9.md.
export const EVENTOS = [
    // Iniciar sesion
    'login_iniciado',
    'login_exitoso',
    'login_rechazado',
    // Registrar movimiento (flujo principal)
    'movimiento_iniciado',
    'movimiento_guardado',
    'movimiento_rechazado',
    // Tarea 9: aviso antes de superar el limite
    'aviso_limite_mostrado',
    'aviso_limite_confirmado',
    'aviso_limite_cancelado',
    // Presupuesto mensual
    'presupuesto_iniciado',
    'presupuesto_guardado',
    'presupuesto_rechazado',
    // Tarea 8: metas de ahorro
    'meta_creada',
    'meta_fondos_asignados',
    'meta_rechazada',
    // Busquedas o filtros sin resultados
    'busqueda_sin_resultados',
    // Tarea 10: mis datos y salida honesta
    'datos_descargados',
    'eliminacion_iniciada',
    'eliminacion_cancelada',
    'cuenta_eliminada',
    'eliminacion_bloqueada'
] as const;

export type NombreEvento = typeof EVENTOS[number];

// Motivos de error: lista fija, nunca el texto del backend.
export const MOTIVOS = [
    'campos_vacios',
    'motivo_numerico',
    'sin_presupuesto',
    'supera_presupuesto',
    'limite_invalido',
    'menor_que_gastado',
    'credenciales',
    'fondos_insuficientes',
    'datos_invalidos',
    'error_servidor'
] as const;

export type Motivo = typeof MOTIVOS[number];

export type PropsEvento = {
    tipo?: string;
    categoria?: string;
    mes?: string;
    supera_limite?: boolean;
    accion?: 'registrar' | 'editar' | 'asignar' | 'retirar' | 'transferir';
    motivo?: Motivo;
    filtros?: string;
    formato?: 'json' | 'csv';
    origen?: 'mis_datos' | 'dialogo_eliminar';
};

const PROPS_PERMITIDAS: (keyof PropsEvento)[] = ['tipo', 'categoria', 'mes', 'supera_limite', 'accion', 'motivo', 'filtros', 'formato', 'origen'];

// Embudos por flujo principal: inicio -> exito, con pasos intermedios.
export const EMBUDOS: { flujo: string; pasos: NombreEvento[] }[] = [
    { flujo: 'Iniciar sesión', pasos: ['login_iniciado', 'login_exitoso'] },
    { flujo: 'Registrar movimiento', pasos: ['movimiento_iniciado', 'movimiento_guardado'] },
    { flujo: 'Aviso de límite (Tarea 9)', pasos: ['aviso_limite_mostrado', 'aviso_limite_confirmado'] },
    { flujo: 'Presupuesto mensual', pasos: ['presupuesto_iniciado', 'presupuesto_guardado'] },
    { flujo: 'Metas de ahorro (Tarea 8)', pasos: ['meta_creada', 'meta_fondos_asignados'] },
    { flujo: 'Eliminar cuenta (Tarea 10)', pasos: ['eliminacion_iniciada', 'cuenta_eliminada'] }
];

export interface RegistroEvento {
    evento: string;
    props: PropsEvento;
    fecha: string;
}

// Lista en memoria + persistencia en localStorage.
export const eventos: RegistroEvento[] = cargarDesdeAlmacenamiento();

function cargarDesdeAlmacenamiento(): RegistroEvento[] {
    try {
        const crudo = localStorage.getItem(CLAVE);
        if (!crudo) return [];
        const parseado = JSON.parse(crudo);
        return Array.isArray(parseado) ? parseado : [];
    } catch {
        return [];
    }
}

function guardarEvento(registro: RegistroEvento) {
    eventos.push(registro);
    try {
        localStorage.setItem(CLAVE, JSON.stringify(eventos));
    } catch {
        // si el storage esta lleno o bloqueado, no romper la UI
    }
}

// Descarta cualquier prop fuera de la lista y motivos fuera de la lista fija.
function sanitizar(props: PropsEvento): PropsEvento {
    const limpio: Record<string, unknown> = {};
    for (const clave of PROPS_PERMITIDAS) {
        if (props[clave] !== undefined && props[clave] !== null) limpio[clave] = props[clave];
    }
    if (limpio.motivo !== undefined && !MOTIVOS.includes(limpio.motivo as Motivo)) {
        limpio.motivo = 'error_servidor';
    }
    return limpio as PropsEvento;
}

export function track(evento: NombreEvento, props: PropsEvento = {}) {
    if (!EVENTOS.includes(evento)) return;
    const registro: RegistroEvento = {
        evento,
        props: sanitizar(props),
        fecha: new Date().toISOString()
    };
    guardarEvento(registro);
    console.log('[evento]', registro);
}

// Utilidades para el panel /analitica y los tests:
export function obtenerEventos(): RegistroEvento[] {
    return [...eventos];
}

export function limpiarEventos() {
    eventos.length = 0;
    try { localStorage.removeItem(CLAVE); } catch { /* noop */ }
}
