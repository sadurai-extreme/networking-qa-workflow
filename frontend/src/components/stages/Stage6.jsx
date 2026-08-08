import React, { useState, useEffect } from 'react';
import { Card, Button, Select, Typography, Progress, List, Tag, message, Space } from 'antd';
import { CloudUploadOutlined, CheckCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useWorkflowStore, useAuthStore } from '../../store';
import { useWorkflowNavigation } from '../../hooks/useWorkflowNavigation';
import ApprovalPanel from '../shared/ApprovalPanel';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';
const { Title, Text } = Typography;

export default function Stage6() {
  const { workflow, advanceStage } = useWorkflowStore();
  const { goToStage } = useWorkflowNavigation();
  const { user: currentUser } = useAuthStore();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    axios.get(`${API}/stage6/projects`).then(r => setProjects(r.data));
    const socket = io(WS_URL);
    socket.on(`qtest-progress-${workflow?.id}`, (data) => {
      setResults(p => [...p, data]);
      setProgress(p => p + 1);
    });
    return () => socket.disconnect();
  }, [workflow?.id]);

  const handleUpload = async () => {
    if (!selectedProject) return message.warning('Select a qTest project first');
    setUploading(true); setResults([]); setProgress(0);
    try {
      const { data } = await axios.post(`${API}/stage6/upload`, { workflow_id: workflow.id, project_id: selectedProject });
      message.success(`Uploaded ${data.uploaded}/${data.total} test cases`);
    } catch { message.error('Upload failed.'); }
    setUploading(false);
  };

  const handleApprove = async () => {
    await axios.post(`${API}/stage6/approve`, { workflow_id: workflow.id, user_id: currentUser.id });
    await advanceStage();
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
      <Title level={4}><CloudUploadOutlined /> Stage 6: qTest Upload</Title>
      
      {/* Navigation */}
      <Space style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => goToStage(5)}
        >
          Back to Stage 5
        </Button>
      </Space>
      
      <Card style={{ marginBottom: 16 }}>
        <Select style={{ width: 300, marginRight: 12 }} placeholder="Select qTest Project" onChange={setSelectedProject}
          options={projects.map(p => ({ value: p.id, label: p.name }))} />
        <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleUpload} loading={uploading}>
          Upload to qTest
        </Button>
        {progress > 0 && <Progress style={{ marginTop: 12 }} percent={Math.min(100, Math.round((progress / 22) * 100))} status={uploading ? 'active' : 'success'} />}
      </Card>
      {results.length > 0 && (
        <Card title="Upload Results" style={{ marginBottom: 16 }}>
          <List size="small" dataSource={results} renderItem={r => (
            <List.Item>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              <Text>{r.tc_number}</Text>
              <Tag color="blue" style={{ marginLeft: 8 }}>{r.qtest_id}</Tag>
            </List.Item>
          )} />
        </Card>
      )}
      <ApprovalPanel onApprove={handleApprove} disabled={results.length === 0} approvalNote="Confirm all test cases are uploaded to qTest before proceeding." />
    </div>
  );
}
