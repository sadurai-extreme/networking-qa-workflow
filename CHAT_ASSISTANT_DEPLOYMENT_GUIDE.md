# AI Chat Assistant - Deployment Guide

**Created**: July 25, 2026  
**Feature**: Interactive AI-powered chat for requirements gathering  
**Stages**: 2 (Skill Files) & 3 (Test Plans)

---

## 📋 Deployment Checklist

### Phase 1: Backend Deployment

#### 1. Database Schema
```bash
# The schema is automatically created on server restart
# Tables created:
# - chat_sessions
# - chat_messages
# - chat_files
```

**Verify tables created:**
```bash
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend/data && sqlite3 qa_workflow.db '.tables' | grep chat"
```

Expected output:
```
chat_files    chat_messages    chat_sessions
```

#### 2. Deploy Backend Files

**a) Deploy chat routes:**
```powershell
scp backend/src/routes/chat.js root@10.127.26.9:~/networking-qa-workflow/backend/src/routes/
```

**b) Deploy updated database.js:**
```powershell
scp backend/src/db/database.js root@10.127.26.9:~/networking-qa-workflow/backend/src/db/
```

**c) Deploy updated server.js:**
```powershell
scp backend/src/server.js root@10.127.26.9:~/networking-qa-workflow/backend/src/
```

#### 3. Restart Backend

```powershell
ssh root@10.127.26.9 'kill $(ps aux | grep "node src/server.js" | grep -v grep | awk "{print \$2}") && cd ~/networking-qa-workflow/backend && source ~/.nvm/nvm.sh && nvm use 16 && nohup node src/server.js > backend.log 2>&1 &'
```

Wait 5 seconds, then verify:
```powershell
ssh root@10.127.26.9 "ps aux | grep 'node src/server.js' | grep -v grep && echo '' && curl -s http://localhost:5100/api/health"
```

#### 4. Verify Database Schema

```powershell
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend/data && sqlite3 qa_workflow.db 'PRAGMA table_info(chat_sessions);'"
```

Expected columns:
```
0|id|TEXT|0||1
1|workflow_id|TEXT|1||0
2|stage_number|INTEGER|1||0
3|started_at|DATETIME|0|CURRENT_TIMESTAMP|0
4|ended_at|DATETIME|0||0
5|status|TEXT|0|'active'|0
6|summary|TEXT|0||0
7|extracted_requirements|TEXT|0||0
```

---

### Phase 2: Frontend Deployment

#### 1. Deploy Components

```powershell
# Create shared directory if not exists
ssh root@10.127.26.9 'mkdir -p ~/networking-qa-workflow/frontend/src/components/shared'

# Deploy ChatPanel component
scp frontend/src/components/shared/ChatPanel.jsx root@10.127.26.9:~/networking-qa-workflow/frontend/src/components/shared/
scp frontend/src/components/shared/ChatPanel.css root@10.127.26.9:~/networking-qa-workflow/frontend/src/components/shared/
```

#### 2. Build Frontend (Local)

Due to Node.js version constraints on the server, build locally:

```powershell
cd frontend
npm run build
```

#### 3. Deploy Built Frontend

```powershell
# Deploy dist folder
scp -r frontend/dist/* root@10.127.26.9:~/networking-qa-workflow/frontend/dist/
```

#### 4. Restart Frontend

```powershell
ssh root@10.127.26.9 'pkill -f "serve dist" && cd ~/networking-qa-workflow/frontend && nohup npx serve dist -l 5101 -n > frontend.log 2>&1 &'
```

---

## 🧪 Testing

### Test 1: Health Check

```bash
curl http://10.127.26.9:5100/api/health
```

Expected: `{"status":"ok","timestamp":"..."}`

### Test 2: Start Chat Session

```bash
curl -X POST http://10.127.26.9:5100/api/chat/session/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "workflow_id": "test-workflow-id",
    "stage_number": 2
  }'
```

Expected response:
```json
{
  "session_id": "uuid",
  "welcome_message": "Hi! I'm here to help you generate...",
  "suggested_questions": ["What feature are you testing?", ...]
}
```

### Test 3: Send Message

```bash
curl -X POST http://10.127.26.9:5100/api/chat/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "session_id": "session-uuid",
    "message": "I need to test VLAN configuration"
  }'
```

### Test 4: Get Chat History

```bash
curl http://10.127.26.9:5100/api/chat/history/session-uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 5: Upload File

```bash
curl -X POST http://10.127.26.9:5100/api/chat/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "session_id=session-uuid" \
  -F "file=@topology.txt"
