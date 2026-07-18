const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(__dirname));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/berita', require('./routes/berita'));
app.use('/api/galeri', require('./routes/galeri'));
app.use('/api/program', require('./routes/program'));
app.use('/api/umkm', require('./routes/umkm'));
app.use('/api/kas', require('./routes/kas'));
app.use('/api/pengurus', require('./routes/pengurus'));
app.use('/api/pendaftar', require('./routes/pendaftar'));

app.get(/^\/admin(?:\/.*)?$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});
