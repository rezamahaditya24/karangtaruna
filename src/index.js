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
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }
        });
      }
    }

    if (path.startsWith('/admin')) {
      const resp = await env.ASSETS.fetch(request);
      if (resp.status === 200 || resp.status === 304) return resp;
      const idx = await env.ASSETS.fetch(new URL('/admin/index.html', url.origin));
      if (idx.status === 200 || idx.status === 304) return idx;
      return new Response('Not found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
}
