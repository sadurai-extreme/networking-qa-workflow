const fs = require('fs');
const path = require('path');

// Simple file-based approach - copy to backend src directory where server can access
const skillContent = fs.readFileSync(path.join(__dirname, '../data/default_skills/skill-EXOS-37069.md'), 'utf8');

// Save to a temp file that the frontend can trigger upload from
const outputPath = path.join(__dirname, 'temp-skill-EXOS-37069.txt');
fs.writeFileSync(outputPath, skillContent, 'utf8');

console.log('✅ Skill file prepared for upload');
console.log('📄 Size:', skillContent.length, 'characters');
console.log('📁 Location:', outputPath);
console.log('\n💡 To upload: Refresh dashboard and click "Regenerate" button');
console.log('   OR: Use the backend API endpoint to upload this file');
