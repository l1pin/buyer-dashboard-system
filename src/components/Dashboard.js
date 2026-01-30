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
import ActionReports from './ActionReports';
import SqlQueryBuilder from './SqlQueryBuilder';
import Settings from './Settings';
import usePermissions from '../hooks/usePermissions';

function Dashboard({ user, session, updateUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('settings');
  const [isUserLoaded, setIsUserLoaded] = useState(false);
  const { canAccessSection, hasPermission, loading: permissionsLoading } = usePermissions(user);

  // Маппинг URL путей к внутренним секциям (новые + старые для совместимости)
  const urlToSection = {
    // Админ
    '/admin/tables': 'table',
    '/admin/users': 'users',
    // Офферы
    '/offers/management': 'offers-management',
    '/offers/my': 'offers-buyer',
    '/analytics/offers': 'offers-management', // Старый URL -> новая секция
    '/workspace/offers': 'offers-buyer', // Старый URL
    // Отчеты
    '/reports/management': 'reports-management',
    '/reports/actions': 'reports-buyer',
    // Лендинги
    '/landings/management': 'landings-management',
    '/landings/create': 'landings-create',
    '/landings/edit': 'landings-edit',
    '/analytics/landings': 'landings-analytics',
    '/workspace/landing-teamlead': 'landings-management', // Старый URL
    '/workspace/landings': 'landings-create', // Старый URL
    '/workspace/landing-editor': 'landings-edit', // Старый URL
    // Контент
    '/creatives/create': 'creatives-create',
    '/creatives/my': 'creatives-view',
    '/analytics/creatives': 'creatives-analytics',
    '/workspace/creatives': 'creatives-view', // Старый URL -> определяем по роли
    // Аналитика
    '/analytics/metrics': 'metrics-analytics',
    // SQL
    '/db/ads_collection': 'sql-query-builder',
    // Настройки
    '/settings': 'settings'
  };

  // Маппинг внутренних секций к URL путям
  const sectionToUrl = {
    // Админ
    'table': '/admin/tables',
    'users': '/admin/users',
    // Офферы (новые)
    'offers-management': '/offers/management',
    'offers-buyer': '/offers/my',
    // Отчеты (новые)
    'reports-management': '/reports/management',
    'reports-buyer': '/reports/actions',
    // Лендинги (новые)
    'landings-management': '/landings/management',
    'landings-create': '/landings/create',
    'landings-edit': '/landings/edit',
    'landings-analytics': '/analytics/landings',
    // Контент (новые)
    'creatives-create': '/creatives/create',
    'creatives-view': '/creatives/my',
    'creatives-analytics': '/analytics/creatives',
    // Аналитика
    'metrics-analytics': '/analytics/metrics',
    // SQL
    'sql-query-builder': '/db/ads_collection',
    // Настройки
    'settings': '/settings',
    // Старые секции (для обратной совместимости)
    'offers-tl': '/offers/management',
    'landing-teamlead': '/landings/management',
    'landings': '/landings/create',
    'landing-editor': '/landings/edit',
    'landing-analytics': '/analytics/landings',
    'creatives': '/creatives/my',
    'analytics': '/analytics/creatives',
    'action-reports': '/reports/actions'
  };

  // Функция для получения дефолтного раздела по роли
  const getDefaultSectionForRole = (role) => {
    if (role === 'editor') return 'creatives-create';
    if (role === 'designer') return 'settings';
    if (role === 'search_manager') return 'creatives-view';
    if (role === 'buyer') return 'creatives-view';
    if (role === 'teamlead') return 'landings-management';
    if (role === 'content_manager') return 'landings-create';
    if (role === 'product_manager') return 'settings';
    if (role === 'proofreader') return 'landings-edit';
    if (role === 'gif_creator') return 'settings';
    return 'settings';
  };

  // Старая логика проверки доступности (для fallback)
  const legacySectionCheck = useCallback((section, role) => {
    switch (section) {
      // Админ
      case 'table':
        return role === 'teamlead';
      case 'users':
        return role === 'teamlead';

      // Офферы (новые)
      case 'offers-management':
        return role === 'teamlead';
      case 'offers-buyer':
        return role === 'buyer';

      // Отчеты (новые)
      case 'reports-management':
        return role === 'teamlead';
      case 'reports-buyer':
        return role === 'buyer';

      // Лендинги (новые)
      case 'landings-management':
        return role === 'teamlead';
      case 'landings-create':
        return role === 'content_manager';
      case 'landings-edit':
        return role === 'proofreader';
      case 'landings-analytics':
        return role === 'teamlead';

      // Контент (новые)
      case 'creatives-create':
        return role === 'editor';
      case 'creatives-view':
        return role === 'editor' || role === 'search_manager' || role === 'buyer';
      case 'creatives-analytics':
        return role === 'teamlead';

      // Аналитика
      case 'metrics-analytics':
        return role === 'teamlead';

      // SQL
      case 'sql-query-builder':
        return role === 'teamlead';

      // Настройки
      case 'settings':
        return true;

      // Старые секции (для обратной совместимости)
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
      case 'offers-tl':
        return role === 'teamlead';
      case 'action-reports':
        return role === 'teamlead' || role === 'buyer';

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
      // === АДМИН ===
      case 'table':
        return hasAccess('table') ? <AdminPanel user={user} /> : null;
      case 'users':
        return hasAccess('users') ? <UserManagement user={user} /> : null;

      // === ОФФЕРЫ ===
      case 'offers-management':
      case 'offers-tl': // Старый ID
        return hasAccess('offers-management') || hasAccess('offers-tl') ? <OffersTL user={user} /> : null;
      case 'offers-buyer':
        return hasAccess('offers-buyer') ? <OffersBuyer user={user} /> : null;

      // === ОТЧЕТЫ ===
      case 'reports-management':
        return hasAccess('reports-management') ? <ActionReports user={user} /> : null;
      case 'reports-buyer':
      case 'action-reports': // Старый ID
        return hasAccess('reports-buyer') || hasAccess('action-reports') ? <ActionReports user={user} /> : null;

      // === ЛЕНДИНГИ ===
      case 'landings-management':
      case 'landing-teamlead': // Старый ID
        return hasAccess('landings-management') || hasAccess('landing-teamlead') ? <LandingTeamLead user={user} /> : null;
      case 'landings-create':
      case 'landings': // Старый ID
        return hasAccess('landings-create') || hasAccess('landings') ? <LandingPanel user={user} /> : null;
      case 'landings-edit':
      case 'landing-editor': // Старый ID
        return hasAccess('landings-edit') || hasAccess('landing-editor') ? <LandingEditor user={user} /> : null;
      case 'landings-analytics':
      case 'landing-analytics': // Старый ID
        return hasAccess('landings-analytics') || hasAccess('landing-analytics') ? <LandingAnalytics user={user} /> : null;

      // === КОНТЕНТ ===
      case 'creatives-create':
        return hasAccess('creatives-create') ? <CreativePanel user={user} /> : null;
      case 'creatives-view':
        if (!hasAccess('creatives-view')) return null;
        // Для search_manager — специальный компонент поиска
        if (user?.role === 'search_manager') {
          return <CreativeSearch user={user} />;
        }
        // Для остальных — показываем CreativeBuyer
        return <CreativeBuyer user={user} />;
      case 'creatives-analytics':
      case 'analytics': // Старый ID
        return hasAccess('creatives-analytics') || hasAccess('analytics') ? <CreativeAnalytics user={user} /> : null;
      case 'creatives': // Старый ID - определяем компонент по правам
        if (!hasAccess('creatives') && !hasAccess('creatives-create') && !hasAccess('creatives-view')) return null;
        if (hasPermission('creatives.create') || hasPermission('creatives.edit')) {
          return <CreativePanel user={user} />;
        }
        if (user?.role === 'search_manager') {
          return <CreativeSearch user={user} />;
        }
        return <CreativeBuyer user={user} />;

      // === АНАЛИТИКА ===
      case 'metrics-analytics':
        return hasAccess('metrics-analytics') ? <MetricsAnalytics user={user} /> : null;

      // === SQL ===
      case 'sql-query-builder':
        return hasAccess('sql-query-builder') ? <SqlQueryBuilder user={user} /> : null;

      // === НАСТРОЙКИ ===
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
