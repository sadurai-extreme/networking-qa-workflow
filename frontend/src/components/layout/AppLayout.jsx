import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Layout, Menu, Avatar, Typography, Badge, Space, Button, Dropdown, message, Tooltip, Switch } from 'antd';
import {
  FileTextOutlined, CodeOutlined, CheckSquareOutlined,
  FundOutlined, PlayCircleOutlined, TrophyOutlined,
  UserOutlined, HomeOutlined, DownOutlined, CrownOutlined, LockOutlined, LogoutOutlined,
  BulbOutlined, BulbFilled, DashboardOutlined,
} from '@ant-design/icons';
import { useWorkflowStore, useAuthStore, useThemeStore } from '../../store';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const STAGES = [
  { name: 'Jira Story',           stage: 1, icon: <FileTextOutlined /> },
  { name: 'Skill File',           stage: 2, icon: <CodeOutlined /> },
  { name: 'Test Plan',            stage: 3, icon: <CheckSquareOutlined /> },
  { name: 'TCs Classification',   stage: 4, icon: <FundOutlined /> },
  { name: 'Script Generation',    stage: 7, icon: <CodeOutlined /> },
  { name: 'TC Execution',         stage: 8, icon: <PlayCircleOutlined /> },
  { name: 'Workflow Completion',  stage: 9, icon: <TrophyOutlined /> },
];

