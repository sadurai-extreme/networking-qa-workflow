require('dotenv').config();

const JIRA_BASE = process.env.JIRA_BASE_URL;
const JIRA_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_PROJECT = process.env.JIRA_PROJECT || 'EXOS';
const RELEASE = process.argv[2] || 'EXOS 33.7.1';

console.log('\n=== JIRA Query Test ===');
console.log('Base URL:', JIRA_BASE);
console.log('Project:', JIRA_PROJECT);
console.log('Release:', RELEASE);
console.log('================================\n');

// Helper to create Basic Auth header
function getAuthHeader() {
  if (JIRA_EMAIL && JIRA_TOKEN) {
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
    return `Basic ${auth}`;
  }
  return `Bearer ${JIRA_TOKEN}`;
}

async function testQuery() {
  try {
    // Extract release label (e.g., "EXOS 33.7.1" -> "PLM_33_7")
    const releaseLabelMatch = RELEASE.match(/EXOS\s([\d]+)\.([\d]+)/);
    const releaseLabel = releaseLabelMatch
      ? `PLM_${releaseLabelMatch[1]}_${releaseLabelMatch[2]}`
      : `PLM_${RELEASE.replace(/\./g, '_')}`;

    console.log(`Release Label Pattern: ${releaseLabel}\n`);

    // Build the JQL query
    const jql = `project = ${JIRA_PROJECT} AND ((type = Initiative OR type = Epic OR type = Story) AND "Target Version" = "${RELEASE}") ORDER BY priority DESC, created DESC`;

    console.log('JQL Query:');
    console.log(jql);
    console.log('\n================================\n');

    // Build URL with query parameters
    const params = new URLSearchParams({
      jql: jql,
      maxResults: 200,
      startAt: 0,
      fields: ['key', 'summary', 'description', 'status', 'priority', 'issuetype', 'assignee', 'labels', 'customfield_10001', 'customfield_10002', 'customfield_10016', 'parent', 'subtasks', 'customfield_10014']
    });

    const searchUrl = `${JIRA_BASE}/rest/api/3/search/jql?${params.toString()}`;

    console.log('Full URL:');
    console.log(searchUrl);
    console.log('\n================================\n');

    // Make the request
    console.log('Fetching from Jira...\n');

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Jira API Error:', response.status);
      console.error('Response:', errorText);
      return;
    }

    const data = await response.json();

    console.log('✅ Success!\n');
    console.log(`Total Items Found: ${data.issues.length}`);
    console.log('Max Results:', data.maxResults);
    console.log('Total in Jira:', data.total);
    console.log('\n================================\n');

    // Show breakdown by type
    const byType = {};
    data.issues.forEach(issue => {
      const type = issue.fields.issuetype?.name || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;
    });

    console.log('Breakdown by Type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log('\n================================\n');
    console.log('Issues List:');
    console.log('================================\n');

    data.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.key} (${issue.fields.issuetype?.name})`);
      console.log(`   Title: ${issue.fields.summary}`);
      console.log(`   Status: ${issue.fields.status?.name}`);
      console.log(`   Priority: ${issue.fields.priority?.name}`);
      console.log(`   Labels: ${issue.fields.labels?.join(', ') || 'None'}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testQuery();
