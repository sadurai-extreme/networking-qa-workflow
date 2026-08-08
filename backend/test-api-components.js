require('dotenv').config();

const JIRA_BASE = process.env.JIRA_BASE_URL;
const JIRA_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;

// Hardcoded JQL query for API-related components in EXOS 33.7.1
const customJQL = '"target version" in ("EXOS 33.7.1") AND type in ("Story", "Improvement") AND Component in ("NetTools and Management : REST-API", "NET : REST", "NetTools and Management : Telemetry/Telegraf", "api")';

console.log('\n=== API Components Query for EXOS 33.7.1 ===');
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

async function runQuery() {
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

    console.log('Full URL (truncated):');
    console.log(searchUrl.substring(0, 150) + '...');
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
    Object.entries(byComponent).sort((a, b) => b[1] - a[1]).forEach(([comp, count]) => {
      console.log(`  ${comp}: ${count}`);
    });

    // Show breakdown by status
    const byStatus = {};
    data.issues.forEach(issue => {
      const status = issue.fields.status?.name || 'Unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });

    console.log('\nBreakdown by Status:');
    Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
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
      
      // Show parent if exists
      if (issue.fields.parent) {
        console.log(`   Parent: ${issue.fields.parent.key} - ${issue.fields.parent.fields.summary}`);
      }
      
      console.log('');
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  }
}

runQuery();
