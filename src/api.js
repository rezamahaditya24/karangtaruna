import { createClient } from '../config/supabase-rest.js';
import { authenticate, signJWT, verifyPassword, authorize, authorizeCreate, authorizeModify, migratePassword, hashPassword } from '../config/auth-cf.js';

let localEnvLoaded = false;
async function loadLocalEnv() {
  if (typeof process !== 'undefined' && process.env && !localEnvLoaded) {
    try {
      const dotenv = await import('dotenv');
      dotenv.config();
    } catch (e) {
      // ignore if dotenv is unavailable in Workers environment
    }
    localEnvLoaded = true;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }
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
      if (v instanceof File) file = { name: k, file: v };
      else body[k] = v;
    }
    return { body, file };
  }
  if (ct.includes('application/json')) return { body: await request.json(), file: null };
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
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': file.file.type || 'application/octet-stream' },
    body: buf
  });
  if (!res.ok) throw new Error(`Gagal upload: ${res.status} ${await res.text()}`);
  return `${env.SUPABASE_URL}/storage/v1/object/public/karangtaruna/${filename}`;
}

function getSegments(path) {
  return path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
}

function isCreateEndpoint(segments) {
  const [first, second] = segments;
  if (segments.length === 1 && ['berita', 'galeri', 'program', 'umkm', 'kas', 'pengurus', 'pendaftar'].includes(first)) return true;
  if (segments.length === 2 && first === 'keuangan' && ['transaksi', 'anggaran', 'iuran'].includes(second)) return true;
  return false;
}

function isKeuanganCommentRoute(segments) {
  return segments[0] === 'keuangan' && segments[1] === 'transaksi' && segments[2] === 'komentar';
}

