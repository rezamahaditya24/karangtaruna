-- Jalankan SQL ini di Supabase SQL Editor (https://supabase.com/dashboard/project/[ref]/sql/new)
-- untuk memperbaiki missing columns yang menyebabkan error PGRST204

-- 1. Pastikan tabel anggaran memiliki semua kolom yang diperlukan
ALTER TABLE anggaran ADD COLUMN IF NOT EXISTS kegiatan_id INTEGER;
ALTER TABLE anggaran ADD COLUMN IF NOT EXISTS periode_bulan INTEGER;
ALTER TABLE anggaran ADD COLUMN IF NOT EXISTS periode_tahun INTEGER;

-- 2. Pastikan tabel users memiliki kolom display_name dan role
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'anggota';

-- 3. Pastikan tabel transaksi memiliki semua kolom
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS kegiatan VARCHAR(255);
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS kegiatan_id INTEGER;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS bukti_url TEXT;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS diverifikasi_oleh INTEGER;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS diverifikasi_at TIMESTAMPTZ;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS dikunci_oleh INTEGER;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS dikunci_at TIMESTAMPTZ;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS koreksi_dari_id INTEGER;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS jam VARCHAR(5);
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS bukti_urls TEXT;

-- 4. Tambah kolom bukti_urls dan fund
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS bukti_urls TEXT;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS fund VARCHAR(20) DEFAULT 'kas';

-- 5. Refresh schema cache
-- Setelah menjalankan ALTER TABLE, schema cache Supabase otomatis ter-refresh dalam beberapa detik.
-- Jika masih error, tunggu 30 detik atau restart project dari dashboard.
