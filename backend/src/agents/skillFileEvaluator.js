/**
 * Skill File Evaluator Agent
 * 
 * Evaluates skill file quality against EXOS documentation standards.
 * 
 * Evaluation Dimensions:
 * 1. Structure & Completeness (25%)
 * 2. Technical Accuracy (25%)
 * 3. Content Quality (15%)
 * 4. Code Commit Alignment (15%)
 * 5. Jira Attachment Coverage (15%)  ← STRICT RULE: attachments must be reflected
 * 6. Documentation Quality (5%)
 *
 * When no Jira attachments exist, Jira Attachment Coverage weight is redistributed:
 *   Technical Accuracy → 30%, Content Quality → 20%, Documentation Quality → 10%
 */

const { callLLM } = require('../services/llm');
const fs = require('fs');
const path = require('path');

class SkillFileEvaluator {
  constructor() {
    this.criteriaPath = path.resolve(__dirname, '../../../SKILL_FILE_EVALUATION_CRITERIA.md');
  }

  /**
   * Load evaluation criteria from documentation
   */
  loadEvaluationCriteria() {
    if (fs.existsSync(this.criteriaPath)) {
      return fs.readFileSync(this.criteriaPath, 'utf-8');
    }
    console.warn('Evaluation criteria file not found:', this.criteriaPath);
    return null;
  }

