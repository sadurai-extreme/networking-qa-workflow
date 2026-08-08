# Reset multiple non-contiguous ports - Skill File

## Feature Overview
# Reset multiple non-contiguous ports
unconfigure ports 1,5,10-15,25 configuration
Confirmation Prompt
The command displays a warning message and requires confirmation before
proceeding:
Warning: This will restore factory defaults to all port-related configuration 
for selected port(s). Do you wish to proceed? (y/N)
Enter y or Yes to proceed with the reset operation. Enter N, No, or press Enter to cancel
the operation.
This confirmation prompt prevents accidental configuration loss.
Configuring ...

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
