# Networking QA Workflow - Project Guidelines & Guardrails

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Design Principles](#architecture--design-principles)
3. [Technology Stack](#technology-stack)
4. [Workflow Stages Explained](#workflow-stages-explained)
5. [Key Features & Integrations](#key-features--integrations)
6. [End-to-End User Journey](#end-to-end-user-journey)
7. [File Structure & Organization](#file-structure--organization)
8. [Development Guidelines](#development-guidelines)
9. [Skill File Creation Guidelines](#skill-file-creation-guidelines)
10. [Configuration & Setup](#configuration--setup)
11. [API Endpoints Reference](#api-endpoints-reference)
12. [Database Schema](#database-schema)
13. [LLM Integration Guidelines](#llm-integration-guidelines)
14. [Testing & Validation](#testing--validation)
15. [Troubleshooting Guide](#troubleshooting-guide)
16. [Best Practices & Guardrails](#best-practices--guardrails)

---

## Project Overview

### What is This System?

The **Networking QA Workflow System** is an intelligent automation platform designed to streamline the Quality Assurance process for network operating system features. It transforms JIRA tickets into comprehensive documentation and test plans through a structured, stage-based workflow.

### Core Purpose

- **Automate Documentation**: Generate feature skill files from JIRA tickets automatically
- **Knowledge Management**: Maintain a searchable repository of network feature documentation
- **Test Planning**: Create comprehensive test plans based on feature requirements
- **Code Intelligence**: Analyze git commits to understand feature implementation details
- **Collaboration**: Enable team review and approval at each stage

### Key Differentiator

Unlike traditional QA tools, this system uses **AI-powered analysis** combined with **git commit intelligence** to understand not just what a feature is supposed to do (from JIRA), but also how it's actually implemented (from code commits).

---

## Architecture & Design Principles

### Stage-Based Workflow (Not Agent-Based)

**Important**: This system uses a **9-stage workflow model**, NOT an agent-based architecture.

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW STAGES (Sequential)                  │
├─────────────────────────────────────────────────────────────────┤
│ Stage 1: Document Collection                                    │
│          ↓                                                       │
│ Stage 2: Skill File Generation (AI + Git Analysis)             │
│          ↓                                                       │
│ Stage 3: Review & Refinement                                    │
│          ↓                                                       │
│ Stage 4: Approval Process                                       │
│          ↓                                                       │
│ Stage 5: Test Plan Generation                                   │
│          ↓                                                       │
│ Stage 6: Test Case Creation                                     │
│          ↓                                                       │
│ Stage 7: Test Execution Planning                                │
│          ↓                                                       │
│ Stage 8: Results Analysis                                       │
│          ↓                                                       │
│ Stage 9: Final Documentation                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Sequential Progression**: Each stage must complete before moving to the next
2. **Human-in-the-Loop**: Review and approval gates prevent automation errors
3. **Data Persistence**: SQLite database stores all workflow state
4. **Version Control**: Track changes to skill files and test plans
5. **Extensibility**: Modular design allows adding new stages or features
6. **Intelligence Layer**: LLM integration provides context-aware generation
7. **Code Context**: Git integration provides implementation details

---

## Technology Stack

### Backend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Node.js 18+ | Server runtime |
| **Framework** | Express.js | REST API framework |
| **Database** | SQLite 3 | Workflow state persistence |
| **File Upload** | Multer | Handle document uploads |
| **Process Management** | node --watch | Auto-restart on code changes |
| **Git Integration** | child_process.spawn | Execute git commands |
| **AI Integration** | Custom LLM Service | Skill file generation |

**Directory**: `backend/`

### Frontend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | React 18 | UI framework |
| **Build Tool** | Vite 4 | Dev server & bundling |
| **UI Library** | Ant Design 5.x | Component library |
| **State Management** | Zustand | Global state management |
| **HTTP Client** | Axios | API requests |
| **Markdown Rendering** | ReactMarkdown | Display skill files |
| **Styling** | CSS + Ant Design Tokens | Theming & styling |

**Directory**: `frontend/`

### Development Tools

- **PowerShell Scripts**: Start/stop services, generate skill files
- **Python Scripts**: Document extraction (python-docx), TOC processing
- **Git**: Version control (xos_exos repository cloning)

### External Integrations

- **JIRA API**: Fetch ticket details from Atlassian (Basic Auth)
- **Git Repository**: EXOS codebase at `git@github.extremenetworks.com:Engineering/xos_exos.git`
- **LLM Service**: AI-powered content generation

---

## Workflow Stages Explained

### Stage 1: Document Collection

**Purpose**: Gather all necessary context for skill file generation

**Inputs**:
- JIRA ticket ID (e.g., EXOS-39560)
- Optional: Functional specifications (.docx)
- Optional: Test plans
- Optional: Reference documents

**Process**:
1. User creates new workflow
2. System fetches JIRA ticket details automatically
3. User uploads additional documents
4. System indexes all documents in database

**Outputs**:
- Workflow record in database
- Document metadata stored
- Ready for Stage 2

**API**: `POST /workflows/create`

---

### Stage 2: Skill File Generation ⭐ (Core AI Stage)

**Purpose**: Generate comprehensive skill file using AI + git commit analysis

**Key Features**:
- 🔍 **Automated Commit Analysis** - Analyzes git commits for implementation details
- 🤖 **LLM Generation** - AI-powered content creation
- 📚 **Context Integration** - Combines JIRA + documents + commits

**Process Flow**:

```
1. User initiates generation
   ↓
2. System fetches JIRA details
   ↓
3. Commit Analyzer runs:
   - Clones/updates xos_exos repo
   - Searches for commits mentioning JIRA ID
   - Extracts changed files
   - Parses function/struct/enum changes
   - Generates diff analysis
   ↓
4. LLM receives context:
   - JIRA summary & description
   - Uploaded documents
   - Commit analysis (functions, files, changes)
   ↓
5. LLM generates skill file:
   - Feature overview
   - Technical details
   - Configuration examples
   - Verification commands
   ↓
6. Skill file saved to database
   ↓
7. User reviews generated content
```

**Commit Analysis Output**:
```javascript
{
  jiraId: "EXOS-39560",
  commits: [
    {
      hash: "abc123...",
      author: "dev@example.com",
      date: "2026-06-15",
      message: "Fix IPP RATE_LIMIT_BROADCAST...",
      files: ["policy/ipp.c", "policy/ipp.h"],
      functions: ["apply_rate_limit", "parse_ipp_profile"],
      structs: ["ipp_action_t"],
      enums: ["IPP_ACTION_TYPE"],
      insertions: 45,
      deletions: 12
    }
  ],
  analysis: "LLM-generated behavioral summary",
  totalCommits: 3
}
```

**LLM System Prompt** (Simplified):
```
You are a network QA documentation expert. Generate a comprehensive skill file 
covering:
1. Feature overview
2. Technical implementation
3. CLI commands
4. Configuration examples
5. Verification steps
6. Troubleshooting

Use provided JIRA details, documents, and commit analysis.
```

**Outputs**:
- Generated skill file (Markdown)
- Stored in database with workflow_id
- Displayed in UI for review

**API**: `POST /stage2/generate`

---

### Stage 3: Review & Refinement

**Purpose**: Human review and editing of generated content

**Process**:
1. QA engineer reviews generated skill file
2. Edits content directly in UI (Markdown editor)
3. Validates technical accuracy
4. Adds missing details from domain knowledge
5. Saves refined version

**Outputs**:
- Refined skill file
- Version history maintained
- Ready for approval

**API**: `PUT /stage3/update`

---

### Stage 4: Approval Process

**Purpose**: Management/lead approval before test planning

**Process**:
1. Reviewer examines skill file
2. Provides feedback or approval
3. Requestor addresses feedback if needed
4. Final approval advances workflow

**Outputs**:
- Approval status in database
- Approver name and timestamp
- Workflow advances to Stage 5

**API**: `POST /stage4/approve`, `POST /stage4/reject`

---

### Stage 5: Test Plan Generation

**Purpose**: Create high-level test strategy

**Process**:
1. LLM analyzes skill file
2. Generates test plan structure:
   - Test objectives
   - Test scope
   - Test categories (functional, regression, performance)
   - Test environment requirements
   - Entry/exit criteria
3. User reviews and refines

**Outputs**:
- Test plan document
- Test categories defined
- Ready for detailed test case creation

**API**: `POST /stage5/generate-test-plan`

---

### Stage 6: Test Case Creation

**Purpose**: Generate detailed test cases

**Process**:
1. For each test category from Stage 5:
   - Generate specific test cases
   - Define setup steps
   - Define execution steps
   - Define verification steps
   - Define expected results
2. Include:
   - Positive tests
   - Negative tests
   - Boundary tests
   - Regression tests
   - Performance tests

**Example Test Case Structure**:
```markdown
## TC-001: Basic Functionality

**Objective**: Verify RATE_LIMIT_BROADCAST action applies correctly

**Type**: Functional

**Prerequisites**:
- EXOS switch with IPP support
- Access to CLI
- Test traffic generator

**Setup**:
1. Configure test VLAN
2. Create IPP profile with rate limit
3. Create IPP rule

**Execution**:
1. Connect device matching rule criteria
2. Verify profile applied
3. Generate broadcast traffic

**Verification**:
1. Check port shows rate limit: `show ports 1:1 information detail`
2. Verify traffic capped at configured rate
3. Check flood drop counters

**Expected Result**:
- Rate limit configured on port
- Traffic limited to specified pps
- Flood drops incrementing

**Pass/Fail Criteria**:
- PASS: Rate limit applied and enforced
- FAIL: Rate limit not applied or not enforced
```

**Outputs**:
- Comprehensive test case document
- Ready for execution planning

**API**: `POST /stage6/generate-test-cases`

---

### Stage 7: Test Execution Planning

**Purpose**: Plan test execution logistics

**Process**:
1. Define test environment topology
2. Assign test cases to engineers
3. Schedule test execution
4. Prepare test data and tools
5. Create automation scripts (optional)

**Outputs**:
- Test execution schedule
- Resource assignments
- Automation scripts

**API**: `POST /stage7/plan-execution`

---

### Stage 8: Results Analysis

**Purpose**: Analyze test execution results

**Process**:
1. Collect test results (pass/fail)
2. Document bugs found
3. Generate test report
4. Calculate metrics (pass rate, coverage)
5. Identify gaps

**Outputs**:
- Test execution report
- Bug list
- Metrics dashboard
- Recommendations

**API**: `POST /stage8/analyze-results`

---

### Stage 9: Final Documentation

**Purpose**: Package all documentation for archival

**Process**:
1. Compile all documents:
   - Skill file
   - Test plan
   - Test cases
   - Test results
   - Bug reports
2. Generate summary report
3. Archive to knowledge base
4. Update default_skills/ if applicable

**Outputs**:
- Complete documentation package
- Archived workflow
- Searchable knowledge base entry

**API**: `POST /stage9/finalize`

---

## Key Features & Integrations

### 1. Deep Commit Analyzer 🔍

**Purpose**: Extract implementation details from git commits

**Location**: `backend/src/agents/commitAnalyzer.js`

**How It Works**:

```javascript
analyzeCommitsForStory(jiraId) →
  1. ensureRepository() // Clone/update xos_exos repo
  2. findCommitsByJira(jiraId) // Search commits
  3. For each commit:
     - getCommitDetails(hash)
     - Extract files changed
     - Parse diff for functions/structs/enums
  4. analyzeCommitsWithLLM(commits, jiraStory)
  5. Return structured analysis
```

**Parsed Code Elements**:
- **Functions**: C/C++ function definitions
- **Structs**: Structure definitions
- **Enums**: Enumeration definitions
- **Macros**: Preprocessor definitions
- **File Changes**: Added/modified/deleted files
- **Diff Statistics**: Insertions, deletions, lines changed

**Integration Point**: Called automatically during Stage 2 generation

**Configuration**:
```javascript
const REPO_CONFIG = {
  url: 'git@github.extremenetworks.com:Engineering/xos_exos.git',
  localPath: './backend/repos/xos_exos',
  defaultBranch: 'main'
};
```

---

### 2. JIRA Integration

**Purpose**: Fetch ticket details automatically

**Implementation**: 
- **Script**: `fetch-jira-ticket.js`
- **API**: Atlassian REST API v3
- **Auth**: Basic Authentication (email + API token)

**Environment Variables**:
```env
JIRA_DOMAIN=extremenetworks.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
```

**Fetched Data**:
- Ticket summary
- Description (parsed from ADF format)
- Status
- Priority
- Assignee
- Components
- Labels
- Custom fields

**Usage in Workflow**:
- Automatic fetch during workflow creation
- Background fetch during Stage 2 generation
- Real-time data (not cached)

---

### 3. LLM Integration

**Purpose**: AI-powered content generation

**Location**: Backend service (callLLM function)

**Key Characteristics**:
- **Streaming Support**: Real-time response streaming
- **Context-Aware**: Receives JIRA + documents + commits
- **Structured Output**: Generates valid Markdown
- **Temperature**: Configurable creativity level

**Prompt Engineering Best Practices**:

1. **System Prompt**: Define role and output format
2. **User Prompt**: Provide all context (JIRA + docs + commits)
3. **Examples**: Include example skill files from default_skills/
4. **Constraints**: Specify structure, length, technical depth

**Example Invocation**:
```javascript
const systemPrompt = `You are a network feature documentation expert...`;
const userPrompt = `
JIRA Ticket: ${jiraData}
Documents: ${documents}
Commit Analysis: ${commitAnalysis}
Generate comprehensive skill file...
`;

const skillFile = await callLLM(systemPrompt, userPrompt, true);
```

---

### 4. Document Extraction

**Purpose**: Extract text from uploaded documents

**Python Script**: `read-docx.py`

**Supported Formats**:
- `.docx` (Microsoft Word)
- Extracts paragraphs and table content
- Preserves basic structure

**Usage**:
```powershell
python read-docx.py "path/to/document.docx" | Out-File "output.txt" -Encoding UTF8
```

**Integration**: Documents uploaded in Stage 1 are extracted and stored as text

---

### 5. Default Skills Repository

**Purpose**: Knowledge base of existing feature documentation

**Location**: `data/default_skills/`

**Content**:
- 200+ pre-existing skill files covering network features
- ACLs, BGP, QoS, VLANs, IPP, etc.
- Used as examples for LLM generation
- Referenced during skill file creation

**Naming Convention**:
- `Feature_Name_Skill.md` (e.g., `ACLs_Skill.md`)
- `JIRA-ID_Feature_Skill.md` (e.g., `EXOS-39560_IPP_RATE_LIMIT_BROADCAST_Feature_Skill.md`)

**Guidelines for Adding New Skills**:
1. Comprehensive feature coverage (not just bug details)
2. Clear structure (Overview → Technical → Examples → Verification)
3. CLI command examples
4. Configuration examples
5. Verification commands
6. Troubleshooting section

---

## End-to-End User Journey

### Persona: QA Engineer

**Scenario**: New feature EXOS-12345 needs documentation and test plan

### Step-by-Step Journey:

#### 1. Login & Dashboard
```
1. Open http://localhost:5173
2. Login with credentials
3. View dashboard with existing workflows
```

#### 2. Create New Workflow
```
1. Click "New Workflow"
2. Enter JIRA ID: EXOS-12345
3. System fetches JIRA details automatically
4. Upload optional documents (functional spec, test plan)
5. Click "Create Workflow"
→ Workflow created, Stage 1 complete
```

#### 3. Generate Skill File (Stage 2)
```
1. Navigate to Stage 2
2. Review JIRA summary displayed
3. See alert: "🔍 Automated Commit Analysis will run"
4. Click "Generate Skill File"
5. System processes:
   - Analyzes git commits for EXOS-12345
   - Extracts functions, files, changes
   - Sends all context to LLM
6. Watch streaming generation in real-time
7. Review generated skill file
8. Save if satisfactory
→ Skill file generated, Stage 2 complete
```

#### 4. Review & Refine (Stage 3)
```
1. Navigate to Stage 3
2. Edit skill file in Markdown editor
3. Add domain expertise details
4. Verify CLI commands
5. Add troubleshooting tips
6. Save refined version
→ Skill file refined, Stage 3 complete
```

#### 5. Submit for Approval (Stage 4)
```
1. Navigate to Stage 4
2. Click "Submit for Approval"
3. Wait for lead review
4. (Lead logs in, reviews, approves)
→ Approval granted, Stage 4 complete
```

#### 6. Generate Test Plan (Stage 5)
```
1. Navigate to Stage 5
2. Click "Generate Test Plan"
3. System analyzes skill file
4. Generates high-level test strategy
5. Review and refine test categories
6. Save test plan
→ Test plan created, Stage 5 complete
```

#### 7. Create Test Cases (Stage 6)
```
1. Navigate to Stage 6
2. Click "Generate Test Cases"
3. System creates detailed test cases
4. Review test cases for each category
5. Add additional test cases manually
6. Save test case document
→ Test cases created, Stage 6 complete
```

#### 8. Plan Execution (Stage 7)
```
1. Navigate to Stage 7
2. Define test environment
3. Assign test cases to engineers
4. Set execution schedule
5. Generate automation scripts
→ Execution planned, Stage 7 complete
```

#### 9. Analyze Results (Stage 8)
```
1. Execute tests (outside system)
2. Navigate to Stage 8
3. Upload test results
4. System analyzes pass/fail
5. Generates test report
6. Documents bugs found
→ Results analyzed, Stage 8 complete
```

#### 10. Finalize Documentation (Stage 9)
```
1. Navigate to Stage 9
2. Review complete documentation package
3. Click "Finalize and Archive"
4. System archives all documents
5. Updates knowledge base
→ Workflow complete! 🎉
```

---

## File Structure & Organization

```
networking-qa-workflow/
│
├── backend/                          # Node.js Express Backend
│   ├── src/
│   │   ├── server.js                # Main Express app
│   │   ├── agents/
│   │   │   └── commitAnalyzer.js    # Git commit analysis agent
│   │   ├── db/
│   │   │   ├── database.sqlite      # SQLite database
│   │   │   └── schema.sql           # Database schema
│   │   ├── routes/
│   │   │   ├── workflows.js         # Workflow CRUD endpoints
│   │   │   ├── stage2.js            # Skill file generation
│   │   │   ├── stage3.js            # Review/refinement
│   │   │   ├── stage4.js            # Approval
│   │   │   └── ...                  # Other stage routes
│   │   ├── services/
│   │   │   ├── llmService.js        # LLM integration
│   │   │   └── jiraService.js       # JIRA API client
│   │   └── middleware/
│   │       ├── auth.js              # Authentication middleware
│   │       └── errorHandler.js      # Error handling
│   ├── repos/                        # Git repository clones
│   │   └── xos_exos/                # EXOS codebase (cloned)
│   ├── package.json
│   └── .env                          # Environment variables
│
├── frontend/                         # React Frontend
│   ├── src/
│   │   ├── App.jsx                  # Main app component
│   │   ├── components/
│   │   │   ├── Dashboard.jsx        # Dashboard view
│   │   │   ├── WorkflowList.jsx     # Workflow listing
│   │   │   └── stages/
│   │   │       ├── Stage1.jsx       # Document collection UI
│   │   │       ├── Stage2.jsx       # Skill file generation UI
│   │   │       ├── Stage3.jsx       # Review UI
│   │   │       └── ...              # Other stage components
│   │   ├── store/
│   │   │   └── index.js             # Zustand stores (auth, workflow, theme)
│   │   ├── styles/
│   │   │   └── App.css              # Global styles
│   │   └── main.jsx                 # React entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js               # Vite configuration
│
├── data/
│   └── default_skills/              # Knowledge base skill files
│       ├── ACLs_Skill.md
│       ├── BGP_Skill.md
│       ├── Instant_Port_Profile_IPP_Skill.md
│       ├── EXOS-39560_IPP_RATE_LIMIT_BROADCAST_Feature_Skill.md
│       └── ... (200+ files)
│
├── uploads/                          # Uploaded documents storage
│   ├── IPP_Functional_Spec.txt
│   └── ...
│
├── scripts/                          # Utility scripts
│   ├── pdf_to_skillfiles.py        # Convert PDFs to skill files
│   └── toc_to_skillfiles.py        # Generate from TOC
│
├── templates/                        # Document templates
│
├── start.ps1                         # PowerShell: Start servers
├── generate-skill.ps1                # PowerShell: Generate skill file
├── fetch-jira-ticket.js              # Node.js: Fetch JIRA data
├── read-docx.py                      # Python: Extract .docx text
│
├── .env.example                      # Environment variables template
├── README.md                         # Project README
├── COMMIT_ANALYZER_INTEGRATION.md    # Commit analyzer docs
├── JIRA_INTEGRATION_GUIDE.md         # JIRA setup guide
└── PROJECT_GUIDELINES.md             # This file
```

---

## Development Guidelines

### Code Style

#### Backend (Node.js)

```javascript
// Use async/await for asynchronous operations
async function generateSkillFile(workflowId, jiraStory) {
  try {
    const jiraData = await fetchJiraTicket(jiraStory);
    const commits = await analyzeCommitsForStory(jiraStory);
    const skillFile = await callLLM(systemPrompt, userPrompt);
    return skillFile;
  } catch (error) {
    console.error('Generation failed:', error);
    throw error;
  }
}

// Use destructuring for cleaner code
const { jiraId, summary, description } = jiraData;

// Use template literals for strings
const message = `Analyzing commits for ${jiraId}`;

// Modular functions - single responsibility
function parseCommitDiff(diff) {
  const functions = extractFunctions(diff);
  const structs = extractStructs(diff);
  return { functions, structs };
}
```

#### Frontend (React)

```javascript
// Functional components with hooks
import { useState, useEffect } from 'react';
import { useWorkflowStore } from '../store';

function Stage2({ workflowId }) {
  const [loading, setLoading] = useState(false);
  const { workflow, updateWorkflow } = useWorkflowStore();
  
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/stage2/generate', { workflowId });
      updateWorkflow(response.data);
    } catch (error) {
      message.error('Generation failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card>
      <Button onClick={handleGenerate} loading={loading}>
        Generate Skill File
      </Button>
    </Card>
  );
}

// Use Ant Design components consistently
import { Button, Card, Alert, Space } from 'antd';

// Destructure props for clarity
function WorkflowCard({ workflow, onSelect }) {
  const { id, jira_story, stage, created_at } = workflow;
  // ...
}
```

### Error Handling

#### Backend

```javascript
// Use try-catch in route handlers
router.post('/generate', async (req, res) => {
  try {
    const result = await generateSkillFile(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Validate inputs
function validateWorkflowId(workflowId) {
  if (!workflowId || typeof workflowId !== 'number') {
    throw new Error('Invalid workflow ID');
  }
}
```

#### Frontend

```javascript
// Use Ant Design message for user feedback
import { message } from 'antd';

try {
  await api.call();
  message.success('Operation successful');
} catch (error) {
  message.error(error.response?.data?.error || 'Operation failed');
}

// Loading states for better UX
const [loading, setLoading] = useState(false);
```

### Database Operations

```javascript
// Use prepared statements to prevent SQL injection
const stmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
const workflow = stmt.get(workflowId);

// Transaction for multiple operations
db.transaction(() => {
  db.prepare('INSERT INTO workflows ...').run(data);
  db.prepare('INSERT INTO documents ...').run(docData);
})();

// Close database connections properly
process.on('exit', () => {
  db.close();
});
```

### Git Operations

```javascript
// Always check if repo exists before operations
async function ensureRepository() {
  if (!fs.existsSync(REPO_PATH)) {
    await cloneRepository();
  } else {
    await updateRepository();
  }
}

// Handle git command errors gracefully
function runGitCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const git = spawn(cmd, args, { cwd: REPO_PATH });
    
    git.on('error', (err) => {
      reject(new Error(`Git command failed: ${err.message}`));
    });
    
    git.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Git exited with code ${code}`));
      }
      resolve();
    });
  });
}
```

### API Design

#### RESTful Conventions

```
GET    /workflows           # List all workflows
POST   /workflows           # Create new workflow
GET    /workflows/:id       # Get specific workflow
PUT    /workflows/:id       # Update workflow
DELETE /workflows/:id       # Delete workflow

POST   /stage2/generate     # Generate skill file
PUT    /stage3/update       # Update skill file
POST   /stage4/approve      # Approve workflow
```

#### Response Format

```javascript
// Success response
{
  success: true,
  data: { ... },
  message: "Operation completed successfully"
}

// Error response
{
  success: false,
  error: "Error message",
  details: { ... }
}
```

---

## Skill File Creation Guidelines

### Structure Template

Every skill file should follow this structure:

```markdown
# Feature Title

## Overview
- Feature ID (JIRA)
- Component
- Brief description

## Feature Description
### What Does It Do?
### Purpose and Benefits

## How It Enhances Existing Features
- Integration points
- Complementary features
- Value addition

## Detailed Feature Behavior
### Configuration Structure
### Parameters
### Expected Behavior Flow
### Internal Processing

## CLI Commands
### Configuration Commands
### Verification Commands
### Monitoring Commands

## Configuration Examples
### Example 1: Basic Use Case
### Example 2: Advanced Use Case
### Example 3: Integration Scenario

## Verification and Monitoring
### Verify Configuration
### Verify Application
### Monitor Operations

## Troubleshooting
### Common Issues
### Debug Commands
### Solutions

## Feature Interactions
### Works With
### Dependencies
### Conflicts

## Platform Considerations
### Hardware Requirements
### Supported Platforms
### Scale Considerations

## Security Implications
### Protection Provided
### Best Practices

## Related Features
### Complementary Features
### Alternative Approaches

## References
### Documentation Links
### Related JIRA Tickets
### Knowledge Base Articles
```

### Content Guidelines

#### 1. Overview Section

**Do**:
- ✅ Provide clear, concise feature description
- ✅ State the component/subsystem
- ✅ Include JIRA ticket reference
- ✅ Mention if it's new feature or enhancement

**Don't**:
- ❌ Include implementation details in overview
- ❌ Use jargon without explanation
- ❌ Make assumptions about reader knowledge

#### 2. Feature Description

**Do**:
- ✅ Explain what the feature does in plain language
- ✅ Describe the problem it solves
- ✅ List key benefits
- ✅ Provide real-world use cases

**Don't**:
- ❌ Jump into technical details too quickly
- ❌ Assume reader knows why feature is needed
- ❌ Skip the "why" and only explain "how"

#### 3. CLI Commands

**Do**:
- ✅ Provide complete, working examples
- ✅ Show exact syntax with parameters
- ✅ Include expected output
- ✅ Group related commands together

**Example**:
```bash
# Create IPP profile with rate limiting
create policy profile "TestProfile" pvid 100 rate-limit-broadcast 1000

# Expected output:
# Profile "TestProfile" created successfully

# Verify profile configuration
show policy profile TestProfile

# Expected output:
# Profile: TestProfile
#   PVID: 100
#   rate-limit-broadcast: 1000
```

**Don't**:
- ❌ Show incomplete commands
- ❌ Use placeholder values without explanation
- ❌ Omit expected output
- ❌ Mix CLI and API examples without clear separation

#### 4. Configuration Examples

**Do**:
- ✅ Start with simple examples, progress to complex
- ✅ Explain the scenario before showing config
- ✅ Show complete configuration, not fragments
- ✅ Include verification steps

**Template**:
```markdown
### Example 1: Guest Network Protection

**Scenario**: Apply broadcast rate limiting to guest network devices

**Requirements**:
- Guest VLAN 200
- Broadcast limit: 500 pps
- Apply to ports 1:1-1:48

**Configuration**:
```bash
# Step 1: Create profile
create policy profile "GuestDevices" pvid 200 rate-limit-broadcast 500

# Step 2: Create rule
configure policy rule "GuestRule" profile "GuestDevices" 
  macsource 00:00:00:00:00:00 mask 0 port 1:1-1:48

# Step 3: Verify
show policy profile GuestDevices
show policy detail port 1:1
```

**Verification**:
```bash
show ports 1:1 information detail | include rate
# Expected: Broadcast Rate Limit: 500 pps
```
```

**Don't**:
- ❌ Show only configuration without context
- ❌ Skip verification steps
- ❌ Use unrealistic examples
- ❌ Forget to explain parameters

#### 5. Troubleshooting

**Do**:
- ✅ Describe the symptom clearly
- ✅ Provide diagnostic commands
- ✅ Show expected vs actual output
- ✅ Offer multiple solutions

**Template**:
```markdown
### Issue: Rate Limit Not Applied

**Symptom**: Profile shows rate limit but port configuration doesn't

**Diagnosis**:
```bash
# Check profile configuration
show policy profile TestProfile
# Output shows: rate-limit-broadcast: 1000 ✓

# Check port configuration
show ports 1:1 configuration | include rate
# Output shows: No rate limit ✗
```

**Root Cause**: Bug EXOS-39560 - IPP action not applied

**Solutions**:
1. **Workaround**: Apply manually via CLI
   ```bash
   configure ports 1:1 rate-limit flood broadcast 1000
   ```
2. **Permanent Fix**: Upgrade to EXOS 33.8+ (when available)

**Prevention**: Always verify rate limit applied after IPP configuration
```

**Don't**:
- ❌ List solutions without explaining the problem
- ❌ Assume one-size-fits-all solution
- ❌ Skip diagnostic steps
- ❌ Forget to mention known bugs

#### 6. References

**Do**:
- ✅ Link to official documentation
- ✅ Reference related JIRA tickets
- ✅ Cite functional specifications
- ✅ Include version information

**Example**:
```markdown
## References

### Documentation
- [EXOS User Guide 33.7](link) - IPP Configuration chapter
- [CLI Reference Guide](link) - Policy commands
- [REST API Guide](link) - Policy endpoints

### Related JIRA Tickets
- EXOS-39560: IPP RATE_LIMIT_BROADCAST not applied (Bug)
- EXOS-12345: IPP enhancements (Feature)

### Specifications
- IPP Functional Specification v2.1
- EXOS Architecture Guide

### Knowledge Base
- KB-100: IPP Best Practices
- KB-200: Troubleshooting IPP Issues
```

---

## Configuration & Setup

### Environment Variables

**Backend (.env)**:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# JIRA Integration
JIRA_DOMAIN=extremenetworks.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token

# Git Repository
GIT_REPO_URL=git@github.extremenetworks.com:Engineering/xos_exos.git
GIT_REPO_LOCAL_PATH=./repos/xos_exos

# LLM Configuration
LLM_ENDPOINT=http://your-llm-service.com/api
LLM_API_KEY=your-llm-api-key
LLM_MODEL=gpt-4
LLM_TEMPERATURE=0.7

# Database
DB_PATH=./src/db/database.sqlite

# File Upload
UPLOAD_DIR=../uploads
MAX_FILE_SIZE=50MB
```

**Frontend (.env)**:
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_APP_TITLE=NOS QA Workflow
```

### Installation & Setup

#### Prerequisites

```powershell
# Node.js 18+
node --version  # Should be 18.0.0 or higher

# npm 9+
npm --version

# Python 3.8+ (for document extraction)
python --version

# Git (for commit analysis)
git --version

# SSH keys configured for GitHub Enterprise
# Test: ssh -T git@github.extremenetworks.com
```

#### Initial Setup

```powershell
# 1. Clone repository
git clone <repo-url>
cd networking-qa-workflow

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install

# 4. Install Python dependencies
pip install python-docx

# 5. Configure environment variables
Copy-Item backend/.env.example backend/.env
# Edit backend/.env with your credentials

# 6. Initialize database
cd backend
node src/db/init-db.js

# 7. Test JIRA connection
node test-jira-connection.js

# 8. Return to root
cd ..
```

#### Starting the Application

**Option 1: PowerShell Script (Recommended)**
```powershell
# From project root
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start.ps1
```

**Option 2: Manual Start**
```powershell
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

**Option 3: VS Code Tasks**
```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Backend",
      "type": "shell",
      "command": "cd backend && npm run dev",
      "isBackground": true
    },
    {
      "label": "Start Frontend",
      "type": "shell",
      "command": "cd frontend && npm run dev",
      "isBackground": true
    }
  ]
}
```

#### Verification

```powershell
# Check backend
curl http://localhost:5000/health
# Expected: {"status": "healthy"}

# Check frontend
curl http://localhost:5173
# Expected: HTML content

# Open browser
Start-Process "http://localhost:5173"
```

---

## API Endpoints Reference

### Authentication

```
POST /api/auth/login
Body: { username, password }
Response: { token, user }

POST /api/auth/logout
Headers: { Authorization: Bearer <token> }
Response: { success: true }
```

### Workflows

```
GET /api/workflows
Query: ?status=active&limit=10&offset=0
Response: { workflows: [...], total: 100 }

POST /api/workflows
Body: { jira_story, description }
Response: { workflow: {...}, id: 1 }

GET /api/workflows/:id
Response: { workflow: {...} }

PUT /api/workflows/:id
Body: { stage, status, ... }
Response: { workflow: {...} }

DELETE /api/workflows/:id
Response: { success: true }
```

### Stage 2: Skill File Generation

```
POST /api/stage2/generate
Body: {
  workflow_id: 1,
  jira_story: "EXOS-12345",
  documents: [multipart files]
}
Response: {
  skillFile: "# Feature Title\n\n...",
  commitAnalysis: {...},
  metadata: {...}
}

GET /api/stage2/skill-file/:workflow_id
Response: { skillFile: "..." }

PUT /api/stage2/skill-file/:workflow_id
Body: { content: "updated content" }
Response: { success: true }
```

### Stage 3: Review

```
PUT /api/stage3/update/:workflow_id
Body: { content: "..." }
Response: { success: true }

POST /api/stage3/add-comment/:workflow_id
Body: { comment: "...", author: "..." }
Response: { comment: {...} }
```

### Stage 4: Approval

```
POST /api/stage4/approve/:workflow_id
Body: { approver: "...", comments: "..." }
Response: { approval: {...} }

POST /api/stage4/reject/:workflow_id
Body: { approver: "...", reason: "..." }
Response: { rejection: {...} }
```

### Commit Analysis

```
POST /api/commit-analysis/analyze
Body: { jira_id: "EXOS-12345" }
Response: {
  commits: [...],
  analysis: "...",
  functions: [...],
  files: [...]
}

GET /api/commit-analysis/repo-status
Response: {
  exists: true,
  path: "...",
  lastUpdate: "..."
}
```

### JIRA Integration

```
GET /api/jira/ticket/:jira_id
Response: {
  key: "EXOS-12345",
  summary: "...",
  description: "...",
  status: "...",
  ...
}

GET /api/jira/search
Query: ?jql=project=EXOS&status=Open
Response: { issues: [...], total: 50 }
```

---

## Database Schema

### Table: workflows

```sql
CREATE TABLE workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jira_story TEXT NOT NULL,
  description TEXT,
  stage INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### Table: documents

```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  filetype TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  extracted_text TEXT,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

### Table: skill_files

```sql
CREATE TABLE skill_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL UNIQUE,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

### Table: approvals

```sql
CREATE TABLE approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL,
  stage INTEGER NOT NULL,
  approver_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  comments TEXT,
  approved_at DATETIME,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id),
  FOREIGN KEY (approver_id) REFERENCES users(id)
);
```

### Table: users

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table: commit_analysis

```sql
CREATE TABLE commit_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL,
  jira_id TEXT NOT NULL,
  commits_json TEXT,
  analysis_text TEXT,
  analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

---

## LLM Integration Guidelines

### Prompt Engineering Best Practices

#### 1. System Prompt Structure

```javascript
const systemPrompt = `
You are an expert {ROLE} with deep knowledge of {DOMAIN}.

Your task: {TASK_DESCRIPTION}

Output format: {FORMAT_SPECIFICATION}

Guidelines:
1. {GUIDELINE_1}
2. {GUIDELINE_2}
...

Constraints:
- {CONSTRAINT_1}
- {CONSTRAINT_2}
...
`;
```

**Example for Skill File Generation**:
```javascript
const systemPrompt = `
You are an expert network QA documentation specialist with deep knowledge of 
Extreme Networks Operating System (EXOS) features, networking protocols, and 
quality assurance practices.

Your task: Generate comprehensive skill files documenting network features based 
on JIRA tickets, functional specifications, and git commit analysis.

Output format: Well-structured Markdown document following the skill file template.

Guidelines:
1. Start with clear overview and feature description
2. Provide detailed technical implementation details
3. Include complete CLI command examples with expected output
4. Add configuration examples for common use cases
5. Include troubleshooting section with diagnostic steps
6. Reference related features and documentation

Constraints:
- Use technical accuracy over brevity
- Include only verified information
- Cite sources for specifications
- Mark known bugs or limitations clearly
- Provide working code examples, not pseudocode
`;
```

#### 2. User Prompt Context Inclusion

**Include All Relevant Context**:
```javascript
const userPrompt = `
# JIRA Ticket Information
Ticket ID: ${jiraData.key}
Summary: ${jiraData.summary}
Description: ${jiraData.description}
Priority: ${jiraData.priority}
Components: ${jiraData.components.join(', ')}

# Uploaded Documents
${documents.map(doc => `
Document: ${doc.filename}
Content:
${doc.extracted_text}
`).join('\n\n')}

# Git Commit Analysis
Total Commits: ${commitAnalysis.totalCommits}

Commits:
${commitAnalysis.commits.map(commit => `
- Commit: ${commit.hash}
  Author: ${commit.author}
  Date: ${commit.date}
  Message: ${commit.message}
  Files Changed: ${commit.files.join(', ')}
  Functions: ${commit.functions.join(', ')}
  Structs: ${commit.structs.join(', ')}
`).join('\n')}

LLM Analysis:
${commitAnalysis.analysis}

# Task
Generate a comprehensive skill file following the template structure. Include:
1. Overview section with feature description
2. Detailed behavior and implementation
3. CLI configuration commands
4. Configuration examples (at least 3 scenarios)
5. Verification and monitoring commands
6. Troubleshooting section
7. References and related features

Focus on the specific feature: ${jiraData.summary}
`;
```

#### 3. Few-Shot Examples

**Provide Example Outputs**:
```javascript
const exampleSkillFile = fs.readFileSync(
  'data/default_skills/ACLs_Skill.md', 
  'utf-8'
);

const userPrompt = `
...context...

# Example Reference
Here's an example of a well-written skill file for reference:

${exampleSkillFile}

Now generate a skill file for the current feature following this structure and quality level.
`;
```

### Handling LLM Responses

#### Streaming Responses

```javascript
async function generateWithStreaming(systemPrompt, userPrompt, onChunk) {
  const stream = await callLLM(systemPrompt, userPrompt, true);
  
  let fullContent = '';
  
  for await (const chunk of stream) {
    fullContent += chunk;
    onChunk(chunk); // Send to frontend for real-time display
  }
  
  return fullContent;
}

// Frontend handling
socket.on('llm-chunk', (chunk) => {
  setGeneratedContent(prev => prev + chunk);
});
```

#### Post-Processing

```javascript
function postProcessSkillFile(rawContent) {
  // Remove markdown code fences if LLM wrapped entire content
  let content = rawContent.replace(/^```markdown\n|```$/g, '');
  
  // Ensure proper heading hierarchy
  content = normalizeHeadings(content);
  
  // Validate required sections
  const requiredSections = [
    '## Overview',
    '## Feature Description',
    '## CLI Commands',
    '## Configuration Examples'
  ];
  
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      console.warn(`Missing required section: ${section}`);
    }
  }
  
  return content;
}
```

### Error Handling & Retries

```javascript
async function generateWithRetry(systemPrompt, userPrompt, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await callLLM(systemPrompt, userPrompt);
      
      // Validate output
      if (isValidSkillFile(result)) {
        return result;
      } else {
        console.warn(`Attempt ${i+1}: Invalid output, retrying...`);
      }
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${i+1} failed:`, error.message);
      
      // Exponential backoff
      await sleep(Math.pow(2, i) * 1000);
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

function isValidSkillFile(content) {
  return (
    content.length > 500 &&
    content.includes('##') &&
    content.includes('```') &&
    !content.includes('ERROR') &&
    !content.includes('I cannot')
  );
}
```

---

## Testing & Validation

### Backend Testing

**Unit Tests** (Jest):
```javascript
// tests/commitAnalyzer.test.js
describe('Commit Analyzer', () => {
  test('should find commits by JIRA ID', async () => {
    const commits = await findCommitsByJira('EXOS-12345');
    expect(commits).toHaveLength(3);
    expect(commits[0]).toHaveProperty('hash');
  });
  
  test('should parse function definitions from diff', () => {
    const diff = `
+static int apply_rate_limit(port_t port, int rate) {
+  // implementation
+}
    `;
    const functions = parseDiffForFunctions(diff);
    expect(functions).toContain('apply_rate_limit');
  });
});
```

**Integration Tests**:
```javascript
// tests/integration/skillGeneration.test.js
describe('Skill File Generation', () => {
  test('should generate skill file with JIRA + commits', async () => {
    const response = await request(app)
      .post('/stage2/generate')
      .send({
        workflow_id: 1,
        jira_story: 'EXOS-TEST-001'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.skillFile).toContain('## Overview');
    expect(response.body.commitAnalysis).toBeDefined();
  });
});
```

### Frontend Testing

**Component Tests** (React Testing Library):
```javascript
// tests/Stage2.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import Stage2 from '../components/stages/Stage2';

describe('Stage2 Component', () => {
  test('should display generate button', () => {
    render(<Stage2 workflowId={1} />);
    expect(screen.getByText('Generate Skill File')).toBeInTheDocument();
  });
  
  test('should show loading state during generation', async () => {
    render(<Stage2 workflowId={1} />);
    fireEvent.click(screen.getByText('Generate Skill File'));
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });
});
```

### End-to-End Testing

**Playwright**:
```javascript
// tests/e2e/workflow.spec.js
test('complete workflow creation', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Login
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Create workflow
  await page.click('text=New Workflow');
  await page.fill('input[name="jira_story"]', 'EXOS-12345');
  await page.click('text=Create');
  
  // Verify creation
  await expect(page.locator('text=Workflow created')).toBeVisible();
});
```

### Manual Testing Checklist

**Pre-Deployment Checklist**:

- [ ] **Authentication**
  - [ ] Login with valid credentials
  - [ ] Login with invalid credentials (should fail)
  - [ ] Logout functionality
  - [ ] Session persistence across page refresh

- [ ] **Workflow Creation**
  - [ ] Create workflow with valid JIRA ID
  - [ ] Create workflow with invalid JIRA ID (should show error)
  - [ ] Upload documents during creation
  - [ ] Verify workflow appears in dashboard

- [ ] **Stage 2 - Skill Generation**
  - [ ] Generate skill file without documents
  - [ ] Generate skill file with documents
  - [ ] Verify commit analysis runs
  - [ ] Check skill file quality
  - [ ] Test edit and save functionality

- [ ] **Stage 3 - Review**
  - [ ] Edit generated skill file
  - [ ] Add comments
  - [ ] Save changes
  - [ ] Verify version history

- [ ] **Stage 4 - Approval**
  - [ ] Submit for approval
  - [ ] Approve as lead
  - [ ] Reject with feedback
  - [ ] Resubmit after changes

- [ ] **Commit Analyzer**
  - [ ] Verify repo cloned successfully
  - [ ] Test with JIRA ID that has commits
  - [ ] Test with JIRA ID that has no commits
  - [ ] Check function/struct parsing accuracy

- [ ] **JIRA Integration**
  - [ ] Fetch valid ticket
  - [ ] Handle invalid ticket ID
  - [ ] Parse description correctly
  - [ ] Extract custom fields

- [ ] **Error Handling**
  - [ ] Network error during API call
  - [ ] Server error (500)
  - [ ] Invalid input validation
  - [ ] File upload errors

---

## Troubleshooting Guide

### Common Issues & Solutions

#### Issue 1: Servers Won't Start

**Symptom**: `start.ps1` fails or servers don't start

**Diagnosis**:
```powershell
# Check if ports already in use
netstat -ano | findstr :5000
netstat -ano | findstr :5173

# Check Node.js installed
node --version

# Check npm installed
npm --version
```

**Solutions**:
```powershell
# Kill processes on ports
Stop-Process -Id <PID> -Force

# Reinstall dependencies
cd backend; Remove-Item node_modules -Recurse -Force; npm install
cd frontend; Remove-Item node_modules -Recurse -Force; npm install

# Clear npm cache
npm cache clean --force
```

---

#### Issue 2: JIRA Integration Failing

**Symptom**: Cannot fetch JIRA tickets, "Authentication failed"

**Diagnosis**:
```powershell
# Test JIRA connection
node backend/test-jira-connection.js

# Check environment variables
Get-Content backend/.env | Select-String "JIRA"
```

**Solutions**:
1. **Verify Credentials**:
   - Ensure `JIRA_EMAIL` is correct
   - Regenerate `JIRA_API_TOKEN` from Atlassian account settings
   - Check for extra spaces in `.env` file

2. **Check Network**:
   ```powershell
   # Test connectivity
   Test-NetConnection extremenetworks.atlassian.net -Port 443
   ```

3. **Update .env**:
   ```env
   JIRA_DOMAIN=extremenetworks.atlassian.net
   JIRA_EMAIL=your-email@extremenetworks.com
   JIRA_API_TOKEN=your-new-token-here
   ```

---

#### Issue 3: Commit Analyzer Not Finding Commits

**Symptom**: Commit analysis returns empty or "No commits found"

**Diagnosis**:
```powershell
# Check repo exists
Test-Path backend/repos/xos_exos

# Check git installation
git --version

# Manually test git command
cd backend/repos/xos_exos
git log --grep="EXOS-12345"
```

**Possible Causes & Solutions**:

1. **Repo Not Cloned**:
   ```powershell
   # Manually clone
   cd backend/repos
   git clone git@github.extremenetworks.com:Engineering/xos_exos.git
   ```

2. **SSH Key Not Configured**:
   ```powershell
   # Test SSH
   ssh -T git@github.extremenetworks.com
   # Should return: "Hi <username>! You've successfully authenticated"
   ```

3. **JIRA ID Not in Commit Messages**:
   - Commits must include JIRA ID in message (e.g., "EXOS-12345: Fix bug")
   - Try broader search or check commit messages manually

4. **Repository Out of Date**:
   ```powershell
   cd backend/repos/xos_exos
   git fetch origin
   git pull origin main
   ```

---

#### Issue 4: Skill File Generation Poor Quality

**Symptom**: Generated skill file missing sections or inaccurate

**Diagnosis**:
- Review JIRA ticket completeness
- Check uploaded documents extracted correctly
- Verify commit analysis included relevant commits

**Solutions**:

1. **Improve JIRA Ticket**:
   - Ensure description is detailed
   - Add acceptance criteria
   - Link related tickets

2. **Upload More Documents**:
   - Functional specification
   - Architecture diagrams
   - Existing test plans

3. **Verify Commit Analysis**:
   - Check commits have detailed messages
   - Ensure JIRA ID in commit messages
   - Look for commits in feature branches

4. **Use Manual Refinement**:
   - Generate initial version
   - Use Stage 3 to add domain expertise
   - Reference similar skill files from default_skills/

5. **Provide Better Examples**:
   - Add exemplary skill files to default_skills/
   - LLM learns from high-quality examples

---

#### Issue 5: Database Errors

**Symptom**: "Database locked" or "SQLITE_BUSY" errors

**Solutions**:
```powershell
# Stop all servers
Get-Process node | Stop-Process

# Check for file locks
Remove-Item backend/src/db/database.sqlite-journal -ErrorAction SilentlyContinue

# Restart servers
.\start.ps1
```

**Prevention**:
- Use transactions for multiple operations
- Close database connections properly
- Avoid concurrent writes

---

#### Issue 6: Frontend Shows Blank Page

**Symptom**: Browser shows white screen, no errors in console

**Diagnosis**:
```powershell
# Check Vite dev server logs
# Look for compilation errors

# Check browser console (F12)
# Look for JavaScript errors

# Check network tab
# Look for failed API calls
```

**Solutions**:

1. **Clear Browser Cache**:
   - Ctrl+Shift+Delete → Clear cache
   - Hard refresh: Ctrl+Shift+R

2. **Check Store Exports**:
   - Ensure all stores exported in `frontend/src/store/index.js`
   - Missing exports cause React errors

3. **Fix ESLint Errors**:
   ```powershell
   cd frontend
   npm run lint
   # Fix any errors shown
   ```

4. **Rebuild Frontend**:
   ```powershell
   cd frontend
   Remove-Item node_modules -Recurse
   Remove-Item dist -Recurse
   npm install
   npm run dev
   ```

---

## Best Practices & Guardrails

### Code Quality Guardrails

#### ✅ DO

1. **Validate All Inputs**:
   ```javascript
   function validateJiraId(jiraId) {
     if (!/^[A-Z]+-\d+$/.test(jiraId)) {
       throw new Error('Invalid JIRA ID format');
     }
   }
   ```

2. **Handle Errors Gracefully**:
   ```javascript
   try {
     await riskyOperation();
   } catch (error) {
     logger.error('Operation failed', { error, context });
     return { success: false, error: error.message };
   }
   ```

3. **Use Transactions for Multiple DB Operations**:
   ```javascript
   db.transaction(() => {
     db.prepare('INSERT INTO workflows ...').run(data);
     db.prepare('INSERT INTO documents ...').run(docData);
   })();
   ```

4. **Log Important Operations**:
   ```javascript
   console.log(`[${new Date().toISOString()}] Generating skill file for ${jiraId}`);
   ```

5. **Validate LLM Outputs**:
   ```javascript
   if (!output.includes('## Overview') || output.length < 500) {
     throw new Error('LLM output validation failed');
   }
   ```

#### ❌ DON'T

1. **Don't Trust User Input**:
   ```javascript
   // BAD: SQL injection risk
   const query = `SELECT * FROM workflows WHERE id = ${req.params.id}`;
   
   // GOOD: Use prepared statements
   const stmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
   const workflow = stmt.get(req.params.id);
   ```

2. **Don't Hardcode Credentials**:
   ```javascript
   // BAD
   const jiraToken = 'my-secret-token';
   
   // GOOD
   const jiraToken = process.env.JIRA_API_TOKEN;
   ```

3. **Don't Ignore Errors**:
   ```javascript
   // BAD
   try { await operation(); } catch {}
   
   // GOOD
   try { await operation(); } catch (error) { handleError(error); }
   ```

4. **Don't Block Event Loop**:
   ```javascript
   // BAD: Synchronous file read
   const content = fs.readFileSync('large-file.txt');
   
   // GOOD: Asynchronous
   const content = await fs.promises.readFile('large-file.txt');
   ```

5. **Don't Leak Sensitive Data in Logs**:
   ```javascript
   // BAD
   console.log('User password:', password);
   
   // GOOD
   console.log('User authentication attempt:', { username });
   ```

---

### Workflow Best Practices

#### Creating Workflows

1. **Ensure JIRA Ticket is Complete**:
   - Summary clear and concise
   - Description detailed
   - Acceptance criteria defined
   - Components tagged

2. **Upload Relevant Documents**:
   - Functional specifications
   - Architecture diagrams
   - Existing test plans
   - Reference implementations

3. **Verify JIRA Fetched Correctly**:
   - Check summary displayed
   - Verify description not truncated
   - Confirm correct ticket loaded

#### Generating Skill Files

1. **Review Commit Analysis Results**:
   - Check if relevant commits found
   - Verify functions/structs parsed correctly
   - Ensure analysis makes sense

2. **Validate Generated Content**:
   - All required sections present
   - CLI examples working
   - Configuration examples realistic
   - Troubleshooting comprehensive

3. **Add Domain Expertise**:
   - LLM may miss nuances
   - Add known limitations
   - Include platform-specific details
   - Reference internal knowledge

4. **Use Default Skills as Examples**:
   - Reference similar features
   - Maintain consistent structure
   - Follow naming conventions

#### Reviewing & Approving

1. **Technical Accuracy Check**:
   - Verify CLI commands work
   - Test configuration examples
   - Validate troubleshooting steps

2. **Completeness Check**:
   - All sections filled
   - Examples for common scenarios
   - Edge cases documented

3. **Clarity Check**:
   - Language clear and concise
   - No jargon without explanation
   - Examples well-commented

---

### Security Best Practices

1. **Environment Variables**:
   - Never commit `.env` files
   - Use `.env.example` as template
   - Rotate credentials regularly

2. **API Authentication**:
   - Require authentication for all endpoints
   - Use JWT tokens with expiration
   - Implement role-based access control

3. **Input Validation**:
   - Sanitize file uploads
   - Validate JIRA IDs, workflow IDs
   - Prevent path traversal attacks

4. **Database Security**:
   - Use prepared statements
   - Implement proper access controls
   - Regular backups

5. **Secrets Management**:
   - Use environment variables
   - Consider Azure Key Vault for production
   - Never log sensitive data

---

### Performance Best Practices

1. **Database Optimization**:
   ```sql
   CREATE INDEX idx_workflows_jira ON workflows(jira_story);
   CREATE INDEX idx_documents_workflow ON documents(workflow_id);
   ```

2. **Caching**:
   ```javascript
   const cache = new Map();
   
   async function fetchWithCache(key, fetcher) {
     if (cache.has(key)) return cache.get(key);
     const data = await fetcher();
     cache.set(key, data);
     return data;
   }
   ```

3. **Pagination**:
   ```javascript
   router.get('/workflows', (req, res) => {
     const { limit = 10, offset = 0 } = req.query;
     const workflows = db.prepare(
       'SELECT * FROM workflows LIMIT ? OFFSET ?'
     ).all(limit, offset);
     res.json({ workflows });
   });
   ```

4. **Streaming Large Responses**:
   ```javascript
   router.get('/large-file', (req, res) => {
     const stream = fs.createReadStream('large.txt');
     stream.pipe(res);
   });
   ```

---

## Future Enhancements

### Planned Features

1. **Advanced Analytics**:
   - Workflow completion metrics
   - Average time per stage
   - Success rate tracking
   - Bottleneck identification

2. **Notification System**:
   - Email notifications for approvals
   - Slack integration
   - Real-time updates via WebSocket

3. **Template Management**:
   - Customizable skill file templates
   - Test case templates
   - Report templates

4. **Enhanced Search**:
   - Full-text search across skill files
   - Semantic search for similar features
   - Tag-based filtering

5. **Version Control Integration**:
   - Git integration for skill files
   - Diff view for changes
   - Rollback capability

6. **Automation**:
   - Scheduled skill file generation
   - Automatic JIRA ticket monitoring
   - CI/CD pipeline integration

---

## Conclusion

This guideline document provides comprehensive coverage of the Networking QA Workflow System architecture, development practices, and operational procedures. 

**Key Takeaways**:

✅ **Stage-Based Architecture**: Sequential 9-stage workflow, not agent-based  
✅ **AI + Code Intelligence**: LLM generation enhanced with git commit analysis  
✅ **Knowledge Management**: Centralized skill file repository  
✅ **Extensible Design**: Modular structure supports future enhancements  
✅ **Best Practices**: Security, performance, and quality guardrails  

**For New Developers**:
1. Read this document thoroughly
2. Set up local environment following setup guide
3. Review existing skill files in default_skills/
4. Test workflow creation end-to-end
5. Study commit analyzer integration
6. Contribute improvements!

**For QA Engineers**:
1. Focus on workflow stages (Section 4)
2. Learn skill file creation guidelines (Section 9)
3. Understand verification processes (Section 14)
4. Reference troubleshooting guide as needed (Section 15)

**For Project Leads**:
1. Review architecture and design principles (Section 2)
2. Understand approval workflows (Stage 4)
3. Monitor best practices compliance (Section 16)
4. Plan future enhancements (Section 16)

---

**Document Version**: 1.0  
**Last Updated**: 2026-07-01  
**Maintained By**: Networking QA Team  
**Questions?** Contact: qa-team@example.com
