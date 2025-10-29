import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { AssignmentManager } from './AssignmentManager';
import { Settings } from './Settings';
import { DashboardLayout } from './DashboardLayout';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { MarkdownComponents } from '../utils/markdownComponents';
import { Loader, LoaderOverlay } from './Loader';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type AdminInfo = {
  id: string;
  name: string;
  email: string;
  contactNumber?: string;
};

type CreatorDetails = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
  lastLogin?: string;
  contactNumber?: string;
  courseAssigned?: string[];
  isActive?: boolean;
  assignedAdmins?: AdminInfo[];
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
  section?: 'PRE_ORDER' | 'IN_ORDER' | 'POST_ORDER';
  course?: string;
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
  totalAssigned: number;
  totalPendingReview: number;
  totalApproved: number;
  totalRejected: number;
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
  const [assignedCreators, setAssignedCreators] = useState<CreatorDetails[]>([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [contentViewTab, setContentViewTab] = useState<'content' | 'validation'>('content');
  const [showRevalidationModal, setShowRevalidationModal] = useState(false);
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);

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
    setIsTabTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      if (filter) {
        setTasksFilter(filter as any);
      }
      setIsTabTransitioning(false);
    }, 300);
    
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


  // Map sidebar navigation IDs to our internal tabs
  const handleSidebarNavigation = (viewId: string) => {
    switch (viewId) {
      case 'review':
        navigateToTab('review');
        break;
      case 'tasks':
        navigateToTab('assignments');
        break;
      case 'creators':
        navigateToTab('assigned-creators');
        break;
      case 'settings':
        setIsTabTransitioning(true);
        setTimeout(() => {
          setActiveTab('settings');
          setIsTabTransitioning(false);
        }, 300);
        break;
      default:
        navigateToTab('review');
    }
  };

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
            <Loader type="guardrail" size="lg" />
          </div>
        </div>
      ) : (
      <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 min-h-full">
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Assigned Creators</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{assignedCreators.length} creators assigned to you</p>
            </div>

            <div className="p-6">
              {assignedCreators.length === 0 ? (
                <div className="text-left py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Creators Assigned</h3>
                  <p className="text-gray-500 dark:text-gray-400">You don't have any creators assigned to you yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignedCreators.map((creator) => (
                    <div key={creator.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                      {/* Header with Avatar and Name */}
                      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-base font-semibold text-white">
                                {creator.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{creator.name}</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{creator.email}</p>
                            </div>
                          </div>
                          {creator.isActive !== undefined && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 self-start ${
                              creator.isActive
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                              {creator.isActive ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details Section */}
                      <div className="p-5 space-y-3">
                        {/* Contact Number */}
                        {creator.contactNumber && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{creator.contactNumber}</span>
                          </div>
                        )}

                        {/* Courses Assigned */}
                        {creator.courseAssigned && creator.courseAssigned.length > 0 && (
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <div className="flex flex-col gap-1">
                              {creator.courseAssigned.map((course, idx) => (
                                <span key={idx} className="text-sm text-gray-700 dark:text-gray-300">{course}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Last Login */}
                        {creator.lastLogin && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Last login: {new Date(creator.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        )}

                        {/* Created Date */}
                        {creator.createdAt && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Joined: {new Date(creator.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        )}

                        {/* Other Assigned Admins */}
                        {creator.assignedAdmins && creator.assignedAdmins.length > 0 && (
                          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-start gap-2 mb-2">
                              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                              <div className="flex-1">
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Also assigned to:
                                </p>
                                <div className="space-y-1.5">
                                  {creator.assignedAdmins.map((admin) => (
                                    <div key={admin.id} className="text-xs text-gray-600 dark:text-gray-400">
                                      <p className="font-medium">{admin.name}</p>
                                      {admin.contactNumber && (
                                        <p className="text-gray-500 dark:text-gray-500">{admin.contactNumber}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
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
            onBack={() => navigateToTab('review')} 
          />
        ) : (
          <>
            {/* Stats Cards - Fixed at top */}
            {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <button
              onClick={() => {
                setActiveTab('assigned-creators');
                fetchAssignedCreators();
                window.location.hash = '#/assigned-creators';
              }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer w-full text-left"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Assigned Creators</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">{stats.assignedCreators}</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('assignments');
                setTasksFilter('assigned');
                window.location.hash = '#/tasks?filter=assigned';
              }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer w-full text-left"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Content Assigned</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">{stats.totalAssigned}</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('assignments');
                setTasksFilter('review');
                window.location.hash = '#/tasks?filter=review';
              }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer w-full text-left"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Pending Review</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">{stats.totalPendingReview}</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('assignments');
                setTasksFilter('approved');
                window.location.hash = '#/tasks?filter=approved';
              }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer w-full text-left"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Content Approved</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">{stats.totalApproved}</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('assignments');
                setTasksFilter('rejected');
                window.location.hash = '#/tasks?filter=rejected';
              }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer w-full text-left"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Content Rejected</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">{stats.totalRejected}</p>
                </div>
              </div>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Review Queue */}
          <div className="lg:col-span-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[calc(100vh-200px)] flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <h2 className="font-semibold text-gray-900 dark:text-white">Review Queue</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{reviewQueue.length} items pending</p>
              </div>

              <div className="p-3 space-y-2 overflow-y-auto flex-1">
                {reviewQueue.map((content) => (
                  <div
                    key={content.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      selectedContent?.id === content.id
                        ? 'border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div
                      onClick={() => {
                        setSelectedContent(content);
                        setIsReviewMode(true);
                      }}
                      className="cursor-pointer"
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {content.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        by {content.author.name}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(content.status)}`}>
                          {content.status}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {content.submittedAt && new Date(content.submittedAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Section, Course and Tags */}
                      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
                        {content.section && (
                          <div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Section: </span>
                            <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                              {content.section.replace('_', ' ')}
                            </span>
                          </div>
                        )}
                        {content.course && (
                          <div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Course: </span>
                            <span className="text-xs text-gray-900 dark:text-white font-medium">{content.course}</span>
                          </div>
                        )}
                        {content.tags && content.tags.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Tags: </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {content.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {reviewQueue.length === 0 && (
                  <div className="text-left py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm">No items to review</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">All caught up!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Review Area */}
          <div className="lg:col-span-8">
            {selectedContent ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[calc(100vh-200px)] flex flex-col">
                <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <div className="p-6 pb-0">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2" style={{ textAlign: 'left' }}>{selectedContent.title}</h2>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>by {selectedContent.author.name}</span>
                          <span>{selectedContent.wordCount} words</span>
                          <span>{selectedContent.readingTime} min read</span>
                          <span>Submitted {selectedContent.submittedAt && new Date(selectedContent.submittedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs for Content and Validation */}
                  <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                    <div className="flex flex-1">
                      <button
                        onClick={() => setContentViewTab('content')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                          contentViewTab === 'content'
                            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Content
                        </div>
                      </button>
                      <button
                        onClick={() => setContentViewTab('validation')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                          contentViewTab === 'validation'
                            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Validation Results
                        </div>
                      </button>
                    </div>

                    {/* Re-validate Button - Only show in review mode and for REVIEW status content */}
                    {isReviewMode && selectedContent?.status === 'REVIEW' && (
                      <div className="px-4">
                        <button
                          onClick={async () => {
                            if (!selectedContent || isRevalidating) return;

                            setIsRevalidating(true);
                            setShowRevalidationModal(true);

                            try {
                              const res = await apiCall(`/api/validate/${selectedContent.id}`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` }
                              });

                              if (res.ok) {
                                const data = await res.json();

                                // Fetch the updated content from the review queue to get the latest validation results
                                await fetchReviewQueue();

                                // Find the updated content in the queue
                                const updatedContentInQueue = reviewQueue.find(c => c.id === selectedContent.id);
                                if (updatedContentInQueue) {
                                  setSelectedContent(updatedContentInQueue);
                                } else {
                                  // If not in queue, update with the response data
                                  setSelectedContent({
                                    ...selectedContent,
                                    validationResults: data.validationResults
                                  });
                                }

                                // Switch to validation tab to show results
                                setContentViewTab('validation');
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
                              setShowRevalidationModal(false);
                            }
                          }}
                          disabled={isRevalidating}
                          className="px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1.5 bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Re-validate with LLM
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                  {contentViewTab === 'content' && (
                    <>
                      {/* Content Preview */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Content Review
                          </h3>
                          <button
                            onClick={copyContentToClipboard}
                            className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
                              copySuccess
                                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
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
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto">
                          <div className="p-4 text-left max-w-none dark:prose-invert">
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
                    </>
                  )}

                  {contentViewTab === 'validation' && (
                    <>
                      {/* LLM Validation Results - Show only the most recent result */}
                      {selectedContent.validationResults && selectedContent.validationResults.length > 0 ? (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
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
                      ) : (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <p className="text-sm">No validation results available for this content.</p>
                        </div>
                      )}
                    </>
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
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-left">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Content Selected</h3>
                <p className="text-gray-500 dark:text-gray-400">Select content from the review queue to start reviewing.</p>
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </div>
      )}

      {/* Revalidation Modal */}
      {showRevalidationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <Loader type="file" size="lg" className="mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Re-validating Content
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Our AI is analyzing your content. This may take a few moments...
            </p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
