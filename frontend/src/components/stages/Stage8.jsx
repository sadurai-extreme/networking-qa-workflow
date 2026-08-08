import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Table, Tag, Space, Typography, Statistic, Row, Col,
  Modal, Radio, Input, Select, Tabs, message, Spin, Divider, Badge,
  Alert, Form, Tooltip
} from 'antd';
import {
  PlayCircleOutlined, CheckOutlined, CloseOutlined, MinusCircleOutlined,
  StopOutlined, ArrowLeftOutlined, DownloadOutlined, EditOutlined,
  DesktopOutlined, SaveOutlined, FileTextOutlined, RobotOutlined, PlusOutlined,
  DeleteOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { useWorkflowStore, useAuthStore } from '../../store';
import { useWorkflowNavigation } from '../../hooks/useWorkflowNavigation';
import ApprovalPanel from '../shared/ApprovalPanel';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const PLATFORMS = [
  'X440G2','X450G2','X460G2','X465',
  '4120','4220','5120','5220','5320','5420','5520','5720','7520','7720',
  'Stack',
];

const RESULT_CONFIG = {
  not_run: { color: 'error',    label: 'NOT RUN',  icon: <MinusCircleOutlined /> },
  pass:    { color: 'success',  label: 'PASS',     icon: <CheckOutlined /> },
  fail:    { color: 'error',    label: 'FAIL',     icon: <CloseOutlined /> },
  blocked: { color: 'warning',  label: 'BLOCKED',  icon: <StopOutlined /> },
};

const CLASS_COLOR = { Automatable: 'green', 'Semi-Automatable': 'orange', Manual: 'blue' };

export default function Stage8() {
  const { workflow, advanceStage } = useWorkflowStore();
  const { goToStage } = useWorkflowNavigation();
  const { user: currentUser } = useAuthStore();

  // ── TC execution state ───────────────────────────────────────────────────
  const [tcs, setTcs]         = useState([]);
  const [summary, setSummary] = useState({ total: 0, not_run: 0, pass: 0, fail: 0, blocked: 0 });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // ── Execution session state ──────────────────────────────────────────────
  const [sessionPlatform,    setSessionPlatform]    = useState('');
  const [sessionCustomPlat,  setSessionCustomPlat]  = useState('');
  const [sessionBuild,       setSessionBuild]       = useState('');
  const [sessionEnv,         setSessionEnv]         = useState('');
  const [sessionId,          setSessionId]          = useState(null);
  const [sessionSaving,      setSessionSaving]      = useState(false);
  const [sessionSaved,       setSessionSaved]       = useState(false);

  // ── Record result modal state ────────────────────────────────────────────
  const [recordModal,   setRecordModal]   = useState(false);
  const [recordTC,      setRecordTC]      = useState(null);
  const [recordResult,  setRecordResult]  = useState('pass');
  const [recordNotes,   setRecordNotes]   = useState('');
  const [recordSteps,   setRecordSteps]   = useState('');
  const [recordPlatform,setRecordPlatform]= useState('');
  const [recordBuild,   setRecordBuild]   = useState('');
  const [recordLoading, setRecordLoading] = useState(false);

  // ── Update test plan state ───────────────────────────────────────────────
  const [updating,     setUpdating]     = useState(false);
  const [finalizing,   setFinalizing]   = useState(false);
  const [updatedPlan,  setUpdatedPlan]  = useState('');
  const [finalPlan,    setFinalPlan]    = useState('');
  const [finalDocId,   setFinalDocId]   = useState(null);
  const [planTab,      setPlanTab]      = useState('quick');

  // ── TC Editor modal state ────────────────────────────────────────────────
  const [tcEditorVisible, setTcEditorVisible] = useState(false);
  const [editingTc,       setEditingTc]       = useState(null);   // TC being edited
  const [editTitle,       setEditTitle]       = useState('');
  const [editDesc,        setEditDesc]        = useState('');
  const [editClass,       setEditClass]       = useState('');
  const [tcSaving,        setTcSaving]        = useState(false);
  const [tcFilter,        setTcFilter]        = useState('');

  // ── Load execution data ──────────────────────────────────────────────────
  const loadExecution = useCallback(async () => {
    if (!workflow?.id) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/stage8/execution/${workflow.id}`);
      setTcs(data.tcs || []);
      setSummary(data.summary || {});
      // Restore latest session context
      if (data.latestSession) {
        const s = data.latestSession;
        if (PLATFORMS.includes(s.platform)) {
          setSessionPlatform(s.platform);
        } else {
          setSessionPlatform('__other__');
          setSessionCustomPlat(s.platform);
        }
        setSessionBuild(s.build || '');
        setSessionEnv(s.environment || '');
        setSessionId(s.id);
        setSessionSaved(true);
      }
    } catch { message.error('Failed to load execution data'); }
    finally { setLoading(false); }
  }, [workflow?.id]);

  const loadFinalPlan = useCallback(async () => {
    if (!workflow?.id) return;
    try {
      const { data } = await axios.get(`${API}/stage8/final-plan/${workflow.id}`);
      if (data.content) { setFinalPlan(data.content); setFinalDocId(data.doc_id); }
    } catch { /* no final plan yet */ }
  }, [workflow?.id]);

  // Load existing quick-updated plan (check if test plan already has execution results appended)
  const loadUpdatedPlan = useCallback(async () => {
    if (!workflow?.id) return;
    try {
      const { data } = await axios.post(`${API}/stage8/execution/update-plan`, { workflow_id: workflow.id, dry_run: true });
      if (data.content) setUpdatedPlan(data.content);
    } catch { /* no updated plan yet */ }
  }, [workflow?.id]);

  useEffect(() => { loadExecution(); loadFinalPlan(); loadUpdatedPlan(); }, [loadExecution, loadFinalPlan, loadUpdatedPlan]);

  // ── Save execution session ───────────────────────────────────────────────
  const saveSession = async () => {
    const plat = sessionPlatform === '__other__' ? sessionCustomPlat.trim() : sessionPlatform;
    if (!plat)          return message.warning('Select or enter a platform');
    if (!sessionBuild.trim()) return message.warning('Enter a build number');
    setSessionSaving(true);
    try {
      const { data } = await axios.post(`${API}/stage8/execution/session`, {
        workflow_id: workflow.id,
        platform:    plat,
        build:       sessionBuild.trim(),
        environment: sessionEnv.trim(),
        started_by:  currentUser?.name || currentUser?.username || 'Unknown',
      });
      setSessionId(data.session_id);
      setSessionSaved(true);
      message.success('Execution session saved');
    } catch { message.error('Failed to save session'); }
    finally { setSessionSaving(false); }
  };

  // ── Open record modal ────────────────────────────────────────────────────
  const openRecord = (tc) => {
    const plat = sessionPlatform === '__other__' ? sessionCustomPlat.trim() : sessionPlatform;
    setRecordTC(tc);
    setRecordResult(tc.result !== 'not_run' ? tc.result : 'pass');
    setRecordNotes(tc.notes || '');
    setRecordSteps(tc.updated_steps || '');
    setRecordPlatform(tc.platform || plat || '');
    setRecordBuild(tc.build || sessionBuild || '');
    setRecordModal(true);
  };

  const saveRecord = async () => {
    if (!recordTC) return;
    setRecordLoading(true);
    try {
      await axios.post(`${API}/stage8/execution/record`, {
        workflow_id:   workflow.id,
        tc_number:     recordTC.tc_number,
        result:        recordResult,
        notes:         recordNotes,
        executed_by:   currentUser?.name || currentUser?.username || 'Unknown',
        updated_steps: recordSteps,
        platform:      recordPlatform,
        build:         recordBuild,
        session_id:    sessionId,
      });
      message.success(`TC ${recordTC.tc_number} recorded as ${recordResult.toUpperCase()}`);
      setRecordModal(false);
      loadExecution();
    } catch { message.error('Failed to save result'); }
    finally { setRecordLoading(false); }
  };

  // ── Update Test Plan (quick, no AI) ─────────────────────────────────────
  const handleUpdatePlan = async () => {
    setUpdating(true);
    try {
      const { data } = await axios.post(`${API}/stage8/execution/update-plan`, { workflow_id: workflow.id });
      setUpdatedPlan(data.content);
      message.success('Test plan updated with execution results');
    } catch (e) { message.error(e?.response?.data?.error || 'Update failed'); }
    finally { setUpdating(false); }
  };

  // ── TC Editor handlers ───────────────────────────────────────────────────
  const openEditTc = async (tc) => {
    setEditingTc(tc);
    setEditTitle(tc.title);
    setEditClass(tc.classification || 'Manual');
    setEditDesc(''); // clear while loading
    try {
      const { data } = await axios.get(`${API}/stage8/tc-content/${workflow.id}/${encodeURIComponent(tc.tc_number)}`);
      setEditDesc(data.content || '');
    } catch {
      setEditDesc(tc.description || '');
    }
  };

  const handleSaveTc = async () => {
    if (!editingTc) return;
    setTcSaving(true);
    try {
      await axios.put(`${API}/stage8/tc/${editingTc.id}`, {
        title: editTitle,
        description: editDesc,
        classification: editClass,
      });
      message.success(`TC ${editingTc.tc_number} updated`);
      setEditingTc(null);
      await loadExecution();
    } catch (e) { message.error(e?.response?.data?.error || 'Save failed'); }
    finally { setTcSaving(false); }
  };

  const handleDeleteTc = (tc) => {
    Modal.confirm({
      title: `Delete TC ${tc.tc_number}?`,
      icon: <ExclamationCircleOutlined />,
      content: `"${tc.title}" — this will also remove its script and execution result. This cannot be undone.`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await axios.delete(`${API}/stage8/tc/${tc.id}`);
          message.success(`TC ${tc.tc_number} deleted`);
          if (editingTc?.id === tc.id) setEditingTc(null);
          await loadExecution();
        } catch (e) { message.error(e?.response?.data?.error || 'Delete failed'); }
      },
    });
  };

  // ── Generate Final Test Plan (AI) ────────────────────────────────────────
  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      const { data } = await axios.post(`${API}/stage8/execution/finalize`, { workflow_id: workflow.id });
      setFinalPlan(data.content);
      setFinalDocId(data.doc_id);
      message.success('Final test plan generated!');
    } catch { message.error('Finalization failed'); }
    finally { setFinalizing(false); }
  };

  const handleApprove = async () => {
    try {
      await axios.post(`${API}/stage8/approve`, { workflow_id: workflow.id, user_id: currentUser?.id });
    } catch { /* approval may already be recorded */ }
    try {
      await advanceStage();
    } catch { /* may already be at next stage */ }
    goToStage(9);
  };

  const downloadDoc = (content, suffix) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${suffix}-${workflow?.jira_story_id || workflow?.id}.md`;
    a.click();
  };

  // ── Filtered TCs ─────────────────────────────────────────────────────────
  const filteredTcs = tcs.filter(tc => {
    if (activeTab === 'all')    return true;
    if (activeTab === 'auto')   return tc.classification === 'Automatable';
    if (activeTab === 'semi')   return tc.classification === 'Semi-Automatable';
    if (activeTab === 'manual') return tc.classification === 'Manual';
    return true;
  });

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    { title: 'TC#',   dataIndex: 'tc_number', key: 'tc_number', width: 75, fixed: 'left' },
    { title: 'Title', dataIndex: 'title',     key: 'title', ellipsis: true },
    {
      title: 'Type', dataIndex: 'classification', key: 'class', width: 145,
      render: cls => <Tag color={CLASS_COLOR[cls] || 'default'}>{cls || '-'}</Tag>,
    },
    {
      title: 'Result', dataIndex: 'result', key: 'result', width: 115,
      filters: [
        { text: 'Pass',    value: 'pass' },
        { text: 'Fail',    value: 'fail' },
        { text: 'Blocked', value: 'blocked' },
        { text: 'Not Run', value: 'not_run' },
      ],
      onFilter: (v, r) => r.result === v,
      render: result => {
        const cfg = RESULT_CONFIG[result] || RESULT_CONFIG.not_run;
        const statusMap = { default: 'default', success: 'success', error: 'error', warning: 'warning' };
        return (
          <Badge
            status={statusMap[cfg.color] || 'default'}
            text={<Tag color={cfg.color === 'default' ? undefined : cfg.color} style={{ marginInlineEnd: 0 }}>{cfg.icon} {cfg.label}</Tag>}
          />
        );
      },
    },
    {
      title: 'Platform', dataIndex: 'platform', key: 'platform', width: 100,
      render: p => p ? <Tag color="geekblue">{p}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Build', dataIndex: 'build', key: 'build', width: 110,
      render: b => b ? <Text code style={{ fontSize: 11 }}>{b}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Executed By', dataIndex: 'executed_by', key: 'executed_by', width: 110,
      render: n => n ? <Text type="secondary" style={{ fontSize: 12 }}>{n}</Text> : '-',
    },
    {
      title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true,
      render: n => n ? <Tooltip title={n}><Text type="secondary" ellipsis style={{ maxWidth: 160 }}>{n}</Text></Tooltip> : '-',
    },
    {
      title: 'Action', key: 'action', width: 130, fixed: 'right',
      render: (_, tc) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openRecord(tc)}>
          Record Result
        </Button>
      ),
    },
  ];

  const tabItems = [
    { key: 'all',    label: `All (${tcs.length})` },
    { key: 'auto',   label: `Automatable (${tcs.filter(t => t.classification === 'Automatable').length})` },
    { key: 'semi',   label: `Semi-Auto (${tcs.filter(t => t.classification === 'Semi-Automatable').length})` },
    { key: 'manual', label: `Manual (${tcs.filter(t => t.classification === 'Manual').length})` },
  ];

  const effectivePlatform = sessionPlatform === '__other__' ? sessionCustomPlat.trim() : sessionPlatform;
  const allRecorded = summary.not_run === 0 && summary.total > 0;

  return (
    <div>
      {/* Workflow header */}
      {workflow && (
        <Card style={{ marginBottom: 16, background: '#f0f5ff', borderColor: '#1890ff' }}>
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
              Workflow: {workflow.title || 'Untitled'}
            </Text>
            <Text type="secondary">
              Story: {workflow.jira_story_id || 'N/A'} | Release: {workflow.jira_release || 'N/A'}
            </Text>
          </Space>
        </Card>
      )}

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => goToStage(7)}>Back to Script Generation</Button>
      </Space>

      <Title level={4}><PlayCircleOutlined /> TC Execution</Title>

      {/* ── Execution Session Card ─────────────────────────────────────────── */}
      <Card
        title={<Space><DesktopOutlined /><span>Execution Session</span></Space>}
        style={{ marginBottom: 20, borderColor: sessionSaved ? '#52c41a' : '#d9d9d9' }}
        extra={
          sessionSaved
            ? <Tag color="success" icon={<CheckOutlined />}>Session Active</Tag>
            : <Tag color="warning">Set platform & build before recording results</Tag>
        }
      >
        <Row gutter={[16, 12]} align="bottom">
          {/* Platform */}
          <Col xs={24} sm={8} md={6}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Platform *</Text>
            <Select
              value={sessionPlatform || undefined}
              onChange={v => { setSessionPlatform(v); setSessionSaved(false); }}
              placeholder="Select platform"
              style={{ width: '100%' }}
              showSearch
            >
              {PLATFORMS.map(p => <Option key={p} value={p}>{p}</Option>)}
              <Option value="__other__"><PlusOutlined /> Other (custom)</Option>
            </Select>
          </Col>

          {/* Custom platform (shown only when Other selected) */}
          {sessionPlatform === '__other__' && (
            <Col xs={24} sm={8} md={5}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Custom Platform *</Text>
              <Input
                value={sessionCustomPlat}
                onChange={e => { setSessionCustomPlat(e.target.value); setSessionSaved(false); }}
                placeholder="e.g. X690"
              />
            </Col>
          )}

          {/* Build */}
          <Col xs={24} sm={8} md={5}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Build / Version *</Text>
            <Input
              value={sessionBuild}
              onChange={e => { setSessionBuild(e.target.value); setSessionSaved(false); }}
              placeholder="e.g. 32.3.1.2"
            />
          </Col>

          {/* Environment */}
          <Col xs={24} sm={8} md={5}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Environment</Text>
            <Input
              value={sessionEnv}
              onChange={e => { setSessionEnv(e.target.value); setSessionSaved(false); }}
              placeholder="e.g. Lab-3, Regression"
            />
          </Col>

          {/* Save button */}
          <Col xs={24} sm={24} md={3}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={saveSession}
              loading={sessionSaving}
              style={{ width: '100%' }}
              disabled={!sessionPlatform || !sessionBuild.trim()}
            >
              {sessionSaved ? 'Update' : 'Save'}
            </Button>
          </Col>
        </Row>

        {sessionSaved && (
          <Alert
            style={{ marginTop: 12 }}
            type="success"
            showIcon
            message={
              <Text>
                Active session: <Text strong>{effectivePlatform}</Text> | Build: <Text code>{sessionBuild}</Text>
                {sessionEnv && <> | Env: <Text italic>{sessionEnv}</Text></>}
                {' '} — Results recorded below will use this platform & build.
              </Text>
            }
          />
        )}
      </Card>

      {/* ── Summary Stats ──────────────────────────────────────────────────── */}
      <Row gutter={12} style={{ marginBottom: 20 }}>
        {[
          { label: 'Total TCs',  value: summary.total,   color: '#1890ff' },
          { label: 'Pass',       value: summary.pass,    color: '#52c41a' },
          { label: 'Fail',       value: summary.fail,    color: '#ff4d4f' },
          { label: 'Blocked',    value: summary.blocked, color: '#fadb14' },
          { label: 'Not Run',    value: summary.not_run, color: '#ff4d4f' },
        ].map(s => (
          <Col key={s.label} flex="1">
            <Card size="small" style={{ textAlign: 'center', borderColor: s.color }}>
              <Statistic
                title={s.label}
                value={s.value ?? 0}
                valueStyle={{ color: s.color, fontSize: 22 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── TC Table ───────────────────────────────────────────────────────── */}
      <Card
        title="Test Cases"
        extra={
          <Button icon={<PlayCircleOutlined />} onClick={loadExecution} loading={loading} size="small">
            Refresh
          </Button>
        }
        style={{ marginBottom: 20 }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="small" style={{ marginBottom: 12 }} />
        <Table
          dataSource={filteredTcs}
          columns={columns}
          rowKey="tc_number"
          loading={loading}
          size="small"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} test cases` }}
          rowClassName={tc => {
            if (tc.result === 'pass')    return 'tc-row-pass';
            if (tc.result === 'fail')    return 'tc-row-fail';
            if (tc.result === 'blocked') return 'tc-row-blocked';
            return '';
          }}
        />
      </Card>

      {/* ── Update Test Plan ───────────────────────────────────────────────── */}
      <Divider />
      <Card
        title={<Space><FileTextOutlined /><span>Update Test Plan with Execution Results</span></Space>}
        style={{ marginBottom: 16 }}
        extra={
          <Button
            icon={<EditOutlined />}
            onClick={() => { setTcEditorVisible(true); setEditingTc(null); setTcFilter(''); }}
          >
            Edit Test Cases
          </Button>
        }
      >
        <Tabs
          activeKey={planTab}
          onChange={setPlanTab}
          items={[
            {
              key: 'quick',
              label: <Space><SaveOutlined />Quick Update (Instant)</Space>,
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">
                    Instantly appends an execution results table (with platform, build, pass/fail status)
                    to the existing test plan — no AI required, updates immediately.
                    {!allRecorded && summary.not_run > 0 &&
                      <Text type="warning"> Note: {summary.not_run} TC(s) still not recorded.</Text>
                    }
                  </Text>
                  <Space>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={updating}
                      onClick={handleUpdatePlan}
                    >
                      {updatedPlan ? 'Re-Update Test Plan' : 'Update Test Plan'}
                    </Button>
                    {updatedPlan && (
                      <Button icon={<DownloadOutlined />} onClick={() => downloadDoc(updatedPlan, 'test-plan-updated')}>
                        Download .md
                      </Button>
                    )}
                  </Space>
                  {updatedPlan && (
                    <div style={{ marginTop: 12, border: '1px solid #b7eb8f', borderRadius: 4, padding: 16, maxHeight: 400, overflow: 'auto', background: '#f6ffed' }}>
                      <ReactMarkdown>{updatedPlan}</ReactMarkdown>
                    </div>
                  )}
                </Space>
              ),
            },
            {
              key: 'ai',
              label: <Space><RobotOutlined />AI Final Report (Claude)</Space>,
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">
                    Uses AI to generate a polished final test execution report — includes executive summary,
                    per-TC execution results with notes, updated steps, and distribution-ready formatting.
                    {!allRecorded && summary.not_run > 0 &&
                      <Text type="warning"> Note: {summary.not_run} TC(s) still not recorded.</Text>
                    }
                  </Text>
                  <Space>
                    <Button
                      type="primary"
                      icon={<RobotOutlined />}
                      loading={finalizing}
                      onClick={handleFinalize}
                      style={{ background: '#722ed1', borderColor: '#722ed1' }}
                    >
                      {finalPlan ? 'Re-Generate Final Report' : 'Generate AI Final Report'}
                    </Button>
                    {finalPlan && (
                      <Button icon={<DownloadOutlined />} onClick={() => downloadDoc(finalPlan, 'final-test-plan')}>
                        Download .md
                      </Button>
                    )}
                  </Space>
                  {finalizing && <Spin tip="AI is generating your final test execution report..." style={{ marginTop: 8 }} />}
                  {finalPlan && (
                    <div style={{ marginTop: 12, border: '1px solid #d3adf7', borderRadius: 4, padding: 16, maxHeight: 500, overflow: 'auto', background: '#f9f0ff' }}>
                      <ReactMarkdown>{finalPlan}</ReactMarkdown>
                    </div>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <ApprovalPanel
        onApprove={handleApprove}
        approvalNote={
          (updatedPlan || finalPlan)
            ? 'Test plan updated. Ready to approve and proceed to Workflow Completion.'
            : 'Tip: Update the test plan with execution results before approving.'
        }
        disabled={false}
      />

      {/* ── Record Result Modal ───────────────────────────────────────────── */}
      <Modal
        title={`Record Result — TC ${recordTC?.tc_number}: ${recordTC?.title}`}
        open={recordModal}
        onCancel={() => setRecordModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setRecordModal(false)}>Cancel</Button>,
          <Button key="save" type="primary" loading={recordLoading} onClick={saveRecord}>Save Result</Button>,
        ]}
        width={640}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* Result */}
          <div>
            <Text strong>Result *</Text>
            <div style={{ marginTop: 6 }}>
              <Radio.Group value={recordResult} onChange={e => setRecordResult(e.target.value)}>
                <Radio.Button value="pass"><CheckOutlined style={{ color: '#52c41a' }} /> Pass</Radio.Button>
                <Radio.Button value="fail"><CloseOutlined style={{ color: '#ff4d4f' }} /> Fail</Radio.Button>
                <Radio.Button value="blocked"><StopOutlined style={{ color: '#faad14' }} /> Blocked</Radio.Button>
              </Radio.Group>
            </div>
          </div>

          {/* Platform + Build row */}
          <Row gutter={12}>
            <Col span={12}>
              <Text strong>Platform</Text>
              <Select
                value={recordPlatform || undefined}
                onChange={setRecordPlatform}
                placeholder="Select platform"
                style={{ width: '100%', marginTop: 4 }}
                showSearch
                allowClear
              >
                {PLATFORMS.map(p => <Option key={p} value={p}>{p}</Option>)}
                {/* Allow typing a custom value */}
              </Select>
              {/* Custom platform input if typed value not in list */}
              <Input
                style={{ marginTop: 4 }}
                value={PLATFORMS.includes(recordPlatform) ? '' : recordPlatform}
                onChange={e => setRecordPlatform(e.target.value)}
                placeholder="Or type custom platform"
                disabled={PLATFORMS.includes(recordPlatform)}
              />
            </Col>
            <Col span={12}>
              <Text strong>Build / Version</Text>
              <Input
                value={recordBuild}
                onChange={e => setRecordBuild(e.target.value)}
                placeholder="e.g. 32.3.1.2"
                style={{ marginTop: 4 }}
              />
            </Col>
          </Row>

          {/* Notes */}
          <div>
            <Text strong>Notes / Observations</Text>
            <TextArea
              value={recordNotes}
              onChange={e => setRecordNotes(e.target.value)}
              rows={3}
              placeholder="Describe what happened, errors encountered, deviations..."
              style={{ marginTop: 4 }}
            />
          </div>

          {/* Updated steps */}
          <div>
            <Text strong>Updated Test Steps <Text type="secondary">(optional — updates test plan)</Text></Text>
            <TextArea
              value={recordSteps}
              onChange={e => setRecordSteps(e.target.value)}
              rows={5}
              placeholder="Paste corrected test steps in markdown if steps need updating..."
              style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
        </Space>
      </Modal>

      <style>{`
        .tc-row-pass td  { background-color: #f6ffed !important; }
        .tc-row-pass:hover td { background-color: #d9f7be !important; }
        .tc-row-fail td  { background-color: #fff1f0 !important; }
        .tc-row-fail:hover td { background-color: #ffa39e55 !important; }
        .tc-row-blocked td { background-color: #fffbe6 !important; }
        .tc-row-blocked:hover td { background-color: #ffe58f55 !important; }
      `}</style>

      {/* ── TC Editor Modal ───────────────────────────────────────────────── */}
      <Modal
        title={<Space><EditOutlined /><span>Edit Test Cases</span></Space>}
        open={tcEditorVisible}
        onCancel={() => { setTcEditorVisible(false); setEditingTc(null); }}
        footer={null}
        width={900}
      >
        <div style={{ display: 'flex', gap: 16, height: 560 }}>
          {/* Left: TC list */}
          <div style={{ width: 260, borderRight: '1px solid #f0f0f0', paddingRight: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input.Search
              placeholder="Search TC…"
              value={tcFilter}
              onChange={e => setTcFilter(e.target.value)}
              size="small"
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {tcs
                .filter(tc => !tcFilter || tc.tc_number.includes(tcFilter) || tc.title.toLowerCase().includes(tcFilter.toLowerCase()))
                .map(tc => (
                  <div
                    key={tc.id}
                    onClick={() => openEditTc(tc)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: editingTc?.id === tc.id ? '#e6f7ff' : 'transparent',
                      borderLeft: editingTc?.id === tc.id ? '3px solid #1890ff' : '3px solid transparent',
                      marginBottom: 2,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text code style={{ fontSize: 11 }}>{tc.tc_number}</Text>
                      <Tag color={CLASS_COLOR[tc.classification] || 'default'} style={{ fontSize: 10, margin: 0 }}>
                        {tc.classification?.charAt(0) || '?'}
                      </Tag>
                    </div>
                    <Text style={{ fontSize: 12 }} ellipsis>{tc.title}</Text>
                  </div>
                ))}
            </div>
          </div>

          {/* Right: Edit form */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!editingTc ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Text type="secondary">Select a test case from the list to edit</Text>
              </div>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 15 }}>TC {editingTc.tc_number}</Text>
                  <Button
                    danger icon={<DeleteOutlined />} size="small"
                    onClick={() => handleDeleteTc(editingTc)}
                  >
                    Delete TC
                  </Button>
                </div>

                <div>
                  <Text strong>Title</Text>
                  <Input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    style={{ marginTop: 4 }}
                  />
                </div>

                <div>
                  <Text strong>Description / Test Steps</Text>
                  <TextArea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={10}
                    style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12 }}
                    placeholder="Enter test steps, expected results, prerequisites…"
                  />
                </div>

                <div>
                  <Text strong>Classification</Text>
                  <Select
                    value={editClass}
                    onChange={setEditClass}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    <Option value="Automatable">Automatable</Option>
                    <Option value="Semi-Automatable">Semi-Automatable</Option>
                    <Option value="Manual">Manual</Option>
                  </Select>
                </div>

                <Space>
                  <Button
                    type="primary" icon={<SaveOutlined />}
                    loading={tcSaving} onClick={handleSaveTc}
                  >
                    Save Changes
                  </Button>
                  <Button onClick={() => setEditingTc(null)}>Cancel</Button>
                </Space>
              </Space>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

