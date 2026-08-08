import React, { useState } from 'react';
import { Steps, Card, Form, Input, Select, Button, Space, Row, Col, Divider, InputNumber, Switch, Tag, Tooltip, Alert } from 'antd';
import { 
  FileTextOutlined, 
  DeploymentUnitOutlined, 
  SettingOutlined, 
  FunctionOutlined, 
  ThunderboltOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  RightOutlined,
  LeftOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

export default function TestPlanQuestionnaire({ onComplete, initialData = {} }) {
  const [current, setCurrent] = useState(0);
  const [form] = Form.useForm();
  const [formData, setFormData] = useState(initialData);

  const steps = [
    {
      title: 'Basic Info',
      icon: <FileTextOutlined />,
      description: 'Jira & Feature Details'
    },
    {
      title: 'Topology',
      icon: <DeploymentUnitOutlined />,
      description: 'Devices & Connections'
    },
    {
      title: 'Technical Specs',
      icon: <SettingOutlined />,
      description: 'VLANs, NSI, Parameters'
    },
    {
      title: 'Behaviors',
      icon: <FunctionOutlined />,
      description: 'Feature Test Scenarios'
    },
    {
      title: 'Preferences',
      icon: <ThunderboltOutlined />,
      description: 'Options & Settings'
    }
  ];

  const next = async () => {
    try {
      const values = await form.validateFields();
      setFormData({ ...formData, ...values });
      setCurrent(current + 1);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const prev = () => {
    setCurrent(current - 1);
  };

  const handleComplete = async () => {
    try {
      const values = await form.validateFields();
      const completeData = { ...formData, ...values };
      onComplete(completeData);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Section 1: Basic Information
  const renderBasicInfo = () => (
    <div>
      <Alert
        message="Basic Feature Information"
        description="This information will be used to fetch Jira details and structure your test plan."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form.Item
        label="Jira Ticket ID"
        name="jiraId"
        rules={[{ required: true, message: 'Please enter Jira ticket ID' }]}
        extra="e.g., EXOS-39334"
      >
        <Input placeholder="EXOS-XXXXX" prefix={<FileTextOutlined />} />
      </Form.Item>

      <Form.Item
        label="Feature Name"
        name="featureName"
        rules={[{ required: true, message: 'Please enter feature name' }]}
      >
        <Input placeholder="Brief feature description" />
      </Form.Item>

      <Form.Item
        label="Target Release"
        name="targetRelease"
        rules={[{ required: true, message: 'Please enter target release' }]}
      >
        <Input placeholder="e.g., EXOS 33.7" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="Priority"
            name="priority"
            rules={[{ required: true }]}
          >
            <Select placeholder="Select priority">
              <Option value="P0">P0 - Critical</Option>
              <Option value="P1">P1 - High</Option>
              <Option value="P2">P2 - Medium</Option>
              <Option value="P3">P3 - Low</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Related Tickets"
            name="relatedTickets"
            extra="Comma-separated, or N/A"
          >
            <Input placeholder="EXOS-38257, EXOS-..." />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label="Feature Description"
        name="description"
        rules={[{ required: true, message: 'Please enter feature description' }]}
        extra="Paste complete Jira description including behaviors and background"
      >
        <TextArea 
          rows={6} 
          placeholder="Complete feature description from Jira..." 
        />
      </Form.Item>
    </div>
  );

  // Section 2: Topology
  const renderTopology = () => (
    <div>
      <Alert
        message="Test Topology Information"
        description="Define the devices and connections for your test environment. Be specific with device models."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form.Item
        label="Number of Devices"
        name="deviceCount"
        rules={[{ required: true }]}
      >
        <InputNumber min={1} max={10} placeholder="e.g., 3" style={{ width: '100%' }} />
      </Form.Item>

      <Divider orientation="left">Device Details</Divider>

      <Form.List name="devices">
        {(fields, { add, remove }) => (
          <>
            {fields.map((field, index) => (
              <Card 
                key={field.key} 
                size="small" 
                title={`Device ${index + 1}`}
                extra={fields.length > 1 && <Button type="link" danger onClick={() => remove(field.name)}>Remove</Button>}
                style={{ marginBottom: 16 }}
              >
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      {...field}
                      label="Role"
                      name={[field.name, 'role']}
                      rules={[{ required: true }]}
                    >
                      <Select placeholder="Select role">
                        <Option value="FA Server">FA Server</Option>
                        <Option value="FA Proxy">FA Proxy</Option>
                        <Option value="FA Client">FA Client</Option>
                        <Option value="DUT">DUT (Device Under Test)</Option>
                        <Option value="Other">Other</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      {...field}
                      label="Model"
                      name={[field.name, 'model']}
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="e.g., 5720-24MXW" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      {...field}
                      label="OS"
                      name={[field.name, 'os']}
                      rules={[{ required: true }]}
                    >
                      <Select placeholder="Select OS">
                        <Option value="EXOS">EXOS</Option>
                        <Option value="VOSS FE">VOSS Fabric Engine</Option>
                        <Option value="Third-party">Third-party</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            ))}
            <Button type="dashed" onClick={() => add()} block icon={<FileTextOutlined />}>
              Add Device
            </Button>
          </>
        )}
      </Form.List>

      <Divider orientation="left">Connections</Divider>

      <Form.Item
        label="Device Connections"
        name="connections"
        extra="Describe connections: Device1:Port <--> Device2:Port [trunk/access]"
      >
        <TextArea 
          rows={4} 
          placeholder="e.g., 5720:1/49 (trunk) <--> 5520:1/50 (trunk)" 
        />
      </Form.Item>
    </div>
  );

  // Section 3: Technical Specifications
  const renderTechnicalSpecs = () => (
    <div>
      <Alert
        message="Technical Specifications"
        description="Provide exact values used in your implementation. Use specific numbers, not placeholders."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Divider orientation="left">VLANs</Divider>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            label="Primary VLAN"
            name="primaryVlan"
            rules={[{ required: true }]}
            extra="e.g., 4048"
          >
            <Input placeholder="VLAN ID" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="Test VLANs"
            name="testVlans"
            extra="Comma-separated"
          >
            <Input placeholder="e.g., 1000, 2000" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="Management VLAN"
            name="mgmtVlan"
            extra="Optional"
          >
            <Input placeholder="e.g., 100" />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">NSI/ISID Values</Divider>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="Primary NSI"
            name="primaryNsi"
            rules={[{ required: true }]}
            extra="e.g., 15999999"
          >
            <Input placeholder="NSI value" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Test NSI Values"
            name="testNsi"
            extra="Comma-separated"
          >
            <Input placeholder="e.g., 10000, 20000" />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">Protocol-Specific Parameters</Divider>

      <Form.Item
        label="Additional Parameters"
        name="protocolParams"
        extra="Enter key=value pairs, one per line (e.g., BVLAN_Primary=4051)"
      >
        <TextArea 
          rows={4} 
          placeholder="BVLAN_Primary=4051&#10;BVLAN_Secondary=4052&#10;System_ID=f4ce.4802.b084" 
        />
      </Form.Item>

      <Divider orientation="left">Tools</Divider>

      <Form.Item
        label="Test Tools"
        name="tools"
        extra="Traffic generators, analyzers, etc."
      >
        <Select mode="tags" placeholder="Select or type (IXIA, Spirent, Wireshark, etc.)">
          <Option value="IXIA">IXIA</Option>
          <Option value="Spirent">Spirent</Option>
          <Option value="Wireshark">Wireshark</Option>
          <Option value="N/A">N/A</Option>
        </Select>
      </Form.Item>
    </div>
  );

  // Section 4: Feature Behaviors
  const renderBehaviors = () => (
    <div>
      <Alert
        message="Feature Behaviors & Test Scenarios"
        description="List the key behaviors and scenarios to test. Each item will become a test case."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form.Item
        label={
          <span>
            Core Functional Behaviors
            <Tooltip title="What the feature SHOULD do - positive scenarios">
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#1890ff' }} />
            </Tooltip>
          </span>
        }
        name="positiveBehaviors"
        rules={[{ required: true, message: 'Please enter at least 3 core behaviors' }]}
        extra="Enter one behavior per line (minimum 3)"
      >
        <TextArea 
          rows={6} 
          placeholder="1. Create fallback VLAN only when ZTP is active&#10;2. Add client ports only on NSI approval&#10;3. Retry NSI signaling while ZTP active" 
        />
      </Form.Item>

      <Form.Item
        label={
          <span>
            Negative Scenarios
            <Tooltip title="What happens when things fail or are rejected">
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#1890ff' }} />
            </Tooltip>
          </span>
        }
        name="negativeBehaviors"
        extra="Enter one scenario per line"
      >
        <TextArea 
          rows={4} 
          placeholder="1. Server rejects NSI → no client forwarding&#10;2. ZTP disabled → no fallback VLAN created" 
        />
      </Form.Item>

      <Form.Item
        label={
          <span>
            Edge Cases
            <Tooltip title="Boundary conditions and special scenarios">
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#1890ff' }} />
            </Tooltip>
          </span>
        }
        name="edgeCases"
        extra="Enter one case per line (optional)"
      >
        <TextArea 
          rows={4} 
          placeholder="1. Client has same VLAN as fallback&#10;2. Server advertises VLAN after fallback created" 
        />
      </Form.Item>

      <Divider orientation="left">Resilience Testing</Divider>

      <Row gutter={16}>
        <Col span={6}>
          <Form.Item name="testReboots" valuePropName="checked">
            <Switch checkedChildren="Yes" unCheckedChildren="No" />
            <span style={{ marginLeft: 8 }}>Reboot Tests</span>
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="testProcessRestarts" valuePropName="checked">
            <Switch checkedChildren="Yes" unCheckedChildren="No" />
            <span style={{ marginLeft: 8 }}>Process Restarts</span>
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="testPortFlaps" valuePropName="checked">
            <Switch checkedChildren="Yes" unCheckedChildren="No" />
            <span style={{ marginLeft: 8 }}>Port Flaps</span>
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="testProtocolResets" valuePropName="checked">
            <Switch checkedChildren="Yes" unCheckedChildren="No" />
            <span style={{ marginLeft: 8 }}>Protocol Resets</span>
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">Scaling (Optional)</Divider>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            label="Max Client Devices"
            name="maxDevices"
          >
            <InputNumber min={1} placeholder="e.g., 50" style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="Max VLANs"
            name="maxVlans"
          >
            <InputNumber min={1} placeholder="e.g., 100" style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="Target Setup Time"
            name="setupTime"
          >
            <Input placeholder="e.g., < 10 sec" />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );

  // Section 5: Preferences
  const renderPreferences = () => (
    <div>
      <Alert
        message="Test Plan Preferences & Options"
        description="Customize the test plan format and additional sections."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form.Item
        label="Test Case Depth"
        name="testCaseDepth"
        initialValue="concise"
        extra="Concise = 5-8 steps (official style, recommended)"
      >
        <Select>
          <Option value="concise">
            <Tag color="green">Concise</Tag> 5-8 steps, official format (Recommended)
          </Option>
          <Option value="detailed">
            <Tag color="blue">Detailed</Tag> 10-15 steps with verification
          </Option>
          <Option value="hybrid">
            <Tag color="purple">Hybrid</Tag> Concise with detailed results
          </Option>
        </Select>
      </Form.Item>

      <Divider orientation="left">Additional Sections</Divider>

      <Space direction="vertical" style={{ width: '100%' }}>
        <Form.Item name="includeRiskAssessment" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Switch checkedChildren="Yes" unCheckedChildren="No" />
          <span style={{ marginLeft: 8 }}>Include Risk Assessment & Mitigation</span>
        </Form.Item>

        <Form.Item name="includeExecutionGuide" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Switch checkedChildren="Yes" unCheckedChildren="No" />
          <span style={{ marginLeft: 8 }}>Include Test Execution Guidelines</span>
        </Form.Item>

        <Form.Item name="includeCLIReference" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Switch checkedChildren="Yes" unCheckedChildren="No" defaultChecked />
          <span style={{ marginLeft: 8 }}>Include CLI Command Reference Appendix</span>
        </Form.Item>

        <Form.Item name="includeReviewTemplate" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Switch checkedChildren="Yes" unCheckedChildren="No" />
          <span style={{ marginLeft: 8 }}>Include Review Meeting Template</span>
        </Form.Item>
      </Space>

      <Divider orientation="left">Documentation References</Divider>

      <Form.Item
        label="Functional Specification URL"
        name="functionalSpecUrl"
      >
        <Input placeholder="https://... or N/A" />
      </Form.Item>

      <Form.Item
        label="PRD/MRD Document URL"
        name="prdMrdUrl"
      >
        <Input placeholder="https://... or N/A" />
      </Form.Item>

      <Form.Item
        label="Configuration Guide URL"
        name="configGuideUrl"
      >
        <Input placeholder="https://... or N/A" />
      </Form.Item>

      <Divider orientation="left">Configuration Files</Divider>

      <Form.Item
        label="Base Configuration Available"
        name="configsAvailable"
        valuePropName="checked"
        extra="Check if you have CLI configuration commands ready"
      >
        <Switch checkedChildren="Yes" unCheckedChildren="No" />
      </Form.Item>

      <Form.Item
        label="Configuration Notes"
        name="configNotes"
        extra="If configs are available, indicate where they are or paste them here"
      >
        <TextArea 
          rows={4} 
          placeholder="Config files location or paste CLI commands..." 
        />
      </Form.Item>

      <Alert
        message="Ready to Generate!"
        description="Review your information and click 'Complete' to generate your test plan."
        type="success"
        showIcon
        style={{ marginTop: 24 }}
      />
    </div>
  );

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return renderBasicInfo();
      case 1:
        return renderTopology();
      case 2:
        return renderTechnicalSpecs();
      case 3:
        return renderBehaviors();
      case 4:
        return renderPreferences();
      default:
        return null;
    }
  };

  return (
    <Card>
      <Steps current={current} items={steps} style={{ marginBottom: 32 }} />

      <Form
        form={form}
        layout="vertical"
        initialValues={formData}
        autoComplete="off"
      >
        {renderStepContent()}

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={current === 0}
            onClick={prev}
            icon={<LeftOutlined />}
          >
            Previous
          </Button>

          <Space>
            <Button
              icon={<SaveOutlined />}
              onClick={() => {
                form.validateFields().then(values => {
                  setFormData({ ...formData, ...values });
                  message.success('Progress saved!');
                });
              }}
            >
              Save Progress
            </Button>

            {current < steps.length - 1 && (
              <Button type="primary" onClick={next} icon={<RightOutlined />}>
                Next
              </Button>
            )}

            {current === steps.length - 1 && (
              <Button 
                type="primary" 
                onClick={handleComplete}
                icon={<CheckCircleOutlined />}
              >
                Complete & Generate
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </Card>
  );
}
