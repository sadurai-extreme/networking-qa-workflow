const express = require('express');
const router = require('express').Router();
const db = require('../db/database');
const { logAuditTrail } = require('../utils/auditLogger');
require('dotenv').config();

const JIRA_BASE = process.env.JIRA_BASE_URL;
const JIRA_TOKEN = process.env.JIRA_API_TOKEN;

// Get all releases (fix versions from Jira)
router.get('/releases', async (req, res) => {
  try {
    const response = await fetch(`${JIRA_BASE}/rest/api/3/project/NOS/versions`, {
      headers: { Authorization: `Bearer ${JIRA_TOKEN}`, 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    const releases = data
      .filter(v => !v.archived)
      .map(v => ({ id: v.id, name: v.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(releases);
  } catch (err) {
    // Return mock data if Jira not yet configured
    res.json([
      { id: '331', name: '33.1' }, { id: '332', name: '33.2' },
      { id: '333', name: '33.3' }, { id: '334', name: '33.4' },
      { id: '335', name: '33.5' }, { id: '336', name: '33.6' },
      { id: '337', name: '33.7' }, { id: '341', name: '34.1' },
    ]);
  }
});

// Get stories by release
router.get('/stories', async (req, res) => {
  const { release } = req.query;
  try {
    const jql = `project = NOS AND fixVersion = "${release}" AND issuetype = Story ORDER BY created DESC`;
    const response = await fetch(
      `${JIRA_BASE}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,description,status,priority,issuetype`,
      { headers: { Authorization: `Bearer ${JIRA_TOKEN}` } }
    );
    const data = await response.json();
    const stories = data.issues.map(issue => ({
      id: issue.key,
      title: issue.fields.summary,
      description: issue.fields.description,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name,
      type: detectStoryType(issue.fields.summary, issue.fields.description),
    }));
    res.json(stories);
  } catch (err) {
    res.json(getMockStories(release));
  }
});

// Select story and save to workflow
router.post('/select', (req, res) => {
  const { workflow_id, story_id, release, title, description, story_type, user_id, user_name } = req.body;
  db.prepare(`UPDATE workflows SET jira_story_id=?, jira_release=?, jira_story_type=?, title=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(story_id, release, story_type, title, workflow_id);
  db.prepare(`UPDATE stages SET status='completed', data=?, completed_at=CURRENT_TIMESTAMP WHERE workflow_id=? AND stage_number=1`)
    .run(JSON.stringify({ story_id, release, title, description, story_type }), workflow_id);
  logAuditTrail({
    workflow_id,
    stage_number: 1,
    action: `Jira story selected: ${story_id} — ${title}`,
    action_type: 'select',
    user_id: user_id || null,
    user_name: user_name || null,
    details: { story_id, release, story_type, title },
  });
  res.json({ success: true });
});

function detectStoryType(title, desc) {
  const text = `${title} ${desc || ''}`.toLowerCase();
  if (text.includes('api') || text.includes('endpoint') || text.includes('rest')) return 'NOS API Endpoint';
  return 'Feature Functionality';
}

function getMockStories(release) {
  return [
    { id: `NOS-100`, title: `BGP Routing API Endpoint Validation`, description: 'Validate BGP neighbor API endpoints', status: 'Open', priority: 'High', type: 'NOS API Endpoint', release },
    { id: `NOS-101`, title: `VLAN Feature Functionality Test`, description: 'Validate VLAN creation and deletion', status: 'Open', priority: 'Medium', type: 'Feature Functionality', release },
    { id: `NOS-102`, title: `OSPF Route Advertisement API`, description: 'Test OSPF route advertisement endpoints', status: 'Open', priority: 'High', type: 'NOS API Endpoint', release },
    { id: `NOS-103`, title: `QoS Policy Feature Validation`, description: 'Validate QoS traffic shaping features', status: 'Open', priority: 'Low', type: 'Feature Functionality', release },
  ];
}

module.exports = router;
