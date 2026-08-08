const axios = require('axios');

async function testChat() {
  try {
    // Login first
    const login = await axios.post('http://localhost:5100/api/auth/login', {
      username: 'extreme',
      password: 'extreme'
    });
    const token = login.data.token;
    console.log('✅ Logged in successfully');

    // Set auth header for subsequent requests
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Get a workflow with skill file
    const workflow = await axios.get('http://localhost:5100/api/workflows');
    if (!workflow.data || workflow.data.length === 0) {
      console.log('❌ No workflows found');
      return;
    }

    const wf = workflow.data[0];
    console.log(`\n✅ Found workflow: ${wf.id}`);
    console.log(`   Story: ${wf.jira_story_id}`);

    // Start a chat session
    const session = await axios.post('http://localhost:5100/api/chat/session/start', {
      workflow_id: wf.id,
      stage_number: 2
    });

    console.log(`\n✅ Chat session started: ${session.data.session_id}`);
    console.log(`   Welcome: ${session.data.welcome_message.substring(0, 100)}...`);
    
    // Check if skill file content is in context
    if (session.data.context && session.data.context.skill_file_content) {
      console.log(`\n✅ Skill file content FOUND in context!`);
      console.log(`   Content length: ${session.data.context.skill_file_content.length} characters`);
      console.log(`   First 200 chars: ${session.data.context.skill_file_content.substring(0, 200)}...`);
    } else {
      console.log(`\n⚠️  No skill file content in context`);
      console.log(`   Context keys: ${Object.keys(session.data.context || {}).join(', ')}`);
    }

    // Test asking about the skill file
    console.log(`\n📤 Asking: "What's in my skill file?"`);
    const response = await axios.post('http://localhost:5100/api/chat/send', {
      session_id: session.data.session_id,
      message: "What's in my skill file?"
    });

    console.log(`\n✅ AI Response:`);
    console.log(`   ${response.data.response.substring(0, 300)}...`);

  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
  }
}

testChat();
