const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
let bucketReady = false;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);

  (async () => {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const exists = buckets?.some(b => b.name === 'karangtaruna');
      if (!exists) {
        await supabase.storage.createBucket('karangtaruna', { public: true });
      }
      bucketReady = true;
    } catch (err) {
      console.error('Supabase Storage init error:', err.message);
    }
  })();
}

async function uploadFile(file, folder = 'galeri') {
  if (!supabase || !bucketReady) {
    throw new Error('Penyimpanan gambar belum siap. Coba lagi.');
  }
  const ext = file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')) || '.jpg' : '.jpg';
  const filename = `${folder}/${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
  const { error } = await supabase.storage
    .from('karangtaruna')
    .upload(filename, file.buffer, {
      contentType: file.mimetype || 'image/jpeg',
      upsert: false
    });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage
    .from('karangtaruna')
    .getPublicUrl(filename);
  return publicUrl;
}

module.exports = { uploadFile };