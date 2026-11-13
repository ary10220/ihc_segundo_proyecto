import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../utils/analitica';
import { guardarToken } from '../utils/auth';
import AuthLayout from '../components/AuthLayout';
import { Link } from 'react-router-dom';

function Login() {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mensajeError, setMensajeError] = useState('');
    // Clase 22 - Patron oscuro corregido (Privacidad por defecto):
    // desmarcado por defecto para que el token no persista salvo decision explicita.
    const [mantenerSesion, setMantenerSesion] = useState(false);

    const navigate = useNavigate();

    const handleLogin = async () => {
        setMensajeError('');

        // Tarea 9 - Analitica: nunca se guarda el correo, solo el paso del flujo.
        track('login_iniciado');

        if (!email.trim() || !password) {
            track('login_rechazado', { motivo: 'campos_vacios' });
            setMensajeError('Por favor ingresa tu correo y contraseña.');
            return;
        }

        try {

            const response = await fetch('http://localhost:4000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const data = await response.json();

            if (response.ok) {

                guardarToken(data.token, mantenerSesion);
                track('login_exitoso');

                console.log('Token guardado correctamente');

                navigate('/dashboard');

            } else {

                track('login_rechazado', { motivo: 'credenciales' });
                setMensajeError(data.error || 'Credenciales incorrectas. Verifica tus datos.');

            }

        } catch (error) {

            track('login_rechazado', { motivo: 'error_servidor' });
            console.error('Error al conectar con el servidor:', error);
            setMensajeError('No se pudo conectar con el servidor. Intenta nuevamente.');

        }

    };

    return (
        <AuthLayout>

            <p className="eyebrow">Acceso</p>
            <h1>Iniciar sesión</h1>

            <label htmlFor="login-correo">Correo</label>
            <input
                id="login-correo"
                type="email"
                placeholder="Correo"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="login-password">Contraseña</label>
            <input
                id="login-password"
                type="password"
                placeholder="Contraseña"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            {/* Clase 22 - Privacidad por defecto: viene DESMARCADO y con el alcance explicado. */}
            <label className="check">
                <input
                    type="checkbox"
                    checked={mantenerSesion}
                    onChange={(e) => setMantenerSesion(e.target.checked)}
                />
                {' '}Mantener sesión iniciada (solo si usás tu propio dispositivo)
            </label>

            <button onClick={handleLogin}>
                Iniciar sesión
            </button>

            {mensajeError && (
                <p role="alert" className="msg-err">
                    {mensajeError}
                </p>
            )}

            <div className="auth-links">
                <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
                <Link to="/register">Crear cuenta</Link>
            </div>

        </AuthLayout>
    );

}

export default Login;
