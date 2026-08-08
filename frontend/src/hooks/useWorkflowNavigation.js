import { useNavigate, useParams } from 'react-router-dom';
import { useWorkflowStore } from '../store';

/**
 * Custom hook for workflow navigation
 * Provides helper functions for navigating between stages
 */
export function useWorkflowNavigation() {
  const navigate = useNavigate();
  const { workflowId } = useParams();
  const { workflow, advanceStage: advanceStageStore } = useWorkflowStore();

  const goToStage = (stageNumber) => {
    if (workflowId) {
      navigate(`/workflow/${workflowId}/stage/${stageNumber}`);
    }
  };

  const goToNextStage = async () => {
    const result = await advanceStageStore();
    if (result && workflowId) {
      navigate(`/workflow/${workflowId}/stage/${result.current_stage}`);
    }
    return result;
  };

  const goToDashboard = () => {
    navigate('/');
  };

  const goToAdmin = () => {
    navigate('/admin');
  };

  return {
    workflowId,
    workflow,
    goToStage,
    goToNextStage,
    goToDashboard,
    goToAdmin,
  };
}
