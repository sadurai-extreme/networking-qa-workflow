

# Fabric Attach Zero-Touch Client NetLogin Bypass Enhancement
## EXOS-39369 Feature Documentation

---

## 1. FEATURE OVERVIEW

### 1.1 Introduction
The Fabric Attach Zero-Touch Client NetLogin Bypass enhancement introduces a new configuration option that allows Fabric Attach (FA) devices to bypass NetLogin authentication when attaching to the network. This feature provides flexibility in network access control for FA-enabled devices while maintaining security boundaries for traditional network access.

### 1.2 Purpose and Scope
**Primary Purpose**: Enable Fabric Attach devices of specific client types to attach directly to the network without requiring NetLogin MAC-based authentication, streamlining device onboarding while preserving authentication requirements for non-FA devices.

**Use Cases**:
- Rapid deployment of trusted FA infrastructure devices (switches, IP phones)
- Zero-touch provisioning in environments with both FA and NetLogin enabled
- Simplified management of FA device VLAN assignments without authentication dependencies
- Support for hybrid authentication models (FA bypass + traditional NetLogin for other devices)

### 1.3 Platform Support
- **EXOS Version**: 33.7 and later
- **Platforms**: All EXOS platforms supporting Fabric Attach
- **Mode**: Fabric Attach Proxy mode

---

## 2. FUNCTIONAL DESCRIPTION

### 2.1 Core Behavior

#### Default Behavior (bypass-netlogin OFF)
When NetLogin is enabled on a port and the `bypass-netlogin` option is set to `off` (default):
1. FA device is discovered via LLDP
2. Device **must** authenticate via NetLogin (MAC-based authentication)
3. Upon successful authentication, device is attached as FA element
4. VLAN/NSI assignment from zero-touch-client configuration applied
5. Authentication failure prevents FA attachment

#### Bypass Behavior (bypass-netlogin ON)
When NetLogin is enabled on a port and the `bypass-netlogin` option is set to `on`:
1. FA device is discovered via LLDP
2. Device **bypasses** NetLogin authentication entirely
3. Device is immediately attached as FA element
4. VLAN/NSI assignment from zero-touch-client configuration applied directly
5. No authentication required regardless of NetLogin port state

#### NetLogin Disabled Scenario
When NetLogin is disabled on a port:
- `bypass-netlogin` setting is stored in configuration but has no operational effect
- Show commands display "N/A" for Netlogin Bypass status
- FA devices attach normally following standard FA discovery process
- NetLogin subsystem still maintains list of bypass clients for reference

### 2.2 Authentication Flow Decision Matrix

| NetLogin State | bypass-netlogin | FA Device Behavior |
|----------------|-----------------|-------------------|
| Enabled        | off (default)   | Requires authentication before FA attachment |
| Enabled        | on              | Bypasses authentication, immediate FA attachment |
| Disabled       | off or on       | Normal FA attachment (bypass setting has no effect) |

### 2.3 LLDP and NetLogin Subsystem Integration

**LLDP Role**:
- Discovers FA devices and client types
- Communicates bypass-enabled clients to NetLogin subsystem
- Maintains FA element database with bypass status

**NetLogin Subsystem**:
- Receives bypass client list from LLDP
- Maintains bypass client database even when NetLogin is globally disabled
- Exempts bypass clients from authentication flow
- Tracks bypass clients by MAC address, port, and VLAN

**Communication Flow**:
```
FA Device → LLDP Discovery → Bypass Check → NetLogin Subsystem → VLAN Assignment
```

### 2.4 VLAN Assignment Coordination

The bypass mechanism affects only **authentication**, not VLAN assignment logic:

1. **VLAN Source**: VLAN/NSI configured in `configure fabric attach zero-touch-client <client>` command
2. **Assignment Trigger**: LLDP discovery (authentication state does not affect assignment when bypass is enabled)
3. **Port VLAN**: FA-assigned VLAN takes precedence over port default VLAN for bypass clients
4. **Management VLAN**: Auto-provision settings still apply (None, Mix modes)

**Key Point**: Bypass eliminates authentication as a gating factor but preserves all FA VLAN assignment semantics.

---

## 3. CLI COMMANDS

### 3.1 Configuration Commands

