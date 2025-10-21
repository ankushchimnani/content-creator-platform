import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { AssignmentManager } from './AssignmentManager';
import { Settings } from './Settings';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { MarkdownComponents } from '../utils/markdownComponents';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type ValidationResult = {
  id: string;
  llmProvider: string;
  modelVersion: string;
  criteria: {
    relevance: { score: number; feedback: string; issues: any[] };
    continuity: { score: number; feedback: string; issues: any[] };
    documentation: { score: number; feedback: string; issues: any[] };
  };
  overallScore: number;
  processingTimeMs: number;
  createdAt: string;
};

type Content = {
  id: string;
  title: string;
  content: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'REJECTED';
  tags: string[];
  category?: string;
  wordCount: number;
  readingTime: number;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  reviewFeedback?: string;
  createdAt: string;
  updatedAt: string;
  validationResults?: ValidationResult[];
  author: {
    id: string;
    name: string;
    email: string;
  };
};

type AdminStats = {
  assignedCreators: number;
  pendingReviews: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  totalReviewed: number;
  reviewRate: string;
};

type Props = {
  user: User;
  token: string;
  onLogout: () => void;
};

export function AdminDashboard({ user, token, onLogout }: Props) {
  const [reviewQueue, setReviewQueue] = useState<Content[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | ''>('');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [activeTab, setActiveTab] = useState<'review' | 'assignments' | 'assigned-creators' | 'settings'>('review');
  const [openCreateAssignment, setOpenCreateAssignment] = useState(false);
  const [tasksFilter, setTasksFilter] = useState<'all' | 'assigned' | 'review' | 'rejected' | 'approved'>('all');
  const [assignedCreators, setAssignedCreators] = useState<User[]>([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);

  useEffect(() => {
    fetchReviewQueue();
    fetchStats();
    
    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchReviewQueue();
      fetchStats();
    }, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'assigned-creators') {
      fetchAssignedCreators();
    }
  }, [activeTab]);

  // Navigation helper functions for admin dashboard
  const navigateToTab = (tab: 'review' | 'assignments' | 'assigned-creators', filter?: string) => {
    setActiveTab(tab);
    if (filter) {
      setTasksFilter(filter as any);
    }
    
    // Update URL with proper history management
    const url = new URL(window.location.href);
    url.hash = '';
    
    if (tab === 'assigned-creators') {
      url.hash = '#/assigned-creators';
    } else if (tab === 'assignments') {
      url.hash = '#/tasks';
      if (filter) {
        url.searchParams.set('filter', filter);
      }
    } else {
      url.hash = '#/review';
    }
    
    // Use pushState to add to history stack for proper back navigation
    window.history.pushState(null, '', url.toString());
  };

  // Handle URL hash changes for proper browser navigation
  useEffect(() => {
    const handleRouteChange = () => {
      const hash = window.location.hash;
      const urlParams = new URLSearchParams(window.location.search);
      
      if (hash.includes('#/assigned-creators')) {
        setActiveTab('assigned-creators');
        setTasksFilter('all');
      } else if (hash.includes('#/tasks')) {
        setActiveTab('assignments');
        const filter = urlParams.get('filter');
        if (filter && ['all', 'assigned', 'review', 'rejected', 'approved'].includes(filter)) {
          setTasksFilter(filter as any);
        } else {
          setTasksFilter('all');
        }
      } else {
        setActiveTab('review');
        setTasksFilter('all');
      }
    };

    // Set initial state from URL
    handleRouteChange();

    // Listen for both hash changes and popstate events (browser back/forward)
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  const fetchReviewQueue = async () => {
    try {
      const res = await apiCall('/api/admin/review-queue', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReviewQueue(data.reviewQueue);
      }
    } catch (error) {
      console.error('Failed to fetch review queue:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await apiCall('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchAssignedCreators = async () => {
    try {
      const res = await apiCall('/api/admin/assigned-creators', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssignedCreators(data.creators || []);
      }
    } catch (error) {
      console.error('Failed to fetch assigned creators:', error);
    }
  };

  const submitReview = async () => {
    if (!selectedContent || !reviewAction) return;

    setIsReviewing(true);
    try {
      const res = await apiCall(`/api/content/${selectedContent.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: reviewAction,
          feedback: reviewFeedback
        })
      });

      if (res.ok) {
        await res.json();
        // Remove from review queue
        setReviewQueue(reviewQueue.filter(c => c.id !== selectedContent.id));
        setSelectedContent(null);
        setReviewAction('');
        setReviewFeedback('');
        // Refresh stats and trigger real-time updates
        fetchStats();
        fetchReviewQueue(); // Refresh the queue to get latest status
        alert(`Content ${reviewAction}d successfully!`);
      } else {
        const error = await res.json();
        alert(`Failed to ${reviewAction} content: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
      alert(`Failed to ${reviewAction} content`);
    } finally {
      setIsReviewing(false);
    }
  };

  const copyContentToClipboard = async () => {
    if (!selectedContent) return;
    
    try {
      await navigator.clipboard.writeText(selectedContent.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Failed to copy content:', error);
      alert('Failed to copy content to clipboard');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'REVIEW': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };


  return (
    <div className="min-h-screen bg-background-light font-sans text-text-light">
      {/* Header */}
      <header className="bg-surface-light border-b border-border-light px-4 md:px-6 py-4 flex flex-col md:flex-row items-start md:items-center gap-4 shadow-sm">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
        </div>
        
        <div className="flex items-center justify-between flex-1 w-full md:ml-6">
          {/* Navigation */}
          <nav className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => navigateToTab('review')}
              className={`px-2 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${
                activeTab === 'review'
                  ? 'text-subtle-light bg-gray-100'
                  : 'text-subtle-light hover:bg-gray-100'
              }`}
            >
              <span className="hidden sm:inline">Review </span>Queue
            </button>
            <button
              onClick={() => navigateToTab('assignments')}
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
          <div className="flex items-center gap-2 md:gap-3">
            <div className="text-left hidden lg:block">
              <div className="text-sm font-medium text-text-light">Welcome, {user.name}</div>
              <div className="text-xs text-gray-500">Admin</div>
            </div>
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
          <AssignmentManager
            user={user}
            token={token}
            triggerCreate={openCreateAssignment}
            onCreateConsumed={() => setOpenCreateAssignment(false)}
            onSwitchToReview={async (contentId) => {
              navigateToTab('review');
              if (contentId) {
                // First try to find the content in the review queue
                let content = reviewQueue.find(c => c.id === contentId);
                
                // If not found in review queue, fetch it directly
                if (!content) {
                  try {
                    const res = await apiCall(`/api/content/${contentId}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                      const data = await res.json();
                      content = data.content;
                    }
                  } catch (error) {
                    console.error('Failed to fetch content:', error);
                    alert('Failed to load content for review');
                    return;
                  }
                }
                
                if (content) {
                  setSelectedContent(content);
                  setIsReviewMode(false); // Set to view mode by default
                } else {
                  alert('Content not found');
                }
              }
            }}
            filter={tasksFilter}
            onFilterChange={(filter) => navigateToTab('assignments', filter)}
          />
        ) : activeTab === 'assigned-creators' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Assigned Creators</h2>
              <p className="text-sm text-gray-500 mt-1">{assignedCreators.length} creators assigned to you</p>
            </div>
            
            <div className="p-6">
              {assignedCreators.length === 0 ? (
                <div className="text-left py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Creators Assigned</h3>
                  <p className="text-gray-500">You don't have any creators assigned to you yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignedCreators.map((creator) => (
                    <div key={creator.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {creator.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{creator.name}</h3>
                          <p className="text-sm text-gray-600">{creator.email}</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        <p>Role: {creator.role}</p>
                        <p>ID: {creator.id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <Settings 
            user={user} 
            token={token} 
            onBack={() => setActiveTab('review')} 
          />
        ) : (
          <>
            {/* Stats Cards */}
            {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <button 
              onClick={() => {
                setActiveTab('assigned-creators');
                fetchAssignedCreators();
                window.location.hash = '#/assigned-creators';
              }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer w-full text-left"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-3 h-3 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-2 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Assigned Creators</p>
                  <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.assignedCreators}</p>
                </div>
              </div>
            </button>

            <button 
              onClick={() => {
                setActiveTab('assignments');
                setTasksFilter('review');
                window.location.hash = '#/tasks?filter=review';
              }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer w-full text-left"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-3 h-3 sm:w-5 sm:h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-2 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Pending Reviews</p>
                  <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.pendingReviews}</p>
                </div>
              </div>
            </button>

            <button 
              onClick={() => {
                setActiveTab('assignments');
                setTasksFilter('approved');
                window.location.hash = '#/tasks?filter=approved';
              }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer w-full text-left"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-3 h-3 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-2 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Approved This Month</p>
                  <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.approvedThisMonth}</p>
                </div>
              </div>
            </button>

            <button 
              onClick={() => {
                setActiveTab('assignments');
                setTasksFilter('rejected');
                window.location.hash = '#/tasks?filter=rejected';
              }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer w-full text-left"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-3 h-3 sm:w-5 sm:h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div className="ml-2 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Rejected This Month</p>
                  <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.rejectedThisMonth}</p>
                </div>
              </div>
            </button>

            <button 
              onClick={() => {
                setActiveTab('assignments');
                setTasksFilter('approved');
                window.location.hash = '#/tasks?filter=approved';
              }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer w-full text-left"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-3 h-3 sm:w-5 sm:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-2 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Total Reviewed</p>
                  <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.totalReviewed}</p>
                </div>
              </div>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:gap-8 lg:grid-cols-4">
          {/* Review Queue */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Review Queue</h2>
                <p className="text-sm text-gray-500 mt-1">{reviewQueue.length} items pending</p>
              </div>
              
              <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                {reviewQueue.map((content) => (
                  <div
                    key={content.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      selectedContent?.id === content.id
                        ? 'border-purple-200 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div 
                      onClick={() => setSelectedContent(content)}
                      className="cursor-pointer"
                    >
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {content.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        by {content.author.name}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(content.status)}`}>
                          {content.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {content.submittedAt && new Date(content.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    {/* View Content Button */}
                    <div className="mt-3 pt-2 border-t border-gray-100">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          // Ensure we have the full content data with validation results
                          try {
                            const res = await apiCall(`/api/content/${content.id}`, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setSelectedContent(data.content);
                              setIsReviewMode(false); // Set to view mode
                            } else {
                              // Fallback to existing content if API fails
                              setSelectedContent(content);
                              setIsReviewMode(false); // Set to view mode
                            }
                          } catch (error) {
                            console.error('Failed to fetch full content:', error);
                            // Fallback to existing content
                            setSelectedContent(content);
                            setIsReviewMode(false); // Set to view mode
                          }
                        }}
                        className="w-full px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Content
                      </button>
                      
                      {/* Review Content Button - Only show for REVIEW status content */}
                      {content.status === 'REVIEW' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContent(content);
                            setIsReviewMode(true); // Set to review mode
                          }}
                          className="w-full px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-md transition-colors flex items-center justify-center gap-1 mt-2"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Review Content
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {reviewQueue.length === 0 && (
                  <div className="text-left py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm">No items to review</p>
                    <p className="text-xs text-gray-400">All caught up!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Review Area */}
          <div className="lg:col-span-3">
            {selectedContent ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2" style={{ textAlign: 'left' }}>{selectedContent.title}</h2>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>by {selectedContent.author.name}</span>
                        <span>{selectedContent.wordCount} words</span>
                        <span>{selectedContent.readingTime} min read</span>
                        <span>Submitted {selectedContent.submittedAt && new Date(selectedContent.submittedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                </div>
                
                <div className="p-6">
                  {/* Content Preview */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Content Review
                      </h3>
                      <button
                        onClick={copyContentToClipboard}
                        className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
                          copySuccess 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                        }`}
                        title="Copy content to clipboard"
                      >
                        {copySuccess ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-96">
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

                  {/* LLM Validation Results - Show only the most recent result */}
                  {selectedContent.validationResults && selectedContent.validationResults.length > 0 && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Validation Results (Most Recent)
                      </h3>
                      {(() => {
                        // Get the most recent validation result (first in the array since they're ordered by createdAt desc)
                        const mostRecentResult = selectedContent.validationResults[0];
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-blue-800">
                                Overall Score: {mostRecentResult.overallScore.toFixed(1)}/100
                              </span>
                              <span className="text-xs text-blue-600">
                                {mostRecentResult.llmProvider} • {mostRecentResult.modelVersion}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="p-3 bg-white rounded border border-blue-100">
                                <div className="text-sm font-medium text-gray-700 mb-1">Adherence to Structure</div>
                                <div className="text-lg font-semibold text-blue-600">
                                  {(mostRecentResult.criteria?.relevance?.score ?? 0).toFixed(1)}/100
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {mostRecentResult.criteria?.relevance?.feedback || 'No feedback available'}
                                </div>
                              </div>
                              
                              <div className="p-3 bg-white rounded border border-blue-100">
                                <div className="text-sm font-medium text-gray-700 mb-1">Coverage of Topics</div>
                                <div className="text-lg font-semibold text-blue-600">
                                  {(mostRecentResult.criteria?.continuity?.score ?? 0).toFixed(1)}/100
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {mostRecentResult.criteria?.continuity?.feedback || 'No feedback available'}
                                </div>
                              </div>
                              
                              <div className="p-3 bg-white rounded border border-blue-100">
                                <div className="text-sm font-medium text-gray-700 mb-1">Ease of Understanding</div>
                                <div className="text-lg font-semibold text-blue-600">
                                  {(mostRecentResult.criteria?.documentation?.score ?? 0).toFixed(1)}/100
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {mostRecentResult.criteria?.documentation?.feedback || 'No feedback available'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Content Status Information */}
                  <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-700">Content Status:</span>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        selectedContent.status === 'REVIEW' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : selectedContent.status === 'APPROVED'
                          ? 'bg-green-100 text-green-800'
                          : selectedContent.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedContent.status}
                      </span>
                    </div>
                    {selectedContent.status === 'REVIEW' && (
                      <p className="text-sm text-gray-600">
                        This content is ready for review. You can approve or reject it.
                      </p>
                    )}
                    {selectedContent.status === 'APPROVED' && (
                      <p className="text-sm text-gray-600">
                        ------------------------------------
                      </p>
                    )}
                    {selectedContent.status === 'REJECTED' && (
                      <p className="text-sm text-gray-600">
                        This content was rejected. It can only be reviewed again after the creator updates it.
                      </p>
                    )}
                    {selectedContent.status === 'DRAFT' && (
                      <p className="text-sm text-gray-600">
                        This content is still in draft status and cannot be reviewed yet.
                      </p>
                    )}
                  </div>

                  {/* Re-validate Button - Only show in review mode and for REVIEW status content */}
                  {isReviewMode && selectedContent?.status === 'REVIEW' && (
                    <div className="mb-6">
                      <button
                        onClick={async () => {
                          if (!selectedContent || isRevalidating) return;
                          
                          setIsRevalidating(true);
                          
                          try {
                            const res = await apiCall(`/api/validate/${selectedContent.id}`, {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            
                            if (res.ok) {
                              const data = await res.json();
                              // Update the selected content with new validation results
                              setSelectedContent({
                                ...selectedContent,
                                validationResults: data.validationResults
                              });
                              alert('Content re-validated successfully!');
                            } else {
                              const error = await res.json();
                              console.error('Revalidation failed:', error);
                              alert(`Failed to re-validate content: ${error.error || 'Unknown error'}`);
                            }
                          } catch (error) {
                            console.error('Failed to re-validate content:', error);
                            alert('Failed to re-validate content. Please try again.');
                          } finally {
                            setIsRevalidating(false);
                          }
                        }}
                        disabled={isRevalidating}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          isRevalidating 
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isRevalidating ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Re-validating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Re-validate with LLM
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Review Form - Only show in review mode and for REVIEW status content */}
                  {isReviewMode && selectedContent?.status === 'REVIEW' && (
                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="font-medium text-gray-900 mb-4">Review Decision</h3>
                    
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="reviewAction"
                            value="approve"
                            checked={reviewAction === 'approve'}
                            onChange={(e) => setReviewAction(e.target.value as 'approve')}
                            className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm font-medium text-green-700">Approve</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="reviewAction"
                            value="reject"
                            checked={reviewAction === 'reject'}
                            onChange={(e) => setReviewAction(e.target.value as 'reject')}
                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                          />
                          <span className="ml-2 text-sm font-medium text-red-700">Reject</span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Feedback {reviewAction === 'reject' && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                          value={reviewFeedback}
                          onChange={(e) => setReviewFeedback(e.target.value)}
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                          placeholder={
                            reviewAction === 'approve' 
                              ? "Optional: Provide positive feedback or suggestions for improvement..."
                              : "Required: Explain why this content needs revision..."
                          }
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => {
                            setSelectedContent(null);
                            setReviewAction('');
                            setReviewFeedback('');
                          }}
                          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={submitReview}
                          disabled={!reviewAction || (reviewAction === 'reject' && !reviewFeedback.trim()) || isReviewing}
                          className={`px-4 py-2 text-white rounded-lg font-medium ${
                            reviewAction === 'approve'
                              ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-300'
                              : 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                          }`}
                        >
                          {isReviewing ? 'Processing...' : `${reviewAction === 'approve' ? 'Approve' : 'Reject'} Content`}
                        </button>
                      </div>
                    </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Empty State
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-left">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Content Selected</h3>
                <p className="text-gray-500">Select content from the review queue to start reviewing.</p>
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </main>
    </div>
  );
}
