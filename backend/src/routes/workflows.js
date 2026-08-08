const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { logAuditTrail, getAuditTrail } = require('../utils/auditLogger');

// Get workflows — admin sees all, user sees only their own
router.get('/', authenticate, (req, res) => {
  console.log('=== GET /workflows ===');
  console.log('User:', req.user.name, '| Role:', req.user.role);
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare('SELECT w.*, u.name as created_by_name FROM workflows w LEFT JOIN users u ON w.created_by=u.id ORDER BY w.created_at DESC').all();
  } else {
    rows = db.prepare('SELECT w.*, u.name as created_by_name FROM workflows w LEFT JOIN users u ON w.created_by=u.id WHERE w.created_by=? ORDER BY w.created_at DESC').all(req.user.id);
  }
  console.log('Returning', rows.length, 'workflows');
  res.json(rows);
});

// Get single workflow with stages
router.get('/:id', authenticate, (req, res) => {
  const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
  // User can only access their own workflow
  if (req.user.role !== 'admin' && workflow.created_by !== req.user.id)
    return res.status(403).json({ error: 'Access denied' });
  const stages = db.prepare('SELECT * FROM stages WHERE workflow_id = ? ORDER BY stage_number').all(req.params.id);
  res.json({ ...workflow, stages });
});

