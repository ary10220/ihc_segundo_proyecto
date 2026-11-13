import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { track, type Motivo } from '../utils/analitica';
import { obtenerToken, limpiarToken } from '../utils/auth';

// Motivo de rechazo de la lista fija (nunca el texto del backend).
const motivoMeta = (error: string | undefined): Motivo =>
    (error || '').toLowerCase().includes('fondos insuficientes') ? 'fondos_insuficientes' : 'datos_invalidos';

interface Meta {
    id: number;
    nombre: string;
    montoObjetivo: string | number;
    fechaObjetivo: string;
    ahorrado: string | number;
}

interface Movimiento {
    id: number;
    tipo: 'asignacion' | 'retiro' | 'transferencia' | 'rechazado';
    monto: string | number;
    detalle: string | null;
    createdAt: string;
}

interface Resumen {
    ingresos: number;
    gastos: number;
    reservado: number;
    disponible: number;
    saldoTotal: number;
    metas: Meta[];
    movimientos: Movimiento[];
}

const API = 'http://localhost:4000/api/metas';
const bs = (n: string | number) => `Bs ${Number(n).toFixed(2)}`;

const etiquetaTipo: Record<Movimiento['tipo'], string> = {
    asignacion: 'Asignación',
    retiro: 'Retiro',
    transferencia: 'Transferencia',
    rechazado: 'Rechazado'
};