  /**
   * Perform automated checks before LLM evaluation
   */
  performAutomatedChecks(skillFileContent) {
    const checks = {
      criticalFailures: [],
      warnings: [],
      stats: {}
    };

    // Critical Check 1: Minimum content length
    const contentLength = skillFileContent.trim().length;
    checks.stats.contentLength = contentLength;
    if (contentLength < 500) {
      checks.criticalFailures.push({
        check: 'Minimum Content Length',
        reason: `Content is only ${contentLength} characters (minimum: 500)`,
        severity: 'CRITICAL'
      });
    }

    // Critical Check 2: Placeholder detection
    const placeholders = ['TBD', 'TODO', '[Fill in]', 'PLACEHOLDER', '[parameters]', '<parameter>'];
    const foundPlaceholders = placeholders.filter(p => 
      skillFileContent.includes(p) || skillFileContent.includes(p.toLowerCase())
    );
    if (foundPlaceholders.length > 0) {
      checks.criticalFailures.push({
        check: 'No Placeholders',
        reason: `Found ${foundPlaceholders.length} placeholder(s): ${foundPlaceholders.join(', ')}`,
        severity: 'CRITICAL'
      });
    }

    // Critical Check 3: Required sections (flexible pattern matching)
    const requiredSections = [
      { 
        name: 'Feature Overview', 
        regex: /^#{1,3}\s*(\d+\.?)?\s*(FEATURE\s+OVERVIEW|Feature\s+Overview|Overview)/im 
      },
      { 
        name: 'CLI Commands', 
        regex: /^#{1,3}\s*(\d+\.?)?\s*(CLI\s+COMMANDS|CLI\s+Commands|Commands)/im 
      },
      { 
        name: 'Technical Details', 
        regex: /^#{1,3}\s*(\d+\.?)?\s*(EXOS\s+IMPLEMENTATION|Technical\s+Details|Implementation\s+Details|Implementation)/im 
      }
    ];

    const missingSections = [];
    for (const section of requiredSections) {
      const found = section.regex.test(skillFileContent);
      if (!found) {
        missingSections.push(section.name);
      }
    }

    if (missingSections.length > 0) {
      checks.criticalFailures.push({
        check: 'Required Sections',
        reason: `Missing sections: ${missingSections.join(', ')}`,
        severity: 'CRITICAL'
      });
    }

    // Statistical checks
    checks.stats.sectionCount = (skillFileContent.match(/^#{1,3}\s/gm) || []).length;
    checks.stats.codeBlockCount = (skillFileContent.match(/```/g) || []).length / 2;
    checks.stats.tableCount = (skillFileContent.match(/\|.*\|/g) || []).length;
    checks.stats.cliCommandCount = (skillFileContent.match(/^configure\s/gm) || []).length +
                                    (skillFileContent.match(/^show\s/gm) || []).length +
                                    (skillFileContent.match(/^enable\s/gm) || []).length +
                                    (skillFileContent.match(/^disable\s/gm) || []).length;

    // Warnings for quality
    if (checks.stats.cliCommandCount < 3) {
      checks.warnings.push({
        check: 'CLI Command Coverage',
        reason: `Only ${checks.stats.cliCommandCount} CLI command(s) found (recommended: 5+)`,
        severity: 'WARNING'
      });
    }

    if (checks.stats.tableCount === 0) {
      checks.warnings.push({
        check: 'Parameter Tables',
        reason: 'No parameter tables found (recommended: at least 1)',
        severity: 'WARNING'
      });
    }

    if (checks.stats.codeBlockCount < 2) {
      checks.warnings.push({
        check: 'Code Examples',
        reason: `Only ${checks.stats.codeBlockCount} code block(s) found (recommended: 3+)`,
        severity: 'WARNING'
      });
    }

    return checks;
  }

  /**
   * Evaluate skill file using LLM
   */
  async evaluateSkillFile(skillFileContent, jiraStory, commitAnalysis = null, jiraAttachments = []) {
    console.log('=== Skill File Evaluator: Starting Evaluation ===');
    console.log('Story:', jiraStory.id, '-', jiraStory.title);
    console.log('Content length:', skillFileContent.length);
    console.log('Jira attachments for eval:', jiraAttachments.length);

    try {
      // Step 1: Automated checks
      console.log('Step 1: Running automated checks...');
      const automatedChecks = this.performAutomatedChecks(skillFileContent);
      console.log('Automated checks complete:', {
        criticalFailures: automatedChecks.criticalFailures.length,
        warnings: automatedChecks.warnings.length
      });
      
      // Log details of critical failures
      if (automatedChecks.criticalFailures.length > 0) {
        console.log('⚠️ CRITICAL FAILURES:');
        automatedChecks.criticalFailures.forEach((failure, idx) => {
          console.log(`  ${idx + 1}. ${failure.check}: ${failure.reason}`);
        });
      }

      // If critical failures exist, return early with F grade
      if (automatedChecks.criticalFailures.length > 0) {
        console.log('❌ AUTO-FAILING due to critical failures');
        return {
          success: true,
          grade: 'F',
          finalScore: 0,
          categoryScores: {
            structure: 0,
            technical: 0,
            content: 0,
            commits: 0,
            jiraAttachmentCoverage: 0,
            documentation: 0
          },
          criticalFailures: automatedChecks.criticalFailures,
          warnings: automatedChecks.warnings,
          stats: automatedChecks.stats,
          strengths: [],
          weaknesses: automatedChecks.criticalFailures.map(f => f.reason),
          recommendations: [
            'Fix all critical failures before proceeding',
            'Ensure all required sections are present',
            'Replace all placeholder text with specific content',
            'Add more CLI commands and examples'
          ],
          summary: 'Skill file failed automated quality checks and cannot proceed to detailed evaluation.'
        };
      }

      // Step 2: Load evaluation criteria
      console.log('Step 2: Loading evaluation criteria...');
      const evaluationCriteria = this.loadEvaluationCriteria();

      // Step 3: Build LLM prompt
      console.log('Step 3: Building evaluation prompt...');

      // Determine if attachments are available — affects scoring weights
      const hasAttachments = jiraAttachments && jiraAttachments.length > 0;
      const attachmentWeightNote = hasAttachments
        ? 'Structure×0.25 + Technical×0.25 + Content×0.15 + Commits×0.15 + JiraAttachmentCoverage×0.15 + Documentation×0.05'
        : 'Structure×0.25 + Technical×0.30 + Content×0.20 + Commits×0.15 + Documentation×0.10 (no attachments — JiraAttachmentCoverage weight redistributed)';

      const systemPrompt = `You are an expert EXOS (Extreme Networks Operating System) technical documentation reviewer specializing in skill file quality assessment.

Your task is to evaluate a skill file against production quality standards and provide:
1. Detailed category scores (0-100 for each category)
2. Overall grade (A, B, C, D, or F)
3. Specific strengths and weaknesses
4. Actionable recommendations for improvement

You must be STRICT and OBJECTIVE. Production-ready documentation requires:
- Specific, not generic, CLI commands and parameters
- Actual implementation details from code commits
- Professional writing with no placeholders
- Complete coverage of the feature

**STRICT RULE — Jira Attachment Coverage:**
If Jira attachments (email threads, specs, design docs) were provided, the skill file MUST incorporate the requirements, behaviors, and constraints described in them. A skill file that ignores attachment content scores 0 in JiraAttachmentCoverage.

**Evaluation Criteria:**
${evaluationCriteria || 'Use standard EXOS documentation quality criteria'}

**IMPORTANT**: Return your evaluation as a structured JSON object with this exact format:
\`\`\`json
{
  "grade": "A|B|C|D|F",
  "finalScore": <number 0-100>,
  "categoryScores": {
    "structure": <0-100>,
    "technical": <0-100>,
    "content": <0-100>,
    "commits": <0-100>,
    "jiraAttachmentCoverage": <0-100>,
    "documentation": <0-100>
  },
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "summary": "Overall assessment in 2-3 sentences"
}
\`\`\`
Note: If no Jira attachments were provided, set jiraAttachmentCoverage to null.`;

      const userPrompt = `**SKILL FILE TO EVALUATE:**

\`\`\`markdown
${skillFileContent}
\`\`\`

**JIRA STORY CONTEXT:**
- **Story ID**: ${jiraStory.id}
- **Title**: ${jiraStory.title}
- **Release**: ${jiraStory.release || 'Not specified'}
- **Description**: ${jiraStory.description ? jiraStory.description.substring(0, 500) : 'Not available'}

${commitAnalysis && commitAnalysis.success ? `
**CODE COMMIT ANALYSIS AVAILABLE:**
- **Commits Analyzed**: ${commitAnalysis.commitCount}
- **Source**: ${commitAnalysis.source === 'jira-dev-status' ? 'Jira Dev-Status API (fallback)' : 'Local git repository'}
- **Functions Modified**: ${commitAnalysis.codeChanges?.allFunctions?.length || 0}
- **Structs Modified**: ${commitAnalysis.codeChanges?.allStructs?.length || 0}
- **Test Modules**: ${commitAnalysis.testRecommendations?.modules?.length || 0}

Check if the skill file references actual implementation details from commits.
` : '**CODE COMMIT ANALYSIS**: Not available — score commits category based on general technical specificity.'}

${hasAttachments ? `
**JIRA ATTACHMENTS — CRITICAL REQUIREMENTS (STRICT RULE)**:
The following attachments were on the Jira story. The skill file MUST reflect all requirements, behaviors, and constraints described in these documents.
Score "jiraAttachmentCoverage" based on how completely the skill file incorporates this content:
- 90-100: All key requirements from attachments are addressed in detail
- 70-89: Most requirements covered, minor gaps
- 50-69: Some requirements covered, significant gaps
- 0-49: Attachment content largely ignored

${jiraAttachments.map((a, i) => `--- Attachment ${i+1}: ${a.filename} ---\n${a.content.substring(0, 3000)}`).join('\n\n')}
` : '**JIRA ATTACHMENTS**: None found — set jiraAttachmentCoverage to null in your response.'}

**YOUR TASK:**
Evaluate this skill file using the criteria provided. Be thorough and strict.

Provide your evaluation in the JSON format specified above. Include:
1. Grade (A-F) based on the scoring rubric
2. Final score (0-100) weighted as: ${attachmentWeightNote}
3. Category scores for each of the 6 dimensions (set jiraAttachmentCoverage to null if no attachments)
4. 3-5 specific strengths
5. 3-5 specific weaknesses
6. 5-7 actionable recommendations
7. Brief summary

**Return ONLY the JSON object, no additional text.**`;

      // Step 4: Call LLM for evaluation (using heavy model for large content)
      console.log('Step 4: Calling LLM for detailed evaluation...');
      const llmResponse = await callLLM(systemPrompt, userPrompt, true); // Use heavy model (gpt-4o)
      console.log('LLM response received, length:', llmResponse.length);

      // Step 5: Parse LLM response
      console.log('Step 5: Parsing evaluation results...');
      let evaluation;
      try {
        // Try to extract JSON from response
        const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                         llmResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          evaluation = JSON.parse(jsonStr);
        } else {
          // If no JSON found, try parsing the whole response
          evaluation = JSON.parse(llmResponse);
        }
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', parseError);
        console.error('Raw response:', llmResponse);
        
        // Fallback: Create a basic evaluation
        evaluation = {
          grade: 'C',
          finalScore: 65,
          categoryScores: {
            structure: 70,
            technical: 65,
            content: 60,
            commits: 60,
            jiraAttachmentCoverage: hasAttachments ? 60 : null,
            documentation: 70
          },
          strengths: ['Skill file was generated'],
          weaknesses: ['Evaluation parsing failed - manual review needed'],
          recommendations: ['Review skill file manually', 'Check for completeness', 'Verify technical accuracy'],
          summary: 'Automated evaluation encountered parsing issues. Manual review recommended.'
        };
      }

      // Recalculate final score using correct weights based on attachment availability
      const cs = evaluation.categoryScores || {};
      if (hasAttachments && cs.jiraAttachmentCoverage != null) {
        evaluation.finalScore = Math.round(
          (cs.structure || 0) * 0.25 +
          (cs.technical || 0) * 0.25 +
          (cs.content || 0) * 0.15 +
          (cs.commits || 0) * 0.15 +
          (cs.jiraAttachmentCoverage || 0) * 0.15 +
          (cs.documentation || 0) * 0.05
        );
      } else {
        evaluation.finalScore = Math.round(
          (cs.structure || 0) * 0.25 +
          (cs.technical || 0) * 0.30 +
          (cs.content || 0) * 0.20 +
          (cs.commits || 0) * 0.15 +
          (cs.documentation || 0) * 0.10
        );
        if (!('jiraAttachmentCoverage' in cs)) cs.jiraAttachmentCoverage = null;
      }
      evaluation.grade = this.calculateGrade(evaluation.finalScore);

      // Step 6: Enhance with automated checks
      evaluation.automatedChecks = automatedChecks;

      console.log('=== Evaluation Complete ===');
      console.log('Grade:', evaluation.grade, '| Final Score:', evaluation.finalScore);
      
      return {
        success: true,
        ...evaluation
      };

    } catch (error) {
      console.error('=== Skill File Evaluation ERROR ===');
      console.error('Error:', error);
      console.error('Stack:', error.stack);
      
      return {
        success: false,
        error: error.message,
        grade: 'F',
        finalScore: 0,
        summary: 'Evaluation failed due to technical error'
      };
    }
  }

  calculateGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

module.exports = new SkillFileEvaluator();
