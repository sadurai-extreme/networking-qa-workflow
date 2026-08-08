/**
 * Commit Analyzer Agent
 * 
 * Analyzes git commits from EXOS repository to extract:
 * - Changed files and code diffs
 * - Modified functions, structs, enums
 * - Feature behavior and impacts
 * - Testing insights
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { callLLM } = require('../services/llm');
const { getImpactedModules, MODULE_MAP } = require('../config/moduleMap');

// Configuration
const EXOS_REPO_URL = 'git@github.extremenetworks.com:Engineering/xos_exos.git';
const REPOS_DIR = path.resolve(__dirname, '../../../repos');
const EXOS_REPO_PATH = path.join(REPOS_DIR, 'xos_exos');

/**
 * Execute git command in EXOS repository
 */
async function runGitCommand(cmd, args = []) {
  console.log(`=== Running git command: git ${cmd} ${args.join(' ')} ===`);
  
  return new Promise((resolve, reject) => {
    const proc = spawn('git', [cmd, ...args], {
      cwd: EXOS_REPO_PATH,
      shell: true
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`Git command failed:`, stderr);
        reject(new Error(`Git command failed: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.on('error', (err) => {
      console.error(`Failed to run git command:`, err);
      reject(err);
    });
  });
}

/**
 * Ensure EXOS repository is cloned and up to date
 */
async function ensureRepository() {
  try {
    // Create repos directory if it doesn't exist
    await fs.mkdir(REPOS_DIR, { recursive: true });

    // Check if repo exists
    try {
      await fs.access(path.join(EXOS_REPO_PATH, '.git'));

      // Cache git fetch — skip if fetched within the last 30 minutes to avoid slow SSH round-trips
      const fetchStampFile = path.join(REPOS_DIR, '.last_fetch');
      let shouldFetch = true;
      try {
        const stamp = await fs.readFile(fetchStampFile, 'utf8');
        const ageSecs = (Date.now() - parseInt(stamp, 10)) / 1000;
        if (ageSecs < 1800) {
          console.log(`⚡ Skipping git fetch (last fetched ${Math.round(ageSecs / 60)}m ago — within 30min cache)`); 
          shouldFetch = false;
        }
      } catch { /* no stamp yet */ }

      if (shouldFetch) {
        console.log('EXOS repository exists, pulling latest changes...');
        try {
          await runGitCommand('fetch', ['origin']);
          await fs.writeFile(fetchStampFile, String(Date.now()));
          console.log('Repository updated successfully');
        } catch (fetchErr) {
          console.log('Warning: Could not fetch latest changes. Using existing repository.');
        }
      }
      
      return true;
    } catch (err) {
      console.log('EXOS repository not found, cloning...');
      
      // Clone repository
      const proc = spawn('git', ['clone', EXOS_REPO_URL, EXOS_REPO_PATH], {
        shell: true
      });

      return new Promise((resolve, reject) => {
        proc.on('close', (code) => {
          if (code !== 0) {
            reject(new Error('Failed to clone EXOS repository'));
          } else {
            console.log('EXOS repository cloned successfully');
            resolve(true);
          }
        });

        proc.on('error', reject);
      });
    }
  } catch (err) {
    console.error('Error ensuring repository:', err);
    throw err;
  }
}

/**
 * Search for commits related to a Jira story
 */
async function findCommitsByJira(jiraId) {
  console.log(`=== Searching for commits with Jira ID: ${jiraId} ===`);
  
  try {
    // Search commit messages for Jira ID
    const logOutput = await runGitCommand('log', [
      '--all',
      '--oneline',
      '--grep', jiraId,
      '-n', '20'
    ]);

    if (!logOutput) {
      console.log('No commits found for Jira ID');
      return [];
    }

    const commits = logOutput.split('\n').map(line => {
      const [hash, ...messageParts] = line.split(' ');
      return {
        hash: hash,
        message: messageParts.join(' ')
      };
    });

    console.log(`Found ${commits.length} commits`);
    return commits;
  } catch (err) {
    console.error('Error finding commits:', err);
    return [];
  }
}

/**
 * Get commit details including diff
 */
async function getCommitDetails(commitHash) {
  console.log(`=== Getting details for commit: ${commitHash} ===`);
  
  try {
    // Get commit metadata
    const showOutput = await runGitCommand('show', [
      '--no-patch',
      '--format=%H%n%an%n%ae%n%ad%n%s',
      commitHash
    ]);

    const [hash, author, email, date, subject] = showOutput.split('\n');

    // Get changed files
    const filesOutput = await runGitCommand('show', [
      '--name-status',
      '--format=',
      commitHash
    ]);

    const files = filesOutput
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [status, ...pathParts] = line.split('\t');
        return {
          status,
          path: pathParts.join('\t')
        };
      });

    // Get diff (limited to 10000 lines for performance)
    const diffOutput = await runGitCommand('show', [
      '-U5', // 5 lines of context
      '--format=',
      commitHash
    ]);

    // Parse diff to extract function changes
    const functionChanges = parseDiffForFunctions(diffOutput);

    return {
      hash,
      author,
      email,
      date,
      subject,
      files,
      diff: diffOutput,
      functionChanges
    };
  } catch (err) {
    console.error('Error getting commit details:', err);
    throw err;
  }
}

/**
 * Parse diff to extract changed functions
 */
function parseDiffForFunctions(diff) {
  const functions = new Set();
  const structs = new Set();
  const enums = new Set();

  // Extract function definitions/modifications
  const functionPattern = /^[\+\-]\s*(?:static\s+)?(?:void|int|char|long|float|double|bool|BOOL|STATUS|UINT32|INT32)\s+(\w+)\s*\(/gm;
  let match;
  while ((match = functionPattern.exec(diff)) !== null) {
    functions.add(match[1]);
  }

  // Extract struct members
  const structPattern = /(?:struct|typedef\s+struct)\s+(\w+)/g;
  while ((match = structPattern.exec(diff)) !== null) {
    structs.add(match[1]);
  }

  // Extract enum constants
  const enumPattern = /\b([A-Z][A-Z0-9_]{3,})\b/g;
  const lines = diff.split('\n');
  for (const line of lines) {
    if (line.startsWith('+') || line.startsWith('-')) {
      while ((match = enumPattern.exec(line)) !== null) {
        // Skip common noise
        if (!['NULL', 'TRUE', 'FALSE', 'SUCCESS', 'ERROR', 'VLAN'].includes(match[1])) {
          enums.add(match[1]);
        }
      }
    }
  }

  return {
    functions: Array.from(functions),
    structs: Array.from(structs),
    enums: Array.from(enums)
  };
}

/**
 * Analyze commits with LLM for behavioral insights
 */
async function analyzeCommitsWithLLM(commits, jiraStory, impactAnalysis) {
  console.log(`=== Analyzing ${commits.length} commits with LLM (light model) ===`);

  const commitSummaries = commits.map(c => ({
    hash: c.hash.substring(0, 8),
    message: c.subject,
    files: c.files.length,
    functions: c.functionChanges.functions.length
  }));

  const systemPrompt = `You are an expert EXOS (Extreme Networks Operating System) code analyst specializing in understanding feature implementations from git commits.

Your task is to analyze git commits and provide comprehensive insights for QA testing documentation.

Focus on:
1. **Feature Behavior**: What does this code change do functionally?
2. **Implementation Details**: How is it implemented (algorithms, data structures, protocols)?
3. **Impacted Areas**: What other modules/features might be affected?
4. **Code Changes**: Key functions added/modified, structs changed, new enums
5. **Testing Considerations**: What aspects need thorough testing?
6. **Critical Paths**: Error handling, boundary conditions, race conditions
7. **Dependencies**: What other features/modules does this interact with?

**CRITICAL RULE — Function Name Inference:**
Even when no code diff is provided, you MUST infer the most likely C/Python function names that were added or modified, based on:
- EXOS naming convention: C functions use camelCase with file-prefix (e.g., lldp_fa.c → lldpFa* functions)
- Commit message keywords map to function names (e.g., "process auth" → lldpFaProcessAuth, lldpFaHandleAuth)
- File names indicate modules (lldp_fa.c → FA-related functions, lldp_cli.py → show/configure commands)
- Always list at least 5-10 specific function names per commit

**MANDATORY**: At the END of your response, include a JSON block with this exact format:
\`\`\`json
{
  "inferredFunctions": ["funcName1", "funcName2", ...],
  "inferredStructs": ["StructName1", ...],
  "cliCommands": ["show ...", "configure ..."]
}
\`\`\`

Provide detailed, technical analysis suitable for creating comprehensive test plans.`;

  const userPrompt = `**Jira Story Information:**
- Story ID: ${jiraStory.id || 'N/A'}
- Title: ${jiraStory.title || 'N/A'}
- Release: ${jiraStory.release || 'N/A'}
${jiraStory.description ? `- Description: ${jiraStory.description}` : ''}

**Test Module Recommendations (from MODULE_MAP analysis):**
- Recommended Test Modules: ${impactAnalysis.testModules.join(', ') || 'None identified'}
- Impacted Feature Areas: ${impactAnalysis.impacts.join(', ') || 'None'}
- Critical Changes Detected: ${impactAnalysis.criticalChanges ? 'YES - High severity changes' : 'No'}
- Keywords for Testing: ${impactAnalysis.keywords.slice(0, 10).join(', ') || 'None'}

**Git Commit Analysis:**

Found ${commits.length} commit(s) related to this feature:

${commits.map((c, idx) => `
### Commit ${idx + 1}: ${c.hash.substring(0, 8)}
**Message:** ${c.subject}
**Author:** ${c.author}
**Date:** ${c.date}

**Changed Files (${c.files.length} total):**
${c.files.slice(0, 15).map(f => `- ${f.status === 'M' ? 'Modified' : f.status === 'A' ? 'Added' : 'Deleted'}: ${f.path}`).join('\n')}
${c.files.length > 15 ? `... and ${c.files.length - 15} more files` : ''}

**Code Changes Detected:**
- Modified Functions: ${c.functionChanges.functions.slice(0, 10).join(', ') || 'None detected'}
${c.functionChanges.functions.length > 10 ? `  ... and ${c.functionChanges.functions.length - 10} more` : ''}
- Struct Changes: ${c.functionChanges.structs.join(', ') || 'None detected'}
- Enum/Constants: ${c.functionChanges.enums.slice(0, 10).join(', ') || 'None detected'}

**Diff Excerpt (first 3000 characters):**
\`\`\`diff
${c.diff.substring(0, 3000)}
${c.diff.length > 3000 ? '\n... (truncated)' : ''}
${c.diff.length === 0 ? '(No diff available — infer functions from file names, EXOS naming conventions, and commit message)' : ''}
\`\`\`
`).join('\n')}

Based on this commit analysis and the recommended test modules, provide a comprehensive report covering:

1. **Feature Behavior Summary**
   - What functionality is being implemented/modified?
   - How does it change user-visible behavior?

2. **Technical Implementation**
   - Key algorithms or logic introduced
   - Data structures modified or created
   - Protocol changes (if any)

3. **Impacted Code Areas**
   - Which modules/subsystems are affected?
   - Cross-module dependencies and interactions
   - Potential ripple effects

4. **Critical Testing Areas**
   - Functional areas that MUST be tested
   - Boundary conditions and edge cases
   - Error handling paths
   - Performance/scalability considerations
   - **Use the recommended test modules above as a starting point**

5. **Integration Points**
   - How does this interact with other EXOS features?
   - CLI command changes
   - SNMP MIB changes
   - API modifications

6. **Risk Assessment**
   - High-risk code paths (error handling, resource management)
   - Backward compatibility concerns
   - Potential failure modes

7. **Test Module Alignment**
   - Validate if the recommended test modules (${impactAnalysis.testModules.join(', ')}) are appropriate
   - Suggest any additional test areas not covered
   - Prioritize which test modules are MOST critical for this change

Format your response as structured Markdown with clear sections. Be specific and technical.`;

  try {
    const analysis = await callLLM(systemPrompt, userPrompt, false);
    console.log('LLM analysis complete, length:', analysis.length);

    // Parse the mandatory JSON block from the analysis to extract inferred function names
    let inferredFunctions = [];
    let inferredStructs = [];
    let inferredCliCommands = [];
    try {
      const jsonMatch = analysis.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        inferredFunctions = parsed.inferredFunctions || [];
        inferredStructs = parsed.inferredStructs || [];
        inferredCliCommands = parsed.cliCommands || [];
        console.log(`[CommitAnalyzer] Extracted ${inferredFunctions.length} inferred functions, ${inferredStructs.length} structs`);
      }
    } catch (e) {
      // Fallback: extract backtick-wrapped function names (ending with ()) from analysis text
      const funcRegex = /`([a-z][a-zA-Z0-9_]{3,})\s*\(\)/g;
      let m;
      while ((m = funcRegex.exec(analysis)) !== null) {
        if (!inferredFunctions.includes(m[1])) inferredFunctions.push(m[1]);
      }
      console.log(`[CommitAnalyzer] Regex fallback extracted ${inferredFunctions.length} function names`);
    }

    return { analysis, inferredFunctions, inferredStructs, inferredCliCommands };
  } catch (err) {
    console.error('LLM analysis failed:', err);
    throw err;
  }
}

/**
 * Fallback: Fetch commits for a Jira story via the Jira dev-status API.
 * Used when the local git repository has 0 matching commits.
 *
 * Returns commits formatted identically to getCommitDetails() so they
 * can be passed straight into analyzeCommitsWithLLM().
 */
async function fetchCommitsFromJiraDevStatus(jiraKey) {
  const baseUrl = process.env.JIRA_BASE_URL || 'https://extremenetworks.atlassian.net';
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!email || !token) {
    console.warn('[CommitAnalyzer] Jira credentials not set — skipping dev-status fallback');
    return [];
  }

  const authHeader = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');

  try {
    // Step 1: Get the numeric issue ID
    console.log(`[CommitAnalyzer] Fetching numeric ID for ${jiraKey} via Jira API...`);
    const issueResp = await axios.get(`${baseUrl}/rest/api/3/issue/${jiraKey}?fields=id`, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
      timeout: 15000
    });
    const numericId = issueResp.data.id;
    console.log(`[CommitAnalyzer] Numeric issue ID: ${numericId}`);

    // Step 2: Fetch dev-status detail (GitHub Enterprise integration)
    const devStatusUrl = `${baseUrl}/rest/dev-status/latest/issue/detail` +
      `?issueId=${numericId}&applicationType=oAuth-com.github.integration.production&dataType=repository`;
    console.log(`[CommitAnalyzer] Fetching dev-status from: ${devStatusUrl}`);

    const devResp = await axios.get(devStatusUrl, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
      timeout: 15000
    });

    const repositories = devResp.data?.detail?.[0]?.repositories || [];
    const allCommits = [];

    for (const repo of repositories) {
      const commits = repo.commits || [];
      for (const c of commits) {
        // Skip merge commits
        if (c.merge) continue;

        // Map to internal format (without diff — not available from Jira API)
        allCommits.push({
          hash: c.id || '',
          author: c.author?.name || c.author?.login || 'Unknown',
          email: c.author?.email || '',
          date: c.authorTimestamp || c.displayId || '',
          subject: c.message || c.displayId || '',
          files: (c.files || []).map(f => ({
            status: f.changeType === 'ADDED' ? 'A' :
                    f.changeType === 'DELETED' ? 'D' : 'M',
            path: f.path || f.name || ''
          })),
          diff: '',  // Jira API does not expose diffs
          functionChanges: { functions: [], structs: [], enums: [] },
          // Include stats if available
          linesAdded: c.files?.reduce((s, f) => s + (f.linesAdded || 0), 0) || 0,
          linesRemoved: c.files?.reduce((s, f) => s + (f.linesRemoved || 0), 0) || 0,
          source: 'jira-dev-status'
        });
      }
    }

    console.log(`[CommitAnalyzer] Jira dev-status fallback found ${allCommits.length} commit(s) for ${jiraKey}`);
    return allCommits;

  } catch (err) {
    console.error(`[CommitAnalyzer] Jira dev-status fetch failed: ${err.message}`);
    return [];
  }
}

