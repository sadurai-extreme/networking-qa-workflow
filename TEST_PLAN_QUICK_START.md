# 🚀 Test Plan Generator - Quick Start Guide

## Overview

This guide helps you generate production-quality EXOS Functional Test Plans by collecting all necessary information systematically.

---

## 📚 Available Resources

### 1. **Guidelines Document**
📄 **File**: `TEST_PLAN_GENERATION_GUIDELINES.md`

**Contains**:
- ✅ Key learnings from official vs AI-generated comparison
- ✅ Complete information gathering questionnaire
- ✅ Test case writing best practices
- ✅ Common pitfalls to avoid
- ✅ Quality checklist

**Use When**: You want to understand the full process and best practices

---

### 2. **Interactive CLI Collector**
💻 **File**: `backend/collect-test-plan-info.js`

**Features**:
- Interactive command-line questionnaire
- Guides you through all required information
- Validates inputs as you go
- Saves to JSON file for test plan generation

**How to Use**:
```bash
cd backend
node collect-test-plan-info.js
```

**Output**: Creates `test-plan-info-[JIRA_ID].json` file

---

### 3. **Quick Template (Copy-Paste)**
📋 From `TEST_PLAN_GENERATION_GUIDELINES.md` Section 6

**Use When**: You prefer to fill out a template at your own pace

---

## 🎯 Recommended Workflow

### Option A: Interactive Mode (Easiest)

```bash
# Step 1: Run the interactive collector
cd backend
node collect-test-plan-info.js

# Step 2: Answer all questions
# The tool will guide you through each section

# Step 3: Review and save the JSON file
# File saved as: test-plan-info-EXOS-XXXXX.json

# Step 4: Generate test plan
# Use the JSON file with your test plan generator or
# provide it to AI assistant with:
# "Generate test plan using this information: [paste JSON]"
```

### Option B: Manual Template (Most Control)

```bash
# Step 1: Copy template from guidelines
# See TEST_PLAN_GENERATION_GUIDELINES.md Section 6

# Step 2: Fill in all sections in your text editor

# Step 3: Provide completed template to test plan generator
```

### Option C: Conversational Mode (Most Flexible)

```bash
# Just ask the AI assistant:
"I need to create a test plan for [JIRA-ID]. 
Ask me questions to gather the required information."

# The AI will guide you through the questionnaire interactively
```

---

## 📋 Minimum Required Information

Before generating a test plan, you MUST have:

### ⭐ Critical (Cannot proceed without)
- [ ] Jira Ticket ID
- [ ] Feature description
- [ ] Topology (device models and connections)
- [ ] Technical values (VLANs, NSI, etc.)
- [ ] At least 3 core feature behaviors

### ⚠️ Important (Highly recommended)
- [ ] Negative test scenarios
- [ ] Related ticket references
- [ ] Configuration CLI commands
- [ ] Resilience test requirements

### 💡 Optional (Enhances quality)
- [ ] Edge cases
- [ ] Scaling/performance targets
- [ ] Documentation links
- [ ] Review meeting requirements

---

## 🎨 Example: EXOS-39334

### Minimal Information Set

```yaml
Jira: EXOS-39334
Feature: FA Fallback Mgmt VLAN Auto-Creation
Release: EXOS 33.7
Priority: P2

Topology:
  - 5720 FE (FA Server)
  - 5520 EXOS (FA Proxy DUT)
  - WAP (FA Client)

Values:
  - VLAN: 4048
  - NSI: 15999999
  - Test VLAN: 1000 (NSI 10000)

Behaviors:
  1. Create VLAN 4048 only when ZTP active
  2. Add client ports only on NSI approval
  3. Retry NSI while ZTP active if rejected
```

✅ **This is enough to generate a basic test plan!**

### Complete Information Set

```yaml
[Add all the additional details from the questionnaire]
+ Configuration CLI commands
+ Negative scenarios
+ Edge cases
+ Resilience tests
+ Documentation links
```

✅ **This generates a comprehensive, production-ready test plan!**

---

## 💡 Pro Tips

### 1. **Start with Jira**
Always begin with the Jira ticket ID. The tool can fetch most basic information automatically.

### 2. **Be Specific**
Use exact values:
- ✅ "VLAN 4048" 
- ❌ "management VLAN"

### 3. **Number Your Behaviors**
List feature behaviors as numbered items. Each becomes a test case.

### 4. **Reference Related Tickets**
Mention previous implementations (e.g., EXOS-38257) for context.

### 5. **Specify Device Models**
Use actual models:
- ✅ "5720-24MXW FE"
- ❌ "FA Server switch"

---

## ✅ Quality Gates

Before submitting for test plan generation, check:

| Section | Status |
|---------|--------|
| Jira ticket ID provided | [ ] |
| Feature description complete | [ ] |
| Topology defined with models | [ ] |
| Technical values specified | [ ] |
| 3+ core behaviors listed | [ ] |
| Negative scenarios identified | [ ] |
| Device models specified | [ ] |

**Minimum to proceed**: First 5 checkboxes ✅

**Recommended**: All 7 checkboxes ✅

---

**Ready to start?**

```bash
node backend/collect-test-plan-info.js
```

Or just ask:
> "Help me create a test plan for EXOS-XXXXX"

---

*Last Updated: 2026-07-06*
