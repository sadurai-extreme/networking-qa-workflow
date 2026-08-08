/**
 * Version Control Utility Functions
 * Phase 1: Core version management operations
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db/database');

/**
 * Create a new version of a document
 * @param {Object} params - Version creation parameters
 * @returns {Object} Created version details
 */
function createDocumentVersion({ document_id, workflow_id, content, created_by, change_summary, change_reason, change_type = 'update', tags = null, metadata = null }) {
  try {
    // Get the current document to determine next version number
    const currentDoc = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
    
    if (!currentDoc) {
      throw new Error('Document not found');
    }

    const nextVersion = (currentDoc.version || 1) + 1;
    
    // Calculate content hash for integrity
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    const fileSize = Buffer.byteLength(content, 'utf8');
    
    // Create version record
    const versionId = uuidv4();
    const parentVersionId = currentDoc.id;
    
    const stmt = db.prepare(`
      INSERT INTO document_versions (
        id, document_id, workflow_id, version_number, content, 
        content_hash, file_size, created_by, change_summary, 
        change_reason, change_type, parent_version_id, tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      versionId,
      document_id,
      workflow_id,
      nextVersion,
      content,
      contentHash,
      fileSize,
      created_by,
      change_summary,
      change_reason,
      change_type,
      parentVersionId,
      tags,
      metadata ? JSON.stringify(metadata) : null
    );
    
    // Update the documents table with new version info
    db.prepare(`
      UPDATE documents 
      SET version = ?,
          content = ?,
          change_summary = ?,
          change_reason = ?,
          tags = ?,
          parent_version_id = ?,
          created_by = ?
      WHERE id = ?
    `).run(nextVersion, content, change_summary, change_reason, tags, parentVersionId, created_by, document_id);
    
    // Log to audit trail
    db.prepare(`
      INSERT INTO audit_trail (id, workflow_id, action, action_type, user_id, details, document_id, document_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      workflow_id,
      `Created version ${nextVersion}`,
      'version_create',
      created_by,
      JSON.stringify({ change_summary, change_reason }),
      document_id,
      nextVersion
    );
    
    return {
      version_id: versionId,
      version_number: nextVersion,
      document_id,
      content_hash: contentHash,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error creating document version:', error);
    throw error;
  }
}

/**
 * Get version history for a document
 * @param {string} document_id - Document ID
 * @returns {Array} List of versions
 */
function getDocumentVersionHistory(document_id) {
  try {
    const versions = db.prepare(`
      SELECT 
        dv.id,
        dv.version_number,
        dv.created_at,
        dv.created_by,
        dv.change_summary,
        dv.change_reason,
        dv.change_type,
        dv.tags,
        dv.file_size,
        u.name as created_by_name
      FROM document_versions dv
      LEFT JOIN users u ON dv.created_by = u.id
      WHERE dv.document_id = ?
      ORDER BY dv.version_number DESC
    `).all(document_id);
    
    return versions;
  } catch (error) {
    console.error('Error getting version history:', error);
    throw error;
  }
}

/**
 * Get a specific version of a document
 * @param {string} document_id - Document ID
 * @param {number} version_number - Version number
 * @returns {Object} Version details with content
 */
function getDocumentVersion(document_id, version_number) {
  try {
    const version = db.prepare(`
      SELECT 
        dv.*,
        u.name as created_by_name
      FROM document_versions dv
      LEFT JOIN users u ON dv.created_by = u.id
      WHERE dv.document_id = ? AND dv.version_number = ?
    `).get(document_id, version_number);
    
    if (!version) {
      throw new Error('Version not found');
    }
    
    return version;
  } catch (error) {
    console.error('Error getting document version:', error);
    throw error;
  }
}

/**
 * Compare two versions of a document
 * @param {string} document_id - Document ID
 * @param {number} version1 - First version number
 * @param {number} version2 - Second version number
 * @returns {Object} Comparison results
 */
function compareDocumentVersions(document_id, version1, version2) {
  try {
    const v1 = getDocumentVersion(document_id, version1);
    const v2 = getDocumentVersion(document_id, version2);
    
    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }
    
    // Simple line-by-line diff
    const lines1 = v1.content.split('\n');
    const lines2 = v2.content.split('\n');
    
    const diff = [];
    const maxLines = Math.max(lines1.length, lines2.length);
    
    let addedLines = 0;
    let deletedLines = 0;
    let modifiedLines = 0;
    
    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';
      
      if (line1 !== line2) {
        if (lines1[i] === undefined) {
          diff.push({ type: 'add', line: i + 1, content: line2 });
          addedLines++;
        } else if (lines2[i] === undefined) {
          diff.push({ type: 'delete', line: i + 1, content: line1 });
          deletedLines++;
        } else {
          diff.push({ type: 'modify', line: i + 1, old: line1, new: line2 });
          modifiedLines++;
        }
      }
    }
    
    return {
      version1: {
        version_number: v1.version_number,
        created_at: v1.created_at,
        created_by: v1.created_by_name
      },
      version2: {
        version_number: v2.version_number,
        created_at: v2.created_at,
        created_by: v2.created_by_name
      },
      diff,
      summary: {
        added: addedLines,
        deleted: deletedLines,
        modified: modifiedLines,
        total_changes: addedLines + deletedLines + modifiedLines
      }
    };
  } catch (error) {
    console.error('Error comparing versions:', error);
    throw error;
  }
}

