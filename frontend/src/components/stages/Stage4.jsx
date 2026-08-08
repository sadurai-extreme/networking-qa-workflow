import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Table, Tag, Select, Typography, Statistic, Row, Col, Spin, message, Space, Modal, Input, Radio, Divider, Badge } from 'antd';
import { FundOutlined, ArrowLeftOutlined, ToolOutlined, MessageOutlined, SendOutlined, RobotOutlined, UserOutlined, CheckCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useWorkflowStore, useAuthStore } from '../../store';
import { useWorkflowNavigation } from '../../hooks/useWorkflowNavigation';
import ApprovalPanel from '../shared/ApprovalPanel';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const { Title, Text } = Typography;
const { TextArea } = Input;

const CLASS_COLORS = { Manual: 'red', 'Semi-Automatable': 'orange', Automatable: 'green' };

const ISSUE_TYPES = [
  { value: 'missing_steps',   label: 'Missing test steps' },
  { value: 'incorrect_steps', label: 'Steps are incorrect / wrong' },
  { value: 'more_detail',     label: 'Need more detail' },
  { value: 'wrong_tc',        label: 'Entire TC is wrong — rewrite it' },
  { value: 'manual',          label: 'I\'ll edit manually' },
];

export default function Stage4() {
  const { workflow, advanceStage } = useWorkflowStore();
  const { goToStage } = useWorkflowNavigation();
  const { user: currentUser } = useAuthStore();
  const [cases, setCases] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);

  // Fix TC modal state
  const [fixModal, setFixModal] = useState(false);
  const [fixingTC, setFixingTC] = useState(null);      // { tc_number, title }
  const [issueType, setIssueType] = useState('missing_steps');
  const [issueDesc, setIssueDesc] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [fixing, setFixing] = useState(false);
  const [loadingTcContent, setLoadingTcContent] = useState(false);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [updatedTCs, setUpdatedTCs] = useState(new Set()); // highlight fixed rows
  const chatBottomRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/stage4/${workflow?.id}`).then(r => { setCases(r.data.cases || []); setSummary(r.data.summary || {}); });
  }, [workflow?.id]);

  const handleClassify = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/stage4/classify`, { workflow_id: workflow.id });
      const { data } = await axios.get(`${API}/stage4/${workflow.id}`);
      setCases(data.cases); setSummary(data.summary);
    } catch { message.error('Classification failed.'); }
    setLoading(false);
  };

  const handleOverride = async (tc_number, classification) => {
    await axios.put(`${API}/stage4/override`, { workflow_id: workflow.id, tc_number, classification });
    setCases(prev => prev.map(c => c.tc_number === tc_number ? { ...c, classification } : c));
  };

  const openFixModal = async (tc) => {
    setFixingTC(tc);
    setIssueType('missing_steps');
    setIssueDesc('');
    setManualContent('');
    setFixModal(true);
    // Pre-fetch TC content for manual edit
    setLoadingTcContent(true);
    try {
      const { data } = await axios.get(`${API}/stage3/tc/${workflow.id}/${encodeURIComponent(tc.tc_number)}`);
      setManualContent(data.content);
    } catch {
      // Not critical — user can type manually
    }
    setLoadingTcContent(false);
  };

  const handleFixTC = async () => {
    if (issueType !== 'manual' && !issueDesc.trim()) {
      message.warning('Please describe what is wrong with this TC.');
      return;
    }
    if (issueType === 'manual' && !manualContent.trim()) {
      message.warning('Please enter the corrected TC content.');
      return;
    }
    setFixing(true);
    try {
      await axios.post(`${API}/stage3/fix-tc`, {
        workflow_id: workflow.id,
        tc_number: fixingTC.tc_number,
        issue_type: issueType,
        description: issueDesc,
        manual_content: issueType === 'manual' ? manualContent : undefined,
      });
      message.success(`TC ${fixingTC.tc_number} updated in the test plan. Re-run classifier to update classification.`);
      setFixModal(false);
    } catch (err) {
      message.error('Fix failed: ' + (err.response?.data?.error || err.message));
    }
    setFixing(false);
  };

  // Chat handlers
  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');

    const userMsg = { role: 'user', content: text };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setChatLoading(true);

    try {
      const { data } = await axios.post(`${API}/stage4/chat`, {
        workflow_id: workflow.id,
        message: text,
        history: chatHistory,
      });

      const assistantMsg = { role: 'assistant', content: data.reply };
      setChatHistory(prev => [...prev, assistantMsg]);

      if (data.action_taken && data.updated_case) {
        // Update the TC row in the table
        setCases(prev => prev.map(c =>
          c.tc_number === data.fixed_tc ? { ...c, classification: data.new_classification } : c
        ));
        setSummary(prev => {
          const counts = { manual: 0, semi: 0, auto: 0 };
          cases.forEach(c => {
            const cl = c.tc_number === data.fixed_tc ? data.new_classification : c.classification;
            if (cl === 'Manual') counts.manual++;
            else if (cl === 'Semi-Automatable') counts.semi++;
            else counts.auto++;
          });
          return { ...prev, ...counts };
        });
        setUpdatedTCs(prev => new Set([...prev, data.fixed_tc]));
        message.success(`TC ${data.fixed_tc} fixed and reclassified → ${data.new_classification}`);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: '⚠️ Error: ' + (err.response?.data?.error || err.message) }]);
    }
    setChatLoading(false);
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleApprove = async () => {
    try {
      await axios.post(`${API}/stage4/approve`, { workflow_id: workflow.id, user_id: currentUser.id });
    } catch (e) { /* already approved */ }
    goToStage(7);
  };

  const columns = [
    { title: 'TC#', dataIndex: 'tc_number', width: 90 },
    { title: 'Title', dataIndex: 'title' },
    {
      title: 'Classification', dataIndex: 'classification', width: 200,
      render: (val, rec) => (
        <Select value={val} size="small" style={{ width: 170 }}
          onChange={v => handleOverride(rec.tc_number, v)}
          options={['Manual', 'Semi-Automatable', 'Automatable'].map(c => ({ value: c, label: <Tag color={CLASS_COLORS[c]}>{c}</Tag> }))}
        />
      )
    },
    {
      title: 'Fix', width: 70, align: 'center',
      render: (_, rec) => (
        <Button size="small" icon={<ToolOutlined />} onClick={() => openFixModal(rec)} title="Fix this test case in the plan" />
      )
    },
  ];

  return (
    <div>
      {workflow && (
        <Card style={{ marginBottom: 16, background: '#f0f5ff', borderColor: '#1890ff' }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text strong style={{ fontSize: 16, color: '#1890ff' }}>Workflow: {workflow.title || 'Untitled'}</Text>
            <Text type="secondary">Story: {workflow.jira_story_id || 'N/A'} | Release: {workflow.jira_release || 'N/A'}</Text>
          </Space>
        </Card>
      )}
      <Title level={4}><FundOutlined /> Stage 4: Test Case Classification</Title>
      
      {/* Navigation */}
      <Space style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => goToStage(3)}
        >
          Back to Stage 3 (Test Plan)
        </Button>
      </Space>
      
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[['🔴 Manual', summary.manual, 'red'], ['🟡 Semi-Auto', summary.semi, 'orange'], ['🟢 Automatable', summary.auto, 'green'], ['Total', summary.total, 'blue']].map(([label, val, color]) => (
          <Col span={6} key={label}>
            <Card><Statistic title={label} value={val || 0} valueStyle={{ color }} /></Card>
          </Col>
        ))}
      </Row>
      <Button type="primary" onClick={handleClassify} loading={loading} style={{ marginBottom: 12 }}>
        🤖 Run TCL Classifier
      </Button>
      {loading && <Spin style={{ display: 'block', marginBottom: 12 }} />}
      {cases.length > 0 && (
        <Table
          dataSource={cases}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ y: 300 }}
          rowClassName={rec => updatedTCs.has(rec.tc_number) ? 'tc-updated-row' : ''}
        />
      )}
      <style>{`.tc-updated-row td { background: #f6ffed !important; transition: background 1s; }`}</style>

      <ApprovalPanel onApprove={handleApprove} disabled={cases.length === 0} approvalNote="Review classifications. You can override any TC before approving." />

      {/* ── Chat Panel ──────────────────────────────────────────────────────── */}
      <Divider />
      <div style={{ marginBottom: 8 }}>
        <Button
          type={chatOpen ? 'default' : 'primary'}
          icon={<MessageOutlined />}
          onClick={() => setChatOpen(o => !o)}
        >
          {chatOpen ? 'Hide Chat' : '💬 Chat with AI'}
        </Button>
        {chatHistory.some(h => h.role === 'assistant') && !chatOpen && (
          <Badge count={chatHistory.filter(h => h.role === 'assistant').length} style={{ marginLeft: 8 }} />
        )}
      </div>

      {chatOpen && (
        <Card
          size="small"
          title={<Space><RobotOutlined style={{ color: '#1890ff' }} /><Text strong>TC Automation Advisor</Text><Text type="secondary" style={{ fontSize: 12 }}>Ask why a TC is Semi-Auto, request step changes, and I'll fix + reclassify it automatically</Text></Space>}
          style={{ border: '1px solid #91caff', borderRadius: 8 }}
        >
          {/* Message history */}
          <div style={{ height: 320, overflowY: 'auto', padding: '8px 4px', marginBottom: 8 }}>
            {chatHistory.length === 0 && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                💡 Try: <em>"Why is TC 5.3.7 Semi-Automatable?"</em> or <em>"Make TC 5.3.10 automatable by replacing NETCONF steps with CLI"</em>
              </Text>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
                    <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
                  </div>
                )}
                <div style={{
                  maxWidth: '78%',
                  background: msg.role === 'user' ? '#1890ff' : '#f5f5f5',
                  color: msg.role === 'user' ? '#fff' : '#000',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  padding: '8px 12px',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8, flexShrink: 0 }}>
                    <UserOutlined style={{ color: '#fff', fontSize: 14 }} />
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
                </div>
                <Spin size="small" /><Text type="secondary" style={{ fontSize: 12 }}>Thinking…</Text>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder='e.g. "Why is 5.3.7 Semi-Automatable?" or "Fix 5.3.10 — replace NETCONF with CLI equivalent steps"'
              autoSize={{ minRows: 1, maxRows: 3 }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
              disabled={chatLoading}
            />
            <Button type="primary" icon={<SendOutlined />} onClick={sendChatMessage} loading={chatLoading} style={{ height: 'auto' }} />
          </Space.Compact>
        </Card>
      )}

      {/* Fix TC Modal */}
      <Modal
        title={<span><ToolOutlined /> Fix Test Case: <Text code>{fixingTC?.tc_number}</Text> — {fixingTC?.title}</span>}
        open={fixModal}
        onCancel={() => setFixModal(false)}
        onOk={handleFixTC}
        okText={issueType === 'manual' ? 'Save Manual Edit' : '🤖 Fix with AI'}
        confirmLoading={fixing}
        width={640}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>What is the issue with this test case?</Text>
            <Radio.Group
              value={issueType}
              onChange={e => setIssueType(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}
            >
              {ISSUE_TYPES.map(t => <Radio key={t.value} value={t.value}>{t.label}</Radio>)}
            </Radio.Group>
          </div>

          {issueType === 'manual' ? (
            <div>
              <Text strong>Edit the test case content:</Text>
              {loadingTcContent
                ? <Spin style={{ display: 'block', marginTop: 8 }} tip="Loading current TC content..." />
                : <TextArea
                    rows={14}
                    value={manualContent}
                    onChange={e => setManualContent(e.target.value)}
                    style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12 }}
                  />
              }
            </div>
          ) : (
            <div>
              <Text strong>Describe what should be fixed <Text type="secondary">(required)</Text>:</Text>
              <TextArea
                rows={4}
                value={issueDesc}
                onChange={e => setIssueDesc(e.target.value)}
                placeholder="e.g. Step 3 is missing — it should include configuring the SNMP community string before running the walk. Also add an expected result for the trap check."
                style={{ marginTop: 6 }}
              />
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
}
