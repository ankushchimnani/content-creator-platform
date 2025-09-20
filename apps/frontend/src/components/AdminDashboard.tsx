import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { AssignmentManager } from './AssignmentManager';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
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
  const [activeTab, setActiveTab] = useState<'review' | 'assignments'>('review');
  const [openCreateAssignment, setOpenCreateAssignment] = useState(false);

  useEffect(() => {
    fetchReviewQueue();
    fetchStats();
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
        // Refresh stats
        fetchStats();
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-sm sm:text-lg font-semibold text-gray-900">
              <span className="hidden sm:inline">Content Validator - Admin</span>
              <span className="sm:hidden">CV Admin</span>
            </div>
          </div>
          
          {/* Mobile Navigation */}
          <nav className="flex gap-2 text-xs sm:hidden">
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'review' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Queue
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'assignments' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => { setActiveTab('assignments'); setOpenCreateAssignment(true); }}
              className="px-3 py-2 rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700"
            >
              + Create
            </button>
          </nav>

          {/* Desktop Navigation */}
          <nav className="hidden gap-8 text-sm text-gray-600 md:flex">
            <button
              onClick={() => setActiveTab('review')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'review' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
              }`}
            >
              Review Queue
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'assignments' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => { setActiveTab('assignments'); setOpenCreateAssignment(true); }}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              + Create Task
            </button>
          </nav>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:block text-sm text-gray-600">
              Admin: <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <button 
                onClick={onLogout}
                className="px-3 py-2 text-xs sm:text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 rounded-lg font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8">
        {activeTab === 'assignments' ? (
          <AssignmentManager
            user={user}
            token={token}
            triggerCreate={openCreateAssignment}
            onCreateConsumed={() => setOpenCreateAssignment(false)}
            onSwitchToReview={() => setActiveTab('review')}
          />
        ) : (
          <>
            {/* Stats Cards */}
            {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
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
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
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
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
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
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
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
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
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
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:gap-8 lg:grid-cols-3">
          {/* Review Queue */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Review Queue</h2>
                <p className="text-sm text-gray-500 mt-1">{reviewQueue.length} items pending</p>
              </div>
              
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
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
          <div className="lg:col-span-2">
            {selectedContent ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h1 className="text-xl font-semibold text-gray-900 mb-2">{selectedContent.title}</h1>
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
                  <div className="prose prose-sm max-w-none mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50 max-h-96 overflow-y-auto">
                    <div dangerouslySetInnerHTML={{ __html: selectedContent.content.replace(/\n/g, '<br>') }} />
                  </div>

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
