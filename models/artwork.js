// Modelo de las creaciones de la comunidad hechas con PANCHODRAW.
// La imagen se guarda en la base (Buffer PNG) y se sirve por
// GET {BASE_PATH}/api/artworks/:id/img -> nunca se expone el base64 en los listados.
const mongoose = require('mongoose');

const artworkSchema = new mongoose.Schema({
    // Datos que carga el usuario en el dialogo de publicacion
    nombre: { type: String, required: true, trim: true, maxlength: 80 },
    autor:  { type: String, required: true, trim: true, maxlength: 60 },

    // Identidad FSCAUTH (OPCIONAL): solo se completa si el dibujo se publico
    // con sesion del ecosistema. Las creaciones de la comunidad se muestran
    // igual en la pagina; esto solo las ata al perfil universal.
    userId:   { type: String, default: '', index: true },
    username: { type: String, default: '', index: true },

    // La imagen en si (PNG con escalado vecino mas cercano desde el canvas de 256x256)
    png:    { type: Buffer, required: true },
    bytes:  { type: Number, default: 0 },
    escala: { type: Number, default: 2 },   // 1x=256, 2x=512, 4x=1024
    w:      { type: Number, default: 512 },
    h:      { type: Number, default: 512 },

    createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

artworkSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Artwork', artworkSchema);
