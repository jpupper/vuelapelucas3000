// Rutas de la API
const express = require('express');
const router = express.Router();
const Inscripcion = require('../models/inscripcion');

// Roles validos de inscripcion
const ROLES_VALIDOS = [
  'espectador',
  'feriante',
  'artista_escenario',
  'vj',
  'instalacion_multimedia',
  'colaborador_productor'
];

// POST /api/inscripciones - Crear nueva inscripción
router.post('/inscripciones', async (req, res) => {
  try {
    const {
      nombre, apellido, email, telefono, ciudad, hospedaje,
      rol, como_colaborar, especificaciones_tecnicas
    } = req.body;

    if (!nombre || !apellido || !email) {
      return res.status(400).json({ error: 'Nombre, apellido y email son requeridos' });
    }

    const rolFinal = ROLES_VALIDOS.includes(rol) ? rol : 'espectador';
    const esEspectador = (rolFinal === 'espectador');
    // Solo los roles tecnicos cargan especificaciones tecnicas
    const ROLES_TECNICOS = ['feriante', 'artista_escenario', 'vj', 'instalacion_multimedia'];

    const inscripcion = new Inscripcion({
      nombre,
      apellido,
      email,
      telefono,
      ciudad,
      hospedaje,
      rol: rolFinal,
      como_colaborar: esEspectador ? '' : (como_colaborar || ''),
      especificaciones_tecnicas: ROLES_TECNICOS.includes(rolFinal) ? (especificaciones_tecnicas || '') : ''
    });

    await inscripcion.save();
    res.status(201).json({ 
      success: true, 
      message: '¡Inscripción exitosa! Te esperamos en Vuelapelucas 3000',
      id: inscripcion._id
    });
  } catch (error) {
    console.error('Error al guardar inscripción:', error);
    res.status(500).json({ error: 'Error al procesar la inscripción' });
  }
});

// GET /api/inscripciones - Obtener todas las inscripciones
router.get('/inscripciones', async (req, res) => {
  try {
    const { pass } = req.query;
    if (pass !== process.env.ADMIN_PASS) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    const inscripciones = await Inscripcion.find().sort({ createdAt: -1 });
    res.json({ success: true, count: inscripciones.length, inscripciones });
  } catch (error) {
    console.error('Error al obtener inscripciones:', error);
    res.status(500).json({ error: 'Error al obtener inscripciones' });
  }
});

// DELETE /api/inscripciones/:id - Eliminar inscripción
router.delete('/inscripciones/:id', async (req, res) => {
  try {
    const { pass } = req.query;
    if (pass !== process.env.ADMIN_PASS) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    await Inscripcion.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Inscripción eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar inscripción' });
  }
});

// GET /api/stats - Estadísticas
router.get('/stats', async (req, res) => {
  try {
    const { pass } = req.query;
    if (pass !== process.env.ADMIN_PASS) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    const total = await Inscripcion.countDocuments();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoy_count = await Inscripcion.countDocuments({ createdAt: { $gte: hoy } });
    
    res.json({ success: true, total, hoy: hoy_count });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;
