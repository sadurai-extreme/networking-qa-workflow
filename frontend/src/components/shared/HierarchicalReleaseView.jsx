import React, { useState, useMemo } from 'react';
import { Table, Tag, Typography, Badge, Space, Button } from 'antd';
import { 
  RightOutlined,
  DownOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';

const { Text, Link } = Typography;

const HierarchicalReleaseView = ({ data, onCreateWorkflow }) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  // Status color mapping
  const getStatusColor = (status) => {
    const colorMap = {
      'Done': 'green',
      'Closed': 'default',
      'In Progress': 'blue',
      'Testing': 'orange',
      'Draft': 'default',
      'To Do': 'default',
      'Ready ✓': 'cyan',
      'Analysis': 'purple'
    };
    return colorMap[status] || 'default';
  };

  // Priority badge mapping - matches Jira style
  const getPriorityBadge = (priority) => {
    if (!priority) return <Tag color="default">—</Tag>;
    const text = priority.replace(/Priority\s*/i, '').toUpperCase();
    if (text.includes('P1') || text.includes('1')) return <Tag color="red">P1</Tag>;
    if (text.includes('P2') || text.includes('2')) return <Tag color="orange">P2</Tag>;
    if (text.includes('P3') || text.includes('3')) return <Tag color="blue">P3</Tag>;
    return <Tag color="default">{text}</Tag>;
  };

  // Flatten hierarchy for table display
  const flattenHierarchy = (hierarchy) => {
    const flattened = [];
    
    hierarchy.forEach((epic) => {
      // Add epic/parent row
      flattened.push({
        ...epic,
        isParent: true,
        hasChildren: epic.children && epic.children.length > 0,
        childCount: epic.children ? epic.children.length : 0
      });

      // Add child stories if epic is expanded
      if (expandedRowKeys.includes(epic.key) && epic.children && epic.children.length > 0) {
        epic.children.forEach((child) => {
          flattened.push({
            ...child,
            isChild: true,
            parentKey: epic.key
          });
        });
      }
    });

    return flattened;
  };

  const tableData = useMemo(() => flattenHierarchy(data.hierarchy || []), [data.hierarchy, expandedRowKeys]);

  const handleExpand = (record) => {
    if (record.hasChildren) {
      setExpandedRowKeys((prev) => {
        if (prev.includes(record.key)) {
          return prev.filter((key) => key !== record.key);
        } else {
          return [...prev, record.key];
        }
      });
    }
  };

  const columns = [
    {
      title: '',
      key: 'expand',
      width: 40,
      fixed: 'left',
      render: (_, record) => {
        if (record.isParent && record.hasChildren) {
          return (
            <span 
              onClick={() => handleExpand(record)}
              style={{ cursor: 'pointer', fontSize: '12px', color: '#666' }}
            >
              {expandedRowKeys.includes(record.key) ? '▼' : '►'}
            </span>
          );
        }
        if (record.isChild) {
          return <span style={{ marginLeft: 8, color: '#ccc' }}>└</span>;
        }
        return null;
      },
    },
    {
      title: 'KEY',
      dataIndex: 'key',
      key: 'key',
      width: 130,
      fixed: 'left',
      render: (key, record) => (
        <Link
          href={`https://extremenetworks.atlassian.net/browse/${key}`}
          target="_blank"
          style={{ 
            fontWeight: record.isParent ? 600 : 400,
            color: record.isParent ? '#1890ff' : '#666'
          }}
        >
          {key}
        </Link>
      ),
    },
    {
      title: 'PRI',
      dataIndex: 'priority',
      key: 'priority',
      width: 60,
      align: 'center',
      render: (priority) => getPriorityBadge(priority),
    },
    {
      title: 'TYPE',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type, record) => (
        <Tag color={record.isParent ? 'purple' : 'blue'}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'SUMMARY',
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
      render: (summary, record) => (
        <Space size={4}>
          <Text 
            strong={record.isParent}
            style={{ 
              fontStyle: record.isChild ? 'italic' : 'normal',
          }}
        >
          {summary}
        </Text>
        </Space>
      ),
    },
    {
      title: 'QA OWNER',
      dataIndex: 'qaOwner',
      key: 'qaOwner',
      width: 130,
      ellipsis: true,
      render: (qaOwner) => qaOwner ? <Text style={{ fontSize: '13px' }}>{qaOwner}</Text> : <Tag color="default">—</Tag>
    },
    {
      title: 'ASSIGNEE',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 140,
      ellipsis: true,
      render: (assignee) => assignee ? <Text style={{ fontSize: '13px' }}>{assignee}</Text> : <Tag color="default">—</Tag>
    },
    {
      title: 'JIRA STATUS',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={getStatusColor(status)} style={{ fontSize: '12px' }}>{status}</Tag>
      ),
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_, record) => {
        // Only show "Start Workflow" button for Stories (the actual testable functionalities)
        if (!record.isParent && record.type === 'Story') {
          return (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => onCreateWorkflow && onCreateWorkflow(record)}
              style={{ 
                fontSize: '12px',
                background: '#52c41a',
                borderColor: '#52c41a'
              }}
            >
              Start Workflow
            </Button>
          );
        }
        return null;
      },
    },
  ];

  // Summary statistics
  const totalEpics = data.hierarchy?.filter(item => item.type === 'Epic' || item.type === 'Initiative').length || 0;
  const totalStories = data.hierarchy?.reduce((sum, epic) => sum + (epic.children?.length || 0), 0) || 0;

  return (
    <div>
      <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0f2f5', borderRadius: '4px' }}>
        <Space size="large">
          <Text strong style={{ fontSize: '13px' }}>Epics: {totalEpics}</Text>
          <Text strong style={{ fontSize: '13px' }}>Stories: {totalStories}</Text>
          <Text strong style={{ fontSize: '13px' }}>Total: {totalEpics + totalStories}</Text>
          <a onClick={() => setExpandedRowKeys(data.hierarchy?.map(item => item.key) || [])} style={{ fontSize: '12px' }}>
            Expand All
          </a>
          <a onClick={() => setExpandedRowKeys([])} style={{ fontSize: '12px' }}>
            Collapse All
          </a>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={tableData}
        rowKey="key"
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          pageSizeOptions: ['25', '50', '100', '200'],
          showTotal: (total) => `Total ${total} items`,
        }}
        scroll={{ x: 1200 }}
        size="small"
        rowClassName={(record) => record.isChild ? 'child-row' : 'parent-row'}
        style={{
          backgroundColor: 'white',
          borderRadius: 8,
        }}
        bordered
      />

      <style>{`
        .parent-row {
          background-color: #fafafa;
          font-weight: 500;
        }
        .child-row {
          background-color: #ffffff;
        }
        .parent-row:hover {
          background-color: #e6f7ff !important;
        }
        .child-row:hover {
          background-color: #f5f5f5 !important;
        }
        .ant-table-cell {
          padding: 8px 12px !important;
        }
      `}</style>
    </div>
  );
};

export default HierarchicalReleaseView;
