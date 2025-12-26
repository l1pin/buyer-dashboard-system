/**
 * useUserManagement - Хук для логики управления пользователями
 *
 * Использует granular permissions вместо access_level:
 * - users.view.own_department - видеть пользователей своего отдела
 * - users.view.all - видеть всех пользователей
 * - users.edit.subordinates - редактировать только подчинённых (team_lead_id)
 * - users.edit.own_department - редактировать пользователей своего отдела
 * - users.edit.all - редактировать любых пользователей
 * - users.create - создавать пользователей
 * - users.delete - архивировать пользователей
 *
 * Приоритет прав редактирования:
 * 1. users.edit.all - может редактировать всех
 * 2. users.edit.own_department - может редактировать в своём отделе
 * 3. users.edit.subordinates - может редактировать только своих подчинённых
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { usePermissions } from './usePermissions';

export const useUserManagement = (currentUser) => {
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Получаем права текущего пользователя
  const {
    hasPermission,
    hasAnyPermission,
    isFullAdmin,
    canViewUsers,
    canEditUsers,
    canCreateUsers,
    canDeleteUsers,
    canManageRoles,
    canManageDepartments,
    loading: permissionsLoading
  } = usePermissions(currentUser);

  // Загрузка данных
  useEffect(() => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Параллельно загружаем отделы и роли
        const [depsResult, rolesResult] = await Promise.all([
          supabase.from('departments').select('*').order('name'),
          supabase.from('roles').select('*').order('sort_order')
        ]);

        if (!depsResult.error) {
          setDepartments(depsResult.data || []);
        }

        if (!rolesResult.error) {
          setRoles(rolesResult.data || []);
        }

      } catch (err) {
        console.error('Error loading management data:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser?.id]);

  // Может ли видеть вкладку "Пользователи"
  const canViewUsersTab = useMemo(() => {
    if (!currentUser) return false;

    // Если есть любое право на просмотр пользователей
    return canViewUsers || hasPermission('section.users');
  }, [currentUser, canViewUsers, hasPermission]);

  // Может ли редактировать конкретного пользователя
  const canEditUser = useCallback((targetUser) => {
    if (!currentUser || !targetUser) return false;

    // Нельзя редактировать самого себя через этот интерфейс
    if (currentUser.id === targetUser.id) return false;

    // Нельзя редактировать защищённых пользователей (кроме других protected)
    if (targetUser.is_protected && !currentUser.is_protected) {
      return false;
    }

    // 1. Полный доступ - может редактировать всех
    if (hasPermission('users.edit.all')) {
      return true;
    }

    // 2. Доступ к своему отделу
    if (hasPermission('users.edit.own_department')) {
      const sameDepart = currentUser.department_id && targetUser.department_id
        ? currentUser.department_id === targetUser.department_id
        : currentUser.department === targetUser.department;

      if (sameDepart) return true;
    }

    // 3. Доступ только к подчинённым
    if (hasPermission('users.edit.subordinates')) {
      return targetUser.team_lead_id === currentUser.id;
    }

    return false;
  }, [currentUser, hasPermission]);

  // Может ли архивировать пользователя
  const canArchiveUser = useCallback((targetUser) => {
    if (!currentUser || !targetUser) return false;

    // Нельзя архивировать самого себя
    if (currentUser.id === targetUser.id) return false;

    // Нельзя архивировать защищённых
    if (targetUser.is_protected) return false;

    // Должно быть право на удаление
    if (!hasPermission('users.delete')) return false;

    // Те же правила, что и для редактирования
    return canEditUser(targetUser);
  }, [currentUser, hasPermission, canEditUser]);

  // Может ли менять отдел пользователя
  const canChangeDepartment = useCallback((targetUser) => {
    if (!currentUser || !targetUser) return false;

    // Только пользователи с полным доступом могут перемещать между отделами
    return hasPermission('users.edit.all');
  }, [currentUser, hasPermission]);

  // Может ли назначить роль
  const canAssignRole = useCallback((targetUser) => {
    // Базовая проверка — можем ли редактировать
    return canEditUser(targetUser);
  }, [canEditUser]);

  // Получить список пользователей, которых можно видеть
  const getVisibleUsers = useCallback(async (includeArchived = false) => {
    if (!currentUser) return [];

    try {
      let query = supabase.from('users').select('*');

      if (!includeArchived) {
        query = query.eq('archived', false);
      }

      // 1. Полный доступ - видит всех
      if (hasPermission('users.view.all')) {
        // Никаких фильтров
      }
      // 2. Доступ к своему отделу
      else if (hasPermission('users.view.own_department')) {
        if (currentUser.department_id) {
          query = query.eq('department_id', currentUser.department_id);
        } else if (currentUser.department) {
          query = query.eq('department', currentUser.department);
        }
      }
      // 3. Нет прав на просмотр - возвращаем пустой массив
      else {
        return [];
      }

      const { data, error } = await query.order('name');

      if (error) throw error;

      return data || [];

    } catch (err) {
      console.error('Error fetching visible users:', err);
      return [];
    }
  }, [currentUser, hasPermission]);

  // Получить подчинённых текущего пользователя
  const getSubordinates = useCallback(async () => {
    if (!currentUser?.id) return [];

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('team_lead_id', currentUser.id)
        .eq('archived', false)
        .order('name');

      if (error) throw error;
      return data || [];

    } catch (err) {
      console.error('Error fetching subordinates:', err);
      return [];
    }
  }, [currentUser?.id]);

  // Проверить, можно ли архивировать (есть ли подчинённые)
  const checkCanArchive = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('team_lead_id', userId)
        .eq('archived', false);

      if (error) throw error;

      return {
        canArchive: !data || data.length === 0,
        subordinates: data || [],
        message: data?.length > 0
          ? `Нельзя архивировать: есть ${data.length} подчинённых`
          : null
      };

    } catch (err) {
      console.error('Error checking archive:', err);
      return { canArchive: false, subordinates: [], message: 'Ошибка проверки' };
    }
  }, []);

  // Получить пользователей которых можно редактировать
  const getEditableUsers = useCallback(async (includeArchived = false) => {
    const visibleUsers = await getVisibleUsers(includeArchived);

    // Фильтруем только тех, кого можно редактировать
    return visibleUsers.filter(user => canEditUser(user));
  }, [getVisibleUsers, canEditUser]);

  return {
    // Состояние
    loading,
    permissionsLoading,
    error,
    departments,
    roles,

    // Проверки прав (из usePermissions)
    canViewUsersTab,
    canCreateUsers,
    canEditUser,
    canArchiveUser,
    canChangeDepartment,
    canAssignRole,
    canManageRoles,
    canManageDepartments,
    isFullAdmin,

    // Действия
    getVisibleUsers,
    getEditableUsers,
    getSubordinates,
    checkCanArchive,

    // Хелперы из usePermissions
    hasPermission,
    hasAnyPermission
  };
};

export default useUserManagement;
