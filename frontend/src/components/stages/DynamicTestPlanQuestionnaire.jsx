import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, Space, Row, Col, Divider, InputNumber, Switch, Spin, Alert, message } from 'antd';
import { 
  QuestionCircleOutlined,
  SaveOutlined,
  RightOutlined,
  LeftOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useWorkflowStore } from '../../store';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const { TextArea } = Input;
const { Option } = Select;

export default function DynamicTestPlanQuestionnaire({ onComplete, initialData = {} }) {
  const { workflow } = useWorkflowStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(0);
  const [formData, setFormData] = useState(initialData);

  useEffect(() => {
    fetchDynamicQuestions();
  }, [workflow?.id]);

  const fetchDynamicQuestions = async () => {
    setLoading(true);
    try {
      console.log('Fetching dynamic questions for workflow:', workflow?.id);
      const { data } = await axios.post(`${API}/stage3/generate-questionnaire`, {
        workflow_id: workflow.id
      });
      
      console.log('Received questions:', data.questions?.length);
      
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No questions generated');
      }
      
      setQuestions(data.questions);
      
      // Group questions by category
      const uniqueCategories = [...new Set(data.questions.map(q => q.category))];
      setCategories(uniqueCategories);
      
      console.log('Categories:', uniqueCategories);
      message.success(`Generated ${data.questions.length} feature-specific questions`);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      console.error('Error details:', err.response?.data);
      message.warning('Using fallback questions due to error: ' + (err.message || 'Unknown error'));
      
      const fallback = getFallbackQuestions();
      setQuestions(fallback);
      setCategories(['Basic Information']);
    }
    setLoading(false);
  };

  const getFallbackQuestions = () => [
    {
      id: 'jira_id',
      category: 'Basic Information',
      question: 'What is the Jira ticket ID?',
      type: 'text',
      placeholder: 'EXOS-XXXXX',
      required: true,
      help: 'The Jira ticket identifier for this feature'
    },
    {
      id: 'feature_name',
      category: 'Basic Information',
      question: 'What is the feature name?',
      type: 'text',
      required: true,
      help: 'Brief descriptive name of the feature'
    },
    {
      id: 'feature_description',
      category: 'Basic Information',
      question: 'Describe the feature functionality',
      type: 'textarea',
      required: true,
      help: 'Detailed description of what the feature does'
    },
    {
      id: 'max_scale',
      category: 'Basic Information',
      question: 'What are the maximum scale limits (if any)?',
      type: 'text',
      placeholder: 'e.g., max 4000 VLANs, max 1000 rules',
      help: 'Resource limits mentioned in the specification'
    },
    {
      id: 'platforms',
      category: 'Basic Information',
      question: 'Which platforms support this feature?',
      type: 'multiselect',
      options: ['All EXOS platforms', 'BCM only', 'VSP only', 'Specific models'],
      help: 'Platform compatibility'
    }
  ];

  const next = async () => {
    try {
      const values = await form.validateFields();
      setFormData({ ...formData, ...values });
      setCurrentCategory(currentCategory + 1);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const prev = () => {
    setCurrentCategory(currentCategory - 1);
  };

  const handleComplete = async () => {
    try {
      const values = await form.validateFields();
      const completeData = { ...formData, ...values };
      onComplete(completeData);
    } catch (error) {
      console.error('Validation failed:', error);
      message.error('Please answer all required questions');
    }
  };

  const renderQuestion = (question) => {
    const rules = question.required ? [{ required: true, message: `Please answer this question` }] : [];

    switch (question.type) {
      case 'number':
        return (
          <Form.Item
            key={question.id}
            label={question.question}
            name={question.id}
            rules={rules}
            extra={question.help}
            tooltip={question.help}
          >
            <InputNumber 
              placeholder={question.placeholder} 
              style={{ width: '100%' }} 
              min={question.min}
              max={question.max}
            />
          </Form.Item>
        );

      case 'select':
        return (
          <Form.Item
            key={question.id}
            label={question.question}
            name={question.id}
            rules={rules}
            extra={question.help}
            tooltip={question.help}
          >
            <Select placeholder={question.placeholder || 'Select option'}>
              {question.options?.map(opt => (
                <Option key={opt} value={opt}>{opt}</Option>
              ))}
            </Select>
          </Form.Item>
        );

      case 'multiselect':
        return (
          <Form.Item
            key={question.id}
            label={question.question}
            name={question.id}
            rules={rules}
            extra={question.help}
            tooltip={question.help}
          >
            <Select mode="multiple" placeholder={question.placeholder || 'Select options'}>
              {question.options?.map(opt => (
                <Option key={opt} value={opt}>{opt}</Option>
              ))}
            </Select>
          </Form.Item>
        );

      case 'boolean':
        return (
          <Form.Item
            key={question.id}
            label={question.question}
            name={question.id}
            valuePropName="checked"
            extra={question.help}
            tooltip={question.help}
          >
            <Switch />
          </Form.Item>
        );

      case 'textarea':
        return (
          <Form.Item
            key={question.id}
            label={question.question}
            name={question.id}
            rules={rules}
            extra={question.help}
            tooltip={question.help}
          >
            <TextArea 
              rows={4} 
              placeholder={question.placeholder}
            />
          </Form.Item>
        );

      case 'text':
      default:
        return (
          <Form.Item
            key={question.id}
            label={question.question}
            name={question.id}
            rules={rules}
            extra={question.help}
            tooltip={question.help}
          >
            <Input placeholder={question.placeholder} />
          </Form.Item>
        );
    }
  };

  const renderCategory = (categoryName) => {
    const categoryQuestions = questions.filter(q => q.category === categoryName);
    
    return (
      <div key={categoryName}>
        <Alert
          message={`${categoryName} (${categoryQuestions.length} questions)`}
          description="Please provide detailed answers to help generate accurate test cases"
          type="info"
          showIcon
          icon={<QuestionCircleOutlined />}
          style={{ marginBottom: 24 }}
        />
        
        {categoryQuestions.map(question => (
          <div key={question.id}>
            {renderQuestion(question)}
            {categoryQuestions.indexOf(question) < categoryQuestions.length - 1 && 
              categoryQuestions.indexOf(question) % 3 === 2 && 
              <Divider dashed />
            }
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
        <p style={{ marginTop: 24, fontSize: 16, color: '#666' }}>
          Analyzing skill file and generating feature-specific questions...
        </p>
        <p style={{ color: '#999' }}>This may take 30-60 seconds</p>
      </Card>
    );
  }

  return (
    <div>
      <Alert
        message="Dynamic Feature-Specific Questionnaire"
        description={`${questions.length} questions generated based on your feature specification. These questions are unique to your feature and will help generate comprehensive test plans.`}
        type="success"
        showIcon
        closable
        style={{ marginBottom: 24 }}
      />

      <Card 
        title={`Category ${currentCategory + 1} of ${categories.length}: ${categories[currentCategory]}`}
        extra={
          <span style={{ color: '#999' }}>
            Progress: {Math.round(((currentCategory + 1) / categories.length) * 100)}%
          </span>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={formData}
          size="large"
        >
          {renderCategory(categories[currentCategory])}

          <Divider />

          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button
              onClick={prev}
              disabled={currentCategory === 0}
              icon={<LeftOutlined />}
            >
              Previous
            </Button>

            {currentCategory < categories.length - 1 ? (
              <Button type="primary" onClick={next} icon={<RightOutlined />} iconPosition="end">
                Next Category
              </Button>
            ) : (
              <Button 
                type="primary" 
                onClick={handleComplete} 
                icon={<SaveOutlined />}
                size="large"
              >
                Complete & Generate Test Plan
              </Button>
            )}
          </Space>
        </Form>
      </Card>

      <Card style={{ marginTop: 16, background: '#f6ffed' }} size="small">
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <strong>Categories:</strong>
          {categories.map((cat, idx) => (
            <div key={cat} style={{ 
              opacity: idx === currentCategory ? 1 : 0.5,
              fontWeight: idx === currentCategory ? 'bold' : 'normal'
            }}>
              {idx + 1}. {cat} {idx < currentCategory && '✓'}
            </div>
          ))}
        </Space>
      </Card>
    </div>
  );
}
