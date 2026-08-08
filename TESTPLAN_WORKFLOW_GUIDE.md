# Test Plan Generation Workflow Guide
## The QA Engineer's Systematic Approach

**Version**: 2.0  
**Date**: 2026-07-06  
**Purpose**: Complete workflow for generating production-quality EXOS test plans

---

## 🎯 Executive Summary

**The Problem**: Initial AI-generated test plans missed critical real-world scenarios like time manipulation, API setup methods, banner warnings, and failover testing because they relied only on API schemas and Jira descriptions.

**The Solution**: Implement a systematic 6-step QA workflow that gathers comprehensive information BEFORE generating test plans.

**Key Insight**: QA engineers think differently than developers. They need to know:
- How to **set up** tests efficiently (not production workflows)
- What **actually breaks** in production (operational scenarios)
- Where users **actually see** the feature (all interfaces)
- What **edge cases** exist (time manipulation, special configs)

---

## 📊 Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STAGE 2: Skill File Generated                     │
│                    ✓ Jira ticket fetched and analyzed                │
│                    ✓ Skill file created                              │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STAGE 3: Test Plan Generation                     │
│                                                                       │
│    Step 1: Analyze Skill File                                       │
│    Step 2: Run Code Commit Analyzer (if code available)             │
│    Step 3: Gap Analysis                                              │
│    Step 4: ASK QA-STYLE QUESTIONS ⭐ NEW                            │
│    Step 5: Gather All Information                                    │
│    Step 6: Generate Test Plan                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📖 Detailed Workflow

### **STEP 1: Analyze Skill File** (Already Done in Stage 2)

**Purpose**: Understand feature description and initial test scenarios

**What to Extract**:
```
✓ Feature name and Jira ID
✓ Feature description
✓ Test scenarios from skill file
✓ Business context
✓ Customer requirements
```

**Example from EXOS-39453**:
```markdown
Feature: Show License improvement for expiration warning when not connected to cloud
Test Scenarios in Skill File:
1. Verify warning when disconnected from XIQ for 3 days
2. Verify warning cleared when reconnected
3. Test with XIQ-SE (on-premises)
4. Test warning persistence after reboot
```

**Status**: ✅ Automatically loaded by testPlanGenerator.js

---

### **STEP 2: Run Code Commit Analyzer** (Optional but Recommended)

**Purpose**: Understand actual implementation details

**What to Extract**:
```
✓ Modified files (C source, API endpoints, CLI handlers)
✓ Specific values used (VLANs, thresholds, NSI)
✓ Implementation architecture
✓ New CLI commands or API endpoints
✓ Configuration parameters
```

**Example Output**:
```
Files Changed:
- licMgrServer.c (license warning logic)
- showLicense.c (CLI command output)
- licenseApi.c (API endpoint handlers)

Specific Values Found:
- Warning thresholds: 90, 60, 30 days
- API endpoint: /v0/system/services/state
- Cloud state: CONNECTED / DISCONNECTED
- Warning levels: MINOR, MAJOR, CRITICAL
```

**How to Use in Workflow**:
1. If xos_exos repository available → Run commit analyzer
2. Parse commit analysis for specific values
3. Use values in test plan (not generic "10, 20, 100")

**Status**: 🔄 Currently manual, needs integration

---

### **STEP 3: Gap Analysis**

**Purpose**: Identify what's NOT mentioned in skill file or code commits

**Questions to Answer**:
```
❓ What operational scenarios are missing?
   - Failover, reboot, upgrade, stack formation
   
❓ What user interfaces are missing?
   - Login banners, system logs, SNMP traps
   
❓ What test setup methods are missing?
   - API configuration, debug CLI, time manipulation
   
❓ What edge cases are missing?
   - Pilot licenses, XIQ-SE, special modes
```

**Example Gap Analysis for EXOS-39453**:
```
Found in Skill File:
✓ Warning when disconnected 3 days
✓ Warning cleared on reconnect
✓ XIQ-SE testing
✓ Reboot persistence

MISSING from Skill File:
❌ Time manipulation with 'configure time' command
❌ API-based license configuration (PATCH operations)
❌ Banner warning at login (critical user notification!)
❌ Failover testing
❌ Pilot license behavior
❌ show license vs show license detail
❌ 15-day banner threshold
❌ SNTP-client interaction
```

