import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../utils/analitica';
import { guardarToken } from '../utils/auth';

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
            // Tarea 9 - Analitica: validacion fallida del formulario de login.
            track('error_validacion', { flujo: 'login', motivo: 'campos_obligatorios' });
            return;
        }

        // Tarea 9 - Analitica: el usuario inicia el flujo de iniciar sesion.
        track('login_iniciado', { flujo: 'login' });

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

                // Tarea 9 - Analitica: login exitoso.
                track('login_exitoso', { flujo: 'login' });

                navigate('/dashboard');

            } else {

                track('login_rechazado', { motivo: 'credenciales' });
                setMensajeError(data.error || 'Credenciales incorrectas. Verifica tus datos.');
                track('login_fallido', { flujo: 'login', motivo: 'credenciales_invalidas' });

            }

        } catch (error) {

            track('login_rechazado', { motivo: 'error_servidor' });
            console.error('Error al conectar con el servidor:', error);
            setMensajeError('No se pudo conectar con el servidor. Intenta nuevamente.');
            track('login_fallido', { flujo: 'login', motivo: 'servidor' });

        }

    };

    return (
        <div>

            <h1>Iniciar sesión</h1>

            <input
                type="email"
                placeholder="Correo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            {/* Clase 22 - Privacidad por defecto: viene DESMARCADO y con el alcance explicado. */}
            <label style={{ display: 'block', margin: '10px 0' }}>
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
                <p role="alert" style={{ color: 'crimson', fontWeight: 'bold', marginTop: '10px' }}>
                    {mensajeError}
                </p>
            )}

        </div>
    );

}

export default Login;