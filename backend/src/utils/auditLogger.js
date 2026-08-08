const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

// Ensure audit_trail table exists
function ensureAuditTrailTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_trail (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        stage_number INTEGER,
        action TEXT NOT NULL,
        action_type TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        details TEXT,
        document_id TEXT,
        document_version INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[AUDIT] Audit trail table ready');
  } catch (err) {
    console.error('[AUDIT] Failed to create audit trail table:', err.message);
  }
}

// Initialize on module load
ensureAuditTrailTable();

/**
 * Log an action to the audit trail
 * @param {Object} params - Audit log parameters
 * @param {string} params.workflow_id - Workflow ID
 * @param {number} params.stage_number - Stage number (optional)
 * @param {string} params.action - Human-readable action description
 * @param {string} params.action_type - Action type (generate, regenerate, approve, amend, edit, delete, etc.)
 * @param {string} params.user_id - User ID (optional)
 * @param {string} params.user_name - User name (optional)
 * @param {Object} params.details - Additional details as object (will be JSON stringified)
 * @param {string} params.document_id - Related document ID (optional)
 * @param {number} params.document_version - Document version (optional)
 */
function logAuditTrail(params) {
  const {
    workflow_id,
    stage_number = null,
    action,
    action_type,
    user_id = null,
    user_name = null,
    details = null,
    document_id = null,
    document_version = null
  } = params;

  try {
    const auditId = uuidv4();
    const detailsJson = details ? JSON.stringify(details) : null;

    db.prepare(`
      INSERT INTO audit_trail (
        id, workflow_id, stage_number, action, action_type, 
        user_id, user_name, details, document_id, document_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditId,
      workflow_id,
      stage_number,
      action,
      action_type,
      user_id,
      user_name,
      detailsJson,
      document_id,
      document_version
    );

    console.log(`[AUDIT] ${action_type}: ${action} (Workflow: ${workflow_id})`);
    return auditId;
  } catch (err) {
    console.error('Failed to log audit trail:', err);
    // Don't throw - audit logging should not break the main flow
    return null;
  }
}

/**
 * Get audit trail for a workflow
 * @param {string} workflow_id - Workflow ID
 * @param {number} stage_number - Optional stage number to filter
 * @returns {Array} Audit trail entries
 */
function getAuditTrail(workflow_id, stage_number = null) {
  try {
    let query = `
      SELECT * FROM audit_trail 
      WHERE workflow_id = ?
    `;
    const params = [workflow_id];

    if (stage_number !== null) {
      query += ` AND stage_number = ?`;
      params.push(stage_number);
    }

    query += ` ORDER BY created_at DESC`;

    return db.prepare(query).all(...params);
  } catch (err) {
    console.error('Failed to get audit trail:', err);
    return [];
  }
}

/**
 * Get recent audit trail entries across all workflows
 * @param {number} limit - Number of entries to return
 * @returns {Array} Audit trail entries
 */
function getRecentAuditTrail(limit = 100) {
  try {
    return db.prepare(`
      SELECT a.*, w.title as workflow_title, w.jira_story_id
      FROM audit_trail a
      JOIN workflows w ON a.workflow_id = w.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(limit);
  } catch (err) {
    console.error('Failed to get recent audit trail:', err);
    return [];
  }
}

module.exports = {
  logAuditTrail,
  getAuditTrail,
  getRecentAuditTrail
};
