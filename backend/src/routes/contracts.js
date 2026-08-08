const express = require('express');
const router = express.Router();
const db = require('../db/database');

// List all active contracts (summary, no content)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, feature_key, jira_story_id, title, description, version,
             length(content) as content_length, created_by, created_at, updated_at
      FROM contracts
      WHERE is_active = 1
      ORDER BY updated_at DESC
    `).all();
    res.json({ success: true, contracts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search contracts by feature_key or title
router.get('/search', (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, contracts: [] });

    const like = `%${q}%`;
    const rows = db.prepare(`
      SELECT id, feature_key, jira_story_id, title, description, version,
             length(content) as content_length, created_at
      FROM contracts
      WHERE is_active = 1
        AND (title LIKE ? OR feature_key LIKE ? OR jira_story_id LIKE ?)
      ORDER BY updated_at DESC
      LIMIT 20
    `).all(like, like, like);
    res.json({ success: true, contracts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all versions of a feature
router.get('/versions/:feature_key', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, feature_key, title, version, length(content) as content_length,
             jira_story_id, created_at, is_active
      FROM contracts
      WHERE feature_key = ?
      ORDER BY version DESC
    `).all(req.params.feature_key.toUpperCase());
    res.json({ success: true, versions: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get full contract including content
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Contract not found' });
    res.json({ success: true, contract: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deactivate (soft-delete) a contract
router.delete('/:id', (req, res) => {
  try {
    db.prepare(`UPDATE contracts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
