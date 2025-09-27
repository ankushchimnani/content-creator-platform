import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  assignedAdmin?: {
    id: string;
    name: string;
    email: string;
  };
  assignedCreators?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  contents?: Array<{
    id: string;
    contentType: string;
    approvedAt: string;
    title: string;
  }>;
  assignedTasks?: Array<{
    id: string;
    content?: {
      id: string;
      contentType: string;
      status: string;
      approvedAt: string;
      title: string;
    };
  }>;
};

type PaymentConfig = {
  id: string;
  contentType: string;
  amountPerUnit: number;
  isActive: boolean;
};

type InvoiceData = {
  creator: User;
  payments: Array<{
    contentType: string;
    count: number;
    amountPerUnit: number;
    totalAmount: number;
    content: Array<{
      id: string;
      title: string;
      approvedAt: string;
      wordCount: number;
    }>;
  }>;
  totalAmount: number;
  period: {
    startDate?: string;
    endDate?: string;
  };
};

type DashboardStats = {
  content: Record<string, number>;
  assignments: Record<string, number>;
  users: Record<string, number>;
  adminAssignments: Array<{
    id: string;
    name: string;
    email: string;
    assignedCreatorsCount: number;
  }>;
  period: {
    startDate?: string;
    endDate?: string;
  };
};

type Props = {
  user: User;
  token: string;
  onLogout: () => void;
};

