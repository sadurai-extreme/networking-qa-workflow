import React from 'react';
import { Upload, Button, List, Typography } from 'antd';
import { UploadOutlined, FileOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function FileUploader({ onUpload, accept = '*', multiple = false, label = 'Upload Files', uploadedFiles = [] }) {
  const props = {
    beforeUpload: (file) => { onUpload && onUpload(file); return false; },
    multiple,
    accept,
    showUploadList: false,
  };

  return (
    <div>
      <Upload {...props}>
        <Button icon={<UploadOutlined />}>{label}</Button>
      </Upload>
      {uploadedFiles.length > 0 && (
        <List
          size="small"
          style={{ marginTop: 8 }}
          dataSource={uploadedFiles}
          renderItem={f => (
            <List.Item>
              <FileOutlined style={{ marginRight: 8, color: '#1677ff' }} />
              <Text>{f.name}</Text>
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
