// backend/models/Emocion.js
const mongoose = require('mongoose');

const emocionSchema = new mongoose.Schema({
  usuario_id: {
    type: String,
    required: true
  },
  fecha: {
    type: Date,
    required: true,
    index: true
  },
  burbujas: [{
    id: Number,
    nombre: String,
    color: String,
    count: Number,
    x: Number,
    y: Number,
    registros: [{
      timestamp: Date,
      nota: String
    }]
  }],
  conexiones: [{
    id: Number,
    origen: Number,
    destino: Number
  }]
});

module.exports = mongoose.model('Emocion', emocionSchema);