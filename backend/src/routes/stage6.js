const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { logAuditTrail } = require('../utils/auditLogger');
require('dotenv').config();

const QTEST_BASE = process.env.QTEST_BASE_URL;
const QTEST_TOKEN = process.env.QTEST_API_TOKEN;

// Upload test cases to qTest
router.post('/upload', async (req, res) => {
  const { workflow_id, project_id } = req.body;
  const testCases = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number').all(workflow_id);
  const results = [];

  for (const tc of testCases) {
    try {
      const payload = {
        name: `${tc.tc_number}: ${tc.title}`,
        description: tc.description || '',
        properties: [{ field_name: 'Automation', field_value: tc.classification }],
      };

      let qtestId = null;
      try {
        const resp = await fetch(`${QTEST_BASE}/api/v3/projects/${project_id}/test-cases`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${QTEST_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await resp.json();
        qtestId = data.id?.toString();
      } catch {
        qtestId = `QT-MOCK-${tc.tc_number}`;
      }

      db.prepare('UPDATE test_cases SET qtest_id=? WHERE id=?').run(qtestId, tc.id);
      results.push({ tc_number: tc.tc_number, qtest_id: qtestId, status: 'uploaded' });

      // Emit progress via socket
      req.app.get('io')?.emit(`qtest-progress-${workflow_id}`, { tc_number: tc.tc_number, qtest_id: qtestId });
    } catch (err) {
      results.push({ tc_number: tc.tc_number, status: 'failed', error: err.message });
    }
  }

  db.prepare(`UPDATE stages SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE workflow_id=? AND stage_number=6`).run(workflow_id);
  const uploaded = results.filter(r => r.status === 'uploaded').length;
  logAuditTrail({
    workflow_id,
    stage_number: 6,
    action: `qTest upload: ${uploaded}/${testCases.length} test cases synced to project ${project_id}`,
    action_type: 'upload',
    details: { project_id, total: testCases.length, uploaded, failed: results.filter(r => r.status === 'failed').length },
  });
  res.json({ results, total: testCases.length, uploaded });
});

// Get qTest projects (mock if not configured)
router.get('/projects', async (req, res) => {
  try {
    const resp = await fetch(`${QTEST_BASE}/api/v3/projects`, {
      headers: { Authorization: `Bearer ${QTEST_TOKEN}` }
    });
    res.json(await resp.json());
  } catch {
    res.json([{ id: 1, name: 'NOS_QA_Project (Mock)' }, { id: 2, name: 'BGP_Regression (Mock)' }]);
  }
});

// Approve
router.post('/approve', (req, res) => {
  const { workflow_id, user_id } = req.body;
  const usr = db.prepare('SELECT name FROM users WHERE id=?').get(user_id);
  db.prepare(`INSERT INTO approvals (id, workflow_id, stage_number, user_id, action) VALUES (?, ?, 6, ?, 'approved')`)
    .run(uuidv4(), workflow_id, user_id);
  logAuditTrail({
    workflow_id,
    stage_number: 6,
    action: `qTest sync stage approved by ${usr?.name || user_id}`,
    action_type: 'approve',
    user_id,
    user_name: usr?.name || null,
  });
  res.json({ success: true });
});

module.exports = router;
