// ====================== KEUANGAN DASHBOARD ======================
async function loadKeuanganDashboard() {
  try {
    const data = await apiFetch(`${API}/keuangan/ringkasan`);
    document.getElementById('keuanganSummary').innerHTML = `
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-number" style="color:#28a745">Rp ${formatNumber(data.saldo_kas)}</div><div class="stat-label">Saldo Kas Umum</div></div>
      <div class="stat-card"><div class="stat-icon">🔒</div><div class="stat-number" style="color:#e67e22">Rp ${formatNumber(data.saldo_penting)}</div><div class="stat-label">Saldo Dana Penting</div></div>
      <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-number" style="color:#6c5ce7">Rp ${formatNumber(data.saldo)}</div><div class="stat-label">Total Kas</div></div>
      <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-number" style="color:#28a745">Rp ${formatNumber(data.bulanIni.pemasukan_kas)}</div><div class="stat-label">Pemasukan Kas</div></div>
      <div class="stat-card"><div class="stat-icon">📉</div><div class="stat-number" style="color:#dc3545">Rp ${formatNumber(data.bulanIni.pengeluaran_kas)}</div><div class="stat-label">Pengeluaran Kas</div></div>
      <div class="stat-card"><div class="stat-icon">💚</div><div class="stat-number" style="color:#e67e22">Rp ${formatNumber(data.bulanIni.pemasukan_penting)}</div><div class="stat-label">Pemasukan Penting</div></div>
      <div class="stat-card"><div class="stat-icon">🔴</div><div class="stat-number" style="color:#e67e22">Rp ${formatNumber(data.bulanIni.pengeluaran_penting)}</div><div class="stat-label">Pengeluaran Penting</div></div>
      <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-number">${data.total}</div><div class="stat-label">Total Transaksi</div></div>
      <div class="stat-card"><div class="stat-icon">⏳</div><div class="stat-number" style="color:#ffc107">${data.perluVerifikasi}</div><div class="stat-label">Perlu Verifikasi</div></div>
    `;
    const chartEl = document.getElementById('keuanganChart');
    const pk = data.bulanIni.pemasukan_kas, pk_ = data.bulanIni.pengeluaran_kas;
    const pp = data.bulanIni.pemasukan_penting, pp_ = data.bulanIni.pengeluaran_penting;
    const total = pk + pk_ + pp + pp_ || 1;
    chartEl.innerHTML = `
      <div style="max-width:480px;margin:0 auto">
        <div style="margin-bottom:15px;font-weight:bold;font-size:14px;color:#555">📊 Breakdown Bulan Ini</div>
        <div style="display:flex;align-items:center;margin-bottom:6px">
          <div style="width:12px;height:12px;background:#28a745;border-radius:3px;margin-right:8px"></div>
          <span style="flex:1">Pemasukan Kas</span><span style="font-weight:bold">Rp ${formatNumber(pk)}</span>
        </div>
        <div style="display:flex;align-items:center;margin-bottom:6px">
          <div style="width:12px;height:12px;background:#dc3545;border-radius:3px;margin-right:8px"></div>
          <span style="flex:1">Pengeluaran Kas</span><span style="font-weight:bold">Rp ${formatNumber(pk_)}</span>
        </div>
        <div style="display:flex;align-items:center;margin-bottom:6px">
          <div style="width:12px;height:12px;background:#81c784;border-radius:3px;margin-right:8px"></div>
          <span style="flex:1">Pemasukan Penting</span><span style="font-weight:bold">Rp ${formatNumber(pp)}</span>
        </div>
        <div style="display:flex;align-items:center;margin-bottom:10px">
          <div style="width:12px;height:12px;background:#e67e22;border-radius:3px;margin-right:8px"></div>
          <span style="flex:1">Pengeluaran Penting</span><span style="font-weight:bold">Rp ${formatNumber(pp_)}</span>
        </div>
        <div style="height:30px;background:#eee;border-radius:15px;overflow:hidden;display:flex">
          <div style="height:100%;background:#28a745;width:${pk/total*100}%;transition:width 0.5s" title="Pemasukan Kas"></div>
          <div style="height:100%;background:#dc3545;width:${pk_/total*100}%;transition:width 0.5s" title="Pengeluaran Kas"></div>
          <div style="height:100%;background:#81c784;width:${pp/total*100}%;transition:width 0.5s" title="Pemasukan Penting"></div>
          <div style="height:100%;background:#e67e22;width:${pp_/total*100}%;transition:width 0.5s" title="Pengeluaran Penting"></div>
        </div>
      </div>`;
    const recent = await apiFetch(`${API}/keuangan/transaksi?limit=10`);
    const cont = document.getElementById('keuanganRecentTable');
    if (!recent || !recent.length) { cont.innerHTML = '<div class="empty-state"><p>Belum ada transaksi.</p></div>'; return; }
    cont.innerHTML = `<table><thead><tr><th>Tgl/Jam</th><th>Tipe</th><th>Kategori</th><th>Jumlah</th><th>Status</th></tr></thead><tbody>${recent.map(t => `<tr>
      <td>${formatDate(t.created_at)}<br><small style="color:#999">${t.jam || ''}</small></td>
      <td><span class="badge ${t.tipe === 'pemasukan' ? 'badge-success' : 'badge-danger'}">${t.tipe}</span></td>
      <td>${escapeHtml(t.kategori)}</td>
      <td style="color:${t.tipe === 'pemasukan' ? '#28a745' : '#dc3545'}">Rp ${formatNumber(t.jumlah)}</td>
      <td><span class="badge ${t.status === 'terkunci' ? 'badge-success' : t.status === 'diverifikasi' ? 'badge-primary' : t.status === 'ditolak' ? 'badge-danger' : 'badge-warning'}">${t.status}</span></td>
    </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    document.getElementById('keuanganSummary').innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

// ====================== TRANSAKSI ======================
async function loadKeuanganTransaksi() {
  const container = document.getElementById('keuanganTableContainer');
  try {
    const tipe = document.getElementById('filterTipe').value;
    const status = document.getElementById('filterStatus').value;
    const search = document.getElementById('filterSearch').value;
    let url = `${API}/keuangan/transaksi?`;
    if (tipe) url += 'tipe=' + tipe + '&';
    if (status) url += 'status=' + status + '&';
    if (search) url += 'search=' + encodeURIComponent(search) + '&';
    const data = await apiFetch(url);
    if (!data || !data.length) { container.innerHTML = '<div class="empty-state"><p>Tidak ada transaksi.</p></div>'; return; }
    container.innerHTML = `<table><thead><tr>
      <th>Tgl/Jam</th><th>Tipe</th><th>Kategori</th><th>Deskripsi</th><th>Jumlah</th><th>Status</th><th>Dana</th><th>Dibuat Oleh</th><th>Aksi</th>
    </tr></thead><tbody>${data.map(t => `<tr>
      <td>${formatDate(t.created_at)}<br><small style="color:#999">${t.jam || formatDateTime(t.created_at).split(' ').pop()}</small></td>
      <td><span class="badge ${t.tipe === 'pemasukan' ? 'badge-success' : 'badge-danger'}">${t.tipe}</span></td>
      <td>${escapeHtml(t.kategori)}</td>
      <td>${escapeHtml(t.deskripsi.substring(0, 50))}${t.deskripsi.length > 50 ? '...' : ''}</td>
      <td style="color:${t.tipe === 'pemasukan' ? '#28a745' : '#dc3545'};font-weight:bold">Rp ${formatNumber(t.jumlah)}</td>
      <td><span class="badge ${t.status === 'terkunci' ? 'badge-success' : t.status === 'diverifikasi' ? 'badge-primary' : t.status === 'ditolak' ? 'badge-danger' : 'badge-warning'}">${t.status}</span></td>
      <td><span class="badge ${(!t.fund || t.fund === 'kas') ? 'badge-secondary' : 'badge-warning'}">${(!t.fund || t.fund === 'kas') ? 'Kas' : 'Penting'}</span></td>
      <td>${escapeHtml(t.created_by_name || '-')}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="detailKeuanganTransaksi(${t.id})">Detail${(() => { try { const urls = t.bukti_urls ? JSON.parse(t.bukti_urls) : (t.bukti_url ? [t.bukti_url] : []); return urls.length > 1 ? ` (${urls.length} img)` : urls.length === 1 ? ' 📷' : ''; } catch { return ''; } })()}</button>
        ${t.status === 'draft' ? `<button class="btn btn-sm btn-success" onclick="verifikasiKeuanganTransaksi(${t.id})">Verifikasi</button> <button class="btn btn-sm btn-danger" onclick="tolakKeuanganTransaksi(${t.id})">Tolak</button>` : ''}
        ${t.status === 'diverifikasi' && ['super_admin', 'ketua'].includes(role) ? `<button class="btn btn-sm btn-primary" onclick="kunciKeuanganTransaksi(${t.id})">Kunci</button>` : ''}
        ${t.status !== 'terkunci' && t.status !== 'ditolak' ? `<button class="btn btn-sm btn-warning" onclick="koreksiKeuanganTransaksi(${t.id})">Koreksi</button>` : ''}
        ${role === 'super_admin' && t.status !== 'terkunci' ? `<button class="btn btn-sm btn-danger" onclick="hapusKeuanganTransaksi(${t.id})">Hapus</button>` : ''}
        <button class="btn btn-sm btn-info" onclick="bukaKomentarKeuangan(${t.id})">💬</button>
      </td>
    </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

function openKeuanganForm() {
  document.getElementById('keuanganModalTitle').textContent = 'Tambah Transaksi';
  document.getElementById('keuanganFormFields').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label>Tipe</label><select name="tipe" required><option value="pemasukan">Pemasukan</option><option value="pengeluaran">Pengeluaran</option></select></div>
      <div class="form-group"><label>Kategori</label><select name="kategori" required>
        <option value="">Pilih Kategori</option>
        <optgroup label="Pemasukan"><option>Iuran Anggota</option><option>Donasi</option><option>Sponsor</option><option>Hasil Usaha</option><option>Lain-lain</option></optgroup>
        <optgroup label="Pengeluaran"><option>Operasional</option><option>Konsumsi</option><option>Acara</option><option>ATK</option><option>Transportasi</option><option>Lain-lain</option></optgroup>
      </select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Jumlah (Rp)</label><input type="number" name="jumlah" min="1" required></div>
      <div class="form-group"><label>Sumber Dana</label><select name="fund" required><option value="kas">Kas Umum</option><option value="penting">Dana Penting</option></select></div>
    </div>
    <div class="form-group"><label>Deskripsi</label><textarea name="deskripsi" rows="3" required placeholder="Untuk apa transaksi ini? Terkait kegiatan apa?"></textarea></div>
    <div class="form-group"><label>Kegiatan (opsional, ketik manual)</label><input type="text" name="kegiatan" placeholder="Misal: Dana Lomba 17 Agustus, Pentas Seni, dll"></div>
    <div class="form-group"><label>Upload Bukti (foto struk/nota)</label>
      <div id="buktiUploadContainer"><div style="display:flex;gap:8px;margin-bottom:6px"><input type="file" name="bukti" accept="image/*" style="flex:1"><button type="button" class="btn btn-sm btn-success" onclick="tambahInputBukti()">+</button></div></div>
    </div>
  `;
  document.getElementById('keuanganModal').classList.add('show');
  document.getElementById('keuanganForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await apiFetch(`${API}/keuangan/transaksi`, { method: 'POST', body: fd });
      closeKeuanganForm();
      loadKeuanganTransaksi();
    } catch (err) { alert('Error: ' + err.message); }
  };
}

function closeKeuanganForm() {
  document.getElementById('keuanganModal').classList.remove('show');
}

async function detailKeuanganTransaksi(id) {
  try {
    const data = await apiFetch(`${API}/keuangan/transaksi?limit=1000`);
    if (!data) { alert('Data gagal dimuat.'); return; }
    const t = data.find(d => d.id === id);
    if (!t) { alert('Transaksi tidak ditemukan.'); return; }
    const modal = document.getElementById('keuanganDetailModal');
    document.getElementById('keuanganDetailContent').innerHTML = `
      <div style="padding:15px 0">
        <table style="width:100%">
          <tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Tipe</td><td><span class="badge ${t.tipe === 'pemasukan' ? 'badge-success' : 'badge-danger'}">${t.tipe}</span></td></tr>
          <tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Kategori</td><td>${escapeHtml(t.kategori)}</td></tr>
          <tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Jumlah</td><td style="font-size:18px;font-weight:bold;color:${t.tipe === 'pemasukan' ? '#28a745' : '#dc3545'}">Rp ${formatNumber(t.jumlah)}</td></tr>
          <tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Deskripsi</td><td>${escapeHtml(t.deskripsi)}</td></tr>
          ${t.kegiatan ? `<tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Kegiatan</td><td>${escapeHtml(t.kegiatan)}</td></tr>` : ''}
          <tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Status</td><td><span class="badge ${t.status === 'terkunci' ? 'badge-success' : t.status === 'diverifikasi' ? 'badge-primary' : t.status === 'ditolak' ? 'badge-danger' : 'badge-warning'}">${t.status}</span></td></tr>
          <tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Dana</td><td><span class="badge ${(!t.fund || t.fund === 'kas') ? 'badge-secondary' : 'badge-warning'}">${(!t.fund || t.fund === 'kas') ? 'Kas Umum' : 'Dana Penting'}</span></td></tr>
          <tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Dibuat Oleh</td><td>${escapeHtml(t.created_by_name || '-')}</td></tr>
          <tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Diverifikasi Oleh</td><td>${escapeHtml(t.diverifikasi_oleh_name || '-')}</td></tr>
          <tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Dikunci Oleh</td><td>${escapeHtml(t.dikunci_oleh_name || '-')}</td></tr>
          ${t.bukti_urls || t.bukti_url ? `<tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Bukti</td><td><div style="display:flex;flex-wrap:wrap;gap:8px">${(() => { try { const urls = t.bukti_urls ? JSON.parse(t.bukti_urls) : (t.bukti_url ? [t.bukti_url] : []); return urls.map(u => `<a href="${u}" target="_blank"><img src="${u}" style="max-width:150px;max-height:150px;border-radius:8px;cursor:pointer;object-fit:cover"></a>`).join(''); } catch { return `<a href="${t.bukti_url}" target="_blank"><img src="${t.bukti_url}" style="max-width:200px;max-height:200px;border-radius:8px;cursor:pointer"></a>`; } })()}</div></td></tr>` : ''}
          ${t.koreksi_dari_id ? `<tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Koreksi Dari</td><td>Transaksi #${t.koreksi_dari_id}</td></tr>` : ''}
          <tr><td style="font-weight:bold;padding:6px 12px 6px 0;color:#666">Tanggal/Jam</td><td>${formatDate(t.created_at)} ${t.jam || ''}</td></tr>
        </table>
      </div>`;
    modal.classList.add('show');
  } catch (err) { alert('Error: ' + err.message); }
}

function closeKeuanganDetail() {
  document.getElementById('keuanganDetailModal').classList.remove('show');
}

async function verifikasiKeuanganTransaksi(id) {
  if (!confirm('Verifikasi transaksi ini?')) return;
  try {
    const res = await apiFetch(`${API}/keuangan/transaksi/${id}/verifikasi`, { method: 'POST' });
    alert(res.message || 'Terverifikasi.');
    loadKeuanganTransaksi();
  } catch (err) { alert('Error: ' + err.message); }
}

async function kunciKeuanganTransaksi(id) {
  if (!confirm('Kunci transaksi ini? Transaksi terkunci tidak bisa diubah atau dihapus.')) return;
  try {
    const res = await apiFetch(`${API}/keuangan/transaksi/${id}/kunci`, { method: 'POST' });
    alert(res.message || 'Terkunci.');
    loadKeuanganTransaksi();
  } catch (err) { alert('Error: ' + err.message); }
}

async function tolakKeuanganTransaksi(id) {
  if (!confirm('Tolak transaksi ini?')) return;
  try {
    const res = await apiFetch(`${API}/keuangan/transaksi/${id}/tolak`, { method: 'POST' });
    alert(res.message || 'Ditolak.');
    loadKeuanganTransaksi();
  } catch (err) { alert('Error: ' + err.message); }
}

async function koreksiKeuanganTransaksi(id) {
  try {
    const data = await apiFetch(`${API}/keuangan/transaksi?limit=1000`);
    if (!data) { alert('Data gagal dimuat.'); return; }
    const t = data.find(d => d.id === id);
    if (!t) { alert('Transaksi tidak ditemukan.'); return; }
    document.getElementById('keuanganModalTitle').textContent = 'Koreksi Transaksi #' + id;
    document.getElementById('keuanganFormFields').innerHTML = `
      <p style="color:#856404;background:#fff3cd;padding:10px;border-radius:6px;margin-bottom:15px">Koreksi akan membuat entri baru. Data asli tetap tersimpan.</p>
      <div class="form-row">
        <div class="form-group"><label>Tipe</label><select name="tipe"><option value="pemasukan" ${t.tipe === 'pemasukan' ? 'selected' : ''}>Pemasukan</option><option value="pengeluaran" ${t.tipe === 'pengeluaran' ? 'selected' : ''}>Pengeluaran</option></select></div>
        <div class="form-group"><label>Kategori</label><input type="text" name="kategori" value="${escapeHtml(t.kategori)}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Jumlah (Rp)</label><input type="number" name="jumlah" value="${t.jumlah}" min="1" required></div>
        <div class="form-group"><label>Sumber Dana</label><select name="fund"><option value="kas" ${(!t.fund || t.fund === 'kas') ? 'selected' : ''}>Kas Umum</option><option value="penting" ${t.fund === 'penting' ? 'selected' : ''}>Dana Penting</option></select></div>
      </div>
      <div class="form-group"><label>Deskripsi</label><textarea name="deskripsi" rows="3" required>${escapeHtml(t.deskripsi)}</textarea></div>
      <div class="form-group"><label>Kegiatan (opsional)</label><input type="text" name="kegiatan" value="${escapeHtml(t.kegiatan || '')}" placeholder="Misal: Dana Lomba 17 Agustus"></div>
      <div class="form-group"><label>Upload Bukti Baru (opsional)</label>
        <div id="buktiUploadContainer"><div style="display:flex;gap:8px;margin-bottom:6px"><input type="file" name="bukti" accept="image/*" style="flex:1"><button type="button" class="btn btn-sm btn-success" onclick="tambahInputBukti()">+</button></div></div>
      </div>
    `;
    document.getElementById('keuanganModal').classList.add('show');
    document.getElementById('keuanganForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const res = await apiFetch(`${API}/keuangan/transaksi/${id}/koreksi`, { method: 'POST', body: fd });
        alert(res.message);
        closeKeuanganForm();
        loadKeuanganTransaksi();
      } catch (err) { alert('Error: ' + err.message); }
    };
  } catch (err) { alert('Error: ' + err.message); }
}

// ====================== ANGGARAN ======================
async function loadKeuanganAnggaran() {
  const container = document.getElementById('keuanganAnggaranContainer');
  try {
    const data = await apiFetch(`${API}/keuangan/anggaran`);
    if (!data || !data.length) { container.innerHTML = '<div class="empty-state"><p>Belum ada anggaran.</p></div>'; return; }
    container.innerHTML = `<table><thead><tr>
      <th>Kegiatan</th><th>Judul</th><th>Rencana</th><th>Realisasi</th><th>Sisa</th><th>Progress</th><th>Aksi</th>
    </tr></thead><tbody>${data.map(a => {
      const sisa = a.rencana - a.realisasi;
      const pct = a.rencana > 0 ? Math.min(100, Math.round(a.realisasi / a.rencana * 100)) : 0;
      const warning = pct >= 90 ? 'color:#dc3545' : pct >= 75 ? 'color:#ffc107' : 'color:#28a745';
      const kegiatanNama = a.kegiatan_nama || '-';
      return `<tr>
        <td>${escapeHtml(kegiatanNama)}</td>
        <td>${escapeHtml(a.judul)}</td>
        <td>Rp ${formatNumber(a.rencana)}</td>
        <td>Rp ${formatNumber(a.realisasi)}</td>
        <td style="${sisa < 0 ? 'color:#dc3545;font-weight:bold' : 'color:#28a745'}">${sisa < 0 ? 'Over Rp ' + formatNumber(Math.abs(sisa)) : 'Rp ' + formatNumber(sisa)}</td>
        <td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${pct >= 90 ? '#dc3545' : pct >= 75 ? '#ffc107' : '#28a745'};border-radius:4px;transition:width 0.5s"></div></div><span style="${warning};font-size:12px;font-weight:bold">${pct}%</span></div></td>
        <td><button class="btn btn-sm btn-warning" onclick="editKeuanganAnggaran(${a.id}, ${a.rencana})">Edit</button>${role === 'super_admin' ? ` <button class="btn btn-sm btn-danger" onclick="hapusKeuanganAnggaran(${a.id})">Hapus</button>` : ''}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

function openKeuanganAnggaranForm() {
  document.getElementById('keuanganAnggaranModalTitle').textContent = 'Tambah Anggaran';
  document.getElementById('keuanganAnggaranFormFields').innerHTML = `
    <div class="form-group"><label>Kegiatan (Program)</label><select name="kegiatan_id" id="anggaranKegiatanSelect"><option value="">Pilih Program</option></select></div>
    <div class="form-group"><label>Judul Anggaran</label><input type="text" name="judul" required placeholder="Misal: Konsumsi, Dekorasi, dll"></div>
    <div class="form-row">
      <div class="form-group"><label>Rencana Anggaran (Rp)</label><input type="number" name="rencana" min="1" required></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Periode Bulan</label><select name="periode_bulan">${['',1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}">${m || 'Pilih'}</option>`).join('')}</select></div>
      <div class="form-group"><label>Periode Tahun</label><select name="periode_tahun">${[2024,2025,2026,2027,2028].map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
    </div>
  `;
  loadKegiatanOptions('keuanganAnggaranForm');
  document.getElementById('keuanganAnggaranModal').classList.add('show');
  document.getElementById('keuanganAnggaranForm').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await apiFetch(`${API}/keuangan/anggaran`, { method: 'POST', body: JSON.stringify(data) });
      closeKeuanganAnggaranForm();
      loadKeuanganAnggaran();
    } catch (err) { alert('Error: ' + err.message); }
  };
}

function closeKeuanganAnggaranForm() {
  document.getElementById('keuanganAnggaranModal').classList.remove('show');
}

async function editKeuanganAnggaran(id, currentRencana) {
  const baru = prompt('Edit rencana anggaran (Rp):', currentRencana);
  if (!baru || isNaN(baru) || parseFloat(baru) <= 0) return;
  try {
    await apiFetch(`${API}/keuangan/anggaran/${id}`, { method: 'PUT', body: JSON.stringify({ rencana: parseFloat(baru) }) });
    loadKeuanganAnggaran();
  } catch (err) { alert('Error: ' + err.message); }
}

// ====================== IURAN ======================
async function loadKeuanganIuran() {
  const container = document.getElementById('keuanganIuranContainer');
  try {
    const data = await apiFetch(`${API}/keuangan/iuran`);
    if (!data || !data.length) { container.innerHTML = '<div class="empty-state"><p>Belum ada data iuran.</p></div>'; return; }
    container.innerHTML = `<table><thead><tr>
      <th>Anggota</th><th>Periode</th><th>Jumlah</th><th>Status</th><th>Lunas At</th>${role === 'super_admin' ? '<th>Aksi</th>' : ''}
    </tr></thead><tbody>${data.map(i => `<tr>
      <td>${escapeHtml(i.anggota_nama || 'Anggota #' + i.anggota_id)}</td>
      <td>${i.periode_bulan}/${i.periode_tahun}</td>
      <td>Rp ${formatNumber(i.jumlah)}</td>
      <td><span class="badge ${i.status === 'lunas' ? 'badge-success' : 'badge-warning'}">${i.status}</span></td>
      <td>${i.lunas_at ? formatDate(i.lunas_at) : '-'}</td>
      ${role === 'super_admin' ? `<td><button class="btn btn-sm btn-danger" onclick="hapusKeuanganIuran(${i.id})">Hapus</button></td>` : ''}
    </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

function openKeuanganIuranForm() {
  document.getElementById('keuanganIuranFormFields').innerHTML = `
    <div class="form-group"><label>Anggota</label><select name="anggota_id" id="iuranAnggotaSelect" required></select></div>
    <div class="form-row">
      <div class="form-group"><label>Bulan</label><select name="periode_bulan" required>${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${m === new Date().getMonth() + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="form-group"><label>Tahun</label><select name="periode_tahun" required>${[2024,2025,2026,2027,2028].map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label>Jumlah (Rp)</label><input type="number" name="jumlah" min="1" required></div>
    <div class="form-group"><label>Transaksi Terkait (opsional)</label><input type="number" name="transaksi_id" placeholder="ID transaksi jika sudah dicatat"></div>
  `;
  loadAnggotaOptions();
  document.getElementById('keuanganIuranModal').classList.add('show');
  document.getElementById('keuanganIuranForm').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await apiFetch(`${API}/keuangan/iuran`, { method: 'POST', body: JSON.stringify(data) });
      closeKeuanganIuranForm();
      loadKeuanganIuran();
    } catch (err) { alert('Error: ' + err.message); }
  };
}

function closeKeuanganIuranForm() {
  document.getElementById('keuanganIuranModal').classList.remove('show');
}

// ====================== KOMENTAR ======================
let komentarTransaksiId = null;

async function bukaKomentarKeuangan(id) {
  komentarTransaksiId = id;
  document.getElementById('keuanganKomentarModal').classList.add('show');
  await loadKomentarKeuangan();
}

function closeKeuanganKomentar() {
  document.getElementById('keuanganKomentarModal').classList.remove('show');
  komentarTransaksiId = null;
}

async function loadKomentarKeuangan() {
  if (!komentarTransaksiId) return;
  try {
    const data = await apiFetch(`${API}/keuangan/transaksi/${komentarTransaksiId}/komentar`);
    const list = document.getElementById('keuanganKomentarList');
    if (!data || !data.length) { list.innerHTML = '<p style="color:#999;text-align:center;padding:20px">Belum ada komentar. Jadilah yang pertama bertanya.</p>'; return; }
    list.innerHTML = data.map(k => `
      <div style="background:#f8f9fa;padding:10px 14px;border-radius:8px;margin-bottom:8px">
        <strong style="font-size:13px">${escapeHtml(k.user_name)}</strong>
        <span style="font-size:11px;color:#999;margin-left:8px">${formatDate(k.created_at)}</span>
        <p style="margin:6px 0 0 0;font-size:14px">${escapeHtml(k.pesan)}</p>
      </div>
    `).join('');
    document.getElementById('keuanganKomentarForm').onsubmit = async (e) => {
      e.preventDefault();
      const pesan = document.getElementById('keuanganKomentarInput').value.trim();
      if (!pesan) return;
      try {
        await apiFetch(`${API}/keuangan/transaksi/${komentarTransaksiId}/komentar`, { method: 'POST', body: JSON.stringify({ pesan }) });
        document.getElementById('keuanganKomentarInput').value = '';
        await loadKomentarKeuangan();
      } catch (err) { alert('Error: ' + err.message); }
    };
  } catch (err) { alert('Error: ' + err.message); }
}

// ====================== LOG ======================
async function loadKeuanganLog() {
  const container = document.getElementById('keuanganLogContainer');
  try {
    const data = await apiFetch(`${API}/keuangan/log`);
    if (!data || !data.length) { container.innerHTML = '<div class="empty-state"><p>Belum ada aktivitas.</p></div>'; return; }
    container.innerHTML = `<table><thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Detail</th></tr></thead><tbody>${data.map(l => `<tr>
      <td>${formatDate(l.created_at)}</td>
      <td>${escapeHtml(l.user_name || '-')}</td>
      <td><span class="badge badge-primary">${escapeHtml(l.aksi)}</span></td>
      <td style="font-size:13px;color:#666">${escapeHtml(l.detail || '')}</td>
    </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

// ====================== USERS ======================
async function loadKeuanganUsers() {
  const container = document.getElementById('keuanganUsersContainer');
  try {
    const data = await apiFetch(`${API}/keuangan/users`);
    if (!data || !data.length) { container.innerHTML = '<div class="empty-state"><p>Tidak ada data user.</p></div>'; return; }
    container.innerHTML = `<table><thead><tr><th>ID</th><th>Username</th><th>Nama</th><th>Role</th><th>Tanggal Dibuat</th><th>Aksi</th></tr></thead><tbody>${data.map(u => `<tr>
      <td>${u.id}</td>
      <td>${escapeHtml(u.username)}</td>
      <td>${escapeHtml(u.display_name || '-')}</td>
      <td><span class="badge ${u.role === 'super_admin' ? 'badge-success' : u.role === 'bendahara' ? 'badge-primary' : u.role === 'ketua' ? 'badge-info' : u.role === 'pengurus' ? 'badge-warning' : 'badge-secondary'}">${escapeHtml(u.role)}</span></td>
      <td>${formatDate(u.created_at)}</td>
      <td><button class="btn btn-sm btn-warning" onclick="ubahRoleUser(${u.id}, '${escapeHtml(u.role)}')">Ubah Role</button>${role === 'super_admin' ? ` <button class="btn btn-sm btn-danger" onclick="hapusKeuanganUser(${u.id})">Hapus</button>` : ''}</td>
    </tr>`).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Gagal memuat data: ${err.message}</p></div>`;
  }
}

function openTambahUser() {
  document.getElementById('tambahUserModal').classList.add('show');
}

function closeTambahUser() {
  document.getElementById('tambahUserModal').classList.remove('show');
  document.getElementById('tambahUserForm').reset();
}

document.getElementById('tambahUserForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const fd = new FormData(this);
  try {
    await apiFetch(`${API}/keuangan/users`, { method: 'POST', body: JSON.stringify(Object.fromEntries(fd)) });
    closeTambahUser();
    loadKeuanganUsers();
  } catch (err) { alert('Error: ' + err.message); }
});

async function ubahRoleUser(id, currentRole) {
  const roles = ['anggota', 'pengurus', 'ketua', 'bendahara', 'super_admin'];
  const role = prompt(`Ubah role user #${id} (${currentRole}):\nPilih: anggota, pengurus, ketua, bendahara, super_admin`, currentRole);
  if (!role || !roles.includes(role)) return;
  try {
    await apiFetch(`${API}/keuangan/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
    loadKeuanganUsers();
  } catch (err) { alert('Error: ' + err.message); }
}

// ====================== HELPERS ======================
async function loadKegiatanOptions(formId, selectedId) {
  try {
    const data = await apiFetch(`${API}/program`);
    if (!data) return;
    const selects = document.querySelectorAll(`#${formId} select[name="kegiatan_id"], #${formId} #anggaranKegiatanSelect`);
    selects.forEach(sel => {
      if (!sel) return;
      data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.judul;
        if (selectedId && p.id == selectedId) opt.selected = true;
        sel.appendChild(opt);
      });
    });
  } catch (_) {}
}

async function loadAnggotaOptions() {
  try {
    const data = await apiFetch(`${API}/pendaftar`);
    if (!data) return;
    const sel = document.getElementById('iuranAnggotaSelect');
    if (!sel) return;
    data.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nama_lengkap;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

function tambahInputBukti() {
  const container = document.getElementById('buktiUploadContainer');
  if (!container) return;
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:6px';
  div.innerHTML = '<input type="file" name="bukti" accept="image/*" style="flex:1"><button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">&times;</button>';
  container.appendChild(div);
}

async function hapusKeuanganTransaksi(id) {
  if (!confirm('Hapus transaksi ini? Tindakan ini tidak bisa dibatalkan.')) return;
  try {
    const res = await apiFetch(`${API}/keuangan/transaksi/${id}`, { method: 'DELETE' });
    alert(res.message);
    loadKeuanganTransaksi();
  } catch (err) { alert('Error: ' + err.message); }
}

async function hapusKeuanganAnggaran(id) {
  if (!confirm('Hapus anggaran ini?')) return;
  try {
    const res = await apiFetch(`${API}/keuangan/anggaran/${id}`, { method: 'DELETE' });
    alert(res.message);
    loadKeuanganAnggaran();
  } catch (err) { alert('Error: ' + err.message); }
}

async function hapusKeuanganIuran(id) {
  if (!confirm('Hapus iuran ini?')) return;
  try {
    const res = await apiFetch(`${API}/keuangan/iuran/${id}`, { method: 'DELETE' });
    alert(res.message);
    loadKeuanganIuran();
  } catch (err) { alert('Error: ' + err.message); }
}

async function hapusKeuanganUser(id) {
  if (!confirm('Hapus user ini? Tindakan ini tidak bisa dibatalkan.')) return;
  try {
    const res = await apiFetch(`${API}/keuangan/users/${id}`, { method: 'DELETE' });
    alert(res.message);
    loadKeuanganUsers();
  } catch (err) { alert('Error: ' + err.message); }
}

// ====================== EXPORT & LAPORAN SPREADSHEET LIVE ======================
let _laporanMenu = '';

function showLaporanModal(menu) {
  _laporanMenu = menu;
  const userToken = localStorage.getItem('token') || '';
  const baseUrl = window.location.origin;
  const csvUrl = `${baseUrl}/api/keuangan/laporan/csv/${menu}?token=${encodeURIComponent(userToken)}`;
  const titles = {
    transaksi: 'Laporan Transaksi',
    anggaran: 'Laporan Anggaran',
    iuran: 'Laporan Iuran',
    log: 'Log Aktivitas',
    users: 'Data User',
    ringkasan: 'Ringkasan Keuangan'
  };
  document.getElementById('laporanModalBody').innerHTML = `
    <p style="margin-bottom:12px"><strong>${titles[menu] || 'Laporan'}</strong></p>
    <p style="margin-bottom:8px;color:#555">Gunakan link ini di Google Sheets dengan fungsi <code style="background:#eee;padding:2px 6px;border-radius:3px;font-size:12px">=IMPORTDATA("URL")</code> agar tabel selalu <strong>auto-update</strong>:</p>
    <div style="display:flex;gap:6px;margin-bottom:12px">
      <input type="text" id="laporanCsvUrl" value="${csvUrl}" readonly
        style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:12px;background:#f9f9f9">
      <button class="btn btn-sm btn-primary" onclick="salinLinkLaporan()">📋 Salin</button>
    </div>
    <p style="margin-bottom:4px;color:#888;font-size:13px">Atau download file CSV untuk impor manual:</p>
  `;
  document.getElementById('laporanDownloadBtn').onclick = () => downloadLaporanCSV(menu);
  document.getElementById('laporanModal').style.display = 'flex';
}

function closeLaporanModal() {
  document.getElementById('laporanModal').style.display = 'none';
}

function salinLinkLaporan() {
  const input = document.getElementById('laporanCsvUrl');
  if (!input) return;
  input.select();
  input.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.querySelector('#laporanModal .modal-footer .btn-primary');
    if (btn) { btn.textContent = '✅ Tersalin!'; setTimeout(() => { btn.textContent = '📋 Salin Link Spreadsheet'; }, 2000); }
  }).catch(() => {
    alert('Link: ' + input.value);
  });
}

function formatRupiah(n) {
  return 'Rp ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function escCsv(v) {
  const s = String(v == null ? '' : v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCsvFile(filename, headers, rows) {
  const csv = [headers.join(','), ...rows.map(r => r.map(escCsv).join(','))].join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function downloadLaporanCSV(menu) {
  try {
    if (menu === 'transaksi') {
      const data = await apiFetch(`${API}/keuangan/transaksi`);
      if (!data || !data.length) { alert('Tidak ada data untuk diexport.'); return; }
      downloadCsvFile('laporan-transaksi.csv',
        ['Tanggal', 'Jam', 'Tipe', 'Kategori', 'Jumlah', 'Deskripsi', 'Status', 'Dana', 'Bukti URL', 'Dibuat Oleh'],
        data.map(t => [
          formatDate(t.created_at), t.jam || '', t.tipe, t.kategori, formatRupiah(t.jumlah),
          (t.deskripsi || '').replace(/,/g, ';'), t.status, !t.fund || t.fund === 'kas' ? 'Kas' : 'Penting',
          (() => { try { const urls = t.bukti_urls ? JSON.parse(t.bukti_urls) : (t.bukti_url ? [t.bukti_url] : []); return urls.join('; '); } catch { return t.bukti_url || ''; } })(),
          t.created_by_name || '-'
        ])
      );
    } else if (menu === 'anggaran') {
      const data = await apiFetch(`${API}/keuangan/anggaran`);
      if (!data || !data.length) { alert('Tidak ada data untuk diexport.'); return; }
      downloadCsvFile('laporan-anggaran.csv',
        ['Kegiatan', 'Judul', 'Rencana', 'Realisasi', 'Sisa', 'Progress (%)'],
        data.map(a => [
          a.kegiatan_nama || '-', a.judul, formatRupiah(a.rencana), formatRupiah(a.realisasi),
          formatRupiah(a.rencana - a.realisasi), a.rencana > 0 ? Math.round(a.realisasi / a.rencana * 100) : 0
        ])
      );
    } else if (menu === 'iuran') {
      const data = await apiFetch(`${API}/keuangan/iuran`);
      if (!data || !data.length) { alert('Tidak ada data untuk diexport.'); return; }
      downloadCsvFile('laporan-iuran.csv',
        ['Anggota', 'Periode', 'Jumlah', 'Status', 'Lunas At'],
        data.map(i => [
          i.anggota_nama || 'Anggota #' + i.anggota_id, i.periode_bulan + '/' + i.periode_tahun,
          formatRupiah(i.jumlah), i.status, i.lunas_at ? formatDate(i.lunas_at) : '-'
        ])
      );
    } else if (menu === 'log') {
      const data = await apiFetch(`${API}/keuangan/log`);
      if (!data || !data.length) { alert('Tidak ada data untuk diexport.'); return; }
      downloadCsvFile('laporan-log-aktivitas.csv',
        ['Waktu', 'User', 'Aksi', 'Detail'],
        data.map(l => [formatDate(l.created_at), l.user_name || '-', l.aksi, l.detail || ''])
      );
    } else if (menu === 'users') {
      const data = await apiFetch(`${API}/keuangan/users`);
      if (!data || !data.length) { alert('Tidak ada data untuk diexport.'); return; }
      downloadCsvFile('laporan-users.csv',
        ['ID', 'Username', 'Nama', 'Role', 'Tanggal Dibuat'],
        data.map(u => [u.id, u.username, u.display_name || '-', u.role, formatDate(u.created_at)])
      );
    } else if (menu === 'ringkasan') {
      const data = await apiFetch(`${API}/keuangan/ringkasan`);
      downloadCsvFile('laporan-ringkasan-keuangan.csv',
        ['Metrik', 'Nilai'],
        [
          ['Saldo Kas Umum', formatRupiah(data.saldo_kas)],
          ['Saldo Dana Penting', formatRupiah(data.saldo_penting)],
          ['Total Kas', formatRupiah(data.saldo)],
          ['Total Transaksi', data.total],
          ['Perlu Verifikasi', data.perluVerifikasi],
          ['Pemasukan Kas (Bulan Ini)', formatRupiah(data.bulanIni.pemasukan_kas)],
          ['Pengeluaran Kas (Bulan Ini)', formatRupiah(data.bulanIni.pengeluaran_kas)],
          ['Pemasukan Penting (Bulan Ini)', formatRupiah(data.bulanIni.pemasukan_penting)],
          ['Pengeluaran Penting (Bulan Ini)', formatRupiah(data.bulanIni.pengeluaran_penting)]
        ]
      );
    }
  } catch (err) { alert('Error: ' + err.message); }
}

// Redirect existing exports to modal
async function exportKeuanganTransaksi() { showLaporanModal('transaksi'); }
async function exportKeuanganAnggaran()  { showLaporanModal('anggaran'); }
async function exportKeuanganIuran()     { showLaporanModal('iuran'); }
async function exportKeuanganLog()       { showLaporanModal('log'); }
async function exportKeuanganUsers()     { showLaporanModal('users'); }
async function exportKeuanganDashboard() { showLaporanModal('ringkasan'); }

