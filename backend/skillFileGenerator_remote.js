/**
 * Skill File Generator Agent
 * 
 * Generates comprehensive skill files (functional specification documents) 
 * for EXOS features based on JIRA stories, reference documents, and code commits.
 * 
 * This agent orchestrates:
 * - Loading default skill file templates from knowledge base
 * - Analyzing git commits for code insights (via commitAnalyzer)
 * - Processing reference documents (specs, test plans)
 * - Generating comprehensive skill files using LLM
 */

const fs = require('fs');
const path = require('path');
const { callLLM } = require('../services/llm');
const { analyzeCommitsForStory } = require('./commitAnalyzer');

class SkillFileGenerator {
  constructor(options = {}) {
    this.defaultSkillsDir = options.defaultSkillsDir || 
      path.resolve(__dirname, '../../../data/default_skills');
    this.maxTemplateContentLength = options.maxTemplateContentLength || 2000;
    this.maxTemplatesInPrompt = options.maxTemplatesInPrompt || 10;
    this.commandReferenceFile = options.commandReferenceFile || 
      path.resolve(__dirname, '../../../data/api_specs/EXOS_Command_Reference_33.7.1.md');
  }

  /**
   * Extract keywords from text for template matching
   */
  extractKeywords(text) {
    if (!text) return [];
    // Remove common words and extract meaningful terms
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can']);
    
    return text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 20); // Top 20 keywords
  }

  /**
   * Calculate relevance score between story and template
   */
  calculateRelevance(storyKeywords, templateFilename, templateContent) {
    let score = 0;
    const filenameKeywords = this.extractKeywords(templateFilename);
    const contentKeywords = this.extractKeywords(templateContent.substring(0, 500));
    
    // Filename matches are worth more
    for (const keyword of storyKeywords) {
      if (filenameKeywords.some(fk => fk.includes(keyword) || keyword.includes(fk))) {
        score += 10;
      }
      if (contentKeywords.some(ck => ck.includes(keyword) || keyword.includes(ck))) {
        score += 1;
      }
    }
    
    return score;
  }

  /**
   * Load all default skill file templates from knowledge base
   */
  loadDefaultSkillTemplates() {
    const templates = [];
    
    console.log('Loading skill file templates from:', this.defaultSkillsDir);
    
    if (!fs.existsSync(this.defaultSkillsDir)) {
      console.log('Default skills directory not found');
      return templates;
    }

    const allFiles = fs.readdirSync(this.defaultSkillsDir).filter(f => f.endsWith('.md'));
    console.log(`Found ${allFiles.length} skill file templates`);
    
    for (const filename of allFiles) {
      const filepath = path.join(this.defaultSkillsDir, filename);
      try {
        const content = fs.readFileSync(filepath, 'utf8');
        templates.push({
          filename,
          filepath,
          fullContent: content,
          // Include first N chars of each template for context
          content: content.substring(0, this.maxTemplateContentLength)
        });
      } catch (err) {
        console.log(`Skipping ${filename}: ${err.message}`);
      }
    }
    
    console.log(`Successfully loaded ${templates.length} skill file templates`);
    return templates;
  }

  /**
   * Select most relevant templates based on Jira story content
   */
  selectRelevantTemplates(allTemplates, jiraStory, maxTemplates = 10) {
    console.log(`Selecting top ${maxTemplates} relevant templates from ${allTemplates.length} total`);
    
    // Extract keywords from story
    const storyText = `${jiraStory.title} ${jiraStory.description || ''} ${jiraStory.id}`;
    const storyKeywords = this.extractKeywords(storyText);
    console.log('Story keywords:', storyKeywords.slice(0, 10).join(', '));
    
    // Calculate relevance scores
    const scoredTemplates = allTemplates.map(template => ({
      ...template,
      relevanceScore: this.calculateRelevance(storyKeywords, template.filename, template.content)
    }));
    
    // Sort by relevance and take top N
    const selectedTemplates = scoredTemplates
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxTemplates);
    
    console.log('Selected templates:');
    selectedTemplates.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.filename} (score: ${t.relevanceScore})`);
    });
    
    return selectedTemplates;
  }

  /**
   * Extract relevant EXOS commands from the command reference guide
   */
  extractRelevantCommands(jiraStory) {
    console.log('=== Extracting Relevant EXOS Commands ===');
    
    try {
      if (!fs.existsSync(this.commandReferenceFile)) {
        console.log('Command reference file not found:', this.commandReferenceFile);
        return null;
      }

      const fileStats = fs.statSync(this.commandReferenceFile);
      const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
      console.log(`Command reference file size: ${fileSizeMB} MB`);

      // Skip if file is too large (> 10 MB) to avoid memory issues
      if (fileStats.size > 10 * 1024 * 1024) {
        console.log('⚠️ Skipping command extraction - file too large (> 10 MB)');
        return null;
      }

      // Extract keywords from the Jira story
      const storyText = `${jiraStory.title} ${jiraStory.description || ''}`;
      const keywords = this.extractKeywords(storyText);
      console.log('Searching for commands related to:', keywords.slice(0, 10).join(', '));

      // Read and search the command reference with memory limit
      console.log('Reading command reference file...');
      const commandRefContent = fs.readFileSync(this.commandReferenceFile, 'utf8');
      console.log('File read successfully. Processing...');
      
      const lines = commandRefContent.split('\n');
      console.log(`Processing ${lines.length} lines...`);
      
      const relevantSections = [];
      let currentSection = [];
      let isRelevantSection = false;
      let sectionScore = 0;

      // Search for relevant command sections (limit processing time)
      const maxLines = Math.min(lines.length, 50000); // Process max 50k lines
      for (let i = 0; i < maxLines; i++) {
        const line = lines[i];
        
        // Check if this is a command header (starts with ##)
        if (line.startsWith('##')) {
          // Process previous section if it was relevant
          if (isRelevantSection && currentSection.length > 0 && sectionScore > 0) {
            relevantSections.push({
              content: currentSection.join('\n'),
              score: sectionScore
            });
          }
          
          // Start new section
          currentSection = [line];
          sectionScore = 0;
          
          // Check if this section is relevant
          const sectionLower = line.toLowerCase();
          isRelevantSection = keywords.some(keyword => 
            sectionLower.includes(keyword.toLowerCase())
          );
          
          if (isRelevantSection) {
            sectionScore = keywords.filter(keyword => 
              sectionLower.includes(keyword.toLowerCase())
            ).length;
          }
        } else if (currentSection.length > 0 && currentSection.length < 100) {
          // Add line to current section (limit to 100 lines per section)
          currentSection.push(line);
          
          // Update relevance score if keywords found
          if (isRelevantSection) {
            const lineLower = line.toLowerCase();
            keywords.forEach(keyword => {
              if (lineLower.includes(keyword.toLowerCase())) {
                sectionScore += 0.5;
              }
            });
          }
        }
      }

      // Add last section if relevant
      if (isRelevantSection && currentSection.length > 0 && sectionScore > 0) {
        relevantSections.push({
          content: currentSection.join('\n'),
          score: sectionScore
        });
      }

      // Sort by relevance and take top sections
      const topSections = relevantSections
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5 most relevant sections

      if (topSections.length > 0) {
        console.log(`✓ Found ${topSections.length} relevant command sections`);
        const combinedContent = topSections.map(s => s.content).join('\n\n---\n\n');
        const truncatedContent = combinedContent.substring(0, 8000); // Limit to 8KB
        
        console.log(`✓ Extracted ${truncatedContent.length} characters of command reference`);
        return truncatedContent;
      } else {
        console.log('No relevant commands found in reference guide');
        return null;
      }

    } catch (error) {
      console.error('⚠️ Error extracting commands from reference:', error.message);
      console.error('Stack:', error.stack);
      // Return null instead of throwing - this is optional feature
      return null;
    }
  }

  /**
   * Analyze commits related to the JIRA story
   */
  async analyzeCommits(jiraStory) {
    console.log('=== Running Commit Analysis for Code Insights ===');
    
    try {
      const commitAnalysis = await analyzeCommitsForStory({
        id: jiraStory.id,
        title: jiraStory.title,
        description: jiraStory.description || '',
        release: jiraStory.release
      });
      
      if (commitAnalysis.success) {
        console.log(`Commit analysis successful: ${commitAnalysis.commitCount} commits analyzed`);
        console.log('Functions changed:', commitAnalysis.codeChanges?.allFunctions?.length || 0);
      } else {
        console.log('Commit analysis returned no results:', commitAnalysis.message || commitAnalysis.error);
      }
      
      return commitAnalysis;
    } catch (err) {
      console.error('Commit analysis failed (continuing without it):', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Build system prompt for LLM with skill file generation instructions
   */
  buildSystemPrompt(templateCount) {
    return `You are an expert in EXOS (Extreme Networks Operating System) and network operating systems, specializing in documenting detailed functional behavior and implementation details.

