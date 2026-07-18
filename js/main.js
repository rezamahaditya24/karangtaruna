/* ============================================================
   KARANG TARUNA MANUNGGAL BHAKTI - DESA DADAPTULIS DALAM
   Main JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  // ==========================================================
  // 1. MOBILE HAMBURGER MENU
  // ==========================================================
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.navbar-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', function () {
      this.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
  }

  // ==========================================================
  // 2. ACTIVE NAV LINK
  // ==========================================================
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  navLinks.querySelectorAll('a').forEach(function (link) {
    const linkPath = link.getAttribute('href').split('/').pop();
    if (linkPath === currentPath) {
      link.classList.add('active');
    }
  });

  // ==========================================================
  // 3. LIGHTBOX (Galeri)
  // ==========================================================
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');

  function setupLightbox() {
    if (!lightbox || !lightboxImg) return;
    document.querySelectorAll('.galeri-item').forEach(function (item) {
      item.addEventListener('click', function () {
        const img = this.querySelector('img');
        const caption = this.querySelector('.galeri-overlay span');
        if (img) {
          lightboxImg.src = img.src;
          lightboxImg.alt = img.alt || '';
          lightboxCaption.textContent = caption ? caption.textContent : '';
          lightbox.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      });
    });

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  // ==========================================================
  // 4. UMKM FILTER
  // ==========================================================
  function setupUmkmFilter() {
    const filterButtons = document.querySelectorAll('.umkm-filter button');
    const umkmCards = document.querySelectorAll('.umkm-card-wrapper');

    if (!filterButtons.length) return;

    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterButtons.forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        const filterValue = this.getAttribute('data-filter');
        umkmCards.forEach(function (card) {
          if (filterValue === 'all') {
            card.style.display = 'block';
          } else {
            card.style.display = card.getAttribute('data-kategori') === filterValue ? 'block' : 'none';
          }
        });
      });
    });
  }

  // ==========================================================
  // 5. BERITA EXPAND / COLLAPSE
  // ==========================================================
  function setupBeritaExpand() {
    document.querySelectorAll('.berita-item').forEach(function (item) {
      const header = item.querySelector('.berita-header h3');
      const body = item.querySelector('.berita-body');
      const toggle = item.querySelector('.berita-toggle');

      function toggleBerita() {
        if (body) {
          body.classList.toggle('expanded');
          if (toggle) {
            toggle.textContent = body.classList.contains('expanded') ? 'Sembunyikan' : 'Baca selengkapnya';
          }
        }
      }

      if (header) {
        header.addEventListener('click', toggleBerita);
        header.style.cursor = 'pointer';
      }
      if (toggle) toggle.addEventListener('click', toggleBerita);
    });
  }

  // ==========================================================
  // 6. FORM PENDAFTARAN
  // ==========================================================
  const daftarForm = document.getElementById('daftarForm');
  const formContainer = document.getElementById('formContainer');
  const formSuccess = document.getElementById('formSuccess');

  if (daftarForm) {
    daftarForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const nama = document.getElementById('nama').value.trim();
      const usia = document.getElementById('usia').value.trim();
      const hp = document.getElementById('hp').value.trim();
      const alamat = document.getElementById('alamat').value.trim();
      const pekerjaan = document.getElementById('pekerjaan').value.trim();
      const alasan = document.getElementById('alasan').value.trim();

      if (!nama || !usia || !hp || !alamat || !alasan) {
        alert('Mohon lengkapi semua data yang diperlukan.');
        return;
      }

      if (isNaN(parseInt(usia)) || parseInt(usia) < 10 || parseInt(usia) > 60) {
        alert('Masukkan usia yang valid (10-60 tahun).');
        return;
      }

      try {
        const res = await fetch('/api/pendaftar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama_lengkap: nama, usia: parseInt(usia), no_hp: hp, alamat, pekerjaan, alasan_bergabung: alasan })
        });
        const data = await res.json();
        if (res.ok) {
          formContainer.style.display = 'none';
          formSuccess.classList.add('active');
        } else {
          alert('Gagal mendaftar: ' + (data.error || 'Terjadi kesalahan'));
        }
      } catch (err) {
        alert('Gagal terhubung ke server. Pastikan server berjalan.');
      }
    });
  }

  // ==========================================================
  // 7. FADE-IN ANIMATION
  // ==========================================================
  const fadeElements = document.querySelectorAll('.fade-in');
  if (fadeElements.length) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    fadeElements.forEach(function (el) { observer.observe(el); });
  }

  // ==========================================================
  // 8. SMOOTH COUNTER (Statistik)
  // ==========================================================
  function animateCounter(element, target, suffix) {
    suffix = suffix || '';
    let current = 0;
    const increment = Math.ceil(target / 60);
    const timer = setInterval(function () {
      current += increment;
      if (current >= target) { current = target; clearInterval(timer); }
      element.textContent = current + suffix;
    }, 25);
  }

  function setupCounters() {
    const statNumbers = document.querySelectorAll('.stat-number');
    if (!statNumbers.length) return;
    const statObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const el = entry.target;
          const text = el.textContent.trim();
          const match = text.match(/^(\d+)/);
          if (match) {
            const target = parseInt(match[0]);
            const suffix = text.replace(/^\d+/, '');
            el.textContent = '0' + suffix;
            animateCounter(el, target, suffix);
          }
          statObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    statNumbers.forEach(function (el) { statObserver.observe(el); });
  }

  // ==========================================================
  // 9. SMOOTH SCROLL
  // ==========================================================
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ==========================================================
  // 10. API DATA LOADER
  // ==========================================================
  const page = currentPath.replace('.html', '');

  async function loadKegiatanTerbaru() {
    const container = document.getElementById('kegiatanContainer');
    if (!container) return;
    try {
      const res = await fetch('/api/berita');
      const berita = await res.json();
      const items = berita.slice(0, 3);
      if (items.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#666">Belum ada kegiatan.</p>';
        return;
      }
      container.innerHTML = items.map(item => `
        <div class="card kegiatan-card fade-in">
          <div class="card-img-placeholder">${escapeHtml(item.judul.charAt(0))}</div>
          <div class="card-body">
            <span class="card-date">${formatDate(item.tanggal)}</span>
            <h3 class="card-title">${escapeHtml(item.judul)}</h3>
            <p class="card-text">${escapeHtml((item.isi || '').substring(0, 150))}${(item.isi || '').length > 150 ? '...' : ''}</p>
          </div>
        </div>
      `).join('');
      // Re-observe fade elements
      document.querySelectorAll('#kegiatanContainer .fade-in').forEach(el => {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { entry.target.classList.add('visible'); this.unobserve(entry.target); }
          });
        }, { threshold: 0.15 }).observe(el);
      });
    } catch (err) { container.innerHTML = '<p style="text-align:center;color:#666">Gagal memuat kegiatan.</p>'; }
  }

  async function loadStats() {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;
    try {
      const [programRes, umkmRes] = await Promise.all([
        fetch('/api/program').then(r => r.json()),
        fetch('/api/umkm').then(r => r.json())
      ]);
      statsContainer.innerHTML = `
        <div class="stat-item fade-in"><div class="stat-number">47</div><div class="stat-label">Anggota Aktif</div></div>
        <div class="stat-item fade-in"><div class="stat-number">32</div><div class="stat-label">Kegiatan Terselenggara</div></div>
        <div class="stat-item fade-in"><div class="stat-number">${programRes.length}</div><div class="stat-label">Program Kerja</div></div>
        <div class="stat-item fade-in"><div class="stat-number">${umkmRes.length}</div><div class="stat-label">UMKM Binaan</div></div>
      `;
      setupCounters();
    } catch (err) { /* keep default */ }
  }

  async function loadBerita() {
    const container = document.getElementById('beritaContainer');
    if (!container) return;
    try {
      const res = await fetch('/api/berita');
      const data = await res.json();
      if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#666">Belum ada berita.</p>';
        return;
      }
      container.innerHTML = data.map(item => `
        <div class="berita-item">
          <div class="berita-date">${formatDate(item.tanggal)}</div>
          <div class="berita-header"><h3>${escapeHtml(item.judul)}</h3></div>
          <div class="berita-body">
            <p>${escapeHtml(item.isi || '')}</p>
          </div>
          <div class="berita-toggle">Baca selengkapnya</div>
        </div>
      `).join('');
      setupBeritaExpand();
    } catch (err) { container.innerHTML = '<p style="text-align:center;padding:40px;color:#666">Gagal memuat berita.</p>'; }
  }

  async function loadGaleri() {
    const container = document.getElementById('galeriContainer');
    if (!container) return;
    try {
      const res = await fetch('/api/galeri');
      const data = await res.json();
      if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#666">Belum ada foto galeri.</p>';
        return;
      }
      container.innerHTML = data.map(item => `
        <div class="galeri-item">
          <img src="${escapeHtml(item.gambar)}" alt="${escapeHtml(item.judul || '')}" loading="lazy">
          <div class="galeri-overlay"><span>${escapeHtml(item.judul || '')}</span></div>
        </div>
      `).join('');
      setupLightbox();
    } catch (err) { container.innerHTML = '<p style="text-align:center;padding:40px;color:#666">Gagal memuat galeri.</p>'; }
  }

  async function loadProgram() {
    const rutinContainer = document.getElementById('programRutinContainer');
    const kalenderContainer = document.getElementById('programKalenderContainer');
    if (!rutinContainer && !kalenderContainer) return;
    try {
      const res = await fetch('/api/program');
      const data = await res.json();
      const rutin = data.filter(p => p.tipe === 'rutin');
      const kalender = data.filter(p => p.tipe === 'kalender');

      if (rutinContainer) {
        if (rutin.length === 0) {
          rutinContainer.innerHTML = '<p style="text-align:center;padding:20px;color:#666">Belum ada program rutin.</p>';
        } else {
          rutinContainer.innerHTML = rutin.map(item => `
            <div class="program-card fade-in">
              <div class="program-icon">${item.icon || '📋'}</div>
              <h3>${escapeHtml(item.judul)}</h3>
              <p>${escapeHtml(item.deskripsi || '')}</p>
              ${item.jadwal ? `<span class="program-jadwal">🕐 ${escapeHtml(item.jadwal)}</span>` : ''}
            </div>
          `).join('');
        }
      }

      if (kalenderContainer) {
        if (kalender.length === 0) {
          kalenderContainer.innerHTML = '<p style="text-align:center;padding:20px;color:#666">Belum ada agenda kalender.</p>';
        } else {
          kalenderContainer.innerHTML = kalender.map(item => `
            <div class="kalender-item fade-in">
              <div class="kalender-date">
                <span class="kalender-tanggal">${formatDate(item.tanggal_mulai)}</span>
              </div>
              <div class="kalender-info">
                <h4>${escapeHtml(item.judul)}</h4>
                <p>${escapeHtml(item.deskripsi || '')}</p>
              </div>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      if (rutinContainer) rutinContainer.innerHTML = '<p style="text-align:center;padding:20px;color:#666">Gagal memuat program.</p>';
      if (kalenderContainer) kalenderContainer.innerHTML = '<p style="text-align:center;padding:20px;color:#666">Gagal memuat kalender.</p>';
    }
  }

  async function loadUmkm() {
    const container = document.getElementById('umkmContainer');
    const filterContainer = document.getElementById('umkmFilterContainer');
    if (!container) return;
    try {
      const res = await fetch('/api/umkm');
      const data = await res.json();
      if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#666">Belum ada data UMKM.</p>';
        return;
      }

      const categories = ['all', ...new Set(data.map(item => item.kategori).filter(Boolean))];
      if (filterContainer) {
        filterContainer.innerHTML = categories.map(kat => `
          <button class="${kat === 'all' ? 'active' : ''}" data-filter="${kat}">${kat === 'all' ? 'Semua' : kat}</button>
        `).join('');
      }

      container.innerHTML = data.map(item => `
        <div class="umkm-card-wrapper" data-kategori="${escapeHtml(item.kategori || '')}">
          <div class="card umkm-card fade-in">
            <div class="umkm-kategori badge">${escapeHtml(item.kategori || '')}</div>
            <h3 class="umkm-nama">${escapeHtml(item.nama_usaha)}</h3>
            <p class="umkm-pemilik">👤 ${escapeHtml(item.pemilik || '')}</p>
            <p class="umkm-deskripsi">${escapeHtml(item.deskripsi || '')}</p>
            ${item.no_hp ? `<p class="umkm-kontak">📞 ${escapeHtml(item.no_hp)}</p>` : ''}
          </div>
        </div>
      `).join('');
      setupUmkmFilter();
    } catch (err) { container.innerHTML = '<p style="text-align:center;padding:40px;color:#666">Gagal memuat data UMKM.</p>'; }
  }

  async function loadKas() {
    const saldoEl = document.getElementById('kasSaldo');
    const ringkasanContainer = document.getElementById('kasRingkasan');
    const tabelContainer = document.getElementById('kasTabel');
    if (!tabelContainer) return;
    try {
      const res = await fetch('/api/kas');
      const data = await res.json();

      if (saldoEl) saldoEl.textContent = 'Rp ' + formatNumber(data.saldo);
      if (ringkasanContainer) {
        ringkasanContainer.innerHTML = `
          <div class="ringkasan-item">Total Pemasukan: <strong style="color:#28a745">Rp ${formatNumber(data.ringkasan.total_pemasukan)}</strong></div>
          <div class="ringkasan-item">Total Pengeluaran: <strong style="color:#dc3545">Rp ${formatNumber(data.ringkasan.total_pengeluaran)}</strong></div>
          <div class="ringkasan-item">Jumlah Transaksi: <strong>${data.ringkasan.jumlah_transaksi}</strong></div>
        `;
      }

      if (data.transaksi.length === 0) {
        tabelContainer.innerHTML = '<p style="text-align:center;padding:20px;color:#666">Belum ada transaksi.</p>';
        return;
      }
      tabelContainer.innerHTML = data.transaksi.map(item => `
        <tr>
          <td>${formatDate(item.tanggal)}</td>
          <td>${escapeHtml(item.deskripsi || '-')}</td>
          <td>${escapeHtml(item.kategori || '-')}</td>
          <td class="nominal hijau">${item.pemasukan > 0 ? 'Rp ' + formatNumber(item.pemasukan) : '-'}</td>
          <td class="nominal merah">${item.pengeluaran > 0 ? 'Rp ' + formatNumber(item.pengeluaran) : '-'}</td>
        </tr>
      `).join('');
    } catch (err) { tabelContainer.innerHTML = '<p style="text-align:center;padding:20px;color:#666">Gagal memuat data kas.</p>'; }
  }

  // Load data based on page
  switch (page) {
    case 'index':
      loadKegiatanTerbaru();
      loadStats();
      break;
    case 'berita':
      loadBerita();
      break;
    case 'galeri':
      loadGaleri();
      break;
    case 'program':
      loadProgram();
      break;
    case 'umkm':
      loadUmkm();
      break;
    case 'kas':
      loadKas();
      break;
  }

  // ==========================================================
  // UTILITIES
  // ==========================================================
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
    return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  }

}); // End DOMContentLoaded
