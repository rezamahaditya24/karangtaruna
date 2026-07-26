const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_KEY not set. File uploads will fail.');
}

const STORAGE_URL = supabaseUrl ? `${supabaseUrl}/storage/v1` : null;

async function ensureBucket() {
  if (!STORAGE_URL) return;
  try {
    const res = await fetch(`${STORAGE_URL}/buckets`, {
      headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }
    });
    const buckets = await res.json();
    if (!buckets?.some(b => b.name === 'karangtaruna')) {
      await fetch(`${STORAGE_URL}/buckets`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'karangtaruna', public: true })
      });
    }
  } catch (err) {
    console.error('Supabase bucket init error:', err.message);
  }
}
ensureBucket();

async function uploadFile(file, folder = 'galeri') {
  if (!STORAGE_URL || !supabaseKey) {
    throw new Error('Penyimpanan gambar tidak dikonfigurasi. Set SUPABASE_URL dan SUPABASE_SERVICE_KEY.');
  }
  const ext = file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')) || '.jpg' : '.jpg';
  const filename = `${folder}/${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
  const res = await fetch(`${STORAGE_URL}/object/karangtaruna/${filename}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': file.mimetype || 'application/octet-stream'
    },
    body: file.buffer
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gagal upload: ${res.status} ${errBody}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/karangtaruna/${filename}`;
}

module.exports = { uploadFile };