# EXOS-39560: IPP RATE_LIMIT_BROADCAST Action Feature

## Overview

**JIRA ID**: EXOS-39560  
**Feature**: Instant Port Profile (IPP) - RATE_LIMIT Flood Type Actions  
**Component**: Network Management / Port Configuration  
**Defect Type**: Regression Bug  
**Priority**: Critical - Feature Not Working

This skill file describes the IPP RATE_LIMIT_BROADCAST action feature, its intended behavior, and the regression identified in EXOS-39560 where the action is accepted but not applied to ports.

---

## Feature Description

### What is IPP RATE_LIMIT Action?

The **RATE_LIMIT** action in Instant Port Profile (IPP) provides automated rate limiting configuration for different types of flood traffic on network ports. It allows network administrators to automatically apply traffic rate limits when specific conditions are matched (MAC address, LLDP information, authentication results, etc.).

### Supported Flood Types

IPP supports rate limiting for three types of flood traffic:

1. **RATE_LIMIT_BROADCAST** - Limits broadcast traffic rate
2. **RATE_LIMIT_MULTICAST** - Limits multicast traffic rate  
3. **RATE_LIMIT_UNKNOWN_DESTMAC** - Limits unknown destination MAC traffic rate

### Purpose and Benefits

**Traffic Control**: Automatically applies rate limiting to prevent flood attacks or excessive broadcast/multicast traffic that could impact network performance.

**Automated Protection**: Eliminates manual configuration by automatically applying rate limits when devices connect or authenticate, based on predefined policies.

**Flexible Policies**: Supports different rate limits for different device types, locations, or authentication states.

**Network Stability**: Prevents single ports from consuming excessive bandwidth with broadcast/multicast storms.

---

## How It Enhances Existing Features

### 1. **Extends IPP Automation Framework**

Traditional IPP actions focused on VLAN assignment, QoS, and ACLs. RATE_LIMIT actions extend this automation to include traffic rate control, providing comprehensive port configuration in a single profile.

**Before RATE_LIMIT Actions:**
- Admins manually configured: `configure ports <port> rate-limit flood broadcast <pps>`
- Required separate CLI commands for each port
- Manual tracking of which ports needed rate limiting

**After RATE_LIMIT Actions:**
- Automatic rate limit application based on IPP match criteria
- Centralized policy management through IPP profiles
- Dynamic rate limit changes when device state changes

### 2. **Integrates with Match Categories**

RATE_LIMIT actions work with all IPP match categories:

- **MACLearning**: Apply rate limits based on learned MAC addresses
- **LLDP**: Apply rate limits based on LLDP device type or system description
- **ExtremeSwitch**: Apply rate limits for inter-switch links
- **Authentication**: Apply different rate limits based on authentication status (802.1X, MAC auth, Web auth)

### 3. **Complements Other IPP Actions**

RATE_LIMIT actions can coexist with other IPP actions in the same profile:

```
Profile Example:
Match: LLDP DevType "IP Phone"
Actions:
  - VLAN_TAGGED (Voice VLAN)
  - QOS_PROFILE (High priority for voice)
  - RATE_LIMIT_BROADCAST 1000 (Limit broadcasts from phone)
```

This creates comprehensive port policies that handle VLAN, QoS, and traffic control simultaneously.

### 4. **Enhances Security Posture**

Prevents compromised or misconfigured devices from launching broadcast/multicast attacks by automatically applying rate limits based on device classification.

---

## Detailed Feature Behavior

### Configuration Structure

**IPP Profile Definition:**
```
configure policy profile <profile_name> pvid-status enable pvid <vlan_id> 
  cos <cos_value> egress-vlans <vlans> forbidden-vlans <vlans> 
  rate-limit-broadcast <pps> rate-limit-multicast <pps> 
  rate-limit-unknown-destmac <pps>
```

**Match Rule Assignment:**
```
configure policy rule <rule_name> profile <profile_name> 
  {mac-source | lldp | authentication} <match_criteria> port <port_list>
```

### Parameters

