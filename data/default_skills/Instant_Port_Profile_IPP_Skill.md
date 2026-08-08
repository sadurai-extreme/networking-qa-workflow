# Instant Port Profile (IPP) - Comprehensive Skill File

## 1. FEATURE OVERVIEW

**Feature Name:** Instant Port Profile (IPP)  
**Category:** Network Access Control, Dynamic Port Configuration  
**Platforms:** EXOS Universal switches

### Purpose
Instant Port Profile (IPP) provides dynamic, event-driven port configuration in response to real-time network connectivity events. It automatically configures switch ports based on detected device types (via MAC learning, LLDP, or authentication), enabling simplified network access control without complex manual configuration.

### Key Capabilities
- **Device Detection**: MAC learning, LLDP neighbor discovery, AAA authentication
- **Dynamic VLAN Assignment**: MAC-based or port-based VLANs (tagged/untagged)
- **QoS Configuration**: Automatic QoS examination and replacement
- **Storm Control**: Broadcast/multicast/unknown-destmac rate limiting
- **Interlink Detection**: Automatic uplink port configuration
- **Authentication Integration**: RADIUS VSA-based device classification

### Use Case
IPP is often described as "Poor Man's NAC (Network Access Control)" - ideal for simple VLAN assignment and basic port configuration based on connected device types, particularly useful for XIQ-managed switches.

---

## 2. FUNCTIONAL DESCRIPTION

### Architecture Overview
IPP leverages the Universal Port Manager (UPM) framework for event detection and action triggering. Unlike UPM (which requires manual CLI scripts), IPP automatically sets up detection events and generates dynamic configurations based on profile definitions.

### Operational Workflow

#### Step 1: Profile Creation and Assignment
```yaml
# IPP Profile Structure (YAML or REST API/OpenAPI)
PortProfile:
  Name: MyPortProfile
  Description: Dynamic port configuration profile
  DeviceTypes:
    - Name: Desktop
      Match:
        Category: MACLearning
        MAC: 0a:ff:d2:22:31:54 / ff:ff:ff:ff:ff:ff
      Actions:
        - VLAN: { VLANID: 10, Add: True, Tagged: False }
        - RateLimit: { FloodType: Broadcast, pps: 1000 }
```

#### Step 2: Profile Binding
- Administrator assigns IPP profile to one or more switch ports
- IPP automatically configures UPM to listen for connectivity events on those ports
- MAC Learning VLAN is configured (required for MAC-based detection)

#### Step 3: Device Connection
When a device connects to an IPP-enabled port:
1. **Detection Event Triggered**:
   - MAC Learning: FDB MAC Tracking detects new MAC address
   - LLDP: LLDP application receives neighbor advertisement
   - Authentication: AAA returns Extreme-Security-Profile VSA

2. **Match Processing**:
   - IPP compares detected attributes (MAC, LLDP DevType, Role) against profile device types
   - Device types are evaluated in order (first match wins)
   - Once matched, device is "locked" to that device type until port restart or config change

3. **Action Execution**:
   - All actions defined for matched device type are applied dynamically
   - Actions include: VLAN assignment, QoS, rate limiting, interlink configuration

#### Step 4: Dynamic Configuration
- Configurations are **non-persistent** (not saved to startup-config)
- Automatically removed on port restart, device disconnect, or profile un-assignment
- Enables temporary, event-driven port behavior

### Match Categories

| Category | Detection Method | Use Case |
|----------|------------------|----------|
| **MACLearning** | FDB MAC Tracking | Detect devices by MAC address or OUI |
| **LLDP** | LLDP neighbor info | Detect devices by LLDP DevType (phones, APs, routers) |
| **ExtremeSwitch** | LLDP (Extreme-specific) | Detect Extreme switches for interlink configuration |
| **Authentication** | RADIUS VSA (Extreme-Security-Profile) | Classify devices by AAA role |

