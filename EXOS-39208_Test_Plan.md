# EXOS-39208 Functional Test Plan
## Flood Rate-Limit Bucketsize CLI Enhancement

**Feature**: Configure buffer granularity (bucketsize) for flood rate-limit  
**Jira**: EXOS-39208  
**Release**: EXOS 33.7 (TBD)  
**Test Plan Version**: 1.0  
**Date**: 2026-07-07

---

## 1. Introduction

### 1.1 Feature Overview
This test plan covers the CLI enhancement to configure bucketsize parameter for flood rate-limit functionality. The feature allows fine-tuning of burst traffic handling by exposing the Broadcom (BCM) bucketsize setting via CLI commands.

### 1.2 Objectives
- Verify CLI syntax for bucketsize configuration
- Validate burst traffic control with different bucketsize values
- Ensure configuration persistence across reboots and process restarts
- Test integration with existing rate-limit features
- Validate error handling for invalid configurations

### 1.3 Problem Being Solved
Current flood rate-limit implementation allows excessive packets (2-3x configured limit) during the first second of burst traffic. The bucketsize parameter provides granular control to reduce this spike.

---

## 2. Test Scope

### 2.1 In Scope
- CLI configuration of bucketsize parameter
- Burst traffic validation using Ixia traffic generator
- All flood types: broadcast, multicast, unknown-destmac
- Show command verification
- Configuration persistence (reboot, save/load)
- Negative testing (invalid values, error messages)
- Out-actions integration (log, trap)

### 2.2 Out of Scope
- NOS-API bucketsize configuration (if not implemented)
- IPP (Instant Port Profile) bucketsize integration (separate feature)
- Non-Broadcom platforms
- Performance benchmarking beyond burst control

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
- **DUT**: 5720-24MXW FE running EXOS 33.7 (or latest with bucketsize support)
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

#### 5.1.1 Verify CLI Syntax - Broadcast Flood Type

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit with bucketsize for broadcast
2. Execute: `configure port 1 rate-limit flood broadcast 500 bucketsize 100 out-actions log trap`
3. Verify command accepted without errors
4. Execute: `show port 1 rate-limit detail`
5. Verify output shows broadcast rate-limit 500 pps with bucketsize 100

**Pass Criteria**: Verify as per methodology

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.1.2 Verify CLI Syntax - Multicast Flood Type

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit with bucketsize for multicast
2. Execute: `configure port 1 rate-limit flood multicast 500 bucketsize 100 out-actions log trap`
3. Verify command accepted without errors
4. Execute: `show port 1 rate-limit detail`
5. Verify output shows multicast rate-limit 500 pps with bucketsize 100

**Pass Criteria**: Verify as per methodology

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.1.3 Verify CLI Syntax - Unknown-DestMAC Flood Type

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit with bucketsize for unknown-destmac
2. Execute: `configure port 1 rate-limit flood unknown-destmac 20 bucketsize 50 out-actions log trap`
3. Verify command accepted without errors
4. Execute: `show port 1 rate-limit detail`
5. Verify output shows unknown-destmac rate-limit 20 pps with bucketsize 50

**Pass Criteria**: Verify as per methodology

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

### 5.2 Functional Specification

#### 5.2.1 Verify Default Bucketsize Behavior (Baseline)

**Topology used**: Topology-1

