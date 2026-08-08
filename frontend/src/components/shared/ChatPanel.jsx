import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, Avatar, Typography, Space, Tag, Upload, message as antdMessage, Spin } from 'antd';
import {
  MessageOutlined,
  SendOutlined,
  PaperClipOutlined,
  DownloadOutlined,
  CloseOutlined,
  MinusOutlined,
  UserOutlined,
  RobotOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useThemeStore } from '../../store';
import './ChatPanel.css';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * ChatPanel - Floating AI assistant for requirements gathering
 * Used in Stage 2 (Skill Files) and Stage 3 (Test Plans)
 */
const ChatPanel = ({ workflowId, stageNumber, context, onRequirementsExtracted, onClose }) => {
  const { isDarkMode } = useThemeStore();

  // Palette flips between light and dark
  const c = isDarkMode ? {
    panel:      '#1f2937',
    header:     '#111827',
    msgArea:    '#111827',
    userBubble: '#1d4ed8',
    aiBubble:   '#374151',
    inputArea:  '#1f2937',
    border:     '#374151',
    text:       '#f3f4f6',
    subText:    '#9ca3af',
    scrollTrack:'#374151',
    scrollThumb:'#6b7280',
  } : {
    panel:      '#ffffff',
    header:     '#1890ff',
    msgArea:    '#f5f5f5',
    userBubble: '#e6f7ff',
    aiBubble:   '#f6ffed',
    inputArea:  '#ffffff',
    border:     '#f0f0f0',
    text:       '#1f2937',
    subText:    '#6b7280',
    scrollTrack:'#f1f1f1',
    scrollThumb:'#888888',
  };

  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [extractedData, setExtractedData] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://10.127.26.9:5100';

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Start chat session
  const startSession = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/api/chat/session/start`, {
        workflow_id: workflowId,
        stage_number: stageNumber,
      });

      setSession(response.data);
      setMessages([
        {
          id: Date.now(),
          role: 'assistant',
          content: response.data.welcome_message,
          timestamp: new Date().toISOString(),
        },
      ]);
      setVisible(true);
    } catch (error) {
      console.error('Failed to start chat session:', error);
      antdMessage.error('Failed to start chat session');
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!inputValue.trim() || !session) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setTyping(true);

    try {
      const response = await axios.post(`${API_BASE}/api/chat/send`, {
        session_id: session.session_id,
        message: inputValue,
      });

      const aiMessage = {
        id: response.data.message_id,
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Update extracted data
      if (response.data.extracted_data) {
        setExtractedData(prev => ({ ...prev, ...response.data.extracted_data }));
      }

      // Check if conversation is complete
      if (response.data.conversation_complete && onRequirementsExtracted) {
        antdMessage.success('Requirements gathered! Ready to generate.');
        onRequirementsExtracted(response.data.extracted_data);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      antdMessage.error('Failed to send message');
    } finally {
      setTyping(false);
    }
  };

  // Upload file
  const handleFileUpload = async (file) => {
    if (!session) return;

    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const uploadMsgId = Date.now();
    const analysisLoadingId = Date.now() + 1;

    // Show file + loading indicator immediately
    setMessages(prev => [
      ...prev,
      {
        id: uploadMsgId,
        role: 'user',
        content: `📎 Uploaded: ${file.name}`,
        timestamp: new Date().toISOString(),
      },
      {
        id: analysisLoadingId,
        role: 'assistant',
        content: isPdf ? '🔍 Analyzing file… (this may take a few seconds for diagrams)' : '📄 Processing file…',
        loading: true,
        timestamp: new Date().toISOString(),
      },
    ]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', session.session_id);

    try {
      const response = await axios.post(`${API_BASE}/api/chat/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Replace loading message with actual analysis result
      setMessages(prev => prev.map(m =>
        m.id === analysisLoadingId
          ? { ...m, content: response.data.analysis, loading: false }
          : m
      ));

      antdMessage.success(`Uploaded: ${file.name}`);
    } catch (error) {
      setMessages(prev => prev.map(m =>
        m.id === analysisLoadingId
          ? { ...m, content: `❌ Failed to process file: ${error.message}`, loading: false }
          : m
      ));
      antdMessage.error('Failed to upload file');
    }

    return false; // Prevent default upload
  };

  // Complete session
  const completeSession = async () => {
    if (!session) return;

    try {
      const response = await axios.post(`${API_BASE}/api/chat/session/complete`, {
        session_id: session.session_id,
      });

      antdMessage.success('Chat session completed!');
      
      if (onRequirementsExtracted) {
        onRequirementsExtracted(response.data.requirements);
      }

      setVisible(false);
    } catch (error) {
      console.error('Failed to complete session:', error);
      antdMessage.error('Failed to complete session');
    }
  };

  // Export chat
  const exportChat = async (format = 'markdown') => {
    if (!session) return;

    try {
      const response = await axios.get(
        `${API_BASE}/api/chat/export/${session.session_id}?format=${format}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `chat-${session.session_id}.${format === 'markdown' ? 'md' : 'txt'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      antdMessage.success('Chat exported!');
    } catch (error) {
      console.error('Export error:', error);
      antdMessage.error('Failed to export chat');
    }
  };

  // Render message
  const renderMessage = (msg) => {
    const isUser = msg.role === 'user';
    
    return (
      <div key={msg.id} className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
        <Space align="start">
          <Avatar
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            style={{ backgroundColor: isUser ? '#1890ff' : '#52c41a' }}
          />
          <div
            className="message-content"
            style={{
              backgroundColor: isUser ? c.userBubble : c.aiBubble,
              color: c.text,
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            }}
          >
            {msg.loading ? (
              <Space>
                <Spin size="small" />
                <Text style={{ color: c.subText, fontStyle: 'italic' }}>{msg.content}</Text>
              </Space>
            ) : (
              <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: c.text }}>
                {msg.content}
              </Paragraph>
            )}
            <Text style={{ fontSize: 11, color: c.subText }}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </Text>
          </div>
        </Space>
      </div>
    );
  };

  return (
    <>
      {/* Toggle Button */}
      {!visible && (
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<MessageOutlined />}
          onClick={startSession}
          loading={loading}
          className="chat-toggle-button"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            width: 60,
            height: 60,
            fontSize: 24,
            zIndex: 1000,
          }}
        />
      )}

      {/* Chat Panel */}
      {visible && (
        <div
          className={`chat-panel ${minimized ? 'minimized' : ''}`}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            width: minimized ? 300 : 400,
            height: minimized ? 60 : 600,
            backgroundColor: c.panel,
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            overflow: 'hidden',
            border: `1px solid ${c.border}`,
          }}
        >
          {/* Header */}
          <div
            className="chat-header"
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${c.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: c.header,
              color: '#fff',
              cursor: 'move',
            }}
          >
            <Space>
              <RobotOutlined />
              <Text strong style={{ color: '#fff' }}>
                AI Assistant - Stage {stageNumber}
              </Text>
            </Space>
            <Space>
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => exportChat('markdown')}
                style={{ color: '#fff' }}
              />
              <Button
                type="text"
                size="small"
                icon={<MinusOutlined />}
                onClick={() => setMinimized(!minimized)}
                style={{ color: '#fff' }}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => {
                  setVisible(false);
                  if (onClose) onClose();
                }}
                style={{ color: '#fff' }}
              />
            </Space>
          </div>

          {/* Messages */}
          {!minimized && (
            <>
              <div
                className="chat-messages"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 16,
                  backgroundColor: c.msgArea,
                }}
              >
                {messages.map(renderMessage)}
                
                {typing && (
                  <div className="chat-message assistant">
                    <Space align="start">
                      <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#52c41a' }} />
                      <Spin indicator={<LoadingOutlined spin />} />
                    </Space>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Extracted Data */}
              {Object.keys(extractedData).length > 0 && (
                <div style={{ padding: '8px 16px', borderTop: `1px solid ${c.border}`, backgroundColor: c.inputArea }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>Extracted:</strong>{' '}
                    {Object.keys(extractedData)
                      .filter(k => extractedData[k] !== null)
                      .map(k => <Tag key={k} color="blue" style={{ marginBottom: 4 }}>{k}</Tag>)}
                  </Text>
                </div>
              )}

              {/* Input */}
              <div style={{ padding: 16, borderTop: `1px solid ${c.border}`, backgroundColor: c.inputArea }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Upload beforeUpload={handleFileUpload} showUploadList={false}>
                    <Button icon={<PaperClipOutlined />} />
                  </Upload>
                  <TextArea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onPressEnter={(e) => {
                      if (!e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={sendMessage}
                    loading={typing}
                  />
                </Space.Compact>
                <div style={{ marginTop: 8 }}>
                  <Button type="link" size="small" onClick={completeSession}>
                    Complete & Generate
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ChatPanel;