#### Enable NetLogin Bypass for FA Client Type
```
configure fabric attach zero-touch-client <client> bypass-netlogin on
```

**Parameters**:
- `<client>`: FA client type (e.g., `switch`, `server`, `ip-phone`, `camera`, etc.)

**Behavior**: All FA devices of the specified client type will bypass NetLogin authentication

**Default**: `off` (authentication required)

**Example**:
```bash
# Enable bypass for switches
configure fabric attach zero-touch-client switch bypass-netlogin on

# Enable bypass for IP phones
configure fabric attach zero-touch-client ip-phone bypass-netlogin on
```

#### Disable NetLogin Bypass (Restore Default)
```
configure fabric attach zero-touch-client <client> bypass-netlogin off
```

**Example**:
```bash
# Restore authentication requirement for switches
configure fabric attach zero-touch-client switch bypass-netlogin off
```

#### Complete Zero-Touch Client Configuration with Bypass
```
configure fabric attach zero-touch-client <client> i-sid <i-sid> vlan <vlan-name> bypass-netlogin [on|off]
```

**Example**:
```bash
# Configure switch client type with bypass enabled
configure fabric attach zero-touch-client switch i-sid 1000 vlan vlan1000 bypass-netlogin on
```

### 3.2 Show Commands

#### Display FA Elements with NetLogin Bypass Status
```
show fabric attach elements
```

**Output Format**:
```
Fabric Attach Mode: Proxy
                                                       Mgmt     Auto           Netlogin
System Id                     Port    Type             VLAN Tag Provision      Bypass
----------------------------- ------- ---------------- ---- --- -------------- --------
f4-ce-48-02-58-00-00-01-00-09 7       Switch           None Mix Disabled       Yes
00-04-96-ec-78-00-00-01-00-1a 26      Server (No Auth) None Mix Disabled       N/A
f4-ce-48-02-58-00-00-01-00-19 27      Switch           None Mix Disabled       Yes
```

**Netlogin Bypass Column Values**:
- **Yes**: Client type has bypass-netlogin enabled and NetLogin is active on port
- **No**: Client type requires authentication (bypass-netlogin off)
- **N/A**: NetLogin disabled on port OR client type is "No Auth" (e.g., Server with no authentication)

#### Display NetLogin Bypass Clients
```
show netlogin
```

**New Section in Output** (when NetLogin is enabled):
```
------------------------------------------------
        Netlogin Bypass Clients
------------------------------------------------
MAC                Port      VLAN
00:04:96:ec:78:00  26        1000
f4:ce:48:02:58:00  7         1000
------------------------------------------------
```

**When NetLogin is Disabled** (bypass clients still displayed):
```
------------------------------------------------
        Netlogin Bypass Clients
------------------------------------------------
MAC                Port      VLAN
00:04:96:ec:78:00  26        1000
```

**Interpretation**:
- Lists all FA devices currently bypassing NetLogin authentication
- Shows MAC address, port, and assigned VLAN for each bypass client
- Maintained by NetLogin subsystem even when NetLogin is globally disabled
- Updated dynamically as FA devices attach/detach

---

## 4. CONFIGURATION EXAMPLES

### 4.1 Example 1: Enable Bypass for Trusted Switch Infrastructure

**Scenario**: Allow FA-enabled switches to attach without authentication while maintaining NetLogin for all other devices.

**Configuration**:
```bash
# Configure NetLogin with MAC-based authentication
enable netlogin mac
configure netlogin vlan nlvlan

# Configure FA zero-touch for switches with bypass
configure fabric attach zero-touch-client switch i-sid 1000 vlan mgmt-vlan bypass-netlogin on

# Apply NetLogin to access ports
configure netlogin port 1-48 mode mac
enable netlogin port 1-48
```

**Result**:
- FA switches on ports 1-48 attach immediately without authentication
- Non-FA devices on the same ports require MAC-based NetLogin authentication
- FA switches assigned to `mgmt-vlan` with I-SID 1000

### 4.2 Example 2: Selective Bypass for IP Phones

**Scenario**: IP phones bypass authentication, servers require authentication.

