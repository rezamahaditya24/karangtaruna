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
const modelNames = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-pro-latest'];
const endpoints = [
  'https://generativelanguage.googleapis.com/v1beta/models:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models:generateText'
];
for (const modelName of modelNames) {
  for (const url of endpoints) {
    const body = url.endsWith(':generateContent')
      ? { model: modelName, contents: [{ role: 'user', parts: [{ text: 'Halo, tolong jawab ringkas.' }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 50 } }
      : { model: modelName, prompt: { text: 'Halo, tolong jawab ringkas.' }, temperature: 0.7, maxOutputTokens: 50 };
    try {
      const res = await fetch(`${url}?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      console.log('REQUEST', url, modelName, 'STATUS', res.status);
      console.log(await res.text());
    } catch (e) {
      console.log('REQUEST', url, modelName, 'ERROR', e.message);
    }
    console.log('---');
  }
}
