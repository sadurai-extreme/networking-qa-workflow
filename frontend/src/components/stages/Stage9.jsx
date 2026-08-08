import React, { useState, useEffect } from 'react';
import {
  Card, Button, Row, Col, Statistic, Table, Tag, Typography, Space,
  Alert, Steps, Progress, Select, Timeline, Badge, Divider, message,
  Tabs, Input, Tooltip as AntTooltip, Form,
} from 'antd';
import {
  TrophyOutlined, DownloadOutlined, CheckCircleOutlined, ArrowLeftOutlined,
  CloudUploadOutlined, FileTextOutlined, BarChartOutlined, ClockCircleOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useWorkflowStore, useAuthStore } from '../../store';
import { useWorkflowNavigation } from '../../hooks/useWorkflowNavigation';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const { Title, Text } = Typography;

const RESULT_COLOR = { PASS: 'green', FAIL: 'red', BLOCKED: 'warning', SKIP: 'default', SKIPPED: 'default', NOT_RUN: 'error' };
const PIE_COLOR_MAP = {
  'Pass':    '#52c41a',
  'Fail':    '#ff4d4f',
  'Blocked': '#fadb14',
  'Skipped': '#d9d9d9',
  'Not Run': '#ff7875',
};
const CLASS_COLOR = { Manual: 'red', 'Semi-Automatable': 'orange', Automatable: 'green' };
// Stage labels matching sidebar navigation (stages 5 & 6 are internal — hidden from progress bar)
const STAGE_LABEL = {
  1: 'Jira Story',
  2: 'Skill File',
  3: 'Test Plan',
  4: 'TC Classification',
  7: 'Script Generation',
  8: 'TC Execution',
  9: 'Workflow Completion',
};
const VISIBLE_STAGES = [1, 2, 3, 4, 7, 8, 9];

