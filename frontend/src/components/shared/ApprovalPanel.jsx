import React from 'react';
import { Card, Button, Space, Alert } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

export default function ApprovalPanel({
  onApprove,
  loading = false,
  approvalNote = null,
  disabled = false,
}) {
  return (
    <Card style={{ marginTop: 16, background: '#fafafa' }}>
      {approvalNote && (
        <Alert message={approvalNote} type="info" showIcon style={{ marginBottom: 12 }} />
      )}
      <Space>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={onApprove}
          loading={loading}
          disabled={disabled}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
        >
          Approve & Proceed
        </Button>
      </Space>
    </Card>
  );
}
