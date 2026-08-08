# EXOS-39208 Functional Test Plan
## Flood Rate-Limit Burst-Tolerance CLI Enhancement

**Feature**: Configure burst-tolerance level for flood rate-limit  
**Jira**: EXOS-39208  
**Release**: EXOS 33.7 (TBD)  
**Test Plan Version**: 2.0  
**Date**: 2026-07-07

---

## 1. Introduction

### 1.1 Feature Overview
This test plan covers the CLI enhancement to configure **burst-tolerance** parameter for flood rate-limit functionality. The feature provides predefined tolerance levels (default, low, medium, high) to control burst traffic handling.

### 1.2 Objectives
- Verify CLI syntax for burst-tolerance configuration (4 options: default, low, medium, high)
- Validate burst traffic control with different tolerance levels
- Ensure configuration persistence across reboots and process restarts
- Test integration with existing rate-limit features
- Validate error handling for invalid tolerance options

### 1.3 Problem Being Solved
Current flood rate-limit implementation allows excessive packets (2-3x configured limit) during the first second of burst traffic. The **burst-tolerance** parameter provides granular control with predefined levels to reduce this spike.

### 1.4 CLI Syntax
```bash
configure ports [<port_list> | <port_group>] rate-limit flood 
  [broadcast | multicast | unknown-destmac] 
  [no-limit | <pps>] 
  {burst-tolerance [default | low | medium | high]} 
  {out-actions [{log} {trap} {disable-port}]}
```

**Burst-Tolerance Options**:
- **default**: Allows packet burst at least equal to configured flood rate
- **low**: Minimal burst tolerance, aggressively suppress packet burst
- **medium**: Moderate burst tolerance
- **high**: Higher burst tolerance, allows larger packet burst

---

## 2. Test Scope

### 2.1 In Scope
- CLI configuration of burst-tolerance (default, low, medium, high)
- Burst traffic validation using Ixia traffic generator
- All flood types: broadcast, multicast, unknown-destmac
- Show command verification
- Configuration persistence (reboot, save/load)
- Negative testing (invalid options, typos)
- Out-actions integration (log, trap, disable-port)

### 2.2 Out of Scope
- NOS-API burst-tolerance configuration (if not implemented)
- IPP (Instant Port Profile) burst-tolerance integration (separate feature)
- Non-Broadcom platforms
- Custom numeric burst-tolerance values (only 4 predefined levels)

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
Ixia2 (Traffic Receiver + Wireshark Capture)
```

### 3.2 Hardware Requirements
- **DUT**: 5720-24MXW FE running EXOS 33.7 (or latest with burst-tolerance support)
- **Traffic Generator**: Ixia XM2/XM12/BreakingPoint with 10G ports
- **Capture Tool**: Wireshark or Ixia built-in capture

### 3.3 Software Requirements
- EXOS 33.7 or later (with EXOS-39208 enhancement)
- Ixia IxOS or IxNetwork
- Wireshark for I/O graph analysis

### 3.4 Base Configuration
```bash
# VLAN Configuration
configure vlan default add port 1, 3 tagged
configure vlan default ipaddress 192.168.1.1 255.255.255.0