**Prerequisites**: Configure topology per testcase 5.1.1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 out-actions log trap`
2. Configure Ixia1 to generate broadcast traffic at line rate (10 Gbps, 64-byte packets)
3. Start Wireshark capture on Ixia2
4. Send traffic for 5 seconds from Ixia1
5. Stop capture, export to PCAP
6. Analyze I/O graph in Wireshark (1-second intervals)
7. Record packets received in first second vs subsequent seconds

**Pass Criteria**: 
- First second: ~1500-2000 packets (3-4x configured 500 pps)
- Subsequent seconds: ~500-550 packets per second
- Document baseline behavior for comparison

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.2 Verify Bucketsize 50 Reduces First-Second Spike

**Topology used**: Topology-1

**Prerequisites**: Configure topology per testcase 5.1.1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Configure Ixia1 to generate broadcast traffic at line rate (10 Gbps, 64-byte packets)
3. Start Wireshark capture on Ixia2
4. Send traffic for 5 seconds from Ixia1
5. Stop capture, analyze I/O graph
6. Record packets in first second
7. Compare with baseline (testcase 5.2.1)

**Pass Criteria**: 
- First second: ≤ 600 packets (≤ 20% over configured 500 pps)
- Significant reduction compared to baseline (testcase 5.2.1)
- Subsequent seconds: ~500-550 packets per second

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.3 Verify Bucketsize 200 Allows Moderate Burst

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 200 out-actions log trap`
2. Repeat burst traffic test per testcase 5.2.2 steps 2-6
3. Compare first-second packets with bucketsize 50 (testcase 5.2.2)

**Pass Criteria**: 
- First second: ~800-1000 packets (moderate burst allowance)
- More than bucketsize 50, less than default
- Subsequent seconds: ~500-550 packets per second

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.2.4 Verify Multicast Burst Control with Bucketsize

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.1.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood multicast 500 bucketsize 50 out-actions log trap`
2. Configure Ixia1 to generate IPv4 multicast traffic (224.0.0.1) at line rate
3. Start capture on Ixia2
4. Send traffic for 5 seconds
5. Analyze I/O graph for first-second packets

**Pass Criteria**: 
- First second: ≤ 600 packets
- Multicast rate-limiting behavior similar to broadcast (testcase 5.2.2)

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.2.5 Verify Unknown-DestMAC Burst Control with Bucketsize

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.1.3

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood unknown-destmac 20 bucketsize 10 out-actions log trap`
2. Configure Ixia1 to generate unicast traffic to unknown MAC addresses at line rate
3. Use rotating destination MAC addresses (not learned in FDB)
4. Start capture on Ixia2, send traffic for 5 seconds
5. Analyze I/O graph for first-second packets

**Pass Criteria**: 
- First second: ≤ 24 packets (≤ 20% over configured 20 pps)
- Unknown-destmac rate-limiting with tight burst control

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

### 5.3 PRD/MRD Requirements

#### 5.3.1 Verify Bucketsize Range - Minimum Value

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 1 out-actions log trap`
2. Verify command accepted
3. Execute: `show port 1 rate-limit detail`
4. Verify bucketsize 1 displayed

**Pass Criteria**: Verify as per methodology

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.3.2 Verify Bucketsize Range - Maximum Value

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 10000 out-actions log trap`
2. Verify command accepted
3. Execute: `show port 1 rate-limit detail`
4. Verify bucketsize 10000 displayed

**Pass Criteria**: Verify as per methodology

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.4 CLI Configuration

#### 5.4.1 Verify Show Command Displays Bucketsize

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Execute: `show port 1 rate-limit`
3. Verify output includes "Bucketsize: 50"
4. Execute: `show port 1 rate-limit detail`
5. Verify detailed output shows bucketsize per flood type

**Pass Criteria**: 
- show port rate-limit displays bucketsize value
- Detail mode shows bucketsize for each configured flood type

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.4.2 Verify Unconfigure Bucketsize Restores Default

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.4.1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Execute: `show port 1 rate-limit` - verify bucketsize 50
3. Execute: `unconfigure port 1 rate-limit flood broadcast bucketsize`
4. Execute: `show port 1 rate-limit`
5. Verify bucketsize shows default value or not displayed
6. Verify rate-limit 500 pps still active

