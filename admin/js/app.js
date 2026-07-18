const API = '/api';
let token = localStorage.getItem('token');
let currentPage = 'dashboard';
let editingId = null;
let currentEntity = '';

// Auth check
if (token) {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('sidebar').style.display = 'block';
  document.querySelector('.main-content').style.display = 'block';
  document.getElementById('displayUsername').textContent = localStorage.getItem('username') || 'Admin';
  navigateTo(window.location.hash.slice(1) || 'dashboard');
} else {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('sidebar').style.display = 'none';
  document.querySelector('.main-content').style.display = 'none';
}

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('loginError');
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      localStorage.setItem('token', token);
      localStorage.setItem('username', data.username);
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('sidebar').style.display = 'block';
      document.querySelector('.main-content').style.display = 'block';
      document.getElementById('displayUsername').textContent = data.username;
      navigateTo('dashboard');
    } else {
      errorEl.textContent = data.error;
      errorEl.style.display = 'block';
    }
  } catch (err) {
    errorEl.textContent = 'Gagal terhubung ke server.';
    errorEl.style.display = 'block';
  }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  location.reload();
});

// Navigation
document.querySelectorAll('.sidebar nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    navigateTo(page);
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('overlay').classList.remove('show');
    }
  });
});

window.addEventListener('hashchange', () => {
  const page = window.location.hash.slice(1) || 'dashboard';
  navigateTo(page);
});

// Hamburger
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
});

document.getElementById('overlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
});

function navigateTo(page) {
  if (!token) return;
  currentPage = page;
  window.location.hash = page;
  const titles = {
    dashboard: 'Dashboard',
    berita: 'Kelola Berita',
    galeri: 'Kelola Galeri',
    program: 'Kelola Program Kerja',
    umkm: 'Kelola UMKM',
    kas: 'Kelola Kas',
    pengurus: 'Kelola Pengurus',
    pendaftar: 'Data Pendaftar'
  };
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  const activeLink = document.querySelector(`.sidebar nav a[data-page="${page}"]`);
  if (activeLink) activeLink.classList.add('active');
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const section = document.getElementById(`page-${page}`);
  if (section) section.classList.add('active');
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'berita': loadBerita(); break;
    case 'galeri': loadGaleri(); break;
    case 'program': loadProgram(); break;
    case 'umkm': loadUmkm(); break;
    case 'kas': loadKas(); break;
    case 'pengurus': loadPengurus(); break;
    case 'pendaftar': loadPendaftar(); break;
  }
}

