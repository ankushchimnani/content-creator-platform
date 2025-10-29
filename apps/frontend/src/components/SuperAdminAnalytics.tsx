import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';

type Props = {
  token: string;
};

type AnalyticsData = {
  metrics: {
    totalAssigned: number;
    pendingReview: number;
    approved: number;
    rejected: number;
  };
  overview: {
    totalContent: number;
    activeUsers: number;
    avgQualityScore: number;
    approvalRate: number;
  };
  filterOptions: {
    admins: Array<{ value: string; label: string; }>;
    creators: Array<{ value: string; label: string; }>;
    months: Array<{ value: string; label: string; }>;
    courses: Array<{ value: string; label: string; }>;
    sections: Array<{ value: string; label: string; }>;
  };
};

export function SuperAdminAnalytics({ token }: Props) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Filter states - now all can be active simultaneously
  const [selectedAdmin, setSelectedAdmin] = useState<string>('all');
  const [selectedCreator, setSelectedCreator] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');

  useEffect(() => {
    fetchAnalytics();
  }, [selectedAdmin, selectedCreator, selectedMonth, selectedCourse, selectedSection]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Build query params with all active filters
      const params = new URLSearchParams();

      if (selectedAdmin !== 'all') params.append('adminId', selectedAdmin);
      if (selectedCreator !== 'all') params.append('creatorId', selectedCreator);
      if (selectedMonth !== 'all') params.append('month', selectedMonth);
      if (selectedCourse !== 'all') params.append('course', selectedCourse);
      if (selectedSection !== 'all') params.append('section', selectedSection);

      const response = await apiCall(`/api/super-admin/analytics?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSelectedAdmin('all');
    setSelectedCreator('all');
    setSelectedMonth('all');
    setSelectedCourse('all');
    setSelectedSection('all');
  };

  const hasActiveFilters = () => {
    return selectedAdmin !== 'all' ||
           selectedCreator !== 'all' ||
           selectedMonth !== 'all' ||
           selectedCourse !== 'all' ||
           selectedSection !== 'all';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Track content performance with flexible filtering</p>
      </div>

      {/* Filter Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Data Filters</h3>
          {hasActiveFilters() && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Admin Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Admin
            </label>
            <select
              value={selectedAdmin}
              onChange={(e) => setSelectedAdmin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="all">All Admins</option>
              {analytics.filterOptions.admins.map(admin => (
                <option key={admin.value} value={admin.value}>{admin.label}</option>
              ))}
            </select>
          </div>

          {/* Creator Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Creator
            </label>
            <select
              value={selectedCreator}
              onChange={(e) => setSelectedCreator(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="all">All Creators</option>
              {analytics.filterOptions.creators.map(creator => (
                <option key={creator.value} value={creator.value}>{creator.label}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="all">All Months</option>
              {analytics.filterOptions.months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>

          {/* Course Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Course
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="all">All Courses</option>
              {analytics.filterOptions.courses.map(course => (
                <option key={course.value} value={course.value}>{course.label}</option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="all">All Sections</option>
              {analytics.filterOptions.sections.map(section => (
                <option key={section.value} value={section.value}>{section.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters() && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
            {selectedAdmin !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300">
                Admin: {analytics.filterOptions.admins.find(a => a.value === selectedAdmin)?.label}
                <button onClick={() => setSelectedAdmin('all')} className="ml-2 hover:text-indigo-600">×</button>
              </span>
            )}
            {selectedCreator !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                Creator: {analytics.filterOptions.creators.find(c => c.value === selectedCreator)?.label}
                <button onClick={() => setSelectedCreator('all')} className="ml-2 hover:text-green-600">×</button>
              </span>
            )}
            {selectedMonth !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                Month: {analytics.filterOptions.months.find(m => m.value === selectedMonth)?.label}
                <button onClick={() => setSelectedMonth('all')} className="ml-2 hover:text-purple-600">×</button>
              </span>
            )}
            {selectedCourse !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                Course: {selectedCourse}
                <button onClick={() => setSelectedCourse('all')} className="ml-2 hover:text-blue-600">×</button>
              </span>
            )}
            {selectedSection !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                Section: {analytics.filterOptions.sections.find(s => s.value === selectedSection)?.label}
                <button onClick={() => setSelectedSection('all')} className="ml-2 hover:text-orange-600">×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Primary 4 Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Assigned */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Assigned Content</p>
              <p className="text-4xl font-bold text-gray-900 dark:text-white">{analytics.metrics.totalAssigned}</p>
            </div>
            <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Pending Review */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Pending Review Content</p>
              <p className="text-4xl font-bold text-gray-900 dark:text-white">{analytics.metrics.pendingReview}</p>
            </div>
            <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Approved */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Approved Content</p>
              <p className="text-4xl font-bold text-gray-900 dark:text-white">{analytics.metrics.approved}</p>
            </div>
            <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Rejected */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Rejected Contents</p>
              <p className="text-4xl font-bold text-gray-900 dark:text-white">{analytics.metrics.rejected}</p>
            </div>
            <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Cards (Bottom Section) */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Platform Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Content</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{analytics.overview.totalContent}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All time</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{analytics.overview.activeUsers}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Creators & Admins</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Quality Score</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{analytics.overview.avgQualityScore.toFixed(1)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Out of 100</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Approval Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{analytics.overview.approvalRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Content approved</p>
              </div>
              <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