// Create new workflow
router.post('/', authenticate, (req, res) => {
  console.log('=== POST /workflows - Creating new workflow ===');
  console.log('Request body:', req.body);
  console.log('User:', req.user);
  
  try {
    const { title, release, storyId, description, type, status, priority } = req.body;
    const created_by = req.user.id; // always use logged-in user
    const id = uuidv4();
    
    // If storyId is provided, workflow starts at Stage 2 (Skill File Generation)
    // Stage 1 (Jira Story Selection) is skipped since story is already selected
    const startStage = storyId ? 2 : 1;
    
    console.log('Creating workflow:', { id, title, release, storyId, description, type, created_by, startStage });
    
    db.prepare(`INSERT INTO workflows (id, title, jira_release, jira_story_id, jira_story_description, jira_story_type, jira_story_status, jira_story_priority, current_stage, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, title, release || null, storyId || null, description || null, type || 'Feature', status || null, priority || null, startStage, created_by);

    // Create all 9 stage records
    const stageNames = [
      'Jira Story Selection', 'Skill File Generation', 'Test Plan Generation',
      'Test Case Classification', 'ISO Formatting', 'qTest Upload',
      'TCL Script Generation', 'Regression Execution', 'Final Report'
    ];
    const insertStage = db.prepare(`INSERT INTO stages (workflow_id, stage_number, stage_name, status, completed_at) VALUES (?, ?, ?, ?, ?)`);
    stageNames.forEach((name, i) => {
      const stageNum = i + 1;
      // If storyId provided, mark Stage 1 as completed
      const stageStatus = (stageNum === 1 && storyId) ? 'completed' : null;
      const completedAt = (stageNum === 1 && storyId) ? new Date().toISOString() : null;
      insertStage.run(id, stageNum, name, stageStatus, completedAt);
    });

    const response = { id, title, current_stage: startStage, jira_release: release, jira_story_id: storyId };
    console.log('Workflow created successfully:', response);
    res.json(response);
  } catch (err) {
    console.error('=== ERROR creating workflow ===');
    console.error(err);
    res.status(500).json({ error: 'Failed to create workflow: ' + err.message });
  }
});

// Advance to next stage
router.post('/:id/advance', (req, res) => {
  const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
  if (!workflow) return res.status(404).json({ error: 'Not found' });

  // Stage order skips obsolete stages 5 (ISO) and 6 (qTest)
  const NEXT_STAGE = { 1: 2, 2: 3, 3: 4, 4: 7, 5: 7, 6: 7, 7: 8, 8: 9 };
  const nextStage = NEXT_STAGE[workflow.current_stage] || (workflow.current_stage + 1);
  if (nextStage > 9) return res.status(400).json({ error: 'Already at final stage' });

  db.prepare(`UPDATE workflows SET current_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(nextStage, req.params.id);
  db.prepare(`UPDATE stages SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE workflow_id = ? AND stage_number = ?`).run(req.params.id, workflow.current_stage);
  db.prepare(`UPDATE stages SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE workflow_id = ? AND stage_number = ?`).run(req.params.id, nextStage);

  res.json({ current_stage: nextStage });
});

// Complete workflow
router.post('/:id/complete', (req, res) => {
  db.prepare(`UPDATE workflows SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
  db.prepare(`UPDATE stages SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE workflow_id = ? AND stage_number = 9`).run(req.params.id);
  res.json({ status: 'completed' });
});

// Delete a single workflow (admin only or own workflow)
router.delete('/:id', authenticate, (req, res) => {
  try {
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    
    // Check permissions: admin can delete any, user can delete only their own
    if (req.user.role !== 'admin' && workflow.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete all related data first (respecting foreign key constraints)
    // Order matters: delete children before parents
    
    // 1. Delete regression results (references regression_runs)
    const regressionRuns = db.prepare('SELECT id FROM regression_runs WHERE workflow_id = ?').all(req.params.id);
    if (regressionRuns.length > 0) {
      const runIds = regressionRuns.map(r => r.id);
      const placeholders = runIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM regression_results WHERE run_id IN (${placeholders})`).run(...runIds);
    }
    
    // 2. Delete TCL scripts (references test_cases)
    const testCases = db.prepare('SELECT id FROM test_cases WHERE workflow_id = ?').all(req.params.id);
    if (testCases.length > 0) {
      const tcIds = testCases.map(tc => tc.id);
      const placeholders = tcIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM tcl_scripts WHERE test_case_id IN (${placeholders})`).run(...tcIds);
    }
    
    // 3. Delete chat assistant data (chat_files -> chat_messages -> chat_sessions)
    const chatSessions = db.prepare('SELECT id FROM chat_sessions WHERE workflow_id = ?').all(req.params.id);
    if (chatSessions.length > 0) {
      const sessionIds = chatSessions.map(s => s.id);
      const placeholders = sessionIds.map(() => '?').join(',');
      // Delete chat files first
      db.prepare(`DELETE FROM chat_files WHERE session_id IN (${placeholders})`).run(...sessionIds);
      // Delete chat messages
      db.prepare(`DELETE FROM chat_messages WHERE session_id IN (${placeholders})`).run(...sessionIds);
    }
    db.prepare('DELETE FROM chat_sessions WHERE workflow_id = ?').run(req.params.id);
    
    // 4. Delete workflow-level tables
    db.prepare('DELETE FROM regression_runs WHERE workflow_id = ?').run(req.params.id);
    db.prepare('DELETE FROM test_cases WHERE workflow_id = ?').run(req.params.id);
    db.prepare('DELETE FROM review_assignments WHERE workflow_id = ?').run(req.params.id);
    
    // 4.1 Delete version control tables
    try {
      db.prepare('DELETE FROM document_versions WHERE workflow_id = ?').run(req.params.id);
    } catch (e) {
      // Table might not exist
    }
    try {
      db.prepare('DELETE FROM document_changes WHERE workflow_id = ?').run(req.params.id);
    } catch (e) {
      // Table might not exist
    }
    try {
      db.prepare('DELETE FROM document_relationships WHERE workflow_id = ?').run(req.params.id);
    } catch (e) {
      // Table might not exist
    }
    try {
      db.prepare('DELETE FROM version_annotations WHERE workflow_id = ?').run(req.params.id);
    } catch (e) {
      // Table might not exist
    }
    
    // 4.2 Delete quality control tables (NEW - from Phase 1)
    // Get all document IDs for this workflow first
    const workflowDocs = db.prepare('SELECT id FROM documents WHERE workflow_id = ?').all(req.params.id);
    if (workflowDocs.length > 0) {
      const docIds = workflowDocs.map(d => d.id);
      const placeholders = docIds.map(() => '?').join(',');
      // Delete from new quality control tables
      try {
        db.prepare(`DELETE FROM document_revisions WHERE document_id IN (${placeholders})`).run(...docIds);
        db.prepare(`DELETE FROM document_validations WHERE document_id IN (${placeholders})`).run(...docIds);
        db.prepare(`DELETE FROM document_normalizations WHERE document_id IN (${placeholders})`).run(...docIds);
        db.prepare(`DELETE FROM document_approvals WHERE document_id IN (${placeholders})`).run(...docIds);
      } catch (e) {
        // Tables might not exist in older DBs
        console.log('Note: Quality control tables not found (expected in older databases)');
      }
    }
    
    db.prepare('DELETE FROM documents WHERE workflow_id = ?').run(req.params.id);
    db.prepare('DELETE FROM approvals WHERE workflow_id = ?').run(req.params.id);
    db.prepare('DELETE FROM stages WHERE workflow_id = ?').run(req.params.id);
    
    // 4.2 Delete audit_log entries for this workflow
    try {
      db.prepare('DELETE FROM audit_log WHERE entity_type = ? AND entity_id = ?').run('workflow', req.params.id);
    } catch (e) {
      // Table might not exist in older DBs
    }
    
    // 4.3 Delete skill_evaluations and audit_trail (if they exist)
    try {
      db.prepare('DELETE FROM skill_evaluations WHERE workflow_id = ?').run(req.params.id);
    } catch (e) {
      // Table might not exist in older DBs
    }
    try {
      db.prepare('DELETE FROM audit_trail WHERE workflow_id = ?').run(req.params.id);
    } catch (e) {
      // Table might not exist in older DBs
    }
    
    // 5. Finally delete the workflow itself
    db.prepare('DELETE FROM workflows WHERE id = ?').run(req.params.id);

    res.json({ message: 'Workflow deleted successfully', id: req.params.id });
  } catch (err) {
    console.error('Error deleting workflow:', err);
    res.status(500).json({ error: 'Failed to delete workflow: ' + err.message });
  }
});

// Bulk delete all active workflows (admin only)
router.post('/bulk/delete-active', authenticate, requireAdmin, (req, res) => {
  console.log('=== Bulk Delete All Active Workflows ===');
  try {
    // Get all active workflow IDs
    const activeWorkflows = db.prepare('SELECT id FROM workflows WHERE status = ?').all('active');
    const workflowIds = activeWorkflows.map(w => w.id);
    console.log(`Found ${workflowIds.length} active workflows to delete`);

    if (workflowIds.length === 0) {
      return res.json({ message: 'No active workflows to delete', count: 0 });
    }

    const placeholders = workflowIds.map(() => '?').join(',');
    
    // Use transaction for atomic operation
    const deleteTransaction = db.transaction((ids) => {
      console.log('Starting transaction...');
      
      // 1. Delete regression results (references regression_runs)
      const regressionRuns = db.prepare(`SELECT id FROM regression_runs WHERE workflow_id IN (${placeholders})`).all(...ids);
      console.log(`Deleting ${regressionRuns.length} regression runs...`);
      if (regressionRuns.length > 0) {
        const runIds = regressionRuns.map(r => r.id);
        const runPlaceholders = runIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM regression_results WHERE run_id IN (${runPlaceholders})`).run(...runIds);
      }
      
      // 2. Delete TCL scripts (references test_cases)
      const testCases = db.prepare(`SELECT id FROM test_cases WHERE workflow_id IN (${placeholders})`).all(...ids);
      console.log(`Deleting TCL scripts for ${testCases.length} test cases...`);
      if (testCases.length > 0) {
        const tcIds = testCases.map(tc => tc.id);
        const tcPlaceholders = tcIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM tcl_scripts WHERE test_case_id IN (${tcPlaceholders})`).run(...tcIds);
      }
      
      // 3. Delete chat assistant data (chat_files -> chat_messages -> chat_sessions)
      console.log('Deleting chat sessions and messages...');
      const chatSessions = db.prepare(`SELECT id FROM chat_sessions WHERE workflow_id IN (${placeholders})`).all(...ids);
      if (chatSessions.length > 0) {
        const sessionIds = chatSessions.map(s => s.id);
        const sessionPlaceholders = sessionIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM chat_files WHERE session_id IN (${sessionPlaceholders})`).run(...sessionIds);
        db.prepare(`DELETE FROM chat_messages WHERE session_id IN (${sessionPlaceholders})`).run(...sessionIds);
      }
      db.prepare(`DELETE FROM chat_sessions WHERE workflow_id IN (${placeholders})`).run(...ids);
      
      // 4. Delete workflow-level tables
      console.log('Deleting workflow-level tables...');
      db.prepare(`DELETE FROM regression_runs WHERE workflow_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM test_cases WHERE workflow_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM review_assignments WHERE workflow_id IN (${placeholders})`).run(...ids);
      
      // 4.1 Delete version control tables
      try {
        console.log('Deleting version control records...');
        db.prepare(`DELETE FROM document_versions WHERE workflow_id IN (${placeholders})`).run(...ids);
        db.prepare(`DELETE FROM document_changes WHERE workflow_id IN (${placeholders})`).run(...ids);
        db.prepare(`DELETE FROM document_relationships WHERE workflow_id IN (${placeholders})`).run(...ids);
        db.prepare(`DELETE FROM version_annotations WHERE workflow_id IN (${placeholders})`).run(...ids);
      } catch (vcErr) {
        console.warn('Version control tables delete warning:', vcErr.message);
      }
      
      // 4.2 Delete quality control tables (NEW - from Phase 1)
      console.log('Deleting quality control records...');
      const workflowDocs = db.prepare(`SELECT id FROM documents WHERE workflow_id IN (${placeholders})`).all(...ids);
      if (workflowDocs.length > 0) {
        const docIds = workflowDocs.map(d => d.id);
        const docPlaceholders = docIds.map(() => '?').join(',');
        try {
          db.prepare(`DELETE FROM document_revisions WHERE document_id IN (${docPlaceholders})`).run(...docIds);
          db.prepare(`DELETE FROM document_validations WHERE document_id IN (${docPlaceholders})`).run(...docIds);
          db.prepare(`DELETE FROM document_normalizations WHERE document_id IN (${docPlaceholders})`).run(...docIds);
          db.prepare(`DELETE FROM document_approvals WHERE document_id IN (${docPlaceholders})`).run(...docIds);
        } catch (qcErr) {
          console.warn('Quality control tables delete warning:', qcErr.message);
        }
      }
      
      db.prepare(`DELETE FROM documents WHERE workflow_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM approvals WHERE workflow_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM stages WHERE workflow_id IN (${placeholders})`).run(...ids);
      
      // 4.2 Delete audit_log entries
      try {
        console.log('Deleting audit log entries...');
        db.prepare(`DELETE FROM audit_log WHERE entity_type = 'workflow' AND entity_id IN (${placeholders})`).run(...ids);
      } catch (auditLogErr) {
        console.warn('Audit log delete warning:', auditLogErr.message);
      }
      
      // 4.3 Delete skill_evaluations (if table exists)
      try {
        console.log('Deleting skill evaluations...');
        db.prepare(`DELETE FROM skill_evaluations WHERE workflow_id IN (${placeholders})`).run(...ids);
      } catch (skillErr) {
        console.warn('Skill evaluations delete warning:', skillErr.message);
      }
      
      // 4.4 Delete audit trail entries
      try {
        console.log('Deleting audit trail entries...');
        db.prepare(`DELETE FROM audit_trail WHERE workflow_id IN (${placeholders})`).run(...ids);
      } catch (auditErr) {
        console.warn('Audit trail delete warning:', auditErr.message);
      }
      
      // 5. Finally delete all active workflows
      console.log('Deleting workflows...');
      db.prepare('DELETE FROM workflows WHERE status = ?').run('active');
      console.log('✓ All deletions complete');
    });

    // Execute transaction
    deleteTransaction(workflowIds);
    console.log(`✓ Successfully deleted ${workflowIds.length} active workflows`);

    res.json({ message: `Deleted ${workflowIds.length} active workflows`, count: workflowIds.length });
  } catch (err) {
    console.error('=== Error deleting active workflows ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Failed to delete active workflows: ' + err.message });
  }
});

