/**
 * Version History Modal Component
 * Phase 1: Display version history with compare and rollback functionality
 */

import React, { useState, useEffect } from 'react';
import { Modal, Timeline, Button, Tag, Space, Tooltip, message, Spin, Typography, Input } from 'antd';
import { 
  HistoryOutlined, 
  EyeOutlined, 
  SwapOutlined, 
  RollbackOutlined, 
  CheckCircleOutlined,
  FileTextOutlined 
} from '@ant-design/icons';
import axios from 'axios';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const VersionHistoryModal = ({ visible, onClose, documentId, workflowId }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackTarget, setRollbackTarget] = useState(null);

  useEffect(() => {
    if (visible && documentId) {
      fetchVersionHistory();
    }
  }, [visible, documentId]);

  const fetchVersionHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/documents/${documentId}/versions`);
      
      if (response.data.success) {
        setVersions(response.data.versions);
      }
    } catch (error) {
      console.error('Error fetching version history:', error);
      message.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleViewVersion = async (versionNumber) => {
    try {
      const response = await axios.get(`/api/documents/${documentId}/versions/${versionNumber}`);
      
      if (response.data.success) {
        setSelectedVersion(response.data.version);
      }
    } catch (error) {
      console.error('Error viewing version:', error);
      message.error('Failed to load version details');
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      const [v1, v2] = selectedVersions.sort((a, b) => a - b);
      window.open(`/compare/${documentId}?v1=${v1}&v2=${v2}`, '_blank');
    } else {
      message.warning('Please select exactly 2 versions to compare');
    }
  };

  const handleRollbackClick = (versionNumber) => {
    setRollbackTarget(versionNumber);
    setRollbackModalVisible(true);
  };

  const handleRollbackConfirm = async () => {
    if (!rollbackReason.trim()) {
      message.warning('Please provide a reason for rollback');
      return;
    }

    try {
      const response = await axios.post(`/api/documents/${documentId}/rollback`, {
        version_number: rollbackTarget,
        reason: rollbackReason,
        user_id: 'user-admin' // TODO: Get from auth context
      });

      if (response.data.success) {
        message.success(`Successfully rolled back to version ${rollbackTarget}`);
        setRollbackModalVisible(false);
        setRollbackReason('');
        setRollbackTarget(null);
        fetchVersionHistory();
      }
    } catch (error) {
      console.error('Error rolling back:', error);
      message.error('Failed to rollback version');
    }
  };

  const toggleVersionSelection = (versionNumber) => {
    if (selectedVersions.includes(versionNumber)) {
      setSelectedVersions(selectedVersions.filter(v => v !== versionNumber));
    } else {
      if (selectedVersions.length < 2) {
        setSelectedVersions([...selectedVersions, versionNumber]);
      } else {
        message.warning('You can only select 2 versions to compare');
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTagColor = (tag) => {
    const colors = {
      'approved': 'green',
      'reviewed': 'blue',
      'draft': 'orange',
      'tested': 'cyan',
      'failed': 'red',
      'rollback': 'purple'
    };
    return colors[tag] || 'default';
  };

  const renderTags = (tagsString) => {
    if (!tagsString) return null;
    
    const tags = tagsString.split(',').filter(t => t.trim());
    return (
      <Space size="small">
        {tags.map((tag, index) => (
          <Tag key={index} color={getTagColor(tag.trim())}>
            {tag.trim()}
          </Tag>
        ))}
      </Space>
    );
  };

  return (
    <>
      <Modal
        title={
          <Space>
            <HistoryOutlined />
            Version History
            {compareMode && <Tag color="blue">Compare Mode</Tag>}
          </Space>
        }
        visible={visible}
        onCancel={onClose}
        width={800}
        footer={[
          <Button key="close" onClick={onClose}>
            Close
          </Button>,
          compareMode && (
            <Button 
              key="compare" 
              type="primary" 
              icon={<SwapOutlined />}
              onClick={handleCompare}
              disabled={selectedVersions.length !== 2}
            >
              Compare Selected ({selectedVersions.length}/2)
            </Button>
          ),
          <Button
            key="compare-mode"
            type={compareMode ? 'default' : 'primary'}
            onClick={() => {
              setCompareMode(!compareMode);
              setSelectedVersions([]);
            }}
          >
            {compareMode ? 'Exit Compare Mode' : 'Compare Versions'}
          </Button>
        ]}
      >
        <Spin spinning={loading}>
          {versions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <FileTextOutlined style={{ fontSize: 48, color: '#ccc' }} />
              <Paragraph type="secondary">No version history available</Paragraph>
            </div>
          ) : (
            <Timeline mode="left">
              {versions.map((version) => (
                <Timeline.Item
                  key={version.id}
                  dot={
                    version.version_number === versions[0].version_number ? (
                      <CheckCircleOutlined style={{ fontSize: 16, color: '#52c41a' }} />
                    ) : (
                      <HistoryOutlined />
                    )
                  }
                  color={version.version_number === versions[0].version_number ? 'green' : 'blue'}
                >
                  <div 
                    style={{ 
                      padding: '12px', 
                      backgroundColor: selectedVersions.includes(version.version_number) ? '#e6f7ff' : '#fafafa',
                      borderRadius: '8px',
                      cursor: compareMode ? 'pointer' : 'default'
                    }}
                    onClick={() => compareMode && toggleVersionSelection(version.version_number)}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Text strong>Version {version.version_number}</Text>
                        {version.version_number === versions[0].version_number && (
                          <Tag color="green">Current</Tag>
                        )}
                        {renderTags(version.tags)}
                      </Space>
                      
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {formatDate(version.created_at)} • {version.created_by_name || 'Unknown User'}
                      </Text>
                      
                      {version.change_summary && (
                        <Text>{version.change_summary}</Text>
                      )}
                      
                      {version.change_reason && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Reason: {version.change_reason}
                        </Text>
                      )}
                      
                      {version.file_size && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Size: {(version.file_size / 1024).toFixed(2)} KB
                        </Text>
                      )}
                      
                      {!compareMode && (
                        <Space size="small">
                          <Tooltip title="View this version">
                            <Button 
                              size="small" 
                              icon={<EyeOutlined />}
                              onClick={() => handleViewVersion(version.version_number)}
                            >
                              View
                            </Button>
                          </Tooltip>
                          
                          {version.version_number !== versions[0].version_number && (
                            <Tooltip title="Rollback to this version">
                              <Button 
                                size="small" 
                                icon={<RollbackOutlined />}
                                onClick={() => handleRollbackClick(version.version_number)}
                              >
                                Rollback
                              </Button>
                            </Tooltip>
                          )}
                        </Space>
                      )}
                    </Space>
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </Spin>
      </Modal>

      {/* Rollback Confirmation Modal */}
      <Modal
        title="Rollback Confirmation"
        visible={rollbackModalVisible}
        onOk={handleRollbackConfirm}
        onCancel={() => {
          setRollbackModalVisible(false);
          setRollbackReason('');
          setRollbackTarget(null);
        }}
        okText="Rollback"
        okButtonProps={{ danger: true }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Paragraph>
            You are about to rollback to <Text strong>Version {rollbackTarget}</Text>.
            This will create a new version with the content from Version {rollbackTarget}.
          </Paragraph>
          
          <Text strong>Reason for rollback (required):</Text>
          <TextArea
            rows={3}
            value={rollbackReason}
            onChange={(e) => setRollbackReason(e.target.value)}
            placeholder="Why are you rolling back? (e.g., Previous version had errors)"
          />
        </Space>
      </Modal>

      {/* Version View Modal */}
      {selectedVersion && (
        <Modal
          title={`Version ${selectedVersion.version_number} - Content`}
          visible={!!selectedVersion}
          onCancel={() => setSelectedVersion(null)}
          width={900}
          footer={[
            <Button key="close" onClick={() => setSelectedVersion(null)}>
              Close
            </Button>
          ]}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">
              {formatDate(selectedVersion.created_at)} • {selectedVersion.created_by_name}
            </Text>
            {renderTags(selectedVersion.tags)}
            <pre style={{ 
              backgroundColor: '#f5f5f5', 
              padding: '16px', 
              borderRadius: '4px',
              maxHeight: '500px',
              overflow: 'auto'
            }}>
              {selectedVersion.content}
            </pre>
          </Space>
        </Modal>
      )}
    </>
  );
};

export default VersionHistoryModal;
