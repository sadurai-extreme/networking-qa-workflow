import React from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import axios from 'axios';
import { useAuthStore } from '../../store';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function ChangePasswordModal({ open, onClose, userId }) {
  const { token } = useAuthStore();
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    try {
      await axios.post(`${API}/auth/change-password`, {
        user_id: userId,
        old_password: values.old_password,
        new_password: values.new_password,
      }, { headers: { Authorization: `Bearer ${token}` } });
      message.success('Password changed successfully!');
      form.resetFields();
      onClose();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to change password');
    }
  };

  return (
    <Modal title="🔒 Change Password" open={open} onCancel={onClose} footer={null}>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="old_password" label="Current Password" rules={[{ required: true }]}>
          <Input.Password placeholder="Enter current password" />
        </Form.Item>
        <Form.Item name="new_password" label="New Password" rules={[{ required: true, min: 6 }]}>
          <Input.Password placeholder="Minimum 6 characters" />
        </Form.Item>
        <Form.Item name="confirm_password" label="Confirm New Password"
          dependencies={['new_password']}
          rules={[{ required: true }, ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('new_password') === value) return Promise.resolve();
              return Promise.reject('Passwords do not match');
            }
          })]}>
          <Input.Password placeholder="Confirm new password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>Update Password</Button>
      </Form>
    </Modal>
  );
}
