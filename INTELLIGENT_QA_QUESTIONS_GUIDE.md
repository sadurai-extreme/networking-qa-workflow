# Intelligent QA Question Selection Guide
## Context-Aware Test Plan Information Gathering

**Version**: 1.0  
**Date**: 2026-07-06  
**Purpose**: Guide for generating contextual QA questions based on specific Jira tickets

---

## 🎯 Core Principle

> **"Don't ask generic questions. Analyze the Jira FIRST, understand what kind of feature it is, then ask ONLY the questions that are relevant to THIS specific feature."**

---

## ❌ What NOT To Do: Generic Questionnaire

### Bad Approach
```
Agent reads Jira ticket → Shows 50-question form to user

Questions asked to EVERYONE:
1. Number of devices?
2. VLAN IDs?
3. NSI values?
4. Time manipulation needed?
5. License provisioning?
6. Banner warnings?
7. Cloud platforms?
... (43 more questions)

User experience: 😤 "Why are you asking about VLANs for a license feature?!"
Time: 15-20 minutes
Relevance: ~30%
```

---

## ✅ What TO Do: Intelligent Selection

### Good Approach
```
Agent reads Jira ticket → Analyzes feature type → Selects relevant questions → Asks 8-15 targeted questions

EXOS-39453: "License expiration warning when not connected to cloud"

Analysis:
- Keywords: expiration, warning, show license, cloud, disconnect
- Feature type: Time-based + License + CLI + Cloud connectivity

Questions (10 total, 100% relevant):
✅ Can we use 'configure time' to test expiration?
✅ How to provision licenses? (API PATCH? Debug CLI?)
✅ Where do warnings appear? (CLI? Banner? Logs?)
✅ XIQ vs XIQ-SE differences?
✅ Reboot persistence?

NOT asking:
❌ VLAN configuration
❌ NSI values  
❌ Traffic patterns
❌ Protocol parameters

User experience: 😊 "This agent understands my feature!"
Time: 3-5 minutes
Relevance: 100%
```

---

## 🧠 The Decision Algorithm

### Step 1: Keyword Analysis

Extract keywords from Jira summary + description:

```javascript
const keywords = extractKeywords(jira.summary + jira.description);

// Keywords → Feature Indicators
if (hasAny(keywords, ['expiration', 'timeout', 'periodic', 'timer', 'schedule']))
  → feature_types.push('TIME_BASED');

if (hasAny(keywords, ['license', 'trial', 'subscription', 'pilot']))
  → feature_types.push('LICENSE');

if (hasAny(keywords, ['show', 'display', 'output', 'CLI', 'command']))
  → feature_types.push('CLI_OUTPUT');

if (hasAny(keywords, ['cloud', 'XIQ', 'disconnect', 'connect', 'online']))
  → feature_types.push('CLOUD_CONNECTIVITY');

if (hasAny(keywords, ['HA', 'failover', 'redundancy', 'backup', 'standby']))
  → feature_types.push('HIGH_AVAILABILITY');

if (hasAny(keywords, ['VLAN', 'NSI', 'ISID', 'SPBM', 'FA', 'Fabric']))
  → feature_types.push('PROTOCOL');

if (hasAny(keywords, ['banner', 'warning', 'message', 'alert', 'notification']))
  → feature_types.push('USER_NOTIFICATION');
```

---

### Step 2: Category Mapping

Map feature types to question categories:

```
Feature Type          → Ask Questions From
─────────────────────────────────────────────────
TIME_BASED           → Category A (Time manipulation)
LICENSE              → Category B (License provisioning)
                     → Category E (Pilot/Trial types)
CLI_OUTPUT           → Category C (UI/Output locations)
CLOUD_CONNECTIVITY   → Category E (XIQ vs XIQ-SE)
HIGH_AVAILABILITY    → Category D (Failover, reboot)
PROTOCOL             → Protocol-specific questions
USER_NOTIFICATION    → Category C (Banner, logs, SNMP)
```

---

### Step 3: Question Selection

Select only relevant questions:

```javascript
function selectQuestions(feature_types, jira) {
  let questions = [];
  
  if (feature_types.includes('TIME_BASED')) {
    questions.push({
      category: 'A',
      id: 'time_1',
      question: `Can we use 'configure time' to test ${extractTimeFeature(jira)}?`,
      why: "Can't wait 90 days - need time manipulation",
      options: ['Yes', 'No - must wait', 'Other method']
    });
    
    questions.push({
      category: 'A',
      id: 'time_2',
      question: 'What time thresholds need testing?',
      context: `Detected: ${extractThresholds(jira)}`,
      options: ['3 days', '15 days', '30 days', '60 days', '90 days'],
      multi_select: true
    });
  }
  
  if (feature_types.includes('LICENSE')) {
    questions.push({
      category: 'B',
      id: 'license_1',
      question: 'How will QA provision licenses for testing?',
      why: 'Need fast, repeatable setup (not production)',
      options: [
        'NOS-API PATCH /v0/configuration/license/ep1',
        'Debug CLI: debug licMgr ep1 enable',
        'Actual cloud provisioning',
        'Other'
      ],
      multi_select: true
    });
  }
  
  // ... more categories
  
  return questions;
}
```