# Port Configuration
enable jumbo-frame ports 1, 3
configure ports 1, 3 auto off speed 10000 duplex full
```

---

## 4. Testing Tools

| Tool | Purpose | Version |
|------|---------|---------|
| Ixia XM2/XM12 | Traffic generation, burst traffic | IxOS 9.x |
| Wireshark | Packet capture, I/O graph statistics | 4.x |
| EXOS CLI | Configuration, show commands | 33.7+ |
| EMS Logs | Trap/log verification | N/A |

---

## 5. Test Cases

### 5.1 Conformance Testing

#### 5.1.1 Verify CLI Syntax - Burst-Tolerance Default

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit with burst-tolerance default for broadcast
2. Execute: `configure port 1 rate-limit flood broadcast 500 burst-tolerance default out-actions log trap`
3. Verify command accepted without errors
4. Execute: `show port 1 rate-limit detail`
5. Verify output shows broadcast rate-limit 500 pps with burst-tolerance default

**Pass Criteria**: Verify as per methodology

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.1.2 Verify CLI Syntax - Burst-Tolerance Low

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit with burst-tolerance low for multicast
2. Execute: `configure port 1 rate-limit flood multicast 500 burst-tolerance low out-actions log trap`
3. Verify command accepted without errors
4. Execute: `show port 1 rate-limit detail`
5. Verify output shows multicast rate-limit 500 pps with burst-tolerance low

**Pass Criteria**: Verify as per methodology

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.1.3 Verify CLI Syntax - Burst-Tolerance Medium

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit with burst-tolerance medium for unknown-destmac
2. Execute: `configure port 1 rate-limit flood unknown-destmac 20 burst-tolerance medium out-actions log trap`
3. Verify command accepted without errors
4. Execute: `show port 1 rate-limit detail`
5. Verify output shows unknown-destmac rate-limit 20 pps with burst-tolerance medium

**Pass Criteria**: Verify as per methodology

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.1.4 Verify CLI Syntax - Burst-Tolerance High

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit with burst-tolerance high for broadcast
2. Execute: `configure port 1 rate-limit flood broadcast 500 burst-tolerance high out-actions log trap`
3. Verify command accepted without errors
4. Execute: `show port 1 rate-limit detail`
5. Verify output shows broadcast rate-limit 500 pps with burst-tolerance high

**Pass Criteria**: Verify as per methodology

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

### 5.2 Functional Specification

#### 5.2.1 Verify Default Burst-Tolerance Behavior (Baseline)

**Topology used**: Topology-1

**Prerequisites**: Configure topology per testcase 5.1.1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance default out-actions log trap`
2. Configure Ixia1 to generate broadcast traffic at line rate (10 Gbps, 64-byte packets)
3. Start Wireshark capture on Ixia2
4. Send traffic for 5 seconds from Ixia1
5. Stop capture, export to PCAP
6. Analyze I/O graph in Wireshark (1-second intervals)
7. Record packets received in first second vs subsequent seconds

**Pass Criteria**: 
- First second: ~1500-2000 packets (baseline behavior, 3-4x configured 500 pps)
- Subsequent seconds: ~500-550 packets per second
- Document baseline for comparison with other tolerance levels

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.2 Verify Burst-Tolerance Low (Aggressive Suppression)

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Configure Ixia1 to generate broadcast traffic at line rate (10 Gbps, 64-byte packets)
3. Start Wireshark capture on Ixia2
4. Send traffic for 5 seconds from Ixia1
5. Stop capture, analyze I/O graph
6. Record packets in first second
7. Compare with default (testcase 5.2.1)

**Pass Criteria**: 
- First second: ≤ 650 packets (≤ 30% over configured 500 pps)
- **Significant reduction** compared to default baseline (testcase 5.2.1)
- Aggressive burst suppression demonstrated
- Subsequent seconds: ~500-550 packets per second

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.3 Verify Burst-Tolerance Medium (Moderate Control)

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance medium out-actions log trap`
2. Repeat burst traffic test per testcase 5.2.2 steps 2-6
3. Compare first-second packets with low (testcase 5.2.2) and default (testcase 5.2.1)

**Pass Criteria**: 
- First second: ~800-1000 packets (60-100% over configured 500 pps)
- **More than low**, **less than default**
- Moderate burst control demonstrated
- Subsequent seconds: ~500-550 packets per second

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.4 Verify Burst-Tolerance High (Allows Larger Burst)

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.3

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance high out-actions log trap`
2. Repeat burst traffic test per testcase 5.2.2 steps 2-6
3. Compare with medium (testcase 5.2.3) and default (testcase 5.2.1)

