const app = require('./src/app');
const sequelize = require('./src/config/database');
const User = require('./src/models/User');
const Gasto = require('./src/models/Gasto');
const Presupuesto = require('./src/models/Presupuesto');
const PresupuestoCategoria = require('./src/models/PresupuestoCategoria');

const PORT = 4000;

const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('PostgreSQL conectado correctamente');

        await sequelize.sync({ alter: true });
        console.log('Modelos sincronizados correctamente');

        app.listen(PORT, () => {
            console.log(`Servidor ejecutandose en http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Error al iniciar el servidor:', error);
    }
};

startServer();