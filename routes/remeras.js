// ============================================================
// REMERAS DEL VUELAPELUCAS 3000
// ------------------------------------------------------------
// GET    {BASE}/api/remeras                  -> catalogo publico + ajustes
// GET    {BASE}/api/remeras/admin?pass=      -> catalogo completo (admin)
// GET    {BASE}/api/remeras/:id/img          -> foto de la remera
// POST   {BASE}/api/remeras?pass=            -> cargar remera (admin, data URL)
// PUT    {BASE}/api/remeras/:id?pass=        -> editar remera (admin)
// DELETE {BASE}/api/remeras/:id?pass=        -> borrar remera (admin)
// GET    {BASE}/api/remeras/config?pass=     -> ajustes (admin)
// PUT    {BASE}/api/remeras/config?pass=     -> guardar ajustes (admin)
// GET    {BASE}/api/compras?pass=            -> todas las compras (admin)
// GET    {BASE}/api/compras/:id/comprobante?pass= -> comprobante de pago
// POST   {BASE}/api/compras                  -> registrar un pedido (publico)
// PUT    {BASE}/api/compras/:id?pass=        -> estado / nota (admin)
// DELETE {BASE}/api/compras/:id?pass=        -> borrar compra (admin)
// ============================================================
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { Remera, Compra, Config } = require('../models/remeras');

const MAX_IMG = 8 * 1024 * 1024;
const TALLES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const ESTADOS = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];
const PRECIO_MIN = 100;
const PRECIO_MAX = 10000000;

const limpio = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const esAdmin = (req) => {
    const pass = process.env.ADMIN_PASS || '';
    return !!pass && String(req.query.pass || (req.body && req.body.pass) || '') === pass;
};
const esId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));

// ---------- ajustes ----------
async function ajustes() {
    let c = await Config.findOne({ clave: 'remeras' });
    if (!c) c = await Config.create({ clave: 'remeras' });
    return c;
}

function precioValido(v, def) {
    const n = Math.round(Number(v));
    if (!isFinite(n) || n < PRECIO_MIN || n > PRECIO_MAX) return def;
    return n;
}

// ---------- imagenes ----------
// Recibe un data URL (image/png|jpeg|webp|gif) y devuelve { imagen, mime } o { error }.
function dataUrlABuffer(image) {
    const s = String(image || '');
    if (!s) return { imagen: null, mime: '' };
    const m = /^data:(image\/(png|jpeg|jpg|gif|webp));base64,/.exec(s);
    if (!m) return { error: 'La imagen tiene que ser PNG, JPG, GIF o WEBP' };
    const buf = Buffer.from(s.split(',')[1] || '', 'base64');
    if (!buf.length) return { error: 'La imagen vino vacía' };
    if (buf.length > MAX_IMG) return { error: 'La imagen supera los 8 MB' };
    return { imagen: buf, mime: m[1] === 'image/jpg' ? 'image/jpeg' : m[1] };
}

function enviarImagen(res, doc, campo) {
    const buf = doc && doc[campo];
    if (!buf) return res.status(404).end();
    res.setHeader('Content-Type', doc[campo + 'Mime'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf.buffer ? buf.buffer : buf);
}

// ---------- anti-spam en memoria (igual criterio que la rifa) ----------
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
const limitePedido = limitador(12);

const publico = (r) => ({
    id: String(r._id),
    nombre: r.nombre,
    descripcion: r.descripcion || '',
    precio: r.precio,
    orden: r.orden || 0,
    tieneImagen: !!r.imagenMime
});

// ============================================================
// CATALOGO
// ============================================================
router.get('/remeras', async (req, res) => {
    try {
        const c = await ajustes();
        // OJO: la imagen es un Buffer; se piden los campos uno por uno (igual
        // que los premios de la rifa) para no arrastrar todas las fotos.
        const lista = await Remera.find({ activa: true }, {
            nombre: 1, descripcion: 1, precio: 1, orden: 1, imagenMime: 1, createdAt: 1
        }).sort({ orden: 1, createdAt: 1 }).lean();
        res.json({
            ok: true,
            precio: c.precio,
            whatsapp: c.whatsapp,
            alias: c.alias,
            instrucciones: c.instrucciones,
            abierta: c.abierta,
            talles: TALLES,
            remeras: lista.map(publico)
        });
    } catch (err) {
        console.error('[REMERAS] catalogo:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo leer el catálogo' });
    }
});

