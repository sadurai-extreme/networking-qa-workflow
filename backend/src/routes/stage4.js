const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { logAuditTrail } = require('../utils/auditLogger');
const { callLLM } = require('../services/llm');

const TCL_DOCS_DIR = path.resolve(__dirname, '../../../data/tcl_framework_docs');
const { buildProcContext, getIndexMeta } = require('../utils/tclIndex');

// Areas already covered by detailed static docs — skip index listing for these
const STATIC_AREAS = new Set(['CLI', 'Traffic', 'SNMP']);

function loadStaticDocs() {
  const docs = {};
  if (!fs.existsSync(TCL_DOCS_DIR)) return docs;
  for (const file of fs.readdirSync(TCL_DOCS_DIR)) {
    if (file === 'automation_index.json') continue; // skip the index itself
    const content = fs.readFileSync(path.join(TCL_DOCS_DIR, file), 'utf8');
    if (file.includes('CLI_Syntax'))    docs.cli      = content.substring(0, 2500);
    if (file.includes('Switch_Events')) docs.events   = content.substring(0, 2500);
    if (file.includes('Traffic'))       docs.traffic  = content.substring(0, 2000);
    if (file.includes('Topology'))      docs.topology = content.substring(0, 1500);
    if (file.includes('SNMP'))          docs.snmp     = content.substring(0, 4000);
  }
  return docs;
}

/**
 * Build additional proc context from the index for any feature areas
 * detected in the test plan text that are NOT already in the static docs.
 */
function buildIndexSection(testPlanText) {
  const meta = getIndexMeta();
  if (!meta.loaded) return '';

  const detectedAreas = Object.keys(meta.areas).filter(
    area => !STATIC_AREAS.has(area) && new RegExp(`\\b${area}\\b`, 'i').test(testPlanText)
  );
  if (detectedAreas.length === 0) return '';

  const lines = [];
  for (const area of detectedAreas) {
    const procs = buildProcContext(area, 20);
    if (procs) {
      lines.push(`### ${area} Library (auto-indexed from automation repo)`);
      lines.push('Available procedures:');
      lines.push('```tcl');
      lines.push(procs);
      lines.push('```');
    }
  }
  return lines.length ? `\n${lines.join('\n')}` : '';
}

