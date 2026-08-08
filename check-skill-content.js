const Database = require('./backend/node_modules/better-sqlite3');
const db = new Database('./backend/data/qa_workflow.db', { readonly: true });

const result = db.prepare(`
  SELECT content 
  FROM documents 
  WHERE workflow_id = ? 
    AND stage_number = 2 
  ORDER BY version DESC 
  LIMIT 1
`).get('0a317867-b84e-4a16-abac-08a088e32287');

if (result && result.content) {
  const lines = result.content.split('\n');
  const headers = lines.filter(line => line.match(/^#+\s/));
  
  console.log('=== SKILL FILE HEADERS ===');
  headers.forEach(h => console.log(h));
  console.log('\n=== FIRST 50 LINES ===');
  console.log(lines.slice(0, 50).join('\n'));
} else {
  console.log('No content found');
}

db.close();