### MAC Address Matching
Uses `MAC / Mask` format for flexible matching:
- **Specific MAC**: `aa:bb:cc:dd:ee:ff / ff:ff:ff:ff:ff:ff`
- **OUI Match**: `aa:bb:cc:00:00:00 / ff:ff:ff:00:00:00`
- **Odd Last Byte**: `00:00:00:00:00:01 / 00:00:00:00:00:01`

### LLDP DevType Matching
Supported LLDP device types:
- `AVAYA_PHONE`, `GEN_TEL_PHONE`
- `ROUTER`, `BRIDGE`, `REPEATER`
- `WLAN_ACCESS_PT`
- `DOCSIS_CABLE_SER`
- `STATION_ONLY`, `OTHER`

### Authentication Role Matching
- Matches role string in `Extreme-Security-Profile` VSA: `Role = <string>`
- Special wildcard: `Role = *` matches all roles
- Used with RADIUS server or netlogin local-user

---

## 3. EXOS IMPLEMENTATION

### Daemons and Modules

| Component | Role |
|-----------|------|
| **UPM (Universal Port Manager)** | Backend server for event detection and action triggering |
| **FDB MAC Tracking** | Detects MAC learning events for MACLearning category |
| **LLDP Daemon** | Provides neighbor discovery for LLDP-based matching |
| **AAA/RADIUS** | Returns VSA for authentication-based matching |
| **Port Manager** | Applies dynamic port configurations |
| **VLAN Manager** | Creates MAC-based and port-based VLANs dynamically |

### Internal Processing

1. **Profile Parsing**: IPP daemon parses YAML or REST API profile structure
2. **UPM Setup**: Automatically configures UPM event listeners for assigned ports
3. **Event Handling**:
   - MAC learn → FDB tracking event → UPM trigger
   - LLDP PDU → LLDP application → UPM trigger
   - Auth success → RADIUS VSA → UPM trigger
4. **Match Engine**: Evaluates device against device types in profile order
5. **Action Dispatcher**: Generates and executes CLI commands for matched actions
6. **State Tracking**: Maintains matched device state, prevents re-matching

### MAC Learning vs LLDP Priority
- If both MACLearning and LLDP device types exist, IPP delays MACLearning by `mac-learning-lldp-wait` seconds (default: 30)
- Allows LLDP neighbor establishment before acting on MAC learning
- Prevents premature VLAN assignment before LLDP classification

### Non-Persistent Configuration
IPP-triggered configurations are **non-persistent**:
- Not saved in `show configuration`
- Automatically removed on switch reboot, port restart, or profile un-assignment
- Leverages non-persistent mode for: VLAN creation, port VLAN membership, rate limiting, QoS

---

## 4. ATTRIBUTES & PARAMETERS

### Profile Attributes

| Attribute | Description | Max Length / Range |
|-----------|-------------|--------------------|
| **Profile Name** | Unique identifier for profile | 32 bytes |
| **Device Type Name** | Unique identifier within profile | 32 bytes |
| **MAC Address** | Device MAC in `addr / mask` format | Standard MAC format |
| **MAC Mask** | Match mask for MAC address | Standard MAC format |
| **DevType** | LLDP device type | Enum (see LLDP types) |
| **System Description** | LLDP sysDescr regex pattern | Extended regex syntax |
| **Role** | Authentication role string | String or `*` (wildcard) |

### Action Parameters

#### VLAN Action
```yaml
VLAN:
  VLANID: <vlan_id> | <vlan_list>  # 1-4094
  Add: True                          # Only "Add: True" supported
  Tagged: True | False               # Tagged or untagged
```

**Untagged VLAN Modes**:
- **MAC-based** (default): `configure vlan <vlan> add mac-based <mac> port <port>`
- **Port-based**: `configure vlan <vlan> add ports <port> untagged`
- Global mode: `configure instant-port untagged-vlan-action-mode [mac-based | port-based]`
- API override: Set `actionSubType: MAC` or `actionSubType: PORT` in REST API

#### Rate Limit Action (Storm Control)
```yaml
RateLimit:
  FloodType: Broadcast | Multicast | Unknown-destmac
  pps: <pps_limit>  # Packets per second (1 - 1000000)
```
Corresponds to CLI: `configure ports <port> rate-limit flood [broadcast | multicast | unknown-destmac] <pps>`

