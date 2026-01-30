/**
 * usePermissions - Хук для работы с правами доступа
 *
 * Поддерживает:
 * - Новую систему (role_id + permissions)
 * - Fallback на старую систему (role текстом)
 *
 * Права на пользователей:
 * - users.view.own_department - видеть пользователей своего отдела
 * - users.view.all - видеть всех пользователей
 * - users.edit.subordinates - редактировать только подчинённых (team_lead_id)
 * - users.edit.own_department - редактировать пользователей своего отдела
 * - users.edit.all - редактировать любых пользователей
 * - users.create - создавать пользователей
 * - users.delete - архивировать пользователей
 * - users.manage_roles - управлять ролями
 * - users.manage_departments - управлять отделами
 *
 * @example
 * const { hasPermission, hasAnyPermission, loading } = usePermissions(user);
 *
 * if (hasPermission('section.creatives')) {
 *   // показываем вкладку
 * }
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';

// Маппинг старых ролей на права (fallback) - ОБНОВЛЁННЫЙ
const LEGACY_ROLE_PERMISSIONS = {
  teamlead: [
    // Новые коды секций
    'section.offers_management',
    'section.reports_management',
    'section.landings_management',
    'section.landings_analytics',
    'section.creatives_analytics',
    'section.metrics_analytics',
    'section.users',
    'section.settings',
    // Старые коды (для совместимости)
    'section.offers_tl',
    'section.landing_teamlead',
    'section.landing_analytics',
    'section.analytics',
    // Гранулярные права на пользователей
    'users.view.all',
    'users.edit.all',
    'users.create',
    'users.delete',
    'users.manage_roles',
    'users.manage_departments',
    // Офферы
    'offers.view',
    'offers.create',
    'offers.edit',
    'offers.assign',
    // Лендинги
    'landings.view',
    'landings.create',
    'landings.edit',
    'landings.delete',
    // Креативы
    'creatives.view',
    'creatives.create',
    'creatives.edit',
    // Аналитика
    'analytics.view',
    'analytics.export'
  ],
  buyer: [
    // Новые коды
    'section.offers_buyer',
    'section.reports_buyer',
    'section.creatives_view',
    'section.settings',
    // Старые коды (для совместимости)
    'section.creatives',
    // Действия
    'creatives.view',
    'offers.view'
  ],
  editor: [
    // Новые коды
    'section.creatives_create',
    'section.settings',
    // Старые коды
    'section.creatives',
    // Действия
    'creatives.view',
    'creatives.create',
    'creatives.edit'
  ],
  designer: [
    'section.settings'
  ],
  search_manager: [
    // Новые коды
    'section.creatives_view',
    'section.settings',
    // Старые коды
    'section.creatives',
    // Действия
    'creatives.view'
  ],
  content_manager: [
    // Новые коды
    'section.landings_create',
    'section.settings',
    // Старые коды
    'section.landings',
    // Действия
    'landings.view'
  ],
  product_manager: [
    'section.settings'
  ],
  proofreader: [
    // Новые коды
    'section.landings_edit',
    'section.settings',
    // Старые коды
    'section.landing_editor',
    // Действия
    'landings.view',
    'landings.edit'
  ],
  gif_creator: [
    'section.settings'
  ]
};

// Все права для "полного админа" (используется для is_protected пользователей)
const ALL_ADMIN_PERMISSIONS = [
  // Новые секции
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
  // Старые секции (для совместимости)
  'section.offers_tl',
  'section.landing_teamlead',
  'section.landings',
  'section.landing_editor',
  'section.landing_analytics',
  'section.analytics',
  'section.creatives',
  // Пользователи
  'users.view.own_department',
  'users.view.all',
  'users.edit.subordinates',
  'users.edit.own_department',
  'users.edit.all',
  'users.create',
  'users.delete',
  'users.manage_roles',
  'users.manage_departments',
  // Офферы
  'offers.view',
  'offers.create',
  'offers.edit',
  'offers.assign',
  // Лендинги
  'landings.view',
  'landings.create',
  'landings.edit',
  'landings.delete',
  // Креативы
  'creatives.view',
  'creatives.create',
  'creatives.edit',
  // Аналитика
  'analytics.view',
  'analytics.export'
];

export const usePermissions = (user) => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Загрузка прав
  useEffect(() => {
    if (!user?.id) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      try {
        setLoading(true);
        setError(null);

        let userPermissions = [];

        // 1. Проверяем is_protected - это "суперадмин", все права
        if (user.is_protected) {
          // Загружаем все права из БД
          const { data: allPermissions } = await supabase
            .from('permissions')
            .select('code');

          if (allPermissions) {
            userPermissions = allPermissions.map(p => p.code);
          } else {
            // Fallback если таблица не существует
            userPermissions = ALL_ADMIN_PERMISSIONS;
          }

          setPermissions([...new Set(userPermissions)]);
          setLoading(false);
          return;
        }

        // 2. Пробуем загрузить права из новой системы (role_id)
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

        // 3. Fallback на старую систему (role текстом)
        if (userPermissions.length === 0 && user.role) {
          userPermissions = LEGACY_ROLE_PERMISSIONS[user.role] || [];
        }

        // 4. Добавляем индивидуальные права (custom_permissions)
        if (user.custom_permissions?.length > 0) {
          userPermissions = [...userPermissions, ...user.custom_permissions];
        }

        // 5. Исключаем права из excluded_permissions
        if (user.excluded_permissions?.length > 0) {
          const excludedSet = new Set(user.excluded_permissions);
          userPermissions = userPermissions.filter(p => !excludedSet.has(p));
        }

        // Убираем дубликаты
        setPermissions([...new Set(userPermissions)]);

      } catch (err) {
        console.error('Error loading permissions:', err);
        setError(err);

        // В случае ошибки — fallback на старую систему
        const fallbackPermissions = user.role
          ? LEGACY_ROLE_PERMISSIONS[user.role] || []
          : [];
        setPermissions(fallbackPermissions);

      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user?.id, user?.role_id, user?.role, user?.is_protected, user?.custom_permissions]);

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

  // Проверка доступа к секции (вкладке)
  const canAccessSection = useCallback((sectionId) => {
    // Маппинг ID секций на коды прав (новые + старые для совместимости)
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
      'offers-tl': 'section.offers_tl',
      'landing-teamlead': 'section.landing_teamlead',
      'landing-analytics': 'section.landing_analytics',
      'analytics': 'section.analytics',
      'creatives': 'section.creatives',
      'landings': 'section.landings',
      'landing-editor': 'section.landing_editor',
      'action-reports': 'section.reports_management' // Fallback для старого ID
    };

    // Алиасы: проверяем и новый и старый код права
    const permissionAliases = {
      'section.offers_management': ['section.offers_tl'],
      'section.landings_management': ['section.landing_teamlead'],
      'section.landings_create': ['section.landings'],
      'section.landings_edit': ['section.landing_editor'],
      'section.landings_analytics': ['section.landing_analytics'],
      'section.creatives_create': ['section.creatives'],
      'section.creatives_view': ['section.creatives'],
      'section.creatives_analytics': ['section.analytics'],
      'section.reports_management': ['section.offers_tl'], // TL видит отчеты если есть offers_tl
      'section.reports_buyer': ['section.offers_buyer'] // Buyer видит отчеты если есть offers_buyer
    };

    const permissionCode = sectionPermissionMap[sectionId];

    // settings доступен всем
    if (sectionId === 'settings') return true;

    if (!permissionCode) return false;

    // Проверяем основной код
    if (hasPermission(permissionCode)) return true;

    // Проверяем алиасы
    const aliases = permissionAliases[permissionCode] || [];
    return aliases.some(alias => hasPermission(alias));
  }, [hasPermission]);

  // Мемоизированный объект для оптимизации
  const permissionsSet = useMemo(() => new Set(permissions), [permissions]);

  // Проверка прав на просмотр пользователей
  const canViewUsers = useMemo(() => {
    return hasAnyPermission(['users.view.own_department', 'users.view.all']);
  }, [hasAnyPermission]);

  // Проверка прав на редактирование пользователей
  const canEditUsers = useMemo(() => {
    return hasAnyPermission(['users.edit.subordinates', 'users.edit.own_department', 'users.edit.all']);
  }, [hasAnyPermission]);

  // Проверка на "полного админа" (есть все права на пользователей)
  const isFullAdmin = useMemo(() => {
    return user?.is_protected || hasPermission('users.edit.all');
  }, [user?.is_protected, hasPermission]);

  return {
    permissions,
    permissionsSet,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getPermissionsByCategory,
    canAccessSection,

    // Удобные шорткаты для пользователей
    canViewUsers,
    canEditUsers,
    canCreateUsers: hasPermission('users.create'),
    canDeleteUsers: hasPermission('users.delete'),
    canManageRoles: hasPermission('users.manage_roles'),
    canManageDepartments: hasPermission('users.manage_departments'),

    // Полный админ
    isFullAdmin
  };
};

export default usePermissions;
