import React, { useState, useEffect } from 'react';
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
  const [activeSection, setActiveSection] = useState('settings'); // Изначально настройки как fallback

  // Устанавливаем правильную секцию при загрузке пользователя
  React.useEffect(() => {
    if (user?.role) {
      if (user.role === 'editor') {
        setActiveSection('creatives');
      } else if (user.role === 'teamlead') {
        setActiveSection('analytics');
      } else if (user.role === 'buyer' || user.role === 'search_manager' || user.role === 'content_manager') {
        setActiveSection('settings');
      }
    }
  }, [user?.role]);

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
        return user?.role === 'teamlead' ? <AdminPanel user={user} /> : null;
      case 'users':
        return user?.role === 'teamlead' ? <UserManagement user={user} /> : null;
      case 'creatives':
        return user?.role === 'editor' ? <CreativePanel user={user} /> : null;
      case 'analytics':
        return user?.role === 'teamlead' ? <CreativeAnalytics user={user} /> : null;
      case 'metrics-analytics':
        return user?.role === 'teamlead' ? <MetricsAnalytics user={user} /> : null;
      case 'settings':
        return <Settings user={user} updateUser={updateUser} />;
      default:
        // Определяем дефолтную секцию по роли
        if (user?.role === 'editor') {
          return <CreativePanel user={user} />;
        } else if (user?.role === 'teamlead') {
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
