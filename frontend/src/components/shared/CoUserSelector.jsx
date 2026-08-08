import React, { useState } from 'react';
import { Select, Tag, Avatar, Space } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';

export default function CoUserSelector({ users = [], value = [], onChange, label = 'Select Co-Reviewers' }) {
  return (
    <div>
      <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>
        <UserAddOutlined style={{ marginRight: 6 }} />{label}
      </label>
      <Select
        mode="multiple"
        style={{ width: '100%' }}
        placeholder="Select users..."
        value={value}
        onChange={onChange}
        optionLabelProp="label"
      >
        {users.map(u => (
          <Select.Option key={u.id} value={u.id} label={u.name}>
            <Space>
              <Avatar size="small" style={{ background: '#1677ff' }}>{u.name[0]}</Avatar>
              {u.name} <Tag color="blue">{u.role}</Tag>
            </Space>
          </Select.Option>
        ))}
      </Select>
    </div>
  );
}