router.get('/remeras/admin', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        const lista = await Remera.find({}, {
            nombre: 1, descripcion: 1, precio: 1, orden: 1, activa: 1, imagenMime: 1, createdAt: 1
        }).sort({ orden: 1, createdAt: 1 }).lean();
        res.json({
            ok: true,
            talles: TALLES,
            remeras: lista.map((r) => Object.assign(publico(r), { activa: r.activa !== false, createdAt: r.createdAt }))
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudo leer el catálogo' });
    }
});

router.get('/remeras/:id/img', async (req, res) => {
    try {
        if (!esId(req.params.id)) return res.status(404).end();
        const r = await Remera.findById(req.params.id, { imagen: 1, imagenMime: 1 }).lean();
        enviarImagen(res, r, 'imagen');
    } catch (err) {
        res.status(404).end();
    }
});

// ---------- alta (admin) ----------
router.post('/remeras', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        const b = req.body || {};
        const nombre = limpio(b.nombre, 90);
        if (!nombre) return res.status(400).json({ ok: false, error: 'Ponele un nombre a la remera' });
        const img = dataUrlABuffer(b.image);
        if (img.error) return res.status(400).json({ ok: false, error: img.error });

        const c = await ajustes();
        const orden = parseInt(b.orden, 10);
        const doc = await Remera.create({
            nombre,
            descripcion: limpio(b.descripcion, 240),
            precio: precioValido(b.precio, c.precio),
            orden: isFinite(orden) ? orden : 0,
            activa: b.activa !== false,
            imagen: img.imagen,
            imagenMime: img.mime
        });
        res.status(201).json({ ok: true, remera: publico(doc), message: 'Remera cargada' });
    } catch (err) {
        console.error('[REMERAS] alta:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo guardar la remera' });
    }
});

// ---------- edicion / borrado (admin) ----------
router.put('/remeras/:id', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        if (!esId(req.params.id)) return res.status(404).json({ ok: false, error: 'Esa remera no existe' });
        const b = req.body || {};
        const cambios = {};
        if (b.nombre != null) {
            const n = limpio(b.nombre, 90);
            if (!n) return res.status(400).json({ ok: false, error: 'El nombre no puede quedar vacío' });
            cambios.nombre = n;
        }
        if (b.descripcion != null) cambios.descripcion = limpio(b.descripcion, 240);
        if (b.precio != null) cambios.precio = precioValido(b.precio, (await ajustes()).precio);
        if (b.orden != null) {
            const o = parseInt(b.orden, 10);
            if (isFinite(o)) cambios.orden = o;
        }
        if (b.activa != null) cambios.activa = !!b.activa;
        if (b.image) {
            const img = dataUrlABuffer(b.image);
            if (img.error) return res.status(400).json({ ok: false, error: img.error });
            cambios.imagen = img.imagen;
            cambios.imagenMime = img.mime;
        }
        const doc = await Remera.findByIdAndUpdate(req.params.id, cambios, { new: true });
        if (!doc) return res.status(404).json({ ok: false, error: 'Esa remera no existe' });
        res.json({ ok: true, remera: publico(doc), message: 'Remera actualizada' });
    } catch (err) {
        console.error('[REMERAS] edicion:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo actualizar la remera' });
    }
});

router.delete('/remeras/:id', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        if (!esId(req.params.id)) return res.status(404).json({ ok: false, error: 'Esa remera no existe' });
        await Remera.findByIdAndDelete(req.params.id);
        res.json({ ok: true, message: 'Remera eliminada' });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudo eliminar la remera' });
    }
});

// ============================================================
// AJUSTES
// ============================================================
router.get('/remeras/config', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        const c = await ajustes();
        res.json({ ok: true, config: c });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudo leer la configuración' });
    }
});

