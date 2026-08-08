# EXOS-39453 Test Plan Comparison Analysis

**Date**: 2026-07-06  
**Comparison**: Official QA Test Plan vs AI-Generated Test Plan

---

## Executive Summary

### Official Test Plan Coverage
- **Total Test Cases for EXOS-39453**: **10 test cases**
- **Sanity Tests**: 10 (100%)
- **Automatable Tests**: 10 (100%)
- **Focus Areas**: Time manipulation, XIQ connectivity, EP1 license behavior

### AI-Generated Test Plan Coverage
- **Total Test Cases**: **22 test cases** 
- **Sanity Tests**: 6 (27%)
- **Test Categories**: 6 categories (Basic, Boundary, State Machine, Switch Events, Integration, Negative)
- **Focus Areas**: API integration, warning levels, state transitions, boundary values

---

## Detailed Comparison

### ✅ Test Cases Present in BOTH Plans

#### 1. **Basic Cloud Disconnect Warning**
- **Official**: "Verify the expiration date (how many days left) is displayed when the switch is not connected to XIQ for 3 days"
- **AI Generated**: Test case 5.1.2 "Verify Enhanced Warning with License Expiring (30 days) and Cloud Disconnected"
- **Match Quality**: ✅ **Good match** - Both test warning display when disconnected from cloud

#### 2. **Cloud Reconnect Clears Warning**
- **Official**: "Verify the expiration date (how many days left) is not displayed when the switch is connected back to XIQ after 3 days"
- **AI Generated**: Test case 5.3.2 "Verify Cloud Reconnect Detection (DISCONNECTED → CONNECTED)"
- **Match Quality**: ✅ **Good match** - Both test warning removal on reconnect

#### 3. **XIQ-SE Support**
- **Official**: "Verify the expiration date (how many days left) is displayed when the switch is not connected to XIQ-SE for 3 days"
- **AI Generated**: Not explicitly mentioned (only "ExtremeCloud IQ")
- **Match Quality**: ⚠️ **Partial** - AI plan doesn't distinguish XIQ vs XIQ-SE

#### 4. **Reboot Persistence**
- **Official**: "Verify the expiration date (how many days left) is displayed when the switch is not connected to XIQ for 3 days after reboot"
- **AI Generated**: Test case 5.4.1 "Verify Warning Persists After Switch Reboot"
- **Match Quality**: ✅ **Good match**

#### 5. **Failover Behavior**
- **Official**: "Verify the expiration date (how many days left) is displayed when the switch is not connected to XIQ for 3 days after failover"
- **AI Generated**: Not present
- **Match Quality**: ❌ **MISSING**

---

## ❌ Test Cases MISSING in AI-Generated Plan

### CRITICAL MISSING TEST CASES

#### 1. ❌ **Time Manipulation Tests**
**Official Test**: "Verify the expiration date (how many days left) is not displayed when the switch time is reverted back"

**Details**:
```
Methodology:
- Onboard switch with XIQ-SE, disable sntp-client
- Change time forward 3 days
- Check for expiration message
- Revert to original time using configure time command
- Verify warning message is removed
```

**Why Missing**: AI plan focuses on natural time progression, not `configure time` command manipulation

**Impact**: **HIGH** - Critical test for time-based feature validation

---

#### 2. ❌ **EP1 License API Configuration Tests**
**Official Test**: "Verify the expiration date (how many days left) is displayed after changing the time and ep1 license is set to ADVANCED with 361 when the license is set to 365 days via API"

**Details**:
```
Methodology:
- Use NOS-API patch operation to set license level to ADVANCED with 365 days expiry
- Change time forward 3 days
- Verify message shows "license will expire in 361 days"
```

**Why Missing**: AI plan doesn't test API-based license configuration

**Impact**: **HIGH** - API is primary interface for cloud-managed licenses

---

#### 3. ❌ **CLI Debug Command License Configuration**
**Official Test**: "Verify the expiration date (how many days left) is displayed after changing the time and ep1 license is set to PREMIUM with 361 when the license is set to 365 days via CLI"

**Details**:
```
Methodology:
- Use debug command CLI to set license level to PREMIUM with 365 days expiry
- Change time forward 3 days
- Verify accurate day count (361 days)
```

**Why Missing**: AI plan doesn't include debug CLI-based license manipulation

**Impact**: **MEDIUM** - Important for dev/support workflows

---

#### 4. ❌ **Failover Testing**
**Official Test**: "Verify the expiration date (how many days left) is displayed when the switch is not connected to XIQ for 3 days after failover"

**Details**:
```
Methodology:
- Onboard switch, disable sntp-client
- Change time forward 3 days
- Verify warning message
- Perform failover
- Re-verify warning message persists
```

