import fs from 'fs';
import { handleAPI } from './src/api.js';
import { signJWT } from './config/auth-cf.js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(line => !line.trim().startsWith('#'))
    .map(line => {
      const [key, ...rest] = line.split('=');
      return [key, rest.join('=')];
    })
);

const token = await signJWT({ id: 1, username: 'admin', role: 'super_admin' }, env.JWT_SECRET);
const request = new Request('https://example.com/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ message: 'Tolong ringkas tugas utama admin.', page: 'dashboard' })
});

const resp = await handleAPI(request, env);
console.log('status', resp.status);
console.log(await resp.text());
