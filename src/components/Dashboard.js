import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('settings');
  const [isUserLoaded, setIsUserLoaded] = useState(false);

  // Маппинг URL путей к внутренним секциям
  const urlToSection = {
    '/admin/tables': 'table',
    '/admin/users': 'users', 
    '/workspace/creatives': 'creatives',
    '/analytics/creatives': 'analytics',
    '/analytics/metrics': 'metrics-analytics',
    '/settings': 'settings'
  };

  // Маппинг внутренних секций к URL путям
  const sectionToUrl = {
    'table': '/admin/tables',
    'users': '/admin/users',
    'creatives': '/workspace/creatives', 
    'analytics': '/analytics/creatives',
    'metrics-analytics': '/analytics/metrics',
    'settings': '/settings'
  };

  // Функция для получения дефолтного раздела по роли
  const getDefaultSectionForRole = (role) => {
    if (role === 'editor') return 'creatives';
    if (role === 'teamlead') return 'analytics';
    if (role === 'buyer' || role === 'search_manager' || role === 'content_manager') return 'settings';
    return 'settings';
  };

  // Функция для проверки доступности раздела для роли
  const isSectionAvailableForRole = (section, role) => {
    switch (section) {
      case 'table':
        return role === 'teamlead';
      case 'users':
        return role === 'teamlead';
      case 'creatives':
        return role === 'editor';
      case 'analytics':
        return role === 'teamlead';
      case 'metrics-analytics':
        return role === 'teamlead';
      case 'settings':
        return true; // Настройки доступны всем
      default:
        return false;
    }
  };

  // Определяем секцию из URL при загрузке
  React.useEffect(() => {
    if (user?.role && user?.id) {
      const currentPath = location.pathname;
      const sectionFromUrl = urlToSection[currentPath];
      
      // Если секция из URL доступна для роли пользователя - используем её
      if (sectionFromUrl && isSectionAvailableForRole(sectionFromUrl, user.role)) {
        setActiveSection(sectionFromUrl);
        localStorage.setItem(`activeSection_${user.id}`, sectionFromUrl);
      } else if (sectionFromUrl && !isSectionAvailableForRole(sectionFromUrl, user.role)) {
        // Если секция из URL недоступна - перенаправляем на дефолтную
        const defaultSection = getDefaultSectionForRole(user.role);
        setActiveSection(defaultSection);
        navigate(sectionToUrl[defaultSection], { replace: true });
        localStorage.setItem(`activeSection_${user.id}`, defaultSection);
      } else {
        // Если URL не соответствует ни одной секции - проверяем localStorage или используем дефолтную
        const savedSection = localStorage.getItem(`activeSection_${user.id}`);
        
        if (savedSection && isSectionAvailableForRole(savedSection, user.role)) {
          setActiveSection(savedSection);
          navigate(sectionToUrl[savedSection], { replace: true });
        } else {
          const defaultSection = getDefaultSectionForRole(user.role);
          setActiveSection(defaultSection);
          navigate(sectionToUrl[defaultSection], { replace: true });
          localStorage.setItem(`activeSection_${user.id}`, defaultSection);
        }
      }
      
      setIsUserLoaded(true);
    }
  }, [user?.role, user?.id, location.pathname, navigate]);

  // Сохраняем activeSection в localStorage и обновляем URL при изменении секции
  React.useEffect(() => {
    if (user?.id && activeSection && isUserLoaded) {
      localStorage.setItem(`activeSection_${user.id}`, activeSection);
      const targetUrl = sectionToUrl[activeSection];
      if (targetUrl && location.pathname !== targetUrl) {
        navigate(targetUrl, { replace: true });
      }
    }
  }, [activeSection, user?.id, isUserLoaded, navigate, location.pathname]);

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
