import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Spin, Input, Upload, Space, Alert, message, Radio, Divider, Modal, Switch, Tabs, Tag, Progress, List, Select } from 'antd';
import { RobotOutlined, UploadOutlined, FileAddOutlined, EditOutlined, FormOutlined, SafetyOutlined, DownloadOutlined, FileWordOutlined, FileExcelOutlined, MessageOutlined, ArrowLeftOutlined, SearchOutlined, ExclamationCircleOutlined, CheckCircleOutlined, WarningOutlined, BulbOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useWorkflowStore, useAuthStore } from '../../store';
import { useWorkflowNavigation } from '../../hooks/useWorkflowNavigation';
import ApprovalPanel from '../shared/ApprovalPanel';
import ChatPanel from '../shared/ChatPanel';
import TestPlanEvaluationDisplay from './TestPlanEvaluationDisplay';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
const { Title } = Typography;
const { TextArea } = Input;

export default function Stage3() {
  const { workflow, advanceStage } = useWorkflowStore();
  const { goToStage, goToNextStage } = useWorkflowNavigation();
  const { user: currentUser } = useAuthStore();
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [featureType, setFeatureType] = useState('new'); // 'new' or 'enhancement'
  const [existingTestPlan, setExistingTestPlan] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [newTestCases, setNewTestCases] = useState([]);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [unitTestPlanFile, setUnitTestPlanFile] = useState(null);
  const [unitTestPlanFileName, setUnitTestPlanFileName] = useState('');
  const [functionalOnelinerFile, setFunctionalOnelinerFile] = useState(null);
  const [functionalOnelinerFileName, setFunctionalOnelinerFileName] = useState('');
  const [topologyFile, setTopologyFile] = useState(null);
  const [topologyFileName, setTopologyFileName] = useState('');
  const [topologyDescription, setTopologyDescription] = useState('');
  const [userInstructions, setUserInstructions] = useState('');
  const [reviewComments, setReviewComments] = useState('');
  const [reviewedPlanFile, setReviewedPlanFile] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [testPlanInfo, setTestPlanInfo] = useState({});
  const [chatSummary, setChatSummary] = useState(null); // extracted requirements from chat

  // Automation folder (mandatory)
  const [automationFolder, setAutomationFolder] = useState('');
  const [automationContext, setAutomationContext] = useState(null);
  const [analyzingFolder, setAnalyzingFolder] = useState(false);

  // Gap analysis
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [gapAnalyzing, setGapAnalyzing] = useState(false);
  const [gapNotes, setGapNotes] = useState('');
  const [activeTab, setActiveTab] = useState('test-plan');

  useEffect(() => {
    axios.get(`${API}/stage3/${workflow?.id}`).then(r => { if (r.data?.content) setContent(r.data.content); });
  }, [workflow?.id]);

  const handleAnalyzeFolder = async () => {
    if (!automationFolder.trim()) {
      message.warning('Please enter or select an automation folder name');
      return;
    }
    setAnalyzingFolder(true);
    try {
      const resp = await fetch('/api/stage3/analyze-automation-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ workflow_id: workflow.id, automation_folder: automationFolder.trim() })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to analyze folder');
      setAutomationContext(data);
      message.success(`Analyzed: ${data.existing_test_cases?.length || 0} existing automated test cases found`);
    } catch (err) {
      message.error(`Folder analysis failed: ${err.message}`);
    } finally {
      setAnalyzingFolder(false);
    }
  };

  const handleGenerate = async () => {
    if (featureType === 'enhancement' && !existingTestPlan) {
      message.warning('Please upload existing test plan first for feature enhancement');
      return;
    }
    if (!automationContext) {
      message.warning('Please analyze the automation functional folder first — it is mandatory to avoid duplicate test cases');
      return;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('workflow_id', workflow.id);
      formData.append('feature_type', featureType);
      if (existingTestPlan) {
        formData.append('existing_test_plan', existingTestPlan);
      }
      if (unitTestPlanFile) {
        formData.append('unit_test_plan', unitTestPlanFile);
      }
      if (functionalOnelinerFile) {
        formData.append('functional_oneliner', functionalOnelinerFile);
      }
      if (topologyFile) {
        formData.append('topology_file', topologyFile);
      }
      if (topologyDescription) {
        formData.append('topology_description', topologyDescription);
      }
      if (userInstructions) {
        formData.append('user_instructions', userInstructions);
      }
      
      const { data } = await axios.post(`${API}/stage3/generate`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setContent(data.content);
      
      // Extract new test cases for display
      if (data.new_test_cases) {
        setNewTestCases(data.new_test_cases);
      } else {
        // Parse test cases from content if not provided separately
        const testCaseMatches = data.content.match(/### Test Case \d+:.*?(?=### Test Case \d+:|$)/gs);
        setNewTestCases(testCaseMatches || []);
      }
      
      message.success(featureType === 'new' ? 'Test plan generated!' : 'Test cases added to existing test plan!');
    } catch (err) { 
      message.error('Generation failed: ' + (err.response?.data?.error || err.message)); 
    }
    setLoading(false);
  };

  const handleExistingTestPlanUpload = async (file) => {
    const text = await file.text();
    setExistingTestPlan(text);
    message.success('Existing test plan loaded. Click "Generate" to add new test cases.');
    return false; // Prevent default upload
  };

  const handleUnitTestPlanUpload = async (file) => {
    setUnitTestPlanFile(file);
    setUnitTestPlanFileName(file.name);
    message.success(`Unit test plan "${file.name}" loaded. It will be considered during test plan generation.`);
    return false; // Prevent default upload
  };

  const handleFunctionalOnelinerUpload = async (file) => {
    setFunctionalOnelinerFile(file);
    setFunctionalOnelinerFileName(file.name);
    message.success(`Functional one-liner "${file.name}" loaded. It will be expanded into detailed test cases.`);
    return false; // Prevent default upload
  };

  const handleTopologyUpload = async (file) => {
    const validExtensions = ['png', 'jpg', 'jpeg', 'svg', 'txt', 'md', 'json', 'yaml', 'yml', 'pdf'];
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      message.error(`Invalid file type. Supported: ${validExtensions.join(', ')}`);
      return false;
    }
    
    setTopologyFile(file);
    setTopologyFileName(file.name);
    message.success(`Topology file "${file.name}" loaded. It will be analyzed during test plan generation.`);
    return false; // Prevent default upload
  };

  const handleDownloadTestPlan = async (format) => {
    if (!content || content.trim().length === 0) {
      message.warning('No test plan content to download');
      return;
    }

    const isExcel = format === 'xlsx' || format === 'excel';
    if (isExcel) setDownloadingExcel(true); else setDownloading(true);
    try {
      const response = await axios.get(`${API}/stage3/download/${workflow.id}/${format}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const ext = format === 'markdown' || format === 'md' ? 'md' : format === 'docx' || format === 'word' ? 'docx' : format;
      link.setAttribute('download', `TestPlan_${workflow.jira_story_id || workflow.id.substring(0, 8)}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success(`Test plan downloaded as ${format.toUpperCase()}!`);
    } catch (err) {
      message.error('Download failed: ' + (err.response?.data?.error || err.message));
    }
    if (isExcel) setDownloadingExcel(false); else setDownloading(false);
  };

  const handleReviewedPlanUpload = async (file) => {
    if (!reviewComments || reviewComments.trim().length === 0) {
      message.warning('Please provide review comments before uploading the reviewed test plan');
      return false;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('workflow_id', workflow.id);
    formData.append('review_comments', reviewComments);

    try {
      const { data } = await axios.post(`${API}/stage3/upload-reviewed`, formData);
      setContent(data.content);
      message.success(`Reviewed test plan uploaded! Revision ${data.revision_number}`);
    } catch (err) {
      message.error('Upload failed: ' + (err.response?.data?.error || err.message));
    }
    
    return false; // Prevent default upload
  };

  const handleRegenerateWithComments = async () => {
    if (!reviewComments || reviewComments.trim().length === 0) {
      message.warning('Please provide review comments before regenerating');
      return;
    }

    setRegenerating(true);
    try {
      const formData = new FormData();
      formData.append('workflow_id', workflow.id);
      formData.append('review_comments', reviewComments);

      const { data } = await axios.post(`${API}/stage3/regenerate-with-comments`, formData);
      setContent(data.content);
      setReviewComments(''); // Clear comments after regeneration
      message.success(`Test plan regenerated addressing review comments! Revision ${data.revision_number}`);
    } catch (err) {
      message.error('Regeneration failed: ' + (err.response?.data?.error || err.message));
    }
    setRegenerating(false);
  };

  const handleFinalUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('workflow_id', workflow.id);
    const { data } = await axios.post(`${API}/stage3/upload`, formData);
    setContent(data.content);
    message.success('Test plan uploaded!');
    return false;
  };

  const handleEvaluate = async () => {
    if (!content || content.trim().length === 0) {
      message.warning('No test plan content to evaluate');
      return;
    }

    setEvaluating(true);
    try {
      const { data } = await axios.post(`${API}/stage3/evaluate`, {
        workflow_id: workflow.id,
        content: content
      });
      setEvaluation(data);
      
      if (data.passed) {
        message.success(`Evaluation complete! Grade: ${data.grade} (${data.score}/100)`);
      } else {
        message.warning(`Evaluation complete. Grade: ${data.grade} (${data.score}/100) - Improvements needed`);
      }
    } catch (err) {
      message.error('Evaluation failed: ' + (err.response?.data?.error || err.message));
    }
    setEvaluating(false);
  };

  const handleApprove = async () => {
    try {
      await axios.post(`${API}/stage3/approve`, { workflow_id: workflow.id, user_id: currentUser.id });
    } catch (e) {
      // approval may already be recorded — proceed to navigation regardless
    }
    goToStage(4);
  };

  const handleExportDocx = async () => {
    if (!newTestCases || newTestCases.length === 0) {
      message.warning('No new test cases to export');
      return;
    }

    setExportingDocx(true);
    try {
      const response = await axios.post(`${API}/stage3/export-docx`, {
        workflow_id: workflow.id,
        test_cases: newTestCases,
        test_plan_info: testPlanInfo
      }, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Test_Cases_${workflow.id.substring(0, 8)}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('Test cases exported to DOCX successfully!');
    } catch (err) {
      message.error('Export failed: ' + (err.response?.data?.error || err.message));
    }
    setExportingDocx(false);
  };

  const handleRequirementsExtracted = (requirements) => {
    // Auto-fill form fields
    if (requirements?.testPlanInfo) setTestPlanInfo(requirements.testPlanInfo);
    if (requirements?.userInstructions) setUserInstructions(requirements.userInstructions);
    if (requirements?.topology_description) setTopologyDescription(requirements.topology_description);
    // Show summary modal for review
    setChatSummary(requirements || {});
  };

  const handleGapAnalysis = async () => {
    setGapAnalyzing(true);
    setGapAnalysis(null);
    try {
      const { data } = await axios.post(`${API}/stage3/gap-analysis`, { workflow_id: workflow.id });
      setGapAnalysis(data.analysis);
      setActiveTab('gap-analysis');
      message.success('Gap analysis complete!');
    } catch (err) {
      message.error('Gap analysis failed: ' + (err.response?.data?.error || err.message));
    }
    setGapAnalyzing(false);
  };

  const handleRegenerateFromGap = async () => {
    const parts = [];
    if (gapAnalysis) {
      if (gapAnalysis.missingScenarios?.length > 0) {
        parts.push('## Missing Scenarios to Add:');
        gapAnalysis.missingScenarios.forEach(s => parts.push(`- [${s.priority || 'P2'}] ${s.title}${s.description ? ': ' + s.description : ''}`));
      }
      if (gapAnalysis.recommendations?.length > 0) {
        parts.push('\n## Recommended New Test Cases:');
        gapAnalysis.recommendations.forEach(r => parts.push(`- [${r.priority || 'P2'}] ${r.title}${r.description ? ': ' + r.description : ''}`));
      }
      if (gapAnalysis.insufficientCoverage?.length > 0) {
        parts.push('\n## Test Cases Needing Improvement:');
        gapAnalysis.insufficientCoverage.forEach(i => parts.push(`- ${i.tcRef}: ${i.gap}${i.suggestion ? ' | Suggestion: ' + i.suggestion : ''}`));
      }
      if (gapAnalysis.integrationGaps?.length > 0) {
        parts.push('\n## Integration Testing Gaps:');
        gapAnalysis.integrationGaps.forEach(g => parts.push(`- [${g.feature}]: ${g.gap}`));
      }
      if (gapAnalysis.cliGaps?.length > 0) {
        parts.push('\n## CLI Coverage Gaps:');
        gapAnalysis.cliGaps.forEach(c => parts.push(`- ${c.command}: ${c.gap}`));
      }
    }
    if (gapNotes && gapNotes.trim()) {
      parts.push('\n## Additional Requirements from Analyst:');
      parts.push(gapNotes.trim());
    }
    const reviewText = parts.join('\n');
    if (!reviewText.trim()) {
      message.warning('No gap analysis findings or notes to regenerate from. Run gap analysis first or add notes.');
      return;
    }
    setRegenerating(true);
    try {
      const formData = new FormData();
      formData.append('workflow_id', workflow.id);
      formData.append('review_comments', reviewText);
      const { data } = await axios.post(`${API}/stage3/regenerate-with-comments`, formData);
      setContent(data.content);
      setGapAnalysis(null);
      setGapNotes('');
      setEvaluation(null);
      setActiveTab('test-plan');
      message.success(`Test plan regenerated from gap analysis! Revision ${data.revision_number}`);
    } catch (err) {
      message.error('Regeneration failed: ' + (err.response?.data?.error || err.message));
    }
    setRegenerating(false);
  };

  return (
    <div>
      {workflow && (
        <Card style={{ marginBottom: 16, background: '#f0f5ff', borderColor: '#1890ff' }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Typography.Text strong style={{ fontSize: 16, color: '#1890ff' }}>Workflow: {workflow.title || 'Untitled'}</Typography.Text>
            <Typography.Text type="secondary">Story: {workflow.jira_story_id || 'N/A'} | Release: {workflow.jira_release || 'N/A'}</Typography.Text>
          </Space>
        </Card>
      )}
      <Title level={4}><RobotOutlined /> Stage 3: Test Plan Generation</Title>
      
      {/* Navigation */}
      <Space style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => goToStage(2)}
        >
          Back to Stage 2 (Skill File)
        </Button>
      </Space>
      
      {/* SQA Test Plan Template Download */}
      <Card style={{ marginBottom: 16, background: '#f0f7ff', borderColor: '#1890ff' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Space>
            <FileWordOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Typography.Title level={5} style={{ margin: 0 }}>
              SQA Test Plan Template
            </Typography.Title>
          </Space>
          <Typography.Text type="secondary">
            Download the official Extreme Networks SQA Functional Test Plan Template (QMS-00337 R03) to maintain standardized documentation.
          </Typography.Text>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />}
            href={`${BACKEND_URL}/uploads/templates/QMS-00337_R03%20Functional_Test_Plan_Template.doc`}
            download="QMS-00337_R03_Functional_Test_Plan_Template.doc"
            target="_blank"
          >
            Download SQA Test Plan Template (.doc)
          </Button>
        </Space>
      </Card>
      
      <Card style={{ marginBottom: 16 }} title="Select Feature Type">
        <Radio.Group 
          value={featureType} 
          onChange={(e) => {
            setFeatureType(e.target.value);
            setExistingTestPlan(null);
            setContent('');
          }}
          style={{ marginBottom: 16 }}
        >
          <Space direction="vertical">
            <Radio value="new">
              <Space>
                <FileAddOutlined />
                <strong>New Feature</strong> - Generate complete test plan from scratch
              </Space>
            </Radio>
            <Radio value="enhancement">
              <Space>
                <EditOutlined />
                <strong>Existing Feature Enhancement</strong> - Add new test cases to existing test plan
              </Space>
            </Radio>
          </Space>
        </Radio.Group>

        {featureType === 'enhancement' && (
          <Alert 
            type="info" 
            message="Enhancement Mode"
            description={
              <div>
                <p>Please upload the existing test plan first. The AI will:</p>
                <ul style={{ marginLeft: 20, marginBottom: 8 }}>
                  <li>Analyze the existing test plan structure</li>
                  <li>Identify what's already covered</li>
                  <li>Add new test cases for the enhancement</li>
                  <li>Maintain consistent numbering and format</li>
                </ul>
              </div>
            }
            showIcon
            style={{ marginTop: 12 }}
          />
        )}
      </Card>

      {featureType === 'enhancement' && (
        <Card style={{ marginBottom: 16 }} title="Step 1: Upload Existing Test Plan">
          <Upload 
            beforeUpload={handleExistingTestPlanUpload} 
            showUploadList={false} 
            accept=".md,.txt,.docx"
          >
            <Button icon={<UploadOutlined />} type={existingTestPlan ? 'default' : 'primary'}>
              {existingTestPlan ? '✓ Existing Test Plan Loaded - Click to Replace' : 'Upload Existing Test Plan'}
            </Button>
          </Upload>
          {existingTestPlan && (
            <Alert 
              type="success" 
              message="Existing test plan loaded successfully" 
              style={{ marginTop: 12 }} 
              showIcon 
            />
          )}
        </Card>
      )}

      {/* Unit Test Plan Upload Section - Available for both new and enhancement modes */}
      <Card 
        style={{ marginBottom: 16 }} 
        title={
          <Space>
            <FileAddOutlined />
            <span>Optional: Unit Test Plan from Dev Team</span>
          </Space>
        }
      >
        <Alert 
          message="Consider Unit Testing Coverage" 
          description={
            <div>
              <p><strong>Upload your development team's unit test plan</strong> to ensure comprehensive test coverage.</p>
              <ul style={{ marginLeft: 20, marginBottom: 8 }}>
                <li><strong>QA/Customer Perspective:</strong> Functional test cases will focus on end-to-end scenarios, user workflows, and customer requirements</li>
                <li><strong>Avoid Duplication:</strong> System analyzes unit tests to prevent redundant test cases at the functional level</li>
                <li><strong>Fill Gaps:</strong> Identifies untested scenarios and generates complementary functional test cases</li>
                <li><strong>Supported Formats:</strong> .txt, .doc, .docx, .csv, .xls, .xlsx</li>
              </ul>
            </div>
          }
          type="info" 
          showIcon 
          style={{ marginBottom: 12 }} 
        />
        <Space direction="vertical" style={{ width: '100%' }}>
          <Upload 
            beforeUpload={handleUnitTestPlanUpload} 
            showUploadList={false} 
            accept=".txt,.doc,.docx,.csv,.xls,.xlsx"
            maxCount={1}
          >
            <Button 
              icon={<UploadOutlined />} 
              type={unitTestPlanFile ? 'default' : 'dashed'}
            >
              {unitTestPlanFile ? '✓ Unit Test Plan Loaded - Click to Replace' : 'Upload Unit Test Plan (Optional)'}
            </Button>
          </Upload>
          {unitTestPlanFile && (
            <Alert 
              message={
                <Space>
                  <span><strong>Loaded:</strong> {unitTestPlanFileName}</span>
                  <Button 
                    type="link" 
                    danger 
                    size="small"
                    onClick={() => {
                      setUnitTestPlanFile(null);
                      setUnitTestPlanFileName('');
                      message.info('Unit test plan removed');
                    }}
                  >
                    Remove
                  </Button>
                </Space>
              }
              description="This unit test plan will be analyzed to generate complementary functional test cases from a QA/customer perspective."
              type="success" 
              showIcon 
              style={{ marginTop: 8 }} 
            />
          )}
        </Space>
      </Card>

      {/* Functional One-Liner Upload Section - Available for both new and enhancement modes */}
      <Card 
        style={{ marginBottom: 16 }} 
        title={
          <Space>
            <FileAddOutlined />
            <span>Optional: Functional One-Liner Test Cases</span>
          </Space>
        }
      >
        <Alert 
          message="Upload Functional One-Liner Test Cases" 
          description={
            <div>
              <p><strong>Upload a list of high-level functional test descriptions</strong> to be expanded into detailed test cases.</p>
              <ul style={{ marginLeft: 20, marginBottom: 8 }}>
                <li><strong>Simple Format:</strong> One test description per line (e.g., "Verify VLAN creation with NSI mapping")</li>
                <li><strong>Auto-Expansion:</strong> Each one-liner will be expanded into a complete test case with Methodology, Pass Criteria, CLI commands, and proper formatting</li>
                <li><strong>Test Case Structure:</strong> System adds topology, preconditions, priority, sanity flags automatically</li>
                <li><strong>Consistent Format:</strong> All expanded test cases follow the official EXOS format (5.x.x numbering, lettered sub-steps)</li>
                <li><strong>Supported Formats:</strong> .txt, .md, .csv, .xlsx</li>
              </ul>
              <p><strong>Example One-Liners:</strong></p>
              <ul style={{ marginLeft: 20, marginBottom: 0, fontFamily: 'Monaco, monospace', fontSize: 12 }}>
                <li>Verify VLAN 4048 to NSI 15999999 mapping on MLAG proxy</li>
                <li>Test dynamic VLAN creation when FA server sends TLV</li>
                <li>Verify VLAN/NSI assignment persists after reboot</li>
              </ul>
            </div>
          }
          type="info" 
          showIcon 
          style={{ marginBottom: 12 }} 
        />
        <Space direction="vertical" style={{ width: '100%' }}>
          <Upload 
            beforeUpload={handleFunctionalOnelinerUpload} 
            showUploadList={false} 
            accept=".txt,.md,.csv,.xlsx"
            maxCount={1}
          >
            <Button 
              icon={<UploadOutlined />} 
              type={functionalOnelinerFile ? 'default' : 'dashed'}
            >
              {functionalOnelinerFile ? '✓ Functional One-Liners Loaded - Click to Replace' : 'Upload Functional One-Liners (Optional)'}
            </Button>
          </Upload>
          {functionalOnelinerFile && (
            <Alert 
              message={
                <Space>
                  <span><strong>Loaded:</strong> {functionalOnelinerFileName}</span>
                  <Button 
                    type="link" 
                    danger 
                    size="small"
                    onClick={() => {
                      setFunctionalOnelinerFile(null);
                      setFunctionalOnelinerFileName('');
                      message.info('Functional one-liners removed');
                    }}
                  >
                    Remove
                  </Button>
                </Space>
              }
              description="Each one-liner will be expanded into a detailed test case with complete Methodology, Pass Criteria, CLI commands, and proper formatting."
              type="success" 
              showIcon 
              style={{ marginTop: 8 }} 
            />
          )}
        </Space>
      </Card>

      {/* Topology Upload Section */}
      <Card 
        style={{ marginBottom: 16 }} 
        title={
          <Space>
            <FileAddOutlined />
            <span>Optional: Test Topology</span>
          </Space>
        }
      >
        <Alert 
          message="Upload Network Topology" 
          description={
            <div>
              <p><strong>Upload your test topology</strong> to ensure test cases match your network setup.</p>
              <ul style={{ marginLeft: 20, marginBottom: 8 }}>
                <li><strong>Image Files:</strong> PNG, JPG, JPEG, SVG (system will analyze using AI vision)</li>
                <li><strong>Text Files:</strong> TXT, MD, JSON, YAML (structured topology description)</li>
                <li><strong>Auto-Detection:</strong> System identifies single-node, 2-node, or 5-node topologies</li>
                <li><strong>Dynamic Port Mapping:</strong> Automatically generates proper TCL port variables</li>
                <li><strong>Supported Formats:</strong> .png, .jpg, .jpeg, .svg, .pdf, .txt, .md, .json, .yaml, .yml</li>
              </ul>
            </div>
          }
          type="info" 
          showIcon 
          style={{ marginBottom: 12 }} 
        />
        <Space direction="vertical" style={{ width: '100%' }}>
          <Upload 
            beforeUpload={handleTopologyUpload} 
            showUploadList={false} 
            accept=".png,.jpg,.jpeg,.svg,.txt,.md,.json,.yaml,.yml,.pdf"
            maxCount={1}
          >
            <Button 
              icon={<UploadOutlined />} 
              type={topologyFile ? 'default' : 'dashed'}
            >
              {topologyFile ? '✓ Topology Loaded - Click to Replace' : 'Upload Topology (Optional)'}
            </Button>
          </Upload>
          {topologyFile && (
            <Alert 
              message={
                <Space>
                  <span><strong>Loaded:</strong> {topologyFileName}</span>
                  <Button 
                    type="link" 
                    danger 
                    size="small"
                    onClick={() => {
                      setTopologyFile(null);
                      setTopologyFileName('');
                      message.info('Topology file removed');
                    }}
                  >
                    Remove
                  </Button>
                </Space>
              }
              description="This topology will be analyzed to generate appropriate test cases with correct port mappings and TCL variables."
              type="success" 
              showIcon 
              style={{ marginTop: 8 }} 
            />
          )}
        </Space>
        
        <Divider />
        
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text strong>Or Describe Your Topology:</Typography.Text>
          <Alert 
            message="Provide a text description of your test topology" 
            description={
              <div>
                <p>If you don't have a topology diagram, describe your test setup in text format.</p>
                <p><strong>Example:</strong></p>
                <ul style={{ marginLeft: 20, marginBottom: 0, fontFamily: 'Monaco, monospace', fontSize: 12 }}>
                  <li>DUT1: X670G2-48x-4q running EXOS 32.6 (MLAG Proxy)</li>
                  <li>DUT2: X670G2-48x-4q running EXOS 32.6 (MLAG Proxy Peer)</li>
                  <li>DUT3: X590-24t-1q running EXOS 32.4 (FA Client)</li>
                  <li>IXIA: Connected to DUT1 port 1:1 for traffic generation</li>
                  <li>ISC: Ports 1:49-50 between DUT1 and DUT2</li>
                </ul>
              </div>
            }
            type="info" 
            style={{ marginBottom: 12 }} 
          />
          <TextArea 
            rows={5}
            placeholder="Describe your test topology setup...

Example:
DUT1: X670G2-48x-4q (EXOS 32.6) - MLAG Proxy
DUT2: X670G2-48x-4q (EXOS 32.6) - MLAG Proxy Peer  
DUT3: X590-24t-1q (EXOS 32.4) - FA Client
IXIA: Connected to DUT1 port 1:1
ISC: Ports 1:49-50 between DUT1 and DUT2"
            value={topologyDescription}
            onChange={(e) => setTopologyDescription(e.target.value)}
            style={{ fontFamily: 'Monaco, monospace', fontSize: 13 }}
          />
          {topologyDescription && (
            <Alert 
              message={`${topologyDescription.length} characters - Topology description will be used in test case generation`}
              type="success" 
              showIcon 
            />
          )}
        </Space>
      </Card>

      {/* User Instructions Section */}
      <Card 
        style={{ marginBottom: 16 }} 
        title={
          <Space>
            <FormOutlined />
            <span>Special Instructions / Requirements</span>
          </Space>
        }
      >
        <Alert 
          message="Provide Additional Context" 
          description={
            <div>
              <p><strong>Add any specific requirements, constraints, or instructions</strong> for test plan generation.</p>
              <p><strong>Examples:</strong></p>
              <ul style={{ marginLeft: 20, marginBottom: 0 }}>
                <li>"Integration testing with VXLAN"</li>
                <li>"Topology1, DUT1 is VOSS FA Server, DUT2 is EXOS FA Client"</li>
                <li>"Focus on IPv6 scenarios"</li>
                <li>"Include performance testing with 10K MACs"</li>
                <li>"Test with specific hardware models: X460-G2, X670-G2"</li>
              </ul>
            </div>
          }
          type="info" 
          showIcon 
          style={{ marginBottom: 12 }} 
        />
        <TextArea 
          rows={4}
          placeholder="Enter any special instructions, requirements, or context for test plan generation...

Examples:
- Integration testing with VXLAN
- Topology: DUT1 is VOSS FA Server, DUT2 is EXOS FA Client
- Focus on IPv6 scenarios
- Test with 10K MAC addresses
- Specific hardware: X460-G2, X670-G2"
          value={userInstructions}
          onChange={(e) => setUserInstructions(e.target.value)}
          style={{ fontFamily: 'Monaco, monospace', fontSize: 13 }}
        />
        {userInstructions && (
          <Alert 
            message={`${userInstructions.length} characters - Instructions will be incorporated into test plan generation`}
            type="info" 
            showIcon 
            style={{ marginTop: 8 }} 
          />
        )}
      </Card>

      <Card
        style={{ marginBottom: 16, borderColor: automationContext ? '#52c41a' : '#faad14', borderWidth: 2 }}
        title={<span>🤖 Automation Functional Folder <Tag color="red">Mandatory</Tag></span>}
      >
        <Alert
          message="Provide the automation test folder to detect existing automated test cases and avoid duplication in the generated test plan."
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
        />
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            style={{ width: '100%' }}
            placeholder="Select or type an automation folder name..."
            showSearch
            allowClear
            value={automationFolder || undefined}
            onChange={val => { setAutomationFolder(val || ''); setAutomationContext(null); }}
            onSearch={val => setAutomationFolder(val)}
            options={[
              { value: 'EXOS_Fabric_Attach_Zero_Touch_Client', label: 'EXOS_Fabric_Attach_Zero_Touch_Client' },
              { value: 'Fabric_Attach_Over_MLAG', label: 'Fabric_Attach_Over_MLAG' },
              { value: 'Fabric_Attach_Radius_VSA', label: 'Fabric_Attach_Radius_VSA' },
              { value: 'Fabric_Attach_Static_NSI_Offset', label: 'Fabric_Attach_Static_NSI_Offset' },
              { value: 'Fabric_Attach_Assignment_Discovery_Timeout', label: 'Fabric_Attach_Assignment_Discovery_Timeout' },
              { value: 'Policy_Fabric_Attach_ISID', label: 'Policy_Fabric_Attach_ISID' },
            ]}
          />
          <Button
            type="default"
            loading={analyzingFolder}
            onClick={handleAnalyzeFolder}
            disabled={!automationFolder.trim()}
          >
            🔍 Analyze Folder
          </Button>
          {automationContext && (
            <Alert
              message={`✅ ${automationContext.existing_test_cases?.length || 0} existing automated test cases loaded from ${automationContext.folder}`}
              description={`${automationContext.lib_procs?.length || 0} library procs available. These test cases will NOT be duplicated in the generated plan.`}
              type="success"
              showIcon
            />
          )}
          {!automationContext && (
            <Alert
              message="Automation folder not yet analyzed — test plan generation is blocked until you analyze a folder"
              type="error"
              showIcon
            />
          )}
        </Space>
      </Card>

      <Card style={{ marginBottom: 16 }} title={
        featureType === 'enhancement' ? 'Generate Enhanced Test Plan' : 'Generate Test Plan'
      }>
        <Alert 
          message={featureType === 'new' ? 'New Feature Test Plan' : 'Feature Enhancement Test Cases'} 
          description={
            featureType === 'new' 
              ? 'Generate a comprehensive EXOS Functional Test Plan from skill file with optional supporting documents'
              : 'Add new test cases to the existing test plan for the enhancement'
          }
          type="info"
          showIcon 
          style={{ marginBottom: 12 }} 
        />
        <Space>
          <Button 
            type="primary" 
            icon={<RobotOutlined />} 
            onClick={handleGenerate} 
            loading={loading}
            disabled={featureType === 'enhancement' && !existingTestPlan}
          >
            {content 
              ? (featureType === 'new' ? 'Regenerate Test Plan' : 'Regenerate Enhanced Test Plan')
              : (featureType === 'new' ? 'Generate Test Plan' : 'Generate/Modify Test Plan')
            }
          </Button>
          <Divider type="vertical" />
          <Upload beforeUpload={handleFinalUpload} showUploadList={false} accept=".md,.txt,.docx">
            <Button icon={<UploadOutlined />}>Or Upload Final Test Plan</Button>
          </Upload>
        </Space>
      </Card>

      {newTestCases && newTestCases.length > 0 && (
        <Card 
          title="New Test Cases Generated" 
          extra={
            <Button 
              type="primary" 
              icon={<FileWordOutlined />}
              onClick={handleExportDocx}
              loading={exportingDocx}
            >
              Export to DOCX
            </Button>
          }
          style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#52c41a' }}
        >
          <Alert 
            message="New Test Cases Preview"
            description={`${newTestCases.length} new test case${newTestCases.length > 1 ? 's' : ''} generated. Review below and export to DOCX for documentation.`}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div style={{ 
            maxHeight: 600, 
            overflow: 'auto', 
            padding: '12px',
            background: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: '4px'
          }}>
            {newTestCases.map((testCase, index) => (
              <div 
                key={index} 
                style={{ 
                  marginBottom: index < newTestCases.length - 1 ? '24px' : '0',
                  paddingBottom: index < newTestCases.length - 1 ? '24px' : '0',
                  borderBottom: index < newTestCases.length - 1 ? '1px solid #f0f0f0' : 'none',
                  textAlign: 'left',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: '1.6'
                }}
              >
                {testCase}
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: '#666' }}>
              {featureType === 'new' 
                ? 'Generating comprehensive test plan...' 
                : 'Analyzing existing test plan and adding new test cases for enhancement...'}
            </p>
          </div>
        </Card>
      )}

      {content && (
        <>
          {/* ── Test Plan Viewer ─────────────────────────────────────────── */}
          <Card 
            title={featureType === 'new' ? 'Generated Test Plan' : 'Enhanced Test Plan (Existing + New Test Cases)'}
            extra={<Button size="small" onClick={() => setEditing(!editing)}>{editing ? 'Preview' : 'Edit'}</Button>}
            style={{ marginBottom: 16 }}
          >
            {editing
              ? <TextArea rows={20} value={content} onChange={e => setContent(e.target.value)} />
              : <pre style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, textAlign: 'left', margin: 0 }}>{content}</pre>
            }
          </Card>

          {/* ── Download ─────────────────────────────────────────────────── */}
          <Card title="Download Test Plan" style={{ marginBottom: 16 }}>
            <Space wrap>
              <Button icon={<DownloadOutlined />} onClick={() => handleDownloadTestPlan('md')} loading={downloading}>Download as Markdown</Button>
              <Button icon={<FileWordOutlined />} onClick={() => handleDownloadTestPlan('docx')} loading={downloading} type="primary">Download as Word (DOCX)</Button>
              <Button icon={<FileExcelOutlined />} onClick={() => handleDownloadTestPlan('xlsx')} loading={downloadingExcel} type="primary" style={{ background: '#217346', borderColor: '#217346' }}>Download as Excel (XLSX)</Button>
            </Space>
          </Card>

          {/* ── Review & Improve ─────────────────────────────────────────── */}
          <Card title="Review & Improve" style={{ marginBottom: 16 }}>
            <Alert
              message="Provide Review Comments"
              description="After reviewing the test plan, provide specific comments about what needs to be changed, improved, or added. The system will regenerate the test plan addressing your feedback."
              type="info" showIcon style={{ marginBottom: 12 }}
            />
            <TextArea
              rows={5}
              placeholder={`Enter your review comments here...\n\nExamples:\n- Add test cases for IPv6 scenarios\n- Include negative test cases for invalid VLAN IDs\n- Expand test coverage for failover scenarios`}
              value={reviewComments}
              onChange={e => setReviewComments(e.target.value)}
              style={{ marginBottom: 12, fontFamily: 'Monaco, monospace', fontSize: 13 }}
            />
            <Space>
              <Button
                type="primary"
                icon={<RobotOutlined />}
                onClick={handleRegenerateWithComments}
                loading={regenerating}
                disabled={!reviewComments || reviewComments.trim().length === 0}
              >
                Regenerate with Review Comments
              </Button>
              <Divider type="vertical" />
              <Upload beforeUpload={handleReviewedPlanUpload} showUploadList={false} accept=".md,.txt,.docx" disabled={!reviewComments || reviewComments.trim().length === 0}>
                <Button icon={<UploadOutlined />} disabled={!reviewComments || reviewComments.trim().length === 0}>Upload Reviewed Test Plan</Button>
              </Upload>
            </Space>
          </Card>

          {/* ── Gap Analysis ─────────────────────────────────────────────── */}
          <Card
            title={
              <Space>
                <SearchOutlined style={{ color: '#faad14' }} />
                <span>Gap Analysis</span>
                {gapAnalysis?.coverageScore != null && (
                  <Tag color={gapAnalysis.coverageScore >= 80 ? 'green' : gapAnalysis.coverageScore >= 60 ? 'orange' : 'red'}>
                    Coverage: {gapAnalysis.coverageScore}%
                  </Tag>
                )}
              </Space>
            }
            extra={
              <Button
                icon={<SearchOutlined />}
                onClick={handleGapAnalysis}
                loading={gapAnalyzing}
                type={gapAnalysis ? 'default' : 'primary'}
                style={!gapAnalysis ? { background: '#faad14', borderColor: '#faad14' } : {}}
              >
                {gapAnalysis ? 'Re-run Gap Analysis' : 'Run Gap Analysis'}
              </Button>
            }
            style={{ marginBottom: 16, borderColor: '#faad14', borderWidth: 2 }}
          >
            {!gapAnalysis && !gapAnalyzing && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#888' }}>
                <SearchOutlined style={{ fontSize: 32, color: '#faad14', marginBottom: 8 }} />
                <p style={{ margin: '8px 0 0' }}>Click <strong>Run Gap Analysis</strong> to compare the test plan against the skill file and identify missing scenarios, insufficient coverage, CLI gaps, and integration test gaps.</p>
              </div>
            )}

            {gapAnalyzing && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
                <p style={{ marginTop: 12, color: '#666' }}>Analyzing test plan coverage against skill file...</p>
              </div>
            )}

            {gapAnalysis && !gapAnalyzing && (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* Summary + score */}
                <Card size="small" style={{ background: '#fafafa' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                    <div style={{ flex: 1 }}>
                      <Typography.Text strong>Coverage Assessment</Typography.Text>
                      <p style={{ margin: '4px 0 0', color: '#555' }}>{gapAnalysis.summary}</p>
                    </div>
                    {gapAnalysis.coverageScore != null && (
                      <div style={{ textAlign: 'center', minWidth: 100 }}>
                        <Progress type="circle" percent={gapAnalysis.coverageScore} size={80}
                          strokeColor={gapAnalysis.coverageScore >= 80 ? '#52c41a' : gapAnalysis.coverageScore >= 60 ? '#faad14' : '#ff4d4f'} />
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Coverage Score</div>
                      </div>
                    )}
                  </Space>
                </Card>

                {gapAnalysis.missingScenarios?.length > 0 && (
                  <Card size="small" title={<Space><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /><span>Missing Scenarios ({gapAnalysis.missingScenarios.length})</span></Space>} style={{ borderColor: '#ffccc7' }}>
                    <List size="small" dataSource={gapAnalysis.missingScenarios} renderItem={item => (
                      <List.Item>
                        <Space align="start" style={{ width: '100%' }}>
                          <Tag color={item.priority === 'P1' ? 'red' : item.priority === 'P2' ? 'orange' : 'default'}>{item.priority || 'P2'}</Tag>
                          <div><Typography.Text strong>{item.title}</Typography.Text>{item.description && <div style={{ color: '#666', fontSize: 13 }}>{item.description}</div>}</div>
                        </Space>
                      </List.Item>
                    )} />
                  </Card>
                )}

                {gapAnalysis.insufficientCoverage?.length > 0 && (
                  <Card size="small" title={<Space><WarningOutlined style={{ color: '#faad14' }} /><span>Insufficient Coverage ({gapAnalysis.insufficientCoverage.length})</span></Space>} style={{ borderColor: '#ffe58f' }}>
                    <List size="small" dataSource={gapAnalysis.insufficientCoverage} renderItem={item => (
                      <List.Item>
                        <div>
                          <Typography.Text code>{item.tcRef}</Typography.Text>
                          <span style={{ marginLeft: 8, color: '#666' }}>{item.gap}</span>
                          {item.suggestion && <div style={{ color: '#1890ff', fontSize: 12, marginTop: 2 }}>💡 {item.suggestion}</div>}
                        </div>
                      </List.Item>
                    )} />
                  </Card>
                )}

                {gapAnalysis.integrationGaps?.length > 0 && (
                  <Card size="small" title={<Space><ExclamationCircleOutlined style={{ color: '#722ed1' }} /><span>Integration Gaps ({gapAnalysis.integrationGaps.length})</span></Space>} style={{ borderColor: '#d3adf7' }}>
                    <List size="small" dataSource={gapAnalysis.integrationGaps} renderItem={item => (
                      <List.Item><Space><Tag color="purple">{item.feature}</Tag><span style={{ color: '#555' }}>{item.gap}</span></Space></List.Item>
                    )} />
                  </Card>
                )}

                {gapAnalysis.cliGaps?.length > 0 && (
                  <Card size="small" title={<Space><ExclamationCircleOutlined style={{ color: '#13c2c2' }} /><span>CLI Coverage Gaps ({gapAnalysis.cliGaps.length})</span></Space>} style={{ borderColor: '#87e8de' }}>
                    <List size="small" dataSource={gapAnalysis.cliGaps} renderItem={item => (
                      <List.Item><div><Typography.Text code style={{ fontSize: 12 }}>{item.command}</Typography.Text><span style={{ marginLeft: 8, color: '#666', fontSize: 13 }}>{item.gap}</span></div></List.Item>
                    )} />
                  </Card>
                )}

                {gapAnalysis.recommendations?.length > 0 && (
                  <Card size="small" title={<Space><BulbOutlined style={{ color: '#52c41a' }} /><span>Recommended New Test Cases ({gapAnalysis.recommendations.length})</span></Space>} style={{ borderColor: '#b7eb8f' }}>
                    <List size="small" dataSource={gapAnalysis.recommendations} renderItem={item => (
                      <List.Item>
                        <Space align="start">
                          <Tag color={item.priority === 'P1' ? 'red' : item.priority === 'P2' ? 'orange' : 'default'}>{item.priority || 'P2'}</Tag>
                          <div><Typography.Text strong>{item.title}</Typography.Text>{item.description && <div style={{ color: '#555', fontSize: 13 }}>{item.description}</div>}</div>
                        </Space>
                      </List.Item>
                    )} />
                  </Card>
                )}

                {/* Additional inputs + Regenerate from Gap */}
                <Card size="small" title={<Space><EditOutlined />Additional Requirements for Regeneration</Space>} style={{ borderColor: '#1890ff', borderWidth: 2 }}>
                  <Input.TextArea
                    rows={3}
                    placeholder="Add any extra requirements or instructions beyond the gap analysis above..."
                    value={gapNotes}
                    onChange={e => setGapNotes(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                  <Button
                    type="primary"
                    icon={<RobotOutlined />}
                    onClick={handleRegenerateFromGap}
                    loading={regenerating}
                    size="large"
                    style={{ background: '#389e0d', borderColor: '#389e0d' }}
                  >
                    Regenerate Test Plan from Gap Analysis
                  </Button>
                </Card>
              </Space>
            )}
          </Card>

          {/* ── Evaluate Quality ─────────────────────────────────────────── */}
          <Card
            title={
              <Space>
                <SafetyOutlined style={{ color: evaluation ? (evaluation.passed ? '#52c41a' : '#ff4d4f') : '#1890ff' }} />
                <span>Evaluate Quality</span>
                {evaluation && (
                  <Tag color={evaluation.passed ? 'success' : 'error'}>{evaluation.grade} — {evaluation.score}/100</Tag>
                )}
              </Space>
            }
            extra={
              <Button
                type="primary"
                icon={<SafetyOutlined />}
                onClick={handleEvaluate}
                loading={evaluating}
                style={evaluation?.passed ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
              >
                {evaluation ? 'Re-evaluate' : 'Evaluate Quality'}
              </Button>
            }
            style={{ marginBottom: 16, borderColor: evaluation ? (evaluation.passed ? '#52c41a' : '#ff4d4f') : '#1890ff', borderWidth: 2 }}
          >
            {!evaluation && (
              <p style={{ color: '#888', margin: 0 }}>Run the quality check to verify the test plan meets standards (score ≥ 60) before approving. Evaluate after any regeneration or gap analysis.</p>
            )}
            {evaluation && !evaluation.passed && (
              <Alert
                message="Quality check did not pass — review and improve"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {(evaluation.criticalFailures || []).map((f, i) => <li key={i}>{f}</li>)}
                    {(evaluation.improvements || []).slice(0, 3).map((imp, i) => <li key={`imp-${i}`}>[{imp.area}] {imp.issue}</li>)}
                  </ul>
                }
                type="error" showIcon
              />
            )}
            {evaluation && evaluation.passed && (
              <Alert message={`Quality check passed — Grade ${evaluation.grade} (${evaluation.score}/100). You can now approve.`} type="success" showIcon />
            )}
          </Card>
        </>
      )}

      {content && (
        <Tabs
          defaultActiveKey="test-plan"
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'test-plan',
              label: 'Review & Download',
              children: (
                <>
          {/* Download Test Plan Section */}
          <Card 
            title="Download Test Plan" 
            style={{ marginBottom: 16 }}
          >
            <Alert 
              message="Download for Offline Review" 
              description="Download the test plan in your preferred format. Excel (XLSX) exports all test cases in qTest-compatible format (Project, Test Suite Path, Test Case Title, Preconditions, Step Actions, Expected Results, Priority)."
              type="info" 
              showIcon 
              style={{ marginBottom: 12 }} 
            />
            <Space wrap>
              <Button 
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadTestPlan('md')}
                loading={downloading}
              >
                Download as Markdown
              </Button>
              <Button 
                icon={<FileWordOutlined />}
                onClick={() => handleDownloadTestPlan('docx')}
                loading={downloading}
                type="primary"
              >
                Download as Word (DOCX)
              </Button>
              <Button 
                icon={<FileExcelOutlined />}
                onClick={() => handleDownloadTestPlan('xlsx')}
                loading={downloadingExcel}
                type="primary"
                style={{ background: '#217346', borderColor: '#217346' }}
              >
                Download as Excel (XLSX)
              </Button>
            </Space>
          </Card>

          {/* Review Comments and Regeneration Section */}
          <Card 
            title="Review & Improve" 
            style={{ marginBottom: 16 }}
          >
            <Alert 
              message="Provide Review Comments" 
              description="After reviewing the test plan, provide specific comments about what needs to be changed, improved, or added. The system will regenerate the test plan addressing your feedback."
              type="info" 
              showIcon 
              style={{ marginBottom: 12 }} 
            />
            <TextArea 
              rows={6}
              placeholder="Enter your review comments here...

Examples:
- Add test cases for IPv6 scenarios
- Include negative test cases for invalid VLAN IDs
- Expand test coverage for failover scenarios
- Clarify expected results in Test Case 5
- Add verification steps for counter validation"
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              style={{ marginBottom: 12, fontFamily: 'Monaco, monospace', fontSize: 13 }}
            />
            <Space>
              <Button 
                type="primary"
                icon={<RobotOutlined />}
                onClick={handleRegenerateWithComments}
                loading={regenerating}
                disabled={!reviewComments || reviewComments.trim().length === 0}
              >
                Regenerate with Review Comments
              </Button>
              <Divider type="vertical" />
              <Upload 
                beforeUpload={handleReviewedPlanUpload} 
                showUploadList={false} 
                accept=".md,.txt,.docx"
                disabled={!reviewComments || reviewComments.trim().length === 0}
              >
                <Button 
                  icon={<UploadOutlined />}
                  disabled={!reviewComments || reviewComments.trim().length === 0}
                >
                  Upload Reviewed Test Plan
                </Button>
              </Upload>
            </Space>
            {(!reviewComments || reviewComments.trim().length === 0) && (
              <Alert 
                message="Review comments required"
                description="Please provide review comments before regenerating or uploading a reviewed test plan."
                type="warning" 
                showIcon 
                style={{ marginTop: 12 }} 
              />
            )}
          </Card>
                </>
              )
            },
            {
              key: 'gap-analysis',
              label: (
                <span>
                  <SearchOutlined /> Gap Analysis
                  {gapAnalysis && gapAnalysis.coverageScore != null && (
                    <Tag
                      color={gapAnalysis.coverageScore >= 80 ? 'green' : gapAnalysis.coverageScore >= 60 ? 'orange' : 'red'}
                      style={{ marginLeft: 8 }}
                    >
                      {gapAnalysis.coverageScore}%
                    </Tag>
                  )}
                </span>
              ),
              children: (
                <div>
                  {!gapAnalysis && !gapAnalyzing && (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <SearchOutlined style={{ fontSize: 40, color: '#faad14', marginBottom: 16 }} />
                      <Typography.Title level={4} style={{ color: '#555' }}>AI-Powered Gap Analysis</Typography.Title>
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                        Compare the test plan against the skill file to identify missing scenarios, insufficient coverage, CLI gaps, and integration test gaps.
                      </Typography.Text>
                      <Button type="primary" icon={<SearchOutlined />} onClick={handleGapAnalysis} loading={gapAnalyzing} size="large" style={{ background: '#faad14', borderColor: '#faad14' }}>
                        Run Gap Analysis
                      </Button>
                    </div>
                  )}

                  {gapAnalyzing && (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                      <Spin size="large" />
                      <p style={{ marginTop: 16, color: '#666' }}>Analyzing test plan coverage against skill file...</p>
                    </div>
                  )}

                  {gapAnalysis && !gapAnalyzing && (
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      {/* Summary + score */}
                      <Card size="small" style={{ background: '#fafafa' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                          <div style={{ flex: 1 }}>
                            <Typography.Text strong>Coverage Assessment</Typography.Text>
                            <p style={{ margin: '4px 0 0', color: '#555' }}>{gapAnalysis.summary}</p>
                          </div>
                          {gapAnalysis.coverageScore != null && (
                            <div style={{ textAlign: 'center', minWidth: 100 }}>
                              <Progress
                                type="circle"
                                percent={gapAnalysis.coverageScore}
                                size={80}
                                strokeColor={gapAnalysis.coverageScore >= 80 ? '#52c41a' : gapAnalysis.coverageScore >= 60 ? '#faad14' : '#ff4d4f'}
                              />
                              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Coverage Score</div>
                            </div>
                          )}
                        </Space>
                      </Card>

                      {/* Missing Scenarios */}
                      {gapAnalysis.missingScenarios?.length > 0 && (
                        <Card
                          size="small"
                          title={<Space><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /><span>Missing Scenarios ({gapAnalysis.missingScenarios.length})</span></Space>}
                          style={{ borderColor: '#ffccc7' }}
                        >
                          <List
                            size="small"
                            dataSource={gapAnalysis.missingScenarios}
                            renderItem={item => (
                              <List.Item>
                                <Space align="start" style={{ width: '100%' }}>
                                  <Tag color={item.priority === 'P1' ? 'red' : item.priority === 'P2' ? 'orange' : 'default'}>{item.priority || 'P2'}</Tag>
                                  <div>
                                    <Typography.Text strong>{item.title}</Typography.Text>
                                    {item.description && <div style={{ color: '#666', fontSize: 13 }}>{item.description}</div>}
                                  </div>
                                </Space>
                              </List.Item>
                            )}
                          />
                        </Card>
                      )}

                      {/* Insufficient Coverage */}
                      {gapAnalysis.insufficientCoverage?.length > 0 && (
                        <Card
                          size="small"
                          title={<Space><WarningOutlined style={{ color: '#faad14' }} /><span>Insufficient Coverage ({gapAnalysis.insufficientCoverage.length})</span></Space>}
                          style={{ borderColor: '#ffe58f' }}
                        >
                          <List
                            size="small"
                            dataSource={gapAnalysis.insufficientCoverage}
                            renderItem={item => (
                              <List.Item>
                                <div>
                                  <Typography.Text code>{item.tcRef}</Typography.Text>
                                  <span style={{ marginLeft: 8, color: '#666' }}>{item.gap}</span>
                                  {item.suggestion && <div style={{ color: '#1890ff', fontSize: 12, marginTop: 2 }}>💡 {item.suggestion}</div>}
                                </div>
                              </List.Item>
                            )}
                          />
                        </Card>
                      )}

                      {/* Integration Gaps */}
                      {gapAnalysis.integrationGaps?.length > 0 && (
                        <Card
                          size="small"
                          title={<Space><ExclamationCircleOutlined style={{ color: '#722ed1' }} /><span>Integration Gaps ({gapAnalysis.integrationGaps.length})</span></Space>}
                          style={{ borderColor: '#d3adf7' }}
                        >
                          <List
                            size="small"
                            dataSource={gapAnalysis.integrationGaps}
                            renderItem={item => (
                              <List.Item>
                                <Space>
                                  <Tag color="purple">{item.feature}</Tag>
                                  <span style={{ color: '#555' }}>{item.gap}</span>
                                </Space>
                              </List.Item>
                            )}
                          />
                        </Card>
                      )}

                      {/* CLI Gaps */}
                      {gapAnalysis.cliGaps?.length > 0 && (
                        <Card
                          size="small"
                          title={<Space><ExclamationCircleOutlined style={{ color: '#13c2c2' }} /><span>CLI Coverage Gaps ({gapAnalysis.cliGaps.length})</span></Space>}
                          style={{ borderColor: '#87e8de' }}
                        >
                          <List
                            size="small"
                            dataSource={gapAnalysis.cliGaps}
                            renderItem={item => (
                              <List.Item>
                                <div>
                                  <Typography.Text code style={{ fontSize: 12 }}>{item.command}</Typography.Text>
                                  <span style={{ marginLeft: 8, color: '#666', fontSize: 13 }}>{item.gap}</span>
                                </div>
                              </List.Item>
                            )}
                          />
                        </Card>
                      )}

                      {/* Recommendations */}
                      {gapAnalysis.recommendations?.length > 0 && (
                        <Card
                          size="small"
                          title={<Space><BulbOutlined style={{ color: '#52c41a' }} /><span>Recommended New Test Cases ({gapAnalysis.recommendations.length})</span></Space>}
                          style={{ borderColor: '#b7eb8f' }}
                        >
                          <List
                            size="small"
                            dataSource={gapAnalysis.recommendations}
                            renderItem={item => (
                              <List.Item>
                                <Space align="start">
                                  <Tag color={item.priority === 'P1' ? 'red' : item.priority === 'P2' ? 'orange' : 'default'}>{item.priority || 'P2'}</Tag>
                                  <div>
                                    <Typography.Text strong>{item.title}</Typography.Text>
                                    {item.description && <div style={{ color: '#555', fontSize: 13 }}>{item.description}</div>}
                                  </div>
                                </Space>
                              </List.Item>
                            )}
                          />
                        </Card>
                      )}

                      {/* Analyst notes + Regenerate */}
                      <Card 
                        size="small" 
                        title={<Space><EditOutlined />Additional Requirements for Regeneration</Space>}
                        style={{ borderColor: '#1890ff', borderWidth: 2 }}
                      >
                        <Alert
                          message="Ready to regenerate based on gap findings above"
                          description="Add any extra requirements below, then click Regenerate. Gap analysis findings will be automatically included as review instructions."
                          type="info"
                          showIcon
                          style={{ marginBottom: 12 }}
                        />
                        <Input.TextArea
                          rows={4}
                          placeholder="Add any additional requirements, special edge cases, or further instructions beyond the gap analysis above..."
                          value={gapNotes}
                          onChange={e => setGapNotes(e.target.value)}
                          style={{ marginBottom: 12 }}
                        />
                        <Space>
                          <Button
                            type="primary"
                            icon={<RobotOutlined />}
                            onClick={handleRegenerateFromGap}
                            loading={regenerating}
                            size="large"
                            style={{ background: '#389e0d', borderColor: '#389e0d' }}
                          >
                            Regenerate Test Plan from Gap Analysis
                          </Button>
                          <Button icon={<SearchOutlined />} onClick={handleGapAnalysis} loading={gapAnalyzing}>
                            Re-run Analysis
                          </Button>
                        </Space>
                      </Card>
                    </Space>
                  )}
                </div>
              )
            }
          ]}
        />
      )}

      {evaluation && <TestPlanEvaluationDisplay evaluation={evaluation} />}

      {/* ── Evaluate Quality Section ──────────────────────────────────────── */}
      {content && (
        <Card
          style={{
            marginBottom: 16,
            borderColor: evaluation ? (evaluation.passed ? '#52c41a' : '#ff4d4f') : '#1890ff',
            borderWidth: 2
          }}
          title={
            <Space>
              <SafetyOutlined style={{ color: evaluation ? (evaluation.passed ? '#52c41a' : '#ff4d4f') : '#1890ff' }} />
              <span>Step 3: Evaluate Quality</span>
              {evaluation && (
                <Tag color={evaluation.passed ? 'success' : 'error'} style={{ marginLeft: 8 }}>
                  {evaluation.grade} — {evaluation.score}/100
                </Tag>
              )}
            </Space>
          }
        >
          {!evaluation && (
            <Alert
              message="Evaluate before approving"
              description="Run the quality evaluation to check if the test plan meets the required standards (score ≥ 60). After gap analysis and any regeneration, evaluate the final test plan."
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}
          {evaluation && !evaluation.passed && (
            <Alert
              message="Quality check did not pass — review and improve"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {(evaluation.criticalFailures || []).map((f, i) => <li key={i}>{f}</li>)}
                  {(evaluation.improvements || []).slice(0, 3).map((imp, i) => <li key={`imp-${i}`}>[{imp.area}] {imp.issue}</li>)}
                </ul>
              }
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}
          {evaluation && evaluation.passed && (
            <Alert
              message={`Quality check passed — Grade ${evaluation.grade} (${evaluation.score}/100)`}
              description="Test plan meets minimum quality standards. You can now approve it."
              type="success"
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}
          <Space>
            <Button
              type="primary"
              icon={<SafetyOutlined />}
              onClick={handleEvaluate}
              loading={evaluating}
              size="large"
              style={evaluation?.passed ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
            >
              {evaluation ? 'Re-evaluate Quality' : 'Evaluate Quality'}
            </Button>
            {!evaluation && (
              <Button
                icon={<SearchOutlined />}
                onClick={() => setActiveTab('gap-analysis')}
              >
                Run Gap Analysis First
              </Button>
            )}
          </Space>
        </Card>
      )}
      
      <ApprovalPanel 
        onApprove={handleApprove} 
        onRegenerate={handleGenerate} 
        disabled={!content} 
        showRegenerate 
        approvalNote="User approval mandatory. Approve the test plan to proceed to next stage." 
      />
      
      {/* Chat Assistant Panel - Always Available */}
      <ChatPanel
        workflowId={workflow?.id}
        stageNumber={3}
        context={{
          jira_story_id: workflow?.jira_story_id,
          jira_release: workflow?.jira_release,
          title: workflow?.title,
          feature_type: featureType,
          test_plan_info: testPlanInfo,
          existing_test_plan: existingTestPlan
        }}
        onRequirementsExtracted={handleRequirementsExtracted}
        onClose={() => {}}
      />

      {/* ── Chat Summary Modal (pops up immediately on chat complete) ──────── */}
      <Modal
        open={!!chatSummary}
        title={<span style={{ color: '#389e0d' }}>✅ Chat Summary — Review Before Generating</span>}
        onCancel={() => setChatSummary(null)}
        width={680}
        footer={[
          <Button key="dismiss" onClick={() => setChatSummary(null)}>Edit Manually</Button>,
          <Button
            key="generate"
            type="primary"
            icon={<RobotOutlined />}
            loading={loading}
            onClick={() => { setChatSummary(null); handleGenerate(); }}
            style={{ background: '#389e0d', borderColor: '#389e0d' }}
          >
            {content ? 'Regenerate Test Plan with Chat Input' : 'Generate Test Plan Now'}
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Alert
            type="success"
            showIcon
            message="Requirements captured from your chat session. Review below then click Generate."
            style={{ marginBottom: 8 }}
          />
          {chatSummary && Object.entries(chatSummary)
            .filter(([, v]) => v && (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.length > 0 : false))
            .map(([key, val]) => (
              <div key={key} style={{ background: '#f6ffed', padding: '8px 12px', borderRadius: 6, border: '1px solid #d9f7be' }}>
                <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {key.replace(/_/g, ' ')}
                </Typography.Text>
                {Array.isArray(val) ? (
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 18, fontSize: 13 }}>
                    {val.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                ) : (
                  <div style={{ marginTop: 3, whiteSpace: 'pre-wrap', fontSize: 13 }}>{val}</div>
                )}
              </div>
            ))
          }
          {chatSummary && Object.values(chatSummary).every(v => !v || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) && (
            <Alert type="warning" showIcon message="No structured data was captured, but the full chat context will still guide test plan generation." />
          )}
        </Space>
      </Modal>
    </div>
  );
}