**Why Missing**: AI plan doesn't include HA/redundancy scenarios

**Impact**: **HIGH** - Critical for production HA deployments

---

#### 5. ❌ **Banner Warning Message Test**
**Official Test**: "Verify whether the banner message is displayed along with the expiration date if the switch is not connected for 15 days to XIQ"

**Details**:
```
Methodology:
- Disconnect from XIQ for 15 days
- Check for banner warning: "license check failed, license assignment will expire in 15 day(s)"
```

**Why Missing**: AI plan focuses on `show license` output, not login banner

**Impact**: **HIGH** - Banner is critical user-facing warning mechanism

---

#### 6. ❌ **Pilot License Testing**
**Official Test**: "Verify the expiration date (how many days left) is displayed with pilot when the switch is not connected to XIQ for 3 days"

**Details**:
```
Methodology:
- Patch ep1 pilot license with payload:
  {
    "level": "NONE",
    "pilot": true,
    "tier": "NONE",
    "expiryPeriod": 864000,
    ...
  }
- Change time forward 3 days
- Verify "license will expire in 6 days"
```

**Why Missing**: AI plan doesn't cover pilot license scenarios

**Impact**: **MEDIUM** - Important for pilot program customers

---

#### 7. ❌ **XIQ-SE Specific Testing**
**Official Test**: "Verify the expiration date (how many days left) is displayed when the switch is not connected to XIQ-SE for 3 days"

**Details**: Separate test for XIQ-SE (on-premises) vs XIQ (cloud)

**Why Missing**: AI plan only mentions "ExtremeCloud IQ" generically

**Impact**: **MEDIUM** - XIQ-SE has different connectivity requirements

---

#### 8. ❌ **SNTP-Client Interaction**
**Official Tests**: Multiple tests explicitly require "disable sntp-client" step

**Why Missing**: AI plan doesn't test SNTP interaction with license expiration detection

**Impact**: **MEDIUM** - SNTP can affect time-based license validation

---

### Additional Missing Test Aspects

#### ❌ **Specific Time Intervals**
- Official: Tests at **3 days**, **15 days** disconnect thresholds
- AI Generated: Uses generic 30/60/90 day thresholds
- **Gap**: Different disconnect duration thresholds not tested

#### ❌ **show license vs show license detail**
- Official: Tests both `show license` and `show license detail` commands separately
- AI Generated: Primarily focuses on `show license`
- **Gap**: `show license detail` output not explicitly validated

#### ❌ **Multiple License Tiers**
- Official: Tests STANDARD, ADVANCED, PREMIUM tiers explicitly
- AI Generated: Generic tier testing
- **Gap**: Tier-specific warning behavior not validated

---

## ✅ Additional Coverage in AI-Generated Plan (Not in Official)

### 1. **Boundary Value Testing** (Category 5.2.x)
- Test at exact 90-day threshold (MINOR warning)
- Test at exact 60-day threshold (MAJOR warning)
- Test at exact 30-day threshold (CRITICAL warning)
- Test on expiration day (day 0)
- Test after expiration (negative days)
- Test at 91+ days (no warning)

**Value**: Comprehensive threshold boundary testing

---

### 2. **Warning Level Escalation**
- Tests MINOR → MAJOR → CRITICAL progression
- API verification of warning levels

**Value**: Validates warning severity logic

---

### 3. **API Integration Testing** (Category 5.5.x)
- API endpoint `/v0/system/services/state` verification
- License state change callback testing
- API field accuracy validation

**Value**: Comprehensive API contract validation

---

### 4. **Negative Testing** (Category 5.6.x)
- Invalid license format
- Missing license file
- Perpetual license (no expiration)
- Time manipulation attacks

**Value**: Error handling validation

---

### 5. **IQAgent Process Restart**
- Test case 5.4.2: Warning stability during IQAgent restart

**Value**: Process resilience testing

---

## Missing Test Categories in AI Plan

### ❌ **EP1 Licensing Context Tests**
The official plan includes extensive EP1 license management tests (not specific to EXOS-39453 but in same document):
- Trial license behavior
- Stack behavior with EP1
- Manufacturing init impact
- Config bundle with EP1
- Persona change persistence
- Unconfigure switch behavior
- ZTP stack scenarios
- Rolling reboot
- Image upgrade
- Cloning behavior

**AI Plan Coverage**: None of these tested (but may be out of scope for EXOS-39453 specifically)

---

## Recommendations for AI-Generated Test Plan Enhancement

### HIGH Priority Additions

