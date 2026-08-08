const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Parse test plan markdown and extract test cases
 * @param {string} markdown - Test plan content in markdown format
 * @returns {Array} Array of test case objects
 */
function parseTestCasesFromMarkdown(markdown) {
  const testCases = [];
  
  // Match test cases in format: #### 5.1.1 Verify ... or ### 5.1.1 Verify ...
  const lines = markdown.split('\n');
  
  let currentTestCase = null;
  let inTestSteps = false;
  let inExpectedResult = false;
  let inPreconditions = false;
  let currentCategory = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect category headers — support "### Category X: Name" and "### 6.1 Name" formats
    const categoryMatch = line.match(/^###\s+Category\s+\d+:\s+(.+?)$/i) ||
                          line.match(/^###\s+\d+\.\d+\s+(.+?)$/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
      continue;
    }
    
    // Check if this is a new test case header
    const testCaseMatch = line.match(/^#{3,4}\s+(\d+\.\d+\.\d+)\s+(.+?)$/);
    if (testCaseMatch) {
      // Save previous test case if exists
      if (currentTestCase) {
        testCases.push(currentTestCase);
      }
      
      // Start new test case
      currentTestCase = {
        id: testCaseMatch[1],
        title: testCaseMatch[2],
        summary: testCaseMatch[2],
        preconditions: [],
        stepActions: [],
        expectedResults: [],
        priority: null,
        keywords: [],
        category: currentCategory
      };
      
      inTestSteps = false;
      inExpectedResult = false;
      inPreconditions = false;
      continue;
    }
    
    if (!currentTestCase) continue;

    // Skip horizontal rules and reset state
    if (/^-{3,}$/.test(line) || /^\*{3,}$/.test(line)) {
      inTestSteps = false;
      inExpectedResult = false;
      inPreconditions = false;
      continue;
    }

    // Skip known non-content bold fields (topology, sanity, etc.)
    if (line.match(/^\*\*(Topology used|Sanity|Keywords?|Test Type|Test Level|Automation|Feature)\*?\*?:/i)) {
      // Extract keywords if present
      if (line.match(/^\*\*Keywords?\*?\*?:/i)) {
        const kwMatch = line.match(/:\s*(.+)$/);
        if (kwMatch) currentTestCase.keywords = kwMatch[1].split(/[,;]/).map(k => k.trim()).filter(Boolean);
      }
      inTestSteps = false;
      inExpectedResult = false;
      inPreconditions = false;
      continue;
    }
    
    // Check for section headers — support BOTH "**Name:**" and "**Name**:" formats
    if (line.match(/^\*\*(Test Steps|Methodology|Steps)\*?\*?\s*:/i)) {
      inTestSteps = true;
      inExpectedResult = false;
      inPreconditions = false;
      continue;
    }
    
    if (line.match(/^\*\*(Expected Results?|Pass Criteria|Expected Outcome)\*?\*?\s*:/i)) {
      inTestSteps = false;
      inExpectedResult = true;
      inPreconditions = false;
      continue;
    }
    
    if (line.match(/^\*\*Preconditions?\*?\*?\s*:/i)) {
      inTestSteps = false;
      inExpectedResult = false;
      inPreconditions = true;
      continue;
    }
    
    // Extract priority — handle "**Priority:** P1" and "**Priority**: P1"
    if (line.match(/^\*\*Priority\*?\*?\s*:/i)) {
      const priorityMatch = line.match(/P(\d+)/i);
      if (priorityMatch) {
        currentTestCase.priority = parseInt(priorityMatch[1]);
      } else {
        const numMatch = line.match(/:\s*(\d+)/);
        if (numMatch) currentTestCase.priority = parseInt(numMatch[1]);
      }
      inTestSteps = false;
      inExpectedResult = false;
      inPreconditions = false;
      continue;
    }

    // Any other bold-only header line resets collection state
    if (/^\*\*[^*]+\*\*\s*:/.test(line) && !inTestSteps && !inExpectedResult && !inPreconditions) {
      continue;
    }
    
    // Collect content based on current section
    if (inTestSteps && line.length > 0 && !line.startsWith('**')) {
      const cleanLine = line.replace(/^[-*]\s*/, '');
      if (cleanLine.length > 0) {
        currentTestCase.stepActions.push(cleanLine);
      }
    }
    
    if (inExpectedResult && line.length > 0 && !line.startsWith('**')) {
      const cleanLine = line.replace(/^[-*]\s*/, '');
      if (cleanLine.length > 0) {
        currentTestCase.expectedResults.push(cleanLine);
      }
    }
    
    if (inPreconditions && line.length > 0 && !line.startsWith('**')) {
      const cleanLine = line.replace(/^[-*]\s*/, '');
      if (cleanLine.length > 0) {
        currentTestCase.preconditions.push(cleanLine);
      }
    }
  }
  
  // Add last test case
  if (currentTestCase) {
    testCases.push(currentTestCase);
  }
  
  return testCases;
}

/**
 * Extract feature/module name and path from test plan
 * @param {string} markdown - Test plan content
 * @param {Object} metadata - Workflow metadata
 * @returns {Object} Module info with name and path
 */
function extractModuleInfo(markdown, metadata = {}) {
  // Extract feature name from title or JIRA story
  let featureName = metadata.feature_name || 'Test_Module';
  
  const titleMatch = markdown.match(/^#\s+(.+?)(?:\s+-\s+Test Plan)?$/m);
  if (titleMatch) {
    featureName = titleMatch[1].trim();
  }
  
  // Clean feature name for path
  const cleanName = featureName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Build test suite path similar to: XOS_Platform.BCM/Feature_Name/5_Testcases/5.X_Category
  const platform = 'XOS_Platform.BCM';
  const basePath = `${platform}/${cleanName}/5_Testcases`;
  
  return {
    name: featureName,
    cleanName: cleanName,
    basePath: basePath,
    project: 'Firmware'
  };
}

/**
 * Generate test suite path for a test case
 * @param {Object} testCase - Test case object
 * @param {string} basePath - Base path for module
 * @returns {string} Full test suite path
 */
function generateTestSuitePath(testCase, basePath) {
  // Extract section number (e.g., 5.2.1.1 -> 5.2.1)
  const parts = testCase.id.split('.');
  const sectionNum = parts.slice(0, 3).join('.');
  
  // Build category path component
  const categoryPath = testCase.category 
    ? testCase.category.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    : `Section_${sectionNum}`;
  
  return `${basePath}/${sectionNum}_${categoryPath}`;
}

/**
 * Generate Excel file in Switch Engine format from test plan markdown
 * @param {string} testPlanContent - Test plan markdown content
 * @param {string} outputPath - Path to save the Excel file
 * @param {Object} metadata - Additional metadata (workflow_id, jira_story_id, etc.)
 */
async function generateQTestExcel(testPlanContent, outputPath, metadata = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  
  // Define columns matching Switch Engine format
  worksheet.columns = [
    { header: 'Project', key: 'project', width: 12 },
    { header: 'Test Suite Path', key: 'test_suite_path', width: 100 },
    { header: 'Test Case Title', key: 'test_case_title', width: 70 },
    { header: 'Summary', key: 'summary', width: 70 },
    { header: 'Preconditions', key: 'preconditions', width: 50 },
    { header: 'Step Actions', key: 'step_actions', width: 100 },
    { header: 'Expected Results', key: 'expected_results', width: 80 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Keywords', key: 'keywords', width: 30 }
  ];
  
  // Parse test cases from markdown
  const testCases = parseTestCasesFromMarkdown(testPlanContent);
  const moduleInfo = extractModuleInfo(testPlanContent, metadata);
  
  console.log(`Parsed ${testCases.length} test cases for Excel export`);
  console.log(`Module: ${moduleInfo.name}, Base Path: ${moduleInfo.basePath}`);
  
  // Add test cases to worksheet
  testCases.forEach((testCase, index) => {
    const row = {
      project: moduleInfo.project,
      test_suite_path: generateTestSuitePath(testCase, moduleInfo.basePath),
      test_case_title: `${testCase.id}      ${testCase.title}`,
      summary: `${testCase.id}      ${testCase.title}`,
      preconditions: testCase.preconditions.length > 0 ? testCase.preconditions.join('\n') : null,
      step_actions: testCase.stepActions.join('\n'),
      expected_results: testCase.expectedResults.join('\n'),
      priority: testCase.priority,
      keywords: testCase.keywords.length > 0 ? testCase.keywords.join(', ') : null
    };
    
    worksheet.addRow(row);
  });
  
  // Style the header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' }
  };
  
  // Auto-fit rows with wrapped text
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { wrapText: true, vertical: 'top' };
    }
  });
  
  // Save the workbook
  await workbook.xlsx.writeFile(outputPath);
  
  console.log(`Excel file generated: ${outputPath}`);
  console.log(`Total test cases exported: ${testCases.length}`);
  
  return {
    filePath: outputPath,
    testCaseCount: testCases.length,
    moduleName: moduleInfo.name
  };
}

module.exports = {
  generateQTestExcel,
  parseTestCasesFromMarkdown,
  extractModuleInfo
};