Your task is to generate a comprehensive SKILL FILE that documents the COMPLETE FUNCTIONAL BEHAVIOR and IMPLEMENTATION of the feature in EXOS. This is NOT a test plan - it is a detailed functional specification document.

**CRITICAL**: Skill files document HOW features work and HOW they are implemented in EXOS, NOT how to test them. Focus on functional behavior, implementation details, protocols, algorithms, and operational characteristics.

**IMPORTANT**: If this is a feature enhancement, document the COMPLETE behavior including:
- Existing feature functionality (how it currently works)
- New enhancement details (what's being added/changed)
- Combined behavior (how the complete feature works after enhancement)
- What's different from the previous version

Provide a COMPLETE picture of the feature's functional behavior.

**🔴 CRITICAL: Code Commit Integration Requirements 🔴**

When CODE COMMIT ANALYSIS is provided in the user prompt, you MUST integrate specific implementation details:

1. **Reference Specific Functions** (MANDATORY):
   - Include actual function names from commit analysis: "Implemented in \`filename.c\` function \`functionName()\`"
   - Example: "Bypass logic handled by \`lldpFaProcessBypassNl()\` in \`lldpFa.c\`"
   
2. **Use Actual File/Module Names** (MANDATORY):
   - Cite specific files from commit analysis: "Configuration stored in \`faZeroTouchClient.c\`"
   - List modified modules: "Changes made to: lldpFa.c, netlogin.c, fdbMgr.c"
   
3. **Document Code-Level Behavior** (MANDATORY):
   - Use function names and logic from commits: "When \`checkBypassNl()\` returns true, authentication is skipped"
   - Reference data structures: "Stored in \`faZeroTouchClient_t\` struct with \`bypassNl\` boolean field"
   
4. **Include Commit Metadata** (REQUIRED):
   - Reference commit hashes when available: "Added in commit \`a1b2c3d\`"
   - Note implementation dates: "Introduced in EXOS 34.1 (2025-06-15)"
   
5. **Align with Test Modules** (REQUIRED):
   - Use test module names from analysis: "Validated by TCL test module \`fabAttachBypassNl.tcl\`"
   - Reference test keywords: "Test keywords: bypass, netlogin, fabric-attach"

**Examples - GOOD vs BAD Documentation:**

❌ **BAD (Generic - Will FAIL):**
"The feature is implemented in the EXOS system using various modules and functions."

✅ **GOOD (Specific - Will PASS):**
"The bypass-netlogin feature is implemented in \`lldpFa.c\` with the core logic in the \`lldpFaProcessBypassNl()\` function. Configuration is stored in the \`faZeroTouchClient_t\` struct with a new \`bypassNl\` boolean field."

**FAILURE TO USE COMMIT DATA = DOCUMENTATION WILL BE REJECTED AS TOO GENERIC**

# SKILL FILE STRUCTURE

A skill file MUST include the following sections in this order:

## 1. FEATURE OVERVIEW
- High-level description of what the feature does
- Purpose and business value
- Use cases and target scenarios
- Related RFCs, standards, or protocols
- Prerequisites and dependencies

## 2. FUNCTIONAL DESCRIPTION
- **Detailed explanation of how the feature works**
- Core functionality and behavior
- Step-by-step operational flow
- User workflow (how administrators interact with the feature)
- Input/output behavior
- State transitions and lifecycle
- Default behaviors and settings

## 3. EXOS IMPLEMENTATION DETAILS
- **How the feature is implemented in EXOS**
- Software architecture and design
- Key modules, daemons, or processes involved
- Data structures and internal representations
- Algorithms and processing logic
- Protocol specifications (state machines, message formats)
- Hardware acceleration (if applicable)
- Internal communication mechanisms
- Memory and resource management
- Platform-specific implementations or limitations

## 4. SUPPORTED ATTRIBUTES AND PARAMETERS
- **Complete list of all configurable parameters**
- BGP/OSPF/protocol attributes supported
- Configuration options with valid ranges
- Default values and recommended settings
- Platform-specific variations
- Version-specific features
- License requirements

## 5. CLI COMMANDS AND SYNTAX
- **All CLI commands related to the feature**
- Configuration commands with syntax
- Show commands for monitoring and verification
- Debug commands (if applicable)
- Command examples with actual output
- Command interdependencies
- Configuration persistence behavior

## 6. FEATURE INTERACTIONS
- **How this feature interacts with other EXOS features**
- Integration with routing protocols
- Integration with VLANs, VRs, or other Layer 2/3 features
- Integration with security features
- Integration with management features
- Protocol interworking
- Shared resources or dependencies
- Order of operations and precedence

## 7. OPERATIONAL CHARACTERISTICS
- **How the feature behaves during operation**
- Performance characteristics and scalability limits
- Resource utilization (CPU, memory, hardware tables)
- Maximum supported values (routes, sessions, entries, etc.)
- Timing and convergence behavior
- High availability behavior
- Failover and redundancy mechanisms
- Graceful restart or recovery procedures
- Logging and SNMP trap behavior

## 8. SPECIAL BEHAVIORS AND EDGE CASES
- **Notable behaviors and corner cases**
- Default route handling
- Behavior with invalid or missing configurations
- Backward compatibility considerations
- Migration from older versions
- Behavior during upgrades
- Platform-specific quirks or limitations
- Known behavioral differences from RFCs or standards

## 9. CONFIGURATION EXAMPLES
- **Real-world configuration scenarios**
- Basic configuration example
- Advanced configuration example
- Common deployment patterns
- Multi-feature integration examples
- Typical topologies

## 10. VERIFICATION AND MONITORING
- **How to verify the feature is working correctly**
- Show command outputs to check
- Log messages indicating proper operation
- SNMP OIDs for monitoring
- Counters and statistics
- Troubleshooting commands
- Common operational states

# FORMATTING GUIDELINES

- Use clear, structured Markdown with proper headings (##, ###, ####)
- Include specific CLI command examples with actual syntax
- Use code blocks for commands and command output
- Use bullet points for lists of behaviors or characteristics
- Add tables for parameters, attributes, and supported values
- Be specific and detailed - document actual EXOS behavior
- Include protocol message formats, state machines, or packet structures where relevant
- Provide realistic configuration examples
- Reference specific EXOS modules, daemons, or processes
- Cite RFC numbers or standards where applicable

# QUALITY STANDARDS FOR FUNCTIONAL DOCUMENTATION

- Each section should be comprehensive and detailed (at least 5-10 substantial points)
- **Section 2 (Functional Description)**: Explain step-by-step how the feature operates from a user and system perspective
- **Section 3 (EXOS Implementation)**: Provide deep technical detail about internal architecture, daemons, processes, algorithms
- **Section 4 (Attributes/Parameters)**: List ALL configurable options with ranges and defaults
- **Section 5 (CLI Commands)**: Document ALL related commands with complete syntax
- **Section 6 (Feature Interactions)**: Explain how feature integrates with other EXOS features
- **Section 7 (Operational Characteristics)**: Document scalability, performance, HA behavior
- **Section 9 (Configuration Examples)**: Provide at least 2-3 complete, realistic configuration examples
- Document actual EXOS behavior, not generic networking concepts
- Include platform-specific details (which platforms support what)
- Document version-specific features or changes
- Cite Switch Engine User Guide page numbers when available

${templateCount > 0 ? `\n**AVAILABLE REFERENCE KNOWLEDGE:**\n\nYou have access to ${templateCount} skill file templates automatically extracted from the Switch Engine User Guide. These cover features like BGP, OSPF, VLANs, Security, ACLs, QoS, and many others. Use the relevant knowledge from these templates to:\n- Understand the expected documentation structure and depth\n- Reference similar feature implementations in EXOS\n- Maintain consistency with existing EXOS documentation style\n- Provide accurate technical details based on Switch Engine User Guide content\n\nAutomatically identify and use knowledge from relevant templates that apply to this feature.\n` : ''}

Format the output in clean, structured Markdown with all 10 sections properly labeled and detailed.`;
  }

  /**
   * Build user prompt with JIRA story, documents, commits, and templates
   */
  buildUserPrompt(jiraStory, documents, commitAnalysis, templates, relevantCommands = null) {
    let prompt = `**Jira Story Information:**
- Story ID: ${jiraStory.id || 'N/A'}
- Release: ${jiraStory.release || 'N/A'}
- Type: ${jiraStory.type || 'N/A'}
- Title: ${jiraStory.title || ''}
${jiraStory.description ? `- Description: ${jiraStory.description}` : ''}

`;

    // Add EXOS Command Reference if available
    if (relevantCommands) {
      prompt += `### 📖 EXOS Command Reference (v33.7.1)

**Relevant commands from official Switch Engine Command Reference:**

\`\`\`markdown
${relevantCommands}
\`\`\`

**Instructions for using command reference:**
- Use the exact command syntax shown in the reference
- Include all command parameters and options as documented
- Document command defaults and platform availability
- Provide realistic CLI examples based on the command syntax
- Cross-reference related commands when applicable

---

`;
    }

    // Add commit analysis if available
    if (commitAnalysis && commitAnalysis.success && commitAnalysis.commitCount > 0) {
      prompt += `### 🔍 CODE COMMIT ANALYSIS (EXOS Repository)

⚠️ **CRITICAL: You MUST use this code commit data in your skill file** ⚠️

**Found ${commitAnalysis.commitCount} related commit(s) in xos_exos repository:**

${commitAnalysis.commits.map((c, idx) => `
**Commit ${idx + 1}: \`${c.shortHash}\`** ← **CITE THIS HASH IN YOUR DOCUMENTATION**
- **Message:** ${c.message}
- **Author:** ${c.author}
- **Date:** ${c.date}
- **Files Changed:** ${c.filesChanged} ← **DOCUMENT THESE FILES BY NAME**
- **Functions Modified:** ${c.functionsChanged} ← **REFERENCE THESE FUNCTIONS**
`).join('\n')}

