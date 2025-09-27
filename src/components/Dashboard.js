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
  const [activeSection, setActiveSection] = useState('settings');
  const [isUserLoaded, setIsUserLoaded] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Функция для получения дефолтного раздела по роли
  const getDefaultSectionForRole = (role) => {
    if (role === 'editor') return 'creatives';
    if (role === 'teamlead') return 'analytics';
    if (role === 'buyer' || role === 'search_manager' || role === 'content_manager') return 'settings';
    return 'settings';
  };

  // Устанавливаем правильную секцию при загрузке пользователя
  React.useEffect(() => {
    if (user?.role) {
      // Проверяем, есть ли сохраненный раздел в localStorage
      const savedSection = localStorage.getItem(`activeSection_${user.id}`);
      
      if (savedSection && !isInitialLoad) {
        // Если есть сохраненный раздел и это не первая загрузка - используем его
        setActiveSection(savedSection);
      } else {
        // Если нет сохраненного раздела или это первая загрузка - используем дефолтный для роли
        const defaultSection = getDefaultSectionForRole(user.role);
        setActiveSection(defaultSection);
        localStorage.setItem(`activeSection_${user.id}`, defaultSection);
      }
      
      setIsUserLoaded(true);
      setIsInitialLoad(false);
    }
  }, [user?.role, user?.id]);

  // Функция для смены раздела с сохранением в localStorage
  const handleSectionChange = (newSection) => {
    setActiveSection(newSection);
    if (user?.id) {
      localStorage.setItem(`activeSection_${user.id}`, newSection);
    }
  };

  // Показываем лоадер пока пользователь не загрузился
  if (!isUserLoaded || !user?.role) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      // Очищаем сохраненный раздел при выходе
      if (user?.id) {
        localStorage.removeItem(`activeSection_${user.id}`);
      }
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
        onSectionChange={handleSectionChange}
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
