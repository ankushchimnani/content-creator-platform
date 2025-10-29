import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { EditorSplit } from './EditorSplit';
import { ResultsPanel } from './ResultsPanel';
import { AssignmentTasks } from './AssignmentTasks';
import { CreatorGuidelines } from './CreatorGuidelines';
import { Settings } from './Settings';
import { DashboardLayout } from './DashboardLayout';
import { Loader, LoaderOverlay } from './Loader';
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
  contactNumber?: string;
  assignedAdminId?: string[];
  assignedAdmin?: {
    id: string;
    name: string;
    email: string;
    contactNumber?: string;
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
  course?: string;
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
  ContentAssignment?: {
    id: string;
    course?: string;
    section?: string;
    assignedById?: string;
    User_ContentAssignment_assignedByIdToUser?: {
      id: string;
      name: string;
      email: string;
      contactNumber?: string;
    };
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
  const [activeTab, setActiveTab] = useState<'content' | 'assignments' | 'guidelines' | 'settings'>('content');
  const [contentTypeFilter, setContentTypeFilter] = useState<'ALL' | 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'>('ALL');
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showReviewersModal, setShowReviewersModal] = useState(false);
  const [assignedAdmins, setAssignedAdmins] = useState<Array<{ id: string; name: string; email: string; contactNumber?: string }>>([]);
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);

  // Map sidebar navigation IDs to internal tab states
  const handleSidebarNavigation = (viewId: string) => {
    const tabMapping: Record<string, typeof activeTab> = {
      'dashboard': 'dashboard',
      'content': 'content',
      'assignments': 'assignments',
      'guidelines': 'guidelines',
      'settings': 'settings'
    };
    const mappedTab = tabMapping[viewId] || 'dashboard';
    setIsTabTransitioning(true);
    setTimeout(() => {
      setActiveTab(mappedTab);
      setIsTabTransitioning(false);
    }, 300);
  };

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
    fetchAssignedAdmins();

    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchContents();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchAssignedAdmins = async () => {
    try {
      // The creator can be assigned to multiple admins in user.assignedAdminId array
      // We need to fetch these admins' details from the backend
      const res = await apiCall('/api/auth/users/assigned-admins', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setAssignedAdmins(data.admins || []);
      }
    } catch (error) {
      console.error('Failed to fetch assigned admins:', error);

      // Fallback: Try to get admins from assignments
      try {
        const res = await apiCall('/api/assignments/my-tasks', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          const assignments = data.assignments || [];

          // Extract unique admins from all assignments
          const adminsMap = new Map<string, { id: string; name: string; email: string; contactNumber?: string }>();

          assignments.forEach((assignment: any) => {
            if (assignment.assignedBy) {
              adminsMap.set(assignment.assignedBy.id, {
                id: assignment.assignedBy.id,
                name: assignment.assignedBy.name,
                email: assignment.assignedBy.email,
                contactNumber: assignment.assignedBy.contactNumber
              });
            }
          });

          setAssignedAdmins(Array.from(adminsMap.values()));
        }
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
      }
    }
  };

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
    setShowValidationModal(true);

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
          <div className="w-full">
            <AssignmentTasks 
              user={user} 
              token={token} 
              onCreateContent={handleCreateContentFromAssignment}
            />
          </div>
        ) : activeTab === 'guidelines' ? (
          <CreatorGuidelines 
            token={token} 
            onBack={() => handleSidebarNavigation('content')} 
          />
        ) : activeTab === 'settings' ? (
          <Settings 
            user={user} 
            token={token} 
            onBack={() => handleSidebarNavigation('content')} 
          />
        ) : (
          <>
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100vh-120px)]">
            {/* Left Sidebar - Content List - Always Open */}
            <aside className="w-full lg:w-80 lg:flex-shrink-0 flex flex-col gap-4">
              <div className="bg-surface-light p-4 rounded-lg shadow-sm flex flex-col gap-4 h-full">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold" style={{ textAlign: 'left' }}>My Content</h2>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setContentTypeFilter('ALL')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium w-full text-left ${
                      contentTypeFilter === 'ALL'
                        ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setContentTypeFilter('LECTURE_NOTE')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium w-full text-left ${
                      contentTypeFilter === 'LECTURE_NOTE'
                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
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
                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    Pre Read
                  </button>
                  <button
                    onClick={() => setContentTypeFilter('ASSIGNMENT')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium w-full text-left ${
                      contentTypeFilter === 'ASSIGNMENT'
                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    Assignment
                  </button>
                </div>
                <div className="border-t border-border-light -mx-4"></div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 -mr-2">
                  {contents.filter(content =>
                    contentTypeFilter === 'ALL' || content.contentType === contentTypeFilter
                  ).map((content) => (
                    <div
                      key={content.id}
                      onClick={() => selectContent(content)}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedContent?.id === content.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-400'
                          : 'border-border-light hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600'
                      }`}
                    >
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{content.title}</h3>
                      {content.ContentAssignment && content.ContentAssignment.length > 0 && content.ContentAssignment[0].course && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{content.ContentAssignment[0].course}</p>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(content.status)}`}>
                            {content.status}
                          </span>
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {new Date(content.updatedAt).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </div>
                  ))}

                  {contents.filter(content =>
                    contentTypeFilter === 'ALL' || content.contentType === contentTypeFilter
                  ).length === 0 && (
                    <div className="text-left py-12 text-gray-500 dark:text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm">No content yet</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Go to Assignments to create content</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                  <h3 className="font-semibold text-gray-600 dark:text-gray-300 mb-3">Assigned Reviewers</h3>

                  {/* Show reviewer name if available */}
                  {selectedContent?.ContentAssignment?.User_ContentAssignment_assignedByIdToUser && (
                    <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reviewer for this task:</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedContent.ContentAssignment.User_ContentAssignment_assignedByIdToUser.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {selectedContent.ContentAssignment.User_ContentAssignment_assignedByIdToUser.email}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      await fetchAssignedAdmins();
                      setShowReviewersModal(true);
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    View Reviewer Details
                  </button>
                </div>
              </div>
            </aside>

            {/* Center Content Area */}
            <section className="flex-1 bg-surface-light p-4 lg:p-6 rounded-lg shadow-sm flex flex-col h-full overflow-hidden">
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
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex-shrink-0">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h2 className="text-lg lg:text-xl font-semibold text-text-light mb-2 break-words">{selectedContent.title}</h2>
                        <div className="flex flex-wrap items-center gap-2 lg:gap-3 text-sm text-subtle-light">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(selectedContent.status)}`}>{selectedContent.status}</span>
                          <span>{selectedContent.wordCount} words</span>
                          <span>{selectedContent.readingTime} min read</span>
                          <span>v{selectedContent.version}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 items-start ml-4">
                        {selectedContent.status === 'REJECTED' && !editingContent ? (
                          <button
                            onClick={() => {
                              setEditingContent(selectedContent);
                              setTitle(selectedContent.title);
                              setContent(selectedContent.content);
                              setContentType(selectedContent.contentType);
                              setDifficulty(selectedContent.difficulty || '');
                            }}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 whitespace-nowrap"
                          >
                            Edit Content
                          </button>
                        ) : selectedContent.status === 'DRAFT' && !editingContent ? (
                          <button
                            onClick={() => submitForReview(selectedContent.id)}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300 whitespace-nowrap"
                          >
                            {isSubmitting ? 'Submitting...' : 'Submit for Review'}
                          </button>
                        ) : null}
                        {!editingContent && (
                          <button
                            onClick={validateContent}
                            disabled={isValidating}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2 whitespace-nowrap"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {isValidating ? 'Validating...' : 'Validate'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Content Area */}
                  <div className="flex-1 overflow-y-auto space-y-4">
                  {/* Admin Feedback Section */}
                  {selectedContent.status === 'REJECTED' && selectedContent.reviewFeedback && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex-shrink-0">
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
                    <div className="bg-white border border-gray-200 rounded-lg flex-shrink-0">
                      <div className="p-4 text-left max-w-full">
                        <div className="prose prose-sm max-w-none break-words">
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
                </div>
              ) : (
                // Empty State - No Content Selected
                <div className="text-center py-12">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Content Selected</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                    Select content from the sidebar to view and edit, or go to the Assignments tab to create content for your assigned tasks.
                  </p>
                  <button
                    onClick={() => handleSidebarNavigation('assignments')}
                    className="mt-6 bg-purple-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    View Assignments
                  </button>
                </div>
              )}
            </section>
            </div>

            {/* Validation Modal */}
            {showValidationModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => !isValidating && setShowValidationModal(false)}>
                <div
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Validation Dashboard</h3>
                    <button
                      onClick={() => setShowValidationModal(false)}
                      disabled={isValidating}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Modal Body - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {isValidating ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Loader type="file" size="lg" />
                        <p className="mt-6 text-gray-900 dark:text-white text-lg font-semibold">Validating Content...</p>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
                          Please wait while we analyze your content
                        </p>
                      </div>
                    ) : (
                      <ResultsPanel
                        result={validationResult}
                        onValidate={validateContent}
                        isValidating={isValidating}
                        validationError={validationError}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Reviewers Modal */}
            {showReviewersModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => setShowReviewersModal(false)}>
                <div
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assigned Reviewers</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Admins who can review your content</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowReviewersModal(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Modal Body - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {assignedAdmins.length > 0 ? (
                      <div className="space-y-3">
                        {assignedAdmins.map((admin) => (
                          <div
                            key={admin.id}
                            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
                          >
                            <div className="flex items-start gap-4">
                              {/* Avatar */}
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                                  {admin.name.charAt(0).toUpperCase()}
                                </div>
                              </div>

                              {/* Admin Details */}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                                  {admin.name}
                                </h4>

                                {/* Email */}
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-1">
                                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  <a href={`mailto:${admin.email}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
                                    {admin.email}
                                  </a>
                                </div>

                                {/* Phone */}
                                {admin.contactNumber && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <a href={`tel:${admin.contactNumber}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                      {admin.contactNumber}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Reviewers Assigned</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
                          You don't have any assigned reviewers yet. Please contact your administrator.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="flex items-center justify-end p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <button
                      onClick={() => setShowReviewersModal(false)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      )}
    </DashboardLayout>
  );
}