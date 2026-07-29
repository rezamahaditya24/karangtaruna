import fs from 'fs';
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
const key = env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY missing');
const models = ['models/gemini-2.5-flash', 'models/gemini-flash-latest', 'models/gemini-pro-latest'];
const endpoints = [
  'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateText',
  'https://generativelanguage.googleapis.com/v1beta/models:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models:generateText',
  'https://generativelanguage.googleapis.com/v1beta2/models/{model}:generateContent',
  'https://generativelanguage.googleapis.com/v1beta2/models/{model}:generateText',
  'https://generativelanguage.googleapis.com/v1beta2/models:generateContent',
  'https://generativelanguage.googleapis.com/v1beta2/models:generateText'
];
for (const model of models) {
  for (const endpoint of endpoints) {
    const url = endpoint.includes('{model}') ? endpoint.replace('{model}', model) : endpoint;
    const body = endpoint.includes('generateContent')
      ? { model, contents: [{ role: 'user', parts: [{ text: 'Halo, tolong jawab ringkas.' }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 50 } }
      : { model, prompt: { text: 'Halo, tolong jawab ringkas.' }, temperature: 0.7, maxOutputTokens: 50 };
    for (const authType of ['query', 'header', 'none']) {
      const requestUrl = authType === 'query' ? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}` : url;
      const headers = { 'Content-Type': 'application/json' };
      if (authType === 'header') headers.Authorization = `Bearer ${key}`;
      if (authType === 'none') delete body.model; // test generateContent with only contents
      try {
        const res = await fetch(requestUrl, { method: 'POST', headers, body: JSON.stringify(body) });
        const text = await res.text();
        console.log('ENDPOINT', endpoint, 'MODEL', model, 'AUTH', authType, 'STATUS', res.status);
        console.log(text);
      } catch (e) {
        console.log('ENDPOINT', endpoint, 'MODEL', model, 'AUTH', authType, 'ERR', e.message);
      }
      console.log('---');
    }
  }
}
