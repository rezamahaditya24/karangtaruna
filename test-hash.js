const crypto = require('crypto');
const password = 'Admin123';

const salt = crypto.randomBytes(16);
crypto.pbkdf2(password, salt, 10000, 32, 'sha256', (err, key) => {
  if (err) { console.error(err); return; }
  
  const combined = Buffer.concat([salt, key]);
  const hash = 'pbkdf2_10000_' + combined.toString('base64');
  console.log('HASH:', hash);
  console.log('SALT(raw):', salt.toString('hex'));
  console.log('KEY(raw):', key.toString('hex'));

  // verify
  const raw = hash.slice(12);
  const dec = Buffer.from(raw, 'base64');
  console.log('DECODED hex:', dec.toString('hex'));
  console.log('DECODED length:', dec.length);
  
  const exSalt = dec.slice(0, 16);
  const exKey = dec.slice(16);
  console.log('EXTRACTED salt:', exSalt.toString('hex'));
  console.log('EXTRACTED key:', exKey.toString('hex'));
  console.log('Salt match:', salt.equals(exSalt));
  console.log('Key match:', key.equals(exKey));

  crypto.pbkdf2('Admin123', exSalt, 10000, 32, 'sha256', (e2, k2) => {
    console.log('RE-DERIVED key:', k2.toString('hex'));
    console.log('FINAL MATCH:', k2.equals(exKey));
    console.log();
    console.log('=== SQL UNTUK INSERT ===');
    console.log(`INSERT INTO users (username, password, role, display_name) VALUES ('admin', '${hash}', 'super_admin', 'Admin');`);
  });
});