**⚠️ KNOWN ISSUE (EXOS-39560)**: RATE_LIMIT_BROADCAST action accepted but NOT applied in EXOS 33.7.0.96 (regression from 33.6.0.455)

#### QoS Action
```yaml
QoS:
  Examination: 802.1p | DSCP
  Replacement: DSCP | 802.1p
```
Corresponds to CLI:
- `configure ports <port> qosprofile <profile> ingress`
- `configure ports <port> qosprofile <profile> egress`

#### Interlink Action
Automatically adds uplink ports as tagged members of action VLANs when ExtremeSwitch neighbor detected.

### Global Configuration Parameters

| Parameter | CLI Command | Default | Description |
|-----------|-------------|---------|-------------|
| **MAC Learning VLAN** | `configure instant-port learning-vlan <vlan>` | Default VLAN | VLAN for MAC learning events |
| **LLDP Wait Delay** | `configure instant-port mac-learning-lldp-wait <seconds>` | 30 seconds | Delay MAC learning if LLDP match possible |
| **Untagged VLAN Mode** | `configure instant-port untagged-vlan-action-mode [mac-based\|port-based]` | mac-based | Default mode for untagged VLAN actions |

---

## 5. CLI COMMANDS

### Profile Management

```bash
# Create/Update IPP Profile via REST API
PUT /rest/openapi/v0/configuration/instant-port/profiles/<profile_name>

# Delete IPP Profile
DELETE /rest/openapi/v0/configuration/instant-port/profiles/<profile_name>

# Show all profiles
show instant-port

# Show specific profile details
show instant-port profile <profile_name>

# Show device type details
show instant-port profile <profile_name> device-type <device_type_name>
```

### Port Assignment

```bash
# Assign profile to ports (via REST API)
PUT /rest/openapi/v0/configuration/instant-port/port-assignments
{
  "assignments": [
    { "port": "1:1", "profile": "MyProfile" },
    { "port": "1:2-10", "profile": "MyProfile" }
  ]
}

# Show port assignments
show instant-port ports <port>
```

### Global Configuration

```bash
# Configure learning VLAN
configure instant-port learning-vlan <vlan_name>

# Configure MAC learning LLDP wait delay
configure instant-port mac-learning-lldp-wait <seconds>

# Configure untagged VLAN action mode
configure instant-port untagged-vlan-action-mode [mac-based | port-based]

# Show configuration
show instant-port
show instant-port configuration
```

### Monitoring and Troubleshooting

```bash
# Show match statistics
show instant-port profile <profile_name>
# Output shows: Attempts, Matches, Assigned Ports

# Show device type match count
show instant-port profile <profile_name> device-type <device_type_name>

# Show ports with IPP assigned
show instant-port ports

# Debug (requires debug mode)
debug instant-port [event | action | match]
```

---

## 6. FEATURE INTERACTIONS

### VLAN Management
- **MAC-based VLAN**: IPP creates temporary MAC-to-VLAN mappings
- **Port-based VLAN**: IPP modifies port VLAN membership temporarily
- **Untagged VLAN**: Only one untagged VLAN per port at a time
- **Tagged VLAN**: Multiple tagged VLANs can coexist

### QoS Integration
- IPP dynamically assigns QoS profiles to ports
- QoS examination (ingress) and replacement (egress) configured per matched device
- Interacts with existing QoS configuration (IPP settings are additive/overriding)

### NetLogin / 802.1X
- IPP can use **Authentication** match category with RADIUS
- `Extreme-Security-Profile` VSA triggers IPP matching
- Typical use case: After AP authenticated, skip authentication for devices behind AP

### LLDP Integration
- LLDP neighbor discovery triggers IPP LLDP-based matching
- IPP uses LLDP source MAC (not Chassis ID) for matching
- LLDP DevType and System Description can be used for classification

