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

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
            <h1 style={{ marginBottom: '8px' }}>Historial de Movimientos del Mes</h1>
                <p style={{ color: '#57606a', textTransform: 'capitalize', marginTop: '0' }}>
                    Período actual: {nombreMes}
                </p>

                {/* Resumen inmediato para evitar recordar datos de otras vistas (Carga Cognitiva) */}
                <div style={{
                    backgroundColor: '#f6f8fa',
                    border: '1px solid #d0d7de',
                    borderRadius: '8px',
                    padding: '12px 18px',
                    margin: '16px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                }}>
                    <div>
                        <span style={{ fontSize: '13px', color: '#57606a' }}>Total movimientos del mes:</span>
                        <strong style={{ display: 'block', fontSize: '18px' }}>{movimientos.length}</strong>
                    </div>
                    <div>
                        <span style={{ fontSize: '13px', color: '#57606a' }}>Total en gastos este mes:</span>
                        <strong style={{ display: 'block', fontSize: '18px', color: '#cf222e' }}>
                            Bs {totalGastos.toFixed(2)}
                        </strong>
                    </div>
                </div>

                {/* Filtros simples (Ley de Hick) */}
                <div style={{ display: 'flex', gap: '10px', margin: '16px 0', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setFiltroTipo('todos')}
                        style={{
                            padding: '8px 16px',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            border: '1px solid #ccc',
                            backgroundColor: filtroTipo === 'todos' ? '#0066cc' : '#f5f5f5',
                            color: filtroTipo === 'todos' ? '#fff' : '#333',
                            fontWeight: 'bold'
                        }}
                    >
                        Todos ({movimientos.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltroTipo('gasto')}
                        style={{
                            padding: '8px 16px',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            border: '1px solid #ccc',
                            backgroundColor: filtroTipo === 'gasto' ? '#d32f2f' : '#f5f5f5',
                            color: filtroTipo === 'gasto' ? '#fff' : '#333',
                            fontWeight: 'bold'
                        }}
                    >
                        Solo Gastos
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltroTipo('ingreso')}
                        style={{
                            padding: '8px 16px',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            border: '1px solid #ccc',
                            backgroundColor: filtroTipo === 'ingreso' ? '#2e7d32' : '#f5f5f5',
                            color: filtroTipo === 'ingreso' ? '#fff' : '#333',
                            fontWeight: 'bold'
                        }}
                    >
                        Solo Ingresos
                    </button>
                </div>

                {cargando ? (
                    <p>Cargando movimientos del mes...</p>
                ) : filtrados.length === 0 ? (
                    /* Estado Vacio orientativo (Empty State): Guia al usuario sobre que hacer a continuacion */
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        border: '2px dashed #d0d7de',
                        borderRadius: '8px',
                        backgroundColor: '#fafafa',
                        margin: '20px 0'
                    }}>
                        <h3 style={{ margin: '0 0 8px 0', color: '#24292f' }}>
                            {movimientos.length === 0
                                ? 'No tienes movimientos registrados este mes'
                                : `No hay movimientos del tipo seleccionado (${filtroTipo})`}
                        </h3>
                        <p style={{ color: '#57606a', margin: '0 0 16px 0', fontSize: '14px' }}>
                            {movimientos.length === 0
                                ? 'Lleva el control de tus finanzas registrando tu primer gasto o ingreso.'
                                : 'Puedes cambiar de pestaña para ver el resto de tus registros.'}
                        </p>
                        {movimientos.length === 0 ? (
                            <button
                                type="button"
                                onClick={() => navigate('/gastos')}
                                style={{
                                    padding: '10px 18px',
                                    backgroundColor: '#1f883d',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                + Registrar un nuevo gasto
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setFiltroTipo('todos')}
                                style={{
                                    padding: '8px 14px',
                                    backgroundColor: '#0066cc',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Ver todos los movimientos
                            </button>
                        )}
                    </div>
                ) : (
                    /* Tarjetas de eventos claras y digeribles (Carga Cognitiva minima) */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {filtrados.map((m) => {
                            const esGasto = (m.tipo || 'gasto').toLowerCase() === 'gasto';
                            return (
                                <div
                                    key={m.id}
                                    style={{
                                        border: '1px solid #e1e4e8',
                                        borderRadius: '8px',
                                        padding: '14px 16px',
                                        backgroundColor: '#ffffff',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                    }}
                                >
                                    <div>
                                        <strong style={{ fontSize: '16px', display: 'block' }}>{m.motivo}</strong>
                                        <small style={{ color: '#57606a' }}>
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
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{
                                            fontSize: '17px',
                                            fontWeight: 'bold',
                                            color: esGasto ? '#cf222e' : '#1a7f37'
                                        }}>
                                            {esGasto ? '-' : '+'} Bs {Number(m.monto).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
        </div>
    );
}

export default Historial;
