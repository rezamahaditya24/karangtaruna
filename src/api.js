import { createClient } from '../config/supabase-rest.js';
import { authenticate, signJWT, verifyPassword, authorize, authorizeCreate, authorizeModify, migratePassword, hashPassword, verifyJWT, extractToken } from '../config/auth-cf.js';

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
    const files = [];
    for (const [k, v] of fd.entries()) {
      if (v instanceof File && v.size > 0) files.push({ name: k, file: v });
      else if (!(v instanceof File)) body[k] = v;
    }
    return { body, file: files[0] || null, files };
  }
  if (ct.includes('application/json')) { try { return { body: await request.json(), file: null, files: [] }; } catch { return { body: {}, file: null, files: [] }; } }
  const text = await request.text();
  try { return { body: JSON.parse(text), file: null, files: [] }; }
  catch { return { body: {}, file: null, files: [] }; }
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
    let body = {}, file = null, files = [];
    if (method === 'POST' || method === 'PUT') {
      const parsed = await parseBody(request);
      body = parsed.body;
      file = parsed.file;
      files = parsed.files || [];
    }

  const publicTables = ['berita', 'galeri', 'program', 'umkm', 'kas', 'pengurus'];
  const adminTables = ['pendaftar', 'keuangan', 'transaksi', 'anggaran', 'iuran', 'users', 'log'];
  let user = null;
  const isPublicRegister = segments[0] === 'pendaftar' && method === 'POST';
  const isPublicGet = publicTables.includes(segments[0]) && method === 'GET';
  const isAuthRoute = segments[0] === 'auth';
  const isCsvRoute = segments[0] === 'keuangan' && segments[1] === 'laporan' && segments[2] === 'csv';
  if (!isAuthRoute && !isPublicGet && !isPublicRegister) {
    try { user = await authenticate(request, env); }
    catch (e) {
      if (isCsvRoute) { user = null; }
      else { return error(e.message, 401); }
    }
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

    const buildLocalReply = (message, page, role = 'anggota') => {
      const text = (message || '').trim().toLowerCase();
      const currentPage = page || 'dashboard';
      const normalizedRole = (role || 'anggota').toLowerCase();
      const roleHint = normalizedRole === 'super_admin' ? 'Anda memiliki akses penuh untuk membuat, mengedit, dan menghapus data.' :
        normalizedRole === 'bendahara' ? 'Sebagai bendahara, Anda bisa membuat dan mengelola transaksi keuangan serta anggaran, tetapi akses pengelolaan user terbatas.' :
        normalizedRole === 'ketua' ? 'Sebagai ketua, Anda bisa membuat transaksi dan laporan kas, tetapi akses pengelolaan user terbatas.' :
        'Sebagai anggota, akses Anda terbatas pada melihat dashboard dan beberapa laporan.';

      const pageNames = {
        dashboard: 'Dashboard',
        berita: 'Kelola Berita',
        galeri: 'Kelola Galeri',
        program: 'Kelola Program Kerja',
        umkm: 'Kelola UMKM',
        kas: 'Kelola Kas',
        pengurus: 'Kelola Pengurus',
        pendaftar: 'Data Pendaftar',
        'keuangan-transaksi': 'Transaksi Keuangan',
        'keuangan-anggaran': 'Anggaran Kegiatan',
        'keuangan-iuran': 'Iuran Anggota',
        'keuangan-log': 'Log Aktivitas',
        'keuangan-users': 'Manajemen User'
      };
      const pageTitle = pageNames[currentPage] || 'Dashboard';

      if (text.includes('fitur') || text.includes('halaman') || text.includes('menu') || text.includes('manajemen user')) {
        return `Panel admin terdiri dari: \n- Dashboard: statistik, ringkasan keuangan, jumlah berita, galeri, program, UMKM, pengurus, dan pendaftar.\n- Berita: tambah/sunting/hapus konten berita.\n- Galeri: unggah foto dan deskripsi.\n- Program Kerja: kelola kegiatan organisasi.\n- UMKM: kelola usaha anggota.\n- Kas: kelola transaksi kas, anggaran, dan iuran.\n- Pengurus: kelola data pengurus.\n- Pendaftar: lihat dan hapus data pendaftar.\n- Manajemen User: lihat daftar akun dan role pengguna, dengan beberapa hak akses terbatas.\n${roleHint}`;
      }

      if (text.includes('manajemen user') || text.includes('role user') || text.includes('kelola user') || text.includes('pengguna')) {
        const base = `Halaman Manajemen User digunakan untuk melihat daftar akun, mengetahui role, dan mengelola hak akses. `;
        if (normalizedRole !== 'super_admin') {
          return `${base}Hanya pengguna dengan hak akses tertinggi yang dapat menambah, mengubah, atau menghapus akun. Saat ini Anda masuk sebagai ${normalizedRole}.`;
        }
        return `${base}Sebagai pemegang hak akses tertinggi, Anda dapat menambah akun baru, mengubah role, dan menghapus akun yang tidak lagi diperlukan. Pastikan hanya memberi akses penuh kepada pengguna yang benar-benar membutuhkan.`;
      }

      if (text.includes('buat') || text.includes('tambah') || text.includes('menambah')) {
        if (currentPage === 'berita') {
          return `${roleHint} Untuk menambahkan berita, buka halaman Berita, klik tombol Tambah Berita, lalu isi judul, isi, tanggal, status, dan unggah gambar jika perlu. Jika Anda bukan super_admin, fitur tambah berita tidak tersedia.`;
        }
        if (currentPage === 'galeri') {
          return `${roleHint} Untuk menambahkan galeri, buka halaman Galeri, klik Tambah Foto, unggah gambar, isi judul dan deskripsi. Perhatikan bahwa hanya super_admin dapat menambah galeri saat ini.`;
        }
        if (currentPage === 'program') {
          return `${roleHint} Untuk menambahkan program kerja, buka halaman Program Kerja, klik Tambah Program, lalu isi judul, deskripsi, tipe, jadwal, dan icon.`;
        }
        if (currentPage === 'umkm') {
          return `${roleHint} Untuk menambahkan UMKM, buka halaman UMKM, klik Tambah UMKM, lalu isi nama usaha, pemilik, kategori, deskripsi, dan nomor HP.`;
        }
        if (currentPage === 'kas' || currentPage.startsWith('keuangan')) {
          if (!['bendahara', 'ketua', 'super_admin'].includes(normalizedRole)) {
            return `Role ${normalizedRole} tidak diizinkan menambahkan transaksi keuangan. Hanya bendahara, ketua, atau super_admin yang dapat membuat data keuangan.`;
          }
          return `${roleHint} Untuk menambahkan transaksi, buka halaman Kas, klik Tambah Transaksi, pilih tanggal, isi deskripsi, kategori, dan masukkan jumlah pemasukan atau pengeluaran.`;
        }
        if (currentPage === 'pengurus') {
          return `${roleHint} Untuk menambahkan pengurus, buka halaman Pengurus, klik Tambah Pengurus, lalu isi nama, jabatan, dan unggah foto.`;
        }
        return `Untuk membuat data di halaman ${pageTitle}, buka halaman tersebut dan cari tombol Tambah. ${roleHint}`;
      }

      if (text.includes('edit') || text.includes('ubah') || text.includes('perbarui')) {
        if (!['super_admin'].includes(normalizedRole)) {
          return `Role ${normalizedRole} tidak memiliki izin untuk mengedit data secara umum. Hanya super_admin yang dapat melakukan edit atau update di sebagian besar entitas.`;
        }
        return `${roleHint} Untuk mengedit, buka halaman ${pageTitle}, cari data yang ingin diubah, klik Edit, lalu perbarui field yang diperlukan.`;
      }

      if (text.includes('hapus') || text.includes('delete')) {
        if (!['super_admin'].includes(normalizedRole)) {
          return `Role ${normalizedRole} tidak memiliki izin untuk menghapus data. Hanya super_admin yang dapat melakukan penghapusan.`;
        }
        return `${roleHint} Untuk menghapus data, buka halaman ${pageTitle}, klik Hapus pada baris data yang relevan, lalu konfirmasi aksi.`;
      }

      if (currentPage === 'dashboard') {
        return `Di Dashboard Anda dapat melihat ringkasan statistik: jumlah berita, galeri, program kerja, UMKM, saldo kas, data pengurus, dan pendaftar. Untuk menggunakan fitur lainnya, pilih menu di sisi kiri. ${roleHint}`;
      }

      if (currentPage === 'berita') {
        return `Halaman Berita digunakan untuk mengelola artikel kegiatan. ${roleHint} Klik Tambah Berita untuk membuat konten baru, atau Edit/Hapus untuk memperbarui konten yang sudah ada.`;
      }
      if (currentPage === 'galeri') {
        return `Halaman Galeri digunakan untuk mengunggah dan mengelola foto kegiatan. ${roleHint} Gunakan tombol Tambah Foto untuk upload gambar baru.`;
      }
      if (currentPage === 'program') {
        return `Halaman Program Kerja digunakan untuk mencatat kegiatan dan jadwal program. ${roleHint} Gunakan tombol Tambah Program untuk membuat catatan program baru.`;
      }
      if (currentPage === 'umkm') {
        return `Halaman UMKM digunakan untuk mengelola bisnis anggota. ${roleHint} Tambahkan data UMKM baru dengan tombol Tambah UMKM.`;
      }
      if (currentPage === 'kas' || currentPage.startsWith('keuangan')) {
        return `Halaman Keuangan mencakup transaksi, anggaran, iuran, dan log. ${roleHint} Gunakan menu Kas untuk menambah transaksi dan dashboard keuangan untuk melihat ringkasan saldo.`;
      }
      if (currentPage === 'pengurus') {
        return `Halaman Pengurus digunakan untuk mengelola data pengurus organisasi. ${roleHint} Tambah atau edit profil pengurus di sini.`;
      }
      if (currentPage === 'pendaftar') {
        return `Halaman Pendaftar menampilkan calon anggota yang mendaftar. ${roleHint} Gunakan halaman ini untuk melihat data dan menghapus pendaftar bila perlu.`;
      }

      const pageHelp = {
        dashboard: `Di Dashboard Anda melihat ringkasan statistik dan dapat memantau kondisi organisasi secara cepat.`,
        berita: `Halaman Berita digunakan untuk membuat, mengedit, dan menghapus artikel kegiatan.`,
        galeri: `Halaman Galeri digunakan untuk mengunggah foto kegiatan dan menambahkan deskripsi.`,
        program: `Halaman Program Kerja digunakan untuk mencatat dan mengelola kegiatan organisasi.`,
        umkm: `Halaman UMKM digunakan untuk mendata dan mengelola usaha anggota.`,
        kas: `Halaman Kas digunakan untuk melihat saldo dan ringkasan transaksi.`,
        pengurus: `Halaman Pengurus digunakan untuk mengelola profil dan jabatan pengurus.`,
        pendaftar: `Halaman Pendaftar digunakan untuk melihat dan menghapus calon anggota yang mendaftar.`,
        'keuangan-transaksi': `Halaman Transaksi Keuangan digunakan untuk menambah dan mencatat pemasukan/pengeluaran.`,
        'keuangan-anggaran': `Halaman Anggaran digunakan untuk mengelola rencana pengeluaran kegiatan.`,
        'keuangan-iuran': `Halaman Iuran digunakan untuk mencatat iuran anggota.`,
        'keuangan-log': `Halaman Log mencatat aktivitas sistem dan perubahan keuangan.`,
        'keuangan-users': `Halaman Manajemen User digunakan untuk melihat daftar akun dan role mereka. Beberapa tindakan hanya dapat dilakukan oleh pengguna dengan akses penuh.`
      };

      if (text.includes('manajemen user') || text.includes('role user') || text.includes('kelola user') || text.includes('pengguna') || text.includes('user')) {
        const base = `Halaman Manajemen User digunakan untuk melihat daftar akun, role, dan akses login. `;
        if (normalizedRole !== 'super_admin') {
          return `${base}Hanya super_admin dapat menambah, mengubah, atau menghapus user. Saat ini Anda masuk sebagai ${normalizedRole}.`;
        }
        return `${base}Sebagai super_admin, Anda dapat menambah user baru, mengubah role, dan menghapus user yang tidak lagi perlu akses.`;
      }

      if (pageHelp[currentPage]) {
        return `${pageHelp[currentPage]} ${roleHint}`;
      }

      return `Halaman ${pageTitle} membantu Anda mengelola data terkait. ${roleHint}`;
    };

    if (!geminiKey) {
      const reply = buildLocalReply(body.message, body.page, body.role);
      return json({ reply });
    }

    const systemPrompt = `Anda adalah asisten AI untuk panel admin Karang Taruna Manunggal Bhakti. 
Anda membantu admin mengelola:
- Berita: menulis judul dan isi berita
- Galeri: menulis deskripsi foto
- Program: mendeskripsikan program kerja
- UMKM: mendeskripsikan usaha
- Pengurus: menulis profil pengurus
- Kas/Keuangan: analisis keuangan sederhana dan transaksi
- Pendaftar: membantu verifikasi
- Manajemen User: melihat daftar akun dan role

Halaman yang tersedia: Dashboard, Berita, Galeri, Program Kerja, UMKM, Kas, Pengurus, Pendaftar, Keuangan (Transaksi, Anggaran, Iuran, Log, Manajemen User).

Saat menjawab, gunakan konteks halaman aktif dan role user. Jika pertanyaan menyebut Manajemen User, jelaskan bahwa hanya pengguna dengan hak penuh dapat menambah, mengubah, atau menghapus akun, serta sebutkan batasan role lain. Jangan jawab dengan pesan umum atau default, dan jawab langsung sesuai fitur yang ditanyakan. Jika pertanyaan menanyakan cara, berikan langkah praktis yang relevan.`;

    const promptText = `${systemPrompt}\n\nHalaman aktif: ${pageTitle}\nRole saat ini: ${body.role || 'anggota'}\n\nPertanyaan admin: ${body.message}`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      let parsedError = null;
      try { parsedError = JSON.parse(errText); } catch (e) { }
      const apiMessage = parsedError?.error?.message || errText || `Status ${res.status}`;
      if (res.status === 429) {
        return error(`AI tidak dapat diproses saat ini karena kuota habis pada model ${geminiModel}. Silakan coba model lain dengan mengatur GEMINI_MODEL di .env atau cek batasan kuota.`, 429);
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
    const fullUser = await supabase.get('users', { id: `eq.${user.id}` });
    return json({ username: fullUser?.username || user.username, role: fullUser?.role || user.role || 'anggota', display_name: fullUser?.display_name || '' });
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
    if (id && method === 'DELETE') { await supabase.update('anggaran', { kegiatan_id: null }, { kegiatan_id: `eq.${id}` }); await supabase.update('transaksi', { kegiatan_id: null }, { kegiatan_id: `eq.${id}` }); await supabase.remove('program', { id: `eq.${id}` }); return json({ message: 'Program berhasil dihapus.' }); }
  }

  // ===================== UMKM =====================
  if (segments[0] === 'umkm') {
    if (method === 'GET' && !id) return json(await supabase.query('umkm', { order: 'created_at.desc' }));
    if (method === 'POST') {
      if (!body.nama_usaha) return error('Nama usaha wajib diisi.');
      const row = await supabase.insert('umkm', { nama_usaha: body.nama_usaha, pemilik: body.pemilik, kategori: body.kategori, deskripsi: body.deskripsi, no_hp: body.no_hp });
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
    if (id && method === 'DELETE') { await supabase.remove('iuran', { anggota_id: `eq.${id}` }); await supabase.remove('pendaftar', { id: `eq.${id}` }); return json({ message: 'Pendaftar berhasil dihapus.' }); }
  }

  // ===================== KEUANGAN =====================
  if (adminTables.includes(segments[0])) {
    const sub = segments.slice(1).join('/');
    const s = segments.slice(1);

    // Ringkasan
    if (s[0] === 'ringkasan') {
      const all = await supabase.query('transaksi');
      const hitung = arr => arr.filter(t => t.status !== 'ditolak').reduce((s, t) => s + (t.tipe === 'pemasukan' ? parseFloat(t.jumlah) : -parseFloat(t.jumlah)), 0);
      const saldo = hitung(all);
      const saldo_kas = hitung(all.filter(t => !t.fund || t.fund === 'kas'));
      const saldo_penting = hitung(all.filter(t => t.fund === 'penting'));
      const now = new Date();
      const bulanIni = all.filter(t => { const d = new Date(t.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.status !== 'ditolak'; });
      const bulanIniKas = bulanIni.filter(t => !t.fund || t.fund === 'kas');
      const bulanIniPenting = bulanIni.filter(t => t.fund === 'penting');
      return json({ saldo, saldo_kas, saldo_penting, total: all.length, perluVerifikasi: all.filter(t => t.status === 'draft').length, bulanIni: { pemasukan: bulanIni.filter(t => t.tipe === 'pemasukan').reduce((s, t) => s + parseFloat(t.jumlah), 0), pengeluaran: bulanIni.filter(t => t.tipe === 'pengeluaran').reduce((s, t) => s + parseFloat(t.jumlah), 0), pemasukan_kas: bulanIniKas.filter(t => t.tipe === 'pemasukan').reduce((s, t) => s + parseFloat(t.jumlah), 0), pengeluaran_kas: bulanIniKas.filter(t => t.tipe === 'pengeluaran').reduce((s, t) => s + parseFloat(t.jumlah), 0), pemasukan_penting: bulanIniPenting.filter(t => t.tipe === 'pemasukan').reduce((s, t) => s + parseFloat(t.jumlah), 0), pengeluaran_penting: bulanIniPenting.filter(t => t.tipe === 'pengeluaran').reduce((s, t) => s + parseFloat(t.jumlah), 0) } });
    }

    // Log
    if (s[0] === 'log') {
      authorize(['super_admin'], user);
      const rows = await supabase.query('aktivitas_log', { order: 'created_at.desc', limit: '100' });
      return json(await Promise.all(rows.map(async r => ({ ...r, user_name: r.user_id ? (await supabase.get('users', { id: `eq.${r.user_id}` }))?.username || '-' : '-' }))));
    }

    // Users
    if (s[0] === 'users') {
      if (method === 'GET') { authorize(['super_admin'], user); return json((await supabase.query('users', { order: 'id.asc' })).map(u => ({ id: u.id, username: u.username, role: u.role, display_name: u.display_name || '', created_at: u.created_at }))); }
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
      if (s[1] && method === 'DELETE') {
        authorize(['super_admin'], user);
        if (parseInt(s[1]) === user.id) return error('Tidak bisa menghapus akun sendiri.');
        await supabase.remove('users', { id: `eq.${s[1]}` });
        return json({ message: 'User berhasil dihapus.' });
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
        if (!['kas', 'penting'].includes(body.fund)) body.fund = 'kas';
        let buktiUrls = [];
        if (files && files.length > 0) {
          for (const f of files) { const url = await uploadToSupabase(f, 'bukti', env); if (url) buktiUrls.push(url); }
        }
        const row = await supabase.insert('transaksi', { tipe: body.tipe, kategori: body.kategori, jumlah: nominal, deskripsi: body.deskripsi, bukti_url: buktiUrls[0] || null, bukti_urls: buktiUrls.length > 0 ? JSON.stringify(buktiUrls) : null, status: 'draft', fund: body.fund, created_by: user.id, jam: new Date(Date.now() + 7 * 3600000).toISOString().slice(11, 16) });
        return json({ id: row.id, message: 'Transaksi berhasil ditambahkan (status: draft).' });
      }

      if (!tid) return error('ID diperlukan');
      const act = s[2];

      if (act === 'verifikasi') {
        authorize(['pengurus', 'bendahara', 'super_admin'], user);
        const tx = await supabase.get('transaksi', { id: `eq.${tid}` });
        if (!tx) return error('Transaksi tidak ditemukan.', 404);
        if (tx.status !== 'draft') return error('Status transaksi saat ini bukan draft.');
        await supabase.update('transaksi', { status: 'diverifikasi', diverifikasi_oleh: user.id, diverifikasi_at: new Date().toISOString() }, { id: `eq.${tid}` });
        return json({ message: 'Transaksi diverifikasi.' });
      }

      if (act === 'setujui') {
        authorize(['pengurus', 'bendahara', 'super_admin'], user);
        const tx = await supabase.get('transaksi', { id: `eq.${tid}` });
        if (!tx) return error('Transaksi tidak ditemukan.', 404);
        if (tx.status !== 'diverifikasi') return error('Transaksi harus diverifikasi dulu.');
        await supabase.update('transaksi', { status: 'diverifikasi', diverifikasi_oleh: user.id, diverifikasi_at: new Date().toISOString() }, { id: `eq.${tid}` });
        return json({ message: 'Transaksi disetujui.' });
      }

      if (act === 'kunci') {
        authorize(['super_admin', 'ketua'], user);
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
        if (!['kas', 'penting'].includes(body.fund)) body.fund = tx.fund || 'kas';
        let buktiUrls = tx.bukti_urls ? JSON.parse(tx.bukti_urls) : (tx.bukti_url ? [tx.bukti_url] : []);
        if (files && files.length > 0) {
          for (const f of files) { const url = await uploadToSupabase(f, 'bukti', env); if (url) buktiUrls.push(url); }
        }
        const row = await supabase.insert('transaksi', { tipe: body.tipe || tx.tipe, kategori: body.kategori || tx.kategori, jumlah: nominal || tx.jumlah, deskripsi: body.deskripsi || tx.deskripsi, bukti_url: buktiUrls[0] || null, bukti_urls: buktiUrls.length > 0 ? JSON.stringify(buktiUrls) : null, status: 'draft', fund: body.fund, created_by: user.id, jam: new Date(Date.now() + 7 * 3600000).toISOString().slice(11, 16), koreksi_dari_id: parseInt(tid) });
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

      if (!act && method === 'DELETE') {
        authorize(['super_admin'], user);
        const tx = await supabase.get('transaksi', { id: `eq.${tid}` });
        if (!tx) return error('Transaksi tidak ditemukan.', 404);
        if (tx.status === 'terkunci') return error('Transaksi terkunci tidak bisa dihapus.');
        await supabase.remove('komentar_transaksi', { transaksi_id: `eq.${tid}` });
        await supabase.remove('transaksi', { id: `eq.${tid}` });
        return json({ message: 'Transaksi berhasil dihapus.' });
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
            .filter(t => t.tipe === 'pengeluaran' && t.kategori === a.judul && t.status === 'terkunci')
            .reduce((s, t) => s + parseFloat(t.jumlah), 0);
          return { ...a, realisasi: parseFloat(real) || 0 };
        }));
      }
      if (!aid && method === 'POST') {
        authorize(['bendahara', 'super_admin'], user);
        if (!body.judul || !body.rencana) return error('Lengkapi field wajib.');
        const row = await supabase.insert('anggaran', { kegiatan_id: body.kegiatan_id ? parseInt(body.kegiatan_id) : null, judul: body.judul, rencana: parseFloat(body.rencana), periode_bulan: body.periode_bulan || null, periode_tahun: body.periode_tahun || null });
        return json({ id: row.id, message: 'Anggaran berhasil dibuat.' });
      }
      if (aid && method === 'PUT') {
        authorize(['bendahara', 'super_admin'], user);
        if (!body.rencana) return error('Rencana anggaran diperlukan.');
        await supabase.update('anggaran', { rencana: parseFloat(body.rencana) }, { id: `eq.${aid}` });
        return json({ message: 'Anggaran diperbarui.' });
      }
      if (aid && method === 'DELETE') {
        authorize(['super_admin', 'ketua'], user);
        await supabase.remove('anggaran', { id: `eq.${aid}` });
        return json({ message: 'Anggaran berhasil dihapus.' });
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
      if (s[1] && method === 'DELETE') {
        authorize(['super_admin'], user);
        await supabase.remove('iuran', { id: `eq.${s[1]}` });
        return json({ message: 'Iuran berhasil dihapus.' });
      }
    }

    // Laporan CSV (live Google Sheets via IMPORTDATA)
    if (s[0] === 'laporan' && s[1] === 'csv') {
      let csvUser = user;
      if (!csvUser) {
        const queryToken = url.searchParams.get('token');
        if (queryToken) {
          try { csvUser = await verifyJWT(queryToken, env.JWT_SECRET); } catch {}
        }
      }
      if (!csvUser) return error('Akses ditolak.', 401);
      const menu = s.slice(2).join('/');
      const escCsv = v => { const s = String(v == null ? '' : v); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const fmtRp = n => 'Rp ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';

      if (menu === 'transaksi') {
        authorize(['super_admin', 'bendahara', 'ketua'], csvUser);
        const data = await supabase.query('transaksi', { order: 'created_at.desc' });
        const enriched = await Promise.all(data.map(async r => ({ ...r, created_by_name: r.created_by ? (await supabase.get('users', { id: `eq.${r.created_by}` }))?.username || null : null })));
        const csv = ['Tanggal,Jam,Tipe,Kategori,Jumlah,Deskripsi,Status,Dana,Bukti URL,Dibuat Oleh',
          ...enriched.map(r => [
            fmtDate(r.created_at), r.jam || '', r.tipe, escCsv(r.kategori), fmtRp(r.jumlah),
            escCsv(r.deskripsi || ''), r.status, !r.fund || r.fund === 'kas' ? 'Kas' : 'Penting',
            escCsv(r.bukti_urls ? JSON.parse(r.bukti_urls).join('; ') : (r.bukti_url || '')),
            escCsv(r.created_by_name || '-')
          ].join(','))
        ].join('\n');
        return new Response('\uFEFF' + csv, { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
      }
      if (menu === 'anggaran') {
        authorize(['super_admin', 'bendahara', 'ketua'], csvUser);
        const rows = await supabase.query('anggaran', { order: 'created_at.desc' });
        const txAll = await supabase.query('transaksi');
        const enriched = await Promise.all(rows.map(async a => {
          const nm = a.kegiatan_id ? (await supabase.get('program', { id: `eq.${a.kegiatan_id}` }))?.judul || null : null;
          const real = txAll.filter(t => t.tipe === 'pengeluaran' && t.kategori === a.judul && t.status === 'terkunci').reduce((s, t) => s + parseFloat(t.jumlah), 0);
          return { ...a, kegiatan_nama: nm, realisasi: real };
        }));
        const csv = ['Kegiatan,Judul,Rencana,Realisasi,Sisa,Progress (%)',
          ...enriched.map(a => [
            escCsv(a.kegiatan_nama || '-'), escCsv(a.judul), fmtRp(a.rencana), fmtRp(a.realisasi),
            fmtRp(a.rencana - a.realisasi), a.rencana > 0 ? Math.round(a.realisasi / a.rencana * 100) : 0
          ].join(','))
        ].join('\n');
        return new Response('\uFEFF' + csv, { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
      }
      if (menu === 'iuran') {
        authorize(['super_admin', 'bendahara', 'ketua'], csvUser);
        const rows = await supabase.query('iuran', { order: 'periode_tahun.desc,periode_bulan.desc' });
        const enriched = await Promise.all(rows.map(async i => ({ ...i, anggota_nama: i.anggota_id ? (await supabase.get('pendaftar', { id: `eq.${i.anggota_id}` }))?.nama_lengkap || null : null })));
        const csv = ['Anggota,Periode,Jumlah,Status,Lunas At',
          ...enriched.map(i => [
            escCsv(i.anggota_nama || 'Anggota #' + i.anggota_id), i.periode_bulan + '/' + i.periode_tahun,
            fmtRp(i.jumlah), i.status, i.lunas_at ? fmtDate(i.lunas_at) : '-'
          ].join(','))
        ].join('\n');
        return new Response('\uFEFF' + csv, { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
      }
      if (menu === 'log') {
        authorize(['super_admin'], csvUser);
        const rows = await supabase.query('aktivitas_log', { order: 'created_at.desc', limit: '100' });
        const enriched = await Promise.all(rows.map(async r => ({ ...r, user_name: r.user_id ? (await supabase.get('users', { id: `eq.${r.user_id}` }))?.username || '-' : '-' })));
        const csv = ['Waktu,User,Aksi,Detail',
          ...enriched.map(l => [fmtDate(l.created_at), escCsv(l.user_name), escCsv(l.aksi), escCsv(l.detail || '')].join(','))
        ].join('\n');
        return new Response('\uFEFF' + csv, { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
      }
      if (menu === 'users') {
        authorize(['super_admin'], csvUser);
        const data = await supabase.query('users', { order: 'id.asc' });
        const csv = ['ID,Username,Nama,Role,Tanggal Dibuat',
          ...data.map(u => [u.id, escCsv(u.username), escCsv(u.display_name || '-'), u.role, fmtDate(u.created_at)].join(','))
        ].join('\n');
        return new Response('\uFEFF' + csv, { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
      }
      if (menu === 'ringkasan') {
        authorize(['super_admin', 'bendahara', 'ketua'], csvUser);
        const all = await supabase.query('transaksi');
        const hitung = arr => arr.filter(t => t.status !== 'ditolak').reduce((s, t) => s + (t.tipe === 'pemasukan' ? parseFloat(t.jumlah) : -parseFloat(t.jumlah)), 0);
        const saldo_kas = hitung(all.filter(t => !t.fund || t.fund === 'kas'));
        const saldo_penting = hitung(all.filter(t => t.fund === 'penting'));
        const now = new Date();
        const bulanIni = all.filter(t => { const d = new Date(t.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.status !== 'ditolak'; });
        const csv = ['Metrik,Nilai',
          ['Saldo Kas Umum', fmtRp(saldo_kas)],
          ['Saldo Dana Penting', fmtRp(saldo_penting)],
          ['Total Kas', fmtRp(hitung(all))],
          ['Total Transaksi', all.length],
          ['Perlu Verifikasi', all.filter(t => t.status === 'draft').length],
          ['Pemasukan Kas (Bulan Ini)', fmtRp(bulanIni.filter(t => t.tipe === 'pemasukan' && (!t.fund || t.fund === 'kas')).reduce((s, t) => s + parseFloat(t.jumlah), 0))],
          ['Pengeluaran Kas (Bulan Ini)', fmtRp(bulanIni.filter(t => t.tipe === 'pengeluaran' && (!t.fund || t.fund === 'kas')).reduce((s, t) => s + parseFloat(t.jumlah), 0))],
          ['Pemasukan Penting (Bulan Ini)', fmtRp(bulanIni.filter(t => t.tipe === 'pemasukan' && t.fund === 'penting').reduce((s, t) => s + parseFloat(t.jumlah), 0))],
          ['Pengeluaran Penting (Bulan Ini)', fmtRp(bulanIni.filter(t => t.tipe === 'pengeluaran' && t.fund === 'penting').reduce((s, t) => s + parseFloat(t.jumlah), 0))]
        ].map(r => r.join(',')).join('\n');
        return new Response('\uFEFF' + csv, { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
      }
      return error('Menu CSV tidak ditemukan.', 404);
    }

    // Laporan Publik
    if (sub === 'laporan/publik') {
      const all = await supabase.query('transaksi', { status: `eq.terkunci`, order: 'created_at.desc', limit: '50' });
      const hitung = arr => arr.reduce((s, t) => s + (t.tipe === 'pemasukan' ? parseFloat(t.jumlah) : -parseFloat(t.jumlah)), 0);
      return json({ saldo: hitung(all), saldo_kas: hitung(all.filter(t => !t.fund || t.fund === 'kas')), saldo_penting: hitung(all.filter(t => t.fund === 'penting')), transaksi: all, ringkasan: { total_pemasukan: all.filter(t => t.tipe === 'pemasukan').reduce((s, t) => s + parseFloat(t.jumlah), 0), total_pengeluaran: all.filter(t => t.tipe === 'pengeluaran').reduce((s, t) => s + parseFloat(t.jumlah), 0) } });
    }
  }

  return error('Route tidak ditemukan.', 404);
}