---

## 📊 Real-World Examples

### Example 1: EXOS-39453 (License Expiration Warning)

#### Jira Analysis:
```
Summary: "Show License improvement for expiration warning when not connected to cloud"
Description: [mentions XIQ, disconnect, expiration, warning message]

Keywords extracted: 
['license', 'expiration', 'warning', 'show', 'cloud', 'XIQ', 'disconnect']

Feature types identified:
✅ TIME_BASED (expiration)
✅ LICENSE (license management)
✅ CLI_OUTPUT (show command)
✅ CLOUD_CONNECTIVITY (XIQ, disconnect)
✅ USER_NOTIFICATION (warning)
```

#### Questions Selected (10 total):

**Category A (Time-Based):**
1. Can we use 'configure time' to test expiration?
2. What time thresholds? (3, 15, 30, 60, 90 days?)
3. Should SNTP be disabled?

**Category B (License Setup):**
4. How to provision licenses? (API? Debug CLI? Cloud?)
5. Are there special license types? (Pilot? Trial?)

**Category C (UI/Output):**
6. Where do warnings appear? (CLI? Banner? Logs?)
7. Is there a banner at specific threshold?

**Category E (Cloud):**
8. Which platforms? (XIQ? XIQ-SE?)
9. Different behavior when disconnected?

**Category D (Operational):**
10. Test after reboot? Failover?

**Questions NOT Asked:**
❌ VLAN configuration (no VLANs mentioned)
❌ NSI values (not FA feature)
❌ Traffic patterns (not traffic-related)
❌ Protocol parameters (not protocol feature)

**Result**: 10 highly relevant questions, user completes in 3 minutes

---

### Example 2: EXOS-39334 (Fabric Attach Fallback VLAN)

#### Jira Analysis:
```
Summary: "Fabric Attach fallback management VLAN creation on FA Proxy"
Description: [mentions NSI, VLAN 4048, SPBM, FA Server/Proxy, retry]

Keywords extracted:
['Fabric', 'Attach', 'FA', 'fallback', 'VLAN', 'NSI', 'SPBM', 'Proxy', 'Server']

Feature types identified:
✅ PROTOCOL (Fabric Attach, SPBM)
✅ CLI_OUTPUT (show commands modified)
❌ TIME_BASED (no time component)
❌ LICENSE (not license-related)
❌ CLOUD_CONNECTIVITY (not cloud-managed)
```

#### Questions Selected (12 total):

**Protocol-Specific:**
1. What VLAN ID for fallback? (specific value needed)
2. What NSI value? (specific value needed)
3. SPBM configuration required?
4. FA topology: Server/Proxy/Client roles?

**Behavior:**
5. When does fallback trigger?
6. Retry mechanism parameters?
7. What happens when FA Server comes back?

**CLI Output:**
8. Which show commands modified?
9. What's the new vs old output?

**Operational:**
10. Test with actual FA Server disconnection?
11. Persistence after reboot?
12. Behavior in stack?

**Questions NOT Asked:**
❌ Time manipulation (not time-based)
❌ License provisioning (not license feature)
❌ Login banners (no user warnings)
❌ Cloud platforms (not cloud-managed)
❌ Pilot licenses (not license-related)

**Result**: 12 highly relevant questions, user completes in 4 minutes

---

### Example 3: Hypothetical ACL Feature

#### Jira Analysis:
```
Summary: "Add support for IPv6 address range in ACL rules"
Description: [mentions ACL, IPv6, range syntax, CLI syntax]

Keywords: ['ACL', 'IPv6', 'range', 'rule', 'CLI']

Feature types:
✅ CLI_OUTPUT (new CLI syntax)
✅ PROTOCOL (ACL, IPv6)
❌ TIME_BASED
❌ LICENSE
❌ CLOUD_CONNECTIVITY
```

#### Questions Selected (8 total):

**CLI Syntax:**
1. New CLI command format?
2. Range syntax: CIDR? Start-End?
3. Show command changes?

**Protocol:**
4. IPv6 address validation?
5. Integration with existing ACL engine?

**Testing:**
6. Traffic patterns to test?
7. Negative cases: invalid ranges?
8. Performance: large range impact?

**Questions NOT Asked:**
❌ Time manipulation
❌ License provisioning
❌ Cloud platforms
❌ Banner warnings
❌ Failover (unless mentioned in Jira)

---

## 🎯 Question Quality Guidelines

