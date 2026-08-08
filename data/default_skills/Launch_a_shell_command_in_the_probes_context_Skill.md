# Launch a shell command in the probe's context - Skill File

## Feature Overview
# Launch a shell command in the probe's context
run service-probe 1 shell
At the prompt, enter the command:
traceroute 11.100.100.1
Expected output:
Exit Status: 0
...output follows:
traceroute to 11.100.100.1 (11.100.100.1), 30 hops max, 46 byte packets
 1  172.16.1.1 (172.16.1.1)    0.547 ms  0.343 ms  0.321 ms
 2  11.100.100.1 (11.100.100.1) 0.287 ms  0.271 ms  0.247 ms
Service Probe
Example: Running a Traceroute via Shell
Switch Engine™ v33.6.1 User Guide 1689


![Image 2562](Switch_Engine_3...

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
