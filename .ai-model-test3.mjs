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
const bodyTemplate = { contents: [{ role: 'user', parts: [{ text: 'Halo, tolong jawab ringkas.' }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 50 } };
const endpoints = [
  { url: 'https://generativelanguage.googleapis.com/v1beta/models:generateContent', body: { ...bodyTemplate } },
  { url: 'https://generativelanguage.googleapis.com/v1beta2/models:generateContent', body: { ...bodyTemplate } },
  { url: 'https://generativelanguage.googleapis.com/v1beta2/models:generateText', body: { prompt: { text: 'Halo, tolong jawab ringkas.' }, temperature: 0.7, maxOutputTokens: 50 } }
];
const models = ['models/gemini-2.5-flash', 'models/gemini-flash-latest', 'models/gemini-pro-latest'];
for (const { url, body } of endpoints) {
  for (const model of models) {
    const payload = { ...body, model };
    for (const useAuthHeader of [false, true]) {
      const requestUrl = useAuthHeader ? url : `${url}?key=${encodeURIComponent(key)}`;
      const headers = { 'Content-Type': 'application/json' };
      if (useAuthHeader) headers.Authorization = `Bearer ${key}`;
      try {
        const res = await fetch(requestUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
        const text = await res.text();
        console.log('ENDPOINT', url, 'MODEL', model, 'AUTH', useAuthHeader ? 'Bearer' : 'key', 'STATUS', res.status);
        console.log(text);
      } catch (e) {
        console.log('ENDPOINT', url, 'MODEL', model, 'AUTH', useAuthHeader ? 'Bearer' : 'key', 'ERROR', e.message);
      }
      console.log('---');
    }
  }
}
