import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  courseAssigned?: string[];
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
  section?: 'PRE_ORDER' | 'IN_ORDER' | 'POST_ORDER';
  course?: string;
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
  
  // Enhanced filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | 'PRE_ORDER' | 'IN_ORDER' | 'POST_ORDER'>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form state
  const [topic, setTopic] = useState('');
  const [topicsTaughtSoFar, setTopicsTaughtSoFar] = useState<string[]>([]);
  const [guidelines, setGuidelines] = useState('');
  const [contentType, setContentType] = useState('LECTURE_NOTE');
  const [difficulty, setDifficulty] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [topicsTaughtSoFarInput, setTopicsTaughtSoFarInput] = useState('');

  // New fields: Section and Course
  const [section, setSection] = useState<'PRE_ORDER' | 'IN_ORDER' | 'POST_ORDER' | ''>('');
  const [course, setCourse] = useState('');
  const [creatorCourses, setCreatorCourses] = useState<string[]>([]);

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

  // Populate form when editing assignment
  useEffect(() => {
    if (editingAssignment) {
      setTopic(editingAssignment.topic || '');
      setTopicsTaughtSoFar(editingAssignment.topicsTaughtSoFar || []);
      setGuidelines(editingAssignment.guidelines || '');
      setContentType(editingAssignment.contentType || 'LECTURE_NOTE');
      setDifficulty(editingAssignment.difficulty || '');
      setDueDate(editingAssignment.dueDate ? editingAssignment.dueDate.split('T')[0] : '');
      setAssignedToId(editingAssignment.assignedTo?.id || '');
      setSection(editingAssignment.section || '');
      setCourse(editingAssignment.course || '');
    }
  }, [editingAssignment]);

  // Populate creator's courses when creator is selected
  useEffect(() => {
    if (assignedToId) {
      const creator = assignedCreators.find(c => c.id === assignedToId);
      if (creator && creator.courseAssigned) {
        setCreatorCourses(creator.courseAssigned);
        // Reset course selection when creator changes
        if (!editingAssignment) {
          setCourse('');
        }
      } else {
        setCreatorCourses([]);
        setCourse('');
      }
    } else {
      setCreatorCourses([]);
      setCourse('');
    }
  }, [assignedToId, assignedCreators, editingAssignment]);

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

  // Enhanced filtering function
  const getFilteredTasks = () => {
    return tasks.filter((assignment) => {
      // Apply status filter
      let statusMatch = true;
      switch (filter) {
        case 'assigned':
          statusMatch = assignment.status === 'ASSIGNED';
          break;
        case 'review':
          statusMatch = assignment.content?.status === 'REVIEW';
          break;
        case 'rejected':
          statusMatch = assignment.content?.status === 'REJECTED';
          break;
        case 'approved':
          statusMatch = assignment.content?.status === 'APPROVED';
          break;
        case 'all':
        default:
          statusMatch = true;
      }

      // Apply search filter
      const searchMatch = searchQuery === '' ||
        assignment.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.content?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.assignedTo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.assignedTo.email.toLowerCase().includes(searchQuery.toLowerCase());

      // Apply content type filter
      const contentTypeMatch = contentTypeFilter === 'all' ||
        assignment.contentType === contentTypeFilter;

      // Apply section filter
      const sectionMatch = sectionFilter === 'all' ||
        assignment.section === sectionFilter;

      // Apply creator filter
      const creatorMatch = creatorFilter === 'all' ||
        assignment.assignedTo.id === creatorFilter;

      // Apply course filter
      const courseMatch = courseFilter === 'all' ||
        assignment.course === courseFilter;

      return statusMatch && searchMatch && contentTypeMatch && sectionMatch && creatorMatch && courseMatch;
    });
  };

  const fetchAssignedCreators = async () => {
    try {
      const res = await apiCall('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();

        // Filter to only show creators assigned to this admin
        const creators = data.users.filter((u: any) => {
          const isCreator = u.role === 'CREATOR';
          const isAssigned = u.assignedAdminId && Array.isArray(u.assignedAdminId) && u.assignedAdminId.includes(user.id);
          return isCreator && isAssigned;
        });

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
          topicsTaughtSoFar,
          guidelines: guidelines || undefined,
          contentType,
          difficulty: difficulty || undefined,
          dueDate: dueDate ? new Date(dueDate + 'T00:00:00.000Z').toISOString() : undefined,
          assignedToId,
          section: section || undefined,
          course: course || undefined
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
          topicsTaughtSoFar,
          guidelines: guidelines || undefined,
          contentType,
          difficulty: difficulty || undefined,
          dueDate: dueDate ? new Date(dueDate + 'T00:00:00.000Z').toISOString() : undefined,
          assignedToId: assignedToId || undefined,
          section: section || undefined,
          course: course || undefined
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
    setTopicsTaughtSoFar([]);
    setGuidelines('');
    setContentType('LECTURE_NOTE');
    setDifficulty('');
    setDueDate('');
    setAssignedToId('');
    setTopicsTaughtSoFarInput('');
    setSection('');
    setCourse('');
    setCreatorCourses([]);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingAssignment(null);
    resetForm();
  };

  const addTopicTaughtSoFar = () => {
    if (topicsTaughtSoFarInput.trim()) {
      const topics = topicsTaughtSoFarInput.split(',').map(t => t.trim()).filter(Boolean);
      setTopicsTaughtSoFar([...topicsTaughtSoFar, ...topics]);
      setTopicsTaughtSoFarInput('');
    }
  };

  const removeTopicTaughtSoFar = (index: number) => {
    setTopicsTaughtSoFar(topicsTaughtSoFar.filter((_, i) => i !== index));
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

  // Get unique courses from all tasks AND assigned creators
  const getUniqueCourses = () => {
    const courses = new Set<string>();

    // Add courses from tasks
    tasks.forEach(task => {
      if (task.course) {
        courses.add(task.course);
      }
    });

    // Add courses from creators
    assignedCreators.forEach(creator => {
      if (creator.courseAssigned && Array.isArray(creator.courseAssigned)) {
        creator.courseAssigned.forEach(course => {
          if (course) {
            courses.add(course);
          }
        });
      }
    });

    return Array.from(courses).sort();
  };

  // Filter tasks based on the filter prop and enhanced filtering
  const filteredTasks = getFilteredTasks();
  const uniqueCourses = getUniqueCourses();

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, contentTypeFilter, sectionFilter, creatorFilter, courseFilter, filter]);

  // Pagination calculations
  const totalItems = filteredTasks.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  // Helper to generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-6">

      {/* Enhanced Filter Section */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        {/* Row 1: Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Bar - Reduced width */}
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
                placeholder="Search tasks..."
              />
            </div>
          </div>

          {/* Section Filter */}
          <div>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value as 'all' | 'PRE_ORDER' | 'IN_ORDER' | 'POST_ORDER')}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            >
              <option value="all">All Sections</option>
              <option value="PRE_ORDER">Pre-Order</option>
              <option value="IN_ORDER">In-Order</option>
              <option value="POST_ORDER">Post-Order</option>
            </select>
          </div>

          {/* Creator Filter */}
          <div>
            <select
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            >
              <option value="all">All Creators</option>
              {assignedCreators.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.name}
                </option>
              ))}
            </select>
          </div>

          {/* Course Filter */}
          <div>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            >
              <option value="all">All Courses</option>
              {uniqueCourses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Content Type Filter */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Type:</span>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'LECTURE_NOTE', 'PRE_READ', 'ASSIGNMENT'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setContentTypeFilter(type)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    contentTypeFilter === type
                      ? 'bg-purple-600 dark:bg-purple-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type === 'all' ? 'All' : type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        {onFilterChange && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-700 mr-2" style={{ textAlign: 'left' }}></span>
                {([
                  { key: 'all', label: 'All Tasks' },
                  { key: 'assigned', label: 'Assigned' },
                  { key: 'review', label: 'Review' },
                  { key: 'rejected', label: 'Rejected' },
                  { key: 'approved', label: 'Approved' }
                ] as const).map(({ key, label }) => {
                  // Calculate count based on all tasks with only search/filter criteria, not the current status tab
                  const count = tasks.filter((assignment) => {
                    // Apply search filter
                    const searchMatch = !searchQuery ||
                      assignment.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      assignment.assignedTo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      assignment.assignedTo.email.toLowerCase().includes(searchQuery.toLowerCase());

                    // Apply content type filter
                    const contentTypeMatch = contentTypeFilter === 'all' ||
                      assignment.contentType === contentTypeFilter;

                    // Apply section filter
                    const sectionMatch = sectionFilter === 'all' ||
                      assignment.section === sectionFilter;

                    // Apply creator filter
                    const creatorMatch = creatorFilter === 'all' ||
                      assignment.assignedTo.id === creatorFilter;

                    // Apply course filter
                    const courseMatch = courseFilter === 'all' ||
                      assignment.course === courseFilter;

                    // Apply status-specific logic for each tab
                    let statusMatch = false;
                    switch (key) {
                      case 'assigned':
                        statusMatch = !assignment.content; // No content created yet
                        break;
                      case 'review':
                        statusMatch = assignment.content?.status === 'REVIEW';
                        break;
                      case 'rejected':
                        statusMatch = assignment.content?.status === 'REJECTED';
                        break;
                      case 'approved':
                        statusMatch = assignment.content?.status === 'APPROVED';
                        break;
                      case 'all':
                      default:
                        statusMatch = true;
                        break;
                    }

                    return statusMatch && searchMatch && contentTypeMatch && sectionMatch && creatorMatch && courseMatch;
                  }).length;

                  return (
                    <button
                      key={key}
                      onClick={() => onFilterChange(key)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        filter === key
                          ? 'bg-blue-600 dark:bg-blue-500 text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {label}
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                        filter === key
                          ? 'bg-blue-500 dark:bg-blue-400 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Clear Filters Button */}
              {(searchQuery || contentTypeFilter !== 'all' || sectionFilter !== 'all' || creatorFilter !== 'all' || courseFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setContentTypeFilter('all');
                    setSectionFilter('all');
                    setCreatorFilter('all');
                    setCourseFilter('all');
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
            {(searchQuery || contentTypeFilter !== 'all' || sectionFilter !== 'all' || creatorFilter !== 'all' || courseFilter !== 'all') && (
              <div className="mt-3 flex items-center gap-2 flex-wrap text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Active:</span>
                {searchQuery && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-xs">
                    Search: "{searchQuery}"
                  </span>
                )}
                {sectionFilter !== 'all' && (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-xs">
                    Section: {sectionFilter.replace('_', '-')}
                  </span>
                )}
                {creatorFilter !== 'all' && (
                  <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-md text-xs">
                    Creator: {assignedCreators.find(c => c.id === creatorFilter)?.name}
                  </span>
                )}
                {courseFilter !== 'all' && (
                  <span className="px-2 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 rounded-md text-xs">
                    Course: {courseFilter}
                  </span>
                )}
                {contentTypeFilter !== 'all' && (
                  <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-md text-xs">
                    Type: {contentTypeFilter.replace('_', ' ')}
                  </span>
                )}
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium">
                  {filteredTasks.length} of {tasks.length} tasks
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {(isCreating || editingAssignment) && (
        <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-[90] p-4 pt-20">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isCreating ? 'Create New Task' : 'Edit Task'}
              </h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingAssignment(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Topic <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="e.g., React Hooks - useState and useEffect"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assign To <span className="text-red-500">*</span>
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select a creator... ({assignedCreators.length} available)</option>
                {assignedCreators.map((creator) => (
                  <option key={creator.id} value={creator.id}>
                    {creator.name} ({creator.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Row 1: Content Type and Course */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="LECTURE_NOTE">Lecture Note</option>
                  <option value="PRE_READ">Pre-read</option>
                  <option value="ASSIGNMENT">Assignment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Course <span className="text-red-500">*</span>
                </label>
                <select
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  required
                  disabled={!assignedToId}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select course...</option>
                  {creatorCourses.map((courseName) => (
                    <option key={courseName} value={courseName}>
                      {courseName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {assignedToId
                    ? `Shows courses assigned to ${assignedCreators.find(c => c.id === assignedToId)?.name || 'selected creator'}`
                    : 'Select a creator first to see available courses'}
                </p>
              </div>
            </div>

            {/* Row 2: Section and Due Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Section <span className="text-red-500">*</span>
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value as 'PRE_ORDER' | 'IN_ORDER' | 'POST_ORDER' | '')}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select section...</option>
                  <option value="PRE_ORDER">Pre-Order</option>
                  <option value="IN_ORDER">In-Order</option>
                  <option value="POST_ORDER">Post-Order</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Categorizes content by course learning phase
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {contentType === 'ASSIGNMENT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Difficulty <span className="text-red-500">*</span>
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select difficulty...</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Required for assignment content type. Determines validation criteria.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Topics taught so far <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={topicsTaughtSoFarInput}
                  onChange={(e) => setTopicsTaughtSoFarInput(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Enter topics separated by commas (e.g., HTML, CSS, JavaScript)"
                  onKeyPress={(e) => e.key === 'Enter' && addTopicTaughtSoFar()}
                />
                <button
                  type="button"
                  onClick={addTopicTaughtSoFar}
                  className="px-4 py-2 bg-gray-700 dark:bg-gray-600 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-700"
                >
                  Add
                </button>
              </div>
              {topicsTaughtSoFar.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {topicsTaughtSoFar.map((topic, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-sm flex items-center gap-1"
                    >
                      {topic}
                      <button
                        type="button"
                        onClick={() => removeTopicTaughtSoFar(index)}
                        className="text-purple-800 dark:text-purple-300 hover:opacity-80"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Required for proper LLM validation. Enter at least one prerequisite topic.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sub-topics <span className="text-red-500">*</span>
              </label>
              <textarea
                value={guidelines}
                onChange={(e) => setGuidelines(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Provide specific sub-topics, requirements, target audience, style preferences, etc. (Minimum 10 characters)"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Required for effective LLM validation. Minimum 10 characters. Be specific about requirements.
              </p>
            </div>

            {/* Validation Summary */}
            </div>

            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingAssignment(null);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
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
                disabled={!topic || !assignedToId || topicsTaughtSoFar.length === 0 || guidelines.length < 10 || (contentType === 'ASSIGNMENT' && !difficulty) || !section || !course}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed"
              >
                {editingAssignment ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignments List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {filter === 'all' ? 'All Tasks' :
             filter === 'assigned' ? 'Assigned Tasks' :
             filter === 'review' ? 'Review Tasks' :
             filter === 'rejected' ? 'Rejected Tasks' :
             filter === 'approved' ? 'Approved Tasks' : 'All Tasks'}
          </h3>
        </div>
        
        <div className="space-y-3">
          {paginatedTasks.map((assignment) => (
            <details
              key={assignment.id}
              className="rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xl transition-all duration-300 details-toggle group"
            >
              <summary className="p-5 cursor-pointer hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 dark:hover:from-gray-800 dark:hover:to-gray-700 transition-all duration-300 bg-white dark:bg-gray-800 rounded-xl relative overflow-hidden">
                {/* Background Icon */}
                <div className="absolute right-8 top-4 opacity-10 dark:opacity-10 -rotate-12 ">
                  <svg className="w-32 h-32 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(assignment.content ? assignment.content.status : assignment.status)}`}>
                            {assignment.content ? assignment.content.status : assignment.status.replace('_', ' ')}
                          </span>
                          {assignment.content?.status === 'REVIEW' && (
                            <span className="px-2.5 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full font-medium animate-pulse">
                              Ready for Review
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {assignment.assignedTo.name}
                          </span>
                          {assignment.course && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              {assignment.course}
                            </span>
                          )}
                          {assignment.section && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              {assignment.section.replace('_', '-')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Created: {formatDate(assignment.createdAt)}
                          </span>
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
              
              <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
                <div className="pt-4 space-y-4">
                  {/* Task Details */}
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Task Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5"></div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Assigned To</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{assignment.assignedTo.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{assignment.assignedTo.email}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5"></div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Content Type</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{assignment.contentType.replace('_', ' ')}</p>
                        </div>
                      </div>
                      {assignment.difficulty && (
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5"></div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Difficulty</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{assignment.difficulty}</p>
                          </div>
                        </div>
                      )}
                      {assignment.course && (
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5"></div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Course</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{assignment.course}</p>
                          </div>
                        </div>
                      )}
                      {assignment.section && (
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5"></div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Section</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{assignment.section.replace('_', '-')}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-500 mt-1.5"></div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(assignment.createdAt)}</p>
                        </div>
                      </div>
                      {assignment.dueDate && (
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5"></div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(assignment.dueDate)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Topics Taught So Far */}
                  {assignment.topicsTaughtSoFar.length > 0 && (
                    <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Topics Taught So Far
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {assignment.topicsTaughtSoFar.map((topic, index) => (
                          <span key={index} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-800">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Guidelines */}
                  {assignment.guidelines && (
                    <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Sub-topics & Guidelines
                      </h4>
                      <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-md border-l-4 border-purple-500">
                        {assignment.guidelines}
                      </div>
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
                          <div className="flex gap-2">
                            {assignment.content?.status === 'REVIEW' && onSwitchToReview && (
                              <button
                                onClick={() => onSwitchToReview(assignment.content?.id)}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                              >
                                Review Now
                              </button>
                            )}
                            <button
                              onClick={() => {
                                // Redirect to review interface to view the content
                                if (assignment.content?.id && onSwitchToReview) {
                                  onSwitchToReview(assignment.content.id);
                                } else {
                                  alert('Content not available for viewing');
                                }
                              }}
                              className="px-3 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Content
                            </button>
                          </div>
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
                    {(() => {
                      const effectiveStatus = assignment.content ? assignment.content.status : assignment.status;
                      const isCompleted = effectiveStatus === 'APPROVED' || effectiveStatus === 'COMPLETED';
                      
                      if (isCompleted) {
                        return (
                          <button
                            disabled
                            className="px-4 py-2 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed text-sm font-medium"
                            title="Cannot edit completed tasks"
                          >
                            Edit Task (Completed)
                          </button>
                        );
                      }
                      
                      return (
                        <button
                          onClick={() => {
                            setEditingAssignment(assignment);
                          }}
                          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
                        >
                          Edit Task
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </details>
          ))}

          {filteredTasks.length === 0 && (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {filter === 'all' ? 'No Tasks Yet' :
                 filter === 'assigned' ? 'No Assigned Tasks' :
                 filter === 'review' ? 'No Review Tasks' :
                 filter === 'rejected' ? 'No Rejected Tasks' :
                 filter === 'approved' ? 'No Approved Tasks' : 'No Tasks Yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {filter === 'all' ? 'Create your first content task to get started.' :
                 filter === 'assigned' ? 'No tasks are currently assigned.' :
                 filter === 'review' ? 'No tasks are currently under review.' :
                 filter === 'rejected' ? 'No tasks have been rejected.' :
                 filter === 'approved' ? 'No tasks have been approved.' : 'Create your first content task to get started.'}
              </p>
              {filter === 'all' && (
                <button
                  onClick={startCreating}
                  className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600"
                >
                  Create Task
                </button>
              )}
            </div>
          )}

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

                {/* Page numbers */}
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-gray-500 dark:text-gray-400">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page as number)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-purple-600 dark:bg-purple-500 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}

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
      </div>

      {/* Floating Create Button */}
      <button
        onClick={startCreating}
        className="fixed bottom-6 right-6 z-[95] w-14 h-14 bg-purple-600 dark:bg-purple-500 text-white rounded-full shadow-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-all hover:scale-110 flex items-center justify-center group"
        title="Create New Task"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
        </svg>
        <span className="absolute right-full mr-3 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Create New Task
        </span>
      </button>
    </div>
  );
}
