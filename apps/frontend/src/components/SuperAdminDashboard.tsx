import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';

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
  _count: {
    assignedCreators: number;
  };
};

type Props = {
  user: User;
  token: string;
  onLogout: () => void;
};

export function SuperAdminDashboard({ user, token, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<'playground' | 'guidelines' | 'users' | 'analytics'>('playground');
  // Removed unused prompts state
  const [guidelines, setGuidelines] = useState<GuidelinesTemplate[]>([]);
  const [creators, setCreators] = useState<CreatorAnalytics[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  // Removed unused showUserForm state
  const [showIndividualUserForm, setShowIndividualUserForm] = useState(false);
  
  // Removed unused csvData state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [bulkCreateResults, setBulkCreateResults] = useState<any>(null);
  
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
    console.log('Fetching all users...');
    const res = await apiCall('/api/super-admin/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Users API response status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Users data received:', data);
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
    const sampleData = `email,role,admin_mapped
creator1@example.com,CREATOR,admin@example.com
creator2@example.com,CREATOR,admin@example.com
admin2@example.com,ADMIN,
superadmin@example.com,SUPER_ADMIN,`;

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
    
    const userData = {
      email: formData.get('email') as string,
      role: formData.get('role') as string,
      password: formData.get('password') as string,
      adminMapped: formData.get('adminMapped') as string || null,
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
        await res.json(); // Response not used
        setShowIndividualUserForm(false);
        alert(`User created successfully! The user can now log in with their email and the password you set.`);
        // Refresh user list
        await fetchAllUsers();
        // Refresh other data if needed
        if (activeTab === 'analytics') {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{user.name}</div>
            
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <nav className="px-6">
          <div className="flex space-x-8">
            {[
              { id: 'playground', label: 'Prompt Playground' },
              { id: 'guidelines', label: 'Guidelines Management' },
              { id: 'users', label: 'User Management' },
              { id: 'analytics', label: 'Creator Analytics' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Content */}
      <main className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>

            {/* Prompt Playground Tab */}
            {activeTab === 'playground' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Prompt Testing Playground</h2>
                    {currentPrompt && (
                      <p className="text-sm text-gray-600 mt-1">
                        Current: {currentPrompt.name} (v{currentPrompt.version}) - 
                        <span className={`ml-1 ${currentPrompt.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                          {currentPrompt.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <select
                      value={playgroundContentType}
                      onChange={(e) => handleContentTypeChange(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="ASSIGNMENT">Assignment</option>
                      <option value="LECTURE_NOTE">Lecture Note</option>
                      <option value="PRE_READ">Pre-Read</option>
                    </select>
                    <button
                      onClick={savePrompt}
                      disabled={savingPrompt}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-blue-900 mb-3">Available Variables</h3>
                        <div className="space-y-2">
                          {availableVariables.available.map((variable: any) => (
                            <div key={variable.name} className="text-xs">
                              <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">
                                {`{${variable.name}}`}
                              </code>
                              <span className="ml-2 text-blue-700">{variable.description}</span>
                              {variable.required && (
                                <span className="ml-1 text-red-600">*</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <p className="text-xs text-blue-700 font-medium">Usage Examples:</p>
                          {availableVariables.usage.examples.map((example: string, index: number) => (
                            <code key={index} className="block text-xs bg-blue-100 px-2 py-1 rounded mt-1 text-blue-800">
                              {example}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prompt Editor */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prompt Template
                      </label>
                      <textarea
                        value={playgroundPrompt}
                        onChange={(e) => setPlaygroundPrompt(e.target.value)}
                        placeholder="Enter your prompt template here. Use {VARIABLE_NAME} for dynamic content..."
                        rows={20}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* Right Column - Test Variables and Results */}
                  <div className="space-y-6">
                    {/* Test Variables */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-4">Test Variables</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Topic</label>
                          <input
                            type="text"
                            value={playgroundVariables.topic}
                            onChange={(e) => setPlaygroundVariables(prev => ({ ...prev, topic: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., Introduction to React Hooks"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Topics Taught So Far</label>
                          <input
                            type="text"
                            value={playgroundVariables.topicsTaughtSoFar}
                            onChange={(e) => setPlaygroundVariables(prev => ({ ...prev, topicsTaughtSoFar: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., JavaScript Basics, ES6 Features"
                          />
                        </div>



                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Content</label>
                          <textarea
                            value={playgroundVariables.content}
                            onChange={(e) => setPlaygroundVariables(prev => ({ ...prev, content: e.target.value }))}
                            rows={8}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                            placeholder="Enter the content to be validated (markdown format)..."
                          />
                        </div>

                        <button
                          onClick={testPrompt}
                          disabled={testingPrompt}
                          className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-gray-900 mb-3">Test Results</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Content Type:</span>
                              <span className="ml-2 font-medium">{testResults.testMetadata.contentType}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Processing Time:</span>
                              <span className="ml-2 font-medium">{testResults.testMetadata.totalProcessingTime}ms</span>
                            </div>
                          </div>
                        </div>

                        {/* Final Scores */}
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-gray-900 mb-3">Final Validation Scores</h3>
                          <div className="space-y-3">
                            {Object.entries(testResults.dualValidationResult.finalScore).map(([criteria, score]) => (
                              <div key={criteria} className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 capitalize">{criteria}:</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        (score as number) >= 80 ? 'bg-green-500' :
                                        (score as number) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${score}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-medium w-8">{score as number}/100</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Final Feedback */}
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-gray-900 mb-3">Final Feedback</h3>
                          <div className="space-y-3">
                            {Object.entries(testResults.dualValidationResult.finalFeedback).map(([criteria, feedback]) => (
                              <div key={criteria}>
                                <h4 className="text-xs font-medium text-gray-700 capitalize mb-1">{criteria}:</h4>
                                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">{feedback as string}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Round 1 vs Round 2 Comparison */}
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-gray-900 mb-3">Dual LLM Validation Details</h3>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-medium text-blue-700 mb-2">Round 1 (Initial)</h4>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-xs text-gray-600">OpenAI:</span>
                                  <div className="text-xs space-y-1">
                                    <div>Relevance: {testResults.dualValidationResult.round1Results.openai.scores.relevance}</div>
                                    <div>Continuity: {testResults.dualValidationResult.round1Results.openai.scores.continuity}</div>
                                    <div>Documentation: {testResults.dualValidationResult.round1Results.openai.scores.documentation}</div>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-600">Gemini:</span>
                                  <div className="text-xs space-y-1">
                                    <div>Relevance: {testResults.dualValidationResult.round1Results.gemini.scores.relevance}</div>
                                    <div>Continuity: {testResults.dualValidationResult.round1Results.gemini.scores.continuity}</div>
                                    <div>Documentation: {testResults.dualValidationResult.round1Results.gemini.scores.documentation}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-xs font-medium text-green-700 mb-2">Round 2 (Cross-Validated)</h4>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-xs text-gray-600">OpenAI:</span>
                                  <div className="text-xs space-y-1">
                                    <div>Relevance: {testResults.dualValidationResult.round2Results.openai.scores.relevance}</div>
                                    <div>Continuity: {testResults.dualValidationResult.round2Results.openai.scores.continuity}</div>
                                    <div>Documentation: {testResults.dualValidationResult.round2Results.openai.scores.documentation}</div>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-600">Gemini:</span>
                                  <div className="text-xs space-y-1">
                                    <div>Relevance: {testResults.dualValidationResult.round2Results.gemini.scores.relevance}</div>
                                    <div>Continuity: {testResults.dualValidationResult.round2Results.gemini.scores.continuity}</div>
                                    <div>Documentation: {testResults.dualValidationResult.round2Results.gemini.scores.documentation}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-600">
                              Processing Time: {testResults.dualValidationResult.processingTime}ms
                            </p>
                          </div>
                        </div>

                        {/* Processed Prompt Preview */}
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-gray-900 mb-3">Processed Prompt Preview</h3>
                          <div className="bg-gray-50 p-3 rounded text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
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
                    <label className="text-sm font-medium text-gray-700">Content Type:</label>
                    <select
                      value={selectedGuidelinesType}
                      onChange={(e) => setSelectedGuidelinesType(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
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
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                          {contentTypeName} Guidelines
                        </h3>
                      </div>

                      {guideline ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Guidelines Content
                            </label>
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 max-h-96 overflow-y-auto" style={{ textAlign: 'left' }}>
                              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                                {guideline.guidelines}
                              </pre>
                            </div>
                          </div>
                          
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                const newGuidelines = prompt('Update guidelines:', guideline.guidelines);
                                if (newGuidelines && newGuidelines !== guideline.guidelines) {
                                  updateGuidelines(guideline.id, newGuidelines);
                                }
                              }}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                            >
                              Update Guidelines
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8">
                          <p className="text-gray-500 mb-4">No guidelines found for {contentTypeName}</p>
                          <button
                            onClick={() => {
                              const newGuidelines = prompt(`Enter guidelines for ${contentTypeName}:`);
                              if (newGuidelines) {
                                createGuidelines(selectedGuidelinesType, newGuidelines);
                              }
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
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

                {/* User List */}
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">All Users</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Admin Mapped
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created At
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {/* Debug: console.log('Current allUsers state:', allUsers) */}
                        {allUsers.length > 0 ? (
                          allUsers.map((user) => (
                            <tr key={user.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {user.email}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user.name || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800' :
                                  user.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user.assignedAdmin ? (
                                  <span className="text-indigo-600">
                                    {user.assignedAdmin.name} ({user.assignedAdmin.email})
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(user.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                              No users found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {bulkCreateResults && (
                  <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Creation Results</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <span className="text-green-600 font-medium">
                          ✓ {bulkCreateResults.created} users created successfully
                        </span>
                        {bulkCreateResults.errors.length > 0 && (
                          <span className="text-red-600 font-medium">
                            ✗ {bulkCreateResults.errors.length} errors
                          </span>
                        )}
                      </div>
                      
                      {bulkCreateResults.users.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Created Users (with temporary passwords):</h4>
                          <div className="bg-gray-50 p-4 rounded-md max-h-64 overflow-y-auto">
                            {bulkCreateResults.users.map((user: any) => (
                              <div key={user.id} className="text-sm text-gray-800 mb-1">
                                {user.email} - Password: <code className="bg-yellow-100 px-1 rounded">{user.tempPassword}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {bulkCreateResults.errors.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-900 mb-2">Errors:</h4>
                          <div className="bg-red-50 p-4 rounded-md max-h-32 overflow-y-auto">
                            {bulkCreateResults.errors.map((error: string, index: number) => (
                              <div key={index} className="text-sm text-red-800 mb-1">
                                {error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div id="bulk-upload-section" className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4" style={{ textAlign: 'left' }}  >Bulk User Upload</h3>
                  
                  <div className="space-y-4">
                    {/* Sample File Download */}
                    <div>
                      <button
                        onClick={downloadSampleCSV}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Sample
                      </button>
                    </div>

                    {/* File Upload */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="csv-upload"
                      />
                      <label htmlFor="csv-upload" className="cursor-pointer">
                        <div className="space-y-2">
                          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium text-indigo-600 hover:text-indigo-500">
                              Click to upload
                            </span>
                            {' '}or drag and drop
                          </div>
                          <p className="text-xs text-gray-500">CSV files only</p>
                        </div>
                      </label>
                    </div>

                    {/* Selected File Display */}
                    {selectedFile && (
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-green-900">{selectedFile.name}</p>
                            <p className="text-xs text-green-700">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="text-green-600 hover:text-green-800"
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
                        className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Creation Results</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <span className="text-green-600 font-medium">
                          ✓ {bulkCreateResults.created} users created successfully
                        </span>
                        {bulkCreateResults.errors.length > 0 && (
                          <span className="text-red-600 font-medium">
                            ✗ {bulkCreateResults.errors.length} errors
                          </span>
                        )}
                      </div>
                      
                      {bulkCreateResults.users.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Created Users (with temporary passwords):</h4>
                          <div className="bg-gray-50 p-4 rounded-md max-h-64 overflow-y-auto">
                            {bulkCreateResults.users.map((user: any) => (
                              <div key={user.id} className="text-sm text-gray-800 mb-1">
                                {user.email} - Password: <code className="bg-yellow-100 px-1 rounded">{user.tempPassword}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {bulkCreateResults.errors.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-900 mb-2">Errors:</h4>
                          <div className="bg-red-50 p-4 rounded-md max-h-32 overflow-y-auto">
                            {bulkCreateResults.errors.map((error: string, index: number) => (
                              <div key={index} className="text-sm text-red-800 mb-1">
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

            {/* Creator Analytics Tab */}
            {activeTab === 'analytics' && (
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
          </>
        )}
      </main>

      {/* Individual User Creation Form Modal */}
      {showIndividualUserForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create Individual User</h3>
            <form onSubmit={handleIndividualUserCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  name="role"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select a role</option>
                  <option value="CREATOR">Creator</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="Enter password (minimum 6 characters)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Set a secure password for the new user
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Admin (for Creators only)
                </label>
                <select
                  name="adminMapped"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">No admin assigned</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.email}>
                      {admin.name} ({admin.email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Only required if role is Creator
                </p>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowIndividualUserForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
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

    </div>
  );
}
