const crypto = globalThis.crypto;

async function main() {
  const password = 'Admin123';
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits']);
  const hashBuf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 10000, hash: 'SHA-256' }, key, 256);

  const combined = new Uint8Array(48);
  combined.set(salt, 0);
  combined.set(new Uint8Array(hashBuf), 16);

  let binary = '';
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i]);
  const b64 = btoa(binary);
  const hash = 'pbkdf2_10000_' + b64;

  console.log('b64 length:', b64.length);
  console.log('hash length:', hash.length);
  
  const raw = hash.slice(13);
  console.log('raw length:', raw.length);
  
  // Show each char code of raw
  const codes = [];
  for (let i = 0; i < raw.length; i++) codes.push(raw.charCodeAt(i));
  console.log('raw codes:', codes.join(','));

  // Try Buffer.from instead of atob
  const dec = Buffer.from(raw.trim(), 'base64');
  console.log('decoded length:', dec.length);
  
  if (dec.length !== 48) {
    console.error('Expected 48 bytes, got', dec.length);
    process.exit(1);
  }

  const exSalt = dec.subarray(0, 16);
  const exHash = dec.subarray(16);

  const key2 = await crypto.subtle.importKey('raw', new TextEncoder().encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits']);
  const hashBuf2 = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: exSalt, iterations: 10000, hash: 'SHA-256' }, key2, 256);

  const h1 = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
  const h2 = Array.from(exHash).map(b => b.toString(16).padStart(2,'0')).join('');

  if (h1 !== h2) {
    console.error('FATAL: Worker verification failed');
    process.exit(1);
  }

  console.log('Worker-verify: PASSED');
  console.log('\nHash:', hash);

  // Insert admin user into Supabase
  const https = require('https');
  const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhc3NpdGZyZHZpeG1henlkcmJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDQwMDgzNywiZXhwIjoyMDk5OTc2ODM3fQ.Vb9sMnvRhmVtdbzIhPChC_DSCNMTvr1D176NMyEiv0s';

  const postData = JSON.stringify({
    username: 'admin',
    password: hash,
    role: 'super_admin',
    display_name: 'Admin'
  });

  const options = {
    hostname: 'passitfrdvixmazydrbc.supabase.co',
    path: '/rest/v1/users',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      'Authorization': 'Bearer ' + apiKey,
      'Prefer': 'return=representation'
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log('Supabase status:', res.statusCode);
      if (res.statusCode === 201) {
        console.log('\n✅ ADMIN USER CREATED');
        console.log('Username: admin');
        console.log('Password: Admin123');
        console.log('Login di: https://karangtaruna.rezamahaditya24.workers.dev/admin/');
      } else {
        console.log('Response:', body);
      }
    });
  });
  req.on('error', (e) => console.error('Error:', e.message));
  req.write(postData);
  req.end();

  // Also call the setup endpoint as backup
  console.log('\n(Also calling /api/setup via Worker after deploy)');
}

main().catch(console.error);
