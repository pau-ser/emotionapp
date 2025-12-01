// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/registro_emocional', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB conectado'))
.catch(err => console.error('❌ Error MongoDB:', err));

// Modelos
const emocionSchema = new mongoose.Schema({
  usuario_id: {
    type: String,
    required: true,
    index: true
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
      nota: String,
      intensidad: Number
    }]
  }],
  conexiones: [{
    id: Number,
    origen: Number,
    destino: Number,
    tipo: String
  }],
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

const Emocion = mongoose.model('Emocion', emocionSchema);

// ============= RUTAS API =============

// Obtener datos de un día específico
app.get('/api/emociones/:usuarioId/:fecha', async (req, res) => {
  try {
    const { usuarioId, fecha } = req.params;
    const fechaInicio = new Date(fecha);
    const fechaFin = new Date(fecha);
    fechaFin.setDate(fechaFin.getDate() + 1);

    const emocion = await Emocion.findOne({
      usuario_id: usuarioId,
      fecha: {
        $gte: fechaInicio,
        $lt: fechaFin
      }
    });

    res.json(emocion || { burbujas: [], conexiones: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar/actualizar datos del día
app.post('/api/emociones', async (req, res) => {
  try {
    const { usuario_id, fecha, burbujas, conexiones } = req.body;
    
    const fechaBusqueda = new Date(fecha);
    const fechaInicio = new Date(fechaBusqueda.setHours(0, 0, 0, 0));
    const fechaFin = new Date(fechaBusqueda.setHours(23, 59, 59, 999));

    const emocionExistente = await Emocion.findOne({
      usuario_id,
      fecha: {
        $gte: fechaInicio,
        $lt: fechaFin
      }
    });

    if (emocionExistente) {
      // Actualizar
      emocionExistente.burbujas = burbujas;
      emocionExistente.conexiones = conexiones;
      emocionExistente.updated_at = new Date();
      await emocionExistente.save();
      res.json(emocionExistente);
    } else {
      // Crear nuevo
      const nuevaEmocion = new Emocion({
        usuario_id,
        fecha: fechaInicio,
        burbujas,
        conexiones
      });
      await nuevaEmocion.save();
      res.json(nuevaEmocion);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener historial de un usuario (últimos 30 días)
app.get('/api/emociones/historial/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const historial = await Emocion.find({
      usuario_id: usuarioId,
      fecha: { $gte: hace30Dias }
    }).sort({ fecha: -1 });

    res.json(historial);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estadísticas de un usuario
app.get('/api/estadisticas/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { dias = 7 } = req.query;
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - parseInt(dias));

    const registros = await Emocion.find({
      usuario_id: usuarioId,
      fecha: { $gte: fechaInicio }
    });

    // Calcular estadísticas
    const estadisticas = {
      total_dias_registrados: registros.length,
      emociones_mas_frecuentes: {},
      promedio_emociones_dia: 0,
      conexiones_totales: 0,
      dias_analizados: parseInt(dias)
    };

    let totalEmociones = 0;
    let totalConexiones = 0;

    registros.forEach(registro => {
      registro.burbujas.forEach(burbuja => {
        if (!estadisticas.emociones_mas_frecuentes[burbuja.nombre]) {
          estadisticas.emociones_mas_frecuentes[burbuja.nombre] = {
            count: 0,
            color: burbuja.color
          };
        }
        estadisticas.emociones_mas_frecuentes[burbuja.nombre].count += burbuja.count;
        totalEmociones += burbuja.count;
      });
      totalConexiones += registro.conexiones.length;
    });

    estadisticas.promedio_emociones_dia = registros.length > 0 
      ? (totalEmociones / registros.length).toFixed(1)
      : 0;
    estadisticas.conexiones_totales = totalConexiones;

    // Ordenar emociones por frecuencia
    const emocionesOrdenadas = Object.entries(estadisticas.emociones_mas_frecuentes)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([nombre, data]) => ({
        nombre,
        count: data.count,
        color: data.color
      }));

    estadisticas.top_5_emociones = emocionesOrdenadas;

    res.json(estadisticas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar datos completos (para análisis IA futuro)
app.get('/api/exportar/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    const todosLosDatos = await Emocion.find({
      usuario_id: usuarioId
    }).sort({ fecha: 1 });

    // Formato para análisis IA
    const datosFormateados = todosLosDatos.map(dia => ({
      fecha: dia.fecha,
      emociones: dia.burbujas.map(b => ({
        nombre: b.nombre,
        frecuencia: b.count,
        registros: b.registros.map(r => ({
          hora: r.timestamp,
          nota: r.nota,
          intensidad: r.intensidad
        }))
      })),
      conexiones: dia.conexiones,
      metadata: {
        total_emociones: dia.burbujas.reduce((sum, b) => sum + b.count, 0),
        total_conexiones: dia.conexiones.length
      }
    }));

    res.json({
      usuario_id: usuarioId,
      total_dias: datosFormateados.length,
      datos: datosFormateados
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar datos de un día específico
app.delete('/api/emociones/:usuarioId/:fecha', async (req, res) => {
  try {
    const { usuarioId, fecha } = req.params;
    const fechaInicio = new Date(fecha);
    const fechaFin = new Date(fecha);
    fechaFin.setDate(fechaFin.getDate() + 1);

    await Emocion.deleteOne({
      usuario_id: usuarioId,
      fecha: {
        $gte: fechaInicio,
        $lt: fechaFin
      }
    });

    res.json({ mensaje: 'Datos eliminados correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mongodb: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

module.exports = app;