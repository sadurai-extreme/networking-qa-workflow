import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout, theme, ConfigProvider } from 'antd';
import { UserOutlined, LogoutOutlined, LockOutlined } from '@ant-design/icons';
import AppLayout from './components/layout/AppLayout';
import StageProgressBar from './components/layout/StageProgressBar';
import HomePage from './pages/HomePage';
import StagePage from './pages/StagePage';
import LoginPage from './components/pages/LoginPage';
import AdminDashboard from './components/pages/AdminDashboard';
import ChangePasswordModal from './components/shared/ChangePasswordModal';
import { useWorkflowStore, useAuthStore, useThemeStore } from './store';

const { Content } = Layout;

function WorkflowLayout() {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { workflow, loadWorkflow } = useWorkflowStore();
  const { token: themeToken } = theme.useToken();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workflowId && (!workflow || workflow.id !== workflowId)) {
      loadWorkflow(workflowId).then(() => setLoading(false)).catch(() => {
        navigate('/');
      });
    } else {
      setLoading(false);
    }
  }, [workflowId]);

  if (loading) {
    return (
      <Content style={{ margin: '24px', padding: 24, background: themeToken.colorBgContainer, borderRadius: 8, minHeight: 'calc(100vh - 120px)' }}>
        <div style={{ textAlign: 'center', padding: 80 }}>Loading workflow...</div>
      </Content>
    );
  }

  const isStageRoute = location.pathname.includes('/stage/');

  return (
    <>
      {workflow && isStageRoute && <StageProgressBar currentStage={workflow.current_stage} />}
      <Content style={{ margin: '0', padding: 0, background: '#f5f7fa', minHeight: 'calc(100vh - 70px)' }}>
        <Routes>
          <Route path="stage/:stageNumber" element={<StagePage />} />
          <Route path="*" element={<Navigate to={`/workflow/${workflowId}/stage/${workflow?.current_stage || 1}`} replace />} />
        </Routes>
      </Content>
    </>
  );
}

export default function App() {
  const { user, token, logout, isAdmin } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);

  // Validate token on app startup
  useEffect(() => {
    const validateToken = async () => {
      if (token) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (!response.ok) {
            console.warn('Token validation failed. Logging out...');
            logout();
          }
        } catch (error) {
          console.error('Token validation error:', error);
          logout();
        }
      }
      setValidatingToken(false);
    };

    validateToken();
  }, []); // Run once on mount

  // Show loading while validating token
  if (validatingToken) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: isDarkMode ? '#0d1117' : '#f5f7fa'
      }}>
        <div>Validating session...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user || !token) return <LoginPage />;

  const userMenuItems = [
    { key: 'profile', label: <span><UserOutlined /> {user.name}</span>, disabled: true },
    { type: 'divider' },
    { key: 'pwd', label: <span><LockOutlined /> Change Password</span>, onClick: () => setShowChangePwd(true) },
    { type: 'divider' },
    { key: 'logout', label: <span><LogoutOutlined /> Logout</span>, onClick: logout },
  ];

  // Theme configuration for Ant Design
  const themeConfig = {
    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#17a2b8',
      colorSuccess: '#20c997',
      colorWarning: '#faad14',
      colorError: '#dc3545',
      colorInfo: '#17a2b8',
      borderRadius: 8,
      colorBgContainer: isDarkMode ? '#161b22' : '#ffffff',
      colorBgLayout: isDarkMode ? '#0d1117' : '#f5f7fa',
    },
  };

  return (
    <ConfigProvider theme={themeConfig}>
      <AppLayout userMenu={userMenuItems} user={user}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/workflow/:workflowId/*" element={<WorkflowLayout />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
      <ChangePasswordModal open={showChangePwd} onClose={() => setShowChangePwd(false)} userId={user.id} />
    </ConfigProvider>
  );
}
