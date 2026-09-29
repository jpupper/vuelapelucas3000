// Modelo de las creaciones de la comunidad hechas con PANCHODRAW.
// Guarda DOS imagenes del mismo dibujo:
//   - png: la version estatica (128/256/512/1024 px, vecino mas cercano)
//   - gif: el TEMBLOR (squigglevision) en bucle, que es como se ve el dibujo
//          mientras lo estas haciendo -> la galeria lo muestra animado.
// Los bytes van en la base y se sirven por /api/artworks/:id/img y /:id/gif.
const mongoose = require('mongoose');

const artworkSchema = new mongoose.Schema({
    // Datos que carga el usuario en el dialogo de publicacion
    nombre: { type: String, required: true, trim: true, maxlength: 80 },
    autor:  { type: String, required: true, trim: true, maxlength: 60 },

    // Identidad FSCAUTH (OPCIONAL): solo se completa si el dibujo se publico
    // con sesion del ecosistema. Las creaciones se muestran igual en la pagina;
    // esto solo las ata al perfil universal.
    userId:   { type: String, default: '', index: true },
    username: { type: String, default: '', index: true },

    png:       { type: Buffer, required: true },
    bytes:     { type: Number, default: 0 },
    gif:       { type: Buffer, default: null },   // animacion del trazo (opcional)
    gifBytes:  { type: Number, default: 0 },

    escala: { type: Number, default: 2 },   // 1x=256, 2x=512, 4x=1024
    w:      { type: Number, default: 512 },
    h:      { type: Number, default: 512 },

    createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

artworkSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Artwork', artworkSchema);
