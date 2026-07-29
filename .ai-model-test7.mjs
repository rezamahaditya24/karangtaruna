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
const modelNames = ['models/gemini-2.5-flash', 'models/gemini-flash-latest', 'models/gemini-pro-latest'];
const endpoints = [
  'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateText'
];
for (const model of modelNames) {
  for (const endpointTemplate of endpoints) {
    const url = endpointTemplate.replace('{model}', encodeURIComponent(model));
    const body = endpointTemplate.endsWith(':generateContent')
      ? { contents: [{ role: 'user', parts: [{ text: 'Halo, tolong jawab ringkas.' }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 50 } }
      : { prompt: { text: 'Halo, tolong jawab ringkas.' }, temperature: 0.7, maxOutputTokens: 50 };
    try {
      const res = await fetch(`${url}?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      console.log('URL', url, 'STATUS', res.status);
      console.log(await res.text());
    } catch (e) {
      console.log('URL', url, 'ERROR', e.message);
    }
    console.log('---');
  }
}
