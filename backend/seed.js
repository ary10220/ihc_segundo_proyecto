// Crea (o actualiza) un usuario semilla para entrar a la app.
// Uso: pnpm seed
const bcrypt = require('bcrypt');
const sequelize = require('./src/config/database');
const User = require('./src/models/User');

const SEED_USER = {
    name: 'Usuario Demo',
    email: 'demo@ihc.com',
    password: 'Demo1234',
    role: 'admin'
};

(async () => {
    try {
        await sequelize.authenticate();
        await User.sync({ alter: true });
        const password = await bcrypt.hash(SEED_USER.password, 10);
        const [user, created] = await User.findOrCreate({
            where: { email: SEED_USER.email },
            defaults: { ...SEED_USER, password }
        });
        if (!created) await user.update({ password, name: SEED_USER.name, role: SEED_USER.role });
        console.log(`${created ? 'Creado' : 'Actualizado'}: ${SEED_USER.email} / ${SEED_USER.password}`);
    } catch (e) {
        console.error('Error en seed:', e);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
})();
