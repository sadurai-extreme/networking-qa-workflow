import React from 'react';
import { Card, Progress, Tag, Alert, Descriptions, Collapse, Badge, Space, Typography, Divider } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ExclamationCircleOutlined,
  TrophyOutlined,
  BulbOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

export default function TestPlanEvaluationDisplay({ evaluation }) {
  if (!evaluation) return null;

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'Excellent': return 'success';
      case 'Good': return 'processing';
      case 'Acceptable': return 'warning';
      case 'Needs Work': return 'warning';
      case 'FAIL': return 'error';
      default: return 'default';
    }
  };

  const getGradeIcon = (grade) => {
    switch (grade) {
      case 'Excellent': return <TrophyOutlined style={{ color: '#52c41a' }} />;
      case 'Good': return <CheckCircleOutlined style={{ color: '#1890ff' }} />;
      case 'Acceptable': return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'FAIL': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default: return <ExclamationCircleOutlined />;
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#52c41a';
    if (score >= 75) return '#1890ff';
    if (score >= 60) return '#faad14';
    if (score >= 40) return '#fa8c16';
    return '#ff4d4f';
  };

  const renderCategoryCard = (category, data) => {
    const { score, weight, details } = data;
    
    return (
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Text strong>{category}</Text>
            <Tag color={score >= 70 ? 'green' : score >= 50 ? 'orange' : 'red'}>
              {score}/100 ({weight})
            </Tag>
          </Space>
          
          <Progress 
            percent={score} 
            strokeColor={getScoreColor(score)}
            size="small"
            showInfo={false}
          />

          {details && (
            <Collapse ghost size="small">
              <Panel header={<Text type="secondary" style={{ fontSize: 12 }}>View Details</Text>} key="1">
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {Object.entries(details).filter(([key]) => key !== 'total').map(([key, value]) => {
                    if (typeof value === 'object' && value.score !== undefined) {
                      return (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <Text type="secondary">{formatKey(key)}</Text>
                          <Text>{value.score === 'N/A' ? 'N/A' : `${value.score}/${value.max}`}</Text>
                        </div>
                      );
                    }
                    return null;
                  })}
                </Space>
              </Panel>
            </Collapse>
          )}
        </Space>
      </Card>
    );
  };

  const formatKey = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const renderMetrics = (metrics) => {
    return (
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="Test Case Count">
          <Badge 
            count={metrics.testCaseCount} 
            style={{ backgroundColor: metrics.testCaseCount >= 15 ? '#52c41a' : '#faad14' }} 
          />
        </Descriptions.Item>
        <Descriptions.Item label="Sanity Coverage">
          {metrics.sanityPercentage}%
          {metrics.sanityPercentage >= 40 && metrics.sanityPercentage <= 60 ? 
            ' ✅' : ' ⚠️'}
        </Descriptions.Item>
        <Descriptions.Item label="Specific Values">
          {metrics.specificValuesPercentage}%
          {metrics.specificValuesPercentage >= 70 ? ' ✅' : ' ⚠️'}
        </Descriptions.Item>
        <Descriptions.Item label="CLI Commands">
          {metrics.cliCommandBlocks}
        </Descriptions.Item>
        <Descriptions.Item label="Cross-References">
          {metrics.crossReferences}
        </Descriptions.Item>
        <Descriptions.Item label="Format">
          {metrics.uses5xFormat ? '5.x.x ✅' : 'TC-xxx ❌'}
        </Descriptions.Item>
      </Descriptions>
    );
  };

  return (
    <div style={{ marginTop: 24 }}>
      <Divider orientation="left">
        <Space>
          <BulbOutlined />
          Test Plan Quality Evaluation
        </Space>
      </Divider>

      {/* Critical Failures Alert */}
      {evaluation.criticalFailures && evaluation.criticalFailures.length > 0 && (
        <Alert
          type="error"
          message="Critical Failures Detected"
          description={
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              {evaluation.criticalFailures.map((failure, idx) => (
                <li key={idx}>{failure}</li>
              ))}
            </ul>
          }
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {/* Overall Score Card */}
      <Card 
        style={{ 
          marginBottom: 16, 
          background: `linear-gradient(135deg, ${getScoreColor(evaluation.score)}15 0%, ${getScoreColor(evaluation.score)}05 100%)`
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Space>
              {getGradeIcon(evaluation.grade)}
              <Title level={4} style={{ margin: 0 }}>
                Grade: {evaluation.grade}
              </Title>
            </Space>
            <Tag 
              color={getGradeColor(evaluation.grade)} 
              style={{ fontSize: 16, padding: '4px 12px' }}
            >
              {evaluation.score}/100
            </Tag>
          </Space>

          <Progress 
            percent={evaluation.score} 
            strokeWidth={12}
            strokeColor={{
              '0%': getScoreColor(evaluation.score),
              '100%': getScoreColor(evaluation.score + 10),
            }}
          />

          {evaluation.passed ? (
            <Alert 
              type="success" 
              message="✅ Test plan meets minimum quality standards (≥60%)" 
              showIcon 
            />
          ) : (
            <Alert 
              type="error" 
              message="❌ Test plan does not meet minimum quality standards (<60%)" 
              showIcon 
            />
          )}
        </Space>
      </Card>

      {/* Category Breakdown */}
      {evaluation.breakdown && (
        <Card title="Score Breakdown by Category" size="small" style={{ marginBottom: 16 }}>
          {Object.entries(evaluation.breakdown).map(([category, data]) => (
            <div key={category}>
              {renderCategoryCard(formatKey(category), data)}
            </div>
          ))}
        </Card>
      )}

      {/* Quality Metrics */}
      {evaluation.metrics && (
        <Card title="Quality Metrics" size="small" style={{ marginBottom: 16 }}>
          {renderMetrics(evaluation.metrics)}
        </Card>
      )}

      {/* Strengths */}
      {evaluation.strengths && evaluation.strengths.length > 0 && (
        <Card 
          title={
            <Space>
              <TrophyOutlined style={{ color: '#52c41a' }} />
              Strengths
            </Space>
          } 
          size="small" 
          style={{ marginBottom: 16 }}
        >
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            {evaluation.strengths.map((strength, idx) => (
              <li key={idx}>
                <Text style={{ color: '#52c41a' }}>{strength}</Text>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Areas for Improvement */}
      {evaluation.improvements && evaluation.improvements.length > 0 && (
        <Card 
          title={
            <Space>
              <ExclamationCircleOutlined style={{ color: '#faad14' }} />
              Areas for Improvement
            </Space>
          } 
          size="small"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {evaluation.improvements.map((improvement, idx) => (
              <Alert
                key={idx}
                type={improvement.priority === 'HIGH' ? 'error' : improvement.priority === 'MEDIUM' ? 'warning' : 'info'}
                message={
                  <Space>
                    <Tag color={improvement.priority === 'HIGH' ? 'red' : improvement.priority === 'MEDIUM' ? 'orange' : 'blue'}>
                      {improvement.priority}
                    </Tag>
                    <Text strong>{improvement.area}</Text>
                  </Space>
                }
                description={improvement.issue}
                showIcon
                style={{ marginBottom: 8 }}
              />
            ))}
          </Space>
        </Card>
      )}

      {/* Grade Reference */}
      <Card title="Grade Reference" size="small" style={{ marginTop: 16 }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Excellent (90-100%)</Text>
            <Tag color="success">Production-ready</Tag>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Good (75-89%)</Text>
            <Tag color="processing">Minor refinements needed</Tag>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Acceptable (60-74%)</Text>
            <Tag color="warning">Needs improvements</Tag>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Needs Work (40-59%)</Text>
            <Tag color="warning">Major rework required</Tag>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Fail (&lt;40%)</Text>
            <Tag color="error">Does not meet standards</Tag>
          </div>
        </Space>
      </Card>
    </div>
  );
}
