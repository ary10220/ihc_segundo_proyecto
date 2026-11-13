import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { guardarToken } from '../utils/auth';

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

        <div>

            <h1>Crear cuenta</h1>

            <input

                type="text"

                placeholder="Nombre"

                value={name}

                onChange={(e) => setName(e.target.value)}

            />

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

            <button onClick={handleRegister}>

                Registrarse

            </button>

        </div>

    );

}

export default Register;