// ============================================================
// CREACIONES DE LA COMUNIDAD (PANCHODRAW) + indice FSCAUTH
// ------------------------------------------------------------
// POST   {BASE_PATH}/api/artworks            -> publicar un dibujo (nombre + autor)
// GET    {BASE_PATH}/api/artworks            -> listado publico para la pagina
// GET    {BASE_PATH}/api/artworks/:id/img    -> el PNG
// DELETE {BASE_PATH}/api/artworks/:id?pass=  -> borrar (admin)
// GET    {BASE_PATH}/api/fsc/assets          -> indice para el pasaporte universal
//                                              (arquitectura BICOMPARTIDA: las
//                                               creaciones viven en ESTA base)
// ============================================================
const express = require('express');
const router = express.Router();
const Artwork = require('../models/artwork');

const PUBLIC_BASE = process.env.FSC_PUBLIC_ORIGIN || 'https://fullscreencode.com';
const PUBLIC_APP = PUBLIC_BASE + '/vuelapelucas3000/';
// fscauth del VPS: verificacion server->server (nunca links para humanos aca)
const FSCAUTH_URL = process.env.FSCAUTH_URL || 'https://vps-4455523-x.dattaweb.com/fscauth';

const MAX_BYTES = 2.6 * 1024 * 1024;   // ~2.6 MB por PNG (512/1024 px de pixel art)
const MAX_LIST = 200;

// ---------- helpers ----------
const limpio = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

// Sesion FSCAUTH: cookie del ecosistema (cross-site) o Bearer.
// Devuelve {username, userId, role} o null. NUNCA confia en lo que manda el cliente.
async function fscSession(req) {
    const token = (() => {
        const cookie = String(req.headers.cookie || '');
        const m = cookie.match(/(?:^|;\s*)fsc_token=([^;]+)/);
        if (m) return decodeURIComponent(m[1]);
        return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    })();
    if (!token) return null;
    try {
        const r = await fetch(FSCAUTH_URL + '/api/auth/verify', { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (d && d.loggedIn === true && d.user) {
            return {
                username: String(d.user.username || ''),
                userId: String(d.user.id || ''),
                role: d.user.role || ''
            };
        }
    } catch (err) {
        console.error('[ARTWORKS] no se pudo verificar la sesion FSC:', err.message);
    }
    return null;
}

// Autorizacion del indice FSC: clave interna compartida o sesion valida del usuario.
async function fscIndexAuthorized(req, username) {
    const internal = process.env.FSC_INTERNAL_KEY || process.env.JWT_SECRET || '';
    const key = req.headers['x-fsc-internal'];
    if (internal && key && key === internal) return true;
    const s = await fscSession(req);
    if (!s) return false;
    if (String(s.username).toLowerCase() === String(username || '').toLowerCase()) return true;
    return s.role === 'ADMIN' || s.role === 'SYSTEM';
}

// Anti-spam simple en memoria: N publicaciones por IP cada 10 minutos.
const RATE = { max: 8, windowMs: 10 * 60 * 1000 };
const rateHits = new Map();
function rateOk(ip) {
    const now = Date.now();
    const hits = (rateHits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
    if (hits.length >= RATE.max) return false;
    hits.push(now);
    rateHits.set(ip, hits);
    if (rateHits.size > 5000) rateHits.clear();
    return true;
}

const pub = (a) => ({
    id: String(a._id),
    nombre: a.nombre,
    autor: a.autor,
    username: a.username || '',
    url: PUBLIC_APP + 'panchodraw/',                       // la app que lo creo
    img: '/api/artworks/' + String(a._id) + '/img',        // relativo: el front le pone el host
    w: a.w, h: a.h, escala: a.escala,
    createdAt: a.createdAt
});

// ---------- POST: publicar ----------
router.post('/artworks', async (req, res) => {
    try {
        const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'anon';
        if (!rateOk(ip)) {
            return res.status(429).json({ error: 'Demasiadas publicaciones seguidas. Esperá unos minutos.' });
        }

        const nombre = limpio(req.body && req.body.nombre, 80);
        const autor = limpio(req.body && req.body.autor, 60);
        const image = String((req.body && req.body.image) || '');
        const escala = [1, 2, 4].indexOf(Number(req.body && req.body.escala)) >= 0 ? Number(req.body.escala) : 2;

        if (!nombre) return res.status(400).json({ error: 'Ponele un nombre al dibujo' });
        if (!autor) return res.status(400).json({ error: 'Ponele un autor al dibujo' });
        if (!/^data:image\/png;base64,/.test(image)) {
            return res.status(400).json({ error: 'La imagen tiene que ser un PNG generado por PanchoDraw' });
        }

        let png;
        try {
            png = Buffer.from(image.split(',')[1], 'base64');
        } catch (e) {
            return res.status(400).json({ error: 'No se pudo leer la imagen' });
        }
        if (!png.length) return res.status(400).json({ error: 'La imagen vino vacía' });
        if (png.length > MAX_BYTES) {
            return res.status(413).json({ error: 'La imagen es muy grande. Probá con 1x o 2x.' });
        }

        // Si hay sesion FSCAUTH, la creacion queda atada al perfil universal.
        const sesion = await fscSession(req);
        const dim = 256 * escala;

        const doc = await Artwork.create({
            nombre, autor,
            username: sesion ? sesion.username : '',
            userId: sesion ? sesion.userId : '',
            png, bytes: png.length, escala, w: dim, h: dim
        });

        res.status(201).json({
            success: true,
            id: String(doc._id),
            nombre: doc.nombre,
            autor: doc.autor,
            fscauth: sesion ? sesion.username : null,
            img: '/api/artworks/' + String(doc._id) + '/img'
        });
    } catch (error) {
        console.error('Error al publicar dibujo:', error);
        res.status(500).json({ error: 'Error al publicar el dibujo' });
    }
});

// ---------- GET: listado publico ----------
router.get('/artworks', async (req, res) => {
    try {
        const docs = await Artwork.find({}, { png: 0 })
            .sort({ createdAt: -1 })
            .limit(MAX_LIST)
            .lean();
        res.json({ success: true, count: docs.length, artworks: docs.map(pub) });
    } catch (error) {
        console.error('Error al listar dibujos:', error);
        res.status(500).json({ error: 'Error al listar las creaciones' });
    }
});

// ---------- GET: el PNG ----------
router.get('/artworks/:id/img', async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(String(req.params.id))) return res.status(400).end();
        const doc = await Artwork.findById(req.params.id, { png: 1 }).lean();
        if (!doc || !doc.png) return res.status(404).end();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(doc.png.buffer || doc.png);
    } catch (error) {
        res.status(404).end();
    }
});

