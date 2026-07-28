const express = require('express');
const router = express.Router();

router.use(express.json());

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  // Local mock: accept admin/Admin123 for quick local testing
  if (username.toLowerCase() === 'admin' && password === 'Admin123') {
    try {
      const mod = await import('../config/auth-cf.js');
      const token = await mod.signJWT({ id: 1, username: 'admin', role: 'super_admin' }, process.env.JWT_SECRET || 'devsecret');
      return res.json({ token, username: 'admin', role: 'super_admin' });
    } catch (e) {
      return res.status(500).json({ error: 'Gagal membuat token.' });
    }
  }
  return res.status(400).json({ error: 'Username atau password salah.' });
});

router.get('/me', async (req, res) => {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Akses ditolak. Silakan login terlebih dahulu.' });
  const token = auth.slice(7);
  try {
    const mod = await import('../config/auth-cf.js');
    const payload = await mod.verifyJWT(token, process.env.JWT_SECRET || 'devsecret');
    return res.json({ username: payload.username, role: payload.role || 'anggota', display_name: payload.display_name || '' });
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }
});

module.exports = router;