**Configuration**:
```bash
# Enable NetLogin
enable netlogin mac

# FA configuration with selective bypass
configure fabric attach zero-touch-client ip-phone i-sid 2000 vlan voice-vlan bypass-netlogin on
configure fabric attach zero-touch-client server i-sid 3000 vlan server-vlan bypass-netlogin off

# Enable NetLogin on ports
configure netlogin port 10-20 mode mac
enable netlogin port 10-20
```

**Result**:
- IP phones: Immediate FA attachment to voice-vlan
- Servers: Authentication required before FA attachment to server-vlan
- `show fabric attach elements` displays "Yes" for ip-phone, "No" for server

### 4.3 Example 3: Transition from Authenticated to Bypass Mode

**Scenario**: Migrate existing FA deployment from authentication-required to bypass mode.

**Before** (authentication required):
```bash
configure fabric attach zero-touch-client switch i-sid 1000 vlan mgmt-vlan bypass-netlogin off
```

**After** (bypass enabled):
```bash
configure fabric attach zero-touch-client switch i-sid 1000 vlan mgmt-vlan bypass-netlogin on
```

**Impact**:
- Existing authenticated switches: Remain connected (no disruption)
- New switches: Bypass authentication immediately
- No service interruption during configuration change

### 4.4 Example 4: Mixed Environment with Multiple Client Types

**Configuration**:
```bash
# Bypass for infrastructure
configure fabric attach zero-touch-client switch i-sid 1000 vlan infra-vlan bypass-netlogin on
configure fabric attach zero-touch-client ip-phone i-sid 2000 vlan voice-vlan bypass-netlogin on

# Authentication required for endpoints
configure fabric attach zero-touch-client camera i-sid 3000 vlan camera-vlan bypass-netlogin off
configure fabric attach zero-touch-client server i-sid 4000 vlan server-vlan bypass-netlogin off

# NetLogin configuration
enable netlogin mac
configure netlogin port 1-48 mode mac
enable netlogin port 1-48
```

**Result**:
| Client Type | Bypass Status | Behavior |
|-------------|---------------|----------|
| Switch      | Yes           | Immediate attachment to infra-vlan |
| IP Phone    | Yes           | Immediate attachment to voice-vlan |
| Camera      | No            | Authentication required for camera-vlan |
| Server      | No            | Authentication required for server-vlan |

---

## 5. SHOW COMMAND OUTPUT INTERPRETATION

### 5.1 Analyzing `show fabric attach elements`

**Key Columns**:
- **Type**: FA client type (switch, server, ip-phone, etc.)
- **Netlogin Bypass**: Indicates bypass status
  - Monitor for "Yes" entries to identify devices bypassing authentication
  - "N/A" entries indicate NetLogin disabled or no-auth client types

**Troubleshooting Use**:
```bash
# Verify bypass configuration is applied
show fabric attach elements | include "Bypass"

# Check for unexpected bypass clients
show fabric attach elements | include "Yes"
```

### 5.2 Analyzing `show netlogin`

**Netlogin Bypass Clients Section**:
- Lists all active bypass clients
- Correlate MAC addresses with `show fabric attach elements`
- Verify VLAN assignments match FA zero-touch configuration

**Troubleshooting Use**:
```bash
# Verify bypass client is registered with NetLogin
show netlogin | include "Bypass Clients" -A 10

# Check if bypass client appears in both FA and NetLogin contexts
show fabric attach elements | include <MAC>
show netlogin | include <MAC>
```

### 5.3 Correlation Example

**FA Element View**:
```
System Id                     Port    Type     Mgmt     Auto        Netlogin
                                               VLAN Tag Provision   Bypass
f4-ce-48-02-58-00-00-01-00-09 7       Switch   None Mix Disabled    Yes
```

**NetLogin View**:
```
        Netlogin Bypass Clients
MAC                Port      VLAN
f4:ce:48:02:58:00  7         1000
```

**Interpretation**: Device `f4-ce-48-02-58-00-00-01-00-09` on port 7 is an FA switch that bypassed NetLogin authentication and is assigned to VLAN 1000.

---

## 6. FEATURE INTERACTIONS

### 6.1 Fabric Attach (FA) Integration

**Discovery Process**:
1. LLDP TLVs exchanged between FA client and proxy
2. Client type identified from LLDP information
3. Zero-touch-client configuration lookup (I-SID, VLAN, bypass-netlogin)
4. If bypass-netlogin=on: Skip to step 7
5. If bypass-netlogin=off: Trigger NetLogin authentication
6. Await authentication result (success/failure)
7. Apply VLAN/NSI assignment
8. FA element attached

