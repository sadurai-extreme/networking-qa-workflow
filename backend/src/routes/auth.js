const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'nosqa_secret_key_2024';

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  // Support login by username OR email
  const user = db.prepare(`SELECT * FROM users WHERE username = ? OR email = ?`).get(username, username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, username: user.username }
  });
});

// Register new user (admin only — called from admin panel)
router.post('/register', (req, res) => {
  const { name, email, username, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email already exists' });

  const id = uuidv4();
  const defaultHash = bcrypt.hashSync('extreme', 10);
  const uname = username || email.split('@')[0];

  db.prepare(`INSERT INTO users (id, name, email, username, password, role) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, name, email, uname, defaultHash, role || 'user');

  res.json({ id, name, email, username: uname, role: role || 'user', defaultPassword: 'extreme' });
});

// Change password
router.post('/change-password', (req, res) => {
  const { user_id, old_password, new_password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = bcrypt.compareSync(old_password, user.password);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newHash, user_id);
  res.json({ success: true });
});

// Verify token
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, username, role FROM users WHERE id = ?').get(decoded.id);
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;
