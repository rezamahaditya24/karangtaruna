const crypto = require('crypto');
const pwd = 'Admin123';

const salt = crypto.randomBytes(16);
crypto.pbkdf2(pwd, salt, 10000, 32, 'sha256', (err, key) => {
  if (err) { console.error(err); process.exit(1); }
  
  const combined = Buffer.concat([salt, key]);
  const b64 = combined.toString('base64');
  const hash = 'pbkdf2_10000_' + b64;
  
  // Simple verification
  const raw = hash.substring(12);
  const dec = Buffer.from(raw, 'base64');
  
  if (dec.length !== 48) {
    console.log('FAIL: decoded length is', dec.length, 'expected 48');
    process.exit(1);
  }
  
  const s1 = salt.toString('hex');
  const s2 = dec.slice(0, 16).toString('hex');
  const k1 = key.toString('hex');
  const k2 = dec.slice(16).toString('hex');
  
  if (s1 !== s2 || k1 !== k2) {
    console.log('FAIL: roundtrip mismatch');
    console.log('salt orig:', s1);
    console.log('salt dec:', s2);
    console.log('key orig:', k1);
    console.log('key dec:', k2);
    console.log('base64:', b64);
    process.exit(1);
  }
  
  console.log('ROUNDTRIP OK');
  console.log('hash:', hash);
  
  // Verify with crypto
  crypto.pbkdf2(pwd, dec.slice(0, 16), 10000, 32, 'sha256', (e2, k2) => {
    if (e2) { console.error(e2); process.exit(1); }
    const match = k2.equals(dec.slice(16));
    console.log('crypto verify:', match ? 'OK' : 'FAIL');
    if (!match) {
      console.log('re-derived:', k2.toString('hex'));
      console.log('expected:', dec.slice(16).toString('hex'));
      process.exit(1);
    }
    console.log();
    console.log('INSERT INTO users (username, password, role, display_name)');
    console.log(`VALUES ('admin', '${hash}', 'super_admin', 'Admin');`);
  });
});
