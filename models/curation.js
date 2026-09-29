// Curaduria del sitio (se maneja desde el panel de admin):
//   - key 'galeria' / 'flyers': que se oculta y que año tiene cada foto
//   - key 'media':            las imagenes SUBIDAS desde el panel
// El contenido base sigue siendo los manifest estaticos (img/galeria,
// img/flyers): aca viven solo los ajustes, por eso un doc chico por seccion.
const mongoose = require('mongoose');

const curationSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },   // 'galeria' | 'flyers'
    ocultos: { type: [String], default: [] },              // rutas relativas que NO se muestran
    years: { type: Object, default: {} },                  // { 'img/galeria/x.jpg': '2023' }
    updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

const mediaSchema = new mongoose.Schema({
    tipo: { type: String, required: true },   // 'galeria' | 'flyer'
    nombre: { type: String, default: '' },
    autor: { type: String, default: '' },
    year: { type: String, default: '' },      // solo para galeria
    mime: { type: String, default: 'image/jpeg' },
    bytes: { type: Number, default: 0 },
    data: { type: Buffer, required: true },
    createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

mediaSchema.index({ tipo: 1, createdAt: -1 });

module.exports = {
    Curation: mongoose.model('Curation', curationSchema),
    Media: mongoose.model('Media', mediaSchema)
};
