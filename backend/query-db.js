const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/qa_workflow.db');

console.log('=== Database Analysis ===\n');

// Get all tables
db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, tables) => {
  console.log('Tables:', tables.map(t => t.name).join(', '));
  
  // Get skill_files structure
  db.all('PRAGMA table_info(skill_files)', (err, cols) => {
    console.log('\nskill_files columns:');
    cols.forEach(c => console.log('  -', c.name, '(' + c.type + ')'));
    
    // Count skill files
    db.all('SELECT COUNT(*) as count FROM skill_files', (err, r) => {
      console.log('\nCurrent skill files:', r[0].count);
      
      // Get workflows
      db.all('SELECT id, jira_id, release_version, summary FROM workflows ORDER BY release_version', (err, ws) => {
        console.log('\nWorkflows by release:');
        const byRelease = {};
        ws.forEach(w => {
          if (!byRelease[w.release_version]) byRelease[w.release_version] = [];
          byRelease[w.release_version].push(w.jira_id);
        });
        
        Object.keys(byRelease).sort().forEach(rel => {
          console.log(`  ${rel}: ${byRelease[rel].join(', ')}`);
        });
        
        console.log('\nTotal workflows:', ws.length);
        db.close();
      });
    });
  });
});
