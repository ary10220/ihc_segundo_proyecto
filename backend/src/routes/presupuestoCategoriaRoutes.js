const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const {
    establecerPresupuestoCategoria,
    obtenerPresupuestoCategoria
} = require('../controllers/presupuestoCategoriaController');

const router = express.Router();

router.post('/establecer', authenticateToken, establecerPresupuestoCategoria);
router.get('/obtener', authenticateToken, obtenerPresupuestoCategoria);

module.exports = router;
