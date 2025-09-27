import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type Assignment = {
  id: string;
  topic: string;
  prerequisiteTopics: string[];
  guidelines?: string;
  contentType: 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE';
  difficulty?: string;
  dueDate?: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  createdAt: string;
  updatedAt: string;
  assignedBy: {
    id: string;
    name: string;
    email: string;
  };
  content?: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    reviewFeedback?: string;
    content?: string;
    brief?: string;
  };
};

type TaskFilter = 'All' | 'Assigned' | 'Draft' | 'Rejected' | 'Approved';

type Props = {
  user: User;
  token: string;
  onCreateContent: (assignment: Assignment) => void;
};

export function AssignmentTasks({ token, onCreateContent }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([]);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Task counts based on content lifecycle
  const taskCounts = {
    All: assignments.length,
    Assigned: assignments.filter(a => !a.content).length, // No content created yet
    Draft: assignments.filter(a => a.content?.status === 'DRAFT').length,
    Rejected: assignments.filter(a => a.content?.status === 'REJECTED').length,
    Approved: assignments.filter(a => a.content?.status === 'APPROVED').length
  };

  useEffect(() => {
    fetchAssignments();
    // Set up polling for real-time updates
    const interval = setInterval(fetchAssignments, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Filter assignments based on active filter and search query
    let filtered = assignments;

    // Apply status filter
    if (activeFilter !== 'All') {
      filtered = filtered.filter(assignment => {
        switch (activeFilter) {
          case 'Assigned':
            return !assignment.content; // No content created yet
          case 'Draft':
            return assignment.content?.status === 'DRAFT';
          case 'Rejected':
            return assignment.content?.status === 'REJECTED';
          case 'Approved':
            return assignment.content?.status === 'APPROVED';
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(assignment =>
        assignment.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.contentType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.assignedBy.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredAssignments(filtered);
  }, [assignments, activeFilter, searchQuery]);

  const fetchAssignments = async () => {
    try {
      const res = await apiCall('/api/assignments/my-tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEffectiveStatus = (assignment: Assignment) => {
    // If content exists, show content status, otherwise show 'ASSIGNED'
    if (assignment.content) {
      return assignment.content.status;
    }
    return 'ASSIGNED';
  };

  const getStatusColor = (assignment: Assignment) => {
    const status = getEffectiveStatus(assignment);
    switch (status) {
      case 'ASSIGNED': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'REVIEW': return 'bg-orange-100 text-orange-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (assignment: Assignment) => {
    const status = getEffectiveStatus(assignment);
    switch (status) {
      case 'ASSIGNED': 
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'DRAFT':
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case 'REVIEW':
        return (
          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        );
      case 'REJECTED':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'APPROVED':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const handleTaskClick = (assignment: Assignment) => {
    if (getEffectiveStatus(assignment) === 'ASSIGNED' || getEffectiveStatus(assignment) === 'DRAFT' || getEffectiveStatus(assignment) === 'REJECTED') {
      onCreateContent(assignment);
    }
  };

  return (
    <div className="w-full h-full bg-background-light font-sans text-text-light">
      {/* Filter Tabs */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {(['All', 'Assigned', 'Draft', 'Rejected', 'Approved'] as TaskFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                activeFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="hidden sm:inline">{filter}</span>
              <span className="sm:hidden">{filter.slice(0, 3)}</span>
              <span className={`ml-1 md:ml-2 px-1 md:px-2 py-1 rounded-full text-xs ${
                activeFilter === filter
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {taskCounts[filter]}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="flex-1 w-full md:max-w-md md:ml-auto">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
            <p className="text-gray-500">No tasks match your current filter criteria.</p>
          </div>
        ) : (
          filteredAssignments.map((assignment) => (
            <details
              key={assignment.id}
              className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow details-toggle"
            >
              <summary className="p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(assignment)}
                    <div>
                      <h3 className="font-semibold text-gray-900">{assignment.topic}</h3>
                      <p className="text-sm text-gray-600">
                        {getEffectiveStatus(assignment) === 'APPROVED' 
                          ? `Completed on ${formatDate(assignment.content?.updatedAt || assignment.updatedAt)}`
                          : `Assigned by ${assignment.assignedBy.name}`
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment)}`}>
                      {getEffectiveStatus(assignment).replace('_', ' ')}
                    </span>
                    {assignment.dueDate && (
                      <span className="text-sm text-gray-500">
                        Due: {formatDate(assignment.dueDate)}
                      </span>
                    )}
                    <svg className="w-5 h-5 text-gray-400 arrow-down transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </summary>
              
              <div className="px-4 pb-4 border-t border-gray-100">
                <div className="pt-4 space-y-4">
                  {/* Task Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Content Type</h4>
                      <p className="text-sm text-gray-900">{assignment.contentType.replace('_', ' ')}</p>
                    </div>
                    {assignment.difficulty && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Difficulty</h4>
                        <p className="text-sm text-gray-900">{assignment.difficulty}</p>
                      </div>
                    )}
                    {assignment.dueDate && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Due Date</h4>
                        <p className="text-sm text-gray-900">{formatDate(assignment.dueDate)}</p>
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Assigned By</h4>
                      <p className="text-sm text-gray-900">{assignment.assignedBy.name}</p>
                    </div>
                  </div>

                  {/* Prerequisites */}
                  {assignment.prerequisiteTopics.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Topics taught so far</h4>
                      <div className="flex flex-wrap gap-2">
                        {assignment.prerequisiteTopics.map((topic, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Guidelines */}
                  {assignment.guidelines && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Sub-topics</h4>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                        {assignment.guidelines}
                      </p>
                    </div>
                  )}

                  {/* Content Link */}
                  {assignment.content && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Linked Content</h4>
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        <p className="text-sm text-green-800">
                          <strong>Title:</strong> {assignment.content.title}
                        </p>
                        <p className="text-sm text-green-800">
                          <strong>Status:</strong> {assignment.content.status}
                        </p>
                        <p className="text-sm text-green-800">
                          <strong>Created:</strong> {formatDate(assignment.content.createdAt)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Rejection Feedback */}
                  {assignment.content?.status === 'REJECTED' && assignment.content?.reviewFeedback && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Rejection Feedback</h4>
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <p className="text-sm text-red-800">
                            {assignment.content.reviewFeedback}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Approval Feedback */}
                  {assignment.content?.status === 'APPROVED' && assignment.content?.reviewFeedback && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Approval Feedback</h4>
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-green-800">
                            {assignment.content.reviewFeedback}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4">
                    {getEffectiveStatus(assignment) === 'ASSIGNED' && (
                      <button
                        onClick={() => handleTaskClick(assignment)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Start Task
                      </button>
                    )}
                    {getEffectiveStatus(assignment) === 'DRAFT' && (
                      <button
                        onClick={() => handleTaskClick(assignment)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
                      >
                        Continue Editing
                      </button>
                    )}
                    {getEffectiveStatus(assignment) === 'REJECTED' && (
                      <button
                        onClick={() => handleTaskClick(assignment)}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        Revise Content
                      </button>
                    )}
                    {getEffectiveStatus(assignment) === 'APPROVED' && (
                      <div className="flex items-center gap-2 text-green-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium">Completed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  );
}