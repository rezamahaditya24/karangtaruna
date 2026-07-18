const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

let db;

if (process.env.MYSQL_URL) {
  // ========== MySQL for Railway ==========
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
    exec: async (sql) => {
      await pool.query(sql);
    }
  };

  // Initialize tables for MySQL
  (async () => {
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await db.exec(`
        CREATE TABLE IF NOT EXISTS berita (
          id INT AUTO_INCREMENT PRIMARY KEY,
          judul VARCHAR(255) NOT NULL,
          isi TEXT,
          tanggal DATE,
          gambar VARCHAR(255),
          status ENUM('publish','draft') DEFAULT 'publish',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await db.exec(`
        CREATE TABLE IF NOT EXISTS galeri (
          id INT AUTO_INCREMENT PRIMARY KEY,
          judul VARCHAR(255),
          gambar VARCHAR(255) NOT NULL,
          deskripsi TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await db.exec(`
        CREATE TABLE IF NOT EXISTS program (
          id INT AUTO_INCREMENT PRIMARY KEY,
          icon VARCHAR(50),
          judul VARCHAR(255) NOT NULL,
          deskripsi TEXT,
          jadwal VARCHAR(255),
          tipe VARCHAR(20) DEFAULT 'rutin',
          tanggal_mulai DATE,
          tanggal_selesai DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await db.exec(`
        CREATE TABLE IF NOT EXISTS umkm (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nama_usaha VARCHAR(255) NOT NULL,
          pemilik VARCHAR(255),
          kategori VARCHAR(50),
          deskripsi TEXT,
          no_hp VARCHAR(20),
          gambar VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await db.exec(`
        CREATE TABLE IF NOT EXISTS kas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tanggal DATE NOT NULL,
          deskripsi VARCHAR(255),
          kategori VARCHAR(100),
          pemasukan DECIMAL(15,2) DEFAULT 0,
          pengeluaran DECIMAL(15,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await db.exec(`
        CREATE TABLE IF NOT EXISTS pengurus (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nama VARCHAR(255) NOT NULL,
          jabatan VARCHAR(100),
          foto VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await db.exec(`
        CREATE TABLE IF NOT EXISTS pendaftar (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nama_lengkap VARCHAR(255) NOT NULL,
          usia INT,
          no_hp VARCHAR(20),
          alamat TEXT,
          pekerjaan VARCHAR(255),
          alasan_bergabung TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // Seed admin user
      const existing = await db.get('SELECT id FROM users WHERE username = ?', ['admin']);
      if (!existing) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync('admin123', salt);
        await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hash]);
        console.log('Default admin user created: admin / admin123');
      }
      console.log('MySQL database ready!');
    } catch (err) {
      console.error('Database init error:', err.message);
    }
  })();

} else {
  // ========== SQLite for Local Development ==========
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

  const existing = sqlite.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    sqlite.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
    console.log('Default admin user created: admin / admin123');
  }

  db = {
    query: (sql, params) => sqlite.prepare(sql).all(...(params || [])),
    get: (sql, params) => sqlite.prepare(sql).get(...(params || [])),
    run: (sql, params) => sqlite.prepare(sql).run(...(params || [])),
    exec: (sql) => sqlite.exec(sql)
  };
}

module.exports = db;
