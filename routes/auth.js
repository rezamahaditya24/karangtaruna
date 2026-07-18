const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(400).json({ error: 'Username atau password salah.' });
    }
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Username atau password salah.' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
