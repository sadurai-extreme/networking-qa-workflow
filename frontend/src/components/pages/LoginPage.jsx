import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Divider } from 'antd';
import { UserOutlined, LockOutlined, ApiOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store';

const { Title, Text } = Typography;

export default function LoginPage() {
  const { login, loading, error } = useAuthStore();
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    await login(values.username, values.password);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #001529 0%, #003366 100%)'
    }}>
      <Card style={{ width: 420, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <ApiOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          <Title level={3} style={{ marginTop: 12, marginBottom: 4 }}>NOS QA Workflow</Title>
          <Text type="secondary">Network Operating System QA Platform</Text>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form form={form} onFinish={handleSubmit} layout="vertical" size="large">
          <Form.Item name="username" label="Username / Email" rules={[{ required: true, message: 'Enter username or email' }]}>
            <Input prefix={<UserOutlined />} placeholder="e.g. extreme or user@company.com" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter password' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Default: extreme" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} style={{ marginTop: 8 }}>
            Sign In
          </Button>
        </Form>

        <Divider />
        <div style={{ background: '#f6f8fa', borderRadius: 6, padding: '10px 14px', fontSize: 12 }}>
          <Text type="secondary"><b>Admin:</b> extreme / extreme</Text><br />
          <Text type="secondary"><b>Users:</b> email / extreme (default)</Text>
        </div>
      </Card>
    </div>
  );
}
