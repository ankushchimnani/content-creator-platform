import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';

interface DashboardLayoutProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function DashboardLayout({
  user,
  activeView,
  onNavigate,
  onLogout,
  children,
}: DashboardLayoutProps) {
  const handleSettingsClick = () => {
    onNavigate('settings');
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-gray-50 dark:bg-gray-900" style={{ overscrollBehavior: 'none' }}>
      <TopNavbar user={user} onSettingsClick={handleSettingsClick} onLogout={onLogout} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          user={user}
          activeView={activeView}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
        <main className="flex-1 overflow-auto" style={{ overscrollBehavior: 'contain' }}>
          {children}
        </main>
      </div>
    </div>
  );
}