export async function handleAPI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const segments = getSegments(path);
  const supabase = createClient(env);

  await loadLocalEnv();
  let body = {}, file = null;
  if (method === 'POST' || method === 'PUT') {
    const parsed = await parseBody(request);
    body = parsed.body;
    file = parsed.file;
  }

  const publicTables = ['berita', 'galeri', 'program', 'umkm', 'kas', 'pengurus'];
  const adminTables = ['pendaftar', 'keuangan', 'transaksi', 'anggaran', 'iuran', 'users', 'log'];
  let user = null;
  const isPublicRegister = segments[0] === 'pendaftar' && method === 'POST';
  const isPublicGet = publicTables.includes(segments[0]) && method === 'GET';
  const isAuthRoute = segments[0] === 'auth';
  if (!isAuthRoute && !isPublicGet && !isPublicRegister) {
    try { user = await authenticate(request, env); }
    catch (e) { return error(e.message, 401); }
  }

  const s = segments.slice(1);
  if (user && method !== 'GET') {
    if (isKeuanganCommentRoute(segments)) {
      // Allow all authenticated users to comment on transaksi.
    } else if (method === 'POST') {
      if (isCreateEndpoint(segments)) {
        authorizeCreate(user, segments[0], s[0]);
      }
    } else if (method === 'PUT' || method === 'DELETE') {
      authorizeModify(user);
    }
  }

  // ===================== AI CHAT =====================
  if (segments[0] === 'ai' && segments[1] === 'chat' && method === 'POST') {
    try { user = await authenticate(request, env); } catch (e) { return error(e.message, 401); }
    if (!body.message) return error('Pesan tidak boleh kosong.');
    const geminiKey = env.GEMINI_API_KEY || (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || '';
    const geminiModel = env.GEMINI_MODEL || (typeof process !== 'undefined' && process.env?.GEMINI_MODEL) || 'gemini-2.5-flash';
    if (!geminiKey) {
      return error('AI tidak dapat digunakan karena GEMINI_API_KEY belum diatur. Silakan tambahkan GEMINI_API_KEY di .env atau secret Cloudflare Workers.', 500);
    }
    const systemPrompt = `Anda adalah asisten AI untuk panel admin Karang Taruna Manunggal Bhakti. 
Anda membantu admin mengelola:
- Berita: menulis judul dan isi berita
- Galeri: menulis deskripsi foto
- Program: mendeskripsikan program kerja
- UMKM: mendeskripsikan usaha
- Pengurus: menulis profil pengurus
- Kas/Keuangan: analisis keuangan sederhana
- Pendaftar: membantu verifikasi

Halaman yang tersedia: Dashboard, Berita, Galeri, Program Kerja, UMKM, Kas, Pengurus, Pendaftar, Keuangan (Transaksi, Anggaran, Iuran, Log, Manajemen User).

Jawab dengan bahasa Indonesia yang ramah dan profesional. Berikan saran yang konkret dan bisa langsung digunakan.`;

    const modelName = geminiModel.trim() || 'gemini-2.5-flash';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nPertanyaan admin: ${body.message}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      let parsedError = null;
      try { parsedError = JSON.parse(errText); } catch (e) { }
      const apiMessage = parsedError?.error?.message || errText || `Status ${res.status}`;
      if (res.status === 429) {
        return error(`AI tidak dapat diproses saat ini karena kuota habis pada model ${modelName}. Silakan coba model lain dengan mengatur GEMINI_MODEL di .env atau cek batasan kuota.`, 429);
      }
      return error(`AI error: ${apiMessage}`, res.status);
    }
    const data = await res.json();
    const reply = data?.candidates?.[0]?.output || data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.candidates?.[0]?.content?.[0]?.text || 'Maaf, AI tidak dapat merespon saat ini.';
    return json({ reply });
  }

  // ===================== SETUP =====================
  if (segments[0] === 'setup' && method === 'POST') {
    const existing = await supabase.get('users', { limit: '1' });
    if (existing) return json({ message: 'Sudah ada user. Tidak perlu setup ulang.' });
    const pw = body.password || 'Admin123';
    const hashed = await hashPassword(pw);
    const row = await supabase.insert('users', { username: 'admin', password: hashed, role: 'super_admin', display_name: 'Admin' });
    return json({ message: 'Admin berhasil dibuat.', username: 'admin' });
  }

  // ===================== AUTH =====================
  if (segments[0] === 'auth' && segments[1] === 'login' && method === 'POST') {
    if (!body.username || !body.password) return error('Username dan password wajib diisi.');
    const authUser = await supabase.get('users', { username: `eq.${body.username.toLowerCase()}` });
    if (!authUser) return error('Username atau password salah.', 400);
    let valid = await verifyPassword(body.password, authUser.password);
    if (!valid) return error('Username atau password salah.', 400);
    await migratePassword(body.password, authUser.password, supabase, authUser.id);
    const token = await signJWT({ id: authUser.id, username: authUser.username, role: authUser.role || 'anggota' }, env.JWT_SECRET);
    return json({ token, username: authUser.username, role: authUser.role || 'anggota' });
  }

  if (segments[0] === 'auth' && segments[1] === 'me' && method === 'GET') {
    try { user = await authenticate(request, env); } catch (e) { return error(e.message, 401); }
    return json({ username: user.username, role: user.role || 'anggota', display_name: user.display_name || '' });
  }

  const id = segments.length > 1 ? segments[1] : null;
  const action = segments.length > 2 ? segments[2] : null;

  // ===================== BERITA =====================
  if (segments[0] === 'berita') {
    if (method === 'GET' && !id) return json(await supabase.query('berita', { order: 'tanggal.desc' }));
    if (method === 'POST') {
      let gambar = null;
      if (file) gambar = await uploadToSupabase(file, 'berita', env);
      const row = await supabase.insert('berita', { judul: body.judul, isi: body.isi, tanggal: body.tanggal || new Date().toISOString().split('T')[0], gambar, status: body.status || 'publish' });
      return json({ id: row.id, message: 'Berita berhasil ditambahkan.' });
    }
    if (id && method === 'PUT') {
      let gambar = body.gambar;
      if (file) gambar = await uploadToSupabase(file, 'berita', env);
      await supabase.update('berita', { judul: body.judul, isi: body.isi, tanggal: body.tanggal, gambar, status: body.status }, { id: `eq.${id}` });
      return json({ message: 'Berita berhasil diperbarui.' });
    }
    if (id && method === 'DELETE') { await supabase.remove('berita', { id: `eq.${id}` }); return json({ message: 'Berita berhasil dihapus.' }); }
  }

  // ===================== GALERI =====================
  if (segments[0] === 'galeri') {
    if (method === 'GET' && !id) return json(await supabase.query('galeri', { order: 'created_at.desc' }));
    if (method === 'POST') {
      if (!file) return error('File gambar diperlukan.');
      const gambar = await uploadToSupabase(file, 'galeri', env);
      const row = await supabase.insert('galeri', { judul: body.judul || '', gambar, deskripsi: body.deskripsi || '' });
      return json({ id: row.id, message: 'Galeri berhasil ditambahkan.' });
    }
    if (id && method === 'PUT') {
      if (file) { const g = await uploadToSupabase(file, 'galeri', env); await supabase.update('galeri', { judul: body.judul, gambar: g, deskripsi: body.deskripsi }, { id: `eq.${id}` }); }
      else { await supabase.update('galeri', { judul: body.judul, deskripsi: body.deskripsi }, { id: `eq.${id}` }); }
      return json({ message: 'Galeri berhasil diperbarui.' });
    }
    if (id && method === 'DELETE') { await supabase.remove('galeri', { id: `eq.${id}` }); return json({ message: 'Galeri berhasil dihapus.' }); }
  }

  // ===================== PROGRAM =====================
  if (segments[0] === 'program') {
    if (method === 'GET' && !id) return json(await supabase.query('program', { order: 'created_at.desc' }));
    if (method === 'POST') {
      if (!body.judul) return error('Judul program wajib diisi.');
      const row = await supabase.insert('program', { judul: body.judul, deskripsi: body.deskripsi, tipe: body.tipe || 'rutin', jadwal: body.jadwal, icon: body.icon });
      return json({ id: row.id, message: 'Program berhasil ditambahkan.' });
    }
    if (id && method === 'PUT') { await supabase.update('program', { judul: body.judul, deskripsi: body.deskripsi, tipe: body.tipe, jadwal: body.jadwal, icon: body.icon }, { id: `eq.${id}` }); return json({ message: 'Program berhasil diperbarui.' }); }
    if (id && method === 'DELETE') { await supabase.remove('program', { id: `eq.${id}` }); return json({ message: 'Program berhasil dihapus.' }); }
  }

  // ===================== UMKM =====================
  if (segments[0] === 'umkm') {
    if (method === 'GET' && !id) return json(await supabase.query('umkm', { order: 'created_at.desc' }));
    if (method === 'POST') {
      if (!body.nama_usaha) return error('Nama usaha wajib diisi.');
      const row = await supabase.insert('umkm', { nama_usaha: body.nama_usaha, pemilik: body.pemilik, kategori: body.kategori, deskripsi: body.deskripsi, no_hp: body.no_hp, alamat: body.alamat });
      return json({ id: row.id, message: 'UMKM berhasil ditambahkan.' });
    }
    if (id && method === 'PUT') { await supabase.update('umkm', body, { id: `eq.${id}` }); return json({ message: 'UMKM berhasil diperbarui.' }); }
    if (id && method === 'DELETE') { await supabase.remove('umkm', { id: `eq.${id}` }); return json({ message: 'UMKM berhasil dihapus.' }); }
  }

  // ===================== KAS =====================
  if (segments[0] === 'kas') {
    if (method === 'GET' && !id) {
      const transaksi = await supabase.query('kas', { order: 'created_at.desc' });
      const all = await supabase.query('kas');
      const pem = all.reduce((s, r) => s + parseFloat(r.pemasukan || 0), 0);
      const peng = all.reduce((s, r) => s + parseFloat(r.pengeluaran || 0), 0);
      return json({ transaksi, saldo: pem - peng, ringkasan: { total_pemasukan: pem, total_pengeluaran: peng, jumlah_transaksi: all.length } });
    }
    if (method === 'POST') {
      await supabase.insert('kas', { tanggal: body.tanggal, deskripsi: body.deskripsi, kategori: body.kategori, pemasukan: parseFloat(body.pemasukan) || 0, pengeluaran: parseFloat(body.pengeluaran) || 0 });
      return json({ message: 'Transaksi berhasil ditambahkan.' });
    }
    if (id && method === 'PUT') { await supabase.update('kas', body, { id: `eq.${id}` }); return json({ message: 'Transaksi berhasil diperbarui.' }); }
    if (id && method === 'DELETE') { await supabase.remove('kas', { id: `eq.${id}` }); return json({ message: 'Transaksi berhasil dihapus.' }); }
  }

  // ===================== PENGURUS =====================
  if (segments[0] === 'pengurus') {
    if (method === 'GET' && !id) return json(await supabase.query('pengurus', { order: 'id.asc' }));
    if (method === 'POST') {
      let foto = null;
      if (file) foto = await uploadToSupabase(file, 'pengurus', env);
      const row = await supabase.insert('pengurus', { nama: body.nama, jabatan: body.jabatan, foto });
      return json({ id: row.id, message: 'Pengurus berhasil ditambahkan.' });
    }
    if (id && method === 'PUT') {
      let foto = body.foto;
      if (file) foto = await uploadToSupabase(file, 'pengurus', env);
      await supabase.update('pengurus', { nama: body.nama, jabatan: body.jabatan, foto }, { id: `eq.${id}` });
      return json({ message: 'Pengurus berhasil diperbarui.' });
    }
    if (id && method === 'DELETE') { await supabase.remove('pengurus', { id: `eq.${id}` }); return json({ message: 'Pengurus berhasil dihapus.' }); }
  }

  // ===================== PENDAFTAR =====================
  if (segments[0] === 'pendaftar') {
    if (method === 'GET') return json(await supabase.query('pendaftar', { order: 'created_at.desc' }));
    if (method === 'POST') {
      if (!body.nama_lengkap) return error('Nama lengkap wajib diisi.');
      await supabase.insert('pendaftar', { nama_lengkap: body.nama_lengkap, usia: parseInt(body.usia) || null, no_hp: body.no_hp, alamat: body.alamat, pekerjaan: body.pekerjaan || '', alasan_bergabung: body.alasan_bergabung || '' });
      return json({ message: 'Pendaftaran berhasil.' });
    }
    if (id && method === 'DELETE') { await supabase.remove('pendaftar', { id: `eq.${id}` }); return json({ message: 'Pendaftar berhasil dihapus.' }); }
  }

  // ===================== KEUANGAN =====================
  if (adminTables.includes(segments[0])) {
    const sub = segments.slice(1).join('/');
    const s = segments.slice(1);

    // Ringkasan
    if (s[0] === 'ringkasan') {
      const all = await supabase.query('transaksi');
      const saldo = all.filter(t => t.status !== 'ditolak').reduce((s, t) => s + (t.tipe === 'pemasukan' ? parseFloat(t.jumlah) : -parseFloat(t.jumlah)), 0);
      const now = new Date();
      const bulanIni = all.filter(t => { const d = new Date(t.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.status !== 'ditolak'; });
      return json({ saldo, total: all.length, perluVerifikasi: all.filter(t => t.status === 'draft').length, bulanIni: { pemasukan: bulanIni.filter(t => t.tipe === 'pemasukan').reduce((s, t) => s + parseFloat(t.jumlah), 0), pengeluaran: bulanIni.filter(t => t.tipe === 'pengeluaran').reduce((s, t) => s + parseFloat(t.jumlah), 0) } });
    }

    // Log
    if (s[0] === 'log') {
      authorize(['super_admin'], user);
      const rows = await supabase.query('aktivitas_log', { order: 'created_at.desc', limit: '100' });
      return json(await Promise.all(rows.map(async r => ({ ...r, user_name: r.user_id ? (await supabase.get('users', { id: `eq.${r.user_id}` }))?.username || '-' : '-' }))));
    }

    // Users
    if (s[0] === 'users') {
      if (method === 'GET') { authorize(['super_admin'], user); return json(await supabase.query('users', { select: 'id,username,role,display_name,created_at', order: 'id.asc' })); }
      if (method === 'POST') {
        authorize(['super_admin'], user);
        if (!body.username || !body.password) return error('Username dan password wajib diisi.');
        if (body.role && !['anggota', 'pengurus', 'ketua', 'bendahara', 'super_admin'].includes(body.role)) return error('Role tidak valid.');
        const existing = await supabase.get('users', { username: `eq.${body.username.toLowerCase()}` });
        if (existing) return error('Username sudah digunakan.');
        const hashed = await hashPassword(body.password);
        await supabase.insert('users', { username: body.username.toLowerCase(), password: hashed, role: body.role || 'anggota', display_name: body.display_name || body.username });
        return json({ message: 'User berhasil ditambahkan.' });
      }
      if (s[2] === 'role' && method === 'PUT') {
        authorize(['super_admin'], user);
        if (!['anggota', 'pengurus', 'ketua', 'bendahara', 'super_admin'].includes(body.role)) return error('Role tidak valid.');
        await supabase.update('users', { role: body.role }, { id: `eq.${s[1]}` });
        return json({ message: 'Role diperbarui.' });
      }
    }

    // Transaksi
    if (s[0] === 'transaksi') {
      const tid = s[1];
      if (!tid && method === 'GET') {
        const filters = { order: 'created_at.desc' };
        const tipe = url.searchParams.get('tipe'); if (tipe) filters.tipe = `eq.${tipe}`;
        const status = url.searchParams.get('status'); if (status) filters.status = `eq.${status}`;
        const limit = url.searchParams.get('limit'); if (limit) filters.limit = limit;
        let rows = await supabase.query('transaksi', filters);
        const search = url.searchParams.get('search');
        if (search) { const q = search.toLowerCase(); rows = rows.filter(r => r.deskripsi?.toLowerCase().includes(q) || r.kategori?.toLowerCase().includes(q)); }
        return json(await Promise.all(rows.map(async r => ({
          ...r, created_by_name: r.created_by ? (await supabase.get('users', { id: `eq.${r.created_by}` }))?.username || null : null,
          diverifikasi_oleh_name: r.diverifikasi_oleh ? (await supabase.get('users', { id: `eq.${r.diverifikasi_oleh}` }))?.username || null : null,
          dikunci_oleh_name: r.dikunci_oleh ? (await supabase.get('users', { id: `eq.${r.dikunci_oleh}` }))?.username || null : null
        }))));
      }

      if (!tid && method === 'POST') {
        if (!body.tipe || !body.kategori || !body.jumlah || !body.deskripsi) return error('Lengkapi semua field wajib.');
        const nominal = parseFloat(body.jumlah);
        if (isNaN(nominal) || nominal <= 0) return error('Jumlah harus angka positif.');
        let buktiUrl = null;
        if (file) buktiUrl = await uploadToSupabase(file, 'bukti', env);
        const row = await supabase.insert('transaksi', { tipe: body.tipe, kategori: body.kategori, jumlah: nominal, deskripsi: body.deskripsi, kegiatan: body.kegiatan || null, bukti_url: buktiUrl, status: 'draft', created_by: user.id });
        return json({ id: row.id, message: 'Transaksi berhasil ditambahkan (status: draft).' });
      }

      if (!tid) return error('ID diperlukan');
      const act = s[2];

      if (act === 'verifikasi') {
        authorize(['pengurus', 'bendahara', 'super_admin'], user);
        const tx = await supabase.get('transaksi', { id: `eq.${tid}` });
        if (!tx) return error('Transaksi tidak ditemukan.', 404);
        if (tx.status !== 'draft') return error('Status transaksi saat ini bukan draft.');
        if (tx.tipe === 'pengeluaran' && parseFloat(tx.jumlah) > 500000) return error('Pengeluaran > Rp500.000 butuh 2 verifikatur.');
        await supabase.update('transaksi', { status: 'diverifikasi', diverifikasi_oleh: user.id, diverifikasi_at: new Date().toISOString() }, { id: `eq.${tid}` });
        return json({ message: 'Transaksi diverifikasi.' });
      }

      if (act === 'setujui') {
        authorize(['pengurus', 'bendahara', 'super_admin'], user);
        const tx = await supabase.get('transaksi', { id: `eq.${tid}` });
        if (!tx) return error('Transaksi tidak ditemukan.', 404);
        if (tx.status !== 'diverifikasi' && !(tx.status === 'draft' && tx.tipe === 'pengeluaran' && parseFloat(tx.jumlah) > 500000)) return error('Transaksi harus diverifikasi dulu.');
        await supabase.update('transaksi', { diverifikasi_oleh: user.id, diverifikasi_at: new Date().toISOString() }, { id: `eq.${tid}` });
        const updated = await supabase.get('transaksi', { id: `eq.${tid}` });
        if (updated.tipe === 'pengeluaran' && parseFloat(updated.jumlah) > 500000 && !updated.diverifikasi_oleh) return json({ message: 'Verifikasi pertama. Butuh 1 lagi.' });
        await supabase.update('transaksi', { status: 'diverifikasi' }, { id: `eq.${tid}` });
        return json({ message: 'Transaksi disetujui.' });
      }

      if (act === 'kunci') {
        authorize(['super_admin'], user);
        const tx = await supabase.get('transaksi', { id: `eq.${tid}` });
        if (!tx) return error('Transaksi tidak ditemukan.', 404);
        if (tx.status !== 'diverifikasi') return error('Hanya transaksi diverifikasi yang bisa dikunci.');
        await supabase.update('transaksi', { status: 'terkunci', dikunci_oleh: user.id, dikunci_at: new Date().toISOString() }, { id: `eq.${tid}` });
        return json({ message: 'Transaksi terkunci.' });
      }

      if (act === 'tolak') {
        authorize(['pengurus', 'bendahara', 'super_admin'], user);
        const tx = await supabase.get('transaksi', { id: `eq.${tid}` });
        if (!tx) return error('Transaksi tidak ditemukan.', 404);
        if (tx.status !== 'draft' && tx.status !== 'diverifikasi') return error('Status ini tidak bisa ditolak.');
        await supabase.update('transaksi', { status: 'ditolak', diverifikasi_oleh: user.id, diverifikasi_at: new Date().toISOString() }, { id: `eq.${tid}` });
        return json({ message: 'Transaksi ditolak.' });
      }

      if (act === 'koreksi') {
        authorize(['bendahara', 'super_admin'], user);
        const tx = await supabase.get('transaksi', { id: `eq.${tid}` });
        if (!tx) return error('Transaksi tidak ditemukan.', 404);
        if (!body.tipe || !body.kategori || !body.jumlah || !body.deskripsi) return error('Lengkapi semua field wajib.');
        const nominal = parseFloat(body.jumlah);
        if (isNaN(nominal) || nominal <= 0) return error('Jumlah harus angka positif.');
        let buktiUrl = tx.bukti_url;
        if (file) buktiUrl = await uploadToSupabase(file, 'bukti', env);
        const row = await supabase.insert('transaksi', { tipe: body.tipe || tx.tipe, kategori: body.kategori || tx.kategori, jumlah: nominal || tx.jumlah, deskripsi: body.deskripsi || tx.deskripsi, kegiatan: body.kegiatan || tx.kegiatan, bukti_url: buktiUrl, status: 'draft', created_by: user.id, koreksi_dari_id: parseInt(tid) });
        return json({ id: row.id, message: 'Koreksi berhasil. Menunggu verifikasi.' });
      }

      if (act === 'komentar') {
        if (method === 'GET') {
          const rows = await supabase.query('komentar_transaksi', { transaksi_id: `eq.${tid}`, order: 'created_at.asc' });
          return json(await Promise.all(rows.map(async r => ({ ...r, user_name: r.user_id ? (await supabase.get('users', { id: `eq.${r.user_id}` }))?.username || '-' : '-' }))));
        }
        if (method === 'POST') {
          if (!body.pesan) return error('Pesan tidak boleh kosong.');
          const row = await supabase.insert('komentar_transaksi', { transaksi_id: parseInt(tid), user_id: user.id, pesan: body.pesan });
          return json({ id: row.id, message: 'Komentar ditambahkan.' });
        }
      }
    }

    // Anggaran
    if (s[0] === 'anggaran') {
      const aid = s[1];
      if (!aid && method === 'GET') {
        const [rows, txAll] = await Promise.all([
          supabase.query('anggaran', { order: 'created_at.desc' }),
          supabase.query('transaksi')
        ]);
        const enriched = await Promise.all(rows.map(async a => {
          const nm = a.kegiatan_id
            ? (await supabase.get('program', { id: `eq.${a.kegiatan_id}` }))?.judul || null
            : null;
          return { ...a, kegiatan_nama: nm };
        }));
        return json(enriched.map(a => {
          const real = txAll
            .filter(t => (t.kegiatan === a.kegiatan || t.kegiatan_id === a.kegiatan_id) && t.status === 'terkunci')
            .reduce((s, t) => s + parseFloat(t.jumlah), 0);
          return { ...a, realisasi: parseFloat(real) || 0 };
        }));
      }
      if (!aid && method === 'POST') {
        authorize(['bendahara', 'super_admin'], user);
        if (!body.judul || !body.rencana) return error('Lengkapi field wajib.');
        const row = await supabase.insert('anggaran', { kegiatan: body.kegiatan || null, judul: body.judul, rencana: parseFloat(body.rencana), periode_bulan: body.periode_bulan || null, periode_tahun: body.periode_tahun || null });
        return json({ id: row.id, message: 'Anggaran berhasil dibuat.' });
      }
      if (aid && method === 'PUT') {
        authorize(['bendahara', 'super_admin'], user);
        if (!body.rencana) return error('Rencana anggaran diperlukan.');
        await supabase.update('anggaran', { rencana: parseFloat(body.rencana) }, { id: `eq.${aid}` });
        return json({ message: 'Anggaran diperbarui.' });
      }
    }

    // Iuran
    if (s[0] === 'iuran') {
      if (method === 'GET') {
        const rows = await supabase.query('iuran', { order: 'periode_tahun.desc,periode_bulan.desc' });
        return json(await Promise.all(rows.map(async i => ({ ...i, anggota_nama: i.anggota_id ? (await supabase.get('pendaftar', { id: `eq.${i.anggota_id}` }))?.nama_lengkap || null : null }))));
      }
      if (method === 'POST') {
        authorize(['bendahara', 'super_admin'], user);
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

    // Laporan Publik
    if (sub === 'laporan/publik') {
      const all = await supabase.query('transaksi', { status: `eq.terkunci`, order: 'created_at.desc', limit: '50' });
      return json({ saldo: all.reduce((s, t) => s + (t.tipe === 'pemasukan' ? parseFloat(t.jumlah) : -parseFloat(t.jumlah)), 0), transaksi: all, ringkasan: { total_pemasukan: all.filter(t => t.tipe === 'pemasukan').reduce((s, t) => s + parseFloat(t.jumlah), 0), total_pengeluaran: all.filter(t => t.tipe === 'pengeluaran').reduce((s, t) => s + parseFloat(t.jumlah), 0) } });
    }
  }

  return error('Route tidak ditemukan.', 404);
}
