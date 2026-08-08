# EXOS-39453: Show License Expiration Warning Enhancement Test Plan

**Feature**: Show License improvement for expiration warning when not connected to cloud  
**Jira ID**: EXOS-39453  
**Priority**: P2 - High  
**Target Release**: EXOS 33.7 or later  
**Test Plan Author**: NOS QA Workflow  
**Date**: 2026-07-06

---

## 1. Introduction

### 1.1 Feature Overview
This feature enhances the `show license` command to display context-aware expiration warnings based on cloud connectivity status. When a switch is disconnected from ExtremeCloud IQ, the warning message emphasizes the need for manual license renewal since auto-renewal is unavailable.

### 1.2 Test Objectives
- Verify enhanced warning messages appear when cloud connectivity is lost
- Validate warning thresholds (90/60/30 days) trigger appropriately
- Confirm standard warnings display when cloud connected
- Test warning message content accuracy and clarity
- Validate API integration with IQAgent operState
- Ensure no warnings appear for valid licenses with sufficient time

### 1.3 Related Components
- **CLI Command**: `show license`, `show licenses slot all`
- **API Endpoint**: `/v0/system/services/state` (IQAgent status)
- **API Schema**: `LicenseExpiryTrap`, `SystemServicesState`, `LicenseEp1Settings`
- **Related Commands**: `show iqagent discovery`, `install license file`

---

## 2. Test Scope

### 2.1 In Scope
- `show license` command warning display logic
- Cloud connectivity state detection (CONNECTED/DISCONNECTED)
- License expiration threshold calculations (90/60/30 days)
- Warning message differentiation based on cloud status
- Runtime state transitions (cloud connect/disconnect)
- Warning level escalation (MINOR/MAJOR/CRITICAL)
- Configuration persistence after reboot
- License state change callbacks

### 2.2 Out of Scope
- Actual license renewal functionality
- ExtremeCloud IQ portal integration
- License file format validation
- License feature enablement/enforcement
- Multi-slot chassis license synchronization (tested separately)
- License tier changes (STANDARD/ADVANCED/PREMIUM)

---

## 3. Test Environment Setup

### 3.1 Topology Requirements
**Topology**: Single EXOS switch with external connectivity

```
┌─────────────────────────┐
│   EXOS Switch (DUT)     │
│   - EXOS 33.7+          │
│   - License installed   │
│   - IQAgent configured  │
└────────┬────────────────┘
         │
         │ Management Interface
         │
┌────────┴────────────────┐
│  ExtremeCloud IQ        │
│  (Cloud Connectivity)   │
└─────────────────────────┘
```

### 3.2 Hardware Requirements
- **Switch Model**: Any EXOS-supported platform (5520, 5720, X465, X870, etc.)
- **Management Port**: Active with internet connectivity
- **License**: Valid EP1 license (STANDARD/ADVANCED/PREMIUM) with controlled expiration dates

### 3.3 Software Requirements
- **EXOS Version**: 33.7 or later
- **License Type**: Extreme Platform ONE Networking (EP1) license
- **IQAgent**: Configured and operational
- **Cloud Access**: ExtremeCloud IQ account with valid subscription

### 3.4 Pre-Test Configuration

#### 3.4.1 Base Configuration
```bash
# Configure management interface
configure vlan Default ipaddress 192.168.1.10/24
enable ipforwarding vlan Default
configure iproute add default 192.168.1.1

# Configure IQAgent
configure iqagent server <cloudiq_server>
enable iqagent
```

#### 3.4.2 License Expiration Date Manipulation
For testing purposes, licenses with controlled expiration dates are required:
- **90-day test**: License expiring in 90 days
- **60-day test**: License expiring in 60 days
- **30-day test**: License expiring in 30 days
- **Expired test**: License already expired
- **Valid test**: License valid for 365+ days

---

## 4. Testing Tools

### 4.1 Verification Tools
- **CLI**: Direct command execution via console or SSH
- **API**: REST API calls to `/v0/system/services/state`
- **Network Tools**: Firewall rules to simulate cloud disconnect
- **Time Manipulation**: System time adjustment (if supported) or wait periods

