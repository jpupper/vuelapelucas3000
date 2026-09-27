// Vuelapelucas 3000 - Modelo de Inscripto
const mongoose = require('mongoose');

const inscripcionSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  email: { type: String, required: true },
  telefono: { type: String },
  ciudad: { type: String },
  hospedaje: { type: String, default: '' },
  // Rol con el que se anota: espectador | feriante | artista_escenario | vj | instalacion_multimedia | colaborador_productor
  rol: { type: String, default: 'espectador' },
  // Detalle de como quiere colaborar (solo cuando NO es espectador)
  como_colaborar: { type: String, default: '' },
  // Especificaciones tecnicas (feriante, artista de escenario, VJ, instalacion multimedia)
  especificaciones_tecnicas: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Inscripcion', inscripcionSchema);
