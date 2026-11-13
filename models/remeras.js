// Vuelapelucas 3000 - REMERAS: catalogo + compras + ajustes
// ---------------------------------------------------------
// Una remera = nombre + precio + foto (Buffer en Mongo, igual que los
// premios de la rifa: no hay carpeta de imagenes que se pueda perder).
// Una compra = el formulario que llena la persona + el comprobante de pago
// (opcional) tambien como Buffer.
const mongoose = require('mongoose');

const remeraSchema = new mongoose.Schema({
  nombre: { type: String, required: true },        // "REMERA X FASOLITO"
  descripcion: { type: String, default: '' },      // detalle corto (opcional)
  precio: { type: Number, default: 50000 },
  orden: { type: Number, default: 0 },             // menor = primero
  activa: { type: Boolean, default: true },        // las inactivas no se muestran
  imagen: { type: Buffer, default: null },
  imagenMime: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
remeraSchema.index({ activa: 1, orden: 1 });

const compraSchema = new mongoose.Schema({
  remera: { type: mongoose.Schema.Types.ObjectId, ref: 'Remera', default: null },
  remeraNombre: { type: String, default: '' },     // copia del nombre al momento de comprar
  talle: { type: String, default: '' },
  sucursal: { type: String, default: '' },         // sucursal de Correo Argentino
  nombreApellido: { type: String, default: '' },
  email: { type: String, default: '' },
  telefono: { type: String, default: '' },
  nota: { type: String, default: '' },
  precio: { type: Number, default: 50000 },
  comprobante: { type: Buffer, default: null },    // OPCIONAL
  comprobanteMime: { type: String, default: '' },
  estado: { type: String, default: 'pendiente' },  // pendiente | pagado | enviado | entregado | cancelado
  createdAt: { type: Date, default: Date.now }
});
compraSchema.index({ createdAt: -1 });

// Ajustes del modulo: un unico documento (clave fija)
const configSchema = new mongoose.Schema({
  clave: { type: String, unique: true, default: 'remeras' },
  precio: { type: Number, default: 50000 },
  whatsapp: { type: String, default: '2954541104' },  // destino de los pedidos
  alias: { type: String, default: '' },               // alias / CBU para transferir
  instrucciones: { type: String, default: '' },       // texto libre abajo del formulario
  abierta: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = {
  Remera: mongoose.model('Remera', remeraSchema),
  Compra: mongoose.model('RemeraCompra', compraSchema),
  Config: mongoose.model('RemeraConfig', configSchema)
};
