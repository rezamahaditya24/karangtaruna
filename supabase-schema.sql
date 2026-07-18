-- Jalankan SQL ini di Supabase SQL Editor (https://supabase.com/dashboard/project/[ref]/sql/new)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
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

-- Create default admin user (password: admin123)
INSERT INTO users (username, password) 
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
ON CONFLICT (username) DO NOTHING;

-- Enable Row Level Security (optional for now)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE berita ENABLE ROW LEVEL SECURITY;
ALTER TABLE galeri ENABLE ROW LEVEL SECURITY;
ALTER TABLE program ENABLE ROW LEVEL SECURITY;
ALTER TABLE umkm ENABLE ROW LEVEL SECURITY;
ALTER TABLE kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendaftar ENABLE ROW LEVEL SECURITY;
