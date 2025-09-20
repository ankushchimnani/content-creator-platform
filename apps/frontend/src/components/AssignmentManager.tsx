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
  };
};

type Props = {
  user: User;
  token: string;
  triggerCreate?: boolean;
  onCreateConsumed?: () => void;
  onSwitchToReview?: () => void;
};

export function AssignmentManager({ user, token, triggerCreate, onCreateConsumed, onSwitchToReview }: Props) {
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
          dueDate: dueDate ? new Date(dueDate + 'T23:59:59.999Z').toISOString() : undefined,
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
          dueDate: dueDate ? new Date(dueDate + 'T23:59:59.999Z').toISOString() : undefined
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

  const deleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      const res = await apiCall(`/api/assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setTasks(tasks.filter(a => a.id !== assignmentId));
        alert('Assignment deleted successfully!');
      } else {
        const error = await res.json();
        alert(`Failed to delete assignment: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to delete assignment:', error);
      alert('Failed to delete assignment');
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

  const startEditing = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setIsCreating(false);
    setTopic(assignment.topic);
    setPrerequisiteTopics(assignment.prerequisiteTopics);
    setGuidelines(assignment.guidelines || '');
    setContentType(assignment.contentType);
    setDifficulty(assignment.difficulty || '');
    setDueDate(assignment.dueDate ? assignment.dueDate.split('T')[0] : '');
    setAssignedToId(assignment.assignedTo.id);
    setPrerequisiteInput(assignment.prerequisiteTopics.join(', '));
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
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-text-light">Content Tasks</h2>
          <p className="text-sm sm:text-base text-subtle-light">
            Assign content creation tasks to your creators
            {tasks.filter(a => a.content?.status === 'REVIEW').length > 0 && (
              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-medium">
                {tasks.filter(a => a.content?.status === 'REVIEW').length} ready for review
              </span>
            )}
          </p>
        </div>
        <button
          onClick={startCreating}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium text-sm sm:text-base transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          <span className="hidden sm:inline">New Task</span>
          <span className="sm:hidden">+ New</span>
        </button>
      </div>

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
          <h3 className="text-lg font-semibold text-gray-900">All Tasks</h3>
          <p className="text-sm text-gray-500 mt-1">{tasks.length} tasks</p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {tasks.map((assignment) => (
            <div key={assignment.id} className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900">{assignment.topic}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(assignment.status)}`}>
                        {assignment.status.replace('_', ' ')}
                      </span>
                      {assignment.content?.status === 'REVIEW' && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-medium animate-pulse">
                          📋 Ready for Review
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3">
                    <div className="flex flex-wrap items-center gap-4">
                      <span>Assigned to: <strong>{assignment.assignedTo.name}</strong></span>
                      <span>Type: <strong>{assignment.contentType.replace('_', ' ')}</strong></span>
                      {assignment.difficulty && (
                        <span>Difficulty: <strong>{assignment.difficulty}</strong></span>
                      )}
                      <span>Created: {formatDate(assignment.createdAt)}</span>
                      {assignment.dueDate && (
                        <span>Due: {formatDate(assignment.dueDate)}</span>
                      )}
                    </div>
                  </div>

                  {assignment.prerequisiteTopics.length > 0 && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-700">Prerequisites: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {assignment.prerequisiteTopics.map((topic, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {assignment.guidelines && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-700">Guidelines: </span>
                      <p className="text-sm text-gray-600 mt-1">{assignment.guidelines}</p>
                    </div>
                  )}

                  {assignment.content && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium text-green-800">
                            Content Created: {assignment.content.title}
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
                        {assignment.content.status === 'REVIEW' && onSwitchToReview && (
                          <button
                            onClick={() => onSwitchToReview()}
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
                  )}
                </div>

                <div className="flex gap-2 sm:ml-4">
                  <button
                    onClick={() => startEditing(assignment)}
                    className="px-3 py-2 text-xs sm:text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 font-medium transition-colors"
                  >
                    Edit
                  </button>
                  {!assignment.content && (
                    <button
                      onClick={() => deleteAssignment(assignment.id)}
                      className="px-3 py-2 text-xs sm:text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Tasks Yet</h3>
              <p className="text-gray-500 mb-4">Create your first content task to get started.</p>
              <button
                onClick={startCreating}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Create Task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
