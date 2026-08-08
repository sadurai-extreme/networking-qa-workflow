# NOS QA Workflow Tool — Complete Technical Documentation

**Version:** 2.0  
**Date:** 2026-07-28  
**Project:** EXOS Networking QA Automation Workflow  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [Complete Workflow: Stage-by-Stage](#5-complete-workflow-stage-by-stage)
   - [Stage 1 — Jira Story Selection](#stage-1--jira-story-selection)
   - [Stage 2 — Skill File Generation](#stage-2--skill-file-generation)
   - [Stage 3 — Test Plan Generation](#stage-3--test-plan-generation)
   - [Stage 4 — Test Case Classification](#stage-4--test-case-classification)
   - [Stage 7 — TCL Script Generation](#stage-7--tcl-script-generation)
   - [Stage 8 — TC Execution](#stage-8--tc-execution)
   - [Stage 9 — Workflow Completion & Reporting](#stage-9--workflow-completion--reporting)
6. [AI Chat Advisor](#6-ai-chat-advisor)
7. [LLM Integration & Model Strategy](#7-llm-integration--model-strategy)
8. [Evaluation & Quality Techniques](#8-evaluation--quality-techniques)
9. [TCL Automation Framework Integration](#9-tcl-automation-framework-integration)
10. [Process Flow Diagrams](#10-process-flow-diagrams)
11. [API Reference Summary](#11-api-reference-summary)
12. [Security & Access Control](#12-security--access-control)
13. [Deployment Architecture](#13-deployment-architecture)

---

## 1. Project Overview

The **NOS QA Workflow Tool** is an end-to-end AI-assisted QA automation platform for EXOS networking software. It transforms a Jira feature story into a fully automated test execution cycle — generating skill files, test plans, TCL automation scripts, executing tests, and producing final reports — with LLM assistance at every stage.

### Core Objectives

| Objective | Description |
|-----------|-------------|
| **Speed** | Reduce test plan creation from days to hours using LLM generation |
| **Consistency** | Enforce EXOS QA standards via automated validation and normalization |
| **Automation** | Maximize TCL script automation rate through intelligent TC classification |
| **Traceability** | Full audit trail from Jira story → test execution → final report |
| **Quality** | Multi-layer AI evaluation with grading (A–F) at each generation stage |

### What Makes This Project Unique

- **Domain-specific LLM prompting** with EXOS TCL framework knowledge (3,746 procs, 552 files indexed)
- **Multi-layer quality pipeline**: Generation → Normalization → Validation → Evaluation → Human Review
- **Hybrid AI strategy**: Heavy models (Claude Opus) for generation; light models (Claude Sonnet) for classification and batch review
- **Vision AI for topology**: PDF topology diagrams analyzed using Claude vision API
- **In-context framework knowledge**: TCL Topology Guide and Traffic Patterns injected into every AI call
- **LLM drift mitigation**: JSON schema enforcement, retry logic, deduplication guards

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  React 18 + Vite  │  Ant Design UI  │  Zustand State       │
│  Port 5101  │  Served as static dist via Nginx              │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API + WebSocket (Socket.IO)
┌────────────────────────────▼────────────────────────────────┐
│                        BACKEND                               │
│  Node.js 16 (NVM)  │  Express.js  │  Port 5100              │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Routes   │  │ LLM      │  │ TCL      │  │ Auth     │   │
│  │ /stage1  │  │ callLLM()│  │ Index    │  │ JWT      │   │
│  │ /stage2  │  │ Anthropic│  │ 3746     │  │ RBAC     │   │
│  │ /stage3  │  │ SDK      │  │ procs    │  │          │   │
│  │ /stage4  │  │          │  │          │  │          │   │
│  │ /stage7  │  └──────────┘  └──────────┘  └──────────┘   │
│  │ /stage8  │                                               │
│  │ /stage9  │                                               │
│  │ /chat    │                                               │
│  └──────────┘                                               │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                       DATA LAYER                             │
│  SQLite (WAL mode)  │  better-sqlite3  │  Port: file-based  │
│  /backend/data/qa_workflow.db                                │
│                                                              │
│  + File Storage: /uploads/  (documents, scripts, chat files) │
│  + TCL Index:   /data/tcl_framework_docs/                    │
└─────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│  Anthropic Claude API  │  Jira REST API  │  qTest API       │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Technology | Role |
|-----------|-----------|------|
| Frontend | React 18, Vite, Ant Design | Stage UI, chat panel, file uploads, approval flows |
| Backend | Node.js 16, Express.js | API, LLM orchestration, document processing |
| Database | SQLite + better-sqlite3 | Persistent state, versioning, audit trail |
| LLM | Anthropic Claude (Opus + Sonnet) | Generation, classification, evaluation, chat, vision |
| TCL Index | JSON + Markdown | Framework knowledge base for AI prompting |
| File Store | Local filesystem | Uploaded docs, generated scripts, chat files |

---

## 3. Technology Stack

### Backend

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 16.20.2 (NVM) | Runtime |
| Express.js | 4.x | REST API framework |
| better-sqlite3 | latest | Synchronous SQLite driver |
| @anthropic-ai/sdk | latest | Claude API client |
| multer | latest | File upload handling |
| jsonwebtoken | latest | JWT authentication |
| bcryptjs | latest | Password hashing |
| socket.io | latest | Real-time WebSocket events |
| uuid | latest | ID generation |
| dotenvx | latest | Encrypted environment management |

### Frontend

| Component | Version | Purpose |
|-----------|---------|---------|
| React | 18.x | UI framework |
| Vite | latest | Build tool |
| Ant Design | 5.x | UI component library |
| Zustand | latest | State management |
| Axios | latest | HTTP client |
| React Router | 6.x | SPA routing |
| Recharts | latest | Charts (pie chart for execution results) |
| React Markdown | latest | Markdown rendering |

### AI Services

| Service | Model | Use Case |
|---------|-------|----------|
| Anthropic Claude | `claude-opus-4-8` | Skill file gen, test plan gen, script gen, TC fix |
| Anthropic Claude | `claude-sonnet-4-6` | TC classification, chat advisor, batch AI review |
| Claude Vision | `claude-sonnet-4-6` | Topology PDF diagram analysis |

### Infrastructure

| Component | Details |
|-----------|---------|
| OS | Ubuntu 18.04 (server at 10.127.26.9) |
| Python | 3.6 (server) — for DOCX extraction |
| poppler-utils | `pdftoppm` — PDF-to-image conversion |
| python-docx | DOCX text extraction |
| pdfminer.six | PDF text extraction (text-based PDFs) |

---

## 4. Database Schema

The system uses a single SQLite database with WAL mode. All tables are created with auto-migration support.

### Core Tables

#### `workflows`
Primary record for each QA workflow instance.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| title | TEXT | Derived from Jira story title |
| jira_story_id | TEXT | e.g., EXOS-38882 |
| jira_release | TEXT | e.g., 32.1.1 |
| jira_story_type | TEXT | Feature Functionality / NOS API Endpoint |
| jira_description | TEXT | Full story description |
| current_stage | INTEGER | Active stage number (1–9) |
| status | TEXT | active / completed |
| created_by | TEXT | User ID |
| created_at | DATETIME | |
| updated_at | DATETIME | |

#### `stages`
One record per stage per workflow (9 stages each).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| workflow_id | TEXT FK | Parent workflow |
| stage_number | INTEGER | 1–9 |
| status | TEXT | pending / active / completed |
| started_at | DATETIME | |
| completed_at | DATETIME | |
| data | TEXT | JSON payload (story details, stage-specific data) |

#### `documents`
All generated and uploaded documents with full version history.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| workflow_id | TEXT FK | |
| stage_number | INTEGER | Which stage produced this doc |
| doc_type | TEXT | skill_file / test_plan / test_plan_excel / iso_testplan / final_execution_report |
| filename | TEXT | Stored filename |
| filepath | TEXT | Relative path in /uploads/ |
| content | TEXT | Full markdown/text content |
| version | TEXT | Semantic version (1.0, 1.1, etc.) |
| revision_number | INTEGER | Sequential revision count |
| approved | INTEGER | 0/1 |
| approved_by | TEXT | User ID |
| approved_at | DATETIME | |
| created_by | TEXT | |
| change_summary | TEXT | What changed in this version |
| llm_model | TEXT | Which AI model generated it |
| llm_temperature | REAL | Temperature setting used |
| generation_timestamp | DATETIME | |
| validation_status | TEXT | passed / failed |
| validation_score | REAL | 0–100 |
| normalization_applied | INTEGER | 0/1 |
| created_at | DATETIME | |

#### `test_cases`
Individual test cases extracted from the test plan.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| workflow_id | TEXT FK | |
| tc_number | TEXT | e.g., 5.1.3 |
| title | TEXT | TC title |
| description | TEXT | Full TC content (steps, expected results) |
| classification | TEXT | Automatable / Semi-Automatable / Manual |
| qtest_id | TEXT | qTest system TC ID |
| status | TEXT | active / deleted |
| result | TEXT | pass / fail / blocked / not_run |
| created_at | DATETIME | |

### Version Control Tables

#### `document_versions`
Full version history for all documents.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| document_id | TEXT FK | Parent document |
| version_number | TEXT | Semantic version |
| content | TEXT | Full content snapshot |
| content_hash | TEXT | SHA256 hash for dedup |
| created_by | TEXT | |
| change_type | TEXT | initial / revision / amendment / regeneration |
| change_summary | TEXT | Human-readable change description |
| change_reason | TEXT | Why changed |
| parent_version_id | TEXT FK | Previous version (chain) |
| tags | TEXT | JSON array of tags |
| created_at | DATETIME | |

#### `document_changes`
Line-level diff tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | |
| version_id | TEXT FK | |
| change_type | TEXT | added / removed / modified |
| old_value | TEXT | Previous content |
| new_value | TEXT | New content |
| section | TEXT | Which section changed |
| line_number | INTEGER | |

### Execution Tables

#### `tcl_scripts`
Generated TCL automation scripts.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| workflow_id | TEXT FK | |
| test_case_id | TEXT FK | References test_cases |
| filename | TEXT | e.g., TC_5.1.3_snmpv3_auth.tcl |
| content | TEXT | Full TCL script content |
| review_status | TEXT | pending / approved / needs_improvement |
| review_feedback | TEXT | AI review feedback JSON |
| created_at | DATETIME | |

#### `tc_execution_results`
Per-test-case execution results from Stage 8.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| workflow_id | TEXT FK | |
| tc_number | TEXT | |
| result | TEXT | pass / fail / blocked / not_run |
| platform | TEXT | e.g., X460G2 |
| build | TEXT | e.g., 32.1.1.4 |
| session_id | TEXT FK | |
| executed_by | TEXT | User ID |
| notes | TEXT | Failure notes |
| executed_at | DATETIME | |

#### `execution_sessions`
Groups of test executions (a "test run").

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| workflow_id | TEXT FK | |
| platform | TEXT | |
| build | TEXT | |
| environment | TEXT | Lab / CI / Regression |
| started_by | TEXT | User ID |
| started_at | DATETIME | |

### Audit & Quality Tables

#### `audit_trail`
Immutable log of all significant actions.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| workflow_id | TEXT FK | |
| stage_number | INTEGER | |
| action | TEXT | Human-readable description |
| action_type | TEXT | generate / approve / override / reject / fix / complete |
| user_id | TEXT | |
| document_version | TEXT | Version at time of action |
| details | TEXT | JSON additional context |
| created_at | DATETIME | |

#### `approvals`
Stage approval records.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| workflow_id | TEXT FK | |
| stage_number | INTEGER | |
| user_id | TEXT | Who approved |
| action | TEXT | approved / rejected |
| notes | TEXT | |
| created_at | DATETIME | |

#### `document_validations`
Detailed quality validation results per document.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | |
| document_id | TEXT FK | |
| validation_score | REAL | 0–100 |
| validation_grade | TEXT | A–F |
| total_issues | INTEGER | |
| critical_issues | INTEGER | |
| major_issues | INTEGER | |
| minor_issues | INTEGER | |
| test_case_count | INTEGER | |
| issues_json | TEXT | Full issue list |
| statistics_json | TEXT | Detailed stats |
| recommendation | TEXT | AI recommendation |
| validated_at | DATETIME | |

### Chat Tables

#### `chat_sessions`
Chat advisor sessions per workflow/stage.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| workflow_id | TEXT FK | |
| stage_number | INTEGER | 2 or 3 |
| status | TEXT | active / completed |
| extracted_data | TEXT | JSON of requirements extracted |
| created_at | DATETIME | |

#### `chat_messages`
Individual messages in a chat session.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| session_id | TEXT FK | |
| role | TEXT | user / assistant |
| content | TEXT | Message text |
| context | TEXT | JSON context snapshot at time of message |
| created_at | DATETIME | |

#### `chat_files`
Files uploaded during chat sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| session_id | TEXT FK | |
| filename | TEXT | Original filename |
| filepath | TEXT | Storage path |
| file_type | TEXT | MIME type |
| file_size | INTEGER | Bytes |
| content | TEXT | Extracted text content (or vision analysis result) |
| created_at | DATETIME | |

---

## 5. Complete Workflow: Stage-by-Stage

### Workflow Stage Map

```
Stage 1 → Stage 2 → Stage 3 → Stage 4 → Stage 7 → Stage 8 → Stage 9
 Jira      Skill     Test       TC         Script    Execution  Report
 Story     File      Plan     Classify   Generation
```

> **Note:** Stages 5 (ISO Format) and 6 (qTest Upload) were deprecated and merged into Stage 9. The workflow advances directly from Stage 4 → Stage 7.

---

### Stage 1 — Jira Story Selection

**Purpose:** Entry point. Connect a Jira feature story to the QA workflow.

**Process Flow:**
```
User selects release → System queries Jira API → Stories listed → 
User selects story → Story details saved to workflow → Stage 1 complete
```

**Key Operations:**

1. **Release Fetch** (`GET /stage1/releases`)
   - Queries Jira NOS project for all fix-versions
   - Falls back to mock data if Jira unavailable

2. **Story Query** (`GET /stage1/stories?release=X`)
   - Queries Jira for stories in selected release
   - Returns: ID, title, description, status, priority, story type
   - Auto-detects story type:
     - Keywords "API", "endpoint", "REST" → **NOS API Endpoint**
     - Otherwise → **Feature Functionality**

3. **Story Selection** (`POST /stage1/select`)
   - Saves: `jira_story_id`, `jira_release`, `jira_story_type`, `title`, `jira_description`
   - Marks Stage 1 as `completed`
   - Logs to `audit_trail`

**LLM Usage:** None — purely Jira API.

**UI Features:**
- Release dropdown
- Story list with priority badges, type tags
- "Select Story" button → auto-advances to Stage 2

---

### Stage 2 — Skill File Generation

**Purpose:** Generate a comprehensive technical **Skill File** (markdown) that captures everything about the feature being tested — CLI commands, topology requirements, test scenarios, expected behaviors, and automation guidance.

**Process Flow:**
```
Upload reference docs (optional) → Configure additional context → 
Generate via LLM → Evaluate quality → Review & amend → Approve → Advance
```

**Key Operations:**

#### 2.1 Skill File Generation (`POST /stage2/generate`)

**Inputs:**
- `current_feature_spec` — Current EXOS feature specification (uploaded file)
- `existing_feature_spec` — Previous version of the spec (for enhancement context)
- `existing_test_plan` — Previous test plan (for reference)
- `additional_cli_commands` — Text area: extra CLI syntax not in spec
- `qa_feature_interactions` — Text area: QA-discovered feature interactions
- Chat session context (auto-injected from Stage 2 chat advisor)

**LLM Call:**
- **Model:** `claude-opus-4-8` (heavy)
- **System Prompt:** Expert EXOS technical writer; generate structured skill file covering: feature overview, CLI syntax, topology requirements, test scenarios, expected behaviors, automation hooks
- **Output:** Structured markdown with sections:
  - Feature Overview
  - CLI Commands & Syntax
  - Topology Requirements
  - Positive Test Scenarios
  - Negative Test Scenarios
  - Error Conditions
  - Automation Guidance
  - Platform Notes

**Post-Generation:**
- Saved to `documents` table (doc_type=`skill_file`, stage_number=2)
- Version stored in `document_versions`
- Metadata captured: `llmModel`, `llmVersion`, timestamp

#### 2.2 Skill File Regeneration (`POST /stage2/regenerate`)
- **Model:** `claude-opus-4-8`
- Takes user feedback text → updates existing skill file
- Returns complete updated document (not a diff)
- Saved as new version (revision_number incremented)

#### 2.3 Q&A Without Modification (`POST /stage2/query`)
- **Model:** `claude-sonnet-4-6`
- Answers questions about the skill file content
- Does NOT modify the document

#### 2.4 Skill File Evaluation (`POST /stage2/evaluate`)

**Model:** `claude-sonnet-4-6`

**Evaluation Dimensions:**
| Dimension | Weight | Description |
|-----------|--------|-------------|
| CLI Coverage | 25% | Are all relevant commands documented? |
| Topology Coverage | 20% | Topology types and port assignments described? |
| Error Conditions | 20% | Negative/boundary cases covered? |
| Scenario Relevance | 20% | Real-world testing scenarios? |
| Automation Readiness | 15% | Can QA automate from this spec? |

**Output:**
```json
{
  "grade": "B",
  "finalScore": 83,
  "categoryScores": { "cli_coverage": 90, "topology": 75, ... },
  "strengths": ["Complete CLI syntax", "..."],
  "weaknesses": ["Missing SNMP OID list", "..."],
  "recommendations": ["Add trap OID table", "..."],
  "summary": "Good skill file with minor gaps..."
}
```

**Grades:** A (90–100) | B (80–89) | C (70–79) | D (60–69) | F (<60)

#### 2.5 Other Operations
- **Reuse** (`POST /stage2/reuse`) — Copy skill file from another workflow for same Jira ID
- **Amend** (`PUT /stage2/amend`) — Manual edit; saved as new version
- **Approve** (`POST /stage2/approve`) — Records approval; allows Stage 3 access
- **Audit Trail** (`GET /stage2/audit-trail/:id`) — Full action history

**UI Features:**
- 3-tab document upload area
- Additional CLI text area
- QA interactions text area
- Integrated chat advisor (Stage 2 chat context)
- Real-time evaluation score display (A–F grade card)
- Version history modal
- Approve button with confirmation

---

### Stage 3 — Test Plan Generation

**Purpose:** Transform the Skill File into a comprehensive, structured **Test Plan** with numbered test cases, steps, expected results, and cleanup procedures. Supports multiple input modes and runs a multi-layer quality pipeline.

**Process Flow:**
```
Select coverage level → Upload optional supplementary docs → 
[Optional] Chat advisor to refine context → 
Generate via LLM → Normalize → Validate → Evaluate → 
Review & fix TCs → Amend → Approve → Advance
```

#### 3.1 Coverage Levels

| Level | Description | Typical TC Count |
|-------|-------------|------------------|
| SANITY | Critical path only; smoke tests | 10–20 TCs |
| STANDARD | Full functional coverage; default | 30–60 TCs |
| COMPREHENSIVE | Edge cases, boundaries, stress | 60–120+ TCs |

#### 3.2 Feature Types

| Type | Description |
|------|-------------|
| New Feature | Complete test plan from scratch |
| Enhancement | Add test cases to existing test plan; focuses on what changed |

#### 3.3 Supplementary Input Sources

| Input | Purpose |
|-------|---------|
| Unit Test Plan (dev) | Developer's unit test plan → AI generates complementary functional TCs |
| Functional One-liners | QA one-liner test list → AI expands into full TC format |
| Topology File (PDF/image) | Network diagram → analyzed by vision AI → topology-aware TCs |
| Topology Description | Text description of test setup |
| User Instructions | Free-form instructions to AI (e.g., "focus on SNMPv3 security modes") |
| Chat Session Context | Requirements gathered via chat advisor |

#### 3.4 Test Plan Generation (`POST /stage3/generate`)

**Model:** `claude-opus-4-8` (heavy, streaming=false)

**System Prompt Key Instructions:**
- Generate test cases following EXOS QA test plan format
- Number TCs as `X.Y.Z` (section.subsection.testcase)
- Each TC must have: Title, Prerequisites, Test Steps, Expected Results, Cleanup
- Include both positive (happy path) and negative (error/boundary) scenarios
- Mark automation hints based on available TCL framework procedures
- Reference topology data for port-specific tests

**Post-Generation Quality Pipeline:**

```
Generated Markdown
       │
       ▼
┌─────────────────┐
│  NORMALIZATION  │  Fix formatting, heading levels, table structure,
│  (auto-applied) │  TC numbering consistency
└────────┬────────┘
         │ changesCount, changesList
         ▼
┌─────────────────┐
│   VALIDATION    │  Score 0–100; check completeness, clarity,
│   (auto-run)    │  coverage, organization
└────────┬────────┘
         │ score, grade, issues[]
         ▼
┌─────────────────┐
│   DB STORAGE    │  documents + document_validations + test_cases
└─────────────────┘
```

**Normalization Checks:**
- Heading level consistency (H1→H2→H3 hierarchy)
- Table alignment and column consistency
- TC numbering (no gaps, no duplicates)
- CLI code block formatting
- Empty section removal

**Validation Scoring:**

| Issue Type | Point Deduction | Examples |
|------------|----------------|---------|
| Critical | -30 pts each | Missing expected results, incomplete steps, TC number gaps |
| Major | -15 pts each | Vague steps ("configure feature"), missing prerequisites, no cleanup |
| Minor | -5 pts each | Formatting inconsistency, non-standard headings |

**Pass Threshold:** Score ≥ 70 → `validation_status = 'passed'`

**Extracted Test Cases:**
After generation, all TCs are parsed from markdown and inserted into `test_cases` table:
```sql
INSERT INTO test_cases (id, workflow_id, tc_number, title, classification)
VALUES (uuid, workflow_id, '5.1.3', 'Verify SNMPv3 AuthPriv mode', 'pending')
```

#### 3.5 Dynamic Questionnaire (`POST /stage3/generate-questionnaire`)

When the user wants targeted context before generation:

**Model:** `claude-sonnet-4-6`

**For New Features:** Generates 6–8 questions covering:
- Primary use case and workflow
- Dynamic behavior (state changes, timers)
- Failure scenarios
- Integration with other features
- Boundary conditions
- Negative/error scenarios

**For Enhancements:** Generates 3–4 focused questions:
- What new behavior was added?
- What existing behavior changed?
- Backward compatibility concerns?

**Question Types:** text | textarea | select | multiselect | boolean  
**Output:** JSON array of question objects with options, placeholders, help text

#### 3.6 Individual TC Fix (`POST /stage3/fix-tc`)

**Model:** `claude-opus-4-8`

**Issue Types Handled:**
| Issue Type | What Happens |
|------------|-------------|
| `missing_steps` | AI generates missing test steps |
| `incorrect_steps` | AI rewrites steps to be accurate |
| `wrong_tc` | AI rewrites entire TC |
| `more_detail` | AI expands steps with more granularity |
| `manual_edit` | User provides direct replacement content |

**Process:**
1. Extract target TC block from markdown using regex
2. Send original TC + issue description to LLM
3. LLM returns corrected TC
4. Splice corrected TC back into full test plan
5. Save updated document as new revision

#### 3.7 Regenerate with Review Comments (`POST /stage3/regenerate-with-comments`)

**Model:** `claude-opus-4-8`

**Inputs:** Current test plan markdown + reviewer comments + optional updated supporting docs  
**Process:** LLM reviews all comments and regenerates complete test plan addressing each comment  
**Output:** New revision with `change_summary` noting which comments were addressed

#### 3.8 Chat-Driven Summary Review

After chat session completes:
1. AI extracts structured requirements from conversation
2. **Summary Modal** pops up showing captured fields:
   - test_objectives
   - positive_scenarios (array)
   - negative_scenarios (array)
   - topology_description
   - prerequisites
   - coverage_level
3. User clicks **"Generate Test Plan Now"** → triggers generation with extracted context
4. Or "Edit Manually" → dismisses modal, user can fill form manually

**UI Features:**
- Feature type selector (New / Enhancement)
- Coverage level selector (SANITY / STANDARD / COMPREHENSIVE)
- 4 document upload slots
- Topology description text area
- User instructions text area
- Dynamic questionnaire (collapsible)
- Chat advisor panel (floating bottom-right)
- Chat summary modal (auto-popup on chat complete)
- Test plan viewer with markdown rendering
- TC fix modal (per-TC)
- Review comments input + Regenerate button
- Evaluation score display
- Download buttons (Markdown, DOCX, Excel)
- Approve & Proceed button

---

### Stage 4 — Test Case Classification

**Purpose:** Classify every test case as **Automatable**, **Semi-Automatable**, or **Manual** based on available TCL framework capabilities. Enable interactive AI advisor to fix and reclassify TCs.

**Process Flow:**
```
Load test cases from Stage 3 → Auto-classify all TCs via LLM →
Review classifications → Manual override if needed →
Chat advisor for TC improvements → Approve → Advance
```

#### 4.1 Auto-Classification (`POST /stage4/classify`)

**Model:** `claude-sonnet-4-6` (light)

**Framework Context Injected:**

The system injects a knowledge base of available TCL procedures:

```
AVAILABLE AUTOMATION PROCEDURES:
CLI:    SendCliCommand, CheckCliOutput, SendCliCommandEx
SNMP:   snmpget_authNoPriv, snmpset_authNoPriv, SnmpCheckKeyValue_snmp
        snmpHandleTraps, snmpget_Priv, snmpset_Priv  
Events: CheckReboot, RestartProcess, WaitForPort
Traffic: SendFrame (IXIA), SendIP, VerifyTraffic
Topology: [Full Topology Guide injected]
Proc Index: [Relevant subset of 3,746 indexed TCL procedures]
```

**Classification Criteria:**

| Classification | Criteria |
|----------------|---------|
| **Automatable** | All steps executable via CLI/SNMP/traffic procs; no human action; deterministic verification |
| **Semi-Automatable** | Mostly scriptable BUT requires human at checkpoints (e.g., cable pull, visual LED check, external tool not in framework, NETCONF if not available) |
| **Manual** | Requires physical action (PSU swap, console-only access, hardware inspection) |

**Output Format (JSON):**
```json
[
  {
    "tc_number": "5.1.3",
    "title": "Verify SNMPv3 AuthPriv GET operation",
    "classification": "Automatable",
    "reason": "All steps use snmpget_Priv and SnmpCheckKeyValue_snmp procs"
  }
]
```

**Deduplication Guard:** LLM sometimes returns duplicate tc_numbers → system keeps first occurrence only.

**Saved to DB:** `UPDATE test_cases SET classification=? WHERE workflow_id=? AND tc_number=?`

#### 4.2 Manual Override (`PUT /stage4/override`)
- User can change any TC's classification
- Reason required
- Logged to `audit_trail` with original + new classification

#### 4.3 Interactive Chat Advisor (`POST /stage4/chat`)

**Model:** `claude-opus-4-8`

**Role:** Senior automation architect who explains why TCs are Semi-Auto/Manual and suggests how to make them Automatable.

**Special `<<<ACTION>>>` Protocol:**

When the chat advisor determines a TC can be fixed, it embeds an action block:
```
<<<ACTION>>>
tc_number: 5.3.7
issue_type: incorrect_steps
description: Steps reference manual cable pull but CheckLinkState proc can simulate this
<<<END>>>
```

**Frontend detects this block and:**
1. Extracts TC content from test plan
2. Sends to LLM for automated fix
3. Reclassifies fixed TC
4. Updates `test_cases` and `documents` (test plan) in DB
5. Shows new classification result in UI

**Summary Panel:**
- Classification breakdown (Automatable / Semi / Manual counts)
- Distribution donut chart
- Per-TC classification + reason display
- Override button per TC
- Approve & Proceed button

---

### Stage 7 — TCL Script Generation

**Purpose:** Generate production-ready TCL automation scripts for all **Automatable** and **Semi-Automatable** test cases. Scripts must strictly conform to the EXOS TCL framework conventions.

**Process Flow:**
```
Load all automatable TCs → Generate scripts (one per TC) →
AI batch review (quality check) → Improve individual scripts →
Approve → Advance
```

#### 7.1 Script Generation (`POST /stage7/generate`)

**Model:** `claude-opus-4-8` (heavy)

**Framework Knowledge Injected:**
- TCL proc index (3,746 procedures from 552 files)
- Topology Guide (single/dual/triple node setups)
- Traffic Patterns (SendFrame, SendIP, IXIA procedures)
- SNMP Library (all OIDs and proc signatures)
- CLI Syntax Guide

**Per-TC Generation Process:**
```
For each Automatable/Semi-Automatable TC:
  1. DELETE existing script for this TC (prevents duplicates)
  2. Build prompt: TC content + framework knowledge + topology
  3. Call LLM → get TCL script
  4. INSERT new script record
  5. Update progress (in-memory counter)
```

**Generation Lock:**
- `generatingWorkflows` Set tracks in-progress generations
- `GET /stage7/status/:workflow_id` returns `{ generating: true/false }`
- Frontend polls on mount — "Proceed" button disabled while generating

**Script Structure (typical output):**
```tcl
# Test Case: 5.1.3 - Verify SNMPv3 AuthPriv GET
# Classification: Automatable
# Generated by NOS QA Workflow Tool

proc TC_5_1_3_SNMPv3_AuthPriv_GET {} {
    # Setup
    set dut1 [ConnectToDUT $DUT1_IP]
    
    # Configure SNMPv3 user
    SendCliCommand $dut1 "configure snmpv3 add user testuser ..."
    
    # Verify via SNMP
    set result [snmpget_Priv $DUT1_IP $OID_SNMPV3_USER ...]
    SnmpCheckKeyValue_snmp $result "testuser"
    
    # Cleanup
    SendCliCommand $dut1 "configure snmpv3 delete user testuser"
}
```

**Deduplication:** `GET /stage7/:workflow_id` returns only the latest script per `test_case_id` (by MAX(rowid) GROUP BY test_case_id) — prevents showing duplicates from regeneration.

**Proceed Gate:**
- Button disabled if: `generating || scripts.length === 0 || scripts.length < totalAutomatable`
- `totalAutomatable` = count of Automatable + Semi-Automatable TCs in DB

#### 7.2 AI Batch Review (`POST /stage7/review` with `batch: true`)

**Model:** `claude-sonnet-4-6` (light — cost-efficient for batch)

**Concurrency:** 3 scripts reviewed in parallel (Promise.all batching)

**Review Output Per Script:**
```json
{
  "verdict": "Approved|Needs Improvement|Rejected",
  "score": 85,
  "summary": "Well-structured script with good error handling",
  "issues": [
    {
      "type": "Critical|Warning|Tip",
      "description": "Missing cleanup on failure path"
    }
  ]
}
```

**UI Display (expandable rows):**
- ▶ Arrow to expand/collapse review details
- Filename + summary visible collapsed
- Expanded: Full issue list with Critical/Warning/Tip tags, score, verdict
- **"Improve" button** per script — opens regeneration modal pre-filled with issue text

#### 7.3 Script Improvement (`POST /stage7/generate` for single TC)

User can click "Improve" → modal opens with:
- Current script
- AI review issues listed
- User can add custom improvement instructions
- Regenerates that script only

---

### Stage 8 — TC Execution

**Purpose:** Record test execution results for each test case. Update the test plan with execution results. Allow editing of test cases before execution.

**Process Flow:**
```
Create execution session (platform, build, environment) →
Mark results per TC (Pass/Fail/Blocked/Not Run) →
[Optional] Edit TCs via TC Editor →
[Optional] Update Test Plan with execution results →
Approve & Proceed
```

#### 8.1 Execution Session (`POST /stage8/execution/session`)

Captures test environment context:
- **Platform:** Dropdown (X440G2, X450G2, X460G2, X465, 4120, 4220, 5120, 5220, 5320, 5420, 5520, 5720, 7520, 7720, Stack)
- **Build:** e.g., 32.1.1.4
- **Environment:** Lab / CI / Regression

#### 8.2 Recording Results (`POST /stage8/execution/result`)

Per-TC result recording:
```json
{
  "workflow_id": "...",
  "tc_number": "5.1.3",
  "result": "pass|fail|blocked|not_run",
  "platform": "X460G2",
  "build": "32.1.1.4",
  "notes": "Failed due to SNMP timeout on port 161"
}
```

**Table with row coloring:**
- Pass → green background
- Fail → red background
- Blocked → orange background

#### 8.3 TC Editor Modal

**Access:** "Edit Test Cases" button in the TC table card.

**Features:**
- Left panel: Searchable TC list
- Right panel: Edit form per selected TC
  - **Title** (text input)
  - **Description/Steps** (large text area — loaded from test plan markdown or saved description)
  - **Classification** (dropdown: Automatable / Semi-Automatable / Manual)
  - Save / Delete buttons

**TC Content Loading (`GET /stage8/tc-content/:workflow_id/:tc_number`):**
1. First checks `test_cases.description` column
2. If NULL → extracts TC section from test plan markdown using regex
3. Regex: `/(^|\n)(#{1,4}\s*(?:Test Case\s*)?TC_NUMBER[^\n]*)/i`
4. Returns content + source indicator ('saved' or 'test_plan')

**TC Delete:**
- Removes from `test_cases`
- Removes from `tcl_scripts`
- Removes from `tc_execution_results`

#### 8.4 Update Test Plan with Results (`POST /stage8/execution/update-plan`)

Appends an execution summary section to the existing test plan document:

```markdown
---

## Execution Results (Updated: 2026-07-28)

**Summary:** Total: 45 | Pass: 38 | Fail: 4 | Blocked: 2 | Not Run: 1

### Test Sessions
| Platform | Build | Environment | Executed By | Date |
...

### Test Case Execution Status
| TC# | Title | Classification | Result | Platform | Build | Notes |
...
```

**`dry_run` mode:** Returns updated content without writing to DB (used on page load to pre-check if plan was previously updated, enabling the Approve button).

#### 8.5 Finalized Test Plan (`GET /stage8/final-plan/:workflow_id`)

Returns any document with `doc_type = 'final_execution_report'` if it exists.

#### 8.6 Approve & Proceed

`handleApprove` flow:
1. `POST /stage8/approve` → records approval (idempotent)
2. `POST /workflows/:id/advance` → moves to Stage 9
3. `goToStage(9)` → navigates immediately

Both steps wrapped in try/catch — already-approved or already-advanced states handled gracefully.

---

### Stage 9 — Workflow Completion & Reporting

**Purpose:** Final summary, report generation, document downloads, qTest upload, and workflow completion.

**Process Flow:**
```
Review execution summary → Download reports →
[Optional] Upload to qTest → Mark workflow complete → Return to dashboard
```

#### 9.1 Execution Summary Dashboard

Loaded from `GET /stage9/:workflow_id`:

- **Stats cards:** Total TCs | Pass | Fail | Blocked | Not Run | Pass Rate %
- **Pie chart:** Result distribution (recharts)
- **Classification breakdown:** Manual / Semi-Auto / Automatable counts
- **Execution sessions:** Timeline of test runs
- **TC results table:** All TCs with result, platform, build, executor

**Pass Rate Color:**
- ≥ 80% → Green
- 50–79% → Orange
- < 50% → Red

#### 9.2 Download Test Report (HTML)

**Fully client-side generation** — no backend call needed.

Generates self-contained HTML file with:
- Header with workflow info (story ID, title, release, generated timestamp)
- Executive Summary stats panel (colored badges)
- Execution Sessions table
- Full Test Case Results table with result badges, platform, build, notes

Download filename: `TestReport_EXOS-XXXXX_2026-07-28.html`

#### 9.3 Download XLSX for qTest (`POST /stage9/generate-qtest-xlsx`)

Generates qTest-compatible Excel file:
- **Module:** e.g., XOS_Platform.BCM
- **Test Plan Name:** Auto-derived from workflow title
- **Test Area:** 5_Testcases (configurable)

#### 9.4 qTest Upload (`POST /stage9/qtest-upload`)

Direct API upload to configured qTest instance:
- Creates test cases in qTest
- Uploads execution results
- Returns: uploaded count, total, per-TC status

**Configured via environment:**
```
QTEST_BASE_URL=https://your-qtest-instance.qtestnet.com
QTEST_TOKEN=your_api_token
```

Mock mode available when not configured.

#### 9.5 DOCX Test Plan Download (`POST /stage9/generate-iso-docx`)

Generates ISO-format DOCX test plan document with:
- **Author, Reviewer, Approver** fields
- Document type: New / Enhancement
- **Base document reference** (for enhancements)
- Version numbering

#### 9.6 Workflow Completion (`POST /stage9/:id/complete`)

- Sets `workflows.status = 'completed'`
- Marks Stage 9 as completed
- Logs to audit trail
- **Navigates to dashboard** automatically

---

## 6. AI Chat Advisor

The chat advisor is a floating panel available in **Stage 2** (Skill File) and **Stage 3** (Test Plan).

### Architecture

```
User Types Message
       │
       ▼
POST /api/chat/send
       │
       ├── Load session context (workflow, documents, test cases)
       ├── Build system prompt with:
       │   ├── Workflow info (story ID, title, release)
       │   ├── Skill file content (if Stage 2 or 3)
       │   ├── Test plan content (if Stage 3 and plan exists)
       │   ├── Test cases list (if Stage 3)
       │   ├── TCL Topology Guide (both stages)
       │   └── TCL Traffic Patterns (both stages)
       ├── Inject uploaded file content (DOCX/PDF/image analysis)
       ├── Call LLM with full context
       └── Return: response + extracted_data + conversation_complete flag
```

### File Upload in Chat

Supported file types and extraction methods:

| File Type | Extraction Method |
|-----------|------------------|
| `.txt`, `.md` | Direct file read |
| `.json`, `.yaml` | Direct file read |
| `.docx` | python-docx (paragraph extraction) |
| `.pdf` (text-based) | pdfminer.six (text extraction) |
| `.pdf` (image-based) | pdftoppm → PNG → Claude Vision API |
| Images (.jpg, .png) | Passed directly to Claude Vision |

**Vision Analysis for Topology PDFs:**
1. `pdftoppm -r 150 -png -f 1 -l 1` converts first page to PNG at 150 DPI
2. PNG base64-encoded and sent to Claude with prompt:
   > "Describe all devices, labels, connections, port numbers, VLANs, subnets, and topology type"
3. Result prefixed with `[TOPOLOGY DIAGRAM - Visual Analysis]` and stored in `chat_files.content`
4. Content injected into every subsequent AI call in that session

**Instant Upload UX:**
- File appears immediately in chat with spinner: "🔍 Analyzing file… (this may take a few seconds for diagrams)"
- Spinner replaced with analysis result when backend responds

### Requirements Extraction

After each AI response, the backend attempts to extract structured requirements:
```json
{
  "test_objectives": "Verify SNMPv3 authentication modes",
  "positive_scenarios": ["AuthNoPriv GET", "AuthPriv GET", "AuthPriv SET"],
  "negative_scenarios": ["Wrong password", "Unsupported OID"],
  "prerequisites": "SNMPv3 configured; EXOS 32.1.1 or later",
  "coverage_level": "comprehensive"
}
```

If `conversation_complete: true` in response → `onRequirementsExtracted` callback fires → **Chat Summary Modal** appears.

### Chat Summary Modal

Pops up automatically when chat completes:
- Shows all captured fields in green cards
- Warning if no structured data captured (chat context still used)
- **"Generate Test Plan Now"** → dismisses modal + triggers generation
- **"Edit Manually"** → dismisses modal only

---

## 7. LLM Integration & Model Strategy

### Model Selection

```
HEAVY MODEL: claude-opus-4-8
  Used for:
  • Skill File Generation (Stage 2)
  • Test Plan Generation (Stage 3)
  • TCL Script Generation (Stage 7)
  • TC Fix (Stage 3)
  • TC Chat Advisor Fix action (Stage 4)
  Rationale: Complex generation requiring depth and accuracy

LIGHT MODEL: claude-sonnet-4-6
  Used for:
  • TC Classification (Stage 4)
  • Batch AI Script Review (Stage 7)
  • Chat Advisor responses (Stages 2, 3)
  • Skill File Evaluation
  • Dynamic Questionnaire Generation
  Rationale: Fast, cost-efficient for repetitive/structured tasks
```

### `callLLM()` Function

Central LLM wrapper:
```javascript
async function callLLM(systemPrompt, userPrompt, heavy = false) {
  const model = heavy 
    ? process.env.ANTHROPIC_MODEL_HEAVY || 'claude-opus-4-8'
    : process.env.ANTHROPIC_MODEL_LIGHT || 'claude-sonnet-4-6';
  
  const response = await anthropic.messages.create({
    model,
    max_tokens: heavy ? 8192 : 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });
  
  return response.content[0].text;
}
```

### LLM Drift Mitigation Techniques

**LLM drift** occurs when AI outputs deviate from expected format or quality. The system uses:

#### 1. JSON Schema Enforcement
For structured outputs (classification, evaluation, questionnaire):
- System prompt specifies exact JSON format with examples
- Response wrapped in JSON.parse() with try/catch
- On parse failure: fallback value or retry

```javascript
try {
  const parsed = JSON.parse(rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  return parsed;
} catch {
  console.warn('JSON parse failed, using fallback');
  return fallbackData;
}
```

#### 2. Deduplication Guards
TC classification can return duplicate tc_numbers:
```javascript
const seen = new Set();
const deduped = classifications.filter(tc => {
  if (seen.has(tc.tc_number)) return false;
  seen.add(tc.tc_number);
  return true;
});
```

#### 3. Script Deduplication (Stage 7)
Before inserting a new script → DELETE old version:
```javascript
db.prepare(`DELETE FROM tcl_scripts WHERE workflow_id=? AND test_case_id=?`).run(wid, tc.id);
db.prepare(`INSERT INTO tcl_scripts ...`).run(...);
```

GET endpoint returns only latest: `WHERE rowid IN (SELECT MAX(rowid) GROUP BY test_case_id)`

#### 4. Generation Lock
In-memory Set prevents double-generation:
```javascript
const generatingWorkflows = new Set();
// On generate start:
generatingWorkflows.add(workflow_id);
// On complete (finally block):
generatingWorkflows.delete(workflow_id);
// Status endpoint:
res.json({ generating: generatingWorkflows.has(workflow_id) });
```

#### 5. Content Trimming
All LLM outputs trimmed and validated before storage. Empty responses trigger error rather than saving blank content.

#### 6. Temperature Control
- Generation tasks: temperature 0.7 (creativity balanced with accuracy)
- Classification tasks: temperature 0.2 (deterministic, consistent)
- Evaluation tasks: temperature 0.3 (reliable scoring)

#### 7. Retry on Parse Failure
For critical structured outputs, up to 2 retries with simplified prompt on parse failure.

---

## 8. Evaluation & Quality Techniques

The system implements a **multi-layer quality assurance pipeline** at each generation stage.

### Layer 1: Normalization (Stage 3)

Applied automatically after test plan generation.

**What it fixes:**
- Heading hierarchy violations (H1 used inside H3 context)
- Table column misalignment
- TC number formatting (ensure `X.Y.Z` format)
- CLI code blocks (ensure triple-backtick wrapping)
- Trailing whitespace and empty sections

**Output stored:** `document_normalizations` table with `changes_count` and full `changes_json`

### Layer 2: Validation Scoring (Stage 3)

Automated structural and content validation.

**Scoring Algorithm:**
```
base_score = 100
for each critical_issue: base_score -= 30
for each major_issue:    base_score -= 15
for each minor_issue:    base_score -= 5
final_score = max(0, base_score)
grade = A if ≥90, B if ≥80, C if ≥70, D if ≥60, else F
```

**Critical Issues (automatic fail conditions):**
- TC with no expected results
- TC with < 2 test steps
- TC number format violation
- Missing TC title

**Major Issues (significant quality problems):**
- Steps use vague language ("configure", "verify" without specifics)
- No prerequisite section
- No cleanup steps
- Duplicate TC numbers

**Minor Issues (style/convention):**
- Non-standard heading text
- Missing code block formatting for CLI
- Inconsistent spacing

**Stored in:** `document_validations` with full JSON breakdown

### Layer 3: AI Evaluation (Stage 2 — Skill File)

LLM-powered evaluation returning dimensional scores.

**Grade Mapping:**
| Score Range | Grade | Meaning |
|-------------|-------|---------|
| 90–100 | A | Excellent — ready for test plan generation |
| 80–89 | B | Good — minor gaps, proceed with awareness |
| 70–79 | C | Acceptable — significant gaps to address |
| 60–69 | D | Poor — major rework recommended |
| < 60 | F | Failing — regenerate with more context |

**Evaluation persisted in:** `skill_evaluations` table for trend analysis

### Layer 4: Batch AI Script Review (Stage 7)

AI reviews each generated TCL script against:
1. **Framework compliance** — Uses correct proc signatures
2. **Error handling** — Handles connection failures, command timeouts
3. **Cleanup completeness** — Restores DUT state on both pass and fail paths
4. **TC coverage** — Script actually tests what TC says
5. **Variable naming** — Follows EXOS TCL naming conventions
6. **Comment quality** — Adequate inline documentation

**Scoring:** 0–100 per script  
**Verdict:** Approved | Needs Improvement | Rejected  
**Issue Tags:** Critical (blocks approval) | Warning (should fix) | Tip (optional improvement)

**Concurrency:** 3 scripts reviewed simultaneously (rate-limit-aware batching)

### Layer 5: Human Review & Approval

Every stage requires explicit human approval before advancement:

| Stage | Approver | What They Verify |
|-------|---------|----------------|
| Stage 2 | Senior QA / Manager | Skill file completeness and accuracy |
| Stage 3 | QA Lead | Test plan quality, coverage, TC accuracy |
| Stage 4 | Automation Engineer | Classification correctness |
| Stage 7 | (implicit advance) | Script generation complete |
| Stage 8 | QA Engineer | Execution results recorded |

### Layer 6: Version Control & Diff Tracking

All documents are versioned with full diff history:
- Every regeneration creates new version in `document_versions`
- `document_changes` stores line-level diffs
- `version_annotations` allows commenting on specific versions
- `document_relationships` links related documents

---

## 9. TCL Automation Framework Integration

### TCL Index

The system indexes the EXOS TCL automation repository at startup:

```
Source: /root/exos-tcl-automation/automation/
Index: /root/networking-qa-workflow/backend/data/tcl_framework_docs/automation_index.json
Stats: 3,746 procedures across 552 files
```

**Index Structure:**
```json
{
  "indexed_at": "2026-07-26T11:45:12.818Z",
  "tcl_root": "/root/exos-tcl-automation/automation",
  "total_files": 552,
  "total_procs": 3746,
  "areas": {
    "General": [{ "name": "SendCliCommand", "params": "dut cmd", "file": "lib.tcl" }],
    "SNMP": [...],
    "Traffic": [...],
    "Events": [...]
  }
}
```

**Used in:**
- Stage 4 classification (what can be automated?)
- Stage 7 script generation (which procs to use?)
- Stage 2/3 chat advisor (answer TCL framework questions)

### Framework Documentation Files

| File | Content |
|------|---------|
| `Topology_Guide.md` | Single/dual/triple node setup specs, IXIA port assignments, DUT IP conventions |
| `Traffic_Patterns.md` | SendFrame, SendIP, IXIA procedures with parameters and examples |
| `SNMP_Library.md` | All SNMP OIDs, procedure signatures, authentication modes |
| `CLI_Syntax_Guide.md` | EXOS CLI command format, common syntax patterns |
| `Switch_Events.md` | CheckReboot, RestartProcess, WaitForPort, link state procedures |

### Topology Types Supported

| Topology | Use Cases |
|----------|-----------|
| **Single-Node** | CLI commands, config tests, SNMP, API testing, non-forwarding features |
| **Two-Node** | L2/L3 forwarding, VLAN testing, QoS, IXIA traffic, port-based features |
| **Three-Node** | Multi-hop routing, ring topology, MSTP, MLAG, complex forwarding |

### Standard Port Conventions

```
DUT1: Ports 1-24 (test ports), Port 49-52 (uplinks)
DUT2: Ports 1-24 (test ports), Port 49-52 (uplinks)
IXIA: Port A → DUT1 Port 1, Port B → DUT1 Port 2 (or DUT2 Port 1)
Interconnect: DUT1 Port 49 ↔ DUT2 Port 49
```

---

## 10. Process Flow Diagrams

### Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      STAGE 1: JIRA STORY                    │
│  Select Release → Browse Stories → Select Story → Save      │
└───────────────────────────┬─────────────────────────────────┘
                            │ story_id, title, description
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   STAGE 2: SKILL FILE                        │
│  Upload Docs (optional) → Chat Advisor → Generate →         │
│  Evaluate (A-F) → Amend if needed → Approve                 │
└───────────────────────────┬─────────────────────────────────┘
                            │ skill_file.md (versioned)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   STAGE 3: TEST PLAN                         │
│  Choose Coverage → Upload Supplements → Chat + Topology →   │
│  Generate → Normalize → Validate → Fix TCs → Approve        │
└───────────────────────────┬─────────────────────────────────┘
                            │ test_plan.md + test_cases[]
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                STAGE 4: CLASSIFICATION                        │
│  Auto-Classify (LLM) → Override if needed → Chat Advisor →  │
│  Fix TCs → Reclassify → Approve                             │
└───────────────────────────┬─────────────────────────────────┘
                            │ classification[] (Auto/Semi/Manual)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                STAGE 7: SCRIPT GENERATION                    │
│  Generate TCL per TC → AI Batch Review → Improve → Proceed  │
└───────────────────────────┬─────────────────────────────────┘
                            │ *.tcl scripts per TC
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  STAGE 8: TC EXECUTION                       │
│  Create Session (platform/build) → Record Results →         │
│  [Optional] Edit TCs → Update Test Plan → Approve           │
└───────────────────────────┬─────────────────────────────────┘
                            │ execution_results[] + updated test_plan
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               STAGE 9: COMPLETION & REPORTING                │
│  Summary Dashboard → Download Report → qTest Upload →       │
│  Download DOCX → Mark Complete → Return to Dashboard         │
└─────────────────────────────────────────────────────────────┘
```

### LLM Call Map

```
Stage 2:
  /generate    → claude-opus-4-8    → Skill File markdown
  /regenerate  → claude-opus-4-8    → Updated Skill File
  /evaluate    → claude-sonnet-4-6  → Grade + Score JSON
  /query       → claude-sonnet-4-6  → Q&A answer

Stage 3:
  /generate              → claude-opus-4-8    → Test Plan markdown
  /generate-questionnaire → claude-sonnet-4-6 → Question array JSON
  /fix-tc                → claude-opus-4-8    → Fixed TC content
  /regenerate-with-comments → claude-opus-4-8 → New revision
  /evaluate              → claude-sonnet-4-6  → Grade + Score JSON

Stage 4:
  /classify  → claude-sonnet-4-6  → Classification array JSON
  /chat      → claude-opus-4-8    → Advisory + optional ACTION block

Stage 7:
  /generate  → claude-opus-4-8    → TCL script (per TC)
  /review    → claude-sonnet-4-6  → Review JSON (verdict, score, issues)

Chat:
  /send      → claude-sonnet-4-6  → Response + extracted_data
  /upload (image PDF) → claude-sonnet-4-6 → Vision description
```

### Quality Pipeline Flow (Stage 3)

```
User Clicks Generate
       │
       ▼
claude-opus-4-8 → Raw Markdown Test Plan
       │
       ▼
testPlanNormalizer.normalize()
  ├── Fix heading levels
  ├── Standardize TC numbering  
  ├── Format CLI blocks
  └── Returns: normalizedContent, changesCount
       │
       ▼
testPlanValidator.validate()
  ├── Check each TC for completeness
  ├── Score: 100 - (critical×30) - (major×15) - (minor×5)
  ├── Grade: A/B/C/D/F
  └── Returns: score, grade, issues[], statistics{}
       │
       ▼
Parse TCs → Insert into test_cases table
       │
       ▼
Save document with validation metadata
       │
       ▼
Display to user: Content + Validation Card
```

---

## 11. API Reference Summary

### Authentication
All endpoints (except `/api/auth/login`) require:
```
Authorization: Bearer <JWT_TOKEN>
```

JWT expires after 24 hours (configurable).

### Core Endpoints

| Stage | Method | Path | Description |
|-------|--------|------|-------------|
| 1 | GET | `/api/stage1/releases` | List Jira releases |
| 1 | GET | `/api/stage1/stories` | Stories by release |
| 1 | POST | `/api/stage1/select` | Save selected story |
| 2 | POST | `/api/stage2/generate` | Generate skill file |
| 2 | POST | `/api/stage2/evaluate` | Evaluate skill file |
| 2 | POST | `/api/stage2/approve` | Approve skill file |
| 2 | GET | `/api/stage2/:workflow_id` | Get skill file |
| 3 | POST | `/api/stage3/generate` | Generate test plan |
| 3 | POST | `/api/stage3/evaluate` | Evaluate test plan |
| 3 | POST | `/api/stage3/fix-tc` | Fix individual TC |
| 3 | POST | `/api/stage3/approve` | Approve test plan |
| 3 | GET | `/api/stage3/:workflow_id` | Get test plan |
| 4 | POST | `/api/stage4/classify` | Classify all TCs |
| 4 | PUT | `/api/stage4/override` | Manual override |
| 4 | POST | `/api/stage4/chat` | Classification advisor |
| 4 | POST | `/api/stage4/approve` | Approve classification |
| 7 | POST | `/api/stage7/generate` | Generate TCL scripts |
| 7 | POST | `/api/stage7/review` | AI review script |
| 7 | GET | `/api/stage7/status/:id` | Generation status |
| 7 | GET | `/api/stage7/:id` | Get scripts |
| 8 | POST | `/api/stage8/execution/session` | Create session |
| 8 | POST | `/api/stage8/execution/result` | Record TC result |
| 8 | POST | `/api/stage8/execution/update-plan` | Update test plan |
| 8 | GET | `/api/stage8/tc-content/:wid/:tc` | Get TC content |
| 8 | PUT | `/api/stage8/tc/:id` | Edit TC |
| 8 | DELETE | `/api/stage8/tc/:id` | Delete TC |
| 8 | POST | `/api/stage8/approve` | Approve execution stage |
| 9 | GET | `/api/stage9/:workflow_id` | Full summary data |
| 9 | POST | `/api/stage9/generate-qtest-xlsx` | Generate XLSX |
| 9 | POST | `/api/stage9/generate-iso-docx` | Generate DOCX |
| 9 | POST | `/api/stage9/qtest-upload` | Upload to qTest |
| 9 | POST | `/api/stage9/:id/complete` | Complete workflow |

### Chat Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/session` | Start chat session |
| POST | `/api/chat/send` | Send message |
| POST | `/api/chat/upload` | Upload file to chat |
| POST | `/api/chat/session/complete` | Complete session + extract |
| GET | `/api/chat/export/:session_id` | Export chat log |

### Workflow Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows` | Create workflow |
| GET | `/api/workflows/:id` | Get workflow |
| POST | `/api/workflows/:id/advance` | Advance to next stage |
| POST | `/api/workflows/:id/complete` | Mark complete |
| DELETE | `/api/workflows/:id` | Delete workflow (admin) |

### Stage Advancement Order
```javascript
const NEXT_STAGE = { 1: 2, 2: 3, 3: 4, 4: 7, 7: 8, 8: 9 };
// Stages 5 and 6 are deprecated — skipped in advancement
```

---

## 12. Security & Access Control

### Authentication

- **JWT-based** authentication (24-hour tokens)
- bcrypt password hashing (salt rounds: 10)
- Token required for all API calls except `/api/auth/login`
- Token refreshed on each request (sliding expiry)

### RBAC (Role-Based Access Control)

| Role | Capabilities |
|------|-------------|
| **admin** | Full access; delete any workflow; view all users; admin panel |
| **user** | Own workflows only; cannot delete others' workflows |

### Input Security

- File uploads validated by MIME type and extension whitelist
- `.pdf`, `.docx`, `.txt`, `.md`, `.json`, `.yaml`, images only
- File size limits enforced
- Uploaded filenames sanitized (stored as UUID-based names)
- SQL injection prevented via parameterized queries (better-sqlite3)
- No raw SQL string concatenation

### API Security

- All LLM API keys in `.env` (dotenvx encrypted)
- Jira credentials in environment only
- qTest token in environment only
- No secrets in frontend bundle

---

## 13. Deployment Architecture

### Production Server

| Component | Details |
|-----------|---------|
| Host | 10.127.26.9 (Ubuntu 18.04) |
| Backend | Node.js 16 via NVM, port 5100, nohup |
| Frontend | Static dist served by Nginx (or backend static), port 5101 |
| Database | SQLite at `/root/networking-qa-workflow/backend/data/qa_workflow.db` |
| TCL Repo | `/root/exos-tcl-automation/automation/` (indexed at startup) |

### Environment Variables

```bash
# LLM
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL_HEAVY=claude-opus-4-8
ANTHROPIC_MODEL_LIGHT=claude-sonnet-4-6

# Jira
JIRA_BASE_URL=https://your-jira.atlassian.net
JIRA_TOKEN=...
JIRA_EMAIL=...

# qTest
QTEST_BASE_URL=https://...
QTEST_TOKEN=...

# Auth
JWT_SECRET=...

# Server
PORT=5100
```

### Backend Start Command

```bash
export NVM_DIR=/root/.nvm
source /root/.nvm/nvm.sh
cd /root/networking-qa-workflow/backend
nohup node src/server.js > /tmp/backend.log 2>&1 &
```

### Frontend Build & Deploy

```powershell
cd frontend
npm run build
scp -r dist/* root@10.127.26.9:/root/networking-qa-workflow/frontend/dist/
```

### Data Backup

SQLite DB backed up before major changes:
```
/backend/data/qa_workflow_backup_YYYYMMDD_HHMMSS.db
```

---

*Document generated by NOS QA Workflow Tool documentation system.*  
*For questions or updates, refer to the project repository or contact the QA Platform team.*
