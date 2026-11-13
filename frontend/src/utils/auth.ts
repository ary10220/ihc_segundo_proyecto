// Clase 22 - Patron oscuro corregido (Privacidad por defecto).
// Antes: el token se guardaba SIEMPRE en localStorage (persiste al cerrar el navegador).
// Ahora: por defecto se guarda solo en sessionStorage (se borra al cerrar). El usuario
// decide activamente "Mantener sesion iniciada" y recien ahi va a localStorage.

const CLAVE = 'token';

export function guardarToken(token: string, mantenerSesion: boolean) {
    // sessionStorage siempre: la sesion vive mientras la pestaña este abierta.
    sessionStorage.setItem(CLAVE, token);
    if (mantenerSesion) {
        localStorage.setItem(CLAVE, token);
    } else {
        // Importante: limpiar localStorage por si habia un token viejo persistido.
        localStorage.removeItem(CLAVE);
    }
}

export function obtenerToken(): string | null {
    return sessionStorage.getItem(CLAVE) || localStorage.getItem(CLAVE);
}

export function limpiarToken() {
    sessionStorage.removeItem(CLAVE);
    localStorage.removeItem(CLAVE);
}
