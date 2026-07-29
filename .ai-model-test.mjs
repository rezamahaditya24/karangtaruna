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
const models = [
  'models/gemini-flash-latest',
  'models/gemini-pro-latest',
  'models/gemini-flash-lite-latest',
  'models/gemini-3.1-pro-preview',
  'models/gemini-3.1-pro-preview-customtools'
];
for (const modelName of models) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: 'Halo, tolong jawab ringkas.' }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 100 }
      })
    });
    const body = await res.text();
    console.log('MODEL:', modelName, 'STATUS:', res.status);
    console.log(body);
  } catch (err) {
    console.log('MODEL:', modelName, 'ERROR:', err.message);
  }
  console.log('---');
}
