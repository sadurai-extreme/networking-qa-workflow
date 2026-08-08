# Quick Start: Chat Assistant Testing

## 🚀 Test Locally (Recommended First)

### 1. Start Backend with Chat Support

```bash
cd backend
node src/server.js
```

Check logs for:
```
Chat assistant tables initialized successfully
```

### 2. Test API Endpoints

Create a test script `test-chat.js`:

```javascript
const axios = require('axios');

async function testChat() {
  const BASE_URL = 'http://localhost:5100';
  
  // 1. Start session
  console.log('1️⃣ Starting chat session...');
  const sessionRes = await axios.post(`${BASE_URL}/api/chat/session/start`, {
    workflow_id: 'test-workflow',
    stage_number: 2
  });
  
  const sessionId = sessionRes.data.session_id;
  console.log('✅ Session started:', sessionId);
  console.log('👋 Welcome:', sessionRes.data.welcome_message);
  
  // 2. Send message
  console.log('\n2️⃣ Sending message...');
  const msgRes = await axios.post(`${BASE_URL}/api/chat/send`, {
    session_id: sessionId,
    message: 'I need to test VLAN configuration with 2-node topology'
  });
  
  console.log('🤖 AI Response:', msgRes.data.response);
  console.log('📊 Extracted:', msgRes.data.extracted_data);
  
  // 3. Get history
  console.log('\n3️⃣ Getting chat history...');
  const historyRes = await axios.get(`${BASE_URL}/api/chat/history/${sessionId}`);
  console.log('💬 Messages:', historyRes.data.messages.length);
  
  // 4. Complete session
  console.log('\n4️⃣ Completing session...');
  const completeRes = await axios.post(`${BASE_URL}/api/chat/session/complete`, {
    session_id: sessionId
  });
  
  console.log('✅ Summary:', completeRes.data.summary);
  console.log('📋 Requirements:', completeRes.data.requirements);
}

testChat().catch(console.error);
```

Run:
```bash
node test-chat.js
```

### 3. Test Frontend Component

Add to any page temporarily:

```javascript
import ChatPanel from './components/shared/ChatPanel';

function TestPage() {
  return (
    <ChatPanel 
      workflowId="test-123"
      stageNumber={2}
      context={{}}
      onRequirementsExtracted={(data) => console.log('Got requirements:', data)}
    />
  );
}
```

---

## 🌐 Test on Remote Server

### 1. Quick Deploy (All-in-One)

```powershell
# Deploy everything
scp backend/src/routes/chat.js backend/src/db/database.js backend/src/server.js root@10.127.26.9:~/networking-qa-workflow/backend/src/

scp -r frontend/src/components/shared/ChatPanel.* root@10.127.26.9:~/networking-qa-workflow/frontend/src/components/shared/

# Restart backend
ssh root@10.127.26.9 'cd ~/networking-qa-workflow/backend && source ~/.nvm/nvm.sh && nvm use 16 && pkill -f "node src/server.js" && nohup node src/server.js > backend.log 2>&1 &'

# Wait and verify
Start-Sleep -Seconds 5
ssh root@10.127.26.9 "curl -s http://localhost:5100/api/health && sqlite3 ~/networking-qa-workflow/backend/data/qa_workflow.db '.tables' | grep chat"
```

### 2. Test Remote Chat

```powershell
# Get auth token first
$login = ssh root@10.127.26.9 "curl -s -X POST http://localhost:5100/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"extreme\",\"password\":\"YOUR_PASSWORD\"}'"
$token = ($login | ConvertFrom-Json).token

# Start chat session
ssh root@10.127.26.9 "curl -s -X POST http://localhost:5100/api/chat/session/start \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer $token' \
  -d '{\"workflow_id\":\"test-workflow\",\"stage_number\":2}'"
```

---

## ✅ Verification Checklist

### Backend
- [ ] Backend runs without errors
- [ ] Chat tables created (chat_sessions, chat_messages, chat_files)
- [ ] /api/chat/session/start returns welcome message
- [ ] /api/chat/send returns AI response
- [ ] Claude API key is valid

### Frontend  
- [ ] ChatPanel component imports successfully
- [ ] Chat button appears on page
- [ ] Clicking button opens chat panel
- [ ] Can send messages and receive responses
- [ ] File upload works
- [ ] Export chat works

### Database
- [ ] Query chat_sessions returns data
- [ ] Query chat_messages shows conversations
- [ ] Extracted requirements are stored

---

## 🎭 Demo Scenario

### Full Chat Workflow Test

**User Story**: Generate skill file for VLAN testing

1. **Start Chat**
   - Click chat button
   - AI welcomes with context about JIRA story

2. **User**: "I need to test VLAN configuration"
   - AI asks about CLI commands and topology

3. **User**: "The commands are create vlan 100 and show vlan. I need 2-node topology"
   - AI confirms and asks about test scenarios

4. **User**: Uploads topology.txt file
   - AI analyzes file and confirms setup

5. **User**: "Generate the skill file"
   - AI summarizes requirements and triggers generation

6. **Result**: 
   - Requirements extracted
   - Skill file generation API called
   - Chat history saved

---

## 🐛 Quick Debug

If something doesn't work:

```bash
# Check backend logs
ssh root@10.127.26.9 "tail -50 ~/networking-qa-workflow/backend/backend.log"

# Check database
ssh root@10.127.26.9 "sqlite3 ~/networking-qa-workflow/backend/data/qa_workflow.db 'SELECT * FROM chat_sessions ORDER BY started_at DESC LIMIT 1;'"

# Check Claude API
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend && grep ANTHROPIC .env"

# Restart backend
ssh root@10.127.26.9 'pkill -f "node src/server.js" && cd ~/networking-qa-workflow/backend && source ~/.nvm/nvm.sh && nvm use 16 && nohup node src/server.js > backend.log 2>&1 &'
```

---

## 🎉 Success!

If you see:
- ✅ Chat button appears
- ✅ Welcome message shows
- ✅ AI responds to questions
- ✅ Requirements are extracted

**You're ready to go!** 🚀

Next: Integrate into actual Stage 2 and Stage 3 pages
