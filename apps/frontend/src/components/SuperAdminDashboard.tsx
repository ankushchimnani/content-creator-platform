import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { DashboardLayout } from './DashboardLayout';
import { Settings } from './Settings';
import { LoaderOverlay } from './Loader';
import { SuperAdminAnalytics } from './SuperAdminAnalytics';

// Available courses list
const AVAILABLE_COURSES = [
  'Product Management',
  'Artificial Intelligence/ Machine Learning',
  'Business Analytics/ Data Analytics',
  'Fintech',
  'Software Engineering',
  'Gen AI',
  'Project Management',
  'Digital Marketing',
  'Cyber Security',
  'System Design'
];

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type PromptTemplate = {
  id: string;
  name: string;
  contentType: 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE';
  prompt: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  createdBy: {
    name: string;
    email: string;
  };
};

type GuidelinesTemplate = {
  id: string;
  name: string;
  contentType: 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE';
  guidelines: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    name: string;
    email: string;
  };
};


type CreatorAnalytics = {
  id: string;
  name: string;
  email: string;
  assignedAdmin?: {
    id: string;
    name: string;
    email: string;
  };
  contentStats: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  lastContentCreated?: string;
};

type Admin = {
  id: string;
  name: string;
  email: string;
};

type Props = {
  user: User;
  token: string;
  onLogout: () => void;
};

