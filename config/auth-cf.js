export function base64UrlDecode(s) {
  try {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return atob(s);
  } catch { return ''; }
}

export function base64UrlEncode(buf) {
  try {
    const s = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return s.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  } catch { return ''; }
}

export async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const payload = JSON.parse(base64UrlDecode(parts[1]));
  if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error('Token expired');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key,
    Uint8Array.from(base64UrlDecode(parts[2]), c => c.charCodeAt(0)),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error('Invalid signature');
  return payload;
}

export async function signJWT(payload, secret, expiresIn = '24h') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = expiresIn.endsWith('h')
    ? Math.floor(Date.now() / 1000) + parseInt(expiresIn) * 3600
    : Math.floor(Date.now() / 1000) + 86400;
  const data = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(data)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headerB64}.${payloadB64}`));
  return `${headerB64}.${payloadB64}.${base64UrlEncode(sig)}`;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 10000, hash: 'SHA-256' }, key, 256);
  const combined = new Uint8Array(salt.length + hash.byteLength);
  combined.set(salt);
  combined.set(new Uint8Array(hash), salt.length);
  return 'pbkdf2_10000_' + btoa(String.fromCharCode(...new Uint8Array(combined)));
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (stored.startsWith('pbkdf2_10000_')) {
    try {
      const raw = stored.slice(13);
      const combined = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
      if (combined.length < 17) return false;
      const salt = combined.slice(0, 16);
      const oldHash = combined.slice(16);
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password),
        { name: 'PBKDF2' }, false, ['deriveBits']);
      const newHash = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 10000, hash: 'SHA-256' }, key, 256);
      if (oldHash.byteLength !== newHash.byteLength) return false;
      const a = new Uint8Array(oldHash), b = new Uint8Array(newHash);
      return a.every((v, i) => v === b[i]);
    } catch { return false; }
  }
  if (stored.startsWith('$2')) {
    try {
      const bcrypt = await import('bcryptjs');
      return await bcrypt.compare(password, stored);
    } catch {
      return false;
    }
  }
  return false;
}

export async function migratePassword(password, stored, supabase, userId) {
  if (stored?.startsWith('$2')) {
    try {
      const bcrypt = await import('bcryptjs');
      const ok = await bcrypt.compare(password, stored);
      if (!ok) return false;
    } catch { return false; }
    const newHash = await hashPassword(password);
    await supabase.update('users', { password: newHash }, { id: `eq.${userId}` });
    return true;
  }
  return false;
}

export function authorize(roles, user) {
  const hierarchy = { anggota: 0, pengurus: 1, bendahara: 2, super_admin: 3 };
  const userLevel = hierarchy[user?.role] ?? 0;
  const minLevel = Math.min(...roles.map(r => hierarchy[r] ?? 0));
  if (userLevel < minLevel) throw new Error('Akses ditolak. Tidak memiliki izin yang cukup.');
}

export function extractToken(request) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function authenticate(request, env) {
  const token = extractToken(request);
  if (!token) throw new Error('Akses ditolak. Silakan login terlebih dahulu.');
  return await verifyJWT(token, env.JWT_SECRET);
}