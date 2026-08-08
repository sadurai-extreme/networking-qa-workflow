const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { callLLM } = require('../services/llm');
const { logAuditTrail } = require('../utils/auditLogger');
const TCL_DOCS_DIR = path.resolve(__dirname, '../../../data/tcl_framework_docs');

// Extract the specific TC's steps from the full test plan
function extractTcStepsFromPlan(planContent, tcNumber) {
  if (!planContent) return '(test plan not available)';
  const esc = tcNumber.replace(/\./g, '\\.');
  const startRe = new RegExp(`(^|\\n)(#{1,4}\\s*(?:Test Case\\s*|TC\\s*)?${esc}[^\\n]*)`, 'i');
  const m = startRe.exec(planContent);
  if (!m) return planContent.substring(0, 4000);
  const tcStart = m.index + (m[1] ? 1 : 0);
  const level = (m[2].match(/^#+/) || [''])[0].length || 3;
  const after = planContent.slice(tcStart + 1);
  const nxt = new RegExp(`\\n#{1,${level}}\\s+(?!${esc})`, 'i').exec(after);
  const tcEnd = nxt ? tcStart + 1 + nxt.index : Math.min(tcStart + 6000, planContent.length);
  return planContent.slice(tcStart, tcEnd);
}

function loadTclDocs() {
  const docs = { cli: '', events: '', traffic: '', topology: '' };
  if (!fs.existsSync(TCL_DOCS_DIR)) return docs;
  for (const file of fs.readdirSync(TCL_DOCS_DIR)) {
    const content = fs.readFileSync(path.join(TCL_DOCS_DIR, file), 'utf8');
    if (file.includes('CLI_Syntax'))    docs.cli      = content;
    if (file.includes('Switch_Events')) docs.events   = content;
    if (file.includes('Traffic'))       docs.traffic  = content;
    if (file.includes('Topology'))      docs.topology = content;
  }
  return docs;
}

// In-memory generation lock: workflow_id → true while generating
const generatingWorkflows = new Set();

// Get generation status
router.get('/status/:workflow_id', (req, res) => {
  res.json({ generating: generatingWorkflows.has(req.params.workflow_id) });
});

// Generate TCL scripts for automatable test cases
router.post('/generate', async (req, res) => {
  const { workflow_id } = req.body;

  if (generatingWorkflows.has(workflow_id)) {
    return res.status(409).json({ error: 'Generation already in progress for this workflow' });
  }
  generatingWorkflows.add(workflow_id);

  const autoCases = db.prepare(`SELECT * FROM test_cases WHERE workflow_id=? AND classification IN ('Automatable','Semi-Automatable') ORDER BY tc_number`).all(workflow_id);
  const testPlanDoc = db.prepare(`SELECT content FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1`).get(workflow_id);

  const tclDocs = loadTclDocs();

  const generated = [];
  for (const tc of autoCases) {
    const systemPrompt = `You are an EXOS TCL test automation specialist generating production-quality scripts for the extremenetworks-emu/exos-tcl-automation framework.

## STRICT FRAMEWORK RULES — VIOLATIONS WILL CAUSE RUNTIME FAILURE

### MANDATORY: Use ONLY these procedures — do NOT invent any other names

**CLI Execution:**
- \`SendACmd "command"\` — THE ONLY way to send CLI commands. NOT SendCliCommand, NOT SendCmd.
- \`Login $DUT1_CONNECT\` — MUST call before any SendACmd for that DUT
- \`LogoutDUT\` / \`LogoutFast\` — for cleanup

**Verification:**
- \`CheckKeyValue "cli command" $parameterList -comment "msg"\` — verify patterns in output
- \`GetKeyValue "cli command" $parameters\` — extract counter/value
- \`CheckCmdLegal "cmd"\` / \`CheckCmdIllegal "cmd"\` — validate command acceptance

**Port Mapping (NEVER hardcode port numbers):**
- \`[MapDUTPortId 1 1]\` — port 1 on DUT1
- \`[MapDUTPortId 9 2]\` — first port on DUT2 in 2-node topology

**Result Reporting:**
- \`result_h1 "title"\` — main title; \`result_h2 "step"\` — step title
- \`result_ok "msg"\` / \`result_error "msg"\` / \`result_debug "msg"\` / \`result_skip "msg"\`
- \`report_start_test "title"\` / \`report_end_test\` — MUST be paired in EVERY step

**Timing:** \`exSleep N\` (seconds), \`after 1000\` (milliseconds for short waits)

---

## MANDATORY SCRIPT TEMPLATE — Every script MUST follow this exactly

\`\`\`tcl
##################################################################
# Test Name: [TC_ID].tcl
# Description: [description]
##################################################################

proc [TC_ID] {} {

set testcase_id "[TC_ID]"
set TestCaseTitle "$testcase_id: [title]"

global DUT1_CONNECT
global DUT2_CONNECT
global DUTs_info

set fd_res [open_result_file "$testcase_id"]
set time1 [clock seconds]

  result_h1 "$TestCaseTitle"
  report_start_test "$TestCaseTitle"

    ### Step 1: [description]
    set subTestTitle "[Step description]"
    result_h2 "$subTestTitle"
    report_start_test "$subTestTitle"
    Login $DUT1_CONNECT

      SendACmd "configure ..."
      set parameterList ""
      lappend parameterList "{expected_pattern} exist"
      CheckKeyValue "show ..." $parameterList -comment "Verify state"
      unset parameterList

    report_end_test

    ### Cleanup (ALWAYS last, no CheckKeyValue after deletions)
    set subTestTitle "Cleanup"
    result_h2 "$subTestTitle"
    report_start_test "$subTestTitle"
    Login $DUT1_CONNECT

      SendACmd "delete vlan ..."

    report_end_test

  set time2 [clock seconds]
  result_p "*** Time for $testcase_id = [expr $time2-$time1] secs\\n\\n"
  close_result_file
  report_end_test
}
\`\`\`

---

## NON-NEGOTIABLE RULES
1. proc name MUST match TC ID. NEVER quote it: \`proc 9.1.1 {}\` NOT \`proc "9.1.1" {}\`
2. NEVER add a bare proc call at the bottom of the file
3. NEVER use \`-fd $fd_res\` in CheckKeyValue calls
4. CheckKeyValue pattern syntax: \`"{pattern} exist"\` with curly braces — NOT \`"pattern exist"\`
5. Always \`unset parameterList\` after each CheckKeyValue block
6. Inline comments: use \`;#\` NOT bare \`#\`: \`set port [MapDUTPortId 1 1] ;# Get port\`
7. NEVER hardcode port numbers — always use \`MapDUTPortId\`
8. Cleanup MUST NOT have CheckKeyValue after delete commands
9. For L3 traffic: SendArpRequest uses positional args — NO \`-tag\` named param
10. Always StopPortsTransmit immediately after CheckRates

## Framework Reference
${tclDocs.cli}

## Switch Events
${tclDocs.events}

## Traffic Patterns
${tclDocs.traffic}

Return ONLY the TCL script. No markdown fences, no explanation.`;


    const userPrompt = `Generate a complete, framework-compliant TCL script for this test case.

TC Number: ${tc.tc_number}
Title: ${tc.title}
Description: ${tc.description || tc.title}
Classification: ${tc.classification}

INSTRUCTIONS:
- The proc name must be exactly: ${tc.tc_number}
- Use SendACmd for ALL CLI commands (NOT SendCliCommand)
- Use MapDUTPortId for ALL port references (NEVER hardcode ports)
- Use CheckKeyValue to verify every configuration step
- Cleanup must be the last step; no CheckKeyValue after delete commands
- For Semi-Automatable TCs: add result_debug + exSleep at manual intervention steps

Test Plan Steps for this TC (extract configuration details, expected results, and cleanup from here):
${extractTcStepsFromPlan(testPlanDoc?.content || '', tc.tc_number)}

Return ONLY the TCL script. No markdown fences, no explanation, no prose.`;

    try {
      const content = await callLLM(systemPrompt, userPrompt, true);
      const scriptId = uuidv4();
      const filename = `${tc.tc_number}.tcl`;
      const dir = path.resolve(__dirname, '../../../uploads/scripts', workflow_id);
      fs.mkdirSync(dir, { recursive: true });
      const filepath = path.join(dir, filename);
      fs.writeFileSync(filepath, content);

      db.prepare(`DELETE FROM tcl_scripts WHERE workflow_id=? AND test_case_id=?`).run(workflow_id, tc.id);
      db.prepare(`INSERT INTO tcl_scripts (id, workflow_id, test_case_id, filename, content) VALUES (?, ?, ?, ?, ?)`)
        .run(scriptId, workflow_id, tc.id, filename, content);

      generated.push({ tc_number: tc.tc_number, filename, id: scriptId });
      req.app.get('io')?.emit(`script-progress-${workflow_id}`, { tc_number: tc.tc_number, filename });
    } catch (err) {
      generated.push({ tc_number: tc.tc_number, error: err.message });
    }
  }
  logAuditTrail({
    workflow_id,
    stage_number: 7,
    action: `TCL scripts generated: ${generated.filter(g => !g.error).length}/${autoCases.length} automatable TCs`,
    action_type: 'generate',
    details: { total: autoCases.length, success: generated.filter(g => !g.error).length, failed: generated.filter(g => g.error).length },
  });
  generatingWorkflows.delete(workflow_id);
  res.json({ generated, total: autoCases.length });
});

// Get all scripts for workflow
router.get('/:workflow_id', (req, res) => {
  const scripts = db.prepare(
    'SELECT ts.*, tc.tc_number, tc.title FROM tcl_scripts ts ' +
    'JOIN test_cases tc ON ts.test_case_id=tc.id ' +
    'WHERE ts.workflow_id=? AND ts.rowid IN (' +
    '  SELECT MAX(rowid) FROM tcl_scripts WHERE workflow_id=? GROUP BY test_case_id' +
    ') ORDER BY tc.tc_number'
  ).all(req.params.workflow_id, req.params.workflow_id);

  const { total } = db.prepare(
    "SELECT COUNT(*) AS total FROM test_cases WHERE workflow_id=? AND classification IN ('Automatable','Semi-Automatable')"
  ).get(req.params.workflow_id) || { total: 0 };

  res.json({ scripts, totalAutomatable: total });
});

// Amend script
router.put('/amend', (req, res) => {
  const { script_id, content, workflow_id, user_id, user_name } = req.body;
  const sc = db.prepare('SELECT tc.tc_number FROM tcl_scripts ts JOIN test_cases tc ON ts.test_case_id=tc.id WHERE ts.id=?').get(script_id);
  db.prepare('UPDATE tcl_scripts SET content=? WHERE id=?').run(content, script_id);
  logAuditTrail({
    workflow_id: workflow_id || null,
    stage_number: 7,
    action: `Script manually amended: TC ${sc?.tc_number || script_id}`,
    action_type: 'amend',
    user_id: user_id || null,
    user_name: user_name || null,
    details: { script_id, tc_number: sc?.tc_number, content_length: content?.length },
  });
  res.json({ success: true });
});

// Assign co-reviewers
router.post('/assign-reviewers', (req, res) => {
  const { workflow_id, assigned_by, co_users } = req.body;
  const assigner = db.prepare('SELECT name FROM users WHERE id=?').get(assigned_by);
  const insert = db.prepare(`INSERT INTO review_assignments (id, workflow_id, stage_number, assigned_by, assigned_to) VALUES (?, ?, 7, ?, ?)`);
  db.transaction(() => co_users.forEach(uid => insert.run(uuidv4(), workflow_id, assigned_by, uid)))();
  logAuditTrail({
    workflow_id,
    stage_number: 7,
    action: `Script review assigned to ${co_users.length} reviewer(s) by ${assigner?.name || assigned_by}`,
    action_type: 'assign_reviewers',
    user_id: assigned_by,
    user_name: assigner?.name || null,
    details: { co_users, reviewer_count: co_users.length },
  });
  res.json({ success: true });
});

// Approve script review
router.post('/approve', (req, res) => {
  const { workflow_id, user_id } = req.body;
  const usr = db.prepare('SELECT name FROM users WHERE id=?').get(user_id);
  db.prepare(`INSERT INTO approvals (id, workflow_id, stage_number, user_id, action) VALUES (?, ?, 7, ?, 'approved')`)
    .run(uuidv4(), workflow_id, user_id);

  const assignments = db.prepare('SELECT * FROM review_assignments WHERE workflow_id=? AND stage_number=7').all(workflow_id);
  const approvals = db.prepare('SELECT user_id FROM approvals WHERE workflow_id=? AND stage_number=7 AND action=?').all(workflow_id, 'approved');
  const approvedIds = new Set(approvals.map(a => a.user_id));
  const allApproved = assignments.length > 0 && assignments.every(a => approvedIds.has(a.assigned_to));

  if (allApproved) {
    db.prepare(`UPDATE stages SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE workflow_id=? AND stage_number=7`).run(workflow_id);
  }
  logAuditTrail({
    workflow_id,
    stage_number: 7,
    action: `Script review approved by ${usr?.name || user_id}${allApproved ? ' — all reviewers approved' : ''}`,
    action_type: 'approve',
    user_id,
    user_name: usr?.name || null,
    details: { all_approved: allApproved },
  });
  res.json({ success: true, all_approved: allApproved });
});

// Get approval status for stage 7
router.get('/approval-status/:workflow_id', (req, res) => {
  const assignments = db.prepare('SELECT ra.*, u.name FROM review_assignments ra JOIN users u ON ra.assigned_to=u.id WHERE ra.workflow_id=? AND ra.stage_number=7').all(req.params.workflow_id);
  const approvals = db.prepare('SELECT user_id FROM approvals WHERE workflow_id=? AND stage_number=7 AND action=?').all(req.params.workflow_id, 'approved');
  const approvedIds = new Set(approvals.map(a => a.user_id));
  res.json(assignments.map(a => ({ ...a, approved: approvedIds.has(a.assigned_to) })));
});

// ── POST /regenerate — Regenerate a single script with user feedback ─────────
router.post('/regenerate', async (req, res) => {
  const { script_id, user_feedback } = req.body;
  if (!script_id) return res.status(400).json({ error: 'script_id required' });

  const script = db.prepare(
    'SELECT ts.*, tc.tc_number, tc.title, tc.description, tc.classification, tc.workflow_id ' +
    'FROM tcl_scripts ts JOIN test_cases tc ON ts.test_case_id=tc.id WHERE ts.id=?'
  ).get(script_id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  const testPlanDoc = db.prepare(
    "SELECT content FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1"
  ).get(script.workflow_id);

  const tclDocs = loadTclDocs();
  const feedback = user_feedback || '(No specific feedback — regenerate with improved quality and stricter framework compliance)';
  const tcSteps = extractTcStepsFromPlan(testPlanDoc ? testPlanDoc.content : '', script.tc_number);

  const systemPrompt = [
    'You are an EXOS TCL test automation specialist. Apply user feedback and fix framework violations.',
    '',
    'RULES:',
    '- SendACmd is THE ONLY CLI proc. NEVER use SendCliCommand.',
    '- Login before every DUT access.',
    '- proc name must match TC ID exactly, unquoted: proc 9.1.1 {} not proc "9.1.1" {}',
    '- CheckKeyValue pattern syntax: "{pattern} exist" with curly braces',
    '- Always unset parameterList after each CheckKeyValue block',
    '- NEVER use -fd $fd_res in CheckKeyValue',
    '- Use MapDUTPortId for ALL port refs — NEVER hardcode port numbers',
    '- StopPortsTransmit immediately after CheckRates',
    '- No CheckKeyValue after delete commands in cleanup',
    '- report_start_test / report_end_test must be paired in every step',
    '',
    'Framework Reference:',
    tclDocs.cli,
    '',
    'Traffic Patterns:',
    tclDocs.traffic,
    '',
    'Return ONLY the TCL script. No markdown fences, no explanation.',
  ].join('\n');

  const userPrompt = [
    `Regenerate the TCL script for TC ${script.tc_number}, incorporating the user feedback.`,
    '',
    `TC Number: ${script.tc_number}`,
    `Title: ${script.title}`,
    `Classification: ${script.classification}`,
    '',
    '## USER FEEDBACK / CHANGES REQUESTED:',
    feedback,
    '',
    '## CURRENT SCRIPT (revise this):',
    script.content,
    '',
    '## TEST PLAN STEPS:',
    tcSteps,
    '',
    'Return ONLY the complete TCL script. No markdown fences, no explanation, no prose.',
  ].join('\n');

  try {
    const content = await callLLM(systemPrompt, userPrompt, true);
    const dir = path.resolve(__dirname, '../../../uploads/scripts', script.workflow_id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, script.filename), content);
    db.prepare('UPDATE tcl_scripts SET content=? WHERE id=?').run(content, script_id);
    logAuditTrail({
      workflow_id: script.workflow_id,
      stage_number: 7,
      action: `Script regenerated with AI: TC ${script.tc_number} (${script.filename})`,
      action_type: 'regenerate',
      details: { script_id, tc_number: script.tc_number, filename: script.filename, has_feedback: !!(user_feedback && user_feedback.trim()) },
    });
    res.json({ success: true, content, filename: script.filename, tc_number: script.tc_number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /review — Senior EXOS Architect AI review ───────────────────────────
router.post('/review', async (req, res) => {
  const { script_id, batch } = req.body;
  if (!script_id) return res.status(400).json({ error: 'script_id required' });

  const script = db.prepare(
    'SELECT ts.*, tc.tc_number, tc.title, tc.description, tc.classification, tc.workflow_id ' +
    'FROM tcl_scripts ts JOIN test_cases tc ON ts.test_case_id=tc.id WHERE ts.id=?'
  ).get(script_id);
  if (!script) return res.status(404).json({ error: 'Script not found' });

  const testPlanDoc = db.prepare(
    "SELECT content FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1"
  ).get(script.workflow_id);

  const tcSteps = extractTcStepsFromPlan(testPlanDoc ? testPlanDoc.content : '', script.tc_number);

  const systemPrompt = `You are a Senior Networking Architect at Extreme Networks with 15+ years of EXOS expertise and deep mastery of the exos-tcl-automation framework.

Your review covers:
1. FRAMEWORK COMPLIANCE — strict rule violations that cause runtime failure
2. EXOS CLI ACCURACY — are commands syntactically correct EXOS CLI?
3. TEST COVERAGE — does the script fully cover the test plan steps?
4. AUTOMATION QUALITY — good assertions, timing, cleanup
5. CODE QUALITY — readability, structure, naming

FRAMEWORK RULES TO CHECK (any violation = CRITICAL):
- SendACmd is the ONLY CLI proc. SendCliCommand = instant fail.
- Login must precede every DUT access
- proc name must match TC ID exactly, unquoted: proc 9.1.1 {} not proc "9.1.1" {}
- CheckKeyValue: pattern must use curly braces: "{pattern} exist"
- unset parameterList after every CheckKeyValue block
- NEVER -fd $fd_res in any CheckKeyValue call
- MapDUTPortId for ALL port refs — hardcoded port numbers = instant fail
- StopPortsTransmit must immediately follow CheckRates
- No CheckKeyValue after delete commands in cleanup
- report_start_test / report_end_test must be paired in every step
- open_result_file and close_result_file must be present
- result_h1 for main title, result_h2 for each step

Return a JSON object ONLY — no prose, no markdown fences. Structure:
{
  "verdict": "PASS" | "NEEDS_REVISION" | "FAIL",
  "score": <integer 0-100>,
  "summary": "<1-2 sentence overall assessment>",
  "issues": [{ "severity": "CRITICAL"|"WARNING"|"SUGGESTION", "category": "<Framework|CLI|Coverage|Quality>", "description": "<issue>", "line_hint": "<code snippet>" }],
  "positives": ["<thing done well>"]
}`;

  const userPrompt = `Review this TCL automation script for TC ${script.tc_number}.

TC Number: ${script.tc_number}
Title: ${script.title}
Classification: ${script.classification}

SCRIPT TO REVIEW:
${script.content}

TEST PLAN STEPS (expected coverage):
${tcSteps}

Return ONLY a valid JSON object. No markdown, no explanation.`;

  try {
    const raw = await callLLM(systemPrompt, userPrompt, !batch);
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let review;
    try { review = JSON.parse(clean); }
    catch { return res.status(500).json({ error: 'Review parse failed', raw }); }
    logAuditTrail({
      workflow_id: script.workflow_id,
      stage_number: 7,
      action: `AI architect review: TC ${script.tc_number} — ${review.verdict} (${review.score}/100)`,
      action_type: 'ai_review',
      details: { script_id, tc_number: script.tc_number, verdict: review.verdict, score: review.score, issues_count: review.issues?.length, critical: review.issues?.filter(i => i.severity === 'CRITICAL').length },
    });
    res.json({ success: true, review, tc_number: script.tc_number, filename: script.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