**Pass Criteria**: 
- First second: ~1200-1500 packets (140-200% over configured 500 pps)
- **More than medium**, **similar to or slightly less than default**
- Allows larger burst while still providing control
- Subsequent seconds: ~500-550 packets per second

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.2.5 Verify Multicast Burst Control with Burst-Tolerance Low

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.1.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood multicast 500 burst-tolerance low out-actions log trap`
2. Configure Ixia1 to generate IPv4 multicast traffic (224.0.0.1) at line rate
3. Start capture on Ixia2
4. Send traffic for 5 seconds
5. Analyze I/O graph for first-second packets

**Pass Criteria**: 
- First second: ≤ 650 packets
- Multicast rate-limiting behavior similar to broadcast (testcase 5.2.2)

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.6 Verify Unknown-DestMAC Burst Control with Burst-Tolerance Low

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.1.3

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood unknown-destmac 20 burst-tolerance low out-actions log trap`
2. Configure Ixia1 to generate unicast traffic to unknown MAC addresses at line rate
3. Use rotating destination MAC addresses (not learned in FDB)
4. Start capture on Ixia2, send traffic for 5 seconds
5. Analyze I/O graph for first-second packets

**Pass Criteria**: 
- First second: ≤ 26 packets (≤ 30% over configured 20 pps)
- Unknown-destmac rate-limiting with tight burst control

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.7 Verify Burst-Tolerance Comparison (All 4 Levels)

**Topology used**: Topology-1

**Prerequisites**: Testcases 5.2.1 through 5.2.4 completed

**Test Methodology**:
1. Compare first-second packet counts from testcases 5.2.1-5.2.4
2. Verify ordering: **low < medium < high ≈ default**
3. Document exact packet counts for each tolerance level
4. Verify clear differentiation between levels

**Pass Criteria**: 
- **low**: ≤ 650 packets (most aggressive)
- **medium**: ~800-1000 packets
- **high**: ~1200-1500 packets
- **default**: ~1500-2000 packets (baseline)
- Clear progression of burst tolerance

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.3 CLI Configuration

#### 5.3.1 Verify Show Command Displays Burst-Tolerance

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Execute: `show port 1 rate-limit`
3. Verify output includes "Burst-Tolerance: low" or equivalent
4. Execute: `show port 1 rate-limit detail`
5. Verify detailed output shows burst-tolerance per flood type