// API helper
async function apiFetch(url, options = {}) {
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

// ============== DASHBOARD ==============
async function loadDashboard() {
  try {
    const [berita, galeri, program, umkm, kasData, pengurus, pendaftar] = await Promise.all([
      apiFetch(`${API}/berita`),
      apiFetch(`${API}/galeri`),
      apiFetch(`${API}/program`),
      apiFetch(`${API}/umkm`),
      apiFetch(`${API}/kas`),
      apiFetch(`${API}/pengurus`),
      apiFetch(`${API}/pendaftar`)
    ]);
    document.getElementById('statBerita').textContent = berita.length;
    document.getElementById('statGaleri').textContent = galeri.length;
    document.getElementById('statProgram').textContent = program.length;
    document.getElementById('statUmkm').textContent = umkm.length;
    document.getElementById('statKasSaldo').textContent = 'Rp ' + formatNumber(kasData.saldo || 0);
    document.getElementById('statPengurus').textContent = pengurus.length;
    document.getElementById('statPendaftar').textContent = pendaftar.length;
  } catch (err) {
    console.error(err);
  }
}

// ============== BERITA ==============
async function loadBerita() {
  const container = document.getElementById('beritaTableContainer');
  try {
    const data = await apiFetch(`${API}/berita`);
    if (!data.length) {
      container.innerHTML = `<div class="empty-state"><p>Belum ada berita.</p></div>`;
      return;
    }
    container.innerHTML = `<table><thead><tr>
      <th>Judul</th><th>Tanggal</th><th>Status</th><th>Aksi</th>
    </tr></thead><tbody>${data.map(item => `<tr>
      <td>${escapeHtml(item.judul)}</td>
      <td>${formatDate(item.tanggal)}</td>
      <td><span class="badge ${item.status === 'publish' ? 'badge-success' : 'badge-warning'}">${item.status}</span></td>
      <td>
        <button class="btn btn-warning btn-sm" onclick='editBerita(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDelete('berita', ${item.id})">Hapus</button>
      </td>
    </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

function editBerita(item) {
  currentEntity = 'berita';
  editingId = item.id;
  document.getElementById('modalTitle').textContent = 'Edit Berita';
  document.getElementById('formFields').innerHTML = `
    <div class="form-group"><label>Judul</label><input type="text" name="judul" value="${escapeHtml(item.judul)}" required></div>
    <div class="form-group"><label>Isi Berita</label><textarea name="isi" rows="6">${escapeHtml(item.isi || '')}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Tanggal</label><input type="date" name="tanggal" value="${item.tanggal || ''}"></div>
      <div class="form-group"><label>Status</label><select name="status"><option value="publish" ${item.status === 'publish' ? 'selected' : ''}>Publish</option><option value="draft" ${item.status === 'draft' ? 'selected' : ''}>Draft</option></select></div>
    </div>
    <div class="form-group"><label>URL Gambar</label><input type="text" name="gambar" value="${escapeHtml(item.gambar || '')}" placeholder="/uploads/nama-file.jpg"></div>
  `;
  document.getElementById('formModal').classList.add('show');
}

// ============== GALERI ==============
async function loadGaleri() {
  const container = document.getElementById('galeriContainer');
  try {
    const data = await apiFetch(`${API}/galeri`);
    if (!data.length) {
      container.innerHTML = `<div class="empty-state"><p>Belum ada foto.</p></div>`;
      return;
    }
    container.innerHTML = `<div class="gallery-grid">${data.map(item => `
      <div class="gallery-item">
        <img src="${item.gambar || 'https://via.placeholder.com/200'}" alt="${escapeHtml(item.judul || '')}" loading="lazy">
        <div class="info">
          <h4>${escapeHtml(item.judul || 'Tanpa Judul')}</h4>
          <div class="actions">
            <button class="btn btn-warning btn-sm" onclick='editGaleri(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Edit</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDelete('galeri', ${item.id})">Hapus</button>
          </div>
        </div>
      </div>
    `).join('')}</div>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

function editGaleri(item) {
  currentEntity = 'galeri';
  editingId = item.id;
  document.getElementById('modalTitle').textContent = 'Edit Foto';
  document.getElementById('formFields').innerHTML = `
    <div class="form-group"><label>Judul</label><input type="text" name="judul" value="${escapeHtml(item.judul || '')}"></div>
    <div class="form-group"><label>Deskripsi</label><textarea name="deskripsi" rows="3">${escapeHtml(item.deskripsi || '')}</textarea></div>
    <div class="form-group"><label>Ganti Gambar</label><input type="file" name="gambar" accept="image/*"></div>
    ${item.gambar ? `<p style="font-size:12px;color:#666">Gambar saat ini: ${item.gambar}</p>` : ''}
  `;
  document.getElementById('formModal').classList.add('show');
}

// ============== PROGRAM ==============
async function loadProgram() {
  const container = document.getElementById('programTableContainer');
  try {
    const data = await apiFetch(`${API}/program`);
    if (!data.length) {
      container.innerHTML = `<div class="empty-state"><p>Belum ada program kerja.</p></div>`;
      return;
    }
    container.innerHTML = `<table><thead><tr>
      <th>Program</th><th>Tipe</th><th>Jadwal</th><th>Aksi</th>
    </tr></thead><tbody>${data.map(item => `<tr>
      <td><strong>${escapeHtml(item.judul)}</strong>${item.deskripsi ? `<br><small style="color:#666">${escapeHtml(item.deskripsi.substring(0, 100))}${item.deskripsi.length > 100 ? '...' : ''}</small>` : ''}</td>
      <td><span class="badge badge-success">${item.tipe}</span></td>
      <td>${escapeHtml(item.jadwal || '')}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick='editProgram(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDelete('program', ${item.id})">Hapus</button>
      </td>
    </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

function editProgram(item) {
  currentEntity = 'program';
  editingId = item.id;
  document.getElementById('modalTitle').textContent = 'Edit Program';
  document.getElementById('formFields').innerHTML = `
    <div class="form-group"><label>Judul Program</label><input type="text" name="judul" value="${escapeHtml(item.judul)}" required></div>
    <div class="form-group"><label>Deskripsi</label><textarea name="deskripsi" rows="4">${escapeHtml(item.deskripsi || '')}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Tipe</label><select name="tipe"><option value="rutin" ${item.tipe === 'rutin' ? 'selected' : ''}>Rutin</option><option value="kalender" ${item.tipe === 'kalender' ? 'selected' : ''}>Kalender</option></select></div>
      <div class="form-group"><label>Jadwal</label><input type="text" name="jadwal" value="${escapeHtml(item.jadwal || '')}"></div>
    </div>
    <div class="form-group"><label>Icon (emoji)</label><input type="text" name="icon" value="${escapeHtml(item.icon || '')}" placeholder="contoh: 🎯"></div>
  `;
  document.getElementById('formModal').classList.add('show');
}

// ============== UMKM ==============
async function loadUmkm() {
  const container = document.getElementById('umkmTableContainer');
  try {
    const data = await apiFetch(`${API}/umkm`);
    if (!data.length) {
      container.innerHTML = `<div class="empty-state"><p>Belum ada data UMKM.</p></div>`;
      return;
    }
    container.innerHTML = `<table><thead><tr>
      <th>Nama Usaha</th><th>Pemilik</th><th>Kategori</th><th>No. HP</th><th>Aksi</th>
    </tr></thead><tbody>${data.map(item => `<tr>
      <td><strong>${escapeHtml(item.nama_usaha)}</strong></td>
      <td>${escapeHtml(item.pemilik || '-')}</td>
      <td><span class="badge badge-success">${escapeHtml(item.kategori || '-')}</span></td>
      <td>${escapeHtml(item.no_hp || '-')}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick='editUmkm(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDelete('umkm', ${item.id})">Hapus</button>
      </td>
    </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

function editUmkm(item) {
  currentEntity = 'umkm';
  editingId = item.id;
  document.getElementById('modalTitle').textContent = 'Edit UMKM';
  document.getElementById('formFields').innerHTML = `
    <div class="form-group"><label>Nama Usaha</label><input type="text" name="nama_usaha" value="${escapeHtml(item.nama_usaha)}" required></div>
    <div class="form-row">
      <div class="form-group"><label>Pemilik</label><input type="text" name="pemilik" value="${escapeHtml(item.pemilik || '')}"></div>
      <div class="form-group"><label>Kategori</label><select name="kategori"><option value="">Pilih Kategori</option>
        ${['Kuliner', 'Fashion', 'Jasa', 'Kerajinan'].map(k => `<option value="${k}" ${item.kategori === k ? 'selected' : ''}>${k}</option>`).join('')}
      </select></div>
    </div>
    <div class="form-group"><label>Deskripsi</label><textarea name="deskripsi" rows="3">${escapeHtml(item.deskripsi || '')}</textarea></div>
    <div class="form-group"><label>No. HP</label><input type="text" name="no_hp" value="${escapeHtml(item.no_hp || '')}"></div>
  `;
  document.getElementById('formModal').classList.add('show');
}

// ============== KAS ==============
async function loadKas() {
  const container = document.getElementById('kasTableContainer');
  const summary = document.getElementById('kasSummary');
  try {
    const data = await apiFetch(`${API}/kas`);
    summary.innerHTML = `
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-number">Rp ${formatNumber(data.saldo)}</div><div class="stat-label">Saldo Saat Ini</div></div>
      <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-number" style="color:#28a745">Rp ${formatNumber(data.ringkasan.total_pemasukan)}</div><div class="stat-label">Total Pemasukan</div></div>
      <div class="stat-card"><div class="stat-icon">📉</div><div class="stat-number" style="color:#dc3545">Rp ${formatNumber(data.ringkasan.total_pengeluaran)}</div><div class="stat-label">Total Pengeluaran</div></div>
      <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-number">${data.ringkasan.jumlah_transaksi}</div><div class="stat-label">Jumlah Transaksi</div></div>
    `;
    const items = data.transaksi;
    if (!items.length) {
      container.innerHTML = `<div class="empty-state"><p>Belum ada transaksi.</p></div>`;
      return;
    }
    container.innerHTML = `<table><thead><tr>
      <th>Tanggal</th><th>Deskripsi</th><th>Kategori</th><th>Pemasukan</th><th>Pengeluaran</th><th>Aksi</th>
    </tr></thead><tbody>${items.map(item => `<tr>
      <td>${formatDate(item.tanggal)}</td>
      <td>${escapeHtml(item.deskripsi || '-')}</td>
      <td>${escapeHtml(item.kategori || '-')}</td>
      <td style="color:#28a745">${item.pemasukan > 0 ? 'Rp ' + formatNumber(item.pemasukan) : '-'}</td>
      <td style="color:#dc3545">${item.pengeluaran > 0 ? 'Rp ' + formatNumber(item.pengeluaran) : '-'}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick='editKas(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDelete('kas', ${item.id})">Hapus</button>
      </td>
    </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

function editKas(item) {
  currentEntity = 'kas';
  editingId = item.id;
  document.getElementById('modalTitle').textContent = 'Edit Transaksi';
  document.getElementById('formFields').innerHTML = `
    <div class="form-group"><label>Tanggal</label><input type="date" name="tanggal" value="${item.tanggal}" required></div>
    <div class="form-group"><label>Deskripsi</label><input type="text" name="deskripsi" value="${escapeHtml(item.deskripsi || '')}"></div>
    <div class="form-group"><label>Kategori</label><input type="text" name="kategori" value="${escapeHtml(item.kategori || '')}"></div>
    <div class="form-row">
      <div class="form-group"><label>Pemasukan (Rp)</label><input type="number" name="pemasukan" value="${item.pemasukan || 0}" min="0"></div>
      <div class="form-group"><label>Pengeluaran (Rp)</label><input type="number" name="pengeluaran" value="${item.pengeluaran || 0}" min="0"></div>
    </div>
  `;
  document.getElementById('formModal').classList.add('show');
}

// ============== PENGURUS ==============
async function loadPengurus() {
  const container = document.getElementById('pengurusTableContainer');
  try {
    const data = await apiFetch(`${API}/pengurus`);
    if (!data.length) {
      container.innerHTML = `<div class="empty-state"><p>Belum ada data pengurus.</p></div>`;
      return;
    }
    container.innerHTML = `<table><thead><tr>
      <th>Nama</th><th>Jabatan</th><th>Aksi</th>
    </tr></thead><tbody>${data.map(item => `<tr>
      <td><strong>${escapeHtml(item.nama)}</strong></td>
      <td>${escapeHtml(item.jabatan || '-')}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick='editPengurus(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDelete('pengurus', ${item.id})">Hapus</button>
      </td>
    </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

function editPengurus(item) {
  currentEntity = 'pengurus';
  editingId = item.id;
  document.getElementById('modalTitle').textContent = 'Edit Pengurus';
  document.getElementById('formFields').innerHTML = `
    <div class="form-group"><label>Nama Lengkap</label><input type="text" name="nama" value="${escapeHtml(item.nama)}" required></div>
    <div class="form-group"><label>Jabatan</label><input type="text" name="jabatan" value="${escapeHtml(item.jabatan || '')}"></div>
    <div class="form-group"><label>URL Foto</label><input type="text" name="foto" value="${escapeHtml(item.foto || '')}" placeholder="/uploads/nama-file.jpg"></div>
  `;
  document.getElementById('formModal').classList.add('show');
}

// ============== PENDAFTAR ==============
async function loadPendaftar() {
  const container = document.getElementById('pendaftarTableContainer');
  try {
    const data = await apiFetch(`${API}/pendaftar`);
    if (!data.length) {
      container.innerHTML = `<div class="empty-state"><p>Belum ada pendaftar.</p></div>`;
      return;
    }
    container.innerHTML = `<table><thead><tr>
      <th>Nama</th><th>Usia</th><th>No. HP</th><th>Pekerjaan</th><th>Tanggal Daftar</th><th>Aksi</th>
    </tr></thead><tbody>${data.map(item => `<tr>
      <td><strong>${escapeHtml(item.nama_lengkap)}</strong></td>
      <td>${item.usia || '-'}</td>
      <td>${escapeHtml(item.no_hp || '-')}</td>
      <td>${escapeHtml(item.pekerjaan || '-')}</td>
      <td>${formatDate(item.created_at)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="confirmDelete('pendaftar', ${item.id})">Hapus</button></td>
    </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

// ============== FORM HANDLING ==============
function openForm(entity) {
  currentEntity = entity;
  editingId = null;
  const titles = {
    berita: 'Tambah Berita',
    galeri: 'Tambah Foto',
    program: 'Tambah Program',
    umkm: 'Tambah UMKM',
    kas: 'Tambah Transaksi',
    pengurus: 'Tambah Pengurus'
  };
  document.getElementById('modalTitle').textContent = titles[entity] || 'Form';
  let fields = '';
  switch (entity) {
    case 'berita':
      fields = `
        <div class="form-group"><label>Judul</label><input type="text" name="judul" required></div>
        <div class="form-group"><label>Isi Berita</label><textarea name="isi" rows="6"></textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Tanggal</label><input type="date" name="tanggal"></div>
          <div class="form-group"><label>Status</label><select name="status"><option value="publish">Publish</option><option value="draft">Draft</option></select></div>
        </div>
        <div class="form-group"><label>URL Gambar</label><input type="text" name="gambar" placeholder="/uploads/nama-file.jpg"></div>`;
      break;
    case 'galeri':
      fields = `
        <div class="form-group"><label>Judul</label><input type="text" name="judul"></div>
        <div class="form-group"><label>Deskripsi</label><textarea name="deskripsi" rows="3"></textarea></div>
        <div class="form-group"><label>Gambar</label><input type="file" name="gambar" accept="image/*" required></div>`;
      break;
    case 'program':
      fields = `
        <div class="form-group"><label>Judul Program</label><input type="text" name="judul" required></div>
        <div class="form-group"><label>Deskripsi</label><textarea name="deskripsi" rows="4"></textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Tipe</label><select name="tipe"><option value="rutin">Rutin</option><option value="kalender">Kalender</option></select></div>
          <div class="form-group"><label>Jadwal</label><input type="text" name="jadwal"></div>
        </div>
        <div class="form-group"><label>Icon (emoji)</label><input type="text" name="icon" placeholder="contoh: 🎯"></div>`;
      break;
    case 'umkm':
      fields = `
        <div class="form-group"><label>Nama Usaha</label><input type="text" name="nama_usaha" required></div>
        <div class="form-row">
          <div class="form-group"><label>Pemilik</label><input type="text" name="pemilik"></div>
          <div class="form-group"><label>Kategori</label><select name="kategori"><option value="">Pilih Kategori</option><option>Kuliner</option><option>Fashion</option><option>Jasa</option><option>Kerajinan</option></select></div>
        </div>
        <div class="form-group"><label>Deskripsi</label><textarea name="deskripsi" rows="3"></textarea></div>
        <div class="form-group"><label>No. HP</label><input type="text" name="no_hp"></div>`;
      break;
    case 'kas':
      fields = `
        <div class="form-group"><label>Tanggal</label><input type="date" name="tanggal" required></div>
        <div class="form-group"><label>Deskripsi</label><input type="text" name="deskripsi"></div>
        <div class="form-group"><label>Kategori</label><input type="text" name="kategori"></div>
        <div class="form-row">
          <div class="form-group"><label>Pemasukan (Rp)</label><input type="number" name="pemasukan" value="0" min="0"></div>
          <div class="form-group"><label>Pengeluaran (Rp)</label><input type="number" name="pengeluaran" value="0" min="0"></div>
        </div>`;
      break;
    case 'pengurus':
      fields = `
        <div class="form-group"><label>Nama Lengkap</label><input type="text" name="nama" required></div>
        <div class="form-group"><label>Jabatan</label><input type="text" name="jabatan"></div>
        <div class="form-group"><label>URL Foto</label><input type="text" name="foto" placeholder="/uploads/nama-file.jpg"></div>`;
      break;
  }
  document.getElementById('formFields').innerHTML = fields;
  document.getElementById('formModal').classList.add('show');
}

function closeForm() {
  document.getElementById('formModal').classList.remove('show');
  document.getElementById('dataForm').reset();
  editingId = null;
}

document.getElementById('dataForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const entity = currentEntity;
  const id = editingId;
  let url = `${API}/${entity}`;
  let method = 'POST';

  if (id) {
    url += `/${id}`;
    method = 'PUT';
  }

  try {
    if (entity === 'galeri') {
      if (!id || formData.get('gambar').size > 0) {
        await apiFetch(url, { method, body: formData });
      } else {
        const data = Object.fromEntries(formData.entries());
        delete data.gambar;
        await apiFetch(url, { method, body: JSON.stringify(data) });
      }
    } else {
      const data = Object.fromEntries(formData.entries());
      if (entity === 'kas') {
        data.pemasukan = parseFloat(data.pemasukan) || 0;
        data.pengeluaran = parseFloat(data.pengeluaran) || 0;
      }
      await apiFetch(url, { method, body: JSON.stringify(data) });
    }
    closeForm();
    navigateTo(currentPage);
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

// ============== DELETE CONFIRMATION ==============
let deleteTarget = { entity: '', id: null };

function confirmDelete(entity, id) {
  deleteTarget = { entity, id };
  document.getElementById('confirmModal').classList.add('show');
}

function closeConfirm() {
  document.getElementById('confirmModal').classList.remove('show');
  deleteTarget = { entity: '', id: null };
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  const { entity, id } = deleteTarget;
  if (!id) return;
  try {
    await apiFetch(`${API}/${entity}/${id}`, { method: 'DELETE' });
    closeConfirm();
    navigateTo(currentPage);
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeForm();
    closeConfirm();
  }
});

// ============== UTILITIES ==============
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatNumber(num) {
  return Number(num).toLocaleString('id-ID');
}

function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}
