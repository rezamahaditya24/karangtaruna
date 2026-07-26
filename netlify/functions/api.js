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

  try { app.use('/api/auth', require('../../routes/auth')); } catch (e) { app.use('/api/auth', (r, s) => s.status(500).json({ error: '/api/auth: ' + e.message })); }
  try { app.use('/api/berita', require('../../routes/berita')); } catch (e) { app.use('/api/berita', (r, s) => s.status(500).json({ error: '/api/berita: ' + e.message })); }
  try { app.use('/api/galeri', require('../../routes/galeri')); } catch (e) { app.use('/api/galeri', (r, s) => s.status(500).json({ error: '/api/galeri: ' + e.message })); }
  try { app.use('/api/program', require('../../routes/program')); } catch (e) { app.use('/api/program', (r, s) => s.status(500).json({ error: '/api/program: ' + e.message })); }
  try { app.use('/api/umkm', require('../../routes/umkm')); } catch (e) { app.use('/api/umkm', (r, s) => s.status(500).json({ error: '/api/umkm: ' + e.message })); }
  try { app.use('/api/kas', require('../../routes/kas')); } catch (e) { app.use('/api/kas', (r, s) => s.status(500).json({ error: '/api/kas: ' + e.message })); }
  try { app.use('/api/pengurus', require('../../routes/pengurus')); } catch (e) { app.use('/api/pengurus', (r, s) => s.status(500).json({ error: '/api/pengurus: ' + e.message })); }
  try { app.use('/api/pendaftar', require('../../routes/pendaftar')); } catch (e) { app.use('/api/pendaftar', (r, s) => s.status(500).json({ error: '/api/pendaftar: ' + e.message })); }

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