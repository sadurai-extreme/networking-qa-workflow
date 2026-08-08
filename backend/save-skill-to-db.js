const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const crypto = require('crypto');

const db = new sqlite3.Database('./data/qa_workflow.db');
const content = fs.readFileSync('../data/default_skills/skill-EXOS-37069.md', 'utf8');
const workflowId = '211a2aab-b5bd-4f0a-be25-e0a461e2d728';
const skillId = crypto.randomUUID();

console.log('Saving skill file to database...');

db.run(
  'INSERT OR REPLACE INTO skill_files (id, workflow_id, jira_id, content, created_at) VALUES (?, ?, ?, ?, datetime("now"))',
  [skillId, workflowId, 'EXOS-37069', content],
  function(err) {
    if (err) {
      console.error('❌ Error:', err.message);
      process.exit(1);
    } else {
      console.log('\n✅ Skill file saved to database!');
      console.log('📋 Skill ID:', skillId);
      console.log('🔗 Workflow ID:', workflowId);
      console.log('📄 Content length:', content.length, 'characters');
      console.log('📊 Lines:', content.split('\n').length);
      db.close();
    }
  }
);
