import React from 'react';
import { Steps } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, ClockCircleOutlined } from '@ant-design/icons';

const STAGES = [
  { name: 'Jira Story',          stage: 1 },
  { name: 'Skill File',          stage: 2 },
  { name: 'Test Plan',           stage: 3 },
  { name: 'TC Classification',   stage: 4 },
  { name: 'Script Generation',   stage: 7 },
  { name: 'TC Execution',        stage: 8 },
  { name: 'Workflow Completion', stage: 9 },
];

// Map DB stage number to a position in the new 7-stage workflow
function toPosition(dbStage) {
  if (dbStage <= 1) return 1;
  if (dbStage <= 2) return 2;
  if (dbStage <= 3) return 3;
  if (dbStage <= 4) return 4;
  if (dbStage <= 7) return 5;
  if (dbStage <= 8) return 6;
  return 7;
}

export default function StageProgressBar({ currentStage }) {
  const currentPos = toPosition(currentStage);
  const items = STAGES.map(({ name }, i) => {
    const stageNum = i + 1;
    let status = 'wait';
    if (stageNum < currentPos) status = 'finish';
    else if (stageNum === currentPos) status = 'process';

    return {
      title: name,
      status,
      icon: stageNum < currentPos
        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
        : stageNum === currentPos
        ? <LoadingOutlined />
        : <ClockCircleOutlined style={{ color: '#bbb' }} />,
    };
  });

  return (
    <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
      <Steps current={currentStage - 1} items={items} size="small" />
    </div>
  );
}
