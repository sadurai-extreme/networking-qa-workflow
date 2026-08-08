/**
 * Test Plan Evaluator Service
 * Evaluates test plan quality against EXOS standards
 * Based on TEST_PLAN_EVALUATION_CRITERIA.md
 */

class TestPlanEvaluator {
  constructor() {
    this.weights = {
      format: 0.20,
      content: 0.25,
      coverage: 0.30,
      completeness: 0.15,
      quality: 0.10
    };
  }

  /**
   * Main evaluation function
   * @param {string} testPlanContent - Markdown content of test plan
   * @param {object} metadata - Additional metadata (jiraId, feature type, etc.)
   * @returns {object} Evaluation results with scores and recommendations
   */
  evaluate(testPlanContent, metadata = {}) {
    console.log('=== Test Plan Evaluation Starting ===');
    
    // Check critical requirements first
    const criticalChecks = this.checkCriticalRequirements(testPlanContent);
    if (criticalChecks.hasCriticalFailures) {
      console.log('CRITICAL FAILURES:', criticalChecks.failures);
      return {
        grade: 'FAIL',
        score: 0,
        criticalFailures: criticalChecks.failures,
        message: 'Test plan has critical failures and does not meet minimum requirements.',
        breakdown: null
      };
    }

    // Evaluate each category
    const formatScore = this.evaluateFormat(testPlanContent);
    const contentScore = this.evaluateContent(testPlanContent);
    const coverageScore = this.evaluateCoverage(testPlanContent, metadata);
    const completenessScore = this.evaluateCompleteness(testPlanContent);
    const qualityScore = this.evaluateQuality(testPlanContent);

    // Calculate weighted final score
    const finalScore = Math.round(
      formatScore.total * this.weights.format +
      contentScore.total * this.weights.content +
      coverageScore.total * this.weights.coverage +
      completenessScore.total * this.weights.completeness +
      qualityScore.total * this.weights.quality
    );

    const grade = this.calculateGrade(finalScore);

    return {
      grade,
      score: finalScore,
      passed: finalScore >= 60,
      criticalFailures: [],
      breakdown: {
        format: { score: formatScore.total, weight: '20%', details: formatScore },
        content: { score: contentScore.total, weight: '25%', details: contentScore },
        coverage: { score: coverageScore.total, weight: '30%', details: coverageScore },
        completeness: { score: completenessScore.total, weight: '15%', details: completenessScore },
        quality: { score: qualityScore.total, weight: '10%', details: qualityScore }
      },
      strengths: this.identifyStrengths({ formatScore, contentScore, coverageScore, completenessScore, qualityScore }),
      improvements: this.identifyImprovements({ formatScore, contentScore, coverageScore, completenessScore, qualityScore }),
      metrics: this.calculateMetrics(testPlanContent)
    };
  }

  /**
   * Check critical requirements (any failure = automatic fail)
   */
  checkCriticalRequirements(content) {
    const failures = [];

    // 1. Test case numbering format
    if (!this.uses5xFormat(content)) {
      failures.push('Uses TC-xxx or custom numbering instead of 5.x.x format');
    }

    // 2. Sanity flags present
    const testCases = this.extractTestCases(content);
    const missingSanityFlag = testCases.some(tc => !tc.hasSanityFlag);
    if (missingSanityFlag) {
      failures.push('Some test cases missing Sanity (Yes/No) flag');
    }

    // 3. Pass criteria present
    const missingPassCriteria = testCases.some(tc => !tc.hasPassCriteria);
    if (missingPassCriteria) {
      failures.push('Some test cases missing Pass Criteria');
    }

    // 4. Placeholder text
    if (this.hasPlaceholders(content)) {
      failures.push('Contains placeholder text like TBD, TODO, [Fill in]');
    }

    // 5. At least one test case
    if (testCases.length === 0) {
      failures.push('No test cases defined');
    }

    return {
      hasCriticalFailures: failures.length > 0,
      failures
    };
  }