router.put('/remeras/config', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        const c = await ajustes();
        const b = req.body || {};
        if (b.precio != null) c.precio = precioValido(b.precio, c.precio);
        if (b.whatsapp != null) c.whatsapp = limpio(b.whatsapp, 40).replace(/[^\d+]/g, '');
        if (b.alias != null) c.alias = limpio(b.alias, 120);
        if (b.instrucciones != null) c.instrucciones = limpio(b.instrucciones, 400);
        if (b.abierta != null) c.abierta = !!b.abierta;
        c.updatedAt = new Date();
        await c.save();
        res.json({ ok: true, config: c });
    } catch (err) {
        console.error('[REMERAS] config:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo guardar la configuración' });
    }
});

// ============================================================
// COMPRAS
// ============================================================

// Link de WhatsApp con el pedido completo ya escrito. Se calcula en el server
// para que el mensaje sea siempre el mismo que ve el admin.
// wa.me necesita el número en formato internacional: 2954541104 -> 5492954541104
function normalizarWhatsapp(numero) {
    const d = String(numero || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.indexOf('54') === 0) return d;                 // ya viene con país
    if (d.length === 11 && d.charAt(0) === '9') return '54' + d;
    if (d.length === 10) return '549' + d;               // 2954 541104
    return d;
}

function linkWhatsapp(numero, texto) {
    const num = normalizarWhatsapp(numero);
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(texto);
}

function mensajePedido(c, codigo) {
    const precio = '$' + Number(c.precio || 0).toLocaleString('es-AR');
    return [
        'HOLA! QUIERO COMPRAR UNA REMERA DEL VUELAPELUCAS 3000',
        '',
        'PEDIDO ' + codigo,
        'REMERA: ' + c.remeraNombre,
        'TALLE: ' + c.talle,
        'PRECIO: ' + precio,
        'SUCURSAL CORREO ARGENTINO: ' + c.sucursal,
        '',
        'NOMBRE Y APELLIDO: ' + c.nombreApellido,
        'MAIL: ' + c.email,
        'TELEFONO: ' + c.telefono,
        c.nota ? 'NOTA: ' + c.nota : null,
        'COMPROBANTE: ' + (c.comprobanteMime ? 'SUBIDO EN LA WEB' : 'LO ENVIO POR ACA')
    ].filter((x) => x !== null).join('\n');
}

// ---------- POST publico: registrar un pedido ----------
router.post('/compras', async (req, res) => {
    try {
        const c = await ajustes();
        if (!c.abierta) return res.status(403).json({ ok: false, error: 'Las compras están cerradas por ahora' });
        if (!limitePedido(req.ip || req.connection.remoteAddress || '?')) {
            return res.status(429).json({ ok: false, error: 'Muchos pedidos seguidos, probá en unos minutos' });
        }

        const b = req.body || {};
        const talle = limpio(b.talle, 8).toUpperCase();
        if (TALLES.indexOf(talle) < 0) return res.status(400).json({ ok: false, error: 'Elegí un talle' });

        const nombreApellido = limpio(b.nombreApellido, 90);
        if (!nombreApellido) return res.status(400).json({ ok: false, error: 'Escribí tu nombre y apellido' });

        const email = limpio(b.email, 90);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            return res.status(400).json({ ok: false, error: 'Revisá el mail' });
        }
        const telefono = limpio(b.telefono, 40);
        if (telefono.replace(/\D/g, '').length < 6) {
            return res.status(400).json({ ok: false, error: 'Revisá el teléfono' });
        }
        const sucursal = limpio(b.sucursal, 120);
        if (!sucursal) return res.status(400).json({ ok: false, error: 'Elegí la sucursal de Correo Argentino' });

        let remera = null;
        if (b.remeraId) {
            if (!esId(b.remeraId)) return res.status(400).json({ ok: false, error: 'Elegí una remera' });
            remera = await Remera.findOne({ _id: b.remeraId, activa: true }, { nombre: 1, precio: 1 }).lean();
            if (!remera) return res.status(400).json({ ok: false, error: 'Esa remera ya no está disponible' });
        }
        const remeraNombre = remera ? remera.nombre : limpio(b.remeraNombre, 90);
        if (!remeraNombre) return res.status(400).json({ ok: false, error: 'Elegí una remera' });

        // El precio SIEMPRE sale del servidor (nunca de lo que mande el cliente).
        const precio = remera ? (remera.precio || c.precio) : c.precio;

        // Comprobante OPCIONAL: si no viene, la compra se guarda igual.
        const img = dataUrlABuffer(b.comprobante);
        if (img.error) return res.status(400).json({ ok: false, error: img.error });

        const doc = await Compra.create({
            remera: remera ? remera._id : null,
            remeraNombre,
            talle,
            sucursal,
            nombreApellido,
            email,
            telefono,
            nota: limpio(b.nota, 200),
            precio,
            comprobante: img.imagen,
            comprobanteMime: img.mime,
            estado: 'pendiente'
        });

        const codigo = String(doc._id).slice(-6).toUpperCase();
        const texto = mensajePedido(Object.assign({}, doc.toObject(), { precio }), codigo);

        res.status(201).json({
            ok: true,
            id: String(doc._id),
            codigo,
            precio,
            whatsapp: linkWhatsapp(c.whatsapp, texto),
            mensaje: texto,
            comprobante: !!img.mime,
            message: '¡Pedido guardado!'
        });
    } catch (err) {
        console.error('[REMERAS] compra:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudo guardar el pedido' });
    }
});

