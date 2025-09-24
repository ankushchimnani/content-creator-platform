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
  assignedTo: {
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
    submittedAt?: string;
    reviewedAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
    reviewFeedback?: string;
  };
};

type Props = {
  user: User;
  token: string;
  triggerCreate?: boolean;
  onCreateConsumed?: () => void;
  onSwitchToReview?: (contentId?: string) => void;
  filter?: 'all' | 'assigned' | 'review' | 'rejected' | 'approved';
  onFilterChange?: (filter: 'all' | 'assigned' | 'review' | 'rejected' | 'approved') => void;
};

export function AssignmentManager({ user, token, triggerCreate, onCreateConsumed, onSwitchToReview, filter = 'all', onFilterChange }: Props) {
  const [tasks, setTasks] = useState<Assignment[]>([]);
  const [assignedCreators, setAssignedCreators] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Form state
  const [topic, setTopic] = useState('');
  const [prerequisiteTopics, setPrerequisiteTopics] = useState<string[]>([]);
  const [guidelines, setGuidelines] = useState('');
  const [contentType, setContentType] = useState('LECTURE_NOTE');
  const [difficulty, setDifficulty] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [prerequisiteInput, setPrerequisiteInput] = useState('');

  useEffect(() => {
    fetchAssignments();
    fetchAssignedCreators();
  }, []);

  // Respond to external request to open create form
  useEffect(() => {
    if (triggerCreate) {
      startCreating();
      onCreateConsumed && onCreateConsumed();
    }
  }, [triggerCreate]);

  const fetchAssignments = async () => {
    try {
      const res = await apiCall('/api/assignments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Fetched assignments:', data.assignments);
        setTasks(data.assignments);
      }
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    }
  };

  const fetchAssignedCreators = async () => {
    try {
      const res = await apiCall('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter to only show creators assigned to this admin
        const creators = data.users.filter((u: any) => 
          u.role === 'CREATOR' && u.assignedAdminId === user.id
        );
        setAssignedCreators(creators);
      }
    } catch (error) {
      console.error('Failed to fetch creators:', error);
    }
  };

  const createAssignment = async () => {
    try {
      const res = await apiCall('/api/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          topic,
          prerequisiteTopics,
          guidelines: guidelines || undefined,
          contentType,
          difficulty: difficulty || undefined,
          dueDate: dueDate ? new Date(dueDate + 'T00:00:00.000Z').toISOString() : undefined,
          assignedToId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTasks([data.assignment, ...tasks]);
        resetForm();
        setIsCreating(false);
        alert('Assignment created successfully!');
      } else {
        const error = await res.json();
        alert(`Failed to create assignment: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create assignment:', error);
      alert('Failed to create assignment');
    }
  };

  const updateAssignment = async (assignmentId: string) => {
    try {
      const res = await apiCall(`/api/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          topic,
          prerequisiteTopics,
          guidelines: guidelines || undefined,
          contentType,
          difficulty: difficulty || undefined,
          dueDate: dueDate ? new Date(dueDate + 'T00:00:00.000Z').toISOString() : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTasks(tasks.map(a => a.id === assignmentId ? data.assignment : a));
        resetForm();
        setEditingAssignment(null);
        alert('Assignment updated successfully!');
      } else {
        const error = await res.json();
        alert(`Failed to update assignment: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to update assignment:', error);
      alert('Failed to update assignment');
    }
  };

  const resetForm = () => {
    setTopic('');
    setPrerequisiteTopics([]);
    setGuidelines('');
    setContentType('LECTURE_NOTE');
    setDifficulty('');
    setDueDate('');
    setAssignedToId('');
    setPrerequisiteInput('');
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingAssignment(null);
    resetForm();
  };

  const addPrerequisite = () => {
    if (prerequisiteInput.trim()) {
      const topics = prerequisiteInput.split(',').map(t => t.trim()).filter(Boolean);
      setPrerequisiteTopics([...prerequisiteTopics, ...topics]);
      setPrerequisiteInput('');
    }
  };

  const removePrerequisite = (index: number) => {
    setPrerequisiteTopics(prerequisiteTopics.filter((_, i) => i !== index));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return 'bg-blue-100 text-blue-800';
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'REVIEW': return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (assignment: Assignment) => {
    // If content exists, show content status, otherwise show 'ASSIGNED'
    const status = assignment.content ? assignment.content.status : 'ASSIGNED';
    
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
    return new Date(dateString).toLocaleDateString();
  };

  // Filter tasks based on the filter prop
  const filteredTasks = tasks.filter((assignment) => {
    switch (filter) {
      case 'assigned':
        return !assignment.content; // No content created yet
      case 'review':
        return assignment.content?.status === 'REVIEW';
      case 'rejected':
        return assignment.content?.status === 'REJECTED';
      case 'approved':
        return assignment.content?.status === 'APPROVED';
      case 'all':
      default:
        return true;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-end mb-6">
        <button
          onClick={startCreating}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium text-sm sm:text-base transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          <span className="hidden sm:inline">New Task</span>
          <span className="sm:hidden">+ New</span>
        </button>
      </div>

      {/* Filter Tabs */}
      {onFilterChange && (
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: 'all', label: 'All Tasks' },
              { key: 'assigned', label: 'Assigned' },
              { key: 'review', label: 'Review' },
              { key: 'rejected', label: 'Rejected' },
              { key: 'approved', label: 'Approved' }
            ] as const).map(({ key, label }) => {
              const count = tasks.filter((assignment) => {
                switch (key) {
                  case 'assigned':
                    return !assignment.content; // No content created yet
                  case 'review':
                    return assignment.content?.status === 'REVIEW';
                  case 'rejected':
                    return assignment.content?.status === 'REJECTED';
                  case 'approved':
                    return assignment.content?.status === 'APPROVED';
                  case 'all':
                  default:
                    return true;
                }
              }).length;

              return (
                <button
                  key={key}
                  onClick={() => onFilterChange(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {label}
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                    filter === key
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingAssignment) && (
        <div className="bg-surface-light rounded-lg shadow-sm border border-border-light p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
            {isCreating ? 'Create New Task' : 'Edit Task'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-light mb-2">
                Topic <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., React Hooks - useState and useEffect"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-light mb-2">
                Assign To <span className="text-red-500">*</span>
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={!!editingAssignment}
              >
                <option value="">Select a creator...</option>
                {assignedCreators.map((creator) => (
                  <option key={creator.id} value={creator.id}>
                    {creator.name} ({creator.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-light mb-2">
                Content Type <span className="text-red-500">*</span>
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="LECTURE_NOTE">Lecture Note</option>
                <option value="PRE_READ">Pre-read</option>
                <option value="ASSIGNMENT">Assignment</option>
              </select>
            </div>

            {contentType === 'ASSIGNMENT' && (
              <div>
                <label className="block text-sm font-medium text-text-light mb-2">
                  Difficulty
                </label>
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

            <div>
              <label className="block text-sm font-medium text-text-light mb-2">
                Prerequisite Topics
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={prerequisiteInput}
                  onChange={(e) => setPrerequisiteInput(e.target.value)}
                  className="flex-1 px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter topics separated by commas"
                  onKeyPress={(e) => e.key === 'Enter' && addPrerequisite()}
                />
                <button
                  type="button"
                  onClick={addPrerequisite}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800"
                >
                  Add
                </button>
              </div>
              {prerequisiteTopics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {prerequisiteTopics.map((topic, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-1"
                    >
                      {topic}
                      <button
                        type="button"
                        onClick={() => removePrerequisite(index)}
                        className="text-purple-800 hover:opacity-80"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-light mb-2">
                Guidelines (Optional)
              </label>
              <textarea
                value={guidelines}
                onChange={(e) => setGuidelines(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Provide specific guidelines, requirements, target audience, style preferences, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-light mb-2">
                Due Date (Optional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="px-4 py-2 border border-border-light rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingAssignment(null);
                  resetForm();
                }}
                className="px-4 py-2 text-text-light border border-border-light rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingAssignment) {
                    updateAssignment(editingAssignment.id);
                  } else {
                    createAssignment();
                  }
                }}
                disabled={!topic || !assignedToId}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300"
              >
                {editingAssignment ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignments List */}
      <div className="bg-surface-light rounded-lg shadow-sm border border-border-light">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {filter === 'all' ? 'All Tasks' : 
             filter === 'assigned' ? 'Assigned Tasks' :
             filter === 'review' ? 'Review Tasks' :
             filter === 'rejected' ? 'Rejected Tasks' :
             filter === 'approved' ? 'Approved Tasks' : 'All Tasks'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{filteredTasks.length} tasks</p>
        </div>
        
        <div className="space-y-3">
          {filteredTasks.map((assignment) => (
            <details
              key={assignment.id}
              className="rounded-lg border border-gray-200 hover:shadow-md transition-shadow details-toggle"
            >
              <summary className="p-4 cursor-pointer hover:bg-gray-50 transition-colors bg-white rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(assignment)}
                    <div>
                      <h3 className="font-semibold text-gray-900">{assignment.topic}</h3>
                      <p className="text-sm text-gray-600">Assigned to {assignment.assignedTo.name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.content ? assignment.content.status : assignment.status)}`}>
                      {assignment.content ? assignment.content.status : assignment.status.replace('_', ' ')}
                    </span>
                    {assignment.content?.status === 'REVIEW' && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-medium animate-pulse">
                        📋 Ready for Review
                      </span>
                    )}
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
              
              <div className="px-4 pb-4 border-t border-gray-100 bg-white rounded-b-lg">
                <div className="pt-4 space-y-4">
                  {/* Task Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Assigned To</h4>
                      <p className="text-sm text-gray-900">{assignment.assignedTo.name} ({assignment.assignedTo.email})</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Content Type</h4>
                      <p className="text-sm text-gray-900">{assignment.contentType.replace('_', ' ')}</p>
                    </div>
                    {assignment.difficulty && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Difficulty</h4>
                        <p className="text-sm text-gray-900">{assignment.difficulty}</p>
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Created</h4>
                      <p className="text-sm text-gray-900">{formatDate(assignment.createdAt)}</p>
                    </div>
                    {assignment.dueDate && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Due Date</h4>
                        <p className="text-sm text-gray-900">{formatDate(assignment.dueDate)}</p>
                      </div>
                    )}
                  </div>

                  {/* Prerequisites */}
                  {assignment.prerequisiteTopics.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Prerequisites</h4>
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
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Guidelines</h4>
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
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-medium text-green-800">
                              {assignment.content.title}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              assignment.content.status === 'REVIEW' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : assignment.content.status === 'APPROVED'
                                ? 'bg-green-100 text-green-800'
                                : assignment.content.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {assignment.content.status}
                            </span>
                          </div>
                          {assignment.content?.status === 'REVIEW' && onSwitchToReview && (
                            <button
                              onClick={() => onSwitchToReview(assignment.content?.id)}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                              Review Now
                            </button>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-green-700">
                          Created: {new Date(assignment.content.createdAt).toLocaleDateString()}
                          {assignment.content.updatedAt !== assignment.content.createdAt && (
                            <span className="ml-3">
                              Updated: {new Date(assignment.content.updatedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
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
                    <button
                      onClick={() => setEditingAssignment(assignment)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
                    >
                      Edit Task
                    </button>
                  </div>
                </div>
              </div>
            </details>
          ))}

          {filteredTasks.length === 0 && (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'all' ? 'No Tasks Yet' :
                 filter === 'assigned' ? 'No Assigned Tasks' :
                 filter === 'review' ? 'No Review Tasks' :
                 filter === 'rejected' ? 'No Rejected Tasks' :
                 filter === 'approved' ? 'No Approved Tasks' : 'No Tasks Yet'}
              </h3>
              <p className="text-gray-500 mb-4">
                {filter === 'all' ? 'Create your first content task to get started.' :
                 filter === 'assigned' ? 'No tasks are currently assigned.' :
                 filter === 'review' ? 'No tasks are currently under review.' :
                 filter === 'rejected' ? 'No tasks have been rejected.' :
                 filter === 'approved' ? 'No tasks have been approved.' : 'Create your first content task to get started.'}
              </p>
              {filter === 'all' && (
                <button
                  onClick={startCreating}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create Task
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
