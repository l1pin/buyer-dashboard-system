/**
 * usePermissions - Хук для работы с правами доступа
 *
 * Поддерживает:
 * - Новую систему (role_id + permissions)
 * - Fallback на старую систему (role текстом)
 *
 * @example
 * const { hasPermission, hasAnyPermission, loading } = usePermissions(user);
 *
 * if (hasPermission('section.creatives')) {
 *   // показываем вкладку
 * }
 *
 * if (hasAnyPermission(['section.analytics', 'section.metrics_analytics'])) {
 *   // показываем хотя бы одну из вкладок
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
    'users.view',
    'users.create',
    'users.edit',
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

// Права по уровню доступа
const ACCESS_LEVEL_PERMISSIONS = {
  admin: ['users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage_roles', 'users.manage_departments'],
  head: ['users.view', 'users.create', 'users.edit', 'users.delete'],
  teamlead: ['users.view'],
  member: []
};

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

        // 1. Проверяем access_level = 'admin' — все права
        if (user.access_level === 'admin') {
          const { data: allPermissions } = await supabase
            .from('permissions')
            .select('code');

          if (allPermissions) {
            userPermissions = allPermissions.map(p => p.code);
          } else {
            // Fallback: если таблица permissions ещё не существует
            userPermissions = Object.values(LEGACY_ROLE_PERMISSIONS).flat();
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

        // 4. Добавляем права по access_level
        if (user.access_level && ACCESS_LEVEL_PERMISSIONS[user.access_level]) {
          userPermissions = [
            ...userPermissions,
            ...ACCESS_LEVEL_PERMISSIONS[user.access_level]
          ];
        }

        // 5. Добавляем индивидуальные права
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
  }, [user?.id, user?.role_id, user?.role, user?.access_level, user?.custom_permissions]);

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

    // Удобные шорткаты
    canManageUsers: hasPermission('users.edit') || hasPermission('users.create'),
    canViewUsers: hasPermission('users.view'),
    canManageRoles: hasPermission('users.manage_roles'),
    canManageDepartments: hasPermission('users.manage_departments'),
    isAdmin: user?.access_level === 'admin'
  };
};

export default usePermissions;
