require('dotenv').config();

const JIRA_BASE = process.env.JIRA_BASE_URL;
const JIRA_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;

// Get JQL from command line argument
const customJQL = process.argv[2];

if (!customJQL) {
  console.error('❌ Please provide a JQL query as an argument');
  process.exit(1);
}

console.log('\n=== Custom JIRA Query Test ===');
console.log('Base URL:', JIRA_BASE);
console.log('================================\n');

// Helper to create Basic Auth header
function getAuthHeader() {
  if (JIRA_EMAIL && JIRA_TOKEN) {
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
    return `Basic ${auth}`;
  }
  return `Bearer ${JIRA_TOKEN}`;
}

async function runCustomQuery() {
  try {
    console.log('JQL Query:');
    console.log(customJQL);
    console.log('\n================================\n');

    // Build URL with query parameters
    const params = new URLSearchParams({
      jql: customJQL,
      maxResults: 200,
      startAt: 0,
      fields: ['key', 'summary', 'description', 'status', 'priority', 'issuetype', 'assignee', 'labels', 'components', 'customfield_10001', 'customfield_10002', 'customfield_10016', 'parent', 'subtasks', 'customfield_10014']
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

    // Show breakdown by component
    const byComponent = {};
    data.issues.forEach(issue => {
      const components = issue.fields.components || [];
      if (components.length === 0) {
        byComponent['None'] = (byComponent['None'] || 0) + 1;
      } else {
        components.forEach(comp => {
          byComponent[comp.name] = (byComponent[comp.name] || 0) + 1;
        });
      }
    });

    console.log('\nBreakdown by Component:');
    Object.entries(byComponent).forEach(([comp, count]) => {
      console.log(`  ${comp}: ${count}`);
    });

    console.log('\n================================\n');
    console.log('Issues List:');
    console.log('================================\n');

    data.issues.forEach((issue, index) => {
      const components = issue.fields.components?.map(c => c.name).join(', ') || 'None';
      console.log(`${index + 1}. ${issue.key} (${issue.fields.issuetype?.name})`);
      console.log(`   Title: ${issue.fields.summary}`);
      console.log(`   Status: ${issue.fields.status?.name}`);
      console.log(`   Priority: ${issue.fields.priority?.name || 'None'}`);
      console.log(`   Components: ${components}`);
      console.log(`   Labels: ${issue.fields.labels?.join(', ') || 'None'}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  }
}

runCustomQuery();
