const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM umkm ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { nama_usaha, pemilik, kategori, deskripsi, no_hp, gambar } = req.body;
    const result = await db.run(
      'INSERT INTO umkm (nama_usaha, pemilik, kategori, deskripsi, no_hp, gambar) VALUES (?, ?, ?, ?, ?, ?)',
      [nama_usaha, pemilik || null, kategori || null, deskripsi || null, no_hp || null, gambar || null]
    );
    res.json({ id: result.lastInsertRowid, message: 'UMKM berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { nama_usaha, pemilik, kategori, deskripsi, no_hp, gambar } = req.body;
    await db.run(
      'UPDATE umkm SET nama_usaha=?, pemilik=?, kategori=?, deskripsi=?, no_hp=?, gambar=? WHERE id=?',
      [nama_usaha, pemilik, kategori, deskripsi, no_hp, gambar, req.params.id]
    );
    res.json({ message: 'UMKM berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.run('DELETE FROM umkm WHERE id = ?', [req.params.id]);
    res.json({ message: 'UMKM berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
