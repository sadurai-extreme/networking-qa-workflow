# Test Plan: EXOS-39334
## Fabric Attach - Auto Creation of Fallback Mgmt VLAN in Proxy

---

## 📋 Test Plan Information

| Field | Value |
|-------|-------|
| **Jira Ticket** | [EXOS-39334](https://extremenetworks.atlassian.net/browse/EXOS-39334) |
| **Feature** | Fabric Attach - Auto creation of fallback management VLAN in proxy |
| **Priority** | P2 - High |
| **Status** | Done |
| **Test Plan Version** | 1.0 |
| **Created Date** | 2026-07-06 |
| **Test Engineer** | QA Team |

---

## 🎯 Test Objectives

The purpose of this test plan is to validate the enhanced Fabric Attach (FA) proxy behavior for automatic fallback management VLAN creation, specifically when integrated with Zero Touch Provisioning (ZTP). The feature ensures that fallback management VLANs are created intelligently based on ZTP state and FA server responses.

### Key Objectives:
1. Verify fallback management VLAN is created **only when ZTP is running**
2. Validate client port addition to mgmt VLAN based on NSI approval
3. Confirm retry behavior when FA server rejects NSI during ZTP
4. Ensure mgmt VLAN is NOT forwarded to clients if server rejects NSI
5. Verify proper VLAN persistence and advertisement upon NSI acceptance
6. Test VLAN cleanup on reboot or when server sends alternate VLAN

---

## 📖 Feature Summary

### Background
Previous implementation (EXOS-38257) added fallback management VLAN support in FA proxy, which caused issues for customers using different management VLANs for FA clients.

### New Behavior
- **Fallback VLAN Creation**: Only occurs when ZTP is active and FA server doesn't send management VLAN
- **NSI-Based Port Management**: Client ports added to mgmt VLAN only upon server NSI approval
- **Retry Mechanism**: Continues NSI requests during ZTP if server rejects
- **Conditional Forwarding**: Mgmt VLAN forwarded to clients only after NSI acceptance
- **Persistence**: VLAN persists until reboot or server provides alternate VLAN

---

## 🔧 Test Environment

### Hardware Requirements
- **FA Proxy Switch**: EXOS switch acting as FA proxy (minimum 4 ports)
- **FA Server Switch**: EXOS switch acting as FA server
- **FA Client Device**: Network device with FA client capability
- **Management Station**: PC/Server for configuration and monitoring

### Software Requirements
- **EXOS Version**: Latest build with EXOS-39334 implementation
- **ZTP**: Enabled and functional
- **Fabric Attach**: Licensed and configured

### Network Topology
```
[FA Server] ---- [FA Proxy] ---- [FA Client]
                     |
                 [Mgmt Station]
```

### Port Assignments
- **Proxy Port 1-2**: Uplink to FA Server
- **Proxy Port 3-4**: Downlink to FA Client devices
- **Management Port**: Out-of-band management

---

## 📚 Prerequisites

### Configuration Prerequisites
1. FA Server configured with FA enabled
2. FA Proxy configured with FA proxy mode
3. ZTP package installed on proxy switch
4. Management VLAN configured on FA server (for some test scenarios)
5. Network connectivity between all devices
6. Console/SSH access to all switches

### Test Data Requirements
- **Management VLAN IDs**: 10, 20, 100 (for various test scenarios)
- **NSI Values**: Test with valid NSI identifiers
- **Client Port List**: Ports 3-4 on proxy switch
- **Server ISID Range**: Configured on FA server

---

## 🧪 Test Cases

### **Test Case 1: Fallback VLAN Creation During ZTP**
**ID**: TC-FA-001  
**Priority**: P0 - Critical  
**Category**: Functional - Positive

#### Objective
Verify that fallback management VLAN is automatically created when ZTP is running and FA server doesn't send management VLAN.

#### Prerequisites
- ZTP is active on proxy switch
- FA server is NOT configured to send management VLAN
- No existing management VLAN on proxy

#### Test Steps
1. Configure FA proxy on switch with ZTP active
2. Connect proxy to FA server (without mgmt VLAN configured on server)
3. Bring up FA adjacency between proxy and server
4. Monitor VLAN creation on proxy switch
5. Verify fallback management VLAN is created

#### Expected Results
- ✅ Fallback management VLAN is automatically created on proxy
- ✅ VLAN is created only after ZTP detects need
- ✅ VLAN follows default naming convention
- ✅ VLAN is in active state

#### CLI Commands
```bash
# On Proxy
show ztp status
show fabric attach
show vlan
show log messages | include "fallback"
```

---

### **Test Case 2: No Fallback VLAN When ZTP Inactive**
**ID**: TC-FA-002  
**Priority**: P0 - Critical  
**Category**: Functional - Negative

#### Objective
Verify that fallback management VLAN is NOT created when ZTP is not running, even if FA server doesn't send management VLAN.

#### Prerequisites
- ZTP is disabled or inactive on proxy switch
- FA server is NOT configured to send management VLAN
- No existing management VLAN on proxy

#### Test Steps
1. Disable ZTP on proxy switch
2. Configure FA proxy on switch
3. Connect proxy to FA server
4. Bring up FA adjacency
5. Monitor VLAN creation on proxy switch
6. Verify NO fallback management VLAN is created

#### Expected Results
- ✅ No automatic VLAN creation occurs
- ✅ FA adjacency establishes normally
- ✅ No error messages related to missing mgmt VLAN
- ✅ Switch operates without fallback VLAN

#### CLI Commands
```bash
# On Proxy
disable ztp
show ztp status
show fabric attach
show vlan
```

---

### **Test Case 3: NSI Acceptance - Client Port Addition**
**ID**: TC-FA-003  
**Priority**: P0 - Critical  
**Category**: Functional - Positive

#### Objective
Verify that client ports are added to management VLAN and VLAN is advertised to clients when FA server approves NSI.

#### Prerequisites
- ZTP is active on proxy
- Fallback mgmt VLAN created (from TC-FA-001)
- FA client connected to proxy
- FA server configured to approve NSI

#### Test Steps
1. Configure FA server to approve NSI requests
2. Connect FA client to proxy port 3
3. Initiate FA discovery from client
4. Send NSI request from proxy to server
5. Verify NSI approval from server
6. Check client port membership in mgmt VLAN
7. Verify VLAN advertisement to client

#### Expected Results
- ✅ FA server approves NSI request
- ✅ Client port (port 3) added to mgmt VLAN
- ✅ Mgmt VLAN is advertised to FA client
- ✅ Client receives VLAN information
- ✅ VLAN persists on proxy until reboot

#### CLI Commands
```bash
# On Proxy
show fabric attach
show vlan <mgmt_vlan_id>
show port <client_port> information detail
show fabric attach elements

# On Server
show fabric attach assignments
show log messages | include "NSI"
```

---

### **Test Case 4: NSI Rejection - No Port Addition**
**ID**: TC-FA-004  
**Priority**: P0 - Critical  
**Category**: Functional - Negative

#### Objective
Verify that client ports are NOT added to mgmt VLAN and VLAN is NOT forwarded when FA server rejects NSI.

#### Prerequisites
- ZTP is active on proxy
- Fallback mgmt VLAN created
- FA client connected to proxy
- FA server configured to reject NSI

#### Test Steps
1. Configure FA server to reject NSI requests
2. Connect FA client to proxy port 3
3. Initiate FA discovery from client
4. Send NSI request from proxy to server
5. Verify NSI rejection from server
6. Check client port membership in mgmt VLAN
7. Verify VLAN is NOT advertised to client

#### Expected Results
- ✅ FA server rejects NSI request
- ✅ Client port NOT added to mgmt VLAN
- ✅ Mgmt VLAN NOT forwarded to client
- ✅ Client does NOT receive VLAN information
- ✅ Proxy continues to keep fallback VLAN

#### CLI Commands
```bash
# On Proxy
show fabric attach
show vlan <mgmt_vlan_id>
show port <client_port> information detail
show fabric attach elements

# On Server
show fabric attach assignments
show log messages | include "NSI reject"
```

---

### **Test Case 5: NSI Retry During ZTP**
**ID**: TC-FA-005  
**Priority**: P1 - High  
**Category**: Functional - Retry Mechanism

#### Objective
Verify that proxy continues to retry NSI requests while ZTP is active, even if server initially rejects.

#### Prerequisites
- ZTP is active on proxy
- Fallback mgmt VLAN created
- FA client connected to proxy
- FA server initially configured to reject NSI

#### Test Steps
1. Configure FA server to reject NSI requests
2. Connect FA client to proxy
3. Send initial NSI request (expect rejection)
4. Monitor proxy behavior for retry attempts
5. Verify periodic NSI retries while ZTP is active
6. Change server to approve NSI
7. Verify NSI approval and port addition

#### Expected Results
- ✅ Proxy retries NSI request periodically
- ✅ Retries continue while ZTP is active
- ✅ Retry interval follows expected timing
- ✅ When server approves, client port added successfully
- ✅ VLAN advertised to client after approval

#### CLI Commands
```bash
# On Proxy
show ztp status
show fabric attach
show log messages | include "NSI"
debug fabric attach

# Monitor retry count and timing
show fabric attach statistics
```

---

### **Test Case 6: Stop NSI Retry When ZTP Completes**
**ID**: TC-FA-006  
**Priority**: P1 - High  
**Category**: Functional - ZTP Transition

#### Objective
Verify that NSI retry attempts stop when ZTP completes or becomes inactive.

#### Prerequisites
- ZTP is active on proxy
- NSI rejection scenario active (TC-FA-004)
- Proxy is retrying NSI requests

#### Test Steps
1. Start with proxy retrying NSI (server rejecting)
2. Monitor NSI retry attempts
3. Complete ZTP process on proxy
4. Verify ZTP transitions to inactive/complete state
5. Monitor proxy behavior for NSI retries
6. Verify retries stop after ZTP completion

#### Expected Results
- ✅ NSI retries continue while ZTP is active
- ✅ Retries stop when ZTP completes
- ✅ Fallback VLAN remains on proxy
- ✅ No error messages in logs
- ✅ FA functionality continues normally

#### CLI Commands
```bash
# On Proxy
show ztp status
show fabric attach
show log messages | include "ZTP"
show log messages | include "NSI"
```

---

### **Test Case 7: VLAN Persistence Until Reboot**
**ID**: TC-FA-007  
**Priority**: P1 - High  
**Category**: Functional - Persistence

#### Objective
Verify that fallback management VLAN persists until switch reboot, even after ZTP completes.

#### Prerequisites
- ZTP completed successfully
- NSI approved by server
- Fallback mgmt VLAN active with client ports

#### Test Steps
1. Complete TC-FA-003 (NSI approval scenario)
2. Verify fallback mgmt VLAN is active
3. Complete ZTP process
4. Wait for extended period (hours)
5. Monitor VLAN status
6. Reboot proxy switch
7. Verify VLAN status after reboot

#### Expected Results
- ✅ VLAN persists after ZTP completion
- ✅ VLAN remains active for extended time
- ✅ Client ports remain in VLAN
- ✅ After reboot, VLAN is removed
- ✅ New ZTP cycle can create fresh fallback VLAN

#### CLI Commands
```bash
# Before Reboot
show vlan
show ztp status
show fabric attach

# After Reboot
show vlan
show configuration | include "vlan"
```

---

### **Test Case 8: Server-Provided VLAN Overrides Fallback**
**ID**: TC-FA-008  
**Priority**: P1 - High  
**Category**: Functional - VLAN Override

#### Objective
Verify that when FA server sends a management VLAN, it overrides the fallback VLAN.

#### Prerequisites
- ZTP is active on proxy
- Fallback mgmt VLAN created (e.g., VLAN 10)
- FA server initially not sending mgmt VLAN
- NSI approved

#### Test Steps
1. Start with fallback VLAN active (VLAN 10)
2. Verify client ports in fallback VLAN
3. Configure FA server to send mgmt VLAN 20
4. Trigger FA server advertisement
5. Monitor proxy VLAN changes
6. Verify new VLAN received from server
7. Check client port membership

#### Expected Results
- ✅ Proxy receives server mgmt VLAN 20
- ✅ Client ports migrated to new VLAN 20
- ✅ Old fallback VLAN 10 removed or deprecated
- ✅ New VLAN advertised to clients
- ✅ FA continues functioning with new VLAN

#### CLI Commands
```bash
# On Proxy
show vlan
show fabric attach
show fabric attach elements

# On Server
show fabric attach configuration
show fabric attach assignments
```

---

### **Test Case 9: Multiple Client Ports Management**
**ID**: TC-FA-009  
**Priority**: P2 - Medium  
**Category**: Functional - Multi-Port

#### Objective
Verify proper handling of multiple client ports when NSI is approved or rejected.

#### Prerequisites
- ZTP is active on proxy
- Fallback mgmt VLAN created
- Multiple FA clients connected (ports 3-4)
- FA server ready

#### Test Steps
1. Connect FA clients to ports 3 and 4
2. Both clients initiate FA discovery
3. Send NSI request from proxy
4. Scenario A: Server approves NSI
   - Verify both ports added to mgmt VLAN
5. Scenario B: Server rejects NSI
   - Verify neither port added to mgmt VLAN
6. Scenario C: Partial approval (if supported)
   - Verify selective port addition

#### Expected Results
- ✅ Both ports handled consistently
- ✅ On approval: Both ports in mgmt VLAN
- ✅ On rejection: Neither port in mgmt VLAN
- ✅ VLAN advertisement consistent across ports
- ✅ No port left in inconsistent state

#### CLI Commands
```bash
# On Proxy
show vlan <mgmt_vlan_id>
show port 3-4 information detail
show fabric attach
show fabric attach elements
```

---

### **Test Case 10: ZTP Restart During Active Session**
**ID**: TC-FA-010  
**Priority**: P2 - Medium  
**Category**: Functional - State Transition

#### Objective
Verify behavior when ZTP restarts while FA session is active with existing fallback VLAN.

#### Prerequisites
- ZTP completed once
- Fallback VLAN active
- FA session established
- NSI approved

#### Test Steps
1. Start with active FA session and fallback VLAN
2. Trigger ZTP restart/re-enable
3. Monitor VLAN status during ZTP restart
4. Verify fallback VLAN handling
5. Check FA session continuity
6. Verify NSI state

#### Expected Results
- ✅ Existing VLAN handled gracefully
- ✅ FA session maintains or re-establishes
- ✅ No duplicate VLANs created
- ✅ Client connectivity maintained or brief interruption
- ✅ System reaches stable state

#### CLI Commands
```bash
# On Proxy
show ztp status
show vlan
show fabric attach
enable ztp
show log messages | include "ZTP|vlan"
```

---

### **Test Case 11: FA Server Unreachable Scenario**
**ID**: TC-FA-011  
**Priority**: P2 - Medium  
**Category**: Functional - Failure Handling

#### Objective
Verify proxy behavior when FA server becomes unreachable after fallback VLAN creation.

#### Prerequisites
- ZTP is active
- Fallback mgmt VLAN created
- FA adjacency established
- NSI approved

#### Test Steps
1. Start with active FA session and fallback VLAN
2. Disconnect FA server (cable pull or shutdown)
3. Monitor proxy behavior
4. Verify VLAN persistence
5. Check client port status
6. Reconnect FA server
7. Verify recovery

#### Expected Results
- ✅ Fallback VLAN persists during server outage
- ✅ Client ports remain in VLAN
- ✅ No VLAN flapping or removal
- ✅ FA adjacency shows down state
- ✅ Upon server return, FA session re-establishes
- ✅ System returns to normal operation

#### CLI Commands
```bash
# On Proxy
show fabric attach
show fabric attach adjacency
show vlan
show log messages | include "adjacency"
```

---

### **Test Case 12: Configuration Persistence After Reload**
**ID**: TC-FA-012  
**Priority**: P2 - Medium  
**Category**: Functional - Config Management

#### Objective
Verify that fallback VLAN configuration does NOT persist in saved configuration (it's runtime only).

#### Prerequisites
- Fallback mgmt VLAN created and active
- NSI approved
- FA session active

#### Test Steps
1. Create fallback VLAN through FA/ZTP process
2. Verify VLAN is active
3. Save configuration
4. Review saved configuration file
5. Reboot switch
6. Check VLAN status after reboot
7. Verify VLAN is not in config

#### Expected Results
- ✅ Fallback VLAN visible in runtime
- ✅ Fallback VLAN NOT in saved configuration
- ✅ After reboot, fallback VLAN removed
- ✅ Manual VLANs remain in configuration
- ✅ New ZTP cycle required for new fallback VLAN

#### CLI Commands
```bash
# Before Reboot
show vlan
show configuration | include "vlan"
save configuration

# After Reboot
show vlan
show configuration | include "vlan"
```

---

### **Test Case 13: Interoperability with Manual VLANs**
**ID**: TC-FA-013  
**Priority**: P2 - Medium  
**Category**: Functional - Coexistence

#### Objective
Verify that fallback management VLAN coexists properly with manually configured VLANs.

#### Prerequisites
- Manually created VLANs on proxy (VLAN 100, 200)
- ZTP active
- FA server not sending mgmt VLAN

#### Test Steps
1. Create manual VLANs 100 and 200
2. Configure ports with manual VLANs
3. Enable FA proxy with ZTP active
4. Trigger fallback VLAN creation
5. Verify fallback VLAN doesn't conflict with manual VLANs
6. Check port memberships
7. Test VLAN forwarding for both types

#### Expected Results
- ✅ Fallback VLAN uses non-conflicting VLAN ID
- ✅ Manual VLANs unaffected
- ✅ Port memberships maintained correctly
- ✅ No VLAN ID collisions
- ✅ Both types of VLANs function independently

#### CLI Commands
```bash
# On Proxy
show vlan
show port information detail
show fabric attach
```

---

### **Test Case 14: Logging and Debug Messages**
**ID**: TC-FA-014  
**Priority**: P3 - Low  
**Category**: Functional - Observability

#### Objective
Verify appropriate log messages are generated for key events in fallback VLAN lifecycle.

#### Prerequisites
- ZTP active
- Debug logging enabled
- FA proxy configured

#### Test Steps
1. Enable debug for FA and ZTP
2. Trigger fallback VLAN creation
3. Review logs for VLAN creation message
4. Trigger NSI approval
5. Review logs for NSI approval message
6. Trigger NSI rejection
7. Review logs for rejection and retry messages
8. Complete ZTP
9. Review logs for completion message
10. Reboot and check cleanup logs

#### Expected Results
- ✅ Log message on fallback VLAN creation
- ✅ Log message on NSI approval/rejection
- ✅ Log message on retry attempts
- ✅ Log message on ZTP completion
- ✅ Log message on VLAN cleanup
- ✅ All messages have appropriate severity
- ✅ Messages are clear and informative

#### CLI Commands
```bash
# On Proxy
enable log debug-mode
enable log target memory-buffer
debug fabric attach
show log messages | include "fabric|ZTP|vlan"
show log | include "NSI|fallback"
```

---

### **Test Case 15: Performance - High Client Count**
**ID**: TC-FA-015  
**Priority**: P3 - Low  
**Category**: Performance

#### Objective
Verify system performance and stability with high number of FA clients during fallback VLAN operations.

#### Prerequisites
- ZTP active on proxy switch
- Multiple FA clients available (10+ clients)
- FA server ready

#### Test Steps
1. Connect 10+ FA clients to proxy
2. Initiate simultaneous FA discoveries
3. Monitor fallback VLAN creation time
4. Send NSI requests for all clients
5. Monitor system CPU and memory
6. Verify client port additions
7. Test VLAN advertisement to all clients
8. Monitor log message volume

#### Expected Results
- ✅ System handles multiple clients without issue
- ✅ VLAN creation time within acceptable range
- ✅ All client ports added upon NSI approval
- ✅ CPU usage remains acceptable
- ✅ Memory usage remains stable
- ✅ No client port missed or dropped
- ✅ No system instability

#### CLI Commands
```bash
# On Proxy
show cpu-monitoring
show memory
show vlan <mgmt_vlan_id>
show fabric attach elements
show fabric attach statistics
```

---

## 📊 Test Execution Summary Template

| Test Case ID | Test Case Name | Status | Priority | Result | Defects | Notes |
|--------------|----------------|--------|----------|--------|---------|-------|
| TC-FA-001 | Fallback VLAN Creation During ZTP | | P0 | | | |
| TC-FA-002 | No Fallback VLAN When ZTP Inactive | | P0 | | | |
| TC-FA-003 | NSI Acceptance - Client Port Addition | | P0 | | | |
| TC-FA-004 | NSI Rejection - No Port Addition | | P0 | | | |
| TC-FA-005 | NSI Retry During ZTP | | P1 | | | |
| TC-FA-006 | Stop NSI Retry When ZTP Completes | | P1 | | | |
| TC-FA-007 | VLAN Persistence Until Reboot | | P1 | | | |
| TC-FA-008 | Server-Provided VLAN Overrides Fallback | | P1 | | | |
| TC-FA-009 | Multiple Client Ports Management | | P2 | | | |
| TC-FA-010 | ZTP Restart During Active Session | | P2 | | | |
| TC-FA-011 | FA Server Unreachable Scenario | | P2 | | | |
| TC-FA-012 | Configuration Persistence After Reload | | P2 | | | |
| TC-FA-013 | Interoperability with Manual VLANs | | P2 | | | |
| TC-FA-014 | Logging and Debug Messages | | P3 | | | |
| TC-FA-015 | Performance - High Client Count | | P3 | | | |

### Status Legend
- ⏳ Not Started
- 🔄 In Progress
- ✅ Passed
- ❌ Failed
- ⚠️ Blocked
- 🔁 Retest Required

---

## ✅ Success Criteria

### Functional Success Criteria
1. ✅ Fallback VLAN created ONLY when ZTP is running
2. ✅ Client ports added to mgmt VLAN only on NSI approval
3. ✅ NSI retry mechanism works correctly during ZTP
4. ✅ Mgmt VLAN not forwarded to clients on NSI rejection
5. ✅ VLAN persists until reboot or server override
6. ✅ No impact on non-ZTP FA proxy operations
7. ✅ No impact on customers with custom mgmt VLANs

### Performance Success Criteria
1. ✅ VLAN creation time < 5 seconds
2. ✅ NSI retry interval within spec (configurable)
3. ✅ System handles 20+ concurrent FA clients
4. ✅ No memory leaks during extended operation
5. ✅ CPU usage remains < 50% during operations

### Stability Success Criteria
1. ✅ No crashes or unexpected reboots
2. ✅ No VLAN flapping or instability
3. ✅ Clean state transitions (ZTP start/stop)
4. ✅ Proper cleanup on switch reload
5. ✅ 48-hour stability test passed

---

## 🔗 Dependencies

### Feature Dependencies
- **EXOS-38257**: Previous fallback mgmt VLAN implementation
- **ZTP Package**: Zero Touch Provisioning must be functional
- **Fabric Attach**: FA proxy and server features

### Test Dependencies
- FA server with NSI approval/rejection capability
- ZTP infrastructure for testing
- FA client devices or simulators
- Network monitoring tools

---

## ⚠️ Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| ZTP not available in test lab | High | Low | Set up ZTP environment in advance |
| FA server not rejecting NSI | Medium | Low | Configure server policies to force rejection |
| Insufficient FA clients | Medium | Medium | Use FA client simulators if needed |
| Timing issues in retry mechanism | Medium | Medium | Use debug logging to capture exact timing |
| VLAN ID conflicts | Low | Low | Document VLAN ID allocation scheme |

---

## 📝 Test Execution Guidelines

### Pre-Execution Checklist
- [ ] EXOS build with EXOS-39334 installed
- [ ] Test topology verified and connected
- [ ] ZTP package installed and functional
- [ ] FA server and proxy licenses verified
- [ ] Console access to all devices confirmed
- [ ] Baseline configurations backed up
- [ ] Test data prepared (VLAN IDs, NSI values)

### During Execution
- [ ] Follow test steps precisely
- [ ] Capture CLI output for each verification step
- [ ] Take packet captures for FA protocol analysis
- [ ] Monitor system logs continuously
- [ ] Document any deviations from expected results
- [ ] Note timing information for performance tests

### Post-Execution
- [ ] Analyze test results against success criteria
- [ ] Document all defects with detailed reproduction steps
- [ ] Generate test execution summary report
- [ ] Backup final configurations
- [ ] Clean up test environment
- [ ] Schedule defect triage meetings

---

## 📎 Appendix

### A. Reference Documents
- EXOS-38257: Original fallback mgmt VLAN feature
- EXOS ZTP Configuration Guide
- Fabric Attach Configuration Guide
- Network Service Identifier (NSI) Specification

### B. CLI Command Reference

#### ZTP Commands
```bash
enable ztp
disable ztp
show ztp status
show ztp configuration
```

#### Fabric Attach Commands
```bash
enable fabric attach
configure fabric attach proxy
show fabric attach
show fabric attach adjacency
show fabric attach elements
show fabric attach assignments
show fabric attach statistics
debug fabric attach
```

#### VLAN Commands
```bash
create vlan <name> tag <vlan_id>
show vlan
show vlan <vlan_id>
configure vlan <vlan_id> add ports <port_list>
delete vlan <vlan_name>
```

### C. Expected VLAN Naming Convention
Fallback management VLANs should follow naming pattern:
- Format: `FA_MGMT_FALLBACK_<id>`
- Example: `FA_MGMT_FALLBACK_10`

### D. NSI Value Ranges
- Valid NSI range: 1 - 16777215 (24-bit identifier)
- Reserved ranges: Check FA specification

### E. Timing Parameters
- NSI retry interval: Configurable (default: 30 seconds)
- ZTP timeout: Per ZTP configuration
- FA adjacency timeout: 90 seconds

---

## 📞 Contact Information

| Role | Name | Contact |
|------|------|---------|
| Test Lead | QA Team Lead | qa-lead@extremenetworks.com |
| Development Contact | Dev Team | dev-team@extremenetworks.com |
| Product Owner | Product Manager | pm@extremenetworks.com |

---

**Test Plan Version History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-06 | QA Team | Initial test plan created |

---

*End of Test Plan*
