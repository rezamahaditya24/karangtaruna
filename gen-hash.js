const crypto = require('crypto');
const pwd = 'Admin123';

crypto.randomBytes(16, (err, salt) => {
  if (err) { console.error(err); process.exit(1); }
  crypto.pbkdf2(pwd, salt, 10000, 32, 'sha256', (e, key) => {
    if (e) { console.error(e); process.exit(1); }
    const combined = Buffer.concat([salt, key]);
    const hash = 'pbkdf2_10000_' + combined.toString('base64');
    
    // Verify full cycle
    const raw = hash.substring(12);
    const dec = Buffer.from(raw, 'base64');
    const exSalt = dec.slice(0, 16);
    const exKey = dec.slice(16);
    
    crypto.pbkdf2(pwd, exSalt, 10000, 32, 'sha256', (e2, k2) => {
      if (e2) { console.error(e2); process.exit(1); }
      const match = k2.equals(exKey);
      if (!match) {
        console.log('ERROR: Hash verification failed');
        process.exit(1);
      }
      console.log('OK - hash verification passed');
      console.log();
      console.log('--- COPY THIS SQL ---');
      console.log("DELETE FROM users WHERE LOWER(username) = 'admin';");
      console.log(`INSERT INTO users (username, password, role, display_name) VALUES ('admin', '${hash}', 'super_admin', 'Admin');`);
      console.log('--- END SQL ---');
    });
  });
});