### 4.2 Verification Commands
```bash
# Check license status
show license
show licenses slot all detail

# Check IQAgent connectivity
show iqagent discovery
show iqagent status

# Check system services state
show management

# API verification
curl -X GET "https://<switch-ip>/api/v0/system/services/state" \
  -H "Authorization: Bearer <token>"
```

---

## 5. Test Cases

### Category 1: Basic Functionality Tests

#### 5.1.1 Verify No Warning with Valid License and Cloud Connected

**Objective**: Confirm no expiration warning appears when license is valid (>90 days) and cloud connected

**Topology**: Single-node

**Prerequisites**:
- Valid license with expiration >90 days remaining
- IQAgent operState = CONNECTED

**Test Methodology**:
1. Verify IQAgent connectivity: `show iqagent discovery`
2. Confirm operState = CONNECTED via API
3. Execute `show license`
4. Verify output format
5. Check for absence of expiration warnings

**Expected Results**:
- Command executes successfully
- License information displays normally
- No expiration warning messages present
- IQAgent status shows CONNECTED

**Pass Criteria**:
- No warnings displayed
- License information accurate
- No error messages

**Sanity**: Yes

---

#### 5.1.2 Verify Enhanced Warning with License Expiring (30 days) and Cloud Disconnected

**Objective**: Confirm enhanced warning appears when license expiring soon AND cloud disconnected

**Topology**: Single-node

**Prerequisites**:
- License with expiration ≤30 days remaining
- IQAgent operState = DISCONNECTED

**Test Methodology**:
1. Configure license with 30-day expiration
2. Disconnect cloud connectivity (block IQAgent traffic)
3. Verify IQAgent operState = DISCONNECTED: `show iqagent discovery`
4. Execute `show license`
5. Capture warning message content
6. Verify manual renewal instructions present

**Expected Results**:
1. Warning message displayed
2. Message indicates cloud disconnect status
3. Manual renewal instructions included
4. Days remaining shown accurately
5. Warning level = CRITICAL

**Warning Message Should Contain**:
```
⚠️ WARNING: License expiration approaching
Days remaining: 30
Cloud connectivity: DISCONNECTED
Action required: Manual license renewal needed
Instructions: Download license from ExtremeCloud IQ portal
              Use: install license file <filename>
              Or restore cloud connectivity
```

**Pass Criteria**:
- Enhanced warning displayed
- Manual instructions present
- Days remaining accurate
- Cloud status mentioned

**Sanity**: Yes

**API Verification**:
```bash
GET /v0/system/services/state
Response: { "iqagent": { "operState": "DISCONNECTED" } }
```

---

#### 5.1.3 Verify Standard Warning with License Expiring (30 days) and Cloud Connected

**Objective**: Confirm standard warning (without manual instructions) when cloud connected

**Topology**: Single-node

**Prerequisites**:
- License with expiration ≤30 days remaining
- IQAgent operState = CONNECTED

**Test Methodology**:
1. Configure license with 30-day expiration
2. Ensure cloud connectivity active
3. Verify IQAgent operState = CONNECTED
4. Execute `show license`
5. Compare warning message to disconnected scenario

**Expected Results**:
- Warning message displayed
- Cloud connectivity status not emphasized
- Reference to ExtremeCloud IQ portal for renewal
- No manual installation instructions (auto-renewal possible)
- Warning level = CRITICAL

**Pass Criteria**:
- Standard warning displayed
- Portal reference included
- No "DISCONNECTED" language
- Auto-renewal mention present

**Sanity**: Yes

---

#### 5.1.4 Verify License Information Display Accuracy

**Objective**: Verify all license fields display correctly alongside warning

**Topology**: Single-node

**Prerequisites**: Any license state

**Test Methodology**:
1. Execute `show license`
2. Verify display of: Level, Tier, Expiry Period, Status
3. Execute `show licenses slot all detail`
4. Cross-reference API response
5. Validate field accuracy

