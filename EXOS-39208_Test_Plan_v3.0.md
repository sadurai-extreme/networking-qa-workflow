# EXOS-39208 Functional Test Plan
## Flood Rate-Limit Burst-Tolerance CLI Enhancement

**Feature**: Configure burst-tolerance level for flood rate-limit  
**Jira**: EXOS-39208  
**Release**: EXOS 33.7 (TBD)  
**Test Plan Version**: 3.0 (Updated after automation script comparison)  
**Date**: 2026-07-07  
**Changes from v2.0**: Added burst size variation testing, CLI exceeded counter validation, quantitative drop ordering, boundary tests, enhanced persistence validation

---

## 1. Introduction

### 1.1 Feature Overview
This test plan covers the CLI enhancement to configure **burst-tolerance** parameter for flood rate-limit functionality. The feature provides predefined tolerance levels (default, low, medium, high) to control burst traffic handling at the BCM ASIC level.

### 1.2 Objectives
- Verify CLI syntax for burst-tolerance configuration (4 options: default, low, medium, high)
- Validate burst traffic control with **multiple burst sizes** aligned to BCM bucket boundaries
- Test quantitative drop ordering: `drops(low) >= drops(medium) >= drops(high)`
- Ensure configuration and **traffic behavior** persistence across reboots
- Test integration with existing rate-limit features
- Validate error handling for invalid tolerance options

### 1.3 Problem Being Solved
Current flood rate-limit implementation allows excessive packets (2-3x configured limit) during the first second of burst traffic. The **burst-tolerance** parameter exposes BCM burst bucket configuration via predefined levels to reduce this spike.

### 1.4 CLI Syntax
```bash
configure ports [<port_list> | <port_group>] rate-limit flood 
  [broadcast | multicast | unknown-destmac] 
  [no-limit | <pps>] 
  {burst-tolerance [default | low | medium | high]} 
  {out-actions [{log} {trap} {disable-port}]}
```

