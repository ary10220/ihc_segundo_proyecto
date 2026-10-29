import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

interface PresupuestoCategoriaItem {
    categoria: string;
    limite: number | null;
    consumido: number;
    restante: number | null;
}

const CATEGORIAS = [
    { valor: 'otros', etiqueta: 'Otros' },
    { valor: 'comida', etiqueta: 'Comida' },
    { valor: 'transporte', etiqueta: 'Transporte' },
    { valor: 'estudio', etiqueta: 'Estudio' }
];

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

    const navigate = useNavigate();

    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const anio = ahora.getFullYear();

    const cargarPresupuesto = async () => {
        const token = localStorage.getItem('token');

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
        const token = localStorage.getItem('token');

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

    useEffect(() => {
        const getUser = async () => {
            const token = localStorage.getItem('token');

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
                    localStorage.removeItem('token');
                    navigate('/login');
                    return;
                }
            } catch (error) {
                console.error('Error al obtener el usuario:', error);
                setError('No se pudo obtener la información del usuario');
            }

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

        if (!Number.isFinite(limiteNumerico) || limiteNumerico <= 0) {
            setError('El límite mensual debe ser mayor que cero');
            return;
        }

        if (resumen && limiteNumerico < resumen.gastado) {
            setError('El límite no puede ser menor que lo que ya has gastado en el mes');
            return;
        }

        if (resumen) {
            const confirmar = window.confirm(
                `¿Confirmas actualizar el límite mensual a Bs ${limiteNumerico.toFixed(2)}? Esta acción reemplazará el límite actual de Bs ${Number(resumen.presupuesto.limite).toFixed(2)}.`
            );
            if (!confirmar) return;
        }

        const token = localStorage.getItem('token');

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
                setError(data.error || 'No se pudo guardar el presupuesto');
                return;
            }

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

        const token = localStorage.getItem('token');

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

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    if (cargando) {
        return <div>Cargando dashboard...</div>;
    }

    return (
        <div>
            <h1>Dashboard</h1>

            {user && (
                <div>
                    <p>Bienvenido, {user.name}</p>
                    <p>Correo: {user.email}</p>
                    <p>Rol: {user.role}</p>
                </div>
            )}

            <hr />

            <section>
                <h2>Presupuesto mensual</h2>
                <p>Período: {mes}/{anio}</p>

                {resumen ? (
                    <div>
                        <p>
                            Límite mensual: Bs{' '}
                            {Number(resumen.presupuesto.limite).toFixed(2)}
                        </p>
                        <p>
                            Total gastado: Bs{' '}
                            {Number(resumen.gastado).toFixed(2)}
                        </p>
                        <p>
                            Saldo disponible: Bs{' '}
                            {Number(resumen.disponible).toFixed(2)}
                        </p>
                    </div>
                ) : (
                    <p>No has establecido un presupuesto para este mes.</p>
                )}

                <form onSubmit={handleGuardarPresupuesto}>
                    <div>
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

                    <button type="submit">
                        Guardar presupuesto
                    </button>
                </form>

                {mensaje && <p role="status">{mensaje}</p>}
                {error && <p role="alert">{error}</p>}
            </section>

            <hr />

            <section>
                <h2>Presupuesto por categoría</h2>
                <p>Período: {mes}/{anio}</p>

                <table>
                    <thead>
                        <tr>
                            <th>Categoría</th>
                            <th>Límite</th>
                            <th>Consumido</th>
                            <th>Restante</th>
                        </tr>
                    </thead>

                    <tbody>
                        {CATEGORIAS.map((opcion) => {
                            const item = categorias.find(
                                (fila) => fila.categoria === opcion.valor
                            );

                            const limiteCategoriaActual =
                                item && item.limite !== null
                                    ? `Bs ${Number(item.limite).toFixed(2)}`
                                    : '—';

                            const restanteCategoria =
                                item && item.restante !== null
                                    ? `Bs ${Number(item.restante).toFixed(2)}`
                                    : '—';

                            const consumidoCategoria = `Bs ${Number(
                                item ? item.consumido : 0
                            ).toFixed(2)}`;

                            return (
                                <tr key={opcion.valor}>
                                    <td>{opcion.etiqueta}</td>
                                    <td>{limiteCategoriaActual}</td>
                                    <td>{consumidoCategoria}</td>
                                    <td>{restanteCategoria}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <form onSubmit={handleGuardarPresupuestoCategoria}>
                    <div>
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

                    <div>
                        <label htmlFor="limite-categoria">
                            Límite de la categoría (Bs)
                        </label>

                        <input
                            id="limite-categoria"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={limiteCategoria}
                            onChange={(event) => setLimiteCategoria(event.target.value)}
                            required
                        />
                    </div>

                    <button type="submit">Guardar</button>
                </form>

                {mensajeCategoria && <p role="status">{mensajeCategoria}</p>}
                {errorCategoria && <p role="alert">{errorCategoria}</p>}
            </section>

            <hr />

            <button onClick={handleLogout}>
                Cerrar sesión
            </button>
        </div>
    );
}

export default Dashboard;