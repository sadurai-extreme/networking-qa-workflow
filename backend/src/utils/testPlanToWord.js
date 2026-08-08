/**
 * Test Plan to Word Document Converter
 * 
 * Generates Word (.docx) documents from markdown test plans
 * Complementary to testPlanToExcel.js for Switch Engine format
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate Word document from test plan markdown
 * Note: This generates a Python script that uses python-docx to create the Word file
 * 
 * @param {string} testPlanContent - Markdown content of test plan
 * @param {string} outputPath - Full path for output .docx file
 * @param {Object} metadata - Workflow metadata (jira_id, feature_name, etc.)
 * @returns {Promise<Object>} Result with file path and test case count
 */
async function generateTestPlanWord(testPlanContent, outputPath, metadata = {}) {
  const { execSync } = require('child_process');
  
  try {
    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create Python script to generate Word document
    const pythonScript = createWordGeneratorScript(testPlanContent, outputPath, metadata);
    const scriptPath = path.join(dir, `_temp_word_gen_${Date.now()}.py`);
    
    fs.writeFileSync(scriptPath, pythonScript, 'utf8');
    
    // Execute Python script to generate Word document
    console.log(`Generating Word document: ${outputPath}`);
    execSync(`python3 "${scriptPath}"`, { encoding: 'utf8' });
    
    // Clean up temp script
    fs.unlinkSync(scriptPath);
    
    // Count test cases
    const testCaseCount = (testPlanContent.match(/^#{4}\s+\d+\.\d+\.\d+/gm) || []).length;
    
    console.log(`Word document generated: ${outputPath}`);
    console.log(`Total test cases: ${testCaseCount}`);
    
    return {
      filePath: outputPath,
      testCaseCount: testCaseCount,
      featureName: metadata.feature_name || 'Test Plan'
    };
    
  } catch (error) {
    console.error('Error generating Word document:', error.message);
    throw new Error(`Failed to generate Word document: ${error.message}`);
  }
}

/**
 * Create Python script for Word document generation
 */
function createWordGeneratorScript(markdown, outputPath, metadata) {
  // Escape special characters for Python triple-quoted string
  const escapedMarkdown = markdown
    .replace(/\\/g, '\\\\')
    .replace(/"""/g, '\\"\\"\\"')
    .replace(/\n/g, '\\n');
  
  const jiraId = (metadata.jira_story_id || '').replace(/'/g, "\\'");
  const featureName = (metadata.feature_name || 'Feature Test Plan').replace(/'/g, "\\'");
  const release = (metadata.jira_release || '').replace(/'/g, "\\'");
  const safePath = outputPath.replace(/\\/g, '/');
  
  // Build Python script using string concatenation to avoid JS escape-sequence conflicts
  const lines = [
    '#!/usr/bin/env python3',
    '# -*- coding: utf-8 -*-',
    'import sys',
    'import datetime',
    'from docx import Document',
    'from docx.shared import Inches, Pt, RGBColor',
    'from docx.enum.text import WD_ALIGN_PARAGRAPH',
    '',
    'def add_inline_bold(paragraph, text):',
    '    """Add text to paragraph with inline **bold** support."""',
    '    remaining = text',
    '    while remaining:',
    '        start = remaining.find("**")',
    '        if start == -1:',
    '            paragraph.add_run(remaining)',
    '            break',
    '        if start > 0:',
    '            paragraph.add_run(remaining[:start])',
    '        end = remaining.find("**", start + 2)',
    '        if end == -1:',
    '            paragraph.add_run(remaining)',
    '            break',
    '        run = paragraph.add_run(remaining[start+2:end])',
    '        run.bold = True',
    '        remaining = remaining[end+2:]',
    '',
    'def is_numbered_list(line):',
    '    """Check if line is a numbered list item like 1. or 2) etc."""',
    '    parts = line.split(None, 1)',
    '    if not parts:',
    '        return False',
    '    token = parts[0]',
    '    return (token.endswith(".") or token.endswith(")")) and token[:-1].isdigit()',
    '',
    'def strip_number(line):',
    '    """Remove leading number from list item."""',
    '    parts = line.split(None, 1)',
    '    return parts[1] if len(parts) > 1 else ""',
    '',
    'def parse_markdown_to_word(markdown_text, output_path, jira_id, feature_name, release):',
    '    doc = Document()',
    '',
    '    style = doc.styles["Normal"]',
    '    style.font.name = "Calibri"',
    '    style.font.size = Pt(11)',
    '',
    '    title = doc.add_heading(feature_name, 0)',
    '    title.alignment = WD_ALIGN_PARAGRAPH.CENTER',
    '',
    '    if jira_id or release:',
    '        doc.add_heading("Release Information", level=2)',
    '        table = doc.add_table(rows=3, cols=2)',
    '        table.style = "Light Grid Accent 1"',
    '        table.rows[0].cells[0].text = "JIRA Story"',
    '        table.rows[0].cells[1].text = jira_id',
    '        table.rows[1].cells[0].text = "Release"',
    '        table.rows[1].cells[1].text = release',
    '        table.rows[2].cells[0].text = "Date"',
    '        table.rows[2].cells[1].text = datetime.datetime.now().strftime("%Y-%m-%d")',
    '        doc.add_paragraph()',
    '',
    '    in_code_block = False',
    '    for line in markdown_text.split("\\n"):',
    '        s = line.strip()',
    '        if not s:',
    '            if not in_code_block:',
    '                doc.add_paragraph()',
    '            continue',
    '        if s.startswith("```") or s.startswith("~~~"):',
    '            in_code_block = not in_code_block',
    '            continue',
    '        if in_code_block:',
    '            p = doc.add_paragraph(line, style="Normal")',
    '            p.paragraph_format.left_indent = Inches(0.5)',
    '            if p.runs:',
    '                p.runs[0].font.name = "Courier New"',
    '                p.runs[0].font.size = Pt(9)',
    '            continue',
    '        if s.startswith("#### "):',
    '            h = doc.add_heading(s[5:], level=4)',
    '            if h.runs:',
    '                h.runs[0].font.color.rgb = RGBColor(0, 51, 153)',
    '        elif s.startswith("### "):',
    '            doc.add_heading(s[4:], level=3)',
    '        elif s.startswith("## "):',
    '            doc.add_heading(s[3:], level=2)',
    '        elif s.startswith("# "):',
    '            doc.add_heading(s[2:], level=1)',
    '        elif s.startswith("- ") or s.startswith("* "):',
    '            p = doc.add_paragraph(style="List Bullet")',
    '            add_inline_bold(p, s[2:])',
    '        elif is_numbered_list(s):',
    '            p = doc.add_paragraph(style="List Number")',
    '            add_inline_bold(p, strip_number(s))',
    '        elif s.startswith("---") or s.startswith("***"):',
    '            doc.add_paragraph("_" * 50)',
    '        else:',
    '            p = doc.add_paragraph()',
    '            add_inline_bold(p, s)',
    '',
    '    doc.save(output_path)',
    '    print("Word document saved: " + output_path)',
    '',
    'markdown_content = """' + escapedMarkdown + '"""',
    `parse_markdown_to_word(markdown_content, r"${safePath}", '${jiraId}', '${featureName}', '${release}')`,
  ];
  
  return lines.join('\n');
}

module.exports = {
  generateTestPlanWord
};