**Aggregated Code Changes** ← **YOU MUST USE THESE IN YOUR DOCUMENTATION**:
- **Modified Functions:** ${commitAnalysis.codeChanges.allFunctions.slice(0, 20).join(', ')}${commitAnalysis.codeChanges.allFunctions.length > 20 ? ` ... and ${commitAnalysis.codeChanges.allFunctions.length - 20} more` : ''}
  ${commitAnalysis.codeChanges.allFunctions.length > 0 ? `→ Example: "Feature implemented in \`${commitAnalysis.codeChanges.allFunctions[0]}\` function"` : ''}
  
- **Struct Changes:** ${commitAnalysis.codeChanges.allStructs.join(', ') || 'None detected'}
  ${commitAnalysis.codeChanges.allStructs.length > 0 ? '→ Document these data structures in Implementation Details section' : ''}
  
- **Enum/Constants:** ${commitAnalysis.codeChanges.allEnums.slice(0, 15).join(', ')}${commitAnalysis.codeChanges.allEnums.length > 15 ? ` ... and ${commitAnalysis.codeChanges.allEnums.length - 15} more` : ''}

**Test Module Recommendations:**
${commitAnalysis.testRecommendations && commitAnalysis.testRecommendations.modules && commitAnalysis.testRecommendations.modules.length > 0 ? `
- **Recommended Test Modules:** ${commitAnalysis.testRecommendations.modules.join(', ')} ← **CITE THESE TEST MODULES**
- **Impacted Feature Areas:** ${commitAnalysis.testRecommendations.impactedAreas.join(', ') || 'None identified'}
- **Keywords for Testing:** ${commitAnalysis.testRecommendations.keywords.slice(0, 10).join(', ') || 'None'}
- **Critical Changes:** ${commitAnalysis.testRecommendations.criticalChanges ? '⚠️ YES - High severity changes detected' : 'No'}
` : '- No specific test module recommendations identified'}

