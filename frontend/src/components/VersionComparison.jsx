/**
 * Version Comparison Page
 * Phase 1: Side-by-side diff viewer
 */

import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Card, Row, Col, Spin, Typography, Tag, Space, Statistic, message } from 'antd';
import { DiffOutlined, PlusOutlined, MinusOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

const VersionComparison = () => {
  const { documentId } = useParams();
  const location = useLocation();
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const v1 = params.get('v1');
    const v2 = params.get('v2');

    if (documentId && v1 && v2) {
      fetchComparison(v1, v2);
    }
  }, [documentId, location.search]);

  const fetchComparison = async (v1, v2) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/documents/${documentId}/compare?v1=${v1}&v2=${v2}`);

      if (response.data.success) {
        setComparison(response.data.comparison);
      }
    } catch (error) {
      console.error('Error fetching comparison:', error);
      message.error('Failed to compare versions');
    } finally {
      setLoading(false);
    }
  };

  const renderDiffLine = (item, index) => {
    const getStyle = (type) => {
      switch (type) {
        case 'add':
          return { backgroundColor: '#f6ffed', borderLeft: '3px solid #52c41a' };
        case 'delete':
          return { backgroundColor: '#fff1f0', borderLeft: '3px solid #ff4d4f' };
        case 'modify':
          return { backgroundColor: '#e6f7ff', borderLeft: '3px solid #1890ff' };
        default:
          return {};
      }
    };

    const getIcon = (type) => {
      switch (type) {
        case 'add':
          return <PlusOutlined style={{ color: '#52c41a' }} />;
        case 'delete':
          return <MinusOutlined style={{ color: '#ff4d4f' }} />;
        case 'modify':
          return <EditOutlined style={{ color: '#1890ff' }} />;
        default:
          return null;
      }
    };

    return (
      <div
        key={index}
        style={{
          ...getStyle(item.type),
          padding: '8px 12px',
          marginBottom: '4px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '13px'
        }}
      >
        <Space>
          {getIcon(item.type)}
          <Text type="secondary" style={{ minWidth: '50px' }}>
            Line {item.line}
          </Text>
          {item.type === 'modify' ? (
            <div>
              <div><Text delete>{item.old}</Text></div>
              <div><Text style={{ color: '#52c41a' }}>{item.new}</Text></div>
            </div>
          ) : (
            <Text>{item.content || item.new || item.old}</Text>
          )}
        </Space>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
        <Text style={{ display: 'block', marginTop: '20px' }}>Loading comparison...</Text>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <DiffOutlined style={{ fontSize: 48, color: '#ccc' }} />
        <Text style={{ display: 'block', marginTop: '20px' }}>No comparison data available</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <Card>
        <Title level={3}>
          <DiffOutlined /> Version Comparison
        </Title>

        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={8}>
            <Statistic
              title="Lines Added"
              value={comparison.summary.added}
              prefix={<PlusOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Lines Deleted"
              value={comparison.summary.deleted}
              prefix={<MinusOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Lines Modified"
              value={comparison.summary.modified}
              prefix={<EditOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            <Card size="small" title={`Version ${comparison.version1.version_number}`}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {new Date(comparison.version1.created_at).toLocaleString()}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {comparison.version1.created_by}
              </Text>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title={`Version ${comparison.version2.version_number}`}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {new Date(comparison.version2.created_at).toLocaleString()}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {comparison.version2.created_by}
              </Text>
            </Card>
          </Col>
        </Row>

        <Card 
          style={{ marginTop: '24px' }} 
          title="Changes"
          extra={<Tag color="blue">{comparison.summary.total_changes} changes</Tag>}
        >
          {comparison.diff.length === 0 ? (
            <Text type="secondary">No changes detected</Text>
          ) : (
            <div style={{ maxHeight: '600px', overflow: 'auto' }}>
              {comparison.diff.map((item, index) => renderDiffLine(item, index))}
            </div>
          )}
        </Card>
      </Card>
    </div>
  );
};

export default VersionComparison;
