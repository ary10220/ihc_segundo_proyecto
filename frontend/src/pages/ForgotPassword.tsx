import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

function ForgotPassword() {

    const [email, setEmail] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [recoveryStarted, setRecoveryStarted] = useState(false);

    const handleForgotPassword = async () => {

        try {

            const response = await fetch('http://localhost:4000/api/auth/forgot-password', {

                method: 'POST',

                headers: {

                    'Content-Type': 'application/json'

                },

                body: JSON.stringify({

                    email

                })

            });

            const data = await response.json();

            if (response.ok) {

                setResetToken(data.resetToken);

                setRecoveryStarted(true);

            } else {

                console.log(data.error);

            }

        } catch (error) {

            console.error('Error al conectar con el servidor:', error);

        }

    };

    const handleResetPassword = async () => {

        try {

            const response = await fetch('http://localhost:4000/api/auth/reset-password', {

                method: 'POST',

                headers: {

                    'Content-Type': 'application/json'

                },

                body: JSON.stringify({

                    resetToken,

                    newPassword

                })

            });

            const data = await response.json();

            if (response.ok) {

                console.log('Contraseña actualizada correctamente');

            } else {

                console.log(data.error);

            }

        } catch (error) {

            console.error('Error al conectar con el servidor:', error);

        }

    };

    return (

        <AuthLayout>

            <p className="eyebrow">{recoveryStarted ? 'Paso 2 de 2' : 'Paso 1 de 2'}</p>
            <h1>Recuperar contraseña</h1>

            {!recoveryStarted && (

                <>

                    <p className="muted">
                        Ingresa el correo electrónico registrado en tu cuenta para iniciar el proceso de recuperación.
                    </p>

                    <label htmlFor="rec-correo">Correo</label>
                    <input
                        id="rec-correo"
                        type="email"
                        placeholder="Correo"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <button onClick={handleForgotPassword}>

                        Continuar

                    </button>

                </>

            )}

            {recoveryStarted && (

                <>

                    <p className="muted">
                        Crea una nueva contraseña segura para tu cuenta.
                    </p>

                    <div className="callout">
                        <p>ℹ <strong>Requisito:</strong> Mínimo 6 caracteres alfanuméricos.</p>
                    </div>

                    <label htmlFor="rec-password">Nueva contraseña</label>
                    <input
                        id="rec-password"
                        type="password"
                        placeholder="Nueva contraseña"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />

                    <button onClick={handleResetPassword}>

                        Cambiar contraseña

                    </button>

                </>

            )}

            <div className="auth-links">
                <Link to="/login">Volver a iniciar sesión</Link>
            </div>

            <p className="fine">
                ¿Tienes problemas para acceder? Contacta a soporte@finanzapp.com
            </p>

        </AuthLayout>

    );

}

export default ForgotPassword;
