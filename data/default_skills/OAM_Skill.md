# OAM - Skill File

## Feature Overview

### Page 1277

OAM
CFM on page 1277
Y.1731—Compliant Performance Monitoring on page 1290
Y.1731 MIB Support on page 1299
EFM OAM—Unidirectional Link Fault Management on page 1300
Two-Way Active Measurement Protocol on page 1302
Bidirectional Forwarding Detection (BFD) on page 1303
Operation, Administration, and Maintenance (OAM) includes functions used to detect
network faults, measure network performance and distribute fault-related information,
including CFM, Y.1731, EFM, and BFD.
CFM
Connectivity Fault Management (CFM), discussed in the IEEE 802.1Q-2011 standard and
originally specified in the IEEE 802.1ag-2007 standard, allows you to detect, verify, and
isolate connectivity failures in virtual bridged LANs.
Part of this specification is a toolset to manually check connectivity, which is sometimes
referred to as Layer 2 ping.
Note
The ExtremeXOS implementation of CFM is based on the IEEE 802.1Q-2011 and
Y.1731 standards.
There is no direct interaction between CFM and other Layer 2 pr...

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
- **Switch Engine v33.6.1 User Guide** - Chapter: OAM
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "OAM"*
