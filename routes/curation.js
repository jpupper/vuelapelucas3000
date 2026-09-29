// ============================================================
// CURADURIA DEL SITIO (panel de admin) + imagenes subidas
// ------------------------------------------------------------
// La galeria y los flyers siguen viviendo como archivos estaticos
// (img/galeria/manifest.json y img/flyers/manifest.json). Lo que se
// maneja desde el panel es la CURADURIA:
//   GET    {BASE}/api/curation/:key            -> publico (ocultos, years, subidas)
//   POST   {BASE}/api/curation/:key?pass=      -> admin: reemplaza ocultos/years
//   POST   {BASE}/api/media?pass=              -> admin: sube una foto/flyer
//   GET    {BASE}/api/media/:id/img            -> la imagen (con ?dl=1 baja)
//   DELETE {BASE}/api/media/:id?pass=          -> admin: borra una subida
// ============================================================
const express = require('express');
const router = express.Router();
const { Curation, Media } = require('../models/curation');

const CLAVES = ['galeria', 'flyers'];
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

const admin = (req) => req.query.pass && req.query.pass === process.env.ADMIN_PASS;

function nombreArchivo(m, ext) {
    const crudo = (String(m.nombre || 'vuelapelucas3000') + (m.autor ? ' - ' + m.autor : ''))
        .replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'vuelapelucas3000';
    const ascii = crudo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '') || 'vuelapelucas3000';
    return 'attachment; filename="' + ascii + '.' + ext + '"; filename*=UTF-8\'\'' + encodeURIComponent(crudo + '.' + ext);
}

const extDe = (mime) => (mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : mime === 'image/webp' ? 'webp' : 'jpg');

// ---------- GET publico: la curaduria de una seccion ----------
router.get('/curation/:key', async (req, res) => {
    const key = String(req.params.key || '');
    if (CLAVES.indexOf(key) < 0) return res.status(400).json({ ok: false, error: 'seccion invalida' });
    try {
        const doc = await Curation.findOne({ key }).lean();
        const subidas = await Media.find({ tipo: key }, { data: 0 }).sort({ createdAt: 1 }).lean();
        res.json({
            ok: true,
            key,
            ocultos: (doc && doc.ocultos) || [],
            years: (doc && doc.years) || {},
            extra: subidas.map((m) => ({
                id: String(m._id),
                nombre: m.nombre || '',
                autor: m.autor || '',
                year: m.year || '',
                src: '/api/media/' + String(m._id) + '/img',
                tipo: m.tipo
            }))
        });
    } catch (err) {
        console.error('[CURATION] error:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo leer la curaduria' });
    }
});

// ---------- POST admin: guardar ocultos / years ----------
router.post('/curation/:key', async (req, res) => {
    const key = String(req.params.key || '');
    if (CLAVES.indexOf(key) < 0) return res.status(400).json({ ok: false, error: 'seccion invalida' });
    if (!admin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });

    try {
        const set = { updatedAt: new Date() };
        if (Array.isArray(req.body && req.body.ocultos)) {
            set.ocultos = req.body.ocultos.map((v) => String(v)).slice(0, 5000);
        }
        if (req.body && req.body.years && typeof req.body.years === 'object') {
            const y = {};
            Object.keys(req.body.years).slice(0, 5000).forEach((k) => {
                y[String(k)] = String(req.body.years[k]).slice(0, 10);
            });
            set.years = y;
        }
        await Curation.updateOne({ key }, { $set: set }, { upsert: true });
        res.json({ ok: true });
    } catch (err) {
        console.error('[CURATION] save error:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo guardar' });
    }
});

// ---------- POST admin: subir una imagen ----------
router.post('/media', async (req, res) => {
    if (!admin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        const tipo = String((req.body && req.body.tipo) || '');
        if (CLAVES.indexOf(tipo) < 0) return res.status(400).json({ ok: false, error: 'tipo invalido' });

        const image = String((req.body && req.body.image) || '');
        const m = /^data:(image\/(png|jpeg|jpg|gif|webp));base64,/.exec(image);
        if (!m) return res.status(400).json({ ok: false, error: 'Subí una imagen válida (PNG, JPG, GIF o WEBP)' });

        const data = Buffer.from(image.split(',')[1], 'base64');
        if (!data.length) return res.status(400).json({ ok: false, error: 'La imagen vino vacía' });
        if (data.length > MAX_MEDIA_BYTES) return res.status(413).json({ ok: false, error: 'La imagen supera los 8 MB' });

        const doc = await Media.create({
            tipo,
            nombre: String((req.body && req.body.nombre) || '').slice(0, 120),
            autor: String((req.body && req.body.autor) || '').slice(0, 80),
            year: String((req.body && req.body.year) || '').slice(0, 10),
            mime: m[1] === 'image/jpg' ? 'image/jpeg' : m[1],
            bytes: data.length,
            data
        });

        res.status(201).json({ ok: true, id: String(doc._id), src: '/api/media/' + String(doc._id) + '/img' });
    } catch (err) {
        console.error('[MEDIA] upload error:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo subir la imagen' });
    }
});

// ---------- GET publico: la imagen subida ----------
router.get('/media/:id/img', async (req, res) => {
    try {
        const m = await Media.findById(req.params.id, { data: 1, mime: 1, nombre: 1, autor: 1 }).lean();
        if (!m || !m.data) return res.status(404).end();
        res.setHeader('Content-Type', m.mime || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        if (req.query.dl) res.setHeader('Content-Disposition', nombreArchivo(m, extDe(m.mime)));
        res.send(m.data.buffer || m.data);
    } catch (err) {
        res.status(404).end();
    }
});

// ---------- PATCH admin: editar una subida (año / nombre / autor) ----------
router.patch('/media/:id', async (req, res) => {
    if (!admin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        const set = {};
        const b = req.body || {};
        if (b.year != null) set.year = String(b.year).slice(0, 10);
        if (b.nombre != null) set.nombre = String(b.nombre).slice(0, 120);
        if (b.autor != null) set.autor = String(b.autor).slice(0, 80);
        if (!Object.keys(set).length) return res.status(400).json({ ok: false, error: 'nada para actualizar' });
        await Media.updateOne({ _id: req.params.id }, { $set: set });
        res.json({ ok: true });
    } catch (err) {
        console.error('[MEDIA] patch error:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo actualizar' });
    }
});

// ---------- DELETE admin: borrar una subida ----------
router.delete('/media/:id', async (req, res) => {
    if (!admin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        await Media.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudo borrar' });
    }
});

module.exports = router;
