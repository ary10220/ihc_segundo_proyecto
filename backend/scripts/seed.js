// Semilla idempotente para las pruebas E2E.
//
// Uso:
//   pnpm run seed          (desde la raíz del repo)
//   npm run seed           (desde backend/)
//
// Se puede ejecutar las veces que haga falta: no duplica usuarios ni
// presupuestos, y deja el límite mensual siempre por encima de lo gastado.

const path = require('path');

// Carga backend/.env sin importar desde qué carpeta se ejecute el script.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcrypt');
const sequelize = require('../src/config/database');
const User = require('../src/models/User');
const Presupuesto = require('../src/models/Presupuesto');
const PresupuestoCategoria = require('../src/models/PresupuestoCategoria');
const Gasto = require('../src/models/Gasto');

const USUARIO = {
    name: 'Usuario E2E',
    email: 'e2e@presupuesto.test',
    password: 'E2e12345'
};

const LIMITE_MENSUAL = 100000;
const LIMITE_CATEGORIA_COMIDA = 10000;

async function main() {
    await sequelize.authenticate();

    const hash = await bcrypt.hash(USUARIO.password, 10);

    // Usuario de prueba: se crea una vez y luego solo se actualiza.
    let user = await User.findOne({ where: { email: USUARIO.email } });

    if (user) {
        user.name = USUARIO.name;
        user.password = hash;
        user.role = 'user';
        await user.save();
    } else {
        user = await User.create({
            name: USUARIO.name,
            email: USUARIO.email,
            password: hash,
            role: 'user'
        });
    }

    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const anio = ahora.getFullYear();

    const gastos = await Gasto.findAll({
        where: { userId: user.id },
        attributes: ['monto']
    });

    const gastado = gastos.reduce(
        (total, gasto) => total + Number(gasto.monto),
        0
    );

    // Si el usuario ya gastó mucho, el límite sube igual: el flujo E2E
    // nunca debe fallar por "presupuesto insuficiente".
    const limite = Math.max(LIMITE_MENSUAL, Math.ceil(gastado) + LIMITE_MENSUAL);

    const presupuesto = await Presupuesto.findOne({
        where: { userId: user.id, mes, anio }
    });

    if (presupuesto) {
        presupuesto.limite = limite;
        await presupuesto.save();
    } else {
        await Presupuesto.create({ userId: user.id, limite, mes, anio });
    }

    // Presupuesto por categoría: deja el Dashboard con datos reales.
    const categoria = await PresupuestoCategoria.findOne({
        where: { userId: user.id, categoria: 'comida', mes, anio }
    });

    if (categoria) {
        categoria.limite = LIMITE_CATEGORIA_COMIDA;
        await categoria.save();
    } else {
        await PresupuestoCategoria.create({
            userId: user.id,
            categoria: 'comida',
            limite: LIMITE_CATEGORIA_COMIDA,
            mes,
            anio
        });
    }

    console.log('Semilla lista');
    console.log(`  usuario:       ${USUARIO.email} / ${USUARIO.password}`);
    console.log(`  período:       ${mes}/${anio}`);
    console.log(`  límite mensual: Bs ${limite.toFixed(2)}`);
    console.log(`  movimientos:   ${gastos.length}`);
}

main()
    .then(async () => {
        await sequelize.close();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('Error en la semilla:', error.message);
        await sequelize.close();
        process.exit(1);
    });
