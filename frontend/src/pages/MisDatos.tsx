import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { track } from '../utils/analitica';
import { obtenerToken, limpiarToken } from '../utils/auth';

// Tarea 10 · Mis datos y salida honesta.
// Regla de Presupuesto Estudiantil: al eliminar la cuenta se elimina todo
// (movimientos, presupuestos y metas). Antes puede descargar sus movimientos.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API = `${API_URL}/api/mis-datos`;

interface Resumen {
    cuenta: { name: string; email: string; createdAt: string };
    conteos: {
        movimientos: number;
        recurrentes: number;
        presupuestos: number;
        limitesCategoria: number;
        metas: number;
        movimientosMetas: number;
    };
    ultimosMovimientos: { id: number; fecha: string; tipo: string; categoria: string; motivo: string; monto: string | number }[];
}

type Formato = 'json' | 'csv';

function MisDatos() {
    const navigate = useNavigate();
    const token = obtenerToken();
    const [resumen, setResumen] = useState<Resumen | null>(null);
    const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
    const [dialogoAbierto, setDialogoAbierto] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const [errorEliminar, setErrorEliminar] = useState<{ porQue: string; queHacer: string } | null>(null);
    const botonCancelar = useRef<HTMLButtonElement>(null);
    const botonAbrir = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        (async () => {
            if (!token) return navigate('/login');
            const r = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
            if (r.status === 401 || r.status === 403) {
                limpiarToken();
                return navigate('/login');
            }
            if (r.ok) setResumen(await r.json());
            else setMensaje({ tipo: 'error', texto: 'No pudimos cargar tus datos. Recarga la página.' });
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (dialogoAbierto) botonCancelar.current?.focus();
    }, [dialogoAbierto]);

    const descargar = async (formato: Formato, origen: 'mis_datos' | 'dialogo_eliminar') => {
        setMensaje(null);
        const r = await fetch(`${API}/exportar?formato=${formato}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) {
            setMensaje({ tipo: 'error', texto: 'No pudimos preparar la descarga. Intenta de nuevo.' });
            return;
        }
        const blob = await r.blob();
        const fecha = new Date().toISOString().slice(0, 10);
        const nombre = formato === 'csv' ? `mis-movimientos-${fecha}.csv` : `mis-datos-${fecha}.json`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        track('datos_descargados', { formato, origen });
        setMensaje({ tipo: 'ok', texto: `Descargaste ${nombre}.` });
    };

    const abrirDialogo = () => {
        track('eliminacion_iniciada');
        setErrorEliminar(null);
        setDialogoAbierto(true);
    };

    const cancelar = () => {
        track('eliminacion_cancelada');
        setDialogoAbierto(false);
        botonAbrir.current?.focus();
    };

    const eliminar = async () => {
        setEliminando(true);
        setErrorEliminar(null);
        try {
            const r = await fetch(`${API}/cuenta`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmar: true })
            });
            if (r.ok) {
                track('cuenta_eliminada');
                limpiarToken();
                navigate('/login', { replace: true, state: { cuentaEliminada: true } });
                return;
            }
            const data = await r.json().catch(() => ({}));
            track('eliminacion_bloqueada', { motivo: r.status >= 500 ? 'error_servidor' : 'datos_invalidos' });
            setErrorEliminar({
                porQue: data.error || 'No pudimos eliminar tu cuenta. No se borró nada.',
                queHacer: data.queHacer || 'Intenta de nuevo en unos minutos.'
            });
        } catch {
            track('eliminacion_bloqueada', { motivo: 'error_servidor' });
            setErrorEliminar({
                porQue: 'No hay conexión con el servidor. No se borró nada.',
                queHacer: 'Revisa tu conexión e intenta de nuevo.'
            });
        } finally {
            setEliminando(false);
        }
    };

    const c = resumen?.conteos;

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <div>
                    <p className="eyebrow">Tu cuenta</p>
                    <h1>Mis datos</h1>
                </div>
            </div>

            {mensaje && (
                <p role={mensaje.tipo === 'error' ? 'alert' : 'status'}
                   className={mensaje.tipo === 'error' ? 'msg-err' : 'msg-ok'}
                   style={{ margin: 0 }}>
                    {mensaje.texto}
                </p>
            )}

            <section className="card" aria-labelledby="titulo-guardamos">
                <h2 id="titulo-guardamos">Lo que guardamos de ti</h2>
                <p className="card-periodo">Esto es todo lo que FinanzApp tiene asociado a tu cuenta.</p>
                {resumen ? (
                    <>
                        <dl className="mis-datos-lista">
                            <dt>Nombre</dt><dd>{resumen.cuenta.name}</dd>
                            <dt>Correo</dt><dd>{resumen.cuenta.email}</dd>
                            <dt>Cuenta creada</dt><dd>{new Date(resumen.cuenta.createdAt).toLocaleDateString()}</dd>
                        </dl>
                        <ul className="mis-datos-conteos" aria-label="Cantidad de registros">
                            <li><strong data-testid="conteo-movimientos">{c!.movimientos}</strong> movimientos (gastos e ingresos)</li>
                            <li><strong>{c!.recurrentes}</strong> pagos recurrentes</li>
                            <li><strong data-testid="conteo-presupuestos">{c!.presupuestos}</strong> presupuestos mensuales</li>
                            <li><strong>{c!.limitesCategoria}</strong> límites por categoría</li>
                            <li><strong data-testid="conteo-metas">{c!.metas}</strong> metas de ahorro</li>
                            <li><strong>{c!.movimientosMetas}</strong> movimientos de metas</li>
                        </ul>
                    </>
                ) : (
                    <p>Cargando…</p>
                )}
                <p className="card-periodo" style={{ marginTop: 12 }}>
                    No guardamos tu ubicación ni compartimos tus datos con nadie. La analítica de uso es anónima y vive solo en tu navegador.
                </p>
            </section>

            <section className="card" aria-labelledby="titulo-descargar">
                <h2 id="titulo-descargar">Descargar mis datos</h2>
                <p className="card-periodo">
                    JSON trae todo (cuenta, movimientos, presupuestos y metas). CSV trae tus movimientos para abrirlos en Excel.
                </p>
                <div className="actions" style={{ marginTop: 12 }}>
                    <button type="button" className="btn-secondary" onClick={() => descargar('json', 'mis_datos')}>
                        Descargar todo (JSON)
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => descargar('csv', 'mis_datos')}>
                        Descargar movimientos (CSV)
                    </button>
                </div>
            </section>

            <section className="card" aria-labelledby="titulo-eliminar">
                <h2 id="titulo-eliminar">Eliminar mi cuenta</h2>
                <p className="card-periodo">
                    Se borra tu cuenta y todos tus datos. No se puede recuperar.
                </p>
                <div className="actions" style={{ marginTop: 12 }}>
                    <button ref={botonAbrir} type="button" className="btn-danger" onClick={abrirDialogo}
                            disabled={dialogoAbierto}>
                        Eliminar mi cuenta
                    </button>
                </div>

                {dialogoAbierto && (
                    <div role="alertdialog" aria-modal="false"
                         aria-labelledby="eliminar-titulo" aria-describedby="eliminar-detalle"
                         className="callout warn" style={{ marginTop: 16 }}
                         onKeyDown={(e) => { if (e.key === 'Escape' && !eliminando) cancelar(); }}>
                        <p id="eliminar-titulo" style={{ fontWeight: 800 }}>¿Eliminar tu cuenta?</p>
                        <div id="eliminar-detalle">
                            <p style={{ margin: '6px 0' }}>Se eliminará para siempre:</p>
                            <ul style={{ margin: '0 0 8px 18px' }}>
                                <li>{c?.movimientos ?? 0} movimientos y {c?.recurrentes ?? 0} pagos recurrentes</li>
                                <li>{c?.presupuestos ?? 0} presupuestos y {c?.limitesCategoria ?? 0} límites por categoría</li>
                                <li>{c?.metas ?? 0} metas de ahorro y su historial</li>
                            </ul>
                            <p style={{ margin: '0 0 8px' }}>
                                Después no podrás iniciar sesión con este correo. Si quieres conservar tus movimientos, descárgalos antes:{' '}
                                <button type="button" className="btn-chip" onClick={() => descargar('csv', 'dialogo_eliminar')}>
                                    Descargar movimientos (CSV)
                                </button>
                            </p>
                        </div>

                        {errorEliminar && (
                            <div role="alert" className="msg-err" style={{ marginBottom: 12 }}>
                                <p style={{ margin: 0 }}><strong>Por qué:</strong> {errorEliminar.porQue}</p>
                                <p style={{ margin: 0 }}><strong>Qué hacer:</strong> {errorEliminar.queHacer}</p>
                            </div>
                        )}

                        <div className="actions dialogo-botones">
                            <button ref={botonCancelar} type="button" className="btn-secondary" onClick={cancelar}
                                    disabled={eliminando}>
                                Conservar mi cuenta
                            </button>
                            <button type="button" className="btn-danger" onClick={eliminar} disabled={eliminando}>
                                {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

export default MisDatos;
