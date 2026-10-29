const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PresupuestoCategoria = sequelize.define('PresupuestoCategoria', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    categoria: {
        type: DataTypes.STRING,
        allowNull: false
    },
    mes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 12
        }
    },
    anio: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 2000
        }
    },
    limite: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0.01
        }
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['userId', 'categoria', 'mes', 'anio']
        }
    ]
});

module.exports = PresupuestoCategoria;