**Impact on FA Functions**:
- LLDP operation: Unchanged
- I-SID assignment: Unchanged
- VLAN assignment: Unchanged
- Auto-provisioning: Unchanged
- Management VLAN tag: Unchanged

**Bypass ONLY affects**: Authentication gating before VLAN assignment

### 6.2 NetLogin Integration

**Authentication Flow Modification**:

**Standard NetLogin Flow** (bypass-netlogin=off):
```
Device Connect → NetLogin Auth Request → RADIUS/Local DB Lookup → 
Auth Success/Failure → VLAN Assignment (if success)
```

**Bypass Flow** (bypass-netlogin=on):
```
Device Connect → Bypass Check → VLAN Assignment (no authentication)
```

**NetLogin Subsystem Responsibilities**:
- Maintain bypass client database (MAC, Port, VLAN)
- Exempt bypass clients from authentication state machine
- Display bypass clients in `show netlogin` output
- Preserve bypass client list even when NetLogin globally disabled

**Coexistence**:
- NetLogin can be enabled globally while specific FA client types bypass
- Non-FA devices on same ports still require NetLogin authentication
- Bypass clients and authenticated clients can coexist on same switch

### 6.3 LLDP Integration

**LLDP's Role in Bypass Mechanism**:
1. **Discovery**: Identify FA device and client type via LLDP TLVs
2. **Communication**: Inform NetLogin subsystem of bypass clients
3. **State Sync**: Update bypass client list on attach/detach events

**Critical Dependency**: LLDP must be enabled on ports for FA and bypass to function

**Verification**:
```bash
# Verify LLDP enabled on FA ports
show lldp port

# Check LLDP neighbors (FA devices)
show lldp neighbors
```

### 6.4 VLAN Assignment and Port Configuration

**VLAN Assignment Priority** (when bypass enabled):
1. FA zero-touch-client VLAN configuration (highest priority)
2. Port default VLAN (ignored for bypass clients)
3. NetLogin dynamic VLAN assignment (bypassed)

**Port Configuration Considerations**:
- Port can be tagged or untagged for FA-assigned VLAN
- Port tagging mode (none, tagged, all) affects FA VLAN assignment
- Management VLAN tag setting in zero-touch-client config applies

**Example**:
```bash
# Port in default VLAN 1
configure vlan default add ports 10 untagged

# FA zero-touch assigns VLAN 1000
configure fabric attach zero-touch-client switch vlan vlan1000 bypass-netlogin on

# Result: Device on port 10 moved from VLAN 1 to VLAN 1000 upon FA attachment
```

### 6.5 Client Type Support Matrix

| Client Type       | bypass-netlogin Support | Default | Notes |
|-------------------|------------------------|---------|-------|
| Switch            | Yes                    | off     | Common use case for bypass |
| Server            | Yes                    | off     | Can be set to on/off |
| Server (No Auth)  | N/A                    | N/A     | Always bypasses (legacy) |
| IP Phone          | Yes                    | off     | Common use case for bypass |
| Camera            | Yes                    | off     | Typically requires auth |
| Generic           | Yes                    | off     | Applies to custom client types |

**"No Auth" Special Case**:
- Legacy server client type that never requires authentication
- Shows "N/A" in Netlogin Bypass column
- `bypass-netlogin` setting has no effect on this client type

---

## 7. OPERATIONAL CHARACTERISTICS

### 7.1 Performance and Scalability

**Bypass Client Limits**:
- No specific limit on number of bypass clients beyond platform FA element limits
- Bypass client database maintained in NetLogin subsystem memory
- Minimal performance impact (bypass check is simple lookup operation)

**Attachment Time**:
- **With Authentication** (bypass=off): 1-5 seconds (depends on RADIUS response time)
- **With Bypass** (bypass=on): < 1 second (immediate after LLDP discovery)

**LLDP Discovery Time**:
- Standard LLDP advertisement interval: 30 seconds (default)
- Fast LLDP mode can reduce discovery time to < 5 seconds
- Bypass does not affect LLDP discovery timing

### 7.2 High Availability and Redundancy

