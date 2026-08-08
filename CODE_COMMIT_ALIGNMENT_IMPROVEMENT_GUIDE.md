# Code Commit Alignment Improvement Guide
## How to Score 100% on Code Commit Alignment Evaluation (15%)

**Issue**: Dashboard-generated skill files are failing the **Code Commit Alignment** criteria (15% weight)  
**Root Cause**: LLM is not using actual code commit data effectively in generated skill files  
**Impact**: Skill files lack specific implementation details, making them generic

---

## 📋 What is Code Commit Alignment?

**Definition**: The degree to which a skill file incorporates actual implementation details from git commit analysis.

### Evaluation Breakdown (100 points total):

| Category | Points | What's Evaluated |
|----------|--------|------------------|
| **Code Insights Usage** | 50 pts | References specific functions, parameters, behavior from code |
| **Commit Metadata Integration** | 25 pts | Uses commit hashes, dates, file names |
| **Test Module Alignment** | 25 pts | References TCL test modules, test keywords |

---

## 🎯 Current State Analysis

### ✅ What's Working:
- Commit analysis is **ENABLED** (SKIP_COMMIT_ANALYSIS is not set)
- Commit data **IS being provided** to the LLM in the prompt
- System includes:
  - Commit hashes, messages, authors, dates
  - Modified functions and files
  - Struct and enum changes
  - Test module recommendations
  - LLM-generated analysis report

### ❌ What's Failing:
- **LLM is ignoring commit data** despite it being in the prompt
- Generated skill files contain generic statements like:
  - "Feature is implemented in the system"
  - "Configuration is stored in memory"
  - **Instead of specific details like:**
    - "Implemented in `faZeroTouchClient.c` function `processBypassNlOption()`"
    - "Default timeout changed from 5s to 10s in commit `abc1234`"

---

## 🔧 Improvement Strategies

### Strategy 1: **Strengthen System Prompt** (RECOMMENDED - Quick Win)

**Problem**: System prompt doesn't mandate using commit data  
**Solution**: Add explicit requirements to system prompt

#### Implementation:

Add to `backend/src/agents/skillFileGenerator.js` in `buildSystemPrompt()`:

```javascript
buildSystemPrompt(templateCount) {
  return `You are an expert in EXOS (Extreme Networks Operating System) and network operating systems, specializing in documenting detailed functional behavior and implementation details.

Your task is to generate a comprehensive SKILL FILE that documents the COMPLETE FUNCTIONAL BEHAVIOR and IMPLEMENTATION of the feature in EXOS. This is NOT a test plan - it is a detailed functional specification document.

**🔴 CRITICAL: Code Commit Integration Requirements 🔴**

When CODE COMMIT ANALYSIS is provided in the user prompt, you MUST:

1. **Reference Specific Functions** (MANDATORY):
   - Include function names from commit analysis: "Implemented in \`filename.c\` function \`functionName()\`"
   - Example: "Bypass logic handled by \`lldpFaProcessBypassNl()\` in \`lldpFa.c\`"
   
2. **Use Actual File/Module Names** (MANDATORY):
   - Cite specific files from commit analysis: "Configuration stored in \`faZeroTouchClient.c\`"
   - List modified modules: "Changes made to: lldpFa.c, netlogin.c, fdbMgr.c"
   
3. **Document Code-Level Behavior** (MANDATORY):
   - Use function names and logic from commits: "When \`checkBypassNl()\` returns true, authentication is skipped"
   - Reference data structures: "Stored in \`faZeroTouchClient_t\` struct with \`bypassNl\` boolean field"
   
4. **Include Commit Metadata** (REQUIRED):
   - Reference commit hashes: "Added in commit \`a1b2c3d\`"
   - Note dates: "Introduced in EXOS 34.1 (2025-06-15)"
   
5. **Align with Test Modules** (REQUIRED):
   - Use test module names: "Validated by TCL test module \`fabAttachBypassNl.tcl\`"
   - Reference test keywords: "Test keywords: bypass, netlogin, fabric-attach"

**FAILURE TO USE COMMIT DATA = UNACCEPTABLE DOCUMENTATION**

If commit analysis is provided but you don't use specific function names, file paths, and code details, the documentation will be rejected as too generic.
`;
}
```

---

### Strategy 2: **Enhance User Prompt Instructions**

**Problem**: User prompt mentions commit data but doesn't emphasize importance  
**Solution**: Make commit data section more prominent with explicit instructions

