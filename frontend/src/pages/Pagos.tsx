import { useEffect, useState } from 'react';
import { obtenerToken } from '../utils/auth';

interface Gasto {

    id: number;

    monto: number;

    motivo: string;

    fecha: string;

    estado: string;

    tipo?: string;

    categoria?: string;

}

function normalizarEstado(estado: string): string {
    const e = estado.toLowerCase().trim();
    if (e === 'gastado' || e === 'pagado') return 'Pagado';
    if (e === 'pendiente') return 'Pendiente';
    return estado;
}

function Pagos() {

    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [saldoDisponible, setSaldoDisponible] = useState<number | null>(null);

    const token = obtenerToken();

    const obtenerPresupuesto = async () => {
        try {
            const ahora = new Date();
            const mes = ahora.getMonth() + 1;
            const anio = ahora.getFullYear();

            const response = await fetch(
                `http://localhost:4000/api/presupuesto/obtener?mes=${mes}&anio=${anio}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();
            if (response.ok && data.disponible !== undefined) {
                setSaldoDisponible(Number(data.disponible));
            }
        } catch (error) {
            console.error('Error al obtener presupuesto en pagos:', error);
        }
    };

    const obtenerGastos = async () => {

        try {

            const response = await fetch(
                'http://localhost:4000/api/gastos/obtener',
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (response.ok) {

                setGastos(data);

            } else {

                console.log(data.error);

            }

        } catch (error) {

            console.error('Error al obtener los gastos:', error);

        }

    };

    const handlePagarGasto = async (id: number) => {

        try {

            const response = await fetch(
                `http://localhost:4000/api/gastos/pagar/${id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (response.ok) {

                console.log(data.message);

                obtenerGastos();
                obtenerPresupuesto();

            } else {

                console.log(data.error);

            }

        } catch (error) {

            console.error('Error al pagar el gasto:', error);

        }

    };

    useEffect(() => {

        obtenerGastos();
        obtenerPresupuesto();

    }, []);

    return (

        <div className="page">

            <div className="page-head">
                <p className="eyebrow">Pagos del mes</p>
                <h1>Pagos</h1>
            </div>

            {/* Contexto financiero para reducir la carga cognitiva */}
            <section className="dark-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
                <div style={{ flex: '1 1 280px' }}>
                    <p className="eyebrow">Resumen</p>
                    <h3 style={{ color: '#fff', fontSize: 'clamp(1.2rem, 1rem + .8vw, 1.6rem)', margin: '0 0 8px' }}>
                        Resumen Financiero del Mes
                    </h3>
                    <small style={{ color: '#b9bbd0', display: 'block', fontSize: '.92rem' }}>
                        Información actualizada del presupuesto para tomar decisiones de pago sin calcular de memoria.
                    </small>
                </div>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, maxWidth: 'none' }}>
                    <strong style={{ display: 'block', color: '#b9bbd0', fontWeight: 600, fontSize: '.9rem' }}>Saldo disponible: </strong>
                    {saldoDisponible !== null ? (
                        <span style={{
                            color: saldoDisponible >= 0 ? 'var(--highlight)' : '#ffb3bd',
                            fontWeight: 900,
                            fontSize: 'clamp(2rem, 1.4rem + 2.4vw, 3rem)',
                            letterSpacing: '-0.04em'
                        }}>
                            Bs {saldoDisponible.toFixed(2)}
                        </span>
                    ) : (
                        <span>Consultando presupuesto...</span>
                    )}
                </p>
            </section>

            <section className="card">
            <p className="eyebrow">Gastos</p>
            <h2 style={{ marginBottom: 16 }}>Lista de gastos</h2>

            <div className="rows">
            {gastos.map((gasto) => {
                const pagado = gasto.estado.toLowerCase().trim() === 'gastado';
                return (

                <div key={gasto.id} className="pay-item" style={pagado ? { background: 'var(--surface-2)' } : undefined}>

                    <p className="pay-motivo">
                        Motivo: {gasto.motivo}
                    </p>

                    <span className="amount gasto pay-monto" aria-hidden="true">Bs {Number(gasto.monto).toFixed(2)}</span>

                    <div className="row-meta pay-full">
                        <p>
                            Monto: {gasto.monto}
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
                            Estado: {normalizarEstado(gasto.estado)}
                        </p>
                    </div>

                    {/* Calculo mental asistido: muestra el impacto financiero inmediato */}
                    {!pagado && saldoDisponible !== null ? (
                        <div className="pay-saldo" style={{
                            background: (saldoDisponible - gasto.monto) >= 0 ? 'var(--surface-2)' : 'var(--red-soft)'
                        }}>
                            <span style={{ fontSize: '.88rem', display: 'block' }}>
                                Saldo restante tras este pago:{' '}
                                <strong style={{
                                    color: (saldoDisponible - gasto.monto) >= 0 ? 'var(--green)' : 'var(--red)'
                                }}>
                                    Bs {(saldoDisponible - gasto.monto).toFixed(2)}
                                </strong>
                            </span>
                            {(saldoDisponible - gasto.monto) < 0 && (
                                <span style={{ fontSize: '.84rem', color: 'var(--red)', fontWeight: 700 }}>
                                    ⚠️ Atención: Este pago superará tu saldo disponible actual.
                                </span>
                            )}
                        </div>
                    ) : <span />}

                    <button
                        className="btn-small pay-btn"
                        onClick={() => handlePagarGasto(gasto.id)}
                        disabled={pagado}
                    >
                        {pagado
                            ? 'Pagado'
                            : 'Marcar como pagado'}
                    </button>

                </div>

                );
            })}
            </div>
            </section>

        </div>

    );

}

export default Pagos;