---

**📝 MANDATORY DOCUMENTATION REQUIREMENTS:**

Your skill file MUST include these commit-based details or it will be REJECTED:

1. **Create "EXOS Implementation Details" Section** with:
   \`\`\`markdown
   ### EXOS Implementation Details
   
   #### Core Functions:
   ${commitAnalysis.codeChanges.allFunctions.slice(0, 3).map(fn => `- \`${fn}\` - [describe its role in the feature]`).join('\n   ')}
   
   #### Modified Files:
   ${commitAnalysis.commits[0]?.filesChanged ? (Array.isArray(commitAnalysis.commits[0].filesChanged) ? commitAnalysis.commits[0].filesChanged : commitAnalysis.commits[0].filesChanged.split(',')).slice(0, 3).map(f => `- \`${typeof f === 'string' ? f.trim() : f}\` - [explain what changed]`).join('\n   ') : '- [list files from commits]'}
   \`\`\`

2. **Include Commit References**: "Added in commit \`${commitAnalysis.commits[0]?.shortHash || 'abc123'}\` (${commitAnalysis.commits[0]?.date || 'date'})"

3. **Reference Test Modules**: ${commitAnalysis.testRecommendations?.modules?.length > 0 ? `"Validated by \`${commitAnalysis.testRecommendations.modules[0]}\`"` : '"Validated by test module [name]"'}

4. **Minimum Requirements** (you will be evaluated on this):
   - Reference at least **5 function names** from the commit data
   - Cite at least **3 file paths** 
   - Include at least **1 commit hash**
   - Mention test modules if provided

---

### 🤖 LLM Commit Analysis Report

${commitAnalysis.analysis}

---
**⚠️ IMPORTANT: Your documentation quality score depends on using the above commit data.**

If you write generic statements like "implemented in the system" instead of specific function/file names, the documentation will FAIL quality evaluation.

This provides real code context for documenting the feature's implementation in EXOS.

`;
    } else if (commitAnalysis && !commitAnalysis.success) {
      prompt += `### 📝 Note: Code Commit Analysis

No git commits found for this Jira story in the xos_exos repository. This may be because:
- The feature is documentation-only
- Commits haven't been pushed yet
- The Jira ID isn't in commit messages

Proceed with skill file generation based on available documentation and EXOS knowledge.

`;
    }

    // Check if we have any documents
    if (!documents.currentSpec && !documents.existingSpec && !documents.testPlan && 
        (!commitAnalysis || !commitAnalysis.success)) {
      prompt += `**Note:** No reference documents or code commits were found. Generate the skill file based on the story title and your knowledge of EXOS features and network protocols. Document the functional behavior and implementation details as they would appear in the Switch Engine User Guide.

`;
    } else {
      prompt += `**Reference Materials Provided:**\n\n`;
    }

    // Add reference documents
    if (documents.currentSpec) {
      prompt += `### Current Feature Specification\n\`\`\`\n${documents.currentSpec.substring(0, 5000)}\n\`\`\`\n\n`;
    }

    if (documents.existingSpec) {
      prompt += `### Existing Feature Specification (for comparison)\n\`\`\`\n${documents.existingSpec.substring(0, 5000)}\n\`\`\`\n\n`;
    }

    if (documents.testPlan) {
      prompt += `### Existing Test Plan (for reference)\n\`\`\`\n${documents.testPlan.substring(0, 5000)}\n\`\`\`\n\n`;
    }

    if (documents.additionalCLI) {
      prompt += `### Additional CLI Commands (User-Provided)
The user has provided the following CLI commands that MUST be documented in the skill file:

\`\`\`
${documents.additionalCLI}
\`\`\`

**Important:** Include these CLI commands in the skill file with:
- Proper syntax documentation
- Parameter descriptions
- Usage examples
- Related configuration context

\n\n`;
    }

    if (documents.qaFeatureInteractions) {
      prompt += `### QA Input: Feature Interactions (User-Provided)
The QA team has identified the following feature interactions that should be considered and documented:

\`\`\`
${documents.qaFeatureInteractions}
\`\`\`

**Important:** In the skill file, ensure that:
- Section 6 (Feature Interactions) thoroughly documents these identified interactions
- All mentioned features are covered with specific interaction scenarios
- Integration points and dependencies are clearly explained
- These interactions are considered when documenting functional behavior
- Configuration examples demonstrate these interactions when applicable

\n\n`;
    }

    // Add knowledge base templates
    if (templates.length > 0) {
      prompt += `### Available Knowledge Base: Switch Engine User Guide Templates

**${templates.length} skill file templates are available** covering various EXOS features (BGP, OSPF, VLANs, ACLs, Security, QoS, etc.).

**Instructions for using templates:**
- Automatically identify which templates are relevant to this feature
- Use relevant templates as reference for documentation style and depth
- Apply knowledge from similar features to this feature's documentation
- Maintain consistency with Switch Engine User Guide documentation standards
- DO NOT copy templates verbatim - adapt the knowledge to this specific feature

Template excerpts for context:

${templates.slice(0, this.maxTemplatesInPrompt).map((template, idx) => 
  `#### ${idx + 1}. ${template.filename.replace('_Skill.md', '')}\n\`\`\`markdown\n${template.content}\n\`\`\`\n`
).join('\n')}

