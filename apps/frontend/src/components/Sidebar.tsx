import { useState } from 'react';
import { getNavigationForRole } from '../config/navigation';

interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
}

export function Sidebar({ user, activeView, onNavigate, onLogout }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const navigation = getNavigationForRole(user.role);

  return (
    <div className="relative w-20 flex-shrink-0 bg-white dark:bg-gray-900">
      <div
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
        className={`${
          isCollapsed ? 'w-20' : 'w-48'
        } bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 ease-in-out absolute top-0 left-0 h-full z-[60] overflow-hidden`}
      >
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 bg-white dark:bg-gray-900 scrollbar-hide">
          <div className="space-y-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center' : 'justify-start'
                } px-3 py-3 rounded-lg transition-all duration-200 group ${
                  activeView === item.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <span
                  className={`${
                    activeView === item.id
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                  }`}
                >
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="ml-3 text-sm font-medium">{item.label}</span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Logout Button at Bottom */}
        <div className="px-2 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <button
            onClick={onLogout}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center' : 'justify-start'
            } px-3 py-3 rounded-lg transition-all duration-300 ease-in-out group text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {!isCollapsed && (
              <span className="ml-3 text-sm font-medium transition-opacity duration-300">Logout</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}