#### Implementation:

Update `backend/src/agents/skillFileGenerator.js` in `buildUserPrompt()`:

```javascript
// After commit analysis section
if (commitAnalysis && commitAnalysis.success && commitAnalysis.commitCount > 0) {
  prompt += `### 🔍 CODE COMMIT ANALYSIS (EXOS Repository)

⚠️ **CRITICAL: You MUST use this code commit data in your skill file** ⚠️

**Found ${commitAnalysis.commitCount} related commit(s) in xos_exos repository:**

${commitAnalysis.commits.map((c, idx) => `
**Commit ${idx + 1}: \`${c.shortHash}\`** ← **CITE THIS HASH**
- **Message:** ${c.message}
- **Author:** ${c.author}
- **Date:** ${c.date}
- **Files Changed:** ${c.filesChanged} ← **DOCUMENT THESE FILES**
- **Functions Modified:** ${c.functionsChanged} ← **REFERENCE THESE FUNCTIONS**
`).join('\n')}

**Aggregated Code Changes** ← **USE THESE IN YOUR DOCUMENTATION**:
- **Modified Functions:** ${commitAnalysis.codeChanges.allFunctions.slice(0, 20).join(', ')}
  → Example: "Bypass handling implemented in \`${commitAnalysis.codeChanges.allFunctions[0] || 'functionName'}\`"
  
- **Struct Changes:** ${commitAnalysis.codeChanges.allStructs.join(', ') || 'None detected'}
  → Document data structures used
  
- **Enum/Constants:** ${commitAnalysis.codeChanges.allEnums.slice(0, 15).join(', ')}
  → Reference configuration options

---

**📝 MANDATORY REQUIREMENTS for Code Commit Integration:**

You MUST include in your skill file:

1. **Function-Level Details Section**:
   \`\`\`
   ### EXOS Implementation Details
   
   #### Core Functions:
   - \`${commitAnalysis.codeChanges.allFunctions[0] || 'functionName'}\` - [describe what it does]
   - [List other functions from commit analysis]
   
   #### Modified Files:
   - \`${commitAnalysis.commits[0]?.filesChanged?.split(',')[0]?.trim() || 'filename.c'}\` - [role in feature]
   \`\`\`

2. **Commit References**:
   - "Introduced in commit \`${commitAnalysis.commits[0]?.shortHash || 'abc123'}\` (${commitAnalysis.commits[0]?.date || '2025-06-15'})"

3. **Test Module Alignment**:
   - "Validated by test modules: ${commitAnalysis.testRecommendations?.modules?.join(', ') || 'testModule.tcl'}"

---

### 🤖 LLM Commit Analysis Report

${commitAnalysis.analysis}

---
**⚠️ IMPORTANT: Failure to use the above commit data will result in REJECTED documentation.**

Your skill file will be evaluated on:
- How many function names you reference (target: 5+)
- How many file paths you cite (target: 3+)
- Whether you include commit hashes (required)
- Whether you reference test modules (required)

`;
}
```

---

### Strategy 3: **Add Examples Section to System Prompt**

Show the LLM EXACTLY what "good" vs "bad" looks like:

```javascript
// Add to system prompt after critical requirements
**Examples of GOOD vs BAD Code Commit Integration:**

❌ **BAD (Generic - Will FAIL evaluation):**
"The feature is implemented in the EXOS system using various modules and functions."

✅ **GOOD (Specific - Will PASS evaluation):**
"The bypass-netlogin feature is implemented in \`lldpFa.c\` with the core logic in the \`lldpFaProcessBypassNl()\` function (commit \`a1b2c3d\`, 2025-06-15). Configuration is stored in the \`faZeroTouchClient_t\` struct with a new \`bypassNl\` boolean field. The feature integrates with NetLogin through IPC messages defined in \`nlBypassNlEntry_s\` struct."

---

❌ **BAD:**
"The feature includes configuration commands."

✅ **GOOD:**
"Configuration command \`bypass-netlogin [on|off]\` added in commit \`b2c3d4e\`, implemented by \`faZtcParseBypassNl()\` function in \`faZeroTouchClient.c\`."

---

❌ **BAD:**
"The feature can be tested."