function Metas() {
    const navigate = useNavigate();
    const token = obtenerToken();
    const [resumen, setResumen] = useState<Resumen | null>(null);
    const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

    const [nombre, setNombre] = useState('');
    const [objetivo, setObjetivo] = useState('');
    const [fecha, setFecha] = useState('');

    const [montos, setMontos] = useState<Record<number, string>>({});

    const [origenId, setOrigenId] = useState('');
    const [destinoId, setDestinoId] = useState('');
    const [montoTransferencia, setMontoTransferencia] = useState('');

    const cargar = async () => {
        if (!token) return navigate('/login');
        const r = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
        if (r.status === 401 || r.status === 403) {
            limpiarToken();
            return navigate('/login');
        }
        if (r.ok) setResumen(await r.json());
    };

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const enviar = async (
        url: string,
        body: object,
        exito: string,
        accion: 'registrar' | 'asignar' | 'retirar' | 'transferir'
    ) => {
        setMensaje(null);
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        const data = await r.json().catch(() => ({}));
        // Tarea 9 - Analitica: sin nombre de la meta ni montos.
        if (r.ok && accion === 'registrar') track('meta_creada');
        if (r.ok && accion === 'asignar') track('meta_fondos_asignados', { accion });
        if (!r.ok) track('meta_rechazada', { accion, motivo: motivoMeta(data.error) });
        if (r.ok) setMensaje({ tipo: 'ok', texto: exito });
        else setMensaje({ tipo: 'error', texto: data.error || 'No se pudo completar la operación' });
        await cargar();
        return r.ok;
    };

    const crear = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await enviar(API, { nombre, montoObjetivo: objetivo, fechaObjetivo: fecha }, `Meta "${nombre}" creada`, 'registrar');
        if (ok) { setNombre(''); setObjetivo(''); setFecha(''); }
    };

    const mover = async (meta: Meta, accion: 'asignar' | 'retirar') => {
        const monto = montos[meta.id] ?? '';
        const ok = await enviar(
            `${API}/${meta.id}/${accion}`,
            { monto },
            accion === 'asignar' ? `Asignaste ${bs(monto)} a ${meta.nombre}` : `Retiraste ${bs(monto)} de ${meta.nombre}`,
            accion
        );
        if (ok) setMontos({ ...montos, [meta.id]: '' });
    };

    const transferir = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await enviar(
            `${API}/transferir`,
            { origenId: Number(origenId), destinoId: Number(destinoId), monto: montoTransferencia },
            `Transferiste ${bs(montoTransferencia)} entre metas`,
            'transferir'
        );
        if (ok) setMontoTransferencia('');
    };

    const metas = resumen?.metas ?? [];

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <div>
                    <p className="eyebrow">Ahorro</p>
                    <h1>Metas de ahorro</h1>
                </div>
            </div>

            {mensaje && (
                <p role={mensaje.tipo === 'error' ? 'alert' : 'status'}
                   className={mensaje.tipo === 'error' ? 'msg-err' : 'msg-ok'}
                   style={{ margin: 0 }}>
                    {mensaje.texto}
                </p>
            )}

            <section className="card" aria-labelledby="titulo-saldo">
                <h2 id="titulo-saldo">Tu saldo</h2>
                <p className="card-periodo">Disponible = ingresos − gastos − fondos reservados en metas</p>
                <div className="stats">
                    <Dato titulo="Saldo total" valor={resumen?.saldoTotal} testId="saldo-total" />
                    <Dato titulo="Reservado en metas" valor={resumen?.reservado} testId="saldo-reservado" />
                    <Dato titulo="Disponible" valor={resumen?.disponible} testId="saldo-disponible" destacado />
                </div>
            </section>

            <section className="card" aria-labelledby="titulo-nueva">
                <h2 id="titulo-nueva">Nueva meta</h2>
                <form onSubmit={crear} className="form-row">
                    <Campo etiqueta="Nombre de la meta">
                        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                    </Campo>
                    <Campo etiqueta="Monto objetivo (Bs)">
                        <input type="number" min="0.01" step="0.01" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} required />
                    </Campo>
                    <Campo etiqueta="Fecha objetivo">
                        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
                    </Campo>
                    <button type="submit">Crear meta</button>
                </form>
            </section>

            <section className="card" aria-labelledby="titulo-metas">
                <h2 id="titulo-metas">Mis metas</h2>
                {metas.length === 0 && <p className="empty">Aún no tienes metas. Crea una arriba.</p>}
                <div className="metas-grid" style={{ marginTop: 14 }}>
                    {metas.map((meta) => {
                        const pct = Math.min(100, Math.round((Number(meta.ahorrado) / Number(meta.montoObjetivo)) * 100));
                        return (
                            <article key={meta.id} data-testid={`meta-${meta.nombre}`}
                                     aria-label={`Meta ${meta.nombre}`}
                                     className="meta-card">
                                <div className="meta-head">
                                    <strong>{meta.nombre}</strong>
                                    <span>Fecha objetivo: {meta.fechaObjetivo}</span>
                                </div>
                                <p>
                                    Ahorrado <span data-testid="meta-ahorrado">{bs(meta.ahorrado)}</span> de {bs(meta.montoObjetivo)} ({pct}%)
                                </p>
                                <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                                     aria-label={`Avance de ${meta.nombre}`}
                                     className={pct >= 100 ? 'bar completa' : 'bar'}>
                                    <div style={{ width: `${pct}%` }} />
                                </div>
                                <div className="form-row" style={{ marginTop: 6 }}>
                                    <Campo etiqueta={`Monto para ${meta.nombre}`}>
                                        <input type="number" min="0.01" step="0.01" value={montos[meta.id] ?? ''}
                                               onChange={(e) => setMontos({ ...montos, [meta.id]: e.target.value })} />
                                    </Campo>
                                    <button type="button" onClick={() => mover(meta, 'asignar')}>Asignar</button>
                                    <button type="button" className="btn-secondary" onClick={() => mover(meta, 'retirar')}>Retirar</button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            {metas.length >= 2 && (
                <section className="card" aria-labelledby="titulo-transferir">
                    <h2 id="titulo-transferir">Transferir entre metas</h2>
                    <form onSubmit={transferir} className="form-row">
                        <Campo etiqueta="Desde">
                            <select value={origenId} onChange={(e) => setOrigenId(e.target.value)} required>
                                <option value="">Elegir meta</option>
                                {metas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                            </select>
                        </Campo>
                        <Campo etiqueta="Hacia">
                            <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} required>
                                <option value="">Elegir meta</option>
                                {metas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                            </select>
                        </Campo>
                        <Campo etiqueta="Monto a transferir (Bs)">
                            <input type="number" min="0.01" step="0.01" value={montoTransferencia}
                                   onChange={(e) => setMontoTransferencia(e.target.value)} required />
                        </Campo>
                        <button type="submit">Transferir</button>
                    </form>
                </section>
            )}

            <section className="card" aria-labelledby="titulo-movs">
                <h2 id="titulo-movs">Historial de movimientos</h2>
                {(resumen?.movimientos.length ?? 0) === 0 ? <p>Sin movimientos todavía.</p> : (
                    <ul aria-label="Movimientos de metas" style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'grid', gap: 8 }}>
                        {resumen!.movimientos.map((m) => (
                            <li key={m.id} className={m.tipo === 'rechazado' ? 'mov-meta rechazado' : 'mov-meta'}>
                                <span><strong>{etiquetaTipo[m.tipo]}</strong> · {m.detalle}</span>
                                <span>{bs(m.monto)} · {new Date(m.createdAt).toLocaleString('es-BO')}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}


function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactElement }) {
    return (
        <label className="campo">
            {etiqueta}
            <span style={{ display: 'contents' }}>{children}</span>
        </label>
    );
}

function Dato({ titulo, valor, testId, destacado }: { titulo: string; valor?: number; testId: string; destacado?: boolean }) {
    return (
        <div className={destacado ? 'stat destacado' : 'stat'}>
            <div className="stat-label">{titulo}</div>
            <div data-testid={testId} className="stat-value">{valor === undefined ? '…' : bs(valor)}</div>
        </div>
    );
}

export default Metas;
