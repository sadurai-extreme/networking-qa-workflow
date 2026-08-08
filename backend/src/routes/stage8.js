const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { callLLM } = require('../services/llm');
const { logAuditTrail } = require('../utils/auditLogger');

// Extract a specific TC's section from test plan markdown
function extractTcSection(planContent, tcNumber) {
  if (!planContent) return '';
  const esc = tcNumber.replace(/\./g, '\\.');
  const startRe = new RegExp(`(^|\\n)(#{1,4}\\s*(?:Test Case\\s*|TC\\s*)?${esc}[^\\n]*)`, 'i');
  const m = startRe.exec(planContent);
  if (!m) return '';
  const tcStart = m.index + (m[1] ? 1 : 0);
  const level = (m[2].match(/^#+/) || [''])[0].length || 3;
  const after = planContent.slice(tcStart + 1);
  const nxt = new RegExp(`\\n#{1,${level}}\\s+(?!${esc})`, 'i').exec(after);
  const tcEnd = nxt ? tcStart + 1 + nxt.index : Math.min(tcStart + 6000, planContent.length);
  return planContent.slice(tcStart, tcEnd).trim();
}

// ── GET /api/stage8/tc-content/:workflow_id/:tc_number ────────────────────────
// Returns TC description from DB (if saved) or extracts from test plan markdown
router.get('/tc-content/:workflow_id/:tc_number', (req, res) => {
  const { workflow_id, tc_number } = req.params;
  const tc = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? AND tc_number=?').get(workflow_id, tc_number);
  if (!tc) return res.status(404).json({ error: 'TC not found' });

  // If description already saved, return it
  if (tc.description && tc.description.trim()) {
    return res.json({ content: tc.description, source: 'saved' });
  }

  // Otherwise extract from test plan document
  const planDoc = db.prepare(
    "SELECT content FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1"
  ).get(workflow_id);
  const extracted = extractTcSection(planDoc?.content || '', tc_number);
  res.json({ content: extracted, source: 'test_plan' });
});

// ── GET /api/stage8/execution/:workflow_id ────────────────────────────────────
router.get('/execution/:workflow_id', (req, res) => {
  const { workflow_id } = req.params;
  const cases = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number').all(workflow_id);
  const results = db.prepare('SELECT * FROM tc_execution_results WHERE workflow_id=?').all(workflow_id);
  const resultMap = {};
  for (const r of results) resultMap[r.tc_number] = r;

  const tcs = cases.map(tc => ({
    ...tc,
    result:        resultMap[tc.tc_number]?.result        || 'not_run',
    notes:         resultMap[tc.tc_number]?.notes         || '',
    updated_steps: resultMap[tc.tc_number]?.updated_steps || '',
    platform:      resultMap[tc.tc_number]?.platform      || '',
    build:         resultMap[tc.tc_number]?.build         || '',
    session_id:    resultMap[tc.tc_number]?.session_id    || null,
    executed_at:   resultMap[tc.tc_number]?.executed_at   || null,
    executed_by:   resultMap[tc.tc_number]?.executed_by   || '',
    exec_id:       resultMap[tc.tc_number]?.id            || null,
  }));

  const summary = {
    total:   tcs.length,
    not_run: tcs.filter(t => t.result === 'not_run').length,
    pass:    tcs.filter(t => t.result === 'pass').length,
    fail:    tcs.filter(t => t.result === 'fail').length,
    blocked: tcs.filter(t => t.result === 'blocked').length,
  };

  // Latest session for this workflow
  const latestSession = db.prepare('SELECT * FROM execution_sessions WHERE workflow_id=? ORDER BY started_at DESC LIMIT 1').get(workflow_id);

  res.json({ tcs, summary, latestSession: latestSession || null });
});

// ── POST /api/stage8/execution/session ───────────────────────────────────────
router.post('/execution/session', (req, res) => {
  const { workflow_id, platform, build, environment, started_by, notes } = req.body;
  if (!workflow_id || !platform || !build)
    return res.status(400).json({ error: 'workflow_id, platform, build required' });
  const id = uuidv4();
  db.prepare(`INSERT INTO execution_sessions (id,workflow_id,platform,build,environment,started_by,notes) VALUES (?,?,?,?,?,?,?)`)
    .run(id, workflow_id, platform, build, environment || '', started_by || '', notes || '');
  logAuditTrail({
    workflow_id,
    stage_number: 8,
    action: `Execution session started — Platform: ${platform}, Build: ${build}${environment ? ', Env: ' + environment : ''}`,
    action_type: 'session_start',
    user_name: started_by || null,
    details: { platform, build, environment, session_id: id },
  });
  res.json({ success: true, session_id: id });
});

// ── GET /api/stage8/execution/sessions/:workflow_id ──────────────────────────
router.get('/execution/sessions/:workflow_id', (req, res) => {
  const sessions = db.prepare('SELECT * FROM execution_sessions WHERE workflow_id=? ORDER BY started_at DESC').all(req.params.workflow_id);
  res.json({ sessions });
});

// ── POST /api/stage8/execution/record ────────────────────────────────────────
router.post('/execution/record', (req, res) => {
  const { workflow_id, tc_number, result, notes, executed_by, updated_steps, platform, build, session_id } = req.body;
  if (!workflow_id || !tc_number || !result)
    return res.status(400).json({ error: 'workflow_id, tc_number, result required' });

  const existing = db.prepare('SELECT id FROM tc_execution_results WHERE workflow_id=? AND tc_number=?').get(workflow_id, tc_number);
  if (existing) {
    db.prepare(`UPDATE tc_execution_results SET result=?, notes=?, updated_steps=?, executed_at=CURRENT_TIMESTAMP, executed_by=?, platform=?, build=?, session_id=? WHERE id=?`)
      .run(result, notes || '', updated_steps || '', executed_by || null, platform || '', build || '', session_id || null, existing.id);
  } else {
    db.prepare(`INSERT INTO tc_execution_results (id,workflow_id,tc_number,result,notes,updated_steps,executed_at,executed_by,platform,build,session_id) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP,?,?,?,?)`)
      .run(uuidv4(), workflow_id, tc_number, result, notes || '', updated_steps || '', executed_by || null, platform || '', build || '', session_id || null);
  }

  // If steps were updated, patch the test plan too
  if (updated_steps && updated_steps.trim()) {
    const planDoc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1`).get(workflow_id);
    if (planDoc) {
      const esc = tc_number.replace(/\./g, '\\.');
      const m = new RegExp(`(^|\\n)(#{1,4}\\s*(?:Test Case\\s*)?${esc}[^\\n]*)`, 'i').exec(planDoc.content);
      if (m) {
        const tcStart = m.index + (m[1] ? 1 : 0);
        const level = (m[2].match(/^#+/) || [''])[0].length || 3;
        const nxt = new RegExp(`\\n#{1,${level}}\\s+(?!${esc}[^\\d])`, 'i').exec(planDoc.content.slice(tcStart + 1));
        const tcEnd = nxt ? tcStart + 1 + nxt.index : planDoc.content.length;
        const updated = planDoc.content.slice(0, tcStart) + updated_steps.trim() + '\n\n' + planDoc.content.slice(tcEnd);
        db.prepare(`UPDATE documents SET content=? WHERE id=?`).run(updated, planDoc.id);
      }
    }
  }
  logAuditTrail({
    workflow_id,
    stage_number: 8,
    action: `TC ${tc_number} result recorded: ${result.toUpperCase()}${platform ? ' on ' + platform : ''}${build ? ' build ' + build : ''}`,
    action_type: 'record_result',
    user_name: executed_by || null,
    details: { tc_number, result, platform: platform || '', build: build || '', session_id: session_id || null, has_notes: !!(notes && notes.trim()), has_updated_steps: !!(updated_steps && updated_steps.trim()) },
  });
  res.json({ success: true });
});

// ── POST /api/stage8/execution/update-plan ────────────────────────────────────
// Append execution results summary block to the test plan (no AI, instant)
router.post('/execution/update-plan', (req, res) => {
  const { workflow_id, dry_run } = req.body;
  if (!workflow_id) return res.status(400).json({ error: 'workflow_id required' });

  const cases   = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number').all(workflow_id);
  const results = db.prepare('SELECT * FROM tc_execution_results WHERE workflow_id=?').all(workflow_id);
  const sessions = db.prepare('SELECT * FROM execution_sessions WHERE workflow_id=? ORDER BY started_at DESC').all(workflow_id);
  const planDoc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1`).get(workflow_id);

  if (!planDoc) return res.status(404).json({ error: 'No test plan found for this workflow' });

  const resultMap = {};
  for (const r of results) resultMap[r.tc_number] = r;

  const pass    = results.filter(r => r.result === 'pass').length;
  const fail    = results.filter(r => r.result === 'fail').length;
  const blocked = results.filter(r => r.result === 'blocked').length;
  const notRun  = cases.filter(tc => !resultMap[tc.tc_number]).length;
  const now     = new Date().toISOString().split('T')[0];

  const sessionLines = sessions.length > 0
    ? sessions.map(s => `| ${s.platform} | ${s.build} | ${s.environment || '-'} | ${s.started_by || '-'} | ${s.started_at?.split('T')[0] || '-'} |`).join('\n')
    : '| - | - | - | - | - |';

  const tcLines = cases.map(tc => {
    const r = resultMap[tc.tc_number];
    const badge = r ? r.result.toUpperCase() : 'NOT RUN';
    return `| ${tc.tc_number} | ${tc.title} | ${tc.classification} | **${badge}** | ${r?.platform || '-'} | ${r?.build || '-'} | ${r?.notes || ''} |`;
  }).join('\n');

  const appendBlock = `

---

## Execution Results (Updated: ${now})

**Summary:** Total: ${cases.length} | Pass: ${pass} | Fail: ${fail} | Blocked: ${blocked} | Not Run: ${notRun}

### Test Sessions
| Platform | Build | Environment | Executed By | Date |
|----------|-------|-------------|-------------|------|
${sessionLines}

### Test Case Execution Status
| TC# | Title | Classification | Result | Platform | Build | Notes |
|-----|-------|----------------|--------|----------|-------|-------|
${tcLines}
`;

  // Remove any previous execution results block and append fresh
  let content = planDoc.content.replace(/\n---\n+## Execution Results[\s\S]*$/, '');
  content += appendBlock;

  // dry_run: return content without writing to DB (used on page load to check if plan exists)
  if (dry_run) return res.json({ content });

  db.prepare(`UPDATE documents SET content=? WHERE id=?`).run(content, planDoc.id);
  logAuditTrail({
    workflow_id,
    stage_number: 8,
    action: `Test plan updated with execution results — Pass:${pass} Fail:${fail} Blocked:${blocked} NotRun:${notRun}`,
    action_type: 'update_test_plan',
    details: { pass, fail, blocked, not_run: notRun, total: cases.length, session_count: sessions.length },
  });
  res.json({ success: true, content });
});

// ── POST /api/stage8/execution/finalize ──────────────────────────────────────
router.post('/execution/finalize', async (req, res) => {
  const { workflow_id } = req.body;
  const cases    = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number').all(workflow_id);
  const results  = db.prepare('SELECT * FROM tc_execution_results WHERE workflow_id=?').all(workflow_id);
  const sessions = db.prepare('SELECT * FROM execution_sessions WHERE workflow_id=? ORDER BY started_at DESC').all(workflow_id);
  const planDoc  = db.prepare(`SELECT content FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1`).get(workflow_id);
  const workflow = db.prepare('SELECT * FROM workflows WHERE id=?').get(workflow_id);
  const resultMap = {};
  for (const r of results) resultMap[r.tc_number] = r;

  const summary = {
    total:   cases.length,
    pass:    results.filter(r => r.result === 'pass').length,
    fail:    results.filter(r => r.result === 'fail').length,
    blocked: results.filter(r => r.result === 'blocked').length,
    not_run: cases.filter(tc => !resultMap[tc.tc_number]).length,
  };

  const executionTable = cases.map(tc => {
    const r = resultMap[tc.tc_number];
    return `| ${tc.tc_number} | ${tc.title} | ${tc.classification} | ${r?.result?.toUpperCase() || 'NOT RUN'} | ${r?.platform || '-'} | ${r?.build || '-'} | ${r?.notes || ''} |`;
  }).join('\n');

  const sessionContext = sessions.length > 0
    ? sessions.map(s => `Platform: ${s.platform}, Build: ${s.build}, Env: ${s.environment || '-'}`).join(' | ')
    : 'No session info recorded';

  const systemPrompt = `You are a technical writer producing a final QA test execution report.
Produce a complete final test plan in markdown that:
- Starts with an Executive Summary including test session context (platforms, builds)
- Includes a Summary Table (pass/fail/blocked/not_run counts)
- Keeps all original TC sections intact
- Appends an "Execution Result" sub-section to each TC: result badge, platform, build, notes, updated steps (if any)
- Is professional and ready for distribution
Return ONLY the markdown document.`;

  const userPrompt = `Workflow: ${workflow?.title || workflow_id} | Jira: ${workflow?.jira_story_id || 'N/A'}
Test Session(s): ${sessionContext}
Summary — Total:${summary.total} Pass:${summary.pass} Fail:${summary.fail} Blocked:${summary.blocked} NotRun:${summary.not_run}

Execution Results:
| TC# | Title | Classification | Result | Platform | Build | Notes |
|-----|-------|---------------|--------|----------|-------|-------|
${executionTable}

Original Test Plan:
${planDoc?.content || '(not found)'}`;

  try {
    const finalPlan = await callLLM(systemPrompt, userPrompt, true);
    const docId = uuidv4();
    db.prepare(`INSERT INTO documents (id,workflow_id,stage_number,doc_type,content,version,created_at) VALUES (?,?,8,'final_test_plan',?,1,CURRENT_TIMESTAMP)`)
      .run(docId, workflow_id, finalPlan);
    res.json({ success: true, content: finalPlan, doc_id: docId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/stage8/final-plan/:workflow_id ───────────────────────────────────
router.get('/final-plan/:workflow_id', (req, res) => {
  const doc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=8 AND doc_type='final_test_plan' ORDER BY created_at DESC LIMIT 1`).get(req.params.workflow_id);
  res.json({ content: doc?.content || null, doc_id: doc?.id || null });
});

// ── POST /api/stage8/approve ──────────────────────────────────────────────────
router.post('/approve', (req, res) => {
  const { workflow_id, user_id } = req.body;
  const usr = db.prepare('SELECT name FROM users WHERE id=?').get(user_id);
  db.prepare(`INSERT OR IGNORE INTO approvals (id,workflow_id,stage_number,user_id,action) VALUES (?,?,8,?,'approved')`).run(uuidv4(), workflow_id, user_id);
  db.prepare(`UPDATE stages SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE workflow_id=? AND stage_number=8`).run(workflow_id);
  logAuditTrail({
    workflow_id,
    stage_number: 8,
    action: `TC Execution stage approved by ${usr?.name || user_id}`,
    action_type: 'approve',
    user_id,
    user_name: usr?.name || null,
  });
  res.json({ success: true });
});

// ── PUT /api/stage8/tc/:id  ── Update a test case title/description ──────────
router.put('/tc/:id', (req, res) => {
  const { title, description, classification } = req.body;
  const tc = db.prepare('SELECT * FROM test_cases WHERE id=?').get(req.params.id);
  if (!tc) return res.status(404).json({ error: 'Test case not found' });
  db.prepare('UPDATE test_cases SET title=?, description=?, classification=? WHERE id=?')
    .run(title ?? tc.title, description ?? tc.description, classification ?? tc.classification, req.params.id);
  logAuditTrail({
    workflow_id: tc.workflow_id,
    stage_number: 8,
    action: `Test case ${tc.tc_number} updated`,
    action_type: 'edit',
    details: { tc_number: tc.tc_number, title, description },
  });
  res.json({ success: true });
});

// ── DELETE /api/stage8/tc/:id  ── Delete a test case ─────────────────────────
router.delete('/tc/:id', (req, res) => {
  const tc = db.prepare('SELECT * FROM test_cases WHERE id=?').get(req.params.id);
  if (!tc) return res.status(404).json({ error: 'Test case not found' });
  db.prepare('DELETE FROM tc_execution_results WHERE workflow_id=? AND tc_number=?').run(tc.workflow_id, tc.tc_number);
  db.prepare('DELETE FROM tcl_scripts WHERE workflow_id=? AND test_case_id=?').run(tc.workflow_id, req.params.id);
  db.prepare('DELETE FROM test_cases WHERE id=?').run(req.params.id);
  logAuditTrail({
    workflow_id: tc.workflow_id,
    stage_number: 8,
    action: `Test case ${tc.tc_number} deleted`,
    action_type: 'delete',
    details: { tc_number: tc.tc_number, title: tc.title },
  });
  res.json({ success: true });
});

module.exports = router;
