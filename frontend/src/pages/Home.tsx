import { Link } from 'react-router-dom';

const estiloBoton = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    minHeight: '44px',
    boxSizing: 'border-box' as const,
    fontSize: '1rem',
    fontWeight: '500' as const,
    borderRadius: '6px',
    textDecoration: 'none',
    border: '1px solid #ccc',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    color: 'inherit',
    transition: 'all 0.2s ease'
};

function Home() {

    return (
        <div style={{ padding: '20px' }}>

            <h1>Bienvenido a Presupuesto Estudiantil</h1>

            <p>Esta es una ruta pública.</p>

            <div
                style={{
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginTop: '20px'
                }}
            >
                <Link to="/login" style={estiloBoton}>
                    Iniciar sesión
                </Link>

                <Link
                    to="/register"
                    style={{
                        ...estiloBoton,
                        backgroundColor: '#0066cc',
                        color: '#ffffff',
                        border: '1px solid #005bb5'
                    }}
                >
                    Registrarse
                </Link>
            </div>

        </div>
    );

}

export default Home;
