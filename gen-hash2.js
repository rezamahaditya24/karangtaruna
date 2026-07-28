const crypto = require('crypto');

// Sync approach to avoid callback issues
const salt = crypto.randomBytes(16);
const key = crypto.pbkdf2Sync('Admin123', salt, 10000, 32, 'sha256');

console.log('salt len:', salt.length, 'key len:', key.length);

const combined = Buffer.concat([salt, key]);
console.log('combined len:', combined.length);

const b64 = combined.toString('base64');
console.log('b64 len:', b64.length);

const hash = 'pbkdf2_10000_' + b64;
console.log('hash:', hash);

const raw = hash.substring(12);
const dec = Buffer.from(raw, 'base64');
console.log('dec len:', dec.length);

const exSalt = dec.subarray(0, 16);
const exKey = dec.subarray(16);

console.log('salt match:', salt.equals(exSalt));
console.log('key match:', key.equals(exKey));

if (!salt.equals(exSalt)) {
  console.log('salt orig hex:', salt.toString('hex'));
  console.log('salt dec  hex:', exSalt.toString('hex'));
  console.log('combined hex:', combined.toString('hex'));
  console.log('dec hex:', dec.toString('hex'));
}

const key2 = crypto.pbkdf2Sync('Admin123', exSalt, 10000, 32, 'sha256');
console.log('verify match:', key2.equals(exKey));
console.log();
console.log('--- SQL ---');
console.log("DELETE FROM users WHERE LOWER(username) = 'admin';");
console.log(`INSERT INTO users (username, password, role, display_name) VALUES ('admin', '${hash}', 'super_admin', 'Admin');`);
