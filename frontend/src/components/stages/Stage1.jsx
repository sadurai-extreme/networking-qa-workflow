import React, { useState, useEffect } from 'react';
import { Card, Select, List, Tag, Button, Input, Spin, Typography, Badge, Divider, Row, Col, Space } from 'antd';
import { BranchesOutlined, SearchOutlined, CheckCircleOutlined, HomeOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useWorkflowStore, useAuthStore } from '../../store';
import { useWorkflowNavigation } from '../../hooks/useWorkflowNavigation';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const { Title, Text } = Typography;

export default function Stage1() {
  const { workflow } = useWorkflowStore();
  const { goToNextStage } = useWorkflowNavigation();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [releases, setReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(workflow?.jira_release || null);
  const [stories, setStories] = useState([]);
  const [selectedStory, setSelectedStory] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/releases`).then(r => setReleases(r.data));
    // If workflow already has a release, fetch its stories
    if (workflow?.jira_release) {
      fetchStories(workflow.jira_release);
    }
  }, []);

  const fetchStories = async (release) => {
    setLoading(true);
    const { data } = await axios.get(`${API}/releases/${release}/stories`);
    setStories(data);
    setLoading(false);
  };

  const handleSelectRelease = (val) => {
    setSelectedRelease(val);
    setSelectedStory(null);
    fetchStories(val);
  };

  const handleApprove = async () => {
    if (!selectedStory) return;
    await axios.post(`${API}/stage1/select`, {
      workflow_id: workflow.id,
      story_id: selectedStory.id,
      release: selectedRelease,
      title: selectedStory.title,
      description: selectedStory.description,
      story_type: selectedStory.type,
    });
    await goToNextStage();
  };

  const filtered = stories.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase())
  );

  // Build tree structure: Epics with their child Stories
  const buildTreeStructure = () => {
    const epics = filtered.filter(item => item.issueType === 'Epic').sort((a, b) => a.id.localeCompare(b.id));
    const storyItems = filtered.filter(item => item.issueType === 'Story');
    
    const tree = [];
    epics.forEach(epic => {
      tree.push({ ...epic, isParent: true });
      
      // Find stories belonging to this epic
      const children = storyItems.filter(story => {
        const epicLink = story.epicLink || story.parentEpic;
        return epicLink === epic.id;
      }).sort((a, b) => a.id.localeCompare(b.id));
      
      children.forEach(child => {
        tree.push({ ...child, isChild: true, parentId: epic.id });
      });
    });
    
    return tree;
  };

  const treeData = buildTreeStructure();

  // Helper to get Epic color
  const getEpicColor = (epicKey) => {
    const colors = ['purple', 'magenta', 'volcano', 'orange', 'gold', 'lime', 'green', 'cyan', 'blue', 'geekblue'];
    const hash = epicKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
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
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<HomeOutlined />} onClick={() => navigate('/')}>Back to Dashboard</Button>
      </Space>
      <Title level={4}><BranchesOutlined /> Stage 1: Select Jira Story</Title>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <label style={{ fontWeight: 500 }}>Release</label>
          <Select
            style={{ width: '100%', marginTop: 6 }}
            placeholder="Select release..."
            onChange={handleSelectRelease}
            options={releases.map(r => ({ value: r.name, label: r.name }))}
          />
        </Col>
        <Col span={16}>
          <label style={{ fontWeight: 500 }}>Search Stories</label>
          <Input
            style={{ marginTop: 6 }}
            prefix={<SearchOutlined />}
            placeholder="Search by ID or title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={!selectedRelease}
          />
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title={`Story List (${filtered.length} items)`} size="small" style={{ height: 400, overflow: 'auto' }}>
            {loading ? <Spin /> : (
              <List
                dataSource={treeData}
                renderItem={item => (
                  <List.Item
                    key={item.id}
                    style={{ 
                      cursor: 'pointer', 
                      background: selectedStory?.id === item.id ? '#e6f7ff' : 'transparent', 
                      padding: item.isChild ? '6px 12px 6px 32px' : '8px 12px',
                      borderRadius: 4,
                      borderLeft: item.issueType === 'Epic' ? '4px solid #722ed1' : 'none',
                      marginBottom: item.isChild ? 2 : 4
                    }}
                    onClick={() => setSelectedStory(item)}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {item.isChild && <span style={{ color: '#bbb' }}>└─</span>}
                        <Text strong style={{ fontSize: item.isChild ? 12 : 14 }}>{item.id}</Text>
                        {item.issueType === 'Epic' ? (
                          <Tag color="purple" style={{ fontSize: 11 }}>📋 EPIC</Tag>
                        ) : (
                          <Tag color={item.type === 'NOS API Endpoint' ? 'blue' : 'green'} style={{ fontSize: 10 }}>
                            {item.type === 'NOS API Endpoint' ? '🔌 API' : '⚙️ Story'}
                          </Tag>
                        )}
                      </div>
                      <Text style={{ fontSize: item.isChild ? 11 : 12, marginTop: 2, display: 'block', color: item.isChild ? '#666' : '#000' }}>
                        {item.title}
                      </Text>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Story Detail" size="small" style={{ height: 400, overflow: 'auto' }}>
            {selectedStory ? (
              <div>
                <Title level={5}>{selectedStory.id}</Title>
                {selectedStory.issueType === 'Epic' && <Tag color="purple">📋 EPIC</Tag>}
                <Tag color={selectedStory.type === 'NOS API Endpoint' ? 'blue' : 'green'}>{selectedStory.type}</Tag>
                <Tag color="orange" style={{ marginLeft: 4 }}>Release: {selectedRelease}</Tag>
                {selectedStory.priority && <Tag color="red" style={{ marginLeft: 4 }}>{selectedStory.priority}</Tag>}
                {(selectedStory.parentEpic || selectedStory.epicLink) && (
                  <Tag color={getEpicColor(selectedStory.parentEpic || selectedStory.epicLink)} style={{ marginLeft: 4 }}>
                    Epic: {selectedStory.parentEpic || selectedStory.epicLink}
                  </Tag>
                )}
                <Divider />
                <Text>{selectedStory.description || 'No description available.'}</Text>
              </div>
            ) : (
              <Text type="secondary">Select a story from the list</Text>
            )}
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button
          type="primary"
          size="large"
          icon={<CheckCircleOutlined />}
          disabled={!selectedStory}
          onClick={handleApprove}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
        >
          Select & Proceed
        </Button>
      </div>
    </div>
  );
}
