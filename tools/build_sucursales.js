// ============================================================
// Construye public/data/sucursales-correo.json a partir del dump crudo
// de OSM (osm_correo_raw.json): sucursales de Correo Argentino con
// coordenadas. A las que no tienen addr:city se les pregunta la zona a
// Photon (geocoder OSM: sin API key y sin el rate limit de Nominatim).
//
//   node tools/build_sucursales.js [ruta_del_raw]
// ============================================================
const fs = require('fs');
const path = require('path');

const RAW = process.argv[2] || 'osm_correo_raw.json';
const OUT = path.join(__dirname, '..', 'public', 'data', 'sucursales-correo.json');
const UA = 'vuelapelucas3000-web/1.0 (https://vuelapelucas3000.com.ar)';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const limpio = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

// Nombres de provincia que no entran en una lista
const PROV = {
  'Ciudad Autónoma de Buenos Aires': 'CABA',
  'Ciudad Autonoma de Buenos Aires': 'CABA',
  'Provincia de Buenos Aires': 'Buenos Aires',
  'Tierra del Fuego, Antártida e Islas del Atlántico Sur': 'Tierra del Fuego'
};

// En las ciudades grandes el "city" es inútil (hay decenas de sucursales con
// el mismo nombre): ahí manda el barrio/partido (district) de Photon.
const CIUDADES_GRANDES = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza',
  'La Plata', 'Mar del Plata', 'Santa Fe', 'San Miguel de Tucumán', 'Salta', 'Neuquén',
  'Bahía Blanca', 'Posadas', 'Corrientes', 'Resistencia', 'Santiago del Estero',
  'San Juan', 'Paraná', 'Formosa', 'San Luis', 'La Rioja', 'Catamarca', 'Río Gallegos',
  'Ushuaia', 'Comodoro Rivadavia', 'Trelew', 'Río Cuarto', 'Villa María', 'Tandil'
];

async function zonaPorCoordenada(lat, lon) {
  const url = 'https://photon.komoot.io/reverse?lat=' + lat + '&lon=' + lon;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('photon ' + r.status);
  const d = await r.json();
  const f = (d.features || [])[0];
  if (!f) return { ciudad: '', provincia: '' };
  const p = f.properties || {};
  const ciudad = limpio(p.city || p.town || p.village || '');
  const barrio = limpio(p.district || p.county || '');
  return {
    ciudad: (!ciudad || CIUDADES_GRANDES.indexOf(ciudad) >= 0) && barrio ? barrio : (ciudad || barrio),
    provincia: limpio(p.state || '')
  };
}

(async () => {
  const raw = JSON.parse(fs.readFileSync(RAW, 'utf8')).elements || [];
  console.log('crudo:', raw.length);

  const items = [];
  for (const e of raw) {
    const t = e.tags || {};
    const lat = e.lat != null ? e.lat : (e.center && e.center.lat);
    const lon = e.lon != null ? e.lon : (e.center && e.center.lon);
    if (lat == null || lon == null) continue;
    items.push({
      ciudad: limpio(t['addr:city'] || t['addr:town'] || t['addr:village'] || ''),
      calle: limpio(t['addr:street'] || ''),
      numero: limpio(t['addr:housenumber'] || ''),
      cp: limpio(t['addr:postcode'] || ''),
      provincia: limpio(t['addr:state'] || t['addr:province'] || ''),
      lat: Number(lat),
      lon: Number(lon)
    });
  }

  // dedupe por coordenada redondeada (OSM a veces tiene el nodo dos veces:
  // una por name y otra por brand)
  const vistos = new Set();
  const unicos = [];
  for (const it of items) {
    const k = it.lat.toFixed(4) + ',' + it.lon.toFixed(4);
    if (vistos.has(k)) continue;
    vistos.add(k);
    unicos.push(it);
  }
  console.log('con coordenadas:', items.length, 'únicos:', unicos.length);

  const faltan = unicos.filter((x) => !x.ciudad);
  console.log('sin ciudad (a geocodificar):', faltan.length);

  let i = 0, errores = 0;
  for (const it of faltan) {
    i++;
    try {
      const z = await zonaPorCoordenada(it.lat.toFixed(5), it.lon.toFixed(5));
      it.ciudad = z.ciudad;
      if (!it.provincia) it.provincia = z.provincia;
    } catch (e) {
      errores++;
      if (errores < 6) console.log('  ! ' + i + ' ' + e.message);
    }
    if (i % 30 === 0) console.log('  ' + i + '/' + faltan.length);
    await dormir(250);
  }
  console.log('errores de geocodificación:', errores);

  const salida = unicos
    .map((x) => ({
      c: x.ciudad,
      d: [x.calle, x.numero].filter(Boolean).join(' '),
      p: PROV[x.provincia] || x.provincia,
      z: x.cp,
      y: Number(x.lat.toFixed(5)),
      x: Number(x.lon.toFixed(5))
    }))
    .sort((a, b) => (a.c > b.c ? 1 : a.c < b.c ? -1 : 0));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    fuente: 'OpenStreetMap — amenity=post_office, Correo Argentino',
    generado: new Date().toISOString().slice(0, 10),
    total: salida.length,
    sucursales: salida
  }));
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  const sinCiudad = salida.filter((s) => !s.c).length;
  console.log('OK ' + OUT + ' (' + salida.length + ' sucursales, ' + kb + ' KB, sin ciudad: ' + sinCiudad + ')');
})();
