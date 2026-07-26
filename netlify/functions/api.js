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

  app.use('/api/auth', require('../../routes/auth'));
  app.use('/api/berita', require('../../routes/berita'));
  app.use('/api/galeri', require('../../routes/galeri'));
  app.use('/api/program', require('../../routes/program'));
  app.use('/api/umkm', require('../../routes/umkm'));
  app.use('/api/kas', require('../../routes/kas'));
  app.use('/api/pengurus', require('../../routes/pengurus'));
  app.use('/api/pendaftar', require('../../routes/pendaftar'));

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
  errorApp.all('*', (req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      detail: err?.message || 'Unknown error'
    });
  });
  handler = serverless(errorApp);
}

module.exports.handler = handler;