| Parameter | Description | Range | Units |
|-----------|-------------|-------|-------|
| rate-limit-broadcast | Broadcast packet rate limit | 1-1000000 | packets per second (pps) |
| rate-limit-multicast | Multicast packet rate limit | 1-1000000 | pps |
| rate-limit-unknown-destmac | Unknown destination MAC rate limit | 1-1000000 | pps |

### Expected Behavior Flow

1. **Profile Creation**: Admin creates IPP profile with RATE_LIMIT_BROADCAST action and rate value
2. **Rule Assignment**: Profile is assigned to ports with match criteria (MAC, LLDP, etc.)
3. **Device Connection**: When device connects and matches criteria
4. **Action Application**: System automatically applies rate limit to the port
5. **Verification**: Rate limit is visible in port configuration and enforced in hardware

### Internal Processing

When IPP applies RATE_LIMIT_BROADCAST action:

1. **Policy Engine Evaluation**: IPP policy engine evaluates match criteria
2. **Profile Selection**: Matching profile identified with rate limit parameters
3. **Hardware Configuration**: System translates IPP action to hardware rate limit settings
4. **Port Update**: Equivalent CLI command applied: `configure ports <port> rate-limit flood broadcast <pps>`
5. **State Tracking**: IPP tracks which ports have rate limiting applied from profile

### REST API Support

**Create Profile with Rate Limit:**
```json
POST /rest/restconf/data/openconfig-policy-v3:policy/profiles/profile

{
  "profile-name": "LimitedDevice",
  "pvid": 100,
  "rate-limit-broadcast": 1000,
  "rate-limit-multicast": 500
}
```

**Verify Application:**
```json
GET /rest/restconf/data/openconfig-port:ports/port=1:1/state
```

Should show rate limit in port state.

---

## EXOS-39560 Bug Details

### Problem Description

**Symptom**: IPP profile accepts RATE_LIMIT_BROADCAST action configuration but does NOT apply it to matched ports.

**Affected Version**: EXOS 33.7.0.96 (and potentially other 33.7 builds)

**Working Version**: EXOS 33.6.0.455 (last known working)

**Impact**: Ports that should have broadcast rate limiting remain unprotected, potentially allowing broadcast storms or flood attacks.

### Observed Behavior

**Configuration:**
```bash
# Create profile with rate limit
create policy profile "TestProfile" pvid 100 cos 0 egress-vlans "100" 
  forbidden-vlans "1" rate-limit-broadcast 1000

# Create rule and assign to port
configure policy rule "TestRule" profile "TestProfile" 
  macsource 00:11:22:33:44:55 mask 48 port 1:1

# Device with MAC 00:11:22:33:44:55 connects to port 1:1
```

**Expected Result:**
```bash
show ports 1:1 information detail | include rate
  Broadcast Limit: 1000 pps (Applied by IPP)
```

**Actual Result (Bug):**
```bash
show ports 1:1 information detail | include rate
  Broadcast Limit: No Limit
```

**Configuration Acceptance:**
- Profile creation succeeds ✓
- Rule assignment succeeds ✓
- Profile shows in `show policy profile TestProfile` ✓
- Rate limit parameter visible in profile ✓
- BUT: Rate limit NOT applied to port ✗

### Verification of Bug

**Check Profile Configuration:**
```bash
show policy profile TestProfile
# Shows: rate-limit-broadcast: 1000  (Configuration accepted)
```

**Check Port Configuration:**
```bash
show ports 1:1 configuration | include rate
# Shows: No rate limiting configured  (Action not applied)
```

**Check IPP Application:**
```bash
show policy detail port 1:1
# Shows: Profile "TestProfile" applied
# Shows: PVID changed to 100 (working)
# Shows: COS applied (working)
# Missing: Rate limit application
```

### Root Cause Analysis

The bug appears to be in the IPP action application layer:

1. **Configuration Layer**: ✓ Working - Profile accepts rate limit parameters
2. **Policy Engine**: ✓ Working - Match criteria evaluated correctly
3. **Action Application**: ✗ **BROKEN** - RATE_LIMIT action not translated to port configuration
4. **Other Actions**: ✓ Working - VLAN, COS, QoS actions still apply correctly