// ---------- DELETE (admin) ----------
router.delete('/artworks/:id', async (req, res) => {
    try {
        if (req.query.pass !== process.env.ADMIN_PASS) {
            return res.status(401).json({ error: 'No autorizado' });
        }
        await Artwork.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Creación eliminada' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la creación' });
    }
});

// ---------- GET: indice para el pasaporte universal (fscauth) ----------
router.get('/fsc/assets', async (req, res) => {
    const username = String(req.query.username || '').trim();
    const userId = String(req.query.userId || '').trim();
    if (!username && !userId) return res.status(400).json({ ok: false, error: 'falta username/userId' });

    if (!(await fscIndexAuthorized(req, username))) {
        return res.status(401).json({ ok: false, error: 'No autorizado' });
    }

    try {
        const filtro = userId ? { userId } : { username: new RegExp('^' + username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
        const docs = await Artwork.find(filtro, { png: 0 }).sort({ createdAt: -1 }).limit(300).lean();

        const items = docs.map((a) => ({
            id: String(a._id),
            title: a.nombre,
            url: PUBLIC_APP + 'panchodraw/?dibujo=' + String(a._id),
            meta: { descripcion: 'PanchoDraw · @' + (a.username || a.autor) }
        }));

        const groups = items.length
            ? [{ type: 'panchodraw', label: 'Dibujos de PanchoDraw', count: items.length, items }]
            : [];

        res.json({
            ok: true,
            app: 'vuelapelucas3000',
            username: username || null,
            total: items.length,
            groups
        });
    } catch (err) {
        console.error('[FSC-ASSETS] error:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo indexar' });
    }
});

module.exports = router;