### Good Questions
✅ Show understanding of the feature
✅ Include context from Jira
✅ Explain why you're asking
✅ Offer reasonable options
✅ Are specific to this feature

**Example**:
```
Q: "I see this feature involves license expiration. Can we use 'configure time' 
   command to manipulate switch time for testing? This would let us test 30/60/90 
   day expiration without waiting."
   
Why good:
- Shows understanding (expiration = time-based)
- Explains benefit (faster testing)
- Offers specific solution (configure time)
- Relevant to THIS feature
```

### Bad Questions
❌ Generic, applies to everything
❌ No context from Jira
❌ No explanation
❌ Vague options
❌ Irrelevant to feature

**Example**:
```
Q: "How many devices in your topology?"

Why bad:
- Generic (applies to any feature)
- No context (why do I need multiple devices?)
- No explanation
- Could be 1-100 devices
- May not be relevant to this feature
```

---

## 💡 Implementation Tips

### For Agent Developers:

1. **Always analyze Jira first**
   ```javascript
   const jiraAnalysis = analyzeJira(jiraTicket);
   const relevantCategories = selectCategories(jiraAnalysis);
   const questions = generateQuestions(relevantCategories, jiraTicket);
   ```

2. **Include context in questions**
   ```javascript
   question.context = `Detected in Jira: "${extractRelevantText(jira)}"`;
   question.why_asking = explainRelevance(question, jira);
   ```

3. **Show intelligence**
   ```javascript
   // Good
   "I see this feature involves license expiration..."
   
   // Bad
   "Question 1 of 50:"
   ```

4. **Provide targeted options**
   ```javascript
   // Good (based on feature)
   if (isTimeBasedFeature) {
     options: ['3 days', '15 days', '30 days', '60 days', '90 days']
   }
   
   // Bad (generic)
   options: ['Yes', 'No', 'Maybe', 'I don't know']
   ```

---

### For UI Designers:

1. **Show analysis before questions**
   ```
   Feature Analysis:
   - Type: Time-based + License + Cloud connectivity
   - Relevant areas: Time manipulation, License setup, UI output
   - Questions: 10 targeted questions
   ```

2. **Add "Why we're asking" tooltips**
   ```
   Q: Can we use 'configure time'?
   ℹ️ We ask this because: Can't wait 90 days in testing
   ```

3. **Group questions by category**
   ```
   Time-Based Testing (3 questions)
   License Setup (2 questions)
   User Interface (3 questions)
   Operational (2 questions)
   ```

4. **Show what's NOT being asked**
   ```
   Not asking about:
   ❌ VLAN configuration (not relevant)
   ❌ Traffic patterns (not relevant)
   ```

---

## 📈 Success Metrics

| Metric | Generic Approach | Intelligent Approach |
|--------|-----------------|---------------------|
| Questions per Jira | 50+ | 8-15 |
| Time to complete | 15-20 min | 3-5 min |
| Relevance | ~30% | 100% |
| User satisfaction | Low | High |
| Test plan quality | Generic | Comprehensive |
| Shows intelligence | ❌ | ✅ |

---

## 🚀 Implementation Checklist

### Agent Logic:
- [ ] Implement keyword extraction from Jira
- [ ] Implement feature type classification
- [ ] Implement category selection algorithm
- [ ] Create question templates for each category
- [ ] Add context generation for each question
- [ ] Add "why we're asking" explanations

### UI/UX:
- [ ] Show feature analysis before questions
- [ ] Group questions by category
- [ ] Add tooltips explaining relevance
- [ ] Show estimated completion time
- [ ] Display what's NOT being asked
- [ ] Progress indicator

### Backend:
- [ ] Create qaQuestionGenerator.js
- [ ] Integrate with Jira analyzer
- [ ] Add question response storage
- [ ] Pass qaInputs to testPlanGenerator

---

## 📚 Related Documentation

- **TESTPLAN_WORKFLOW_GUIDE.md** - Complete 6-step workflow with intelligent questions
- **TEST_PLAN_GENERATION_GUIDELINES.md** - Question categories reference
- **EXOS-39453_Test_Plan_Comparison.md** - Real example of what was missing

---

## 💭 Final Thoughts

**The key to good test plans is asking the RIGHT questions, not ALL questions.**

A smart agent:
1. ✅ Reads the Jira carefully
2. ✅ Understands what kind of feature it is
3. ✅ Selects only relevant question categories
4. ✅ Asks 8-15 targeted questions
5. ✅ Shows intelligence and understanding

A dumb agent:
1. ❌ Shows 50-question form
2. ❌ Asks about everything
3. ❌ Wastes user time
4. ❌ Annoys users
5. ❌ Looks unintelligent

**Remember**: The goal is to gather information efficiently while showing that you understand the feature. Quality over quantity!