**Status**: 🔄 Currently manual, needs to be systematic

---

### **STEP 4: ASK QA-STYLE QUESTIONS** ⭐ **MOST CRITICAL STEP**

**Purpose**: Uncover real-world testing scenarios that developers/Jira don't mention

**Why This Was Missing**: 
- AI focused on API architecture
- Didn't ask HOW QA actually tests features
- Assumed production workflows = test workflows (WRONG!)

---

## 🎯 **INTELLIGENT QUESTION SELECTION**

**CRITICAL**: Questions must be **contextual and adaptive** based on the specific Jira ticket, NOT a generic questionnaire!

### **Step 4A: Analyze Jira Ticket First**

Before asking ANY questions, analyze the Jira ticket to determine:

```
1. What TYPE of feature is this?
   - Time-based? (expiration, timeout, periodic events)
   - Protocol/networking? (VLAN, routing, FA, VXLAN)
   - License-related? (provisioning, validation, enforcement)
   - CLI/API? (new commands, modified output)
   - Security? (authentication, authorization, encryption)
   - Configuration? (new settings, parameters)
   - HA/Redundancy? (failover, clustering, sync)

2. What KEYWORDS indicate specific testing needs?
   - "expiration", "timeout", "periodic" → Time-based questions
   - "license", "subscription", "trial" → License questions
   - "banner", "message", "display" → UI/output questions
   - "cloud", "XIQ", "disconnect" → Cloud connectivity questions
   - "stack", "failover", "HA" → Operational questions
   - "VLAN", "NSI", "ISID" → Protocol-specific questions

3. What's MISSING from the Jira description?
   - No mention of test setup → Ask setup questions
   - No mention of timeframes → Ask time-based questions
   - No mention of user interface → Ask UI questions
   - No mention of HA → Ask operational questions
```

### **Step 4B: Select Relevant Question Categories**

**Example Decision Tree**:

```
IF Jira mentions "expiration" OR "timeout" OR "periodic":
  → ASK: Category A (Time-Based Testing)
  
IF Jira mentions "license" OR "trial" OR "subscription":
  → ASK: Category B (Test Setup - License provisioning)
  → ASK: Category E (Special Configurations - Pilot/Trial)
  
IF Jira mentions "show" OR "display" OR "output" OR "CLI":
  → ASK: Category C (User Interfaces - CLI, banner, logs)
  
IF Jira mentions "cloud" OR "XIQ" OR "disconnect":
  → ASK: Category E (Special Configurations - Cloud platforms)
  
IF Jira mentions "stack" OR "failover" OR "HA" OR "redundancy":
  → ASK: Category D (Operational Scenarios - HA testing)
  
IF Jira mentions "VLAN" OR "NSI" OR "ISID":
  → ASK: Protocol-specific questions (not in generic categories)
  
IF feature modifies existing command:
  → ASK: "What's the old vs new output?"
  → ASK: "Are there related commands to test?"
```

### **Step 4C: Ask ONLY Relevant Questions**

---

## 📝 **REAL EXAMPLE: EXOS-39453**

### **What Agent Should Do**:

#### **1. Analyze Jira Ticket**
```
Jira ID: EXOS-39453
Summary: "Show License improvement for expiration warning when not connected to cloud"

Keywords Found:
✓ "expiration" → Time-based feature
✓ "warning" → User-facing message
✓ "show" → CLI command
✓ "cloud" → Cloud connectivity
✓ "license" → License management

Feature Type: Time-based + License + CLI + Cloud connectivity
```

#### **2. Determine Relevant Questions**

```
Category A (Time-Based): ✅ YES - Feature involves expiration
Category B (Test Setup): ✅ YES - Need to configure licenses
Category C (UI/Output): ✅ YES - "show license" output + warnings
Category D (Operational): ✅ YES - Production switches need failover
Category E (Special Config): ✅ YES - Cloud platforms, license types
Category F (Integration): ⚠️ MAYBE - Ask if time sync matters
Category G (Negative): ✅ YES - Always ask
```

#### **3. Ask Smart, Contextual Questions**