**Burst-Tolerance Options**:
- **default**: BCM bucket ≥ configured rate (Extreme's original algorithm, baseline behavior)
- **low**: Minimal burst tolerance (BCM bucket = 256 at 1000 pps, one below SDK default)
- **medium**: Moderate burst tolerance (BCM bucket = 1024 at 1000 pps, SDK default)
- **high**: Higher burst tolerance (BCM bucket = 2048 at 1000 pps, one above SDK default)

### 1.5 BCM Hardware Details

**BCM Burst Bucket Quantization**: {1, 4, 16, 64, 256, 1024, 2048, 4096, ...}

**At 1000 pps configured rate**:
- **low**: 256 frames (one BCM bucket below SDK default)
- **medium**: 1024 frames (SDK default bucket)
- **high**: 2048 frames (one BCM bucket above SDK default)
- **default**: 1024 frames (Extreme's algorithm, ≥ configured rate)

**Hardware Tolerance**: ±50 packets for drop count comparisons (BCM ASIC variation)

---

## 2. Test Scope

### 2.1 In Scope
- CLI configuration of burst-tolerance (default, low, medium, high)
- **Burst size variation testing** (500, 1024, 2048, 4096, 8000 frames)
- **CLI exceeded counter validation** (primary method)
- **Quantitative drop ordering** with ±50 hardware tolerance
- All flood types: broadcast, multicast, unknown-destmac
- Show command verification
- Configuration **and traffic behavior** persistence (reboot, save/load)
- Boundary testing (max rate 262144 pps)
- Multi-port independence testing
- Negative testing (invalid options, typos)
- Out-actions integration (log, trap, disable-port)

### 2.2 Out of Scope
- NOS-API burst-tolerance configuration (if not implemented)
- IPP (Instant Port Profile) burst-tolerance integration (separate feature)
- Non-Broadcom platforms (BCM-specific feature)
- Custom numeric burst-tolerance values (only 4 predefined levels)
- Per-rate bucket mapping configuration (handled by SDK)

---

## 3. Test Environment Setup

### 3.1 Test Topology

```
Topology-1: Burst Traffic Validation

Ixia1 (Traffic Generator)
  |
  | 10G Port 3 (Ingress)
  |
[DUT] 5720-24MXW FE (EXOS 33.7)
  |
  | 10G Port 1 (Egress - Rate Limited)
  |
Ixia2 (Traffic Receiver)
```

### 3.2 Hardware Requirements
- **DUT**: 5720-24MXW FE running EXOS 33.7 (or latest with burst-tolerance support)
- **Traffic Generator**: Ixia XM2/XM12/BreakingPoint with 10G ports
- **Platform**: BCM ASIC required (burst buckets are BCM-specific)

### 3.3 Software Requirements
- EXOS 33.7 or later (with EXOS-39208 enhancement)
- Ixia IxOS or IxNetwork

### 3.4 Base Configuration
```bash
# VLAN Configuration
create vlan burst_test
configure vlan burst_test add ports 1, 3 untagged

# Port Configuration
enable jumbo-frame ports 1, 3
configure ports 1, 3 auto off speed 10000 duplex full
```

---

## 4. Testing Tools

| Tool | Purpose | Method |
|------|---------|--------|
| Ixia XM2/XM12 | Single-burst traffic generation | Send finite burst (numFrames parameter) |
| EXOS CLI | Configuration, **exceeded counter** | `show port 1 rate-limit flood no-refresh` |
| EMS Logs | Trap/log verification | `show log` |

---

## 5. Test Cases

### 5.1 Conformance Testing

#### 5.1.1 Verify CLI Syntax - Burst-Tolerance Default

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit with burst-tolerance default for broadcast
2. Execute: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance default`
3. Verify command accepted without errors
4. Execute: `show port 1 information detail`
5. Verify output shows: `Broadcast Rate: 1000 packets-per-second, Burst Tolerance: Default`

**Pass Criteria**: 
- Command accepted
- Show output displays burst-tolerance default

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.1.2 Verify CLI Syntax - Burst-Tolerance Low

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit with burst-tolerance low for multicast
2. Execute: `configure port 1 rate-limit flood multicast 1000 burst-tolerance low`
3. Verify command accepted without errors
4. Execute: `show port 1 information detail`
5. Verify output shows: `Multicast Rate: 1000 packets-per-second, Burst Tolerance: Low`

**Pass Criteria**: 
- Command accepted
- Show output displays burst-tolerance low

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.1.3 Verify CLI Syntax - Burst-Tolerance Medium

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit with burst-tolerance medium for unknown-destmac
2. Execute: `configure port 1 rate-limit flood unknown-destmac 1000 burst-tolerance medium`
3. Verify command accepted without errors
4. Execute: `show port 1 information detail`
5. Verify output shows: `Unknown Dest Mac Rate: 1000 packets-per-second, Burst Tolerance: Medium`

**Pass Criteria**: 
- Command accepted
- Show output displays burst-tolerance medium

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.1.4 Verify CLI Syntax - Burst-Tolerance High

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit with burst-tolerance high for broadcast
2. Execute: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance high`
3. Verify command accepted without errors
4. Execute: `show port 1 information detail`
5. Verify output shows: `Broadcast Rate: 1000 packets-per-second, Burst Tolerance: High`

**Pass Criteria**: 
- Command accepted
- Show output displays burst-tolerance high

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

### 5.2 Functional Specification - Burst Size Variation Testing

**Configuration for all 5.2.x tests**:
- Rate-limit: **1000 pps** (sets SDK default bucket at 1024)
- Burst sizes: **500, 1024, 2048, 4096, 8000 frames**
- Burst rate: **10000 fps** (10x CIR - line rate for 64-byte packets at 10 Gbps)
- Validation: **CLI exceeded counter** from `show port 1 rate-limit flood no-refresh`
- Hardware tolerance: **±50 packets**

#### 5.2.1 Verify Burst-Tolerance Low - Single Burst Testing

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. For each burst size in {500, 1024, 2048, 4096, 8000}:
   a. Execute: `clear counters`
   b. Execute: `clear port 1 rate-limit flood out-of-profile`
   c. Wait 1 second for hardware to settle
   d. Send **single burst** from Ixia: `numFrames=<burst_size>`, `frameRate=10000 fps`
   e. Wait 3 seconds for counters to update
   f. Execute: `show port 1 rate-limit flood no-refresh`
   g. Read "Exceeded" counter (broadcast is at offset 6, column 2)
   h. Record drops for this burst size

**Expected Drops (burst-tolerance low, BCM bucket = 256)**:

| Burst Size | Expected Drops | Reasoning |
|-----------|----------------|-----------|
| 500 | ~240-290 | Small burst, low bucket allows ~256 through |
| 1024 | ~750-800 | At SDK boundary, ~256 allowed → ~768 dropped |
| 2048 | ~1750-1800 | Exceeds low bucket significantly |
| 4096 | ~3800-3900 | Well above low bucket, most dropped |
| 8000 | ~7700-7800 | Extreme burst, low bucket allows only ~256 |

**Pass Criteria**: 
- For burst_size > 256: Exceeded counter > 0 (drops observed)
- Drops increase with burst size
- At burst_size=1024: drops ~750-800 (within ±50 tolerance)
- Behavior consistent across all 5 burst sizes

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.2 Verify Burst-Tolerance Medium - Single Burst Testing

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance medium`
2. Repeat testcase 5.2.1 methodology for all 5 burst sizes
3. Record drops for each burst size

**Expected Drops (burst-tolerance medium, BCM bucket = 1024)**:

| Burst Size | Expected Drops | Reasoning |
|-----------|----------------|-----------|
| 500 | 0-50 | Burst < bucket, all or most allowed |
| 1024 | 0-100 | At bucket boundary, minimal drops |
| 2048 | ~1000-1100 | Exceeds medium bucket by ~1024 |
| 4096 | ~3000-3100 | Well above medium bucket |
| 8000 | ~6900-7100 | Extreme burst, medium bucket allows ~1024 |

**Pass Criteria**: 
- For burst_size ≤ 1024: Minimal drops (0-100)
- For burst_size > 1024: Drops = burst_size - 1024 (±50)
- At burst_size=2048: drops ~1000-1100 (within ±50 tolerance)

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.3 Verify Burst-Tolerance High - Single Burst Testing

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance high`
2. Repeat testcase 5.2.1 methodology for all 5 burst sizes
3. Record drops for each burst size

**Expected Drops (burst-tolerance high, BCM bucket = 2048)**:

| Burst Size | Expected Drops | Reasoning |
|-----------|----------------|-----------|
| 500 | 0 | Burst well below bucket |
| 1024 | 0 | Burst below bucket |
| 2048 | 0-100 | At bucket boundary |
| 4096 | ~2000-2100 | Exceeds high bucket by ~2048 |
| 8000 | ~5900-6100 | Extreme burst, high bucket allows ~2048 |

**Pass Criteria**: 
- For burst_size ≤ 2048: Minimal drops (0-100)
- For burst_size > 2048: Drops = burst_size - 2048 (±50)
- At burst_size=4096: drops ~2000-2100 (within ±50 tolerance)

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.4 Verify Burst-Tolerance Default - Single Burst Testing

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance default`
2. Repeat testcase 5.2.1 methodology for all 5 burst sizes
3. Record drops for each burst size

**Expected Drops (burst-tolerance default, BCM bucket ≥ 1000)**:

| Burst Size | Expected Drops | Reasoning |
|-----------|----------------|-----------|
| 500 | 0 | Burst below rate |
| 1024 | 0-100 | Near default bucket |
| 2048 | ~1000-1100 | Exceeds default bucket |
| 4096 | ~3000-3100 | Well above default bucket |
| 8000 | ~6900-7100 | Extreme burst |

**Pass Criteria**: 
- Behavior similar to medium (default bucket ~ 1024 for 1000 pps)
- Baseline for comparison with low/medium/high

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.5 Verify Quantitative Drop Ordering - All Burst Sizes

**Topology used**: Topology-1

**Prerequisites**: Testcases 5.2.1 through 5.2.4 completed

**Test Methodology**:
1. For each burst size {500, 1024, 2048, 4096, 8000}:
   a. Compare drops across tolerance levels from previous tests
   b. Verify ordering: `drops(low) >= drops(medium) >= drops(high)`
   c. Account for hardware tolerance: `abs(drops_A - drops_B) <= 50` means equivalent
   d. Document any violations

**Expected Ordering (example for burst_size=2048)**:
- **low**: ~1750-1800 drops
- **medium**: ~1000-1100 drops
- **high**: ~0-100 drops
- **default**: ~1000-1100 drops
- **Verification**: 1800 >= 1100 >= 100 ✅

**Pass Criteria**: 
- For ALL burst sizes: `drops(low) >= drops(medium) >= drops(high)` (within ±50)
- Clear differentiation between tolerance levels
- Ordering consistent across all 5 burst sizes

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.6 Verify Multicast Burst Control with Low Tolerance

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood multicast 1000 burst-tolerance low`
2. Enable IGMP snooping: `enable igmp snooping` (so multicast floods are rate-limited)
3. Send multicast bursts (dest MAC: 01:00:00:01:01:01) at burst_size=2048
4. Read exceeded counter (multicast is at offset 5, column 2)
5. Compare with broadcast low drops from testcase 5.2.1

**Pass Criteria**: 
- Multicast drops ~1750-1800 (similar to broadcast low at burst_size=2048)
- Burst-tolerance works for multicast flood type

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.7 Verify Unknown-DestMAC Burst Control with Low Tolerance

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood unknown-destmac 1000 burst-tolerance low`
2. Clear FDB: `clear fdb`
3. Send unknown-destmac bursts (dest MAC: 00:00:00:99:99:99) at burst_size=2048
4. Read exceeded counter (unknown-destmac is at offset 6, column 2)
5. Compare with broadcast low drops from testcase 5.2.1

**Pass Criteria**: 
- Unknown-destmac drops ~1750-1800 (similar to broadcast low at burst_size=2048)
- Burst-tolerance works for unknown-destmac flood type

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

### 5.3 CLI Configuration

#### 5.3.1 Verify Show Command Displays Burst-Tolerance

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. Execute: `show port 1 information detail`
3. Verify output includes: `Broadcast Rate: 1000 packets-per-second, Burst Tolerance: Low`
4. Verify detail mode shows burst-tolerance per flood type

**Pass Criteria**: 
- show port information detail displays burst-tolerance level
- Burst-tolerance visible for each configured flood type

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.3.2 Verify Changing Burst-Tolerance Level On-The-Fly

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. Execute: `show port 1 information detail` - verify burst-tolerance low
3. Reconfigure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance high`
4. Execute: `show port 1 information detail`
5. Verify burst-tolerance changed to high
6. Verify rate-limit 1000 pps still active (not reset)

**Pass Criteria**: 
- Burst-tolerance level can be changed without unconfiguring rate-limit
- New tolerance level takes effect immediately
- Rate-limit configuration preserved

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.3.3 Verify Multiple Flood Types with Different Burst-Tolerance

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. Configure: `configure port 1 rate-limit flood multicast 1000 burst-tolerance medium`
3. Configure: `configure port 1 rate-limit flood unknown-destmac 1000 burst-tolerance high`
4. Execute: `show port 1 information detail`
5. Verify each flood type shows its specific burst-tolerance

**Pass Criteria**: 
- Broadcast: burst-tolerance low
- Multicast: burst-tolerance medium
- Unknown-destmac: burst-tolerance high
- Each flood type has independent burst-tolerance configuration

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.3.4 Verify Rate-Limit Without Explicit Burst-Tolerance (Uses Default)

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000`
2. Do NOT specify burst-tolerance (should use default)
3. Execute: `show port 1 information detail`
4. Verify burst-tolerance shows "Default" or is implicit
5. Send burst_size=2048, verify drops ~1000-1100 (default behavior)

**Pass Criteria**: 
- Rate-limit works without explicit burst-tolerance
- Default tolerance automatically applied
- Behavior matches testcase 5.2.4 (default baseline)

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.3.5 Verify Maximum Rate (262144 pps) with Burst-Tolerance

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 262144 burst-tolerance low`
2. Verify command accepted (262144 is max rate)
3. Execute: `show port 1 information detail`
4. Verify burst-tolerance low active at max rate
5. Send burst_size=4096 at 500000 fps (above max rate)
6. Verify rate-limiting still functions correctly

**Pass Criteria**: 
- Burst-tolerance configurable at maximum supported rate (262144 pps)
- Rate-limiting functional at boundary
- No overflow or hardware issues

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.4 SNMP

#### 5.4.1 Verify SNMP MIB for Burst-Tolerance (If Supported)

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. Query SNMP MIB: extremePortRateLimitTable
3. Check for burst-tolerance object (if new MIB object added)
4. If supported: Verify value matches configured level (0=default, 1=low, 2=medium, 3=high)
5. If not supported: Document as expected limitation

**Pass Criteria**: 
- If supported: SNMP MIB reflects burst-tolerance level
- If not supported: Document limitation for future enhancement

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.5 Redundancy/Resiliency

#### 5.5.1 Verify Burst-Tolerance Persists After Reboot (Config + Traffic)

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. **Pre-Reboot Traffic Test**:
   a. Send burst_size=2048, record exceeded counter (expect ~1750-1800)
3. Execute: `save configuration`
4. Execute: `reboot`
5. Wait for switch to come back up
6. Execute: `show port 1 information detail`
7. Verify burst-tolerance low configuration persists
8. **Post-Reboot Traffic Test**:
   a. Send burst_size=2048, record exceeded counter
   b. Compare with pre-reboot drops (should match within ±100)

**Pass Criteria**: 
- Burst-tolerance configuration persists after reboot
- **Traffic behavior consistent** before and after reboot
- Pre-reboot drops ≈ Post-reboot drops (within ±100 tolerance)

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.5.2 Verify Burst-Tolerance Survives Process Restart

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. Execute: `restart process hal`
3. Wait for process to restart
4. Execute: `show port 1 information detail`
5. Verify burst-tolerance low configuration retained
6. Send burst_size=2048, verify drops ~1750-1800 (behavior intact)

**Pass Criteria**: 
- Burst-tolerance configuration survives HAL process restart
- No configuration loss
- Traffic behavior intact after restart

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.5.3 Verify Burst-Tolerance in Stacking Environment

**Topology used**: 2-node stack (5720-24MXW FE stack)

**Test Methodology**:
1. Configure on master: `configure port 1:1 rate-limit flood broadcast 1000 burst-tolerance low`
2. Configure on member: `configure port 2:1 rate-limit flood broadcast 1000 burst-tolerance high`
3. Execute: `show port 1:1 information detail` - verify burst-tolerance low
4. Execute: `show port 2:1 information detail` - verify burst-tolerance high
5. Perform stack master failover
6. Verify configurations persist on new master

**Pass Criteria**: 
- Each stack member has independent burst-tolerance configuration
- Configuration persists across stack master failover

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.6 Scaling

#### 5.6.1 Verify Burst-Tolerance on Multiple Ports

**Topology used**: Topology-1 (use ports 1-10)

**Test Methodology**:
1. Configure burst-tolerance on 10 ports with varying levels:
   - `configure ports 1-5 rate-limit flood broadcast 1000 burst-tolerance low`
   - `configure ports 6-10 rate-limit flood broadcast 1000 burst-tolerance high`
2. Execute: `show ports 1-10 information detail`
3. Verify ports 1-5 show burst-tolerance low
4. Verify ports 6-10 show burst-tolerance high
5. Modify port 5 to burst-tolerance medium
6. Verify port 5 shows new value, others unchanged

**Pass Criteria**: 
- Burst-tolerance can be configured on multiple ports
- Changes to one port don't affect others
- Up to 48 ports tested (platform maximum)

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.6.2 Verify Multi-Port Independence (Low vs High Simultaneously)

**Topology used**: Topology-1 (use ports 1 and 2)

**Test Methodology**:
1. Configure port 1: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. Configure port 2: `configure port 2 rate-limit flood broadcast 1000 burst-tolerance high`
3. Send identical bursts to both ports simultaneously (burst_size=2048)
4. Read exceeded counters:
   - Port 1: `show port 1 rate-limit flood no-refresh` (expect ~1750-1800 drops)
   - Port 2: `show port 2 rate-limit flood no-refresh` (expect ~0-100 drops)
5. Verify port 1 drops >> port 2 drops (difference > 1500)

**Pass Criteria**: 
- Each port's tolerance level is independent
- Port 1 (low) drops significantly more than port 2 (high)
- Simultaneous burst traffic handled correctly per port

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.7 Performance

#### 5.7.1 Verify CPU Impact During Burst Traffic with Low Tolerance

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. Monitor CPU usage: `show cpu-monitoring`
3. Generate burst traffic from Ixia (continuous bursts every 1 second for 60 seconds)
4. Monitor CPU usage during traffic
5. Stop traffic, check CPU returns to baseline

**Pass Criteria**: 
- CPU usage increase during burst < 20%
- CPU returns to baseline after traffic stops
- No excessive CPU consumption due to burst-tolerance processing

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.8 Error Handling

#### 5.8.1 Verify Error on Invalid Burst-Tolerance Option

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance very-low`
2. Verify command rejected with error message
3. Expected error: "Error: Invalid burst-tolerance option 'very-low'. Valid options: default, low, medium, high"

**Pass Criteria**: 
- Command rejected
- Clear error message displayed
- No configuration applied

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.8.2 Verify Error on Numeric Burst-Tolerance Value

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance 100`
2. Verify command rejected with error message
3. Expected error: "Error: Invalid burst-tolerance option '100'. Valid options: default, low, medium, high"

**Pass Criteria**: 
- Command rejected (burst-tolerance only accepts enum values, not numeric)
- Clear error message displayed

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.8.3 Verify Error on Typo in Burst-Tolerance

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance loww`
2. Verify command rejected with error message
3. Try other typos: "medum", "hih", "defualt"
4. Verify all rejected with helpful error messages

**Pass Criteria**: 
- Typos rejected
- Error message suggests correct spelling

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.9 Integration with Out-Actions

#### 5.9.1 Verify Log Action with Burst-Tolerance Low

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low out-actions log`
2. Send burst_size=2048 (will exceed rate-limit with low tolerance)
3. Check EMS logs: `show log | grep FldRateOutActLogEvent`
4. Verify rate-limit exceeded logs generated
5. Verify logs indicate broadcast flood on port 1

**Pass Criteria**: 
- Rate-limit logs generated when exceeded
- Burst-tolerance doesn't interfere with log action

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.9.2 Verify Out-Actions Work with All Tolerance Levels

**Topology used**: Topology-1

**Test Methodology**:
1. Configure low with log: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low out-actions log`
2. Send burst_size=2048, verify log generated
3. Clear log: `clear log static`
4. Change to high: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance high out-actions log`
5. Send burst_size=8000 (exceeds even high tolerance)
6. Verify log generated for high tolerance too

**Pass Criteria**: 
- Out-actions work with low tolerance
- Out-actions work with high tolerance
- Tolerance level change doesn't break out-actions

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.9.3 Verify Disable-Port Action with Burst-Tolerance Low

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low out-actions disable-port`
2. Send sustained burst traffic exceeding rate-limit
3. Verify port 1 disabled automatically
4. Check: `show port 1` - verify state disabled
5. Re-enable port: `enable port 1`

**Pass Criteria**: 
- Port disabled when rate-limit exceeded
- Burst-tolerance low controls burst before disable-port triggered

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.10 Different Traffic Patterns

#### 5.10.1 Verify Burst-Tolerance Low with Short Burst (1 second)

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. Send 1-second burst at 10000 fps (10000 frames total)
3. Wait 3 seconds, read exceeded counter
4. Verify drops ~9700-9800 (burst well above low bucket of ~256)

**Pass Criteria**: 
- Short burst controlled within tolerance limit
- Drops match expected for burst_size=10000 with low tolerance

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.10.2 Verify Burst-Tolerance Low with Continuous Traffic

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. Send continuous broadcast traffic at 2000 pps for 60 seconds
3. Read exceeded counter every 10 seconds
4. Verify steady-state drops ~1000 packets/10 seconds after initial burst

**Pass Criteria**: 
- Steady-state rate limiting unaffected by burst-tolerance
- Burst-tolerance only impacts initial burst behavior
- After initial burst drains, all levels rate-limit at CIR

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.10.3 Verify Burst-Tolerance with Periodic Bursts

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
2. Send periodic bursts: burst_size=2048 every 10 seconds, repeat 5 times
3. Read exceeded counter after each burst
4. Verify each burst shows consistent drops (~1750-1800)

**Pass Criteria**: 
- Each burst interval shows consistent burst control
- Burst-tolerance behavior repeatable across multiple bursts
- Bucket refills between bursts (10-second gap is sufficient)

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.11 Negative Scenarios

#### 5.11.1 Verify Burst-Tolerance Doesn't Break Existing Rate-Limit

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit WITHOUT burst-tolerance: `configure port 1 rate-limit flood broadcast 1000`
2. Send burst_size=2048, record drops (baseline)
3. Add burst-tolerance: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance low`
4. Send burst_size=2048, record drops
5. Verify rate-limiting still works with low tolerance
6. Verify no functional regression

**Pass Criteria**: 
- Rate-limit functionality intact before and after burst-tolerance addition
- Backward compatibility maintained
- Adding burst-tolerance doesn't disable rate-limiting

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.11.2 Verify Rate-Limit Without Burst-Tolerance Uses Default

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 1000`
2. Do NOT configure burst-tolerance (uses default)
3. Send burst_size=2048, record drops
4. Configure explicit default: `configure port 1 rate-limit flood broadcast 1000 burst-tolerance default`
5. Send burst_size=2048, record drops
6. Verify drops match (both use default behavior)

**Pass Criteria**: 
- Rate-limit works without explicit burst-tolerance configuration
- Implicit default behavior matches explicit "burst-tolerance default"
- Burst-tolerance parameter is optional

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

## 6. Test Execution Summary

### 6.1 Test Case Distribution

| Category | Total Test Cases | Sanity Tests | Automatable Tests |
|----------|-----------------|--------------|-------------------|
| 5.1 Conformance | 4 | 4 | 4 |
| 5.2 Functional Spec (Burst Testing) | 7 | 7 | 7 |
| 5.3 CLI Configuration | 5 | 2 | 5 |
| 5.4 SNMP | 1 | 0 | 1 |
| 5.5 Redundancy | 3 | 1 | 3 |
| 5.6 Scaling | 2 | 0 | 2 |
| 5.7 Performance | 1 | 0 | 1 |
| 5.8 Error Handling | 3 | 0 | 3 |
| 5.9 Integration | 3 | 0 | 3 |
| 5.10 Traffic Patterns | 3 | 0 | 3 |
| 5.11 Negative | 2 | 1 | 2 |
| **TOTAL** | **34** | **15 (44%)** | **34 (100%)** |

### 6.2 Sanity Test Coverage
- **Sanity tests**: 15 out of 34 (44%)
- **Focus**: All 4 CLI syntax options, burst size variation testing with all tolerance levels, persistence with traffic validation, backward compatibility

### 6.3 Changes from Test Plan v2.0

#### Added Test Cases:
1. **5.2.5**: Quantitative drop ordering validation across all burst sizes
2. **5.3.5**: Boundary test at maximum rate (262144 pps)
3. **5.6.2**: Multi-port independence test (low vs high simultaneously)

#### Enhanced Test Cases:
1. **5.2.1-5.2.4**: Changed from continuous line-rate traffic to **burst size variation** (500, 1024, 2048, 4096, 8000)
2. **5.2.1-5.2.4**: Changed validation from Wireshark I/O graph to **CLI exceeded counter**
3. **5.2.1-5.2.4**: Added **expected drop counts** based on BCM bucket sizes
4. **5.5.1**: Enhanced persistence test to include **traffic behavior validation** before and after reboot
5. **5.9.2**: Enhanced out-actions test to verify **all tolerance levels** with out-actions

#### Removed/Consolidated:
- Removed Wireshark I/O graph analysis (replaced with CLI exceeded counter)
- Removed vague "~800-1000 packets" criteria (replaced with quantitative drops based on BCM buckets)

---

## 7. Expected Burst Behavior Summary (1000 pps limit)

### 7.1 BCM Bucket Mapping

| Burst-Tolerance | BCM Bucket Size | Expected Drops (burst_size=2048) | Use Case |
|----------------|----------------|----------------------------------|----------|
| **low** | 256 frames | ~1750-1800 drops | Strict burst control, security-sensitive |
| **medium** | 1024 frames | ~1000-1100 drops | Balanced control, typical enterprise |
| **high** | 2048 frames | ~0-100 drops | Lenient, allows legitimate bursts |
| **default** | ≥ 1000 frames | ~1000-1100 drops | Baseline (pre-enhancement behavior) |

### 7.2 Validation Method

**Primary**: CLI exceeded counter
```bash
show port 1 rate-limit flood no-refresh
```
- Broadcast: offset 6, column 2
- Multicast: offset 5, column 2
- Unknown-destmac: offset 6, column 2

**Hardware Tolerance**: ±50 packets (account for BCM ASIC timing variations)

---

## 8. Appendix

### 8.1 References
- **Jira**: EXOS-39208
- **Related**: CFD-16121 (Customer-found defect)
- **Related**: EXOS-39560 (IPP Rate-Limit)
- **Automation Scripts**: `/extreme/Regression/33.4_latest/exos-tcl-automation/automation/Functionaltest/L2_ratelimit/`

### 8.2 Ixia Traffic Configuration Example

**Single Burst Configuration**:
```
Stream: Broadcast Burst
- Packet Type: Ethernet II
- Destination MAC: FF:FF:FF:FF:FF:FF
- Source MAC: 00:11:22:33:44:55
- Frame Size: 64 bytes
- Transmission Mode: numFrames (NOT continuous)
- numFrames: 2048 (or 500, 1024, 4096, 8000 per test case)
- frameRate: 10000 fps (10x CIR)
```

**Key Difference from v2.0**: Use `numFrames` parameter for **finite burst**, NOT continuous line-rate traffic. This is critical for BCM bucket testing.

### 8.3 CLI Exceeded Counter Reading

```bash
# Clear counters before test
clear counters
clear port 1 rate-limit flood out-of-profile

# Send burst (Ixia command or equivalent)

# Wait for counters to settle
# (3 seconds after burst completes)

# Read exceeded counter
show port 1 rate-limit flood no-refresh

# Output format:
# Port  Flood           Rate      Exceeded  Disabled
#  1    Broadcast       1000      1789      -
#  1    Multicast       No Limit  -         -
#  1    Unknown DestMac No Limit  -         -

# Broadcast "Exceeded" column = 1789 drops
```

### 8.4 CLI Help Text Reference
```
burst-tolerance => help="Configure the tolerance level to handle a packet burst"
low             => help="Minimal burst tolerance, aggressively suppress a packet burst"
medium          => help="Moderate burst tolerance"
high            => help="Higher burst tolerance, allows a larger packet burst"
default         => help="Burst tolerance that allows a packet burst at least equal to the configured flood rate"
```

### 8.5 BCM Bucket Boundary Rationale

**Why test these specific burst sizes?**
- **500**: Below SDK default bucket (1024) — tests small burst handling
- **1024**: Exactly at SDK default bucket boundary — key differentiation point
- **2048**: One BCM bucket above SDK default — exposes medium vs high difference
- **4096**: Maximum standard BCM bucket — saturates most tolerance levels
- **8000**: Above max bucket — all levels must drop significantly, tests extreme burst

These sizes align with **BCM hardware quantization points** and expose maximum behavioral differences between tolerance levels.

### 8.6 Why CLI Exceeded Counter > Wireshark?

**Advantages of CLI counter**:
1. **Direct hardware read** — reflects BCM ASIC drop counters
2. **Automation-friendly** — parseable output, no PCAP files
3. **Production-ready** — matches how users debug rate-limiting issues
4. **Precise** — exact drop count, no sampling or capture loss

**Disadvantages of Wireshark**:
1. **Capture loss** — may miss packets at line rate
2. **Post-processing** — requires PCAP export and I/O graph analysis
3. **Interpretation** — "packets in first second" is less precise than drop counter
4. **Not how users debug** — users check CLI counters, not Wireshark

### 8.7 Comparison with Automation Scripts

**Test Plan v3.0 alignment with `/extreme/Regression/33.4_latest/exos-tcl-automation/automation/Functionaltest/L2_ratelimit/`**:

| Feature | Automation Scripts | Test Plan v3.0 | Status |
|---------|-------------------|----------------|--------|
| Burst Size Variation | ✅ {500, 1024, 2048, 4096, 8000} | ✅ {500, 1024, 2048, 4096, 8000} | ✅ **Aligned** |
| CLI Exceeded Counter | ✅ Primary validation | ✅ Primary validation | ✅ **Aligned** |
| Drop Ordering | ✅ low >= medium >= high (±50) | ✅ low >= medium >= high (±50) | ✅ **Aligned** |
| Persistence + Traffic | ✅ Pre/post-reboot validation | ✅ Pre/post-reboot validation | ✅ **Aligned** |
| Multi-Port Independence | ✅ Low vs high simultaneously | ✅ Low vs high simultaneously | ✅ **Aligned** |
| Boundary Test | ✅ Max rate 262144 pps | ✅ Max rate 262144 pps | ✅ **Aligned** |
| Error Handling | ❌ Not in automation | ✅ Invalid options, typos | ➕ **Added value** |
| SNMP MIB | ❌ Not in automation | ✅ MIB validation | ➕ **Added value** |
| Traffic Patterns | ⚠️ Single burst only | ✅ Short/continuous/periodic | ➕ **Added value** |

### 8.8 Review Meeting Notes
- **Date**: TBD
- **Attendees**: QA, Development, Product Management
- **Approvals**: TBD

---

**Test Plan v3.0 - End of Document**