${templates.length > this.maxTemplatesInPrompt ? `*...and ${templates.length - this.maxTemplatesInPrompt} more templates covering additional EXOS features*\n` : ''}
`;
    }

    prompt += `
Based on the above information${templates.length > 0 ? ' and available knowledge base' : ''}, generate a comprehensive skill file that documents the functional behavior and EXOS implementation details of this feature.

**CRITICAL REQUIREMENTS:**
1. Follow the 10-section structure exactly
2. Each section must be comprehensive (5-10+ detailed points)
3. Focus on FUNCTIONAL BEHAVIOR, not test procedures
4. Include specific EXOS implementation details
5. Provide realistic CLI command examples
6. Document feature interactions with other EXOS features
7. Include at least 2-3 complete configuration examples
8. Document operational characteristics and scalability
9. Use knowledge from relevant templates for consistency
10. Output clean, well-formatted Markdown

Generate the skill file now.`;

    return prompt;
  }

  /**
   * Main method: Generate skill file
   */
  async generateSkillFile(options) {
    const {
      jiraStory,
      documents = {},
      streaming = false,
      onChunk = null
    } = options;

    console.log('=== Skill File Generator Agent ===');
    console.log('Jira Story:', jiraStory.id, '-', jiraStory.title);
    console.log('Documents provided:', Object.keys(documents));
    console.log('Streaming:', streaming);

    try {
      // Step 1: Load and select relevant skill file templates
      const allTemplates = this.loadDefaultSkillTemplates();
      const relevantTemplates = this.selectRelevantTemplates(
        allTemplates, 
        jiraStory, 
        this.maxTemplatesInPrompt
      );

      // Step 2: Analyze commits (optional - can be disabled for speed)
      const skipCommitAnalysis = process.env.SKIP_COMMIT_ANALYSIS === 'true';
      let commitAnalysis = { success: false, skipped: true };
      
      if (!skipCommitAnalysis) {
        commitAnalysis = await this.analyzeCommits(jiraStory);
      } else {
        console.log('⚡ Skipping commit analysis (SKIP_COMMIT_ANALYSIS=true)');
      }

      // Step 2.5: Extract relevant EXOS commands from reference guide
      const relevantCommands = this.extractRelevantCommands(jiraStory);

      // Step 3: Build prompts
      const systemPrompt = this.buildSystemPrompt(relevantTemplates.length);
      const userPrompt = this.buildUserPrompt(jiraStory, documents, commitAnalysis, relevantTemplates, relevantCommands);

      console.log('System prompt length:', systemPrompt.length);
      console.log('User prompt length:', userPrompt.length);
      console.log('Total context size:', systemPrompt.length + userPrompt.length);

      // Step 4: Call LLM to generate skill file
      console.log('Calling LLM to generate skill file...');
      
      const result = await callLLM(systemPrompt, userPrompt, streaming, onChunk);

      console.log('Skill file generation completed');
      console.log('Generated content length:', result ? result.length : 0);

      // Step 5: Validate commit alignment if commit analysis was performed
      let commitAlignmentScore = null;
      if (commitAnalysis && commitAnalysis.success && commitAnalysis.commitCount > 0) {
        const alignmentReport = this.validateCommitAlignment(result, commitAnalysis);
        commitAlignmentScore = alignmentReport.score;
        
        console.log('\n📊 Code Commit Alignment Validation:');
        console.log(`   Overall Score: ${alignmentReport.score}/100`);
        console.log(`   Functions Referenced: ${alignmentReport.summary.functions}`);
        console.log(`   Files Cited: ${alignmentReport.summary.files}`);
        console.log(`   Commit Hashes: ${alignmentReport.summary.commits}`);
        console.log(`   Test Modules: ${alignmentReport.summary.testModules}`);
        console.log(`   Data Structures: ${alignmentReport.summary.dataStructures}`);
        
        if (alignmentReport.score < 50) {
          console.warn('⚠️  WARNING: Low commit alignment score (<50)');
          console.warn('   Generated skill file may not meet code commit evaluation criteria');
          console.warn('   Recommendation: Review file for specific function/file references');
        } else if (alignmentReport.score >= 75) {
          console.log('✅ Good commit alignment - documentation uses specific implementation details');
        } else {
          console.log('ℹ️  Moderate commit alignment - could include more specific references');
        }
      }

      return {
        success: true,
        content: result,
        prompts: {
          systemPrompt,
          userPrompt
        },
        metadata: {
          jiraStory: {
            id: jiraStory.id,
            title: jiraStory.title,
            release: jiraStory.release
          },
          templatesTotal: allTemplates.length,
          templatesUsed: relevantTemplates.length,
          topTemplates: relevantTemplates.slice(0, 5).map(t => ({
            name: t.filename,
            score: t.relevanceScore
          })),
          commitAnalysis: {
            success: commitAnalysis?.success || false,
            skipped: commitAnalysis?.skipped || false,
            commitCount: commitAnalysis?.commitCount || 0,
            alignmentScore: commitAlignmentScore
          },
          documentsProvided: Object.keys(documents).filter(k => documents[k]),
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Skill file generation error:', error);
      return {
        success: false,
        error: error.message,
        metadata: {
          jiraStory: {
            id: jiraStory.id,
            title: jiraStory.title
          },
          failedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Generate skill file with streaming support
   */
  async generateSkillFileStreaming(options, onChunk) {
    return this.generateSkillFile({
      ...options,
      streaming: true,
      onChunk
    });
  }

  /**
   * Validate generated skill file content
   */
  validateSkillFile(content) {
    const requiredSections = [
      'FEATURE OVERVIEW',
      'FUNCTIONAL DESCRIPTION',
      'EXOS IMPLEMENTATION',
      'SUPPORTED ATTRIBUTES',
      'CLI COMMANDS',
      'FEATURE INTERACTIONS',
      'OPERATIONAL CHARACTERISTICS',
      'SPECIAL BEHAVIORS',
      'CONFIGURATION EXAMPLES',
      'VERIFICATION'
    ];

    const validation = {
      valid: true,
      missingSections: [],
      sectionCounts: {},
      totalLength: content.length,
      warnings: []
    };

    // Check for required sections
    for (const section of requiredSections) {
      const regex = new RegExp(`##\\s+.*${section}`, 'i');
      if (!regex.test(content)) {
        validation.valid = false;
        validation.missingSections.push(section);
      }
    }

    // Count sections
    const sectionMatches = content.match(/##\s+[^\n]+/g) || [];
    validation.sectionCounts.total = sectionMatches.length;

    // Warn if content is too short
    if (content.length < 5000) {
      validation.warnings.push('Content may be too brief (< 5000 characters)');
    }

    // Warn if missing code blocks
    const codeBlocks = content.match(/```/g) || [];
    if (codeBlocks.length < 4) {
      validation.warnings.push('Few code examples found (< 2 code blocks)');
    }

    return validation;
  }

  /**
   * Validate commit alignment - checks if generated skill file uses commit data
   * Returns a score from 0-100 based on how well commit data was integrated
   */
  validateCommitAlignment(skillFileContent, commitAnalysis) {
    if (!commitAnalysis || !commitAnalysis.success || commitAnalysis.commitCount === 0) {
      console.log('ℹ️  No commit analysis available - skipping alignment validation');
      return { score: 100, reason: 'No commit data to validate against' };
    }

    let score = 0;
    const content = skillFileContent.toLowerCase();
    const details = {
      functionsFound: [],
      filesFound: [],
      hashesFound: [],
      testModulesFound: []
    };

    // Check for function references (30 pts max)
    const functionsFound = commitAnalysis.codeChanges.allFunctions.filter(fn => 
      content.includes(fn.toLowerCase())
    );
    details.functionsFound = functionsFound;
    const functionScore = Math.min(30, functionsFound.length * 6); // 6 pts per function, max 5 functions
    score += functionScore;
    
    // Check for file references (25 pts max)
    const allFiles = commitAnalysis.commits.flatMap(c => 
      Array.isArray(c.filesChanged) ? c.filesChanged : c.filesChanged.split(',').map(f => f.trim())
    );
    const filesReferenced = allFiles.filter(file => 
      content.includes(file.toLowerCase())
    );
    details.filesFound = filesReferenced;
    const fileScore = Math.min(25, filesReferenced.length * 8); // 8 pts per file, max 3 files
    score += fileScore;
    
    // Check for commit hashes (20 pts max)
    const hashesFound = commitAnalysis.commits.filter(c => 
      content.includes(c.shortHash.toLowerCase())
    );
    details.hashesFound = hashesFound.map(c => c.shortHash);
    const hashScore = Math.min(20, hashesFound.length * 20); // 20 pts per hash, max 1 hash
    score += hashScore;
    
    // Check for test modules (15 pts max)
    if (commitAnalysis.testRecommendations?.modules) {
      const testModulesFound = commitAnalysis.testRecommendations.modules.filter(mod =>
        content.includes(mod.toLowerCase())
      );
      details.testModulesFound = testModulesFound;
      const testScore = Math.min(15, testModulesFound.length * 15); // 15 pts per module, max 1 module
      score += testScore;
    }
    
    // Check for struct/enum references (10 pts max)
    const structsFound = commitAnalysis.codeChanges.allStructs.filter(s => 
      content.includes(s.toLowerCase())
    );
    const enumsFound = commitAnalysis.codeChanges.allEnums.filter(e => 
      content.includes(e.toLowerCase())
    );
    const dataStructScore = Math.min(10, (structsFound.length + enumsFound.length) * 5);
    score += dataStructScore;
    
    // Generate detailed report
    const report = {
      score: Math.round(score),
      maxScore: 100,
      details,
      summary: {
        functions: `${functionsFound.length}/${commitAnalysis.codeChanges.allFunctions.length} (${functionScore}/30 pts)`,
        files: `${filesReferenced.length}/${allFiles.length} (${fileScore}/25 pts)`,
        commits: `${hashesFound.length}/${commitAnalysis.commits.length} (${hashScore}/20 pts)`,
        testModules: commitAnalysis.testRecommendations?.modules 
          ? `${details.testModulesFound.length}/${commitAnalysis.testRecommendations.modules.length} (${Math.min(15, details.testModulesFound.length * 15)}/15 pts)`
          : 'N/A',
        dataStructures: `${structsFound.length + enumsFound.length} structs/enums (${dataStructScore}/10 pts)`
      }
    };
    
    return report;
  }
}

module.exports = SkillFileGenerator;
