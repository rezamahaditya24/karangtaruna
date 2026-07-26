const path = require('path');
const serverless = require('serverless-http');
require('dotenv').config();

let handler;

try {
  const express = require('express');
  const cors = require('cors');

  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));
  app.use('/admin', express.static(path.join(__dirname, '..', '..', 'admin')));
  app.use(express.static(path.join(__dirname, '..', '..')));

  const tryRoute = (path, filepath) => {
    try { app.use(path, require(filepath)); } catch (e) { console.error(`${path} route:`, e.message); app.use(path, (req, res) => res.status(500).json({ error: `${path} unavailable: ${e.message}` })); }
  };
  tryRoute('/api/auth', '../../routes/auth');
  tryRoute('/api/berita', '../../routes/berita');
  tryRoute('/api/galeri', '../../routes/galeri');
  tryRoute('/api/program', '../../routes/program');
  tryRoute('/api/umkm', '../../routes/umkm');
  tryRoute('/api/kas', '../../routes/kas');
  tryRoute('/api/pengurus', '../../routes/pengurus');
  tryRoute('/api/pendaftar', '../../routes/pendaftar');

  app.get(/^\/admin(?:\/.*)?$/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'admin', 'index.html'), (err) => {
      if (err) res.status(503).json({ error: 'Admin panel unavailable' });
    });
  });

  app.use((err, req, res, next) => {
    console.error('Handler error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Terjadi kesalahan server' });
  });

  handler = serverless(app);
} catch (err) {
  console.error('FATAL: Function initialization failed:', err?.message || err);
  const errorApp = require('express')();
  errorApp.all(/^\/?(?:api\/.*)?$/, (req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      detail: err?.message || err?.stack || 'Unknown error'
    });
  });
  errorApp.get(/^\/.*$/, (req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      detail: err?.message || err?.stack || 'Unknown error'
    });
  });
  handler = serverless(errorApp);
}

module.exports.handler = handler;