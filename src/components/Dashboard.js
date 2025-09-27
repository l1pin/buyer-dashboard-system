import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import Sidebar from './Sidebar';
import WorkTable from './WorkTable';
import AdminPanel from './AdminPanel';
import UserManagement from './UserManagement';
import CreativePanel from './CreativePanel';
import CreativeAnalytics from './CreativeAnalytics';
import MetricsAnalytics from './MetricsAnalytics';
import Settings from './Settings';

function Dashboard({ user, session, updateUser }) {
  const [activeSection, setActiveSection] = useState(() => {
    // Устанавливаем начальную секцию в зависимости от роли пользователя
    if (user?.role === 'editor') {
      return 'creatives';
    } else if (user?.role === 'teamlead') {
      return 'table';
    } else if (user?.role === 'search_manager') {
      return 'analytics';
    } else if (user?.role === 'content_manager') {
      return 'creatives';
    } else {
      return 'table';
    }
  });

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('rememberMe');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'table':
        if (user?.role === 'teamlead') {
          return <AdminPanel user={user} />;
        } else if (user?.role === 'buyer') {
          return <WorkTable user={user} />;
        } else {
          return null; // Video Designers, Search Managers, Content Managers не имеют доступа к таблицам
        }
      case 'users':
        return user?.role === 'teamlead' ? <UserManagement user={user} /> : null;
      case 'creatives':
        return (user?.role === 'editor' || user?.role === 'content_manager') ? <CreativePanel user={user} /> : null;
      case 'analytics':
        return (user?.role === 'teamlead' || user?.role === 'search_manager') ? <CreativeAnalytics user={user} /> : null;
      case 'metrics-analytics':
        return (user?.role === 'teamlead' || user?.role === 'search_manager') ? <MetricsAnalytics user={user} /> : null;
      case 'settings':
        return <Settings user={user} updateUser={updateUser} />;
      default:
        // Определяем дефолтную секцию по роли
        if (user?.role === 'editor' || user?.role === 'content_manager') {
          return <CreativePanel user={user} />;
        } else if (user?.role === 'teamlead') {
          return <AdminPanel user={user} />;
        } else if (user?.role === 'buyer') {
          return <WorkTable user={user} />;
        } else if (user?.role === 'search_manager') {
          return <CreativeAnalytics user={user} />;
        } else {
          return <Settings user={user} updateUser={updateUser} />;
        }
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-hidden">
        <div className="h-full">
          {renderActiveSection()}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