**Pass Criteria**: 
- Unconfigure removes bucketsize, restores default
- Rate-limit configuration remains active

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.4.3 Verify Multiple Flood Types with Different Bucketsize

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Configure: `configure port 1 rate-limit flood multicast 500 bucketsize 100 out-actions log trap`
3. Configure: `configure port 1 rate-limit flood unknown-destmac 20 bucketsize 10 out-actions log trap`
4. Execute: `show port 1 rate-limit detail`
5. Verify each flood type shows its specific bucketsize

**Pass Criteria**: 
- Broadcast: bucketsize 50
- Multicast: bucketsize 100
- Unknown-destmac: bucketsize 10
- Each flood type has independent bucketsize configuration

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.5 SNMP

#### 5.5.1 Verify SNMP MIB for Bucketsize (If Supported)

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Query SNMP MIB for rate-limit configuration (extremePortRateLimitTable)
3. Verify bucketsize parameter in MIB (if new MIB object added)
4. If not in MIB, document as expected limitation

**Pass Criteria**: 
- If supported: SNMP MIB reflects bucketsize value
- If not supported: Document limitation

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.6 Redundancy/Resiliency

#### 5.6.1 Verify Bucketsize Persists After Reboot

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Execute: `save configuration`
3. Execute: `reboot`
4. Wait for switch to come back up
5. Execute: `show port 1 rate-limit detail`
6. Verify bucketsize 50 configuration persists

**Pass Criteria**: 
- Bucketsize configuration persists after reboot
- Rate-limit behavior consistent after reboot

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

#### 5.6.2 Verify Bucketsize Survives Process Restart

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Execute: `restart process hal`
3. Wait for process to restart
4. Execute: `show port 1 rate-limit detail`
5. Verify bucketsize 50 configuration retained

**Pass Criteria**: 
- Bucketsize configuration survives HAL process restart
- No configuration loss

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.6.3 Verify Bucketsize in Stacking Environment

**Topology used**: 2-node stack (5720-24MXW FE stack)

**Test Methodology**:
1. Configure on master: `configure port 1:1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Configure on member: `configure port 2:1 rate-limit flood broadcast 500 bucketsize 100 out-actions log trap`
3. Execute: `show port 1:1 rate-limit` - verify bucketsize 50
4. Execute: `show port 2:1 rate-limit` - verify bucketsize 100
5. Perform stack master failover
6. Verify configurations persist on new master

**Pass Criteria**: 
- Each stack member has independent bucketsize configuration
- Configuration persists across stack master failover

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.7 Scaling

#### 5.7.1 Verify Bucketsize on Multiple Ports

**Topology used**: Topology-1 (use ports 1-10)

**Test Methodology**:
1. Configure bucketsize on 10 ports with varying values:
   - `configure ports 1-10 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Execute: `show ports 1-10 rate-limit`
3. Verify all 10 ports show bucketsize 50
4. Modify port 5 to bucketsize 200
5. Verify port 5 shows new value, others unchanged

**Pass Criteria**: 
- Bucketsize can be configured on multiple ports
- Changes to one port don't affect others
- Up to 48 ports tested (platform maximum)

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.8 Performance

#### 5.8.1 Verify CPU Impact During Burst Traffic

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Monitor CPU usage: `show cpu-monitoring`
3. Generate burst traffic from Ixia1 (line rate, 10 seconds)
4. Monitor CPU usage during traffic
5. Stop traffic, check CPU returns to baseline

**Pass Criteria**: 
- CPU usage increase during burst < 20%
- CPU returns to baseline after traffic stops
- No excessive CPU consumption due to bucketsize processing

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.9 Error Handling

#### 5.9.1 Verify Error on Invalid Bucketsize - Below Minimum

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 0 out-actions log trap`
2. Verify command rejected with error message
3. Expected error: "Error: bucketsize value 0 is out of range (1-10000)"

**Pass Criteria**: 
- Command rejected
- Clear error message displayed
- No configuration applied

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.9.2 Verify Error on Invalid Bucketsize - Above Maximum

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 99999 out-actions log trap`
2. Verify command rejected with error message
3. Expected error: "Error: bucketsize value 99999 is out of range (1-10000)"

**Pass Criteria**: Verify as per methodology

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.9.3 Verify Error on Non-Numeric Bucketsize

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize abc out-actions log trap`
2. Verify command rejected with error message
3. Expected error: "Error: Invalid bucketsize value 'abc'. Must be numeric."

**Pass Criteria**: Verify as per methodology

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.9.4 Verify Bucketsize Without Rate-Limit Configured

**Topology used**: Topology-1

**Test Methodology**:
1. Ensure no rate-limit configured: `unconfigure port 1 rate-limit flood broadcast`
2. Configure: `configure port 1 rate-limit flood broadcast bucketsize 50`
3. Verify command behavior (accepted with warning? rejected?)
4. If accepted, verify rate-limit inactive until pps configured
5. Configure rate-limit: `configure port 1 rate-limit flood broadcast 500 out-actions log trap`
6. Verify bucketsize 50 automatically applied

**Pass Criteria**: 
- Clear behavior documented (accept with warning OR reject)
- If accepted, bucketsize activates when rate-limit configured
- No unexpected behavior

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.10 Integration with Out-Actions

#### 5.10.1 Verify Log Action with Bucketsize

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log`
2. Generate burst traffic from Ixia1
3. Check EMS logs: `show log`
4. Verify rate-limit exceeded logs generated
5. Verify logs indicate broadcast flood on port 1

**Pass Criteria**: 
- Rate-limit logs generated when exceeded
- Bucketsize doesn't interfere with log action

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.10.2 Verify Trap Action with Bucketsize

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure SNMP trap receiver
2. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions trap`
3. Generate burst traffic from Ixia1
4. Check trap receiver for rate-limit traps
5. Verify trap received when rate-limit exceeded

**Pass Criteria**: 
- SNMP traps sent when rate-limit exceeded
- Bucketsize doesn't interfere with trap action

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.10.3 Verify Disable-Port Action with Bucketsize

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions disable-port`
2. Generate burst traffic from Ixia1 exceeding rate-limit
3. Verify port 1 disabled automatically
4. Check: `show port 1 information` - verify state disabled
5. Re-enable port: `enable port 1`

**Pass Criteria**: 
- Port disabled when rate-limit exceeded
- Bucketsize controls burst before disable-port triggered

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.11 Different Traffic Patterns

#### 5.11.1 Verify Bucketsize with Short Burst (1 second)

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Configure Ixia1 to send 1-second burst at line rate, then stop
3. Capture on Ixia2
4. Verify packets received in that 1 second ≤ 600

**Pass Criteria**: 
- Short burst controlled within bucketsize limit
- First-second spike reduced

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.11.2 Verify Bucketsize with Continuous Traffic

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Configure Ixia1 to send continuous broadcast traffic at 1000 pps for 60 seconds
3. Capture on Ixia2, analyze per-second packets
4. Verify steady-state: ~500 packets/second after first second

**Pass Criteria**: 
- Steady-state rate limiting unaffected by bucketsize
- Bucketsize only impacts burst behavior

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.11.3 Verify Bucketsize with Periodic Bursts

**Topology used**: Topology-1

**Prerequisites**: Per testcase 5.2.2

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
2. Configure Ixia1 to send periodic bursts: 1-second burst every 10 seconds, repeat 5 times
3. Capture on Ixia2
4. Analyze each burst interval
5. Verify each burst shows first-second spike reduction

**Pass Criteria**: 
- Each burst interval shows consistent burst control
- Bucketsize behavior repeatable across multiple bursts

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

### 5.12 Negative Scenarios

#### 5.12.1 Verify Bucketsize Doesn't Break Existing Rate-Limit

**Topology used**: Topology-1

