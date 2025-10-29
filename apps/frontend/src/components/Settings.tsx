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
  onBack?: () => void;
};

export function Settings({ user, token, onBack }: Props) {
  const [userDetails, setUserDetails] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await apiCall('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (res.ok) {
        setPasswordSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setShowPasswordForm(false);
          setPasswordSuccess('');
        }, 2000);
      } else {
        const data = await res.json();
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  const currentUser = userDetails || user;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-6">
            {/* Page Title */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account Information</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your account details and assigned relationships</p>
            </div>

            {/* User Information Card */}
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
              <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">Personal Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name
                  </label>
                  <div className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white">
                    {currentUser.name}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white">
                    {currentUser.email}
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Role
                  </label>
                  <div className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white capitalize">
                    {currentUser.role.replace('_', ' ').toLowerCase()}
                  </div>
                </div>

                {/* User ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    User ID
                  </label>
                  <div className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white font-mono text-sm">
                    {currentUser.id}
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment Information */}
            {currentUser.role === 'CREATOR' && currentUser.assignedAdmin && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <h3 className="text-md font-medium text-blue-900 dark:text-blue-300 mb-4">Assignment Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Assigned Admin Name */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                      Assigned Admin
                    </label>
                    <div className="px-4 py-3 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-md text-blue-900 dark:text-blue-200">
                      {currentUser.assignedAdmin.name}
                    </div>
                  </div>

                  {/* Assigned Admin Email */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                      Admin Email
                    </label>
                    <div className="px-4 py-3 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-md text-blue-900 dark:text-blue-200">
                      {currentUser.assignedAdmin.email}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Information */}
            {currentUser.role === 'ADMIN' && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                <h3 className="text-md font-medium text-green-900 dark:text-green-300 mb-4">Admin Information</h3>

                <div className="text-sm text-green-800 dark:text-green-300">
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
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <h3 className="text-md font-medium text-yellow-900 dark:text-yellow-300 mb-2">Assignment Status</h3>
                <div className="text-sm text-yellow-800 dark:text-yellow-300">
                  <p>You are not currently assigned to any admin. Please contact your system administrator to get assigned.</p>
                </div>
              </div>
            )}

            {/* Password Change Section */}
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
              <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">Security</h3>

              {!showPasswordForm ? (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-md transition-colors text-sm font-medium"
                >
                  Change Password
                </button>
              ) : (
                <div className="space-y-4">
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    {/* Current Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                        placeholder="Enter your current password"
                      />
                    </div>

                    {/* New Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                        placeholder="Enter your new password (min 6 characters)"
                      />
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                        placeholder="Confirm your new password"
                      />
                    </div>

                    {/* Error Message */}
                    {passwordError && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                        <p className="text-sm text-red-800 dark:text-red-300">{passwordError}</p>
                      </div>
                    )}

                    {/* Success Message */}
                    {passwordSuccess && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                        <p className="text-sm text-green-800 dark:text-green-300">{passwordSuccess}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-md transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isChangingPassword ? 'Changing...' : 'Change Password'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                          setPasswordError('');
                          setPasswordSuccess('');
                        }}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded-md transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {new Date().toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
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
