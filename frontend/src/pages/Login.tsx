import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mensajeError, setMensajeError] = useState('');

    const navigate = useNavigate();

    const handleLogin = async () => {
        setMensajeError('');

        if (!email.trim() || !password) {
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

                localStorage.setItem('token', data.token);

                console.log('Token guardado correctamente');

                navigate('/dashboard');

            } else {

                setMensajeError(data.error || 'Credenciales incorrectas. Verifica tus datos.');

            }

        } catch (error) {

            console.error('Error al conectar con el servidor:', error);
            setMensajeError('No se pudo conectar con el servidor. Intenta nuevamente.');

        }

    };

    return (
        <div>

            <h1>Iniciar sesión</h1>

            <input
                type="email"
                aria-label="Correo"
                placeholder="Correo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <input
                type="password"
                aria-label="Contraseña"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

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