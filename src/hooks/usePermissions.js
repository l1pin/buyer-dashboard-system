/**
 * usePermissions - Хук для работы с правами доступа
 *
 * Поддерживает:
 * - Новую систему (role_id + permissions из БД)
 * - Fallback на старую систему (role текстом)
 *
 * РАЗДЕЛЫ (section.*):
 * - section.offers_management - Офферы для Team Lead
 * - section.offers_buyer - Мои офферы для Media Buyer
 * - section.reports_management - Отчеты по байерам для Team Lead
 * - section.reports_buyer - Отчеты по действиям для Media Buyer
 * - section.landings_management - Лендинги для Team Lead (LandingTeamLead.js)
 * - section.landings_create - Лендинги для Content Manager (LandingPanel.js)
 * - section.landings_edit - Лендинги для Proofreader (LandingEditor.js)
 * - section.landings_analytics - Аналитика лендингов для Team Lead
 * - section.metrics_analytics - Метрики аналитика для Team Lead
 * - section.users - Пользователи для Team Lead
 * - section.creatives_create - Креативы для Video Designer (CreativePanel.js)
 * - section.creatives_view - Мои креативы для Media Buyer/Search Manager
 * - section.creatives_analytics - Аналитика креативов для Team Lead
 *
 * ПРАВА НА ПОЛЬЗОВАТЕЛЕЙ (users.*):
 * - users.view.own_department - видеть пользователей своего отдела
 * - users.view.all - видеть всех пользователей
 * - users.edit.subordinates - редактировать только подчинённых
 * - users.edit.own_department - редактировать пользователей своего отдела
 * - users.edit.all - редактировать любых пользователей
 * - users.create - создавать пользователей
 * - users.delete - архивировать пользователей
 * - users.manage_roles - управлять ролями
 * - users.manage_departments - управлять отделами
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';

// ============================================
// МАППИНГ РОЛЕЙ НА ПРАВА (FALLBACK)
// Используется если role_permissions в БД пустые
// ============================================
const LEGACY_ROLE_PERMISSIONS = {
  teamlead: [
    // Разделы
    'section.offers_management',
    'section.reports_management',
    'section.landings_management',
    'section.landings_analytics',
    'section.creatives_analytics',
    'section.metrics_analytics',
    'section.users',
    'section.settings',
    // Права на пользователей
    'users.view.all',
    'users.view.archived',
    'users.edit.all',
    'users.create',
    'users.delete',
    'users.manage_roles',
    'users.manage_departments',
  ],
  buyer: [
    'section.offers_buyer',
    'section.reports_buyer',
    'section.creatives_view',
    'section.settings',
  ],
  editor: [
    'section.creatives_create',
    'section.settings',
  ],
  designer: [
    'section.settings',
  ],
  search_manager: [
    'section.creatives_view',
    'section.settings',
  ],
  content_manager: [
    'section.landings_create',
    'section.settings',
  ],
  product_manager: [
    'section.settings',
  ],
  proofreader: [
    'section.landings_edit',
    'section.settings',
  ],
  gif_creator: [
    'section.settings',
  ]
};

// Все права для суперадмина (is_protected)
const ALL_ADMIN_PERMISSIONS = [
  // Все разделы
  'section.offers_management',
  'section.offers_buyer',
  'section.reports_management',
  'section.reports_buyer',
  'section.landings_management',
  'section.landings_create',
  'section.landings_edit',
  'section.landings_analytics',
  'section.creatives_create',
  'section.creatives_view',
  'section.creatives_analytics',
  'section.metrics_analytics',
  'section.users',
  'section.settings',
  // Все права на пользователей
  'users.view.own_department',
  'users.view.all',
  'users.view.archived',
  'users.edit.subordinates',
  'users.edit.own_department',
  'users.edit.all',
  'users.create',
  'users.delete',
  'users.manage_roles',
  'users.manage_departments',
];

// ============================================
// КЕШИРОВАНИЕ ПРАВ В localStorage
// ============================================
const CACHE_KEY_PREFIX = 'permissions_cache_';
const CACHE_VERSION = 'v2'; // Увеличить при изменении структуры

const getCacheKey = (userId) => `${CACHE_KEY_PREFIX}${CACHE_VERSION}_${userId}`;

const getCachedPermissions = (userId) => {
  try {
    const cached = localStorage.getItem(getCacheKey(userId));
    if (cached) {
      const { permissions, timestamp } = JSON.parse(cached);
      // Кеш валиден 24 часа (но обновляем в фоне)
      const isValid = Date.now() - timestamp < 24 * 60 * 60 * 1000;
      if (isValid && Array.isArray(permissions)) {
        return permissions;
      }
    }
  } catch (e) {
    console.warn('Failed to read permissions cache:', e);
  }
  return null;
};

const setCachedPermissions = (userId, permissions) => {
  try {
    localStorage.setItem(getCacheKey(userId), JSON.stringify({
      permissions,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to cache permissions:', e);
  }
};

// ============================================
// ХУК
// ============================================
export const usePermissions = (user) => {
  // Инициализируем сразу с закешированными правами (мгновенное отображение!)
  const [permissions, setPermissions] = useState(() => {
    if (user?.id) {
      const cached = getCachedPermissions(user.id);
      if (cached) {
        console.log('🚀 Using cached permissions for instant display');
        return cached;
      }
    }
    return [];
  });

  // loading = false если есть кеш (для мгновенного отображения)
  const [loading, setLoading] = useState(() => {
    if (user?.id) {
      return !getCachedPermissions(user.id);
    }
    return true;
  });
  const [error, setError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Сериализуем массивы для корректного сравнения в зависимостях
  const customPermissionsKey = JSON.stringify(user?.custom_permissions || []);
  const excludedPermissionsKey = JSON.stringify(user?.excluded_permissions || []);

  // Загрузка прав
  useEffect(() => {
    if (!user?.id) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      // Если есть кеш - не показываем loading, обновляем в фоне
      const cachedPerms = getCachedPermissions(user.id);
      if (!cachedPerms) {
        setLoading(true);
      }
      setError(null);

      try {
        let userPermissions = [];
        const customPerms = user.custom_permissions || [];
        const excludedPerms = user.excluded_permissions || [];

        // Только логируем при первой загрузке
        if (isInitialLoad) {
          console.log('🔐 Loading permissions for user:', user.id);
          console.log('   role_id:', user.role_id);
        }

        // 1. Проверяем is_protected - это суперадмин, все права
        if (user.is_protected) {
          const { data: allPermissions } = await supabase
            .from('permissions')
            .select('code');

          if (allPermissions?.length > 0) {
            userPermissions = allPermissions.map(p => p.code);
          } else {
            userPermissions = ALL_ADMIN_PERMISSIONS;
          }

          const finalPerms = [...new Set(userPermissions)];
          console.log('   Admin permissions:', finalPerms.length);
          setPermissions(finalPerms);
          setCachedPermissions(user.id, finalPerms);
          setLoading(false);
          setIsInitialLoad(false);
          return;
        }

        // 2. Загружаем права роли из БД
        if (user.role_id) {
          const { data: rolePermissions, error: roleError } = await supabase
            .from('role_permissions')
            .select('permissions(code)')
            .eq('role_id', user.role_id);

          if (!roleError && rolePermissions?.length > 0) {
            userPermissions = rolePermissions
              .map(rp => rp.permissions?.code)
              .filter(Boolean);
          }
        }

        // 3. Fallback на LEGACY только если role_permissions полностью пустые
        if (userPermissions.length === 0 && user.role) {
          userPermissions = LEGACY_ROLE_PERMISSIONS[user.role] || [];
        }

        // 4. ВСЕГДА добавляем custom_permissions (это ключевой момент!)
        if (customPerms.length > 0) {
          userPermissions = [...userPermissions, ...customPerms];
        }

        // 5. Исключаем excluded_permissions
        if (excludedPerms.length > 0) {
          const excludedSet = new Set(excludedPerms);
          userPermissions = userPermissions.filter(p => !excludedSet.has(p));
        }

        // Убираем дубликаты и сохраняем
        const finalPermissions = [...new Set(userPermissions)];

        // Кешируем права для мгновенной загрузки при следующем визите
        setCachedPermissions(user.id, finalPermissions);

        if (isInitialLoad) {
          console.log('   ✅ Final permissions:', finalPermissions);
        }
        setPermissions(finalPermissions);

      } catch (err) {
        console.error('Error loading permissions:', err);
        setError(err);
        // При ошибке используем кеш если есть
        const cachedPerms = getCachedPermissions(user.id);
        if (cachedPerms) {
          setPermissions(cachedPerms);
        } else {
          setPermissions([]);
        }
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    };

    loadPermissions();
  }, [user?.id, user?.role_id, user?.role, user?.is_protected, customPermissionsKey, excludedPermissionsKey, isInitialLoad]);

  // Проверка конкретного права
  const hasPermission = useCallback((permissionCode) => {
    return permissions.includes(permissionCode);
  }, [permissions]);

  // Проверка любого из прав
  const hasAnyPermission = useCallback((permissionCodes) => {
    return permissionCodes.some(code => permissions.includes(code));
  }, [permissions]);

  // Проверка всех прав
  const hasAllPermissions = useCallback((permissionCodes) => {
    return permissionCodes.every(code => permissions.includes(code));
  }, [permissions]);

  // Получить права по категории
  const getPermissionsByCategory = useCallback((category) => {
    const categoryPrefix = `${category}.`;
    return permissions.filter(p => p.startsWith(categoryPrefix));
  }, [permissions]);

  // ============================================
  // ПРОВЕРКА ДОСТУПА К СЕКЦИИ (ВКЛАДКЕ)
  // ============================================
  const canAccessSection = useCallback((sectionId) => {
    // Маппинг ID секций (из Sidebar/Dashboard) на коды прав
    const sectionPermissionMap = {
      // Новые section IDs
      'offers-management': 'section.offers_management',
      'offers-buyer': 'section.offers_buyer',
      'reports-management': 'section.reports_management',
      'reports-buyer': 'section.reports_buyer',
      'landings-management': 'section.landings_management',
      'landings-create': 'section.landings_create',
      'landings-edit': 'section.landings_edit',
      'landings-analytics': 'section.landings_analytics',
      'creatives-create': 'section.creatives_create',
      'creatives-view': 'section.creatives_view',
      'creatives-analytics': 'section.creatives_analytics',
      'metrics-analytics': 'section.metrics_analytics',
      'users': 'section.users',
      'settings': 'section.settings',

      // Старые section IDs (для обратной совместимости)
      'offers-tl': 'section.offers_management',
      'landing-teamlead': 'section.landings_management',
      'landings': 'section.landings_create',
      'landing-editor': 'section.landings_edit',
      'landing-analytics': 'section.landings_analytics',
      'creatives': 'section.creatives_view', // По умолчанию на просмотр
      'analytics': 'section.creatives_analytics',
      'action-reports': 'section.reports_buyer'
    };

    // settings доступен всем
    if (sectionId === 'settings') return true;

    const permissionCode = sectionPermissionMap[sectionId];
    if (!permissionCode) return false;

    return hasPermission(permissionCode);
  }, [hasPermission]);

  // Мемоизированный Set для оптимизации
  const permissionsSet = useMemo(() => new Set(permissions), [permissions]);

  // Проверка прав на просмотр пользователей
  const canViewUsers = useMemo(() => {
    return hasAnyPermission(['users.view.own_department', 'users.view.all']);
  }, [hasAnyPermission]);

  // Проверка прав на редактирование пользователей
  const canEditUsers = useMemo(() => {
    return hasAnyPermission(['users.edit.subordinates', 'users.edit.own_department', 'users.edit.all']);
  }, [hasAnyPermission]);

  // Проверка на "полного админа"
  const isFullAdmin = useMemo(() => {
    return user?.is_protected || hasPermission('users.edit.all');
  }, [user?.is_protected, hasPermission]);

  // Права готовы если есть хотя бы одно право или loading завершён
  // Это позволяет использовать кешированные права мгновенно
  const permissionsReady = permissions.length > 0 || !loading;

  return {
    permissions,
    permissionsSet,
    loading,
    permissionsReady, // true если права готовы (кеш или загружены)
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getPermissionsByCategory,
    canAccessSection,

    // Шорткаты для пользователей
    canViewUsers,
    canEditUsers,
    canCreateUsers: hasPermission('users.create'),
    canDeleteUsers: hasPermission('users.delete'),
    canViewArchivedUsers: hasPermission('users.view.archived'),
    canManageRoles: hasPermission('users.manage_roles'),
    canManageDepartments: hasPermission('users.manage_departments'),

    // Полный админ
    isFullAdmin
  };
};

export default usePermissions;