  /**
   * Evaluate Format & Structure (100 points)
   */
  evaluateFormat(content) {
    let numbering = 0, structure = 0, sanity = 0, passCriteria = 0;

    // 1. Test Case Numbering (25 points)
    if (this.uses5xFormat(content)) {
      numbering = 25;
    } else if (this.hasMixedFormat(content)) {
      numbering = 5;
    }

    // 2. Section Structure (25 points)
    const sections = this.checkSectionStructure(content);
    if (sections.hasAll) {
      structure = 25;
    } else if (sections.hasMost) {
      structure = 18;
    } else if (sections.hasSome) {
      structure = 10;
    }

    // 3. Sanity Flags (25 points)
    const sanityStats = this.analyzeSanityFlags(content);
    if (sanityStats.allHaveFlags && sanityStats.sanityPercent >= 40 && sanityStats.sanityPercent <= 60) {
      sanity = 25;
    } else if (sanityStats.allHaveFlags) {
      sanity = 18;
    } else if (sanityStats.someHaveFlags) {
      sanity = 10;
    }

    // 4. Pass Criteria Format (25 points)
    const passStats = this.analyzePassCriteria(content);
    if (passStats.allHaveCriteria && passStats.qualityGood) {
      passCriteria = 25;
    } else if (passStats.allHaveCriteria) {
      passCriteria = 18;
    } else if (passStats.mostHaveCriteria) {
      passCriteria = 10;
    }

    return {
      total: numbering + structure + sanity + passCriteria,
      numbering: { score: numbering, max: 25 },
      structure: { score: structure, max: 25 },
      sanity: { score: sanity, max: 25 },
      passCriteria: { score: passCriteria, max: 25 }
    };
  }

  /**
   * Evaluate Content Quality (100 points)
   */
  evaluateContent(content) {
    let specificValues = 0, cliCommands = 0, methodology = 0, crossRef = 0, topology = 0;

    // 1. Specific Values vs Generic (30 points)
    const valueAnalysis = this.analyzeSpecificValues(content);
    if (valueAnalysis.percentSpecific >= 90) {
      specificValues = 30;
    } else if (valueAnalysis.percentSpecific >= 70) {
      specificValues = 20;
    } else if (valueAnalysis.percentSpecific >= 50) {
      specificValues = 10;
    }

    // 2. CLI Command Completeness (25 points)
    const cliAnalysis = this.analyzeCLICommands(content);
    if (cliAnalysis.hasCompleteCommands) {
      cliCommands = 25;
    } else if (cliAnalysis.hasMostCommands) {
      cliCommands = 18;
    } else if (cliAnalysis.hasSomeCommands) {
      cliCommands = 10;
    }

    // 3. Test Methodology Detail (20 points)
    const methodologyAnalysis = this.analyzeMethodology(content);
    if (methodologyAnalysis.avgSteps >= 5 && methodologyAnalysis.avgSteps <= 8) {
      methodology = 20;
    } else if (methodologyAnalysis.avgSteps >= 4 && methodologyAnalysis.avgSteps <= 10) {
      methodology = 14;
    } else {
      methodology = 7;
    }

    // 4. Cross-Referencing (15 points)
    const crossRefCount = this.countCrossReferences(content);
    if (crossRefCount > 5) {
      crossRef = 15;
    } else if (crossRefCount > 2) {
      crossRef = 10;
    } else if (crossRefCount > 0) {
      crossRef = 5;
    }

    // 5. Topology Specification (10 points)
    const topologyAnalysis = this.analyzeTopology(content);
    if (topologyAnalysis.hasDetailedTopology) {
      topology = 10;
    } else if (topologyAnalysis.hasBasicTopology) {
      topology = 7;
    } else if (topologyAnalysis.hasVagueTopology) {
      topology = 3;
    }

    return {
      total: specificValues + cliCommands + methodology + crossRef + topology,
      specificValues: { score: specificValues, max: 30 },
      cliCommands: { score: cliCommands, max: 25 },
      methodology: { score: methodology, max: 20 },
      crossRef: { score: crossRef, max: 15 },
      topology: { score: topology, max: 10 }
    };
  }

