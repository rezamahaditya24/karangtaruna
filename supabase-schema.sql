-- Jalankan SQL ini di Supabase SQL Editor (https://supabase.com/dashboard/project/[ref]/sql/new)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'anggota',
  display_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS berita (
  id SERIAL PRIMARY KEY,
  judul VARCHAR(255) NOT NULL,
  isi TEXT,
  tanggal DATE,
  gambar VARCHAR(255),
  status VARCHAR(10) DEFAULT 'publish',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS galeri (
  id SERIAL PRIMARY KEY,
  judul VARCHAR(255),
  gambar TEXT NOT NULL,
  deskripsi TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS program (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  judul VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  jadwal VARCHAR(255),
  tipe VARCHAR(20) DEFAULT 'rutin',
  tanggal_mulai DATE,
  tanggal_selesai DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS umkm (
  id SERIAL PRIMARY KEY,
  nama_usaha VARCHAR(255) NOT NULL,
  pemilik VARCHAR(255),
  kategori VARCHAR(50),
  deskripsi TEXT,
  no_hp VARCHAR(20),
  gambar VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kas (
  id SERIAL PRIMARY KEY,
  tanggal DATE NOT NULL,
  deskripsi VARCHAR(255),
  kategori VARCHAR(100),
  pemasukan DECIMAL(15,2) DEFAULT 0,
  pengeluaran DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pengurus (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  jabatan VARCHAR(100),
  foto VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pendaftar (
  id SERIAL PRIMARY KEY,
  nama_lengkap VARCHAR(255) NOT NULL,
  usia INTEGER,
  no_hp VARCHAR(20),
  alamat TEXT,
  pekerjaan VARCHAR(255),
  alasan_bergabung TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaksi (
  id SERIAL PRIMARY KEY,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  tipe VARCHAR(50) NOT NULL,
  kategori VARCHAR(100) NOT NULL,
  jumlah NUMERIC(15,2) NOT NULL,
  deskripsi TEXT,
  kegiatan VARCHAR(255),
  kegiatan_id INTEGER,
  bukti_url TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  created_by INTEGER,
  diverifikasi_oleh INTEGER,
  diverifikasi_at TIMESTAMPTZ,
  dikunci_oleh INTEGER,
  dikunci_at TIMESTAMPTZ,
  koreksi_dari_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anggaran (
  id SERIAL PRIMARY KEY,
  kegiatan VARCHAR(255),
  kegiatan_id INTEGER,
  judul VARCHAR(255) NOT NULL,
  rencana NUMERIC(15,2) NOT NULL DEFAULT 0,
  periode_bulan INTEGER,
  periode_tahun INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iuran (
  id SERIAL PRIMARY KEY,
  anggota_id INTEGER NOT NULL,
  periode_bulan INTEGER NOT NULL,
  periode_tahun INTEGER NOT NULL,
  jumlah NUMERIC(15,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'lunas',
  transaksi_id INTEGER,
  lunas_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aktivitas_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  aksi VARCHAR(255) NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS komentar_transaksi (
  id SERIAL PRIMARY KEY,
  transaksi_id INTEGER NOT NULL,
  user_id INTEGER,
  pesan TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default admin user will be auto-created on app startup with:
--   Username: Admin
--   Password: Admin123
-- This is handled in config/db.js for both SQLite and PostgreSQL.
-- You can run the query below to create it manually if needed:
-- INSERT INTO users (username, password) VALUES ('Admin', '$2b$10$...bcrypt_hash_for_Admin123...')
-- ON CONFLICT (username) DO NOTHING;

-- Enable Row Level Security (optional for now)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE berita ENABLE ROW LEVEL SECURITY;
ALTER TABLE galeri ENABLE ROW LEVEL SECURITY;
ALTER TABLE program ENABLE ROW LEVEL SECURITY;
ALTER TABLE umkm ENABLE ROW LEVEL SECURITY;
ALTER TABLE kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendaftar ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE anggaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE iuran ENABLE ROW LEVEL SECURITY;
ALTER TABLE aktivitas_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE komentar_transaksi ENABLE ROW LEVEL SECURITY;