```
🤖 Agent: "I see this feature involves license expiration warnings. Let me ask some targeted questions:

TIME-BASED TESTING (detected 'expiration' in Jira):
───────────────────────────────────────────────────
Q1. Can we use 'configure time' command to manipulate switch time?
    This would let us test 30/60/90 day expiration without waiting.
    Options: [Yes] [No - must wait] [Other method: ___]

Q2. What specific time thresholds should we test?
    I see "expiration warning" mentioned. Common thresholds:
    Options: [3 days] [15 days] [30 days] [60 days] [90 days] [Other: ___]
    (Select all that apply)

LICENSE PROVISIONING (detected 'license' in Jira):
───────────────────────────────────────────────────
Q3. How will QA set up licenses for testing?
    Options:
    [ ] NOS-API PATCH /v0/configuration/license/ep1
    [ ] Debug CLI: debug licMgr ep1 enable <level> <tier> <seconds>
    [ ] Actual cloud provisioning (requires XIQ access)
    [ ] Other: ___________________

Q4. Are there special license types to test?
    Options: [Pilot] [Trial] [Perpetual] [Standard only]

USER INTERFACE (detected 'show' command in Jira):
───────────────────────────────────────────────────
Q5. Where should users see expiration warnings?
    I see "show License" mentioned. Are there other places?
    Options:
    [ ] show license (primary)
    [ ] show license detail
    [ ] show licenses slot all
    [ ] Login banner
    [ ] System logs (EMS)
    [ ] SNMP traps
    [ ] Other: ___________________

Q6. Is there a login banner warning at any threshold?
    Common for critical warnings (e.g., "license expiring in X days")
    Options: [Yes - at ___ days] [No]

CLOUD CONNECTIVITY (detected 'cloud' in Jira):
───────────────────────────────────────────────────
Q7. Which cloud platforms need testing?
    Options: [XIQ (cloud)] [XIQ-SE (on-premises)] [Both] [Other: ___]

Q8. Does warning behavior differ when disconnected vs connected?
    Options:
    [ ] Yes - different warning messages
    [ ] Yes - warnings only when disconnected
    [ ] No - same behavior
    Explain: ___________________

OPERATIONAL SCENARIOS (production switches):
───────────────────────────────────────────────────
Q9. Should we test after switch reboot?
    Options: [Yes - warning must persist] [Not needed]

Q10. Should we test after failover? (HA switches)
    Options: [Yes - HA critical] [Not applicable - single node only]
"
```

---

## 🚫 **WHAT NOT TO DO**

### ❌ **Bad Approach: Generic Questionnaire**

```
🤖 Agent: "Please answer ALL questions below:

1. Device topology (number of switches)?
2. What VLANs are used?
3. What NSI values?
4. What protocols involved?
5. Time-based testing needed?
6. License provisioning method?
7. Banner warnings?
8. Cloud platforms?
9. Failover testing?
10. Stack testing?
11. SNMP testing?
... (50 more questions)
```

**Problems**:
- User must read 50 questions, answer all
- Many irrelevant (e.g., asking about NSI for license feature)
- Wastes time
- Annoys users
- Looks unintelligent

---

## ✅ **GOOD APPROACH: Intelligent, Contextual Questions**

### **Example 1: EXOS-39453 (License Expiration)**

```
Jira Analysis:
- Feature: License expiration warnings
- Keywords: expiration, warning, show license, cloud

Questions Asked: (10 targeted questions)
✅ Time manipulation? (relevant - expiration)
✅ License provisioning? (relevant - license feature)
✅ Where users see warnings? (relevant - show command)
✅ Cloud platforms? (relevant - "not connected to cloud")
✅ Reboot/failover? (relevant - production switches)

Questions NOT Asked:
❌ VLAN configuration (not relevant)
❌ NSI values (not relevant)
❌ Traffic patterns (not relevant)
❌ Protocol parameters (not relevant)
```

### **Example 2: EXOS-39334 (Fabric Attach Fallback VLAN)**

```
Jira Analysis:
- Feature: FA fallback management VLAN
- Keywords: Fabric Attach, VLAN, fallback, NSI, SPBM

Questions Agent SHOULD Ask:
✅ What VLAN ID for fallback? (relevant - VLAN feature)
✅ What NSI value? (relevant - FA uses NSI)
✅ SPBM configuration? (relevant - FA requires SPBM)
✅ Topology: FA Server/Proxy/Client? (relevant - FA topology)
✅ What happens when FA Server unavailable? (relevant - "fallback")
✅ Retry mechanism parameters? (relevant - connection retry)

Questions Agent SHOULD NOT Ask:
❌ Time manipulation? (not time-based feature)
❌ License provisioning? (not license-related)
❌ Login banner warnings? (no user warnings mentioned)
❌ Cloud connectivity? (not cloud-managed)
```

