import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Typography,
  Space, Statistic, Row, Col, Popconfirm, message, Tabs, Badge,
  Timeline, Tooltip, Descriptions, Progress, Spin, Alert, Collapse,
  Empty,
} from 'antd';
import {
  UserAddOutlined, CrownOutlined, TeamOutlined, BranchesOutlined,
  AuditOutlined, ReloadOutlined, SearchOutlined, DeleteOutlined,
  ClockCircleOutlined, DatabaseOutlined, CloudServerOutlined,
  ThunderboltOutlined, LockOutlined, ArrowRightOutlined, SettingOutlined,
  BugOutlined, CheckCircleFilled, CloseCircleFilled, LoadingOutlined,
  MinusCircleFilled, PlayCircleOutlined, StopOutlined, ExperimentOutlined,
  EyeOutlined, SwapOutlined, WarningOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useAuthStore } from '../../store';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const { Title, Text } = Typography;

const ACTION_COLORS = {
  generate: 'blue', regenerate: 'purple', approve: 'green',
  amend: 'orange', edit: 'cyan', delete: 'red', complete: 'green',
  generate_xlsx: 'geekblue', qtest_upload: 'geekblue', generate_iso_docx: 'purple',
  login: 'default', logout: 'default',
};
function actionTag(type) {
  return <Tag color={ACTION_COLORS[type] || 'default'} style={{ fontFamily: 'monospace', fontSize: 11 }}>{type}</Tag>;
}
function relativeTime(ts) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ stats, activity, loading, onRefresh }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  if (!stats) return null;
  const statCards = [
    { label: 'Total Users',      value: stats.users,        color: '#1677ff' },
    { label: 'Total Workflows',  value: stats.workflows,    color: '#722ed1' },
    { label: 'Active',           value: stats.active,       color: '#1677ff' },
    { label: 'Completed',        value: stats.completed,    color: '#52c41a' },
    { label: 'Total Test Cases', value: stats.totalTc,      color: '#13c2c2' },
    { label: 'Exec Results',     value: stats.execResults,  color: '#52c41a' },
    { label: 'Audit Entries',    value: stats.auditEntries, color: '#8c8c8c' },
    { label: 'Documents',        value: stats.documents,    color: '#fa8c16' },
  ];
  const passColor = stats.passRate === null ? '#8c8c8c'
    : stats.passRate >= 80 ? '#52c41a' : stats.passRate >= 50 ? '#fa8c16' : '#ff4d4f';
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        {statCards.map(({ label, value, color }) => (
          <Col key={label} xs={12} sm={8} md={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic title={<Text style={{ fontSize: 12 }}>{label}</Text>} value={value} valueStyle={{ color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={16}>
        <Col span={8}>
          <Card title="Overall Pass Rate" size="small">
            {stats.passRate !== null ? (
              <>
                <Progress type="circle" percent={stats.passRate} strokeColor={passColor} size={100}
                  style={{ display: 'block', margin: '0 auto', textAlign: 'center' }} />
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Across all executed TCs</Text>
                </div>
              </>
            ) : <Text type="secondary">No execution results yet</Text>}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Workflows by Stage" size="small" bodyStyle={{ maxHeight: 180, overflowY: 'auto' }}>
            {(stats.stageRows || []).map(row => {
              const STAGE_DISPLAY_LABEL = {
                1: 'Stage 1: Jira Story',
                2: 'Stage 2: Skill File',
                3: 'Stage 3: Test Plan',
                4: 'Stage 4: TC Classification',
                7: 'Stage 5: Script Generation',
                8: 'Stage 6: TC Execution',
                9: 'Stage 7: Workflow Completion',
              };
              const label = STAGE_DISPLAY_LABEL[row.current_stage] || `Stage ${row.current_stage}`;
              return (
                <div key={row.current_stage} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12 }}>{label}</Text>
                  <Badge count={row.cnt} color="#1677ff" showZero />
                </div>
              );
            })}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Recent Activity" size="small"
            extra={<Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} />}
            bodyStyle={{ maxHeight: 180, overflowY: 'auto' }}>
            <Timeline size="small" items={(activity || []).slice(0, 8).map(a => ({
              children: (
                <Space direction="vertical" size={0}>
                  <Text style={{ fontSize: 11 }}>{actionTag(a.action_type)} {a.action?.slice(0, 50)}</Text>
                  <Text type="secondary" style={{ fontSize: 10 }}>{a.user_name || 'system'} · {relativeTime(a.created_at)}</Text>
                </Space>
              ),
            }))} />
          </Card>
        </Col>
      </Row>
      {stats.recent > 0 && (
        <Alert type="info" showIcon message={`${stats.recent} workflow${stats.recent > 1 ? 's' : ''} created in the last 7 days`} />
      )}
    </Space>
  );
}

// ── Audit Logs Tab — consolidated summary ─────────────────────────────────────
function AuditLogsTab({ headers }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await axios.get(`${API}/admin/audit-summary`, { headers });
      setData(d);
    } catch (err) { message.error('Failed to load activity summary: ' + err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  if (!data)   return null;

  // Workflow summary table columns
  const wfColumns = [
    { title: 'Workflow', key: 'wf', ellipsis: true,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.workflow_title || <Text type="secondary">Deleted</Text>}</Text>
          {r.jira_story_id && <Tag color="geekblue" style={{ fontSize: 10 }}>{r.jira_story_id}</Tag>}
        </Space>
      ) },
    { title: 'Owner', dataIndex: 'created_by_name', width: 120,
      render: v => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: 'Status', dataIndex: 'workflow_status', width: 100,
      render: s => s
        ? <Badge status={{ active: 'processing', completed: 'success' }[s] || 'default'} text={s} />
        : <Text type="secondary">—</Text> },
    { title: 'Actions', dataIndex: 'total_actions', width: 80,
      sorter: (a, b) => b.total_actions - a.total_actions,
      render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Action Types', dataIndex: 'action_types_csv', ellipsis: true,
      render: v => v
        ? v.split(',').slice(0, 4).map(t => (
            <Tag key={t} color={ACTION_COLORS[t] || 'default'} style={{ fontSize: 10, marginBottom: 2 }}>{t}</Tag>
          ))
        : '—' },
    { title: 'Last Activity', dataIndex: 'last_activity', width: 130,
      sorter: (a, b) => new Date(b.last_activity) - new Date(a.last_activity),
      defaultSortOrder: 'ascend',
      render: v => (
        <Tooltip title={v ? new Date(v).toLocaleString() : ''}>
          <Text style={{ fontSize: 11 }}>{relativeTime(v)}</Text>
        </Tooltip>
      ) },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Summary stat cards */}
      <Row gutter={[12, 12]}>
        {[
          { label: 'Total Actions',        value: data.total,               color: '#1677ff' },
          { label: 'Workflows Tracked',    value: data.byWorkflow.length,   color: '#722ed1' },
          { label: 'Actions Today',        value: data.today,               color: '#13c2c2' },
          { label: 'Action Types in Use',  value: data.byType.length,       color: '#fa8c16' },
        ].map(({ label, value, color }) => (
          <Col key={label} xs={12} sm={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic title={<Text style={{ fontSize: 12 }}>{label}</Text>}
                value={value} valueStyle={{ color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        {/* By-workflow table */}
        <Col xs={24} lg={16}>
          <Card
            title="Activity per Workflow"
            size="small"
            extra={<Button size="small" icon={<ReloadOutlined />} onClick={load} />}
          >
            <Table
              dataSource={data.byWorkflow}
              columns={wfColumns}
              rowKey="workflow_id"
              size="small"
              pagination={{ pageSize: 8, showTotal: t => `${t} workflows`, showSizeChanger: false }}
            />
          </Card>
        </Col>

        {/* Right panel: recent feed + type breakdown */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {/* Action type counts */}
            <Card title="By Action Type" size="small" bodyStyle={{ maxHeight: 180, overflowY: 'auto' }}>
              {data.byType.map(({ action_type, cnt }) => (
                <div key={action_type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  {actionTag(action_type)}
                  <Tag color="default">{cnt}</Tag>
                </div>
              ))}
            </Card>

            {/* Top users */}
            {data.byUser.length > 0 && (
              <Card title="Most Active Users" size="small">
                {data.byUser.map(({ user_name, cnt }) => (
                  <div key={user_name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ fontSize: 12 }}>{user_name}</Text>
                    <Tag color="blue">{cnt}</Tag>
                  </div>
                ))}
              </Card>
            )}
          </Space>
        </Col>
      </Row>

      {/* Recent activity feed */}
      <Card title="Recent Activity" size="small"
        extra={<Text type="secondary" style={{ fontSize: 12 }}>Latest 12 actions</Text>}>
        <Timeline size="small" items={data.recent.map(a => ({
          color: { generate: 'blue', approve: 'green', complete: 'green',
                   delete: 'red', amend: 'orange' }[a.action_type] || 'gray',
          children: (
            <Row gutter={8} style={{ marginBottom: 0 }}>
              <Col flex="auto">
                {actionTag(a.action_type)}
                <Text style={{ fontSize: 12, marginLeft: 6 }}>{a.action}</Text>
                {a.workflow_title && (
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                    — {a.workflow_title.slice(0, 35)}
                    {a.jira_story_id && <Tag color="geekblue" style={{ fontSize: 10, marginLeft: 4 }}>{a.jira_story_id}</Tag>}
                  </Text>
                )}
              </Col>
              <Col style={{ textAlign: 'right', minWidth: 130 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {a.user_name || 'system'} · {relativeTime(a.created_at)}
                </Text>
              </Col>
            </Row>
          ),
        }))} />
      </Card>
    </Space>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab({ headers }) {
  const [users, setUsers]       = useState([]);
  const [addModal, setAddModal] = useState(false);
  const [form]                  = Form.useForm();
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await axios.get(`${API}/users`, { headers }); setUsers(data); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, []);

  const handleAdd = async (values) => {
    try {
      await axios.post(`${API}/auth/register`, values, { headers });
      message.success('User created — default password: extreme');
      setAddModal(false); form.resetFields(); load();
    } catch (err) { message.error(err.response?.data?.error || err.message); }
  };
  const handleDelete = async (id) => {
    try { await axios.delete(`${API}/users/${id}`, { headers }); message.success('User deleted'); load(); }
    catch (err) { message.error(err.message); }
  };
  const handleRoleChange = async (id, role) => {
    try { await axios.put(`${API}/admin/users/${id}/role`, { role }, { headers }); message.success('Role updated'); load(); }
    catch (err) { message.error(err.message); }
  };
  const handleResetPwd = async (id, name) => {
    try { await axios.post(`${API}/admin/users/${id}/reset-password`, {}, { headers }); message.success(`Password for ${name} reset to: extreme`); }
    catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Name',     dataIndex: 'name',     sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Email',    dataIndex: 'email',    ellipsis: true },
    { title: 'Username', dataIndex: 'username' },
    { title: 'Role', dataIndex: 'role', width: 140,
      render: (r, rec) => rec.id === 'user-admin'
        ? <Tag color="gold">👑 System Admin</Tag>
        : <Select size="small" value={r} style={{ width: 115 }} onChange={v => handleRoleChange(rec.id, v)}
            options={[{ value: 'admin', label: '👑 Admin' }, { value: 'user', label: '👤 User' }]} /> },
    { title: 'Created', dataIndex: 'created_at', width: 110, render: v => v?.substring(0, 10) },
    { title: 'Actions', width: 195,
      render: (_, rec) => rec.id === 'user-admin' ? null : (
        <Space size={4}>
          <Popconfirm title={`Reset password for "${rec.name}" to "extreme"?`}
            onConfirm={() => handleResetPwd(rec.id, rec.name)}>
            <Button size="small" icon={<LockOutlined />}>Reset Pwd</Button>
          </Popconfirm>
          <Popconfirm title="Delete this user?" onConfirm={() => handleDelete(rec.id)}>
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ) },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">{users.length} users registered</Text>
        <Button type="primary" icon={<UserAddOutlined />} onClick={() => setAddModal(true)}>Add User</Button>
      </div>
      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} size="small" pagination={false} />
      <Modal title="Add New User" open={addModal}
        onCancel={() => { setAddModal(false); form.resetFields(); }} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="name"  label="Full Name" rules={[{ required: true }]}><Input placeholder="e.g. John Smith" /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input placeholder="john@company.com" /></Form.Item>
          <Form.Item name="username" label="Username"><Input placeholder="Auto-generated if empty" /></Form.Item>
          <Form.Item name="role" label="Role" initialValue="user">
            <Select options={[{ value: 'user', label: '👤 User' }, { value: 'admin', label: '👑 Admin' }]} />
          </Form.Item>
          <Alert type="info" showIcon message="Default password: extreme" style={{ marginBottom: 12 }} />
          <Button type="primary" htmlType="submit" block>Create User</Button>
        </Form>
      </Modal>
    </Space>
  );
}

// ── Workflows Tab ─────────────────────────────────────────────────────────────
function WorkflowsTab({ headers }) {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await axios.get(`${API}/admin/workflows`, { headers }); setWorkflows(data); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, []);

  const handleDelete = async (id, title) => {
    try {
      await axios.delete(`${API}/admin/workflows/${id}`, { headers });
      message.success(`Deleted "${title}"`); load();
    } catch (err) { message.error(err.message); }
  };

  const filtered = workflows.filter(w => {
    const m = !search || [w.title, w.jira_story_id, w.created_by_name]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const s = !statusFilter || w.status === statusFilter;
    return m && s;
  });

  const columns = [
    { title: 'Title', dataIndex: 'title', ellipsis: true,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          <Space size={4}>
            {r.jira_story_id && <Tag color="geekblue" style={{ fontSize: 10 }}>{r.jira_story_id}</Tag>}
            {r.jira_story_type && <Tag style={{ fontSize: 10 }}>{r.jira_story_type}</Tag>}
          </Space>
        </Space>
      ) },
    { title: 'Owner',   dataIndex: 'created_by_name', width: 120 },
    { title: 'Release', dataIndex: 'jira_release',    width: 110, render: v => v || '—' },
    { title: 'Stage',   dataIndex: 'current_stage',   width: 75,
      render: v => <Tag color="blue">S{v}/9</Tag> },
    { title: 'Status',  dataIndex: 'status', width: 110,
      render: s => <Badge status={{ active: 'processing', completed: 'success' }[s] || 'default'} text={s} /> },
    { title: 'TCs', dataIndex: 'tc_count', width: 55 },
    { title: 'Results', key: 'res', width: 95,
      render: (_, r) => r.tc_count > 0
        ? <Space size={2}><Tag color="green" style={{ fontSize: 10 }}>{r.passed_count}P</Tag><Tag color="red" style={{ fontSize: 10 }}>{r.failed_count}F</Tag></Space>
        : '—' },
    { title: 'Logs', dataIndex: 'audit_count', width: 50,
      render: v => <Text type="secondary">{v}</Text> },
    { title: 'Created', dataIndex: 'created_at', width: 100, render: v => v?.substring(0, 10) },
    { title: '', key: 'act', width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Open workflow">
            <Button size="small" icon={<ArrowRightOutlined />}
              onClick={() => navigate(`/workflow/${r.id}/stage/${r.current_stage}`)} />
          </Tooltip>
          <Popconfirm title={<>Delete <b>"{r.title}"</b>?<br /><Text type="danger" style={{ fontSize: 12 }}>Deletes all TCs, results and logs.</Text></>}
            onConfirm={() => handleDelete(r.id, r.title)} okType="danger" okText="Delete">
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ) },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Row gutter={8} align="middle">
        <Col flex="auto">
          <Input placeholder="Search title, story ID, owner..." prefix={<SearchOutlined />}
            value={search} onChange={e => setSearch(e.target.value)} allowClear />
        </Col>
        <Col>
          <Select placeholder="Status" style={{ width: 130 }} value={statusFilter || undefined}
            onChange={v => setStatusFilter(v || '')} allowClear
            options={[{ value: 'active', label: '🔵 Active' }, { value: 'completed', label: '✅ Completed' }, { value: 'draft', label: '📝 Draft' }]} />
        </Col>
        <Col><Button icon={<ReloadOutlined />} onClick={load} /></Col>
        <Col><Text type="secondary" style={{ fontSize: 12 }}>{filtered.length} / {workflows.length}</Text></Col>
      </Row>
      <Table dataSource={filtered} columns={columns} rowKey="id" loading={loading} size="small"
        scroll={{ x: 1050 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} workflows` }} />
    </Space>
  );
}

// ── System Tab ────────────────────────────────────────────────────────────────
function SystemTab({ headers }) {
  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await axios.get(`${API}/admin/system`, { headers }); setInfo(data); }
    catch (err) { message.error('Failed to load system info: ' + err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;
  if (!info)   return null;

  const heapPct = Math.round((info.memory.heapUsed / info.memory.heapTotal) * 100);
  const osPct   = Math.round(((info.os.totalMem - info.os.freeMem) / info.os.totalMem) * 100);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Card title={<><CloudServerOutlined /> Node.js Server</>} size="small">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Node Version">{info.node}</Descriptions.Item>
            <Descriptions.Item label="Platform">{info.platform} ({info.arch})</Descriptions.Item>
            <Descriptions.Item label="Uptime"><Tag color="green">{info.uptimeHuman}</Tag></Descriptions.Item>
            <Descriptions.Item label="Heap">
              {info.memory.heapUsed}MB / {info.memory.heapTotal}MB
              {' '}<Progress percent={heapPct} size="small" style={{ width: 80, display: 'inline-flex' }} showInfo={false} />
            </Descriptions.Item>
            <Descriptions.Item label="RSS">{info.memory.rss} MB</Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card title={<><SettingOutlined /> Operating System</>} size="small">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Hostname">{info.os.hostname}</Descriptions.Item>
            <Descriptions.Item label="OS">{info.os.type} {info.os.release}</Descriptions.Item>
            <Descriptions.Item label="CPUs">{info.os.cpus} cores</Descriptions.Item>
            <Descriptions.Item label="Memory">
              {info.os.totalMem - info.os.freeMem}MB / {info.os.totalMem}MB
              {' '}<Progress percent={osPct} size="small" style={{ width: 80, display: 'inline-flex' }}
                strokeColor={osPct > 85 ? '#ff4d4f' : undefined} showInfo={false} />
            </Descriptions.Item>
            <Descriptions.Item label="Free Mem">{info.os.freeMem} MB</Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card title={<><DatabaseOutlined /> SQLite Database</>} size="small">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Path">
              <Text style={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>{info.db.path}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Size">
              {info.db.sizeMB ? `${info.db.sizeMB} MB` : <Text type="secondary">N/A</Text>}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card title={<><CloudServerOutlined /> Uploaded Files</>} size="small">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Path">
              <Text style={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>{info.uploads.path}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Files">{info.uploads.count}</Descriptions.Item>
            <Descriptions.Item label="Total Size">{info.uploads.sizeMB} MB</Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col span={24} style={{ textAlign: 'right' }}>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
      </Col>
    </Row>
  );
}

// ── System Tests Tab ──────────────────────────────────────────────────────────
const CLIENT_TESTS = [
  {
    id: 'api_health', category: 'Backend Health',
    name: 'API server reachable',
    desc: 'GET /api/health → 200 OK',
    run: async (api, headers) => {
      const r = await axios.get(`${api}/health`);
      if (r.status !== 200) throw new Error(`Status ${r.status}`);
      return `Status 200 — ${JSON.stringify(r.data).slice(0, 80)}`;
    },
  },
  {
    id: 'admin_stats', category: 'Backend Health',
    name: 'Admin stats endpoint',
    desc: 'GET /api/admin/stats → returns workflow/user counts',
    run: async (api, headers) => {
      const r = await axios.get(`${api}/admin/stats`, { headers });
      const d = r.data;
      if (d.workflows === undefined) throw new Error('Missing workflows field');
      return `workflows=${d.workflows}, users=${d.users}, testCases=${d.totalTc}`;
    },
  },
  {
    id: 'auth_valid', category: 'Authentication',
    name: 'Valid login accepted',
    desc: 'POST /api/auth/login with admin credentials → token returned',
    run: async (api, headers) => {
      const r = await axios.post(`${api}/auth/login`, { username: 'extreme', password: 'extreme' });
      if (!r.data.token) throw new Error('No token in response');
      return `Token issued — user: ${r.data.user?.name || r.data.user?.email}`;
    },
  },
  {
    id: 'auth_invalid', category: 'Authentication',
    name: 'Invalid login rejected',
    desc: 'POST /api/auth/login with wrong credentials → 401 returned',
    run: async (api, headers) => {
      try {
        await axios.post(`${api}/auth/login`, { identifier: 'nobody_test_user', password: 'wrongpass123' });
        throw new Error('Expected 401 but got 200 — invalid logins are NOT being rejected!');
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 400) return 'Correctly rejected with ' + err.response.status;
        throw err;
      }
    },
  },
  {
    id: 'auth_me', category: 'Authentication',
    name: 'Session token validates',
    desc: 'GET /api/auth/me with Bearer token → returns current user',
    run: async (api, headers) => {
      const r = await axios.get(`${api}/auth/me`, { headers });
      if (!r.data.id) throw new Error('No user id in response');
      return `Authenticated as: ${r.data.name} (${r.data.role})`;
    },
  },
  {
    id: 'workflows_list', category: 'Workflow API',
    name: 'Workflows list returns array',
    desc: 'GET /api/workflows → array with id, title, current_stage fields',
    run: async (api, headers) => {
      const r = await axios.get(`${api}/workflows`, { headers });
      if (!Array.isArray(r.data)) throw new Error('Response is not an array');
      if (r.data.length > 0) {
        const w = r.data[0];
        if (!w.id || !w.title) throw new Error('Workflow missing id or title');
      }
      return `${r.data.length} workflow(s) returned`;
    },
  },
  {
    id: 'workflows_fields', category: 'Workflow API',
    name: 'Workflow has required fields',
    desc: 'Latest workflow has: id, title, current_stage, jira_story_id, status',
    run: async (api, headers) => {
      const r = await axios.get(`${api}/workflows`, { headers });
      if (!r.data.length) return 'No workflows to check (skip)';
      const w = r.data[0];
      const required = ['id', 'title', 'current_stage', 'status'];
      const missing = required.filter(f => w[f] === undefined);
      if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}`);
      return `All required fields present — stage ${w.current_stage}, status: ${w.status}`;
    },
  },
  {
    id: 'stage9_report', category: 'Stage APIs',
    name: 'Stage 9 summary report',
    desc: 'GET /api/stage9/:id → report with stages, test_cases, summary',
    run: async (api, headers) => {
      const wList = await axios.get(`${api}/workflows`, { headers });
      if (!wList.data.length) return 'No workflows available (skip)';
      const wId = wList.data[0].id;
      const r = await axios.get(`${api}/stage9/${wId}`, { headers });
      const d = r.data;
      const required = ['workflow', 'stages', 'summary', 'test_cases'];
      const missing = required.filter(f => d[f] === undefined);
      if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}`);
      return `workflow: "${d.workflow.title}", TCs: ${d.test_cases.length}, stages: ${d.stages.length}`;
    },
  },
  {
    id: 'test_cases_list', category: 'Stage APIs',
    name: 'Test cases retrievable',
    desc: 'GET /api/stage4/:workflowId → test cases with classification',
    run: async (api, headers) => {
      const wList = await axios.get(`${api}/workflows`, { headers });
      if (!wList.data.length) return 'No workflows available (skip)';
      const wId = wList.data[0].id;
      const r = await axios.get(`${api}/stage4/${wId}`, { headers });
      const tcs = r.data.cases || r.data.test_cases || (Array.isArray(r.data) ? r.data : null);
      if (!Array.isArray(tcs)) throw new Error('Expected array of test cases');
      return `${tcs.length} test case(s) — first: "${(tcs[0]?.title || '—').slice(0, 50)}"`;
    },
  },
  {
    id: 'admin_users', category: 'Admin APIs',
    name: 'Users list accessible',
    desc: 'GET /api/users → array of user objects',
    run: async (api, headers) => {
      const r = await axios.get(`${api}/users`, { headers });
      if (!Array.isArray(r.data)) throw new Error('Expected array');
      const admins = r.data.filter(u => u.role === 'admin').length;
      return `${r.data.length} user(s), ${admins} admin(s)`;
    },
  },
  {
    id: 'admin_audit', category: 'Admin APIs',
    name: 'Audit trail accessible',
    desc: 'GET /api/admin/audit-summary → grouped audit log entries',
    run: async (api, headers) => {
      const r = await axios.get(`${api}/admin/audit-summary`, { headers });
      const entries = r.data.byWorkflow || [];
      return `${entries.length} workflow audit group(s), ${r.data.total || 0} total actions`;
    },
  },
  {
    id: 'admin_workflows', category: 'Admin APIs',
    name: 'Admin workflow list',
    desc: 'GET /api/admin/workflows → paginated list',
    run: async (api, headers) => {
      const r = await axios.get(`${api}/admin/workflows?page=1&limit=5`, { headers });
      const list = r.data.workflows || r.data;
      if (!Array.isArray(list)) throw new Error('Expected array');
      return `${list.length} workflow(s) in page 1`;
    },
  },
];

const STATUS_ICON = {
  pending:  <MinusCircleFilled style={{ color: '#d9d9d9' }} />,
  running:  <LoadingOutlined style={{ color: '#1677ff' }} spin />,
  pass:     <CheckCircleFilled style={{ color: '#52c41a' }} />,
  fail:     <CloseCircleFilled style={{ color: '#ff4d4f' }} />,
  skip:     <MinusCircleFilled style={{ color: '#faad14' }} />,
};

function StatusTag({ status }) {
  const map = {
    pending: { color: 'default',   text: 'Pending' },
    running: { color: 'processing', text: 'Running' },
    pass:    { color: 'success',    text: 'Pass' },
    fail:    { color: 'error',      text: 'Fail' },
    skip:    { color: 'warning',    text: 'Skip' },
  };
  const { color, text } = map[status] || map.pending;
  return <Badge status={color} text={text} />;
}

function SystemTestsTab({ headers }) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const [results, setResults] = useState({});   // id → { status, detail, duration }
  const [serverChecks, setServerChecks] = useState([]);
  const [serverStatus, setServerStatus] = useState('idle'); // idle | running | done
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);

  const allTests = [
    ...CLIENT_TESTS,
    ...serverChecks.map(c => ({
      id: `srv_${c.id}`, category: 'Server-Side Checks',
      name: c.name, desc: c.detail || c.name,
      _serverResult: c,
    })),
  ];

  const categories = [...new Set(allTests.map(t => t.category))];

  const setResult = (id, val) => setResults(prev => ({ ...prev, [id]: val }));

  const runTest = async (test) => {
    if (test._serverResult) {
      setResult(test.id, {
        status: test._serverResult.status,
        detail: test._serverResult.detail,
        duration: test._serverResult.duration,
      });
      return;
    }
    setResult(test.id, { status: 'running', detail: '', duration: 0 });
    const t0 = Date.now();
    try {
      const detail = await test.run(API_URL, headers);
      const status = detail?.startsWith?.('No ') && detail?.includes('skip') ? 'skip' : 'pass';
      setResult(test.id, { status, detail, duration: Date.now() - t0 });
    } catch (err) {
      const detail = err.response
        ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 200)}`
        : err.message;
      setResult(test.id, { status: 'fail', detail, duration: Date.now() - t0 });
    }
  };

  const loadServerChecks = async () => {
    setServerStatus('running');
    try {
      const r = await axios.get(`${API_URL}/admin/system-checks`, { headers });
      setServerChecks(r.data.checks || []);
      // pre-fill results for server checks
      (r.data.checks || []).forEach(c => {
        setResult(`srv_${c.id}`, { status: c.status, detail: c.detail, duration: c.duration });
      });
    } catch (err) {
      message.error('Server checks failed: ' + err.message);
    } finally {
      setServerStatus('done');
    }
  };

  const runAll = async () => {
    abortRef.current = false;
    setRunning(true);
    // First load server checks
    await loadServerChecks();
    // Then run client tests sequentially
    for (const test of CLIENT_TESTS) {
      if (abortRef.current) break;
      await runTest(test);
    }
    setRunning(false);
  };

  const stopAll = () => { abortRef.current = true; setRunning(false); };

  const reset = () => { setResults({}); setServerChecks([]); setServerStatus('idle'); };

  const passed  = Object.values(results).filter(r => r.status === 'pass').length;
  const failed  = Object.values(results).filter(r => r.status === 'fail').length;
  const skipped = Object.values(results).filter(r => r.status === 'skip').length;
  const total   = allTests.length;
  const ran     = passed + failed + skipped;
  const passRate = ran > 0 ? Math.round((passed / ran) * 100) : 0;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Header / controls */}
      <Card size="small">
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space size={24}>
              <Statistic title="Total Tests" value={total} valueStyle={{ fontSize: 20 }} />
              <Statistic title="Passed" value={passed} valueStyle={{ fontSize: 20, color: '#52c41a' }} />
              <Statistic title="Failed" value={failed} valueStyle={{ fontSize: 20, color: failed > 0 ? '#ff4d4f' : '#8c8c8c' }} />
              <Statistic title="Skipped" value={skipped} valueStyle={{ fontSize: 20, color: '#faad14' }} />
              {ran > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Pass Rate</div>
                  <Progress type="circle" percent={passRate} size={48}
                    strokeColor={passRate === 100 ? '#52c41a' : passRate >= 70 ? '#faad14' : '#ff4d4f'} />
                </div>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              {running
                ? <Button danger icon={<StopOutlined />} onClick={stopAll}>Stop</Button>
                : <Button type="primary" icon={<PlayCircleOutlined />} onClick={runAll}>Run All Tests</Button>
              }
              <Button icon={<ReloadOutlined />} onClick={reset} disabled={running}>Reset</Button>
            </Space>
          </Col>
        </Row>
        {ran > 0 && (
          <Progress
            percent={Math.round((ran / total) * 100)}
            success={{ percent: Math.round((passed / total) * 100) }}
            strokeColor="#ff4d4f"
            style={{ marginTop: 12 }}
            showInfo={false}
          />
        )}
      </Card>

      {failed > 0 && (
        <Alert type="error" showIcon
          message={`${failed} test(s) failed`}
          description="Review the failed tests below to diagnose the issue."
        />
      )}
      {ran === total && total > 0 && failed === 0 && (
        <Alert type="success" showIcon message="All tests passed — system is healthy ✓" />
      )}

      {/* Test categories */}
      {categories.map(cat => {
        const tests = allTests.filter(t => t.category === cat);
        const catPassed = tests.filter(t => results[t.id]?.status === 'pass').length;
        const catFailed = tests.filter(t => results[t.id]?.status === 'fail').length;
        return (
          <Card
            key={cat}
            size="small"
            title={
              <Space>
                <BugOutlined />
                <Text strong>{cat}</Text>
                {catFailed > 0 && <Tag color="error">{catFailed} failed</Tag>}
                {catPassed === tests.length && catPassed > 0 && <Tag color="success">All pass</Tag>}
              </Space>
            }
            extra={
              <Button size="small" onClick={() => tests.forEach(t => runTest(t))} disabled={running}>
                Run Category
              </Button>
            }
          >
            {tests.map(test => {
              const res = results[test.id];
              const status = res?.status || 'pending';
              return (
                <div key={test.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid #f0f0f0',
                }}>
                  <div style={{ paddingTop: 2, flexShrink: 0 }}>{STATUS_ICON[status]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text strong style={{ fontSize: 13 }}>{test.name}</Text>
                      <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>{test.desc}</Text>
                      {res?.duration > 0 && (
                        <Text type="secondary" style={{ fontSize: 11 }}>{res.duration}ms</Text>
                      )}
                    </div>
                    {res?.detail && (
                      <div style={{
                        marginTop: 4, padding: '4px 8px', borderRadius: 4, fontSize: 12,
                        fontFamily: 'monospace', wordBreak: 'break-all',
                        background: status === 'fail' ? '#fff1f0' : status === 'pass' ? '#f6ffed' : '#fafafa',
                        color: status === 'fail' ? '#cf1322' : status === 'pass' ? '#389e0d' : '#595959',
                        border: `1px solid ${status === 'fail' ? '#ffa39e' : status === 'pass' ? '#b7eb8f' : '#e8e8e8'}`,
                      }}>
                        {res.detail}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <Space size={4}>
                      <StatusTag status={status} />
                      <Button size="small" onClick={() => runTest(test)} disabled={running}
                        style={{ fontSize: 11 }}>Run</Button>
                    </Space>
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })}
    </Space>
  );
}

// ── LLM Drift Tab ─────────────────────────────────────────────────────────────
const DRIFT_RISK_CONFIG = {
  high:     { color: '#ff4d4f', bg: '#fff1f0', border: '#ffa39e', label: 'High Drift',     icon: <WarningOutlined /> },
  medium:   { color: '#fa8c16', bg: '#fff7e6', border: '#ffd591', label: 'Medium Drift',   icon: <WarningOutlined /> },
  low:      { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', label: 'Low Drift',      icon: <InfoCircleOutlined /> },
  none:     { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', label: 'No Drift',       icon: <CheckCircleFilled /> },
  expected: { color: '#1677ff', bg: '#e6f4ff', border: '#91caff', label: 'Prompt Changed', icon: <SwapOutlined /> },
};
function DriftRiskTag({ risk }) {
  const cfg = DRIFT_RISK_CONFIG[risk] || DRIFT_RISK_CONFIG.none;
  return (
    <Tag style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bg }}>
      {cfg.icon} {cfg.label}
    </Tag>
  );
}

function LLMDriftTab({ headers }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [promptModal, setPromptModal] = useState(null); // { versionId, title }
  const [promptData, setPromptData]   = useState(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('snapshots');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await axios.get(`${API}/admin/llm-drift`, { headers });
      setData(d);
    } catch (err) { message.error('Failed to load LLM drift data: ' + err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const openPrompt = async (versionId, title) => {
    setPromptModal({ versionId, title });
    setPromptData(null);
    setPromptLoading(true);
    try {
      const { data: d } = await axios.get(`${API}/admin/llm-drift/${versionId}/prompt`, { headers });
      setPromptData(d);
    } catch (err) { message.error('Failed to load prompt: ' + err.message); }
    finally { setPromptLoading(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;

  const noData = !data || data.total_versions === 0;

  const snapshotColumns = [
    { title: 'Workflow', key: 'wf', ellipsis: true,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 12 }}>{r.workflow_title}</Text>
          {r.jira_story_id && <Tag color="geekblue" style={{ fontSize: 10 }}>{r.jira_story_id}</Tag>}
        </Space>
      ) },
    { title: 'Type', dataIndex: 'doc_type', width: 100,
      render: v => <Tag color={v === 'skill_file' ? 'purple' : 'blue'} style={{ fontSize: 11 }}>{v}</Tag> },
    { title: 'Version', dataIndex: 'version_number', width: 70, align: 'center',
      render: v => <Tag color="default">v{v}</Tag> },
    { title: 'Created', dataIndex: 'created_at', width: 130,
      render: v => <Text style={{ fontSize: 11 }}>{new Date(v).toLocaleString()}</Text> },
    { title: 'Output', dataIndex: 'output_len', width: 90, align: 'right',
      render: v => <Text style={{ fontSize: 12 }}>{v ? (v / 1000).toFixed(1) + 'K' : '—'}</Text> },
    { title: 'Sys Prompt', dataIndex: 'sys_prompt_len', width: 100, align: 'right',
      render: v => v ? <Tag color="cyan" style={{ fontSize: 11 }}>{(v / 1000).toFixed(1)}K</Tag> : <Text type="secondary">—</Text> },
    { title: 'User Prompt', dataIndex: 'usr_prompt_len', width: 100, align: 'right',
      render: v => v ? <Tag color="geekblue" style={{ fontSize: 11 }}>{(v / 1000).toFixed(1)}K</Tag> : <Text type="secondary">—</Text> },
    { title: '', width: 80,
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => openPrompt(r.id, `${r.doc_type} v${r.version_number} — ${r.jira_story_id || r.workflow_title}`)}>
          View
        </Button>
      ) },
  ];

  const driftColumns = [
    { title: 'Workflow', key: 'wf', ellipsis: true,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 12 }}>{r.workflow_title}</Text>
          {r.jira_story_id && <Tag color="geekblue" style={{ fontSize: 10 }}>{r.jira_story_id}</Tag>}
        </Space>
      ) },
    { title: 'Type', dataIndex: 'doc_type', width: 90,
      render: v => <Tag color={v === 'skill_file' ? 'purple' : 'blue'} style={{ fontSize: 11 }}>{v}</Tag> },
    { title: 'Versions', key: 'ver', width: 90, align: 'center',
      render: (_, r) => <Text style={{ fontSize: 12 }}>v{r.prev_version} → v{r.curr_version}</Text> },
    { title: 'Drift Risk', dataIndex: 'drift_risk', width: 140,
      filters: Object.keys(DRIFT_RISK_CONFIG).map(k => ({ text: DRIFT_RISK_CONFIG[k].label, value: k })),
      onFilter: (v, r) => r.drift_risk === v,
      render: v => <DriftRiskTag risk={v} /> },
    { title: 'Output Δ', dataIndex: 'output_drift_pct', width: 85, align: 'right',
      sorter: (a, b) => Math.abs(a.output_drift_pct || 0) - Math.abs(b.output_drift_pct || 0),
      render: v => {
        if (v === null) return <Text type="secondary">—</Text>;
        const color = Math.abs(v) >= 30 ? '#ff4d4f' : Math.abs(v) >= 10 ? '#fa8c16' : '#52c41a';
        return <Text strong style={{ color }}>{v > 0 ? '+' : ''}{v}%</Text>;
      } },
    { title: 'Output (chars)', key: 'olen', width: 130,
      render: (_, r) => (
        <Text style={{ fontSize: 11 }}>
          {(r.prev_output_len / 1000).toFixed(1)}K → {(r.curr_output_len / 1000).toFixed(1)}K
        </Text>
      ) },
    { title: 'Prompt Changed', dataIndex: 'prompt_changed', width: 120, align: 'center',
      render: v => v
        ? <Badge status="warning" text={<Text style={{ fontSize: 11, color: '#fa8c16' }}>Yes</Text>} />
        : <Badge status="success" text={<Text style={{ fontSize: 11, color: '#52c41a' }}>No</Text>} /> },
    { title: 'Sys Prompt Δ', key: 'spdelta', width: 110, align: 'right',
      render: (_, r) => {
        if (r.prev_sys_prompt_len === r.curr_sys_prompt_len) return <Text type="secondary">same</Text>;
        const delta = (r.curr_sys_prompt_len || 0) - (r.prev_sys_prompt_len || 0);
        return <Text style={{ fontSize: 11, color: delta > 0 ? '#1677ff' : '#ff4d4f' }}>{delta > 0 ? '+' : ''}{delta} chars</Text>;
      } },
    { title: '', key: 'actions', width: 120,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View prev version prompt">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openPrompt(r.prev_id, `v${r.prev_version} — ${r.jira_story_id}`)}>v{r.prev_version}</Button>
          </Tooltip>
          <Tooltip title="View curr version prompt">
            <Button size="small" icon={<EyeOutlined />} type="primary" onClick={() => openPrompt(r.curr_id, `v${r.curr_version} — ${r.jira_story_id}`)}>v{r.curr_version}</Button>
          </Tooltip>
        </Space>
      ) },
  ];

  const highDrift   = data?.comparisons?.filter(c => c.drift_risk === 'high').length || 0;
  const medDrift    = data?.comparisons?.filter(c => c.drift_risk === 'medium').length || 0;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Summary cards */}
      <Row gutter={[12, 12]}>
        {[
          { label: 'Versions Tracked',    value: data?.total_versions || 0,           color: '#1677ff' },
          { label: 'Documents Monitored', value: data?.documents_tracked || 0,        color: '#722ed1' },
          { label: 'Comparisons',         value: data?.comparisons_available || 0,    color: '#13c2c2' },
          { label: 'Drift Detected',      value: (highDrift + medDrift),              color: highDrift > 0 ? '#ff4d4f' : medDrift > 0 ? '#fa8c16' : '#52c41a' },
        ].map(({ label, value, color }) => (
          <Col key={label} xs={12} sm={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic title={<Text style={{ fontSize: 12 }}>{label}</Text>}
                value={value} valueStyle={{ color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {noData ? (
        <Alert type="info" showIcon
          message="No LLM prompt snapshots yet"
          description="Generate a skill file or test plan — prompts are automatically saved with each version for drift tracking." />
      ) : (
        <>
          {highDrift > 0 && (
            <Alert type="error" showIcon icon={<WarningOutlined />}
              message={`${highDrift} high-drift comparison(s) detected`}
              description="Output changed >30% with no prompt change — possible LLM model drift. Review the Drift Analysis tab." />
          )}
          {medDrift > 0 && highDrift === 0 && (
            <Alert type="warning" showIcon
              message={`${medDrift} medium-drift comparison(s) detected`}
              description="Output changed 10–30% with no prompt change — worth monitoring." />
          )}
          {!highDrift && !medDrift && data.comparisons_available > 0 && (
            <Alert type="success" showIcon message="No significant LLM drift detected across all tracked version pairs." />
          )}
        </>
      )}

      <Tabs
        activeKey={activeSubTab}
        onChange={setActiveSubTab}
        size="small"
        items={[
          {
            key: 'snapshots',
            label: <><DatabaseOutlined /> Version Snapshots ({data?.total_versions || 0})</>,
            children: (
              <Table
                dataSource={data?.versions || []}
                columns={snapshotColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 15, showTotal: t => `${t} snapshots`, showSizeChanger: false }}
                scroll={{ x: 800 }}
              />
            ),
          },
          {
            key: 'drift',
            label: (
              <Space size={4}>
                <SwapOutlined />
                Drift Analysis ({data?.comparisons_available || 0})
                {(highDrift + medDrift) > 0 && (
                  <Badge count={highDrift + medDrift} style={{ backgroundColor: highDrift > 0 ? '#ff4d4f' : '#fa8c16' }} />
                )}
              </Space>
            ),
            children: !data || data?.comparisons?.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Space direction="vertical" size={4}>
                    <Text strong>No comparisons yet</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Need 2+ versions of the same document with prompts saved to compare. Generate a skill file or test plan, then regenerate it to see drift analysis here.
                    </Text>
                  </Space>
                }
                style={{ padding: 40 }}
              />
            ) : (
              <Table
                dataSource={data?.comparisons || []}
                columns={driftColumns}
                rowKey={r => `${r.document_id}-${r.prev_version}-${r.curr_version}`}
                size="small"
                pagination={{ pageSize: 15, showTotal: t => `${t} comparisons`, showSizeChanger: false }}
                scroll={{ x: 900 }}
                rowClassName={r => r.drift_risk === 'high' ? 'ant-table-row-danger' : ''}
              />
            ),
          },
          {
            key: 'guide',
            label: <><InfoCircleOutlined /> How to Interpret</>,
            children: (
              <Card size="small" style={{ maxWidth: 700 }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div>
                    <Text strong>What is LLM Drift?</Text>
                    <br />
                    <Text type="secondary">The model produces different output for the same prompt over time — due to model updates, temperature variance, or internal changes.</Text>
                  </div>
                  <div>
                    <Text strong>Drift Risk Levels</Text>
                    <Space direction="vertical" size={4} style={{ marginTop: 6, width: '100%' }}>
                      {[
                        { risk: 'high',     desc: 'Output changed >30% with no prompt change → investigate model updates' },
                        { risk: 'medium',   desc: 'Output changed 10–30% with no prompt change → monitor over time' },
                        { risk: 'low',      desc: 'Output changed <10% with no prompt change → within normal variance' },
                        { risk: 'none',     desc: 'Output unchanged with same prompt → perfectly stable' },
                        { risk: 'expected', desc: 'Prompt was changed by user → output change is intentional' },
                      ].map(({ risk, desc }) => (
                        <Row key={risk} gutter={12} align="middle">
                          <Col><DriftRiskTag risk={risk} /></Col>
                          <Col flex="auto"><Text style={{ fontSize: 12 }}>{desc}</Text></Col>
                        </Row>
                      ))}
                    </Space>
                  </div>
                  <div>
                    <Text strong>How to Detect Drift</Text>
                    <br />
                    <Text type="secondary">Re-generate the same skill file or test plan (same inputs, no changes). If <Tag color="red">High Drift</Tag> appears with Prompt Changed = No, the LLM behaviour has shifted.</Text>
                  </div>
                </Space>
              </Card>
            ),
          },
        ]}
      />

      {/* Prompt Viewer Modal */}
      <Modal
        title={<Space><ExperimentOutlined /> Prompt Snapshot — {promptModal?.title}</Space>}
        open={!!promptModal}
        onCancel={() => { setPromptModal(null); setPromptData(null); }}
        footer={<Button onClick={() => { setPromptModal(null); setPromptData(null); }}>Close</Button>}
        width={900}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {promptLoading && <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>}
        {promptData && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="Type">{promptData.doc_type}</Descriptions.Item>
              <Descriptions.Item label="Version">v{promptData.version_number}</Descriptions.Item>
              <Descriptions.Item label="Jira ID">{promptData.jira_story_id || '—'}</Descriptions.Item>
              <Descriptions.Item label="Generated">{new Date(promptData.created_at).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Sys Prompt">{promptData.system_prompt_length?.toLocaleString()} chars</Descriptions.Item>
              <Descriptions.Item label="User Prompt">{promptData.user_prompt_length?.toLocaleString()} chars</Descriptions.Item>
            </Descriptions>
            <Collapse
              size="small"
              items={[
                {
                  key: 'sys',
                  label: <Space><Tag color="cyan">System Prompt</Tag><Text type="secondary" style={{ fontSize: 11 }}>{promptData.system_prompt_length?.toLocaleString()} chars</Text></Space>,
                  children: (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, maxHeight: 300, overflowY: 'auto', margin: 0, fontFamily: 'monospace', background: '#fafafa', padding: 12, borderRadius: 4 }}>
                      {promptData.system_prompt}
                    </pre>
                  ),
                },
                {
                  key: 'usr',
                  label: <Space><Tag color="geekblue">User Prompt</Tag><Text type="secondary" style={{ fontSize: 11 }}>{promptData.user_prompt_length?.toLocaleString()} chars</Text></Space>,
                  children: (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, maxHeight: 300, overflowY: 'auto', margin: 0, fontFamily: 'monospace', background: '#fafafa', padding: 12, borderRadius: 4 }}>
                      {promptData.user_prompt}
                    </pre>
                  ),
                },
              ]}
            />
          </Space>
        )}
      </Modal>
    </Space>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };
  const [stats, setStats]       = useState(null);
  const [activity, setActivity] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const [s, a] = await Promise.all([
        axios.get(`${API}/admin/stats`,    { headers }),
        axios.get(`${API}/admin/activity`, { headers }),
      ]);
      setStats(s.data); setActivity(a.data);
    } catch (err) { message.error('Failed to load overview: ' + err.message); }
    finally { setOverviewLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, []);

  const tabItems = [
    { key: 'overview',   label: <><ThunderboltOutlined /> Overview</>,
      children: <OverviewTab stats={stats} activity={activity} loading={overviewLoading} onRefresh={loadOverview} /> },
    { key: 'audit',      label: <><AuditOutlined /> Audit Logs</>,
      children: <AuditLogsTab headers={headers} /> },
    { key: 'users',      label: <><TeamOutlined /> Users</>,
      children: <UsersTab headers={headers} /> },
    { key: 'workflows',  label: <><BranchesOutlined /> Workflows</>,
      children: <WorkflowsTab headers={headers} /> },
    { key: 'system',     label: <><CloudServerOutlined /> System</>,
      children: <SystemTab headers={headers} /> },
    { key: 'tests',      label: <><BugOutlined /> System Tests</>,
      children: <SystemTestsTab headers={headers} /> },
    { key: 'llm-drift',  label: <><ExperimentOutlined /> LLM Drift</>,
      children: <LLMDriftTab headers={headers} /> },
  ];

  return (
    <div style={{ padding: '0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <CrownOutlined style={{ fontSize: 22, color: '#faad14' }} />
          <Title level={4} style={{ margin: 0 }}>Admin Dashboard</Title>
          <Tag color="gold">Admin Only</Tag>
        </Space>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ClockCircleOutlined /> {new Date().toLocaleTimeString()}
          </Text>
          <Button icon={<ReloadOutlined />} onClick={loadOverview} size="small">Refresh</Button>
        </Space>
      </div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} destroyInactiveTabPane={false} />
    </div>
  );
}