**Expected Results**:
- Level: STANDARD/ADVANCED/PREMIUM
- Tier: A/B/C/D
- Expiry period in days/hours
- Effective status: Yes/No
- Warning (if applicable) aligned with data

**Pass Criteria**:
- All fields accurate
- Warning consistent with expiry data

**Sanity**: No

---

### Category 2: Boundary Value Testing

#### 5.2.1 Verify Warning at 90-Day Threshold (MINOR Level)

**Objective**: Test warning appearance at 90-day boundary

**Topology**: Single-node

**Prerequisites**: License expiring in exactly 90 days

**Test Methodology**:
1. Configure license with 90-day expiration
2. Disconnect cloud (operState = DISCONNECTED)
3. Execute `show license`
4. Verify warning level = MINOR
5. Check warning message content

**Expected Results**:
- Informational warning displayed
- Warning level = MINOR
- Less urgent tone than 30-day warning
- Cloud disconnect status mentioned

**Pass Criteria**: Warning appears at 90-day threshold

**Sanity**: No

---

#### 5.2.2 Verify Warning at 60-Day Threshold (MAJOR Level)

**Objective**: Test warning escalation at 60-day boundary

**Topology**: Single-node

**Prerequisites**: License expiring in exactly 60 days

**Test Methodology**:
1. Configure license with 60-day expiration
2. Disconnect cloud
3. Execute `show license`
4. Verify warning level = MAJOR
5. Compare to 90-day warning severity

**Expected Results**:
- Warning message displayed
- Warning level = MAJOR (escalated from MINOR)
- More urgent than 90-day warning
- Manual renewal instructions present

**Pass Criteria**: Warning escalates appropriately at 60 days

**Sanity**: No

---

#### 5.2.3 Verify Warning at 30-Day Threshold (CRITICAL Level)

**Objective**: Test critical warning at 30-day boundary

**Topology**: Single-node

**Prerequisites**: License expiring in exactly 30 days

**Test Methodology**:
1. Configure license with 30-day expiration
2. Disconnect cloud
3. Execute `show license`
4. Verify warning level = CRITICAL
5. Verify urgency indicators present

**Expected Results**:
- Warning level = CRITICAL
- Maximum urgency tone
- Detailed manual renewal steps
- Service impact warning

**Pass Criteria**: Critical warning appears at 30 days

**Sanity**: No

---

#### 5.2.4 Verify Warning on Expiration Day

**Objective**: Test warning message on day of expiration

**Topology**: Single-node

**Prerequisites**: License expiring today (0 days remaining)

**Test Methodology**:
1. Configure license expiring today
2. Execute `show license`
3. Verify error message severity
4. Check for service impact details

**Expected Results**:
- Error message (not warning)
- Days remaining = 0
- Service impact clearly stated
- Immediate action required

**Pass Criteria**: Day-0 error message appropriate

**Sanity**: No

---

#### 5.2.5 Verify Error Message After Expiration (Expired License)

**Objective**: Test behavior with expired license

**Topology**: Single-node

**Prerequisites**: License expired (negative days)

**Test Methodology**:
1. Use expired license
2. Execute `show license`
3. Verify error message
4. Check for restore instructions
5. Test if features are disabled

**Expected Results**:
- Error message indicating expired license
- Days expired count shown
- Restore instructions provided
- Features may be disabled (per license policy)

**Pass Criteria**: Expired license clearly indicated

**Sanity**: No

---

#### 5.2.6 Verify No Warning at 91+ Days

**Objective**: Confirm no warning beyond 90-day threshold

**Topology**: Single-node

**Prerequisites**: License with >90 days remaining

**Test Methodology**:
1. Configure license with 91+ days
2. Disconnect cloud
3. Execute `show license`
4. Verify NO warning displayed

**Expected Results**:
- No warning messages
- Normal license display
- Even with cloud disconnected

**Pass Criteria**: No warning beyond threshold

**Sanity**: No

---

### Category 3: State Machine Testing