```

### Test 6: Export Chat

```bash
curl "http://10.127.26.9:5100/api/chat/export/session-uuid?format=markdown" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o chat-export.md
```

### Test 7: Complete Session

```bash
curl -X POST http://10.127.26.9:5100/api/chat/session/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "session_id": "session-uuid"
  }'
```

---

## 🎨 Frontend Integration Examples

### Example 1: Stage 2 Integration

**File**: `frontend/src/components/stages/Stage2.jsx`

```javascript
import React, { useState } from 'react';
import { Switch, Space } from 'antd';
import ChatPanel from '../shared/ChatPanel';

const Stage2 = ({ workflow }) => {
  const [useChat, setUseChat] = useState(false);
  const [requirements, setRequirements] = useState({});

  const handleRequirementsExtracted = (data) => {
    setRequirements(data);
    // Auto-fill form with extracted data
    // or proceed directly to generation
  };

  return (
    <div>
      <h2>Stage 2: Skill File Generation</h2>
      
      {/* Mode Toggle */}
      <Space>
        <span>Form Mode</span>
        <Switch checked={useChat} onChange={setUseChat} />
        <span>Chat Mode 💬</span>
      </Space>

      {/* Conditionally render form OR chat */}
      {useChat ? (
        <ChatPanel
          workflowId={workflow.id}
          stageNumber={2}
          context={{
            jiraStory: workflow.jira_story,
            commitData: workflow.commit_data,
          }}
          onRequirementsExtracted={handleRequirementsExtracted}
        />
      ) : (
        <div>
          {/* Existing questionnaire form */}
          <QuestionnaireForm />
        </div>
      )}
    </div>
  );
};

export default Stage2;
```

### Example 2: Stage 3 Integration

**File**: `frontend/src/components/stages/Stage3.jsx`

```javascript
import React, { useState } from 'react';
import { Switch, Space } from 'antd';
import ChatPanel from '../shared/ChatPanel';

const Stage3 = ({ workflow }) => {
  const [useChat, setUseChat] = useState(false);
  const [testPlanRequirements, setTestPlanRequirements] = useState({});

  const handleRequirementsExtracted = (data) => {
    setTestPlanRequirements(data);
    // Proceed with test plan generation using chat data
    generateTestPlan(data);
  };

  return (
    <div>
      <h2>Stage 3: Test Plan Generation</h2>
      
      {/* Mode Toggle */}
      <Space>
        <span>Form Mode</span>
        <Switch checked={useChat} onChange={setUseChat} />
        <span>Chat Mode 💬</span>
      </Space>

      {/* Conditionally render form OR chat */}
      {useChat ? (
        <ChatPanel
          workflowId={workflow.id}
          stageNumber={3}
          context={{
            skillFile: workflow.skill_file,
            topology: workflow.topology,
          }}
          onRequirementsExtracted={handleRequirementsExtracted}
        />
      ) : (
        <div>
          {/* Existing form */}
          <TestPlanForm />
        </div>
      )}
    </div>
  );
};

export default Stage3;
```

---

## 🔧 Configuration

### Environment Variables

Add to `.env` if needed:
```env
# Chat Assistant Configuration
CHAT_MAX_MESSAGES_PER_MINUTE=5
CHAT_MAX_FILE_SIZE=10485760  # 10MB
CHAT_ALLOWED_FILE_TYPES=jpeg,jpg,png,gif,txt,md,json,yaml,yml,pdf,docx
```

### Claude API Model

The chat uses `ANTHROPIC_MODEL_LIGHT` from `.env`:
```env
ANTHROPIC_MODEL_LIGHT=claude-sonnet-4-6
```

For cost optimization, you can switch to haiku:
```env
ANTHROPIC_MODEL_LIGHT=claude-haiku-4-1
```

---

## 📊 Monitoring

### Check Chat Activity

```sql
-- Active chat sessions
SELECT 
  cs.id,
  cs.workflow_id,
  cs.stage_number,
  cs.started_at,
  cs.status,
  COUNT(cm.id) as message_count
FROM chat_sessions cs
LEFT JOIN chat_messages cm ON cm.session_id = cs.id
WHERE cs.status = 'active'
GROUP BY cs.id
ORDER BY cs.started_at DESC;
```

### Check Recent Messages

```sql
-- Recent chat messages
SELECT 
  cm.timestamp,
  cs.workflow_id,
  cs.stage_number,
  cm.role,
  SUBSTR(cm.content, 1, 100) as content_preview
FROM chat_messages cm
JOIN chat_sessions cs ON cs.id = cm.session_id
ORDER BY cm.timestamp DESC
LIMIT 20;
```

### Check Extracted Requirements

```sql
-- Sessions with extracted requirements
SELECT 
  workflow_id,
  stage_number,
  started_at,
  ended_at,
  summary,
  extracted_requirements
