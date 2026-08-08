# PDF to Skill Files Converter

Automatically convert PDF concept guides into structured skill files for the NOS QA Workflow.

## Features

✅ **Full PDF Extraction**
- Extracts all text content
- Preserves images (topologies, diagrams)
- OCR for configuration screenshots
- Maintains document structure

✅ **Intelligent Processing**
- Splits content by sections
- Identifies configuration blocks
- Detects topology diagrams
- Generates structured skill files

✅ **Auto-Generated Skill Files**
- Similar format to BGP/VLAN templates
- Includes test scenarios
- References configurations and topologies
- Ready for Stage 2 workflow

## Installation

Already installed! ✅ marker-pdf is ready to use.

## Usage

### Basic Usage

```bash
cd c:\My_Projects\networking-qa-workflow

python scripts\pdf_to_skillfiles.py "path\to\your\concept_guide.pdf"
```

### Advanced Options

```bash
# Specify custom output directories
python scripts\pdf_to_skillfiles.py "concept_guide.pdf" \
  --output-dir "./pdf_extracts" \
  --skill-dir "./data/default_skills"
```

### Parameters

- `pdf_path` - Path to your PDF concept guide (required)
- `--output-dir` - Where to save extracted markdown (default: `./pdf_output`)
- `--skill-dir` - Where to save skill files (default: `./data/default_skills`)

## Example

```bash
# Convert VLAN Concept Guide
python scripts\pdf_to_skillfiles.py "C:\Documents\VLAN_Concept_Guide.pdf"
```

**Output:**
```
📚 PDF to Skill Files Converter
============================================================
🔄 Converting PDF to Markdown: VLAN_Concept_Guide.pdf
✅ PDF conversion complete!
📄 Markdown file: pdf_output/VLAN_Concept_Guide.md
📑 Analyzing markdown structure...
✅ Found 15 sections

🔨 Generating skill files...
  ✅ VLAN_Basics_Skill.md
  ✅ VLAN_Tagging_Skill.md
  ✅ VLAN_Trunking_Skill.md
  ✅ Inter_VLAN_Routing_Skill.md
  ✅ VLAN_Security_Skill.md

============================================================
✨ Success! Generated 5 skill files
============================================================
```

## What Gets Extracted

### 1. Text Content
- All paragraphs and sections
- Headers and subheaders
- Lists and tables

### 2. Images
- Network topology diagrams
- Configuration screenshots (with OCR)
- Flowcharts and diagrams
- Saved in `pdf_output/<pdf_name>_images/`

### 3. Configurations
- CLI command blocks
- Configuration file snippets
- Code examples

## Generated Skill File Structure

Each skill file includes:

```markdown
# Feature Name - Skill File

## Feature Overview
[Extracted from PDF section]

## Test Scenarios

### Functional Testing
- Basic configuration tests
- Validation steps

### Configuration Testing
[Includes extracted configurations]

### Topology Reference
[Links to extracted topology images]

### Interoperability Testing
### Negative Testing
### Performance Testing

## Expected Results
## References
```

## Integration with Stage 2

Generated skill files automatically appear in **Stage 2: Skill File Generation** under "Default Skill Files".

## Troubleshooting

### "marker_single command not found"
```bash
pip install marker-pdf
```

### "No markdown file generated"
- Check PDF is not password-protected
- Ensure PDF contains readable text (not scanned images only)
- Try with `--batch_multiplier 1` for faster processing

### Large PDF taking too long
```bash
# Process specific pages only (requires manual PDF split)
python scripts\pdf_to_skillfiles.py "chapter3.pdf"
```

## Tips for Best Results

1. **Use text-based PDFs** - Better results than scanned documents
2. **Clean PDFs** - Remove unnecessary pages (cover, TOC)
3. **Chapter-by-chapter** - Split large PDFs into chapters first
4. **Review output** - Always review generated skill files
5. **Manual editing** - Fine-tune the generated content in Stage 2

## Next Steps

After generating skill files:

1. Review generated files in `data/default_skills/`
2. Go to **Stage 2** in the QA Workflow
3. Select and view the new skill files
4. Use them as templates for new test plans

---

**Created:** 2026-06-29  
**Tool:** Marker PDF (marker-pdf)  
**Python:** 3.13
