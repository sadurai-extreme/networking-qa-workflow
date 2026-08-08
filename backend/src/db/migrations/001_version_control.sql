-- Phase 1: Version Control System Database Schema
-- Migration 001: Core version control tables and columns

-- Step 1: Add version control columns to existing documents table
ALTER TABLE documents ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE documents ADD COLUMN parent_version_id TEXT;
ALTER TABLE documents ADD COLUMN created_by TEXT;
ALTER TABLE documents ADD COLUMN change_summary TEXT;
ALTER TABLE documents ADD COLUMN change_reason TEXT;
ALTER TABLE documents ADD COLUMN tags TEXT;

-- Step 2: Create document_versions table (complete version history)
CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT,
  file_size INTEGER,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  change_summary TEXT,
  change_reason TEXT,
  change_type TEXT DEFAULT 'update',
  parent_version_id TEXT,
  tags TEXT,
  metadata TEXT,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_doc_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_workflow_id ON document_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_created_at ON document_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_versions_version_number ON document_versions(document_id, version_number);

-- Step 4: Create document_changes table (detailed change tracking)
CREATE TABLE IF NOT EXISTS document_changes (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  change_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  changed_by TEXT NOT NULL,
  change_type TEXT NOT NULL,
  section TEXT,
  old_value TEXT,
  new_value TEXT,
  line_number INTEGER,
  change_description TEXT,
  FOREIGN KEY (version_id) REFERENCES document_versions(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_changes_version_id ON document_changes(version_id);
CREATE INDEX IF NOT EXISTS idx_changes_timestamp ON document_changes(change_timestamp DESC);

-- Step 5: Create document_relationships table (traceability)
CREATE TABLE IF NOT EXISTS document_relationships (
  id TEXT PRIMARY KEY,
  source_doc_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  target_doc_id TEXT NOT NULL,
  target_version TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (source_doc_id) REFERENCES documents(id),
  FOREIGN KEY (target_doc_id) REFERENCES documents(id)
);

CREATE INDEX IF NOT EXISTS idx_relationships_source ON document_relationships(source_doc_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON document_relationships(target_doc_id);

-- Step 6: Create version_annotations table (comments on versions)
CREATE TABLE IF NOT EXISTS version_annotations (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  annotation TEXT NOT NULL,
  annotation_type TEXT DEFAULT 'comment',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved INTEGER DEFAULT 0,
  FOREIGN KEY (version_id) REFERENCES document_versions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_annotations_version_id ON version_annotations(version_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON version_annotations(user_id);

-- Migration complete
