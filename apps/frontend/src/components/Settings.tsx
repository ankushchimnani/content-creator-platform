import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';

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
};

type Props = {
  user: User;
  token: string;
  onBack: () => void;
};

export function Settings({ user, token, onBack }: Props) {
  const [userDetails, setUserDetails] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUserDetails();
  }, []);

  const fetchUserDetails = async () => {
    try {
      // Fetch updated user details from the server
      const res = await apiCall('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setUserDetails(data.user);
      } else {
        // Fallback to the user data passed as props
        setUserDetails(user);
      }
    } catch (error) {
      console.error('Failed to fetch user details:', error);
      // Fallback to the user data passed as props
      setUserDetails(user);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const currentUser = userDetails || user;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <span className="material-icons">arrow_back</span>
          </button>
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-orange-600">
              {currentUser.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-gray-900">{currentUser.name}</div>
            <div className="text-xs text-gray-500 capitalize">{currentUser.role.toLowerCase()} Validator</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            {/* Page Title */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Account Information</h2>
              <p className="text-sm text-gray-500 mt-1">Your account details and assigned relationships</p>
            </div>

            {/* User Information Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-md font-medium text-gray-900 mb-4">Personal Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="px-4 py-3 bg-white border border-gray-300 rounded-md text-gray-900">
                    {currentUser.name}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="px-4 py-3 bg-white border border-gray-300 rounded-md text-gray-900">
                    {currentUser.email}
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <div className="px-4 py-3 bg-white border border-gray-300 rounded-md text-gray-900 capitalize">
                    {currentUser.role.toLowerCase()} Validator
                  </div>
                </div>

                {/* User ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    User ID
                  </label>
                  <div className="px-4 py-3 bg-white border border-gray-300 rounded-md text-gray-900 font-mono text-sm">
                    {currentUser.id}
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment Information */}
            {currentUser.role === 'CREATOR' && currentUser.assignedAdmin && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-md font-medium text-blue-900 mb-4">Assignment Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Assigned Admin Name */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      Assigned Admin
                    </label>
                    <div className="px-4 py-3 bg-white border border-blue-300 rounded-md text-blue-900">
                      {currentUser.assignedAdmin.name}
                    </div>
                  </div>

                  {/* Assigned Admin Email */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      Admin Email
                    </label>
                    <div className="px-4 py-3 bg-white border border-blue-300 rounded-md text-blue-900">
                      {currentUser.assignedAdmin.email}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Information */}
            {currentUser.role === 'ADMIN' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-md font-medium text-green-900 mb-4">Admin Information</h3>
                
                <div className="text-sm text-green-800">
                  <p>You are an administrator with full access to:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Create and manage content assignments</li>
                    <li>Review and approve/reject content submissions</li>
                    <li>View analytics and performance metrics</li>
                    <li>Manage assigned creators</li>
                  </ul>
                </div>
              </div>
            )}

            {/* No Assignment Message */}
            {currentUser.role === 'CREATOR' && !currentUser.assignedAdmin && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-md font-medium text-yellow-900 mb-2">Assignment Status</h3>
                <div className="text-sm text-yellow-800">
                  <p>You are not currently assigned to any admin. Please contact your system administrator to get assigned.</p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Last updated: {new Date().toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-500">
                  Account information is read-only
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