export function SuperAdminDashboard({ user, token, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<'analytics' | 'playground' | 'llm' | 'prompts' | 'guidelines' | 'users' | 'settings'>('analytics');
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);

  // Map sidebar navigation IDs to internal tab states
  const handleSidebarNavigation = (viewId: string) => {
    const tabMapping: Record<string, typeof activeTab> = {
      'dashboard': 'analytics',     // Analytics Dashboard (default)
      'playground': 'playground',   // Prompt Playground
      'llm': 'llm',                 // LLM Config (if needed)
      'prompts': 'prompts',         // Prompt Templates
      'guidelines': 'guidelines',   // Guidelines
      'users': 'users',             // User Management
      'settings': 'settings'        // Settings
    };
    const mappedTab = tabMapping[viewId] || 'analytics';
    setIsTabTransitioning(true);
    setTimeout(() => {
      setActiveTab(mappedTab);
      setIsTabTransitioning(false);
    }, 300);
  };
  // Removed unused prompts state
  const [guidelines, setGuidelines] = useState<GuidelinesTemplate[]>([]);
  const [creators, setCreators] = useState<CreatorAnalytics[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  // Removed unused showUserForm state
  const [showIndividualUserForm, setShowIndividualUserForm] = useState(false);
  const [showViewUserModal, setShowViewUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  // Removed unused csvData state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [bulkCreateResults, setBulkCreateResults] = useState<any>(null);

  // Multi-admin selection state
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [editSelectedAdmins, setEditSelectedAdmins] = useState<string[]>([]);

  // Multi-course selection state
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [editSelectedCourses, setEditSelectedCourses] = useState<string[]>([]);
  
  // Playground state
  const [playgroundPrompt, setPlaygroundPrompt] = useState('');
  const [playgroundContentType, setPlaygroundContentType] = useState<'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'>('ASSIGNMENT');
  const [playgroundVariables, setPlaygroundVariables] = useState({
    topic: '',
    topicsTaughtSoFar: '',
    content: '',
  });
  const [availableVariables, setAvailableVariables] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [testingPrompt, setTestingPrompt] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<PromptTemplate | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  
  // Guidelines management state
  const [selectedGuidelinesType, setSelectedGuidelinesType] = useState<'ASSIGNMENT' | 'LECTURE_NOTE' | 'PRE_READ'>('ASSIGNMENT');
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);
  const [guidelinesModalMode, setGuidelinesModalMode] = useState<'create' | 'update'>('create');
  const [guidelinesModalData, setGuidelinesModalData] = useState({ id: '', contentType: '', guidelines: '' });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'guidelines':
          await fetchGuidelines();
          break;
        case 'playground':
          await fetchAvailableVariables();
          await fetchCurrentPrompt();
          break;
        case 'users':
          await Promise.all([
            fetchAdmins(),
            fetchAllUsers()
          ]);
          break;
        case 'analytics':
          await fetchCreatorAnalytics();
          await fetchAdmins();
          break;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };


  const fetchGuidelines = async () => {
    const res = await apiCall('/api/super-admin/guidelines', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setGuidelines(data.guidelines);
    }
  };


  const fetchCreatorAnalytics = async () => {
    const res = await apiCall('/api/super-admin/analytics/creators', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setCreators(data.creators);
    }
  };

  const fetchAdmins = async () => {
    const res = await apiCall('/api/super-admin/admins', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setAdmins(data.admins);
    }
  };

  const fetchAllUsers = async () => {
    const res = await apiCall('/api/super-admin/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setAllUsers(data.users);
    } else {
      console.error('Failed to fetch users:', res.status, await res.text());
    }
  };

  const fetchAvailableVariables = async () => {
    const res = await apiCall('/api/super-admin/prompts/variables', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setAvailableVariables(data);
    }
  };

  const fetchCurrentPrompt = async () => {
    const res = await apiCall('/api/super-admin/prompts', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      // Find the active prompt for the current content type
      const activePrompt = data.prompts.find((p: PromptTemplate) => 
        p.contentType === playgroundContentType && p.isActive
      );
      if (activePrompt) {
        setCurrentPrompt(activePrompt);
        setPlaygroundPrompt(activePrompt.prompt);
      }
    }
  };

  const testPrompt = async () => {
    if (!playgroundPrompt.trim()) {
      alert('Please enter a prompt to test');
      return;
    }

    setTestingPrompt(true);
    setTestResults(null);

    try {
      const res = await apiCall('/api/super-admin/prompts/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: playgroundPrompt,
          contentType: playgroundContentType,
          variables: {
            topic: playgroundVariables.topic,
            prerequisites: playgroundVariables.topicsTaughtSoFar,
            guidelines: '', // Guidelines are now fetched from database
            content: playgroundVariables.content,
          }
        })
      });

      const results = await res.json();
      setTestResults(results);

      if (!res.ok) {
        alert(`Test failed: ${results.error}`);
      }
    } catch (error) {
      console.error('Error testing prompt:', error);
      alert('Failed to test prompt');
    } finally {
      setTestingPrompt(false);
    }
  };


  const savePrompt = async () => {
    if (!playgroundPrompt.trim()) {
      alert('Please enter a prompt to save');
      return;
    }

    setSavingPrompt(true);
    try {
      const promptData = {
        name: `${playgroundContentType.replace('_', ' ')} Validation Prompt v${(currentPrompt?.version || 0) + 1}`,
        contentType: playgroundContentType,
        prompt: playgroundPrompt,
      };

      const url = currentPrompt 
        ? `/api/super-admin/prompts/${currentPrompt.id}`
        : '/api/super-admin/prompts';
      
      const res = await apiCall(url, {
        method: currentPrompt ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(promptData)
      });

      if (res.ok) {
        await fetchCurrentPrompt(); // Refresh the current prompt
        alert('Prompt saved successfully!');
      } else {
        const error = await res.json();
        alert(`Error saving prompt: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
      alert('Failed to save prompt');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleContentTypeChange = async (newContentType: string) => {
    setPlaygroundContentType(newContentType as any);
    
    // Fetch the current prompt for the new content type
    const res = await apiCall('/api/super-admin/prompts', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const activePrompt = data.prompts.find((p: PromptTemplate) => 
        p.contentType === newContentType && p.isActive
      );
      if (activePrompt) {
        setCurrentPrompt(activePrompt);
        setPlaygroundPrompt(activePrompt.prompt);
      } else {
        setCurrentPrompt(null);
        setPlaygroundPrompt('');
      }
    }
  };

  // Guidelines management functions
  const createGuidelines = async (contentType: string, guidelines: string) => {
    try {
      const res = await apiCall('/api/super-admin/guidelines', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${contentType} Guidelines v1`,
          contentType,
          guidelines
        })
      });

      if (res.ok) {
        await fetchGuidelines();
        setShowGuidelinesModal(false);
        setGuidelinesModalData({ id: '', contentType: '', guidelines: '' });
        alert('Guidelines created successfully!');
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating guidelines:', error);
      alert('Failed to create guidelines');
    }
  };

  const updateGuidelines = async (id: string, guidelines: string) => {
    try {
      const res = await apiCall(`/api/super-admin/guidelines/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ guidelines })
      });

      if (res.ok) {
        await fetchGuidelines();
        setShowGuidelinesModal(false);
        setGuidelinesModalData({ id: '', contentType: '', guidelines: '' });
        alert('Guidelines updated successfully!');
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating guidelines:', error);
      alert('Failed to update guidelines');
    }
  };




  const downloadSampleCSV = () => {
    const sampleData = `name,email,contactNumber,role,courseAssigned,admins
John Doe,john.doe@example.com,+1234567890,CREATOR,"Software Engineering,Gen AI","admin1@example.com,admin2@example.com"
Jane Smith,jane.smith@example.com,+0987654321,CREATOR,"Product Management,Business Analytics/ Data Analytics","admin1@example.com"
Admin User,admin@example.com,+1122334455,ADMIN,,
Super Admin,superadmin@example.com,+9988776655,SUPER_ADMIN,,`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_users.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const downloadTemporaryPasswords = async () => {
    try {
      const response = await apiCall('/api/super-admin/users/temporary-passwords/download', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `temporary-passwords-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to download temporary passwords');
      }
    } catch (error) {
      console.error('Error downloading temporary passwords:', error);
      alert('Failed to download temporary passwords');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      setBulkCreateResults(null); // Clear previous results
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleCSVUpload = async () => {
    if (!selectedFile) {
      alert('Please select a CSV file');
      return;
    }

    setUploadingCSV(true);
    
    try {
      // Read file content
      const fileContent = await selectedFile.text();
      
      const res = await apiCall('/api/super-admin/users/bulk-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ csvData: fileContent })
      });

      const results = await res.json();
      setBulkCreateResults(results);
      
      if (res.ok) {
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        // Refresh user list
        await fetchAllUsers();
      }
    } catch (error) {
      console.error('Error creating users:', error);
      alert('Failed to create users');
    } finally {
      setUploadingCSV(false);
    }
  };

  // Removed unused handleBulkUserCreate function

  const handleIndividualUserCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    const role = formData.get('role') as string;

    const userData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      contactNumber: formData.get('contactNumber') as string || null,
      role: role,
      courseAssigned: role === 'CREATOR' && selectedCourses.length > 0 ? selectedCourses.join(',') : null,
      adminMapped: role === 'CREATOR' ? selectedAdmins : null, // Use selected admins array for creators
    };

    try {
      const res = await apiCall('/api/super-admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });

      if (res.ok) {
        const response = await res.json();
        setShowIndividualUserForm(false);
        setSelectedAdmins([]); // Reset selected admins
        setSelectedCourses([]); // Reset selected courses
        alert(`User created successfully!\n\nGenerated Password: ${response.defaultPassword}\n\nThe password follows the pattern: FirstName@123\nYou can send credentials to the user via email.`);
        // Refresh user list
        await fetchAllUsers();
        // Refresh other data if needed
        if (activeTab === 'users') {
          await fetchCreatorAnalytics();
          await fetchAdmins();
        }
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user');
    }
  };

  const handleUserUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    const role = formData.get('role') as string;

    const userData = {
      name: formData.get('name') as string,
      contactNumber: formData.get('contactNumber') as string || null,
      role: role,
      courseAssigned: role === 'CREATOR' && editSelectedCourses.length > 0 ? editSelectedCourses.join(',') : null,
      adminMapped: role === 'CREATOR' ? editSelectedAdmins : null, // Use edit selected admins array
      isActive: formData.get('isActive') === 'true',
    };

    try {
      const res = await apiCall(`/api/super-admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });

      if (res.ok) {
        await res.json();
        setShowEditUserModal(false);
        setSelectedUser(null);
        setEditSelectedAdmins([]); // Reset edit selected admins
        alert('User updated successfully!');
        await fetchAllUsers();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
    }
  };



  const updateCreatorAdmin = async (creatorId: string, adminId: string | null) => {
    try {
      const res = await apiCall(`/api/super-admin/creators/${creatorId}/admin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ adminId })
      });

      if (res.ok) {
        fetchCreatorAnalytics();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating creator admin:', error);
      alert('Failed to update admin assignment');
    }
  };

  // Filter users based on search query, status, and course
  const filteredUsers = allUsers.filter(user => {
    // Search filter (name or email)
    const matchesSearch = searchQuery === '' ||
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && user.isActive) ||
      (statusFilter === 'inactive' && !user.isActive);

    // Course filter
    const matchesCourse = courseFilter === 'all' ||
      (user.courseAssigned && user.courseAssigned.includes(courseFilter));

    return matchesSearch && matchesStatus && matchesCourse;
  });

  return (
    <DashboardLayout
      user={user}
      activeView={activeTab}
      onNavigate={handleSidebarNavigation}
      onLogout={onLogout}
    >
      {isTabTransitioning ? (
        <div className="relative w-full h-full min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="absolute inset-0 flex items-center justify-center">
            <LoaderOverlay type="guardrail" size="lg" />
          </div>
        </div>
      ) : (
      <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 min-h-full">
          <>
            {/* Analytics Dashboard Tab */}
            {activeTab === 'analytics' && (
              <SuperAdminAnalytics token={token} />
            )}

            {/* Prompt Playground Tab */}
            {activeTab === 'playground' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Prompt Testing Playground</h2>
                    {currentPrompt && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Current: {currentPrompt.name} (v{currentPrompt.version}) -
                        <span className={`ml-1 ${currentPrompt.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {currentPrompt.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <select
                      value={playgroundContentType}
                      onChange={(e) => handleContentTypeChange(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="ASSIGNMENT">Assignment</option>
                      <option value="LECTURE_NOTE">Lecture Note</option>
                      <option value="PRE_READ">Pre-Read</option>
                    </select>
                    <button
                      onClick={savePrompt}
                      disabled={savingPrompt}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {savingPrompt ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Save Prompt
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Prompt Editor */}
                  <div className="space-y-6">
                    {/* Available Variables Reference */}
                    {availableVariables && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">Available Variables</h3>
                        <div className="space-y-2">
                          {availableVariables.available.map((variable: any) => (
                            <div key={variable.name} className="text-xs">
                              <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                                {`{${variable.name}}`}
                              </code>
                              <span className="ml-2 text-blue-700 dark:text-blue-300">{variable.description}</span>
                              {variable.required && (
                                <span className="ml-1 text-red-600 dark:text-red-400">*</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Usage Examples:</p>
                          {availableVariables.usage.examples.map((example: string, index: number) => (
                            <code key={index} className="block text-xs bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded mt-1 text-blue-800 dark:text-blue-200">
                              {example}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prompt Editor */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Prompt Template
                      </label>
                      <textarea
                        value={playgroundPrompt}
                        onChange={(e) => setPlaygroundPrompt(e.target.value)}
                        placeholder="Enter your prompt template here. Use {VARIABLE_NAME} for dynamic content..."
                        rows={20}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* Right Column - Test Variables and Results */}
                  <div className="space-y-6">
                    {/* Test Variables */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Test Variables</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Topic</label>
                          <input
                            type="text"
                            value={playgroundVariables.topic}
                            onChange={(e) => setPlaygroundVariables(prev => ({ ...prev, topic: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                            placeholder="e.g., Introduction to React Hooks"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Topics Taught So Far</label>
                          <input
                            type="text"
                            value={playgroundVariables.topicsTaughtSoFar}
                            onChange={(e) => setPlaygroundVariables(prev => ({ ...prev, topicsTaughtSoFar: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                            placeholder="e.g., JavaScript Basics, ES6 Features"
                          />
                        </div>



                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Content</label>
                          <textarea
                            value={playgroundVariables.content}
                            onChange={(e) => setPlaygroundVariables(prev => ({ ...prev, content: e.target.value }))}
                            rows={8}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white font-mono"
                            placeholder="Enter the content to be validated (markdown format)..."
                          />
                        </div>

                        <button
                          onClick={testPrompt}
                          disabled={testingPrompt}
                          className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {testingPrompt ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Testing Prompt...
                            </>
                          ) : (
                            'Test Prompt with Dual LLM Validation'
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Test Results */}
                    {testResults ? (
                      <>
                        {/* Test Metadata */}
                        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Test Results</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Content Type:</span>
                              <span className="ml-2 font-medium dark:text-gray-200">{testResults.testMetadata.contentType}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Processing Time:</span>
                              <span className="ml-2 font-medium dark:text-gray-200">{testResults.testMetadata.totalProcessingTime}ms</span>
                            </div>
                          </div>
                        </div>

                        {/* Final Scores */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Final Validation Scores</h3>
                          <div className="space-y-3">
                            {Object.entries(testResults.dualValidationResult.finalScore).map(([criteria, score]) => (
                              <div key={criteria} className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{criteria}:</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        (score as number) >= 80 ? 'bg-green-500' :
                                        (score as number) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${score}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-medium dark:text-gray-200 w-8">{score as number}/100</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Final Feedback */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Final Feedback</h3>
                          <div className="space-y-3">
                            {Object.entries(testResults.dualValidationResult.finalFeedback).map(([criteria, feedback]) => (
                              <div key={criteria}>
                                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize mb-1">{criteria}:</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">{feedback as string}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Round 1 vs Round 2 Comparison */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Dual LLM Validation Details</h3>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2">Round 1 (Initial)</h4>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-xs text-gray-600 dark:text-gray-400">OpenAI:</span>
                                  <div className="text-xs dark:text-gray-300 space-y-1">
                                    <div>Relevance: {testResults.dualValidationResult.round1Results.openai.scores.relevance}</div>
                                    <div>Continuity: {testResults.dualValidationResult.round1Results.openai.scores.continuity}</div>
                                    <div>Documentation: {testResults.dualValidationResult.round1Results.openai.scores.documentation}</div>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-600 dark:text-gray-400">Gemini:</span>
                                  <div className="text-xs dark:text-gray-300 space-y-1">
                                    <div>Relevance: {testResults.dualValidationResult.round1Results.gemini.scores.relevance}</div>
                                    <div>Continuity: {testResults.dualValidationResult.round1Results.gemini.scores.continuity}</div>
                                    <div>Documentation: {testResults.dualValidationResult.round1Results.gemini.scores.documentation}</div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">Round 2 (Cross-Validated)</h4>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-xs text-gray-600 dark:text-gray-400">OpenAI:</span>
                                  <div className="text-xs dark:text-gray-300 space-y-1">
                                    <div>Relevance: {testResults.dualValidationResult.round2Results.openai.scores.relevance}</div>
                                    <div>Continuity: {testResults.dualValidationResult.round2Results.openai.scores.continuity}</div>
                                    <div>Documentation: {testResults.dualValidationResult.round2Results.openai.scores.documentation}</div>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-600 dark:text-gray-400">Gemini:</span>
                                  <div className="text-xs dark:text-gray-300 space-y-1">
                                    <div>Relevance: {testResults.dualValidationResult.round2Results.gemini.scores.relevance}</div>
                                    <div>Continuity: {testResults.dualValidationResult.round2Results.gemini.scores.continuity}</div>
                                    <div>Documentation: {testResults.dualValidationResult.round2Results.gemini.scores.documentation}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Processing Time: {testResults.dualValidationResult.processingTime}ms
                            </p>
                          </div>
                        </div>

                        {/* Processed Prompt Preview */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Processed Prompt Preview</h3>
                          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-xs dark:text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {testResults.processedPrompt}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

              </div>
            )}

            {/* Guidelines Management Tab */}
            {activeTab === 'guidelines' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  
                  
                  <div className="flex items-center gap-3" style={{ textAlign: 'left' }}>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Content Type:</label>
                    <select
                      value={selectedGuidelinesType}
                      onChange={(e) => setSelectedGuidelinesType(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
                    >
                      <option value="ASSIGNMENT">Assignment Guidelines</option>
                      <option value="LECTURE_NOTE">Lecture Note Guidelines</option>
                      <option value="PRE_READ">Pre-Read Guidelines</option>
                    </select>
                  </div>
                </div>

                {(() => {
                  const guideline = guidelines.find(g => g.contentType === selectedGuidelinesType && g.isActive);
                  const contentTypeName = selectedGuidelinesType === 'ASSIGNMENT' ? 'Assignment' : 
                                         selectedGuidelinesType === 'LECTURE_NOTE' ? 'Lecture Note' : 
                                         'Pre-Read';
                  
                  return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <div className="mb-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {contentTypeName} Guidelines
                        </h3>
                      </div>

                      {guideline ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Guidelines Content
                            </label>
                            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md p-4 max-h-96 overflow-y-auto" style={{ textAlign: 'left' }}>
                              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                                {guideline.guidelines}
                              </pre>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setGuidelinesModalMode('update');
                                setGuidelinesModalData({
                                  id: guideline.id,
                                  contentType: selectedGuidelinesType,
                                  guidelines: guideline.guidelines
                                });
                                setShowGuidelinesModal(true);
                              }}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-sm"
                            >
                              Update Guidelines
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8">
                          <p className="text-gray-500 dark:text-gray-400 mb-4">No guidelines found for {contentTypeName}</p>
                          <button
                            onClick={() => {
                              setGuidelinesModalMode('create');
                              setGuidelinesModalData({
                                id: '',
                                contentType: selectedGuidelinesType,
                                guidelines: ''
                              });
                              setShowGuidelinesModal(true);
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-sm"
                          >
                            Create Guidelines
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}


            {/* User Management Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowIndividualUserForm(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Create Individual User
                    </button>
                  </div>
                </div>

                {/* Filter Section */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Search by Name or Email
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search users..."
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                        />
                        <svg
                          className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Status Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    {/* Course Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Course
                      </label>
                      <select
                        value={courseFilter}
                        onChange={(e) => setCourseFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="all">All Courses</option>
                        <option value="Product Management">Product Management</option>
                        <option value="Artificial Intelligence/ Machine Learning">Artificial Intelligence/ Machine Learning</option>
                        <option value="Business Analytics/ Data Analytics">Business Analytics/ Data Analytics</option>
                        <option value="Fintech">Fintech</option>
                        <option value="Software Engineering">Software Engineering</option>
                        <option value="Gen AI">Gen AI</option>
                        <option value="Project Management">Project Management</option>
                        <option value="Digital Marketing">Digital Marketing</option>
                        <option value="Cyber Security">Cyber Security</option>
                        <option value="System Design">System Design</option>
                      </select>
                    </div>
                  </div>

                  {/* Clear Filters Button */}
                  {(searchQuery !== '' || statusFilter !== 'all' || courseFilter !== 'all') && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                          setCourseFilter('all');
                        }}
                        className="px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  )}
                </div>

                {/* User List */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">All Users</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Course
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Admin Mapped
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((user) => (
                            <tr key={user.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {user.name || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                {user.email}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                {user.contactNumber || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                  user.role === 'ADMIN' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                {user.courseAssigned && user.courseAssigned.length > 0 ? (
                                  <span className="text-green-600 dark:text-green-400">
                                    {user.courseAssigned.length} course{user.courseAssigned.length > 1 ? 's' : ''}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                {user.assignedAdminId && user.assignedAdminId.length > 0 ? (
                                  <span className="text-indigo-600 dark:text-indigo-400">
                                    {user.assignedAdminId.length} admin{user.assignedAdminId.length > 1 ? 's' : ''}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center gap-3">
                                  {/* Status Icon */}
                                  {user.isActive ? (
                                    <svg
                                      className="w-5 h-5 text-green-500"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                      title="Active"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  ) : (
                                    <svg
                                      className="w-5 h-5 text-red-500"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                      title="Inactive"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}

                                  <button
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setShowViewUserModal(true);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedUser(user);
                                      // Initialize edit selected admins with current admin IDs converted to emails
                                      if (user.assignedAdminId && user.assignedAdminId.length > 0) {
                                        const adminEmails = user.assignedAdminId
                                          .map((id: string) => allUsers.find((u: any) => u.id === id)?.email)
                                          .filter((email: string | undefined): email is string => !!email);
                                        setEditSelectedAdmins(adminEmails);
                                      } else {
                                        setEditSelectedAdmins([]);
                                      }
                                      // Initialize edit selected courses with current courses
                                      if (user.courseAssigned && user.courseAssigned.length > 0) {
                                        setEditSelectedCourses(user.courseAssigned);
                                      } else {
                                        setEditSelectedCourses([]);
                                      }
                                      setShowEditUserModal(true);
                                    }}
                                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Send credentials email to ${user.email}?`)) {
                                        try {
                                          const res = await apiCall(`/api/super-admin/users/${user.id}/send-credentials`, {
                                            method: 'POST',
                                            headers: {
                                              Authorization: `Bearer ${token}`
                                            }
                                          });

                                          if (res.ok) {
                                            alert('Credentials email sent successfully!');
                                          } else {
                                            const error = await res.json();
                                            alert(`Error: ${error.error}`);
                                          }
                                        } catch (error) {
                                          console.error('Error sending email:', error);
                                          alert('Failed to send credentials email');
                                        }
                                      }
                                    }}
                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                    title="Send credentials email"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                              No users found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {bulkCreateResults && (
                  <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Creation Results</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          ✓ {bulkCreateResults.created} users created successfully
                        </span>
                        {bulkCreateResults.errors.length > 0 && (
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            ✗ {bulkCreateResults.errors.length} errors
                          </span>
                        )}
                      </div>
                      
                      {bulkCreateResults.users.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">Created Users (with temporary passwords):</h4>
                            <button
                              onClick={downloadTemporaryPasswords}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 flex items-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download All
                            </button>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md max-h-64 overflow-y-auto">
                            {bulkCreateResults.users.map((user: any) => (
                              <div key={user.id} className="text-sm text-gray-800 dark:text-gray-200 mb-1">
                                {user.email} - Password: <code className="bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-200 px-1 rounded">{user.tempPassword}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {bulkCreateResults.errors.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-900 dark:text-red-300 mb-2">Errors:</h4>
                          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md max-h-32 overflow-y-auto">
                            {bulkCreateResults.errors.map((error: string, index: number) => (
                              <div key={index} className="text-sm text-red-800 dark:text-red-300 mb-1">
                                {error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div id="bulk-upload-section" className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4" style={{ textAlign: 'left' }}  >Bulk User Upload</h3>

                  <div className="space-y-4">
                    {/* Sample File Download */}
                    <div>
                      <button
                        onClick={downloadSampleCSV}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Sample CSV
                      </button>
                    </div>

                    {/* File Upload */}
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="csv-upload"
                      />
                      <label htmlFor="csv-upload" className="cursor-pointer">
                        <div className="space-y-2">
                          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                              Click to upload
                            </span>
                            {' '}or drag and drop
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">CSV files only</p>
                        </div>
                      </label>
                    </div>

                    {/* Selected File Display */}
                    {selectedFile && (
                      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-green-900 dark:text-green-300">{selectedFile.name}</p>
                            <p className="text-xs text-green-700 dark:text-green-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Upload Button */}
                    {selectedFile && (
                      <button
                        onClick={handleCSVUpload}
                        disabled={uploadingCSV}
                        className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {uploadingCSV ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Processing CSV...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Upload and Create Users
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {bulkCreateResults && (
                  <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Creation Results</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          ✓ {bulkCreateResults.created} users created successfully
                        </span>
                        {bulkCreateResults.errors.length > 0 && (
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            ✗ {bulkCreateResults.errors.length} errors
                          </span>
                        )}
                      </div>
                      
                      {bulkCreateResults.users.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">Created Users (with temporary passwords):</h4>
                            <button
                              onClick={downloadTemporaryPasswords}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 flex items-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download All
                            </button>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md max-h-64 overflow-y-auto">
                            {bulkCreateResults.users.map((user: any) => (
                              <div key={user.id} className="text-sm text-gray-800 dark:text-gray-200 mb-1">
                                {user.email} - Password: <code className="bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-200 px-1 rounded">{user.tempPassword}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {bulkCreateResults.errors.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-900 dark:text-red-300 mb-2">Errors:</h4>
                          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md max-h-32 overflow-y-auto">
                            {bulkCreateResults.errors.map((error: string, index: number) => (
                              <div key={index} className="text-sm text-red-800 dark:text-red-300 mb-1">
                                {error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Creator Analytics - Removed, merged into Users tab */}
            {false && activeTab === 'analytics' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">Creator Analytics & Management</h2>

                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Creator
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned Admin
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Content
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status Breakdown
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Activity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {creators.map((creator) => (
                        <tr key={creator.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{creator.name}</div>
                              <div className="text-sm text-gray-500">{creator.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={creator.assignedAdmin?.id || ''}
                              onChange={(e) => updateCreatorAdmin(creator.id, e.target.value || null)}
                              className="text-sm border border-gray-300 rounded-md px-2 py-1"
                            >
                              <option value="">No Admin Assigned</option>
                              {admins.map((admin) => (
                                <option key={admin.id} value={admin.id}>
                                  {admin.name} ({admin._count.assignedCreators} creators)
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {creator.contentStats.total}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="space-y-1">
                              {Object.entries(creator.contentStats.byStatus).map(([status, count]) => (
                                <div key={status} className="flex items-center gap-2">
                                  <span className={`inline-block w-2 h-2 rounded-full ${
                                    status === 'APPROVED' ? 'bg-green-400' :
                                    status === 'REJECTED' ? 'bg-red-400' :
                                    status === 'REVIEW' ? 'bg-yellow-400' :
                                    'bg-gray-400'
                                  }`}></span>
                                  <span className="text-xs">{status}: {count}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {creator.lastContentCreated 
                              ? new Date(creator.lastContentCreated).toLocaleDateString()
                              : 'Never'
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-indigo-600 hover:text-indigo-900">
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <Settings user={user} token={token} />
            )}
          </>

        {/* View User Modal */}
        {showViewUserModal && selectedUser && (
          <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">User Details</h3>
                <button
                  onClick={() => setShowViewUserModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Full Name</label>
                    <p className="text-base text-gray-900 dark:text-white">{selectedUser.name || '-'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
                    <p className="text-base text-gray-900 dark:text-white">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Contact Number</label>
                    <p className="text-base text-gray-900 dark:text-white">{selectedUser.contactNumber || '-'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Role</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedUser.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                      selectedUser.role === 'ADMIN' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {selectedUser.role}
                    </span>
                  </div>
                </div>

                {selectedUser.role === 'CREATOR' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Course{selectedUser.courseAssigned && selectedUser.courseAssigned.length > 1 ? 's' : ''} Assigned</label>
                        {selectedUser.courseAssigned && selectedUser.courseAssigned.length > 0 ? (
                          <div className="space-y-1">
                            {selectedUser.courseAssigned.map((course: string, idx: number) => (
                              <p key={idx} className="text-base text-gray-900 dark:text-white">
                                • {course}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-base text-gray-500 dark:text-gray-400">-</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Admin Mapped</label>
                        {selectedUser.assignedAdminId && selectedUser.assignedAdminId.length > 0 ? (
                          <div className="space-y-1">
                            {selectedUser.assignedAdminId.map((adminId: string) => {
                              const admin = allUsers.find((u: any) => u.id === adminId);
                              return admin ? (
                                <p key={adminId} className="text-base text-gray-900 dark:text-white">
                                  • {admin.name} ({admin.email})
                                </p>
                              ) : (
                                <p key={adminId} className="text-base text-gray-500 dark:text-gray-400">
                                  • Admin ID: {adminId}
                                </p>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-base text-gray-900 dark:text-white">-</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                    <div className="flex items-center gap-2">
                      {selectedUser.isActive ? (
                        <>
                          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-base text-green-600 dark:text-green-400 font-medium">Active</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <span className="text-base text-red-600 dark:text-red-400 font-medium">Inactive</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Created At</label>
                    <p className="text-base text-gray-900 dark:text-white">
                      {new Date(selectedUser.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {selectedUser.lastLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Last Login</label>
                    <p className="text-base text-gray-900 dark:text-white">
                      {new Date(selectedUser.lastLogin).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowViewUserModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditUserModal && selectedUser && (
          <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Edit User</h3>
              <form onSubmit={handleUserUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      defaultValue={selectedUser.name}
                      placeholder="John Doe"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      disabled
                      defaultValue={selectedUser.email}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contact Number
                    </label>
                    <input
                      type="tel"
                      name="contactNumber"
                      defaultValue={selectedUser.contactNumber || ''}
                      placeholder="+1 234 567 8900"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="isActive"
                      required
                      defaultValue={selectedUser.isActive ? 'true' : 'false'}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="role"
                      required
                      id="edit-role-select"
                      defaultValue={selectedUser.role}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                      onChange={(e) => {
                        const courseField = document.getElementById('edit-course-field');
                        const adminField = document.getElementById('edit-admin-field');
                        if (courseField && adminField) {
                          if (e.target.value === 'CREATOR') {
                            courseField.style.display = 'block';
                            adminField.style.display = 'block';
                          } else {
                            courseField.style.display = 'none';
                            adminField.style.display = 'none';
                          }
                        }
                      }}
                    >
                      <option value="CREATOR">Creator</option>
                      <option value="ADMIN">Admin</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  </div>

                  <div id="edit-course-field" style={{display: selectedUser.role === 'CREATOR' ? 'block' : 'none'}}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Courses <span className="text-red-500">*</span>
                    </label>

                    {/* Selected Courses Display */}
                    {editSelectedCourses.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {editSelectedCourses.map((course) => (
                          <div
                            key={course}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm"
                          >
                            <span>{course}</span>
                            <button
                              type="button"
                              onClick={() => setEditSelectedCourses(editSelectedCourses.filter(c => c !== course))}
                              className="ml-1 hover:text-green-600 dark:hover:text-green-300"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Course Dropdown */}
                    <select
                      value=""
                      onChange={(e) => {
                        const course = e.target.value;
                        if (course && !editSelectedCourses.includes(course)) {
                          setEditSelectedCourses([...editSelectedCourses, course]);
                        }
                        e.target.value = '';
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select course to add...</option>
                      {AVAILABLE_COURSES
                        .filter(course => !editSelectedCourses.includes(course))
                        .map((course) => (
                          <option key={course} value={course}>
                            {course}
                          </option>
                        ))}
                    </select>

                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      You can assign multiple courses. Select from dropdown to add.
                    </p>
                  </div>
                </div>

                <div id="edit-admin-field" style={{display: selectedUser.role === 'CREATOR' ? 'block' : 'none'}}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Assigned Admins (for Creators)
                  </label>

                  {/* Selected Admins Display */}
                  {editSelectedAdmins.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editSelectedAdmins.map((adminEmail) => {
                        const admin = admins.find(a => a.email === adminEmail);
                        return admin ? (
                          <div
                            key={admin.id}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-sm"
                          >
                            <span>{admin.name}</span>
                            <button
                              type="button"
                              onClick={() => setEditSelectedAdmins(editSelectedAdmins.filter(email => email !== adminEmail))}
                              className="ml-1 hover:text-indigo-600 dark:hover:text-indigo-300"
                            >
                              ×
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* Admin Dropdown */}
                  <select
                    value=""
                    onChange={(e) => {
                      const email = e.target.value;
                      if (email && !editSelectedAdmins.includes(email)) {
                        setEditSelectedAdmins([...editSelectedAdmins, email]);
                      }
                      e.target.value = '';
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select admin to add...</option>
                    {admins
                      .filter(admin => !editSelectedAdmins.includes(admin.email))
                      .map((admin) => (
                        <option key={admin.id} value={admin.email}>
                          {admin.name} ({admin.email})
                        </option>
                      ))}
                  </select>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    You can assign multiple admins. Select from dropdown to add, click × to remove.
                  </p>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditUserModal(false);
                      setSelectedUser(null);
                      setEditSelectedAdmins([]);
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Update User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Individual User Creation Form Modal */}
        {showIndividualUserForm && (
        <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New User</h3>
            <form onSubmit={handleIndividualUserCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="John Doe"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contact Number
                </label>
                <input
                  type="tel"
                  name="contactNumber"
                  placeholder="+1 234 567 8900"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Password Info Message */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>ℹ️ Auto-Generated Password:</strong> The system will automatically generate a password following the pattern <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">FirstName@123</code>.
                  You can send credentials to the user via email after creation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="role"
                    required
                    id="role-select"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    onChange={(e) => {
                      const courseField = document.getElementById('course-field');
                      const adminField = document.getElementById('admin-field');
                      if (courseField && adminField) {
                        if (e.target.value === 'CREATOR') {
                          courseField.style.display = 'block';
                          if (e.target.value === 'CREATOR') {
                            adminField.style.display = 'block';
                          } else {
                            adminField.style.display = 'none';
                          }
                        } else {
                          courseField.style.display = 'none';
                          adminField.style.display = 'none';
                        }
                      }
                    }}
                  >
                    <option value="">Select a role</option>
                    <option value="CREATOR">Creator</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>

                <div id="course-field" style={{display: 'none'}}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Courses <span className="text-red-500">*</span>
                  </label>

                  {/* Selected Courses Display */}
                  {selectedCourses.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedCourses.map((course) => (
                        <div
                          key={course}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm"
                        >
                          <span>{course}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedCourses(selectedCourses.filter(c => c !== course))}
                            className="ml-1 hover:text-green-600 dark:hover:text-green-300"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Course Dropdown */}
                  <select
                    value=""
                    onChange={(e) => {
                      const course = e.target.value;
                      if (course && !selectedCourses.includes(course)) {
                        setSelectedCourses([...selectedCourses, course]);
                      }
                      e.target.value = '';
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select course to add...</option>
                    {AVAILABLE_COURSES
                      .filter(course => !selectedCourses.includes(course))
                      .map((course) => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}
                  </select>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    You can assign multiple courses. Select from dropdown to add.
                  </p>
                </div>
              </div>

              <div id="admin-field" style={{display: 'none'}}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assigned Admins (for Creators)
                </label>

                {/* Selected Admins Display */}
                {selectedAdmins.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedAdmins.map((adminEmail) => {
                      const admin = admins.find(a => a.email === adminEmail);
                      return admin ? (
                        <div
                          key={admin.id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-sm"
                        >
                          <span>{admin.name}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedAdmins(selectedAdmins.filter(email => email !== adminEmail))}
                            className="ml-1 hover:text-indigo-600 dark:hover:text-indigo-300"
                          >
                            ×
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Admin Dropdown */}
                <select
                  value=""
                  onChange={(e) => {
                    const email = e.target.value;
                    if (email && !selectedAdmins.includes(email)) {
                      setSelectedAdmins([...selectedAdmins, email]);
                    }
                    e.target.value = '';
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select admin to add...</option>
                  {admins
                    .filter(admin => !selectedAdmins.includes(admin.email))
                    .map((admin) => (
                      <option key={admin.id} value={admin.email}>
                        {admin.name} ({admin.email})
                      </option>
                    ))}
                </select>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  You can assign multiple admins. Select from dropdown to add.
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowIndividualUserForm(false);
                    setSelectedAdmins([]);
                    setSelectedCourses([]);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guidelines Modal */}
      {showGuidelinesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden relative">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {guidelinesModalMode === 'create' ? 'Create Guidelines' : 'Update Guidelines'}
              </h2>
              <button
                onClick={() => {
                  setShowGuidelinesModal(false);
                  setGuidelinesModalData({ id: '', contentType: '', guidelines: '' });
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content Type
                </label>
                <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-900 dark:text-white">
                  {guidelinesModalData.contentType.replace('_', ' ')}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Guidelines <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={guidelinesModalData.guidelines}
                  onChange={(e) => setGuidelinesModalData({ ...guidelinesModalData, guidelines: e.target.value })}
                  placeholder="Enter guidelines for this content type..."
                  rows={15}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none font-mono text-sm"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Enter detailed guidelines for {guidelinesModalData.contentType.replace('_', ' ')} content creation.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowGuidelinesModal(false);
                  setGuidelinesModalData({ id: '', contentType: '', guidelines: '' });
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!guidelinesModalData.guidelines.trim()) {
                    alert('Please enter guidelines');
                    return;
                  }
                  if (guidelinesModalMode === 'create') {
                    createGuidelines(guidelinesModalData.contentType, guidelinesModalData.guidelines);
                  } else {
                    updateGuidelines(guidelinesModalData.id, guidelinesModalData.guidelines);
                  }
                }}
                className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
              >
                {guidelinesModalMode === 'create' ? 'Create' : 'Update'} Guidelines
              </button>
            </div>
          </div>
        </div>
      )}
          
          </div>
      )}
    </DashboardLayout>
  );
}