**Pass Criteria**: 
- show port rate-limit displays burst-tolerance level
- Detail mode shows burst-tolerance for each configured flood type

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.3.2 Verify Changing Burst-Tolerance Level

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.3.1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Execute: `show port 1 rate-limit` - verify burst-tolerance low
3. Reconfigure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance high out-actions log trap`
4. Execute: `show port 1 rate-limit`
5. Verify burst-tolerance changed to high
6. Verify rate-limit 500 pps still active

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
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Configure: `configure port 1 rate-limit flood multicast 500 burst-tolerance medium out-actions log trap`
3. Configure: `configure port 1 rate-limit flood unknown-destmac 20 burst-tolerance high out-actions log trap`
4. Execute: `show port 1 rate-limit detail`
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
1. Configure: `configure port 1 rate-limit flood broadcast 500 out-actions log trap`
2. Do NOT specify burst-tolerance (should use default)
3. Execute: `show port 1 rate-limit detail`
4. Verify burst-tolerance shows "default" or equivalent
5. Generate burst traffic, verify behavior matches testcase 5.2.1

**Pass Criteria**: 
- Rate-limit works without explicit burst-tolerance
- Default tolerance automatically applied
- Behavior matches testcase 5.2.1 (default baseline)

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

### 5.4 SNMP

#### 5.4.1 Verify SNMP MIB for Burst-Tolerance (If Supported)

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Query SNMP MIB for rate-limit configuration (extremePortRateLimitTable)
3. Verify burst-tolerance parameter in MIB (if new MIB object added)
4. If not in MIB, document as expected limitation

**Pass Criteria**: 
- If supported: SNMP MIB reflects burst-tolerance level (0=default, 1=low, 2=medium, 3=high)
- If not supported: Document limitation

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.5 Redundancy/Resiliency

#### 5.5.1 Verify Burst-Tolerance Persists After Reboot

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Execute: `save configuration`
3. Execute: `reboot`
4. Wait for switch to come back up
5. Execute: `show port 1 rate-limit detail`
6. Verify burst-tolerance low configuration persists

**Pass Criteria**: 
- Burst-tolerance configuration persists after reboot
- Rate-limit behavior consistent after reboot

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.5.2 Verify Burst-Tolerance Survives Process Restart

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Execute: `restart process hal`
3. Wait for process to restart
4. Execute: `show port 1 rate-limit detail`
5. Verify burst-tolerance low configuration retained

**Pass Criteria**: 
- Burst-tolerance configuration survives HAL process restart
- No configuration loss

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.5.3 Verify Burst-Tolerance in Stacking Environment

**Topology used**: 2-node stack (5720-24MXW FE stack)

**Test Methodology**:
1. Configure on master: `configure port 1:1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Configure on member: `configure port 2:1 rate-limit flood broadcast 500 burst-tolerance high out-actions log trap`
3. Execute: `show port 1:1 rate-limit` - verify burst-tolerance low
4. Execute: `show port 2:1 rate-limit` - verify burst-tolerance high
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
   - `configure ports 1-5 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
   - `configure ports 6-10 rate-limit flood broadcast 500 burst-tolerance high out-actions log trap`
2. Execute: `show ports 1-10 rate-limit`
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

### 5.7 Performance

#### 5.7.1 Verify CPU Impact During Burst Traffic with Low Tolerance

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Monitor CPU usage: `show cpu-monitoring`
3. Generate burst traffic from Ixia1 (line rate, 10 seconds)
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
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance very-low out-actions log trap`
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
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance 100 out-actions log trap`
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
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance loww out-actions log trap`
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

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log`
2. Generate burst traffic from Ixia1
3. Check EMS logs: `show log`
4. Verify rate-limit exceeded logs generated
5. Verify logs indicate broadcast flood on port 1

**Pass Criteria**: 
- Rate-limit logs generated when exceeded
- Burst-tolerance doesn't interfere with log action

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.9.2 Verify Trap Action with Burst-Tolerance Low

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure SNMP trap receiver
2. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions trap`
3. Generate burst traffic from Ixia1
4. Check trap receiver for rate-limit traps
5. Verify trap received when rate-limit exceeded

**Pass Criteria**: 
- SNMP traps sent when rate-limit exceeded
- Burst-tolerance doesn't interfere with trap action

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.9.3 Verify Disable-Port Action with Burst-Tolerance Low

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions disable-port`
2. Generate burst traffic from Ixia1 exceeding rate-limit
3. Verify port 1 disabled automatically
4. Check: `show port 1 information` - verify state disabled
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

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Configure Ixia1 to send 1-second burst at line rate, then stop
3. Capture on Ixia2
4. Verify packets received in that 1 second ≤ 650

**Pass Criteria**: 
- Short burst controlled within tolerance limit
- First-second spike suppressed per testcase 5.2.2

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.10.2 Verify Burst-Tolerance Low with Continuous Traffic

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Configure Ixia1 to send continuous broadcast traffic at 1000 pps for 60 seconds
3. Capture on Ixia2, analyze per-second packets
4. Verify steady-state: ~500 packets/second after first second

**Pass Criteria**: 
- Steady-state rate limiting unaffected by burst-tolerance
- Burst-tolerance only impacts burst behavior

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.10.3 Verify Burst-Tolerance with Periodic Bursts

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
2. Configure Ixia1 to send periodic bursts: 1-second burst every 10 seconds, repeat 5 times
3. Capture on Ixia2
4. Analyze each burst interval
5. Verify each burst shows first-second spike suppression

**Pass Criteria**: 
- Each burst interval shows consistent burst control
- Burst-tolerance behavior repeatable across multiple bursts

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.11 Negative Scenarios

#### 5.11.1 Verify Burst-Tolerance Doesn't Break Existing Rate-Limit

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit WITHOUT burst-tolerance: `configure port 1 rate-limit flood broadcast 500 out-actions log trap`
2. Generate traffic, verify rate-limiting works (baseline)
3. Add burst-tolerance: `configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap`
4. Generate traffic, verify rate-limiting still works
5. Verify no functional regression

**Pass Criteria**: 
- Rate-limit functionality intact before and after burst-tolerance addition
- Backward compatibility maintained

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.11.2 Verify Rate-Limit Without Burst-Tolerance Uses Default

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 out-actions log trap`
2. Do NOT configure burst-tolerance (uses default)
3. Generate burst traffic
4. Verify rate-limiting active
5. Verify behavior matches testcase 5.2.1 (default tolerance)