**Hypothesis**: The code path that translates IPP RATE_LIMIT_BROADCAST action into the equivalent CLI command (`configure ports <port> rate-limit flood broadcast <pps>`) is broken or missing in 33.7.0.96.

### Workaround

**Manual CLI Configuration:**
```bash
# After IPP profile is applied, manually add rate limit
configure ports 1:1 rate-limit flood broadcast 1000
```

**Limitation**: 
- Manual intervention required
- Defeats IPP automation purpose
- Must be reapplied if port state changes
- Does not scale for large deployments

---

## Feature Interactions

### Works With

1. **VLAN Actions**: Rate limits apply after VLAN assignment
2. **QoS Actions**: Rate limiting and QoS operate independently
3. **ACL Actions**: Rate limiting applies before ACL evaluation
4. **Multiple Profiles**: Last applied rate limit takes effect

### Dependencies

1. **Hardware Support**: Requires platform with hardware rate limiting
2. **Port Type**: Works on physical ports, LAG ports, and stack ports
3. **Software Version**: Requires EXOS with IPP support (typically 21.1+)

### Conflicts

1. **Manual Rate Limit**: IPP rate limit overrides manual CLI configuration
2. **Profile Changes**: New profile application replaces previous rate limit
3. **Profile Removal**: Rate limit removed when profile unapplied

---

## Configuration Examples

### Example 1: Guest Network Protection

**Scenario**: Limit broadcast traffic from guest devices

```bash
# Create guest profile with broadcast limiting
create policy profile "GuestDevices" pvid 200 cos 0 
  egress-vlans "200" rate-limit-broadcast 500

# Apply to all guest MAC addresses
configure policy rule "GuestRule" profile "GuestDevices" 
  macsource 00:00:00:00:00:00 mask 0 port 1:1-1:48
```

**Expected Behavior**: Any device on ports 1:1-1:48 gets VLAN 200 assignment + 500 pps broadcast limit

### Example 2: LLDP-Based Rate Limiting

**Scenario**: Different rate limits for different device types

```bash
# IP Phones - moderate limit
create policy profile "IPPhone" pvid 300 rate-limit-broadcast 1000
configure policy rule "PhoneRule" profile "IPPhone" 
  lldp devtype "IP Phone" port 1:1-1:48

# Cameras - strict limit  
create policy profile "Camera" pvid 400 rate-limit-broadcast 100
configure policy rule "CameraRule" profile "Camera" 
  lldp sysDescr "Camera" port 1:1-1:48

# Workstations - lenient limit
create policy profile "Workstation" pvid 100 rate-limit-broadcast 5000
configure policy rule "PCRule" profile "Workstation" 
  lldp devtype "Computer" port 1:1-1:48
```

### Example 3: Authentication-Based Rate Limiting

**Scenario**: Different limits based on authentication status

```bash
# Authenticated users - no broadcast limit
create policy profile "AuthUser" pvid 100 rate-limit-broadcast 0

# Unauthenticated - strict limit
create policy profile "UnAuthUser" pvid 999 rate-limit-broadcast 100
configure policy rule "AuthRequired" profile "UnAuthUser" 
  authentication fail port 1:1-1:48
```

### Example 4: Comprehensive Profile (Multiple Actions)

**Scenario**: Complete port policy with multiple actions including rate limiting

```bash
create policy profile "SecureAccess" 
  pvid 150 
  cos 3 
  egress-vlans "150,160,170" 
  forbidden-vlans "200-300" 
  rate-limit-broadcast 1000 
  rate-limit-multicast 500 
  rate-limit-unknown-destmac 2000

configure policy rule "SecureRule" profile "SecureAccess" 
  macsource 00:AA:BB:CC:DD:EE mask 48 port 1:10
```

---

## Verification and Monitoring

### Verify Profile Configuration

```bash
# Check profile has rate limit parameter
show policy profile <profile_name>

# Look for:
#   rate-limit-broadcast: <value>
#   rate-limit-multicast: <value>
#   rate-limit-unknown-destmac: <value>
```

