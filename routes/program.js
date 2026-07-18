const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM program ORDER BY tipe, created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { icon, judul, deskripsi, jadwal, tipe, tanggal_mulai, tanggal_selesai } = req.body;
    const result = await db.run(
      'INSERT INTO program (icon, judul, deskripsi, jadwal, tipe, tanggal_mulai, tanggal_selesai) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [icon || null, judul, deskripsi || null, jadwal || null, tipe || 'rutin', tanggal_mulai || null, tanggal_selesai || null]
    );
    res.json({ id: result.lastInsertRowid, message: 'Program berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { icon, judul, deskripsi, jadwal, tipe, tanggal_mulai, tanggal_selesai } = req.body;
    await db.run(
      'UPDATE program SET icon=?, judul=?, deskripsi=?, jadwal=?, tipe=?, tanggal_mulai=?, tanggal_selesai=? WHERE id=?',
      [icon, judul, deskripsi, jadwal, tipe, tanggal_mulai, tanggal_selesai, req.params.id]
    );
    res.json({ message: 'Program berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.run('DELETE FROM program WHERE id = ?', [req.params.id]);
    res.json({ message: 'Program berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
