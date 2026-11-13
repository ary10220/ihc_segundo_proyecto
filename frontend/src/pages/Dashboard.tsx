import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { track } from '../utils/analitica';
import { obtenerToken, limpiarToken } from '../utils/auth';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface Presupuesto {
    id: number;
    userId: number;
    mes: number;
    anio: number;
    limite: string | number;
}

interface ResumenPresupuesto {
    presupuesto: Presupuesto;
    gastado: number;
    disponible: number;
}

// Estado del presupuesto por categoria devuelto por el backend.
// 'ok' (<80%), 'alerta' (80-100%), 'excedido' (>100%) o 'sin-limite'
// cuando aun no se fijo un limite para la categoria.
type EstadoCategoria = 'ok' | 'alerta' | 'excedido' | 'sin-limite';

interface PresupuestoCategoriaItem {
    categoria: string;
    limite: number | null;
    consumido: number;
    restante: number | null;
    estado?: EstadoCategoria;
    porcentaje?: number;
}

interface GastoRecurrente {
    id: number;
    monto: string | number;
    motivo: string;
    categoria: string;
    frecuencia: 'semanal' | 'mensual';
    proximaFecha: string;
    activa: boolean;
    ultimoError: string | null;
}

function fechaLocalInput() {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const CATEGORIAS = [
    { valor: 'otros', etiqueta: 'Otros' },
    { valor: 'comida', etiqueta: 'Comida' },
    { valor: 'transporte', etiqueta: 'Transporte' },
    { valor: 'estudio', etiqueta: 'Estudio' }
];

// Calcula el estado y porcentaje localmente cuando el backend no
// los entrega (fallback para entornos con API vieja). Repite la
// logica del controlador: alerta desde 80%, excedido >100%.
function derivarEstadoCategoria(item: PresupuestoCategoriaItem): {
    estado: EstadoCategoria;
    porcentaje: number;
} {
    if (item.estado && item.porcentaje !== undefined) {
        return { estado: item.estado, porcentaje: item.porcentaje };
    }
    if (item.limite === null || Number(item.limite) <= 0) {
        return { estado: 'sin-limite', porcentaje: 0 };
    }
    const porcentaje = Math.round(
        (Number(item.consumido) / Number(item.limite)) * 100
    );
    let estado: EstadoCategoria = 'ok';
    if (porcentaje > 100) estado = 'excedido';
    else if (porcentaje >= 80) estado = 'alerta';
    return { estado, porcentaje };
}

// Etiqueta en espanol para cada estado, usada en el badge visible
// al usuario. Debe coincidir con los textos del requisito.
function etiquetaEstadoCategoria(estado: EstadoCategoria): string {
    switch (estado) {
        case 'ok':
            return 'Dentro del límite';
        case 'alerta':
            return 'Desde 80%';
        case 'excedido':
            return 'Excedido';
        default:
            return 'Sin límite';
    }
}

function Dashboard() {
    const [user, setUser] = useState<User | null>(null);
    const [resumen, setResumen] = useState<ResumenPresupuesto | null>(null);
    const [limite, setLimite] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(true);
    const [categorias, setCategorias] = useState<PresupuestoCategoriaItem[]>([]);
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('otros');
    const [limiteCategoria, setLimiteCategoria] = useState('');
    const [mensajeCategoria, setMensajeCategoria] = useState('');
    const [errorCategoria, setErrorCategoria] = useState('');
    const [gastosRecurrentes, setGastosRecurrentes] = useState<GastoRecurrente[]>([]);
    const [montoRecurrente, setMontoRecurrente] = useState('');
    const [motivoRecurrente, setMotivoRecurrente] = useState('');
    const [categoriaRecurrente, setCategoriaRecurrente] = useState('otros');
    const [frecuenciaRecurrente, setFrecuenciaRecurrente] = useState<'semanal' | 'mensual'>('semanal');
    const [fechaInicioRecurrente, setFechaInicioRecurrente] = useState(fechaLocalInput);
    const [mensajeRecurrente, setMensajeRecurrente] = useState('');
    const [errorRecurrente, setErrorRecurrente] = useState('');

    const navigate = useNavigate();

    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const anio = ahora.getFullYear();

    const cargarPresupuesto = async () => {
        const token = obtenerToken();

        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const response = await fetch(
                `http://localhost:4000/api/presupuesto/obtener?mes=${mes}&anio=${anio}`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (response.ok) {
                setResumen(data);
                setLimite(String(data.presupuesto.limite));
            } else if (response.status === 404) {
                setResumen(null);
            } else {
                setError(data.error || 'Error al obtener el presupuesto');
            }
        } catch (error) {
            console.error('Error al obtener el presupuesto:', error);
            setError('No se pudo conectar con el servidor');
        }
    };

    const cargarPresupuestoCategoria = async () => {
        const token = obtenerToken();

        if (!token) {
            return;
        }

        try {
            const response = await fetch(
                `http://localhost:4000/api/presupuesto-categoria/obtener?mes=${mes}&anio=${anio}`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json().catch(() => null);

            if (response.ok && data) {
                setCategorias(data.categorias || []);
                setErrorCategoria('');
            } else {
                setErrorCategoria(
                    (data && data.error) ||
                        'No se pudieron cargar los presupuestos por categoría'
                );
            }
        } catch (error) {
            console.error(
                'Error al obtener los presupuestos por categoría:',
                error
            );
            setErrorCategoria('No se pudo conectar con el servidor');
        }
    };

    const cargarGastosRecurrentes = async () => {
        const token = obtenerToken();
        if (!token) return;

        try {
            const response = await fetch('http://localhost:4000/api/gastos-recurrentes', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setGastosRecurrentes(data.recurrentes || []);
                setErrorRecurrente('');
            } else {
                setErrorRecurrente(data.error || 'No se pudieron cargar las recurrencias');
            }
        } catch (error) {
            console.error('Error al obtener gastos recurrentes:', error);
            setErrorRecurrente('No se pudo conectar con el servidor');
        }
    };

    useEffect(() => {
        const getUser = async () => {
            const token = obtenerToken();

            if (!token) {
                navigate('/login');
                return;
            }

            try {
                const response = await fetch(
                    'http://localhost:4000/api/auth/me',
                    {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                const data = await response.json();

                if (response.ok) {
                    setUser(data);
                } else {
                    console.log(data.error);
                    limpiarToken();
                    navigate('/login');
                    return;
                }
            } catch (error) {
                console.error('Error al obtener el usuario:', error);
                setError('No se pudo obtener la información del usuario');
            }

            await cargarGastosRecurrentes();
            await cargarPresupuesto();
            await cargarPresupuestoCategoria();
            setCargando(false);
        };

        getUser();
    }, [navigate]);

    const handleGuardarPresupuesto = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();
        setError('');
        setMensaje('');

        const limiteNumerico = Number(limite);
        const accion = resumen ? 'editar' : 'registrar';

        // Tarea 9 - Analitica: flujo de presupuesto mensual (sin el monto exacto).
        track('presupuesto_iniciado', { accion });

        if (!Number.isFinite(limiteNumerico) || limiteNumerico <= 0) {
            track('presupuesto_rechazado', { accion, motivo: 'limite_invalido' });
            setError('El límite mensual debe ser mayor que cero');
            return;
        }

        if (resumen && limiteNumerico < resumen.gastado) {
            track('presupuesto_rechazado', { accion, motivo: 'menor_que_gastado' });
            setError('El límite no puede ser menor que lo que ya has gastado en el mes');
            return;
        }

        if (resumen) {
            const confirmar = window.confirm(
                `¿Confirmas actualizar el límite mensual a Bs ${limiteNumerico.toFixed(2)}? Esta acción reemplazará el límite actual de Bs ${Number(resumen.presupuesto.limite).toFixed(2)}.`
            );
            if (!confirmar) return;
        }

        const token = obtenerToken();

        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const response = await fetch(
                'http://localhost:4000/api/presupuesto/establecer',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        limite: limiteNumerico,
                        mes,
                        anio
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                track('presupuesto_rechazado', { accion, motivo: response.status === 400 ? 'limite_invalido' : 'error_servidor' });
                setError(data.error || 'No se pudo guardar el presupuesto');
                return;
            }

            track('presupuesto_guardado', { accion });
            setMensaje(data.message || 'Presupuesto guardado correctamente');
            await cargarPresupuesto();
        } catch (error) {
            console.error('Error al guardar el presupuesto:', error);
            setError('No se pudo conectar con el servidor');
        }
    };

    const handleGuardarPresupuestoCategoria = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();
        setMensajeCategoria('');
        setErrorCategoria('');

        const limiteNumerico = Number(limiteCategoria);

        if (!Number.isFinite(limiteNumerico) || limiteNumerico <= 0) {
            setErrorCategoria('El límite por categoría debe ser mayor que cero');
            return;
        }

        const categoriaActual = categorias.find(
            (item) => item.categoria === categoriaSeleccionada
        );

        if (categoriaActual && limiteNumerico < Number(categoriaActual.consumido)) {
            setErrorCategoria(
                'El límite no puede ser menor que lo que ya has gastado en esa categoría'
            );
            return;
        }

        const token = obtenerToken();

        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const response = await fetch(
                'http://localhost:4000/api/presupuesto-categoria/establecer',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        categoria: categoriaSeleccionada,
                        limite: limiteNumerico,
                        mes,
                        anio
                    })
                }
            );

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                setErrorCategoria(
                    (data && data.error) ||
                        'No se pudo guardar el presupuesto por categoría'
                );
                return;
            }

            setMensajeCategoria(
                (data && data.message) ||
                    'Presupuesto por categoría guardado correctamente'
            );
            await cargarPresupuestoCategoria();
        } catch (error) {
            console.error('Error al guardar el presupuesto por categoría:', error);
            setErrorCategoria('No se pudo conectar con el servidor');
        }
    };

    const handleGuardarGastoRecurrente = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();
        setMensajeRecurrente('');
        setErrorRecurrente('');

        const montoNumero = Number(montoRecurrente);
        if (!Number.isFinite(montoNumero) || montoNumero <= 0 || !motivoRecurrente.trim()) {
            setErrorRecurrente('Ingresa un monto positivo y un motivo');
            return;
        }

        const token = obtenerToken();
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const response = await fetch('http://localhost:4000/api/gastos-recurrentes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    monto: montoNumero,
                    motivo: motivoRecurrente,
                    categoria: categoriaRecurrente,
                    frecuencia: frecuenciaRecurrente,
                    fechaInicio: fechaInicioRecurrente
                })
            });
            const data = await response.json();
            if (!response.ok) {
                setErrorRecurrente(data.error || 'No se pudo guardar el gasto recurrente');
                return;
            }

            setMensajeRecurrente(data.message || 'Gasto recurrente guardado correctamente');
            setMontoRecurrente('');
            setMotivoRecurrente('');
            setFechaInicioRecurrente(fechaLocalInput());
            await cargarGastosRecurrentes();
            await cargarPresupuesto();
            await cargarPresupuestoCategoria();
        } catch (error) {
            console.error('Error al guardar el gasto recurrente:', error);
            setErrorRecurrente('No se pudo conectar con el servidor');
        }
    };

    const handleDesactivarGastoRecurrente = async (id: number) => {
        const token = obtenerToken();
        if (!token) {
            navigate('/login');
            return;
        }
        try {
            const response = await fetch(`http://localhost:4000/api/gastos-recurrentes/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) {
                setErrorRecurrente(data.error || 'No se pudo desactivar la recurrencia');
                return;
            }
            setMensajeRecurrente(data.message || 'Gasto recurrente desactivado correctamente');
            await cargarGastosRecurrentes();
        } catch (error) {
            console.error('Error al desactivar el gasto recurrente:', error);
            setErrorRecurrente('No se pudo conectar con el servidor');
        }
    };

    const handleLogout = () => {
        limpiarToken();
        navigate('/login');
    };

    if (cargando) {
        return <div className="dashboard">Cargando dashboard...</div>;
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div>
                    <h1>Dashboard</h1>
                    {user && (
                        <p className="dashboard-user">
                            {user.name} · {user.email}
                        </p>
                    )}
                </div>
                <button className="dashboard-logout" onClick={handleLogout}>
                    Cerrar sesión
                </button>
            </header>

            {/* Tarjeta #1: presupuesto mensual al tope. El feedback dijo
                que el monto del presupuesto no se encontraba; aquí lo
                mostramos como KPI de resumen en el primer bloque. */}
            <section className="card" aria-labelledby="titulo-mensual">
                <h2 id="titulo-mensual">Presupuesto mensual</h2>
                <p className="card-periodo">Período: {mes}/{anio}</p>

                {resumen ? (
                    <div className="resumen-grid">
                        <div className="resumen-item">
                            <span className="resumen-item-etiqueta">Límite</span>
                            <span className="resumen-item-valor">
                                Bs {Number(resumen.presupuesto.limite).toFixed(2)}
                            </span>
                        </div>
                        <div className="resumen-item">
                            <span className="resumen-item-etiqueta">Gastado</span>
                            <span className="resumen-item-valor">
                                Bs {Number(resumen.gastado).toFixed(2)}
                            </span>
                        </div>
                        <div className="resumen-item">
                            <span className="resumen-item-etiqueta">Disponible</span>
                            <span className="resumen-item-valor">
                                Bs {Number(resumen.disponible).toFixed(2)}
                            </span>
                        </div>
                    </div>
                ) : (
                    <p>No has establecido un presupuesto para este mes.</p>
                )}

                <form onSubmit={handleGuardarPresupuesto} className="form-row">
                    <div className="form-field">
                        <label htmlFor="limite">
                            {resumen
                                ? 'Actualizar límite mensual (Bs)'
                                : 'Establecer límite mensual (Bs)'}
                        </label>
                        <input
                            id="limite"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={limite}
                            onChange={(event) => setLimite(event.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn">
                        Guardar presupuesto
                    </button>
                </form>

                {mensaje && <p role="status" className="msg-ok">{mensaje}</p>}
                {error && <p role="alert" className="msg-err">{error}</p>}
            </section>

            {/* Tarjeta #2: presupuesto por categoría con semáforo.
                Era la crítica más fuerte del feedback (información
                escondida). Pasa a segundo plano, no al final. */}
            <section className="card" aria-labelledby="titulo-categorias">
                <h2 id="titulo-categorias">Presupuesto por categoría</h2>
                <p className="card-periodo">Período: {mes}/{anio}</p>

                <table className="tabla-categorias">
                    <thead>
                        <tr>
                            <th>Categoría</th>
                            <th>Estado</th>
                            <th>Consumo</th>
                            <th style={{ minWidth: 160 }}>Avance</th>
                            <th>Restante</th>
                        </tr>
                    </thead>
                    <tbody>
                        {CATEGORIAS.map((opcion) => {
                            const item =
                                categorias.find(
                                    (fila) => fila.categoria === opcion.valor
                                ) ?? {
                                    categoria: opcion.valor,
                                    limite: null,
                                    consumido: 0,
                                    restante: null
                                };

                            const { estado, porcentaje } =
                                derivarEstadoCategoria(item);

                            const limiteTxt =
                                item.limite !== null
                                    ? `Bs ${Number(item.limite).toFixed(2)}`
                                    : '—';
                            const restanteTxt =
                                item.restante !== null
                                    ? `Bs ${Number(item.restante).toFixed(2)}`
                                    : '—';
                            const consumidoTxt = `Bs ${Number(
                                item.consumido
                            ).toFixed(2)} / ${limiteTxt}`;
                            const anchoBarra = Math.min(porcentaje, 100);

                            return (
                                <tr key={opcion.valor}>
                                    <td>{opcion.etiqueta}</td>
                                    <td>
                                        <span
                                            className={`badge-estado estado-${estado}`}
                                        >
                                            {etiquetaEstadoCategoria(estado)}
                                        </span>
                                    </td>
                                    <td>{consumidoTxt}</td>
                                    <td>
                                        <div
                                            className={`progreso estado-${estado}`}
                                            role="progressbar"
                                            aria-valuenow={porcentaje}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-label={`Avance ${opcion.etiqueta} ${porcentaje}%`}
                                        >
                                            <div
                                                className="progreso-barra"
                                                style={{ width: `${anchoBarra}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td>{restanteTxt}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <form
                    onSubmit={handleGuardarPresupuestoCategoria}
                    className="form-row"
                >
                    <div className="form-field">
                        <label htmlFor="categoria-presupuesto">Categoría</label>
                        <select
                            id="categoria-presupuesto"
                            value={categoriaSeleccionada}
                            onChange={(event) =>
                                setCategoriaSeleccionada(event.target.value)
                            }
                        >
                            {CATEGORIAS.map((opcion) => (
                                <option key={opcion.valor} value={opcion.valor}>
                                    {opcion.etiqueta}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-field">
                        <label htmlFor="limite-categoria">
                            Límite de la categoría (Bs)
                        </label>
                        <input
                            id="limite-categoria"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={limiteCategoria}
                            onChange={(event) =>
                                setLimiteCategoria(event.target.value)
                            }
                            required
                        />
                    </div>

                    <button type="submit" className="btn">Guardar</button>
                </form>

                {mensajeCategoria && (
                    <p role="status" className="msg-ok">{mensajeCategoria}</p>
                )}
                {errorCategoria && (
                    <p role="alert" className="msg-err">{errorCategoria}</p>
                )}
            </section>

            {/* Tarjeta #3: gastos recurrentes queda al final por ser
                la operación menos frecuente. La lista tiene scroll
                interno para no estirar la página. */}
            <section className="card" id="gastos-recurrentes" aria-labelledby="titulo-recurrentes">
                <h2 id="titulo-recurrentes">Gastos recurrentes</h2>
                <p className="card-periodo">
                    Programa gastos semanales o mensuales y revisa su próxima
                    ocurrencia.
                </p>

                {gastosRecurrentes.length === 0 ? (
                    <p role="status">
                        No tienes gastos recurrentes. Puedes crear uno con el
                        formulario.
                    </p>
                ) : (
                    <ul className="lista-recurrentes">
                        {gastosRecurrentes.map((recurrente) => (
                            <li key={recurrente.id}>
                                <strong>{recurrente.motivo}</strong>
                                <p>Monto: Bs {Number(recurrente.monto).toFixed(2)}</p>
                                <p>Categoría: {recurrente.categoria}</p>
                                <p>Frecuencia: {recurrente.frecuencia}</p>
                                <p>
                                    Próxima ocurrencia:{' '}
                                    <time dateTime={recurrente.proximaFecha}>
                                        {new Date(
                                            `${recurrente.proximaFecha}T12:00:00`
                                        ).toLocaleDateString()}
                                    </time>
                                </p>
                                <p>
                                    Estado:{' '}
                                    {recurrente.activa ? 'Activa' : 'Inactiva'}
                                </p>
                                {recurrente.ultimoError && (
                                    <p role="alert" className="msg-err">
                                        {recurrente.ultimoError}
                                    </p>
                                )}
                                {recurrente.activa && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() =>
                                            handleDesactivarGastoRecurrente(
                                                recurrente.id
                                            )
                                        }
                                    >
                                        Desactivar recurrencia
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <form
                    onSubmit={handleGuardarGastoRecurrente}
                    className="form-row"
                >
                    <div className="form-field">
                        <label htmlFor="monto-recurrente">
                            Monto recurrente (Bs)
                        </label>
                        <input
                            id="monto-recurrente"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={montoRecurrente}
                            onChange={(event) =>
                                setMontoRecurrente(event.target.value)
                            }
                            required
                        />
                    </div>
                    <div className="form-field">
                        <label htmlFor="motivo-recurrente">Motivo</label>
                        <input
                            id="motivo-recurrente"
                            type="text"
                            maxLength={255}
                            value={motivoRecurrente}
                            onChange={(event) =>
                                setMotivoRecurrente(event.target.value)
                            }
                            required
                        />
                    </div>
                    <div className="form-field">
                        <label htmlFor="categoria-recurrente">Categoría</label>
                        <select
                            id="categoria-recurrente"
                            value={categoriaRecurrente}
                            onChange={(event) =>
                                setCategoriaRecurrente(event.target.value)
                            }
                        >
                            {CATEGORIAS.map((opcion) => (
                                <option key={opcion.valor} value={opcion.valor}>
                                    {opcion.etiqueta}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-field">
                        <label htmlFor="frecuencia-recurrente">Frecuencia</label>
                        <select
                            id="frecuencia-recurrente"
                            value={frecuenciaRecurrente}
                            onChange={(event) =>
                                setFrecuenciaRecurrente(
                                    event.target.value as 'semanal' | 'mensual'
                                )
                            }
                        >
                            <option value="semanal">Semanal</option>
                            <option value="mensual">Mensual</option>
                        </select>
                    </div>
                    <div className="form-field">
                        <label htmlFor="fecha-inicio-recurrente">
                            Primera ocurrencia
                        </label>
                        <input
                            id="fecha-inicio-recurrente"
                            type="date"
                            min={fechaLocalInput()}
                            value={fechaInicioRecurrente}
                            onChange={(event) =>
                                setFechaInicioRecurrente(event.target.value)
                            }
                            required
                        />
                    </div>
                    <button type="submit" className="btn">
                        Guardar gasto recurrente
                    </button>
                </form>

                {mensajeRecurrente && (
                    <p role="status" className="msg-ok">{mensajeRecurrente}</p>
                )}
                {errorRecurrente && (
                    <p role="alert" className="msg-err">{errorRecurrente}</p>
                )}
            </section>
        </div>
    );
}

export default Dashboard;
