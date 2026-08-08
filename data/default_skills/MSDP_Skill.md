# MSDP - Skill File

## Feature Overview

### Page 1144

MSDP
MSDP Overview on page 1144
PIM Border Configuration on page 1145
MSDP Peers on page 1145
MSDP Mesh-Groups on page 1148
Anycast RP on page 1149
SA Cache on page 1151
SNMP MIBs on page 1152
This chapter introduces MSDP (Multicast Source Discovery Protocol), an interdomain
multicast protocol used to connect multiple multicast routing domains that run PIM-
SM (Protocol Independent Multicast-Sparse Mode). This chapter discusses the features
and configuration for PIM border, MSDP peers, mesh groups, anycast RP, SA cache,
redundancy, and SNMP (Simple Network Management Protocol) MIBs.
Note
For more information about MSDP, refer to RFC 3618.
MSDP Overview
MSDP (Multicast Source Discovery Protocol) is an interdomain multicast protocol
used to connect multiple multicast routing domains that run Protocol Independent
Multicast-Sparse Mode (PIM-SM).
MSDP speakers are configured on each PIM-SM domain. These speakers establish a
peering relationship with other MSDP speakers through...

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
- **Switch Engine v33.6.1 User Guide** - Chapter: MSDP
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "MSDP"*
