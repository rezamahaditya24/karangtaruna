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
  'https://generativelanguage.googleapis.com/v1beta2/models/{model}:generateContent',
  'https://generativelanguage.googleapis.com/v1beta2/models/{model}:generateText'
];
for (const modelName of modelNames) {
  for (const endpoint of endpoints) {
    const url = endpoint.replace('{model}', encodeURIComponent(modelName));
    for (const useKeyHeader of [false, true]) {
      const requestUrl = useKeyHeader ? url : `${url}?key=${encodeURIComponent(key)}`;
      const headers = { 'Content-Type': 'application/json' };
      if (useKeyHeader) headers['x-goog-api-key'] = key;
      const body = endpoint.endsWith(':generateContent')
        ? { contents: [{ role: 'user', parts: [{ text: 'Halo, tolong jawab ringkas.' }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 100 } }
        : { prompt: { text: 'Halo, tolong jawab ringkas.' }, temperature: 0.7, maxOutputTokens: 100 };
      try {
        const res = await fetch(requestUrl, { method: 'POST', headers, body: JSON.stringify(body) });
        const text = await res.text();
        console.log('REQUEST', requestUrl);
        console.log('MODEL', modelName, 'ENDPOINT', endpoint, 'KEY-HEADER', useKeyHeader, 'STATUS', res.status);
        console.log(text);
      } catch (err) {
        console.log('REQUEST', requestUrl);
        console.log('MODEL', modelName, 'ENDPOINT', endpoint, 'KEY-HEADER', useKeyHeader, 'ERR', err.message);
      }
      console.log('---');
    }
  }
}
