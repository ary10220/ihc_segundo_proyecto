const app = require('./src/app');
const sequelize = require('./src/config/database');
const User = require('./src/models/User');
const Gasto = require('./src/models/Gasto');
const Presupuesto = require('./src/models/Presupuesto');
const PresupuestoCategoria = require('./src/models/PresupuestoCategoria');
const GastoRecurrente = require('./src/models/GastoRecurrente');
require('./src/models/Meta');
require('./src/models/MovimientoMeta');
const Evento = require('./src/models/Evento');
const { procesarTodasLasRecurrencias } = require('./src/services/gastoRecurrenteService');

const PORT = process.env.PORT || 4000;

const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('PostgreSQL conectado correctamente');

        await sequelize.sync({ alter: true });
        console.log('Modelos sincronizados correctamente');

        app.listen(PORT, () => {
            console.log(`Servidor ejecutandose en http://localhost:${PORT}`);
        });

        procesarTodasLasRecurrencias().catch((error) => {
            console.error('Error al procesar gastos recurrentes:', error);
        });
        const procesador = setInterval(() => {
            procesarTodasLasRecurrencias().catch((error) => {
                console.error('Error al procesar gastos recurrentes:', error);
            });
        }, 60_000);
        procesador.unref();

    } catch (error) {
        console.error('Error al iniciar el servidor:', error);
    }
};

startServer();