#### 5.3.1 Verify Cloud Disconnect Detection (CONNECTED → DISCONNECTED)

**Objective**: Test runtime detection of cloud disconnect

**Topology**: Single-node

**Prerequisites**:
- License expiring ≤30 days
- Cloud initially connected

**Test Methodology**:
1. Start with IQAgent CONNECTED
2. Execute `show license` (no enhanced warning)
3. Block cloud connectivity (firewall rule)
4. Wait for IQAgent state change (30-60 seconds)
5. Verify `show iqagent discovery` shows DISCONNECTED
6. Execute `show license` again
7. Verify enhanced warning appears

**Expected Results**:
- State transition detected
- Warning changes from standard to enhanced
- No switch reboot required
- Real-time warning update

**Pass Criteria**: Warning updates on state change

**Sanity**: Yes

---

#### 5.3.2 Verify Cloud Reconnect Detection (DISCONNECTED → CONNECTED)

**Objective**: Test runtime detection of cloud reconnect

**Topology**: Single-node

**Prerequisites**:
- License expiring ≤30 days
- Cloud initially disconnected (enhanced warning showing)

**Test Methodology**:
1. Start with enhanced warning displayed
2. Restore cloud connectivity
3. Wait for IQAgent state change
4. Verify `show iqagent discovery` shows CONNECTED
5. Execute `show license`
6. Verify warning reverts to standard format

**Expected Results**:
- State transition detected
- Warning changes from enhanced to standard
- Manual instructions removed
- Portal reference added

**Pass Criteria**: Warning updates on reconnect

**Sanity**: Yes

---

#### 5.3.3 Verify License Renewal Clears Warning

**Objective**: Test warning removal after license renewal

**Topology**: Single-node

**Prerequisites**: Expiring license with warning displayed

**Test Methodology**:
1. Display current warning
2. Install new license: `install license file <filename>`
3. Verify new license has extended expiration
4. Execute `show license`
5. Verify warning cleared

**Expected Results**:
- New license installed successfully
- Expiration date extended
- Warning no longer displayed
- Normal license display

**Pass Criteria**: Warning clears after renewal

**Sanity**: No

---

### Category 4: Switch Events Testing

#### 5.4.1 Verify Warning Persists After Switch Reboot

**Objective**: Confirm warning state persists across reboots

**Topology**: Single-node

**Prerequisites**:
- License expiring ≤30 days
- Cloud disconnected
- Enhanced warning currently displayed

**Test Methodology**:
1. Verify enhanced warning present
2. Save configuration: `save configuration`
3. Reboot switch: `reboot`
4. Wait for switch to come online
5. Verify IQAgent operState = DISCONNECTED
6. Execute `show license`
7. Verify enhanced warning still present

**Expected Results**:
- Configuration persists
- IQAgent state persists
- Warning displays after reboot
- No configuration loss

**Pass Criteria**: Warning persists after reboot

**Sanity**: Yes

---

#### 5.4.2 Verify Warning During IQAgent Process Restart

**Objective**: Test warning display during IQAgent restart

**Topology**: Single-node

**Prerequisites**: License expiring, cloud disconnected

**Test Methodology**:
1. Display current warning state
2. Restart IQAgent process: `restart process iqagent`
3. Wait for process restart (10-30 seconds)
4. Execute `show license` during restart
5. Execute `show license` after restart completes
6. Verify warning consistency

**Expected Results**:
- Warning displays during restart (may show DISCONNECTED)
- Warning correct after restart
- No crash or error

**Pass Criteria**: Warning stable during process restart

**Sanity**: No

---

### Category 5: Integration Testing

#### 5.5.1 Verify API Consistency with CLI Output

**Objective**: Ensure API and CLI show consistent license/IQAgent state

**Topology**: Single-node

**Prerequisites**: Any license state

**Test Methodology**:
1. Execute CLI: `show license`
2. Execute CLI: `show iqagent discovery`
3. Execute API: `GET /v0/system/services/state`
4. Execute API: `GET /v0/license/ep1` (if available)
5. Compare all outputs for consistency

