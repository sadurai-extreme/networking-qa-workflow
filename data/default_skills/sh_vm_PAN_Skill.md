# sh vm PAN - Skill File

## Feature Overview
# sh vm PAN 
VM Name:         PAN
    State:       Running
    Memory size: 8192 MB
    CPUs:        2
    Auto-start:  Disabled
    VNC:         127.0.0.1:1 (Port 5901)
    Disk:        vda
        Source:                  /mnt/vmdisk/.vm/PAN_PA-VM-KVM-9.1.2.qcow2
        Disk bus type:           virtio
        Allocated size in bytes: 64424509440 (60.00 GB)
        Physical size in bytes:  5405478912 (5.03 GB)
        Read requests:           48213
        Bytes read:              1188752896
 ...

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