// Color schemes for charts
const COLORS = {
  content: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'],
  payment: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'],
  role: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300']
};

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function SuperAdminDashboard({ user, token, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<'users' | 'invoices' | 'dashboard' | 'assignments'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [paymentConfigs, setPaymentConfigs] = useState<PaymentConfig[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [allInvoicesData, setAllInvoicesData] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<{creatorId: string, adminId: string | null} | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchPaymentConfigs();
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardStats();
    }
  }, [activeTab, startDate, endDate]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await apiCall('/api/superadmin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPaymentConfigs = async () => {
    try {
      const response = await apiCall('/api/superadmin/payment-config', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setPaymentConfigs(data.configs);
    } catch (error) {
      console.error('Error fetching payment configs:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await apiCall(`/api/superadmin/dashboard-stats?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setDashboardStats(data.stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchInvoice = async (creatorId: string) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await apiCall(`/api/superadmin/invoice/${creatorId}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setInvoiceData(data);
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMultipleInvoices = async () => {
    if (selectedCreators.length === 0) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const invoicePromises = selectedCreators.map(creatorId => 
        apiCall(`/api/superadmin/invoice/${creatorId}?${params}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).then(response => response.ok ? response.json() : null)
      );
      
      const invoices = await Promise.all(invoicePromises);
      const validInvoices = invoices.filter(invoice => invoice !== null);
      setAllInvoicesData(validInvoices);
    } catch (error) {
      console.error('Error fetching multiple invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatorSelection = (creatorId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedCreators(prev => [...prev, creatorId]);
    } else {
      setSelectedCreators(prev => prev.filter(id => id !== creatorId));
    }
  };

  const selectAllCreators = () => {
    setSelectedCreators(creators.map(c => c.id));
  };

  const clearSelection = () => {
    setSelectedCreators([]);
  };

  const updatePaymentConfig = async (contentType: string, amountPerUnit: number) => {
    try {
      await apiCall('/api/superadmin/payment-config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contentType, amountPerUnit })
      });
      await fetchPaymentConfigs();
    } catch (error) {
      console.error('Error updating payment config:', error);
    }
  };

  const updateAdminAssignment = async (creatorId: string, adminId: string | null) => {
    try {
      await apiCall('/api/superadmin/assign-admin', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ creatorId, adminId })
      });
      await fetchUsers();
      setEditingAssignment(null);
    } catch (error) {
      console.error('Error updating admin assignment:', error);
    }
  };

  const exportInvoicesCSV = async () => {
    try {
      setIsLoading(true);
      
      // If we have multiple invoices data, use it; otherwise fetch all invoices
      let invoicesToExport = allInvoicesData;
      
      if (invoicesToExport.length === 0) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        const response = await apiCall(`/api/superadmin/invoices/export?${params}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        invoicesToExport = data.invoices;
      }
      
      // Create CSV content
      const csvContent = [
        ['Creator Name', 'Creator Email', 'Admin Name', 'Admin Email', 'PRE_READ Count', 'PRE_READ Amount (₹)', 'ASSIGNMENT Count', 'ASSIGNMENT Amount (₹)', 'LECTURE_NOTE Count', 'LECTURE_NOTE Amount (₹)', 'Total Amount (₹)'],
        ...invoicesToExport.map((invoice: any) => [
          invoice.creator?.name || invoice.creatorName,
          invoice.creator?.email || invoice.creatorEmail,
          invoice.creator?.assignedAdmin?.name || invoice.assignedAdminName || 'Unassigned',
          invoice.creator?.assignedAdmin?.email || invoice.assignedAdminEmail || '',
          invoice.payments.find((p: any) => p.contentType === 'PRE_READ')?.count || 0,
          invoice.payments.find((p: any) => p.contentType === 'PRE_READ')?.totalAmount || 0,
          invoice.payments.find((p: any) => p.contentType === 'ASSIGNMENT')?.count || 0,
          invoice.payments.find((p: any) => p.contentType === 'ASSIGNMENT')?.totalAmount || 0,
          invoice.payments.find((p: any) => p.contentType === 'LECTURE_NOTE')?.count || 0,
          invoice.payments.find((p: any) => p.contentType === 'LECTURE_NOTE')?.totalAmount || 0,
          invoice.totalAmount
        ])
      ].map(row => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices_${startDate || 'all'}_${endDate || 'all'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const creators = users.filter(u => u.role === 'CREATOR');
  const admins = users.filter(u => u.role === 'ADMIN');

  // Prepare chart data
  const prepareContentStatusData = () => {
    if (!dashboardStats) return [];
    return Object.entries(dashboardStats.content).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      count: count
    }));
  };

  const prepareAssignmentStatusData = () => {
    if (!dashboardStats) return [];
    return Object.entries(dashboardStats.assignments).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      count: count
    }));
  };

  const prepareUserRoleData = () => {
    if (!dashboardStats) return [];
    return Object.entries(dashboardStats.users).map(([role, count]) => ({
      name: role.charAt(0).toUpperCase() + role.slice(1),
      value: count,
      count: count
    }));
  };

  const preparePaymentData = () => {
    return paymentConfigs.map(config => ({
      name: config.contentType.replace('_', ' '),
      amount: config.amountPerUnit,
      color: COLORS.payment[paymentConfigs.indexOf(config)]
    }));
  };

  const prepareCreatorPerformanceData = () => {
    return creators.map(creator => {
      const approvedContent = creator.contents?.filter(c => c.approvedAt) || [];
      const totalEarnings = approvedContent.reduce((sum, content) => {
        const config = paymentConfigs.find(c => c.contentType === content.contentType);
        return sum + (config?.amountPerUnit || 0);
      }, 0);
      
      return {
        name: creator.name.split(' ')[0], // First name only
        earnings: totalEarnings,
        contentCount: approvedContent.length,
        assignments: creator.assignedTasks?.length || 0
      };
    });
  };

  const prepareAdminWorkloadData = () => {
    return dashboardStats?.adminAssignments.map(admin => ({
      name: admin.name.split(' ')[0], // First name only
      creators: admin.assignedCreatorsCount,
      workload: admin.assignedCreatorsCount * 10 // Assuming 10 tasks per creator
    })) || [];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h2>
              <p className="text-sm text-gray-600">Welcome, {user.name}</p>
            </div>
            <button
              onClick={onLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'users', label: 'User Management' },
              { id: 'invoices', label: 'Invoices & Reports' },
              { id: 'assignments', label: 'Admin Assignments' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white border-b py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            />
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-900">Dashboard Analytics</h2>
              <div className="text-sm text-gray-500">
                Last updated: {new Date().toLocaleString()}
              </div>
            </div>
            
            {dashboardStats && (
              <>
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100">Total Content</p>
                        <p className="text-3xl font-bold">{Object.values(dashboardStats.content).reduce((a, b) => a + b, 0)}</p>
                      </div>
                      <div className="text-blue-200">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100">Approved Content</p>
                        <p className="text-3xl font-bold">{dashboardStats.content.approved || 0}</p>
                      </div>
                      <div className="text-green-200">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100">Total Users</p>
                        <p className="text-3xl font-bold">{Object.values(dashboardStats.users).reduce((a, b) => a + b, 0)}</p>
                      </div>
                      <div className="text-purple-200">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-100">Active Assignments</p>
                        <p className="text-3xl font-bold">{dashboardStats.assignments.assigned || 0}</p>
                      </div>
                      <div className="text-orange-200">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Content Status Pie Chart */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Status Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={prepareContentStatusData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={renderCustomizedLabel}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {prepareContentStatusData().map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS.content[index % COLORS.content.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`${value} items`, 'Count']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* User Roles Pie Chart */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">User Roles Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={prepareUserRoleData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={renderCustomizedLabel}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {prepareUserRoleData().map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS.role[index % COLORS.role.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`${value} users`, 'Count']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Charts Row 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Assignment Status Bar Chart */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Status Overview</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={prepareAssignmentStatusData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value: any) => [`${value} assignments`, 'Count']} />
                        <Bar dataKey="count" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Payment Rates Bar Chart */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Rates by Content Type</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={preparePaymentData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Amount']} />
                        <Bar dataKey="amount" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Charts Row 3 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Creator Performance */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Creator Performance & Earnings</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={prepareCreatorPerformanceData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip 
                          formatter={(value: any, name: string) => [
                            name === 'earnings' ? `₹${value.toLocaleString()}` : value,
                            name === 'earnings' ? 'Earnings' : 'Content Count'
                          ]} 
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="earnings" fill="#8884d8" name="Earnings" />
                        <Bar yAxisId="right" dataKey="contentCount" fill="#82ca9d" name="Content Count" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Admin Workload */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Workload Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={prepareAdminWorkloadData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value: any, name: string) => [
                          value,
                          name === 'creators' ? 'Assigned Creators' : 'Workload Score'
                        ]} />
                        <Area type="monotone" dataKey="creators" stackId="1" stroke="#8884d8" fill="#8884d8" />
                        <Area type="monotone" dataKey="workload" stackId="2" stroke="#82ca9d" fill="#82ca9d" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Summary Statistics */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {dashboardStats.content.approved || 0}
                      </div>
                      <div className="text-sm text-blue-800">Approved Content</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {dashboardStats.content.rejected ? 
                          `${Math.round(((dashboardStats.content.approved || 0) / ((dashboardStats.content.approved || 0) + (dashboardStats.content.rejected || 0))) * 100)}% approval rate` : 
                          '100% approval rate'
                        }
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        ₹{creators.reduce((total, creator) => {
                          const approvedContent = creator.contents?.filter(c => c.approvedAt) || [];
                          return total + approvedContent.reduce((sum, content) => {
                            const config = paymentConfigs.find(c => c.contentType === content.contentType);
                            return sum + (config?.amountPerUnit || 0);
                          }, 0);
                        }, 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-green-800">Total Earnings</div>
                      <div className="text-xs text-green-600 mt-1">
                        Across all creators
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {dashboardStats.adminAssignments.length}
                      </div>
                      <div className="text-sm text-purple-800">Active Admins</div>
                      <div className="text-xs text-purple-600 mt-1">
                        Managing {creators.length} creators
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
              <div className="flex space-x-4">
                <h3 className="text-lg font-medium text-gray-900">Payment Configuration</h3>
              </div>
            </div>

            {/* Payment Configuration */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Rates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {paymentConfigs.map(config => (
                  <div key={config.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{config.contentType.replace('_', ' ')}</span>
                      <span className="text-sm text-gray-500">₹{config.amountPerUnit.toLocaleString()}</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={config.amountPerUnit}
                      onChange={(e) => updatePaymentConfig(config.contentType, parseFloat(e.target.value))}
                      className="w-full border border-gray-300 rounded-md px-3 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">All Users</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Admin</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map(user => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' :
                            user.role === 'CREATOR' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.assignedAdmin?.name || 'Unassigned'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {user.role === 'CREATOR' && (
                            <button
                              onClick={() => fetchInvoice(user.id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Invoice
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Invoices & Reports</h2>
              <div className="flex space-x-2">
                <button
                  onClick={fetchMultipleInvoices}
                  disabled={selectedCreators.length === 0 || isLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : `Generate Invoices (${selectedCreators.length})`}
                </button>
                <button
                  onClick={exportInvoicesCSV}
                  disabled={isLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoading ? 'Exporting...' : 'Export CSV'}
                </button>
              </div>
            </div>

            {/* Payment Overview Chart */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Overview</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-md font-medium text-gray-700 mb-3">Payment Rates</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={preparePaymentData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Amount']} />
                      <Bar dataKey="amount" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h4 className="text-md font-medium text-gray-700 mb-3">Creator Earnings Distribution</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={prepareCreatorPerformanceData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, earnings }: any) => `${name}: ₹${earnings.toLocaleString()}`}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="earnings"
                      >
                        {prepareCreatorPerformanceData().map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS.payment[index % COLORS.payment.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Earnings']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Creator Selection */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Select Creators for Invoice Generation</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={selectAllCreators}
                    className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {creators.map(creator => (
                  <div key={creator.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      id={`creator-${creator.id}`}
                      checked={selectedCreators.includes(creator.id)}
                      onChange={(e) => handleCreatorSelection(creator.id, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`creator-${creator.id}`} className="flex-1 cursor-pointer">
                      <div className="font-medium text-gray-900">{creator.name}</div>
                      <div className="text-sm text-gray-500">{creator.email}</div>
                      <div className="text-xs text-gray-400">
                        Admin: {creator.assignedAdmin?.name || 'Unassigned'}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              
              {selectedCreators.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    {selectedCreators.length} creator{selectedCreators.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </div>

            {/* Invoices Table */}
            {allInvoicesData.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Invoice Summary ({allInvoicesData.length} creators)
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creator</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pre-read</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lecture Note</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allInvoicesData.map((invoice, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {invoice.creator?.name || invoice.creatorName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {invoice.creator?.email || invoice.creatorEmail}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {invoice.creator?.assignedAdmin?.name || invoice.assignedAdminName || 'Unassigned'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {invoice.payments.find((p: any) => p.contentType === 'PRE_READ')?.count || 0} items
                            </div>
                            <div className="text-sm text-gray-500">
                              ₹{(invoice.payments.find((p: any) => p.contentType === 'PRE_READ')?.totalAmount || 0).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {invoice.payments.find((p: any) => p.contentType === 'ASSIGNMENT')?.count || 0} items
                            </div>
                            <div className="text-sm text-gray-500">
                              ₹{(invoice.payments.find((p: any) => p.contentType === 'ASSIGNMENT')?.totalAmount || 0).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {invoice.payments.find((p: any) => p.contentType === 'LECTURE_NOTE')?.count || 0} items
                            </div>
                            <div className="text-sm text-gray-500">
                              ₹{(invoice.payments.find((p: any) => p.contentType === 'LECTURE_NOTE')?.totalAmount || 0).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              ₹{invoice.totalAmount.toLocaleString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900" colSpan={5}>
                          Grand Total
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          ₹{allInvoicesData.reduce((sum, invoice) => sum + invoice.totalAmount, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Individual Invoice Display (for backward compatibility) */}
            {invoiceData && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Individual Invoice for {invoiceData.creator.name}
                </h3>
                <div className="mb-4">
                  <p><strong>Creator:</strong> {invoiceData.creator.name} ({invoiceData.creator.email})</p>
                  <p><strong>Assigned Admin:</strong> {invoiceData.creator.assignedAdmin?.name || 'Unassigned'}</p>
                  <p><strong>Period:</strong> {invoiceData.period.startDate || 'All time'} to {invoiceData.period.endDate || 'Present'}</p>
                </div>
                
                {/* Invoice Chart */}
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-700 mb-3">Payment Breakdown</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={invoiceData.payments}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="contentType" />
                      <YAxis />
                      <Tooltip formatter={(value: any, name: string) => [
                        name === 'totalAmount' ? `₹${value.toLocaleString()}` : value,
                        name === 'totalAmount' ? 'Total Amount' : 'Count'
                      ]} />
                      <Legend />
                      <Bar dataKey="count" fill="#8884d8" name="Count" />
                      <Bar dataKey="totalAmount" fill="#82ca9d" name="Total Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoiceData.payments.map((payment, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {payment.contentType.replace('_', ' ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {payment.count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ₹{payment.amountPerUnit.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            ₹{payment.totalAmount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900" colSpan={3}>
                          Total Amount
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          ₹{invoiceData.totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Admin-Creator Assignments</h2>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Manage Assignments</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creator</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Admin</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {creators.map(creator => (
                      <tr key={creator.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {creator.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {creator.assignedAdmin?.name || 'Unassigned'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setEditingAssignment({creatorId: creator.id, adminId: creator.assignedAdmin?.id || null})}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit Assignment
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Assignment Modal */}
            {editingAssignment && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Update Admin Assignment</h3>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assign Admin:
                      </label>
                      <select
                        value={editingAssignment.adminId || ''}
                        onChange={(e) => setEditingAssignment({
                          ...editingAssignment,
                          adminId: e.target.value || null
                        })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="">Unassigned</option>
                        {admins.map(admin => (
                          <option key={admin.id} value={admin.id}>
                            {admin.name} ({admin.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => setEditingAssignment(null)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => updateAdminAssignment(editingAssignment.creatorId, editingAssignment.adminId)}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}