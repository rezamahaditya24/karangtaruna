const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

router.get('/', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM galeri ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, upload.single('gambar'), async (req, res) => {
  try {
    const { judul, deskripsi } = req.body;
    const gambar = req.file ? '/uploads/' + req.file.filename : null;
    const result = await db.run(
      'INSERT INTO galeri (judul, gambar, deskripsi) VALUES (?, ?, ?)',
      [judul, gambar, deskripsi]
    );
    res.json({ id: result.lastInsertRowid, message: 'Galeri berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, upload.single('gambar'), async (req, res) => {
  try {
    const { judul, deskripsi } = req.body;
    if (req.file) {
      await db.run('UPDATE galeri SET judul=?, gambar=?, deskripsi=? WHERE id=?',
        [judul, '/uploads/' + req.file.filename, deskripsi, req.params.id]);
    } else {
      await db.run('UPDATE galeri SET judul=?, deskripsi=? WHERE id=?',
        [judul, deskripsi, req.params.id]);
    }
    res.json({ message: 'Galeri berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.run('DELETE FROM galeri WHERE id = ?', [req.params.id]);
    res.json({ message: 'Galeri berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
