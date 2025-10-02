import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { EditorSplit } from './EditorSplit';
import { ResultsPanel } from './ResultsPanel';
import { AssignmentTasks } from './AssignmentTasks';
import { Settings } from './Settings';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { MarkdownComponents } from '../utils/markdownComponents';

// Function to get sample reference URLs for different content types
function getSampleReferenceUrl(contentType: string): string {
  const sampleUrls = {
    'ASSIGNMENT': 'https://peerabduljabbar.notion.site/How-to-create-assignments-26f8a9082226815ea660cfa8daa074eb',
    'LECTURE_NOTE': 'https://peerabduljabbar.notion.site/Notes-Template-2798a908222680feaf41c7d794a040ea',
    'PRE_READ': 'https://peerabduljabbar.notion.site/Pre-notes-Template-2798a908222680528079eb9b80a0849a'
  };
  return sampleUrls[contentType as keyof typeof sampleUrls] || sampleUrls.LECTURE_NOTE;
}

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  assignedAdmin?: {
    id: string;
    name: string;
    email: string;
  };
};

type Content = {
  id: string;
  title: string;
  content: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'REJECTED';
  contentType: 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE';
  difficulty?: string;
  tags: string[];
  category?: string;
  wordCount: number;
  readingTime: number;
  version: number;
  rejectionCount: number;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  reviewFeedback?: string;
  createdAt: string;
  updatedAt: string;
  reviewer?: {
    id: string;
    name: string;
    email: string;
  };
};

type ValidateResponse = {
  overallScore: number;
  overallConfidence?: number;
  providers?: string[];
  processingTime?: number;
  assignmentContext?: {
    topic: string;
    topicsTaughtSoFar: string[];
    hasGuidelines: boolean;
    guidelines?: string;
  } | null;
  criteria: {
    relevance: { score: number; feedback: string; confidence?: number; issues?: any[]; suggestions?: string[] };
    continuity: { score: number; feedback: string; confidence?: number; issues?: any[]; suggestions?: string[] };
    documentation: { score: number; feedback: string; confidence?: number; issues?: any[]; suggestions?: string[] };
  };
};

type Props = {
  user: User;
  token: string;
  onLogout: () => void;
  onNavigateToContentCreation?: (taskData?: any) => void;
};

