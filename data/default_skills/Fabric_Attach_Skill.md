# Fabric Attach - Skill File

## Feature Overview

### Page 783

Fabric Attach
Fabric Attach Overview on page 783
Configuring Fabric Attach on page 796
Fabric Attach Timeout Configurations on page 799
Fabric Attach and Extended Edge Switching Configuration
Examples on page 799
The Fabric Attach feature allows attachment of non-SPB (Shortest Path Bridging)
stations to an SPB network through a Fabric Attach server or it can act as a Fabric
Attach server for VXLAN (Virtual Extensible LAN) overlay networks.
Fabric Attach Overview
Fabric Attach uses the IEEE802.1ab LLDP (Link Layer Discovery Protocol) extensions to
automatically attach network devices to individual services in a IEEE 802.1aq Shortest
Path Bridging (SPB) network. These network devices typically do not support SPB,
MAC-in-MAC (802.1ah) or Network Services Identifier (NSI)/Individual Service Identifier
(ISID) usage, and therefore cannot easily take advantage of the Fabric infrastructure
without manual configuration of VLAN attachments to NSIs or ISIDs in multiple
locations. Fab...

## Test Scenarios

### Functional Testing
1. **Basic Configuration**
   - Verify feature can be enabled/disabled
   - Validate default settings
   - Test configuration persistence across reboots
   - Verify show commands display correct information

2. **Feature-Specific Tests**
   - Test primary feature functionality
   - Validate configuration options
   - Test interaction with related features
   - Verify state transitions

### Configuration Testing
- Valid configuration commands
- Invalid configuration handling
- Configuration limits and boundaries
- Configuration file backup and restore

### Interoperability Testing
- Test with different switch models
- Validate with various firmware versions
- Check interaction with other protocols/features
- Multi-vendor interoperability (if applicable)

### Negative Testing
- Invalid configurations
- Resource exhaustion scenarios
- Error handling validation
- Recovery from failure conditions

### Performance Testing
- Load testing under heavy traffic
- Scalability validation (maximum entries/sessions)
- Resource utilization monitoring
- Performance degradation testing

### Security Testing
- Authentication and authorization
- Access control verification
- Security policy enforcement
- Vulnerability testing

## Expected Results
- Feature functions as documented in Switch Engine User Guide
- No unexpected behavior or crashes
- Performance within acceptable limits
- Proper error messages for invalid operations
- Clean logs without errors

## Test Cases

### TC001: Basic Feature Enablement
**Objective:** Verify feature can be enabled  
**Steps:**
1. Configure feature with minimum required parameters
2. Verify configuration is accepted
3. Check feature status shows "enabled"

**Expected:** Feature enabled successfully

### TC002: Configuration Persistence
**Objective:** Verify configuration survives reboot  
**Steps:**
1. Configure feature fully
2. Save configuration
3. Reboot switch
4. Verify configuration intact after boot

**Expected:** All settings preserved

### TC003: Show Commands
**Objective:** Verify all show commands work  
**Steps:**
1. Execute all relevant show commands
2. Verify output format is correct
3. Check all fields display accurate data

**Expected:** Commands return valid output

## References
- **Switch Engine v33.6.1 User Guide** - Chapter: Fabric Attach
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "Fabric Attach"*
