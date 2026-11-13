import { Link } from 'react-router-dom';

function Home() {

    return (
        <div className="public">

            <header className="public-top">
                <Link to="/" className="brand">
                    <span className="brand-logo" aria-hidden="true">FA</span>
                    FinanzApp
                </Link>
            </header>

            <main className="hero">

                <p className="eyebrow">Ruta pública</p>

                <h1>Bienvenido a Presupuesto Estudiantil</h1>

                <p className="lead">Esta es una ruta pública.</p>

                <div className="actions">
                    <Link to="/login" className="btn btn-secondary btn-lg">
                        Iniciar sesión
                    </Link>

                    <Link to="/register" className="btn btn-lg">
                        Registrarse
                    </Link>
                </div>

                <div className="flow" aria-hidden="true">
                    <span className="pill">Registrar</span><span>→</span>
                    <span className="pill on">Presupuestar</span><span>→</span>
                    <span className="pill">Pagar</span><span>→</span>
                    <span className="pill">Ahorrar</span>
                </div>

                <div className="dark-card">
                    <p className="eyebrow">FinanzApp</p>
                    <p>Organiza movimientos, controla tu presupuesto mensual y ahorra para tus metas.</p>
                </div>

            </main>

        </div>
    );

}

export default Home;