✅ **GOOD:**
"Feature validated by TCL test module \`fabAttachBypassNl.tcl\` with test keywords: bypass, netlogin, fabric-attach, zero-touch-client."
```

---

### Strategy 4: **Post-Generation Validation Check**

Add validation to ensure commit data was used:

```javascript
// Add to skillFileGenerator.js after generation
async generateSkillFile(options) {
  // ... existing code ...
  
  const result = await callLLM(systemPrompt, userPrompt, streaming, onChunk);
  
  // Validate commit alignment
  if (commitAnalysis && commitAnalysis.success && commitAnalysis.commitCount > 0) {
    const validationScore = this.validateCommitAlignment(result, commitAnalysis);
    
    if (validationScore < 50) {
      console.warn(`⚠️ WARNING: Low commit alignment score (${validationScore}/100)`);
      console.warn('Generated skill file may not meet code commit evaluation criteria');
    } else {
      console.log(`✅ Good commit alignment score: ${validationScore}/100`);
    }
  }
  
  return { success: true, content: result, /* ... */ };
}

validateCommitAlignment(skillFileContent, commitAnalysis) {
  let score = 0;
  const content = skillFileContent.toLowerCase();
  
  // Check for function references (20 pts)
  const functionsFound = commitAnalysis.codeChanges.allFunctions.filter(fn => 
    content.includes(fn.toLowerCase())
  );
  score += Math.min(20, functionsFound.length * 4);
  
  // Check for file references (15 pts)
  const filesReferenced = commitAnalysis.commits.flatMap(c => 
    c.filesChanged.split(',').map(f => f.trim())
  ).filter(file => content.includes(file.toLowerCase()));
  score += Math.min(15, filesReferenced.length * 5);
  
  // Check for commit hashes (10 pts)
  const hashesFound = commitAnalysis.commits.filter(c => 
    content.includes(c.shortHash.toLowerCase())
  );
  score += Math.min(10, hashesFound.length * 10);
  
  // Check for test modules (10 pts)
  if (commitAnalysis.testRecommendations?.modules) {
    const testModulesFound = commitAnalysis.testRecommendations.modules.filter(mod =>
      content.includes(mod.toLowerCase())
    );
    score += Math.min(10, testModulesFound.length * 5);
  }
  
  return score;
}
```

---

## 📈 Expected Improvements

### Before (Current State):
```markdown
## Implementation Details

The bypass-netlogin feature is implemented in EXOS to allow Fabric Attach devices
to bypass authentication when configured. The feature stores configuration in 
memory and processes it during device discovery.
```

**Score**: 10/100 (Too generic)

---

### After (With Improvements):
```markdown
## EXOS Implementation Details

### Architecture

The bypass-netlogin feature is implemented through three primary components:

1. **Fabric Attach Module** (`lldpFa.c`, commit `a1b2c3d`)
   - Core processing in `lldpFaProcessBypassNl()` function
   - Manages bypass client database via `lldpFaBypassNlList` global array
   - Sends IPC messages to NetLogin subsystem using `lldpFaBypassNlMsg_s` structure

2. **Zero-Touch Configuration** (`faZeroTouchClient.c`, commit `a1b2c3d`)
   - New `bypassNl` boolean field added to `faZeroTouchClient_t` struct
   - Configuration parsing in `faZtcParseBypassNl()` function
   - Default value: false (authentication required)

3. **NetLogin Integration** (`netlogin.c`, commit `b2c3d4e`)
   - New bypass list maintained in `nlBypassNlEntry_s` linked list
   - Bypass check performed in `nlCheckBypassClient()` before authentication
   - Bypass clients excluded from `nlAuthenticatedClients` counter

### Key Functions Modified (from commit analysis):
- `lldpFaProcessBypassNl()` - Main bypass processing logic
- `faZtcParseBypassNl()` - CLI command parser
- `nlCheckBypassClient()` - NetLogin bypass validator
- `lldpFaAddBypassNlEntry()` - Add MAC to bypass list
- `lldpFaRemoveBypassNlEntry()` - Remove MAC from bypass list

### Test Validation
Feature validated by TCL test modules:
- `fabAttachBypassNl.tcl` - Main functional tests
- `fabAttachZeroTouch.tcl` - Integration tests with ZTC
- Test keywords: bypass, netlogin, fabric-attach, zero-touch-client, authentication
```

**Score**: 85/100 (Excellent - meets evaluation criteria)

---

## 🚀 Implementation Steps

### Step 1: Update System Prompt (5 minutes)

```bash
# Edit skillFileGenerator.js
code backend/src/agents/skillFileGenerator.js

