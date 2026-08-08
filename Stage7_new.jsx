import React, { useState, useEffect } from 'react';
import {
  Card, Button, List, Typography, Space, Badge, message, Spin, Modal, Input, Tooltip
} from 'antd';
import {
  CodeOutlined, ReloadOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useWorkflowStore, useAuthStore, useUserStore } from '../../store';
import { useWorkflowNavigation } from '../../hooks/useWorkflowNavigation';
import CoUserSelector from '../shared/CoUserSelector';
import ApprovalPanel from '../shared/ApprovalPanel';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';
const { Title, Text } = Typography;
const { TextArea } = Input;

export default function Stage7() {
  const { workflow, advanceStage } = useWorkflowStore();
  const { user: currentUser } = useAuthStore();
  const { users, loadUsers } = useUserStore();
  const { goToStage } = useWorkflowNavigation();

  const [scripts, setScripts] = useState([]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [selectedCoUsers, setSelectedCoUsers] = useState([]);
  const [approvalStatus, setApprovalStatus] = useState([]);

  // Regenerate modal state
  const [regenVisible, setRegenVisible] = useState(false);
  const [regenFeedback, setRegenFeedback] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadUsers();
    loadScripts();
    loadApprovalStatus();
    const socket = io(WS_URL);
    socket.on(`script-progress-${workflow?.id}`, () => loadScripts());
    return () => socket.disconnect();
  }, [workflow?.id]);

  const loadScripts = async () => {
    const { data } = await axios.get(`${API}/stage7/${workflow?.id}`);
    setScripts(data);
    if (data.length > 0 && !selectedScript) setSelectedScript(data[0]);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await axios.post(`${API}/stage7/generate`, { workflow_id: workflow.id });
      await loadScripts();
      message.success('TCL scripts generated!');
    } catch {
      message.error('Script generation failed.');
    }
    setGenerating(false);
  };

  const handleEditScript = async (value) => {
    if (!selectedScript) return;
    setSelectedScript(s => ({ ...s, content: value }));
    await axios.put(`${API}/stage7/amend`, { script_id: selectedScript.id, content: value });
  };

  // Open modal pre-filled with empty feedback
  const openRegenModal = () => {
    setRegenFeedback('');
    setRegenVisible(true);
  };

  // Submit regenerate with feedback
  const handleRegenerate = async () => {
    if (!selectedScript) return;
    setRegenerating(true);
    try {
      const { data } = await axios.post(`${API}/stage7/regenerate`, {
        script_id: selectedScript.id,
        user_feedback: regenFeedback.trim()
      });
      setSelectedScript(s => ({ ...s, content: data.content }));
      setScripts(prev => prev.map(sc =>
        sc.id === selectedScript.id ? { ...sc, content: data.content } : sc
      ));
      message.success(`Script "${data.filename}" regenerated!`);
      setRegenVisible(false);
    } catch (err) {
      message.error(err.response?.data?.error || 'Regeneration failed.');
    }
    setRegenerating(false);
  };

  const handleAssignReviewers = async () => {
    await axios.post(`${API}/stage7/assign-reviewers`, {
      workflow_id: workflow.id,
      assigned_by: currentUser.id,
      co_users: selectedCoUsers
    });
    loadApprovalStatus();
    message.success('Reviewers assigned!');
  };

  const loadApprovalStatus = async () => {
    const { data } = await axios.get(`${API}/stage7/approval-status/${workflow.id}`);
    setApprovalStatus(data);
  };

  const handleApprove = async () => {
    const { data } = await axios.post(`${API}/stage7/approve`, {
      workflow_id: workflow.id,
      user_id: currentUser.id
    });
    if (data.all_approved) {
      await advanceStage();
      goToStage(8);
    } else {
      loadApprovalStatus();
      message.info('Your approval recorded. Waiting for co-users.');
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => goToStage(4)}>
          Previous
        </Button>
        <Button
          type="primary"
          icon={<CodeOutlined />}
          onClick={handleGenerate}
          loading={generating}
        >
          Generate All TCL Scripts
        </Button>
        {generating && <Spin />}
      </Space>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {/* Script list */}
        <Card title="Scripts" size="small" style={{ width: 220, flexShrink: 0, overflow: 'auto', maxHeight: 480 }}>
          <List
            size="small"
            dataSource={scripts}
            renderItem={s => (
              <List.Item
                key={s.id}
                style={{
                  cursor: 'pointer',
                  background: selectedScript?.id === s.id ? '#e6f7ff' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 4
                }}
                onClick={() => setSelectedScript(s)}
              >
                <Text style={{ fontSize: 12 }}>{s.filename}</Text>
              </List.Item>
            )}
          />
        </Card>

        {/* Editor panel */}
        <Card
          title={
            <Space>
              <span>{selectedScript?.filename || 'Select a script'}</span>
              {selectedScript && (
                <Tooltip title="Regenerate this script with AI using your feedback">
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={openRegenModal}
                    type="default"
                  >
                    Regenerate
                  </Button>
                </Tooltip>
              )}
            </Space>
          }
          style={{ flex: 1, minHeight: 480 }}
        >
          {selectedScript ? (
            <Editor
              height="420px"
              language="tcl"
              value={selectedScript.content}
              onChange={handleEditScript}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 13 }}
            />
          ) : (
            <Text type="secondary">
              Generate scripts or select one from the list to view and edit.
            </Text>
          )}
        </Card>
      </div>

      {/* Co-user Review */}
      <Card title="Co-user Review" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <CoUserSelector
            users={users.filter(u => u.id !== currentUser?.id)}
            value={selectedCoUsers}
            onChange={setSelectedCoUsers}
          />
          <Button onClick={handleAssignReviewers} disabled={selectedCoUsers.length === 0}>
            Assign Reviewers
          </Button>
          <List
            dataSource={approvalStatus}
            renderItem={a => (
              <List.Item>
                {a.approved
                  ? <Badge status="success" text={`${a.name} ✅`} />
                  : <Badge status="processing" text={`${a.name} ⏳`} />}
              </List.Item>
            )}
          />
        </Space>
      </Card>

      <ApprovalPanel
        onApprove={handleApprove}
        showRegenerate
        onRegenerate={handleGenerate}
        showAmend={false}
        disabled={scripts.length === 0}
        approvalNote="Primary user + all co-users must approve before proceeding."
      />

      {/* Regenerate Modal */}
      <Modal
        title={
          <Space>
            <ReloadOutlined />
            Regenerate: {selectedScript?.filename}
          </Space>
        }
        open={regenVisible}
        onCancel={() => setRegenVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setRegenVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="regen"
            type="primary"
            icon={<ReloadOutlined />}
            loading={regenerating}
            onClick={handleRegenerate}
          >
            Regenerate Script
          </Button>
        ]}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Text>
            Describe what to change or fix in the current script. The AI will use your
            instructions plus the original test plan steps to regenerate the script.
            Leave blank to regenerate with improved quality only.
          </Text>
          <TextArea
            rows={6}
            placeholder={
              'Examples:\n' +
              '• Use IGMPv3 instead of IGMPv2 for the multicast join\n' +
              '• Add traffic rate verification after the failover step\n' +
              '• The cleanup section is missing — add delete commands\n' +
              '• Fix the CheckKeyValue patterns to use curly braces'
            }
            value={regenFeedback}
            onChange={e => setRegenFeedback(e.target.value)}
          />
        </Space>
      </Modal>
    </div>
  );
}
