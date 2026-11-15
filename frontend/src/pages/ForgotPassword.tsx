import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function ForgotPassword() {

    const [email, setEmail] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [recoveryStarted, setRecoveryStarted] = useState(false);

    const handleForgotPassword = async () => {

        try {

            const response = await fetch(API_URL + '/api/auth/forgot-password', {

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

            const response = await fetch(API_URL + '/api/auth/reset-password', {

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

        <div>

            <h1>Recuperar contraseña</h1>

            {!recoveryStarted && (

                <div>

                    <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '12px' }}>
                        Ingresa el correo electrónico registrado en tu cuenta para iniciar el proceso de recuperación.
                    </p>

                    <input

                        type="email"

                        placeholder="Correo"

                        value={email}

                        onChange={(e) => setEmail(e.target.value)}

                    />

                    <button onClick={handleForgotPassword}>

                        Continuar

                    </button>

                </div>

            )}

            {recoveryStarted && (

                <div>

                    <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '6px' }}>
                        Crea una nueva contraseña segura para tu cuenta.
                    </p>

                    <p style={{ fontSize: '0.8em', color: '#444', backgroundColor: '#f0f4f8', padding: '6px 10px', borderRadius: '4px', marginBottom: '12px', display: 'inline-block' }}>
                        ℹ <strong>Requisito:</strong> Mínimo 6 caracteres alfanuméricos.
                    </p>

                    <br />

                    <input

                        type="password"

                        placeholder="Nueva contraseña"

                        value={newPassword}

                        onChange={(e) => setNewPassword(e.target.value)}

                    />

                    <button onClick={handleResetPassword}>

                        Cambiar contraseña

                    </button>

                </div>

            )}

            <p style={{ fontSize: '0.8em', color: '#888', marginTop: '20px' }}>
                ¿Tienes problemas para acceder? Contacta a soporte@finanzapp.com
            </p>

        </div>

    );

}

export default ForgotPassword;
