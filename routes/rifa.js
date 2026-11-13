// ============================================================
// RIFA DEL VUELAPELUCAS 3000
// ------------------------------------------------------------
// GET    {BASE}/api/rifa                     -> estado público (total, números ocupados, premios)
// GET    {BASE}/api/rifa/premios             -> premios (público: sólo aprobados; ?pass=: todos)
// POST   {BASE}/api/rifa/premios             -> anotar un premio (JPCONNECT, o sin sesión si está abierto)
// GET    {BASE}/api/rifa/premios/:id/img     -> imagen del premio
// PUT    {BASE}/api/rifa/premios/:id?pass=   -> aprobar / descartar / asignar número ganador (admin)
// DELETE {BASE}/api/rifa/premios/:id?pass=   -> borrar premio (admin)
// GET    {BASE}/api/rifa/numeros             -> números comprados (público: sólo número)
// POST   {BASE}/api/rifa/numeros             -> comprar/reservar números (público, anti-spam)
// PUT    {BASE}/api/rifa/numeros/:numero?pass= -> editar un número (admin)
// DELETE {BASE}/api/rifa/numeros/:numero?pass= -> liberar un número (admin)
// GET    {BASE}/api/rifa/config?pass=        -> ajustes (admin)
// PUT    {BASE}/api/rifa/config?pass=        -> cambiar total / precio / cierre / abierta (admin)
//
// El premio queda atado a la cuenta JPCONNECT: el servidor la verifica contra
// fscauth con el Bearer del usuario; el cliente nunca decide quién es.
// ============================================================
const express = require('express');
const router = express.Router();
const { Numero, Premio, Ajuste } = require('../models/rifa');

const RIFA = 'vuelapelucas';
const FSCAUTH_URL = process.env.FSCAUTH_URL || 'https://vps-4455523-x.dattaweb.com/jpconnect';
const MAX_IMG = 8 * 1024 * 1024;

const limpio = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const esAdmin = (req) => {
    const pass = process.env.ADMIN_PASS || '';
    return !!pass && String(req.query.pass || req.body && req.body.pass || '') === pass;
};

// Sesión JPCONNECT (fscauth): cookie del ecosistema o Bearer. Nunca confía en el cliente.
async function fscSession(req) {
    let token = '';
    const cookie = String(req.headers.cookie || '');
    const m = cookie.match(/(?:^|;\s*)fsc_token=([^;]+)/);
    if (m) token = decodeURIComponent(m[1]);
    if (!token) token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return null;
    try {
        const r = await fetch(FSCAUTH_URL + '/api/auth/verify', { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (d && d.loggedIn === true && d.user) {
            return {
                username: String(d.user.username || ''),
                displayName: String(d.user.displayName || d.user.username || ''),
                userId: String(d.user.id || ''),
                role: d.user.role || ''
            };
        }
    } catch (err) {
        console.error('[RIFA] no se pudo verificar la sesion FSC:', err.message);
    }
    return null;
}

// Anti-spam en memoria: N escrituras por IP cada 10 minutos.
function limitador(max) {
    const hits = new Map();
    const windowMs = 10 * 60 * 1000;
    return function (ip) {
        const now = Date.now();
        const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
        if (arr.length >= max) return false;
        arr.push(now);
        hits.set(ip, arr);
        if (hits.size > 5000) hits.clear();
        return true;
    };
}
const limiteCompra = limitador(40);    // comprar varios números
const limitePremio = limitador(10);    // anotar premios

async function ajustes() {
    let a = await Ajuste.findOne({ rifa: RIFA });
    if (!a) a = await Ajuste.create({ rifa: RIFA });
    return a;
}

// Normaliza el total: entre 10 y 9999 números.
function totalValido(v) {
    const n = parseInt(v, 10);
    if (!isFinite(n) || n < 10) return 10;
    if (n > 9999) return 9999;
    return n;
}

// ---------- GET público: estado completo de la rifa ----------
router.get('/rifa', async (req, res) => {
    try {
        const a = await ajustes();
        const nums = await Numero.find({ rifa: RIFA, numero: { $gte: 1, $lte: a.total } }, { numero: 1 }).lean();
        const ocupados = nums.map((n) => n.numero).sort((x, y) => x - y);
        const premios = await Premio.countDocuments({ rifa: RIFA, estado: 'aprobado' });
        res.json({
            ok: true,
            total: a.total,
            precio: a.precio,
            info: a.info,
            cierre: a.cierre,
            mpLink: a.mpLink,
            abierta: a.abierta,
            ocupados,
            vendidos: ocupados.length,
            disponibles: Math.max(0, a.total - ocupados.length),
            premios
        });
    } catch (err) {
        console.error('[RIFA] estado:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo leer la rifa' });
    }
});

// ---------- GET admin: ajustes ----------
router.get('/rifa/config', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        const a = await ajustes();
        res.json({ ok: true, config: a });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudo leer la configuración' });
    }
});

