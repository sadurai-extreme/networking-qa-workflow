const https = require('https');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, 'backend', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const JIRA_BASE = envVars.JIRA_BASE_URL;
const JIRA_TOKEN = envVars.JIRA_API_TOKEN;
const JIRA_EMAIL = envVars.JIRA_EMAIL;
const ticketId = process.argv[2] || 'EXOS-39560';

console.log(`Fetching JIRA ticket: ${ticketId}...`);

// Create Basic Auth token (email:apiToken base64 encoded)
const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');

const options = {
  hostname: 'extremenetworks.atlassian.net',
  path: `/rest/api/3/issue/${ticketId}?fields=summary,description,status,priority,issuetype,assignee,reporter,created,updated`,
  method: 'GET',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      const issue = JSON.parse(data);
      console.log('\n========== JIRA TICKET:', issue.key, '==========');
      console.log('Summary:    ', issue.fields.summary);
      console.log('Type:       ', issue.fields.issuetype.name);
      console.log('Status:     ', issue.fields.status.name);
      console.log('Priority:   ', issue.fields.priority?.name || 'N/A');
      console.log('Created:    ', issue.fields.created);
      console.log('Updated:    ', issue.fields.updated);
      console.log('\nDescription:');
      
      // Handle Atlassian Document Format (ADF)
      if (issue.fields.description) {
        if (issue.fields.description.type === 'doc') {
          const extractText = (node) => {
            if (node.text) return node.text;
            if (node.content) {
              return node.content.map(extractText).join('');
            }
            return '';
          };
          const description = issue.fields.description.content.map(extractText).join('\n');
          console.log(description);
        } else {
          console.log(issue.fields.description);
        }
      } else {
        console.log('[No description provided]');
      }
      
      console.log('\n============================================\n');
    } else {
      console.error('Error:', res.statusCode, data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.end();
