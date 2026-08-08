import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Select, Button, Typography, Row, Col, Statistic, Table, Tag, Space, Spin, Alert, Input, Modal, message, Tooltip } from 'antd';
import { PlusOutlined, RocketOutlined, CheckCircleOutlined, ClockCircleOutlined, SearchOutlined, ReloadOutlined, DeleteOutlined, ExclamationCircleOutlined, ArrowDownOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useWorkflowStore, useAuthStore } from '../store';
import HierarchicalReleaseView from '../components/shared/HierarchicalReleaseView';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const { Title, Text } = Typography;
const { Search } = Input;

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();
  const { workflows, loadWorkflows, createWorkflow, setWorkflow, loading: workflowLoading } = useWorkflowStore();
  const [releases, setReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [consolidatedData, setConsolidatedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);
  const [newWorkflowModal, setNewWorkflowModal] = useState(false);
  const [newWorkflowData, setNewWorkflowData] = useState({ title: '', release: '', storyId: '' });
  const [isManualEntry, setIsManualEntry] = useState(false);
  const releaseRef = useRef(null);

  const scrollToRelease = () => {
    releaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      releaseRef.current?.querySelector('.ant-select-selector')?.click();
    }, 600);
  };

  const openManualEntry = () => {
    setIsManualEntry(true);
    setNewWorkflowData({ title: '', release: '', storyId: '' });
    setNewWorkflowModal(true);
  };

  useEffect(() => {
    loadAllWorkflows();
    fetchReleases();
  }, []);

  useEffect(() => {
    if (selectedRelease) {
      fetchConsolidatedData(selectedRelease);
    }
  }, [selectedRelease]);

  const loadAllWorkflows = async () => {
    setLoadingWorkflows(true);
    await loadWorkflows();
    setLoadingWorkflows(false);
  };

  const fetchReleases = async () => {
    try {
      const { data } = await axios.get(`${API}/releases`);
      setReleases(data);
    } catch (err) {
      console.error('Failed to fetch releases:', err);
    }
  };

  const fetchConsolidatedData = async (release) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/releases/${release}/consolidated`);
      setConsolidatedData(data);
    } catch (err) {
      console.error('Failed to fetch consolidated data:', err);
      setConsolidatedData(null);
    }
    setLoading(false);
  };

  // Version comparison helper - checks if release version is >= 33.3.1
  const isReleaseSupported = (releaseName) => {
    // Extract version number from release name (e.g., "EXOS 33.3.1" -> "33.3.1")
    const versionMatch = releaseName.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!versionMatch) return false;

    const [, major, minor, patch] = versionMatch.map(Number);
    
    // Compare with minimum supported version 33.3.1
    if (major > 33) return true;
    if (major < 33) return false;
    if (minor > 3) return true;
    if (minor < 3) return false;
    return patch >= 1;
  };

  const handleReleaseChange = (release) => {
    if (!isReleaseSupported(release)) {
      message.error({
        content: `Release ${release} is not supported. Please select version 33.3.1 or later.`,
        duration: 5,
      });
      setSelectedRelease(null);
      setReleaseStories([]);
      return;
    }
    setSelectedRelease(release);
  };

  const handleCreateFromStory = (issue) => {
    setIsManualEntry(false);
    setNewWorkflowData({
      title: issue.summary,
      release: selectedRelease,
      storyId: issue.key,
      description: issue.description || '',
      type: issue.type || 'Feature',
      status: issue.status || '',
      priority: issue.priority || ''
    });
    setNewWorkflowModal(true);
  };

  const handleCreateWorkflow = async () => {
    console.log('=== START handleCreateWorkflow ===');
    console.log('newWorkflowData:', newWorkflowData);
    
    if (!newWorkflowData.title.trim()) {
      message.warning('Please enter a workflow title');
      console.log('Validation failed: empty title');
      return;
    }
    
    console.log('Calling createWorkflow with:', {
      title: newWorkflowData.title,
      release: newWorkflowData.release,
      storyId: newWorkflowData.storyId,
    });
    
    try {
      const workflow = await createWorkflow(newWorkflowData.title, {
        release: newWorkflowData.release,
        storyId: newWorkflowData.storyId,
      });
      
      console.log('Workflow created:', workflow);
      
      if (!workflow || !workflow.id) {
        console.error('Invalid workflow response:', workflow);
        message.error('Failed to create workflow: Invalid response from server');
        return;
      }
      
      message.success(`Workflow "${workflow.title}" created successfully!`);
      setNewWorkflowModal(false);
      setWorkflow(workflow);
      
      console.log('Navigating to stage 2 for workflow:', workflow.id);
      // Start workflow at Stage 2 (Skill File Generation) - story already selected
      navigate(`/workflow/${workflow.id}/stage/2`);
    } catch (err) {
      console.error('=== ERROR in handleCreateWorkflow ===');
      console.error('Error object:', err);
      console.error('Error response:', err.response);
      console.error('Error message:', err.message);
      message.error(err.response?.data?.error || err.message || 'Failed to create workflow. Please try again.');
    }
    
    console.log('=== END handleCreateWorkflow ===');
  };

  const handleOpenWorkflow = (workflow) => {
    setWorkflow(workflow);
    navigate(`/workflow/${workflow.id}/stage/${workflow.current_stage}`);
  };

  const handleClearActiveWorkflows = () => {
    console.log('=== Clear All Active Workflows ===');
    console.log('Active workflows count:', activeWorkflows.length);
    Modal.confirm({
      title: 'Clear All Active Workflows?',
      icon: <ExclamationCircleOutlined />,
      content: `This will permanently delete all ${activeWorkflows.length} active workflows. This action cannot be undone.`,
      okText: 'Yes, Clear All',
      okType: 'danger',
      cancelText: 'Cancel',
      async onOk() {
        console.log('User confirmed deletion');
        try {
          console.log('Calling DELETE API...');
          const response = await axios.post(`${API}/workflows/bulk/delete-active`);
          console.log('Delete response:', response.data);
          message.success(response.data.message || 'All active workflows cleared');
          
          console.log('Reloading workflows...');
          await loadAllWorkflows(); // Refresh the list
          console.log('Workflows reloaded. New count:', workflows?.length);
        } catch (error) {
          console.error('Error clearing workflows:', error);
          console.error('Error response:', error.response);
          message.error(error.response?.data?.error || 'Failed to clear active workflows');
        }
      },
    });
  };

  const handleDeleteWorkflow = (workflow) => {
    Modal.confirm({
      title: `Delete Workflow?`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p><strong>{workflow.title}</strong></p>
          <p>This will permanently delete this workflow and all associated data. This action cannot be undone.</p>
        </div>
      ),
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      async onOk() {
        try {
          const response = await axios.delete(`${API}/workflows/${workflow.id}`);
          message.success(response.data.message || 'Workflow deleted successfully');
          loadAllWorkflows(); // Refresh the list
        } catch (error) {
          console.error('Error deleting workflow:', error);
          message.error(error.response?.data?.error || 'Failed to delete workflow');
        }
      },
    });
  };

  const activeWorkflows = workflows?.filter(w => w.status === 'active') || [];
  const completedWorkflows = workflows?.filter(w => w.status === 'completed') || [];

  const workflowColumns = [
    { 
      title: 'Jira ID', 
      dataIndex: 'jira_story_id',
      width: 130,
      render: (jira) => jira ? <Tag color="blue" style={{ fontFamily: 'monospace' }}>{jira}</Tag> : '—',
    },
    { 
      title: 'Title', 
      dataIndex: 'title',
      ellipsis: true,
      minWidth: 200,
      render: (title) => <span style={{ fontWeight: 500 }}>{title || '—'}</span>,
    },
    { 
      title: 'Release', 
      dataIndex: 'jira_release', 
      width: 120,
      render: (release) => release ? <Tag color="purple">{release}</Tag> : '-'
    },
    { 
      title: 'Stage', 
      dataIndex: 'current_stage', 
      width: 160,
      render: (stage) => {
        const STAGE_LABEL = {
          1: 'Jira Story',
          2: 'Skill File',
          3: 'Test Plan',
          4: 'TC Classification',
          7: 'Script Generation',
          8: 'TC Execution',
          9: 'Workflow Completion',
        };
        const STAGE_DISPLAY = { 1:1, 2:2, 3:3, 4:4, 7:5, 8:6, 9:7 };
        const label = STAGE_LABEL[stage] || `Stage ${stage}`;
        const display = STAGE_DISPLAY[stage] || stage;
        return <Tag color="blue">Stage {display}: {label}</Tag>;
      }
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      width: 120,
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'default'} icon={status === 'active' ? <ClockCircleOutlined /> : <CheckCircleOutlined />}>
          {status}
        </Tag>
      )
    },
    { 
      title: 'Created', 
      dataIndex: 'created_at', 
      width: 180,
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Action',
      width: 180,
      render: (_, workflow) => (
        <Space size="small">
          <Button 
            type="link" 
            onClick={() => handleOpenWorkflow(workflow)}
          >
            {workflow.status === 'active' ? 'Resume' : 'View'}
          </Button>
          <Button 
            type="link" 
            danger
            onClick={() => handleDeleteWorkflow(workflow)}
            disabled={workflow.status !== 'active' && user.role !== 'admin'}
          >
            Delete
          </Button>
        </Space>
      )
    }
  ];

  return (
    <>
      {/* Page Header Banner */}
      <div className="page-header-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-header-title">NOS QA Workflow Dashboard</h1>
            <p className="page-header-subtitle">
              Welcome back, <strong>{user.name}</strong>! {isAdmin() ? '(Admin) ' : ''}
              Manage your QA workflows and testing pipeline
            </p>
          </div>
          <Space size="large">
            <Tooltip title="Select an EXOS release from the Release Dashboard below to browse Jira stories and start a workflow">
              <Button 
                type="primary"
                size="large"
                icon={<ArrowDownOutlined />}
                onClick={scrollToRelease}
                className="action-button-teal"
              >
                Start New Workflow
              </Button>
            </Tooltip>
            <Tooltip title="Manually enter a Jira story ID and release to create a workflow">
              <Button
                size="large"
                icon={<PlusOutlined />}
                onClick={openManualEntry}
              >
                Enter Jira Manually
              </Button>
            </Tooltip>
            <Button 
              icon={<ReloadOutlined />} 
              size="large"
              onClick={() => {
                fetchReleases();
                loadAllWorkflows();
                if (selectedRelease) fetchStoriesForRelease(selectedRelease);
              }}
            >
              Refresh Data
            </Button>
          </Space>
        </div>
      </div>

      <div style={{ padding: '32px 48px', background: '#f5f7fa' }}>
        {/* Statistics */}
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          <Col span={6}>
            <div className="stat-card">
              <div className="stat-card-header">Active Workflows</div>
              <div className="stat-card-body">
                <div className="stat-value">{activeWorkflows.length}</div>
                <div className="stat-label"><ClockCircleOutlined /> In Progress</div>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div className="stat-card">
              <div className="stat-card-header">Completed</div>
              <div className="stat-card-body">
                <div className="stat-value" style={{ color: '#20c997' }}>{completedWorkflows.length}</div>
                <div className="stat-label"><CheckCircleOutlined /> Done</div>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div className="stat-card">
              <div className="stat-card-header">Total Workflows</div>
              <div className="stat-card-body">
                <div className="stat-value" style={{ color: '#6f42c1' }}>{workflows?.length || 0}</div>
                <div className="stat-label">All Time</div>
              </div>
            </div>
          </Col>
        </Row>

      {/* Release Selection & Consolidated Dashboard */}
      <div ref={releaseRef}>
      <Card 
        title={
          <Space>
            <RocketOutlined />
            <span>Release Dashboard - Epics &amp; API Stories</span>
            <Tag color="blue" style={{ marginLeft: 8, fontWeight: 700 }}>Step 1: Start Here</Tag>
          </Space>
        }
        style={{ marginBottom: 24 }}
        styles={{ header: { background: 'linear-gradient(135deg, #2d3e5f 0%, #1a2541 100%)', color: 'white', borderBottom: '3px solid #17a2b8' } }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 14 }}>① Select EXOS Release:</Text>
          <Select
            showSearch
            placeholder="Select a release (e.g., EXOS 34.1.1)"
            style={{ width: 320, marginLeft: 16 }}
            onChange={handleReleaseChange}
            value={selectedRelease}
            options={releases.map(r => ({ value: r.name, label: r.name }))}
            size="large"
          />
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => {
              fetchReleases();
              if (selectedRelease) {
                fetchConsolidatedData(selectedRelease);
              }
            }}
            style={{ marginLeft: 12 }}
            size="large"
          >
            Refresh Data
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="Loading consolidated data from Jira..." />
          </div>
        ) : selectedRelease ? (
          consolidatedData ? (
            <HierarchicalReleaseView 
              data={consolidatedData} 
              onCreateWorkflow={handleCreateFromStory}
            />
          ) : (
            <Alert
              title="Loading consolidated data..."
              description="Fetching epics and API stories from Jira..."
              type="info"
              showIcon
            />
          )
        ) : (
          <Alert
            title="Select a release to view data"
            description="Choose an EXOS release from the dropdown above to see all associated Jira data from the PLM structure board."
            type="info"
            showIcon
          />
        )}
      </Card>
      </div>

      {/* Active Workflows */}
      {activeWorkflows.length > 0 && (
        <Card 
          title={
            <Space>
              <ClockCircleOutlined />
              <span>Active Workflows ({activeWorkflows.length})</span>
            </Space>
          }
          extra={
            isAdmin && (
              <Button 
                danger 
                icon={<DeleteOutlined />}
                onClick={handleClearActiveWorkflows}
                size="small"
              >
                Clear All
              </Button>
            )
          }
          style={{ marginBottom: 24 }}
          styles={{ header: { background: 'linear-gradient(135deg, #2d3e5f 0%, #1a2541 100%)', color: 'white', borderBottom: '3px solid #17a2b8' } }}
        >
          <Table
            dataSource={activeWorkflows}
            columns={workflowColumns}
            rowKey="id"
            pagination={false}
            size="middle"
            scroll={{ x: 1150 }}
          />
        </Card>
      )}

      {/* Completed Workflows */}
      {completedWorkflows.length > 0 && (
        <Card 
          title={
            <Space>
              <CheckCircleOutlined />
              <span>Completed Workflows</span>
            </Space>
          }
          styles={{ header: { background: 'linear-gradient(135deg, #2d3e5f 0%, #1a2541 100%)', color: 'white', borderBottom: '3px solid #20c997' } }}
        >
          <Table
            dataSource={completedWorkflows}
            columns={workflowColumns}
            rowKey="id"
            pagination={{ pageSize: 5 }}
            size="middle"
            scroll={{ x: 1150 }}
          />
        </Card>
      )}

      {/* Create Workflow Modal */}
      <Modal
        title={isManualEntry ? 'Create Workflow — Manual Jira Entry' : 'Create New QA Workflow'}
        open={newWorkflowModal}
        onOk={handleCreateWorkflow}
        onCancel={() => { setNewWorkflowModal(false); setIsManualEntry(false); }}
        okText="Start Workflow"
        confirmLoading={workflowLoading}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {isManualEntry && (
            <Alert
              message="Manual Entry Mode"
              description="Fill in the Jira Story ID and select a release manually. The story details will be fetched from Jira when the workflow starts."
              type="info"
              showIcon
              style={{ marginBottom: 4 }}
            />
          )}
          <div>
            <Text strong>Workflow Title:</Text>
            <Input
              placeholder="Enter workflow title"
              value={newWorkflowData.title}
              onChange={(e) => setNewWorkflowData({ ...newWorkflowData, title: e.target.value })}
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <Text strong>Release:</Text>
            {isManualEntry ? (
              <Select
                showSearch
                placeholder="Select a release"
                style={{ width: '100%', marginTop: 8 }}
                value={newWorkflowData.release || undefined}
                onChange={(val) => setNewWorkflowData({ ...newWorkflowData, release: val })}
                options={releases.map(r => ({ value: r.name, label: r.name }))}
                size="large"
              />
            ) : (
              <Input disabled value={newWorkflowData.release} style={{ marginTop: 8 }} />
            )}
          </div>
          <div>
            <Text strong>Jira Story ID:</Text>
            {isManualEntry ? (
              <Input
                placeholder="e.g. EXOS-39635"
                value={newWorkflowData.storyId}
                onChange={(e) => setNewWorkflowData({ ...newWorkflowData, storyId: e.target.value.trim() })}
                style={{ marginTop: 8 }}
              />
            ) : (
              <Input disabled value={newWorkflowData.storyId} style={{ marginTop: 8 }} />
            )}
          </div>
        </Space>
      </Modal>
      </div>
    </>
  );
}
