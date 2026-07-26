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

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });

    function convert(sql, params) {
      let i = 0;
      const text = sql.replace(/\?/g, () => `$${++i}`);
      return { text, values: params || [] };
    }

    function isInsertReturning(sql) {
      const upper = sql.trim().toUpperCase();
      return upper.startsWith('INSERT') && !upper.includes('RETURNING');
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
        let finalSql = text;
        let finalValues = values;
        if (isInsertReturning(text)) {
          const returning = text.trim().endsWith(')') ? ' RETURNING id' : '';
          finalSql = text + returning;
        }
        const result = await pool.query(finalSql, finalValues);
        const row = result.rows?.[0];
        return { lastInsertRowid: row?.id || 0, changes: result.rowCount || 0 };
      },
      exec: async (sql) => { await pool.query(sql); }
    };

    (async () => {
      try {
        const existing = await db.get('SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)', ['admin']);
        if (!existing) {
          const salt = bcrypt.genSaltSync(10);
          const hash = bcrypt.hashSync('Admin123', salt);
          await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['Admin', hash]);
          console.log('Default admin user created: Admin / Admin123');
        } else if (existing.username !== 'Admin') {
          const salt = bcrypt.genSaltSync(10);
          const hash = bcrypt.hashSync('Admin123', salt);
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
    `);

    const existing = sqlite.prepare('SELECT id, username FROM users WHERE LOWER(username) = ?').get('admin');
    if (!existing) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('Admin123', salt);
      sqlite.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('Admin', hash);
      console.log('Default admin user created: Admin / Admin123');
    } else if (existing.username !== 'Admin') {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('Admin123', salt);
      sqlite.prepare('UPDATE users SET username = ?, password = ? WHERE id = ?').run('Admin', hash, existing.id);
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