export function CreatorDashboard({ user, token, onLogout, onNavigateToContentCreation }: Props) {
  const [contents, setContents] = useState<Content[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidateResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'assignments' | 'settings'>('content');
  const [contentTypeFilter, setContentTypeFilter] = useState<'ALL' | 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'>('ALL');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Form state for new/edit content
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'>('LECTURE_NOTE');
  const [difficulty, setDifficulty] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [creatingFromAssignment, setCreatingFromAssignment] = useState<{ id: string; topic: string } | null>(null);

  useEffect(() => {
    fetchContents();
    
    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchContents();
    }, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchContents = async () => {
    try {
      const res = await apiCall('/api/content', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setContents(data.contents);
      }
    } catch (error) {
      console.error('Failed to fetch contents:', error);
    }
  };

  const createContent = async () => {
    try {
      const res = await apiCall('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          content,
          contentType,
          difficulty: difficulty || undefined,
          tags,
          category: category || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setContents([data.content, ...contents]);
        setSelectedContent(data.content);
        resetForm();
        setIsCreating(false);
        alert('Content created successfully!');
      } else {
        const error = await res.json();
        alert(`Failed to create content: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create content:', error);
      alert('Failed to create content');
    }
  };

  const submitForReview = async (contentId: string) => {
    setIsSubmitting(true);
    try {
      const res = await apiCall('/api/content/submit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ contentId })
      });

      if (res.ok) {
        const data = await res.json();
        setContents(contents.map(c => c.id === contentId ? data.content : c));
        if (selectedContent?.id === contentId) {
          setSelectedContent(data.content);
        }
        alert('Content submitted for review!');
      } else {
        const error = await res.json();
        alert(`Failed to submit: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to submit:', error);
      alert('Failed to submit content');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateContent = async (contentId: string, updatedData: { title: string; content: string; contentType?: string; difficulty?: string }) => {
    try {
      const res = await apiCall(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updatedData),
      });

      if (res.ok) {
        const data = await res.json();
        // Update the content in the list
        setContents(contents.map(c => c.id === contentId ? data.content : c));
        if (selectedContent?.id === contentId) {
          setSelectedContent(data.content);
        }
        setEditingContent(null);
        alert('Content updated successfully!');
      } else {
        const error = await res.json();
        alert(`Failed to update content: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to update content:', error);
      alert('Failed to update content');
    }
  };

  const validateContent = async () => {
    if (!selectedContent) return;
    
    setIsValidating(true);
    setValidationError(null);
    
    try {
      const res = await apiCall('/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: selectedContent.content,
          options: {
            contentId: selectedContent.id
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        setValidationResult(data);
      } else {
        const error = await res.json();
        setValidationError(error.error || 'Validation failed');
      }
    } catch (error) {
      console.error('Validation error:', error);
      setValidationError('Network error during validation');
    } finally {
      setIsValidating(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setContentType('LECTURE_NOTE');
    setDifficulty('');
    setTags([]);
    setCategory('');
  };


  const startCreating = () => {
    setIsCreating(true);
    setSelectedContent(null);
    resetForm();
    setCreatingFromAssignment(null);
  };

  const selectContent = (content: Content) => {
    setSelectedContent(content);
    setIsCreating(false);
    setValidationResult(null);
  };

  const handleCreateContentFromAssignment = (assignment: any) => {
    if (onNavigateToContentCreation) {
      const taskData = {
        taskId: assignment.id,
        topic: assignment.topic,
        contentType: assignment.contentType,
        guidelines: assignment.guidelines,
        topicsTaughtSoFar: assignment.topicsTaughtSoFar,
        // Include existing content data for revision
        existingContent: assignment.content ? {
          id: assignment.content.id,
          title: assignment.content.title,
          content: assignment.content.content || '',
          reviewFeedback: assignment.content.reviewFeedback || ''
        } : null
      };
      onNavigateToContentCreation(taskData);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'REVIEW': return 'bg-orange-100 text-orange-600';
      case 'APPROVED': return 'bg-green-100 text-green-600';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-background-light font-sans text-text-light">
      {/* Header */}
      <header className="bg-surface-light border-b border-border-light px-4 md:px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg md:text-xl font-bold text-text-light">Content Validator</h2>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          {/* Navigation */}
          <nav className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => setActiveTab('content')}
              className={`px-2 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${
                activeTab === 'content'
                  ? 'text-subtle-light bg-gray-100'
                  : 'text-subtle-light hover:bg-gray-100'
              }`}
            >
              <span className="hidden sm:inline">My </span>Content
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-2 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${
                activeTab === 'assignments'
                  ? 'text-subtle-light bg-gray-100'
                  : 'text-subtle-light hover:bg-gray-100'
              }`}
            >
              Tasks
            </button>
          </nav>

          {/* User Info */}
          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-left hidden lg:block"><p className="text-sm font-medium">Welcome, {user.name}</p></div>
            <button 
              onClick={() => setActiveTab('settings')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              title="Settings"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-2 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium bg-gray-200 text-text-light hover:bg-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        {activeTab === 'assignments' ? (
          <div className="w-full">
            <AssignmentTasks 
              user={user} 
              token={token} 
              onCreateContent={handleCreateContentFromAssignment}
            />
          </div>
        ) : activeTab === 'settings' ? (
          <Settings 
            user={user} 
            token={token} 
            onBack={() => setActiveTab('content')} 
          />
        ) : (
          <>
            <div className="flex flex-col lg:flex-row gap-6 h-full">
            {/* Left Sidebar - Content List */}
            <aside className={`${sidebarCollapsed ? 'lg:w-16' : 'lg:w-80'} w-full lg:flex-shrink-0 flex flex-col gap-6 transition-all duration-300 ease-in-out`}>
              <div className="bg-surface-light p-4 rounded-lg shadow-sm flex flex-col gap-4 h-full">
                {sidebarCollapsed && (
                  <div className="flex flex-col items-center gap-4">
                    <button
                      onClick={startCreating}
                      className="bg-purple-600 text-white p-2 rounded-md hover:bg-purple-700 transition-colors"
                      title="Create new content"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <div className="text-xs text-gray-500 text-left">
                      {contents.length} items
                    </div>
                  </div>
                )}
                {!sidebarCollapsed && (
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">My Content</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={startCreating}
                        className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-purple-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New
                      </button>
                      <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        title="Collapse sidebar"
                      >
                        <svg 
                          className="w-4 h-4 transition-transform duration-200" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                
                {sidebarCollapsed && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                      title="Expand sidebar"
                    >
                      <svg 
                        className="w-4 h-4 transition-transform duration-200 rotate-180" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                  </div>
                )}
                {!sidebarCollapsed && (
                  <>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setContentTypeFilter('ALL')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium w-full text-left ${
                          contentTypeFilter === 'ALL'
                            ? 'bg-gray-200'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setContentTypeFilter('LECTURE_NOTE')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium w-full text-left ${
                          contentTypeFilter === 'LECTURE_NOTE'
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Lecture Note
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setContentTypeFilter('PRE_READ')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium w-full text-left ${
                          contentTypeFilter === 'PRE_READ'
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Pre Read
                      </button>
                      <button
                        onClick={() => setContentTypeFilter('ASSIGNMENT')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium w-full text-left ${
                          contentTypeFilter === 'ASSIGNMENT'
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Assignment
                      </button>
                    </div>
                    <div className="border-t border-border-light -mx-4"></div>
                  </>
                )}
                
                {!sidebarCollapsed && (
                  <>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 -mr-2">
                      {contents.filter(content => 
                        contentTypeFilter === 'ALL' || content.contentType === contentTypeFilter
                      ).map((content) => (
                        <div
                          key={content.id}
                          onClick={() => selectContent(content)}
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            selectedContent?.id === content.id 
                              ? 'border-purple-500 bg-purple-50' 
                              : 'border-border-light hover:bg-gray-50'
                          }`}
                        >
                          <h3 className="font-semibold">{content.title}</h3>
                          <div className="flex justify-between items-center mt-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(content.status)}`}>
                                {content.status}
                              </span>
                              
                            </div>
                            <span className="text-xs text-gray-600">
                              {new Date(content.updatedAt).toLocaleDateString('en-GB')}
                            </span>
                          </div>
                        </div>
                      ))}
                      
                      {contents.filter(content => 
                        contentTypeFilter === 'ALL' || content.contentType === contentTypeFilter
                      ).length === 0 && (
                        <div className="text-left py-12 text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm">No content yet</p>
                          <p className="text-xs text-gray-400">Create your first piece</p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="font-semibold text-gray-600">Assigned Reviewer</h3>
                      {user.assignedAdmin ? (
                        <div className="mt-2 text-sm">
                          <div className="font-medium text-text-light">{user.assignedAdmin.name}</div>
                          <div className="text-subtle-light text-xs">{user.assignedAdmin.email}</div>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-subtle-light">Not assigned</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </aside>

            {/* Center Content Area */}
            <section className="flex-1 bg-surface-light p-6 rounded-lg shadow-sm min-h-0 flex flex-col">
              {isCreating ? (
                // New Content Creation Form
                <div className="space-y-6">
                  <h1 className="text-xl font-semibold text-text-light">Create New Content</h1>

                  <div>
                    <label className="block text-sm font-medium text-text-light mb-2">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter content title..."
                    />
                  </div>


                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-light mb-2">Content Type</label>
                      <select
                        value={contentType}
                        onChange={(e) => setContentType(e.target.value as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE')}
                        className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="LECTURE_NOTE">Lecture Note</option>
                        <option value="PRE_READ">Pre-read</option>
                        <option value="ASSIGNMENT">Assignment</option>
                      </select>
                    </div>

                    {contentType === 'ASSIGNMENT' && (
                      <div>
                        <label className="block text-sm font-medium text-text-light mb-2">Difficulty</label>
                        <select
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value)}
                          className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="">Select difficulty...</option>
                          <option value="EASY">Easy</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HARD">Hard</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Sample Reference Links - Only for Content Creators */}
                  {user.role === 'CREATOR' && (
                    <div>
                      <label className="block text-sm font-medium text-text-light mb-2">
                        Sample Reference
                      </label>
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-800 mb-1">Need inspiration?</p>
                            <p className="text-sm text-blue-700 mb-2">
                              Check out this sample {contentType.replace('_', ' ').toLowerCase()} to understand the expected format and structure:
                            </p>
                            <a
                              href={getSampleReferenceUrl(contentType)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              View Sample {contentType.replace('_', ' ')}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-light mb-2">Content</label>
                    <EditorSplit value={content} onChange={setContent} issues={[]} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-light mb-2">Tags</label>
                      <input
                        type="text"
                        value={tags.join(', ')}
                        onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                        className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="react, hooks, javascript"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-light mb-2">Category</label>
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="tutorial, guide, reference"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-2 text-text-light border border-border-light rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        await createContent();
                        // If created from assignment, link it
                        if (creatingFromAssignment && contents[0]) {
                          try {
                            const created = contents[0];
                            await apiCall(`/api/assignments/${creatingFromAssignment.id}/link-content`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ contentId: created.id })
                            });
                          } catch {}
                        }
                        setCreatingFromAssignment(null);
                      }}
                      disabled={!title.trim() || !content.trim()}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300"
                    >
                      {creatingFromAssignment ? 'Create & Link' : 'Create Content'}
                    </button>
                  </div>
                </div>
              ) : selectedContent ? (
                // Selected Content View
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2">
                      <h2 className="text-xl font-semibold text-text-light mb-2">{selectedContent.title}</h2>
                      <div className="flex items-center gap-3 text-sm text-subtle-light">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(selectedContent.status)}`}>{selectedContent.status}</span>
                        <span>{selectedContent.wordCount} words</span>
                        <span>{selectedContent.readingTime} min read</span>
                        <span>v{selectedContent.version}</span>
                      </div>
                    </div>
                    <div className="col-span-1 text-left">
                      {selectedContent.status === 'REJECTED' && !editingContent ? (
                        <button
                          onClick={() => {
                            setEditingContent(selectedContent);
                            setTitle(selectedContent.title);
                            setContent(selectedContent.content);
                            setContentType(selectedContent.contentType);
                            setDifficulty(selectedContent.difficulty || '');
                          }}
                          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                        >
                          Edit Content
                        </button>
                      ) : selectedContent.status === 'DRAFT' && !editingContent ? (
                        <button
                          onClick={() => submitForReview(selectedContent.id)}
                          disabled={isSubmitting}
                          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300"
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit for Review'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Admin Feedback Section */}
                  {selectedContent.status === 'REJECTED' && selectedContent.reviewFeedback && (
                    <div className=" p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-red-800 mb-2">
                            Admin Feedback - Content Needs Revision
                          </h4>
                          <div className="text-sm text-red-700 bg-white p-3 rounded border border-red-200 whitespace-pre-wrap">
                            {selectedContent.reviewFeedback}
                          </div>
                          {selectedContent.reviewedAt && (
                            <p className="text-xs text-red-600 mt-2">
                              Reviewed on {new Date(selectedContent.reviewedAt).toLocaleDateString()} at {new Date(selectedContent.reviewedAt).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Approval Feedback Section */}
                  {selectedContent.status === 'APPROVED' && selectedContent.reviewFeedback && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-green-800 mb-2">
                            Admin Feedback - Content Approved
                          </h4>
                          <div className="text-sm text-green-700 bg-white p-3 rounded border border-green-200 whitespace-pre-wrap">
                            {selectedContent.reviewFeedback}
                          </div>
                          {selectedContent.reviewedAt && (
                            <p className="text-xs text-green-600 mt-2">
                              Reviewed on {new Date(selectedContent.reviewedAt).toLocaleDateString()} at {new Date(selectedContent.reviewedAt).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {editingContent?.id === selectedContent.id ? (
                    // Edit Form
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-text-light mb-2">Title</label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>


                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-text-light mb-2">Content Type</label>
                          <select
                            value={contentType}
                            onChange={(e) => setContentType(e.target.value as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE')}
                            className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="LECTURE_NOTE">Lecture Note</option>
                            <option value="PRE_READ">Pre-read</option>
                            <option value="ASSIGNMENT">Assignment</option>
                          </select>
                        </div>
                        {contentType === 'ASSIGNMENT' && (
                          <div>
                            <label className="block text-sm font-medium text-text-light mb-2">Difficulty</label>
                            <select
                              value={difficulty}
                              onChange={(e) => setDifficulty(e.target.value)}
                              className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                              <option value="">Select difficulty...</option>
                              <option value="EASY">Easy</option>
                              <option value="MEDIUM">Medium</option>
                              <option value="HARD">Hard</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-light mb-2">Content</label>
                        <EditorSplit value={content} onChange={setContent} issues={[]} />
                      </div>

                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => {
                            setEditingContent(null);
                          }}
                          className="px-4 py-2 text-text-light border border-border-light rounded-md hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => updateContent(selectedContent.id, { title, content, contentType, difficulty })}
                          disabled={!title.trim() || !content.trim()}
                          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300"
                        >
                          Update Content
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Read-only content summary
                    <div className="space-y-2 flex-1 min-h-0 flex flex-col">
                      <div className="bg-white border border-gray-200 rounded-lg flex-1 overflow-auto min-h-0">
                        <div className="p-4 text-left max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={MarkdownComponents}
                          >
                            {selectedContent.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Empty State - No Content Selected  
                <div className="text-left">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium">No Content Selected</h3>
                  <p className="mt-1 text-sm text-gray-600">Select content from the sidebar or create new content to get started.</p>
                  <button
                    onClick={startCreating}
                    className="mt-6 bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors"
                  >
                    Create New Content
                  </button>
                </div>
              )}
            </section>

            {/* Right Validation Panel */}
            <aside className="w-80">
              <ResultsPanel
                result={validationResult}
                onValidate={validateContent}
                isValidating={isValidating}
                validationError={validationError}
              />
            </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}