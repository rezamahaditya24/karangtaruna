const crypto = require('crypto');

// Direct test: encode known bytes, decode back
const known = Buffer.from([0x7b, 0x01, 0x67, 0xb5]);
const b64 = known.toString('base64');
console.log('Known bytes:', known.toString('hex'));
console.log('Base64:', b64);
const dec = Buffer.from(b64, 'base64');
console.log('Decoded back:', dec.toString('hex'));
console.log('Match:', known.equals(dec));

// Test with the exact string from previous run
const raw = 'ewFntX+2lzFzFBiWUWbdiLGNSwXWKpSnwLewOARMOH0fDAHu0i5VUpN3MvsGJs9U';
console.log('\nRaw base64 length:', raw.length);
const buf = Buffer.from(raw, 'base64');
console.log('Decoded hex:', buf.toString('hex'));
console.log('Decoded length:', buf.length);
