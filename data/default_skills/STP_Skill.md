# STP - Skill File

## Feature Overview

### Page 1780

STP
Spanning Tree Protocol Overview on page 1780
Span Tree Domains on page 1794
STP Configurations on page 1802
Per VLAN Spanning Tree on page 1809
Rapid Spanning Tree Protocol on page 1810
Multiple Spanning Tree Protocol on page 1822
STP and Network Login on page 1834
STP and ONEPolicy on page 1835
STP and MLAG on page 1835
STP Rules and Restrictions on page 1837
Configuring STP on the Switch on page 1838
Displaying STP Settings on page 1840
STP Configuration Examples on page 1841
Using the STP (Spanning Tree Protocol) functionality of the switch makes your network
more fault tolerant. This chapter explains more about STP and the STP features
supported by ExtremeXOS.
Note
STP is a part of the 802.1D bridge specification defined by the IEEE Computer
Society. To explain STP in terms used by the IEEE 802.1D specification, the
switch will be referred to as a bridge.
ExtremeXOS version 12.0 and later supports the new edition of the IEEE 802.1D standard
(known as IEEE 802.1D-2...

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
- **Switch Engine v33.6.1 User Guide** - Chapter: STP
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "STP"*