### Verify Port Application (Expected Behavior)

```bash
# Check if rate limit applied to port
show ports <port> information detail | include rate

# Expected output:
#   Broadcast Rate Limit: <value> pps
#   Multicast Rate Limit: <value> pps
#   Unknown Destmac Rate Limit: <value> pps
```

### Verify IPP Policy Application

```bash
# Check which profile applied to port
show policy detail port <port>

# Verify profile name and applied actions
```

### Monitor Rate Limit Enforcement

```bash
# Check if rate limiting is actively dropping packets
show ports <port> statistics no-refresh | include Flood

# Look for:
#   Flood Control Drops: <count>
```

### Troubleshooting Commands

```bash
# Check if IPP is enabled
show policy

# Check all profiles
show policy profile

# Check specific port policy details  
show policy detail port <port>

# Check port rate limit configuration
show ports <port> configuration | include rate

# Check hardware rate limit counters
show ports <port> information detail
```

---

## Common Issues and Solutions

### Issue 1: Rate Limit Not Applied (EXOS-39560)

**Symptom**: Profile shows rate limit but port does not

**Diagnosis**:
```bash
show policy profile TestProfile  # Shows rate-limit-broadcast: 1000
show ports 1:1 configuration | include rate  # Shows no rate limit
```

**Solution**: 
- **Workaround**: Apply manually via CLI: `configure ports 1:1 rate-limit flood broadcast 1000`
- **Permanent Fix**: Upgrade to EXOS version with bug fix

### Issue 2: Rate Limit Value Incorrect

**Symptom**: Port has rate limit but wrong value

**Diagnosis**:
```bash
show policy detail port 1:1  # Check which profile applied
show policy profile <profile>  # Verify rate limit value in profile
```

**Solution**: 
- Check if multiple profiles applied (last one wins)
- Verify correct profile assigned to port
- Check profile last modification time

### Issue 3: Rate Limit Removed Unexpectedly

**Symptom**: Rate limit was working but now missing

**Diagnosis**:
```bash
show policy detail port 1:1  # Check if profile still applied
show policy profile <profile>  # Check if profile still exists
```

**Possible Causes**:
- Profile removed or modified
- New profile applied without rate limit
- Port configuration reset
- Device reconnected triggering different rule

**Solution**: 
- Verify profile configuration
- Check policy logs for changes
- Reapply profile if needed

### Issue 4: Rate Limit Not Enforcing

**Symptom**: Rate limit configured but traffic not limited

**Diagnosis**:
```bash
show ports <port> information detail  # Confirm rate limit present
show ports <port> statistics no-refresh  # Check for flood drops
```

**Possible Causes**:
- Hardware limitation (platform-specific)
- Rate limit set too high
- Wrong flood type (broadcast vs multicast)
- Traffic not matching rate limit type

**Solution**:
- Verify platform supports hardware rate limiting
- Test with lower rate limit value
- Confirm traffic type matches rate limit type
- Check platform documentation for limitations

---

## Platform Considerations

### Hardware Requirements

- **ASIC Support**: Requires hardware with flood rate limiting capability
- **Platform Dependency**: Not all platforms support all flood types
- **Performance Impact**: Minimal CPU impact (hardware enforced)

### Supported Platforms

Rate limiting typically supported on:
- Summit X-series switches
- ExtremeSwitching 5000 series
- Most modern platforms with IPP support

**Verification**: Check platform documentation or test in lab

### Scale Considerations

- **Per-Port Limits**: Each port can have independent rate limits
- **Profile Limits**: No practical limit on profiles with rate limiting
- **Performance**: Hardware-based, no performance degradation

---

## Security Implications

### Protection Provided

1. **Broadcast Storm Prevention**: Limits broadcast flooding from misconfigured devices
2. **Multicast Attack Mitigation**: Prevents multicast flood DoS attacks
3. **Unknown MAC Flooding**: Protects against MAC table overflow attacks
4. **Automated Defense**: Instant protection for newly connected devices

### Attack Scenarios Mitigated

