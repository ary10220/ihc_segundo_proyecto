import { NavLink, useNavigate } from 'react-router-dom';
import { limpiarToken } from '../utils/auth';

function Navbar() {
    const navigate = useNavigate();

    const handleLogout = () => {
        limpiarToken();
        navigate('/login');
    };

    const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

    return (
        <header className="topbar">
            <NavLink to="/dashboard" className="brand" end>
                <span className="brand-logo" aria-hidden="true">FA</span>
                <strong>FinanzApp</strong>
            </NavLink>

            <div className="topbar-actions">
                <button type="button" className="btn-secondary btn-small" onClick={handleLogout}>
                    Cerrar sesión
                </button>
            </div>

            <nav className="mainnav" aria-label="Secciones">
                <NavLink to="/dashboard" className={linkClass}>
                    Dashboard
                </NavLink>
                <NavLink to="/gastos" className={linkClass}>
                    Gastos
                </NavLink>
                <NavLink to="/pagos" className={linkClass}>
                    Pagos
                </NavLink>
                <NavLink to="/historial" className={linkClass}>
                    Historial
                </NavLink>
                <NavLink to="/metas" className={linkClass}>
                    Metas
                </NavLink>
            </nav>
        </header>
    );
}

export default Navbar;
