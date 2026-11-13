import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerToken, limpiarToken } from '../utils/auth';

interface Movimiento {
    id: number;
    monto: number;
    motivo: string;
    fecha: string;
    estado: string;
    tipo?: string;
    categoria?: string;
}

function Historial() {
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [filtroTipo, setFiltroTipo] = useState<'todos' | 'gasto' | 'ingreso'>('todos');
    const [cargando, setCargando] = useState(true);

    const navigate = useNavigate();
    const token = obtenerToken();

    const cargarHistorial = async () => {
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const response = await fetch('http://localhost:4000/api/gastos/historial-mes', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                limpiarToken();
                navigate('/login');
                return;
            }

            const data = await response.json();
            if (response.ok) {
                setMovimientos(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Error al cargar historial:', error);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarHistorial();
    }, []);

    const filtrados = movimientos.filter((m) => {
        if (filtroTipo === 'todos') return true;
        return (m.tipo || 'gasto').toLowerCase() === filtroTipo;
    });

    const totalGastos = movimientos
        .filter((m) => (m.tipo || 'gasto').toLowerCase() === 'gasto')
        .reduce((acc, m) => acc + Number(m.monto), 0);

    const ahora = new Date();
    const nombreMes = ahora.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    const seg = (activo: boolean) => (activo ? 'seg on' : 'seg');

    return (
        <div className="page">
            <div className="page-head">
                <p className="eyebrow">Historial</p>
                <h1>Historial de Movimientos del Mes</h1>
                <p style={{ textTransform: 'capitalize' }}>
                    Período actual: {nombreMes}
                </p>
            </div>

                {/* Resumen inmediato para evitar recordar datos de otras vistas (Carga Cognitiva) */}
                <div className="stats">
                    <div className="stat">
                        <span className="stat-label">Total movimientos del mes:</span>
                        <strong className="stat-value">{movimientos.length}</strong>
                    </div>
                    <div className="stat destacado">
                        <span className="stat-label">Total en gastos este mes:</span>
                        <strong className="stat-value">
                            Bs {totalGastos.toFixed(2)}
                        </strong>
                    </div>
                </div>

                <section className="card">
                {/* Filtros simples (Ley de Hick) */}
                <div className="segs" style={{ marginBottom: 18 }}>
                    <button type="button" className={seg(filtroTipo === 'todos')} onClick={() => setFiltroTipo('todos')}>
                        Todos ({movimientos.length})
                    </button>
                    <button type="button" className={seg(filtroTipo === 'gasto')} onClick={() => setFiltroTipo('gasto')}>
                        Solo Gastos
                    </button>
                    <button type="button" className={seg(filtroTipo === 'ingreso')} onClick={() => setFiltroTipo('ingreso')}>
                        Solo Ingresos
                    </button>
                </div>

                {cargando ? (
                    <p className="muted">Cargando movimientos del mes...</p>
                ) : filtrados.length === 0 ? (
                    /* Estado Vacio orientativo (Empty State): Guia al usuario sobre que hacer a continuacion */
                    <div className="empty">
                        <h3>
                            {movimientos.length === 0
                                ? 'No tienes movimientos registrados este mes'
                                : `No hay movimientos del tipo seleccionado (${filtroTipo})`}
                        </h3>
                        <p style={{ margin: '0 0 18px 0' }}>
                            {movimientos.length === 0
                                ? 'Lleva el control de tus finanzas registrando tu primer gasto o ingreso.'
                                : 'Puedes cambiar de pestaña para ver el resto de tus registros.'}
                        </p>
                        {movimientos.length === 0 ? (
                            <button type="button" onClick={() => navigate('/gastos')}>
                                + Registrar un nuevo gasto
                            </button>
                        ) : (
                            <button type="button" className="btn-secondary" onClick={() => setFiltroTipo('todos')}>
                                Ver todos los movimientos
                            </button>
                        )}
                    </div>
                ) : (
                    /* Tarjetas de eventos claras y digeribles (Carga Cognitiva minima) */
                    <div className="rows">
                        {filtrados.map((m) => {
                            const esGasto = (m.tipo || 'gasto').toLowerCase() === 'gasto';
                            return (
                                <div key={m.id} className="row-item">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 240px', minWidth: 0 }}>
                                        <span aria-hidden="true" style={{
                                            width: 10, height: 10, borderRadius: '50%', flex: 'none',
                                            background: esGasto ? 'var(--red)' : 'var(--green)'
                                        }} />
                                        <div style={{ minWidth: 0 }}>
                                            <strong style={{ fontSize: '1.02rem', display: 'block', overflowWrap: 'anywhere' }}>{m.motivo}</strong>
                                            <small>
                                                {new Date(m.fecha).toLocaleDateString('es-ES', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}{' '}
                                                • Categoría: {m.categoria || 'otros'} • Estado: {m.estado}
                                            </small>
                                        </div>
                                    </div>
                                    <span className={`amount ${esGasto ? 'gasto' : 'ingreso'}`} style={{ fontSize: '1.1rem' }}>
                                        {esGasto ? '-' : '+'} Bs {Number(m.monto).toFixed(2)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
                </section>
        </div>
    );
}

export default Historial;