**Expected Results**:
- IQAgent operState matches between CLI and API
- License expiry period matches
- Warning level consistent
- No data discrepancies

**Pass Criteria**: CLI and API data consistent

**Sanity**: No

---

#### 5.5.2 Verify License State Change Callback Triggers

**Objective**: Test callback mechanism on license state changes

**Topology**: Single-node

**Prerequisites**: Expiring license

**Test Methodology**:
1. Register for license state change callbacks (via API if supported)
2. Trigger state change (cloud disconnect)
3. Verify callback fired
4. Check callback payload contains:
   - Old state
   - New state
   - Expiry period
   - Warning level

**Expected Results**:
- Callback triggered on state change
- Payload accurate
- Timestamp included
- No duplicate callbacks

**Pass Criteria**: Callbacks fire correctly

**Sanity**: No

---

#### 5.5.3 Verify SNMP Trap Generation for License Expiry

**Objective**: Test SNMP trap sent on license expiration warning

**Topology**: Single-node with SNMP manager

**Prerequisites**:
- SNMP configured
- License expiring ≤30 days
- Cloud disconnected

**Test Methodology**:
1. Configure SNMP trap receiver
2. Trigger warning condition
3. Monitor for `LicenseExpiryTrap`
4. Verify trap contents:
   - trapId
   - description
   - warningLevel (CRITICAL)
   - expiryPeriod

**Expected Results**:
- Trap sent to configured receiver
- Trap contains accurate data
- Warning level matches CLI display
- Trap description human-readable

**Pass Criteria**: Trap sent with correct data

**Sanity**: No

---

### Category 6: Negative Testing

#### 5.6.1 Verify Behavior with Invalid License File

**Objective**: Test warning with corrupted license

**Topology**: Single-node

**Prerequisites**: Invalid or corrupted license file

**Test Methodology**:
1. Attempt to install invalid license
2. Verify installation fails
3. Execute `show license`
4. Check error messages
5. Verify no misleading warnings

**Expected Results**:
- License installation fails gracefully
- Error message clear
- No false expiration warnings
- Original license state unchanged

**Pass Criteria**: Invalid license handled properly

**Sanity**: No

---

#### 5.6.2 Verify Behavior with No License Installed

**Objective**: Test command output with missing license

**Topology**: Single-node

**Prerequisites**: No license installed

**Test Methodology**:
1. Remove or not install license
2. Execute `show license`
3. Verify appropriate message
4. Ensure no crash or undefined behavior

**Expected Results**:
- Message indicates no license installed
- No expiration warnings (nothing to expire)
- Command completes successfully
- Instructions to install license

**Pass Criteria**: No license handled gracefully

**Sanity**: No

---

#### 5.6.3 Verify Warning with Perpetual License

**Objective**: Test that perpetual licenses show no expiration

**Topology**: Single-node

**Prerequisites**: Perpetual license installed

**Test Methodology**:
1. Install perpetual license
2. Disconnect cloud
3. Execute `show license`
4. Verify NO expiration warning

**Expected Results**:
- No expiration date shown
- No expiration warning
- Cloud disconnect irrelevant for perpetual licenses

**Pass Criteria**: No false warnings for perpetual licenses

**Sanity**: No

---

#### 5.6.4 Verify Behavior with System Time Changed

**Objective**: Test warning accuracy if system time manipulated

**Topology**: Single-node

**Prerequisites**: License expiring in 30 days (calculated from current time)

**Test Methodology**:
1. Note current system time
2. Set system time forward 31 days
3. Execute `show license`
4. Verify warning reflects new calculated expiration
5. Restore system time
6. Verify warning adjusts

**Expected Results**:
- Warning based on system time
- Days remaining calculated correctly
- Warning appears/disappears appropriately
- (Note: May trigger tamper detection in production)

**Pass Criteria**: Time-based calculation accurate

**Sanity**: No

---

## 6. Test Execution Summary