### UPM (Universal Port Manager)
- IPP uses UPM as backend for event detection and triggering
- IPP profiles and UPM profiles are separate (one IPP profile per port, one UPM profile per event per port)
- IPP automatically configures UPM - no manual UPM setup required

### MAC Tracking / FDB
- FDB MAC Tracking application provides MAC learning events
- MAC learning occurs on untagged traffic in the learning VLAN
- MAC learning events trigger MACLearning category matching

---

## 7. OPERATIONAL CHARACTERISTICS

### Scalability
- **Profiles per switch**: Limited by system resources (typically 10-50 profiles)
- **Device types per profile**: Recommended < 100 device types
- **Ports per profile**: All switch ports supported
- **Matched devices per port**: Multiple devices can be matched simultaneously (MAC-based VLANs support multiple MACs per port)

### Performance
- **Match processing**: Near real-time (< 1 second for MAC learning, depends on LLDP timer for LLDP)
- **Action execution**: Sequential CLI command execution (typically < 2 seconds)
- **LLDP wait delay**: 30 seconds default (configurable)

### High Availability (HA) Behavior
- IPP profiles are synchronized in HA configuration
- Matched device state is **not** synchronized (devices re-match after failover)
- Non-persistent configurations are lost on failover (devices must re-connect)

### Resource Utilization
- **CPU**: Minimal impact during normal operation, slight increase during match/action execution
- **Memory**: Profile storage (< 1 MB per profile), matched device state tracking
- **FDB Entries**: MAC-based VLAN actions consume FDB entries

### Persistence
- **IPP Profiles**: Saved in configuration, persistent across reboots
- **Port Assignments**: Saved in configuration, persistent
- **Dynamic Actions**: **NOT saved**, automatically removed on reboot/restart
- **Matched Device State**: **NOT saved**, devices re-match after restart

---

## 8. CONFIGURATION EXAMPLES

### Example 1: Voice Phone with VLAN and QoS

```yaml
# YAML Profile
PortProfile:
  Name: VoicePhoneProfile
  Description: Assign voice VLAN and QoS to IP phones
  DeviceTypes:
    - Name: CiscoPhone
      Match:
        Category: LLDP
        DevType: GEN_TEL_PHONE
        MAC: 00:00:0c:00:00:00 / ff:ff:ff:00:00:00  # Cisco OUI
      Actions:
        - VLAN:
            VLANID: 100
            Add: True
            Tagged: False  # Untagged voice VLAN
        - QoS:
            Examination: 802.1p
            Replacement: DSCP
        - RateLimit:
            FloodType: Broadcast
            pps: 500
```

**REST API Equivalent**:
```json
PUT /rest/openapi/v0/configuration/instant-port/profiles/VoicePhoneProfile
{
  "name": "VoicePhoneProfile",
  "devices": [{
    "name": "CiscoPhone",
    "matchList": [{
      "category": "LLDP",
      "devType": "GEN_TEL_PHONE",
      "data": "00:00:0c:00:00:00/ff:ff:ff:00:00:00"
    }],
    "actionList": [
      {
        "actionType": "SET_VLAN_UNTAGGED",
        "vlanList": ["100"]
      },
      {
        "actionType": "SET_QOS_EXAM_REPLACE",
        "qosExamination": "802_1P",
        "qosReplacement": "DSCP"
      },
      {
        "actionType": "RATE_LIMIT_BROADCAST",
        "rateLimit": 500
      }
    ]
  }]
}
```

### Example 2: MAC-based Desktop Classification

```yaml
PortProfile:
  Name: DesktopProfile
  Description: Assign data VLAN based on MAC OUI
  DeviceTypes:
    - Name: DellDesktop
      Match:
        Category: MACLearning
        MAC: 00:1a:a0:00:00:00 / ff:ff:ff:00:00:00  # Dell OUI
      Actions:
        - VLAN:
            VLANID: 200
            Add: True
            Tagged: False
    
    - Name: HPDesktop
      Match:
        Category: MACLearning
        MAC: 00:1f:29:00:00:00 / ff:ff:ff:00:00:00  # HP OUI
      Actions:
        - VLAN:
            VLANID: 201
            Add: True
            Tagged: False
```

