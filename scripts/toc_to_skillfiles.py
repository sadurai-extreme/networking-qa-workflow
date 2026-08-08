#!/usr/bin/env python3
"""
TOC-based Skill File Generator
Uses Table of Contents to create feature-grouped skill files from PDF extraction.
"""

import os
import re
from pathlib import Path
import argparse

# Table of Contents from Switch Engine User Guide (pages start on page 7 of PDF)
# Format: (Feature Name, Start Page Number in document content)
TOC = [
    ("Getting Started", 9),
    ("Managing the Switch", 67),
    ("Managing the ExtremeXOS Software", 134),
    ("Configuring Stacked Switches", 146),
    ("Configuring Slots and Ports", 223),
    ("ACLs", 340),
    ("AVB", 409),
    ("BGP", 419),
    ("BGP Auto-peering", 482),
    ("CLEAR-Flow", 499),
    ("Data Center Solutions", 518),
    ("EAPS", 546),
    ("ERPS", 602),
    ("ESRP", 616),
    ("EVPN - Ethernet Virtual Private Network", 647),
    ("Extended Edge Switching", 732),
    ("Fabric Attach", 783),
    ("FDB", 823),
    ("Identity Management", 836),
    ("Integrated Application Hosting", 865),
    ("IPv4 Unicast Routing", 881),
    ("IPv6 Multicast", 942),
    ("IPv6 Unicast Routing", 952),
    ("IS-IS", 988),
    ("Keychain Manager", 1010),
    ("Layer 2 Tunneling and Filtering", 1013),
    ("Layer 3 Virtual Private Network", 1021),
    ("LLDP", 1032),
    ("MPLS", 1052),
    ("MSDP", 1144),
    ("Multicast Routing and Switching", 1153),
    ("Network Login", 1210),
    ("OAM", 1277),
    ("ONEPolicy", 1312),
    ("OSPF", 1385),
    ("OSPFv2 Auto-peering", 1404),
    ("OSPFv3", 1407),
    ("PoE", 1422),
    ("Policy Manager", 1442),
    ("Quality of Service", 1447),
    ("RADIUS over TLS", 1483),
    ("REST API", 1490),
    ("RIP", 1501),
    ("RIPng", 1508),
    ("Routing Policies", 1514),
    ("Security", 1525),
    ("Service Probe", 1679),
    ("Software Upgrade and Boot Options", 1690),
    ("Status Monitoring and Statistics", 1720),
    ("STP", 1780),
    ("Supported Standards and Protocols", 1847),
    ("Troubleshooting", 2100),
    ("Universal Port", 2128),
    ("Using CLI Scripting", 2175),
    ("Virtual Routers", 2191),
    ("VLANs", 2206),
    ("VMAN", 2254),
    ("VRRP", 2269),
    ("VXLAN", 2298),
]


def extract_chapter_content(markdown_file, start_page, end_page):
    """Extract content between two page numbers from markdown."""
    with open(markdown_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find content between page markers
    start_marker = f"## Page {start_page}\n"
    end_marker = f"## Page {end_page}\n"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    if start_idx == -1:
        return None
    
    if end_idx == -1:
        # Last chapter - take everything till end
        return content[start_idx:]
    
    return content[start_idx:end_idx]


def create_skill_file(feature_name, content, output_dir):
    """Create a skill file from chapter content."""
    
    # Clean feature name for filename
    safe_name = re.sub(r'[^\w\s-]', '', feature_name)
    safe_name = re.sub(r'[-\s]+', '_', safe_name)
    filename = f"{safe_name}_Skill.md"
    
    # Extract first 1000 characters for overview
    overview = content[:1000].replace("##", "###") + "..."
    
    # Build skill file content
    skill_content = f"""# {feature_name} - Skill File

## Feature Overview

{overview}

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
- **Switch Engine v33.6.1 User Guide** - Chapter: {feature_name}
- **Release Notes** - Check for known issues
- **Configuration Guide** - Step-by-step procedures

## Notes
- Review feature-specific documentation for detailed test procedures
- Consult topology requirements before testing
- Check hardware compatibility for feature support

---
*Auto-generated from Switch Engine User Guide v33.6.1*
*Source: Pages extracted from TOC chapter "{feature_name}"*
"""
    
    # Save skill file
    output_path = Path(output_dir) / filename
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(skill_content)
    
    return filename


def main():
    parser = argparse.ArgumentParser(description='Generate skill files from TOC structure')
    parser.add_argument('markdown_file', help='Path to extracted markdown file')
    parser.add_argument('--output-dir', default='./data/default_skills', help='Output directory')
    parser.add_argument('--clean', action='store_true', help='Remove old Page_*_Skill.md files first')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("📚 TOC-Based Skill File Generator")
    print("=" * 60)
    
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Clean up old page-based skill files
    if args.clean:
        print("\n🧹 Cleaning up old Page_*_Skill.md files...")
        removed_count = 0
        for old_file in output_dir.glob("Page_*_Skill.md"):
            old_file.unlink()
            removed_count += 1
        print(f"   Removed {removed_count} old files")
    
    print(f"\n📖 Processing {len(TOC)} chapters from Table of Contents...")
    print(f"📁 Output directory: {output_dir}\n")
    
    generated_files = []
    
    for i, (feature_name, start_page) in enumerate(TOC):
        # Determine end page
        if i + 1 < len(TOC):
            end_page = TOC[i + 1][1]
        else:
            end_page = 2379  # Last page
        
        print(f"  Processing: {feature_name} (pages {start_page}-{end_page})...")
        
        # Extract content
        content = extract_chapter_content(args.markdown_file, start_page, end_page)
        
        if content:
            # Create skill file
            filename = create_skill_file(feature_name, content, output_dir)
            generated_files.append(filename)
            print(f"    ✅ Created: {filename}")
        else:
            print(f"    ⚠️  Skipped: No content found")
    
    print(f"\n{'=' * 60}")
    print(f"✨ Success! Generated {len(generated_files)} skill files")
    print(f"{'=' * 60}")
    print(f"\nGenerated files:")
    for f in generated_files[:10]:
        print(f"  - {f}")
    if len(generated_files) > 10:
        print(f"  ... and {len(generated_files) - 10} more")
    
    print(f"\n💡 Next steps:")
    print(f"  1. Review generated skill files in: {output_dir}")
    print(f"  2. Files will appear in Stage 2 'Default Skill Files' section")
    print(f"  3. Select and customize for your test scenarios")


if __name__ == "__main__":
    main()