export default function Stage9() {
  const { workflow, completeWorkflow } = useWorkflowStore();
  const { user } = useAuthStore();
  const { goToStage, goToDashboard } = useWorkflowNavigation();

  const [report, setReport] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);

  // XLSX export state
  const [xlsxModule, setXlsxModule] = useState('XOS_Platform.BCM');
  const [xlsxPlanName, setXlsxPlanName] = useState('');
  const [xlsxTestarea, setXlsxTestarea] = useState('5_Testcases');
  const [generatingXlsx, setGeneratingXlsx] = useState(false);

  // ISO DOCX state
  const [docxType, setDocxType] = useState('New');
  const [docxAuthor, setDocxAuthor] = useState(user?.name || '');
  const [docxReviewer, setDocxReviewer] = useState('');
  const [docxApprover, setDocxApprover] = useState('');
  const [docxBaseRef, setDocxBaseRef] = useState('');
  const [docxVersion, setDocxVersion] = useState('1.0');
  const [generatingDocx, setGeneratingDocx] = useState(false);
  const [generatingTemplateDocx, setGeneratingTemplateDocx] = useState(false);

  useEffect(() => {
    if (!workflow?.id) return;
    axios.get(`${API}/stage9/${workflow.id}`).then(r => {
      setReport(r.data);
      // Auto-derive TestPlan name from workflow title
      if (r.data?.workflow?.title) {
        setXlsxPlanName(
          r.data.workflow.title
            .replace(/[^a-zA-Z0-9\s_]/g, '')
            .trim()
            .replace(/\s+/g, '_')
        );
      }
      // Auto-detect doc type from workflow story type
      const storyType = r.data?.workflow?.jira_story_type || '';
      setDocxType(storyType.toLowerCase().includes('enhancement') ? 'Enhancement' : 'New');
    }).catch(console.error);
    axios.get(`${API}/stage9/qtest-projects`)
      .then(r => setProjects(r.data))
      .catch(() => setProjects([
        { id: 1, name: 'NOS_QA_Project (Mock)' },
        { id: 2, name: 'EXOS_Regression (Mock)' },
      ]));
  }, [workflow?.id]);

  const handleDownloadXlsx = async () => {
    setGeneratingXlsx(true);
    try {
      const resp = await axios.post(
        `${API}/stage9/generate-qtest-xlsx`,
        { workflow_id: workflow.id, module: xlsxModule, testplan_name: xlsxPlanName, testarea: xlsxTestarea },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `qTest_${xlsxPlanName || 'TestPlan'}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('✅ qTest XLSX downloaded successfully');
    } catch (err) {
      message.error('Failed to generate XLSX: ' + (err.response?.data?.error || err.message));
    } finally {
      setGeneratingXlsx(false);
    }
  };

  const handleQtestUpload = async () => {
    if (!selectedProject) return message.warning('Please select a qTest project first');
    setUploading(true);
    setUploadProgress(10);
    setUploadResults(null);
    const timer = setInterval(() => setUploadProgress(p => Math.min(p + 7, 85)), 500);
    try {
      const { data } = await axios.post(`${API}/stage9/qtest-upload`, {
        workflow_id: workflow.id,
        project_id: selectedProject,
      });
      clearInterval(timer);
      setUploadProgress(100);
      setUploadResults(data);
      message.success(`✅ Uploaded ${data.uploaded}/${data.total} test cases to qTest`);
    } catch (err) {
      clearInterval(timer);
      setUploadProgress(0);
      message.error('qTest upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!docxAuthor.trim()) return message.warning('Please enter the Author name');
    setGeneratingDocx(true);
    try {
      const resp = await axios.post(
        `${API}/stage9/generate-iso-docx`,
        {
          workflow_id: workflow.id,
          doc_type:     docxType,
          author:       docxAuthor,
          reviewer:     docxReviewer,
          approver:     docxApprover,
          base_doc_ref: docxType === 'Enhancement' ? docxBaseRef : '',
          version:      docxVersion || '1.0',
        },
        { responseType: 'blob' }
      );
      const url  = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href  = url;
      const jira = report?.workflow?.jira_story_id || 'TestPlan';
      link.setAttribute('download', `TestPlan_ISO_${jira}_v${docxVersion || '1.0'}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('✅ ISO Test Plan DOCX downloaded');
    } catch (err) {
      message.error('Failed to generate DOCX: ' + (err.response?.data?.error || err.message));
    } finally {
      setGeneratingDocx(false);
    }
  };

  const handleDownloadTemplateDocx = async () => {
    if (!docxAuthor.trim()) return message.warning('Please enter the Author name');
    setGeneratingTemplateDocx(true);
    try {
      const resp = await axios.post(
        `${API}/stage9/generate-docx-template`,
        {
          workflow_id: workflow.id,
          author:      docxAuthor,
          reviewer:    docxReviewer,
          approver:    docxApprover,
          version:     docxVersion || '1.0',
        },
        { responseType: 'blob' }
      );
      const url  = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href  = url;
      const jira = report?.workflow?.jira_story_id || 'TestPlan';
      link.setAttribute('download', `TestPlan_Template_${jira}_v${docxVersion || '1.0'}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('✅ Company Template DOCX downloaded');
    } catch (err) {
      message.error('Failed to generate template DOCX: ' + (err.response?.data?.error || err.message));
    } finally {
      setGeneratingTemplateDocx(false);
    }
  };

  const handleDownloadTestReport = () => {
    if (!report) return;
    const { workflow: wf, summary, test_cases, execution_results, sessions } = report;
    const execMap = {};
    (execution_results || []).forEach(r => { execMap[r.test_case_id] = r; });
    const now = new Date().toLocaleString();
    const resultBadge = (r) => {
      if (!r) return `<span style="background:#d9d9d9;color:#555;padding:2px 8px;border-radius:4px;font-size:11px">NOT RUN</span>`;
      const colors = { PASS: '#52c41a', FAIL: '#ff4d4f', BLOCKED: '#fadb14', SKIP: '#d9d9d9', SKIPPED: '#d9d9d9' };
      const fg = { PASS: '#fff', FAIL: '#fff', BLOCKED: '#333', SKIP: '#555', SKIPPED: '#555' };
      const v = (r.result || '').toUpperCase();
      return `<span style="background:${colors[v]||'#d9d9d9'};color:${fg[v]||'#555'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${v}</span>`;
    };
    const tcRows = (test_cases || []).map(tc => {
      const r = execMap[tc.id];
      return `<tr>
        <td>${tc.tc_number}</td>
        <td>${tc.title}</td>
        <td>${tc.classification || '—'}</td>
        <td>${resultBadge(r)}</td>
        <td>${r?.platform || '—'}</td>
        <td>${r?.build || '—'}</td>
        <td>${r?.executed_by || '—'}</td>
        <td>${r?.notes || ''}</td>
      </tr>`;
    }).join('');
    const sessionRows = (sessions || []).map(s => `<tr>
      <td>${s.platform || '—'}</td>
      <td>${s.build || '—'}</td>
      <td>${s.environment || '—'}</td>
      <td>${s.started_by || '—'}</td>
      <td>${s.started_at ? new Date(s.started_at).toLocaleString() : '—'}</td>
    </tr>`).join('');
    const passRate = summary.pass_rate;
    const rateColor = passRate >= 80 ? '#52c41a' : passRate >= 50 ? '#fa8c16' : '#ff4d4f';
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Test Execution Report – ${wf?.jira_story_id || wf?.title}</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;margin:0;padding:24px;color:#222;background:#f5f5f5}
h1{color:#1d3557;margin:0 0 4px}
.header{background:linear-gradient(135deg,#1d3557,#457b9d);color:#fff;padding:20px 28px;border-radius:8px;margin-bottom:20px}
.header h1{color:#fff;font-size:20px}
.meta{font-size:13px;opacity:.85;margin-top:6px}
.card{background:#fff;border-radius:8px;padding:16px 20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
h2{font-size:15px;color:#1d3557;margin:0 0 12px;border-bottom:1px solid #eee;padding-bottom:6px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:4px}
.stat{background:#f0f5ff;border-radius:6px;padding:10px 18px;text-align:center;min-width:90px}
.stat-val{font-size:26px;font-weight:700}
.stat-lbl{font-size:11px;color:#888;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#f0f5ff;text-align:left;padding:7px 10px;font-weight:600;font-size:12px;border-bottom:2px solid #d0d9e8}
td{padding:6px 10px;border-bottom:1px solid #f0f0f0;vertical-align:middle}
tr:nth-child(even) td{background:#fafafa}
.footer{text-align:center;font-size:11px;color:#aaa;margin-top:24px}
</style>
</head>
<body>
<div class="header">
  <h1>📋 Test Execution Report</h1>
  <div class="meta">
    Story: <strong>${wf?.jira_story_id || 'N/A'}</strong> &nbsp;|&nbsp;
    Title: <strong>${wf?.title || 'N/A'}</strong> &nbsp;|&nbsp;
    Release: <strong>${wf?.jira_release || 'N/A'}</strong> &nbsp;|&nbsp;
    Generated: <strong>${now}</strong>
  </div>
</div>
<div class="card">
  <h2>Executive Summary</h2>
  <div class="stats">
    <div class="stat"><div class="stat-val" style="color:#1677ff">${summary.total}</div><div class="stat-lbl">Total</div></div>
    <div class="stat"><div class="stat-val" style="color:#52c41a">${summary.passed}</div><div class="stat-lbl">Passed</div></div>
    <div class="stat"><div class="stat-val" style="color:#ff4d4f">${summary.failed}</div><div class="stat-lbl">Failed</div></div>
    <div class="stat"><div class="stat-val" style="color:#fadb14">${summary.blocked}</div><div class="stat-lbl">Blocked</div></div>
    <div class="stat"><div class="stat-val" style="color:#888">${summary.not_run}</div><div class="stat-lbl">Not Run</div></div>
    <div class="stat"><div class="stat-val" style="color:${rateColor}">${passRate}%</div><div class="stat-lbl">Pass Rate</div></div>
  </div>
</div>
${(sessions || []).length > 0 ? `
<div class="card">
  <h2>Execution Sessions</h2>
  <table><thead><tr><th>Platform</th><th>Build</th><th>Environment</th><th>Executed By</th><th>Date</th></tr></thead>
  <tbody>${sessionRows}</tbody></table>
</div>` : ''}
<div class="card">
  <h2>Test Case Execution Results (${(test_cases||[]).length} total)</h2>
  <table><thead><tr><th>TC#</th><th>Title</th><th>Type</th><th>Result</th><th>Platform</th><th>Build</th><th>Executed By</th><th>Notes</th></tr></thead>
  <tbody>${tcRows}</tbody></table>
</div>
<div class="footer">Generated by EXOS QA Workflow Tool &nbsp;·&nbsp; ${now}</div>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TestReport_${wf?.jira_story_id || 'workflow'}_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    message.success('Test report downloaded');
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await axios.post(`${API}/stage9/${workflow.id}/complete`, {
        user_id: user?.id, user_name: user?.name,
      });
      await completeWorkflow();
      message.success('🏁 Workflow completed successfully!');
      goToDashboard();
    } catch (err) {
      message.error('Failed to complete: ' + err.message);
      setCompleting(false);
    }
  };

  if (!report) return <div style={{ padding: 24 }}>Loading workflow summary...</div>;

  const { workflow: wf, stages, summary, test_cases, execution_results, sessions, approvals, documents, qtest } = report;

  // Build a map: test_case_id → latest execution result
  const execMap = {};
  (execution_results || []).forEach(r => { execMap[r.test_case_id] = r; });

  // Pie chart data (only non-zero slices)
  const pieData = [
    { name: 'Pass', value: summary.passed },
    { name: 'Fail', value: summary.failed },
    { name: 'Blocked', value: summary.blocked },
    { name: 'Skipped', value: summary.skipped },
    { name: 'Not Run', value: summary.not_run },
  ].filter(d => d.value > 0);

  // Stage progress steps — show only the 7 visible stages (skip internal stages 5 & 6)
  const stepsItems = (stages || [])
    .filter(s => VISIBLE_STAGES.includes(s.stage_number))
    .map(s => ({
      title: STAGE_LABEL[s.stage_number],
      status: s.status === 'completed' ? 'finish' : s.status === 'active' ? 'process' : 'wait',
    }));

  // TC table columns
  const tcColumns = [
    { title: 'TC#', dataIndex: 'tc_number', width: 75, sorter: (a, b) => String(a.tc_number).localeCompare(String(b.tc_number)) },
    { title: 'Title', dataIndex: 'title', ellipsis: true },
    {
      title: 'Type', dataIndex: 'classification', width: 140,
      render: v => <Tag color={CLASS_COLOR[v] || 'default'}>{v || '—'}</Tag>,
    },
    {
      title: 'Result', width: 90,
      render: (_, tc) => {
        const r = execMap[tc.id];
        return r ? <Tag color={RESULT_COLOR[r.result] || 'default'}>{r.result}</Tag> : <Tag>N/A</Tag>;
      },
    },
    {
      title: 'Platform', width: 110,
      render: (_, tc) => {
        const r = execMap[tc.id];
        return r?.platform ? <Tag color="geekblue">{r.platform}</Tag> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Build', width: 130,
      render: (_, tc) => {
        const r = execMap[tc.id];
        return r?.build ? <code style={{ fontSize: 11 }}>{r.build}</code> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Executed By', width: 120,
      render: (_, tc) => <Text type="secondary">{execMap[tc.id]?.executed_by || '—'}</Text>,
    },
  ];

  // qTest upload results columns
  const uploadColumns = [
    { title: 'TC#', dataIndex: 'tc_number', width: 75 },
    { title: 'Title', dataIndex: 'title', ellipsis: true },
    {
      title: 'Type', dataIndex: 'classification', width: 130,
      render: v => <Tag color={CLASS_COLOR[v] || 'default'}>{v || '—'}</Tag>,
    },
    { title: 'qTest ID', dataIndex: 'qtest_id', width: 130 },
    { title: 'Run ID', dataIndex: 'run_id', width: 130, render: v => v || <Text type="secondary">—</Text> },
    {
      title: 'Result', dataIndex: 'result', width: 90,
      render: v => <Tag color={RESULT_COLOR[v] || 'default'}>{v || '—'}</Tag>,
    },
    {
      title: 'Status', dataIndex: 'status', width: 85,
      render: v => <Tag color={v === 'uploaded' ? 'green' : 'red'}>{v}</Tag>,
    },
  ];

  const passColor = summary.pass_rate >= 80 ? '#52c41a' : summary.pass_rate >= 50 ? '#fa8c16' : '#ff4d4f';

  return (
    <div>
      {/* ── Workflow header ─────────────────────────────────────────────── */}
      <Card
        style={{ marginBottom: 16, background: 'linear-gradient(135deg, #1d3557 0%, #457b9d 100%)', border: 'none' }}
        bodyStyle={{ padding: '14px 20px' }}
      >
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Text strong style={{ fontSize: 17, color: '#fff' }}>
            <TrophyOutlined style={{ marginRight: 8 }} />
            {wf?.title || 'Untitled Workflow'}
          </Text>
          <Space wrap>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
              Story: <strong>{wf?.jira_story_id || 'N/A'}</strong>
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)' }}>|</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
              Release: <strong>{wf?.jira_release || 'N/A'}</strong>
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)' }}>|</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
              Type: <strong>{wf?.jira_story_type || 'N/A'}</strong>
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)' }}>|</Text>
            <Tag color={wf?.status === 'completed' ? 'green' : 'processing'} style={{ fontWeight: 600 }}>
              {wf?.status || 'active'}
            </Tag>
          </Space>
        </Space>
      </Card>

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => goToStage(8)}>Back to TC Execution</Button>
      </Space>

      {/* ── Stage progress ──────────────────────────────────────────────── */}
      <Card title="Workflow Stage Progress" style={{ marginBottom: 16 }} bodyStyle={{ overflowX: 'auto' }}>
        <Steps items={stepsItems} size="small" style={{ minWidth: 700 }} />
      </Card>

      {/* ── Summary stats ───────────────────────────────────────────────── */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total TCs', value: summary.total, color: '#1677ff' },
          { label: '✅ Passed', value: summary.passed, color: '#52c41a' },
          { label: '❌ Failed', value: summary.failed, color: '#ff4d4f' },
          { label: '⛔ Blocked', value: summary.blocked, color: '#fadb14' },
          { label: '⏭️ Not Run', value: summary.not_run, color: '#ff4d4f' },
          { label: 'Pass Rate', value: `${summary.pass_rate}%`, color: passColor },
        ].map(({ label, value, color }) => (
          <Col span={4} key={label}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic title={label} value={value} valueStyle={{ color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Charts + Sessions ───────────────────────────────────────────── */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={10}>
          <Card title={<><BarChartOutlined /> Execution Results</>} style={{ height: '100%' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={pieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={85}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLOR_MAP[entry.name] || '#d9d9d9'} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">No execution results recorded yet</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col span={14}>
          <Row gutter={[0, 12]} style={{ height: '100%' }}>
            <Col span={24}>
              <Card title="Classification Breakdown" size="small">
                <Row gutter={8}>
                  {[
                    { label: 'Manual', count: summary.manual_count, color: 'red' },
                    { label: 'Semi-Automatable', count: summary.semi_count, color: 'orange' },
                    { label: 'Automatable', count: summary.auto_count, color: 'green' },
                  ].map(({ label, count, color }) => (
                    <Col span={8} key={label} style={{ textAlign: 'center' }}>
                      <Tag color={color} style={{ padding: '3px 10px', marginBottom: 4, fontWeight: 600 }}>{label}</Tag>
                      <div style={{ fontSize: 24, fontWeight: 700 }}>{count}</div>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>

            <Col span={24}>
              <Card title={<><ClockCircleOutlined /> Execution Sessions</>} size="small" bodyStyle={{ maxHeight: 140, overflowY: 'auto' }}>
                {sessions?.length > 0 ? (
                  <Timeline
                    size="small"
                    items={sessions.slice(0, 4).map(s => ({
                      children: (
                        <Space size={4} wrap>
                          <Tag color="blue">{s.platform || 'Unknown'}</Tag>
                          <code style={{ fontSize: 11 }}>{s.build || 'N/A'}</code>
                          {s.environment && <Tag color="purple">{s.environment}</Tag>}
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {s.started_at ? new Date(s.started_at).toLocaleString() : ''}
                          </Text>
                        </Space>
                      ),
                    }))}
                  />
                ) : (
                  <Text type="secondary">No execution sessions recorded</Text>
                )}
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* ── Test cases table ────────────────────────────────────────────── */}
      <Card
        title={<><CheckSquareOutlined /> Test Cases &amp; Execution Results</>}
        style={{ marginBottom: 16 }}
        extra={<Text type="secondary">{test_cases?.length || 0} total</Text>}
      >
        <Table
          dataSource={test_cases}
          columns={tcColumns}
          rowKey="id"
          size="small"
          scroll={{ x: 900, y: 320 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} test cases` }}
          onRow={(tc) => {
            const r = execMap[tc.id];
            if (!r) return {};
            if (r.result === 'PASS') return { style: { background: '#f6ffed' } };
            if (r.result === 'FAIL') return { style: { background: '#fff1f0' } };
            if (r.result === 'BLOCKED') return { style: { background: '#fff7e6' } };
            return {};
          }}
        />
      </Card>

      {/* ── Download Test Report ─────────────────────────────────────────── */}
      <Card
        title={<><FileTextOutlined /> Download Test Report</>}
        style={{ marginBottom: 16 }}
        extra={
          <Tag color={summary.pass_rate >= 80 ? 'success' : summary.pass_rate >= 50 ? 'warning' : 'error'}>
            Pass Rate: {summary.pass_rate}%
          </Tag>
        }
      >
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space direction="vertical" size={2}>
            <Text>Download a full HTML execution report with summary, sessions, and per-TC results.</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Includes: {summary.total} test cases &nbsp;·&nbsp;
              {summary.passed} passed &nbsp;·&nbsp;
              {summary.failed} failed &nbsp;·&nbsp;
              {summary.blocked} blocked &nbsp;·&nbsp;
              {summary.not_run} not run
            </Text>
          </Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="large"
            onClick={handleDownloadTestReport}
            style={{ background: '#1d3557', borderColor: '#1d3557' }}
          >
            Download Test Report (HTML)
          </Button>
        </Space>
      </Card>

      {/* ── qTest Upload ────────────────────────────────────────────────── */}
      <Card
        title={<><CloudUploadOutlined /> Upload to qTest</>}
        style={{ marginBottom: 16 }}
        extra={
          qtest?.configured
            ? <Badge status="success" text="qTest Configured" />
            : <Badge status="warning" text="Mock Mode" />
        }
      >
        <Tabs
          defaultActiveKey="xlsx"
          items={[
            {
              key: 'xlsx',
              label: <><DownloadOutlined /> Download XLSX</>,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <Alert
                    type="info"
                    showIcon
                    message="Generates a qTest-compatible Excel file with all test cases structured for direct import into qTest Manager."
                    style={{ marginBottom: 4 }}
                  />

                  <Row gutter={12}>
                    <Col span={8}>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Test Module</Text>
                      </div>
                      <AntTooltip title="e.g. XOS_Platform.BCM or XOS_Platform.TAH">
                        <Input
                          value={xlsxModule}
                          onChange={e => setXlsxModule(e.target.value)}
                          placeholder="XOS_Platform.BCM"
                        />
                      </AntTooltip>
                    </Col>
                    <Col span={10}>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>TestPlan Name <Text type="secondary" style={{ fontSize: 11 }}>(auto-derived from workflow title)</Text></Text>
                      </div>
                      <Input
                        value={xlsxPlanName}
                        onChange={e => setXlsxPlanName(e.target.value)}
                        placeholder="Feature_Name_With_Underscores"
                      />
                    </Col>
                    <Col span={6}>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Test Area Folder</Text>
                      </div>
                      <Input
                        value={xlsxTestarea}
                        onChange={e => setXlsxTestarea(e.target.value)}
                        placeholder="5_Testcases"
                      />
                    </Col>
                  </Row>

                  <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 6, fontFamily: 'monospace', fontSize: 12 }}>
                    <Text type="secondary">Path preview: </Text>
                    <Text style={{ color: '#1677ff' }}>
                      {xlsxModule || 'XOS_Platform.BCM'}/{xlsxPlanName || '<TestPlan>'}/{xlsxTestarea || '5_Testcases'}/<Text type="secondary">&lt;Section&gt;</Text>
                    </Text>
                  </div>

                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadXlsx}
                    loading={generatingXlsx}
                    disabled={!xlsxPlanName}
                    style={{ width: 220 }}
                  >
                    {generatingXlsx ? 'Generating...' : 'Generate & Download XLSX'}
                  </Button>

                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Generates <strong>{test_cases?.length || 0}</strong> test cases with columns: Project, Test Suite Path, Test Case Title, Summary, Preconditions, Step Actions, Expected Results, Priority, Keywords
                  </Text>
                </Space>
              ),
            },
            {
              key: 'api',
              label: <><CloudUploadOutlined /> Direct API Upload</>,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <Row gutter={12} align="middle">
                    <Col flex="auto">
                      <Select
                        placeholder="Select qTest Project..."
                        style={{ width: '100%' }}
                        value={selectedProject}
                        onChange={setSelectedProject}
                        options={projects.map(p => ({ value: p.id, label: p.name }))}
                        showSearch
                        optionFilterProp="label"
                      />
                    </Col>
                    <Col>
                      <Button
                        type="primary"
                        icon={<CloudUploadOutlined />}
                        onClick={handleQtestUpload}
                        loading={uploading}
                        disabled={!selectedProject}
                      >
                        Upload TCs + Results
                      </Button>
                    </Col>
                  </Row>

                  {(uploading || uploadProgress === 100) && (
                    <Progress
                      percent={uploadProgress}
                      status={uploading ? 'active' : 'success'}
                    />
                  )}

                  {uploadProgress === 100 && uploadResults && (
                    <Alert
                      type="success"
                      message={`Uploaded ${uploadResults.uploaded} of ${uploadResults.total} test cases with execution results`}
                      showIcon
                    />
                  )}

                  {uploadResults && (
                    <>
                      <Divider style={{ margin: '8px 0' }}>Upload Results</Divider>
                      <Table
                        dataSource={uploadResults.results}
                        columns={uploadColumns}
                        rowKey="tc_number"
                        size="small"
                        pagination={false}
                        scroll={{ x: 800, y: 220 }}
                      />
                    </>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* ── ISO DOCX Download ───────────────────────────────────────────── */}
      <Card
        title={<><FileTextOutlined /> Download Test Plan (DOCX)</>}
        style={{ marginBottom: 16 }}
        size="small"
      >
        <Space align="end" wrap>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Author <Text type="danger">*</Text></Text>
            <Input
              placeholder="Author name"
              value={docxAuthor}
              onChange={e => setDocxAuthor(e.target.value)}
              style={{ width: 220, display: 'block', marginTop: 4 }}
              allowClear
            />
          </div>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownloadDocx}
            loading={generatingDocx}
            disabled={!docxAuthor.trim()}
            size="large"
            style={{ background: '#1D3557', borderColor: '#1D3557' }}
          >
            {generatingDocx ? 'Generating...' : 'Download as DOCX'}
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplateDocx}
            loading={generatingTemplateDocx}
            disabled={!docxAuthor.trim()}
            size="large"
            style={{ borderColor: '#2E5FA3', color: '#2E5FA3' }}
          >
            {generatingTemplateDocx ? 'Generating...' : 'Download (Company Template)'}
          </Button>
          {!docxAuthor.trim() && (
            <Text type="danger" style={{ fontSize: 12 }}>Author name required</Text>
          )}
        </Space>
      </Card>

      {/* ── Documents ───────────────────────────────────────────────────── */}
      <Card title={<><FileTextOutlined /> Documents</>} style={{ marginBottom: 16 }}>
        <Space wrap>
          {documents?.test_plan && (
            <Button
              icon={<DownloadOutlined />}
              href={`${API.replace('/api', '')}/uploads/${documents.test_plan.filename}`}
              target="_blank"
            >
              Test Plan {documents.test_plan.version ? `(v${documents.test_plan.version})` : ''}
            </Button>
          )}
          {documents?.iso_doc && (
            <Button
              icon={<DownloadOutlined />}
              href={`${API.replace('/api', '')}/uploads/${documents.iso_doc.filename}`}
              target="_blank"
            >
              ISO Test Plan (.docx)
            </Button>
          )}
          {documents?.final_report && (
            <Button
              icon={<DownloadOutlined />}
              href={`${API.replace('/api', '')}/uploads/${documents.final_report.filename}`}
              target="_blank"
            >
              Final Execution Report
            </Button>
          )}
          {!documents?.test_plan && !documents?.iso_doc && !documents?.final_report && (
            <Text type="secondary">No documents available for download</Text>
          )}
        </Space>
      </Card>

      {/* ── Complete workflow ────────────────────────────────────────────── */}
      <Card
        style={{ textAlign: 'center', background: '#f6ffed', borderColor: '#b7eb8f' }}
        bodyStyle={{ padding: '24px 32px' }}
      >
        <Space direction="vertical" size={8}>
          <TrophyOutlined style={{ fontSize: 36, color: '#52c41a' }} />
          <Title level={4} style={{ margin: 0 }}>Ready to Complete This Workflow?</Title>
          <Text type="secondary">
            Verify all stages are complete, test results are recorded, and documents are uploaded before marking done.
          </Text>
          <Button
            type="primary"
            size="large"
            icon={<CheckCircleOutlined />}
            onClick={handleComplete}
            loading={completing}
            style={{ background: '#52c41a', borderColor: '#52c41a', height: 48, paddingInline: 48, fontSize: 16, marginTop: 8 }}
          >
            🏁 Mark Workflow as Completed
          </Button>
        </Space>
      </Card>
    </div>
  );
}
