# VMAN - Skill File

## Feature Overview

### Page 2254

VMAN (PBN)
VMAN Overview on page 2254
VMAN Configuration Options and Features on page 2260
Configuration on page 2263
Displaying VMAN Information on page 2266
Configuration Examples on page 2266
The virtual metropolitan area network (VMAN) feature allows you to scale a Layer 2
network and avoid some of the management and bandwidth overhead required by
Layer 3 networks.
Note
If a failover occurs, VMAN operation is not interrupted. The system has hitless
failover—network traffic is not interrupted during a failover.
VMAN Overview
The VMAN feature is defined by the IEEE 802.1ad standard, which is an amendment to
the IEEE 802.1Q VLAN (Virtual LAN) standard.
A VMAN is a virtual Metropolitan Area Network (MAN) that operates over a physical
MAN or Provider Bridged Network (PBN). This feature allows a service provider to create
VMAN instances within a MAN or PBN to support individual customers. Each VMAN
supports tagged and untagged VLAN traffic for a customer, and this traffic i...

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
- **Switch Engine v33.6.1 User Guide** - Chapter: VMAN
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "VMAN"*
