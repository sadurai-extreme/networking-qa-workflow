const express = require('express');
const router = express.Router();
const db = require('../db/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Get all users (all roles can see, but passwords excluded)
router.get('/', authenticate, (req, res) => {
  res.json(db.prepare('SELECT id, name, email, username, role, created_at FROM users ORDER BY name').all());
});

// Create user (admin only)
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, email, username, role } = req.body;
  const id = uuidv4();
  const hash = bcrypt.hashSync('extreme', 10);
  const uname = username || email.split('@')[0];
  db.prepare('INSERT INTO users (id, name, email, username, password, role) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, email, uname, hash, role || 'user');
  res.json({ id, name, email, username: uname, role: role || 'user' });
});

// Update user (admin can update any; user can only update themselves)
router.put('/:id', authenticate, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && req.user.id !== req.params.id)
    return res.status(403).json({ error: 'You can only edit your own profile' });

  const { name, email } = req.body;
  db.prepare('UPDATE users SET name=?, email=? WHERE id=?').run(name, email, req.params.id);
  res.json({ success: true });
});

// Delete user (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  if (req.params.id === 'user-admin') return res.status(400).json({ error: 'Cannot delete admin' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
