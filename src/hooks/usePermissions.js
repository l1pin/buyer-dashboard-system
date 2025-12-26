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

// Маппинг старых ролей на права (fallback)
const LEGACY_ROLE_PERMISSIONS = {
  teamlead: [
    'section.offers_tl',
    'section.landing_teamlead',
    'section.landing_analytics',
    'section.analytics',
    'section.metrics_analytics',
    'section.users',
    'section.settings',
    // Новые granular права
    'users.view.all',
    'users.edit.all',
    'users.create',
    'users.delete',
    'users.manage_roles',
    'users.manage_departments',
    'offers.view',
    'offers.create',
    'offers.edit',
    'offers.assign',
    'landings.view',
    'landings.create',
    'landings.edit',
    'landings.delete',
    'creatives.view',
    'creatives.create',
    'creatives.edit',
    'analytics.view',
    'analytics.export'
  ],
  buyer: [
    'section.creatives',
    'section.offers_buyer',
    'section.settings',
    'creatives.view',
    'offers.view'
  ],
  editor: [
    'section.creatives',
    'section.settings',
    'creatives.view',
    'creatives.create',
    'creatives.edit'
  ],
  designer: [
    'section.settings'
  ],
  search_manager: [
    'section.creatives',
    'section.settings',
    'creatives.view'
  ],
  content_manager: [
    'section.landings',
    'section.settings',
    'landings.view'
  ],
  product_manager: [
    'section.settings'
  ],
  proofreader: [
    'section.landing_editor',
    'section.settings',
    'landings.view',
    'landings.edit'
  ],
  gif_creator: [
    'section.settings'
  ]
};

// Все права для "полного админа" (используется для is_protected пользователей)
const ALL_ADMIN_PERMISSIONS = [
  // Секции
  'section.offers_tl',
  'section.offers_buyer',
  'section.landing_teamlead',
  'section.landings',
  'section.landing_editor',
  'section.landing_analytics',
  'section.analytics',
  'section.metrics_analytics',
  'section.users',
  'section.creatives',
  'section.settings',
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
    // Маппинг ID секций на коды прав
    const sectionPermissionMap = {
      'offers-tl': 'section.offers_tl',
      'offers-buyer': 'section.offers_buyer',
      'landing-teamlead': 'section.landing_teamlead',
      'landing-analytics': 'section.landing_analytics',
      'analytics': 'section.analytics',
      'metrics-analytics': 'section.metrics_analytics',
      'users': 'section.users',
      'creatives': 'section.creatives',
      'landings': 'section.landings',
      'landing-editor': 'section.landing_editor',
      'settings': 'section.settings'
    };

    const permissionCode = sectionPermissionMap[sectionId];

    // settings доступен всем
    if (sectionId === 'settings') return true;

    if (!permissionCode) return false;

    return hasPermission(permissionCode);
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
