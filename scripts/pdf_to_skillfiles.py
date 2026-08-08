#!/usr/bin/env python3
"""
PDF to Skill Files Converter
Extracts text, images, and configurations from PDF concept guides
and generates structured skill files for the QA workflow.

Uses PyMuPDF (fitz) for fast, reliable PDF extraction without heavy ML dependencies.
"""

import os
import sys
import json
import argparse
from pathlib import Path
import re

try:
    import fitz  # PyMuPDF
except ImportError:
    print("❌ PyMuPDF not installed. Installing now...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "PyMuPDF"], check=True)
    import fitz


def convert_pdf_to_markdown(pdf_path, output_dir):
    """
    Convert PDF to Markdown using PyMuPDF.
    Extracts text and images from the PDF.
    
    Args:
        pdf_path: Path to the input PDF file
        output_dir: Directory to save markdown and extracted images
    
    Returns:
        Path to the generated markdown file
    """
    print(f"🔄 Converting PDF to Markdown: {pdf_path}")
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    try:
        # Open PDF
        doc = fitz.open(pdf_path)
        pdf_name = Path(pdf_path).stem
        
        print(f"📖 Processing {len(doc)} pages...")
        
        # Extract text and structure
        full_text = []
        images_dir = output_path / f"{pdf_name}_images"
        images_dir.mkdir(exist_ok=True)
        
        image_count = 0
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Extract text with structure preservation
            text = page.get_text("text")
            if text.strip():
                full_text.append(f"\n## Page {page_num + 1}\n\n{text}\n")
            
            # Extract images
            image_list = page.get_images()
            for img_index, img in enumerate(image_list):
                xref = img[0]
                try:
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    image_filename = f"page{page_num + 1}_img{img_index + 1}.{image_ext}"
                    image_path = images_dir / image_filename
                    
                    with open(image_path, "wb") as img_file:
                        img_file.write(image_bytes)
                    
                    # Add image reference to markdown
                    full_text.append(f"\n![Image {image_count + 1}]({pdf_name}_images/{image_filename})\n\n")
                    image_count += 1
                except Exception as e:
                    print(f"⚠️  Could not extract image on page {page_num + 1}: {e}")
            
            # Progress indicator
            if (page_num + 1) % 50 == 0:
                print(f"   Processed {page_num + 1}/{len(doc)} pages...")
        
        total_pages = len(doc)
        doc.close()
        
        # Save markdown file
        markdown_file = output_path / f"{pdf_name}.md"
        markdown_content = "".join(full_text)
        
        with open(markdown_file, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        print("✅ PDF conversion complete!")
        print(f"📄 Markdown file: {markdown_file}")
        print(f"📊 Pages processed: {total_pages}")
        print(f"📸 Images extracted: {image_count}")
        
        return markdown_file
                
    except Exception as e:
        print(f"❌ Error during PDF conversion: {e}")
        import traceback
        traceback.print_exc()
        raise


def split_markdown_by_sections(markdown_path):
    """
    Split markdown content into logical sections based on headers.
    
    Returns:
        List of dictionaries with 'title' and 'content'
    """
    print(f"📑 Analyzing markdown structure...")
    
    with open(markdown_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    sections = []
    current_section = None
    
    lines = content.split('\n')
    
    for line in lines:
        # Detect headers (# Header or ## Header)
        if line.startswith('#'):
            # Save previous section
            if current_section:
                sections.append(current_section)
            
            # Start new section
            level = len(line.split()[0])  # Count # symbols
            title = line.lstrip('#').strip()
            current_section = {
                'title': title,
                'level': level,
                'content': line + '\n'
            }
        elif current_section:
            current_section['content'] += line + '\n'
        else:
            # Content before first header
            if not sections:
                sections.append({
                    'title': 'Introduction',
                    'level': 1,
                    'content': line + '\n'
                })
    
    # Add last section
    if current_section:
        sections.append(current_section)
    
    print(f"✅ Found {len(sections)} sections")
    return sections


def extract_configurations_and_topologies(section):
    """
    Identify configuration blocks and topology references in a section.
    
    Returns:
        Dictionary with 'configs' and 'topology_images'
    """
    configs = []
    topology_images = []
    
    content = section['content']
    
    # Extract code blocks (configurations)
    code_pattern = r'```(.*?)```'
    code_blocks = re.findall(code_pattern, content, re.DOTALL)
    configs.extend(code_blocks)
    
    # Extract image references
    image_pattern = r'!\[([^\]]*)\]\(([^\)]+)\)'
    images = re.findall(image_pattern, content)
    
    for alt_text, img_path in images:
        if any(keyword in alt_text.lower() for keyword in ['topology', 'diagram', 'network', 'architecture']):
            topology_images.append({'alt': alt_text, 'path': img_path})
    
    return {
        'configs': configs,
        'topology_images': topology_images
    }


def generate_skill_file_content(section, extracted_data):
    """
    Generate a skill file in markdown format similar to BGP/VLAN templates.
    """
    title = section['title']
    content = section['content']
    
    skill_file = f"""# {title} - Skill File

## Feature Overview
{content[:500]}...

## Test Scenarios

### Functional Testing
1. **Basic Configuration**
   - Verify feature can be enabled/disabled
   - Validate default settings
   - Test configuration persistence

### Configuration Testing
"""
    
    # Add configuration examples if found
    if extracted_data['configs']:
        skill_file += "\n#### Configuration Examples\n"
        for idx, config in enumerate(extracted_data['configs'][:3], 1):
            skill_file += f"\n**Example {idx}:**\n```\n{config[:300]}...\n```\n"
    
    # Add topology references
    if extracted_data['topology_images']:
        skill_file += "\n### Topology Reference\n"
        for topo in extracted_data['topology_images']:
            skill_file += f"- {topo['alt']}: `{topo['path']}`\n"
    
    skill_file += """
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
"""
    
    return skill_file


def main():
    parser = argparse.ArgumentParser(description='Convert PDF concept guide to skill files')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--output-dir', default='./pdf_output', help='Output directory for markdown')
    parser.add_argument('--skill-dir', default='./data/default_skills', help='Directory to save skill files')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("📚 PDF to Skill Files Converter")
    print("=" * 60)
    
    # Step 1: Convert PDF to Markdown
    try:
        markdown_file = convert_pdf_to_markdown(args.pdf_path, args.output_dir)
    except Exception as e:
        print(f"❌ Failed to convert PDF: {e}")
        sys.exit(1)
    
    # Step 2: Split into sections
    sections = split_markdown_by_sections(markdown_file)
    
    # Step 3: Generate skill files for major sections
    skill_dir = Path(args.skill_dir)
    skill_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n🔨 Generating skill files...")
    
    generated_files = []
    
    for section in sections:
        # Only process level 1 and 2 headers (major sections)
        if section['level'] <= 2 and len(section['content']) > 200:
            # Extract configs and topologies
            extracted = extract_configurations_and_topologies(section)
            
            # Generate skill file content
            skill_content = generate_skill_file_content(section, extracted)
            
            # Create filename
            safe_title = re.sub(r'[^\w\s-]', '', section['title'])
            safe_title = re.sub(r'[-\s]+', '_', safe_title)
            filename = f"{safe_title}_Skill.md"
            
            skill_path = skill_dir / filename
            
            # Save skill file
            with open(skill_path, 'w', encoding='utf-8') as f:
                f.write(skill_content)
            
            generated_files.append(str(skill_path))
            print(f"  ✅ {filename}")
    
    print(f"\n{'=' * 60}")
    print(f"✨ Success! Generated {len(generated_files)} skill files")
    print(f"{'=' * 60}")
    print(f"📁 Markdown output: {markdown_file}")
    print(f"📁 Skill files: {skill_dir}")
    print(f"\nGenerated files:")
    for f in generated_files:
        print(f"  - {Path(f).name}")


if __name__ == "__main__":
    main()
