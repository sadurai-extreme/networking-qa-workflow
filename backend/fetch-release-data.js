require('dotenv').config();

const JIRA_BASE = process.env.JIRA_BASE_URL;
const JIRA_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_PROJECT = process.env.JIRA_PROJECT || 'EXOS';

// Get release from command line argument
const RELEASE = process.argv[2] || 'EXOS 33.7.1';

// Helper to create Basic Auth header
function getAuthHeader() {
  if (JIRA_EMAIL && JIRA_TOKEN) {
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
    return `Basic ${auth}`;
  }
  return `Bearer ${JIRA_TOKEN}`;
}

// Helper to fetch from Jira
async function fetchFromJira(jql, description) {
  try {
    const params = new URLSearchParams({
      jql: jql,
      maxResults: 200,
      startAt: 0,
      fields: ['key', 'summary', 'description', 'status', 'priority', 'issuetype', 'assignee', 'labels', 'components', 'customfield_10001', 'customfield_10002', 'customfield_10016', 'parent', 'subtasks', 'customfield_10014']
    });

    const searchUrl = `${JIRA_BASE}/rest/api/3/search/jql?${params.toString()}`;

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Jira API Error for ${description}:`, response.status);
      console.error('Response:', errorText);
      return null;
    }

    const data = await response.json();
    console.log(`✅ ${description}: ${data.issues.length} issues found`);
    return data.issues;

  } catch (err) {
    console.error(`❌ Error fetching ${description}:`, err.message);
    return null;
  }
}

async function fetchReleaseData() {
  console.log('\n=== Consolidated Release Data Fetch ===');
  console.log('Base URL:', JIRA_BASE);
  console.log('Project:', JIRA_PROJECT);
  console.log('Release:', RELEASE);
  console.log('======================================\n');

  // Extract release label (e.g., "EXOS 33.7.1" -> "PLM_33_7")
  const releaseLabelMatch = RELEASE.match(/EXOS\s([\d]+)\.([\d]+)/);
  const releaseLabel = releaseLabelMatch
    ? `PLM_${releaseLabelMatch[1]}_${releaseLabelMatch[2]}`
    : `PLM_${RELEASE.replace(/\./g, '_')}`;

  console.log(`Release Label Pattern: ${releaseLabel}\n`);

  // Query 1: Epics and Initiatives
  const epicJQL = `project = ${JIRA_PROJECT} AND ((type = Initiative OR type = Epic OR type = Story) AND "Target Version" = "${RELEASE}") ORDER BY priority DESC, created DESC`;
  
  console.log('Query 1 - Epics and Initiatives:');
  console.log(epicJQL);
  console.log('');

  const epics = await fetchFromJira(epicJQL, 'Epics/Initiatives');

  // Query 2: API Component Stories
  const apiJQL = `"target version" in ("${RELEASE}") AND type in ("Story", "Improvement") AND Component in ("NetTools and Management : REST-API", "NET : REST", "NetTools and Management : Telemetry/Telegraf", "api")`;
  
  console.log('\nQuery 2 - API Component Stories:');
  console.log(apiJQL);
  console.log('');

  const apiStories = await fetchFromJira(apiJQL, 'API Stories');

  // Consolidate results
  console.log('\n======================================');
  console.log('CONSOLIDATED RESULTS');
  console.log('======================================\n');

  const allIssues = new Map();

  // Add epics
  if (epics) {
    epics.forEach(issue => {
      allIssues.set(issue.key, {
        ...issue,
        sourceQuery: 'Epics/Initiatives'
      });
    });
  }

  // Add API stories (avoid duplicates)
  if (apiStories) {
    apiStories.forEach(issue => {
      if (!allIssues.has(issue.key)) {
        allIssues.set(issue.key, {
          ...issue,
          sourceQuery: 'API Stories'
        });
      } else {
        // Mark as found in both queries
        const existing = allIssues.get(issue.key);
        existing.sourceQuery = 'Both Queries';
      }
    });
  }

  const consolidatedIssues = Array.from(allIssues.values());

  console.log(`Total Unique Issues: ${consolidatedIssues.length}`);
  
  // Breakdown by type
  const byType = {};
  consolidatedIssues.forEach(issue => {
    const type = issue.fields.issuetype?.name || 'Unknown';
    byType[type] = (byType[type] || 0) + 1;
  });

  console.log('\nBreakdown by Type:');
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Breakdown by status
  const byStatus = {};
  consolidatedIssues.forEach(issue => {
    const status = issue.fields.status?.name || 'Unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  console.log('\nBreakdown by Status:');
  Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // Breakdown by priority
  const byPriority = {};
  consolidatedIssues.forEach(issue => {
    const priority = issue.fields.priority?.name || 'None';
    byPriority[priority] = (byPriority[priority] || 0) + 1;
  });

  console.log('\nBreakdown by Priority:');
  Object.entries(byPriority).sort((a, b) => {
    const priorityOrder = { 'P1 - Urgent': 1, 'P2 - High': 2, 'P3 - Medium': 3, 'P4 - Low': 4, 'None': 5 };
    return (priorityOrder[a[0]] || 99) - (priorityOrder[b[0]] || 99);
  }).forEach(([priority, count]) => {
    console.log(`  ${priority}: ${count}`);
  });

  console.log('\n======================================');
  console.log('DETAILED ISSUE LIST');
  console.log('======================================\n');

  consolidatedIssues.forEach((issue, index) => {
    const components = issue.fields.components?.map(c => c.name).join(', ') || 'None';
    console.log(`${index + 1}. ${issue.key} (${issue.fields.issuetype?.name})`);
    console.log(`   Title: ${issue.fields.summary}`);
    console.log(`   Status: ${issue.fields.status?.name}`);
    console.log(`   Priority: ${issue.fields.priority?.name || 'None'}`);
    console.log(`   Components: ${components}`);
    console.log(`   Labels: ${issue.fields.labels?.join(', ') || 'None'}`);
    console.log(`   Source: ${issue.sourceQuery}`);
    
    if (issue.fields.parent) {
      console.log(`   Parent: ${issue.fields.parent.key} - ${issue.fields.parent.fields.summary}`);
    }
    
    console.log('');
  });

  // Return JSON output for programmatic use
  return {
    release: RELEASE,
    releaseLabel: releaseLabel,
    totalIssues: consolidatedIssues.length,
    breakdowns: {
      byType,
      byStatus,
      byPriority
    },
    issues: consolidatedIssues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description,
      type: issue.fields.issuetype?.name,
      status: issue.fields.status?.name,
      priority: issue.fields.priority?.name,
      components: issue.fields.components?.map(c => c.name) || [],
      labels: issue.fields.labels || [],
      parent: issue.fields.parent ? {
        key: issue.fields.parent.key,
        summary: issue.fields.parent.fields.summary
      } : null,
      sourceQuery: issue.sourceQuery
    }))
  };
}

// Run the fetch and output JSON if requested
fetchReleaseData().then(data => {
  if (process.argv.includes('--json')) {
    console.log('\n======================================');
    console.log('JSON OUTPUT');
    console.log('======================================\n');
    console.log(JSON.stringify(data, null, 2));
  }
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
