/**
 * Test Plan Validator
 * 
 * Validates test plan content against organizational standards
 * to ensure consistent output regardless of LLM changes.
 * 
 * Validation Categories:
 * 1. Structure - Required sections present
 * 2. Format - Proper markdown, numbering, headers
 * 3. Test Cases - Correct format, required fields
 * 4. Quality - CLI commands, no placeholders, sanity flags
 */

class TestPlanValidator {
  constructor(standards = null) {
    // Load standards from config or use defaults
    this.standards = standards || this.getDefaultStandards();
  }

  getDefaultStandards() {
    return {
      format: {
        testCaseNumbering: /^5\.\d+\.\d+\.\d+/,
        sectionHeaders: ['Methodology', 'Pass Criteria'],
        deprecatedHeaders: ['Test Steps', 'Expected Results'],
        cliPrefix: 'CLI :',
        examplePrefix: 'Eg :',
        stepFormat: /^[a-z]\.\s/m,
        priorityValues: ['P1', 'P2', 'P3'],
        sanityValues: ['Yes', 'No']
      },
      structure: {
        requiredSections: [
          'Introduction',
          'Test Environment',
          'Test Cases'
        ]
      },
      quality: {
        minTestCases: 5,
        sanityPercentageMin: 30,
        sanityPercentageMax: 70,
        forbiddenPlaceholders: ['TBD', 'TODO', '[Fill in]', 'XXX', 'placeholder'],
        requiredTestCaseFields: ['Topology used', 'Methodology', 'Pass Criteria', 'Priority', 'Sanity']
      }
    };
  }

  /**
   * Main validation function
   * @param {string} content - Test plan markdown content
   * @returns {Object} Validation result
   */
  validate(content) {
    const result = {
      valid: true,
      score: 100,
      errors: [],
      warnings: [],
      issues: {
        critical: [],
        major: [],
        minor: []
      },
      statistics: {},
      metadata: {
        validatedAt: new Date().toISOString(),
        standardsVersion: '2.0'
      }
    };

    // Run all validation checks
    this.validateStructure(content, result);
    this.validateFormat(content, result);
    this.validateTestCases(content, result);
    this.validateQuality(content, result);
    
    // Calculate statistics
    result.statistics = this.calculateStatistics(content);
    
    // Calculate final score
    result.score = this.calculateScore(result);
    result.valid = result.score >= 60 && result.issues.critical.length === 0;

    return result;
  }

  /**
   * Validate document structure
   */
  validateStructure(content, result) {
    const missingSections = [];
    
    this.standards.structure.requiredSections.forEach(section => {
      const sectionRegex = new RegExp(`##\\s+.*${section}`, 'i');
      if (!sectionRegex.test(content)) {
        missingSections.push(section);
      }
    });

    if (missingSections.length > 0) {
      result.issues.major.push({
        type: 'missing_sections',
        message: `Missing required sections: ${missingSections.join(', ')}`,
        severity: 'major',
        impact: -10
      });
      result.warnings.push(`Missing sections: ${missingSections.join(', ')}`);
    }
  }

  /**
   * Validate test plan format
   */
  validateFormat(content, result) {
    // Check for deprecated section headers
    const deprecatedHeaders = this.standards.format.deprecatedHeaders;
    deprecatedHeaders.forEach(header => {
      const headerRegex = new RegExp(`\\*\\*${header}\\*\\*:`, 'g');
      const matches = content.match(headerRegex);
      if (matches && matches.length > 0) {
        result.issues.major.push({
          type: 'deprecated_headers',
          message: `Using deprecated header "${header}" (${matches.length} occurrences). Use modern headers: ${this.standards.format.sectionHeaders.join(', ')}`,
          severity: 'major',
          impact: -15,
          occurrences: matches.length
        });
        result.warnings.push(`Found ${matches.length} deprecated "${header}" headers`);
      }
    });

    // Check for proper section headers
    const requiredHeaders = this.standards.format.sectionHeaders;
    requiredHeaders.forEach(header => {
      const headerRegex = new RegExp(`\\*\\*${header}\\*\\*:`, 'g');
      const matches = content.match(headerRegex);
      if (!matches || matches.length === 0) {
        result.issues.minor.push({
          type: 'missing_standard_header',
          message: `No test cases found using standard "${header}" header`,
          severity: 'minor',
          impact: -5
        });
      }
    });
  }

