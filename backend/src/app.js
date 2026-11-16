const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const gastosRoutes = require('./routes/gastosRoutes');
const presupuestoRoutes = require('./routes/presupuestoRoutes');
const presupuestoCategoriaRoutes = require('./routes/presupuestoCategoriaRoutes');
const gastoRecurrenteRoutes = require('./routes/gastoRecurrenteRoutes');
const metaRoutes = require('./routes/metaRoutes');
const analiticaRoutes = require('./routes/analiticaRoutes');
const misDatosRoutes = require('./routes/misDatosRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/presupuesto', presupuestoRoutes);
app.use('/api/presupuesto-categoria', presupuestoCategoriaRoutes);
app.use('/api/gastos-recurrentes', gastoRecurrenteRoutes);
app.use('/api/metas', metaRoutes);
app.use('/api/analitica', analiticaRoutes);
app.use('/api/mis-datos', misDatosRoutes);
app.get('/', (req, res) => {
    res.json({ message: 'Bienvenido a la API de Presupuesto Estudiantil' })
});

module.exports = app;
