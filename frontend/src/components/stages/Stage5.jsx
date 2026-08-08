import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Alert, List, Badge, Space, message } from 'antd';
import { FormatPainterOutlined, DownloadOutlined, CheckCircleOutlined, ClockCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useWorkflowStore, useAuthStore, useUserStore } from '../../store';
import { useWorkflowNavigation } from '../../hooks/useWorkflowNavigation';
import CoUserSelector from '../shared/CoUserSelector';
import ApprovalPanel from '../shared/ApprovalPanel';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const { Title, Text } = Typography;

export default function Stage5() {
  const { workflow, advanceStage } = useWorkflowStore();
  const { goToStage } = useWorkflowNavigation();
  const { user: currentUser } = useAuthStore(); const { users, loadUsers } = useUserStore();
  const [formatResult, setFormatResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCoUsers, setSelectedCoUsers] = useState([]);
  const [approvalStatus, setApprovalStatus] = useState([]);

  useEffect(() => { loadUsers(); }, []);

  const handleFormat = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/stage5/format`, { workflow_id: workflow.id });
      setFormatResult(data);
    } catch { message.error('Formatting failed.'); }
    setLoading(false);
  };

  const handleAssignReviewers = async () => {
    await axios.post(`${API}/stage5/assign-reviewers`, { workflow_id: workflow.id, assigned_by: currentUser.id, co_users: selectedCoUsers });
    loadApprovalStatus();
    message.success('Reviewers assigned!');
  };

  const loadApprovalStatus = async () => {
    const { data } = await axios.get(`${API}/stage5/approval-status/${workflow.id}`);
    setApprovalStatus(data);
  };

  const handleApprove = async () => {
    const { data } = await axios.post(`${API}/stage5/approve`, { workflow_id: workflow.id, user_id: currentUser.id });
    if (data.all_approved) { await advanceStage(); }
    else { loadApprovalStatus(); message.info('Your approval recorded. Waiting for co-users.'); }
  };

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
      <Title level={4}><FormatPainterOutlined /> Stage 5: ISO .docx Formatting</Title>
      
      {/* Navigation */}
      <Space style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => goToStage(4)}
        >
          Back to Stage 4
        </Button>
      </Space>
      
      <Button type="primary" icon={<FormatPainterOutlined />} onClick={handleFormat} loading={loading} style={{ marginBottom: 16 }}>
        Format to ISO Template
      </Button>
      {formatResult && (
        <Card title="Formatted Test Plan" style={{ marginBottom: 16 }} extra={
          formatResult.download_url && (
            <Button icon={<DownloadOutlined />} href={`http://localhost:5000${formatResult.download_url}`} target="_blank" size="small">
              Download .docx
            </Button>
          )
        }>
          {formatResult.status === 'template_missing'
            ? <Alert type="warning" message={formatResult.message} description={<pre style={{ fontSize: 12 }}>{formatResult.preview}</pre>} />
            : <Alert type="success" message={`ISO document generated: ${formatResult.filename}`} />
          }
        </Card>
      )}
      <Card title="Co-user Review Assignment" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <CoUserSelector users={users.filter(u => u.id !== currentUser.id)} value={selectedCoUsers} onChange={setSelectedCoUsers} />
          <Button onClick={handleAssignReviewers} disabled={selectedCoUsers.length === 0}>Assign Reviewers</Button>
          {approvalStatus.length > 0 && (
            <List dataSource={approvalStatus} renderItem={a => (
              <List.Item>
                {a.approved ? <Badge status="success" text={`${a.name} — Approved ✅`} /> : <Badge status="processing" text={`${a.name} — Pending ⏳`} />}
              </List.Item>
            )} />
          )}
        </Space>
      </Card>
      <ApprovalPanel onApprove={handleApprove} disabled={!formatResult} approvalNote="Both user and co-user approvals required to proceed." />
    </div>
  );
}