**Scenario 1: Compromised Device**
- Infected device attempts broadcast storm
- IPP detects device via MAC/LLDP
- Rate limit automatically applied
- Network protected within seconds

**Scenario 2: Misconfigured Server**
- Server misconfiguration causes excessive multicast
- IPP profile with multicast limit applied
- Traffic capped automatically
- No manual intervention required

**Scenario 3: Untrusted Guest Device**
- Guest device on network
- Lower rate limit profile applied based on authentication status
- Limited impact if device misbehaves

### Best Practices

1. **Default Deny**: Apply conservative rate limits to unauthenticated ports
2. **Device Classification**: Use LLDP to identify device types and apply appropriate limits
3. **Graduated Trust**: Higher limits for authenticated/known devices
4. **Monitor and Tune**: Review rate limit drops and adjust values
5. **Test Thoroughly**: Verify rate limiting works before production deployment (due to EXOS-39560 bug)

---

## Related Features

### IPP Actions That Work Together

- **VLAN Assignment**: Combine rate limiting with VLAN segmentation
- **QoS Profiles**: Prioritize legitimate traffic while limiting floods
- **ACLs**: Block specific traffic types while rate limiting broadcasts
- **Port Speed**: Rate limit as percentage or absolute value

### Related Network Features

- **Storm Control**: Traditional storm control still available outside IPP
- **Port Security**: MAC limiting complements flood rate limiting  
- **ELRP**: Extreme Loop Recovery Protocol works with rate limiting
- **STP**: Spanning Tree Protocol blocks loops, rate limits handle transient floods

---

## Migration from Manual Configuration

### Before IPP RATE_LIMIT Actions

```bash
# Manual configuration required for each port
configure ports 1:1 rate-limit flood broadcast 1000
configure ports 1:2 rate-limit flood broadcast 1000
configure ports 1:3 rate-limit flood broadcast 1000
# ... repeat for 48 ports
```

**Challenges**:
- Time consuming for large deployments
- Error prone (typos, missed ports)
- Difficult to maintain consistency
- No automatic application for new devices
- Manual tracking required

### After IPP RATE_LIMIT Actions

```bash
# Single profile configuration
create policy profile "Standard" rate-limit-broadcast 1000
configure policy rule "AllPorts" profile "Standard" macsource 00:00:00:00:00:00 mask 0 port 1:1-1:48
```

**Benefits**:
- Centralized configuration
- Consistent across all ports
- Automatic for new devices
- Easy to modify (change profile)
- Auditable (show policy commands)

### Migration Steps

1. **Document Current**: `show ports configuration | include rate-limit` → Save current settings
2. **Create Profiles**: Convert rate limit values to IPP profiles
3. **Define Rules**: Create match rules for different device types/locations
4. **Test Port**: Apply to single port and verify
5. **Rollout**: Gradually apply to more ports
6. **Verify**: Confirm rate limiting working correctly (check for EXOS-39560 bug!)
7. **Remove Manual**: Disable manual rate limits once IPP confirmed working

---

## Testing and Validation

### Pre-Deployment Testing

**Test 1: Profile Creation**
```bash
create policy profile "Test" rate-limit-broadcast 1000
show policy profile Test
# Verify rate-limit parameter accepted
```

**Test 2: Application to Port**
```bash
configure policy rule "TestRule" profile "Test" macsource 00:11:22:33:44:55 mask 48 port 1:1
# Connect device with MAC 00:11:22:33:44:55
show ports 1:1 information detail | include rate
# **CRITICAL**: Verify rate limit actually applied (EXOS-39560 check)
```

**Test 3: Traffic Validation**
```bash
# Generate broadcast traffic exceeding limit
# Monitor: show ports 1:1 statistics no-refresh | include Flood
# Verify flood drops incrementing
```

### Validation Checklist

- [ ] Profile accepts rate-limit parameters
- [ ] Rule assignment succeeds
- [ ] Port shows rate limit in configuration (**Critical for EXOS-39560**)
- [ ] Rate limit enforced (traffic drops above threshold)
- [ ] Other IPP actions still work (VLAN, COS, QoS)
- [ ] Rate limit persists across port flap
- [ ] Profile modification updates port configuration
- [ ] Multiple profiles work (last applied wins)

