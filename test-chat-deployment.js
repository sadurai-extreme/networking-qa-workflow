const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

async function testChatAPI() {
  try {
    console.log('Testing Chat API...\n');
    
    // Test 1: Start session
    const response = await axios.post('http://localhost:5100/api/chat/session/start', {
      workflow_id: '5abb4f48-2839-4b81-8836-24d4203338d5',
      stage_number: 2
    });
    
    console.log('✅ Chat API Working!');
    console.log('\nSession ID:', response.data.session_id);
    console.log('\nWelcome Message:');
    console.log(response.data.welcome_message);
    console.log('\nSuggested Questions:', response.data.suggested_questions);
    
    // Test 2: Verify database
    console.log('\n---\nVerifying database...');
    const db = new Database(path.resolve(__dirname, 'data/qa_workflow.db'));
    const sessions = db.prepare('SELECT * FROM chat_sessions').all();
    console.log('✅ Chat sessions in DB:', sessions.length);
    db.close();
    
    console.log('\n🎉 Chat Assistant Deployment Successful!');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testChatAPI();