### Example 3: Authentication-based Role Assignment

```yaml
PortProfile:
  Name: AuthProfile
  Description: Assign VLAN based on RADIUS role
  DeviceTypes:
    - Name: Employee
      Match:
        Category: Authentication
        Role: EmployeeRole
      Actions:
        - VLAN:
            VLANID: 10
            Add: True
            Tagged: False
    
    - Name: Guest
      Match:
        Category: Authentication
        Role: GuestRole
      Actions:
        - VLAN:
            VLANID: 50
            Add: True
            Tagged: False
        - RateLimit:
            FloodType: Broadcast
            pps: 100
```

**RADIUS Configuration**:
```
# RADIUS server returns:
Extreme-Security-Profile = "Role = EmployeeRole"
```

---

## 9. VERIFICATION AND MONITORING

### Verify Profile Configuration

```bash
# Show all IPP profiles
show instant-port

# Example output:
Learning VLAN: Default (1)
Number of profiles: 2
MACLearning LLDP wait delay: 30 sec(s)
Untagged VLAN action mode: MAC-based

Instant Port Profile             Secure AuthProtos Devs   Attempts    Matches Assigned Ports
-------------------------------- ------ ---------- ---- ---------- ---------- ---------------
VoicePhoneProfile                false                1         10          5 1:1-10
DesktopProfile                   false                2         50         30 1:11-24
```

### Verify Device Type Matches

```bash
# Show device type details
show instant-port profile VoicePhoneProfile device-type CiscoPhone

# Example output:
Profile VoicePhoneProfile, with 1 device types, assigned to ports 1:1-10
    DeviceType          : (0) CiscoPhone
    Category            : LLDP
        DevType         : GEN_TEL_PHONE
        MAC Address     : 00:00:0c:00:00:00
        MAC Mask        : ff:ff:ff:00:00:00
    Actions (3)
         0. (0xABCD1234) VLAN       : Add (true), Tagged (false:MAC-based), VLANIDs (100)
         1. (0xABCD1235) QoS        : Exam (802.1p), Replace (DSCP)
         2. (0xABCD1236) RateLimit  : FloodType (Broadcast), pps (500)
    Number of matches   : 5
```

### Verify Port State

```bash
# Check port configuration after IPP match
show ports 1:5 information detail

# Verify VLAN assignment:
#   VLAN cfg: Name: VLAN_0100, Internal Tag = 100(MAC-Based)
# Verify QoS:
#   Ingress 802.1p Examination: Enabled
#   Egress IPTOS Replacement: Enabled
# Verify rate limit:
#   Broadcast Rate: 500 packets-per-second
```

### Troubleshooting

#### No Match Occurring

1. **Check MAC Learning VLAN**:
   ```bash
   show instant-port
   # Verify "Learning VLAN" is correct
   ```

2. **Check port assignment**:
   ```bash
   show instant-port ports <port>
   ```

3. **Verify FDB MAC tracking**:
   ```bash
   show fdb | include <mac_address>
   ```

4. **Check LLDP neighbors** (for LLDP-based matching):
   ```bash
   show lldp neighbors ports <port>
   ```

#### Actions Not Applied

1. **Verify match occurred**:
   ```bash
   show instant-port profile <profile> device-type <device_type>
   # Check "Number of matches" counter
   ```

2. **Check port configuration**:
   ```bash
   show ports <port> information detail
   show vlan
   ```

3. **Review system logs**:
   ```bash
   show log messages | include instant-port
   show log messages | include UPM
   ```

#### Known Issue: RATE_LIMIT_BROADCAST Not Applied (EXOS-39560)

**Bug**: In EXOS 33.7.0.96, `RATE_LIMIT_BROADCAST` action is accepted but NOT applied to ports.

**Symptom**:
```bash
show ports 3:10 information detail
#   Broadcast Rate: No-limit  ← Should be "10 packets-per-second"
```