# Add critical commit integration requirements to buildSystemPrompt()
# (See Strategy 1 above)
```

### Step 2: Enhance User Prompt (5 minutes)

```bash
# In same file, update buildUserPrompt()
# Make commit section more prominent with explicit requirements
# (See Strategy 2 above)
```

### Step 3: Add Validation Function (10 minutes)

```bash
# Add validateCommitAlignment() method
# Add validation check after LLM generation
# (See Strategy 4 above)
```

### Step 4: Deploy to Remote Server (5 minutes)

```bash
# Copy updated file to remote
scp backend/src/agents/skillFileGenerator.js root@10.127.26.9:~/networking-qa-workflow/backend/src/agents/

# Restart backend
ssh root@10.127.26.9 "cd ~/networking-qa-workflow/backend && pm2 restart backend"
```

### Step 5: Test with New Skill Generation

```bash
# Generate a new skill file via Dashboard
# Check if function names, file paths, and commit hashes are now included
```

---

## 📊 Evaluation Checklist

After implementing improvements, verify the generated skill file includes:

### Code Insights Usage (50 points):
- [ ] **5+ specific function names** referenced (e.g., `lldpFaProcessBypassNl()`) ← 20 pts
- [ ] **3+ configuration parameters** from code (e.g., `bypassNl` field) ← 15 pts
- [ ] **Behavior described using code logic** (e.g., "when `checkBypass()` returns true...") ← 10 pts
- [ ] **2+ file paths mentioned** (e.g., `lldpFa.c`, `faZeroTouchClient.c`) ← 5 pts

### Commit Metadata Integration (25 points):
- [ ] **At least 1 commit hash** referenced (e.g., commit `a1b2c3d`) ← 5 pts
- [ ] **2+ changed files** mentioned (e.g., "Changes to lldpFa.c and netlogin.c") ← 5 pts
- [ ] **New vs modified** functionality identified ← 10 pts
- [ ] **Deprecated features** noted (if applicable) ← 5 pts

### Test Module Alignment (25 points):
- [ ] **1+ TCL test module** referenced (e.g., `fabAttachBypassNl.tcl`) ← 10 pts
- [ ] **3+ test keywords** mentioned ← 10 pts
- [ ] **Test scenarios** aligned with actual tests ← 5 pts

**Target Score**: 75/100 minimum (good), 85/100 excellent

---

## 🎯 Quick Wins (Immediate Actions)

### Priority 1: Add Mandatory Instructions to System Prompt ⚡
**Time**: 5 minutes  
**Impact**: HIGH  
**What**: Add "CRITICAL: Code Commit Integration Requirements" section to system prompt  
**Why**: Forces LLM to use commit data

### Priority 2: Make Commit Section More Prominent ⚡
**Time**: 5 minutes  
**Impact**: HIGH  
**What**: Add "⚠️ CRITICAL: You MUST use this code commit data" to user prompt  
**Why**: Emphasizes importance of commit data

### Priority 3: Add Examples (Good vs Bad)
**Time**: 10 minutes  
**Impact**: MEDIUM  
**What**: Show LLM examples of acceptable vs unacceptable documentation  
**Why**: Provides clear guidance on expectations

---

## 💡 Pro Tips

1. **Use Actual Commits as Training Examples**
   - When testing, use features that have real git commits
   - Verify commit analysis is returning data before evaluating

2. **Check Commit Analysis Logs**
   ```bash
   # On remote server
   ssh root@10.127.26.9
   cd ~/networking-qa-workflow/backend
   pm2 logs backend --lines 100 | grep -i "commit"
   ```

3. **Monitor Validation Scores**
   - After implementing validation, track scores over time
   - Aim for consistent 75+ scores

4. **Iterate on Prompt Engineering**
   - Test different instruction phrasings
   - Track which instructions work best with Claude vs GPT

---

## 📝 Summary

**Problem**: Code Commit Alignment failing (15% of evaluation score)  
**Root Cause**: LLM ignoring commit data despite it being available  
**Solution**: Strengthen system prompt with mandatory requirements + add validation  
**Expected Result**: 75-85/100 Code Commit Alignment score (vs current ~10/100)  
**Implementation Time**: 25 minutes  
**Effort**: Low (prompt engineering only, no code logic changes)

---

*Last Updated: July 23, 2026*  
*Related: SKILL_FILE_EVALUATION_CRITERIA.md, SKILL_GENERATION_COMPARISON.md*
