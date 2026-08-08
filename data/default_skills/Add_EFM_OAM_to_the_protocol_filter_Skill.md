# Add EFM OAM to the protocol filter - Skill File

## Feature Overview
# Add EFM OAM to the protocol filter
configure protocol filter my_slow_protocols_filteradd dest-mac 
01:80:C2:00:00:02 etype 0x8809 field offset 14 value 03 mask FF
The following validity checks are performed when a protocol is added to a protocol
filter:
•
Ensure that the protocol does not already exist in the protocol filter.
•
If the protocol filter is used by any L2PT profile:
◦Ensure that the protocol defines a destination MAC address.
◦Ensure that the protocol defines a protocol identifier...

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