---

## 🧠 **INTELLIGENT QUESTION ALGORITHM**

### **Pseudo-code for Agent**:

```python
def generate_qa_questions(jira_ticket, skill_file, gap_analysis):
    """
    Generate contextual QA questions based on feature analysis
    """
    
    # Step 1: Analyze feature type
    feature_keywords = extract_keywords(jira_ticket.summary + jira_ticket.description)
    feature_type = classify_feature(feature_keywords)
    
    # Step 2: Determine relevant question categories
    relevant_categories = []
    
    if has_keywords(feature_keywords, ['expiration', 'timeout', 'periodic', 'timer']):
        relevant_categories.append('TIME_BASED')
        
    if has_keywords(feature_keywords, ['license', 'trial', 'subscription', 'pilot']):
        relevant_categories.append('LICENSE_PROVISIONING')
        relevant_categories.append('LICENSE_TYPES')
        
    if has_keywords(feature_keywords, ['show', 'display', 'output', 'CLI']):
        relevant_categories.append('USER_INTERFACES')
        
    if has_keywords(feature_keywords, ['cloud', 'XIQ', 'disconnect', 'connect']):
        relevant_categories.append('CLOUD_PLATFORMS')
        
    if has_keywords(feature_keywords, ['HA', 'failover', 'redundancy', 'stack']):
        relevant_categories.append('OPERATIONAL_HA')
        
    if has_keywords(feature_keywords, ['VLAN', 'NSI', 'ISID', 'SPBM', 'FA']):
        relevant_categories.append('PROTOCOL_SPECIFIC')
    
    # Step 3: Check gaps from gap analysis
    if gap_analysis.missing_banner_tests:
        relevant_categories.append('BANNER_WARNINGS')
        
    if gap_analysis.missing_api_setup:
        relevant_categories.append('API_CONFIGURATION')
    
    # Step 4: Generate only relevant questions
    questions = []
    for category in relevant_categories:
        questions.extend(get_questions_for_category(category, jira_ticket))
    
    # Step 5: Add context to each question
    questions = add_context_to_questions(questions, jira_ticket, skill_file)
    
    return questions


def get_questions_for_category(category, jira_ticket):
    """
    Get category-specific questions with Jira context
    """
    if category == 'TIME_BASED':
        return [
            {
                'id': 'time_1',
                'question': f"Can we use 'configure time' to test {extract_time_feature(jira_ticket)}?",
                'context': f"Feature involves: {extract_time_feature(jira_ticket)}",
                'options': ['Yes', 'No - must wait', 'Other method'],
                'why_asking': 'Cannot wait 90 days in testing - need time manipulation'
            },
            {
                'id': 'time_2',
                'question': 'What time thresholds need testing?',
                'context': f"Detected in Jira: {extract_thresholds(jira_ticket)}",
                'options': ['3 days', '15 days', '30 days', '60 days', '90 days'],
                'multi_select': True
            }
        ]
    
    elif category == 'LICENSE_PROVISIONING':
        return [
            {
                'id': 'license_1',
                'question': 'How will QA provision licenses for testing?',
                'context': 'Need fast, repeatable license setup (not production workflow)',
                'options': [
                    'NOS-API PATCH /v0/configuration/license/ep1',
                    'Debug CLI: debug licMgr ep1 enable',
                    'Actual cloud provisioning',
                    'Other'
                ],
                'multi_select': True
            }
        ]
    
    # ... other categories
    
    return []
```

---

## 📊 **COMPARISON: Generic vs Intelligent**

| Aspect | Generic Questions | Intelligent Questions ✅ |
|--------|------------------|------------------------|
| **Number of Questions** | 50+ for every Jira | 8-15 relevant only |
| **Relevance** | Many irrelevant | 100% relevant |
| **User Experience** | Tedious, annoying | Focused, efficient |
| **Time to Complete** | 15-20 minutes | 3-5 minutes |
| **Intelligence** | Looks dumb | Looks smart |
| **Context** | No context | Shows understanding |
| **Adaptability** | One-size-fits-all | Adaptive per feature |

