const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM pendaftar ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nama_lengkap, usia, no_hp, alamat, pekerjaan, alasan_bergabung } = req.body;
    const result = await db.run(
      'INSERT INTO pendaftar (nama_lengkap, usia, no_hp, alamat, pekerjaan, alasan_bergabung) VALUES (?, ?, ?, ?, ?, ?)',
      [nama_lengkap, usia || null, no_hp || null, alamat || null, pekerjaan || null, alasan_bergabung || null]
    );
    res.json({ id: result.lastInsertRowid, message: 'Pendaftaran berhasil dikirim.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.run('DELETE FROM pendaftar WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pendaftar berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
