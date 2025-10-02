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
  assignedBy?: {
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

type TaskFilter = 'All' | 'Assigned' | 'In Progress' | 'Completed';

type Props = {
  user: User;
  token: string;
  onLogout: () => void;
  onNavigateToSettings?: () => void;
};

export function ContentValidationDashboard({ user, token, onLogout, onNavigateToSettings }: Props) {
  const [tasks, setTasks] = useState<Assignment[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Assignment[]>([]);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Task counts
  const taskCounts = {
    All: tasks.length,
    Assigned: tasks.filter(t => t.status === 'ASSIGNED').length,
    'In Progress': tasks.filter(t => t.status === 'IN_PROGRESS').length,
    Completed: tasks.filter(t => t.status === 'COMPLETED').length
  };

  useEffect(() => {
    fetchTasks();
    // Set up polling for real-time updates
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Filter tasks based on active filter and search query
    let filtered = tasks;

    // Apply status filter
    if (activeFilter !== 'All') {
      const statusMap: Record<TaskFilter, string> = {
        'All': '',
        'Assigned': 'ASSIGNED',
        'In Progress': 'IN_PROGRESS',
        'Completed': 'COMPLETED'
      };
      filtered = filtered.filter(task => task.status === statusMap[activeFilter]);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.topic.toLowerCase().includes(query) ||
        (user.role === 'ADMIN' ? task.assignedTo.name : task.assignedBy?.name || '').toLowerCase().includes(query) ||
        task.contentType.toLowerCase().includes(query)
      );
    }

    setFilteredTasks(filtered);
  }, [tasks, activeFilter, searchQuery, user.role]);

  const fetchTasks = async () => {
    try {
      const endpoint = user.role === 'ADMIN' ? '/api/assignments' : '/api/assignments/my-tasks';
      const res = await apiCall(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.assignments);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createContent = (task: Assignment) => {
    // Redirect to content creation page with task context
    const taskData = encodeURIComponent(JSON.stringify({
      taskId: task.id,
      topic: task.topic,
      contentType: task.contentType,
      guidelines: task.guidelines,
      prerequisiteTopics: task.prerequisiteTopics
    }));
    
    // Navigate to content creation with task data
    window.location.href = `/#/create-content?task=${taskData}`;
  };

  const createNewTask = () => {
    alert('Opening new task creation form...');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex h-screen w-full">
      {/* Sidebar */}
      <aside className="w-20 bg-gray-800 flex flex-col items-center py-6">
        <div className="flex items-center justify-center h-12 w-12 bg-indigo-600 rounded-lg mb-8">
          <span className="material-icons text-white text-3xl">school</span>
        </div>
        <nav className="flex flex-col items-center space-y-6">
          {/* Assignment/Tasks - Current active view */}
          <div className="text-indigo-400 transition-colors p-2 rounded-lg bg-gray-700">
            <span className="material-icons text-3xl">assignment</span>
          </div>
        </nav>
        <div className="mt-auto flex flex-col items-center space-y-6">
          <button 
            onClick={onNavigateToSettings}
            className="text-gray-400 hover:text-indigo-400 transition-colors p-2 rounded-lg hover:bg-gray-700"
            title="Settings"
          >
            <span className="material-icons text-3xl">settings</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Content Validation Dashboard</h1>
          <div className="flex items-center gap-4">
            {user.role === 'ADMIN' && (
              <button
                onClick={createNewTask}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="material-icons text-xl">add</span> New Task
              </button>
            )}
            <div className="flex items-center gap-2">
              <img 
                alt="User avatar" 
                className="w-10 h-10 rounded-full object-cover bg-orange-100 flex items-center justify-center" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAH4bxsQWSYi84Z7hKvBT-gTsdg7ory05d01ZljS03ZAI4IInN8R04au7ciqSmffaDzQpmKcjchJ5fJ-mjY93hf4-FHHNHdTgly39HKhgm7sxRtGiCi6mIOLsD6Pyx-7RZ7x8ACYdmWHuvU0dc3Ba4uDObfS7-ufqVwpgAjbQEtvQN-bytHqra7U8RVla1YbhPWLZWOb8clM6CHv7loEp2EqUjHPxbVnXlM3Ezir_CNU7rbMlWu-Ucl2G7wvUK-myzfAz23hsLj56Jm"
              />
              <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role.toLowerCase()} Validator</p>
              </div>
              <button 
                onClick={onLogout}
                className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
              >
                <span className="material-icons">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto bg-gray-50">
          <div>
            <div className="flex justify-between items-center mb-6">
              {/* Filter Buttons */}
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                {(['All', 'Assigned', 'In Progress', 'Completed'] as TaskFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeFilter === filter
                        ? 'text-indigo-600 bg-white shadow-sm'
                        : 'text-gray-600 hover:text-indigo-600'
                    }`}
                  >
                    {filter}{' '}
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                      activeFilter === filter
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {taskCounts[filter]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    search
                  </span>
                  <input
                    className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Search tasks..."
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Task List */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="space-y-4">
                {filteredTasks.map((task) => (
                  <details key={task.id} className="details-toggle border border-gray-200 rounded-lg">
                    <summary className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        {task.status === 'COMPLETED' ? (
                          <span className="material-icons text-green-600 text-2xl">check_circle</span>
                        ) : (
                          <span className="material-icons text-indigo-600 text-2xl">description</span>
                        )}
                        <div>
                          <h4 className="text-lg font-semibold">{task.topic}</h4>
                          <p className="text-sm text-gray-500">
                            {user.role === 'ADMIN' 
                              ? `Assigned to ${task.assignedTo.name}`
                              : `Assigned by ${task.assignedBy?.name || 'Admin'}`
                            }
                            {task.status === 'COMPLETED' && (
                              <span> • Completed on {formatDate(task.updatedAt)}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        {task.status === 'ASSIGNED' && (
                          <span className="px-2.5 py-0.5 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full">
                            ASSIGNED
                          </span>
                        )}
                        {task.status === 'IN_PROGRESS' && (
                          <span className="px-2.5 py-0.5 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">
                            IN PROGRESS
                          </span>
                        )}
                        {task.status === 'COMPLETED' && (
                          <span className="px-2.5 py-0.5 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                            COMPLETED
                          </span>
                        )}
                        {task.dueDate && (
                          <p className="text-sm text-gray-500 hidden sm:block">
                            Due: <span className="font-medium text-gray-900">
                              {formatDate(task.dueDate)}
                            </span>
                          </p>
                        )}
                        <span className="material-icons text-gray-400 transition-transform arrow-down">
                          expand_more
                        </span>
                      </div>
                    </summary>
                    
                    <div className="p-6 border-t border-gray-200 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                          <h5 className="font-semibold mb-2">Task Details</h5>
                          <p className="text-sm text-gray-500">
                            {task.guidelines || `Please review the ${task.contentType.replace('_', ' ').toLowerCase()} content for ${task.topic}. Ensure the content is accurate, clear, and includes appropriate examples.`}
                          </p>
                          
                          {task.prerequisiteTopics.length > 0 && (
                            <div className="mt-4">
                              <p className="text-sm font-medium mb-2">Prerequisites covered:</p>
                              <div className="flex flex-wrap gap-2">
                                {task.prerequisiteTopics.map((topic, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-3 py-1 text-sm font-medium text-indigo-600 bg-indigo-100 rounded-full"
                                  >
                                    {topic}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {task.guidelines && (
                            <div className="mt-4 bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-600">
                              <p className="text-sm font-medium text-indigo-800">Guidelines:</p>
                              <ul className="list-disc list-inside text-sm text-indigo-700 mt-1">
                                <li>Check for technical accuracy.</li>
                                <li>Verify clarity and conciseness.</li>
                                <li>Ensure examples are correct and runnable.</li>
                                <li>Check for any grammatical errors or typos.</li>
                              </ul>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          {task.status === 'COMPLETED' ? (
                            <>
                              <h5 className="font-semibold mb-2">Validator's Feedback</h5>
                              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-600">
                                <p className="text-sm font-medium text-green-800">
                                  {task.content?.status === 'APPROVED' 
                                    ? '"Content approved successfully. Well-structured and clear."'
                                    : task.content?.status === 'REJECTED'
                                    ? '"Content needs revision. Please check feedback."'
                                    : '"Task completed successfully."'
                                  }
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <h5 className="font-semibold mb-2">Actions</h5>
                              <div className="flex flex-col gap-2">
                                {task.status === 'IN_PROGRESS' && user.role === 'CREATOR' && (
                                  <button
                                    onClick={() => createContent(task)}
                                    className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                                  >
                                    <span className="material-icons text-base">edit</span> Create Content
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                ))}

                {/* Empty State */}
                {filteredTasks.length === 0 && (
                  <div className="text-left py-12">
                    <span className="material-icons text-6xl text-gray-400 mb-4">assignment</span>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchQuery ? 'No tasks found' : 'No tasks yet'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {searchQuery 
                        ? `No tasks match "${searchQuery}"`
                        : 'Tasks will appear here when they are assigned'
                      }
                    </p>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}