---

## 🎯 **IMPLEMENTATION REQUIREMENTS**

### **For Agent Logic**:

```javascript
// In testPlanGenerator.js or new qaQuestionGenerator.js

async function generateQAQuestions(jiraTicket, skillFile, gapAnalysis) {
  // 1. Extract keywords from Jira
  const keywords = extractKeywords(jiraTicket.summary + jiraTicket.description);
  
  // 2. Classify feature type
  const featureType = classifyFeature(keywords);
  
  // 3. Determine relevant categories
  const categories = determineRelevantCategories(keywords, gapAnalysis);
  
  // 4. Generate contextual questions
  const questions = categories.flatMap(cat => 
    getQuestionsForCategory(cat, jiraTicket)
  );
  
  // 5. Add "why we're asking" context
  questions.forEach(q => {
    q.context = generateQuestionContext(q, jiraTicket, skillFile);
  });
  
  return {
    featureType,
    relevantCategories: categories,
    questions: questions,
    totalQuestions: questions.length
  };
}
```

### **For Frontend UI**:

```jsx
// Smart question display
<QAQuestionsModal>
  <FeatureAnalysis>
    Feature Type: {featureType}
    Relevant Areas: {categories.join(', ')}
    Questions: {questions.length} targeted questions
  </FeatureAnalysis>
  
  {questions.map(q => (
    <Question key={q.id}>
      <QuestionText>{q.question}</QuestionText>
      <Context>{q.why_asking}</Context>
      <DetectedInJira>{q.jira_context}</DetectedInJira>
      <Options>{q.options}</Options>
    </Question>
  ))}
</QAQuestionsModal>
```

---

## 💡 **KEY TAKEAWAY**

> **"Don't ask generic questions. Analyze the Jira first, understand what kind of feature it is, then ask ONLY the questions that make sense for THIS specific feature."**

**Smart Agent**:
1. Reads Jira: "License expiration warning"
2. Thinks: "Ah, time-based + license + CLI + cloud"
3. Asks: 10 targeted questions about time manipulation, license setup, warning display, cloud platforms

**Dumb Agent**:
1. Reads Jira
2. Shows: 50-question generic form
3. User frustrated: "Why are you asking about VLANs for a license feature?!"

---

#### **Category A: Time-Based Testing**

**ONLY ASK IF**: Jira mentions time, expiration, timeout, periodic events, or scheduling

```
🤖 Agent should ask:

"I see this feature involves license expiration warnings. Let me ask you about time-based testing:

1. Can we use the 'configure time' command to manipulate switch time for testing?
   □ Yes → Add time manipulation test cases
   □ No → Use wait periods or simulated time

2. Should SNTP-client be disabled during time manipulation?
   □ Yes → Add 'disable sntp-client' to test setup
   □ No → Note SNTP interaction

3. What specific time intervals need testing?
   Your options: [3 days] [15 days] [30 days] [60 days] [90 days] [Other: ___]
   
4. Can time be reverted to clear the warning state?
   □ Yes → Add time revert test case
   □ No → Warning persists

5. Does the feature have different thresholds at specific time boundaries?
   Example: Different warning at 3 days vs 15 days vs 30 days
   Please specify thresholds: ___________________
"
```

**Real Example - What We Missed**:
```
Official Test: "Change time forward 3 days using configure time command"
AI Test: "Wait 30 days for license expiration" 

QA Reality: Can't wait 30 days! Must use configure time.
```

---

#### **Category B: Test Setup & Configuration**

For any configurable feature:

```
🤖 Agent should ask:

"How will QA set up this feature for testing? (Select all that apply)

□ NOS-API PATCH operations
   → API endpoint: ___________________
   → Sample payload needed? Yes/No
   
□ Debug CLI commands
   → Example command: ___________________
   → Requires admin privileges? Yes/No
   
□ Production CLI commands
   → Standard user workflow? Yes/No
   
□ Cloud provisioning (actual XIQ/XIQ-SE)
   → Requires active subscription? Yes/No
   
□ Test-only configuration methods
   → Describe: ___________________

Follow-up: Do we need BOTH API and CLI test setup methods?
"
```