**Failover Behavior**:
- Bypass configuration synchronized across HA pair members
- Bypass client database rebuilt after failover (from LLDP re-discovery)
- No authentication delay during failover for bypass clients

**Configuration Sync**:
- Zero-touch-client bypass settings replicated in HA configurations
- NetLogin bypass client list is runtime state (not synchronized)
- Post-failover: LLDP re-establishes bypass client list

### 7.3 State Management

**Bypass Client Lifecycle**:
1. **Attach**: Device discovered, bypass check, added to bypass client list
2. **Active**: Device operates with FA VLAN assignment
3. **Detach**: LLDP session lost, removed from bypass client list
4. **Reattach**: Re-discovery, bypass check, re-added to list

**Persistence**:
- Configuration (bypass-netlogin on/off): Saved in configuration, survives reboot
- Runtime state (bypass client list): Rebuilt after reboot via LLDP re-discovery

---

## 8. TROUBLESHOOTING AND DEBUGGING

### 8.1 Common Issues and Resolution

#### Issue 1: FA Device Not Bypassing Authentication

**Symptoms**:
- Device appears in `show fabric attach elements` with "Netlogin Bypass = No"
- Device requires authentication despite bypass-netlogin on configuration

**Diagnosis**:
```bash
# Verify bypass configuration
show configuration | include "zero-touch-client"

# Check if NetLogin is enabled on port
show netlogin ports <port>

# Verify client type matches configuration
show fabric attach elements | include <port>
```

**Possible Causes**:
1. `bypass-netlogin` not set to `on` for that client type
2. Client type mismatch (e.g., configured for "switch" but device advertises as "server")
3. NetLogin disabled on port (bypass has no effect, shows N/A)

**Resolution**:
```bash
# Enable bypass for correct client type
configure fabric attach zero-touch-client <correct-type> bypass-netlogin on

# Verify configuration applied
show fabric attach elements
```

#### Issue 2: Bypass Client Not in NetLogin Bypass List

**Symptoms**:
- `show fabric attach elements` shows "Bypass = Yes"
- `show netlogin` does not list device in "Netlogin Bypass Clients"

**Diagnosis**:
```bash
# Check if NetLogin is enabled globally
show netlogin

# Verify LLDP session exists
show lldp port <port> neighbors

# Check FA element state
show fabric attach elements | include <MAC>
```

**Possible Causes**:
1. NetLogin disabled globally (bypass list not populated)
2. LLDP communication issue (client not properly discovered)
3. Timing issue (client recently attached, bypass list not yet updated)

**Resolution**:
```bash
# Enable NetLogin if disabled
enable netlogin mac

# Verify LLDP enabled on port
enable lldp port <port>

# Wait for LLDP refresh (30s default) or bounce LLDP
disable lldp port <port>
enable lldp port <port>
```

#### Issue 3: "N/A" Status When Bypass Expected

**Symptoms**:
- `bypass-netlogin on` configured
- `show fabric attach elements` shows "Netlogin Bypass = N/A"

**Diagnosis**:
```bash
# Check NetLogin status on port
show netlogin ports <port>

# Verify client type
show fabric attach elements | include <port>
```

**Possible Causes**:
1. NetLogin disabled on port → Bypass has no effect
2. Client type is "Server (No Auth)" → Always shows N/A

**Resolution**:
- If NetLogin should be enabled: `enable netlogin port <port>`
- If client type is "No Auth": This is expected behavior

### 8.2 Debug Commands

#### Enable FA Debug Logging
```bash
enable log debug-mode
configure log target memory-buffer severity debug-data
debug lldp tlv all
debug fabric attach all
```

#### Monitor LLDP Neighbor Activity
```bash
show lldp port <port> neighbors detail
show lldp port <port> config
```

#### Verify Zero-Touch Configuration
```bash
show configuration fabric attach
show fabric attach zero-touch-client
```

#### Track NetLogin Events
```bash
show log | include netlogin
show log | include "bypass"
```

### 8.3 Verification Checklist