**Verification**:
```bash
# Check if other actions work:
show ports 3:10 information detail | include "802.1p Examination"
#   Ingress 802.1p Examination: Enabled  ← Works

show ports 3:10 information detail | include "IPTOS Replacement"
#   Egress IPTOS Replacement: Enabled on QP1 QP8  ← Works

show ports 3:10 information detail | include "Broadcast Rate"
#   Broadcast Rate: No-limit  ← BUG: Should show rate limit
```

**Workaround**:
```bash
# Manually configure broadcast rate limiting
configure ports 3:10 rate-limit flood broadcast 10

# Verify:
show ports 3:10 information detail | include "Broadcast Rate"
#   Broadcast Rate: 10 packets-per-second  ← Works when configured manually
```

**Affected Versions**: 33.7.0.96  
**Working Versions**: 33.6.0.455  
**Status**: Defect closed (fix expected in future release)

---

## 10. REFERENCES

- **Functional Specification**: Instant Port Functional Specification and Design Document
- **Related Features**:
  - Universal Port Manager (UPM)
  - MAC-based VLAN
  - 802.1X / NetLogin
  - LLDP
  - QoS
- **CLI Reference**: EXOS User Guide - Instant Port Configuration
- **REST API**: OpenAPI Specification `/rest/openapi/v0/configuration/instant-port/`
- **JIRA**: 
  - EXOS-39560: IPP RATE_LIMIT_BROADCAST action accepted but not applied (regression)

---

## APPENDIX: EXOS-39560 - RATE_LIMIT_BROADCAST Regression Details

### Bug Summary
**JIRA**: EXOS-39560  
**Priority**: P2 - High  
**Status**: Closed  
**Type**: Regression Defect

### Issue Description
Instant Port Profile containing `RATE_LIMIT_BROADCAST` action with `rateLimit: 10` is accepted successfully and the profile match occurs, but the broadcast rate setting is **not applied** to the runtime port state. The `show ports <port> information detail` command continues to show `Broadcast Rate: No-limit` instead of the configured value.

Other actions in the same IPP profile (LLDP, CDP, QoS, VLAN) are applied successfully, indicating the issue is specific to the RATE_LIMIT_BROADCAST action.

### Reproducibility
- **100% reproducible** across all testbeds
- Affects all port types (physical ports and LAG interfaces)
- Occurs on all tested platforms (5520-24T-ACDC, 5520-24X-ACDC stacks)

### Test Evidence

**IPP Profile**:
```json
{
  "actionType": "RATE_LIMIT_BROADCAST",
  "rateLimit": 10
}
```

**Expected Output**:
```
Broadcast Rate: 10 packets-per-second
```

**Actual Output** (Bug):
```
Broadcast Rate: No-limit
```

**Test Error**:
```
Error:!!!!! Chk key <Broadcast Rate.*10 packets-per-second> fail. 
Wanted <exist> BUTGOT <keyNotFound>
```

### Affected Versions
- **Failing**: 33.7.0.96
- **Working**: 33.6.0.455

### Test Logs
- **Pass logs**: http://10.69.20.102/Functionaltest/InstantPortProfile_CDP_LLDP/Report/2026-06-14...33.6.0.455.../report.txt
- **Fail logs**: http://10.69.20.102/Functionaltest/InstantPortProfile_CDP_LLDP/Report/2026-06-14...33.7.0.96.../report.txt

### Workaround
```bash
# Manually configure broadcast rate limiting
configure ports <port> rate-limit flood broadcast <pps>

# Example:
configure ports 3:10 rate-limit flood broadcast 10
```

### Root Cause (Suspected)
The IPP daemon successfully accepts the RATE_LIMIT_BROADCAST action and triggers profile matching correctly. Other actions (LLDP, CDP, QoS, VLAN) are dispatched and applied successfully. However, the rate limit action appears to fail during the action dispatch or port configuration phase, preventing the broadcast rate limit from being applied to the port hardware/runtime state.

This is a regression introduced between 33.6.0.455 (working) and 33.7.0.96 (broken), suggesting a code change in the IPP action dispatcher or port rate limiting module.
