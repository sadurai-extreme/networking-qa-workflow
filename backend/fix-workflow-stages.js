const db = require('./src/db/database');

// Update workflows that have jira_story_id but are still at stage 1
const result = db.prepare(`
  UPDATE workflows 
  SET current_stage = 2 
  WHERE current_stage = 1 
    AND jira_story_id IS NOT NULL
`).run();

console.log(`Updated ${result.changes} workflows to Stage 2`);

// Show all workflows
const workflows = db.prepare(`
  SELECT id, title, jira_story_id, current_stage, status 
  FROM workflows 
  ORDER BY created_at DESC
`).all();

console.log('\nCurrent workflows:');
workflows.forEach(w => {
  console.log(`- ${w.jira_story_id || 'No Story'}: Stage ${w.current_stage}, Status: ${w.status}`);
});
