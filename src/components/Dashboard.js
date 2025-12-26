import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Sidebar from './Sidebar';
import WorkTable from './WorkTable';
import AdminPanel from './AdminPanel';
import UserManagement from './UserManagement';
import CreativePanel from './CreativePanel';
import CreativeBuyer from './CreativeBuyer';
import CreativeSearch from './CreativeSearch';
import CreativeAnalytics from './CreativeAnalytics';
import MetricsAnalytics from './MetricsAnalytics';
import OffersTL from './OffersTL';
import OffersBuyer from './OffersBuyer';
import LandingPanel from './LandingPanel';
import LandingEditor from './LandingEditor';
import LandingTeamLead from './LandingTeamLead';
import LandingAnalytics from './LandingAnalytics';
import Settings from './Settings';
import usePermissions from '../hooks/usePermissions';

function Dashboard({ user, session, updateUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('settings');
  const [isUserLoaded, setIsUserLoaded] = useState(false);
  const { canAccessSection, hasPermission, loading: permissionsLoading } = usePermissions(user);

  // Маппинг URL путей к внутренним секциям
  const urlToSection = {
    '/admin/tables': 'table',
    '/admin/users': 'users',
    '/workspace/creatives': 'creatives',
    '/workspace/landings': 'landings',
    '/workspace/landing-editor': 'landing-editor',
    '/workspace/landing-teamlead': 'landing-teamlead',
    '/workspace/offers': 'offers-buyer',
    '/analytics/creatives': 'analytics',
    '/analytics/metrics': 'metrics-analytics',
    '/analytics/landings': 'landing-analytics',
    '/analytics/offers': 'offers-tl',
    '/settings': 'settings'
  };

  // Маппинг внутренних секций к URL путям
  const sectionToUrl = {
    'table': '/admin/tables',
    'users': '/admin/users',
    'creatives': '/workspace/creatives',
    'landings': '/workspace/landings',
    'landing-editor': '/workspace/landing-editor',
    'landing-teamlead': '/workspace/landing-teamlead',
    'offers-buyer': '/workspace/offers',
    'analytics': '/analytics/creatives',
    'metrics-analytics': '/analytics/metrics',
    'landing-analytics': '/analytics/landings',
    'offers-tl': '/analytics/offers',
    'settings': '/settings'
  };

  // Функция для получения дефолтного раздела по роли
  const getDefaultSectionForRole = (role) => {
    if (role === 'editor') return 'landing-editor';
    if (role === 'designer') return 'settings';
    if (role === 'search_manager') return 'creatives';
    if (role === 'buyer') return 'creatives';
    if (role === 'teamlead') return 'landing-teamlead';
    if (role === 'content_manager') return 'landings';
    if (role === 'product_manager') return 'settings';
    if (role === 'proofreader') return 'landing-editor';
    if (role === 'gif_creator') return 'settings';
    return 'settings';
  };

  // Старая логика проверки доступности (для fallback)
  const legacySectionCheck = useCallback((section, role) => {
    switch (section) {
      case 'table':
        return role === 'teamlead';
      case 'users':
        return role === 'teamlead';
      case 'creatives':
        return role === 'editor' || role === 'search_manager' || role === 'buyer';
      case 'landings':
        return role === 'content_manager';
      case 'landing-editor':
        return role === 'proofreader';
      case 'landing-teamlead':
        return role === 'teamlead';
      case 'landing-analytics':
        return role === 'teamlead';
      case 'analytics':
        return role === 'teamlead';
      case 'metrics-analytics':
        return role === 'teamlead';
      case 'offers-tl':
        return role === 'teamlead';
      case 'offers-buyer':
        return role === 'buyer';
      case 'settings':
        return true; // Настройки доступны всем
      default:
        return false;
    }
  }, []);

  // Функция для проверки доступности раздела (новая система + fallback)
  const isSectionAvailableForRole = useCallback((section, role) => {
    // Если права ещё загружаются — используем старую логику
    if (permissionsLoading) {
      return legacySectionCheck(section, role);
    }

    // Пробуем новую систему
    const newSystemResult = canAccessSection(section);

    // Если новая система вернула true — используем её
    // Иначе — проверяем старую логику (для обратной совместимости)
    return newSystemResult || legacySectionCheck(section, role);
  }, [canAccessSection, permissionsLoading, legacySectionCheck]);

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
    // Проверка доступа через новую систему с fallback
    const hasAccess = (section) => isSectionAvailableForRole(section, user?.role);

    switch (activeSection) {
      case 'table':
        return hasAccess('table') ? <AdminPanel user={user} /> : null;
      case 'users':
        return hasAccess('users') ? <UserManagement user={user} /> : null;
      case 'creatives':
        if (!hasAccess('creatives')) return null;
        // Определяем компонент по правам, а не по роли
        // Если есть право создавать/редактировать — показываем полную панель
        if (hasPermission('creatives.create') || hasPermission('creatives.edit')) {
          return <CreativePanel user={user} />;
        }
        // Для search_manager — специальный компонент поиска
        if (user?.role === 'search_manager') {
          return <CreativeSearch user={user} />;
        }
        // Для остальных (только просмотр) — показываем CreativeBuyer
        return <CreativeBuyer user={user} />;
      case 'landings':
        return hasAccess('landings') ? <LandingPanel user={user} /> : null;
      case 'landing-editor':
        return hasAccess('landing-editor') ? <LandingEditor user={user} /> : null;
      case 'landing-teamlead':
        return hasAccess('landing-teamlead') ? <LandingTeamLead user={user} /> : null;
      case 'landing-analytics':
        return hasAccess('landing-analytics') ? <LandingAnalytics user={user} /> : null;
      case 'analytics':
        return hasAccess('analytics') ? <CreativeAnalytics user={user} /> : null;
      case 'metrics-analytics':
        return hasAccess('metrics-analytics') ? <MetricsAnalytics user={user} /> : null;
      case 'offers-tl':
        return hasAccess('offers-tl') ? <OffersTL user={user} /> : null;
      case 'offers-buyer':
        return hasAccess('offers-buyer') ? <OffersBuyer user={user} /> : null;
      case 'settings':
        return <Settings user={user} updateUser={updateUser} />;
      default:
        // Определяем дефолтную секцию по правам
        if (hasPermission('creatives.create') || hasPermission('creatives.edit')) {
          return <CreativePanel user={user} />;
        } else if (user?.role === 'search_manager') {
          return <CreativeSearch user={user} />;
        } else if (hasPermission('creatives.view')) {
          return <CreativeBuyer user={user} />;
        } else if (hasPermission('landings.edit') || hasPermission('landings.create')) {
          return <LandingPanel user={user} />;
        } else if (user?.role === 'proofreader') {
          return <LandingEditor user={user} />;
        } else if (user?.role === 'teamlead' || user?.is_protected) {
          return <LandingTeamLead user={user} />;
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