FROM chat_sessions
WHERE extracted_requirements IS NOT NULL
ORDER BY ended_at DESC;
```

---

## 🚨 Troubleshooting

### Issue 1: Chat session not starting

**Symptom**: POST /api/chat/session/start returns error

**Check**:
```bash
# Verify backend is running
ssh root@10.127.26.9 "curl -s http://localhost:5100/api/health"

# Check backend logs
ssh root@10.127.26.9 "tail -50 ~/networking-qa-workflow/backend/backend.log | grep -i chat"

# Verify tables exist
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend/data && sqlite3 qa_workflow.db '.tables' | grep chat"
```

**Solution**:
- Restart backend to create tables
- Check ANTHROPIC_API_KEY is set in .env

### Issue 2: AI not responding

**Symptom**: Messages sent but no AI response

**Check**:
```bash
# Check Claude API key
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend && grep ANTHROPIC_API_KEY .env"

# Check logs for API errors
ssh root@10.127.26.9 "tail -100 ~/networking-qa-workflow/backend/backend.log | grep -i anthropic"
```

**Solution**:
- Verify API key is valid
- Check API rate limits
- Verify model name is correct

### Issue 3: File upload failing

**Symptom**: File upload returns error

**Check**:
```bash
# Verify upload directory exists
ssh root@10.127.26.9 "ls -la ~/networking-qa-workflow/uploads/chat"

# Check permissions
ssh root@10.127.26.9 "ls -ld ~/networking-qa-workflow/uploads/chat"
```

**Solution**:
```bash
# Create directory with correct permissions
ssh root@10.127.26.9 "mkdir -p ~/networking-qa-workflow/uploads/chat && chmod 755 ~/networking-qa-workflow/uploads/chat"
```

### Issue 4: Frontend chat panel not appearing

**Symptom**: Chat button doesn't show or clicking does nothing

**Check**:
- Browser console for JavaScript errors
- Network tab for failed API requests
- Component import path is correct

**Solution**:
```bash
# Rebuild frontend
cd frontend
npm run build

# Redeploy
scp -r dist/* root@10.127.26.9:~/networking-qa-workflow/frontend/dist/
```

---

## 📈 Success Metrics

After deployment, track:

1. **Adoption Rate**: % of users choosing chat over forms
   ```sql
   SELECT 
     COUNT(DISTINCT cs.workflow_id) as chat_users,
     (SELECT COUNT(DISTINCT workflow_id) FROM workflows) as total_users,
     ROUND(100.0 * COUNT(DISTINCT cs.workflow_id) / (SELECT COUNT(DISTINCT workflow_id) FROM workflows), 2) as adoption_percentage
   FROM chat_sessions cs
   WHERE cs.started_at >= date('now', '-30 days');
   ```

2. **Completion Rate**: % of sessions that complete successfully
   ```sql
   SELECT 
     COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
     COUNT(*) as total,
     ROUND(100.0 * COUNT(CASE WHEN status = 'completed' THEN 1 END) / COUNT(*), 2) as completion_rate
   FROM chat_sessions
   WHERE started_at >= date('now', '-30 days');
   ```

3. **Average Session Duration**:
   ```sql
   SELECT 
     AVG(JULIANDAY(ended_at) - JULIANDAY(started_at)) * 24 * 60 as avg_duration_minutes
   FROM chat_sessions
   WHERE status = 'completed'
     AND started_at >= date('now', '-30 days');
   ```

4. **Message Volume**:
   ```sql
   SELECT 
     DATE(timestamp) as date,
     COUNT(*) as messages,
     COUNT(DISTINCT session_id) as sessions
   FROM chat_messages
   WHERE timestamp >= date('now', '-30 days')
   GROUP BY DATE(timestamp)
   ORDER BY date DESC;
   ```

---

## 🎉 Deployment Complete!

**What's Working:**
✅ AI-powered chat assistant  
✅ Context-aware responses  
✅ File upload capability  
✅ Chat history persistence  
✅ Requirements extraction  
✅ Export functionality  

**Next Steps:**
1. Test with real users in Stage 2 and Stage 3
2. Collect feedback on AI responses
3. Monitor Claude API costs
4. Iterate on prompts for better extraction
5. Add more suggested questions
6. Implement rate limiting if needed

**Support:**
- Check logs: `ssh root@10.127.26.9 "tail -f ~/networking-qa-workflow/backend/backend.log"`
- Query database: See monitoring queries above
- Frontend debugging: Check browser console

---

**Status**: Ready for Production ✅  
**Deployment Date**: July 25, 2026  
**Feature Version**: 1.0