/**
 * Rollback document to a previous version
 * @param {string} document_id - Document ID
 * @param {number} target_version - Version to rollback to
 * @param {string} user_id - User performing rollback
 * @param {string} reason - Reason for rollback
 * @returns {Object} New version created from rollback
 */
function rollbackDocumentVersion(document_id, target_version, user_id, reason) {
  try {
    const targetVersion = getDocumentVersion(document_id, target_version);
    
    if (!targetVersion) {
      throw new Error('Target version not found');
    }
    
    const document = db.prepare('SELECT workflow_id FROM documents WHERE id = ?').get(document_id);
    
    // Create new version with content from target version
    const newVersion = createDocumentVersion({
      document_id,
      workflow_id: document.workflow_id,
      content: targetVersion.content,
      created_by: user_id,
      change_summary: `Rolled back to version ${target_version}`,
      change_reason: reason || `Rollback to version ${target_version}`,
      change_type: 'rollback',
      tags: 'rollback',
      metadata: {
        rollback_from_version: targetVersion.version_number,
        rollback_reason: reason
      }
    });
    
    return newVersion;
  } catch (error) {
    console.error('Error rolling back version:', error);
    throw error;
  }
}

/**
 * Create a relationship between two documents
 * @param {Object} params - Relationship parameters
 * @returns {Object} Created relationship
 */
