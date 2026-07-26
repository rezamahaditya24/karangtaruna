const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const { uploadFile } = require('../config/supabase');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM berita ORDER BY tanggal DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM berita WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Berita tidak ditemukan.' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, upload.single('gambar'), async (req, res) => {
  try {
    const { judul, isi, tanggal, status } = req.body;
    let gambar = null;
    if (req.file) {
      gambar = await uploadFile(req.file, 'berita');
    }
    const result = await db.run(
      'INSERT INTO berita (judul, isi, tanggal, gambar, status) VALUES (?, ?, ?, ?, ?)',
      [judul, isi, tanggal || new Date().toISOString().split('T')[0], gambar, status || 'publish']
    );
    res.json({ id: result.lastInsertRowid, message: 'Berita berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, upload.single('gambar'), async (req, res) => {
  try {
    const { judul, isi, tanggal, status } = req.body;
    let gambar = req.body.gambar;
    if (req.file) {
      gambar = await uploadFile(req.file, 'berita');
    }
    await db.run(
      'UPDATE berita SET judul=?, isi=?, tanggal=?, gambar=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [judul, isi, tanggal, gambar, status, req.params.id]
    );
    res.json({ message: 'Berita berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.run('DELETE FROM berita WHERE id = ?', [req.params.id]);
    res.json({ message: 'Berita berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;