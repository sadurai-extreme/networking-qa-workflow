const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { logAuditTrail } = require('../utils/auditLogger');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// Format test plan to ISO .docx template
router.post('/format', (req, res) => {
  const { workflow_id } = req.body;
  const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
  const testCases = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number').all(workflow_id);
  const testPlanDoc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY version DESC LIMIT 1`).get(workflow_id);

  const templatePath = path.resolve(__dirname, '../../../templates/iso_testplan_template.docx');
  if (!fs.existsSync(templatePath)) {
    // Return placeholder response if template not yet provided
    return res.json({
      message: 'ISO template not yet uploaded. Please place iso_testplan_template.docx in the templates/ folder.',
      preview: generateMarkdownPreview(workflow, testCases, testPlanDoc),
      status: 'template_missing'
    });
  }

  try {
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const manual = testCases.filter(tc => tc.classification === 'Manual');
    const semi = testCases.filter(tc => tc.classification === 'Semi-Automatable');
    const auto = testCases.filter(tc => tc.classification === 'Automatable');

    doc.render({
      project_name: workflow.title,
      jira_story: workflow.jira_story_id,
      release: workflow.jira_release,
      date: new Date().toLocaleDateString(),
      total_tc: testCases.length,
      manual_count: manual.length,
      semi_count: semi.length,
      auto_count: auto.length,
      manual_cases: manual,
      semi_cases: semi,
      auto_cases: auto,
      all_cases: testCases,
    });

    const outputBuf = doc.getZip().generate({ type: 'nodebuffer' });
    const filename = `TestPlan_ISO_${workflow_id}.docx`;
    const outputPath = path.resolve(__dirname, '../../../uploads', filename);
    fs.writeFileSync(outputPath, outputBuf);

    const docId = uuidv4();
    db.prepare(`INSERT OR REPLACE INTO documents (id, workflow_id, stage_number, doc_type, filename, filepath) VALUES (?, ?, 5, 'iso_testplan', ?, ?)`)
      .run(docId, workflow_id, filename, outputPath);

    res.json({ id: docId, filename, download_url: `/uploads/${filename}`, status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get review assignments for stage 5
router.post('/assign-reviewers', (req, res) => {
  const { workflow_id, assigned_by, co_users } = req.body;
  const assigner = db.prepare('SELECT name FROM users WHERE id=?').get(assigned_by);
  const insert = db.prepare(`INSERT INTO review_assignments (id, workflow_id, stage_number, assigned_by, assigned_to) VALUES (?, ?, 5, ?, ?)`);
  db.transaction(() => {
    co_users.forEach(userId => insert.run(uuidv4(), workflow_id, assigned_by, userId));
  })();
  logAuditTrail({
    workflow_id,
    stage_number: 5,
    action: `Test plan review assigned to ${co_users.length} reviewer(s) by ${assigner?.name || assigned_by}`,
    action_type: 'assign_reviewers',
    user_id: assigned_by,
    user_name: assigner?.name || null,
    details: { co_users, reviewer_count: co_users.length },
  });
  res.json({ success: true });
});

// Approve (user or co-user)
router.post('/approve', (req, res) => {
  const { workflow_id, user_id } = req.body;
  db.prepare(`INSERT INTO approvals (id, workflow_id, stage_number, user_id, action) VALUES (?, ?, 5, ?, 'approved')`)
    .run(uuidv4(), workflow_id, user_id);

  // Check if all required approvals received
  const assignments = db.prepare('SELECT * FROM review_assignments WHERE workflow_id=? AND stage_number=5').all(workflow_id);
  const approvals = db.prepare('SELECT * FROM approvals WHERE workflow_id=? AND stage_number=5 AND action=?').all(workflow_id, 'approved');
  const approvedIds = new Set(approvals.map(a => a.user_id));
  const allApproved = assignments.every(a => approvedIds.has(a.assigned_to));

  const usr = db.prepare('SELECT name FROM users WHERE id=?').get(user_id);
  if (allApproved) {
    db.prepare(`UPDATE stages SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE workflow_id=? AND stage_number=5`).run(workflow_id);
  }
  logAuditTrail({
    workflow_id,
    stage_number: 5,
    action: `Test plan review approved by ${usr?.name || user_id}${allApproved ? ' — all reviewers approved' : ''}`,
    action_type: 'approve',
    user_id,
    user_name: usr?.name || null,
    details: { all_approved: allApproved },
  });
  res.json({ success: true, all_approved: allApproved });
});

// Get approval status
router.get('/approval-status/:workflow_id', (req, res) => {
  const assignments = db.prepare('SELECT ra.*, u.name FROM review_assignments ra JOIN users u ON ra.assigned_to=u.id WHERE ra.workflow_id=? AND ra.stage_number=5').all(req.params.workflow_id);
  const approvals = db.prepare('SELECT user_id FROM approvals WHERE workflow_id=? AND stage_number=5 AND action=?').all(req.params.workflow_id, 'approved');
  const approvedIds = new Set(approvals.map(a => a.user_id));
  res.json(assignments.map(a => ({ ...a, approved: approvedIds.has(a.assigned_to) })));
});

function generateMarkdownPreview(workflow, testCases, testPlanDoc) {
  const manual = testCases.filter(tc => tc.classification === 'Manual');
  const semi = testCases.filter(tc => tc.classification === 'Semi-Automatable');
  const auto = testCases.filter(tc => tc.classification === 'Automatable');
  return `# Test Plan — ${workflow?.title || ''}\n**Release:** ${workflow?.jira_release}\n**Jira Story:** ${workflow?.jira_story_id}\n\n## Summary\n- Total: ${testCases.length}\n- 🔴 Manual: ${manual.length}\n- 🟡 Semi-Auto: ${semi.length}\n- 🟢 Automatable: ${auto.length}\n\n## Test Cases\n${testCases.map(tc => `### ${tc.tc_number}: ${tc.title}\n**Classification:** ${tc.classification}`).join('\n\n')}`;
}

module.exports = router;
