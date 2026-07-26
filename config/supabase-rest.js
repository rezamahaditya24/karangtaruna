export function createClient(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY not set');

  const restUrl = `${url}/rest/v1`;
  const authHeaders = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };

  async function request(method, path, opts = {}) {
    const res = await fetch(`${restUrl}${path}`, {
      method,
      headers: { ...authHeaders, ...opts.headers },
      body: opts.body
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase ${method} ${path}: ${res.status} ${body}`);
    }
    if (opts.raw) return res;
    if (opts.noJson) return;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  function qs(filters) {
    if (!filters || !Object.keys(filters).length) return '';
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null) p.set(k, v);
    }
    return '?' + p.toString();
  }

  return {
    get: async (table, filters = {}, select = '*') => {
      const rows = await request('GET', `/${table}${qs({ select, limit: '1', ...filters })}`);
      return rows?.[0] || null;
    },

    query: async (table, filters = {}, select = '*') => {
      return await request('GET', `/${table}${qs({ select, ...filters })}`);
    },

    insert: async (table, data) => {
      const rows = await request('POST', `/${table}`, {
        body: JSON.stringify(data),
        headers: { 'Prefer': 'return=representation' }
      });
      return rows?.[0] || null;
    },

    update: async (table, data, filters = {}) => {
      if (!Object.keys(filters).length) throw new Error('Update requires filter');
      const rows = await request('PATCH', `/${table}${qs(filters)}`, {
        body: JSON.stringify(data),
        headers: { 'Prefer': 'return=representation' }
      });
      return rows || null;
    },

    remove: async (table, filters = {}) => {
      if (!Object.keys(filters).length) throw new Error('Delete requires filter');
      return await request('DELETE', `/${table}${qs(filters)}`, { noJson: true });
    },

    count: async (table, filters = {}) => {
      const res = await request('HEAD', `/${table}${qs({ ...filters, select: 'id' })}`, {
        headers: { 'Prefer': 'count=exact' }, raw: true
      });
      return parseInt(res.headers.get('content-range')?.split('/')?.[1] || '0');
    },

    raw: async (path, opts = {}) => {
      return await request(opts.method || 'GET', path, opts);
    }
  };
}