import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Typography } from 'antd';
import Stage1 from '../components/stages/Stage1';
import Stage2 from '../components/stages/Stage2';
import Stage3 from '../components/stages/Stage3';
import Stage4 from '../components/stages/Stage4';
import Stage7 from '../components/stages/Stage7';
import Stage8 from '../components/stages/Stage8';
import Stage9 from '../components/stages/Stage9';

const { Title } = Typography;

const STAGE_COMPONENTS = {
  1: Stage1,
  2: Stage2,
  3: Stage3,
  4: Stage4,
  7: Stage7,
  8: Stage8,
  9: Stage9,
};

const STAGE_TITLES = {
  1: 'Jira Story Selection',
  2: 'Skill File Generation',
  3: 'Test Plan Creation',
  4: 'Test Case Classification',
  7: 'Script Generation',
  8: 'TC Execution',
  9: 'Workflow Completion',
};

const STAGE_SUBTITLES = {
  1: 'Select and configure your Jira story',
  2: 'Generate skill files from feature specifications',
  3: 'Create comprehensive test plans',
  4: 'Classify test cases by priority and type',
  7: 'Generate TCL automation scripts for automatable test cases',
  8: 'Execute test cases, record results, and produce final test plan',
  9: 'Review execution summary, upload results to qTest, and complete the workflow',
};

// Maps internal backend stage number to display number shown in UI
const DISPLAY_NUMBER = { 1: 1, 2: 2, 3: 3, 4: 4, 7: 5, 8: 6, 9: 7 };

export default function StagePage() {
  const { workflowId, stageNumber } = useParams();
  const stageNum = parseInt(stageNumber);

  // Redirect obsolete stages 5 (ISO Format) and 6 (qTest Upload) → Stage 7 (Script Generation)
  if (stageNum === 5 || stageNum === 6) {
    return <Navigate to={`/workflow/${workflowId}/stage/7`} replace />;
  }

  const displayNum = DISPLAY_NUMBER[stageNum] ?? stageNum;
  const StageComponent = STAGE_COMPONENTS[stageNum];

  if (!StageComponent) {
    return <Navigate to={`/workflow/${workflowId}/stage/1`} replace />;
  }

  return (
    <>
      {/* Stage Header Banner */}
      <div className="page-header-banner" style={{ padding: '20px 32px' }}>
        <div>
          <Title level={3} style={{ color: 'white', margin: 0, fontSize: 20 }}>
            Stage {displayNum}: {STAGE_TITLES[stageNum]}
          </Title>
          <p className="page-header-subtitle" style={{ margin: '4px 0 0 0' }}>
            {STAGE_SUBTITLES[stageNum]}
          </p>
        </div>
      </div>
      <div style={{ padding: '32px 48px', background: '#f5f7fa', minHeight: 'calc(100vh - 150px)' }}>
        <StageComponent workflowId={workflowId} />
      </div>
    </>
  );
}
