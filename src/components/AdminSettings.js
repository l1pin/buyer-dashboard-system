/**
 * AdminSettings - Компонент для управления отделами и ролями
 * Доступен только для admin (access_level === 'admin')
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Shield,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  AlertCircle,
  Check,
  Users,
  ChevronDown,
  ChevronUp,
  Lock
} from 'lucide-react';
import { userService } from '../supabaseClient';
import PermissionsMatrix from './PermissionsMatrix';

// ============================================
// ОТДЕЛЫ
// ============================================
const DepartmentsPanel = ({ user }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [updating, setUpdating] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [userCounts, setUserCounts] = useState({});

  const loadDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userService.getAllDepartments();
      setDepartments(data || []);

      // Загружаем количество пользователей в каждом отделе
      const counts = {};
      for (const dept of (data || [])) {
        try {
          const users = await userService.getUsersByDepartment(dept.id);
          counts[dept.id] = users?.length || 0;
        } catch (e) {
          counts[dept.id] = 0;
        }
      }
      setUserCounts(counts);
    } catch (err) {
      console.error('Error loading departments:', err);
      setError('Ошибка загрузки отделов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const handleCreate = async () => {
    if (!newDeptName.trim()) {
      setError('Введите название отдела');
      return;
    }

    try {
      setCreating(true);
      setError('');
      await userService.createDepartment({ name: newDeptName.trim() });
      setNewDeptName('');
      setShowCreateForm(false);
      setSuccess('Отдел создан');
      await loadDepartments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating department:', err);
      setError('Ошибка создания отдела: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) {
      setError('Введите название отдела');
      return;
    }

    try {
      setUpdating(true);
      setError('');
      await userService.updateDepartment(id, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
      setSuccess('Отдел обновлён');
      await loadDepartments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating department:', err);
      setError('Ошибка обновления отдела: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id) => {
    if (userCounts[id] > 0) {
      setError(`Невозможно удалить отдел: в нём ${userCounts[id]} пользователей`);
      return;
    }

    try {
      setDeletingId(id);
      setError('');
      await userService.deleteDepartment(id);
      setSuccess('Отдел удалён');
      await loadDepartments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting department:', err);
      setError('Ошибка удаления отдела: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center">
          <Check className="h-4 w-4 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      {!showCreateForm && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Добавить отдел
        </button>
      )}

      {showCreateForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-3">Новый отдел</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="Название отдела"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {creating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              Создать
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewDeptName('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {departments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>Отделы не созданы</p>
            <p className="text-sm mt-1">Создайте первый отдел</p>
          </div>
        ) : (
          departments.map((dept) => (
            <div
              key={dept.id}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow"
            >
              {editingId === dept.id ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(dept.id)}
                  />
                  <button
                    onClick={() => handleUpdate(dept.id)}
                    disabled={updating}
                    className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {updating ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditName('');
                    }}
                    className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{dept.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {userCounts[dept.id] || 0} пользователей
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingId(dept.id);
                        setEditName(dept.name);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Редактировать"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(dept.id)}
                      disabled={deletingId === dept.id || userCounts[dept.id] > 0}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={userCounts[dept.id] > 0 ? 'Нельзя удалить: есть пользователи' : 'Удалить'}
                    >
                      {deletingId === dept.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================
// РОЛИ
// ============================================
const RolesPanel = ({ user }) => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  const [expandedRoleId, setExpandedRoleId] = useState(null);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editData, setEditData] = useState({ display_name: '', description: '' });
  const [updating, setUpdating] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [userCounts, setUserCounts] = useState({});

  const [rolePermissions, setRolePermissions] = useState({});
  const [savingPermissions, setSavingPermissions] = useState(null);

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userService.getAllRoles();
      setRoles(data || []);

      // Загружаем количество пользователей для каждой роли
      const counts = {};
      for (const role of (data || [])) {
        counts[role.id] = await userService.getUserCountByRole(role.code);
      }
      setUserCounts(counts);

      // Загружаем права для каждой роли
      const perms = {};
      for (const role of (data || [])) {
        try {
          const rolePerms = await userService.getRolePermissions(role.id);
          perms[role.id] = rolePerms.map(p => p.code);
        } catch (e) {
          perms[role.id] = [];
        }
      }
      setRolePermissions(perms);
    } catch (err) {
      console.error('Error loading roles:', err);
      setError('Ошибка загрузки ролей');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Создание роли
  const handleCreate = async () => {
    if (!newRole.name.trim()) {
      setError('Введите название роли');
      return;
    }

    try {
      setCreating(true);
      setError('');
      await userService.createRole({
        name: newRole.name.trim(),
        display_name: newRole.name.trim(),
        description: newRole.description.trim() || null
      });
      setNewRole({ name: '', description: '' });
      setShowCreateForm(false);
      setSuccess('Роль создана');
      await loadRoles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating role:', err);
      setError('Ошибка создания роли: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  // Обновление роли
  const handleUpdate = async (roleId) => {
    if (!editData.display_name.trim()) {
      setError('Введите название роли');
      return;
    }

    try {
      setUpdating(true);
      setError('');
      await userService.updateRole(roleId, {
        display_name: editData.display_name.trim(),
        description: editData.description.trim() || null
      });
      setEditingRoleId(null);
      setEditData({ display_name: '', description: '' });
      setSuccess('Роль обновлена');
      await loadRoles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating role:', err);
      setError('Ошибка обновления роли: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Удаление роли
  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      setError('');
      await userService.deleteRole(id);
      setSuccess('Роль удалена');
      await loadRoles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting role:', err);
      setError('Ошибка удаления: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Сохранение прав роли
  const handleSavePermissions = async (roleId, permissions) => {
    try {
      setSavingPermissions(roleId);
      setError('');
      await userService.setRolePermissions(roleId, permissions);
      setRolePermissions(prev => ({ ...prev, [roleId]: permissions }));
      setSuccess('Права роли обновлены');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving role permissions:', err);
      setError('Ошибка сохранения прав: ' + err.message);
    } finally {
      setSavingPermissions(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center">
          <Check className="h-4 w-4 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Кнопка создания */}
      {!showCreateForm && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Добавить роль
        </button>
      )}

      {/* Форма создания */}
      {showCreateForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-3">Новая роль</h4>
          <div className="space-y-3">
            <input
              type="text"
              value={newRole.name}
              onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
              placeholder="Название роли *"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <input
              type="text"
              value={newRole.description}
              onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              placeholder="Описание (опционально)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Создать
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewRole({ name: '', description: '' });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Список ролей */}
      <div className="space-y-2">
        {roles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>Роли не найдены</p>
          </div>
        ) : (
          roles.map((role) => (
            <div
              key={role.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            >
              {/* Заголовок роли */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${role.is_system ? 'bg-amber-100' : 'bg-green-100'}`}>
                    {role.is_system ? (
                      <Lock className="h-5 w-5 text-amber-600" />
                    ) : (
                      <Shield className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <div>
                    {editingRoleId === role.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editData.display_name}
                          onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editData.description}
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          placeholder="Описание"
                          className="px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleUpdate(role.id)}
                            disabled={updating}
                            className="p-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingRoleId(null);
                              setEditData({ display_name: '', description: '' });
                            }}
                            className="p-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {role.display_name || role.name}
                          {role.is_system && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                              системная
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {role.description || `Код: ${role.code}`}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Users className="h-3 w-3" />
                          {userCounts[role.id] || 0} пользователей
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingRoleId !== role.id && (
                    <>
                      <button
                        onClick={() => {
                          setEditingRoleId(role.id);
                          setEditData({
                            display_name: role.display_name || role.name,
                            description: role.description || ''
                          });
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {!role.is_system && (
                        <button
                          onClick={() => handleDelete(role.id)}
                          disabled={deletingId === role.id || (userCounts[role.id] || 0) > 0}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={(userCounts[role.id] || 0) > 0 ? 'Нельзя удалить: есть пользователи' : 'Удалить'}
                        >
                          {deletingId === role.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => setExpandedRoleId(expandedRoleId === role.id ? null : role.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Настроить права"
                  >
                    {expandedRoleId === role.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Секция прав */}
              {expandedRoleId === role.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <h5 className="text-sm font-medium text-gray-900 mb-3">
                    Права по умолчанию для роли
                  </h5>
                  <PermissionsMatrix
                    permissions={rolePermissions[role.id] || []}
                    onChange={(newPermissions) => {
                      setRolePermissions(prev => ({ ...prev, [role.id]: newPermissions }));
                    }}
                    rolePermissions={[]}
                    disabled={false}
                    showRolePermissions={false}
                  />
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => handleSavePermissions(role.id, rolePermissions[role.id] || [])}
                      disabled={savingPermissions === role.id}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingPermissions === role.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Сохранить права
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================
const AdminSettings = ({ user }) => {
  const [activeTab, setActiveTab] = useState('departments');

  if (user?.access_level !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Доступ запрещён</h2>
          <p className="text-gray-500">Эта страница доступна только администраторам</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Настройки системы</h1>
          <p className="text-gray-500 mt-1">Управление отделами и ролями</p>
        </div>

        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'departments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Отделы
            </div>
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'roles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Роли
            </div>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {activeTab === 'departments' && <DepartmentsPanel user={user} />}
          {activeTab === 'roles' && <RolesPanel user={user} />}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