1. **Add Time Manipulation Test Cases**
   ```
   - Test 5.X.1: Verify warning clears when time reverted using configure time
   - Test 5.X.2: Verify warning appears after time advanced using configure time
   - Test 5.X.3: Verify SNTP-client disable doesn't affect warning logic
   ```

2. **Add API-Based License Configuration**
   ```
   - Test 5.X.4: Configure license via NOS-API PATCH /v0/configuration/license/ep1
   - Test 5.X.5: Verify day count accuracy after API configuration + time change
   - Test 5.X.6: Test all license tiers (STANDARD, ADVANCED, PREMIUM) via API
   ```

3. **Add Banner Warning Test**
   ```
   - Test 5.X.7: Verify login banner displays warning at 15-day disconnect threshold
   - Test 5.X.8: Verify banner message format matches spec
   ```

4. **Add Failover Testing**
   ```
   - Test 5.X.9: Verify warning persists after failover
   - Test 5.X.10: Verify warning state synchronized in HA pair
   ```

5. **Add Pilot License Testing**
   ```
   - Test 5.X.11: Verify pilot license warning behavior
   - Test 5.X.12: Verify pilot license API payload processing
   ```

---

### MEDIUM Priority Additions

6. **Add XIQ-SE Specific Tests**
   ```
   - Test 5.X.13: Distinguish XIQ vs XIQ-SE connectivity detection
   - Test 5.X.14: Verify warning behavior with XIQ-SE disconnect
   ```

7. **Add show license detail Testing**
   ```
   - Test 5.X.15: Verify warning in "show license detail" output
   - Test 5.X.16: Compare warning format between "show license" and "show license detail"
   ```

8. **Add Specific Disconnect Duration Tests**
   ```
   - Test 5.X.17: Verify warning at 3-day disconnect threshold
   - Test 5.X.18: Verify enhanced warning at 15-day disconnect threshold
   ```

---

### LOW Priority Additions

9. **Add CLI Debug Command Testing**
   ```
   - Test 5.X.19: Configure license via debug licMgr ep1 enable
   - Test 5.X.20: Verify debug command license behavior
   ```

---

## Summary Statistics

| Metric | Official Plan (EXOS-39453 Only) | AI-Generated Plan | Gap |
|--------|--------------------------------|-------------------|-----|
| **Total Test Cases** | 10 | 22 | +12 AI |
| **Sanity Tests** | 10 (100%) | 6 (27%) | -4 |
| **Automatable** | 10 (100%) | Not specified | Unknown |
| **Time Manipulation Tests** | 6 | 0 | **-6** ❌ |
| **API Configuration Tests** | 2 | 0 | **-2** ❌ |
| **Banner Warning Tests** | 1 | 0 | **-1** ❌ |
| **Failover Tests** | 1 | 0 | **-1** ❌ |
| **Pilot License Tests** | 1 | 0 | **-1** ❌ |
| **XIQ-SE Tests** | 2 | 0 | **-2** ❌ |
| **Boundary Value Tests** | 0 | 6 | +6 ✅ |
| **Warning Level Tests** | 0 | 6 | +6 ✅ |
| **Negative Tests** | 0 | 4 | +4 ✅ |

---

## Conclusion

### Strengths of AI-Generated Plan
✅ **Comprehensive boundary testing** at warning thresholds  
✅ **Strong API integration** validation  
✅ **Negative testing** coverage  
✅ **State transition** testing (connect/disconnect)  
✅ **Well-structured** with clear categories  

### Critical Gaps
❌ **No time manipulation tests** (configure time command)  
❌ **No API-based license configuration** tests  
❌ **No banner warning** validation  
❌ **No failover** testing  
❌ **No pilot license** coverage  
❌ **No XIQ-SE distinction**  
❌ **Lower sanity test percentage** (27% vs 100%)  

### Overall Assessment
The AI-generated test plan provides **broader architectural coverage** with boundary testing and API validation, but **misses critical real-world scenarios** from the official plan, particularly:
- Time manipulation (critical for license expiration testing)
- API-based license provisioning (how licenses are actually configured)
- Banner warnings (critical user-facing feature)
- HA/failover scenarios (production requirement)

**Recommendation**: Merge both plans to create comprehensive coverage:
- Keep AI plan's boundary/negative/API verification tests
- Add official plan's time manipulation, banner, failover, and pilot tests
- Result: ~32 comprehensive test cases covering both architectural depth and real-world scenarios

---

## Action Items

1. ✅ **Immediate**: Add 8 missing critical test cases to AI plan
2. ⚠️ **Short-term**: Add 5 medium-priority test cases
3. 📋 **Long-term**: Consider adding EP1 license context tests if in scope
4. 🔄 **Review**: Increase sanity test percentage from 27% to ~60%
5. 📝 **Document**: Add automation notes for each test case