**Real Example - What We Missed**:
```
Official Test: "Use NOS-API PATCH /v0/configuration/license/ep1 with 
                payload { level: PREMIUM, expiryPeriod: 864000 }"

AI Test: "Install license from ExtremeCloud IQ"

QA Reality: Tests use API PATCH for fast, repeatable setup!
```

---

#### **Category C: User Interfaces & Output**

For features that display information:

```
🤖 Agent should ask:

"Where will users see this feature in action? (Check ALL that apply)

□ CLI command output
   → Primary command: ___________________
   → Detail variant: ___________________ (e.g., 'show license detail')
   → Slot-specific: ___________________ (e.g., 'show licenses slot all')
   
□ Login banner / pre-login message
   → When displayed: ___________________
   → Example message: ___________________
   
□ System logs (EMS logs)
   → Log level: [Info] [Warn] [Error] [Critical]
   → When logged: ___________________
   
□ SNMP traps
   → Trap ID: ___________________
   
□ Web UI
   → Which page/section: ___________________
   
□ API response
   → Endpoint: ___________________
   
□ LED indicators
   → Which LEDs: ___________________

Which interface is PRIMARY for users to discover this feature?
"
```

**Real Example - What We Missed**:
```
Official Test: "Verify banner message at 15-day disconnect: 
                'license check failed, license assignment will expire in 15 day(s)'"

AI Test: Only tested 'show license' command output

QA Reality: Banner is PRIMARY notification - users see it at login!
```

---

#### **Category D: Operational Scenarios**

For production features:

```
🤖 Agent should ask:

"Let's cover operational/production scenarios:

HIGH AVAILABILITY:
1. Does this feature need HA/failover testing?
   □ Yes → What should persist after failover: ___________________
   □ No → Single-node feature
   
2. Is configuration synchronized between active/standby?
   □ Yes → Test sync mechanism
   □ No → Independent configuration

SWITCH LIFECYCLE:
Which events should we test? (Select all that apply)
□ Soft reboot (save & reboot)
□ Hard power cycle
□ Process restart (restart process <name>)
□ Image upgrade to newer version
□ Image downgrade to older version
□ Rolling reboot (in stack)
□ Configuration reset (unconfigure switch)

STACKING & MULTI-NODE:
3. Does this feature work in stacking environments?
   □ Yes → Test these scenarios:
      □ Stack formation with mixed license types
      □ Master/backup slot behavior differences
      □ Slot addition to active stack
      □ Slot removal from active stack
      □ Slot replacement
      □ ZTP stack formation
   □ No → Single-node only
"
```

**Real Example - What We Missed**:
```
Official Test: "Perform failover and verify warning persists"

AI Test: No failover testing

QA Reality: Production switches run HA - MUST test failover!
```

---

#### **Category E: Special Configurations**

For features with variants:

```
🤖 Agent should ask:

"Are there different types/modes/tiers to test?

LICENSE TYPES (if applicable):
□ Pilot licenses (different behavior?)
□ Trial licenses
□ Perpetual licenses
□ Base tier
□ Premier tier
□ Standard/Advanced/Premium levels

MANAGEMENT PLATFORMS (if applicable):
Which platforms need testing?
□ ExtremeCloud IQ (XIQ) - Cloud-based
□ XIQ-SE (Site Engine) - On-premises
□ XMC (Management Center) - Legacy
□ Standalone (no management platform)

Do these platforms have DIFFERENT behavior for this feature?
□ Yes → Separate test cases needed for each
□ No → Generic cloud connectivity test

CONNECTIVITY SCENARIOS:
□ Feature behavior changes when disconnected from cloud
□ Different behavior for different disconnect durations
   → Thresholds: ___________________
□ State changes when reconnecting
"
```

**Real Example - What We Missed**:
```
Official Test: "Test pilot license with payload { pilot: true, expiryPeriod: 864000 }"

AI Test: Only tested standard licenses

QA Reality: Pilot customers have different expiry logic!
```

---

### **STEP 5: Gather All Information**

**Purpose**: Compile complete picture before generating test plan

**Information Sources**:
1. ✅ Skill file (feature description, scenarios)
2. ✅ Code commits (specific values, implementation)
3. ✅ Gap analysis (missing scenarios)
4. ⭐ **QA questions responses** (operational reality)

