# Skill File Evaluation Criteria
## Comprehensive Quality Assessment for EXOS Feature Skill Files

**Version**: 1.0  
**Date**: 2026-07-17  
**Purpose**: Systematic evaluation framework for assessing skill file quality against EXOS documentation standards

---

## 📋 Table of Contents

1. [Evaluation Overview](#evaluation-overview)
2. [Scoring System](#scoring-system)
3. [Critical Requirements (Must-Have)](#critical-requirements-must-have)
4. [Structure & Completeness Evaluation](#structure--completeness-evaluation)
5. [Technical Accuracy Evaluation](#technical-accuracy-evaluation)
6. [Content Quality Evaluation](#content-quality-evaluation)
7. [Code Commit Alignment Evaluation](#code-commit-alignment-evaluation)
8. [Documentation Quality Evaluation](#documentation-quality-evaluation)
9. [Quality Metrics](#quality-metrics)
10. [Pass/Fail Criteria](#passfail-criteria)

---

## 🎯 Evaluation Overview

### Purpose
This evaluation framework assesses whether AI-generated skill files meet Extreme Networks production quality standards for EXOS Feature Functional Specifications.

### Evaluation Dimensions
1. **Structure & Completeness** (25%) - All required sections present
2. **Technical Accuracy** (30%) - Correct CLI commands, APIs, parameters
3. **Content Quality** (20%) - Specific values, not generic placeholders
4. **Code Commit Alignment** (15%) - Uses actual implementation details
5. **Documentation Quality** (10%) - Professional, clear, well-formatted

### Target Score
- **Excellent**: 90-100% (Production Ready)
- **Good**: 75-89% (Minor revisions needed)
- **Acceptable**: 60-74% (Moderate improvements needed)
- **Needs Work**: 40-59% (Significant revisions required)
- **Fail**: <40% (Not usable)

---

## 📊 Scoring System

### Point Allocation

| Category | Max Points | Weight |
|----------|-----------|---------|
| **1. Structure & Completeness** | 100 | 25% |
| **2. Technical Accuracy** | 100 | 30% |
| **3. Content Quality** | 100 | 20% |
| **4. Code Commit Alignment** | 100 | 15% |
| **5. Documentation Quality** | 100 | 10% |
| **TOTAL** | **500** | **100%** |

### Weighted Final Score
```
Final Score = (Structure×0.25) + (Technical×0.30) + (Content×0.20) + (Commits×0.15) + (Docs×0.10)
```

---

## ⚠️ Critical Requirements (Must-Have)

### Mandatory Elements (Any Missing = FAIL)

**If ANY of these are missing, the skill file automatically FAILS regardless of other scores.**

```
□ 1. Feature Overview section present
□ 2. At least ONE CLI command documented
□ 3. Technical details or implementation section present
□ 4. JIRA story ID referenced
□ 5. No placeholder text like "TBD", "TODO", "[Fill in]", "PLACEHOLDER"
□ 6. No empty required sections
□ 7. At least 500 characters of actual content
□ 8. Feature name clearly identified
```

**Critical Failure Examples**:
- ❌ "CLI Commands: TBD" (placeholder)
- ❌ Empty "Technical Details" section
- ❌ "configure feature [parameters]" (generic, not specific)
- ❌ Skill file less than 500 characters

---

## 1️⃣ Structure & Completeness Evaluation (100 points)

### 1.1 Required Sections (60 points)

**Each section present = 10 points**

✅ **Core Sections (Must Have)**:
- [ ] **Feature Overview** (10 pts)
  - What the feature does
  - Why it's needed
  - Key benefits
  
- [ ] **Technical Details** (10 pts)
  - How it works
  - Architecture/components
  - Implementation specifics
  
- [ ] **CLI Commands** (10 pts)
  - Configuration commands
  - Show commands
  - Example usage
  
- [ ] **Configuration Parameters** (10 pts)
  - Parameter table
  - Valid ranges
  - Default values

✅ **Recommended Sections**:
- [ ] **API Endpoints** (if REST API available) (10 pts)
  - Endpoints list
  - Request/response examples
  
- [ ] **Test Scenarios** or **Test Parameters** (10 pts)
  - Valid test cases
  - Edge cases
  - Boundary values

**Scoring**:
- All 6 sections present: 60 points
- Missing 1-2 sections: 40 points
- Missing 3+ sections: 20 points

### 1.2 Section Quality (20 points)

- **Adequate depth**: Each section has substantial content (5 pts)
- **Logical flow**: Sections organized logically (5 pts)
- **Cross-references**: Sections reference each other appropriately (5 pts)
- **Completeness**: No obvious gaps in coverage (5 pts)

### 1.3 Markdown Formatting (20 points)

- **Proper headings**: Uses # ## ### hierarchy (5 pts)
- **Tables**: Uses markdown tables for parameters (5 pts)
- **Code blocks**: CLI/API examples in ```code blocks``` (5 pts)
- **Lists**: Uses bullet points and numbered lists appropriately (5 pts)

---

## 2️⃣ Technical Accuracy Evaluation (100 points)

### 2.1 CLI Commands Accuracy (40 points)

**Specific Commands** (20 pts):
- ✅ Uses actual EXOS command syntax
  - `configure fabric attach zero-touch-client ...` ✓
  - `configure feature ...` ✗ (too generic)
- ✅ Includes full command paths
- ✅ Shows proper parameter names
- ✅ Demonstrates correct syntax

**Command Completeness** (20 pts):
- Configuration commands present
- Show commands present
- Verification commands present
- Multiple commands documented (not just one)

**Scoring**:
- 5+ specific commands with correct syntax: 40 points
- 3-4 commands: 30 points
- 1-2 commands: 20 points
- Only generic commands: 10 points

### 2.2 Parameter Accuracy (30 points)

**Valid Ranges** (15 pts):
- ✅ Numeric ranges are realistic (1-65535, not 1-999999)
- ✅ Enum values are accurate (on|off, enable|disable)
- ✅ String formats documented (IP addresses, MAC addresses)
- ✅ Default values specified

**Parameter Details** (15 pts):
- ✅ Parameter names match actual EXOS naming
- ✅ Parameter descriptions are clear
- ✅ Mandatory vs optional parameters distinguished
- ✅ Dependencies between parameters explained

### 2.3 API Accuracy (if applicable) (30 points)

**Endpoint Structure** (15 pts):
- ✅ REST endpoints follow actual NOS API patterns
- ✅ HTTP methods correct (GET, POST, PUT, DELETE)
- ✅ URL paths are realistic (/api/v1/...)
- ✅ Query parameters documented

**Request/Response Examples** (15 pts):
- ✅ JSON structure matches actual API
- ✅ Field names are accurate
- ✅ Data types correct (string, int, boolean)
- ✅ Response codes documented (200, 400, 404)

---

## 3️⃣ Content Quality Evaluation (100 points)

### 3.1 Specificity (40 points)

**Specific vs Generic**:

❌ **Generic (0 pts)**:
- "Configure the feature with appropriate parameters"
- "Set the value between min and max"
- "Use standard configuration commands"

✅ **Specific (Full points)**:
- "configure fabric attach zero-touch-client bypass-netlogin on"
- "VLAN ID range: 1-4094, default: 100"
- "Timeout values: 30, 60, 90, 120 seconds"

**Scoring**:
- 90%+ content is specific: 40 points
- 70-89% specific: 30 points
- 50-69% specific: 20 points
- <50% specific: 10 points

### 3.2 Technical Depth (30 points)

- **Architecture details**: How components interact (10 pts)
- **Protocol details**: Standards, RFCs, specifications (10 pts)
- **Implementation notes**: Timers, thresholds, algorithms (10 pts)

### 3.3 Practical Examples (30 points)

- **Real-world scenarios**: Actual use cases (10 pts)
- **Configuration examples**: Complete configs, not fragments (10 pts)
- **Expected outputs**: Show command results (10 pts)

---

## 4️⃣ Code Commit Alignment Evaluation (100 points)

### 4.1 Code Insights Usage (50 points)

**Evidence of commit analysis**:
- ✅ References specific functions from code changes (20 pts)
- ✅ Uses actual configuration parameters from implementation (15 pts)
- ✅ Documents behavior based on code logic (10 pts)
- ✅ Mentions actual file paths or modules (5 pts)

**Examples**:
- ✅ "Implemented in `fdbAgingDaemon.c` function `checkAgingTimer()`" (Good)
- ✅ "Default timeout changed from 5 to 10 seconds in commit abc123" (Excellent)
- ✗ "Feature is implemented in the system" (Too generic)

### 4.2 Commit Metadata Integration (25 points)

- ✅ References commit hashes or dates (5 pts)
- ✅ Mentions changed files (5 pts)
- ✅ Identifies new vs modified functionality (10 pts)
- ✅ Notes deprecated features (5 pts)

### 4.3 Test Module Alignment (25 points)

- ✅ References TCL test modules from code analysis (10 pts)
- ✅ Mentions test keywords (10 pts)
- ✅ Aligns test scenarios with actual tests (5 pts)

---

## 5️⃣ Documentation Quality Evaluation (100 points)

### 5.1 Writing Quality (40 points)

- **Clarity**: Clear, unambiguous language (10 pts)
- **Consistency**: Terminology used consistently (10 pts)
- **Professionalism**: Production-quality writing (10 pts)
- **Grammar**: No spelling or grammar errors (10 pts)

### 5.2 Structure & Organization (30 points)

- **Logical flow**: Information presented in logical order (10 pts)
- **Headings**: Descriptive, well-organized headings (10 pts)
- **Readability**: Easy to scan and find information (10 pts)

### 5.3 Formatting & Presentation (30 points)

- **Tables**: Well-formatted parameter tables (10 pts)
- **Code blocks**: Proper syntax highlighting (10 pts)
- **Lists**: Effective use of bullet/numbered lists (10 pts)

---

## 📈 Quality Metrics

### Metric Calculations

```javascript
// Structure Score
structure_score = (sections_present / 6) × 60 + section_quality + formatting

// Technical Score
technical_score = cli_accuracy + parameter_accuracy + api_accuracy

// Content Score
content_score = specificity + technical_depth + practical_examples

// Commit Score
commit_score = code_insights + commit_metadata + test_alignment

// Documentation Score
doc_score = writing_quality + structure_org + formatting_presentation

// Final Score
final_score = (structure × 0.25) + (technical × 0.30) + 
              (content × 0.20) + (commit × 0.15) + (doc × 0.10)
```

---

## ✅ Pass/Fail Criteria

### Automatic FAIL Conditions

**Any of these results in immediate failure**:
- Missing 3+ required sections
- More than 5 placeholder/TBD instances
- No specific CLI commands (all generic)
- No code commit insights referenced
- Less than 500 characters total content
- Missing JIRA story reference

### Grade Thresholds

| Grade | Score Range | Description | Action |
|-------|-------------|-------------|--------|
| **A** | 90-100 | Excellent - Production Ready | ✅ Approve |
| **B** | 75-89 | Good - Minor revisions | ⚠️ Review |
| **C** | 60-74 | Acceptable - Moderate improvements | 🔧 Revise |
| **D** | 40-59 | Needs Work - Significant revisions | ❌ Regenerate |
| **F** | 0-39 | Fail - Not usable | ❌ Regenerate |

---

## 🎯 Evaluation Checklist

Use this checklist for manual or automated evaluation:

### Structure Checklist
- [ ] Feature Overview section present and complete
- [ ] Technical Details section present with implementation specifics
- [ ] CLI Commands section with 3+ specific commands
- [ ] Configuration Parameters table with ranges and defaults
- [ ] API Endpoints section (if applicable)
- [ ] Test Scenarios or Test Parameters section
- [ ] Proper markdown formatting (headings, tables, code blocks)

### Technical Accuracy Checklist
- [ ] CLI commands use actual EXOS syntax
- [ ] Parameter ranges are realistic and accurate
- [ ] API endpoints follow NOS API patterns
- [ ] Request/response examples are valid JSON
- [ ] No generic placeholders in technical sections

### Content Quality Checklist
- [ ] 90%+ content is specific (not generic)
- [ ] Architecture and implementation details included
- [ ] Real-world use cases and examples provided
- [ ] Expected outputs documented
- [ ] Technical depth appropriate for production docs

### Code Commit Alignment Checklist
- [ ] References specific functions/files from commits
- [ ] Uses actual parameters from implementation
- [ ] Documents behavior based on code logic
- [ ] Mentions commit hashes or change dates
- [ ] Aligns with TCL test modules

### Documentation Quality Checklist
- [ ] Writing is clear, professional, and grammatically correct
- [ ] Terminology used consistently throughout
- [ ] Information flows logically
- [ ] Easy to scan and find specific information
- [ ] Tables, code blocks, and lists well-formatted

---

## 📝 Examples

### ✅ Excellent Skill File Excerpt

```markdown
## CLI Commands

### Configuration Commands

**Enable Fabric Attach Zero-Touch Client with NetLogin Bypass**:
```
configure fabric attach zero-touch-client bypass-netlogin on
```

**Configure NSI (Network Service Identifier) assignment**:
```
configure fabric attach zero-touch-client nsi-assignment vlan 100 nsi 16777215
```

**Show Commands**:
```
show fabric attach zero-touch-client
show fabric attach zero-touch-client bypass-netlogin
show fabric attach assignments
```

### Configuration Parameters

| Parameter | Description | Valid Range | Default |
|-----------|-------------|-------------|---------|
| bypass-netlogin | Enable/disable NetLogin bypass | on, off | off |
| nsi | Network Service Identifier | 1-16777215 | auto-assign |
| vlan | VLAN ID for assignment | 1-4094 | - |

**Implementation Note**: The bypass-netlogin feature was added in commit abc123def 
(2026-07-15) to allow authenticated FA clients to bypass NetLogin authentication.
Implemented in `faClientHandler.c` function `processBypassNetlogin()`.
```

**Why Excellent**:
- ✅ Specific CLI commands with actual syntax
- ✅ Complete parameter table with accurate ranges
- ✅ References actual commit and implementation details
- ✅ Professional formatting
- ✅ No placeholders or generic content

### ❌ Poor Skill File Excerpt

```markdown
## CLI Commands

Configure the feature using the appropriate command:
```
configure feature <parameters>
```

Show the configuration:
```
show feature
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| parameter1 | TBD |
| parameter2 | Configure as needed |
```

**Why Poor**:
- ❌ Generic command syntax
- ❌ Placeholder "TBD"
- ❌ Incomplete parameter table (missing ranges, defaults)
- ❌ No commit insights
- ❌ Not actionable

---

## 🚀 Usage

### For LLM Evaluation Agent

```javascript
evaluate_skill_file(skill_file_content, jira_story, commit_analysis) {
  // 1. Check critical requirements
  if (has_critical_failures()) return { grade: 'F', reason: '...' };
  
  // 2. Score each category
  structure_score = evaluate_structure();
  technical_score = evaluate_technical_accuracy();
  content_score = evaluate_content_quality();
  commit_score = evaluate_commit_alignment();
  doc_score = evaluate_documentation_quality();
  
  // 3. Calculate weighted final score
  final_score = calculate_weighted_score();
  
  // 4. Determine grade and recommendations
  return {
    grade: determine_grade(final_score),
    final_score: final_score,
    category_scores: { ... },
    strengths: [ ... ],
    weaknesses: [ ... ],
    recommendations: [ ... ]
  };
}
```

### For Manual Review

1. Print this checklist
2. Read skill file section by section
3. Check off items as you verify them
4. Calculate scores for each category
5. Determine final grade
6. Document recommendations

---

**End of Evaluation Criteria**
