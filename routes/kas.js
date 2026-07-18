const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const transaksi = await db.query('SELECT * FROM kas ORDER BY tanggal DESC');
    const ringkasan = await db.get(
      "SELECT COALESCE(SUM(pemasukan),0) as total_pemasukan, COALESCE(SUM(pengeluaran),0) as total_pengeluaran, COUNT(*) as jumlah_transaksi FROM kas"
    );
    const saldoRow = await db.get(
      "SELECT COALESCE(SUM(pemasukan)-SUM(pengeluaran),0) as saldo FROM kas"
    );
    res.json({ transaksi, ringkasan, saldo: saldoRow ? saldoRow.saldo : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { tanggal, deskripsi, kategori, pemasukan, pengeluaran } = req.body;
    const result = await db.run(
      'INSERT INTO kas (tanggal, deskripsi, kategori, pemasukan, pengeluaran) VALUES (?, ?, ?, ?, ?)',
      [tanggal, deskripsi || null, kategori || null, pemasukan || 0, pengeluaran || 0]
    );
    res.json({ id: result.lastInsertRowid, message: 'Transaksi berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { tanggal, deskripsi, kategori, pemasukan, pengeluaran } = req.body;
    await db.run(
      'UPDATE kas SET tanggal=?, deskripsi=?, kategori=?, pemasukan=?, pengeluaran=? WHERE id=?',
      [tanggal, deskripsi, kategori, pemasukan, pengeluaran, req.params.id]
    );
    res.json({ message: 'Transaksi berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.run('DELETE FROM kas WHERE id = ?', [req.params.id]);
    res.json({ message: 'Transaksi berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