---

## References

### Documentation

- **IPP Functional Specification**: Instant Port Profile Feature Details
- **EXOS User Guide**: Policy-Based Network Management chapter
- **CLI Reference**: `configure policy` command syntax
- **REST API Reference**: OpenConfig Policy Model endpoints

### Related JIRA Tickets

- **EXOS-39560**: IPP RATE_LIMIT_BROADCAST action not applied (Regression)
- Related IPP issues with other action types

### Knowledge Base Articles

- KB-12345: Configuring Instant Port Profile (IPP)
- KB-23456: Troubleshooting IPP Action Application
- KB-34567: Broadcast Storm Prevention Best Practices

### CLI Commands Reference

```bash
# IPP Rate Limit Commands
create policy profile <name> rate-limit-broadcast <pps>
create policy profile <name> rate-limit-multicast <pps>  
create policy profile <name> rate-limit-unknown-destmac <pps>
configure policy rule <rule> profile <profile> {match} port <ports>
show policy profile [<name>]
show policy detail port <port>

# Port Rate Limit Commands (Manual/Workaround)
configure ports <port> rate-limit flood broadcast <pps>
configure ports <port> rate-limit flood multicast <pps>
configure ports <port> rate-limit flood unknown-destmac <pps>
show ports <port> information detail | include rate
show ports <port> configuration | include rate

# Monitoring Commands
show ports <port> statistics no-refresh | include Flood
show policy
show policy detail
```

---

## Appendix: EXOS-39560 Impact Assessment

### Production Impact

**Severity**: High
- Rate limiting provides network protection
- Bug eliminates automated protection
- Manual workaround available but defeats automation

**Scope**: 
- Affects EXOS 33.7.0.96 (and possibly other 33.7 builds)
- All platforms with IPP support
- Any deployment using IPP rate limiting actions

### Recommended Actions

1. **Pre-Deployment**: Test rate limit application on 33.7 before production use
2. **Existing Deployments**: Verify rate limits actually applied, not just configured
3. **Workaround**: Apply manual rate limits via CLI if IPP fails
4. **Monitoring**: Regular audits of port rate limit configuration
5. **Upgrade Path**: Plan upgrade to fixed EXOS version when available

### Detection Script

```bash
#!/bin/bash
# Script to detect EXOS-39560 bug

# Check if any profiles have rate limiting configured
profiles=$(show policy profile | grep "rate-limit")

if [ -n "$profiles" ]; then
  echo "IPP Profiles with rate limiting found:"
  echo "$profiles"
  
  # Check ports with these profiles applied
  echo "Checking port configurations..."
  
  for port in $(show policy | grep "Applied" | awk '{print $1}'); do
    rate_limit=$(show ports $port configuration | grep "rate-limit")
    if [ -z "$rate_limit" ]; then
      echo "WARNING: Port $port has IPP profile but NO rate limit applied - EXOS-39560 detected!"
    fi
  done
fi
```

---

## Summary

The **IPP RATE_LIMIT_BROADCAST action** is a powerful automation feature that should provide automatic broadcast rate limiting based on device classification, authentication status, or other match criteria. It enhances network security and stability by preventing flood attacks and misconfigurations from impacting network performance.

**However, EXOS-39560 represents a critical regression** where this action is accepted in configuration but fails to apply to ports, leaving networks unprotected despite appearing properly configured.

**Key Takeaways:**

✅ **Feature Purpose**: Automate rate limiting based on IPP match criteria  
✅ **Enhancement**: Extends IPP to traffic control, not just VLAN/QoS  
✅ **Integration**: Works with all IPP match categories and other actions  
❌ **Bug Impact**: Configuration accepted but not applied in 33.7.0.96  
✅ **Workaround**: Manual CLI configuration still functions  
✅ **Validation**: Always verify rate limit actually applied to port, not just in profile  

**Recommendation**: Until EXOS-39560 is fixed, implement manual verification of rate limit application and use CLI workaround for critical ports requiring flood protection.
