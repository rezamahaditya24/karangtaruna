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
const models = ['models/gemini-2.5-flash-001', 'models/gemini-2.5-flash@001', 'models/gemini-flash-latest', 'models/gemini-flash-latest-001'];
const urls = [
  'https://generativelanguage.googleapis.com/v1beta/models:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models:generateText'
];
for (const model of models) {
  for (const url of urls) {
    const body = url.endsWith(':generateContent')
      ? { model, contents: [{ role: 'user', parts: [{ text: 'Halo, tolong jawab ringkas.' }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 50 } }
      : { model, prompt: { text: 'Halo, tolong jawab ringkas.' }, temperature: 0.7, maxOutputTokens: 50 };
    try {
      const res = await fetch(`${url}?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      console.log('REQUEST', url, model, 'STATUS', res.status);
      console.log(await res.text());
    } catch (e) {
      console.log('REQUEST', url, model, 'ERROR', e.message);
    }
    console.log('---');
  }
}
