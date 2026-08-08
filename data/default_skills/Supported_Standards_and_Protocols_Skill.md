# Supported Standards and Protocols - Skill File

## Feature Overview

### Page 1847

Supported Standards, Protocols, and
MIBs
Extreme Networks Proprietary MIBs on page 1847
MIB Support Details on page 2031
This appendix provides information about the MIB support provided by the
ExtremeXOS SNMP (Simple Network Management Protocol) agent residing on Extreme
Networks devices running ExtremeXOS and Extreme Networks proprietary MIBS.
Note
All information for supported standards and protocols can be found in the
following location: http://www.extremenetworks.com/resources. This appendix
contains only the MIB support details.
Extreme Networks Proprietary MIBs
The Extreme Networks MIBs are located at http://www.extremenetworks.com/support/
policies/mibs/.
Switch Engine™ v33.6.1 User Guide 1847


![Image 2808](Switch_Engine_33_6_1_User_Guide_images/page1847_img1.png)


![Image 2809](Switch_Engine_33_6_1_User_Guide_images/page1847_img2.png)


![Image 2810](Switch_Engine_33_6_1_User_Guide_images/page1847_img3.png)


### Page 1848

EXTREME ACL MIB
The following tables...

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
- **Switch Engine v33.6.1 User Guide** - Chapter: Supported Standards and Protocols
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "Supported Standards and Protocols"*
