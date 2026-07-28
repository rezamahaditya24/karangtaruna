const express = require('express');
const router = express.Router();
router.use(express.json());
router.use((req, res) => res.status(404).json({ error: 'Route not implemented (berita).' }));
module.exports = router;
