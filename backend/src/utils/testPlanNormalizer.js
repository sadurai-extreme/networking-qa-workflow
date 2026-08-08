/**
 * Test Plan Normalizer
 * 
 * Auto-corrects common format deviations to ensure consistent output
 * regardless of LLM changes. Applies organizational standards.
 * 
 * Normalization Rules:
 * 1. Enforce 5.x.x.x numbering
 * 2. Replace deprecated headers with standard ones
 * 3. Fix CLI command format
 * 4. Ensure proper step formatting
 * 5. Add missing sanity flags (default: No)
 * 6. Fix priority format
 */

class TestPlanNormalizer {
  constructor(standards = null) {
    this.standards = standards || this.getDefaultStandards();
    this.changes = [];
  }

  getDefaultStandards() {
    return {
      format: {
        sectionHeaders: {
          'Test Steps': 'Methodology',
          'Expected Results': 'Pass Criteria',
          'Test Procedure': 'Methodology',
          'Expected Outcome': 'Pass Criteria'
        },
        cliPrefix: 'CLI :',
        examplePrefix: 'Eg :',
        priorityFormat: /P[123]/,
        sanityFormat: /(Yes|No)/
      }
    };
  }

  /**
   * Main normalization function
   * @param {string} content - Test plan markdown content
   * @returns {Object} {content: normalized content, changes: array of changes made}
   */
  normalize(content) {
    this.changes = [];
    let normalized = content;

    // Run all normalizations in sequence
    normalized = this.enforceNumbering(normalized);
    normalized = this.replaceSectionHeaders(normalized);
    normalized = this.enforceCliFormat(normalized);
    normalized = this.enforceStepFormat(normalized);
    normalized = this.addMissingSanityFlags(normalized);
    normalized = this.fixPriorityFormat(normalized);
    normalized = this.removeExtraWhitespace(normalized);

    return {
      content: normalized,
      changes: this.changes,
      changesCount: this.changes.length
    };
  }

  /**
   * Enforce 5.x.x.x test case numbering
   */
  enforceNumbering(content) {
    let normalized = content;
    let changesMade = 0;

    // Fix common numbering issues
    // TC-001 → 5.1.1.1
    normalized = normalized.replace(/####\s+TC-(\d+)/g, (match, num) => {
      changesMade++;
      this.changes.push(`Changed TC-${num} to 5.1.1.${num} format`);
      return `#### 5.1.1.${num}`;
    });

