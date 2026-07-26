import { handleAPI } from './api.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        }
      });
    }

    if (path.startsWith('/api')) {
      try {
        return await handleAPI(request, env);
      } catch (err) {
        console.error('[worker]', err.message, err.stack);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }
        });
      }
    }

    if (path.startsWith('/admin')) {
      const last = path.split('/').filter(Boolean).pop() || '';
      if (last.includes('.')) {
        return env.ASSETS.fetch(request);
      }
      return env.ASSETS.fetch(new Request(`${url.origin}/admin/index.html`, request));
    }

    return env.ASSETS.fetch(request);
  }
}
