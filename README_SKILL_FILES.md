# Skill File Generation System

## Overview
The system now includes **59 pre-generated skill file templates** extracted from the Switch Engine v33.6.1 User Guide. These templates serve as reference structures for generating custom skill files for specific features.

## How It Works

### 1. Default Skill Files (Templates)
Located in: `data/default_skills/`

**Generated from Table of Contents:**
- ACLs_Skill.md
- BGP_Skill.md
- OSPF_Skill.md
- VLANs_Skill.md
- Security_Skill.md
- ... and 54 more

Each template includes:
- Feature overview
- Test scenario patterns
- Configuration testing guidelines
- Interoperability requirements
- Performance and security testing approaches

### 2. Stage 2: Skill File Generation

When generating a custom skill file:

1. **Select Relevant Templates**: Choose default skill files that match your feature (e.g., for BGP testing, select "BGP_Skill.md")

2. **Upload Documents**: Provide up to 3 reference documents:
   - Current Feature Specification
   - Existing Feature Specification (for comparison)
   - Existing Test Plan

3. **Generate with LLM**: The system sends to Ollama:
   - Selected template skill files (as structural reference)
   - Your uploaded documents
   - Jira story details

4. **Result**: Custom skill file combining:
   - Template structure and depth
   - Your specific feature requirements
   - Test scenarios adapted to your story

### 3. Benefits

**Consistency**: All skill files follow the same comprehensive structure

**Quality**: Templates derived from official documentation ensure coverage

**Efficiency**: No need to write from scratch - start with proven patterns

**Customization**: Templates guide generation but content is specific to your feature

## Adding New PDF Guides

To process a new PDF guide:

```bash
# Step 1: Extract PDF to markdown
python scripts/pdf_to_skillfiles.py "path/to/guide.pdf"

# Step 2: Generate skill files from Table of Contents
python scripts/toc_to_skillfiles.py "pdf_output/guide.md" --output-dir "data/default_skills" --clean
```

## File Structure

```
networking-qa-workflow/
├── data/
│   └── default_skills/           # 59 template skill files
│       ├── BGP_Skill.md
│       ├── VLANs_Skill.md
│       └── ...
├── pdf_output/                   # Extracted PDF content
│   ├── Switch_Engine_33_6_1_User_Guide.md
│   └── Switch_Engine_33_6_1_User_Guide_images/
├── scripts/
│   ├── pdf_to_skillfiles.py     # Extract PDF to markdown
│   └── toc_to_skillfiles.py     # Generate skill files from TOC
└── backend/src/routes/
    └── stage2.js                 # Skill generation endpoint
```

## API Endpoint

**POST** `/api/stage2/generate`

**Request (multipart/form-data):**
```javascript
{
  workflow_id: string,
  jira_story: JSON,
  current_feature_spec: File (optional),
  existing_feature_spec: File (optional),
  existing_test_plan: File (optional),
  selected_skill_files: JSON array (optional) // ["BGP_Skill.md", "Security_Skill.md"]
}
```

**Response:**
```javascript
{
  id: string,
  content: string,  // Generated skill file in markdown
  filename: string
}
```

## Example Workflow

### Testing a new BGP feature:

1. Navigate to Stage 2
2. Select templates:
   - ✓ BGP_Skill.md
   - ✓ Routing_Policies_Skill.md
   - ✓ IPv4_Unicast_Routing_Skill.md
3. Upload:
   - Current Feature Specification: "BGP_Community_Support_v2.pdf"
   - Existing Test Plan: "BGP_v1_Tests.xlsx"
4. Click "Generate Skill File with LLM"
5. Review and customize generated content
6. Approve and proceed to Stage 3

## Notes

- Templates are read-only (first 3000 characters sent to LLM for context)
- Can select multiple templates for comprehensive coverage
- Generated skill files are stored in database and filesystem
- Approved skill files are immutable (new version created on regeneration)

---

**Last Updated:** June 29, 2026  
**Version:** 1.0
