import { useState, useEffect } from 'react';

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
  };
};

type Props = {
  user: User;
  token: string;
  onCreateContent: (assignment: Assignment) => void;
};

export function AssignmentTasks({ user, token, onCreateContent }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const res = await fetch('/api/assignments/my-tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments);
      }
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    }
  };

  const startAssignment = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setAssignments(assignments.map(a => 
          a.id === assignmentId ? data.assignment : a
        ));
        alert('Assignment started! You can now create content for this topic.');
      } else {
        const error = await res.json();
        alert(`Failed to start assignment: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to start assignment:', error);
      alert('Failed to start assignment');
    }
  };

  const linkContentToAssignment = async (assignmentId: string, contentId: string) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/link-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ contentId })
      });

      if (res.ok) {
        const data = await res.json();
        setAssignments(assignments.map(a => 
          a.id === assignmentId ? data.assignment : a
        ));
        alert('Content linked to assignment successfully!');
      } else {
        const error = await res.json();
        alert(`Failed to link content: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to link content:', error);
      alert('Failed to link content');
    }
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

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const pendingAssignments = assignments.filter(a => a.status !== 'COMPLETED');
  const completedAssignments = assignments.filter(a => a.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">My Content Assignments</h2>
        <p className="text-gray-600">Content creation tasks assigned by your admin</p>
      </div>

      {/* Pending Assignments */}
      {pendingAssignments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Pending Tasks</h3>
            <p className="text-sm text-gray-500 mt-1">{pendingAssignments.length} assignments to complete</p>
          </div>
          
          <div className="divide-y divide-gray-200">
            {pendingAssignments.map((assignment) => (
              <div key={assignment.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900 text-lg">{assignment.topic}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(assignment.status)}`}>
                        {assignment.status.replace('_', ' ')}
                      </span>
                      {assignment.dueDate && isOverdue(assignment.dueDate) && assignment.status !== 'COMPLETED' && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-4">
                        <span>Assigned by: <strong>{assignment.assignedBy.name}</strong></span>
                        <span>Created: {formatDate(assignment.createdAt)}</span>
                        {assignment.dueDate && (
                          <span className={isOverdue(assignment.dueDate) && assignment.status !== 'COMPLETED' ? 'text-red-600 font-medium' : ''}>
                            Due: {formatDate(assignment.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    {assignment.prerequisiteTopics.length > 0 && (
                      <div className="mb-3">
                        <span className="text-sm font-medium text-gray-700">Prerequisites covered: </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {assignment.prerequisiteTopics.map((topic, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {assignment.guidelines && (
                      <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <span className="text-sm font-medium text-purple-900 block mb-2">Guidelines:</span>
                        <p className="text-sm text-purple-800">{assignment.guidelines}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {assignment.status === 'ASSIGNED' && (
                      <button
                        onClick={() => startAssignment(assignment.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        Start Working
                      </button>
                    )}
                    
                    {assignment.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => onCreateContent(assignment)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                      >
                        Create Content
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedAssignment(
                        selectedAssignment?.id === assignment.id ? null : assignment
                      )}
                      className="px-4 py-2 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 text-sm"
                    >
                      {selectedAssignment?.id === assignment.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>
                </div>

                {selectedAssignment?.id === assignment.id && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h5 className="font-medium text-gray-900 mb-2">Assignment Details</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Status:</span>
                        <span className="ml-2 font-medium">{assignment.status.replace('_', ' ')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Assigned by:</span>
                        <span className="ml-2 font-medium">{assignment.assignedBy.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Created:</span>
                        <span className="ml-2">{formatDate(assignment.createdAt)}</span>
                      </div>
                      {assignment.dueDate && (
                        <div>
                          <span className="text-gray-600">Due Date:</span>
                          <span className="ml-2">{formatDate(assignment.dueDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Assignments */}
      {completedAssignments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Completed Tasks</h3>
            <p className="text-sm text-gray-500 mt-1">{completedAssignments.length} assignments completed</p>
          </div>
          
          <div className="divide-y divide-gray-200">
            {completedAssignments.map((assignment) => (
              <div key={assignment.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900">{assignment.topic}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(assignment.status)}`}>
                        COMPLETED
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      Assigned by: <strong>{assignment.assignedBy.name}</strong> • 
                      Completed: {formatDate(assignment.updatedAt)}
                    </div>

                    {assignment.content && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium text-green-800">
                            Content: {assignment.content.title}
                          </span>
                          <span className="text-xs text-green-600">
                            ({assignment.content.status})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {assignments.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Assignments Yet</h3>
          <p className="text-gray-500">Your admin hasn't assigned any content creation tasks yet.</p>
        </div>
      )}
    </div>
  );
}