// ---------- PUT admin: ajustes ----------
router.put('/rifa/config', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        const a = await ajustes();
        const b = req.body || {};
        const totalNuevo = totalValido(b.total != null ? b.total : a.total);
        // Aviso (no bloqueo): si se achica el total, los números de más quedan fuera del tablero.
        a.total = totalNuevo;
        if (b.precio != null) a.precio = limpio(b.precio, 60);
        if (b.info != null) a.info = limpio(b.info, 300);
        if (b.cierre != null) a.cierre = limpio(b.cierre, 60);
        if (b.mpLink != null) a.mpLink = limpio(b.mpLink, 300);
        if (b.abierta != null) a.abierta = !!b.abierta;
        a.updatedAt = new Date();
        await a.save();
        res.json({ ok: true, config: a });
    } catch (err) {
        console.error('[RIFA] config:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo guardar la configuración' });
    }
});

// ---------- GET público: números comprados ----------
// Sin ?pass= sólo devuelve los números (para pintar el tablero). Con ?pass= devuelve
// los datos del comprador, que el cartón público NO expone.
router.get('/rifa/numeros', async (req, res) => {
    try {
        const a = await ajustes();
        const admin = esAdmin(req);
        const filtro = { rifa: RIFA, numero: { $gte: 1, $lte: a.total } };
        const campos = admin ? { numero: 1, comprador: 1, username: 1, telefono: 1, email: 1, nota: 1, createdAt: 1 }
                             : { numero: 1 };
        const nums = await Numero.find(filtro, campos).sort({ numero: 1 }).lean();
        res.json({ ok: true, total: a.total, numeros: nums });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudieron leer los números' });
    }
});

// ---------- POST público: comprar / reservar números ----------
router.post('/rifa/numeros', async (req, res) => {
    try {
        const a = await ajustes();
        if (!a.abierta && !esAdmin(req)) return res.status(403).json({ ok: false, error: 'La rifa está cerrada' });
        if (!limiteCompra(req.ip || req.connection.remoteAddress || '?')) {
            return res.status(429).json({ ok: false, error: 'Muchos intentos, probá en unos minutos' });
        }
        const b = req.body || {};
        const lista = Array.isArray(b.numeros) ? b.numeros : [b.numero];
        const pedidos = [];
        for (const n of lista) {
            const num = parseInt(n, 10);
            if (isFinite(num) && num >= 1 && num <= a.total && pedidos.indexOf(num) < 0) pedidos.push(num);
        }
        if (!pedidos.length) return res.status(400).json({ ok: false, error: 'Elegí al menos un número' });
        if (pedidos.length > 50) return res.status(400).json({ ok: false, error: 'Máximo 50 números por vez' });

        const comprador = limpio(b.comprador, 80);
        if (!comprador) return res.status(400).json({ ok: false, error: 'Escribí tu nombre' });

        const ses = await fscSession(req);

        // Si alguno ya está tomado, se informa exactamente cuáles y no se toca nada.
        const ya = await Numero.find({ rifa: RIFA, numero: { $in: pedidos } }, { numero: 1 }).lean();
        if (ya.length) {
            return res.status(409).json({
                ok: false,
                error: 'Algunos números ya están tomados',
                tomados: ya.map((x) => x.numero).sort((x, y) => x - y)
            });
        }

        const docs = await Numero.insertMany(pedidos.map((n) => ({
            rifa: RIFA,
            numero: n,
            comprador,
            username: ses ? ses.username : limpio(b.username, 40),
            telefono: limpio(b.telefono, 40),
            email: limpio(b.email, 80),
            nota: limpio(b.nota, 140)
        })));

        res.status(201).json({
            ok: true,
            numeros: docs.map((d) => d.numero).sort((x, y) => x - y),
            username: ses ? ses.username : '',
            message: '¡Listo! Guardamos tus números'
        });
    } catch (err) {
        if (err && err.code === 11000) {
            return res.status(409).json({ ok: false, error: 'Alguno de esos números se tomó justo ahora, probá de nuevo' });
        }
        console.error('[RIFA] compra:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudieron guardar los números' });
    }
});

// ---------- PUT admin: editar un número ----------
router.put('/rifa/numeros/:numero', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        const num = parseInt(req.params.numero, 10);
        const b = req.body || {};
        const cambios = {};
        ['comprador', 'username', 'telefono', 'email', 'nota'].forEach((k) => {
            if (b[k] != null) cambios[k] = limpio(b[k], k === 'nota' ? 140 : 80);
        });
        const doc = await Numero.findOneAndUpdate({ rifa: RIFA, numero: num }, cambios, { new: true });
        if (!doc) return res.status(404).json({ ok: false, error: 'Ese número no está vendido' });
        res.json({ ok: true, numero: doc });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudo editar el número' });
    }
});

// ---------- DELETE admin: liberar un número ----------
router.delete('/rifa/numeros/:numero', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        const num = parseInt(req.params.numero, 10);
        await Numero.deleteOne({ rifa: RIFA, numero: num });
        res.json({ ok: true, message: 'Número liberado' });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudo liberar el número' });
    }
});

