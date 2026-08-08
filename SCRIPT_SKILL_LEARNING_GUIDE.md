# Script Skill Learning Feature - User Guide

## Overview

The **Script Skill Learning** feature is an intelligent approach to TCL script generation that learns from your existing automation code before generating new test scripts. This ensures generated scripts follow the same patterns, use the same procedures, and maintain consistency with your established automation framework.

## Why Use This Feature?

Traditional script generation relies solely on generic framework knowledge. The Script Skill Learning feature:

1. **Learns from Your Code**: Analyzes existing automation folders to extract actual procedures, patterns, and dependencies used in your organization
2. **Phased Approach**: Generates sanity test cases first for validation before creating all scripts
3. **Iterative Improvement**: Incorporates your feedback from sanity script reviews into remaining script generation
4. **Consistency**: Ensures generated scripts match your team's coding standards and patterns

## How It Works - 5 Simple Steps

### Step 1: Select Functional Area

Browse available automation functional areas (e.g., ACL, VLAN, STP, BGP, etc.) from your existing automation repository.

**What it shows:**
- List of all functional test areas
- Number of procedures available per area (if indexed)

**Action:** Click on the area most similar to your current test plan

### Step 2: Analyze Area

The system scans the selected functional area to extract:
- **Library Files**: TCL lib files with reusable procedures
- **Test Scripts**: Existing automation scripts
- **Procedures**: All available procedures with signatures and parameters
- **Common Patterns**: Detected patterns like login sequences, verification methods, cleanup procedures
- **Dependencies**: Files that need to be sourced

**What you see:**
- Total counts of files, procedures, patterns found
- Detailed breakdown of each category
- First 20 procedures as preview

**Action:** Review the analysis and click "Generate Script Skill File"

### Step 3: Generate Script Skill File

Creates a JSON-based "skill file" containing:
- All learned procedures with signatures
- Common patterns and best practices
- Library file dependencies
- Usage guidelines
- Example script snippets

This skill file will be used to enhance all generated scripts.

**Action:** Click "Generate Sanity Test Scripts"

### Step 4: Generate & Review Sanity Scripts

**Sanity scripts generated:** 
The system identifies and generates scripts for:
- Test cases with "sanity" or "basic" in title
- Test cases for basic enable/disable functionality
- Test cases numbered `*.1` (typically basic configuration tests)
- Maximum 5 sanity test cases

**Why sanity first?**
- Quick validation of generation quality
- Early detection of any issues
- Opportunity to provide feedback before bulk generation

**What to do:**
1. Review the generated sanity scripts in the main Stage 7 editor
2. Run these scripts in your test environment (if possible)
3. Identify any issues or improvements needed
4. Enter feedback in the text area

**Example Feedback:**
```
- Use more descriptive result_h2 messages for each configuration step
- Add CheckKeyValue verification after every "configure" command
- Include "show" commands to verify state before unconfigure in cleanup
- Use specific procedure names from ACL_Lib.tcl instead of generic ones
- Add exSleep 2 after configuration changes before verification
```

**Action:** Provide feedback (optional) and click "Generate All Remaining Scripts"

### Step 5: Generate All Remaining Scripts

Using:
- The script skill file (learned patterns)
- Your feedback from sanity script review
- Framework documentation

The system generates scripts for all remaining automatable test cases.

**What happens:**
- Skips already-generated test cases
- Applies learned patterns from skill file
- Incorporates your review feedback
- Generates production-ready TCL scripts

**Result:** All test scripts generated and ready for review!

## Accessing the Feature

1. Navigate to **Stage 7: Script Generation**
2. Click the **"Learn from Automation"** button (orange/yellow button with lightbulb icon)
3. Follow the 5-step wizard

## API Endpoints

For developers or automation integration:

### GET /api/stage7/automation-areas
List all available functional areas

### POST /api/stage7/analyze-area
```json
{
  "area_name": "ACL"
}
```

### POST /api/stage7/generate-skill-file
```json
{
  "workflow_id": "uuid",
  "area_name": "ACL"
}
```

### POST /api/stage7/generate-sanity-scripts
```json
{
  "workflow_id": "uuid",
  "skill_file_id": "uuid"
}
```

### POST /api/stage7/generate-remaining-scripts
```json
{
  "workflow_id": "uuid",
  "skill_file_id": "uuid",
  "sanity_feedback": "Your feedback here..."
}
```

## Configuration

### Setting Automation Base Path

Default path: `C:\My_Projects\exos-tcl-automation\automation\Functionaltest`

To change, edit `backend/src/services/scriptSkillAnalyzer.js`:

```javascript
const scriptSkillAnalyzer = new ScriptSkillAnalyzer('YOUR_PATH_HERE');
```

### Automation Index

The feature can use `automation_index.json` for faster area listing.
Located at: `data/tcl_framework_docs/automation_index.json`

If not found, it falls back to filesystem scanning.

## Benefits

### 1. Higher Quality Scripts
- Uses real procedures from your codebase
- Follows established patterns
- Includes proper dependencies

### 2. Faster Development
- Automated learning eliminates manual procedure lookup
- Sanity-first approach catches issues early
- Feedback loop improves bulk generation

### 3. Consistency
- Scripts match your team's coding style
- Uses organization-specific procedures
- Maintains standard patterns across all scripts

### 4. Risk Reduction
- Validate with sanity scripts first
- Iterative feedback incorporation
- No "big bang" generation failures

## Best Practices

1. **Choose Similar Areas**: Select a functional area that closely matches your test plan for best results

2. **Review Sanity Scripts Thoroughly**: Take time to run and review sanity scripts - this pays off when generating remaining scripts

3. **Provide Specific Feedback**: The more detailed your feedback, the better the remaining scripts will be

4. **Iterative Use**: Use this feature multiple times for different test plan sections if they cover different functional areas

5. **Save Skill Files**: Generated skill files are saved to the database and can be reused for similar test plans

## Troubleshooting

### "No automation areas found"
- Check that the automation base path is correct
- Verify the path exists and contains functional test folders
- Check file/folder permissions

### "Analysis failed"
- Ensure the selected area folder exists
- Check for TCL files in the area
- Verify read permissions on files

### "No sanity test cases found"
- Your test plan may not have basic/sanity cases
- Try using regular "Generate All TCL Scripts" instead
- Or manually tag some test cases with "sanity" or "basic" in the title

### Scripts generated without learned patterns
- Verify skill file was created successfully
- Check that skill_file_id was passed to generation endpoints
- Review browser console for any errors

## File Structure

```
backend/
  src/
    services/
      scriptSkillAnalyzer.js        # Main analyzer service
    routes/
      stage7.js                      # API endpoints

frontend/
  src/
    components/
      stages/
        Stage7.jsx                   # Main script generation page
        ScriptSkillLearning.jsx      # Learning wizard component

data/
  script_skills/                     # Generated skill files
  tcl_framework_docs/
    automation_index.json            # Pre-indexed automation areas (optional)
```

## Future Enhancements

Planned features:
- [ ] Multi-area learning (combine patterns from multiple areas)
- [ ] Pattern voting/ranking based on usage frequency
- [ ] Custom pattern templates
- [ ] Skill file versioning and comparison
- [ ] Integration with Git to track automation repository changes
- [ ] ML-based pattern detection improvements

## Support

For issues or questions:
1. Check the browser console for detailed error messages
2. Review backend logs for API errors
3. Verify file paths and permissions
4. Check the audit trail in the database for generation history

---

**Created:** 2026-08-01  
**Version:** 1.0  
**Feature:** Script Skill Learning for TCL Automation
