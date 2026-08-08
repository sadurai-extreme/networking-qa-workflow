const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { logAuditTrail } = require('../utils/auditLogger');
require('dotenv').config();

const QTEST_BASE = process.env.QTEST_BASE_URL;
const QTEST_TOKEN = process.env.QTEST_API_TOKEN;

// ─── Helpers for XLSX generation ─────────────────────────────────────────────

// Parse markdown test plan to build map: section_prefix → section_label
// e.g. "5.1" → "5.1_CLI_Test_Cases"
function parseSectionHeadings(content) {
  const map = {};
  if (!content) return map;
  for (const line of content.split('\n')) {
    const m = line.match(/^#{1,4}\s+(\d+(?:\.\d+)*)\s+(.*)/);
    if (m) {
      const prefix = m[1];
      const title = m[2]
        .trim()
        .replace(/\*\*/g, '')
        .replace(/[^a-zA-Z0-9\s_]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      if (title) map[prefix] = `${prefix}_${title}`;
    }
  }
  return map;
}

// Drop the last decimal segment to get the section prefix
// "5.1.1" → "5.1",  "5.3.10" → "5.3",  "5.1" → "5.1"
function getTcSectionPrefix(tcNumber) {
  const parts = String(tcNumber).split('.');
  return parts.length <= 1 ? tcNumber : parts.slice(0, -1).join('.');
}

// Extract step actions and expected results for a TC from the test plan markdown
function extractTcContent(planContent, tcNumber) {
  if (!planContent) return { steps: '', expected: '' };
  const escaped = String(tcNumber).replace(/\./g, '\\.');
  // Match the TC heading and capture content until the next heading of same/higher level
  const pat = new RegExp(
    `\\n#{1,4}[^\\n]*?(?:TC[\\s.-]*)?${escaped}(?:[^\\d.][^\\n]*)?\\n([\\s\\S]*?)(?=\\n#{1,4}[^\\n]|$)`, 'i'
  );
  const match = pat.exec('\n' + planContent);
  if (!match) return { steps: '', expected: '' };
  const section = match[1] || '';

  const stepsM = section.match(/(?:#{2,4}\s*)?(?:steps?|procedure|test steps?|actions?)(?:\s*:|\s*\n)([\s\S]*?)(?=(?:#{2,4}\s*)?(?:expected|result|verification)|$)/i);
  const expectedM = section.match(/(?:#{2,4}\s*)?(?:expected(?:\s+results?|\s+outcome|\s+behavior)?|verification)(?:\s*:|\s*\n)([\s\S]*?)(?=(?:#{2,4}\s*)|$)/i);

  return {
    steps:    (stepsM    ? stepsM[1]    : section).trim().slice(0, 2000),
    expected: (expectedM ? expectedM[1] : ''      ).trim().slice(0, 1000),
  };
}

// ─── Static routes MUST be before /:workflow_id ─────────────────────────────

// GET /qtest-projects
router.get('/qtest-projects', async (req, res) => {
  try {
    const resp = await fetch(`${QTEST_BASE}/api/v3/projects`, {
      headers: { Authorization: `Bearer ${QTEST_TOKEN}` },
    });
    res.json(await resp.json());
  } catch {
    res.json([
      { id: 1, name: 'NOS_QA_Project (Mock)' },
      { id: 2, name: 'EXOS_Regression (Mock)' },
      { id: 3, name: 'BGP_Suite (Mock)' },
    ]);
  }
});

// POST /qtest-upload — upload TCs + execution results to qTest
router.post('/qtest-upload', async (req, res) => {
  const { workflow_id, project_id } = req.body;
  if (!workflow_id || !project_id) {
    return res.status(400).json({ error: 'workflow_id and project_id required' });
  }

  const testCases = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number').all(workflow_id);
  const io = req.app.get('io');
  const results = [];

  for (const tc of testCases) {
    try {
      let qtestId = tc.qtest_id;

      // Upload TC if not already in qTest
      if (!qtestId) {
        const payload = {
          name: `${tc.tc_number}: ${tc.title}`,
          description: tc.description || '',
          properties: [{ field_name: 'Automation', field_value: tc.classification }],
        };
        try {
          const resp = await fetch(`${QTEST_BASE}/api/v3/projects/${project_id}/test-cases`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${QTEST_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await resp.json();
          qtestId = data.id?.toString();
        } catch {
          qtestId = `QT-${project_id}-${tc.tc_number}`;
        }
        db.prepare('UPDATE test_cases SET qtest_id=? WHERE id=?').run(qtestId, tc.id);
      }

      // Get latest execution result for this TC
      const execResult = db.prepare(
        'SELECT * FROM tc_execution_results WHERE workflow_id=? AND test_case_id=? ORDER BY executed_at DESC LIMIT 1'
      ).get(workflow_id, tc.id);

      let runId = null;
      if (execResult) {
        try {
          if (QTEST_BASE && QTEST_TOKEN) {
            const runPayload = {
              name: `Execution: ${tc.tc_number}`,
              test_case: { id: parseInt(qtestId) || 0 },
              properties: [
                { field_name: 'Status', field_value: execResult.result },
                { field_name: 'Platform', field_value: execResult.platform || '' },
                { field_name: 'Build', field_value: execResult.build || '' },
              ],
            };
            const runResp = await fetch(`${QTEST_BASE}/api/v3/projects/${project_id}/test-runs`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${QTEST_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(runPayload),
            });
            const runData = await runResp.json();
            runId = runData.id?.toString();
          } else {
            runId = `QT-RUN-MOCK-${tc.tc_number}`;
          }
        } catch {
          runId = `QT-RUN-MOCK-${tc.tc_number}`;
        }
      }

      results.push({
        tc_number: tc.tc_number,
        title: tc.title,
        classification: tc.classification,
        qtest_id: qtestId,
        run_id: runId,
        result: execResult?.result || 'NOT_RUN',
        platform: execResult?.platform || null,
        build: execResult?.build || null,
        status: 'uploaded',
      });

      io?.emit(`qtest-progress-${workflow_id}`, {
        tc_number: tc.tc_number,
        done: results.length,
        total: testCases.length,
      });
    } catch (err) {
      results.push({ tc_number: tc.tc_number, title: tc.title, status: 'failed', error: err.message });
    }
  }

  const uploaded = results.filter(r => r.status === 'uploaded').length;
  logAuditTrail({
    workflow_id,
    stage_number: 9,
    action: `qTest upload: ${uploaded}/${testCases.length} TCs with execution results to project ${project_id}`,
    action_type: 'qtest_upload',
    details: { project_id, total: testCases.length, uploaded, failed: results.filter(r => r.status === 'failed').length },
  });

  res.json({ results, total: testCases.length, uploaded });
});

// ─── POST /generate-qtest-xlsx ────────────────────────────────────────────────
router.post('/generate-qtest-xlsx', async (req, res) => {
  const {
    workflow_id,
    module: mod = 'XOS_Platform.BCM',
    testplan_name,
    testarea = '5_Testcases',
  } = req.body;
  if (!workflow_id) return res.status(400).json({ error: 'workflow_id required' });

  const workflow = db.prepare('SELECT * FROM workflows WHERE id=?').get(workflow_id);
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

  const testCases = db.prepare(
    'SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number'
  ).all(workflow_id);

  const planDoc = db.prepare(
    "SELECT content FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1"
  ).get(workflow_id);

  // Derive TestPlan name from workflow title if not provided
  const planName = (testplan_name || workflow.title || 'Test_Plan')
    .replace(/[^a-zA-Z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  const sectionMap = parseSectionHeadings(planDoc?.content || '');

  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');

  sheet.columns = [
    { header: 'Project',          key: 'project',  width: 12 },
    { header: 'Test Suite Path',  key: 'path',     width: 90 },
    { header: 'Test Case Title',  key: 'title',    width: 65 },
    { header: 'Summary',          key: 'summary',  width: 65 },
    { header: 'Preconditions',    key: 'precond',  width: 30 },
    { header: 'Step Actions',     key: 'steps',    width: 65 },
    { header: 'Expected Results', key: 'expected', width: 55 },
    { header: 'Priority',         key: 'priority', width: 12 },
    { header: 'Keywords',         key: 'keywords', width: 22 },
  ];

  // Style header row — blue background, white bold text
  const hdr = sheet.getRow(1);
  hdr.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  hdr.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  hdr.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  hdr.height    = 22;

  for (const tc of testCases) {
    const secPrefix  = getTcSectionPrefix(tc.tc_number);
    const secLabel   = sectionMap[secPrefix] || `${secPrefix}_Test_Cases`;
    const suitePath  = `${mod}/${planName}/${testarea}/${secLabel}`;
    const tcTitle    = `${tc.tc_number} ${tc.title}`;
    const { steps, expected } = extractTcContent(planDoc?.content || '', tc.tc_number);
    const priority   = tc.classification === 'Manual' ? 'High'
                     : tc.classification === 'Semi-Automatable' ? 'Medium' : 'Low';

    const row = sheet.addRow({
      project: 'Firmware',
      path:    suitePath,
      title:   tcTitle,
      summary: tcTitle,
      precond: '',
      steps,
      expected,
      priority,
      keywords: tc.classification || '',
    });
    row.alignment = { wrapText: true, vertical: 'top' };
  }

  const filename = `qTest_${planName}_${workflow_id.slice(0, 8)}.xlsx`;
  const filepath = path.resolve(__dirname, '../../../uploads', filename);
  await workbook.xlsx.writeFile(filepath);

  logAuditTrail({
    workflow_id,
    stage_number: 9,
    action: `qTest XLSX generated: ${testCases.length} TCs exported`,
    action_type: 'generate_xlsx',
    details: { filename, total: testCases.length, planName, module: mod, testarea },
  });

  res.download(filepath, filename);
});

// ─── POST /generate-iso-docx ─────────────────────────────────────────────────
router.post('/generate-iso-docx', async (req, res) => {
  const {
    workflow_id,
    doc_type   = 'New',
    author     = '',
    reviewer   = '',
    approver   = '',
    base_doc_ref = '',
    version    = '1.0',
  } = req.body;

  if (!workflow_id) return res.status(400).json({ error: 'workflow_id required' });

  const workflow = db.prepare('SELECT * FROM workflows WHERE id=?').get(workflow_id);
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

  const testCases = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number').all(workflow_id);

  const planDoc = db.prepare(
    "SELECT content FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1"
  ).get(workflow_id);

  const sessions = db.prepare('SELECT * FROM execution_sessions WHERE workflow_id=? ORDER BY started_at').all(workflow_id);

  // Latest execution result per TC
  const execRows = db.prepare(`
    SELECT ter.*, tc.id AS test_case_id
    FROM tc_execution_results ter
    JOIN test_cases tc ON ter.tc_number = tc.tc_number AND tc.workflow_id = ter.workflow_id
    WHERE ter.workflow_id = ?
    ORDER BY ter.executed_at DESC
  `).all(workflow_id);

  const execMap = {};
  for (const r of execRows) {
    if (!execMap[r.test_case_id]) execMap[r.test_case_id] = r;
  }

  const hasResults = Object.keys(execMap).length > 0;

  // Build enriched TC list with extracted steps
  const tcDetails = testCases.map(tc => {
    const { steps, expected } = extractTcContent(planDoc?.content || '', tc.tc_number);
    const er = execMap[tc.id];
    return {
      id:             tc.id,
      tc_number:      tc.tc_number,
      title:          tc.title,
      classification: tc.classification,
      description:    tc.description,
      steps,
      expected,
      result:   er?.result   || '',
      platform: er?.platform || '',
      build:    er?.build    || '',
      notes:    er?.notes    || '',
    };
  });

  // Execution summary counts
  const passed  = Object.values(execMap).filter(r => r.result?.toUpperCase() === 'PASS').length;
  const failed  = Object.values(execMap).filter(r => r.result?.toUpperCase() === 'FAIL').length;
  const blocked = Object.values(execMap).filter(r => r.result?.toUpperCase() === 'BLOCKED').length;

  const summary = {
    total:     testCases.length,
    passed, failed, blocked,
    not_run:   Math.max(0, testCases.length - Object.keys(execMap).length),
    pass_rate: (passed + failed) > 0 ? Math.round((passed / (passed + failed)) * 100) : 0,
  };

  const safeStory = (workflow.jira_story_id || workflow_id.slice(0, 8)).replace(/[^a-zA-Z0-9_-]/g, '');
  const filename  = `TestPlan_ISO_${safeStory}_v${version}.docx`;
  const outputPath = path.resolve(__dirname, '../../../uploads', filename);

  const payload = {
    title:        workflow.title,
    jira_story:   workflow.jira_story_id || '',
    release:      workflow.jira_release  || '',
    story_type:   workflow.jira_story_type || 'Feature',
    doc_type,
    author, reviewer, approver, base_doc_ref, version,
    output_path:  outputPath,
    test_cases:   tcDetails,
    sessions,
    summary,
    has_results:  hasResults,
  };

  const { spawn } = require('child_process');
  const scriptPath = path.resolve(__dirname, '../scripts/generate_iso_docx.py');

  const python = spawn('python3', [scriptPath]);
  let stderr = '';
  python.stderr.on('data', d => { stderr += d.toString(); });
  python.stdin.write(JSON.stringify(payload));
  python.stdin.end();

  python.on('close', code => {
    if (code !== 0) {
      console.error('[generate-iso-docx] Python error:', stderr);
      return res.status(500).json({ error: 'DOCX generation failed', details: stderr.slice(0, 400) });
    }

    logAuditTrail({
      workflow_id,
      stage_number: 9,
      action: `ISO Test Plan DOCX generated (${doc_type}, v${version}, author: ${author || 'unset'})`,
      action_type: 'generate_iso_docx',
      details: { filename, doc_type, author, version, tc_count: testCases.length },
    });

    res.download(outputPath, filename, err => {
      if (err) console.error('[generate-iso-docx] download error:', err.message);
    });
  });
});

// ─── POST /generate-docx-template — fill reference_testplan.docx template ────
router.post('/generate-docx-template', async (req, res) => {
  const {
    workflow_id,
    author     = '',
    reviewer   = '',
    approver   = '',
    version    = '1.0',
  } = req.body;

  if (!workflow_id) return res.status(400).json({ error: 'workflow_id required' });

  const workflow = db.prepare('SELECT * FROM workflows WHERE id=?').get(workflow_id);
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

  const testCases = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number').all(workflow_id);

  const planDoc = db.prepare(
    "SELECT content FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1"
  ).get(workflow_id);

  // Build enriched TC list with extracted steps/expected
  const tcDetails = testCases.map(tc => {
    const { steps, expected } = extractTcContent(planDoc?.content || '', tc.tc_number);
    return {
      id:             tc.id,
      tc_number:      tc.tc_number,
      title:          tc.title,
      classification: tc.classification,
      description:    tc.description,
      steps,
      expected,
    };
  });

  const safeStory = (workflow.jira_story_id || workflow_id.slice(0, 8)).replace(/[^a-zA-Z0-9_-]/g, '');
  const filename  = `TestPlan_Template_${safeStory}_v${version}.docx`;
  const outputPath = path.resolve(__dirname, '../../../uploads', filename);
  const templatePath = path.resolve(__dirname, '../../../templates/reference_testplan.docx');

  if (!require('fs').existsSync(templatePath)) {
    return res.status(500).json({ error: 'Reference template not found on server', path: templatePath });
  }

  const payload = {
    title:         workflow.title,
    jira_story:    workflow.jira_story_id || '',
    release:       workflow.jira_release  || '',
    story_type:    workflow.jira_story_type || 'Feature',
    author, reviewer, approver, version,
    output_path:   outputPath,
    template_path: templatePath,
    test_cases:    tcDetails,
  };

  const { spawn } = require('child_process');
  const scriptPath = path.resolve(__dirname, '../scripts/fill_template_docx.py');
  const python = spawn('python3', [scriptPath]);
  let stderr = '';
  python.stderr.on('data', d => { stderr += d.toString(); });
  python.stdin.write(JSON.stringify(payload));
  python.stdin.end();

  python.on('close', code => {
    if (code !== 0) {
      console.error('[generate-docx-template] Python error:', stderr);
      return res.status(500).json({ error: 'Template fill failed', details: stderr.slice(0, 400) });
    }

    logAuditTrail({
      workflow_id,
      stage_number: 9,
      action: `Reference template DOCX generated (v${version}, author: ${author || 'unset'})`,
      action_type: 'generate_docx_template',
      details: { filename, author, version, tc_count: testCases.length },
    });

    res.download(outputPath, filename, err => {
      if (err) console.error('[generate-docx-template] download error:', err.message);
    });
  });
});

// ─── GET /:workflow_id — comprehensive workflow summary ──────────────────────
router.get('/:workflow_id', (req, res) => {
  const { workflow_id } = req.params;
  const workflow = db.prepare('SELECT * FROM workflows WHERE id=?').get(workflow_id);
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

  const testCases = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number').all(workflow_id);

  // Latest execution result per TC (Stage 8 results)
  const allExecResults = db.prepare(`
    SELECT ter.*, tc.id AS test_case_id, tc.title, tc.classification
    FROM tc_execution_results ter
    JOIN test_cases tc ON ter.tc_number = tc.tc_number AND tc.workflow_id = ter.workflow_id
    WHERE ter.workflow_id = ?
    ORDER BY ter.executed_at DESC
  `).all(workflow_id);

  const latestByTc = {};
  for (const r of allExecResults) {
    if (!latestByTc[r.test_case_id]) latestByTc[r.test_case_id] = r;
  }
  const executionResults = Object.values(latestByTc);

  // Execution sessions
  const sessions = db.prepare('SELECT * FROM execution_sessions WHERE workflow_id=? ORDER BY started_at DESC').all(workflow_id);

  // Stage statuses
  const stages = db.prepare('SELECT * FROM stages WHERE workflow_id=? ORDER BY stage_number').all(workflow_id);

  // Approvals across all stages
  const approvals = db.prepare(`
    SELECT a.*, u.name AS user_name
    FROM approvals a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.workflow_id = ?
    ORDER BY a.created_at
  `).all(workflow_id);

  // Documents
  const allDocs = db.prepare('SELECT * FROM documents WHERE workflow_id=? ORDER BY created_at DESC').all(workflow_id);
  const testPlanDoc = allDocs.find(d => d.stage_number === 3 && d.doc_type === 'test_plan');
  const isoDoc = allDocs.find(d => d.stage_number === 5 && d.doc_type === 'iso_testplan');
  const finalReport = allDocs.find(d => d.doc_type === 'final_execution_report');

  // Classification
  const manual = testCases.filter(tc => tc.classification === 'Manual');
  const semi = testCases.filter(tc => tc.classification === 'Semi-Automatable');
  const auto = testCases.filter(tc => tc.classification === 'Automatable');

  // Execution stats (handle both upper and lower case result values)
  const passed = executionResults.filter(r => r.result?.toUpperCase() === 'PASS').length;
  const failed = executionResults.filter(r => r.result?.toUpperCase() === 'FAIL').length;
  const blocked = executionResults.filter(r => r.result?.toUpperCase() === 'BLOCKED').length;
  const skipped = executionResults.filter(r => ['SKIP','SKIPPED'].includes(r.result?.toUpperCase())).length;
  const notRun = Math.max(0, testCases.length - executionResults.length);

  res.json({
    workflow,
    stages,
    summary: {
      total: testCases.length,
      passed, failed, blocked, skipped,
      not_run: notRun,
      pass_rate: (passed + failed) > 0 ? Math.round((passed / (passed + failed)) * 100) : 0,
      manual_count: manual.length,
      semi_count: semi.length,
      auto_count: auto.length,
    },
    test_cases: testCases,
    execution_results: executionResults,
    sessions,
    approvals,
    documents: {
      test_plan: testPlanDoc ? { filename: testPlanDoc.filename, version: testPlanDoc.version } : null,
      iso_doc: isoDoc ? { filename: isoDoc.filename } : null,
      final_report: finalReport ? { filename: finalReport.filename } : null,
    },
    qtest: {
      base_url: QTEST_BASE || null,
      configured: !!(QTEST_BASE && QTEST_TOKEN),
    },
  });
});

// POST /:workflow_id/complete
router.post('/:workflow_id/complete', (req, res) => {
  const { workflow_id } = req.params;
  const { user_id, user_name } = req.body || {};
  db.prepare(`UPDATE workflows SET status='completed', updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(workflow_id);
  db.prepare(`UPDATE stages SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE workflow_id=? AND stage_number=9`).run(workflow_id);
  logAuditTrail({
    workflow_id,
    stage_number: 9,
    action: `Workflow completed by ${user_name || user_id || 'system'}`,
    action_type: 'complete',
    user_id: user_id || null,
    user_name: user_name || null,
  });
  res.json({ success: true, message: 'Workflow completed successfully!' });
});

module.exports = router;
