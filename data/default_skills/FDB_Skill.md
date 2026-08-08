# FDB - Skill File

## Feature Overview

### Page 823

FDB
FDB Contents on page 823
How FDB Entries Get Added on page 823
How FDB Entries Age Out on page 824
FDB Entry Types on page 824
Managing the FDB on page 826
MAC-Based Security on page 829
Managing MAC Address Tracking on page 833
Displaying FDB Entries and Statistics on page 835
The FDB (forwarding database) chapter is intended to help you learn about forwarding
databases, adding and displaying entries and entry types, managing the FDB, and
MAC-based security. This chapter also provides information about MAC Address
tracking. The switch maintains a forwarding database (FDB) of all MAC addresses
received on all of its ports. It uses the information in this database to decide whether a
frame should be forwarded or filtered.
Note
See command references for details of the commands related to the FDB.
FDB Contents
Each FDB (forwarding database) entry consists of:
•
The MAC address of the device
•
An identifier for the port and VLAN (Virtual LAN) on which it was received
•
Th...

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
- **Switch Engine v33.6.1 User Guide** - Chapter: FDB
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "FDB"*
