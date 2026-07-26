const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const multer = require('multer');
const { uploadFile } = require('../config/supabase');

const upload = multer({ storage: multer.memoryStorage() });

// ====================== ACTIVITY LOG HELPER ======================
async function logActivity(userId, aksi, detail) {
  try {
    await db.run('INSERT INTO aktivitas_log (user_id, aksi, detail) VALUES (?, ?, ?)', [userId, aksi, detail || null]);
  } catch (_) {}
}

// ====================== RINGKASAN / DASHBOARD ======================
router.get('/ringkasan', auth, async (req, res) => {
  try {
    const saldo = await db.get("SELECT COALESCE(SUM(CASE WHEN tipe='pemasukan' THEN jumlah ELSE 0 END) - SUM(CASE WHEN tipe='pengeluaran' THEN jumlah ELSE 0 END),0) as saldo FROM transaksi WHERE status != 'ditolak'");
    const totalTransaksi = await db.get('SELECT COUNT(*) as total FROM transaksi');
    const perluVerifikasi = await db.get("SELECT COUNT(*) as total FROM transaksi WHERE status = 'draft'");
    const isPg = !!process.env.DATABASE_URL;
    const dateFn = isPg ? "to_char(created_at, 'YYYY-MM') = to_char(CURRENT_TIMESTAMP, 'YYYY-MM')" : "strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')";
    const bulanIni = await db.get(`SELECT COALESCE(SUM(CASE WHEN tipe='pemasukan' THEN jumlah ELSE 0 END),0) as pemasukan, COALESCE(SUM(CASE WHEN tipe='pengeluaran' THEN jumlah ELSE 0 END),0) as pengeluaran FROM transaksi WHERE ${dateFn} AND status != 'ditolak'`);
    res.json({ saldo: saldo?.saldo || 0, total: totalTransaksi?.total || 0, perluVerifikasi: perluVerifikasi?.total || 0, bulanIni: bulanIni || { pemasukan: 0, pengeluaran: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== TRANSAKSI ======================
router.get('/transaksi', auth, async (req, res) => {
  try {
    let sql = 'SELECT t.*, u.username as created_by_name, uv.username as diverifikasi_oleh_name, uk.username as dikunci_oleh_name FROM transaksi t LEFT JOIN users u ON t.created_by = u.id LEFT JOIN users uv ON t.diverifikasi_oleh = uv.id LEFT JOIN users uk ON t.dikunci_oleh = uk.id';
    const params = [];
    const conditions = [];
    if (req.query.status) { conditions.push('t.status = ?'); params.push(req.query.status); }
    if (req.query.tipe) { conditions.push('t.tipe = ?'); params.push(req.query.tipe); }
    if (req.query.kegiatan_id) { conditions.push('t.kegiatan_id = ?'); params.push(req.query.kegiatan_id); }
    if (req.query.search) { conditions.push('(t.deskripsi LIKE ? OR t.kategori LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    if (req.query.limit) { sql += ' ORDER BY t.created_at DESC LIMIT ?'; params.push(parseInt(req.query.limit)); }
    else { sql += ' ORDER BY t.created_at DESC'; }
    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transaksi', auth, upload.single('bukti'), async (req, res) => {
  try {
    const { tipe, kategori, jumlah, deskripsi, kegiatan_id } = req.body;
    if (!tipe || !kategori || !jumlah || !deskripsi) return res.status(400).json({ error: 'Lengkapi semua field wajib.' });
    const nominal = parseFloat(jumlah);
    if (isNaN(nominal) || nominal <= 0) return res.status(400).json({ error: 'Jumlah harus angka positif.' });
    let buktiUrl = null;
    if (req.file) buktiUrl = await uploadFile(req.file, 'bukti');
    const result = await db.run(
      'INSERT INTO transaksi (tipe, kategori, jumlah, deskripsi, kegiatan_id, bukti_url, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tipe, kategori, nominal, deskripsi, kegiatan_id || null, buktiUrl, 'draft', req.user.id]
    );
    await logActivity(req.user.id, 'tambah_transaksi', `Transaksi ${tipe} Rp${nominal} - ${deskripsi.substring(0, 50)}`);
    res.json({ id: result.lastInsertRowid, message: 'Transaksi berhasil ditambahkan (status: draft).' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transaksi/:id/verifikasi', auth, authorize('pengurus', 'bendahara', 'super_admin'), async (req, res) => {
  try {
    const tx = await db.get('SELECT * FROM transaksi WHERE id = ?', [req.params.id]);
    if (!tx) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (tx.status !== 'draft') return res.status(400).json({ error: 'Status transaksi saat ini bukan draft.' });
    if (tx.tipe === 'pengeluaran' && tx.jumlah > 500000) return res.status(400).json({ error: 'Pengeluaran > Rp500.000 membutuhkan 2 verifikatur. Gunakan endpoint verifikasi berjenjang.' });
    await db.run('UPDATE transaksi SET status = ?, diverifikasi_oleh = ?, diverifikasi_at = CURRENT_TIMESTAMP WHERE id = ?', ['diverifikasi', req.user.id, req.params.id]);
    await logActivity(req.user.id, 'verifikasi_transaksi', `Transaksi #${req.params.id} diverifikasi`);
    res.json({ message: 'Transaksi diverifikasi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transaksi/:id/setujui', auth, authorize('pengurus', 'bendahara', 'super_admin'), async (req, res) => {
  try {
    const tx = await db.get('SELECT * FROM transaksi WHERE id = ?', [req.params.id]);
    if (!tx) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (tx.status !== 'diverifikasi' && !(tx.status === 'draft' && tx.tipe === 'pengeluaran' && tx.jumlah > 500000)) {
      return res.status(400).json({ error: 'Transaksi harus diverifikasi dulu atau memerlukan persetujuan kedua.' });
    }
    if (tx.status === 'draft' && tx.tipe === 'pengeluaran' && tx.jumlah > 500000) {
      await db.run('UPDATE transaksi SET diverifikasi_oleh = ?, diverifikasi_at = CURRENT_TIMESTAMP WHERE id = ?', [req.user.id, req.params.id]);
      const count = await db.get('SELECT COUNT(*) as cnt FROM transaksi WHERE id = ? AND diverifikasi_oleh IS NOT NULL', [req.params.id]);
      if (count.cnt < 2) return res.json({ message: 'Verifikasi pertama diterima. Butuh 1 verifikatur lagi untuk pengeluaran > Rp500.000.' });
    }
    await db.run('UPDATE transaksi SET status = ?, diverifikasi_oleh = CASE WHEN diverifikasi_oleh IS NULL THEN ? ELSE diverifikasi_oleh END, diverifikasi_at = CURRENT_TIMESTAMP WHERE id = ?', ['diverifikasi', req.user.id, req.params.id]);
    await logActivity(req.user.id, 'setujui_transaksi', `Transaksi #${req.params.id} disetujui`);
    res.json({ message: 'Transaksi disetujui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transaksi/:id/kunci', auth, authorize('super_admin'), async (req, res) => {
  try {
    const tx = await db.get('SELECT * FROM transaksi WHERE id = ?', [req.params.id]);
    if (!tx) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (tx.status !== 'diverifikasi') return res.status(400).json({ error: 'Hanya transaksi yang sudah diverifikasi yang bisa dikunci.' });
    await db.run('UPDATE transaksi SET status = ?, dikunci_oleh = ?, dikunci_at = CURRENT_TIMESTAMP WHERE id = ?', ['terkunci', req.user.id, req.params.id]);
    await logActivity(req.user.id, 'kunci_transaksi', `Transaksi #${req.params.id} dikunci`);
    res.json({ message: 'Transaksi terkunci. Tidak bisa diubah/dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transaksi/:id/tolak', auth, authorize('pengurus', 'bendahara', 'super_admin'), async (req, res) => {
  try {
    const tx = await db.get('SELECT * FROM transaksi WHERE id = ?', [req.params.id]);
    if (!tx) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    if (tx.status !== 'draft' && tx.status !== 'diverifikasi') return res.status(400).json({ error: 'Transaksi tidak bisa ditolak pada status ini.' });
    await db.run('UPDATE transaksi SET status = ?, diverifikasi_oleh = ?, diverifikasi_at = CURRENT_TIMESTAMP WHERE id = ?', ['ditolak', req.user.id, req.params.id]);
    await logActivity(req.user.id, 'tolak_transaksi', `Transaksi #${req.params.id} ditolak`);
    res.json({ message: 'Transaksi ditolak.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transaksi/:id/koreksi', auth, upload.single('bukti'), authorize('bendahara', 'super_admin'), async (req, res) => {
  try {
    const tx = await db.get('SELECT * FROM transaksi WHERE id = ?', [req.params.id]);
    if (!tx) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    const { tipe, kategori, jumlah, deskripsi, kegiatan_id } = req.body;
    if (!tipe || !kategori || !jumlah || !deskripsi) return res.status(400).json({ error: 'Lengkapi semua field wajib.' });
    const nominal = parseFloat(jumlah);
    if (isNaN(nominal) || nominal <= 0) return res.status(400).json({ error: 'Jumlah harus angka positif.' });
    let buktiUrl = null;
    if (req.file) {
      buktiUrl = await uploadFile(req.file, 'bukti');
    } else {
      buktiUrl = tx.bukti_url;
    }
    const result = await db.run(
      'INSERT INTO transaksi (tipe, kategori, jumlah, deskripsi, kegiatan_id, bukti_url, status, created_by, koreksi_dari_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [tipe || tx.tipe, kategori || tx.kategori, nominal || tx.jumlah, deskripsi || tx.deskripsi, kegiatan_id || tx.kegiatan_id, buktiUrl, 'draft', req.user.id, tx.id]
    );
    await logActivity(req.user.id, 'koreksi_transaksi', `Koreksi transaksi #${req.params.id} -> #${result.lastInsertRowid}`);
    res.json({ id: result.lastInsertRowid, message: 'Koreksi berhasil dibuat sebagai transaksi baru. Menunggu verifikasi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== ANGGARAN ======================
router.get('/anggaran', auth, async (req, res) => {
  try {
    const rows = await db.query('SELECT a.*, p.judul as kegiatan_nama FROM anggaran a LEFT JOIN program p ON a.kegiatan_id = p.id ORDER BY a.created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/anggaran', auth, authorize('bendahara', 'super_admin'), async (req, res) => {
  try {
    const { kegiatan_id, judul, rencana, periode_bulan, periode_tahun } = req.body;
    if (!kegiatan_id || !judul || !rencana) return res.status(400).json({ error: 'Lengkapi field wajib.' });
    const result = await db.run('INSERT INTO anggaran (kegiatan_id, judul, rencana, periode_bulan, periode_tahun) VALUES (?, ?, ?, ?, ?)', [kegiatan_id, judul, parseFloat(rencana), periode_bulan || null, periode_tahun || null]);
    await logActivity(req.user.id, 'tambah_anggaran', `Anggaran ${judul} Rp${rencana}`);
    res.json({ id: result.lastInsertRowid, message: 'Anggaran berhasil dibuat.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/anggaran/:id', auth, authorize('bendahara', 'super_admin'), async (req, res) => {
  try {
    const { rencana } = req.body;
    await db.run('UPDATE anggaran SET rencana = ? WHERE id = ?', [parseFloat(rencana), req.params.id]);
    await logActivity(req.user.id, 'ubah_anggaran', `Anggaran #${req.params.id} diubah Rp${rencana}`);
    res.json({ message: 'Anggaran diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== IURAN ======================
router.get('/iuran', auth, async (req, res) => {
  try {
    const rows = await db.query('SELECT i.*, p.nama_lengkap as anggota_nama FROM iuran i LEFT JOIN pendaftar p ON i.anggota_id = p.id ORDER BY i.periode_tahun DESC, i.periode_bulan DESC, p.nama_lengkap ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/iuran', auth, authorize('bendahara', 'super_admin'), async (req, res) => {
  try {
    const { anggota_id, periode_bulan, periode_tahun, jumlah, transaksi_id } = req.body;
    if (!anggota_id || !periode_bulan || !periode_tahun || !jumlah) return res.status(400).json({ error: 'Lengkapi field wajib.' });
    const result = await db.run('INSERT INTO iuran (anggota_id, periode_bulan, periode_tahun, jumlah, status, transaksi_id, lunas_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(anggota_id, periode_bulan, periode_tahun) DO UPDATE SET status=?, transaksi_id=?, lunas_at=CURRENT_TIMESTAMP', [anggota_id, periode_bulan, periode_tahun, parseFloat(jumlah), 'lunas', transaksi_id || null, 'lunas', transaksi_id || null]);
    await logActivity(req.user.id, 'bayar_iuran', `Iuran anggota #${anggota_id} periode ${periode_bulan}/${periode_tahun}`);
    res.json({ id: result.lastInsertRowid, message: 'Iuran dicatat.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== KOMENTAR / TANYA-JAWAB ======================
router.get('/transaksi/:id/komentar', auth, async (req, res) => {
  try {
    const rows = await db.query('SELECT k.*, u.username as user_name FROM komentar_transaksi k LEFT JOIN users u ON k.user_id = u.id WHERE k.transaksi_id = ? ORDER BY k.created_at ASC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transaksi/:id/komentar', auth, async (req, res) => {
  try {
    const { pesan } = req.body;
    if (!pesan) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    const result = await db.run('INSERT INTO komentar_transaksi (transaksi_id, user_id, pesan) VALUES (?, ?, ?)', [req.params.id, req.user.id, pesan]);
    await logActivity(req.user.id, 'komentar', `Komentar transaksi #${req.params.id}`);
    res.json({ id: result.lastInsertRowid, message: 'Komentar ditambahkan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== AKTIVITAS LOG ======================
router.get('/log', auth, authorize('super_admin'), async (req, res) => {
  try {
    const rows = await db.query('SELECT l.*, u.username as user_name FROM aktivitas_log l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC LIMIT 100');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== LAPORAN (PUBLIK - no auth) ======================
router.get('/laporan/publik', async (req, res) => {
  try {
    const saldo = await db.get("SELECT COALESCE(SUM(CASE WHEN tipe='pemasukan' THEN jumlah ELSE 0 END) - SUM(CASE WHEN tipe='pengeluaran' THEN jumlah ELSE 0 END),0) as saldo FROM transaksi WHERE status = 'terkunci'");
    const transaksi = await db.query("SELECT tipe, kategori, jumlah, deskripsi, kegiatan_id, bukti_url, created_at FROM transaksi WHERE status = 'terkunci' ORDER BY created_at DESC LIMIT 50");
    const ringkasan = await db.get("SELECT COALESCE(SUM(CASE WHEN tipe='pemasukan' THEN jumlah ELSE 0 END),0) as total_pemasukan, COALESCE(SUM(CASE WHEN tipe='pengeluaran' THEN jumlah ELSE 0 END),0) as total_pengeluaran FROM transaksi WHERE status = 'terkunci'");
    res.json({ saldo: saldo?.saldo || 0, transaksi, ringkasan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== MANAJEMEN USER ======================
router.get('/users', auth, authorize('super_admin'), async (req, res) => {
  try {
    const rows = await db.query('SELECT id, username, role, display_name, created_at FROM users ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/role', auth, authorize('super_admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['anggota', 'pengurus', 'bendahara', 'super_admin'].includes(role)) return res.status(400).json({ error: 'Role tidak valid.' });
    await db.run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    await logActivity(req.user.id, 'ubah_role', `User #${req.params.id} -> ${role}`);
    res.json({ message: 'Role diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;