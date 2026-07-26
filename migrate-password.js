// Menghasilkan SQL untuk migrasi password admin ke format PBKDF2.
// Jalankan: node migrate-password.js
// Output: SQL yang bisa dijalankan di Supabase SQL Editor.

const crypto = require('crypto');
const textEncoder = new TextEncoder();

async function main() {
  const password = process.argv[2] || 'Admin123';
  const salt = crypto.randomBytes(16);
  const hash = await new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 10000, 32, 'sha256', (err, key) => {
      if (err) reject(err); else resolve(key);
    });
  });
  const combined = Buffer.concat([salt, hash]);
  const hashed = 'pbkdf2_10000_' + combined.toString('base64');
  console.log('\n--- Jalankan SQL ini di Supabase SQL Editor ---\n');
  console.log(`UPDATE users SET password = '${hashed}' WHERE LOWER(username) = 'admin';`);
  console.log('\nAtau jalankan via psql:\n');
  console.log(`psql "$DATABASE_URL" -c "UPDATE users SET password = '${hashed}' WHERE LOWER(username) = 'admin';"`);
}

main().catch(console.error);
