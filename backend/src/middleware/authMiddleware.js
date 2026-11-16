const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        try {
            // Tarea 10: si la cuenta fue eliminada, su token deja de servir.
            const existe = await User.findByPk(user.id, { attributes: ['id'] });
            if (!existe) return res.status(401).json({ error: 'La cuenta ya no existe' });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ error: 'Error al validar la sesión' });
        }
        req.user = user;
        next();
    });
}

const authorizeRole = (role) => {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole };
