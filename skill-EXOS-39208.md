# EXOS-39208: Flood Rate-Limit CLI - Bucketsize Configuration Enhancement

## Feature Overview

**Jira**: EXOS-39208  
**Type**: Enhancement (CLI Feature Addition)  
**Status**: Closed  
**Priority**: P4 - Low

### Summary
Add CLI provision to configure buffer granularity (bucketsize) for flood rate-limit functionality to better control burst traffic behavior.

### Problem Statement
With current flood rate-limit implementation in EXOS, when the switch receives random burst traffic, an excessive number of packets (several times more than the configured limit) are allowed through the port during the first second of such bursts. 

**Root Cause**: Default BCM (Broadcom) "Bucketsize" setting is not optimal for all traffic patterns.

**Solution**: Expose bucketsize parameter via CLI to allow fine-tuning of burst traffic handling.

---

## Feature Description

### Current Behavior (Before Enhancement)
```bash
configure port 3 rate-limit flood broadcast 500 out-actions log trap
configure port 3 rate-limit flood multicast 500 out-actions log trap
configure port 3 rate-limit flood unknown-destmac 20 out-actions log trap
```

**Issue**: During burst traffic, first second allows ~2000-3000 packets instead of configured 500 pps.

### Enhanced Behavior (After Implementation)
```bash
configure port 3 rate-limit flood broadcast 500 bucketsize <value> out-actions log trap
# OR (depending on final implementation)
configure port 3 rate-limit flood broadcast 500 out-actions log trap
configure port 3 rate-limit bucketsize <value>
```

**Expected**: Bucketsize parameter fine-tunes burst handling to more closely match configured rate limit.

---

## CLI Syntax (Official)

### Configuration Commands

**Actual CLI Syntax**:
```bash
configure ports [<port_list> | <port_group>] rate-limit flood 
  [broadcast | multicast | unknown-destmac] 
  [no-limit | <pps>] 
  {burst-tolerance [default | low | medium | high]} 
  {out-actions [{log} {trap} {disable-port}]}
```

**Example Configurations**:
```bash
# Low burst tolerance (aggressively suppress burst)
configure port 1 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap

# Medium burst tolerance (moderate)
configure port 1 rate-limit flood multicast 500 burst-tolerance medium out-actions log trap

# High burst tolerance (allow larger burst)
configure port 1 rate-limit flood unknown-destmac 20 burst-tolerance high out-actions log trap

# Default tolerance (burst at least equal to configured rate)
configure port 1 rate-limit flood broadcast 500 burst-tolerance default out-actions log trap
```

### Show Commands

**Enhanced show command**:
```bash
show port <port> rate-limit [detail]
```

**Expected Output** (to include burst-tolerance):
```
Port 3:
  Broadcast Rate Limit: 500 pps (Burst-Tolerance: low)
  Multicast Rate Limit: 500 pps (Burst-Tolerance: medium)
  Unknown-DestMAC Rate Limit: 20 pps (Burst-Tolerance: high)
  Out-Actions: log, trap
```

### Unconfigure Commands
```bash
# Unconfigure specific flood type (removes rate-limit and burst-tolerance)
unconfigure port <port> rate-limit flood <type>

# Reset to default burst-tolerance
configure port <port> rate-limit flood <type> <pps> burst-tolerance default
```

---

## Technical Details

### Parameters

| Parameter | Type | Options | Default | Description |
|-----------|------|---------|---------|-------------|
| burst-tolerance | Enum | default, low, medium, high | default | Configures tolerance level to handle packet bursts |

**Burst-Tolerance Options**:
- **default**: Burst tolerance that allows a packet burst at least equal to the configured flood rate
- **low**: Minimal burst tolerance, aggressively suppress a packet burst
- **medium**: Moderate burst tolerance
- **high**: Higher burst tolerance, allows a larger packet burst

### Flood Types Supported
- **broadcast**: Broadcast packets (FF:FF:FF:FF:FF:FF)
- **multicast**: Multicast packets (01:00:5E:xx:xx:xx, 33:33:xx:xx:xx:xx)
- **unknown-destmac**: Unicast packets with unknown destination MAC

### BCM Implementation
- **Broadcom Level**: Setting affects BCM chip's rate-limiting algorithm via bucket size tuning
- **Token Bucket Algorithm**: burst-tolerance maps to BCM bucketsize internally
- **Tolerance Mapping**:
  - `low`: Smallest BCM bucketsize → aggressive burst suppression
  - `medium`: Moderate BCM bucketsize → balanced control
  - `high`: Larger BCM bucketsize → allows larger bursts
  - `default`: Standard BCM bucketsize → baseline behavior

---

## Test Topology

```
Ixia1 (Traffic Generator)
   |
   | Port 3 (Ingress)
   |
  [DUT] EXOS Switch
   |
   | Port 1 (Egress - Rate Limited)
   |
Ixia2 (Traffic Receiver + Capture)
```

### Configuration
```bash
# VLAN Configuration
configure vlan default add port 1, 3

# Rate Limit Configuration (Port 3 egress) with burst-tolerance
configure port 3 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap
configure port 3 rate-limit flood multicast 500 burst-tolerance medium out-actions log trap
configure port 3 rate-limit flood unknown-destmac 20 burst-tolerance low out-actions log trap
```

---

## Test Scenarios

### Scenario 1: Burst Traffic Validation
**Objective**: Verify burst-tolerance parameter controls burst traffic in first second

**Test Steps**:
1. Configure rate-limit without burst-tolerance (uses default)
2. Start packet capture on Ixia2
3. Send burst traffic (broadcast at line rate) from Ixia1 for 5 seconds
4. Stop capture and analyze I/O graph in Wireshark
5. Record packets received in first second
6. Repeat with different burst-tolerance values (low, medium, high, default)
7. Compare first-second spike across tolerance levels

**Expected Burst Behavior**:
- **default**: First second ~1500-2000 packets (baseline, 3-4x configured 500 pps)
- **low**: First second ~550-650 packets (aggressive suppression, ≤30% over limit)
- **medium**: First second ~800-1000 packets (moderate burst)
- **high**: First second ~1200-1500 packets (allows larger burst)

### Scenario 2: CLI Syntax Validation
**Objective**: Verify all CLI commands accept burst-tolerance parameter

**Test Cases**:
- Configure burst-tolerance with broadcast rate-limit (test all 4 options: default, low, medium, high)
- Configure burst-tolerance with multicast rate-limit
- Configure burst-tolerance with unknown-destmac rate-limit
- Verify show command displays burst-tolerance level
- Change burst-tolerance from low → high → default
- Verify invalid options rejected (e.g., "very-low", numeric values)

### Scenario 3: Persistence Testing
**Objective**: Verify burst-tolerance configuration persists

**Test Cases**:
- Configure burst-tolerance low, save config, reboot switch
- Configure burst-tolerance high, perform process restart (HAL)
- Configure burst-tolerance medium, verify across ISSU upgrade

### Scenario 4: Negative Testing
**Objective**: Verify error handling

**Test Cases**:
- Configure burst-tolerance with invalid option (e.g., "very-low", "extreme")
- Configure burst-tolerance with numeric value (should be rejected)
- Configure burst-tolerance without rate-limit configured
- Verify typos rejected (e.g., "loww", "defalt")

---

## API Integration

### NOS-API Endpoint (If Supported)
```http
PATCH /v0/configuration/port/{portId}/rate-limit
Content-Type: application/json

{
  "floodType": "BROADCAST",
  "rateLimit": 500,
  "burstTolerance": "LOW",
  "outActions": ["LOG", "TRAP"]
}
```

**burstTolerance Values**: "DEFAULT", "LOW", "MEDIUM", "HIGH"

### IPP Integration (If Supported)
```bash
create ipp-match <name>
  match-criteria lldp ...
  action rate-limit-broadcast 500 burst-tolerance low
end
```

---

## Related Features

- **EXOS-39560**: IPP RATE_LIMIT Flood Type Actions
- **CFD-16121**: Original customer-found defect about burst traffic
- **Flood Rate-Limit**: Existing EXOS feature for traffic control

---

## References

### Configuration Files
```bash
configure vlan default add port 1, 3
configure port 3 rate-limit flood broadcast 500 burst-tolerance low out-actions log trap
configure port 3 rate-limit flood multicast 500 burst-tolerance medium out-actions log trap
configure port 3 rate-limit flood unknown-destmac 20 burst-tolerance low out-actions log trap
```

### Validation Tools
- **Ixia Traffic Generator**: Burst traffic generation
- **Wireshark**: I/O graph statistics analysis
- **EXOS CLI**: Configuration and show commands
- **EMS Logs**: out-actions log trap verification

---

## Success Criteria

1. ✅ CLI accepts burst-tolerance parameter with all options (default, low, medium, high)
2. ✅ **low**: Burst traffic in first second ≤ 30% over configured limit (aggressive suppression)
3. ✅ **medium**: Moderate burst control (~60-100% over limit)
4. ✅ **high**: Allows larger burst (~140-200% over limit)
5. ✅ Configuration persists across reboot/process restart
6. ✅ Show command displays burst-tolerance level
7. ✅ Error handling for invalid tolerance levels
8. ✅ Works with all flood types (broadcast, multicast, unknown-destmac)
9. ✅ Compatible with existing out-actions (log, trap, disable-port)

---

## Constraints & Limitations

- **Broadcom Dependency**: Feature relies on BCM chip capabilities
- **Platform Specific**: May not be available on all EXOS platforms
- **Predefined Levels**: Only 4 tolerance levels available (cannot specify custom numeric values)
- **Traffic Patterns**: Optimal tolerance level may vary by network traffic pattern
- **Trade-off**: Lower tolerance = tighter burst control but less flexibility for legitimate bursts

---

## Notes

- This is an enhancement to existing flood rate-limit feature
- Customer-driven requirement from CFD-16121
- Focus is on burst traffic control, not steady-state rate limiting
- BCM-level tuning exposed via user-friendly CLI

---

## Questions for Development/QA

1. ✅ **ANSWERED**: CLI syntax is `burst-tolerance [default | low | medium | high]`
2. What is the exact BCM bucketsize value mapped to each tolerance level (low/medium/high)?
3. Can burst-tolerance be configured independently per flood-type (broadcast, multicast, unknown-destmac)?
4. Is burst-tolerance configurable via NOS-API? What are the JSON field names?
5. Is burst-tolerance supported in IPP (Instant Port Profile) actions?
6. What platforms support this feature (all EXOS? specific models? BCM chip dependency?)
7. What is the recommended tolerance level for typical enterprise networks?
8. What happens if burst-tolerance is configured without rate-limit <pps> configured?
9. What error messages for invalid tolerance levels (e.g., typos, numeric values)?
10. Does changing burst-tolerance take effect immediately or require traffic restart?
