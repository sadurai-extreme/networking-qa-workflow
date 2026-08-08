# Quality of Service - Skill File

## Feature Overview

### Page 1447

Quality of Service
QoS Overview on page 1448
Applications and Types of QoS on page 1449
Traffic Groups on page 1451
Introduction to Rate Limiting, Rate Shaping, and Scheduling on page 1456
Introduction to WRED on page 1459
Meters on page 1463
QoS Profiles on page 1463
Class of Service (CoS) on page 1466
Configuring QoS on page 1468
Displaying QoS Configuration and Performance on page 1481
VXLAN gateway uses a DSCP value of 0 when the tenant packet is not IP. Otherwise,
it copies the tenant DSCP value to the outer IP header. In order to overwrite this, user
must configure an ACL (Access Control List) rule. This ACL is general and applied to all
virtual networks. The following is an example of this ACL rule:
entry map {
      if {
          protocol udp;
          destination-port 4789;
      }
      then {
          qosprofile qp3;
          replace-dscp;
          replace-dot1p;
 }
 }
Then, the following command is used to put the outer DSCP value to a fixed value of 32:
...

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
- **Switch Engine v33.6.1 User Guide** - Chapter: Quality of Service
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "Quality of Service"*
