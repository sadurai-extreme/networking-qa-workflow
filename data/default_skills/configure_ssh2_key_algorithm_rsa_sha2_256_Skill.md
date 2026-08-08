# configure ssh2 key algorithm rsa-sha2-256 - Skill File

## Feature Overview
# configure ssh2 key algorithm rsa-sha2-256
New key algorithm will be usable after disable and enable SSH or 'restart process exsshd'.
Warning: Legacy clients that do not support this algorithm will not connect with the
        switch's SSH server.
The following command configures the host key algorithm:
configure ssh2 key algorithm [ ssh-rsa | rsa-sha2-256 | rsa-sha2-512]
Use the show ssh2 command to display current and configured algorithms.
Enabling SSH2 for Inbound Switch Access
You must ena...

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