### 6.1 Test Metrics
| Category | Test Cases | Sanity | Non-Sanity |
|----------|-----------|---------|------------|
| Category 1: Basic Functionality | 4 | 3 | 1 |
| Category 2: Boundary Value | 6 | 0 | 6 |
| Category 3: State Machine | 3 | 2 | 1 |
| Category 4: Switch Events | 2 | 1 | 1 |
| Category 5: Integration | 3 | 0 | 3 |
| Category 6: Negative | 4 | 0 | 4 |
| **Total** | **22** | **6** | **16** |

### 6.2 Sanity Test Subset
The following tests should be included in sanity/smoke testing:
1. 5.1.1 - No warning with valid license
2. 5.1.2 - Enhanced warning (cloud disconnected, expiring)
3. 5.1.3 - Standard warning (cloud connected, expiring)
4. 5.3.1 - Cloud disconnect detection
5. 5.3.2 - Cloud reconnect detection
6. 5.4.1 - Warning persists after reboot

---

## 7. Test Dependencies

### 7.1 Prerequisites
- Access to ExtremeCloud IQ portal
- Ability to generate test licenses with controlled expiration dates
- Network infrastructure allowing cloud connectivity control
- SNMP manager for trap testing (optional)

### 7.2 Test Data Requirements
- Valid EP1 licenses with various expiration dates (90/60/30/0 days)
- Expired license for negative testing
- Perpetual license for negative testing
- Invalid license file for negative testing

---

## 8. Risk Assessment

### 8.1 High-Risk Scenarios
- **Silent failure of cloud connectivity check**: If IQAgent state is incorrect, users may not get warnings when needed
- **False positives**: Incorrect warnings could cause unnecessary alarm
- **Time zone issues**: Expiration calculations could be off in different time zones

### 8.2 Mitigation Strategies
- Thorough testing of IQAgent state detection
- Validate time calculations across time zones
- Test with real-world cloud disconnect scenarios (not just simulated)

---

## 9. Appendix

### 9.1 CLI Command Reference

```bash
# License Commands
show license
show licenses slot all
show licenses slot all detail
install license file <filename>
install license file <filename> slot <slot-number>

# IQAgent Commands
show iqagent discovery
show iqagent status
enable iqagent
disable iqagent
configure iqagent server <url>

# System Commands
show management
show log
save configuration
reboot
```

### 9.2 API Endpoints

```bash
# System Services State
GET /v0/system/services/state
Response: {
  "iqagent": {
    "operState": "CONNECTED" | "DISCONNECTED"
  }
}

# License Information (if available)
GET /v0/license/ep1
Response: {
  "level": "STANDARD" | "ADVANCED" | "PREMIUM",
  "tier": "A" | "B" | "C" | "D",
  "expiryPeriod": <seconds>,
  "effective": true | false
}
```

### 9.3 Expected Warning Message Formats

**Enhanced Warning (Cloud Disconnected):**
```
⚠️  WARNING: License expiration approaching
    Days remaining: 30
    Cloud connectivity: DISCONNECTED
    
    ⚠️  ACTION REQUIRED: Manual license renewal needed
    
    Your Extreme Platform ONE Networking license will expire in 30 days.
    Cloud connectivity is not available for automatic renewal.
    
    To renew your license:
    1. Log in to ExtremeCloud IQ portal: https://extremecloudiq.com
    2. Navigate to License Management
    3. Download your renewed license file
    4. Install on switch: install license file <filename>
    
    Or restore cloud connectivity for automatic renewal.
```

**Standard Warning (Cloud Connected):**
```
ℹ️  NOTICE: License expiration approaching
    Days remaining: 30
    Cloud connectivity: CONNECTED
    
    Your Extreme Platform ONE Networking license will expire in 30 days.
    
    Please renew via ExtremeCloud IQ portal: https://extremecloudiq.com
    Automatic renewal may occur if enabled in your subscription.
```

---

## 10. Test Plan Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Lead | | | |
| Dev Lead | | | |
| Product Owner | | | |

---

**Document Version**: 1.0  
**Last Updated**: 2026-07-06  
**Status**: Draft - Ready for Review
