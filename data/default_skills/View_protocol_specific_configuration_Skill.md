# View protocol-specific configuration - Skill File

## Feature Overview
# View protocol-specific configuration
show lldp ports <port_list>
show stp ports <port_list>
Related Commands
The unconfigure ports command has several other options for unconfiguring specific
features:
•
unconfigure ports <port_list> description-string - Removes the port
description
•
unconfigure ports <port_list> display-string - Removes the display string
Use Cases
Configuring Slots and Ports on a Switch
328
Switch Engine™ v33.6.1 User Guide


![Image 512](Switch_Engine_33_6_1_User_Guide_ima...

## Test Scenarios

### Functional Testing
1. **Basic Configuration**
   - Verify feature can be enabled/disabled
   - Validate default settings
   - Test configuration persistence

### Configuration Testing

### Interoperability Testing
- Test with different switch models
- Validate with various firmware versions
- Check interaction with other features

### Negative Testing
- Invalid configurations
- Resource exhaustion scenarios
- Error handling validation

### Performance Testing
- Load testing
- Scalability validation
- Resource utilization

## Expected Results
- Feature functions as documented
- No unexpected behavior
- Performance within acceptable limits

## References
- Concept Guide Section: {title}
- Related Documentation: [Add links]

---
*Auto-generated from PDF Concept Guide*