**Compilation Format**:
```json
{
  "feature": "EXOS-39453",
  "skillFile": { ... },
  "codeAnalysis": { ... },
  "gapAnalysis": { ... },
  "qaInputs": {
    "timeBasedTesting": {
      "useConfigureTime": true,
      "disableSNTP": true,
      "testIntervals": [3, 15, 30, 60, 90],
      "canRevertTime": true
    },
    "testSetupMethods": {
      "apiConfig": {
        "enabled": true,
        "endpoint": "/v0/configuration/license/ep1",
        "samplePayload": "{ level: PREMIUM, expiryPeriod: 864000 }"
      },
      "debugCLI": {
        "enabled": true,
        "command": "debug licMgr ep1 enable PREMIUM A 864000"
      }
    },
    "userInterfaces": {
      "primary": "login_banner",
      "cliCommands": ["show license", "show license detail"],
      "banner": {
        "threshold": "15 days",
        "message": "license check failed, license assignment will expire in X day(s)"
      },
      "logs": {
        "level": "Error",
        "frequency": "Daily after 15 days"
      }
    },
    "operationalScenarios": {
      "failover": true,
      "reboot": true,
      "stack": false
    },
    "specialConfigs": {
      "pilotLicenses": true,
      "platforms": ["XIQ", "XIQ-SE"],
      "connectivity": {
        "disconnectThresholds": [3, 15]
      }
    }
  }
}
```

---

### **STEP 6: Generate Test Plan**

**Purpose**: Now create comprehensive test plan with ALL information

**Test Plan Categories** (from gathered info):

1. **Basic Functionality** (from skill file)
2. **Boundary Value Testing** (from code analysis thresholds)
3. **Time Manipulation Tests** ⭐ (from QA inputs)
4. **API Configuration Tests** ⭐ (from QA inputs)
5. **Banner & UI Tests** ⭐ (from QA inputs)
6. **Operational Tests** ⭐ (from QA inputs - failover, reboot)
7. **Special Configurations** ⭐ (from QA inputs - pilot, XIQ-SE)
8. **State Transitions** (from gap analysis)
9. **Integration Tests** (from code analysis)
10. **Negative Tests** (from all sources)

**Test Case Structure**:
```markdown
#### 5.X.Y Test Case Title

**Objective**: Clear test objective

**Topology**: Topology-1/2/3

**Prerequisites**:
- Specific values (VLAN 4048, not "mgmt VLAN")
- Setup from testcase 5.2.1 (cross-reference)
- Time manipulation: configure time +3 days
- SNTP disabled: disable sntp-client

**Test Methodology**:
1. Configure license via API PATCH /v0/configuration/license/ep1
2. Use configure time command to advance 15 days
3. Reboot switch
4. Verify banner message at login
5. Execute show license and show license detail
6. Check EMS logs for error messages

**Expected Results**:
- Banner displays: "license check failed..."
- show license shows warning
- show license detail shows warning
- EMS log entry created

**Pass Criteria**:
Verify as per methodology

**Sanity (Yes/No)**: Yes
**Automatable (Yes/No)**: Yes
```

---

## 🔧 Implementation in Code

### Current testPlanGenerator.js Integration

**Already Supported**:
```javascript
async generateTestPlan(options) {
  const {
    skillFileContent,      // ✅ Step 1
    gapAnalysis,           // ✅ Step 3
    testPlanInfo,          // ⚠️ Step 5 (partial)
    ...
  } = options;
```

**Need to Add**:
```javascript
async generateTestPlan(options) {
  const {
    skillFileContent,      // ✅ Step 1
    codeCommitAnalysis,    // 🆕 Step 2
    gapAnalysis,           // ✅ Step 3
    qaInputs,              // 🆕 Step 4 (QA questions)
    testPlanInfo,          // ✅ Step 5 (compiled)
    ...
  } = options;
```

### Recommended Prompt Enhancement

**Add to buildUserPrompt()**:
```javascript
// CRITICAL: QA-Style Testing Techniques
if (qaInputs?.timeBasedTesting?.useConfigureTime) {
  prompt += `
### Time Manipulation Testing (CRITICAL)

QA will use 'configure time' command to manipulate switch time:
- Disable SNTP: disable sntp-client
- Advance time: configure time +[days] days
- Test intervals: ${qaInputs.timeBasedTesting.testIntervals.join(', ')} days
- Time revert: ${qaInputs.timeBasedTesting.canRevertTime ? 'Supported' : 'Not supported'}