// ---------- GET admin: compras ----------
router.get('/compras', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        // La imagen es un Buffer: se enumeran los campos para no traerla.
        const lista = await Compra.find({}, {
            remera: 1, remeraNombre: 1, talle: 1, sucursal: 1, nombreApellido: 1,
            email: 1, telefono: 1, nota: 1, precio: 1, comprobanteMime: 1,
            estado: 1, createdAt: 1
        }).sort({ createdAt: -1 }).lean();
        res.json({
            ok: true,
            compras: lista.map((x) => ({
                id: String(x._id),
                codigo: String(x._id).slice(-6).toUpperCase(),
                remeraNombre: x.remeraNombre,
                talle: x.talle,
                sucursal: x.sucursal,
                nombreApellido: x.nombreApellido,
                email: x.email,
                telefono: x.telefono,
                nota: x.nota,
                precio: x.precio,
                estado: x.estado,
                tieneComprobante: !!x.comprobanteMime,
                createdAt: x.createdAt
            }))
        });
    } catch (err) {
        console.error('[REMERAS] compras:', err.message);
        res.status(500).json({ ok: false, error: 'No se pudieron leer las compras' });
    }
});

// ---------- GET comprobante (admin) ----------
router.get('/compras/:id/comprobante', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        if (!esId(req.params.id)) return res.status(404).end();
        const x = await Compra.findById(req.params.id, { comprobante: 1, comprobanteMime: 1 }).lean();
        if (!x || !x.comprobante) return res.status(404).end();
        res.setHeader('Content-Type', x.comprobanteMime || 'image/jpeg');
        res.setHeader('Cache-Control', 'private, max-age=60');
        res.send(x.comprobante.buffer ? x.comprobante.buffer : x.comprobante);
    } catch (err) {
        res.status(404).end();
    }
});

// ---------- PUT admin: estado / nota ----------
router.put('/compras/:id', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        if (!esId(req.params.id)) return res.status(404).json({ ok: false, error: 'Esa compra no existe' });
        const b = req.body || {};
        const cambios = {};
        if (b.estado != null) {
            if (ESTADOS.indexOf(b.estado) < 0) return res.status(400).json({ ok: false, error: 'Estado inválido' });
            cambios.estado = b.estado;
        }
        if (b.nota != null) cambios.nota = limpio(b.nota, 200);
        const doc = await Compra.findByIdAndUpdate(req.params.id, cambios, {
            new: true,
            projection: { remeraNombre: 1, talle: 1, estado: 1, nota: 1 }
        });
        if (!doc) return res.status(404).json({ ok: false, error: 'Esa compra no existe' });
        res.json({ ok: true, compra: doc });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudo actualizar la compra' });
    }
});

// ---------- DELETE admin ----------
router.delete('/compras/:id', async (req, res) => {
    if (!esAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
    try {
        if (!esId(req.params.id)) return res.status(404).json({ ok: false, error: 'Esa compra no existe' });
        await Compra.findByIdAndDelete(req.params.id);
        res.json({ ok: true, message: 'Compra eliminada' });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'No se pudo eliminar la compra' });
    }
});

module.exports = router;