// ---------- GET premios ----------
// Público: sólo aprobados. Con ?pass= (admin) o ?mios=<username> (con sesión) ve los propios.
router.get('/rifa/premios', async (req, res) => {
    try {
        const admin = esAdmin(req);
        const filtro = { rifa: RIFA };
        if (!admin) filtro.estado = 'aprobado';
        // OJO: la imagen es un Buffer; { imagen: 0 } en un lean() NO la excluye,
        // así que se piden los campos explícitamente (si no, se manda toda la foto).
        const lista = await Premio.find(filtro, {
            titulo: 1, descripcion: 1, ofrecidoPor: 1, username: 1, contacto: 1,
            estado: 1, numeroGanador: 1, imagenMime: 1, createdAt: 1
        }).sort({ createdAt: admin ? -1 : 1 }).lean();
        res.json({
            ok: true,
            premios: lista.map((p) => ({
                id: String(p._id),
                titulo: p.titulo,
                descripcion: p.descripcion,
                ofrecidoPor: p.ofrecidoPor,
                username: p.username,
                contacto: admin ? p.contacto : '',
                estado: p.estado,
                numeroGanador: p.numeroGanador,
                tieneImagen: !!p.imagenMime,
                createdAt: p.createdAt
            }))
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudieron leer los premios' });
    }
});

// ---------- POST público: anotar un premio ----------
router.post('/rifa/premios', async (req, res) => {
    try {
        const a = await ajustes();
        if (!a.abierta && !esAdmin(req)) return res.status(403).json({ ok: false, error: 'La inscripción de premios está cerrada' });
        if (!limitePremio(req.ip || req.connection.remoteAddress || '?')) {
            return res.status(429).json({ ok: false, error: 'Muchos intentos, probá en unos minutos' });
        }
        const b = req.body || {};
        const titulo = limpio(b.titulo, 110);
        if (!titulo) return res.status(400).json({ ok: false, error: 'Poné qué premio ofrecés' });

        const ses = await fscSession(req);
        const image = String(b.image || '');
        let imagen = null, imagenMime = '';
        if (image) {
            const m = /^data:(image\/(png|jpeg|jpg|gif|webp));base64,/.exec(image);
            if (!m) return res.status(400).json({ ok: false, error: 'La foto tiene que ser PNG, JPG, GIF o WEBP' });
            const buf = Buffer.from(image.split(',')[1], 'base64');
            if (!buf.length) return res.status(400).json({ ok: false, error: 'La foto vino vacía' });
            if (buf.length > MAX_IMG) return res.status(413).json({ ok: false, error: 'La foto supera los 8 MB' });
            imagen = buf;
            imagenMime = m[1] === 'image/jpg' ? 'image/jpeg' : m[1];
        }

        const doc = await Premio.create({
            rifa: RIFA,
            titulo,
            descripcion: limpio(b.descripcion, 400),
            ofrecidoPor: limpio(b.ofrecidoPor, 80) || (ses ? ses.displayName : ''),
            username: ses ? ses.username : '',        // identidad REAL del ecosistema
            contacto: limpio(b.contacto, 120),
            imagen,
            imagenMime,
            // Con sesión JPCONNECT queda aprobado al toque: la identidad ya está verificada.
            estado: ses ? 'aprobado' : 'pendiente'
        });

        res.status(201).json({
            ok: true,
            id: String(doc._id),
            estado: doc.estado,
            username: ses ? ses.username : '',
            message: ses
                ? '¡Gracias! Tu premio quedó publicado para la rifa'
                : '¡Gracias! Tu premio quedó anotado; al ser revisado aparece en la lista'
        });
    } catch (err) {
        console.error('[RIFA] premio:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo guardar el premio' });
    }
});

// ---------- GET imagen del premio ----------
router.get('/rifa/premios/:id/img', async (req, res) => {
    try {
        const p = await Premio.findById(req.params.id, { imagen: 1, imagenMime: 1 }).lean();
        if (!p || !p.imagen) return res.status(404).end();
        res.setHeader('Content-Type', p.imagenMime || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(p.imagen.buffer ? p.imagen.buffer : p.imagen);
    } catch (err) {
        res.status(404).end();
    }
});

// ---------- PUT admin: aprobar / descartar / número ganador ----------
router.put('/rifa/premios/:id', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        const b = req.body || {};
        const cambios = {};
        if (b.estado != null) {
            if (['pendiente', 'aprobado', 'descartado'].indexOf(b.estado) < 0) {
                return res.status(400).json({ ok: false, error: 'Estado inválido' });
            }
            cambios.estado = b.estado;
        }
        if (b.numeroGanador != null) {
            const n = parseInt(b.numeroGanador, 10);
            cambios.numeroGanador = (isFinite(n) && n > 0) ? n : null;
        }
        const doc = await Premio.findByIdAndUpdate(req.params.id, cambios, {
            new: true,
            projection: { titulo: 1, estado: 1, numeroGanador: 1 }
        });
        if (!doc) return res.status(404).json({ ok: false, error: 'Ese premio no existe' });
        res.json({ ok: true, premio: doc });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudo actualizar el premio' });
    }
});

// ---------- DELETE admin ----------
router.delete('/rifa/premios/:id', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        await Premio.findByIdAndDelete(req.params.id);
        res.json({ ok: true, message: 'Premio eliminado' });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudo eliminar el premio' });
    }
});

module.exports = router;
