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

        <div>

            <h1>Pagos</h1>

            {/* Contexto financiero para reducir la carga cognitiva (centrado en la pantalla) */}
            <div style={{
                backgroundColor: '#f0f4f8',
                border: '1px solid #d0d7de',
                borderRadius: '8px',
                padding: '16px 20px',
                margin: '20px auto 30px auto',
                maxWidth: '480px',
                textAlign: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
            }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#1f2328' }}>
                    Resumen Financiero del Mes
                </h3>
                <p style={{ margin: '6px 0', fontSize: '16px' }}>
                    <strong>Saldo disponible: </strong>
                    {saldoDisponible !== null ? (
                        <span style={{
                            color: saldoDisponible >= 0 ? '#1a7f37' : '#cf222e',
                            fontWeight: 'bold',
                            fontSize: '18px'
                        }}>
                            Bs {saldoDisponible.toFixed(2)}
                        </span>
                    ) : (
                        <span>Consultando presupuesto...</span>
                    )}
                </p>
                <small style={{ color: '#57606a', display: 'block', marginTop: '6px' }}>
                    Información actualizada del presupuesto para tomar decisiones de pago sin calcular de memoria.
                </small>
            </div>

            <h2>Lista de gastos</h2>

            {gastos.map((gasto) => (

                <div key={gasto.id}>

                    <p>
                        Monto: {gasto.monto}
                    </p>

                    <p>
                        Motivo: {gasto.motivo}
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

                    {/* Calculo mental asistido: muestra el impacto financiero inmediato */}
                    {gasto.estado.toLowerCase().trim() !== 'gastado' && saldoDisponible !== null && (
                        <div style={{
                            backgroundColor: '#f6f8fa',
                            border: '1px dashed #d0d7de',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            margin: '10px 0',
                            maxWidth: '400px'
                        }}>
                            <span style={{ fontSize: '13px', display: 'block' }}>
                                Saldo restante tras este pago:{' '}
                                <strong style={{
                                    color: (saldoDisponible - gasto.monto) >= 0 ? '#1a7f37' : '#cf222e'
                                }}>
                                    Bs {(saldoDisponible - gasto.monto).toFixed(2)}
                                </strong>
                            </span>
                            {(saldoDisponible - gasto.monto) < 0 && (
                                <span style={{ fontSize: '12px', color: '#cf222e', fontWeight: 'bold' }}>
                                    ⚠️ Atención: Este pago superará tu saldo disponible actual.
                                </span>
                            )}
                        </div>
                    )}

                    <button
                        onClick={() => handlePagarGasto(gasto.id)}
                        disabled={gasto.estado.toLowerCase().trim() === 'gastado'}
                    >
                        {gasto.estado.toLowerCase().trim() === 'gastado'
                            ? 'Pagado'
                            : 'Marcar como pagado'}
                    </button>

                    <hr />

                </div>

            ))}

        </div>

    );

}

export default Pagos;
