const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = path.resolve(__dirname, process.env.DB_PATH || '../../data/qa_workflow.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE,
      password TEXT NOT NULL DEFAULT '',
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      jira_story_id TEXT,
      jira_release TEXT,
      jira_story_description TEXT,
      jira_story_type TEXT,
      jira_story_status TEXT,
      jira_story_priority TEXT,
      current_stage INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL,
      stage_number INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      started_at DATETIME,
      completed_at DATETIME,
      data TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      stage_number INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      stage_number INTEGER NOT NULL,
      doc_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      content TEXT,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      tc_number TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      classification TEXT DEFAULT 'pending',
      qtest_id TEXT,
      status TEXT DEFAULT 'pending',
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    );

    CREATE TABLE IF NOT EXISTS tcl_scripts (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      test_case_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id),
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id)
    );

    CREATE TABLE IF NOT EXISTS regression_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      platforms TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      started_at DATETIME,
      completed_at DATETIME,
      total_tests INTEGER DEFAULT 0,
      passed INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      fa_portal_run_id TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    );

    CREATE TABLE IF NOT EXISTS regression_results (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      test_case_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      result TEXT,
      log TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (run_id) REFERENCES regression_runs(id),
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id)
    );

    CREATE TABLE IF NOT EXISTS review_assignments (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      stage_number INTEGER NOT NULL,
      assigned_by TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id),
      FOREIGN KEY (assigned_by) REFERENCES users(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

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
    );

    CREATE TABLE IF NOT EXISTS tc_execution_results (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      tc_number TEXT NOT NULL,
      result TEXT CHECK(result IN ('not_run','pass','fail','blocked')) DEFAULT 'not_run',
      notes TEXT,
      updated_steps TEXT,
      executed_at DATETIME,
      executed_by TEXT,
      UNIQUE(workflow_id, tc_number)
    );
  `);

  // Migrate existing workflows table to add new Jira story fields
  try {
    // Check if columns exist
    const columns = db.prepare("PRAGMA table_info(workflows)").all();
    const columnNames = columns.map(col => col.name);
    
    if (!columnNames.includes('jira_story_description')) {
      console.log('Adding jira_story_description column to workflows table...');
      db.exec('ALTER TABLE workflows ADD COLUMN jira_story_description TEXT');
    }
    
    if (!columnNames.includes('jira_story_status')) {
      console.log('Adding jira_story_status column to workflows table...');
      db.exec('ALTER TABLE workflows ADD COLUMN jira_story_status TEXT');
    }
    
    if (!columnNames.includes('jira_story_priority')) {
      console.log('Adding jira_story_priority column to workflows table...');
      db.exec('ALTER TABLE workflows ADD COLUMN jira_story_priority TEXT');
    }
    
    // Add topology and user instructions columns
    if (!columnNames.includes('topology_file')) {
      console.log('Adding topology_file column to workflows table...');
      db.exec('ALTER TABLE workflows ADD COLUMN topology_file TEXT');
    }
    
    if (!columnNames.includes('topology_description')) {
      console.log('Adding topology_description column to workflows table...');
      db.exec('ALTER TABLE workflows ADD COLUMN topology_description TEXT');
    }
    
    if (!columnNames.includes('user_instructions')) {
      console.log('Adding user_instructions column to workflows table...');
      db.exec('ALTER TABLE workflows ADD COLUMN user_instructions TEXT');
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
  
  // Migrate documents table for review comments and revisions
  try {
    const docColumns = db.prepare("PRAGMA table_info(documents)").all();
    const docColumnNames = docColumns.map(col => col.name);
    
    if (!docColumnNames.includes('review_comments')) {
      console.log('Adding review_comments column to documents table...');
      db.exec('ALTER TABLE documents ADD COLUMN review_comments TEXT');
    }
    
    if (!docColumnNames.includes('revision_number')) {
      console.log('Adding revision_number column to documents table...');
      db.exec('ALTER TABLE documents ADD COLUMN revision_number INTEGER DEFAULT 1');
    }
    
    if (!docColumnNames.includes('approved')) {
      console.log('Adding approved column to documents table...');
      db.exec('ALTER TABLE documents ADD COLUMN approved INTEGER DEFAULT 0');
    }
  } catch (err) {
    console.error('Documents migration error:', err);
  }

  // Migrate documents table for version control Phase 1
  try {
    const docVCColumns = db.prepare("PRAGMA table_info(documents)").all();
    const docVCColumnNames = docVCColumns.map(col => col.name);
    
    if (!docVCColumnNames.includes('is_active')) {
      console.log('Adding is_active column to documents table...');
      db.exec('ALTER TABLE documents ADD COLUMN is_active INTEGER DEFAULT 1');
    }
    
    if (!docVCColumnNames.includes('parent_version_id')) {
      console.log('Adding parent_version_id column to documents table...');
      db.exec('ALTER TABLE documents ADD COLUMN parent_version_id TEXT');
    }
    
    if (!docVCColumnNames.includes('created_by')) {
      console.log('Adding created_by column to documents table...');
      db.exec('ALTER TABLE documents ADD COLUMN created_by TEXT');
    }
    
    if (!docVCColumnNames.includes('change_summary')) {
      console.log('Adding change_summary column to documents table...');
      db.exec('ALTER TABLE documents ADD COLUMN change_summary TEXT');
    }
    
    if (!docVCColumnNames.includes('change_reason')) {
      console.log('Adding change_reason column to documents table...');
      db.exec('ALTER TABLE documents ADD COLUMN change_reason TEXT');
    }
    
    if (!docVCColumnNames.includes('tags')) {
      console.log('Adding tags column to documents table...');
      db.exec('ALTER TABLE documents ADD COLUMN tags TEXT');
    }
  } catch (err) {
    console.error('Version control documents migration error:', err);
  }

  // Create version control tables
  try {
    db.exec(`
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
    `);

    // Create indexes for version control tables
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_doc_versions_document_id ON document_versions(document_id);
      CREATE INDEX IF NOT EXISTS idx_doc_versions_workflow_id ON document_versions(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_doc_versions_created_at ON document_versions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_doc_versions_version_number ON document_versions(document_id, version_number);
      CREATE INDEX IF NOT EXISTS idx_changes_version_id ON document_changes(version_id);
      CREATE INDEX IF NOT EXISTS idx_changes_timestamp ON document_changes(change_timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_relationships_source ON document_relationships(source_doc_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_target ON document_relationships(target_doc_id);
      CREATE INDEX IF NOT EXISTS idx_annotations_version_id ON version_annotations(version_id);
      CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON version_annotations(user_id);
    `);

    console.log('Version control tables initialized successfully');
  } catch (err) {
    console.error('Version control tables creation error:', err);
  }

  // Create chat assistant tables
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        stage_number INTEGER NOT NULL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        status TEXT DEFAULT 'active',
        summary TEXT,
        extracted_requirements TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id)
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        context_used TEXT,
        files_attached TEXT,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
      );

      CREATE TABLE IF NOT EXISTS chat_files (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        message_id TEXT,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id),
        FOREIGN KEY (message_id) REFERENCES chat_messages(id)
      );
    `);

    // Create indexes for chat tables
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_workflow ON chat_sessions(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_stage ON chat_sessions(workflow_id, stage_number);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_files_session ON chat_files(session_id);
    `);

    console.log('Chat assistant tables initialized successfully');
  } catch (err) {
    console.error('Chat tables creation error:', err);
  }

  // Migrate tc_execution_results to add platform, build, session_id
  try {
    const execCols = db.prepare("PRAGMA table_info(tc_execution_results)").all().map(c => c.name);
    if (!execCols.includes('platform')) {
      db.exec('ALTER TABLE tc_execution_results ADD COLUMN platform TEXT');
      console.log('Added platform column to tc_execution_results');
    }
    if (!execCols.includes('build')) {
      db.exec('ALTER TABLE tc_execution_results ADD COLUMN build TEXT');
      console.log('Added build column to tc_execution_results');
    }
    if (!execCols.includes('session_id')) {
      db.exec('ALTER TABLE tc_execution_results ADD COLUMN session_id TEXT');
      console.log('Added session_id column to tc_execution_results');
    }
  } catch (err) {
    console.error('tc_execution_results migration error:', err);
  }

  // Create execution_sessions table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS execution_sessions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        build TEXT NOT NULL,
        environment TEXT,
        started_by TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id)
      );
    `);
    console.log('Execution sessions table ready');
  } catch (err) {
    console.error('execution_sessions table error:', err);
  }

  // Create generation_prompts table — stores system+user prompts for every LLM generation
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS generation_prompts (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        stage_number INTEGER NOT NULL,
        doc_type TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        user_prompt TEXT NOT NULL,
        model_used TEXT,
        total_chars INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id)
      );
      CREATE INDEX IF NOT EXISTS idx_gen_prompts_document ON generation_prompts(document_id);
      CREATE INDEX IF NOT EXISTS idx_gen_prompts_workflow ON generation_prompts(workflow_id);
    `);
    console.log('generation_prompts table ready');
  } catch (err) {
    console.error('generation_prompts table error:', err);
  }

  // Create contracts table — parent/canonical skill files per feature
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS contracts (
        id TEXT PRIMARY KEY,
        feature_key TEXT NOT NULL,
        jira_story_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        content TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        source_document_id TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (source_document_id) REFERENCES documents(id)
      );
      CREATE INDEX IF NOT EXISTS idx_contracts_feature_key ON contracts(feature_key);
      CREATE INDEX IF NOT EXISTS idx_contracts_jira ON contracts(jira_story_id);
      CREATE INDEX IF NOT EXISTS idx_contracts_active ON contracts(is_active);
    `);
    console.log('contracts table ready');
  } catch (err) {
    console.error('contracts table error:', err);
  }

  // Seed default users with hashed passwords
  const bcrypt = require('bcryptjs');
  const defaultHash = bcrypt.hashSync('extreme', 10);

  // Run migrations first (for existing DBs upgrading from old schema)
  try { db.exec(`ALTER TABLE users ADD COLUMN username TEXT`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT ''`); } catch {}

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get('user-admin');
  if (!existing) {
    db.prepare(`INSERT INTO users (id, name, email, username, password, role) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('user-admin', 'Admin User', 'extreme@nosqa.local', 'extreme', defaultHash, 'admin');
  } else {
    // Update existing admin to new credentials
    db.prepare(`UPDATE users SET email=?, username=?, password=?, role=? WHERE id=?`)
      .run('extreme@nosqa.local', 'extreme', defaultHash, 'admin', 'user-admin');
  }

  // Set default password for any user without one
  const usersWithoutPwd = db.prepare(`SELECT id FROM users WHERE password = '' OR password IS NULL`).all();
  usersWithoutPwd.forEach(u => {
    db.prepare(`UPDATE users SET password = ? WHERE id = ?`).run(defaultHash, u.id);
  });
}

initSchema();
module.exports = db;
