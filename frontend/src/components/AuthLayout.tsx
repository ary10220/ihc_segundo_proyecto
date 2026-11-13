import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/* Marco visual compartido por Login, Registro y Recuperar contraseña. */
function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="auth">
            <aside className="auth-side">
                <Link to="/" className="brand">
                    <span className="brand-logo" aria-hidden="true">FA</span>
                    FinanzApp
                </Link>
                <div>
                    <p className="eyebrow">Presupuesto Estudiantil</p>
                    <h2>Controla tu dinero sin calcular de memoria.</h2>
                </div>
                <small>Movimientos · Presupuesto · Pagos · Metas</small>
            </aside>
            <main className="auth-main">
                <div className="auth-card">{children}</div>
            </main>
        </div>
    );
}

export default AuthLayout;