  /**
   * Evaluate Test Coverage (100 points)
   */
  evaluateCoverage(content, metadata) {
    let timeBased = 0, apiSetup = 0, userInterface = 0, operational = 0, negative = 0, special = 0;

    const isTimeBasedFeature = this.isTimeBasedFeature(content, metadata);
    const hasAPIFeature = this.hasAPIFeature(content, metadata);

    // 1. Time-Based Testing (20 points if applicable)
    if (isTimeBasedFeature) {
      const timeTests = this.analyzeTimeBasedTests(content);
      if (timeTests.comprehensive) {
        timeBased = 20;
      } else if (timeTests.some) {
        timeBased = 14;
      } else if (timeTests.mentioned) {
        timeBased = 7;
      }
    } else {
      timeBased = 'N/A';
    }

    // 2. API/Setup Method Testing (20 points if applicable)
    if (hasAPIFeature) {
      const apiTests = this.analyzeAPITests(content);
      if (apiTests.multipleMethods) {
        apiSetup = 20;
      } else if (apiTests.oneMethod) {
        apiSetup = 14;
      } else if (apiTests.mentioned) {
        apiSetup = 7;
      }
    } else {
      apiSetup = 'N/A';
    }

    // 3. User Interface Testing (20 points)
    const uiTests = this.analyzeUITests(content);
    if (uiTests.allInterfaces) {
      userInterface = 20;
    } else if (uiTests.primaryInterface) {
      userInterface = 14;
    } else if (uiTests.basicCLI) {
      userInterface = 7;
    }

    // 4. Operational Scenario Testing (20 points)
    const opTests = this.analyzeOperationalTests(content);
    if (opTests.allScenarios) {
      operational = 20;
    } else if (opTests.rebootTested) {
      operational = 14;
    } else if (opTests.minimal) {
      operational = 7;
    }

    // 5. Negative Testing (10 points)
    const negTests = this.analyzeNegativeTests(content);
    if (negTests.comprehensive) {
      negative = 10;
    } else if (negTests.some) {
      negative = 7;
    } else if (negTests.minimal) {
      negative = 3;
    }

    // 6. Special Configuration Testing (10 points if applicable)
    const specialTests = this.analyzeSpecialConfigs(content);
    if (specialTests.applicable) {
      if (specialTests.allVariants) {
        special = 10;
      } else if (specialTests.mainVariant) {
        special = 7;
      } else if (specialTests.mentioned) {
        special = 3;
      }
    } else {
      special = 'N/A';
    }

    return {
      total: [timeBased, apiSetup, userInterface, operational, negative, special]
        .filter(s => s !== 'N/A')
        .reduce((sum, s) => sum + s, 0),
      timeBased: { score: timeBased, max: 20 },
      apiSetup: { score: apiSetup, max: 20 },
      userInterface: { score: userInterface, max: 20 },
      operational: { score: operational, max: 20 },
      negative: { score: negative, max: 10 },
      special: { score: special, max: 10 }
    };
  }

  /**
   * Evaluate Completeness (100 points)
   */
  evaluateCompleteness(content) {
    let sections = 0, testCount = 0, sanityCoverage = 0, references = 0;

    // 1. Required Sections (40 points)
    const sectionCount = this.countRequiredSections(content);
    sections = Math.min(40, sectionCount * 8);

    // 2. Test Case Count (30 points)
    const testCaseCount = this.countTestCases(content);
    if (testCaseCount >= 20) {
      testCount = 30;
    } else if (testCaseCount >= 15) {
      testCount = 22;
    } else if (testCaseCount >= 10) {
      testCount = 15;
    } else if (testCaseCount >= 5) {
      testCount = 8;
    }

    // 3. Sanity Test Coverage (15 points)
    const sanityStats = this.analyzeSanityFlags(content);
    if (sanityStats.sanityPercent >= 40 && sanityStats.sanityPercent <= 60) {
      sanityCoverage = 15;
    } else if (sanityStats.sanityPercent >= 30 && sanityStats.sanityPercent <= 70) {
      sanityCoverage = 10;
    } else if (sanityStats.sanityPercent > 0) {
      sanityCoverage = 5;
    }

    // 4. Documentation References (15 points)
    const refCount = this.countReferences(content);
    if (refCount >= 5) {
      references = 15;
    } else if (refCount >= 3) {
      references = 10;
    } else if (refCount >= 1) {
      references = 5;
    }

    return {
      total: sections + testCount + sanityCoverage + references,
      sections: { score: sections, max: 40 },
      testCount: { score: testCount, max: 30 },
      sanityCoverage: { score: sanityCoverage, max: 15 },
      references: { score: references, max: 15 }
    };
  }