    // Test Case 1: → 5.1.1.1
    normalized = normalized.replace(/####\s+Test Case (\d+):/g, (match, num) => {
      changesMade++;
      this.changes.push(`Changed "Test Case ${num}:" to 5.1.1.${num} format`);
      return `#### 5.1.1.${num}`;
    });

    // Ensure proper spacing after test case number
    normalized = normalized.replace(/(####\s+5\.\d+\.\d+\.\d+)([^\s])/g, '$1      $2');

    if (changesMade > 0) {
      console.log(`Normalized ${changesMade} test case numbers`);
    }

    return normalized;
  }

  /**
   * Replace deprecated section headers with standard ones
   */
  replaceSectionHeaders(content) {
    let normalized = content;
    const headerReplacements = this.standards.format.sectionHeaders;

    Object.entries(headerReplacements).forEach(([oldHeader, newHeader]) => {
      const oldPattern = new RegExp(`\\*\\*${oldHeader}\\*\\*:`, 'g');
      const matches = normalized.match(oldPattern);
      
      if (matches && matches.length > 0) {
        normalized = normalized.replace(oldPattern, `**${newHeader}**:`);
        this.changes.push(`Replaced ${matches.length} "${oldHeader}" headers with "${newHeader}"`);
        console.log(`Replaced ${matches.length} deprecated "${oldHeader}" headers`);
      }
    });

    return normalized;
  }

  /**
   * Enforce CLI command format
   */
  enforceCliFormat(content) {
    let normalized = content;
    let changesMade = 0;

    // Fix various CLI command formats
    const cliPatterns = [
      // "CLI:" → "CLI :"
      { pattern: /CLI:([^\s])/g, replacement: 'CLI : $1', desc: 'Added space after CLI:' },
      // "cli :" → "CLI :"
      { pattern: /\bcli\s*:/gi, replacement: 'CLI :', desc: 'Capitalized CLI' },
      // "Command:" → "CLI :"
      { pattern: /\bCommand\s*:/gi, replacement: 'CLI :', desc: 'Changed Command: to CLI :' },
      // "# command" → "CLI : #command" (if not already prefixed)
      { pattern: /^([a-z]\.\s+.*)\n(#[a-z]+.*)/gmi, replacement: '$1\nCLI : $2', desc: 'Added CLI : prefix to commands' }
    ];

    cliPatterns.forEach(({ pattern, replacement, desc }) => {
      const before = normalized;
      normalized = normalized.replace(pattern, replacement);
      if (before !== normalized) {
        changesMade++;
        this.changes.push(desc);
      }
    });

    if (changesMade > 0) {
      console.log(`Normalized ${changesMade} CLI command formats`);
    }

    return normalized;
  }

  /**
   * Enforce lettered step format (a., b., c.)
   */
  enforceStepFormat(content) {
    let normalized = content;
    let changesMade = 0;

    // Convert numbered steps to lettered steps within Methodology sections
    // Find Methodology sections
    const methodologyPattern = /\*\*Methodology\*\*:(.*?)(?=\*\*Pass Criteria\*\*:|$)/gs;
    
    normalized = normalized.replace(methodologyPattern, (match) => {
      let section = match;
      
      // Replace numbered steps (1., 2., 3.) with lettered (a., b., c.)
      const numberPattern = /^(\s*)(\d+)\.\s+/gm;
      let stepNumber = 0;
      
      section = section.replace(numberPattern, (stepMatch, spaces, num) => {
        const letter = String.fromCharCode(97 + stepNumber); // a, b, c, ...
        stepNumber++;
        changesMade++;
        return `${spaces}${letter}. `;
      });

      return section;
    });

    if (changesMade > 0) {
      this.changes.push(`Converted ${changesMade} numbered steps to lettered format`);
      console.log(`Normalized ${changesMade} step formats`);
    }

    return normalized;
  }

  /**
   * Add missing Sanity flags (default to "No")
   */
  addMissingSanityFlags(content) {
    let normalized = content;
    let addedFlags = 0;

    // Find test cases that don't have Sanity flag
    const testCasePattern = /(####\s+5\.\d+\.\d+\.\d+.*?)(?=####\s+5\.\d+|$)/gs;
    
    normalized = normalized.replace(testCasePattern, (testCase) => {
      // Check if Sanity flag exists
      if (!/\*\*Sanity\*\*:/i.test(testCase)) {
        // Add Sanity flag before the last line (or at the end)
        const lines = testCase.split('\n');
        const lastLineIndex = lines.length - 1;
        
        // Insert before the last line if it's empty, otherwise append
        if (lines[lastLineIndex].trim() === '') {
          lines.splice(lastLineIndex, 0, '**Sanity**: No');
        } else {
          lines.push('**Sanity**: No');
        }
        
        addedFlags++;
        testCase = lines.join('\n');
      }
      return testCase;
    });

    if (addedFlags > 0) {
      this.changes.push(`Added ${addedFlags} missing Sanity flags (default: No)`);
      console.log(`Added ${addedFlags} missing Sanity flags`);
    }

    return normalized;
  }

  /**
   * Fix priority format
   */
  fixPriorityFormat(content) {
    let normalized = content;
    let changesMade = 0;

    // Fix various priority formats
    const priorityFixes = [
      // "Priority: 1" → "Priority**: P1"
      { pattern: /\*\*Priority\*\*:\s*(\d)/g, replacement: '**Priority**: P$1', desc: 'Added P prefix to priority' },
      // "Priority: High" → "Priority**: P1"
      { pattern: /\*\*Priority\*\*:\s*(High|Critical)/gi, replacement: '**Priority**: P1', desc: 'Converted High/Critical to P1' },
      // "Priority: Medium" → "Priority**: P2"
      { pattern: /\*\*Priority\*\*:\s*Medium/gi, replacement: '**Priority**: P2', desc: 'Converted Medium to P2' },
      // "Priority: Low" → "Priority**: P3"
      { pattern: /\*\*Priority\*\*:\s*Low/gi, replacement: '**Priority**: P3', desc: 'Converted Low to P3' }
    ];

    priorityFixes.forEach(({ pattern, replacement, desc }) => {
      const before = normalized;
      normalized = normalized.replace(pattern, replacement);
      if (before !== normalized) {
        changesMade++;
        this.changes.push(desc);
      }
    });

    if (changesMade > 0) {
      console.log(`Normalized ${changesMade} priority formats`);
    }

    return normalized;
  }

  /**
   * Remove extra whitespace and normalize line endings
   */
  removeExtraWhitespace(content) {
    let normalized = content;

    // Remove trailing whitespace
    normalized = normalized.replace(/[ \t]+$/gm, '');

    // Normalize multiple blank lines to maximum 2
    normalized = normalized.replace(/\n{4,}/g, '\n\n\n');

    // Ensure single newline at end of file
    normalized = normalized.trim() + '\n';

    return normalized;
  }

  /**
   * Get normalization summary
   */
  getSummary() {
    return {
      totalChanges: this.changes.length,
      changes: this.changes,
      categories: this.categorizeChanges(this.changes)
    };
  }

  /**
   * Categorize changes for reporting
   */
  categorizeChanges(changes) {
    const categories = {
      numbering: 0,
      headers: 0,
      cli: 0,
      steps: 0,
      sanity: 0,
      priority: 0,
      other: 0
    };

    changes.forEach(change => {
      const lower = change.toLowerCase();
      if (lower.includes('number')) categories.numbering++;
      else if (lower.includes('header')) categories.headers++;
      else if (lower.includes('cli') || lower.includes('command')) categories.cli++;
      else if (lower.includes('step')) categories.steps++;
      else if (lower.includes('sanity')) categories.sanity++;
      else if (lower.includes('priority')) categories.priority++;
      else categories.other++;
    });

    return categories;
  }
}

module.exports = TestPlanNormalizer;
