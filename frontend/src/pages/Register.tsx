import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { guardarToken } from '../utils/auth';
import AuthLayout from '../components/AuthLayout';
import { Link } from 'react-router-dom';

function Register() {

    const [name, setName] = useState('');

    const [email, setEmail] = useState('');

    const [password, setPassword] = useState('');

    const navigate = useNavigate();

    const handleRegister = async () => {

        try {

            const response = await fetch('http://localhost:4000/api/auth/register', {

                method: 'POST',

                headers: {

                    'Content-Type': 'application/json'

                },

                body: JSON.stringify({

                    name,

                    email,

                    password

                })

            });

            const data = await response.json();

            if (response.ok) {

                console.log('Usuario registrado correctamente');

                console.log('Token:', data.token);

                // Clase 22 - al registrarse el token va solo a sessionStorage (no persiste).
                guardarToken(data.token, false);

                navigate('/dashboard');

            } else {

                console.log(data.error);

            }

        } catch (error) {

            console.error('Error al conectar con el servidor:', error);

        }

    };

    return (

        <AuthLayout>

            <p className="eyebrow">Nueva cuenta</p>
            <h1>Crear cuenta</h1>

            <label htmlFor="reg-nombre">Nombre</label>
            <input
                id="reg-nombre"
                type="text"
                placeholder="Nombre"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />

            <label htmlFor="reg-correo">Correo</label>
            <input
                id="reg-correo"
                type="email"
                placeholder="Correo"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="reg-password">Contraseña</label>
            <input
                id="reg-password"
                type="password"
                placeholder="Contraseña"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            <button onClick={handleRegister}>

                Registrarse

            </button>

            <div className="auth-links">
                <span className="muted">¿Ya tienes cuenta?</span>
                <Link to="/login">Iniciar sesión</Link>
            </div>

        </AuthLayout>

    );

}

export default Register;