  /**
   * Validate individual test cases
   */
  validateTestCases(content, result) {
    // Extract test cases using multiple patterns
    const testCasePattern = /####\s+(5\.\d+\.\d+\.\d+.*?)(?=####\s+5\.\d+|$)/gs;
    const testCases = content.match(testCasePattern) || [];

    if (testCases.length < this.standards.quality.minTestCases) {
      result.issues.critical.push({
        type: 'insufficient_test_cases',
        message: `Only ${testCases.length} test cases found. Minimum required: ${this.standards.quality.minTestCases}`,
        severity: 'critical',
        impact: -30
      });
      result.errors.push(`Insufficient test cases: ${testCases.length} < ${this.standards.quality.minTestCases}`);
    }

    testCases.forEach((testCase, index) => {
      this.validateSingleTestCase(testCase, index + 1, result);
    });
  }

  /**
   * Validate a single test case
   */
  validateSingleTestCase(testCase, caseNumber, result) {
    const issues = [];

    // Check numbering format
    const numberMatch = testCase.match(/^####\s+(5\.\d+\.\d+\.\d+)/);
    if (!numberMatch) {
      issues.push(`Test case ${caseNumber}: Invalid numbering format (should be 5.x.x.x)`);
      result.issues.major.push({
        type: 'invalid_numbering',
        testCase: caseNumber,
        message: 'Invalid test case numbering',
        severity: 'major',
        impact: -8
      });
    }

    // Check required fields
    this.standards.quality.requiredTestCaseFields.forEach(field => {
      const fieldRegex = new RegExp(`\\*\\*${field}\\*\\*:`, 'i');
      if (!fieldRegex.test(testCase)) {
        issues.push(`Test case ${caseNumber}: Missing required field "${field}"`);
        result.issues.major.push({
          type: 'missing_field',
          testCase: caseNumber,
          field: field,
          message: `Missing required field: ${field}`,
          severity: 'major',
          impact: -10
        });
      }
    });

    // Check for sanity flag
    const sanityMatch = testCase.match(/\*\*Sanity\*\*:\s*(Yes|No)/i);
    if (!sanityMatch) {
      issues.push(`Test case ${caseNumber}: Missing or invalid Sanity flag`);
      result.issues.major.push({
        type: 'missing_sanity',
        testCase: caseNumber,
        message: 'Missing Sanity flag',
        severity: 'major',
        impact: -10
      });
    }

    // Check for priority
    const priorityMatch = testCase.match(/\*\*Priority\*\*:\s*(P[123])/i);
    if (!priorityMatch) {
      issues.push(`Test case ${caseNumber}: Missing or invalid Priority`);
      result.issues.major.push({
        type: 'missing_priority',
        testCase: caseNumber,
        message: 'Missing or invalid Priority',
        severity: 'major',
        impact: -8
      });
    }

    // Check for CLI commands (should have at least one)
    const cliPattern = /CLI\s*:\s*#/g;
    const cliMatches = testCase.match(cliPattern);
    if (!cliMatches || cliMatches.length === 0) {
      result.issues.minor.push({
        type: 'no_cli_commands',
        testCase: caseNumber,
        message: 'No CLI commands found',
        severity: 'minor',
        impact: -3
      });
    }

    // Add issues to warnings
    if (issues.length > 0) {
      result.warnings.push(...issues);
    }
  }

  /**
   * Validate overall quality
   */
  validateQuality(content, result) {
    // Check for placeholders
    this.standards.quality.forbiddenPlaceholders.forEach(placeholder => {
      const placeholderRegex = new RegExp(placeholder, 'gi');
      const matches = content.match(placeholderRegex);
      if (matches && matches.length > 0) {
        result.issues.critical.push({
          type: 'placeholder_found',
          message: `Found placeholder text "${placeholder}" (${matches.length} occurrences)`,
          severity: 'critical',
          impact: -25,
          occurrences: matches.length
        });
        result.errors.push(`Placeholder "${placeholder}" found ${matches.length} times`);
      }
    });

    // Check sanity distribution
    const sanityYes = (content.match(/\*\*Sanity\*\*:\s*Yes/gi) || []).length;
    const sanityNo = (content.match(/\*\*Sanity\*\*:\s*No/gi) || []).length;
    const totalSanityFlags = sanityYes + sanityNo;

    if (totalSanityFlags > 0) {
      const sanityPercentage = (sanityYes / totalSanityFlags) * 100;
      
      if (sanityPercentage < this.standards.quality.sanityPercentageMin) {
        result.issues.minor.push({
          type: 'low_sanity_coverage',
          message: `Only ${sanityPercentage.toFixed(1)}% tests marked as Sanity (recommended: ${this.standards.quality.sanityPercentageMin}-${this.standards.quality.sanityPercentageMax}%)`,
          severity: 'minor',
          impact: -5
        });
        result.warnings.push(`Low sanity test coverage: ${sanityPercentage.toFixed(1)}%`);
      } else if (sanityPercentage > this.standards.quality.sanityPercentageMax) {
        result.issues.minor.push({
          type: 'high_sanity_coverage',
          message: `${sanityPercentage.toFixed(1)}% tests marked as Sanity (recommended: ${this.standards.quality.sanityPercentageMin}-${this.standards.quality.sanityPercentageMax}%)`,
          severity: 'minor',
          impact: -5
        });
        result.warnings.push(`High sanity test coverage: ${sanityPercentage.toFixed(1)}%`);
      }
    }
  }

  /**
   * Calculate statistics
   */
  calculateStatistics(content) {
    const stats = {
      testCaseCount: 0,
      sanityTestCount: 0,
      p1TestCount: 0,
      p2TestCount: 0,
      cliCommandCount: 0,
      sectionCount: 0,
      characterCount: content.length,
      lineCount: content.split('\n').length
    };

    // Count test cases
    const testCasePattern = /####\s+5\.\d+\.\d+\.\d+/g;
    stats.testCaseCount = (content.match(testCasePattern) || []).length;

    // Count sanity tests
    stats.sanityTestCount = (content.match(/\*\*Sanity\*\*:\s*Yes/gi) || []).length;

    // Count priorities
    stats.p1TestCount = (content.match(/\*\*Priority\*\*:\s*P1/gi) || []).length;
    stats.p2TestCount = (content.match(/\*\*Priority\*\*:\s*P2/gi) || []).length;

    // Count CLI commands
    stats.cliCommandCount = (content.match(/CLI\s*:\s*#/g) || []).length;

    // Count sections
    stats.sectionCount = (content.match(/^##\s+/gm) || []).length;

    // Calculate percentages
    if (stats.testCaseCount > 0) {
      stats.sanityPercentage = ((stats.sanityTestCount / stats.testCaseCount) * 100).toFixed(1);
      stats.p1Percentage = ((stats.p1TestCount / stats.testCaseCount) * 100).toFixed(1);
      stats.avgCliCommandsPerTest = (stats.cliCommandCount / stats.testCaseCount).toFixed(1);
    }

    return stats;
  }

  /**
   * Calculate overall validation score
   */
  calculateScore(result) {
    let score = 100;

    // Deduct points for issues
    result.issues.critical.forEach(issue => {
      score += issue.impact || -25;
    });

    result.issues.major.forEach(issue => {
      score += issue.impact || -10;
    });

    result.issues.minor.forEach(issue => {
      score += issue.impact || -5;
    });

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get validation summary for display
   */
  getSummary(validationResult) {
    const { valid, score, issues, statistics, errors, warnings } = validationResult;

    return {
      status: valid ? 'PASSED' : 'FAILED',
      score: score,
      grade: this.getGrade(score),
      totalIssues: issues.critical.length + issues.major.length + issues.minor.length,
      criticalIssues: issues.critical.length,
      majorIssues: issues.major.length,
      minorIssues: issues.minor.length,
      testCases: statistics.testCaseCount,
      sanityTests: statistics.sanityTestCount,
      errors: errors.length,
      warnings: warnings.length,
      recommendation: this.getRecommendation(score, issues)
    };
  }

  /**
   * Get letter grade
   */
  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Get recommendation based on validation results
   */
  getRecommendation(score, issues) {
    if (issues.critical.length > 0) {
      return 'CRITICAL ISSUES FOUND - Must fix before approval';
    }
    if (score < 60) {
      return 'BELOW STANDARD - Regeneration recommended';
    }
    if (score < 80) {
      return 'NEEDS IMPROVEMENT - Review and fix issues';
    }
    if (score < 90) {
      return 'GOOD - Minor improvements suggested';
    }
    return 'EXCELLENT - Meets all standards';
  }
}

module.exports = TestPlanValidator;
