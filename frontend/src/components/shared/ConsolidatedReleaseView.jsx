import React from 'react';
import { Card, Table, Tag, Row, Col, Statistic, Descriptions, Collapse, Space, Typography, Button } from 'antd';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  RocketOutlined, 
  BugOutlined, 
  ApiOutlined,
  FlagOutlined,
  PlusOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Panel } = Collapse;

export default function ConsolidatedReleaseView({ data, onCreateWorkflow }) {
  if (!data) return null;

  const { release, totalIssues, breakdowns, issues } = data;

  // Status colors
  const getStatusColor = (status) => {
    const statusMap = {
      'Done': 'success',
      'In Progress': 'processing',
      'Testing': 'warning',
      'Draft': 'default',
      'Analysis': 'cyan',
    };
    return statusMap[status] || 'default';
  };

  // Priority colors
  const getPriorityColor = (priority) => {
    if (!priority) return 'default';
    if (priority.includes('P1') || priority.includes('Urgent')) return 'red';
    if (priority.includes('P2') || priority.includes('High')) return 'orange';
    if (priority.includes('P3') || priority.includes('Medium')) return 'blue';
    if (priority.includes('P4') || priority.includes('Low')) return 'green';
    return 'default';
  };

  // Type icons
  const getTypeIcon = (type) => {
    if (type === 'Epic') return <FlagOutlined />;
    if (type === 'Story') return <ApiOutlined />;
    if (type === 'Bug') return <BugOutlined />;
    return <RocketOutlined />;
  };

  const columns = [
    {
      title: 'Key',
      dataIndex: 'key',
      width: 120,
      fixed: 'left',
      render: (key) => <Tag color="blue">{key}</Tag>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 100,
      filters: Object.keys(breakdowns.byType).map(type => ({ text: type, value: type })),
      onFilter: (value, record) => record.type === value,
      render: (type) => (
        <Tag icon={getTypeIcon(type)} color={type === 'Epic' ? 'purple' : 'cyan'}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      ellipsis: true,
      render: (text) => <Text style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      filters: Object.keys(breakdowns.byStatus).map(status => ({ text: status, value: status })),
      onFilter: (value, record) => record.status === value,
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      width: 120,
      filters: Object.keys(breakdowns.byPriority).map(priority => ({ text: priority, value: priority })),
      onFilter: (value, record) => record.priority === value,
      sorter: (a, b) => {
        const priorityOrder = { 'P1 - Urgent': 1, 'P2 - High': 2, 'P3 - Medium': 3, 'P4 - Low': 4, 'None': 5 };
        return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
      },
      render: (priority) => <Tag color={getPriorityColor(priority)}>{priority || 'None'}</Tag>,
    },
    {
      title: 'Components',
      dataIndex: 'components',
      width: 200,
      ellipsis: true,
      render: (components) => (
        components?.length > 0 ? (
          <Text style={{ fontSize: 11 }}>{components.join(', ')}</Text>
        ) : <Text type="secondary">None</Text>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'sourceQuery',
      width: 150,
      filters: [
        { text: 'Epics/Initiatives', value: 'Epics/Initiatives' },
        { text: 'API Stories', value: 'API Stories' },
        { text: 'Both Queries', value: 'Both Queries' },
      ],
      onFilter: (value, record) => record.sourceQuery === value,
      render: (source) => {
        const colorMap = {
          'Epics/Initiatives': 'purple',
          'API Stories': 'cyan',
          'Both Queries': 'magenta'
        };
        return <Tag color={colorMap[source]}>{source}</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onCreateWorkflow && onCreateWorkflow(record)}
        >
          Create Workflow
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* Summary Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Issues"
              value={totalIssues}
              prefix={<RocketOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Epics"
              value={breakdowns.byType['Epic'] || 0}
              prefix={<FlagOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Stories"
              value={breakdowns.byType['Story'] || 0}
              prefix={<ApiOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Done"
              value={breakdowns.byStatus['Done'] || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Detailed Breakdowns */}
      <Collapse defaultActiveKey={['1']} style={{ marginBottom: 24 }}>
        <Panel header="📊 Breakdown by Status" key="1">
          <Row gutter={[16, 16]}>
            {Object.entries(breakdowns.byStatus)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <Col span={6} key={status}>
                  <Card size="small">
                    <Statistic
                      title={status}
                      value={count}
                      valueStyle={{ fontSize: 24 }}
                      suffix={<Tag color={getStatusColor(status)}>{((count / totalIssues) * 100).toFixed(1)}%</Tag>}
                    />
                  </Card>
                </Col>
              ))}
          </Row>
        </Panel>
        
        <Panel header="🎯 Breakdown by Priority" key="2">
          <Row gutter={[16, 16]}>
            {Object.entries(breakdowns.byPriority)
              .sort((a, b) => {
                const priorityOrder = { 'P1 - Urgent': 1, 'P2 - High': 2, 'P3 - Medium': 3, 'P4 - Low': 4, 'None': 5 };
                return (priorityOrder[a[0]] || 99) - (priorityOrder[b[0]] || 99);
              })
              .map(([priority, count]) => (
                <Col span={6} key={priority}>
                  <Card size="small">
                    <Statistic
                      title={priority}
                      value={count}
                      valueStyle={{ fontSize: 24 }}
                      suffix={<Tag color={getPriorityColor(priority)}>{((count / totalIssues) * 100).toFixed(1)}%</Tag>}
                    />
                  </Card>
                </Col>
              ))}
          </Row>
        </Panel>

        <Panel header="🔧 Breakdown by Component" key="3">
          <Row gutter={[16, 16]}>
            {Object.entries(breakdowns.byComponent)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8) // Show top 8 components
              .map(([component, count]) => (
                <Col span={6} key={component}>
                  <Card size="small">
                    <Statistic
                      title={component.length > 30 ? component.substring(0, 30) + '...' : component}
                      value={count}
                      valueStyle={{ fontSize: 24 }}
                      suffix={<Tag>{((count / totalIssues) * 100).toFixed(1)}%</Tag>}
                    />
                  </Card>
                </Col>
              ))}
          </Row>
        </Panel>
      </Collapse>

      {/* Issues Table */}
      <Card 
        title={`All Issues for ${release} (${totalIssues} total)`}
        styles={{ header: { background: '#f0f2f5' } }}
      >
        <Table
          dataSource={issues}
          columns={columns}
          rowKey="key"
          pagination={{ 
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} issues`
          }}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>
    </div>
  );
}