/**
 * Main function: Analyze commits for a Jira story
 */
async function analyzeCommitsForStory(jiraStory) {
  console.log('=== Starting Commit Analysis ===');
  console.log('Jira Story:', jiraStory.id, '-', jiraStory.title);

  try {
    // Ensure repository is ready
    await ensureRepository();

    // Find commits
    const commitList = await findCommitsByJira(jiraStory.id);

    if (commitList.length === 0) {
      console.log(`[CommitAnalyzer] No local commits found for ${jiraStory.id} — trying Jira dev-status API fallback...`);
      const jiraCommits = await fetchCommitsFromJiraDevStatus(jiraStory.id);

      if (jiraCommits.length === 0) {
        console.log('[CommitAnalyzer] Jira fallback also returned 0 commits');
        return {
          success: true,
          commitCount: 0,
          message: `No git commits found for Jira ID ${jiraStory.id}. This might be a documentation-only feature or the commits haven't been pushed yet.`,
          commits: [],
          analysis: null
        };
      }

      // Use Jira-sourced commits — map them through the same LLM analysis pipeline
      console.log(`[CommitAnalyzer] Using ${jiraCommits.length} commit(s) from Jira dev-status API`);
      const jiraFileObjects = jiraCommits.flatMap(c => c.files);
      const impactAnalysis = getImpactedModules(jiraFileObjects);

      console.log('=== Test Module Recommendations (Jira fallback) ===');
      console.log('Recommended test modules:', impactAnalysis.testModules.join(', '));

      const llmResult = await analyzeCommitsWithLLM(jiraCommits, jiraStory, impactAnalysis);
      const allFilePaths = Array.from(new Set(jiraCommits.flatMap(c => c.files.map(f => f.path))));

      // Merge inferred functions with any diff-extracted ones (Jira commits have none from diffs)
      const allFunctions = Array.from(new Set([
        ...jiraCommits.flatMap(c => c.functionChanges.functions),
        ...(llmResult.inferredFunctions || [])
      ]));
      const allStructs = Array.from(new Set([
        ...jiraCommits.flatMap(c => c.functionChanges.structs),
        ...(llmResult.inferredStructs || [])
      ]));

      console.log(`[CommitAnalyzer] Jira fallback final: ${allFunctions.length} functions, ${allFilePaths.length} files`);

      return {
        success: true,
        commitCount: jiraCommits.length,
        source: 'jira-dev-status',
        commits: jiraCommits.map(c => ({
          hash: c.hash,
          shortHash: c.hash.substring(0, 8),
          author: c.author,
          date: c.date,
          message: c.subject,
          filesChanged: c.files.map(f => f.path).join(','),
          functionsChanged: allFunctions.length,
          linesAdded: c.linesAdded || 0,
          linesRemoved: c.linesRemoved || 0
        })),
        codeChanges: {
          allFunctions,
          allStructs,
          allEnums: [],
          files: allFilePaths
        },
        testRecommendations: {
          modules: impactAnalysis.testModules,
          keywords: impactAnalysis.keywords,
          impactedAreas: impactAnalysis.impacts,
          criticalChanges: impactAnalysis.criticalChanges
        },
        analysis: llmResult.analysis
      };
    }

    // Get detailed information for each commit
    const commits = [];
    for (const commit of commitList.slice(0, 5)) { // Limit to 5 commits to avoid overwhelming LLM
      try {
        const details = await getCommitDetails(commit.hash);
        commits.push(details);
      } catch (err) {
        console.error(`Failed to get details for commit ${commit.hash}:`, err);
      }
    }

    if (commits.length === 0) {
      throw new Error('Failed to retrieve commit details');
    }

    // Map changed files to test modules using MODULE_MAP
    const allFiles = commits.flatMap(c => c.files);
    const impactAnalysis = getImpactedModules(allFiles);
    
    console.log('=== Test Module Recommendations ===');
    console.log('Recommended test modules:', impactAnalysis.testModules.join(', '));
    console.log('Keywords:', impactAnalysis.keywords.join(', '));
    console.log('Impacted areas:', impactAnalysis.impacts.join(', '));
    console.log('Critical changes:', impactAnalysis.criticalChanges);

    // Analyze with LLM
    const llmResult = await analyzeCommitsWithLLM(commits, jiraStory, impactAnalysis);

    // Merge diff-extracted functions with any LLM-inferred functions
    const allFunctions = Array.from(new Set([
      ...commits.flatMap(c => c.functionChanges.functions),
      ...(llmResult.inferredFunctions || [])
    ]));
    const allStructs = Array.from(new Set([
      ...commits.flatMap(c => c.functionChanges.structs),
      ...(llmResult.inferredStructs || [])
    ]));

    console.log(`[CommitAnalyzer] Local git final: ${allFunctions.length} functions, ${allStructs.length} structs`);

    // Return structured result
    return {
      success: true,
      commitCount: commits.length,
      commits: commits.map(c => ({
        hash: c.hash,
        shortHash: c.hash.substring(0, 8),
        author: c.author,
        date: c.date,
        message: c.subject,
        filesChanged: c.files.map(f => f.path).join(','),
        functionsChanged: c.functionChanges.functions.length
      })),
      codeChanges: {
        allFunctions,
        allStructs,
        allEnums: Array.from(new Set(commits.flatMap(c => c.functionChanges.enums)))
      },
      testRecommendations: {
        modules: impactAnalysis.testModules,
        keywords: impactAnalysis.keywords,
        impactedAreas: impactAnalysis.impacts,
        criticalChanges: impactAnalysis.criticalChanges
      },
      analysis: llmResult.analysis
    };

  } catch (err) {
    console.error('=== Commit Analysis Error ===');
    console.error(err);
    
    return {
      success: false,
      error: err.message,
      commitCount: 0,
      commits: [],
      analysis: null
    };
  }
}

module.exports = {
  analyzeCommitsForStory,
  ensureRepository
};