function createDocumentRelationship({ source_doc_id, source_version, target_doc_id, target_version, relationship_type, notes }) {
  try {
    const relationshipId = uuidv4();
    
    db.prepare(`
      INSERT INTO document_relationships (
        id, source_doc_id, source_version, target_doc_id, 
        target_version, relationship_type, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      relationshipId,
      source_doc_id,
      source_version,
      target_doc_id,
      target_version,
      relationship_type,
      notes
    );
    
    return {
      id: relationshipId,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error creating document relationship:', error);
    throw error;
  }
}

/**
 * Get relationships for a document
 * @param {string} document_id - Document ID
 * @returns {Array} List of relationships
 */
function getDocumentRelationships(document_id) {
  try {
    const relationships = db.prepare(`
      SELECT 
        dr.*,
        d1.filename as source_filename,
        d1.doc_type as source_doc_type,
        d2.filename as target_filename,
        d2.doc_type as target_doc_type
      FROM document_relationships dr
      LEFT JOIN documents d1 ON dr.source_doc_id = d1.id
      LEFT JOIN documents d2 ON dr.target_doc_id = d2.id
      WHERE dr.source_doc_id = ? OR dr.target_doc_id = ?
      ORDER BY dr.created_at DESC
    `).all(document_id, document_id);
    
    return relationships;
  } catch (error) {
    console.error('Error getting document relationships:', error);
    throw error;
  }
}

/**
 * Add annotation to a version
 * @param {Object} params - Annotation parameters
 * @returns {Object} Created annotation
 */
function addVersionAnnotation({ version_id, user_id, annotation, annotation_type = 'comment' }) {
  try {
    const annotationId = uuidv4();
    
    db.prepare(`
      INSERT INTO version_annotations (
        id, version_id, user_id, annotation, annotation_type
      ) VALUES (?, ?, ?, ?, ?)
    `).run(annotationId, version_id, user_id, annotation, annotation_type);
    
    return {
      id: annotationId,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error adding version annotation:', error);
    throw error;
  }
}

/**
 * Get annotations for a version
 * @param {string} version_id - Version ID
 * @returns {Array} List of annotations
 */
function getVersionAnnotations(version_id) {
  try {
    const annotations = db.prepare(`
      SELECT 
        va.*,
        u.name as user_name
      FROM version_annotations va
      LEFT JOIN users u ON va.user_id = u.id
      WHERE va.version_id = ?
      ORDER BY va.created_at DESC
    `).all(version_id);
    
    return annotations;
  } catch (error) {
    console.error('Error getting version annotations:', error);
    throw error;
  }
}

/**
 * Get traceability chain for a workflow
 * @param {string} workflow_id - Workflow ID
 * @returns {Object} Complete traceability information
 */
function getWorkflowTraceability(workflow_id) {
  try {
    // Get all documents for this workflow
    const documents = db.prepare(`
      SELECT 
        d.id,
        d.doc_type,
        d.filename,
        d.stage_number,
        d.version,
        d.created_at
      FROM documents d
      WHERE d.workflow_id = ?
      ORDER BY d.stage_number, d.created_at
    `).all(workflow_id);
    
    // Get version history for each document
    const traceability = documents.map(doc => {
      const versions = getDocumentVersionHistory(doc.id);
      const relationships = getDocumentRelationships(doc.id);
      
      return {
        ...doc,
        versions,
        relationships
      };
    });
    
    return {
      workflow_id,
      documents: traceability
    };
  } catch (error) {
    console.error('Error getting workflow traceability:', error);
    throw error;
  }
}

/**
 * Create a revision record with LLM and validation metadata
 * @param {Object} params - Revision parameters
 * @returns {Object} Created revision details
 */
function createDocumentRevision({
  document_id,
  version_number,
  content,
  created_by,
  change_type,
  change_summary,
  llm_model,
  llm_version,
  validation_score,
  normalization_applied,
  diff_from_previous = null,
  metadata = null
}) {
  try {
    const revisionId = uuidv4();
    
    db.prepare(`
      INSERT INTO document_revisions (
        id, document_id, version_number, content, created_by, created_at,
        change_type, change_summary, llm_model, llm_version,
        validation_score, normalization_applied, diff_from_previous, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      revisionId,
      document_id,
      version_number,
      content,
      created_by,
      new Date().toISOString(),
      change_type,
      change_summary,
      llm_model,
      llm_version,
      validation_score,
      normalization_applied ? 1 : 0,
      diff_from_previous,
      metadata ? JSON.stringify(metadata) : null
    );
    
    console.log(`Created revision ${revisionId} for document ${document_id}`);
    
    return {
      revision_id: revisionId,
      document_id,
      version_number,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error creating document revision:', error);
    throw error;
  }
}

/**
 * Get revision history with LLM tracking
 * @param {string} document_id - Document ID
 * @returns {Array} List of revisions with LLM and validation metadata
 */
function getDocumentRevisionHistory(document_id) {
  try {
    const revisions = db.prepare(`
      SELECT 
        id,
        version_number,
        created_at,
        created_by,
        change_type,
        change_summary,
        llm_model,
        llm_version,
        validation_score,
        normalization_applied
      FROM document_revisions
      WHERE document_id = ?
      ORDER BY created_at DESC
    `).all(document_id);
    
    return revisions;
  } catch (error) {
    console.error('Error getting revision history:', error);
    throw error;
  }
}

/**
 * Get quality metrics for a document
 * @param {string} document_id - Document ID
 * @returns {Object} Quality metrics summary
 */
function getDocumentQualityMetrics(document_id) {
  try {
    // Get latest validation
    const latestValidation = db.prepare(`
      SELECT * FROM document_validations
      WHERE document_id = ?
      ORDER BY validated_at DESC
      LIMIT 1
    `).get(document_id);
    
    // Get validation history
    const validationHistory = db.prepare(`
      SELECT 
        validated_at,
        validation_score,
        validation_grade,
        total_issues
      FROM document_validations
      WHERE document_id = ?
      ORDER BY validated_at ASC
    `).all(document_id);
    
    // Get normalization count
    const normalizationCount = db.prepare(`
      SELECT COUNT(*) as count, SUM(changes_count) as total_changes
      FROM document_normalizations
      WHERE document_id = ?
    `).get(document_id);
    
    return {
      latest_validation: latestValidation,
      validation_history: validationHistory,
      normalization_stats: normalizationCount,
      quality_trend: calculateQualityTrend(validationHistory)
    };
  } catch (error) {
    console.error('Error getting quality metrics:', error);
    throw error;
  }
}

/**
 * Calculate quality trend from validation history
 * @private
 */
function calculateQualityTrend(history) {
  if (history.length < 2) return 'stable';
  
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  
  const scoreDiff = latest.validation_score - previous.validation_score;
  
  if (scoreDiff > 5) return 'improving';
  if (scoreDiff < -5) return 'declining';
  return 'stable';
}

module.exports = {
  createDocumentVersion,
  getDocumentVersionHistory,
  getDocumentVersion,
  compareDocumentVersions,
  rollbackDocumentVersion,
  createDocumentRelationship,
  getDocumentRelationships,
  addVersionAnnotation,
  getVersionAnnotations,
  getWorkflowTraceability,
  createDocumentRevision,
  getDocumentRevisionHistory,
  getDocumentQualityMetrics
};
