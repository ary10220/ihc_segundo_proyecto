import { Navigate, Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { obtenerToken } from '../utils/auth';

function ProtectedRoute() {

    const token = obtenerToken();

    if (!token) {

        return <Navigate to="/login" replace />;

    }

    return (
        <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main style={{ flex: 1, width: '100%' }}>
                <Outlet />
            </main>
        </div>
    );

}

export default ProtectedRoute;