export default function AppLayout({ children, userMenu = [], user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { workflowId } = useParams();
  const { workflow } = useWorkflowStore();
  const { logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const currentStage = workflow?.current_stage || 1;
  const isAdmin = user?.role === 'admin';
  const [stage2Approved, setStage2Approved] = useState(false);

  const handleLogout = () => {
    message.success('Logged out successfully');
    logout();
    navigate('/');
  };

  // Determine if we're in a workflow context
  const isInWorkflow = location.pathname.includes('/workflow/');
  const isHomePage = location.pathname === '/';

  // Check if Stage 2 is approved
  useEffect(() => {
    if (workflow?.id) {
      axios.get(`${API}/stage2/${workflow.id}`)
        .then(r => setStage2Approved(r.data?.approved || false))
        .catch(() => setStage2Approved(false));
    }
  }, [workflow?.id, currentStage]);

  const handleStageClick = (stageNum) => {
    if (!workflow || !workflowId) return;
    
    // Block navigation to Stage 3+ if Stage 2 is not approved
    if (stageNum >= 3 && !stage2Approved) {
      message.warning('Please complete and approve Stage 2 (Skill File) before proceeding to Stage 3');
      return;
    }
    
    navigate(`/workflow/${workflowId}/stage/${stageNum}`);
  };

  const menuItems = STAGES.map(({ name, stage: stageNum, icon }) => {
    const isDone = stageNum < currentStage;
    const isActive = stageNum === currentStage;
    const isLocked = stageNum >= 3 && !stage2Approved; // Lock Stage 3+ until Stage 2 approved
    
    // Map each stage to the minimum DB current_stage needed to unlock it
    const UNLOCK_AT = { 1: 1, 2: 2, 3: 3, 4: 4, 7: 5, 8: 8 };
    const isAccessible = currentStage >= (UNLOCK_AT[stageNum] ?? stageNum);

    return {
      key: String(stageNum),
      icon: isLocked ? <LockOutlined /> : icon,
      label: (
        <Space>
          <span>{name}</span>
          {isAccessible && stageNum < currentStage && <Badge status="success" />}
          {isActive && <Badge status="processing" />}
          {isLocked && <Badge status="default" text="Locked" />}
        </Space>
      ),
      disabled: !isInWorkflow || !isAccessible || isLocked,
      onClick: () => handleStageClick(stageNum),
    };
  });

  // Add home menu item at the top
  const homeMenuItem = {
    key: 'home',
    icon: <HomeOutlined />,
    label: 'Dashboard',
    onClick: () => navigate('/'),
  };

  const adminMenuItem = isAdmin ? {
    key: 'admin',
    icon: <DashboardOutlined style={{ color: '#faad14' }} />,
    label: <span style={{ color: '#faad14', fontWeight: 600 }}>Admin Panel</span>,
    onClick: () => navigate('/admin'),
  } : null;

  const allMenuItems = [
    homeMenuItem,
    { type: 'divider' },
    ...menuItems,
    ...(adminMenuItem ? [{ type: 'divider' }, adminMenuItem] : []),
  ];

  // Apply dark mode class to body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  // Highlight current stage based on URL path (not DB current_stage)
  const urlStageMatch = location.pathname.match(/\/stage\/(\d+)/);
  const urlStageNum = urlStageMatch ? parseInt(urlStageMatch[1]) : null;
  const isAdminPage = location.pathname === '/admin';
  const selectedKeys = isAdminPage ? ['admin'] : isHomePage ? ['home'] : urlStageNum ? [String(urlStageNum)] : [String(currentStage)];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        width={220} 
        style={{ 
          position: 'fixed', 
          height: '100vh', 
          left: 0, 
          top: 0, 
          zIndex: 100,
          background: '#1a2541'
        }}>
        <div style={{ 
          padding: '20px 16px', 
          borderBottom: '1px solid #2d3a54', 
          cursor: 'pointer',
          background: '#1a2541'
        }} onClick={() => navigate('/')}>
          <Text style={{ color: '#fff', fontWeight: 600, fontSize: 16, letterSpacing: '0.5px' }}>EXOS QA Dashboard</Text>
          {workflow && (
            <div style={{ marginTop: 6 }}>
              <Text style={{ color: '#8b9ab8', fontSize: 12 }} ellipsis>{workflow.title}</Text>
            </div>
          )}
        </div>
        <Menu 
          mode="inline" 
          selectedKeys={selectedKeys} 
          items={allMenuItems} 
          style={{ 
            marginTop: 0,
            background: '#1a2541',
            border: 'none'
          }}
          theme="dark"
        />
        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          padding: '12px 16px', 
          borderTop: '1px solid #2d3a54',
          background: '#1a2541'
        }}>
          <div style={{ marginBottom: 12 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                {isDarkMode ? <BulbFilled style={{ color: '#faad14' }} /> : <BulbOutlined style={{ color: '#c9d1e0' }} />}
                <Text style={{ color: '#c9d1e0', fontSize: 12 }}>
                  {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                </Text>
              </Space>
              <Switch 
                checked={isDarkMode} 
                onChange={toggleTheme}
                size="small"
                checkedChildren="🌙"
                unCheckedChildren="☀️"
              />
            </Space>
          </div>
          <div style={{ marginBottom: 8 }}>
            <Dropdown menu={{ items: userMenu }} trigger={['click']}>
              <Space style={{ cursor: 'pointer', width: '100%' }}>
                <Avatar icon={<UserOutlined />} size="small" style={{ background: isAdmin ? '#faad14' : '#17a2b8' }} />
                <Text style={{ color: '#c9d1e0', fontSize: 12 }}>{user?.name}</Text>
                {isAdmin && <CrownOutlined style={{ color: '#faad14', fontSize: 11 }} />}
                <DownOutlined style={{ color: '#8b9ab8', fontSize: 10 }} />
              </Space>
            </Dropdown>
          </div>
          <Tooltip title="Clear cache and logout">
            <Button 
              type="primary" 
              danger 
              icon={<LogoutOutlined />} 
              block 
              size="small"
              onClick={handleLogout}
              style={{ marginTop: 4 }}
            >
              Logout
            </Button>
          </Tooltip>
        </div>
      </Sider>
      <Layout style={{ marginLeft: 220, background: '#f5f7fa' }}>
        {children}
      </Layout>
    </Layout>
  );
}
