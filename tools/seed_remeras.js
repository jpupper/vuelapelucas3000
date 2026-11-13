// ============================================================
// CARGA INICIAL DE LAS REMERAS DEL VUELAPELUCAS 3000
// ------------------------------------------------------------
// Toma las fotos de public/img/remeras/ y las guarda en Mongo (Buffer),
// que es de donde las lee la API. Es IDEMPOTENTE: si ya hay una remera
// con ese nombre, no la duplica.
//
//   node tools/seed_remeras.js
//
// Se corre una vez por base (local y VPS). No toca las remeras que
// hayas cargado desde el admin.
// ============================================================
try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
} catch (e) { /* sin dotenv se usan las variables del entorno */ }

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Remera, Config } = require('../models/remeras');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vuelapelucas3000';
const DIR = path.join(__dirname, '..', 'public', 'img', 'remeras');

const CATALOGO = [
  { nombre: 'REMERA X FASOLITO', archivo: 'remera-fasolito.webp', orden: 1 },
  { nombre: 'REMERA X JUANITO', archivo: 'remera-juanito.webp', orden: 2 },
  { nombre: 'REMERA X PAM! PAM!', archivo: 'remera-pam.webp', orden: 3 },
  { nombre: 'REMERA X PANCHO DEL PUEBLO', archivo: 'remera-pancho.webp', orden: 4 },
  { nombre: 'REMERA X JPUPPER', archivo: 'remera-pupper.webp', orden: 5 }
];

(async () => {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Mongo conectado:', MONGO_URI.replace(/\/\/[^@]*@/, '//***@'));

  let cfg = await Config.findOne({ clave: 'remeras' });
  if (!cfg) {
    cfg = await Config.create({ clave: 'remeras', precio: 50000, whatsapp: '2954541104' });
    console.log('  ajustes creados:', cfg.precio, cfg.whatsapp);
  }
  const precio = cfg.precio || 50000;

  for (const r of CATALOGO) {
    const ya = await Remera.findOne({ nombre: r.nombre }, { _id: 1 }).lean();
    if (ya) { console.log('  =', r.nombre, '(ya estaba)'); continue; }
    const p = path.join(DIR, r.archivo);
    if (!fs.existsSync(p)) { console.log('  ! falta el archivo', r.archivo); continue; }
    const buf = fs.readFileSync(p);
    await Remera.create({
      nombre: r.nombre,
      descripcion: '',
      precio,
      orden: r.orden,
      activa: true,
      imagen: buf,
      imagenMime: 'image/webp'
    });
    console.log('  +', r.nombre, Math.round(buf.length / 1024) + ' KB');
  }

  const total = await Remera.countDocuments();
  console.log('✅ Listo. Remeras en la base:', total);
  await mongoose.disconnect();
})().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