// Classify test cases
router.post('/classify', async (req, res) => {
  const { workflow_id } = req.body;
  const testPlanDoc = db.prepare(`SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1`).get(workflow_id);
  if (!testPlanDoc) return res.status(400).json({ error: 'Test plan not found.' });

  const tclDocs = loadStaticDocs();
  const hasDocs = Object.keys(tclDocs).length > 0;
  const indexSection = buildIndexSection(testPlanDoc.content);

  const frameworkSection = hasDocs ? `
## EXOS TCL Automation Framework Capabilities

Use the following framework reference to determine if each test case CAN be automated:

### CLI Automation (SendCliCommand, CheckCliOutput)
${tclDocs.cli || ''}

### Switch Events (CheckReboot, RestartProcess, MSM Failover)
${tclDocs.events || ''}

### SNMP Library (snmpget_authNoPriv, snmpget_authPriv, SnmpCheckKeyValue_snmp, snmpHandleTraps_NoErr)
${tclDocs.snmp || ''}

### Traffic Generation (SendFrame, IXIA procedures)
${tclDocs.traffic || ''}

### Topology Reference
${tclDocs.topology || ''}${indexSection}

## Classification Rules (based on the framework above)
- **Automatable**: ALL steps can be executed using the framework procedures above — CLI config, show commands, reboot/failover, SNMP GET/walk/trap, config save/restore, traffic send/verify, no human action needed
- **Semi-Automatable**: Mostly scriptable but requires human setup at specific points (e.g., NETCONF/YANG client not available in framework, EWX/XML provisioning requiring external tool, physical IXIA cable connections, or reading a physical display)
- **Manual**: Requires physical human action that cannot be scripted: cable pull, PSU/FAN swap, console-only access, button press, or visual hardware inspection
` : `
## Classification Rules
- **Automatable**: All steps are CLI-driven with no human intervention
- **Semi-Automatable**: Mostly scriptable but needs minimal human checkpoint
- **Manual**: Requires physical hardware interaction
`;

  const systemPrompt = `You are a TCL test automation expert for Extreme Networks EXOS NOS testing.
Classify each test case from the test plan into exactly one of three categories:
1. "Manual"
2. "Semi-Automatable"
3. "Automatable"
${frameworkSection}
Return ONLY a JSON array (no markdown, no explanation):
[{"tc_number":"5.1.1","title":"...","classification":"Automatable","reason":"Uses SendCliCommand for configure/show steps; CheckReboot for persistence; fully covered by framework"}]`;

  const userPrompt = `Classify every test case in this test plan:\n\n${testPlanDoc.content}`;

  try {
    const result = await callLLM(systemPrompt, userPrompt, false);
    let testCases;
    try {
      testCases = JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to parse classification response' });
    }

    // Deduplicate by tc_number (LLM may return duplicates)
    const seen = new Set();
    const uniqueCases = testCases.filter(tc => {
      if (seen.has(tc.tc_number)) return false;
      seen.add(tc.tc_number);
      return true;
    });

    const insert = db.prepare(`INSERT INTO test_cases (id, workflow_id, tc_number, title, classification) VALUES (?, ?, ?, ?, ?)`);
    db.transaction(() => {
      db.prepare(`DELETE FROM test_cases WHERE workflow_id=?`).run(workflow_id);
      uniqueCases.forEach(tc => insert.run(uuidv4(), workflow_id, tc.tc_number, tc.title, tc.classification));
    })();

    const meta = getIndexMeta();
    console.log(`Classified ${uniqueCases.length} TCs for workflow ${workflow_id} | static docs: ${hasDocs} | index: ${meta.loaded ? meta.total_procs + ' procs' : 'not loaded'}`);
    res.json(uniqueCases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Override classification manually
router.put('/override', (req, res) => {
  const { workflow_id, tc_number, classification, user_id, user_name } = req.body;
  const prev = db.prepare('SELECT classification FROM test_cases WHERE workflow_id=? AND tc_number=?').get(workflow_id, tc_number);
  db.prepare(`UPDATE test_cases SET classification=? WHERE workflow_id=? AND tc_number=?`).run(classification, workflow_id, tc_number);
  logAuditTrail({
    workflow_id,
    stage_number: 4,
    action: `TC ${tc_number} classification overridden: ${prev?.classification} → ${classification}`,
    action_type: 'override',
    user_id: user_id || null,
    user_name: user_name || null,
    details: { tc_number, from: prev?.classification, to: classification },
  });
  res.json({ success: true });
});

// Approve classification
router.post('/approve', (req, res) => {
  const { workflow_id, user_id } = req.body;
  const usr = db.prepare('SELECT name FROM users WHERE id=?').get(user_id);
  db.prepare(`INSERT INTO approvals (id, workflow_id, stage_number, user_id, action) VALUES (?, ?, 4, ?, 'approved')`)
    .run(uuidv4(), workflow_id, user_id);
  db.prepare(`UPDATE stages SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE workflow_id=? AND stage_number=4`).run(workflow_id);
  logAuditTrail({
    workflow_id,
    stage_number: 4,
    action: `TC classification approved by ${usr?.name || user_id}`,
    action_type: 'approve',
    user_id,
    user_name: usr?.name || null,
  });
  res.json({ success: true });
});

// Get classifications
router.get('/:workflow_id', (req, res) => {
  const cases = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number').all(req.params.workflow_id);
  const summary = {
    total: cases.length,
    manual: cases.filter(c => c.classification === 'Manual').length,
    semi: cases.filter(c => c.classification === 'Semi-Automatable').length,
    auto: cases.filter(c => c.classification === 'Automatable').length,
  };
  res.json({ cases, summary });
});

// ── Stage 4 Chat — AI advisor that can fix TCs and re-classify them ───────────
// POST /api/stage4/chat
// Body: { workflow_id, message, history: [{role, content}] }
// Returns: { reply, action_taken, updated_case? }
router.post('/chat', async (req, res) => {
  const { workflow_id, message, history = [] } = req.body;
  if (!workflow_id || !message) return res.status(400).json({ error: 'workflow_id and message required' });

  // Load current TC list + test plan
  const cases = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? ORDER BY tc_number').all(workflow_id);
  const testPlanDoc = db.prepare(
    `SELECT content FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1`
  ).get(workflow_id);

  const tcList = cases.map(c =>
    `  ${c.tc_number}: ${c.title}  →  [${c.classification}]`
  ).join('\n');

  const systemPrompt = `You are a TCL test automation advisor for Extreme Networks EXOS NOS.
The user is reviewing the TC classification results and may want to make specific TCs automatable.

## Current Test Cases and Classifications:
${tcList}

## What CAN be automated (TCL framework):
- CLI config/show via SendCliCommand, CheckCliOutput
- SNMP GET/walk via snmpget_authNoPriv, snmpget_authPriv, SnmpCheckKeyValue_snmp
- SNMP traps via snmpHandleTraps_NoErr
- Switch reboot/failover via CheckReboot, RestartProcess
- Traffic via SendFrame (IXIA)
- File ops: config save/restore via CLI

## What CANNOT be automated (no framework support):
- NETCONF / YANG / RESTCONF operations
- EWX / XML provisioning
- Physical cable pull / PSU swap / button press
- External TFTP server setup (but CLI-based 'tftp get' IS automatable)

## Your job:
1. Explain WHY a TC is Semi-Automatable or Manual when asked
2. Suggest specific test step changes that would make it Automatable
3. When the user agrees, respond with a structured action to fix and reclassify the TC

## CRITICAL — Action format:
If you decide to fix a TC, end your reply with this EXACT block (no extra whitespace):
<<<ACTION>>>
tc_number: <e.g. 5.3.7>
issue_type: incorrect_steps
description: <precise instruction for what to change in the test steps>
<<<END>>>

Only include the ACTION block if you are actually executing a fix. Do NOT include it for questions, explanations, or proposals.`;

  const historyText = history
    .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
    .join('\n\n');
  const userPrompt = historyText
    ? `${historyText}\n\nUser: ${message}`
    : message;

  let rawReply;
  try {
    rawReply = await callLLM(systemPrompt, userPrompt, false);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  // Parse optional ACTION block
  const actionMatch = rawReply.match(/<<<ACTION>>>\s*\ntc_number:\s*(.+?)\nissue_type:\s*(.+?)\ndescription:\s*([\s\S]+?)\n<<<END>>>/);
  const reply = rawReply.replace(/<<<ACTION>>>[\s\S]*?<<<END>>>/g, '').trim();

  if (!actionMatch) {
    return res.json({ reply, action_taken: false });
  }

  // Execute the fix
  const tc_number   = actionMatch[1].trim();
  const issue_type  = actionMatch[2].trim();
  const description = actionMatch[3].trim();

  if (!testPlanDoc) {
    return res.json({ reply: reply + '\n\n⚠️ Cannot fix: test plan not found.', action_taken: false });
  }

  // ── Inline extractTcBlock (mirrors stage3.js helper) ─────────────────────
  function extractTcBlock(fullPlan, tcNum) {
    const esc = tcNum.replace(/\./g, '\\.');
    const startRe = new RegExp(`(^|\\n)(#{1,4}\\s*(?:Test Case\\s*)?${esc}[^\\n]*)`, 'i');
    const m = startRe.exec(fullPlan);
    if (!m) return null;
    const tcStart = m.index + (m[1] ? 1 : 0);
    const level = (m[2].match(/^#+/) || [''])[0].length || 3;
    const nextRe = new RegExp(`\\n#{1,${level}}\\s+(?!${esc}[^\\d])`, 'i');
    const after = fullPlan.slice(tcStart + 1);
    const nxt = nextRe.exec(after);
    const tcEnd = nxt ? tcStart + 1 + nxt.index : fullPlan.length;
    return { block: fullPlan.slice(tcStart, tcEnd).trim(), tcStart, tcEnd };
  }

  const extracted = extractTcBlock(testPlanDoc.content, tc_number);
  if (!extracted) {
    return res.json({ reply: reply + `\n\n⚠️ Could not find TC ${tc_number} in the test plan.`, action_taken: false });
  }

  // Fix via LLM
  const fixSystemPrompt = `You are a networking QA test plan expert. Fix ONLY the given test case based on the reported issue. Keep the same TC number and title. Return ONLY the corrected markdown block.`;
  const fixUserPrompt = `Issue: ${description}\n\nOriginal:\n${extracted.block}\n\nReturn the corrected version only.`;

  let newBlock;
  try {
    const fixed = await callLLM(fixSystemPrompt, fixUserPrompt, false);
    newBlock = fixed.replace(/```(?:markdown)?\n?|\n?```/g, '').trim();
  } catch (err) {
    return res.json({ reply: reply + `\n\n⚠️ LLM fix failed: ${err.message}`, action_taken: false });
  }

  // Save updated plan
  const planDoc = db.prepare(
    `SELECT * FROM documents WHERE workflow_id=? AND stage_number=3 AND doc_type='test_plan' ORDER BY created_at DESC LIMIT 1`
  ).get(workflow_id);
  const updatedPlan = testPlanDoc.content.slice(0, extracted.tcStart) + newBlock + '\n\n' + testPlanDoc.content.slice(extracted.tcEnd);
  db.prepare(`UPDATE documents SET content=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(updatedPlan, planDoc.id);

  // Reclassify just this TC
  const tclDocs = loadStaticDocs();
  const frameworkCtx = `
Available TCL procedures:
- SendCliCommand, CheckCliOutput (CLI)
- snmpget_authNoPriv, snmpget_authPriv, SnmpCheckKeyValue_snmp, snmpHandleTraps_NoErr (SNMP)
- CheckReboot, RestartProcess (Switch Events)
- SendFrame (Traffic/IXIA)
NOT available: NETCONF, EWX/XML, RESTCONF
`;
  const reClassifyPrompt = `You are a TCL automation classifier. Classify this single test case.
${frameworkCtx}
Rules:
- Automatable: ALL steps use available procedures, no human action
- Semi-Automatable: mostly scriptable but has one required human step or unsupported protocol
- Manual: requires physical human action

Return ONLY JSON: {"tc_number":"...","title":"...","classification":"Automatable|Semi-Automatable|Manual","reason":"..."}`;

  let newClassification = null;
  try {
    const clResult = await callLLM(reClassifyPrompt, `Classify this test case:\n\n${newBlock}`, false);
    const parsed = JSON.parse(clResult.replace(/```json\n?|\n?```/g, '').trim());
    newClassification = parsed.classification;

    // Update DB
    db.prepare(`UPDATE test_cases SET classification=? WHERE workflow_id=? AND tc_number=?`)
      .run(newClassification, workflow_id, tc_number);

    console.log(`[chat] Fixed & reclassified TC ${tc_number} → ${newClassification}`);
  } catch {
    // Classification parse failed — keep old classification
  }

  // Return updated full case list
  const updatedCase = db.prepare('SELECT * FROM test_cases WHERE workflow_id=? AND tc_number=?').get(workflow_id, tc_number);

  res.json({
    reply,
    action_taken: true,
    fixed_tc: tc_number,
    new_classification: newClassification,
    updated_case: updatedCase,
  });
});

module.exports = router;
