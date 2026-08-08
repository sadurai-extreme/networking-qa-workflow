import { create } from 'zustand';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ---------- AXIOS INTERCEPTORS FOR TOKEN HANDLING ----------
let isSettingUpInterceptor = false;

const setupAxiosInterceptors = () => {
  if (isSettingUpInterceptor) return;
  isSettingUpInterceptor = true;

  // Request interceptor: Add token to all requests
  axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('qa_token');
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor: Handle 401 (token expired)
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.error || '';
        
        // Check if it's a token expiration error
        if (errorMessage.includes('expired') || errorMessage.includes('Invalid')) {
          console.warn('Token expired or invalid. Logging out...');
          
          // Clear storage
          localStorage.removeItem('qa_token');
          localStorage.removeItem('qa_user');
          sessionStorage.clear();
          
          // Get the logout function from auth store
          const authStore = useAuthStore.getState();
          authStore.logout();
          
          // Redirect to login
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
};

// Set up interceptors immediately
setupAxiosInterceptors();

// ---------- AUTH STORE ----------
export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('qa_user') || 'null'),
  token: localStorage.getItem('qa_token') || null,
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await axios.post(`${API}/auth/login`, { username, password });
      localStorage.setItem('qa_token', data.token);
      localStorage.setItem('qa_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Login failed', loading: false });
    }
  },

  logout: () => {
    // Clear all localStorage items related to the app
    localStorage.removeItem('qa_token');
    localStorage.removeItem('qa_user');
    
    // Clear any session storage as well
    sessionStorage.clear();
    
    // Reset all state
    set({ user: null, token: null, error: null, loading: false });
    
    // Also clear workflow store state
    useWorkflowStore.setState({
      workflows: [],
      workflow: null,
      stages: [],
      loading: false,
      error: null
    });
  },

  isAdmin: () => get().user?.role === 'admin',
}));

// ---------- WORKFLOW STORE ----------
export const useWorkflowStore = create((set, get) => ({
  workflow: null,
  workflows: [],
  stages: [],
  loading: false,
  error: null,

  setWorkflow: (workflow) => set({ workflow }),

  loadWorkflows: async () => {
    console.log('=== STORE: loadWorkflows called ===');
    set({ loading: true });
    const token = useAuthStore.getState().token;
    try {
      console.log('Making API call to:', `${API}/workflows`);
      const { data } = await axios.get(`${API}/workflows`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('API returned workflows:', data.length, 'workflows');
      console.log('Workflows data:', data);
      set({ workflows: data, loading: false });
      return data;
    } catch (err) {
      console.error('Error loading workflows:', err);
      set({ error: err.message, loading: false });
      return [];
    }
  },

  createWorkflow: async (title, metadata = {}) => {
    console.log('=== STORE: createWorkflow called ===');
    console.log('Title:', title);
    console.log('Metadata:', metadata);
    
    set({ loading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('API URL:', API);
      
      const payload = { 
        title,
        release: metadata.release,
        storyId: metadata.storyId,
        description: metadata.description || '',
        type: metadata.type || 'Feature',
        status: metadata.status || '',
        priority: metadata.priority || ''
      };
      console.log('Request payload:', payload);
      
      const { data } = await axios.post(`${API}/workflows`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Response data:', data);
      set({ workflow: data, loading: false });
      
      // Refresh workflows list
      console.log('Refreshing workflows list...');
      get().loadWorkflows();
      
      console.log('=== STORE: createWorkflow SUCCESS ===');
      return data;
    } catch (err) {
      console.error('=== STORE: createWorkflow ERROR ===');
      console.error('Error:', err);
      console.error('Error response:', err.response);
      console.error('Error message:', err.message);
      
      set({ error: err.response?.data?.error || err.message, loading: false });
      throw err;
    }
  },

  loadWorkflow: async (id) => {
    set({ loading: true });
    const token = useAuthStore.getState().token;
    const { data } = await axios.get(`${API}/workflows/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set({ workflow: data, stages: data.stages || [], loading: false });
    return data;
  },

  advanceStage: async () => {
    const { workflow } = get();
    const token = useAuthStore.getState().token;
    const { data } = await axios.post(`${API}/workflows/${workflow.id}/advance`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set(state => ({
      workflow: { ...state.workflow, current_stage: data.current_stage }
    }));
    return data;
  },

  completeWorkflow: async () => {
    const { workflow } = get();
    const token = useAuthStore.getState().token;
    await axios.post(`${API}/workflows/${workflow.id}/complete`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set(state => ({ workflow: { ...state.workflow, status: 'completed' } }));
    // Refresh workflows list
    get().loadWorkflows();
  },
}));

// ---------- USER STORE ----------
export const useUserStore = create((set) => ({
  users: [],
  loadUsers: async () => {
    const token = useAuthStore.getState().token;
    const { data } = await axios.get(`${API}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set({ users: data });
  },
}));

// ---------- THEME STORE ----------
export const useThemeStore = create((set) => ({
  isDarkMode: localStorage.getItem('qa_theme') !== 'light',
  
  toggleTheme: () => set((state) => {
    const newMode = !state.isDarkMode;
    localStorage.setItem('qa_theme', newMode ? 'dark' : 'light');
    return { isDarkMode: newMode };
  }),
  
  setTheme: (isDark) => {
    localStorage.setItem('qa_theme', isDark ? 'dark' : 'light');
    set({ isDarkMode: isDark });
  },
}));