**Pass Criteria**: 
- Rate-limit works without explicit burst-tolerance configuration
- Burst-tolerance parameter is optional
- Default behavior documented and consistent

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

## 6. Test Execution Summary

### 6.1 Test Case Distribution

| Category | Total Test Cases | Sanity Tests | Automatable Tests |
|----------|-----------------|--------------|-------------------|
| 5.1 Conformance | 4 | 4 | 4 |
| 5.2 Functional Spec | 7 | 5 | 7 |
| 5.3 CLI Configuration | 4 | 2 | 4 |
| 5.4 SNMP | 1 | 0 | 1 |
| 5.5 Redundancy | 3 | 1 | 3 |
| 5.6 Scaling | 1 | 0 | 1 |
| 5.7 Performance | 1 | 0 | 1 |
| 5.8 Error Handling | 3 | 0 | 3 |
| 5.9 Integration | 3 | 0 | 3 |
| 5.10 Traffic Patterns | 3 | 0 | 3 |
| 5.11 Negative | 2 | 1 | 2 |
| **TOTAL** | **32** | **13 (41%)** | **32 (100%)** |

### 6.2 Sanity Test Coverage
- **Sanity tests**: 13 out of 32 (41%)
- **Focus**: All 4 CLI syntax options, basic burst control with different tolerance levels, persistence, backward compatibility

---

## 7. Expected Burst Behavior Summary

| Burst-Tolerance | First-Second Packets (500 pps limit) | Spike Over Limit | Use Case |
|----------------|-------------------------------------|------------------|----------|
| **low** | ≤ 650 packets | ≤ 30% | Strict burst control, security-sensitive |
| **medium** | ~800-1000 packets | ~60-100% | Balanced control, typical enterprise |
| **high** | ~1200-1500 packets | ~140-200% | Lenient, allows legitimate bursts |
| **default** | ~1500-2000 packets | ~200-300% | Baseline (pre-enhancement behavior) |

---

## 8. Appendix

### 8.1 References
- **Jira**: EXOS-39208
- **Related**: CFD-16121 (Customer-found defect)
- **Related**: EXOS-39560 (IPP Rate-Limit)

### 8.2 Ixia Traffic Configuration Example
```
Stream: Broadcast Burst
- Packet Type: Ethernet II
- Destination MAC: FF:FF:FF:FF:FF:FF
- Source MAC: 00:11:22:33:44:55
- Frame Size: 64 bytes
- Rate: Line Rate (10 Gbps) OR 1000 pps (for continuous)
- Duration: 1 second burst OR 60 seconds continuous
```

### 8.3 Wireshark I/O Graph Settings
```
- Graph Type: Packets/Second
- Interval: 1 second
- Filter: (none for all packets OR broadcast filter)
- Display: Bar graph showing packets per second over time
```

### 8.4 CLI Help Text Reference
```
burst-tolerance => help="Configure the tolerance level to handle a packet burst"
low             => help="Minimal burst tolerance, aggressively suppress a packet burst"
medium          => help="Moderate burst tolerance"
high            => help="Higher burst tolerance, allows a larger packet burst"
default         => help="Burst tolerance that allows a packet burst at least equal to the configured flood rate"
```

### 8.5 Review Meeting Notes
- **Date**: TBD
- **Attendees**: QA, Development, Product Management
- **Approvals**: TBD

---

**Test Plan Approved By**:
- QA Lead: _______________
- Development Lead: _______________
- Product Management: _______________

**Date**: _______________
