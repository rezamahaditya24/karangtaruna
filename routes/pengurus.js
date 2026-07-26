const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const { uploadFile } = require('../config/supabase');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM pengurus ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, upload.single('foto'), async (req, res) => {
  try {
    const { nama, jabatan } = req.body;
    let foto = null;
    if (req.file) {
      foto = await uploadFile(req.file, 'pengurus');
    }
    const result = await db.run(
      'INSERT INTO pengurus (nama, jabatan, foto) VALUES (?, ?, ?)',
      [nama, jabatan || null, foto]
    );
    res.json({ id: result.lastInsertRowid, message: 'Pengurus berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, upload.single('foto'), async (req, res) => {
  try {
    const { nama, jabatan } = req.body;
    let foto = req.body.foto;
    if (req.file) {
      foto = await uploadFile(req.file, 'pengurus');
    }
    await db.run(
      'UPDATE pengurus SET nama=?, jabatan=?, foto=? WHERE id=?',
      [nama, jabatan, foto, req.params.id]
    );
    res.json({ message: 'Pengurus berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.run('DELETE FROM pengurus WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pengurus berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;