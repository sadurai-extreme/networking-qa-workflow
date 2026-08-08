#!/usr/bin/env node
require('dotenv').config();

const JIRA_BASE = process.env.JIRA_BASE_URL || 'https://extremenetworks.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

async function fetchIssue(issueKey) {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  
  try {
    const response = await fetch(`${JIRA_BASE}/rest/api/3/issue/${issueKey}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const issue = await response.json();
    
    console.log('\n=== JIRA Issue Details ===');
    console.log(`Key: ${issue.key}`);
    console.log(`Type: ${issue.fields.issuetype.name}`);
    console.log(`Summary: ${issue.fields.summary}`);
    console.log(`Status: ${issue.fields.status.name}`);
    console.log(`Priority: ${issue.fields.priority?.name || 'None'}`);
    console.log(`Target Version (customfield_10061): ${issue.fields.customfield_10061?.map(v => v.name).join(', ') || 'None'}`);
    console.log(`Labels: ${issue.fields.labels?.join(', ') || 'None'}`);
    console.log(`Components: ${issue.fields.components?.map(c => c.name).join(', ') || 'None'}`);
    console.log(`Parent: ${issue.fields.parent?.key || 'None'} - ${issue.fields.parent?.fields?.summary || ''}`);
    console.log(`Epic Link (customfield_10014): ${issue.fields.customfield_10014 || 'None'}`);
    
    // Check for other potential version fields
    console.log(`\nFix Versions: ${issue.fields.fixVersions?.map(v => v.name).join(', ') || 'None'}`);
    console.log(`Affected Versions: ${issue.fields.versions?.map(v => v.name).join(', ') || 'None'}`);
    
    // List all custom fields that might contain "version" or "target"
    console.log('\n=== Version-related Custom Fields ===');
    for (const [key, value] of Object.entries(issue.fields)) {
      if (key.startsWith('customfield_') && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          if (value.name || value.value) {
            console.log(`${key}: ${value.name || value.value}`);
          }
        } else if (Array.isArray(value) && value.length > 0) {
          if (value[0].name || value[0].value) {
            console.log(`${key}: ${value.map(v => v.name || v.value).join(', ')}`);
          }
        }
      }
    }
    
    return issue;
  } catch (error) {
    console.error(`Error fetching issue ${issueKey}:`, error.message);
    return null;
  }
}

// Get issue key from command line argument
const issueKey = process.argv[2];
if (!issueKey) {
  console.error('Usage: node test-specific-issue.js EXOS-XXXXX');
  process.exit(1);
}

fetchIssue(issueKey);
