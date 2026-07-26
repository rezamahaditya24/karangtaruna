import { createClient } from '../../config/supabase-rest.js';
import { authenticate, signJWT, hashPassword, verifyPassword, authorize, migratePassword } from '../../config/auth-cf.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function error(msg, status = 400) {
  return json({ error: msg }, status);
}

async function parseBody(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const fd = await request.formData();
    const body = {};
    let file = null;
    for (const [k, v] of fd.entries()) {
      if (v instanceof File) { file = { name: k, file: v }; }
      else body[k] = v;
    }
    return { body, file };
  }
  if (ct.includes('application/json')) {
    return { body: await request.json(), file: null };
  }
  const text = await request.text();
  try { return { body: JSON.parse(text), file: null }; }
  catch { return { body: {}, file: null }; }
}

async function uploadToSupabase(file, folder, env) {
  if (!file) return null;
  const buf = await file.file.arrayBuffer();
  const ext = file.file.name?.substring(file.file.name.lastIndexOf('.')) || '.jpg';
  const filename = `${folder}/${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/karangtaruna/${filename}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': file.file.type || 'application/octet-stream'
    },
    body: buf
  });
  if (!res.ok) throw new Error(`Gagal upload: ${res.status} ${await res.text()}`);
  return `${env.SUPABASE_URL}/storage/v1/object/public/karangtaruna/${filename}`;
}

function log(s) { console.log('[api]', s); }

// ===================== ON REQUEST =====================
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const method = request.method;
  const supabase = createClient(env);

  try {
    // ===================== AUTH =====================
    if (path === 'auth/login' && method === 'POST') {
      const { body } = await parseBody(request);
      const { username, password } = body;
      if (!username || !password) return error('Username dan password wajib diisi.');
      const user = await supabase.get('users', { username: `eq.${username.toLowerCase()}` });
      if (!user) return error('Username atau password salah.', 400);
      let valid = await verifyPassword(password, user.password);
      if (!valid) return error('Username atau password salah.', 400);
      const migrated = await migratePassword(password, user.password, supabase, user.id);
      if (migrated) log(`Password migrated for user #${user.id} (${user.username})`);
      const token = await signJWT({ id: user.id, username: user.username, role: user.role || 'anggota' }, env.JWT_SECRET);
      return json({ token, username: user.username });
    }

    // Auth middleware for protected routes
    let user = null;
    const protectedPaths = ['berita', 'galeri', 'program', 'umkm', 'kas', 'pengurus', 'pendaftar', 'keuangan', 'transaksi', 'anggaran', 'iuran', 'users', 'log'];
    const isProtected = protectedPaths.some(p => path === p || path.startsWith(p + '/'));
    if (isProtected) {
      try { user = await authenticate(request, env); }
      catch (e) { return error(e.message, 401); }
    }

    // Helper: get user for request
    const reqUser = () => user;

    // ===================== BERITA =====================
    if (path.startsWith('berita')) {
      if (method === 'GET') {
        const rows = await supabase.query('berita', { order: 'tanggal.desc' });
        return json(rows);
      }
      if (method === 'POST') {
        const { body, file } = await parseBody(request);
        let gambar = body.gambar || null;
        if (file) gambar = await uploadToSupabase(file, 'berita', env);
        const row = await supabase.insert('berita', { judul: body.judul, isi: body.isi, tanggal: body.tanggal || new Date().toISOString().split('T')[0], gambar, status: body.status || 'publish' });
        return json({ id: row.id, message: 'Berita berhasil ditambahkan.' });
      }
      const id = path.split('/')[1];
      if (!id) return error('ID diperlukan');
      if (method === 'PUT') {
        const { body, file } = await parseBody(request);
        let gambar = body.gambar;
        if (file) gambar = await uploadToSupabase(file, 'berita', env);
        await supabase.update('berita', { judul: body.judul, isi: body.isi, tanggal: body.tanggal, gambar, status: body.status }, { id: `eq.${id}` });
        return json({ message: 'Berita berhasil diperbarui.' });
      }
      if (method === 'DELETE') {
        await supabase.remove('berita', { id: `eq.${id}` });
        return json({ message: 'Berita berhasil dihapus.' });
      }
    }

    // ===================== GALERI =====================
    if (path.startsWith('galeri')) {
      if (method === 'GET') {
        const rows = await supabase.query('galeri', { order: 'created_at.desc' });
        return json(rows);
      }
      if (method === 'POST') {
        const { body, file } = await parseBody(request);
        if (!file) return error('File gambar diperlukan.');
        const gambar = await uploadToSupabase(file, 'galeri', env);
        const row = await supabase.insert('galeri', { judul: body.judul || '', gambar, deskripsi: body.deskripsi || '' });
        return json({ id: row.id, message: 'Galeri berhasil ditambahkan.' });
      }
      const id = path.split('/')[1];
      if (!id) return error('ID diperlukan');
      if (method === 'PUT') {
        const { body, file } = await parseBody(request);
        if (file) {
          const gambar = await uploadToSupabase(file, 'galeri', env);
          await supabase.update('galeri', { judul: body.judul, gambar, deskripsi: body.deskripsi }, { id: `eq.${id}` });
        } else {
          await supabase.update('galeri', { judul: body.judul, deskripsi: body.deskripsi }, { id: `eq.${id}` });
        }
        return json({ message: 'Galeri berhasil diperbarui.' });
      }
      if (method === 'DELETE') {
        await supabase.remove('galeri', { id: `eq.${id}` });
        return json({ message: 'Galeri berhasil dihapus.' });
      }
    }

    // ===================== PROGRAM =====================
    if (path.startsWith('program')) {
      if (method === 'GET') {
        const rows = await supabase.query('program', { order: 'created_at.desc' });
        return json(rows);
      }
      if (method === 'POST') {
        const { body } = await parseBody(request);
        if (!body.judul) return error('Judul program wajib diisi.');
        const row = await supabase.insert('program', { judul: body.judul, deskripsi: body.deskripsi, tipe: body.tipe || 'rutin', jadwal: body.jadwal, icon: body.icon });
        return json({ id: row.id, message: 'Program berhasil ditambahkan.' });
      }
      const id = path.split('/')[1];
      if (!id) return error('ID diperlukan');
      if (method === 'PUT') {
        const { body } = await parseBody(request);
        await supabase.update('program', { judul: body.judul, deskripsi: body.deskripsi, tipe: body.tipe, jadwal: body.jadwal, icon: body.icon }, { id: `eq.${id}` });
        return json({ message: 'Program berhasil diperbarui.' });
      }
      if (method === 'DELETE') {
        await supabase.remove('program', { id: `eq.${id}` });
        return json({ message: 'Program berhasil dihapus.' });
      }
    }

    // ===================== UMKM =====================
    if (path.startsWith('umkm')) {
      if (method === 'GET') {
        const rows = await supabase.query('umkm', { order: 'created_at.desc' });
        return json(rows);
      }
      if (method === 'POST') {
        const { body } = await parseBody(request);
        if (!body.nama_usaha) return error('Nama usaha wajib diisi.');
        const row = await supabase.insert('umkm', { nama_usaha: body.nama_usaha, pemilik: body.pemilik, kategori: body.kategori, deskripsi: body.deskripsi, no_hp: body.no_hp, alamat: body.alamat });
        return json({ id: row.id, message: 'UMKM berhasil ditambahkan.' });
      }
      const id = path.split('/')[1];
      if (!id) return error('ID diperlukan');
      if (method === 'PUT') {
        const { body } = await parseBody(request);
        await supabase.update('umkm', { nama_usaha: body.nama_usaha, pemilik: body.pemilik, kategori: body.kategori, deskripsi: body.deskripsi, no_hp: body.no_hp, alamat: body.alamat }, { id: `eq.${id}` });
        return json({ message: 'UMKM berhasil diperbarui.' });
      }
      if (method === 'DELETE') {
        await supabase.remove('umkm', { id: `eq.${id}` });
        return json({ message: 'UMKM berhasil dihapus.' });
      }
    }

    // ===================== KAS =====================
    if (path.startsWith('kas')) {
      if (method === 'GET') {
        const transaksi = await supabase.query('kas', { order: 'created_at.desc' });
        const all = await supabase.query('kas');
        const totalPemasukan = all.reduce((s, r) => s + parseFloat(r.pemasukan || 0), 0);
        const totalPengeluaran = all.reduce((s, r) => s + parseFloat(r.pengeluaran || 0), 0);
        return json({ transaksi, saldo: totalPemasukan - totalPengeluaran, ringkasan: { total_pemasukan: totalPemasukan, total_pengeluaran: totalPengeluaran, jumlah_transaksi: all.length } });
      }
      if (method === 'POST') {
        const { body } = await parseBody(request);
        const row = await supabase.insert('kas', { tanggal: body.tanggal, deskripsi: body.deskripsi, kategori: body.kategori, pemasukan: parseFloat(body.pemasukan) || 0, pengeluaran: parseFloat(body.pengeluaran) || 0 });
        return json({ message: 'Transaksi berhasil ditambahkan.' });
      }
      const id = path.split('/')[1];
      if (!id) return error('ID diperlukan');
      if (method === 'PUT') {
        const { body } = await parseBody(request);
        await supabase.update('kas', { tanggal: body.tanggal, deskripsi: body.deskripsi, kategori: body.kategori, pemasukan: parseFloat(body.pemasukan) || 0, pengeluaran: parseFloat(body.pengeluaran) || 0 }, { id: `eq.${id}` });
        return json({ message: 'Transaksi berhasil diperbarui.' });
      }
      if (method === 'DELETE') {
        await supabase.remove('kas', { id: `eq.${id}` });
        return json({ message: 'Transaksi berhasil dihapus.' });
      }
    }

    // ===================== PENGURUS =====================
    if (path.startsWith('pengurus')) {
      if (method === 'GET') {
        const rows = await supabase.query('pengurus', { order: 'id.asc' });
        return json(rows);
      }
      if (method === 'POST') {
        const { body, file } = await parseBody(request);
        let foto = null;
        if (file) foto = await uploadToSupabase(file, 'pengurus', env);
        const row = await supabase.insert('pengurus', { nama: body.nama, jabatan: body.jabatan, foto });
        return json({ id: row.id, message: 'Pengurus berhasil ditambahkan.' });
      }
      const id = path.split('/')[1];
      if (!id) return error('ID diperlukan');
      if (method === 'PUT') {
        const { body, file } = await parseBody(request);
        let foto = body.foto;
        if (file) foto = await uploadToSupabase(file, 'pengurus', env);
        await supabase.update('pengurus', { nama: body.nama, jabatan: body.jabatan, foto }, { id: `eq.${id}` });
        return json({ message: 'Pengurus berhasil diperbarui.' });
      }
      if (method === 'DELETE') {
        await supabase.remove('pengurus', { id: `eq.${id}` });
        return json({ message: 'Pengurus berhasil dihapus.' });
      }
    }

    // ===================== PENDAFTAR =====================
    if (path.startsWith('pendaftar')) {
      if (method === 'GET') {
        const rows = await supabase.query('pendaftar', { order: 'created_at.desc' });
        return json(rows);
      }
      if (method === 'DELETE') {
        const id = path.split('/')[1];
        if (!id) return error('ID diperlukan');
        await supabase.remove('pendaftar', { id: `eq.${id}` });
        return json({ message: 'Pendaftar berhasil dihapus.' });
      }
      return json(await supabase.query('pendaftar', { order: 'created_at.desc' }));
    }

    // ===================== KEUANGAN =====================
    if (path.startsWith('keuangan') || path.startsWith('transaksi') || path.startsWith('anggaran') || path.startsWith('iuran') || path.startsWith('users') || path.startsWith('log')) {
      const keuPath = path.replace(/^keuangan\//, '');
      const segments = keuPath.split('/');

      // --- RINGKASAN ---
      if (keuPath === 'ringkasan') {
        const all = await supabase.query('transaksi');
        const saldo = all.filter(t => t.status !== 'ditolak').reduce((s, t) => s + (t.tipe === 'pemasukan' ? parseFloat(t.jumlah) : -parseFloat(t.jumlah)), 0);
        const now = new Date();
        const bulanIni = all.filter(t => {
          const d = new Date(t.created_at);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.status !== 'ditolak';
        });
        const pemasukan = bulanIni.filter(t => t.tipe === 'pemasukan').reduce((s, t) => s + parseFloat(t.jumlah), 0);
        const pengeluaran = bulanIni.filter(t => t.tipe === 'pengeluaran').reduce((s, t) => s + parseFloat(t.jumlah), 0);
        const perluVerifikasi = all.filter(t => t.status === 'draft').length;
        return json({ saldo, total: all.length, perluVerifikasi, bulanIni: { pemasukan, pengeluaran } });
      }

      // --- LOG ---
      if (keuPath === 'log') {
        authorize(['super_admin'], user);
        const rows = await supabase.query('aktivitas_log', { order: 'created_at.desc', limit: '100' });
        const enriched = await Promise.all(rows.map(async (r) => {
          const u = r.user_id ? await supabase.get('users', { id: `eq.${r.user_id}` }) : null;
          return { ...r, user_name: u?.username || '-' };
        }));
        return json(enriched);
      }

      // --- USERS ---
      if (keuPath === 'users') {
        if (method === 'GET') {
          authorize(['super_admin'], user);
          const rows = await supabase.query('users', { select: 'id,username,role,display_name,created_at', order: 'id.asc' });
          return json(rows);
        }
        const uid = segments[1];
        if (uid && method === 'PUT' && keuPath.endsWith('/role')) {
          authorize(['super_admin'], user);
          const { body } = await parseBody(request);
          if (!['anggota', 'pengurus', 'bendahara', 'super_admin'].includes(body.role)) return error('Role tidak valid.');
          await supabase.update('users', { role: body.role }, { id: `eq.${uid}` });
          return json({ message: 'Role diperbarui.' });
        }
      }

      // --- TRANSAKSI ---
      if (segments[0] === 'transaksi') {
        const id = segments[1];

        // GET /transaksi
        if (!id && method === 'GET') {
          const tipe = url.searchParams.get('tipe');
          const status = url.searchParams.get('status');
          const kegiatanId = url.searchParams.get('kegiatan_id');
          const search = url.searchParams.get('search');
          const limit = url.searchParams.get('limit');
          const filters = { order: 'created_at.desc' };
          if (tipe) filters.tipe = `eq.${tipe}`;
          if (status) filters.status = `eq.${status}`;
          if (kegiatanId) filters.kegiatan_id = `eq.${kegiatanId}`;
          if (limit) filters.limit = limit;
          let rows = await supabase.query('transaksi', filters);
          if (search) {
            const q = search.toLowerCase();
            rows = rows.filter(r => r.deskripsi?.toLowerCase().includes(q) || r.kategori?.toLowerCase().includes(q));
          }
          const enriched = await Promise.all(rows.map(async (r) => {
            const cb = r.created_by ? await supabase.get('users', { id: `eq.${r.created_by}` }) : null;
            const dv = r.diverifikasi_oleh ? await supabase.get('users', { id: `eq.${r.diverifikasi_oleh}` }) : null;
            const dk = r.dikunci_oleh ? await supabase.get('users', { id: `eq.${r.dikunci_oleh}` }) : null;
            return { ...r, created_by_name: cb?.username || null, diverifikasi_oleh_name: dv?.username || null, dikunci_oleh_name: dk?.username || null };
          }));
          return json(enriched);
        }

        // POST /transaksi
        if (!id && method === 'POST') {
          const { body, file } = await parseBody(request);
          if (!body.tipe || !body.kategori || !body.jumlah || !body.deskripsi) return error('Lengkapi semua field wajib.');
          const nominal = parseFloat(body.jumlah);
          if (isNaN(nominal) || nominal <= 0) return error('Jumlah harus angka positif.');
          let buktiUrl = null;
          if (file) buktiUrl = await uploadToSupabase(file, 'bukti', env);
          const row = await supabase.insert('transaksi', { tipe: body.tipe, kategori: body.kategori, jumlah: nominal, deskripsi: body.deskripsi, kegiatan: body.kegiatan || null, bukti_url: buktiUrl, status: 'draft', created_by: user.id });
          return json({ id: row.id, message: 'Transaksi berhasil ditambahkan (status: draft).' });
        }

        if (!id) return error('ID diperlukan');

        // Actions
        const action = segments[2];

        if (action === 'verifikasi') {
          authorize(['pengurus', 'bendahara', 'super_admin'], user);
          const tx = await supabase.get('transaksi', { id: `eq.${id}` });
          if (!tx) return error('Transaksi tidak ditemukan.', 404);
          if (tx.status !== 'draft') return error('Status transaksi saat ini bukan draft.');
          if (tx.tipe === 'pengeluaran' && parseFloat(tx.jumlah) > 500000) return error('Pengeluaran > Rp500.000 membutuhkan 2 verifikatur.');
          await supabase.update('transaksi', { status: 'diverifikasi', diverifikasi_oleh: user.id, diverifikasi_at: new Date().toISOString() }, { id: `eq.${id}` });
          return json({ message: 'Transaksi diverifikasi.' });
        }

        if (action === 'setujui') {
          authorize(['pengurus', 'bendahara', 'super_admin'], user);
          const tx = await supabase.get('transaksi', { id: `eq.${id}` });
          if (!tx) return error('Transaksi tidak ditemukan.', 404);
          if (tx.status !== 'diverifikasi' && !(tx.status === 'draft' && tx.tipe === 'pengeluaran' && parseFloat(tx.jumlah) > 500000)) {
            return error('Transaksi harus diverifikasi dulu atau memerlukan persetujuan kedua.');
          }
          await supabase.update('transaksi', { diverifikasi_oleh: user.id, diverifikasi_at: new Date().toISOString() }, { id: `eq.${id}` });
          const updated = await supabase.get('transaksi', { id: `eq.${id}` });
          if (updated.tipe === 'pengeluaran' && parseFloat(updated.jumlah) > 500000 && !updated.diverifikasi_oleh) {
            return json({ message: 'Verifikasi pertama diterima. Butuh 1 verifikatur lagi.' });
          }
          await supabase.update('transaksi', { status: 'diverifikasi' }, { id: `eq.${id}` });
          return json({ message: 'Transaksi disetujui.' });
        }

        if (action === 'kunci') {
          authorize(['super_admin'], user);
          const tx = await supabase.get('transaksi', { id: `eq.${id}` });
          if (!tx) return error('Transaksi tidak ditemukan.', 404);
          if (tx.status !== 'diverifikasi') return error('Hanya transaksi yang sudah diverifikasi yang bisa dikunci.');
          await supabase.update('transaksi', { status: 'terkunci', dikunci_oleh: user.id, dikunci_at: new Date().toISOString() }, { id: `eq.${id}` });
          return json({ message: 'Transaksi terkunci. Tidak bisa diubah/dihapus.' });
        }

        if (action === 'tolak') {
          authorize(['pengurus', 'bendahara', 'super_admin'], user);
          const tx = await supabase.get('transaksi', { id: `eq.${id}` });
          if (!tx) return error('Transaksi tidak ditemukan.', 404);
          if (tx.status !== 'draft' && tx.status !== 'diverifikasi') return error('Transaksi tidak bisa ditolak pada status ini.');
          await supabase.update('transaksi', { status: 'ditolak', diverifikasi_oleh: user.id, diverifikasi_at: new Date().toISOString() }, { id: `eq.${id}` });
          return json({ message: 'Transaksi ditolak.' });
        }

        if (action === 'koreksi') {
          authorize(['bendahara', 'super_admin'], user);
          const tx = await supabase.get('transaksi', { id: `eq.${id}` });
          if (!tx) return error('Transaksi tidak ditemukan.', 404);
          const { body, file } = await parseBody(request);
          if (!body.tipe || !body.kategori || !body.jumlah || !body.deskripsi) return error('Lengkapi semua field wajib.');
          const nominal = parseFloat(body.jumlah);
          if (isNaN(nominal) || nominal <= 0) return error('Jumlah harus angka positif.');
          let buktiUrl = tx.bukti_url;
          if (file) buktiUrl = await uploadToSupabase(file, 'bukti', env);
          const row = await supabase.insert('transaksi', { tipe: body.tipe || tx.tipe, kategori: body.kategori || tx.kategori, jumlah: nominal || tx.jumlah, deskripsi: body.deskripsi || tx.deskripsi, kegiatan: body.kegiatan || tx.kegiatan, bukti_url: buktiUrl, status: 'draft', created_by: user.id, koreksi_dari_id: parseInt(id) });
          return json({ id: row.id, message: 'Koreksi berhasil dibuat sebagai transaksi baru. Menunggu verifikasi.' });
        }

        // Komentar
        if (action === 'komentar') {
          if (method === 'GET') {
            const rows = await supabase.query('komentar_transaksi', { transaksi_id: `eq.${id}`, order: 'created_at.asc' });
            const enriched = await Promise.all(rows.map(async (r) => {
              const u = r.user_id ? await supabase.get('users', { id: `eq.${r.user_id}` }) : null;
              return { ...r, user_name: u?.username || '-' };
            }));
            return json(enriched);
          }
          if (method === 'POST') {
            const { body } = await parseBody(request);
            if (!body.pesan) return error('Pesan tidak boleh kosong.');
            const row = await supabase.insert('komentar_transaksi', { transaksi_id: parseInt(id), user_id: user.id, pesan: body.pesan });
            return json({ id: row.id, message: 'Komentar ditambahkan.' });
          }
        }

        return error('Action tidak dikenal.', 404);
      }

      // --- ANGGARAN ---
      if (segments[0] === 'anggaran') {
        const id = segments[1];
        if (!id && method === 'GET') {
          const rows = await supabase.query('anggaran', { order: 'created_at.desc' });
          const enriched = await Promise.all(rows.map(async (a) => {
            const p = a.kegiatan_id ? await supabase.get('program', { id: `eq.${a.kegiatan_id}` }) : null;
            return { ...a, kegiatan_nama: p?.judul || null };
          }));
          const realisasi = await supabase.query('transaksi');
          return json(enriched.map(a => ({
            ...a, realisasi: parseFloat(realisasi.filter(t => t.kegiatan === a.kegiatan || t.kegiatan_id === a.kegiatan_id && t.status === 'terkunci').reduce((s, t) => s + parseFloat(t.jumlah), 0) || 0)
          })));
        }
        if (!id && method === 'POST') {
          authorize(['bendahara', 'super_admin'], user);
          const { body } = await parseBody(request);
          if (!body.judul || !body.rencana) return error('Lengkapi field wajib.');
          const row = await supabase.insert('anggaran', { kegiatan: body.kegiatan || null, judul: body.judul, rencana: parseFloat(body.rencana), periode_bulan: body.periode_bulan || null, periode_tahun: body.periode_tahun || null });
          return json({ id: row.id, message: 'Anggaran berhasil dibuat.' });
        }
        if (id && method === 'PUT') {
          authorize(['bendahara', 'super_admin'], user);
          const { body } = await parseBody(request);
          if (!body.rencana) return error('Rencana anggaran diperlukan.');
          await supabase.update('anggaran', { rencana: parseFloat(body.rencana) }, { id: `eq.${id}` });
          return json({ message: 'Anggaran diperbarui.' });
        }
      }

      // --- IURAN ---
      if (segments[0] === 'iuran') {
        if (method === 'GET') {
          const rows = await supabase.query('iuran', { order: 'periode_tahun.desc,periode_bulan.desc' });
          const enriched = await Promise.all(rows.map(async (i) => {
            const p = i.anggota_id ? await supabase.get('pendaftar', { id: `eq.${i.anggota_id}` }) : null;
            return { ...i, anggota_nama: p?.nama_lengkap || null };
          }));
          return json(enriched);
        }
        if (method === 'POST') {
          authorize(['bendahara', 'super_admin'], user);
          const { body } = await parseBody(request);
          if (!body.anggota_id || !body.periode_bulan || !body.periode_tahun || !body.jumlah) return error('Lengkapi field wajib.');
          const existing = await supabase.get('iuran', { anggota_id: `eq.${body.anggota_id}`, periode_bulan: `eq.${body.periode_bulan}`, periode_tahun: `eq.${body.periode_tahun}` });
          if (existing) {
            await supabase.update('iuran', { status: 'lunas', jumlah: parseFloat(body.jumlah), transaksi_id: body.transaksi_id || null, lunas_at: new Date().toISOString() }, { id: `eq.${existing.id}` });
            return json({ id: existing.id, message: 'Iuran dicatat.' });
          }
          const row = await supabase.insert('iuran', { anggota_id: parseInt(body.anggota_id), periode_bulan: parseInt(body.periode_bulan), periode_tahun: parseInt(body.periode_tahun), jumlah: parseFloat(body.jumlah), status: 'lunas', transaksi_id: body.transaksi_id || null, lunas_at: new Date().toISOString() });
          return json({ id: row.id, message: 'Iuran dicatat.' });
        }
      }

      // --- LAPORAN PUBLIK ---
      if (keuPath === 'laporan/publik') {
        const all = await supabase.query('transaksi', { status: `eq.terkunci`, order: 'created_at.desc', limit: '50' });
        const saldo = all.reduce((s, t) => s + (t.tipe === 'pemasukan' ? parseFloat(t.jumlah) : -parseFloat(t.jumlah)), 0);
        const totalPemasukan = all.filter(t => t.tipe === 'pemasukan').reduce((s, t) => s + parseFloat(t.jumlah), 0);
        const totalPengeluaran = all.filter(t => t.tipe === 'pengeluaran').reduce((s, t) => s + parseFloat(t.jumlah), 0);
        return json({ saldo, transaksi: all, ringkasan: { total_pemasukan: totalPemasukan, total_pengeluaran: totalPengeluaran } });
      }
    }

    return error('Route tidak ditemukan.', 404);

  } catch (err) {
    log('Error: ' + err.message);
    return error(err.message, 500);
  }
}