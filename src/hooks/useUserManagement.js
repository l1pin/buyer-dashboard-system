/**
 * useUserManagement - Хук для логики управления пользователями
 *
 * Определяет:
 * - Кого текущий пользователь может видеть
 * - Кого может редактировать
 * - Может ли создавать новых
 * - Может ли менять уровень доступа
 *
 * Иерархия:
 * - admin: всё
 * - head: свой отдел
 * - teamlead: видит отдел, редактирует только своих подчинённых
 * - member: ничего (только свой профиль)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';

// Иерархия уровней доступа (для сравнения)
const ACCESS_LEVEL_HIERARCHY = {
  admin: 4,
  head: 3,
  teamlead: 2,
  member: 1
};

export const useUserManagement = (currentUser) => {
  const [visibleUsers, setVisibleUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Получить уровень в иерархии
  const getAccessLevelRank = useCallback((level) => {
    return ACCESS_LEVEL_HIERARCHY[level] || 0;
  }, []);

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

        // Если таблицы ещё не существуют — fallback
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

    const accessLevel = currentUser.access_level || 'member';

    // Fallback на старую систему
    if (!currentUser.access_level && currentUser.role === 'teamlead') {
      return true;
    }

    return ['admin', 'head', 'teamlead'].includes(accessLevel);
  }, [currentUser]);

  // Может ли создавать пользователей
  const canCreateUsers = useMemo(() => {
    if (!currentUser) return false;

    const accessLevel = currentUser.access_level || 'member';

    // Fallback на старую систему
    if (!currentUser.access_level && currentUser.role === 'teamlead') {
      return true;
    }

    return ['admin', 'head'].includes(accessLevel);
  }, [currentUser]);

  // Может ли редактировать конкретного пользователя
  const canEditUser = useCallback((targetUser) => {
    if (!currentUser || !targetUser) return false;

    // Нельзя редактировать самого себя через этот интерфейс
    // (для этого есть Settings)
    if (currentUser.id === targetUser.id) return false;

    // Нельзя редактировать защищённых пользователей (кроме admin)
    if (targetUser.is_protected && currentUser.access_level !== 'admin') {
      return false;
    }

    const accessLevel = currentUser.access_level || 'member';

    // Fallback на старую систему
    if (!currentUser.access_level && currentUser.role === 'teamlead') {
      return true; // старые teamlead могли редактировать всех
    }

    switch (accessLevel) {
      case 'admin':
        // Admin может редактировать всех
        return true;

      case 'head':
        // Head может редактировать только в своём отделе
        // Сравниваем по department_id или fallback на department (текст)
        if (currentUser.department_id && targetUser.department_id) {
          return currentUser.department_id === targetUser.department_id;
        }
        return currentUser.department === targetUser.department;

      case 'teamlead':
        // Team Lead может редактировать только своих подчинённых
        return targetUser.team_lead_id === currentUser.id;

      default:
        return false;
    }
  }, [currentUser]);

  // Может ли архивировать пользователя
  const canArchiveUser = useCallback((targetUser) => {
    if (!currentUser || !targetUser) return false;

    // Нельзя архивировать самого себя
    if (currentUser.id === targetUser.id) return false;

    // Нельзя архивировать защищённых
    if (targetUser.is_protected) return false;

    // Те же правила, что и для редактирования
    return canEditUser(targetUser);
  }, [currentUser, canEditUser]);

  // Может ли менять уровень доступа пользователя
  const canChangeAccessLevel = useCallback((targetUser, newLevel) => {
    if (!currentUser || !targetUser) return false;

    const currentRank = getAccessLevelRank(currentUser.access_level);
    const targetCurrentRank = getAccessLevelRank(targetUser.access_level);
    const newRank = getAccessLevelRank(newLevel);

    // Нельзя назначить уровень выше или равный своему
    if (newRank >= currentRank) return false;

    // Нельзя менять уровень у того, кто на том же или выше уровне
    if (targetCurrentRank >= currentRank) return false;

    // Только admin может назначать head
    if (newLevel === 'head' && currentUser.access_level !== 'admin') {
      return false;
    }

    // Head может назначать только teamlead и member в своём отделе
    if (currentUser.access_level === 'head') {
      const sameDepart = currentUser.department_id === targetUser.department_id ||
        currentUser.department === targetUser.department;

      if (!sameDepart) return false;
      if (!['teamlead', 'member'].includes(newLevel)) return false;
    }

    return true;
  }, [currentUser, getAccessLevelRank]);

  // Может ли менять отдел пользователя
  const canChangeDepartment = useCallback((targetUser) => {
    if (!currentUser || !targetUser) return false;

    const accessLevel = currentUser.access_level || 'member';

    // Только admin может перемещать между отделами
    return accessLevel === 'admin';
  }, [currentUser]);

  // Может ли назначить роль
  const canAssignRole = useCallback((targetUser, roleId) => {
    // Базовая проверка — можем ли редактировать
    return canEditUser(targetUser);
  }, [canEditUser]);

  // Может ли управлять ролями (создавать/редактировать роли)
  const canManageRoles = useMemo(() => {
    return currentUser?.access_level === 'admin';
  }, [currentUser]);

  // Может ли управлять отделами
  const canManageDepartments = useMemo(() => {
    return currentUser?.access_level === 'admin';
  }, [currentUser]);

  // Получить список пользователей, которых можно видеть
  const getVisibleUsers = useCallback(async (includeArchived = false) => {
    if (!currentUser) return [];

    try {
      const accessLevel = currentUser.access_level || 'member';

      // Fallback на старую систему
      let isLegacyTeamLead = !currentUser.access_level && currentUser.role === 'teamlead';

      let query = supabase.from('users').select('*');

      if (!includeArchived) {
        query = query.eq('archived', false);
      }

      switch (accessLevel) {
        case 'admin':
          // Видит всех
          break;

        case 'head':
          // Видит только свой отдел
          if (currentUser.department_id) {
            query = query.eq('department_id', currentUser.department_id);
          } else if (currentUser.department) {
            query = query.eq('department', currentUser.department);
          }
          break;

        case 'teamlead':
          // Видит свой отдел
          if (currentUser.department_id) {
            query = query.eq('department_id', currentUser.department_id);
          } else if (currentUser.department) {
            query = query.eq('department', currentUser.department);
          }
          break;

        default:
          if (isLegacyTeamLead) {
            // Старые teamlead видят всех
            break;
          }
          // member — никого не видит
          return [];
      }

      const { data, error } = await query.order('name');

      if (error) throw error;

      return data || [];

    } catch (err) {
      console.error('Error fetching visible users:', err);
      return [];
    }
  }, [currentUser]);

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

  // Получить доступные уровни доступа для назначения
  const getAvailableAccessLevels = useCallback((targetUser) => {
    if (!currentUser) return [];

    const allLevels = ['member', 'teamlead', 'head', 'admin'];
    const currentRank = getAccessLevelRank(currentUser.access_level);

    // Фильтруем уровни, которые можем назначить
    return allLevels.filter(level => {
      const levelRank = getAccessLevelRank(level);
      // Можно назначить только уровни ниже своего
      return levelRank < currentRank;
    });
  }, [currentUser, getAccessLevelRank]);

  return {
    // Состояние
    loading,
    error,
    departments,
    roles,

    // Проверки прав
    canViewUsersTab,
    canCreateUsers,
    canEditUser,
    canArchiveUser,
    canChangeAccessLevel,
    canChangeDepartment,
    canAssignRole,
    canManageRoles,
    canManageDepartments,

    // Действия
    getVisibleUsers,
    getSubordinates,
    checkCanArchive,
    getAvailableAccessLevels,

    // Хелперы
    getAccessLevelRank,
    accessLevelHierarchy: ACCESS_LEVEL_HIERARCHY
  };
};

export default useUserManagement;