  /**
   * Evaluate Professional Quality (100 points)
   */
  evaluateQuality(content) {
    let language = 0, actionability = 0, consistency = 0, formatting = 0;

    // 1. Language & Clarity (30 points)
    const languageAnalysis = this.analyzeLanguage(content);
    if (languageAnalysis.professional) {
      language = 30;
    } else if (languageAnalysis.minorIssues) {
      language = 22;
    } else {
      language = 15;
    }

    // 2. Actionability (30 points)
    const actionAnalysis = this.analyzeActionability(content);
    if (actionAnalysis.fullyActionable) {
      actionability = 30;
    } else if (actionAnalysis.mostlyActionable) {
      actionability = 22;
    } else {
      actionability = 15;
    }

    // 3. Consistency (20 points)
    const consistencyAnalysis = this.analyzeConsistency(content);
    if (consistencyAnalysis.fullyConsistent) {
      consistency = 20;
    } else if (consistencyAnalysis.minorInconsistencies) {
      consistency = 14;
    } else {
      consistency = 7;
    }

    // 4. Formatting (20 points)
    const formattingAnalysis = this.analyzeFormatting(content);
    if (formattingAnalysis.excellent) {
      formatting = 20;
    } else if (formattingAnalysis.good) {
      formatting = 14;
    } else {
      formatting = 7;
    }

    return {
      total: language + actionability + consistency + formatting,
      language: { score: language, max: 30 },
      actionability: { score: actionability, max: 30 },
      consistency: { score: consistency, max: 20 },
      formatting: { score: formatting, max: 20 }
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  uses5xFormat(content) {
    const pattern5x = /####?\s+5\.\d+\.\d+/g;
    const patternTC = /####?\s+(TC|Test Case|Test|TestCase)[-_\s]*\d+/gi;
    const has5x = (content.match(pattern5x) || []).length;
    const hasTC = (content.match(patternTC) || []).length;
    return has5x > 0 && hasTC === 0;
  }

  hasMixedFormat(content) {
    const pattern5x = /####?\s+5\.\d+\.\d+/g;
    const patternTC = /####?\s+(TC|Test Case)[-_\s]*\d+/gi;
    return (content.match(pattern5x) || []).length > 0 && (content.match(patternTC) || []).length > 0;
  }

  hasPlaceholders(content) {
    return /\b(TBD|TODO|FIXME|\[Fill in\]|\[TBD\]|\[TODO\])\b/i.test(content);
  }

  extractTestCases(content) {
    const testCases = [];
    const testCasePattern = /####?\s+(5\.\d+\.\d+|TC[-_\s]*\d+|Test Case \d+)[^\n]*\n([\s\S]*?)(?=####?\s+(?:5\.\d+\.\d+|TC|Test Case|\d+\.|Appendix|$))/gi;
    let match;

    while ((match = testCasePattern.exec(content)) !== null) {
      const tcContent = match[2];
      testCases.push({
        id: match[1],
        content: tcContent,
        hasSanityFlag: /\*{0,2}Sanity\*{0,2}\s*(?:\(Yes\/No\))?\s*:/i.test(tcContent),
        hasPassCriteria: /\*{0,2}Pass\s+Criteria\*{0,2}\s*:/i.test(tcContent)
      });
    }

    return testCases;
  }

  checkSectionStructure(content) {
    const requiredSections = [
      /##\s+Introduction/i,
      /##\s+(Test\s+)?Scope/i,
      /##\s+(Test\s+)?Environment/i,
      /##\s+Testing\s+Tools/i,
      /##\s+Test\s+Cases/i
    ];

    const foundSections = requiredSections.filter(pattern => pattern.test(content)).length;

    return {
      hasAll: foundSections === 5,
      hasMost: foundSections >= 4,
      hasSome: foundSections >= 2,
      count: foundSections
    };
  }

  analyzeSanityFlags(content) {
    const testCases = this.extractTestCases(content);
    const withFlags = testCases.filter(tc => tc.hasSanityFlag).length;
    const sanityYes = (content.match(/\*{0,2}Sanity\*{0,2}\s*(?:\(Yes\/No\))?\s*:\s*Yes/gi) || []).length;

    return {
      allHaveFlags: withFlags === testCases.length && testCases.length > 0,
      someHaveFlags: withFlags > 0,
      sanityPercent: testCases.length > 0 ? Math.round((sanityYes / testCases.length) * 100) : 0
    };
  }

  analyzePassCriteria(content) {
    const testCases = this.extractTestCases(content);
    const withCriteria = testCases.filter(tc => tc.hasPassCriteria).length;
    const qualityGood = !/\*{0,2}Pass\s+Criteria\*{0,2}\s*:\s*(TBD|Test should pass|System works)/i.test(content);

    return {
      allHaveCriteria: withCriteria === testCases.length && testCases.length > 0,
      mostHaveCriteria: withCriteria > testCases.length * 0.8,
      qualityGood
    };
  }

  analyzeSpecificValues(content) {
    const specificPatterns = [
      /VLAN\s+\d{3,4}\b/g,
      /NSI\s+\d{7,8}\b/g,
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
      /5\d{3}-\d{2}[A-Z]{1,3}/g // Device models like 5720-24MXW
    ];

    const genericPatterns = [
      /\b(management|test|sample|example|default)\s+(VLAN|NSI|IP|device)\b/gi,
      /\b(VLAN|NSI|IP|device)\s+(ID|value|number)\b/gi
    ];

    const specificCount = specificPatterns.reduce((sum, p) => sum + (content.match(p) || []).length, 0);
    const genericCount = genericPatterns.reduce((sum, p) => sum + (content.match(p) || []).length, 0);
    const total = specificCount + genericCount;

    return {
      percentSpecific: total > 0 ? Math.round((specificCount / total) * 100) : 0,
      specificCount,
      genericCount
    };
  }

  analyzeCLICommands(content) {
    const cliBlockPattern = /```(?:bash|shell|cli)?\n([\s\S]*?)```/g;
    const cliBlocks = [...content.matchAll(cliBlockPattern)];
    
    const hasCompleteCommands = cliBlocks.length > 5 && 
      cliBlocks.some(block => block[1].includes('configure') && block[1].split('\n').length >= 3);

    const hasMostCommands = cliBlocks.length > 2;
    const hasSomeCommands = cliBlocks.length > 0;

    return { hasCompleteCommands, hasMostCommands, hasSomeCommands, count: cliBlocks.length };
  }

  analyzeMethodology(content) {
    const methodologies = content.match(/(?:Test\s+)?Methodology[:\s]*\n([\s\S]*?)(?=\n##|Pass\s+Criteria|$)/gi) || [];
    
    if (methodologies.length === 0) return { avgSteps: 0 };

    const stepCounts = methodologies.map(m => {
      const steps = m.match(/^\s*\d+\./gm) || [];
      return steps.length;
    });

    const avgSteps = stepCounts.reduce((sum, count) => sum + count, 0) / stepCounts.length;

    return { avgSteps: Math.round(avgSteps) };
  }

  countCrossReferences(content) {
    const patterns = [
      /per\s+testcase\s+5\.\d+\.\d+/gi,
      /as\s+in\s+testcase\s+5\.\d+\.\d+/gi,
      /refer\s+to\s+(testcase\s+)?5\.\d+\.\d+/gi
    ];

    return patterns.reduce((sum, p) => sum + (content.match(p) || []).length, 0);
  }

  analyzeTopology(content) {
    const hasDetailedTopology = /Topology[-\s]*\d+/i.test(content) && 
      /5\d{3}-\d{2}[A-Z]{1,3}/.test(content) && // Device models
      (/┌|├|│|─/.test(content) || /\|/.test(content)); // ASCII art

    const hasBasicTopology = /##\s+Topology/i.test(content) || /Topology\s+used/i.test(content);
    const hasVagueTopology = /switch|device|node/i.test(content);

    return { hasDetailedTopology, hasBasicTopology, hasVagueTopology };
  }

  isTimeBasedFeature(content, metadata) {
    const timeKeywords = ['expir', 'timeout', 'timer', 'schedule', 'period', 'duration'];
    const text = (content + JSON.stringify(metadata)).toLowerCase();
    return timeKeywords.some(kw => text.includes(kw));
  }

  hasAPIFeature(content, metadata) {
    const apiKeywords = ['api', 'rest', 'endpoint', 'patch', 'post', 'get'];
    const text = (content + JSON.stringify(metadata)).toLowerCase();
    return apiKeywords.some(kw => text.includes(kw));
  }

  analyzeTimeBasedTests(content) {
    const hasConfigureTime = /configure\s+time/i.test(content);
    const hasTimeAdvance = /advance\s+time|\+\s*\d+\s+days/i.test(content);
    const hasSNTPDisable = /disable\s+sntp/i.test(content);
    const hasRevert = /revert\s+time|-\s*\d+\s+days/i.test(content);

    const comprehensive = hasConfigureTime && hasTimeAdvance && hasSNTPDisable;
    const some = hasConfigureTime || hasTimeAdvance;
    const mentioned = /time/i.test(content);

    return { comprehensive, some, mentioned };
  }

  analyzeAPITests(content) {
    const hasPATCH = /PATCH|POST|PUT/.test(content);
    const hasDebugCLI = /debug\s+\w+/.test(content);
    const multipleMethods = hasPATCH && hasDebugCLI;
    const oneMethod = hasPATCH || hasDebugCLI;
    const mentioned = /api|endpoint/i.test(content);

    return { multipleMethods, oneMethod, mentioned };
  }

  analyzeUITests(content) {
    const hasCLI = /show\s+\w+/i.test(content);
    const hasBanner = /banner|login\s+message/i.test(content);
    const hasLogs = /log|syslog|ems/i.test(content);
    const hasSNMP = /snmp|trap/i.test(content);

    const allInterfaces = [hasCLI, hasBanner, hasLogs, hasSNMP].filter(Boolean).length >= 3;
    const primaryInterface = hasCLI;
    const basicCLI = /show/i.test(content);

    return { allInterfaces, primaryInterface, basicCLI };
  }

  analyzeOperationalTests(content) {
    const hasReboot = /reboot|restart/i.test(content);
    const hasFailover = /failover|ha|redundancy/i.test(content);
    const hasProcessRestart = /process\s+restart/i.test(content);
    const hasStack = /stack/i.test(content);

    const allScenarios = [hasReboot, hasFailover, hasProcessRestart].filter(Boolean).length >= 2;
    const rebootTested = hasReboot;
    const minimal = hasReboot || hasFailover;

    return { allScenarios, rebootTested, minimal };
  }

  analyzeNegativeTests(content) {
    const negativeKeywords = ['invalid', 'error', 'fail', 'missing', 'incorrect', 'negative'];
    const negativeCount = negativeKeywords.filter(kw => new RegExp(kw, 'i').test(content)).length;

    const comprehensive = negativeCount >= 4;
    const some = negativeCount >= 2;
    const minimal = negativeCount >= 1;

    return { comprehensive, some, minimal, count: negativeCount };
  }

  analyzeSpecialConfigs(content) {
    const hasPilot = /pilot/i.test(content);
    const hasXIQ = /xiq|cloud/i.test(content);
    const hasTiers = /tier|level|standard|premium/i.test(content);

    const applicable = hasPilot || hasXIQ || hasTiers;
    const allVariants = [hasPilot, hasXIQ, hasTiers].filter(Boolean).length >= 2;
    const mainVariant = [hasPilot, hasXIQ, hasTiers].filter(Boolean).length >= 1;

    return { applicable, allVariants, mainVariant, mentioned: applicable };
  }

  countRequiredSections(content) {
    const sections = [
      /##\s+Introduction/i,
      /##\s+(Test\s+)?Scope/i,
      /##\s+(Test\s+)?Environment/i,
      /##\s+Testing\s+Tools/i,
      /##\s+Test\s+Cases/i
    ];

    return sections.filter(pattern => pattern.test(content)).length;
  }

  countTestCases(content) {
    return this.extractTestCases(content).length;
  }

  countReferences(content) {
    const patterns = [
      /jira|exos-\d+/gi,
      /https?:\/\/[^\s]+/g,
      /refer to|see|reference/gi
    ];

    return patterns.reduce((sum, p) => sum + (content.match(p) || []).length, 0);
  }

  analyzeLanguage(content) {
    const hasTypos = /\b(teh|recieve|occured|seperate)\b/i.test(content);
    const professional = !hasTypos && !/!!|wow|awesome/i.test(content);
    const minorIssues = !professional && !hasTypos;

    return { professional, minorIssues };
  }

  analyzeActionability(content) {
    const vagueSteps = /configure\s+(?:the\s+)?(system|feature|device)\s+(?:appropriately|correctly)/gi;
    const fullyActionable = !vagueSteps.test(content) && this.extractTestCases(content).length > 0;
    const mostlyActionable = (content.match(vagueSteps) || []).length < 3;

    return { fullyActionable, mostlyActionable };
  }

  analyzeConsistency(content) {
    // Check for consistent terminology
    const hasFA = content.includes('FA ');
    const hasFabricAttach = content.includes('Fabric Attach');
    const mixedTerms = hasFA && hasFabricAttach;

    const fullyConsistent = !mixedTerms;
    const minorInconsistencies = mixedTerms;

    return { fullyConsistent, minorInconsistencies };
  }

  analyzeFormatting(content) {
    const hasCodeBlocks = /```[\s\S]*?```/.test(content);
    const hasHeaders = /##/.test(content);
    const hasBullets = /^\s*[-*+]\s/m.test(content);

    const excellent = hasCodeBlocks && hasHeaders && hasBullets;
    const good = hasHeaders && (hasCodeBlocks || hasBullets);

    return { excellent, good };
  }

  calculateGrade(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Acceptable';
    if (score >= 40) return 'Needs Work';
    return 'Fail';
  }

  identifyStrengths(scores) {
    const strengths = [];
    if (scores.formatScore.total >= 80) strengths.push('Excellent format compliance with 5.x.x numbering');
    if (scores.contentScore.total >= 80) strengths.push('High-quality content with specific values and complete CLI commands');
    if (scores.coverageScore.total >= 80) strengths.push('Comprehensive test coverage across multiple dimensions');
    if (scores.completenessScore.total >= 80) strengths.push('Complete documentation with all required sections');
    if (scores.qualityScore.total >= 80) strengths.push('Professional quality writing and presentation');

    return strengths.length > 0 ? strengths : ['Test plan shows effort and follows basic structure'];
  }

  identifyImprovements(scores) {
    const improvements = [];
    if (scores.formatScore.total < 70) improvements.push({ area: 'Format', issue: 'Use 5.x.x test case numbering; ensure all tests have Sanity flags', priority: 'HIGH' });
    if (scores.contentScore.total < 70) improvements.push({ area: 'Content', issue: 'Use specific values (VLAN 4048 not "mgmt VLAN"); add complete CLI commands', priority: 'HIGH' });
    if (scores.coverageScore.total < 70) improvements.push({ area: 'Coverage', issue: 'Add time manipulation tests, API setup tests, and operational scenarios', priority: 'MEDIUM' });
    if (scores.completenessScore.total < 70) improvements.push({ area: 'Completeness', issue: 'Add more test cases (target 15-25); improve sanity test distribution', priority: 'MEDIUM' });
    if (scores.qualityScore.total < 70) improvements.push({ area: 'Quality', issue: 'Make steps more actionable; improve consistency in terminology', priority: 'LOW' });

    return improvements;
  }

  calculateMetrics(content) {
    const testCases = this.extractTestCases(content);
    const sanityStats = this.analyzeSanityFlags(content);
    const valueAnalysis = this.analyzeSpecificValues(content);
    const cliAnalysis = this.analyzeCLICommands(content);
    const crossRefCount = this.countCrossReferences(content);

    return {
      testCaseCount: testCases.length,
      sanityPercentage: sanityStats.sanityPercent,
      specificValuesPercentage: valueAnalysis.percentSpecific,
      cliCommandBlocks: cliAnalysis.count,
      crossReferences: crossRefCount,
      uses5xFormat: this.uses5xFormat(content)
    };
  }
}

module.exports = new TestPlanEvaluator();
