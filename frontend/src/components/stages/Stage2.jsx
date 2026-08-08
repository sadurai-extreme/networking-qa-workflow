import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Spin, Input, Space, Upload, message, Row, Col, Alert, Divider, List, Progress, Timeline, Tag, Switch, Modal, Select, AutoComplete } from 'antd';
import { RobotOutlined, UploadOutlined, FileTextOutlined, CheckCircleOutlined, EditOutlined, EyeOutlined, DownloadOutlined, SendOutlined, CodeOutlined, CommentOutlined, TrophyOutlined, CloseCircleOutlined, BulbOutlined, HistoryOutlined, ClockCircleOutlined, MessageOutlined, FormOutlined, ArrowLeftOutlined, SaveOutlined, BookOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useWorkflowStore, useAuthStore } from '../../store';
import { useWorkflowNavigation } from '../../hooks/useWorkflowNavigation';
import ApprovalPanel from '../shared/ApprovalPanel';
import ChatPanel from '../shared/ChatPanel';
import ReactMarkdown from 'react-markdown';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function Stage2() {
  const { workflow } = useWorkflowStore();
  const { goToNextStage, goToStage } = useWorkflowNavigation();
  const { user: currentUser } = useAuthStore();
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [existingSkillFile, setExistingSkillFile] = useState(null);
  const [showingExisting, setShowingExisting] = useState(false);
  
  // Three document types
  const [currentFeatureSpecs, setCurrentFeatureSpecs] = useState([]);
  const [existingFeatureSpecs, setExistingFeatureSpecs] = useState([]);
  const [existingTestPlans, setExistingTestPlans] = useState([]);
  
  // New features
  const [additionalCLI, setAdditionalCLI] = useState('');
  const [qaFeatureInteractions, setQaFeatureInteractions] = useState('');
  const [userFeedback, setUserFeedback] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  
  // Evaluation feature
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  
  // Audit trail feature
  const [auditTrail, setAuditTrail] = useState([]);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [loadingAuditTrail, setLoadingAuditTrail] = useState(false);
  
  // Chat assistant feature
  const [inputMode, setInputMode] = useState('form'); // 'form' or 'chat'
  const [showChatPanel, setShowChatPanel] = useState(false);

  // Contract feature
  const [contractModalVisible, setContractModalVisible] = useState(false);
  const [contractTitle, setContractTitle] = useState('');
  const [contractDescription, setContractDescription] = useState('');
  const [contractSaving, setContractSaving] = useState(false);
  const [baseContractId, setBaseContractId] = useState(null);
  const [baseContractLabel, setBaseContractLabel] = useState('');
  const [baseContractOptions, setBaseContractOptions] = useState([]);
  const [baseContractSearching, setBaseContractSearching] = useState(false);

  useEffect(() => {
    if (workflow?.id) {
      // Load existing skill file and approval status for THIS workflow
      axios.get(`${API}/stage2/${workflow.id}`).then(r => {
        console.log('Stage 2 data loaded:', r.data);
        if (r.data?.content && typeof r.data.content === 'string') {
          setContent(r.data.content);
          setShowingExisting(false); // Already have skill file for this workflow
        } else if (workflow?.jira_story_id) {
          // No skill file yet - check if one exists for this Jira story from previous workflows
          axios.get(`${API}/stage2/check-existing/${workflow.jira_story_id}`).then(resp => {
            if (resp.data?.exists) {
              console.log('Found existing skill file for Jira story:', workflow.jira_story_id);
              setExistingSkillFile(resp.data.document);
              setShowingExisting(true);
            }
          }).catch(err => {
            console.error('Error checking for existing skill file:', err);
          });
        }
        if (r.data?.approved) setApproved(true);
      }).catch(err => {
        console.error('Error loading stage 2 data:', err);
      });
    }
  }, [workflow?.id, workflow?.jira_story_id]);

  const handleReuseExisting = async () => {
    setLoading(true);
    try {
      console.log('=== Reusing existing skill file ===');
      console.log('Source document:', existingSkillFile.id);
      
      const { data } = await axios.post(`${API}/stage2/reuse`, {
        workflow_id: workflow.id,
        source_document_id: existingSkillFile.id
      });
      
      console.log('Reuse successful:', data);
      setContent(data.content);
      setShowingExisting(false);
      // Reload audit trail to show the reuse action
      loadAuditTrail();
      message.success('Existing skill file reused successfully!');
    } catch (err) {
      console.error('Reuse failed:', err);
      message.error('Failed to reuse skill file: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  const [generationProgress, setGenerationProgress] = useState('');

  const handleGenerate = async () => {
    console.log('=== Starting skill file generation ===');
    console.log('Workflow:', workflow);
    console.log('Documents:', { currentFeatureSpecs, existingFeatureSpecs, existingTestPlans });
    console.log('Additional CLI:', additionalCLI);
    console.log('QA Feature Interactions:', qaFeatureInteractions);
    
    setLoading(true);
    setGenerationProgress('Analyzing git commits...');
    try {
      const formData = new FormData();
      formData.append('workflow_id', workflow.id);
      formData.append('jira_story', JSON.stringify({ 
        id: workflow.jira_story_id,
        title: workflow.title, 
        description: workflow.jira_story_description || '',
        release: workflow.jira_release,
        type: workflow.jira_story_type || 'Feature'
      }));
      
      currentFeatureSpecs.forEach(f => { if (f.originFileObj) formData.append('current_feature_spec', f.originFileObj); });
      existingFeatureSpecs.forEach(f => { if (f.originFileObj) formData.append('existing_feature_spec', f.originFileObj); });
      existingTestPlans.forEach(f => { if (f.originFileObj) formData.append('existing_test_plan', f.originFileObj); });
      if (additionalCLI.trim()) formData.append('additional_cli', additionalCLI);
      if (qaFeatureInteractions.trim()) formData.append('qa_feature_interactions', qaFeatureInteractions);
      if (baseContractId) formData.append('base_contract_id', baseContractId);
      
      console.log('Sending generation request...');
      setGenerationProgress('Generating comprehensive skill file with AI and analyzing code commits... This may take 3-5 minutes.');
      
      const { data } = await axios.post(`${API}/stage2/generate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 360000  // 6 minute timeout (commit analysis takes 2-3 min + LLM generation 2-3 min)
      });
      
      console.log('Generation successful:', data);
      setContent(data.content);
      setApproved(false); // New skill file needs fresh approval
      setShowingExisting(false); // Hide existing file card after generating new one
      setGenerationProgress('');
      setChatHistory(prev => [...prev, { 
        type: 'system', 
        message: 'Skill file generated successfully!',
        timestamp: new Date()
      }]);
      // Reload audit trail to show the generation action
      loadAuditTrail();
      message.success('Skill file generated successfully!');
    } catch (err) {
      console.error('Generation failed:', err);
      setGenerationProgress('');
      if (err.code === 'ECONNABORTED') {
        message.error('Generation timed out after 3 minutes. Please try again or check if Ollama is running.');
      } else {
        message.error('Generation failed: ' + (err.response?.data?.error || err.message || 'Check LLM config'));
      }
    }
    setLoading(false);
  };

  const handleRegenerateSkill = async () => {
    if (!userFeedback.trim()) {
      message.warning('Please describe what you would like to change or improve');
      return;
    }

    console.log('=== Regenerating Skill File ===');
    console.log('User Feedback:', userFeedback);
    
    setLoading(true);
    
    // Add user feedback to chat immediately
    const userMessage = { type: 'user', message: userFeedback, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMessage]);
    const currentFeedback = userFeedback;
    setUserFeedback('');
    
    try {
      const { data } = await axios.post(`${API}/stage2/regenerate`, {
        workflow_id: workflow.id,
        current_content: content,
        user_feedback: currentFeedback,
        jira_story: {
          id: workflow.jira_story_id,
          title: workflow.title,
          description: workflow.jira_story_description || '',
          release: workflow.jira_release,
          type: workflow.jira_story_type || 'Feature'
        }
      }, {
        timeout: 360000  // 6 minute timeout for regeneration with commit analysis
      });
      
      console.log('Skill file regenerated:', data);
      
      // Update the content with the regenerated skill file
      setContent(data.content);
      setApproved(false); // Regenerated skill file needs fresh approval
      
      setChatHistory(prev => [...prev, 
        { type: 'assistant', message: `✅ Skill file regenerated successfully (Version ${data.version})`, timestamp: new Date() }
      ]);
      // Reload audit trail to show the regeneration action
      loadAuditTrail();
      message.success('Skill file regenerated successfully!');
    } catch (err) {
      console.error('Regeneration failed:', err);
      setChatHistory(prev => [...prev, 
        { type: 'error', message: 'Failed to regenerate: ' + (err.response?.data?.error || err.message), timestamp: new Date() }
      ]);
      message.error('Failed to regenerate skill file');
    }
    setLoading(false);
  };

  const handleEvaluate = async () => {
    if (!content || !content.trim()) {
      message.warning('Please generate a skill file first');
      return;
    }

    console.log('=== Evaluating Skill File ===');
    setEvaluating(true);
    
    try {
      const { data } = await axios.post(`${API}/stage2/evaluate`, {
        workflow_id: workflow.id,
        content: content,
        jira_story: {
          id: workflow.jira_story_id,
          title: workflow.title,
          description: workflow.jira_story_description || '',
          release: workflow.jira_release,
          type: workflow.jira_story_type || 'Feature'
        }
      }, {
        timeout: 360000  // 6 minute timeout for evaluation with quality analysis
      });
      
      console.log('Evaluation complete:', data);
      setEvaluation(data);
      setShowEvaluation(true);
      message.success(`Evaluation complete! Grade: ${data.grade}`);
    } catch (err) {
      console.error('Evaluation failed:', err);
      message.error('Evaluation failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setEvaluating(false);
    }
  };

  const handleApprove = async () => {
    try {
      await axios.post(`${API}/stage2/approve`, { 
        workflow_id: workflow.id, 
        user_id: currentUser.id 
      });
      setApproved(true);
      // Reload audit trail before navigating
      await loadAuditTrail();
      message.success('Skill file approved! Proceeding to next stage...');
      setTimeout(() => goToNextStage(), 1000);
    } catch (err) {
      message.error('Approval failed: ' + (err.response?.data?.error || 'Unknown error'));
    }
  };
  
  const loadAuditTrail = async () => {
    if (!workflow?.id) return;
    
    setLoadingAuditTrail(true);
    try {
      const { data } = await axios.get(`${API}/stage2/audit-trail/${workflow.id}`);
      setAuditTrail(data.audit_trail || []);
    } catch (err) {
      console.error('Failed to load audit trail:', err);
      message.error('Failed to load audit trail');
    } finally {
      setLoadingAuditTrail(false);
    }
  };
  
  const handleViewDefaultSkill = async (file) => {
    try {
      const response = await axios.get(`${API}/stage2/default-skills/${file.name}`);
      setViewingFile({ name: file.name, content: response.data });
      setViewModalVisible(true);
    } catch (err) {
      message.error('Failed to load skill file');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill_file_${workflow?.jira_story_id || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    message.success('Skill file downloaded!');
  };

  const handleRequirementsExtracted = (requirements) => {
    console.log('Requirements extracted from chat:', requirements);
    message.success('Requirements extracted! You can now generate the skill file.');
    
    // Auto-fill form fields if needed
    if (requirements.additionalCLI) {
      setAdditionalCLI(requirements.additionalCLI);
    }
    if (requirements.qaFeatureInteractions) {
      setQaFeatureInteractions(requirements.qaFeatureInteractions);
    }
    if (requirements.userFeedback) {
      setUserFeedback(requirements.userFeedback);
    }
  };

  const handleSearchContracts = async (q) => {
    if (!q || q.length < 2) { setBaseContractOptions([]); return; }
    setBaseContractSearching(true);
    try {
      const { data } = await axios.get(`${API}/contracts/search?q=${encodeURIComponent(q)}`);
      setBaseContractOptions((data.contracts || []).map(c => ({
        value: c.id,
        label: `[${c.feature_key}] ${c.title} (v${c.version})`
      })));
    } catch { setBaseContractOptions([]); }
    setBaseContractSearching(false);
  };

  const handleSaveAsContract = async () => {
    if (!contractTitle.trim()) { message.warning('Please enter a title for the contract'); return; }
    setContractSaving(true);
    try {
      const { data } = await axios.post(`${API}/stage2/save-as-contract`, {
        workflow_id: workflow.id,
        title: contractTitle,
        description: contractDescription,
        content,
        feature_key: workflow.jira_story_id
      });
      message.success(`Saved as Contract: ${data.feature_key} v${data.version}`);
      setContractModalVisible(false);
      setContractTitle('');
      setContractDescription('');
    } catch (err) {
      message.error('Failed to save contract: ' + (err.response?.data?.error || err.message));
    }
    setContractSaving(false);
  };

  return (
    <div>
      <Card style={{ marginBottom: 16, background: '#f0f5ff', borderColor: '#1890ff' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Typography.Text strong style={{ fontSize: 16, color: '#1890ff' }}>Workflow: {workflow?.title || 'Untitled'}</Typography.Text>
          <Typography.Text type="secondary">Story: {workflow?.jira_story_id || 'N/A'} | Release: {workflow?.jira_release || 'N/A'}</Typography.Text>
        </Space>
      </Card>
      <Alert
        message="Stage 2: Skill File Generation"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      {/* Navigation */}
      <Space style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => goToStage(1)}
        >
          Back to Stage 1
        </Button>
      </Space>
      
      {/* Show existing skill file if found */}
      {showingExisting && existingSkillFile && (
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
              <span>Existing Skill File Found!</span>
            </Space>
          }
          style={{ marginBottom: 16, borderColor: '#52c41a', borderWidth: 2 }}
          styles={{ header: { background: '#f6ffed', borderBottom: '2px solid #52c41a' } }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="success"
              message={
                <div>
                  <strong>A skill file already exists for {workflow?.jira_story_id}</strong>
                </div>
              }
              description={
                <div>
                  <Paragraph style={{ marginBottom: 8 }}>
                    Previously generated on: <strong>{new Date(existingSkillFile.created_at).toLocaleString()}</strong>
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 8 }}>
                    From workflow: <Text code>{existingSkillFile.workflow_title}</Text>
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 0 }}>
                    You can <strong>reuse the existing skill file</strong> (recommended for consistency) or <strong>generate a new one</strong> if requirements have changed.
                  </Paragraph>
                </div>
              }
              showIcon
            />
            
            {/* Preview of existing skill file */}
            <Card
              size="small"
              title="Preview of Existing Skill File"
              styles={{ body: { maxHeight: 300, overflow: 'auto', background: '#fafafa' } }}
            >
              {existingSkillFile?.content && typeof existingSkillFile.content === 'string' ? (
                <ReactMarkdown>{existingSkillFile.content.substring(0, 1000)}...</ReactMarkdown>
              ) : (
                <Alert type="warning" message="Content preview unavailable" />
              )}
            </Card>
            
            <Row gutter={16}>
              <Col span={12}>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleReuseExisting}
                  loading={loading}
                  size="large"
                  block
                  style={{ height: 50, fontSize: 15 }}
                >
                  ✅ Reuse Existing Skill File
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  icon={<RobotOutlined />}
                  onClick={() => setShowingExisting(false)}
                  size="large"
                  block
                  style={{ height: 50, fontSize: 15 }}
                >
                  🔄 Generate New Skill File Instead
                </Button>
              </Col>
            </Row>
          </Space>
        </Card>
      )}
      
      <Alert
        message="🔍 Automated Code Commit Analysis"
        description="The system automatically analyzes git commits from the EXOS repository (xos_exos) related to this Jira story. It extracts changed functions, structs, enums, code diffs, and uses AI to understand the actual implementation. This provides real code-level insights for comprehensive skill file documentation."
        type="success"
        showIcon
        icon={<RobotOutlined />}
        style={{ marginBottom: 16, borderColor: '#52c41a' }}
      />
      
      {/* ─── CONTRACT: Use an existing Contract as base for this generation ─── */}
      <Card
        title={
          <Space>
            <BookOutlined style={{ color: '#722ed1', fontSize: 18 }} />
            <span style={{ color: '#722ed1', fontWeight: 700 }}>Base Contract</span>
            <Tag color="purple">For Feature Enhancements</Tag>
          </Space>
        }
        style={{ marginBottom: 16, borderColor: '#722ed1', borderWidth: 2 }}
        styles={{ header: { background: '#f9f0ff', borderBottom: '2px solid #722ed1' } }}
      >
        {!baseContractId ? (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="Is this workflow an enhancement to an existing feature?"
              description={
                <span>
                  If a <strong>Contract</strong> exists for this feature, select it below.
                  A Contract is the <strong>canonical skill file</strong> for a feature — it contains the complete, approved functional documentation.
                  Selecting it means the AI uses it as the base, so <strong>you don't need to upload old spec docs</strong>.
                </span>
              }
            />
            <AutoComplete
              style={{ width: '100%' }}
              options={baseContractOptions}
              onSearch={handleSearchContracts}
              onSelect={(val, opt) => {
                setBaseContractId(val);
                setBaseContractLabel(opt.label);
              }}
              placeholder="Search by feature key or Jira story (e.g. EXOS-39208, IPv6, NetLogin)..."
              notFoundContent={baseContractSearching ? <Spin size="small" /> : 'Type at least 2 characters to search'}
              allowClear
              size="large"
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
              Leave empty if this is a new feature (no existing contract needed)
            </Text>
          </>
        ) : (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message={<><strong>Contract loaded:</strong> {baseContractLabel}</>}
            description="The AI will use this as the base feature document. You only need to upload the current enhancement spec — no need for old history docs."
            action={
              <Button size="small" danger onClick={() => { setBaseContractId(null); setBaseContractLabel(''); setBaseContractOptions([]); }}>
                Remove
              </Button>
            }
          />
        )}
      </Card>

      {/* Optional: Reference Materials - MOVED TO TOP */}
      <Card 
        title={
          <Space>
            <FileTextOutlined />
            <span>Optional: Upload Reference Documents</span>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>{baseContractId ? '(Contract loaded — upload current spec only)' : '(Enhance AI generation quality)'}</Text>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Alert
          message="Optional: Upload documents for better context"
          description={baseContractId
            ? "Contract is already loaded as the base. Upload only the current enhancement specification if available."
            : "Reference documents help the AI understand the feature better. The system automatically uses 200+ skill file templates from the Switch Engine User Guide. You can generate without uploading these if unavailable."}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Row gutter={16}>
          <Col span={8}>
            <div>
              <Paragraph strong>1. Current Feature Specification (Optional)</Paragraph>
              <Upload 
                fileList={currentFeatureSpecs}
                onChange={({ fileList }) => setCurrentFeatureSpecs(fileList.slice(0, 3))}
                beforeUpload={() => false}
                maxCount={3}
                multiple
              >
                <Button icon={<UploadOutlined />} block>
                  {currentFeatureSpecs.length > 0 ? `✓ ${currentFeatureSpecs.length} file(s) selected` : 'Upload Documents (max 3)'}
                </Button>
              </Upload>
            </div>
          </Col>
          
          <Col span={8}>
            <div>
              <Paragraph strong>2. Existing Feature Specification (Optional)</Paragraph>
              <Upload 
                fileList={existingFeatureSpecs}
                onChange={({ fileList }) => setExistingFeatureSpecs(fileList.slice(0, 3))}
                beforeUpload={() => false}
                maxCount={3}
                multiple
              >
                <Button icon={<UploadOutlined />} block>
                  {existingFeatureSpecs.length > 0 ? `✓ ${existingFeatureSpecs.length} file(s) selected` : 'Upload Documents (max 3)'}
                </Button>
              </Upload>
            </div>
          </Col>
          
          <Col span={8}>
            <div>
              <Paragraph strong>3. Existing Test Plan (Optional)</Paragraph>
              <Upload 
                fileList={existingTestPlans}
                onChange={({ fileList }) => setExistingTestPlans(fileList.slice(0, 3))}
                beforeUpload={() => false}
                maxCount={3}
                multiple
              >
                <Button icon={<UploadOutlined />} block>
                  {existingTestPlans.length > 0 ? `✓ ${existingTestPlans.length} file(s) selected` : 'Upload Documents (max 3)'}
                </Button>
              </Upload>
            </div>
          </Col>
        </Row>
      </Card>
      
      {/* Additional CLI Commands Input */}
      <Card
        title={
          <Space>
            <CodeOutlined />
            <span>Additional CLI Commands (Optional)</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Alert
          message="Paste CLI commands that should be included in the skill file"
          description="If you know specific CLI commands that should be documented, paste them here. The AI will incorporate these commands into the generated skill file with proper formatting and context."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <TextArea
          rows={6}
          placeholder={`Example:
enable netlogin
configure netlogin bypass-authentication enable
configure netlogin bypass-mac <MAC_address>
configure netlogin bypass-port <port_list>
show netlogin bypass`}
          value={additionalCLI}
          onChange={(e) => setAdditionalCLI(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '13px' }}
        />
      </Card>
      
      {/* QA Feature Interactions Input */}
      <Card
        title={
          <Space>
            <CommentOutlined />
            <span>QA Input: Feature Interactions (Optional)</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Alert
          message="Specify features that interact with this feature"
          description="If this feature may interact with other EXOS features (e.g., VLAN, ACL, LACP, STP), please list them here. The AI will ensure the skill file documents these interactions and considers them during test plan generation."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <TextArea
          rows={6}
          placeholder={`Example:
- Interacts with VLAN configuration and port membership
- May affect ACL rule processing and priority
- Works with LACP for link aggregation scenarios
- Should be tested with STP enabled/disabled
- Requires consideration of QoS policies when configured`}
          value={qaFeatureInteractions}
          onChange={(e) => setQaFeatureInteractions(e.target.value)}
          style={{ fontSize: '13px' }}
        />
      </Card>
      
      {/* Primary Action: Generate Skill File - MOVED BELOW UPLOADS */}
      <Card 
        title={
          <Space>
            <RobotOutlined style={{ fontSize: 18, color: '#17a2b8' }} />
            <span>Generate Skill File Using AI</span>
          </Space>
        }
        style={{ marginBottom: 16, borderColor: '#17a2b8', borderWidth: 2 }}
        styles={{ header: { background: 'linear-gradient(135deg, #2d3e5f 0%, #1a2541 100%)', color: 'white', borderBottom: '3px solid #17a2b8' } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Alert
            type="success"
            message="AI-Powered Skill File Generation"
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>
                  The AI will generate a comprehensive skill file documenting the <strong>COMPLETE functional behavior and EXOS implementation</strong> of the feature. The generation process includes:
                </Paragraph>
                <ul style={{ marginLeft: 20, marginBottom: 8 }}>
                  <li><strong>🔍 Automated Commit Analysis:</strong> Analyzes git commits from xos_exos repository, extracts changed functions, structs, enums, and uses AI to understand actual code implementation</li>
                  <li><strong>Functional Description:</strong> How the feature works operationally</li>
                  <li><strong>EXOS Implementation:</strong> Technical architecture, daemons, modules, and internal processing (enhanced by commit analysis)</li>
                  <li><strong>Supported Attributes:</strong> All configurable parameters, ranges, and defaults</li>
                  <li><strong>CLI Commands:</strong> Complete command syntax with examples and output</li>
                  <li><strong>Feature Interactions:</strong> How feature integrates with other EXOS features</li>
                  <li><strong>Operational Characteristics:</strong> Scalability, performance, HA behavior</li>
                  <li><strong>Configuration Examples:</strong> Real-world EXOS configuration scenarios</li>
                </ul>
                <Alert
                  type="info"
                  message={<strong>📝 For Feature Enhancements</strong>}
                  description="If this is an enhancement to an existing feature, the skill file will document the COMPLETE behavior including existing functionality + new enhancements. This provides a full picture of how the feature works after the enhancement."
                  showIcon
                  style={{ marginBottom: 8 }}
                />
                <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                  <Text type="secondary">
                    💡 The AI automatically uses knowledge from 200+ skill file templates from the Switch Engine User Guide. Reference documents uploaded above will further enhance generation quality.
                  </Text>
                </Paragraph>
              </div>
            }
            showIcon
          />
          
          <Button 
            type="primary" 
            icon={<RobotOutlined />} 
            onClick={handleGenerate} 
            loading={loading}
            size="large"
            block
            style={{ height: 60, fontSize: 16, fontWeight: 600 }}
          >
            {content ? '🔄 Regenerate Skill File with LLM' : '🚀 Generate Skill File with LLM'}
          </Button>
          
          {loading && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Spin size="large" />
              <Paragraph style={{ marginTop: 16, fontSize: 14, fontWeight: 'bold', color: '#1890ff' }}>
                {generationProgress || 'Analyzing data and generating comprehensive skill file...'}
              </Paragraph>
              <Paragraph style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                💡 Tip: Generation typically takes 1-2 minutes with local Ollama LLM
              </Paragraph>
            </div>
          )}
        </Space>
      </Card>
      
      {content && (
        <Card
          title={<><FileTextOutlined /> Generated Skill File</>}
          extra={
            <Space>
              <Button 
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                type="primary"
              >
                Download
              </Button>
              <Button 
                size="small" 
                icon={editing ? <EyeOutlined /> : <EditOutlined />}
                onClick={() => setEditing(!editing)}
              >
                {editing ? 'Preview' : 'Edit'}
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {editing ? (
            <>
              <TextArea 
                rows={20} 
                value={content} 
                onChange={e => setContent(e.target.value)}
                style={{ fontFamily: 'monospace' }}
              />
              <Button 
                style={{ marginTop: 12 }} 
                type="primary"
                onClick={() => { setEditing(false); message.success('Changes saved locally.'); }}
                icon={<CheckCircleOutlined />}
              >
                Done Editing
              </Button>
            </>
          ) : (
            <div style={{ 
              maxHeight: 500, 
              overflow: 'auto', 
              padding: 16, 
              background: '#f5f5f5',
              textAlign: 'left'
            }}>
              {typeof content === 'string' && content.trim() ? (
                <div style={{
                  maxWidth: '80ch',
                  margin: '0',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word'
                }}>
                  <ReactMarkdown 
                    components={{
                      p: ({node, ...props}) => <p style={{ margin: '0.5em 0', wordWrap: 'break-word', overflowWrap: 'break-word' }} {...props} />,
                      code: ({node, inline, ...props}) => inline ? 
                        <code style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word' }} {...props} /> : 
                        <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word' }} {...props} />,
                      pre: ({node, ...props}) => <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word', overflow: 'auto' }} {...props} />
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              ) : (
                <Alert 
                  type="warning" 
                  message="No content available" 
                  description="The skill file content is empty or invalid. Please generate a new skill file."
                />
              )}
            </div>
          )}
        </Card>
      )}
      
      {/* Chat/Feedback Interface for Regeneration */}
      {content && (
        <Card
          title={
            <Space>
              <CommentOutlined />
              <span>Request Updates to Skill File</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Alert
            message="Have changes or improvements?"
            description="Describe what you'd like to update, add, or fix in the skill file. The AI will regenerate it based on your feedback."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          {chatHistory.length > 0 && (
            <Card 
              size="small" 
              title="Feedback History"
              style={{ marginBottom: 16, maxHeight: 200, overflow: 'auto' }}
            >
              <List
                dataSource={chatHistory}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={item.type === 'user' ? '👤' : (item.type === 'error' ? '⚠️' : '🤖')}
                      title={item.type === 'user' ? 'You' : (item.type === 'error' ? 'Error' : 'LLM Assistant')}
                      description={
                        <div>
                          <Text>{item.message}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
          
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              rows={3}
              placeholder="Describe what you'd like to update, add, or fix in the skill file: Add more error handling examples, include CLI commands for troubleshooting, expand section 3 with timeout scenarios, etc."
              value={userFeedback}
              onChange={(e) => setUserFeedback(e.target.value)}
              disabled={loading}
              onPressEnter={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  handleRegenerateSkill();
                }
              }}
            />
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleRegenerateSkill}
              loading={loading}
              disabled={!userFeedback.trim()}
              style={{ height: 'auto' }}
            >
              Regenerate Skill
            </Button>
          </Space.Compact>
          <Text type="secondary" style={{ fontSize: '11px', marginTop: 8, display: 'block' }}>
            💡 Tip: Press Ctrl+Enter to regenerate quickly. The skill file will be updated based on your feedback.
          </Text>
        </Card>
      )}

      {/* ─── SAVE AS CONTRACT — prominent dedicated section ─── */}
      {content && (
        <Card
          title={
            <Space>
              <SaveOutlined style={{ color: '#722ed1', fontSize: 18 }} />
              <span style={{ color: '#722ed1', fontWeight: 700 }}>Save as Contract</span>
              <Tag color="purple">Permanent Feature Reference</Tag>
            </Space>
          }
          style={{ marginBottom: 16, borderColor: '#722ed1', borderWidth: 2 }}
          styles={{ header: { background: '#f9f0ff', borderBottom: '2px solid #722ed1' } }}
        >
          <Row gutter={24} align="middle">
            <Col span={16}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text strong style={{ fontSize: 15 }}>What is a Contract?</Text>
                <Text>
                  A Contract is the <strong>approved, canonical skill file</strong> for this feature. Once saved, it acts as the
                  base for any future enhancement workflow — so QA engineers don't need to re-upload old specs.
                  The AI will automatically extend the Contract when generating skill files for future Jira stories.
                </Text>
                <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                  <li>Stores the full feature functional document permanently</li>
                  <li>Versioned — each time you update and re-save, a new version is created</li>
                  <li>Future enhancement workflows simply select this Contract as their base</li>
                </ul>
              </Space>
            </Col>
            <Col span={8} style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                block
                style={{ height: 56, fontSize: 15, background: '#722ed1', borderColor: '#722ed1' }}
                onClick={() => {
                  setContractTitle(workflow?.title || workflow?.jira_story_id || '');
                  setContractDescription('');
                  setContractModalVisible(true);
                }}
              >
                💾 Save as Contract
              </Button>
              <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
                Saves this skill file as the canonical reference
              </Text>
            </Col>
          </Row>
        </Card>
      )}
      
      <Divider />
      
      {/* Evaluation Section */}
      {content && (
        <Card 
          title={<><TrophyOutlined /> Quality Evaluation</>}
          extra={
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleEvaluate}
              loading={evaluating}
              disabled={!content || evaluating}
            >
              {evaluating ? 'Evaluating...' : 'Evaluate Quality'}
            </Button>
          }
        >
          {!evaluation && !evaluating && (
            <Alert
              message="Quality Evaluation Available"
              description="Click 'Evaluate Quality' to assess this skill file against EXOS production standards. The evaluator will score Structure, Technical Accuracy, Content Quality, Code Commit Alignment, and Documentation Quality."
              type="info"
              showIcon
            />
          )}
          
          {evaluating && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                Evaluating skill file quality against EXOS standards...
              </Text>
            </div>
          )}
          
          {evaluation && showEvaluation && (
            <div>
              {/* Overall Grade */}
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={8}>
                  <Card style={{ textAlign: 'center', background: evaluation.grade === 'A' ? '#f6ffed' : evaluation.grade === 'B' ? '#e6f7ff' : evaluation.grade === 'C' ? '#fffbe6' : evaluation.grade === 'D' ? '#fff1f0' : '#fff1f0' }}>
                    <Title level={1} style={{ margin: 0, color: evaluation.grade === 'A' ? '#52c41a' : evaluation.grade === 'B' ? '#1890ff' : evaluation.grade === 'C' ? '#faad14' : evaluation.grade === 'D' ? '#ff4d4f' : '#ff4d4f' }}>
                      {evaluation.grade}
                    </Title>
                    <Text type="secondary">Overall Grade</Text>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card style={{ textAlign: 'center' }}>
                    <Title level={1} style={{ margin: 0 }}>
                      {Math.round(evaluation.finalScore)}
                    </Title>
                    <Text type="secondary">Final Score (0-100)</Text>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card style={{ textAlign: 'center' }}>
                    <Title level={1} style={{ margin: 0, color: evaluation.grade === 'F' ? '#ff4d4f' : evaluation.grade === 'A' ? '#52c41a' : '#1890ff' }}>
                      {evaluation.grade === 'A' ? '✅ Excellent' : evaluation.grade === 'B' ? '👍 Good' : evaluation.grade === 'C' ? '⚠️ Acceptable' : evaluation.grade === 'D' ? '❌ Needs Work' : '❌ Failed'}
                    </Title>
                    <Text type="secondary">Status</Text>
                  </Card>
                </Col>
              </Row>
              
              {/* Category Scores */}
              <Card title="Category Scores" style={{ marginBottom: 16 }}>
                {evaluation.categoryScores && (
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                      <Text strong>Structure & Completeness (25%)</Text>
                      <Progress percent={Math.round(evaluation.categoryScores.structure)} status={evaluation.categoryScores.structure >= 75 ? 'success' : evaluation.categoryScores.structure >= 60 ? 'normal' : 'exception'} />
                    </div>
                    <div>
                      <Text strong>Technical Accuracy (30%)</Text>
                      <Progress percent={Math.round(evaluation.categoryScores.technical)} status={evaluation.categoryScores.technical >= 75 ? 'success' : evaluation.categoryScores.technical >= 60 ? 'normal' : 'exception'} />
                    </div>
                    <div>
                      <Text strong>Content Quality (20%)</Text>
                      <Progress percent={Math.round(evaluation.categoryScores.content)} status={evaluation.categoryScores.content >= 75 ? 'success' : evaluation.categoryScores.content >= 60 ? 'normal' : 'exception'} />
                    </div>
                    <div>
                      <Text strong>Code Commit Alignment (15%)</Text>
                      <Progress percent={Math.round(evaluation.categoryScores.commits)} status={evaluation.categoryScores.commits >= 75 ? 'success' : evaluation.categoryScores.commits >= 60 ? 'normal' : 'exception'} />
                    </div>
                    <div>
                      <Text strong>Documentation Quality (10%)</Text>
                      <Progress percent={Math.round(evaluation.categoryScores.documentation)} status={evaluation.categoryScores.documentation >= 75 ? 'success' : evaluation.categoryScores.documentation >= 60 ? 'normal' : 'exception'} />
                    </div>
                  </Space>
                )}
              </Card>
              
              {/* Summary */}
              {evaluation.summary && (
                <Alert
                  message="Evaluation Summary"
                  description={evaluation.summary}
                  type={evaluation.grade === 'F' ? 'error' : evaluation.grade === 'D' ? 'warning' : evaluation.grade === 'C' ? 'warning' : 'success'}
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}
              
              {/* Strengths and Weaknesses */}
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Card title={<Text type="success"><CheckCircleOutlined /> Strengths</Text>} size="small">
                    {evaluation.strengths && evaluation.strengths.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {evaluation.strengths.map((strength, idx) => (
                          <li key={idx} style={{ marginBottom: 8 }}>{strength}</li>
                        ))}
                      </ul>
                    ) : (
                      <Text type="secondary">No strengths identified</Text>
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title={<Text type="danger"><CloseCircleOutlined /> Weaknesses</Text>} size="small">
                    {evaluation.weaknesses && evaluation.weaknesses.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {evaluation.weaknesses.map((weakness, idx) => (
                          <li key={idx} style={{ marginBottom: 8 }}>{weakness}</li>
                        ))}
                      </ul>
                    ) : (
                      <Text type="secondary">No significant weaknesses</Text>
                    )}
                  </Card>
                </Col>
              </Row>
              
              {/* Recommendations */}
              {evaluation.recommendations && evaluation.recommendations.length > 0 && (
                <Card title={<><BulbOutlined /> Recommendations</>} size="small">
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    {evaluation.recommendations.map((rec, idx) => (
                      <li key={idx} style={{ marginBottom: 8 }}>{rec}</li>
                    ))}
                  </ol>
                </Card>
              )}
              
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Button onClick={() => setShowEvaluation(false)}>Hide Evaluation</Button>
              </div>
            </div>
          )}
        </Card>
      )}
      
      <Divider />
      
      {/* Audit Trail Section */}
      {content && (
        <Card 
          title={<><HistoryOutlined /> Audit Trail</>}
          extra={
            <Button
              type="default"
              icon={<ClockCircleOutlined />}
              onClick={() => {
                if (!showAuditTrail) {
                  loadAuditTrail();
                }
                setShowAuditTrail(!showAuditTrail);
              }}
              loading={loadingAuditTrail}
            >
              {showAuditTrail ? 'Hide History' : 'Show History'}
            </Button>
          }
        >
          {!showAuditTrail && !loadingAuditTrail && (
            <Alert
              message="Track Changes and Actions"
              description="View the complete history of changes, regenerations, and approvals for this skill file with timestamps."
              type="info"
              showIcon
            />
          )}
          
          {loadingAuditTrail && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                Loading audit trail...
              </Text>
            </div>
          )}
          
          {showAuditTrail && !loadingAuditTrail && auditTrail.length === 0 && (
            <Alert
              message="No History Yet"
              description="No actions have been recorded yet for this skill file."
              type="info"
              showIcon
            />
          )}
          
          {showAuditTrail && !loadingAuditTrail && auditTrail.length > 0 && (
            <Timeline
              mode="left"
              items={auditTrail.map((entry) => {
                const getColor = (actionType) => {
                  switch (actionType) {
                    case 'generate': return 'blue';
                    case 'regenerate': return 'cyan';
                    case 'approve': return 'green';
                    case 'amend': return 'orange';
                    case 'reuse': return 'purple';
                    default: return 'gray';
                  }
                };
                
                return {
                  color: getColor(entry.action_type),
                  children: (
                    <div>
                      <div style={{ marginBottom: 4 }}>
                        <Tag color={getColor(entry.action_type)}>{entry.action_type.toUpperCase()}</Tag>
                        <Text strong>{entry.action}</Text>
                      </div>
                      {entry.user_name && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          by {entry.user_name}
                        </Text>
                      )}
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {new Date(entry.created_at).toLocaleString()}
                      </Text>
                      {entry.details && (
                        <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                          {entry.details.version && <div>Version: {entry.details.version}</div>}
                          {entry.details.content_length && <div>Size: {entry.details.content_length} characters</div>}
                          {entry.details.user_feedback && (
                            <div style={{ marginTop: 4, fontStyle: 'italic' }}>
                              Feedback: "{entry.details.user_feedback}..."
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                };
              })}
            />
          )}
        </Card>
      )}
      
      <Divider />
      
      <Card title={<><CheckCircleOutlined /> Approval Required</>}>
        {approved ? (
          <Alert
            message="Skill File Approved"
            description="This skill file has been reviewed and approved. You can proceed to the next stage."
            type="success"
            showIcon
          />
        ) : (
          <ApprovalPanel 
            onApprove={handleApprove} 
            disabled={!content}
            approvalNote="⚠️ Please carefully review the generated skill file before approving. The next stage will only be accessible after approval."
          />
        )}
      </Card>
      
      {/* Save as Contract Modal */}
      <Modal
        title={<Space><SaveOutlined style={{ color: '#722ed1' }} /><span style={{ color: '#722ed1' }}>Save Skill File as Contract</span></Space>}
        open={contractModalVisible}
        onCancel={() => setContractModalVisible(false)}
        onOk={handleSaveAsContract}
        okText="💾 Save Contract"
        confirmLoading={contractSaving}
        okButtonProps={{ style: { background: '#722ed1', borderColor: '#722ed1' } }}
        width={560}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="This skill file will be saved as the canonical feature reference."
            description="Future enhancement workflows can select this Contract to use as a base — no need to upload old specs again."
            type="success"
            showIcon
            icon={<BookOutlined />}
          />
          <div>
            <Text strong>Contract Title *</Text>
            <Input
              placeholder={`e.g., ${workflow?.jira_story_id} — ${workflow?.title || 'Feature Skill File'}`}
              value={contractTitle}
              onChange={e => setContractTitle(e.target.value)}
              style={{ marginTop: 4 }}
              size="large"
            />
          </div>
          <div>
            <Text strong>Description <Text type="secondary">(optional)</Text></Text>
            <Input.TextArea
              rows={3}
              placeholder="Brief description of what this feature does, so future QA engineers can identify it..."
              value={contractDescription}
              onChange={e => setContractDescription(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </div>
          <Alert
            message={`Feature Key: ${(workflow?.jira_story_id || 'FEATURE').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`}
            description="Used to group contract versions for the same feature. Derived from the Jira story ID."
            type="info"
            showIcon
          />
        </Space>
      </Modal>

      {/* Chat Assistant Panel - Always Available */}
      <ChatPanel
        workflowId={workflow?.id}
        stageNumber={2}
        context={{
          jira_story_id: workflow?.jira_story_id,
          jira_release: workflow?.jira_release,
          title: workflow?.title,
          current_feature_spec: currentFeatureSpecs[0]?.originFileObj || null,
          existing_feature_spec: existingFeatureSpecs[0]?.originFileObj || null,
          existing_test_plan: existingTestPlans[0]?.originFileObj || null
        }}
        onRequirementsExtracted={handleRequirementsExtracted}
        onClose={() => {}}
      />
    </div>
  );
}