**Test Methodology**:
1. Configure rate-limit WITHOUT bucketsize: `configure port 1 rate-limit flood broadcast 500 out-actions log trap`
2. Generate traffic, verify rate-limiting works (baseline)
3. Add bucketsize: `configure port 1 rate-limit flood broadcast 500 bucketsize 50 out-actions log trap`
4. Generate traffic, verify rate-limiting still works
5. Verify no functional regression

**Pass Criteria**: 
- Rate-limit functionality intact before and after bucketsize addition
- Backward compatibility maintained

**Sanity (Yes/No)**: No  
**Automatable (Yes/No)**: Yes

---

#### 5.12.2 Verify Rate-Limit Without Bucketsize Still Works

**Topology used**: Topology-1

**Test Methodology**:
1. Configure: `configure port 1 rate-limit flood broadcast 500 out-actions log trap`
2. Do NOT configure bucketsize (use default)
3. Generate burst traffic
4. Verify rate-limiting active
5. Verify steady-state: ~500 pps (after first-second spike)

**Pass Criteria**: 
- Rate-limit works without explicit bucketsize configuration
- Bucketsize parameter is optional
- Default behavior documented

**Sanity (Yes/No)**: Yes  
**Automatable (Yes/No)**: Yes

---

## 6. Test Execution Summary

### 6.1 Test Case Distribution

| Category | Total Test Cases | Sanity Tests | Automatable Tests |
|----------|-----------------|--------------|-------------------|
| 5.1 Conformance | 3 | 3 | 3 |
| 5.2 Functional Spec | 5 | 4 | 5 |
| 5.3 PRD/MRD | 2 | 0 | 2 |
| 5.4 CLI Configuration | 3 | 1 | 3 |
| 5.5 SNMP | 1 | 0 | 1 |
| 5.6 Redundancy | 3 | 1 | 3 |
| 5.7 Scaling | 1 | 0 | 1 |
| 5.8 Performance | 1 | 0 | 1 |
| 5.9 Error Handling | 4 | 0 | 4 |
| 5.10 Integration | 3 | 0 | 3 |
| 5.11 Traffic Patterns | 3 | 0 | 3 |
| 5.12 Negative | 2 | 1 | 2 |
| **TOTAL** | **31** | **10 (32%)** | **31 (100%)** |

### 6.2 Sanity Test Coverage
- **Sanity tests**: 10 out of 31 (32%)
- **Focus**: CLI syntax, basic burst control, persistence, backward compatibility

---

## 7. Appendix

### 7.1 References
- **Jira**: EXOS-39208
- **Related**: CFD-16121 (Customer-found defect)
- **Related**: EXOS-39560 (IPP Rate-Limit)

### 7.2 Ixia Traffic Configuration Example
```
Stream: Broadcast Burst
- Packet Type: Ethernet II
- Destination MAC: FF:FF:FF:FF:FF:FF
- Source MAC: 00:11:22:33:44:55
- Frame Size: 64 bytes
- Rate: Line Rate (10 Gbps) OR 1000 pps (for continuous)
- Duration: 1 second burst OR 60 seconds continuous
```

### 7.3 Wireshark I/O Graph Settings
```
- Graph Type: Packets/Second
- Interval: 1 second
- Filter: (none for all packets OR broadcast filter)
- Display: Bar graph showing packets per second over time
```

### 7.4 Expected Bucketsize Values (To Be Confirmed)

| Traffic Pattern | Recommended Bucketsize | Rationale |
|----------------|----------------------|-----------|
| Strict burst control | 10-50 | Minimal burst allowance |
| Moderate control | 100-200 | Balance between burst and control |
| Lenient (default-like) | 500-1000 | Allow burst, control steady-state |

### 7.5 Review Meeting Notes
- **Date**: TBD
- **Attendees**: QA, Development, Product Management
- **Approvals**: TBD

---

**Test Plan Approved By**:
- QA Lead: _______________
- Development Lead: _______________
- Product Management: _______________

**Date**: _______________
