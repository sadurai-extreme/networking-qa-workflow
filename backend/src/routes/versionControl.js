/**
 * Version Control API Routes
 * Phase 1: Core version management endpoints
 */

const express = require('express');
const router = express.Router();
const {
  createDocumentVersion,
  getDocumentVersionHistory,
  getDocumentVersion,
  compareDocumentVersions,
  rollbackDocumentVersion,
  createDocumentRelationship,
  getDocumentRelationships,
  addVersionAnnotation,
  getVersionAnnotations,
  getWorkflowTraceability
} = require('../utils/versionControl');

/**
 * GET /api/documents/:doc_id/versions
 * Get version history for a document
 */
router.get('/documents/:doc_id/versions', (req, res) => {
  try {
    const { doc_id } = req.params;
    const versions = getDocumentVersionHistory(doc_id);
    
    res.json({
      success: true,
      document_id: doc_id,
      versions
    });
  } catch (error) {
    console.error('Error fetching version history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:doc_id/versions/:version_number
 * Get specific version content
 */
router.get('/documents/:doc_id/versions/:version_number', (req, res) => {
  try {
    const { doc_id, version_number } = req.params;
    const version = getDocumentVersion(doc_id, parseInt(version_number));
    
    res.json({
      success: true,
      version
    });
  } catch (error) {
    console.error('Error fetching version:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:doc_id/compare
 * Compare two versions
 * Query params: v1, v2
 */
router.get('/documents/:doc_id/compare', (req, res) => {
  try {
    const { doc_id } = req.params;
    const { v1, v2 } = req.query;
    
    if (!v1 || !v2) {
      return res.status(400).json({
        success: false,
        error: 'Both v1 and v2 query parameters are required'
      });
    }
    
    const comparison = compareDocumentVersions(doc_id, parseInt(v1), parseInt(v2));
    
    res.json({
      success: true,
      comparison
    });
  } catch (error) {
    console.error('Error comparing versions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/:doc_id/update
 * Create new version of document
 * Body: { content, change_summary, change_reason, tags, user_id }
 */
router.post('/documents/:doc_id/update', (req, res) => {
  try {
    const { doc_id } = req.params;
    const { content, change_summary, change_reason, tags, user_id } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }
    
    if (!change_summary) {
      return res.status(400).json({
        success: false,
        error: 'Change summary is required'
      });
    }
    
    const db = require('../db/database');
    const document = db.prepare('SELECT workflow_id FROM documents WHERE id = ?').get(doc_id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    const newVersion = createDocumentVersion({
      document_id: doc_id,
      workflow_id: document.workflow_id,
      content,
      created_by: user_id || 'user-admin',
      change_summary,
      change_reason: change_reason || change_summary,
      change_type: 'update',
      tags
    });
    
    res.json({
      success: true,
      version: newVersion
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/:doc_id/rollback
 * Rollback document to a previous version
 * Body: { version_number, reason, user_id }
 */
router.post('/documents/:doc_id/rollback', (req, res) => {
  try {
    const { doc_id } = req.params;
    const { version_number, reason, user_id } = req.body;
    
    if (!version_number) {
      return res.status(400).json({
        success: false,
        error: 'Version number is required'
      });
    }
    
    const newVersion = rollbackDocumentVersion(
      doc_id,
      parseInt(version_number),
      user_id || 'user-admin',
      reason || 'No reason provided'
    );
    
    res.json({
      success: true,
      message: `Rolled back to version ${version_number}`,
      version: newVersion
    });
  } catch (error) {
    console.error('Error rolling back document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/:doc_id/versions/:version_number/tag
 * Add tag to a version
 * Body: { tag }
 */
router.post('/documents/:doc_id/versions/:version_number/tag', (req, res) => {
  try {
    const { doc_id, version_number } = req.params;
    const { tag } = req.body;
    
    if (!tag) {
      return res.status(400).json({
        success: false,
        error: 'Tag is required'
      });
    }
    
    const version = getDocumentVersion(doc_id, parseInt(version_number));
    const db = require('../db/database');
    
    // Get existing tags and add new one
    const existingTags = version.tags ? version.tags.split(',') : [];
    if (!existingTags.includes(tag)) {
      existingTags.push(tag);
    }
    
    const newTags = existingTags.join(',');
    
    db.prepare('UPDATE document_versions SET tags = ? WHERE id = ?')
      .run(newTags, version.id);
    
    res.json({
      success: true,
      message: 'Tag added successfully',
      tags: newTags
    });
  } catch (error) {
    console.error('Error adding tag:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:doc_id/relationships
 * Get document relationships (traceability)
 */
router.get('/documents/:doc_id/relationships', (req, res) => {
  try {
    const { doc_id } = req.params;
    const relationships = getDocumentRelationships(doc_id);
    
    res.json({
      success: true,
      document_id: doc_id,
      relationships
    });
  } catch (error) {
    console.error('Error fetching relationships:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/relationship
 * Create relationship between documents
 * Body: { source_doc_id, source_version, target_doc_id, target_version, relationship_type, notes }
 */
router.post('/documents/relationship', (req, res) => {
  try {
    const { source_doc_id, source_version, target_doc_id, target_version, relationship_type, notes } = req.body;
    
    if (!source_doc_id || !target_doc_id || !relationship_type) {
      return res.status(400).json({
        success: false,
        error: 'source_doc_id, target_doc_id, and relationship_type are required'
      });
    }
    
    const relationship = createDocumentRelationship({
      source_doc_id,
      source_version: source_version || '1',
      target_doc_id,
      target_version: target_version || '1',
      relationship_type,
      notes
    });
    
    res.json({
      success: true,
      relationship
    });
  } catch (error) {
    console.error('Error creating relationship:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/versions/:version_id/annotations
 * Add annotation to version
 * Body: { annotation, annotation_type, user_id }
 */
router.post('/versions/:version_id/annotations', (req, res) => {
  try {
    const { version_id } = req.params;
    const { annotation, annotation_type, user_id } = req.body;
    
    if (!annotation) {
      return res.status(400).json({
        success: false,
        error: 'Annotation is required'
      });
    }
    
    const result = addVersionAnnotation({
      version_id,
      user_id: user_id || 'user-admin',
      annotation,
      annotation_type: annotation_type || 'comment'
    });
    
    res.json({
      success: true,
      annotation: result
    });
  } catch (error) {
    console.error('Error adding annotation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/versions/:version_id/annotations
 * Get annotations for version
 */
router.get('/versions/:version_id/annotations', (req, res) => {
  try {
    const { version_id } = req.params;
    const annotations = getVersionAnnotations(version_id);
    
    res.json({
      success: true,
      version_id,
      annotations
    });
  } catch (error) {
    console.error('Error fetching annotations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workflows/:workflow_id/traceability
 * Get complete traceability chain for workflow
 */
router.get('/workflows/:workflow_id/traceability', (req, res) => {
  try {
    const { workflow_id } = req.params;
    const traceability = getWorkflowTraceability(workflow_id);
    
    res.json({
      success: true,
      traceability
    });
  } catch (error) {
    console.error('Error fetching traceability:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