**REQUIREMENT**: Every time-based test case MUST use configure time command.
DO NOT say "wait for 30 days" - use "configure time +30 days"
`;
}

// API-Based Test Setup
if (qaInputs?.testSetupMethods?.apiConfig?.enabled) {
  prompt += `
### API-Based License Configuration (CRITICAL)

QA will configure licenses via API for fast, repeatable setup:
- Endpoint: ${qaInputs.testSetupMethods.apiConfig.endpoint}
- Method: PATCH
- Sample payload:
\`\`\`json
${qaInputs.testSetupMethods.apiConfig.samplePayload}
\`\`\`

**REQUIREMENT**: Include test cases that use API PATCH for license configuration.
`;
}

// Banner Testing
if (qaInputs?.userInterfaces?.banner) {
  prompt += `
### Login Banner Testing (CRITICAL)

Banner is PRIMARY user notification:
- Threshold: ${qaInputs.userInterfaces.banner.threshold}
- Message format: "${qaInputs.userInterfaces.banner.message}"

**REQUIREMENT**: Test banner display, not just CLI command output.
`;
}

// Operational Scenarios
if (qaInputs?.operationalScenarios?.failover) {
  prompt += `
### Failover Testing (CRITICAL)

Production switches run HA - MUST test failover:
**REQUIREMENT**: Add test case: "Verify warning persists after failover"
`;
}
```

---

## 📋 Integration Checklist

### For Frontend (Stage 3 UI)

```
□ Step 1: Show "Analyze Skill File" status (already done)
□ Step 2: Add "Run Code Commit Analyzer" button (if xos_exos available)
□ Step 3: Add "Gap Analysis" display
□ Step 4: Show "QA Questions" modal ⭐ MOST IMPORTANT
□ Step 5: Display "Information Summary" before generation
□ Step 6: Generate test plan button (already exists)
```

### For Backend API

```
□ Add POST /api/stage3/code-commit-analysis endpoint
□ Add POST /api/stage3/gap-analysis endpoint
□ Add POST /api/stage3/qa-questions endpoint ⭐
□ Update POST /api/stage3/generate to accept:
   - codeCommitAnalysis
   - gapAnalysis  
   - qaInputs (from questions)
```

### For testPlanGenerator.js

```
□ Update buildUserPrompt() to inject QA inputs
□ Add time manipulation test case templates
□ Add API configuration test case templates
□ Add banner testing test case templates
□ Add operational scenario templates
□ Emphasize specific values over generic ones
```

---

## 🎯 Success Metrics

**Before Workflow** (AI-generated EXOS-39453):
- 22 test cases
- 0 time manipulation tests ❌
- 0 API configuration tests ❌
- 0 banner tests ❌
- 0 failover tests ❌
- 27% sanity coverage

**After Workflow** (with QA questions):
- ~32 test cases
- 6 time manipulation tests ✅
- 2 API configuration tests ✅
- 1 banner test ✅
- 1 failover test ✅
- 1 pilot license test ✅
- 60% sanity coverage ✅

**Gap Closure**: 100% of official test plan scenarios covered

---

## 📚 Documentation References

1. **TEST_PLAN_GENERATION_GUIDELINES.md** - QA questions reference
2. **EXOS-39453_Test_Plan_Comparison.md** - Real example of gaps
3. **INTERACTIVE_QUESTIONNAIRE_INTEGRATION.md** - Frontend implementation
4. **testPlanGenerator.js** - Current implementation

---

## 🚀 Next Steps

1. **Immediate**: Add QA questions modal to Stage 3 UI
2. **Short-term**: Integrate code commit analyzer
3. **Medium-term**: Automate gap analysis
4. **Long-term**: Build question templates for common feature types (licensing, FA, VXLAN, etc.)

---

## 💡 Key Takeaway

> **"QA engineers don't test what you built. They test how it breaks, how users see it, and how it survives production."**

The 6-step workflow ensures we capture:
- ✅ What was built (code analysis)
- ✅ What Jira says (skill file)
- ✅ What's missing (gap analysis)
- ✅ **How QA actually tests it** (QA questions) ⭐
- ✅ Comprehensive test plan (all scenarios)

---

**Version History**:
- v1.0 (2026-07-06): Initial workflow documentation
- v2.0 (2026-07-06): Added comprehensive QA questions and real examples