// Delete individual workflow (admin or owner)
router.delete('/:workflow_id', authenticate, async (req, res) => {
  console.log('=== Delete Individual Workflow ===');
  try {
    const { workflow_id } = req.params;
    const user = req.user;

    // Check if workflow exists
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflow_id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Check permissions (admin or owner)
    if (user.role !== 'admin' && workflow.created_by !== user.id) {
      return res.status(403).json({ error: 'Unauthorized: You can only delete your own workflows' });
    }

    console.log(`Deleting workflow: ${workflow_id} (${workflow.title})`);

    // Use transaction for atomic operation
    const deleteTransaction = db.transaction((id) => {
      // 1. Delete regression results (references regression_runs)
      const regressionRuns = db.prepare('SELECT id FROM regression_runs WHERE workflow_id = ?').all(id);
      if (regressionRuns.length > 0) {
        const runIds = regressionRuns.map(r => r.id);
        const runPlaceholders = runIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM regression_results WHERE run_id IN (${runPlaceholders})`).run(...runIds);
      }
      
      // 2. Delete TCL scripts (references test_cases)
      const testCases = db.prepare('SELECT id FROM test_cases WHERE workflow_id = ?').all(id);
      if (testCases.length > 0) {
        const tcIds = testCases.map(tc => tc.id);
        const tcPlaceholders = tcIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM tcl_scripts WHERE test_case_id IN (${tcPlaceholders})`).run(...tcIds);
      }
      
      // 3. Delete workflow-level tables
      db.prepare('DELETE FROM regression_runs WHERE workflow_id = ?').run(id);
      db.prepare('DELETE FROM test_cases WHERE workflow_id = ?').run(id);
      db.prepare('DELETE FROM review_assignments WHERE workflow_id = ?').run(id);
      db.prepare('DELETE FROM documents WHERE workflow_id = ?').run(id);
      db.prepare('DELETE FROM approvals WHERE workflow_id = ?').run(id);
      db.prepare('DELETE FROM stages WHERE workflow_id = ?').run(id);
      
      // 3.1 Delete skill_evaluations (if table exists)
      try {
        db.prepare('DELETE FROM skill_evaluations WHERE workflow_id = ?').run(id);
      } catch (skillErr) {
        console.warn('Skill evaluations delete warning:', skillErr.message);
      }
      
      // 3.2 Delete audit trail entries
      try {
        db.prepare('DELETE FROM audit_trail WHERE workflow_id = ?').run(id);
      } catch (auditErr) {
        console.warn('Audit trail delete warning:', auditErr.message);
      }
      
      // 4. Finally delete the workflow
      db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
    });

    // Execute transaction
    deleteTransaction(workflow_id);
    console.log(`✓ Successfully deleted workflow: ${workflow_id}`);

    res.json({ 
      message: 'Workflow deleted successfully', 
      workflow_id,
      title: workflow.title 
    });
  } catch (err) {
    console.error('=== Error deleting workflow ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Failed to delete workflow: ' + err.message });
  }
});

// ── GET /api/workflows/:id/audit-trail ──────────────────────────────────────
// Returns the full audit trail for a workflow across all stages
router.get('/:id/audit-trail', authenticate, (req, res) => {
  try {
    const entries = getAuditTrail(req.params.id);
    // Also pull approvals for completeness
    const approvals = db.prepare(`
      SELECT a.*, u.name as user_name, u.email FROM approvals a
      LEFT JOIN users u ON a.user_id=u.id
      WHERE a.workflow_id=? ORDER BY a.created_at ASC
    `).all(req.params.id);
    res.json({
      workflow_id: req.params.id,
      audit_trail: entries.map(e => ({
        ...e,
        details: e.details ? JSON.parse(e.details) : null,
      })),
      approvals,
      total: entries.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
