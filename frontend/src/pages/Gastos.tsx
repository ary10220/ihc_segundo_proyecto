import { useEffect, useRef, useState } from 'react';
import { track, type Motivo } from '../utils/analitica';
import { obtenerToken } from '../utils/auth';

// Traduce el error del backend a un motivo de la lista fija (sin guardar el texto).
function motivoDesdeError(error: string | undefined): Motivo {
    const texto = (error || '').toLowerCase();
    if (texto.includes('no tienes un presupuesto') || texto.includes('no existe un presupuesto')) return 'sin_presupuesto';
    if (texto.includes('supera')) return 'supera_presupuesto';
    if (texto.includes('monto positivo')) return 'campos_vacios';
    return 'error_servidor';
}

interface Gasto {
    id: number;
    monto: number;
    motivo: string;
    fecha: string;
    estado: string;
    tipo?: string;
    categoria?: string;
}

interface AvisoLimite {
    accion: 'registrar' | 'editar';
    categoria: string;
    limite: number;
    consumido: number;
    montoSolicitado: number;
    exceso: number;
}

function Gastos() {

    const [monto, setMonto] = useState('');
    const [motivo, setMotivo] = useState('');
    const [tipo, setTipo] = useState('gasto');
    const [categoria, setCategoria] = useState('otros');
    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [mensajeExito, setMensajeExito] = useState('');
    const [mensajeError, setMensajeError] = useState('');
    const [buscar, setBuscar] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [filtroPeriodo, setFiltroPeriodo] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [totalFiltrado, setTotalFiltrado] = useState(0);
    const [mostrarMasFiltros, setMostrarMasFiltros] = useState(false);

    const [gastoEditando, setGastoEditando] = useState<number | null>(null);

    // Tarea 9: aviso antes de superar el limite de la categoria.
    const [avisoLimite, setAvisoLimite] = useState<AvisoLimite | null>(null);

    // Tarea 9 - Analitica: no repetir busqueda_sin_resultados por cada tecla.
    const ultimaBusquedaVacia = useRef('');

    const token = obtenerToken();

    const obtenerGastos = async () => {

        try {

            const params = new URLSearchParams();

            if (buscar.trim()) params.append('buscar', buscar.trim());
            if (filtroTipo) params.append('tipo', filtroTipo);
            if (filtroCategoria) params.append('categoria', filtroCategoria);
            if (filtroEstado) params.append('estado', filtroEstado);
            if (filtroPeriodo) params.append('periodo', filtroPeriodo);
            if (filtroPeriodo === 'rango' && fechaDesde) params.append('desde', fechaDesde);
            if (filtroPeriodo === 'rango' && fechaHasta) params.append('hasta', fechaHasta);

            const queryString = params.toString();
            const url = queryString
                ? `http://localhost:4000/api/gastos/filtrar?${queryString}`
                : 'http://localhost:4000/api/gastos/filtrar';

            const response = await fetch(
                url,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (response.ok) {
                setGastos(data.movimientos || []);
                setTotalFiltrado(Number(data.total) || 0);

                // Tarea 9 - Analitica: busqueda o filtro sin resultados.
                // Solo se guarda QUE filtros estaban activos, nunca el texto buscado.
                const filtros = [
                    buscar.trim() && 'texto',
                    filtroTipo && 'tipo',
                    filtroCategoria && 'categoria',
                    filtroEstado && 'estado',
                    filtroPeriodo && 'periodo'
                ].filter(Boolean).join(',');
                const sinResultados = (data.movimientos || []).length === 0;
                if (filtros && sinResultados && ultimaBusquedaVacia.current !== filtros) {
                    track('busqueda_sin_resultados', { filtros });
                    ultimaBusquedaVacia.current = filtros;
                } else if (!sinResultados) {
                    ultimaBusquedaVacia.current = '';
                }
            } else {
                console.log(data.error);
            }

        } catch (error) {
            console.error('Error al obtener los gastos:', error);
        }
    };

    useEffect(() => {
        obtenerGastos();
    }, [buscar, filtroTipo, filtroCategoria, filtroEstado, filtroPeriodo, fechaDesde, fechaHasta]);

    const handleRegitrarGasto = async (confirmarExceso = false) => {

        // Clase 21 - Analitica: el usuario inicia el flujo de registrar un movimiento.
        // Al confirmar el aviso no se cuenta un segundo inicio.
        if (!confirmarExceso) track('movimiento_iniciado', { tipo, categoria });

        if (!monto || !motivo.trim()) {
            track('movimiento_rechazado', { tipo, categoria, motivo: 'campos_vacios' });
            setMensajeError('Todos los campos son obligatorios.');
            setTimeout(() => setMensajeError(''), 3000);
            return;
        }

        if (/^\d+$/.test(motivo.trim())) {
            track('movimiento_rechazado', { tipo, categoria, motivo: 'motivo_numerico' });
            setMensajeError('El motivo debe contener una descripción válida en texto, no solo números.');
            setTimeout(() => setMensajeError(''), 4000);
            return;
        }

        setMensajeError('');

        try {

            const response = await fetch(
                'http://localhost:4000/api/gastos/registrar',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        monto,
                        motivo,
                        tipo,
                        categoria,
                        confirmarExceso
                    })
                }
            );

            const data = await response.json();

            if (response.status === 409 && data.requiereConfirmacion) {
                track('aviso_limite_mostrado', { categoria, accion: 'registrar' });
                setAvisoLimite({ accion: 'registrar', ...data });
                return;
            }

            setAvisoLimite(null);

            if (response.ok) {

                if (confirmarExceso) track('aviso_limite_confirmado', { categoria, accion: 'registrar' });

                // Clase 21 - Analitica: solo llegamos aqui si el movimiento se guardo.
                track('movimiento_guardado', { tipo, categoria, supera_limite: confirmarExceso });

                setMensajeExito('Gasto registrado correctamente.');
                setTimeout(() => setMensajeExito(''), 3000);

                setMonto('');
                setMotivo('');
                setTipo('gasto');
                setCategoria('otros');

                obtenerGastos();

            } else {

                track('movimiento_rechazado', { tipo, categoria, motivo: motivoDesdeError(data.error) });
                console.log(data.error);
                alert(data.error);

            }

        } catch (error) {
            track('movimiento_rechazado', { tipo, categoria, motivo: 'error_servidor' });
            console.error('Error al registrar el gasto:', error);
        }
    };


    const handleEliminarGasto = async (id: number) => {

        const confirmar = window.confirm(
            'Estas seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer.'
        );

        if (!confirmar) {
            return;
        }

        try {

            const response = await fetch(
                `http://localhost:4000/api/gastos/eliminar/${id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (response.ok) {

                alert('Gasto eliminado correctamente.');

                obtenerGastos();

            } else {

                alert(data.error);

            }

        } catch (error) {

            console.error('Error al eliminar el gasto:', error);

            alert('Ocurrió un error al intentar eliminar el gasto.');

        }

    };


    const handleEditarGasto = (gasto: Gasto) => {

        setGastoEditando(gasto.id);
        setMonto(String(gasto.monto));
        setMotivo(gasto.motivo);
        if (gasto.tipo) setTipo(gasto.tipo);
        if (gasto.categoria) setCategoria(gasto.categoria);

    };

    const handleActualizarGasto = async (confirmarExceso = false) => {

        if (!monto || !motivo.trim() || gastoEditando === null) {
            setMensajeError('Todos los campos son obligatorios.');
            setTimeout(() => setMensajeError(''), 3000);
            return;
        }

        if (/^\d+$/.test(motivo.trim())) {
            setMensajeError('El motivo debe contener una descripción válida en texto, no solo números.');
            setTimeout(() => setMensajeError(''), 4000);
            return;
        }

        setMensajeError('');

        try {

            const response = await fetch(
                `http://localhost:4000/api/gastos/editar/${gastoEditando}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        monto,
                        motivo,
                        tipo,
                        categoria,
                        confirmarExceso
                    })
                }
            );

            const data = await response.json();

            if (response.status === 409 && data.requiereConfirmacion) {
                track('aviso_limite_mostrado', { categoria, accion: 'editar' });
                setAvisoLimite({ accion: 'editar', ...data });
                return;
            }

            setAvisoLimite(null);

            if (response.ok) {

                if (confirmarExceso) track('aviso_limite_confirmado', { categoria, accion: 'editar' });

                setMensajeExito('Gasto actualizado correctamente.');
                setTimeout(() => setMensajeExito(''), 3000);

                setMonto('');
                setMotivo('');
                setTipo('gasto');
                setCategoria('otros');
                setGastoEditando(null);

                obtenerGastos();

            } else {

                console.log(data.error);
                alert(data.error);

            }

        } catch (error) {
            console.error('Error al editar el gasto:', error);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>

            <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                <h1>{gastoEditando === null ? 'Ingresar Gastos' : `Editando Gasto #${gastoEditando}`}</h1>

            {gastoEditando !== null && (
                <div style={{ backgroundColor: '#e7f3fe', color: '#1f2328', borderLeft: '4px solid #2196F3', padding: '10px 14px', marginBottom: '14px', borderRadius: '4px' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#0d47a1' }}>
                        Modo edición activo: Gasto #{gastoEditando} ({motivo || 'sin motivo'})
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.9em', color: '#555' }}>
                        Modifica los valores deseados o cancela para volver al registro nuevo.
                    </p>
                </div>
            )}

            <input
                type="number"
                placeholder="Monto"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
            />

            <input
                type="text"
                placeholder="Motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
            />

            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso</option>
            </select>

            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="otros">Otros</option>
                <option value="comida">Comida</option>
                <option value="transporte">Transporte</option>
                <option value="estudio">Estudio</option>
            </select>

            {gastoEditando === null ? (

                <button onClick={() => handleRegitrarGasto()} disabled={avisoLimite !== null}>
                    Registrar Gasto
                </button>

            ) : (

                <>
                    <button onClick={() => handleActualizarGasto()} disabled={avisoLimite !== null}>
                        Guardar cambios
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setGastoEditando(null);
                            setMonto('');
                            setMotivo('');
                            setTipo('gasto');
                            setCategoria('otros');
                            setMensajeError('');
                            setAvisoLimite(null);
                        }}
                        style={{ marginLeft: '8px' }}
                    >
                        Cancelar edición
                    </button>
                </>

            )}

            {/* Tarea 9: aviso antes de superar el limite. Confirmar guarda; cancelar no cambia nada. */}
            {avisoLimite && (
                <div
                    role="alertdialog"
                    aria-labelledby="aviso-limite-titulo"
                    aria-describedby="aviso-limite-detalle"
                    style={{ backgroundColor: '#fff3cd', color: '#1f2328', border: '1px solid #ffe69c', borderLeft: '4px solid #b45309', padding: '12px 14px', marginTop: '12px', borderRadius: '6px' }}
                >
                    <p id="aviso-limite-titulo" style={{ margin: 0, fontWeight: 'bold' }}>
                        Te pasarías del límite de {avisoLimite.categoria} por Bs {avisoLimite.exceso.toFixed(2)}
                    </p>
                    <p id="aviso-limite-detalle" style={{ margin: '6px 0 10px 0' }}>
                        Límite del mes: Bs {avisoLimite.limite.toFixed(2)} · Ya gastado: Bs {avisoLimite.consumido.toFixed(2)} · Este gasto: Bs {avisoLimite.montoSolicitado.toFixed(2)}.
                        ¿Quieres guardarlo de todas formas?
                    </p>
                    <button
                        type="button"
                        onClick={() => avisoLimite.accion === 'registrar' ? handleRegitrarGasto(true) : handleActualizarGasto(true)}
                    >
                        Guardar de todas formas
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            track('aviso_limite_cancelado', { categoria: avisoLimite.categoria, accion: avisoLimite.accion });
                            setAvisoLimite(null);
                        }}
                        style={{ marginLeft: '8px' }}
                    >
                        Cancelar
                    </button>
                </div>
            )}

            {mensajeExito && (
                <p role="status" style={{ color: 'green', fontWeight: 'bold', marginTop: '8px' }}>
                    {mensajeExito}
                </p>
            )}

            {mensajeError && (
                <p role="alert" style={{ color: 'crimson', fontWeight: 'bold', marginTop: '8px' }}>
                    {mensajeError}
                </p>
            )}
            </section>

            <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                <h2>Buscar y Filtrar Movimientos</h2>

                <div style={{ marginBottom: '12px' }}>
                    <input
                        type="text"
                        placeholder="Buscar por concepto o descripción..."
                        value={buscar}
                        onChange={(e) => setBuscar(e.target.value)}
                        style={{ padding: '8px', width: '100%', maxWidth: '360px', boxSizing: 'border-box' }}
                    />
                </div>

                {/* Accesos directos principales para reducir opciones simultaneas (Ley de Hick) */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Filtros rápidos:</span>
                    <button
                        type="button"
                        onClick={() => { setFiltroTipo(''); setFiltroPeriodo(''); }}
                        style={{
                            padding: '6px 12px',
                            cursor: 'pointer',
                            color: '#1f2328',
                            backgroundColor: (!filtroTipo && !filtroPeriodo) ? '#d0d7de' : '#f6f8fa',
                            border: '1px solid #d0d7de',
                            borderRadius: '6px'
                        }}
                    >
                        Todos
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltroTipo(filtroTipo === 'gasto' ? '' : 'gasto')}
                        style={{
                            padding: '6px 12px',
                            cursor: 'pointer',
                            color: '#1f2328',
                            backgroundColor: filtroTipo === 'gasto' ? '#cfe2ff' : '#f6f8fa',
                            border: '1px solid #b6d4fe',
                            borderRadius: '6px'
                        }}
                    >
                        Solo gastos
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltroTipo(filtroTipo === 'ingreso' ? '' : 'ingreso')}
                        style={{
                            padding: '6px 12px',
                            cursor: 'pointer',
                            color: '#1f2328',
                            backgroundColor: filtroTipo === 'ingreso' ? '#d1e7dd' : '#f6f8fa',
                            border: '1px solid #a3cfbb',
                            borderRadius: '6px'
                        }}
                    >
                        Solo ingresos
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltroPeriodo(filtroPeriodo === 'este_mes' ? '' : 'este_mes')}
                        style={{
                            padding: '6px 12px',
                            cursor: 'pointer',
                            color: '#1f2328',
                            backgroundColor: filtroPeriodo === 'este_mes' ? '#fff3cd' : '#f6f8fa',
                            border: '1px solid #ffe69c',
                            borderRadius: '6px'
                        }}
                    >
                        Este mes
                    </button>
                    {/* Clase 20 - Arquitectura de informacion: subir el filtro de estado al primer nivel */}
                    <span style={{ fontSize: '14px', fontWeight: 'bold', marginLeft: '8px' }}>| Estado:</span>
                    <button
                        type="button"
                        onClick={() => setFiltroEstado('')}
                        style={{
                            padding: '6px 12px',
                            cursor: 'pointer',
                            color: '#1f2328',
                            backgroundColor: !filtroEstado ? '#cfe2ff' : '#f6f8fa',
                            border: '1px solid #b6d4fe',
                            borderRadius: '6px'
                        }}
                    >
                        Todos los estados
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltroEstado(filtroEstado === 'pendiente' ? '' : 'pendiente')}
                        style={{
                            padding: '6px 12px',
                            cursor: 'pointer',
                            color: '#1f2328',
                            backgroundColor: filtroEstado === 'pendiente' ? '#cfe2ff' : '#f6f8fa',
                            border: '1px solid #b6d4fe',
                            borderRadius: '6px'
                        }}
                    >
                        Pendientes
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltroEstado(filtroEstado === 'pagado' ? '' : 'pagado')}
                        style={{
                            padding: '6px 12px',
                            cursor: 'pointer',
                            color: '#1f2328',
                            backgroundColor: filtroEstado === 'pagado' ? '#cfe2ff' : '#f6f8fa',
                            border: '1px solid #b6d4fe',
                            borderRadius: '6px'
                        }}
                    >
                        Pagados
                    </button>
                    <button
                        type="button"
                        onClick={() => setMostrarMasFiltros(!mostrarMasFiltros)}
                        style={{
                            padding: '6px 12px',
                            cursor: 'pointer',
                            color: '#1f2328',
                            backgroundColor: mostrarMasFiltros ? '#e9ecef' : '#ffffff',
                            border: '1px solid #6c757d',
                            borderRadius: '6px',
                            marginLeft: '4px'
                        }}
                    >
                        {mostrarMasFiltros ? '▲ Menos filtros' : '▼ Más filtros'}
                    </button>
                </div>

                {/* Divulgacion progresiva: solo se muestran los 4 desplegables si el usuario los solicita */}
                {mostrarMasFiltros && (
                    <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef', color: '#1f2328', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '3px' }}>Tipo:</label>
                                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={{ padding: '4px 8px' }}>
                                    <option value="">Todos los tipos</option>
                                    <option value="gasto">Solo gastos</option>
                                    <option value="ingreso">Solo ingresos</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '3px' }}>Categoría:</label>
                                <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={{ padding: '4px 8px' }}>
                                    <option value="">Todas las categorías</option>
                                    <option value="comida">Comida</option>
                                    <option value="transporte">Transporte</option>
                                    <option value="estudio">Estudio</option>
                                    <option value="otros">Otros</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '3px' }}>Estado:</label>
                                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ padding: '4px 8px' }}>
                                    <option value="">Todos los estados</option>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="pagado">Pagado</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '3px' }}>Período:</label>
                                <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} style={{ padding: '4px 8px' }}>
                                    <option value="">Todos los períodos</option>
                                    <option value="este_mes">Este mes</option>
                                    <option value="mes_anterior">Mes anterior</option>
                                    <option value="rango">Rango de fechas</option>
                                </select>
                            </div>
                        </div>

                        {filtroPeriodo === 'rango' && (
                            <div style={{ marginTop: '10px' }}>
                                <label>Desde: </label>
                                <input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={(e) => setFechaDesde(e.target.value)}
                                    style={{ padding: '4px', marginRight: '10px' }}
                                />
                                <label>Hasta: </label>
                                <input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={(e) => setFechaHasta(e.target.value)}
                                    style={{ padding: '4px' }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {(buscar || filtroTipo || filtroCategoria || filtroEstado || filtroPeriodo) && (
                    <div style={{ marginTop: '10px' }}>
                        <p><strong>Filtros activos:</strong></p>
                        {buscar && (
                            <span>
                                Concepto: "{buscar}" <button onClick={() => setBuscar('')}>✕</button>{' '}
                            </span>
                        )}
                        {filtroTipo && (
                            <span>
                                Tipo: {filtroTipo} <button onClick={() => setFiltroTipo('')}>✕</button>{' '}
                            </span>
                        )}
                        {filtroCategoria && (
                            <span>
                                Categoría: {filtroCategoria} <button onClick={() => setFiltroCategoria('')}>✕</button>{' '}
                            </span>
                        )}
                        {filtroEstado && (
                            <span>
                                Estado: {filtroEstado} <button onClick={() => setFiltroEstado('')}>✕</button>{' '}
                            </span>
                        )}
                        {filtroPeriodo && (
                            <span>
                                Período: {filtroPeriodo === 'rango' ? `${fechaDesde || 'inicio'} a ${fechaHasta || 'hoy'}` : filtroPeriodo.replace('_', ' ')}{' '}
                                <button onClick={() => { setFiltroPeriodo(''); setFechaDesde(''); setFechaHasta(''); }}>✕</button>{' '}
                            </span>
                        )}
                        <div>
                            <button
                                onClick={() => {
                                    setBuscar('');
                                    setFiltroTipo('');
                                    setFiltroCategoria('');
                                    setFiltroEstado('');
                                    setFiltroPeriodo('');
                                    setFechaDesde('');
                                    setFechaHasta('');
                                }}
                            >
                                Limpiar todos los filtros
                            </button>
                        </div>
                    </div>
                )}
            </section>

            <h2>Lista de movimientos</h2>
            <p><strong>Total filtrado: Bs {totalFiltrado.toFixed(2)}</strong></p>

            {gastos.length === 0 ? (
                <p>No se encontraron movimientos con los filtros seleccionados.</p>
            ) : (
                gastos.map((gasto) => {
                    const estaEditandoEste = gasto.id === gastoEditando;

                    return (
                        <div
                            key={gasto.id}
                            style={{
                                padding: '10px',
                                margin: '10px 0',
                                border: estaEditandoEste ? '2px solid #2196F3' : '1px solid #ddd',
                                borderRadius: '6px',
                                backgroundColor: estaEditandoEste ? '#f4f9ff' : 'transparent'
                            }}
                        >
                            {estaEditandoEste && (
                                <p style={{ margin: '0 0 8px 0' }}>
                                    <span style={{ backgroundColor: '#2196F3', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 'bold' }}>
                                        EDITANDO ESTE REGISTRO
                                    </span>
                                </p>
                            )}

                            <p>
                                <strong>Monto:</strong> <span style={{ fontSize: '1.15em', fontWeight: 'bold', color: gasto.tipo === 'ingreso' ? 'green' : '#c62828' }}>Bs {gasto.monto}</span>
                            </p>

                            <p>
                                <strong>Motivo:</strong> {gasto.motivo}
                            </p>

                        <p>
                            Tipo: {gasto.tipo || 'gasto'}
                        </p>

                        <p>
                            Categoría: {gasto.categoria || 'otros'}
                        </p>

                        <p>
                            Fecha: {new Date(gasto.fecha).toLocaleString()}
                        </p>

                        <p>
                            Estado: {gasto.estado}
                        </p>

                        <div style={{ display: 'flex', gap: '14px', marginTop: '12px', alignItems: 'center' }}>
                            <button
                                onClick={() => {
                                    if (gasto.estado.toLowerCase().trim() === 'gastado') {
                                        alert('No se puede editar este gasto porque ya está pagado.');
                                        return;
                                    }

                                    handleEditarGasto(gasto);
                                }}
                                style={{
                                    backgroundColor: '#1976d2',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '9px 18px',
                                    fontSize: '0.95em',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(25, 118, 210, 0.25)',
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                Editar
                            </button>

                            <button
                                onClick={() => handleEliminarGasto(gasto.id)}
                                style={{
                                    backgroundColor: '#d32f2f',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '9px 18px',
                                    fontSize: '0.95em',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(211, 47, 47, 0.25)',
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                Eliminar
                            </button>
                        </div>

                            <hr />

                        </div>
                    );
                })
            )}

        </div>
    );
}

export default Gastos;