# NOS QA Workflow Tool

## Overview
A 9-stage QA workflow tool for qualifying NOS (Network Operating System) API endpoints and Feature Functionality. Features a modern dashboard interface with Jira integration for release and story management.

## Stack
- **Frontend:** React + Vite + Ant Design + React Router
- **Backend:** Node.js + Express + Socket.io
- **Database:** SQLite (better-sqlite3)
- **LLM:** Ollama (local) or GitHub Models API (gpt-4o)
- **Integrations:** Jira, qTest, FA Regression Portal

## Key Features
- 🎯 **Separate pages for each workflow stage** with routing
- 📊 **Main dashboard** with workflow overview and statistics
- 🔗 **Direct Jira integration** - Select EXOS releases and fetch stories
- 🚀 **One-click workflow creation** from Jira stories
- 💬 **Real-time updates** via WebSocket
- 👥 **Multi-user collaboration** with co-user reviews
- 🤖 **LLM-powered generation** for skill files, test plans, and TCL scripts
- 📈 **Progress tracking** with visual stage indicators

## Setup

### 1. Configure Environment
Copy and fill in your credentials:
```
backend\.env  — set JIRA_PROJECT, JIRA_BASE_URL, JIRA_API_TOKEN, QTEST_*, FA_PORTAL_*
frontend\.env — set VITE_API_URL, VITE_WS_URL
```

**Important Backend Environment Variables:**
```env
# Jira Integration (Required for release/story fetching)
JIRA_PROJECT=NOS
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_API_TOKEN=your_jira_api_token

# LLM Configuration
OLLAMA_URL=http://localhost:11434/v1
LLM_MODEL_HEAVY=llama3.1:8b
LLM_MODEL_LIGHT=llama3.1:8b
```

**Note:** The tool works with mock data if Jira is not configured.

### 2. Add ISO Template
Place your ISO test plan template at:
```
templates\iso_testplan_template.docx
```

### 3. Start the Tool
```powershell
.\start.ps1
```
Or manually:
```powershell
# Terminal 1 - Backend
cd backend; npm start

# Terminal 2 - Frontend
cd frontend; npm run dev
```

### 4. Open Browser
```
http://localhost:5173
```

## Application Structure

### Routes
- `/` - Main dashboard with release selector and workflow overview
- `/workflow/:id/stage/:num` - Individual stage pages (1-9)
- `/admin` - Admin dashboard (admin users only)

### Navigation
- **Dashboard** - View all active/completed workflows, select EXOS release to see stories
- **Sidebar Menu** - Click stage items to navigate (enabled stages only)
- **Stage Progression** - Approval buttons advance to next stage automatically
- **Browser History** - Use back/forward buttons to navigate between stages

## 9-Stage Workflow
| Stage | Name | Description |
|---|---|---|
| 1 | Jira Story Selection | Browse and select Jira stories by release |
| 2 | Skill File Generation | LLM generates skill file from story + references |
| 3 | Test Plan Generation | Auto-generate or upload test plan (See [Test Plan Generator](#test-plan-generator)) |
| 4 | Test Case Classification | TCL Agent classifies: Manual / Semi / Auto |
| 5 | ISO Formatting | Format to ISO .docx template |
| 6 | qTest Upload | Upload test cases to qTest |
| 7 | TCL Script Generation | Generate and review TCL scripts |
| 8 | Regression Execution | Run scripts, monitor live, push to FA Portal |
| 9 | Final Report | View results, export, and complete workflow |

## Test Plan Generator

Generate production-quality EXOS Functional Test Plans using AI-powered tools:

### 📚 Resources
- **[Test Plan Generation Guidelines](TEST_PLAN_GENERATION_GUIDELINES.md)** - Complete guide with best practices
- **[Quick Start Guide](TEST_PLAN_QUICK_START.md)** - Get started in 5 minutes
- **[Comparison & Analysis](TEST_PLAN_COMPARISON_AND_PROMPT.md)** - Official vs AI-generated analysis

### 🚀 Quick Start
```bash
# Interactive questionnaire
cd backend
node collect-test-plan-info.js
```

Or use conversational mode:
```
"Help me create a test plan for EXOS-39334"
```

### ⭐ Key Features
- ✅ Systematic information collection
- ✅ Matches official Extreme Networks format
- ✅ Includes setup configurations and CLI commands
- ✅ Generates sanity flags and cross-references
- ✅ Supports resilience and performance testing

See [TEST_PLAN_QUICK_START.md](TEST_PLAN_QUICK_START.md) for details.

## Integrations
- **Jira MCP** — Configure `JIRA_*` env vars
- **qTest MCP** — Configure `QTEST_*` env vars  
- **FA Regression Portal** — Configure `FA_PORTAL_*` env vars
- **GitHub Models API** — Set `GITHUB_TOKEN` with `models:read` scope
