import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { AssignmentManager } from './AssignmentManager';
import { Settings } from './Settings';
import { marked } from 'marked';

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
    relevance: { score: number; feedback: string; suggestions: string[] };
    continuity: { score: number; feedback: string; suggestions: string[] };
    documentation: { score: number; feedback: string; suggestions: string[] };
  };
  overallScore: number;
  processingTimeMs: number;
  createdAt: string;
};

type Content = {
  id: string;
  title: string;
  content: string;
  brief?: string;
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

  // Handle URL hash changes for proper browser navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('#/assigned-creators')) {
        setActiveTab('assigned-creators');
        setTasksFilter('all');
      } else if (hash.includes('#/tasks')) {
        setActiveTab('assignments');
        const urlParams = new URLSearchParams(hash.split('?')[1]);
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
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'REVIEW': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderMarkdownPreview = (text: string) => {
    // Preprocess text to fix common markdown mistakes
    let processedText = text
      // Fix links with spaces: [text] (url) -> [text](url)
      .replace(/\[([^\]]+)\]\s+\(([^)]+)\)/g, '[$1]($2)')
      // Fix URLs without protocol: www.example.com -> https://www.example.com
      .replace(/\[([^\]]+)\]\((www\.[^)]+)\)/g, '[$1](https://$2)')
      // Fix URLs without protocol: example.com -> https://example.com (but not if already has protocol)
      .replace(/\[([^\]]+)\]\(([^h][^)]+)\)/g, (match, text, url) => {
        if (!url.startsWith('http') && !url.startsWith('mailto:') && !url.startsWith('#')) {
          return `[${text}](https://${url})`;
        }
        return match;
      });
    
    // Configure marked for better security and rendering
    marked.setOptions({
      breaks: true, // Convert line breaks to <br>
      gfm: true, // GitHub Flavored Markdown
    });
    
    try {
      const html = marked.parse(processedText) as string;
      // Add target="_blank" to all links for better UX
      let processedHtml = html.replace(/<a href="/g, '<a target="_blank" rel="noopener noreferrer" href="');
      
      // Reduce heading sizes and spacing
      processedHtml = processedHtml
        .replace(/<h1>/g, '<h2 class="text-sm font-semibold mb-1">')
        .replace(/<h2>/g, '<h3 class="text-sm font-medium mb-1">')
        .replace(/<h3>/g, '<h4 class="text-xs font-medium mb-1">')
        .replace(/<\/h1>/g, '</h2>')
        .replace(/<\/h2>/g, '</h3>')
        .replace(/<\/h3>/g, '</h4>')
        .replace(/<p>/g, '<p class="mb-1">')
        .replace(/<ul>/g, '<ul class="mb-1 ml-4">')
        .replace(/<ol>/g, '<ol class="mb-1 ml-4">')
        .replace(/<li>/g, '<li class="mb-0.5">');
      
      return processedHtml;
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return text.replace(/\n/g, '<br>'); // Fallback to basic rendering
    }
  };

  return (
    <div className="min-h-screen bg-background-light font-sans text-text-light">
      {/* Header */}
      <header className="bg-surface-light border-b border-border-light px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        
        <div className="flex items-center justify-between flex-1 ml-6">
          {/* Navigation */}
          <nav className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('review');
                setTasksFilter('all');
                window.location.hash = '#';
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'review'
                  ? 'text-subtle-light bg-gray-100'
                  : 'text-subtle-light hover:bg-gray-100'
              }`}
            >
              Review Queue
            </button>
            <button
              onClick={() => {
                setActiveTab('assignments');
                setTasksFilter('all');
                window.location.hash = '#/tasks';
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'assignments'
                  ? 'text-subtle-light bg-gray-100'
                  : 'text-subtle-light hover:bg-gray-100'
              }`}
            >
              Tasks
            </button>
          </nav>

          {/* User Info */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-text-light">Welcome, {user.name}</div>
              <div className="text-xs text-gray-500">Admin</div>
            </div>
            <button 
              onClick={() => setActiveTab('settings')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gray-200 text-text-light hover:bg-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        {activeTab === 'assignments' ? (
          <AssignmentManager
            user={user}
            token={token}
            triggerCreate={openCreateAssignment}
            onCreateConsumed={() => setOpenCreateAssignment(false)}
            onSwitchToReview={(contentId) => {
              setActiveTab('review');
              if (contentId) {
                // Find the content in the review queue and select it
                const content = reviewQueue.find(c => c.id === contentId);
                if (content) {
                  setSelectedContent(content);
                }
              }
            }}
            filter={tasksFilter}
            onFilterChange={setTasksFilter}
          />
        ) : activeTab === 'assigned-creators' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Assigned Creators</h2>
              <p className="text-sm text-gray-500 mt-1">{assignedCreators.length} creators assigned to you</p>
            </div>
            
            <div className="p-6">
              {assignedCreators.length === 0 ? (
                <div className="text-center py-12">
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
                    onClick={() => setSelectedContent(content)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedContent?.id === content.id
                        ? 'border-purple-200 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
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
                ))}
                
                {reviewQueue.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
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
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">{selectedContent.title}</h2>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>by {selectedContent.author.name}</span>
                        <span>{selectedContent.wordCount} words</span>
                        <span>{selectedContent.readingTime} min read</span>
                        <span>Submitted {selectedContent.submittedAt && new Date(selectedContent.submittedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {selectedContent.brief && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 className="font-medium text-blue-900 mb-2">Content Brief</h3>
                      <p className="text-blue-800 text-sm">{selectedContent.brief}</p>
                    </div>
                  )}
                </div>
                
                <div className="p-6">
                  {/* Content Preview */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Content Review
                    </h3>
                    <div className="text-sm text-left leading-relaxed p-3 bg-white border border-gray-200 rounded-lg" style={{textAlign: 'left'}}>
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(selectedContent.content) }} />
                    </div>
                  </div>

                  {/* LLM Validation Results */}
                  {selectedContent.validationResults && selectedContent.validationResults.length > 0 && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Validation Results
                      </h3>
                      {selectedContent.validationResults.map((result, index) => (
                        <div key={index} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-800">
                              Overall Score: {result.overallScore.toFixed(1)}/10
                            </span>
                            <span className="text-xs text-blue-600">
                              {result.llmProvider} • {result.modelVersion}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3 bg-white rounded border border-blue-100">
                              <div className="text-sm font-medium text-gray-700 mb-1">Adherence to Structure</div>
                              <div className="text-lg font-semibold text-blue-600">
                                {result.criteria.relevance.score.toFixed(1)}/10
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {result.criteria.relevance.feedback}
                              </div>
                            </div>
                            
                            <div className="p-3 bg-white rounded border border-blue-100">
                              <div className="text-sm font-medium text-gray-700 mb-1">Coverage of Topics</div>
                              <div className="text-lg font-semibold text-blue-600">
                                {result.criteria.continuity.score.toFixed(1)}/10
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {result.criteria.continuity.feedback}
                              </div>
                            </div>
                            
                            <div className="p-3 bg-white rounded border border-blue-100">
                              <div className="text-sm font-medium text-gray-700 mb-1">Ease of Understanding</div>
                              <div className="text-lg font-semibold text-blue-600">
                                {result.criteria.documentation.score.toFixed(1)}/10
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {result.criteria.documentation.feedback}
                              </div>
                            </div>
                          </div>
                          
                          {result.criteria.relevance.suggestions.length > 0 && (
                            <div className="mt-3">
                              <div className="text-sm font-medium text-blue-800 mb-2">AI Suggestions:</div>
                              <ul className="text-sm text-blue-700 space-y-1">
                                {result.criteria.relevance.suggestions.map((suggestion, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-blue-500 mt-1">•</span>
                                    <span>{suggestion}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Review Form */}
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
                </div>
              </div>
            ) : (
              // Empty State
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
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