- [ ] **LLDP Enabled**: `show lldp` confirms LLDP globally enabled and on specific ports
- [ ] **FA Mode**: `show fabric attach` shows Proxy mode enabled
- [ ] **Zero-Touch Config**: `show fabric attach zero-touch-client` displays bypass-netlogin on
- [ ] **NetLogin State**: `show netlogin` confirms NetLogin enabled (or disabled, if N/A expected)
- [ ] **Element Attachment**: `show fabric attach elements` shows device attached with correct bypass status
- [ ] **Bypass Client List**: `show netlogin` displays device in "Netlogin Bypass Clients" section (if NetLogin enabled)
- [ ] **VLAN Assignment**: `show vlan` confirms device in correct FA-assigned VLAN

---

## 9. BEST PRACTICES AND RECOMMENDATIONS

### 9.1 Security Considerations

**Use Bypass Sparingly**:
- Only enable bypass for **trusted** device types (infrastructure switches, managed IP phones)
- Maintain authentication for user-facing devices (cameras, generic servers, endpoints)
- Regularly review bypass client list for unauthorized devices

**Segmentation**:
```bash
# Good practice: Separate bypass and non-bypass client types into different VLANs
configure fabric attach zero-touch-client switch vlan infrastructure bypass-netlogin on
configure fabric attach zero-touch-client camera vlan iot bypass-netlogin off
```

**Port Security**:
- Consider enabling port security on FA ports to limit MAC addresses
- Use FA in combination with other security features (ACLs, dynamic FDB)
- Monitor `show fabric attach elements` for unexpected bypass clients

### 9.2 Configuration Management

**Consistency Across Client Types**:
- Document which client types have bypass enabled
- Maintain consistent bypass settings across similar deployment sites
- Use configuration templates for standardized deployment

**Change Control**:
```bash
# Before enabling bypass on production network, test in lab
# Document bypass decision and approval

# Example: Controlled bypass enablement
configure fabric attach zero-touch-client switch bypass-netlogin on
save configuration
```

**Audit and Compliance**:
- Periodically review `show fabric attach elements` output
- Correlate bypass clients with asset inventory
- Ensure bypass usage aligns with security policy

### 9.3 Deployment Recommendations

**Phased Rollout**:
1. **Lab Testing**: Verify bypass behavior with all client types
2. **Pilot Deployment**: Enable bypass on limited port range
3. **Monitor**: Watch `show fabric attach elements` and `show netlogin` for anomalies
4. **Full Deployment**: Roll out to all FA proxy switches

**Mixed Environment Strategy**:
- Use bypass for infrastructure (switches, phones)
- Require authentication for endpoints (cameras, servers)
- Clearly document which client types bypass and rationale

**Example**:
```bash
# Infrastructure: Bypass enabled
configure fabric attach zero-touch-client switch bypass-netlogin on
configure fabric attach zero-touch-client ip-phone bypass-netlogin on

# Endpoints: Authentication required
configure fabric attach zero-touch-client camera bypass-netlogin off
configure fabric attach zero-touch-client server bypass-netlogin off
```

### 9.4 Monitoring and Maintenance

**Regular Checks**:
```bash
# Weekly: Review bypass client list
show netlogin | include "Bypass Clients" -A 20

# Monthly: Audit FA element bypass status
show fabric attach elements > fa-audit-$(date +%Y%m%d).txt
```

**Alerting**:
- Configure SNMP traps or syslog for FA element attach/detach events
- Alert on unexpected bypass clients (MAC addresses not in asset database)

**Documentation**:
- Maintain list of authorized bypass client MAC addresses
- Document bypass policy and exceptions
- Keep change log for bypass configuration modifications

---

## 10. MIGRATION AND UPGRADE NOTES

### 10.1 Upgrading to EXOS 33.7+ from Earlier Versions

**Pre-Upgrade**:
- FA devices authenticate via NetLogin (if enabled)
- No `bypass-netlogin` option available

**Post-Upgrade**:
- Default behavior unchanged (`bypass-netlogin` defaults to `off`)
- Existing FA devices continue to require authentication
- No configuration changes required for existing deployments

**Opt-In to Bypass**:
```bash
# After upgrade to EXOS 33.7+
configure fabric attach zero-touch-client <client> bypass-netlogin on
```

### 10.2 Downgrade Considerations

**Downgrading from EXOS 33.7+ to Earlier Version**:
- `bypass-netlogin` configuration will be ignored (option not recognized)
- FA devices will revert to authentication-required behavior
- No data loss, but bypass functionality unavailable

