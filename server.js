require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'local';
const BASE_PATH = process.env.BASE_PATH || '/vuelapelucas3000_2';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vuelapelucas3000';

// CORS - Configuración completa para permitir requests desde el frontend
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = [
      "https://fullscreencode.com",
      "https://vps-4455523-x.dattaweb.com",
      "http://localhost:" + PORT
    ];
    callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  exposedHeaders: ["Content-Length", "X-Requested-With"],
  maxAge: 86400
}));

// Manejar preflight OPTIONS
app.options('*', cors());

// CSP Headers
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com",
    "connect-src 'self' https://fullscreencode.com https://vps-4455523-x.dattaweb.com https://res.cloudinary.com https://api.cloudinary.com",
    "media-src 'self' https://res.cloudinary.com https://*.cloudinary.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'self' https://fullscreencode.com"
  ].join('; '));
  next();
});

// Asegurar compatibilidad shadres / shaders apuntando siempre a public/shaders/
app.get(['/shadres/backgroundshader.frag', `${BASE_PATH}/shadres/backgroundshader.frag`], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'shaders', 'backgroundshader.frag'));
});

app.use(express.static(path.join(__dirname, 'public')));

// Paginas standalone - accesibles con y sin BASE_PATH
app.get(['/anotate', `${BASE_PATH}/anotate`, '/anotate.html', `${BASE_PATH}/anotate.html`], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'anotate.html'));
});

app.get(['/hospedajes', `${BASE_PATH}/hospedajes`, '/hospedajes.html', `${BASE_PATH}/hospedajes.html`], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hospedajes.html'));
});

// API routes
app.use(`${BASE_PATH}/api`, require('./routes/api'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'vuelapelucas3000', version: '1.0.0', environment: NODE_ENV });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// MongoDB connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    if (NODE_ENV !== 'local') process.exit(1);
  });

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 http://localhost:${PORT}${BASE_PATH} [${NODE_ENV}]`);
});

// Graceful shutdown
process.on('SIGTERM', () => { server.close(); mongoose.connection.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); mongoose.connection.close(); process.exit(0); });
