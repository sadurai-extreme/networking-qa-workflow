# AI-Powered Chat Assistant - Design Document

**Date**: July 25, 2026  
**Feature**: Interactive Chat Window for Requirements Gathering  
**Scope**: Stage 2 (Skill Files) and Stage 3 (Test Plans)

---

## 🎯 Overview

An AI-powered chat assistant that provides conversational interface for gathering user requirements during workflow stages. Users can choose between traditional forms or interactive chat to provide information.

### Key Features

- ✅ **AI-Powered**: Uses Claude API for intelligent, context-aware responses
- ✅ **Context Awareness**: Knows current workflow, stage, documents, and history
- ✅ **Floating UI**: Non-intrusive panel that can be opened/closed
- ✅ **Persistent History**: Chat logs saved with workflow for traceability
- ✅ **File Upload**: Users can upload files during conversation
- ✅ **Export**: Download chat history as text or JSON
- ✅ **Optional**: Coexists with existing forms - users choose their preference

---

## 📊 Database Schema

### New Tables

#### 1. chat_sessions
```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  stage_number INTEGER NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  status TEXT DEFAULT 'active', -- active, completed, abandoned
  summary TEXT, -- AI-generated summary of session
  extracted_requirements TEXT, -- JSON of extracted requirements
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

#### 2. chat_messages
```sql
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  context_used TEXT, -- JSON of context available to AI
  files_attached TEXT, -- JSON array of file references
  metadata TEXT, -- JSON for additional data
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
);
```

#### 3. chat_files
```sql
CREATE TABLE chat_files (
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
```

---

## 🔌 Backend API Design

### Base Path: `/api/chat`

#### 1. **POST /api/chat/session/start**
Start a new chat session

**Request:**
```json
{
  "workflow_id": "uuid",
  "stage_number": 2
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "welcome_message": "Hi! I'm your AI assistant for generating skill files...",
  "suggested_questions": [
    "What features need testing?",
    "Are there any topology requirements?",
    "Which CLI commands are involved?"
  ]
}
```

#### 2. **POST /api/chat/send**
Send a message and get AI response

**Request:**
```json
{
  "session_id": "uuid",
  "message": "User's question or statement",
  "files": ["file_id_1", "file_id_2"]
}
```

**Response:**
```json
{
  "message_id": "uuid",
  "response": "AI's response text",
  "follow_up_questions": ["Question 1?", "Question 2?"],
  "extracted_data": {
    "feature_type": "VLAN",
    "topology_needed": true
  },
  "confidence": 0.85
}
```

#### 3. **GET /api/chat/history/:session_id**
Get chat history for a session

**Response:**
```json
{
  "session_id": "uuid",
  "messages": [
    {
      "id": "msg1",
      "role": "assistant",
      "content": "Welcome message",
      "timestamp": "2026-07-25T10:00:00Z"
    },
    {
      "id": "msg2",
      "role": "user",
      "content": "I need to test VLAN configuration",
      "timestamp": "2026-07-25T10:01:00Z",
      "files": ["topology.png"]
    }
  ]
}
```

#### 4. **POST /api/chat/upload**
Upload files in chat

**Request:** Multipart form data
- `session_id`: string
- `file`: file upload

**Response:**
```json
{
  "file_id": "uuid",
  "filename": "topology.png",
  "url": "/uploads/chat/topology.png",
  "analysis": "Detected 2-node topology with VOSS switches"
}
```

#### 5. **GET /api/chat/export/:session_id**
Export chat history

**Query Params:**
- `format`: "text" | "json" | "markdown"

**Response:** File download

#### 6. **POST /api/chat/session/complete**
Mark session as complete and extract requirements

**Request:**
```json
{
  "session_id": "uuid"
}
```

**Response:**
```json
{
  "summary": "User wants to test VLAN configuration with 2-node topology...",
  "requirements": {
    "feature_type": "VLAN Configuration",
    "topology": "2-node VOSS",
    "cli_commands": ["create vlan 100", "show vlan"],
    "user_instructions": "Test VLAN creation and verification"
  },
  "ready_for_generation": true
}
```

---

## 🎨 Frontend Components

### 1. ChatPanel.jsx (Main Component)

**Location**: `frontend/src/components/shared/ChatPanel.jsx`

**Props:**
```javascript
{
  workflowId: string,
  stageNumber: number,
  context: {
    jiraStory: object,
    existingDocuments: array,
    commitData: array
  },
  onRequirementsExtracted: (requirements) => void,
  onClose: () => void
}
```

**Features:**
- Floating panel (bottom-right corner)
- Draggable header
- Minimize/maximize
- Unread message indicator
- Typing indicator for AI

**UI Structure:**
```
┌─────────────────────────────┐
│ 🤖 AI Assistant      [_][×] │ ← Header
├─────────────────────────────┤
│ Welcome! I'm here to help   │
│ you generate skill files.   │ ← Chat Messages
│                              │   (scrollable)
│ User: I need VLAN tests      │
│                              │
│ Assistant: Great! Can you... │
├─────────────────────────────┤
│ [📎] Type your message...    │ ← Input Area
│                    [Send →] │
└─────────────────────────────┘
```

### 2. ChatMessage.jsx

Individual message component with:
- User/assistant avatar
- Timestamp
- Message content with markdown support
- Attached files preview
- Copy button

### 3. ChatInput.jsx

Input component with:
- Text input (auto-expanding)
- File upload button
- Send button
- Character count
- Emoji picker (optional)

### 4. ChatFileUpload.jsx

File upload component:
- Drag-and-drop zone
- File type validation
- Progress indicator
- Preview for images
- AI analysis of uploaded files

### 5. ChatToggle.jsx

Toggle button to switch between form and chat modes:
```
[ Form Mode ] ←→ [ Chat Mode ]
```

---

## 🧠 AI Context System

### Stage 2 (Skill File Generation) Context

When user chats in Stage 2, AI has access to:

```javascript
{
  "stage": 2,
  "workflow": {
    "id": "uuid",
    "jira_story_id": "EXOS-12345",
    "title": "Story title",
    "description": "Story description"
  },
  "available_data": {
    "commit_data": {
      "commits": [...],
      "files_changed": [...],
      "functions_modified": [...]
    },
    "existing_skill_files": [...],
    "cli_documentation": [...]
  },
  "previous_messages": [...],
  "user_goal": "Generate skill file for testing"
}
```

**AI System Prompt for Stage 2:**
```
You are an expert QA assistant helping generate skill files for network testing.

Context:
- JIRA Story: {story.id} - {story.title}
- Code Changes: {commitData.summary}
- Available Skill Files: {skillFiles.count}

Your role:
1. Ask clarifying questions about test requirements
2. Understand feature scope and testing needs
3. Extract: feature type, CLI commands, topology requirements
4. Provide helpful suggestions based on similar skill files
5. Guide user to provide complete information

Be conversational, helpful, and concise. Ask one question at a time.
```

### Stage 3 (Test Plan Generation) Context

```javascript
{
  "stage": 3,
  "workflow": {
    "id": "uuid",
    "skill_file": {
      "content": "...",
      "feature_type": "VLAN",
      "cli_commands": [...]
    }
  },
  "available_data": {
    "topology_files": [...],
    "existing_test_plans": [...],
    "similar_features": [...]
  },
  "previous_messages": [...]
}
```

**AI System Prompt for Stage 3:**
```
You are an expert QA assistant helping generate test plans.

Context:
- Skill File: {skillFile.summary}
- Feature Type: {feature.type}
- Topology: {topology.description}

Your role:
1. Understand test coverage requirements
2. Ask about positive/negative test scenarios
3. Clarify boundary conditions and edge cases
4. Extract: test objectives, prerequisites, expected results
5. Suggest test scenarios based on feature type

Be thorough but concise. Focus on test completeness.
```

---

## 🔄 Integration with Existing UI

### Stage 2 Integration

**File**: `frontend/src/components/stages/Stage2.jsx`

**Changes:**
1. Add chat toggle button next to questionnaire
2. Conditionally render form OR chat panel
3. Extract requirements from chat when switching to form
4. Pass chat-extracted data to skill generation API

**UI Layout:**
```
┌──────────────────────────────────────┐
│  Stage 2: Skill File Generation      │
├──────────────────────────────────────┤
│  Mode: [ Form ] [ Chat 💬 ]          │
├──────────────────────────────────────┤
│  [Form fields OR Chat panel]         │
│                                       │
│  [...questionnaire or chat UI...]    │
│                                       │
└──────────────────────────────────────┘
```

### Stage 3 Integration

**File**: `frontend/src/components/stages/Stage3.jsx`

Similar integration pattern:
- Chat toggle
- Conditional rendering
- Requirements extraction
- Pass to test plan generation

---

## 📦 Implementation Phases

### Phase 1: Backend Foundation (Day 1)
- ✅ Database schema (3 tables)
- ✅ Chat session management
- ✅ Message storage and retrieval
- ✅ Claude API integration
- ✅ Context building utilities

### Phase 2: Basic Chat UI (Day 2)
- ✅ ChatPanel component (floating)
- ✅ ChatMessage component
- ✅ ChatInput component
- ✅ WebSocket for real-time updates
- ✅ Basic styling

### Phase 3: AI Intelligence (Day 3)
- ✅ Context-aware prompts
- ✅ Stage-specific AI behavior
- ✅ Requirements extraction
- ✅ Follow-up question generation
- ✅ Confidence scoring

### Phase 4: File Upload (Day 4)
- ✅ File upload API
- ✅ ChatFileUpload component
- ✅ File analysis (topology, documents)
- ✅ File preview in chat

### Phase 5: Integration (Day 5)
- ✅ Stage 2 integration
- ✅ Stage 3 integration
- ✅ Form ↔ Chat mode switching
- ✅ Data synchronization

### Phase 6: Export & Polish (Day 6)
- ✅ Export chat history
- ✅ Session summary generation
- ✅ UI polish and animations
- ✅ Error handling
- ✅ Loading states

---

## 🧪 Testing Strategy

### Unit Tests
- Message storage/retrieval
- Context building
- Requirements extraction
- File upload handling

### Integration Tests
- Chat session lifecycle
- AI response generation
- Form ↔ Chat data sync
- Export functionality

### User Testing Scenarios
1. Generate skill file using only chat
2. Start with form, switch to chat
3. Upload topology file in chat
4. Export chat history
5. Abandon and resume chat session

---

## 📝 Example Chat Flow

### Stage 2: Skill File Generation

**Assistant**: Hi! I'm here to help you generate a skill file for EXOS-39369. I've already reviewed the JIRA story about bypassing netlogin authentication in Fabric Attach. What would you like to test specifically?

**User**: I need to test the new bypass configuration command

**Assistant**: Great! I found that the changes involve `lldp_cli.c` and `lldp_netlogin.c` files. Here's what I understand:
- Feature: Fabric Attach netlogin bypass
- Files modified: 2 C files
- CLI command: Likely `configure lldp netlogin bypass`

Can you confirm:
1. What's the exact CLI command to configure the bypass?
2. Do we need any specific topology (e.g., 2-node with VOSS + switch)?

**User**: Yes, the command is `configure fabricattach zero-touch-client netlogin bypass enable`

**Assistant**: Perfect! ✅ I've captured that. For the topology:
- Do you need a specific switch configuration?
- Should we test with netlogin enabled/disabled scenarios?

**User**: *uploads topology.txt*

**Assistant**: Thanks! I analyzed your topology file. I see:
- DUT1: VOSS switch (FA ZTC server)
- DUT2: Client switch
- Netlogin configured on DUT1

This looks good for testing the bypass feature. 

Shall I proceed to generate the skill file with:
- Feature: FA ZTC netlogin bypass
- CLI: `configure fabricattach zero-touch-client netlogin bypass enable`
- Topology: 2-node (VOSS + client)
- Test scenarios: With/without netlogin

**User**: Yes, generate it

**Assistant**: ✅ Generating skill file with all the information we discussed...

*[System extracts requirements and triggers skill file generation]*

---

## 🔐 Security Considerations

1. **Authentication**: All chat endpoints require valid JWT token
2. **Rate Limiting**: Prevent AI API abuse (5 messages per minute per user)
3. **File Validation**: Strict file type and size limits
4. **Content Filtering**: No sensitive data in chat logs
5. **Session Isolation**: Users can only access their own chat sessions

---

## 💰 Cost Considerations

**Claude API Usage:**
- Average conversation: 10-15 messages
- Per message: ~500 tokens input + ~200 tokens output
- Cost per conversation: ~$0.02 - $0.05 (with claude-sonnet)

**Optimization:**
- Use lighter model (claude-haiku) for simple questions
- Cache context to reduce input tokens
- Implement conversation summary to compress history

---

## 🎯 Success Metrics

1. **Adoption**: % of users choosing chat over forms
2. **Completion**: % of chat sessions resulting in successful generation
3. **Efficiency**: Time saved compared to forms
4. **Quality**: Skill file quality from chat vs. forms
5. **Satisfaction**: User feedback on chat experience

---

## 🚀 Future Enhancements (Phase 2)

1. **Multi-user Chat**: Team collaboration in same session
2. **Voice Input**: Speech-to-text for hands-free operation
3. **Smart Suggestions**: Autocomplete based on history
4. **Template Library**: Quick-start templates via chat
5. **Advanced Analysis**: AI analyzes uploaded code/logs
6. **Chat Search**: Search across all chat histories
7. **Mobile App**: Chat on mobile devices
8. **Multilingual**: Support for multiple languages

---

## 📚 Documentation

- **User Guide**: How to use chat assistant
- **API Reference**: Chat endpoints documentation
- **Developer Guide**: Extending chat functionality
- **Prompt Engineering**: Best practices for AI prompts

---

**Status**: Ready for Implementation  
**Estimated Development Time**: 6 days  
**Priority**: High (Requested feature)