**Recommendation**: Remove `bypass-netlogin on` configuration before downgrade to avoid warnings

### 10.3 Configuration Migration

**From Legacy "Server (No Auth)" to bypass-netlogin**:

**Legacy**:
```bash
configure fabric attach zero-touch-client server-no-auth i-sid 3000 vlan server-vlan
```

**Modern (EXOS 33.7+)**:
```bash
configure fabric attach zero-touch-client server i-sid 3000 vlan server-vlan bypass-netlogin on
```

**Note**: "Server (No Auth)" client type still supported for backward compatibility

---

## 11. RELATED FEATURES AND COMMANDS

### 11.1 Fabric Attach Commands
- `configure fabric attach mode proxy`
- `configure fabric attach zero-touch-client <client> i-sid <i-sid> vlan <vlan>`
- `show fabric attach`
- `show fabric attach elements`
- `show fabric attach stats`

### 11.2 NetLogin Commands
- `enable netlogin mac`
- `configure netlogin port <port> mode mac`
- `show netlogin`
- `show netlogin port <port>`
- `show netlogin mac-list`

### 11.3 LLDP Commands
- `enable lldp`
- `enable lldp port <port>`
- `show lldp neighbors`
- `show lldp port <port> neighbors detail`

### 11.4 VLAN Commands
- `create vlan <vlan-name> tag <tag>`
- `configure vlan <vlan-name> add ports <port> {tagged|untagged}`
- `show vlan <vlan-name>`

---

## 12. APPENDICES

### Appendix A: Quick Reference Card

**Enable Bypass**:
```bash
configure fabric attach zero-touch-client <client> bypass-netlogin on
```

**Verify Bypass Status**:
```bash
show fabric attach elements | include "Bypass"
show netlogin | include "Bypass Clients" -A 10
```

**Disable Bypass**:
```bash
configure fabric attach zero-touch-client <client> bypass-netlogin off
```

### Appendix B: Glossary

| Term | Definition |
|------|------------|
| FA | Fabric Attach - LLDP-based auto-configuration and provisioning |
| NetLogin | Network Login - EXOS authentication feature (MAC, 802.1X, web-based) |
| Proxy Mode | FA mode where switch acts as proxy for FA clients |
| I-SID | Service Instance Identifier - SPBM identifier for L2 services |
| Zero-Touch Client | Pre-configured FA client type with VLAN/I-SID assignment |
| Bypass Client | FA device that skips NetLogin authentication via bypass-netlogin option |

### Appendix C: Feature Matrix by EXOS Version

| Feature | EXOS < 33.7 | EXOS 33.7+ |
|---------|-------------|------------|
| FA Zero-Touch | ✓ | ✓ |
| NetLogin Integration | ✓ (auth required) | ✓ (auth required or bypass) |
| bypass-netlogin Option | ✗ | ✓ |
| Netlogin Bypass Column in show commands | ✗ | ✓ |
| Netlogin Bypass Clients Section | ✗ | ✓ |

---

## 13. SUMMARY

The Fabric Attach Zero-Touch Client NetLogin Bypass enhancement provides a powerful, flexible mechanism for controlling network access for FA-enabled devices. By decoupling FA attachment from NetLogin authentication for specific client types, administrators can:

- Streamline deployment of trusted infrastructure devices
- Maintain security boundaries for endpoints
- Support hybrid authentication models
- Reduce onboarding complexity in FA+NetLogin environments

**Key Takeaways**:
1. **Granular Control**: Bypass configured per client type (switch, ip-phone, camera, etc.)
2. **Default Secure**: bypass-netlogin defaults to `off` (authentication required)
3. **Operational Visibility**: New show command outputs clearly indicate bypass status
4. **Seamless Integration**: Works with existing FA, NetLogin, and LLDP subsystems
5. **Backward Compatible**: No impact on existing deployments until explicitly enabled

For additional information, refer to EXOS User Guide (Fabric Attach and NetLogin chapters) and EXOS Release Notes for version 33.7+.

---

**Document Version**: 1.0  
**Generated**: 2026-07-21  
**JIRA Reference**: EXOS-39369  
**Supported Platforms**: All EXOS platforms  
**Minimum EXOS Version**: 33.7
