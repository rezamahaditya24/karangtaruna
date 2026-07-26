const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

function createFallbackDb() {
  return {
    query: async () => { throw new Error('Database not configured. Set DATABASE_URL or DB_PATH.'); },
    get: async () => { throw new Error('Database not configured. Set DATABASE_URL or DB_PATH.'); },
    run: async () => { throw new Error('Database not configured. Set DATABASE_URL or DB_PATH.'); },
    exec: async () => { throw new Error('Database not configured. Set DATABASE_URL or DB_PATH.'); }
  };
}

const isNetlify = !!process.env.NETLIFY;

let db;

try {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');

    const dbUrl = new URL(process.env.DATABASE_URL);
    dbUrl.searchParams.delete('sslmode');
    dbUrl.searchParams.delete('ssl');

    const pool = new Pool({
      connectionString: dbUrl.toString(),
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 60000,
      allowExitOnIdle: true
    });

    pool.on('error', (err) => console.error('PostgreSQL pool error:', err.message));

    function convert(sql, params) {
      let i = 0;
      const text = sql.replace(/\?/g, () => `$${++i}`);
      return { text, values: params || [] };
    }

    db = {
      query: async (sql, params) => {
        const { text, values } = convert(sql, params);
        const result = await pool.query(text, values);
        return result.rows;
      },
      get: async (sql, params) => {
        const { text, values } = convert(sql, params);
        const result = await pool.query(text, values);
        return result.rows[0] || null;
      },
      run: async (sql, params) => {
        const { text, values } = convert(sql, params);
        const isInsert = text.trim().toUpperCase().startsWith('INSERT') && !text.toUpperCase().includes('RETURNING');
        const finalSql = isInsert ? text + ' RETURNING id' : text;
        const result = await pool.query(finalSql, values);
        const row = result.rows?.[0];
        return { lastInsertRowid: row?.id || 0, changes: result.rowCount || 0 };
      },
      exec: async (sql) => { await pool.query(sql); }
    };

    (async () => {
      try {
        await db.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'anggota'`);
        await db.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100)`);
      } catch (_) { /* column may already exist */ }

      try {
        await db.exec(`
          CREATE TABLE IF NOT EXISTS transaksi (
            id SERIAL PRIMARY KEY,
            tipe VARCHAR(20) NOT NULL,
            kategori VARCHAR(100) NOT NULL,
            jumlah DECIMAL(15,2) NOT NULL,
            deskripsi TEXT NOT NULL,
            kegiatan_id INTEGER REFERENCES program(id),
            bukti_url TEXT,
            status VARCHAR(20) DEFAULT 'draft',
            created_by INTEGER NOT NULL REFERENCES users(id),
            diverifikasi_oleh INTEGER REFERENCES users(id),
            diverifikasi_at TIMESTAMPTZ,
            dikunci_oleh INTEGER REFERENCES users(id),
            dikunci_at TIMESTAMPTZ,
            koreksi_dari_id INTEGER REFERENCES transaksi(id),
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS anggaran (
            id SERIAL PRIMARY KEY,
            kegiatan_id INTEGER NOT NULL REFERENCES program(id),
            judul VARCHAR(255) NOT NULL,
            rencana DECIMAL(15,2) DEFAULT 0,
            realisasi DECIMAL(15,2) DEFAULT 0,
            periode_bulan INTEGER,
            periode_tahun INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS aktivitas_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            aksi VARCHAR(100) NOT NULL,
            detail TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS iuran (
            id SERIAL PRIMARY KEY,
            anggota_id INTEGER NOT NULL REFERENCES pendaftar(id),
            periode_bulan INTEGER NOT NULL,
            periode_tahun INTEGER NOT NULL,
            jumlah DECIMAL(15,2) DEFAULT 0,
            status VARCHAR(10) DEFAULT 'belum',
            transaksi_id INTEGER REFERENCES transaksi(id),
            lunas_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(anggota_id, periode_bulan, periode_tahun)
          );
          CREATE TABLE IF NOT EXISTS komentar_transaksi (
            id SERIAL PRIMARY KEY,
            transaksi_id INTEGER NOT NULL REFERENCES transaksi(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            pesan TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);
      } catch (err) {
        console.error('Error creating keuangan tables:', err.message);
      }

      try {
        await db.run(`UPDATE users SET role = 'super_admin' WHERE LOWER(username) = 'admin' AND (role IS NULL OR role = 'anggota')`);
      } catch (_) {}

      try {
        const existing = await db.get('SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)', ['admin']);
        if (!existing) {
          const hash = await bcrypt.hash('Admin123', 10);
          await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['Admin', hash]);
          console.log('Default admin user created: Admin / Admin123');
        } else if (existing.username !== 'Admin') {
          const hash = await bcrypt.hash('Admin123', 10);
          await db.run('UPDATE users SET username = ?, password = ? WHERE id = ?', ['Admin', hash, existing.id]);
          console.log('Default admin user updated: Admin / Admin123');
        }
      } catch (err) {
        console.error('Error seeding admin user:', err.message);
      }
    })();

  } else if (process.env.MYSQL_URL) {
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool(process.env.MYSQL_URL);

    db = {
      query: async (sql, params) => {
        const [rows] = await pool.query(sql, params);
        return rows;
      },
      get: async (sql, params) => {
        const [rows] = await pool.query(sql, params);
        return rows[0];
      },
      run: async (sql, params) => {
        const [result] = await pool.query(sql, params);
        return { lastInsertRowid: result.insertId, changes: result.affectedRows };
      },
      exec: async (sql) => { await pool.query(sql); }
    };

  } else if (!isNetlify) {
    const Database = require('better-sqlite3');
    const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
    const sqlite = new Database(dbPath);

    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS berita (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        judul TEXT NOT NULL,
        isi TEXT,
        tanggal TEXT,
        gambar TEXT,
        status TEXT DEFAULT 'publish',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS galeri (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        judul TEXT,
        gambar TEXT NOT NULL,
        deskripsi TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS program (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        icon TEXT,
        judul TEXT NOT NULL,
        deskripsi TEXT,
        jadwal TEXT,
        tipe TEXT DEFAULT 'rutin',
        tanggal_mulai TEXT,
        tanggal_selesai TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS umkm (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_usaha TEXT NOT NULL,
        pemilik TEXT,
        kategori TEXT,
        deskripsi TEXT,
        no_hp TEXT,
        gambar TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS kas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal TEXT NOT NULL,
        deskripsi TEXT,
        kategori TEXT,
        pemasukan REAL DEFAULT 0,
        pengeluaran REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS pengurus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama TEXT NOT NULL,
        jabatan TEXT,
        foto TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS pendaftar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_lengkap TEXT NOT NULL,
        usia INTEGER,
        no_hp TEXT,
        alamat TEXT,
        pekerjaan TEXT,
        alasan_bergabung TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS transaksi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipe TEXT NOT NULL DEFAULT 'pemasukan',
        kategori TEXT NOT NULL,
        jumlah REAL NOT NULL,
        deskripsi TEXT NOT NULL,
        kegiatan_id INTEGER REFERENCES program(id),
        bukti_url TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_by INTEGER NOT NULL REFERENCES users(id),
        diverifikasi_oleh INTEGER REFERENCES users(id),
        diverifikasi_at DATETIME,
        dikunci_oleh INTEGER REFERENCES users(id),
        dikunci_at DATETIME,
        koreksi_dari_id INTEGER REFERENCES transaksi(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS anggaran (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kegiatan_id INTEGER NOT NULL REFERENCES program(id),
        judul TEXT NOT NULL,
        rencana REAL DEFAULT 0,
        realisasi REAL DEFAULT 0,
        periode_bulan INTEGER,
        periode_tahun INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS aktivitas_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        aksi TEXT NOT NULL,
        detail TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS iuran (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anggota_id INTEGER NOT NULL REFERENCES pendaftar(id),
        periode_bulan INTEGER NOT NULL,
        periode_tahun INTEGER NOT NULL,
        jumlah REAL DEFAULT 0,
        status TEXT DEFAULT 'belum',
        transaksi_id INTEGER REFERENCES transaksi(id),
        lunas_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(anggota_id, periode_bulan, periode_tahun)
      );
      CREATE TABLE IF NOT EXISTS komentar_transaksi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaksi_id INTEGER NOT NULL REFERENCES transaksi(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        pesan TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try { sqlite.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'anggota'").run(); } catch (_) {}
    try { sqlite.prepare("ALTER TABLE users ADD COLUMN display_name TEXT").run(); } catch (_) {}
    try { sqlite.prepare("UPDATE users SET role = 'super_admin' WHERE username = 'Admin' AND (role IS NULL OR role = 'anggota')").run(); } catch (_) {}

    const existing = sqlite.prepare('SELECT id, username FROM users WHERE LOWER(username) = ?').get('admin');
    if (!existing) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('Admin123', salt);
      sqlite.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('Admin', hash, 'super_admin');
      console.log('Default admin user created: Admin / Admin123');
    } else if (existing.username !== 'Admin') {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('Admin123', salt);
      sqlite.prepare('UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?').run('Admin', hash, 'super_admin', existing.id);
      console.log('Default admin user updated: Admin / Admin123');
    }

    db = {
      query: (sql, params) => sqlite.prepare(sql).all(...(params || [])),
      get: (sql, params) => sqlite.prepare(sql).get(...(params || [])),
      run: (sql, params) => sqlite.prepare(sql).run(...(params || [])),
      exec: (sql) => sqlite.exec(sql)
    };
  } else {
    db = createFallbackDb();
  }
} catch (err) {
  console.error('Database initialization error:', err.message);
  db = createFallbackDb();
}

module.exports = db;
