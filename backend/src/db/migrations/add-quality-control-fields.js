/**
 * Database Migration: Add Quality Control and Audit Fields
 * 
 * Adds fields for LLM tracking, validation, and audit trail
 * to support quality assurance regardless of LLM changes.
 */

const Database = require('better-sqlite3');
const path = require('path');

function runMigration() {
  const dbPath = path.resolve(__dirname, '../../../data/qa_workflow.db');
  const db = new Database(dbPath);

  console.log('Starting database migration: Quality Control & Audit Trail...');

  try {
    // Begin transaction
    db.prepare('BEGIN').run();

    // 1. Add LLM tracking fields to documents table
    console.log('Adding LLM tracking fields to documents table...');
    
    const llmFields = [
      'ALTER TABLE documents ADD COLUMN llm_model TEXT',
      'ALTER TABLE documents ADD COLUMN llm_version TEXT',
      'ALTER TABLE documents ADD COLUMN llm_temperature REAL',
      'ALTER TABLE documents ADD COLUMN generation_timestamp DATETIME'
    ];

    llmFields.forEach(sql => {
      try {
        db.prepare(sql).run();
      } catch (err) {
        if (!err.message.includes('duplicate column name')) {
          throw err;
        }
        console.log(`  - Column already exists: ${sql.split(' ')[5]}`);
      }
    });

    // 2. Add validation fields to documents table
    console.log('Adding validation fields to documents table...');
    
    const validationFields = [
      'ALTER TABLE documents ADD COLUMN validation_status TEXT DEFAULT "pending"',
      'ALTER TABLE documents ADD COLUMN validation_score INTEGER',
      'ALTER TABLE documents ADD COLUMN validation_errors TEXT',
      'ALTER TABLE documents ADD COLUMN validation_warnings TEXT',
      'ALTER TABLE documents ADD COLUMN validated_at DATETIME'
    ];

    validationFields.forEach(sql => {
      try {
        db.prepare(sql).run();
      } catch (err) {
        if (!err.message.includes('duplicate column name')) {
          throw err;
        }
        console.log(`  - Column already exists: ${sql.split(' ')[5]}`);
      }
    });

    // 3. Add normalization tracking
    console.log('Adding normalization tracking fields...');
    
    const normalizationFields = [
      'ALTER TABLE documents ADD COLUMN normalization_applied BOOLEAN DEFAULT 0',
      'ALTER TABLE documents ADD COLUMN normalization_changes TEXT',
      'ALTER TABLE documents ADD COLUMN normalized_at DATETIME'
    ];

    normalizationFields.forEach(sql => {
      try {
        db.prepare(sql).run();
      } catch (err) {
        if (!err.message.includes('duplicate column name')) {
          throw err;
        }
        console.log(`  - Column already exists: ${sql.split(' ')[5]}`);
      }
    });

    // 4. Add approval fields
    console.log('Adding approval workflow fields...');
    
    const approvalFields = [
      'ALTER TABLE documents ADD COLUMN approved_by TEXT',
      'ALTER TABLE documents ADD COLUMN approved_at DATETIME',
      'ALTER TABLE documents ADD COLUMN approval_status TEXT DEFAULT "pending"',
      'ALTER TABLE documents ADD COLUMN approval_comments TEXT'
    ];

    approvalFields.forEach(sql => {
      try {
        db.prepare(sql).run();
      } catch (err) {
        if (!err.message.includes('duplicate column name')) {
          throw err;
        }
        console.log(`  - Column already exists: ${sql.split(' ')[5]}`);
      }
    });

    // 5. Create document_revisions table for detailed version history
    console.log('Creating document_revisions table...');
    
    db.prepare(`
      CREATE TABLE IF NOT EXISTS document_revisions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        version_number TEXT NOT NULL,
        content TEXT NOT NULL,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        change_type TEXT,
        change_summary TEXT,
        llm_model TEXT,
        llm_version TEXT,
        validation_score INTEGER,
        normalization_applied BOOLEAN,
        diff_from_previous TEXT,
        metadata TEXT,
        FOREIGN KEY(document_id) REFERENCES documents(id)
      )
    `).run();

    // 6. Create document_validations table for validation history
    console.log('Creating document_validations table...');
    
    db.prepare(`
      CREATE TABLE IF NOT EXISTS document_validations (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        version_number TEXT,
        validated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        validator_version TEXT,
        validation_score INTEGER,
        validation_grade TEXT,
        total_issues INTEGER,
        critical_issues INTEGER,
        major_issues INTEGER,
        minor_issues INTEGER,
        test_case_count INTEGER,
        issues_json TEXT,
        statistics_json TEXT,
        recommendation TEXT,
        FOREIGN KEY(document_id) REFERENCES documents(id)
      )
    `).run();

    // 7. Create document_normalizations table for normalization history
    console.log('Creating document_normalizations table...');
    
    db.prepare(`
      CREATE TABLE IF NOT EXISTS document_normalizations (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        normalized_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        normalizer_version TEXT,
        changes_count INTEGER,
        changes_json TEXT,
        categories_json TEXT,
        FOREIGN KEY(document_id) REFERENCES documents(id)
      )
    `).run();

    // 8. Create document_approvals table for approval workflow
    console.log('Creating document_approvals table...');
    
    db.prepare(`
      CREATE TABLE IF NOT EXISTS document_approvals (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        version_number TEXT,
        approver_id TEXT NOT NULL,
        approved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approval_status TEXT NOT NULL,
        comments TEXT,
        previous_status TEXT,
        FOREIGN KEY(document_id) REFERENCES documents(id)
      )
    `).run();

    // 9. Create audit_log table for comprehensive audit trail
    console.log('Creating audit_log table...');
    
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        event_type TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        user_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        llm_model TEXT,
        ip_address TEXT,
        user_agent TEXT,
        metadata TEXT
      )
    `).run();

    // 10. Create indexes for performance
    console.log('Creating indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_documents_llm_model ON documents(llm_model)',
      'CREATE INDEX IF NOT EXISTS idx_documents_validation_status ON documents(validation_status)',
      'CREATE INDEX IF NOT EXISTS idx_documents_approval_status ON documents(approval_status)',
      'CREATE INDEX IF NOT EXISTS idx_revisions_document_id ON document_revisions(document_id)',
      'CREATE INDEX IF NOT EXISTS idx_revisions_created_at ON document_revisions(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_validations_document_id ON document_validations(document_id)',
      'CREATE INDEX IF NOT EXISTS idx_validations_score ON document_validations(validation_score)',
      'CREATE INDEX IF NOT EXISTS idx_normalizations_document_id ON document_normalizations(document_id)',
      'CREATE INDEX IF NOT EXISTS idx_approvals_document_id ON document_approvals(document_id)',
      'CREATE INDEX IF NOT EXISTS idx_approvals_status ON document_approvals(approval_status)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)'
    ];

    indexes.forEach(sql => {
      db.prepare(sql).run();
    });

    // Commit transaction
    db.prepare('COMMIT').run();

    console.log('✅ Migration completed successfully!');
    console.log('\nNew tables created:');
    console.log('  - document_revisions: Detailed version history');
    console.log('  - document_validations: Validation results history');
    console.log('  - document_normalizations: Normalization changes history');
    console.log('  - document_approvals: Approval workflow tracking');
    console.log('  - audit_log: Comprehensive audit trail');
    console.log('\nNew fields added to documents table:');
    console.log('  - LLM tracking: llm_model, llm_version, llm_temperature, generation_timestamp');
    console.log('  - Validation: validation_status, validation_score, validation_errors, validation_warnings, validated_at');
    console.log('  - Normalization: normalization_applied, normalization_changes, normalized_at');
    console.log('  - Approval: approved_by, approved_at, approval_status, approval_comments');

  } catch (error) {
    // Rollback on error
    db.prepare('ROLLBACK').run();
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
