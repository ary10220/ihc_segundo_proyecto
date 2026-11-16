const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { verMisDatos, exportarMisDatos, eliminarCuenta } = require('../controllers/misDatosController');

const router = express.Router();

router.get('/', authenticateToken, verMisDatos);
router.get('/exportar', authenticateToken, exportarMisDatos);
router.delete('/cuenta', authenticateToken, eliminarCuenta);

module.exports = router;
