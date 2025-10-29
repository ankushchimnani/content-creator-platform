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
  topicsTaughtSoFar: string[];
  guidelines?: string;
  contentType: 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE';
  difficulty?: string;
  dueDate?: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  createdAt: string;
  updatedAt: string;
  course?: string;
  section?: 'PRE_ORDER' | 'IN_ORDER' | 'POST_ORDER';
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Additional filter states
  const [selectedContentType, setSelectedContentType] = useState<string>('ALL');
  const [selectedAdmin, setSelectedAdmin] = useState<string>('ALL');
  const [selectedCourse, setSelectedCourse] = useState<string>('ALL');

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

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedContentType, selectedAdmin, selectedCourse, activeFilter]);

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

    // Apply content type filter
    if (selectedContentType !== 'ALL') {
      filtered = filtered.filter(assignment => assignment.contentType === selectedContentType);
    }

    // Apply admin filter
    if (selectedAdmin !== 'ALL') {
      filtered = filtered.filter(assignment => assignment.assignedBy.id === selectedAdmin);
    }

    // Apply course filter
    if (selectedCourse !== 'ALL') {
      filtered = filtered.filter(assignment => assignment.course === selectedCourse);
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
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [assignments, activeFilter, searchQuery, selectedContentType, selectedAdmin, selectedCourse]);

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

  // Get unique values for filters
  const uniqueAdmins = Array.from(new Set(assignments.map(a => JSON.stringify({ id: a.assignedBy.id, name: a.assignedBy.name }))))
    .map(str => JSON.parse(str));
  const uniqueCourses = Array.from(new Set(assignments.map(a => a.course).filter(Boolean))) as string[];

  // Pagination calculations
  const totalItems = filteredAssignments.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedAssignments = filteredAssignments.slice(startIndex, endIndex);

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
      case 'ASSIGNED': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'IN_PROGRESS': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'COMPLETED': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'OVERDUE': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'DRAFT': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
      case 'REVIEW': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
      case 'REJECTED': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'APPROVED': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
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
    <div className="w-full h-full bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-white">
      {/* Fixed Filter Section */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        {/* Row 1: Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Bar */}
          <div className="lg:col-span-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                placeholder="Search assignments..."
              />
            </div>
          </div>

          {/* Admin Filter */}
          <div>
            <select
              value={selectedAdmin}
              onChange={(e) => setSelectedAdmin(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            >
              <option value="ALL">All Admins</option>
              {uniqueAdmins.map(admin => (
                <option key={admin.id} value={admin.id}>{admin.name}</option>
              ))}
            </select>
          </div>

          {/* Course Filter */}
          <div>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            >
              <option value="ALL">All Courses</option>
              {uniqueCourses.map(course => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Content Type Filter */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Type:</span>
            <div className="flex gap-2 flex-wrap">
              {(['ALL', 'LECTURE_NOTE', 'PRE_READ', 'ASSIGNMENT'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedContentType(type)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    selectedContentType === type
                      ? 'bg-purple-600 dark:bg-purple-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type === 'ALL' ? 'All' : type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {(['All', 'Assigned', 'Draft', 'Rejected', 'Approved'] as TaskFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeFilter === filter
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {filter}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                    activeFilter === filter
                      ? 'bg-blue-500 dark:bg-blue-400 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {taskCounts[filter]}
                  </span>
                </button>
              ))}
            </div>

            {/* Clear Filters Button */}
            {(searchQuery || selectedContentType !== 'ALL' || selectedAdmin !== 'ALL' || selectedCourse !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedContentType('ALL');
                  setSelectedAdmin('ALL');
                  setSelectedCourse('ALL');
                }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear All
              </button>
            )}
          </div>

          {/* Active Filters Summary */}
          {(searchQuery || selectedContentType !== 'ALL' || selectedAdmin !== 'ALL' || selectedCourse !== 'ALL') && (
            <div className="mt-3 flex items-center gap-2 flex-wrap text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Active:</span>
              {searchQuery && (
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-xs">
                  Search: "{searchQuery}"
                </span>
              )}
              {selectedAdmin !== 'ALL' && (
                <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-md text-xs">
                  Admin: {uniqueAdmins.find(a => a.id === selectedAdmin)?.name}
                </span>
              )}
              {selectedCourse !== 'ALL' && (
                <span className="px-2 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 rounded-md text-xs">
                  Course: {selectedCourse}
                </span>
              )}
              {selectedContentType !== 'ALL' && (
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-md text-xs">
                  Type: {selectedContentType.replace('_', ' ')}
                </span>
              )}
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium">
                {filteredAssignments.length} of {assignments.length} assignments
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tasks found</h3>
            <p className="text-gray-500 dark:text-gray-400">No tasks match your current filter criteria.</p>
          </div>
        ) : (
          paginatedAssignments.map((assignment) => (
            <details
              key={assignment.id}
              className="rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xl transition-all duration-300 details-toggle group"
            >
              <summary className="p-5 cursor-pointer hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 dark:hover:from-gray-800 dark:hover:to-gray-700 transition-all duration-300 bg-white dark:bg-gray-800 rounded-xl relative overflow-hidden">
                {/* Background Icon */}
                <div className="absolute right-8 top-2 opacity-40 dark:opacity-60 -rotate-12">
                  <svg className="w-28 h-28 text-gray-500 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-4">
                    {/* Left Side: Icon + Content */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {getStatusIcon(assignment)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-base">{assignment.topic}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(assignment)}`}>
                            {getEffectiveStatus(assignment).replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {getEffectiveStatus(assignment) === 'APPROVED'
                              ? `Completed on ${formatDate(assignment.content?.updatedAt || assignment.updatedAt)}`
                              : `Assigned by ${assignment.assignedBy.name}`
                            }
                          </span>
                          {/* Content Type Badge */}
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            {assignment.contentType.replace('_', ' ')}
                          </span>
                          {/* Course Badge */}
                          {assignment.course && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              {assignment.course}
                            </span>
                          )}
                          {/* Section Badge */}
                          {assignment.section && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              {assignment.section.replace('_', '-')}
                            </span>
                          )}
                          {assignment.dueDate && (
                            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Due: {formatDate(assignment.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Arrow */}
                    <div className="flex items-center flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </summary>
              
              <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="pt-2 space-y-2">
                  {/* Compact Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="flex items-start gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-purple-500 mt-1.5 flex-shrink-0"></div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Type</p>
                        <p className="text-gray-900 dark:text-white font-medium">{assignment.contentType.replace('_', ' ')}</p>
                      </div>
                    </div>
                    {assignment.course && (
                      <div className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Course</p>
                          <p className="text-gray-900 dark:text-white font-medium">{assignment.course}</p>
                        </div>
                      </div>
                    )}
                    {assignment.section && (
                      <div className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Section</p>
                          <p className="text-gray-900 dark:text-white font-medium">{assignment.section.replace('_', '-')}</p>
                        </div>
                      </div>
                    )}
                    {assignment.difficulty && (
                      <div className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-orange-500 mt-1.5 flex-shrink-0"></div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Difficulty</p>
                          <p className="text-gray-900 dark:text-white font-medium">{assignment.difficulty}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Topics Taught - Compact */}
                  {assignment.topicsTaughtSoFar.length > 0 && (
                    <div className="bg-white dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                        <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
                        </svg>
                        Topics Covered
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {assignment.topicsTaughtSoFar.map((topic, index) => (
                          <span key={index} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Guidelines - Compact */}
                  {assignment.guidelines && (
                    <div className="bg-white dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                        <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Sub-topics & Guidelines
                      </h4>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{assignment.guidelines}</p>
                    </div>
                  )}

                  {/* Feedback - Rejection */}
                  {assignment.content?.status === 'REJECTED' && assignment.content?.reviewFeedback && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-l-3 border-red-500 dark:border-red-400 rounded p-2">
                      <div className="flex items-start gap-1.5">
                        <svg className="w-3.5 h-3.5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-0.5">Rejection Feedback</p>
                          <p className="text-xs text-red-700 dark:text-red-400 leading-snug">{assignment.content.reviewFeedback}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Feedback - Approval */}
                  {assignment.content?.status === 'APPROVED' && assignment.content?.reviewFeedback && (
                    <div className="bg-green-50 dark:bg-green-900/20 border-l-3 border-green-500 dark:border-green-400 rounded p-2">
                      <div className="flex items-start gap-1.5">
                        <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-0.5">Approval Feedback</p>
                          <p className="text-xs text-green-700 dark:text-green-400 leading-snug">{assignment.content.reviewFeedback}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons - Compact */}
                  <div className="flex justify-end gap-2 pt-2">
                    {getEffectiveStatus(assignment) === 'ASSIGNED' && (
                      <button
                        onClick={() => handleTaskClick(assignment)}
                        className="px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-xs font-medium"
                      >
                        Start Task
                      </button>
                    )}
                    {getEffectiveStatus(assignment) === 'DRAFT' && (
                      <button
                        onClick={() => handleTaskClick(assignment)}
                        className="px-3 py-1.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors text-xs font-medium"
                      >
                        Continue Editing
                      </button>
                    )}
                    {getEffectiveStatus(assignment) === 'REJECTED' && (
                      <button
                        onClick={() => handleTaskClick(assignment)}
                        className="px-3 py-1.5 bg-red-600 dark:bg-red-500 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-xs font-medium"
                      >
                        Revise Content
                      </button>
                    )}
                    {getEffectiveStatus(assignment) === 'APPROVED' && (
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-medium">Completed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </details>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="mt-6 mb-20 flex flex-col sm:flex-row items-center justify-around gap-4 px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
          {/* Items per page selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="pageSize" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Items per page:
            </label>
            <select
              id="pageSize"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
            </span>
          </div>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {/* Previous button */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                currentPage === 1
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
              }`}
              title="Previous page"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Page number buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Show first page, last page, current page, and one page on either side
              const showPage =
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1);

              // Show ellipsis
              if (!showPage) {
                // Only show one ellipsis between ranges
                if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <span key={page} className="px-2 text-gray-400 dark:text-gray-500">
                      ...
                    </span>
                  );
                }
                return null;
              }

              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[2.5rem] px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-purple-600 dark:bg-purple-500 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
                  }`}
                  title={`Page ${page}`}
                >
                  {page}
                </button>
              );
            })}

            {/* Next button */}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                currentPage === totalPages
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
              }`}
              title="Next page"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}