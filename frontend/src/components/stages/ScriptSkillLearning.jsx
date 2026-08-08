import React, { useState, useEffect } from 'react';
import {
  Modal, Button, List, Typography, Space, message, Spin, Card, Tag, 
  Collapse, Descriptions, Alert, Steps, Input
} from 'antd';
import {
  FolderOpenOutlined, ExperimentOutlined, FileTextOutlined,
  BulbOutlined, ThunderboltOutlined, CheckCircleOutlined,
  ArrowRightOutlined, SearchOutlined
} from '@ant-design/icons';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { Step } = Steps;
const { TextArea } = Input;

/**
 * ScriptSkillLearning Component
 * Allows users to:
 * 1. Browse existing automation functional areas
 * 2. Analyze a selected area to learn patterns/procs
 * 3. Generate a "script skill file"
 * 4. Generate sanity test cases first
 * 5. Review sanity scripts
 * 6. Generate remaining scripts with learned patterns
 */
export default function ScriptSkillLearning({ visible, onClose, workflowId, onScriptsGenerated }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [areas, setAreas] = useState([]);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [generatingSkill, setGeneratingSkill] = useState(false);
  const [skillFile, setSkillFile] = useState(null);
  const [generatingSanity, setGeneratingSanity] = useState(false);
  const [sanityResults, setSanityResults] = useState(null);
  const [sanityFeedback, setSanityFeedback] = useState('');
  const [generatingRemaining, setGeneratingRemaining] = useState(false);

  useEffect(() => {
    if (visible) {
      loadAutomationAreas();
    }
  }, [visible]);

  const loadAutomationAreas = async () => {
    try {
      const { data } = await axios.get(`${API}/stage7/automation-areas`);
      setAreas(data.areas || []);
    } catch (err) {
      message.error('Failed to load automation areas: ' + err.message);
    }
  };

  const handleToggleArea = (area) => {
    setSelectedAreas(prev => {
      const exists = prev.find(a => a.name === area.name);
      if (exists) {
        return prev.filter(a => a.name !== area.name);
      } else {
        return [...prev, area];
      }
    });
  };

  const handleSelectAll = () => {
    const filtered = areas.filter(area => 
      area.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSelectedAreas(filtered);
  };

  const handleClearSelection = () => {
    setSelectedAreas([]);
  };

  const handleAnalyzeAreas = async () => {
    if (selectedAreas.length === 0) {
      message.warning('Please select at least one automation area');
      return;
    }
    
    setAnalyzing(true);
    try {
      const areaNames = selectedAreas.map(a => a.name);
      const { data } = await axios.post(`${API}/stage7/analyze-areas`, {
        area_names: areaNames
      });
      setAnalysis(data.combined);
      setCurrentStep(2);
      message.success(`Analyzed ${selectedAreas.length} areas: Found ${data.combined.totalProcedures} procedures`);
    } catch (err) {
      message.error('Analysis failed: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateSkillFile = async () => {
    if (selectedAreas.length === 0 && !analysis) return;
    
    setGeneratingSkill(true);
    try {
      const areaNames = selectedAreas.map(a => a.name).join('+');
      const { data } = await axios.post(`${API}/stage7/generate-skill-file`, {
        workflow_id: workflowId,
        area_name: areaNames
      });
      
      setSkillFile(data.skillFile);
      setCurrentStep(3); // Move to sanity script generation step
      message.success('Script skill file generated! Now generate sanity scripts...');
      
    } catch (err) {
      message.error('Failed to generate skill file: ' + err.message);
    } finally {
      setGeneratingSkill(false);
    }
  };

  const handleGenerateSanityScripts = async () => {
    if (!skillFile) return;
    
    setGeneratingSanity(true);
    try {
      const { data } = await axios.post(`${API}/stage7/generate-sanity-scripts`, {
        workflow_id: workflowId,
        skill_file_id: skillFile.docId
      });
      setSanityResults(data);
      setCurrentStep(4);
      message.success(data.message);
      if (onScriptsGenerated) onScriptsGenerated();
    } catch (err) {
      message.error('Failed to generate sanity scripts: ' + err.message);
    } finally {
      setGeneratingSanity(false);
    }
  };

  const handleGenerateRemainingScripts = async () => {
    if (!skillFile) return;
    
    setGeneratingRemaining(true);
    try {
      const { data } = await axios.post(`${API}/stage7/generate-remaining-scripts`, {
        workflow_id: workflowId,
        skill_file_id: skillFile.docId,
        sanity_feedback: sanityFeedback.trim() || null
      });
      message.success(data.message);
      setCurrentStep(5);
      if (onScriptsGenerated) onScriptsGenerated();
      setTimeout(() => {
        onClose();
        // Reset state for next time
        setCurrentStep(0);
        setSelectedAreas([]);
        setSearchTerm('');
        setAnalysis(null);
        setSkillFile(null);
        setSanityResults(null);
        setSanityFeedback('');
      }, 2000);
    } catch (err) {
      message.error('Failed to generate remaining scripts: ' + err.message);
    } finally {
      setGeneratingRemaining(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setSelectedAreas([]);
    setSearchTerm('');
    setAnalysis(null);
    setSkillFile(null);
    setSanityResults(null);
    setSanityFeedback('');
  };

  return (
    <Modal
      title={
        <Space>
          <BulbOutlined style={{ color: '#faad14' }} />
          <span>Learn from Existing Automation</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
    >
      <Alert
        message="Smart Script Generation Workflow"
        description="This feature learns from existing automation patterns, generates sanity test scripts first for validation, then creates remaining scripts based on your review feedback."
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
      />

      <Steps current={currentStep} style={{ marginBottom: 30 }}>
        <Step title="Select Area" icon={<FolderOpenOutlined />} />
        <Step title="Analyze" icon={<ExperimentOutlined />} />
        <Step title="Generate Skill" icon={<FileTextOutlined />} />
        <Step title="Sanity Scripts" icon={<ThunderboltOutlined />} />
        <Step title="Review & Generate All" icon={<CheckCircleOutlined />} />
      </Steps>

      {/* Step 0: Select Functional Area(s) */}
      {currentStep === 0 && (
        <div>
          <Title level={4}>
            <FolderOpenOutlined /> Select Automation Functional Areas
          </Title>
          <Paragraph type="secondary">
            Search and select multiple functional test areas to learn automation patterns from:
          </Paragraph>
          
          {areas.length === 0 ? (
            <Spin tip="Loading automation areas..." />
          ) : (
            <>
              <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                <Input
                  placeholder="Search folders... (e.g., ACL, IPv6, VLAN)"
                  prefix={<SearchOutlined />}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="large"
                />
                <Space>
                  <Tag color="blue">{selectedAreas.length} selected</Tag>
                  <Tag>{areas.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase())).length} shown / {areas.length} total</Tag>
                  <Button size="small" onClick={handleSelectAll}>
                    Select All Shown
                  </Button>
                  <Button size="small" onClick={handleClearSelection}>
                    Clear Selection
                  </Button>
                  <Button 
                    type="primary" 
                    icon={<ExperimentOutlined />}
                    onClick={handleAnalyzeAreas}
                    disabled={selectedAreas.length === 0}
                    loading={analyzing}
                  >
                    Analyze Selected ({selectedAreas.length})
                  </Button>
                </Space>
              </Space>
              
              <List
                bordered
                dataSource={areas.filter(area => 
                  area.name.toLowerCase().includes(searchTerm.toLowerCase())
                )}
                style={{ maxHeight: 400, overflow: 'auto' }}
                renderItem={(area) => {
                  const isSelected = selectedAreas.find(a => a.name === area.name);
                  return (
                    <List.Item
                      onClick={() => handleToggleArea(area)}
                      style={{ 
                        cursor: 'pointer', 
                        transition: 'background 0.2s',
                        background: isSelected ? '#e6f7ff' : 'white'
                      }}
                      onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = '#f0f5ff')}
                      onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'white')}
                    >
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          <input 
                            type="checkbox" 
                            checked={!!isSelected}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <FolderOpenOutlined style={{ fontSize: 18, color: isSelected ? '#1890ff' : '#8c8c8c' }} />
                          <Text strong={isSelected}>{area.name}</Text>
                        </Space>
                        {area.fileCount !== undefined && (
                          <Tag color={isSelected ? 'blue' : 'default'}>
                            {area.fileCount} TCL files
                          </Tag>
                        )}
                      </Space>
                    </List.Item>
                  );
                }}
              />
            </>
          )}
        </div>
      )}

      {/* Step 1: Show Analysis Results */}
      {currentStep === 1 && (
        <div>
          <Title level={4}>
            <ExperimentOutlined /> Analyze: {selectedAreas.map(a => a.name).join(', ')}
          </Title>
          <Paragraph type="secondary">
            Click analyze to scan existing scripts, extract procedures, and identify patterns.
          </Paragraph>
          
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              type="primary"
              icon={<ExperimentOutlined />}
              onClick={handleAnalyzeAreas}
              loading={analyzing}
              size="large"
            >
              {analyzing ? 'Analyzing...' : 'Analyze Functional Areas'}
            </Button>
            
            <Button onClick={() => setCurrentStep(0)}>
              ← Back to Area Selection
            </Button>
          </Space>
        </div>
      )}

      {/* Step 2: View Analysis & Generate Skill File */}
      {currentStep === 2 && analysis && (
        <div>
          <Title level={4}>
            <FileTextOutlined /> Analysis Results
          </Title>
          
          <Card style={{ marginBottom: 20 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Area">{analysis.areaName}</Descriptions.Item>
              <Descriptions.Item label="Library Files">{analysis.libFilesCount}</Descriptions.Item>
              <Descriptions.Item label="Test Scripts">{analysis.testScriptsCount}</Descriptions.Item>
              <Descriptions.Item label="Procedures Found">{analysis.proceduresCount}</Descriptions.Item>
              <Descriptions.Item label="Dependencies">{analysis.dependenciesCount}</Descriptions.Item>
              <Descriptions.Item label="Patterns">{analysis.patternsCount}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Collapse defaultActiveKey={['1']} style={{ marginBottom: 20 }}>
            <Panel header={`Library Files (${analysis.libFilesCount})`} key="1">
              <List
                size="small"
                dataSource={analysis.libFiles}
                renderItem={(file) => <List.Item>{file}</List.Item>}
              />
            </Panel>
            
            <Panel header={`Procedures (showing first 20 of ${analysis.proceduresCount})`} key="2">
              <List
                size="small"
                dataSource={analysis.procedures}
                renderItem={(proc) => (
                  <List.Item>
                    <Text code>{proc.signature}</Text>
                    <Tag color="green">{proc.sourceFile}</Tag>
                  </List.Item>
                )}
              />
            </Panel>
            
            <Panel header={`Common Patterns (${analysis.patternsCount})`} key="3">
              <List
                size="small"
                dataSource={analysis.patterns}
                renderItem={(pattern) => (
                  <List.Item>
                    <Tag color="blue">{pattern.type}</Tag>
                    <Text>{pattern.pattern}</Text>
                  </List.Item>
                )}
              />
            </Panel>
          </Collapse>

          <Space>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={handleGenerateSkillFile}
              loading={generatingSkill}
              size="large"
            >
              Generate Script Skill File
            </Button>
            
            <Button onClick={() => setCurrentStep(1)}>
              ← Back
            </Button>
          </Space>
        </div>
      )}

      {/* Step 3: Skill File Generated - Generate Sanity Scripts */}
      {currentStep === 3 && skillFile && (
        <div>
          <Title level={4}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} /> Skill File Generated
          </Title>
          
          <Card style={{ marginBottom: 20, background: '#f6ffed', borderColor: '#b7eb8f' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Skill File: {skillFile.filename}</Text>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Procedures">{skillFile.proceduresCount}</Descriptions.Item>
                <Descriptions.Item label="Patterns">{skillFile.patternsCount}</Descriptions.Item>
              </Descriptions>
            </Space>
          </Card>

          <Alert
            message="Next: Generate Sanity Test Cases"
            description="We'll first generate a few sanity/basic test scripts. You can run these, review them, and provide feedback before generating all remaining scripts."
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />

          <Space>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleGenerateSanityScripts}
              loading={generatingSanity}
              size="large"
            >
              {generatingSanity ? 'Generating Sanity Scripts...' : 'Generate Sanity Test Scripts'}
            </Button>
            
            <Button onClick={() => setCurrentStep(2)}>
              ← Back
            </Button>
          </Space>
        </div>
      )}

      {/* Step 4: Sanity Scripts Generated - Provide Feedback */}
      {currentStep === 4 && sanityResults && (
        <div>
          <Title level={4}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} /> Sanity Scripts Generated
          </Title>
          
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>{sanityResults.message}</Paragraph>
            
            <List
              size="small"
              dataSource={sanityResults.generated}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    {item.status === 'success' ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <Tag color="red">Failed</Tag>
                    )}
                    <Text strong>TC {item.tc_number}</Text>
                    <Text type="secondary">{item.filename}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>

          <Alert
            message="Review & Provide Feedback"
            description="Run these sanity scripts and review them. Provide feedback below on what needs to be improved. This feedback will be used to generate better scripts for all remaining test cases."
            type="warning"
            showIcon
            style={{ marginBottom: 20 }}
          />

          <Card title="Review Feedback (Optional)" style={{ marginBottom: 20 }}>
            <TextArea
              rows={6}
              value={sanityFeedback}
              onChange={(e) => setSanityFeedback(e.target.value)}
              placeholder="Example:&#10;- Use more descriptive result_h2 messages&#10;- Add more verification steps after configuration&#10;- Include proper cleanup in all test cases&#10;- Use specific CheckKeyValue patterns from lib files"
            />
          </Card>

          <Space>
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              onClick={handleGenerateRemainingScripts}
              loading={generatingRemaining}
              size="large"
            >
              {generatingRemaining ? 'Generating All Scripts...' : 'Generate All Remaining Scripts'}
            </Button>
            
            <Button onClick={handleReset} disabled={generatingRemaining}>
              Start Over
            </Button>
          </Space>
        </div>
      )}

      {/* Step 5: All Done */}
      {currentStep === 5 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
          <Title level={3}>All Scripts Generated!</Title>
          <Paragraph>
            All test scripts have been generated using learned patterns and your feedback.
            Close this window to review them.
          </Paragraph>
          <Button type="primary" onClick={onClose} size="large">
            Close & Review Scripts
          </Button>
        </div>
      )}
    </Modal>
  );
}
