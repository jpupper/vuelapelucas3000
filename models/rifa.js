// Vuelapelucas 3000 - Rifa: números / cartones + premios + ajustes
const mongoose = require('mongoose');

// Un número de la rifa. Los comprados tienen comprador; los libres no existen
// como documento (se derivan del total configurado) salvo que haya reservas.
const numeroSchema = new mongoose.Schema({
  rifa: { type: String, default: 'vuelapelucas', index: true },
  numero: { type: Number, required: true },
  comprador: { type: String, default: '' },      // nombre de quien lo compra
  username: { type: String, default: '' },       // cuenta JPCONNECT (si compró logueado)
  telefono: { type: String, default: '' },
  email: { type: String, default: '' },
  nota: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
numeroSchema.index({ rifa: 1, numero: 1 }, { unique: true });

// Premios ofrecidos por la comunidad para sortear el último día del festival.
const premioSchema = new mongoose.Schema({
  rifa: { type: String, default: 'vuelapelucas', index: true },
  titulo: { type: String, required: true },
  descripcion: { type: String, default: '' },
  ofrecidoPor: { type: String, default: '' },    // nombre visible que escribe la persona
  username: { type: String, default: '' },       // cuenta JPCONNECT (identidad real)
  contacto: { type: String, default: '' },
  // imagen subida como data URL (se sirve desde /api/rifa/premios/:id/img)
  imagen: { type: Buffer, default: null },
  imagenMime: { type: String, default: '' },
  estado: { type: String, default: 'pendiente' }, // pendiente | aprobado | descartado
  // Si se le asigna un número ganador, queda con el resultado del sorteo
  numeroGanador: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Ajustes de la rifa: un único documento por rifa
const ajusteSchema = new mongoose.Schema({
  rifa: { type: String, default: 'vuelapelucas', unique: true },
  total: { type: Number, default: 100 },         // números a manejar (1..total)
  precio: { type: String, default: '' },         // texto libre: "$5.000" / "1 colaboración"
  info: { type: String, default: '' },           // aclaraciones para la galería pública
  cierre: { type: String, default: '' },         // fecha/hora del sorteo (texto)
  mpLink: { type: String, default: '' },         // link de pago (MercadoPago, alias, etc.)
  abierta: { type: Boolean, default: true },     // permite anotarse/comprar
  updatedAt: { type: Date, default: Date.now }
});

module.exports = {
  Numero: mongoose.model('RifaNumero', numeroSchema),
  Premio: mongoose.model('RifaPremio', premioSchema),
  Ajuste: mongoose.model('RifaAjuste', ajusteSchema)
};
