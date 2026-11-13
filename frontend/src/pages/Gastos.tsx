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

    const seg = (activo: boolean) => (activo ? 'seg on' : 'seg');

    return (
        <div className="page">

            <div className="page-head">
                <p className="eyebrow">Movimientos</p>
                <h1>{gastoEditando === null ? 'Ingresar Gastos' : `Editando Gasto #${gastoEditando}`}</h1>
            </div>

            <div className="grid-2">

            <section className="card" style={gastoEditando !== null ? { borderColor: 'var(--accent-text)', boxShadow: '0 0 0 4px var(--accent-soft)' } : undefined}>

            {gastoEditando !== null && (
                <div className="callout" style={{ marginBottom: 18 }}>
                    <p style={{ fontWeight: 700 }}>
                        Modo edición activo: Gasto #{gastoEditando} ({motivo || 'sin motivo'})
                    </p>
                    <p className="muted" style={{ marginTop: 4, fontSize: '.92rem' }}>
                        Modifica los valores deseados o cancela para volver al registro nuevo.
                    </p>
                </div>
            )}

            <div style={{ display: 'grid', gap: 14 }}>
                <div className="form-field">
                    <label htmlFor="gasto-monto">Monto (Bs)</label>
                    <input
                        id="gasto-monto"
                        type="number"
                        placeholder="Monto"
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="gasto-motivo">Motivo</label>
                    <input
                        id="gasto-motivo"
                        type="text"
                        placeholder="Motivo"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                    <div className="form-field">
                        <label htmlFor="gasto-tipo">Tipo</label>
                        <select id="gasto-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                            <option value="gasto">Gasto</option>
                            <option value="ingreso">Ingreso</option>
                        </select>
                    </div>

                    <div className="form-field">
                        <label htmlFor="gasto-categoria">Categoría</label>
                        <select id="gasto-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                            <option value="otros">Otros</option>
                            <option value="comida">Comida</option>
                            <option value="transporte">Transporte</option>
                            <option value="estudio">Estudio</option>
                        </select>
                    </div>
                </div>

            {gastoEditando === null ? (

                <button onClick={() => handleRegitrarGasto()} disabled={avisoLimite !== null}>
                    Registrar Gasto
                </button>

            ) : (

                <div className="actions">
                    <button onClick={() => handleActualizarGasto()} disabled={avisoLimite !== null}>
                        Guardar cambios
                    </button>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                            setGastoEditando(null);
                            setMonto('');
                            setMotivo('');
                            setTipo('gasto');
                            setCategoria('otros');
                            setMensajeError('');
                            setAvisoLimite(null);
                        }}
                    >
                        Cancelar edición
                    </button>
                </div>

            )}
            </div>

            {/* Tarea 9: aviso antes de superar el limite. Confirmar guarda; cancelar no cambia nada. */}
            {avisoLimite && (
                <div
                    role="alertdialog"
                    aria-labelledby="aviso-limite-titulo"
                    aria-describedby="aviso-limite-detalle"
                    className="callout warn"
                    style={{ marginTop: 16 }}
                >
                    <p id="aviso-limite-titulo" style={{ fontWeight: 800 }}>
                        Te pasarías del límite de {avisoLimite.categoria} por Bs {avisoLimite.exceso.toFixed(2)}
                    </p>
                    <p id="aviso-limite-detalle" style={{ margin: '6px 0 12px 0' }}>
                        Límite del mes: Bs {avisoLimite.limite.toFixed(2)} · Ya gastado: Bs {avisoLimite.consumido.toFixed(2)} · Este gasto: Bs {avisoLimite.montoSolicitado.toFixed(2)}.
                        ¿Quieres guardarlo de todas formas?
                    </p>
                    <div className="actions">
                        <button
                            type="button"
                            className="btn-small"
                            onClick={() => avisoLimite.accion === 'registrar' ? handleRegitrarGasto(true) : handleActualizarGasto(true)}
                        >
                            Guardar de todas formas
                        </button>
                        <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => {
                                track('aviso_limite_cancelado', { categoria: avisoLimite.categoria, accion: avisoLimite.accion });
                                setAvisoLimite(null);
                            }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {mensajeExito && (
                <p role="status" className="msg-ok">
                    {mensajeExito}
                </p>
            )}

            {mensajeError && (
                <p role="alert" className="msg-err">
                    {mensajeError}
                </p>
            )}
            </section>

            <section className="card">
                <p className="eyebrow">Búsqueda</p>
                <h2>Buscar y Filtrar Movimientos</h2>

                <div style={{ margin: '14px 0' }}>
                    <input
                        type="text"
                        placeholder="Buscar por concepto o descripción..."
                        aria-label="Buscar por concepto o descripción"
                        value={buscar}
                        onChange={(e) => setBuscar(e.target.value)}
                    />
                </div>

                {/* Accesos directos principales para reducir opciones simultaneas (Ley de Hick) */}
                <div className="segs" style={{ marginBottom: 10 }}>
                    <span className="segs-label">Filtros rápidos:</span>
                    <button type="button" className={seg(!filtroTipo && !filtroPeriodo)} onClick={() => { setFiltroTipo(''); setFiltroPeriodo(''); }}>
                        Todos
                    </button>
                    <button type="button" className={seg(filtroTipo === 'gasto')} onClick={() => setFiltroTipo(filtroTipo === 'gasto' ? '' : 'gasto')}>
                        Solo gastos
                    </button>
                    <button type="button" className={seg(filtroTipo === 'ingreso')} onClick={() => setFiltroTipo(filtroTipo === 'ingreso' ? '' : 'ingreso')}>
                        Solo ingresos
                    </button>
                    <button type="button" className={seg(filtroPeriodo === 'este_mes')} onClick={() => setFiltroPeriodo(filtroPeriodo === 'este_mes' ? '' : 'este_mes')}>
                        Este mes
                    </button>
                </div>
                <div className="segs" style={{ marginBottom: 12 }}>
                    {/* Clase 20 - Arquitectura de informacion: subir el filtro de estado al primer nivel */}
                    <span className="segs-label">| Estado:</span>
                    <button type="button" className={seg(!filtroEstado)} onClick={() => setFiltroEstado('')}>
                        Todos los estados
                    </button>
                    <button type="button" className={seg(filtroEstado === 'pendiente')} onClick={() => setFiltroEstado(filtroEstado === 'pendiente' ? '' : 'pendiente')}>
                        Pendientes
                    </button>
                    <button type="button" className={seg(filtroEstado === 'pagado')} onClick={() => setFiltroEstado(filtroEstado === 'pagado' ? '' : 'pagado')}>
                        Pagados
                    </button>
                </div>
                <button
                    type="button"
                    className="btn-secondary btn-small"
                    aria-expanded={mostrarMasFiltros}
                    onClick={() => setMostrarMasFiltros(!mostrarMasFiltros)}
                >
                    {mostrarMasFiltros ? '▲ Menos filtros' : '▼ Más filtros'}
                </button>

                {/* Divulgacion progresiva: solo se muestran los 4 desplegables si el usuario los solicita */}
                {mostrarMasFiltros && (
                    <div style={{ padding: 16, marginTop: 14, backgroundColor: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                            <div className="form-field">
                                <label htmlFor="filtro-tipo">Tipo:</label>
                                <select id="filtro-tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                                    <option value="">Todos los tipos</option>
                                    <option value="gasto">Solo gastos</option>
                                    <option value="ingreso">Solo ingresos</option>
                                </select>
                            </div>

                            <div className="form-field">
                                <label htmlFor="filtro-categoria">Categoría:</label>
                                <select id="filtro-categoria" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                                    <option value="">Todas las categorías</option>
                                    <option value="comida">Comida</option>
                                    <option value="transporte">Transporte</option>
                                    <option value="estudio">Estudio</option>
                                    <option value="otros">Otros</option>
                                </select>
                            </div>

                            <div className="form-field">
                                <label htmlFor="filtro-estado">Estado:</label>
                                <select id="filtro-estado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                                    <option value="">Todos los estados</option>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="pagado">Pagado</option>
                                </select>
                            </div>

                            <div className="form-field">
                                <label htmlFor="filtro-periodo">Período:</label>
                                <select id="filtro-periodo" value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>
                                    <option value="">Todos los períodos</option>
                                    <option value="este_mes">Este mes</option>
                                    <option value="mes_anterior">Mes anterior</option>
                                    <option value="rango">Rango de fechas</option>
                                </select>
                            </div>
                        </div>

                        {filtroPeriodo === 'rango' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
                                <div className="form-field">
                                    <label htmlFor="filtro-desde">Desde: </label>
                                    <input
                                        id="filtro-desde"
                                        type="date"
                                        value={fechaDesde}
                                        onChange={(e) => setFechaDesde(e.target.value)}
                                    />
                                </div>
                                <div className="form-field">
                                    <label htmlFor="filtro-hasta">Hasta: </label>
                                    <input
                                        id="filtro-hasta"
                                        type="date"
                                        value={fechaHasta}
                                        onChange={(e) => setFechaHasta(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {(buscar || filtroTipo || filtroCategoria || filtroEstado || filtroPeriodo) && (
                    <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <p style={{ margin: 0, width: '100%' }}><strong>Filtros activos:</strong></p>
                        {buscar && (
                            <span className="chip">
                                Concepto: "{buscar}" <button className="btn-chip" aria-label="Quitar filtro de concepto" onClick={() => setBuscar('')}>✕</button>{' '}
                            </span>
                        )}
                        {filtroTipo && (
                            <span className="chip">
                                Tipo: {filtroTipo} <button className="btn-chip" aria-label="Quitar filtro de tipo" onClick={() => setFiltroTipo('')}>✕</button>{' '}
                            </span>
                        )}
                        {filtroCategoria && (
                            <span className="chip">
                                Categoría: {filtroCategoria} <button className="btn-chip" aria-label="Quitar filtro de categoría" onClick={() => setFiltroCategoria('')}>✕</button>{' '}
                            </span>
                        )}
                        {filtroEstado && (
                            <span className="chip">
                                Estado: {filtroEstado} <button className="btn-chip" aria-label="Quitar filtro de estado" onClick={() => setFiltroEstado('')}>✕</button>{' '}
                            </span>
                        )}
                        {filtroPeriodo && (
                            <span className="chip">
                                Período: {filtroPeriodo === 'rango' ? `${fechaDesde || 'inicio'} a ${fechaHasta || 'hoy'}` : filtroPeriodo.replace('_', ' ')}{' '}
                                <button className="btn-chip" aria-label="Quitar filtro de período" onClick={() => { setFiltroPeriodo(''); setFechaDesde(''); setFechaHasta(''); }}>✕</button>{' '}
                            </span>
                        )}
                        <div style={{ width: '100%' }}>
                            <button
                                className="btn-secondary btn-small"
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

            </div>

            <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <div>
                    <p className="eyebrow">Registros</p>
                    <h2>Lista de movimientos</h2>
                </div>
                <p style={{ margin: 0 }}><strong>Total filtrado: Bs {totalFiltrado.toFixed(2)}</strong></p>
            </div>

            {gastos.length === 0 ? (
                <p className="empty">No se encontraron movimientos con los filtros seleccionados.</p>
            ) : (
                <div className="rows">
                {gastos.map((gasto) => {
                    const estaEditandoEste = gasto.id === gastoEditando;
                    const estadoNorm = gasto.estado.toLowerCase().trim();
                    const pagado = estadoNorm === 'gastado' || estadoNorm === 'pagado';

                    return (
                        <div
                            key={gasto.id}
                            className={estaEditandoEste ? 'row-item editing' : 'row-item'}
                        >
                            <div className="row-main">
                            {estaEditandoEste && (
                                <p style={{ margin: '0 0 8px 0' }}>
                                    <span className="chip accent">
                                        EDITANDO ESTE REGISTRO
                                    </span>
                                </p>
                            )}

                            <p style={{ margin: 0, fontSize: '1.05rem' }}>
                                <strong>Motivo:</strong> {gasto.motivo}
                            </p>

                            <div className="row-meta">
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
                            </div>
                            </div>

                            <div className="row-side">
                                <span className={`chip ${pagado ? 'green' : 'amber'}`} aria-hidden="true">{pagado ? 'Pagado' : 'Pendiente'}</span>

                                <p style={{ margin: 0 }}>
                                    <strong>Monto:</strong> <span className={`amount ${gasto.tipo === 'ingreso' ? 'ingreso' : 'gasto'}`} style={{ fontSize: '1.15rem' }}>Bs {gasto.monto}</span>
                                </p>

                                <button
                                    className="btn-secondary btn-small"
                                    onClick={() => {
                                        if (estadoNorm === 'gastado') {
                                            alert('No se puede editar este gasto porque ya está pagado.');
                                            return;
                                        }

                                        handleEditarGasto(gasto);
                                    }}
                                >
                                    Editar
                                </button>

                                <button
                                    className="btn-danger btn-small"
                                    onClick={() => handleEliminarGasto(gasto.id)}
                                >
                                    Eliminar
                                </button>
                            </div>

                        </div>
                    );
                })}
                </div>
            )}
            </section>

        </div>
    );
}

export default Gastos;