import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { userService } from '../supabaseClient';
import {
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Shield,
  User,
  X,
  Check,
  Eye,
  EyeOff,
  Video,
  Palette,
  Info,
  Edit,
  Edit3,
  Save,
  Search,
  Code2,
  Package,
  Pencil,
  Image,
  Calendar,
  DollarSign,
  Euro,
  Minus,
  Archive,
  RotateCcw,
  Crown,
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Lock,
  Users
} from 'lucide-react';
import { FacebookIcon, GoogleIcon, TiktokIcon } from './SourceIcons';
import PermissionsMatrix from './PermissionsMatrix';
import { useUserManagement } from '../hooks/useUserManagement';

// Кастомный селектор источника трафика с иконками
const SourceSelector = ({ value, onChange, className }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const sources = [
    { value: 'Facebook', label: 'Facebook', icon: FacebookIcon },
    { value: 'Google', label: 'Google', icon: GoogleIcon },
    { value: 'TikTok', label: 'TikTok', icon: TiktokIcon }
  ];

  const selectedSource = sources.find(s => s.value === value) || sources[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={className}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <selectedSource.icon className="w-5 h-5" />
            <span>{selectedSource.label}</span>
          </div>
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <>
          {/* Backdrop для закрытия при клике вне */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Меню опций */}
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {sources.map((source) => (
              <button
                key={source.value}
                type="button"
                onClick={() => {
                  onChange(source.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 ${
                  value === source.value ? 'bg-blue-50' : ''
                }`}
              >
                <source.icon className="w-5 h-5" />
                <span>{source.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Маппинг иконок для ролей
const ROLE_ICONS = {
  'buyer': { icon: 'ad', color: 'text-blue-600' },
  'editor': { icon: Video, color: 'text-purple-600' },
  'designer': { icon: Palette, color: 'text-pink-600' },
  'search_manager': { icon: Search, color: 'text-orange-600' },
  'content_manager': { icon: Code2, color: 'text-indigo-600' },
  'product_manager': { icon: Package, color: 'text-amber-600' },
  'proofreader': { icon: Pencil, color: 'text-teal-600' },
  'gif_creator': { icon: Image, color: 'text-cyan-600' },
  'teamlead': { icon: Shield, color: 'text-green-600' },
  'default': { icon: User, color: 'text-gray-600' }
};

// Кастомный селектор роли пользователя (динамический из БД)
const RoleSelector = ({ value, onChange, roles, className }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  // Преобразуем роли из БД в формат для отображения
  const displayRoles = (roles || []).map(r => ({
    value: r.code,
    label: r.name || r.code,
    ...(ROLE_ICONS[r.code] || ROLE_ICONS.default)
  }));

  const selectedRole = displayRoles.find(r => r.value === value) || displayRoles[0] || { value: '', label: 'Не выбрано', ...ROLE_ICONS.default };

  const RoleIconComponent = ({ role, className: iconClassName }) => {
    if (role.icon === 'ad') {
      return <AdIcon className={iconClassName} />;
    }
    const IconComponent = role.icon;
    return <IconComponent className={iconClassName} />;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={className}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RoleIconComponent role={selectedRole} className={`w-5 h-5 ${selectedRole.color}`} />
            <span>{selectedRole.label}</span>
          </div>
          <svg className="w-5 h-5 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-auto">
            {displayRoles.length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-gray-500">Нет ролей</div>
            ) : (
              displayRoles.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => {
                    onChange(role.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                    value === role.value ? 'bg-blue-50' : ''
                  }`}
                >
                  <RoleIconComponent role={role} className={`w-5 h-5 ${role.color}`} />
                  <span className="text-sm">{role.label}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Кастомный селектор Team Lead с аватарами
const TeamLeadSelector = ({ value, onChange, teamLeads, className }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedTeamLead = teamLeads.find(tl => tl.id === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={className}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {selectedTeamLead ? (
              <>
                <div className="w-6 h-6 rounded-full overflow-hidden bg-green-100 flex items-center justify-center">
                  {selectedTeamLead.avatar_url ? (
                    <img
                      src={selectedTeamLead.avatar_url}
                      alt={selectedTeamLead.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full flex items-center justify-center ${selectedTeamLead.avatar_url ? 'hidden' : ''}`}>
                    <Shield className="w-3.5 h-3.5 text-green-600" />
                  </div>
                </div>
                <span>{selectedTeamLead.name}</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <span className="text-gray-500">Не выбран</span>
              </>
            )}
          </div>
          <svg className="w-5 h-5 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
            {/* Опция "Не выбран" */}
            <button
              type="button"
              onClick={() => {
                onChange(null, null);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                !value ? 'bg-blue-50' : ''
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-sm text-gray-500">Не выбран</span>
            </button>

            {/* Список Team Leads */}
            {teamLeads.map((tl) => (
              <button
                key={tl.id}
                type="button"
                onClick={() => {
                  onChange(tl.id, tl.name);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                  value === tl.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-full overflow-hidden bg-green-100 flex items-center justify-center">
                  {tl.avatar_url ? (
                    <img
                      src={tl.avatar_url}
                      alt={tl.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full flex items-center justify-center ${tl.avatar_url ? 'hidden' : ''}`}>
                    <Shield className="w-4 h-4 text-green-600" />
                  </div>
                </div>
                <span className="text-sm">{tl.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Кастомный селектор отдела
const DepartmentSelector = ({ value, onChange, departments, disabled, className }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedDepartment = departments.find(d => d.id === value);

  if (disabled) {
    return (
      <div className={className}>
        <div className="flex items-center space-x-2 opacity-60">
          <Building2 className="w-5 h-5 text-gray-500" />
          <span>{selectedDepartment?.name || 'Не выбран'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={className}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-gray-500" />
            <span>{selectedDepartment?.name || 'Выберите отдел'}</span>
          </div>
          <ChevronDown className="w-5 h-5 ml-2 text-gray-400" />
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
            {/* Опция "Не выбран" */}
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                !value ? 'bg-blue-50' : ''
              }`}
            >
              <Building2 className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Не выбран</span>
            </button>

            {departments.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() => {
                  onChange(dept.id);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                  value === dept.id ? 'bg-blue-50' : ''
                }`}
              >
                <Building2 className="w-5 h-5 text-blue-500" />
                <span className="text-sm">{dept.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Кастомный селектор валюты
const CurrencySelector = ({ value, onChange, className }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const currencies = [
    { value: 'USD', label: 'USD', symbol: '$', color: 'text-green-600' },
    { value: 'EUR', label: 'EUR', symbol: '€', color: 'text-blue-600' },
    { value: 'UAH', label: 'UAH', symbol: '₴', color: 'text-yellow-600' }
  ];

  const selectedCurrency = currencies.find(c => c.value === value) || currencies[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={className}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className={`text-lg font-medium ${selectedCurrency.color}`}>{selectedCurrency.symbol}</span>
            <span>{selectedCurrency.label}</span>
          </div>
          <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {currencies.map((currency) => (
              <button
                key={currency.value}
                type="button"
                onClick={() => {
                  onChange(currency.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center space-x-2 ${
                  value === currency.value ? 'bg-blue-50' : ''
                }`}
              >
                <span className={`text-lg font-medium ${currency.color}`}>{currency.symbol}</span>
                <span className="text-sm">{currency.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Кастомная иконка Ad для Media Buyer
const AdIcon = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z"/>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 15v-4a2 2 0 0 1 4 0v4" />
    <line x1="7" y1="13" x2="11" y2="13" />
    <path d="M17 9v6h-1.5a1.5 1.5 0 1 1 1.5 -1.5" />
  </svg>
);

// ============================================
// ПАНЕЛЬ ОТДЕЛОВ
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

      // Загружаем количество пользователей параллельно
      const countsResults = await Promise.all(
        (data || []).map(async (dept) => {
          try {
            const users = await userService.getUsersByDepartment(dept.id);
            return { id: dept.id, count: users?.length || 0 };
          } catch (e) {
            return { id: dept.id, count: 0 };
          }
        })
      );

      const counts = {};
      countsResults.forEach(r => { counts[r.id] = r.count; });
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-4">
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
            <div className="text-center py-12 text-gray-500">
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
    </div>
  );
};


// ============================================
// ПАНЕЛЬ РОЛЕЙ
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
  const [editData, setEditData] = useState({ name: '', description: '' });
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

      // Загружаем всё параллельно
      const [countsResults, permsResults] = await Promise.all([
        // Загрузка количества пользователей
        Promise.all((data || []).map(async (role) => {
          const count = await userService.getUserCountByRole(role.code);
          return { id: role.id, count };
        })),
        // Загрузка прав
        Promise.all((data || []).map(async (role) => {
          try {
            const rolePerms = await userService.getRolePermissions(role.id);
            return { id: role.id, perms: rolePerms.map(p => p.code) };
          } catch (e) {
            return { id: role.id, perms: [] };
          }
        }))
      ]);

      // Преобразуем в объекты
      const counts = {};
      countsResults.forEach(r => { counts[r.id] = r.count; });
      setUserCounts(counts);

      const perms = {};
      permsResults.forEach(r => { perms[r.id] = r.perms; });
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

  const handleUpdate = async (roleId) => {
    if (!editData.name.trim()) {
      setError('Введите название роли');
      return;
    }

    try {
      setUpdating(true);
      setError('');
      await userService.updateRole(roleId, {
        name: editData.name.trim(),
        description: editData.description.trim() || null
      });
      setEditingRoleId(null);
      setEditData({ name: '', description: '' });
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-4">
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
            Добавить роль
          </button>
        )}

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

        <div className="space-y-2">
          {roles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Роли не найдены</p>
            </div>
          ) : (
            roles.map((role) => (
                <div
                  key={role.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${role.is_system ? 'bg-amber-100' : 'bg-blue-100'}`}>
                        {role.is_system ? (
                          <Lock className="h-5 w-5 text-amber-600" />
                        ) : (
                          <Shield className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        {editingRoleId === role.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editData.name}
                              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
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
                                className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingRoleId(null);
                                  setEditData({ name: '', description: '' });
                                }}
                                className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium text-gray-900 flex items-center gap-2">
                              {role.name}
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
                                name: role.name,
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
    </div>
  );
};

function UserManagement({ user }) {
  const [users, setUsers] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]); // Список Team Leads для дропдауна
  const [roles, setRoles] = useState([]); // Список ролей из БД
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showArchived, setShowArchived] = useState(false); // Показывать архивированных
  const [restoring, setRestoring] = useState(null); // ID восстанавливаемого пользователя
  const [fieldErrors, setFieldErrors] = useState({}); // Ошибки полей для подсветки
  const [searchQuery, setSearchQuery] = useState(''); // Поиск пользователей
  const [debouncedSearch, setDebouncedSearch] = useState(''); // Дебаунсированный поиск
  const searchTimeoutRef = useRef(null); // Ref для таймаута дебаунса
  const isFirstLoadRef = useRef(true); // Ref для отслеживания первой загрузки
  const [rolePermissions, setRolePermissions] = useState([]); // Права от роли
  const [activeTab, setActiveTab] = useState('users'); // Активная вкладка: users, roles, departments

  // Хук для управления пользователями
  const {
    departments,
    canEditUser,
    canChangeDepartment,
    isFullAdmin,
    canManageRoles,
    canManageDepartments
  } = useUserManagement(user);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'buyer',
    department: '', // Отдел (обязательно для Team Lead) - legacy
    department_id: null, // ID отдела
    custom_permissions: [], // Дополнительные права
    team_lead_id: null,
    team_lead_name: null,
    buyer_settings: {
      traffic_channels: [] // Пустой по умолчанию - каналы добавляются по кнопке
    }
  });
  const [newUserRolePermissions, setNewUserRolePermissions] = useState([]); // Права роли для нового пользователя

  const [editUserData, setEditUserData] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    role: 'buyer',
    department: '', // Отдел (обязательно для Team Lead) - legacy
    department_id: null, // ID отдела
    custom_permissions: [], // Дополнительные права
    is_protected: false,
    team_lead_id: null,
    team_lead_name: null,
    buyer_settings: {
      traffic_channels: [] // Пустой по умолчанию
    }
  });

  useEffect(() => {
    // Показываем loading только при первой загрузке, не при переключении вкладок
    const showLoading = isFirstLoadRef.current;
    loadUsers(showLoading);
    loadTeamLeads(); // Загружаем Team Leads при инициализации
    loadRoles(); // Загружаем роли из БД
    isFirstLoadRef.current = false;
  }, [showArchived]); // Перезагружаем при переключении архива

  const loadTeamLeads = async () => {
    try {
      const teamLeadsData = await userService.getUsersByRole('teamlead');
      setTeamLeads(teamLeadsData || []);
    } catch (error) {
      console.error('Ошибка загрузки Team Leads:', error);
    }
  };

  const loadRoles = async () => {
    try {
      const rolesData = await userService.getAllRoles();
      setRoles(rolesData || []);
    } catch (error) {
      console.error('Ошибка загрузки ролей:', error);
    }
  };

  const loadUsers = async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setLoading(true);
      }
      const usersData = showArchived
        ? await userService.getArchivedUsers()
        : await userService.getAllUsers();
      // Показываем всех пользователей, включая тимлидов
      setUsers(usersData);
    } catch (error) {
      setError('Ошибка загрузки пользователей: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Обработчик поиска с дебаунсом
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Очищаем предыдущий таймаут
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Устанавливаем новый таймаут для дебаунса (300мс)
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);

  // Очистка таймаута при размонтировании компонента
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Фильтрация пользователей по поисковому запросу
  const filteredUsers = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return users;
    }

    const searchLower = debouncedSearch.toLowerCase().trim();
    return users.filter(user =>
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  }, [users, debouncedSearch]);

  // Группировка пользователей по отделам и тимлидам
  const groupedUsers = useMemo(() => {
    const result = {
      departments: {},
      noDepartment: {
        teamLeads: {},
        noTeamLead: []
      }
    };

    // Сначала собираем всех тимлидов (у кого есть подчинённые)
    const teamLeadIds = new Set(
      filteredUsers
        .filter(u => u.team_lead_id)
        .map(u => u.team_lead_id)
    );

    filteredUsers.forEach(user => {
      const deptId = user.department_id || user.department || null;
      const deptName = user.department_id
        ? (departments.find(d => d.id === user.department_id)?.name || 'Неизвестный отдел')
        : (user.department || null);

      // Определяем, является ли пользователь тимлидом
      const isTeamLead = user.role === 'teamlead' || teamLeadIds.has(user.id);

      if (deptName) {
        // Есть отдел
        if (!result.departments[deptName]) {
          result.departments[deptName] = {
            id: user.department_id || deptName,
            name: deptName,
            teamLeads: {},
            noTeamLead: []
          };
        }

        if (isTeamLead && !user.team_lead_id) {
          // Это тимлид без своего тимлида — верхний уровень
          if (!result.departments[deptName].teamLeads[user.id]) {
            result.departments[deptName].teamLeads[user.id] = {
              user: user,
              subordinates: []
            };
          } else {
            result.departments[deptName].teamLeads[user.id].user = user;
          }
        } else if (user.team_lead_id) {
          // Есть тимлид — добавляем к тимлиду
          const tlId = user.team_lead_id;
          if (!result.departments[deptName].teamLeads[tlId]) {
            result.departments[deptName].teamLeads[tlId] = {
              user: null, // тимлид может быть в другом отделе
              subordinates: []
            };
          }
          result.departments[deptName].teamLeads[tlId].subordinates.push(user);
        } else {
          // Нет тимлида
          result.departments[deptName].noTeamLead.push(user);
        }
      } else {
        // Нет отдела
        if (isTeamLead && !user.team_lead_id) {
          if (!result.noDepartment.teamLeads[user.id]) {
            result.noDepartment.teamLeads[user.id] = {
              user: user,
              subordinates: []
            };
          } else {
            result.noDepartment.teamLeads[user.id].user = user;
          }
        } else if (user.team_lead_id) {
          const tlId = user.team_lead_id;
          if (!result.noDepartment.teamLeads[tlId]) {
            result.noDepartment.teamLeads[tlId] = {
              user: null,
              subordinates: []
            };
          }
          result.noDepartment.teamLeads[tlId].subordinates.push(user);
        } else {
          result.noDepartment.noTeamLead.push(user);
        }
      }
    });

    return result;
  }, [filteredUsers, departments]);

  // Состояние раскрытия отделов
  const [expandedDepartments, setExpandedDepartments] = useState({});
  const [expandedTeamLeads, setExpandedTeamLeads] = useState({});

  const toggleDepartment = (deptName) => {
    setExpandedDepartments(prev => ({
      ...prev,
      [deptName]: !prev[deptName]
    }));
  };

  const toggleTeamLead = (tlId) => {
    setExpandedTeamLeads(prev => ({
      ...prev,
      [tlId]: !prev[tlId]
    }));
  };

  const validateUserData = (userData, isEdit = false) => {
    const errors = {};

    if (!userData.name?.trim()) {
      errors.name = true;
      setError('Имя пользователя обязательно для заполнения');
      setFieldErrors(errors);
      return false;
    }

    if (!userData.email?.trim()) {
      errors.email = true;
      setError('Email адрес обязателен для заполнения');
      setFieldErrors(errors);
      return false;
    }

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email.trim())) {
      errors.email = true;
      setError('Введите корректный email адрес (например: user@example.com)');
      setFieldErrors(errors);
      return false;
    }

    // Для создания пароль обязателен, для редактирования - нет
    if (!isEdit && (!userData.password || userData.password.length < 6)) {
      errors.password = true;
      setError('Пароль должен содержать минимум 6 символов');
      setFieldErrors(errors);
      return false;
    }

    // Для редактирования проверяем пароль только если он указан
    if (isEdit && userData.password && userData.password.length < 6) {
      errors.password = true;
      setError('Пароль должен содержать минимум 6 символов');
      setFieldErrors(errors);
      return false;
    }

    // Проверка на существующий email
    const emailToCheck = userData.email.trim().toLowerCase();
    const existingUser = users.find(u => {
      if (isEdit) {
        return u.id !== userData.id && u.email.toLowerCase() === emailToCheck;
      } else {
        return u.email.toLowerCase() === emailToCheck;
      }
    });

    if (existingUser) {
      errors.email = true;
      setError('Пользователь с таким email уже существует');
      setFieldErrors(errors);
      return false;
    }

    // Для Team Lead обязателен отдел
    if (userData.role === 'teamlead' && !userData.department?.trim()) {
      errors.department = true;
      setError('Для Team Lead обязательно указать отдел');
      setFieldErrors(errors);
      return false;
    }

    // Для всех ролей кроме Team Lead обязателен выбор Team Lead
    if (userData.role !== 'teamlead' && !userData.team_lead_id) {
      errors.team_lead_id = true;
      setError('Необходимо выбрать Team Lead');
      setFieldErrors(errors);
      return false;
    }

    // Проверка каналов трафика для Media Buyer
    if (userData.role === 'buyer' && userData.buyer_settings?.traffic_channels?.length > 0) {
      const channels = userData.buyer_settings.traffic_channels;

      // Проверка обязательных полей
      for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        const channelNum = i + 1;

        if (!channel.source) {
          errors[`channel_${i}_source`] = true;
          setError(`Канал ${channelNum}: Источник трафика обязателен`);
          setFieldErrors(errors);
          return false;
        }

        if (!channel.currency) {
          errors[`channel_${i}_currency`] = true;
          setError(`Канал ${channelNum}: Валюта обязательна`);
          setFieldErrors(errors);
          return false;
        }

        if (!channel.channel_id?.trim()) {
          errors[`channel_${i}_channel_id`] = true;
          setError(`Канал ${channelNum}: ID канала обязателен`);
          setFieldErrors(errors);
          return false;
        }

        if (!channel.account_name?.trim()) {
          errors[`channel_${i}_account_name`] = true;
          setError(`Канал ${channelNum}: Название аккаунта обязательно`);
          setFieldErrors(errors);
          return false;
        }
      }

      // Проверка дубликатов ID каналов
      const channelIds = channels.map(c => c.channel_id?.trim().toLowerCase()).filter(Boolean);
      const duplicateChannelId = channelIds.find((id, index) => channelIds.indexOf(id) !== index);
      if (duplicateChannelId) {
        const duplicateIndices = channels
          .map((c, i) => c.channel_id?.trim().toLowerCase() === duplicateChannelId ? i : -1)
          .filter(i => i !== -1);
        duplicateIndices.forEach(i => {
          errors[`channel_${i}_channel_id`] = true;
        });
        setError(`ID канала "${duplicateChannelId}" уже привязан к этому байеру`);
        setFieldErrors(errors);
        return false;
      }

      // Проверка дубликатов названий аккаунтов
      const accountNames = channels.map(c => c.account_name?.trim().toLowerCase()).filter(Boolean);
      const duplicateAccountName = accountNames.find((name, index) => accountNames.indexOf(name) !== index);
      if (duplicateAccountName) {
        const duplicateIndices = channels
          .map((c, i) => c.account_name?.trim().toLowerCase() === duplicateAccountName ? i : -1)
          .filter(i => i !== -1);
        duplicateIndices.forEach(i => {
          errors[`channel_${i}_account_name`] = true;
        });
        setError(`Название аккаунта "${duplicateAccountName}" уже используется в другом канале`);
        setFieldErrors(errors);
        return false;
      }
    }

    setFieldErrors({});
    return true;
  };

  const handleCreateUser = async () => {
    if (!validateUserData(newUser, false)) {
      return;
    }

    try {
      setCreating(true);
      setError('');
      setSuccess('');

      console.log('🚀 Попытка создания пользователя:', {
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        role: newUser.role
      });

      // Подготавливаем данные для создания пользователя
      // Для обычных пользователей берем отдел от выбранного Team Lead
      let userDepartment = newUser.department?.trim() || null;
      if (newUser.role !== 'teamlead' && newUser.team_lead_id) {
        const selectedTeamLead = teamLeads.find(tl => tl.id === newUser.team_lead_id);
        userDepartment = selectedTeamLead?.department || null;
      }

      const userData = {
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role,
        department: userDepartment,
        department_id: newUser.department_id || null,
        custom_permissions: newUser.custom_permissions || [],
        team_lead_id: newUser.team_lead_id || null,
        team_lead_name: newUser.team_lead_name || null,
        created_by_id: user.id,
        created_by_name: user.name || user.email
      };

      // Добавляем buyer_settings только для Media Buyer
      if (newUser.role === 'buyer') {
        // Фильтруем пустые ID каналов и форматируем данные
        const validChannels = newUser.buyer_settings.traffic_channels
          .filter(channel => channel.channel_id.trim())
          .map(channel => ({
            source: channel.source || 'Facebook',
            channel_id: channel.channel_id.trim(),
            account_name: channel.account_name?.trim() || '',
            currency: channel.currency,
            access_granted: channel.access_granted || '2020-01-01',
            access_limited: channel.access_limited || null
          }));

        userData.buyer_settings = {
          traffic_channels: validChannels
        };
      }

      const result = await userService.createUser(userData);

      console.log('✅ Результат создания пользователя:', result);

      // Очищаем форму и закрываем модал
      const createdUserName = newUser.name.trim();
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'buyer',
        department: '',
        department_id: null,
        custom_permissions: [],
        team_lead_id: null,
        team_lead_name: null,
        buyer_settings: {
          traffic_channels: []
        }
      });
      setNewUserRolePermissions([]);
      setShowCreateModal(false);

      // Обновляем список пользователей
      await loadUsers();
      
      setSuccess(`Пользователь "${createdUserName}" успешно создан`);

    } catch (error) {
      console.error('❌ Ошибка создания пользователя:', error);
      
      // Проверяем, может быть пользователь всё же был создан
      const createdUserName = newUser.name.trim();
      const createdUserEmail = newUser.email.trim();
      
      // Ждем немного и проверяем, появился ли пользователь в списке
      setTimeout(async () => {
        try {
          // Получаем свежий список пользователей
          const freshUsersData = await userService.getAllUsers();
          const freshFilteredUsers = freshUsersData.filter(u => u.role !== 'teamlead');
          
          // Проверяем, есть ли созданный пользователь в обновленном списке
          const wasUserCreated = freshFilteredUsers.some(u => 
            u.email.toLowerCase() === createdUserEmail.toLowerCase()
          );
          
          if (wasUserCreated) {
            console.log('✅ Пользователь был создан успешно, несмотря на ошибку');
            
            // Обновляем состояние списка пользователей
            setUsers(freshFilteredUsers);
            
            // Очищаем форму и закрываем модал
            setNewUser({
              name: '',
              email: '',
              password: '',
              role: 'buyer',
              department: '',
              team_lead_id: null,
              team_lead_name: null,
              buyer_settings: {
                traffic_channels: []
              }
            });
            setShowCreateModal(false);
            setError(''); // Очищаем ошибку
            setSuccess(`Пользователь "${createdUserName}" успешно создан`);
            return;
          }
        } catch (checkError) {
          console.error('Ошибка проверки созданного пользователя:', checkError);
        }
      }, 1000);
      
      // Показываем ошибку только если это реальная проблема
      let errorMessage = 'Неизвестная ошибка создания пользователя';
      
      if (error.message) {
        if (error.message.includes('уже существует') || 
            error.message.includes('already registered') ||
            error.message.includes('already exists')) {
          errorMessage = error.message;
        } else if (error.message.includes('signup is disabled')) {
          errorMessage = 'Регистрация новых пользователей отключена в настройках Supabase. Обратитесь к системному администратору.';
        } else if (error.message.includes('invalid')) {
          errorMessage = `Неверный формат email адреса "${newUser.email}". Проверьте правильность введенного email.`;
        } else {
          errorMessage = `Ошибка создания пользователя: ${error.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleEditUser = async (userToEdit) => {
    // Запрещаем редактирование защищенных пользователей
    if (userToEdit.is_protected) {
      setError('Редактирование защищенного пользователя запрещено');
      return;
    }

    setEditingUser(userToEdit);

    // Загружаем buyer_settings если пользователь - Media Buyer
    // Если каналов нет - оставляем пустой массив (каналы добавляются по кнопке)
    const buyerSettings = userToEdit.role === 'buyer' && userToEdit.buyer_settings
      ? {
          traffic_channels: userToEdit.buyer_settings.traffic_channels?.length > 0
            ? userToEdit.buyer_settings.traffic_channels.map(channel => ({
                source: channel.source || 'Facebook',
                channel_id: channel.channel_id || '',
                account_name: channel.account_name || '',
                currency: channel.currency || 'USD',
                access_granted: channel.access_granted || '2020-01-01',
                access_limited: channel.access_limited || null
              }))
            : [] // Пустой массив - каналы добавляются по кнопке
        }
      : {
          traffic_channels: [] // Пустой массив
        };

    // Загружаем права роли для отображения
    try {
      if (userToEdit.role_id) {
        const perms = await userService.getRolePermissions(userToEdit.role_id);
        setRolePermissions(perms.map(p => p.code));
      } else {
        setRolePermissions([]);
      }
    } catch (err) {
      console.error('Error loading role permissions:', err);
      setRolePermissions([]);
    }

    setEditUserData({
      id: userToEdit.id,
      name: userToEdit.name || '',
      email: userToEdit.email || '',
      password: '', // Пароль всегда пустой для безопасности
      role: userToEdit.role || 'buyer',
      department: userToEdit.department || '', // legacy
      department_id: userToEdit.department_id || null,
      custom_permissions: userToEdit.custom_permissions || [],
      is_protected: userToEdit.is_protected || false,
      team_lead_id: userToEdit.team_lead_id || null,
      team_lead_name: userToEdit.team_lead_name || null,
      buyer_settings: buyerSettings
    });
    setShowEditModal(true);
    setShowPassword(false); // Скрываем пароль при открытии
    clearMessages();
  };

  const handleUpdateUser = async () => {
    if (!validateUserData(editUserData, true)) {
      return;
    }

    try {
      setUpdating(true);
      setError('');
      setSuccess('');

      console.log('📝 Обновление пользователя:', {
        id: editUserData.id,
        name: editUserData.name.trim(),
        email: editUserData.email.trim(),
        role: editUserData.role,
        hasPassword: !!editUserData.password
      });

      // Подготавливаем данные для обновления
      // Для обычных пользователей берем отдел от выбранного Team Lead
      let userDepartment = editUserData.department?.trim() || null;
      if (editUserData.role !== 'teamlead' && editUserData.team_lead_id) {
        const selectedTeamLead = teamLeads.find(tl => tl.id === editUserData.team_lead_id);
        userDepartment = selectedTeamLead?.department || null;
      }

      const updateData = {
        id: editUserData.id,
        name: editUserData.name.trim(),
        email: editUserData.email.trim(),
        password: editUserData.password || undefined, // Только если пароль указан
        role: editUserData.role,
        department: userDepartment,
        department_id: editUserData.department_id || null,
        custom_permissions: editUserData.custom_permissions || [],
        is_protected: editUserData.is_protected,
        team_lead_id: editUserData.team_lead_id || null,
        team_lead_name: editUserData.team_lead_name || null
      };

      // Добавляем buyer_settings только для Media Buyer
      if (editUserData.role === 'buyer') {
        // Фильтруем пустые ID каналов и форматируем данные
        const validChannels = editUserData.buyer_settings.traffic_channels
          .filter(channel => channel.channel_id.trim())
          .map(channel => ({
            source: channel.source || 'Facebook',
            channel_id: channel.channel_id.trim(),
            account_name: channel.account_name?.trim() || '',
            currency: channel.currency,
            access_granted: channel.access_granted || '2020-01-01',
            access_limited: channel.access_limited || null
          }));

        updateData.buyer_settings = {
          traffic_channels: validChannels
        };
      }

      const result = await userService.updateUser(updateData);

      console.log('✅ Результат обновления пользователя:', result);

      // Очищаем форму и закрываем модал
      const updatedUserName = editUserData.name.trim();
      setEditUserData({
        id: '',
        name: '',
        email: '',
        password: '',
        role: 'buyer',
        department: '',
        department_id: null,
        custom_permissions: [],
        is_protected: false,
        team_lead_id: null,
        team_lead_name: null,
        buyer_settings: {
          traffic_channels: []
        }
      });
      setRolePermissions([]);
      setEditingUser(null);
      setShowEditModal(false);
      setShowPassword(false);

      // Обновляем список пользователей
      await loadUsers();
      
      setSuccess(`Данные пользователя "${updatedUserName}" успешно обновлены`);

    } catch (error) {
      console.error('❌ Ошибка обновления пользователя:', error);
      
      let errorMessage = 'Неизвестная ошибка обновления пользователя';
      
      if (error.message) {
        if (error.message.includes('уже существует') || 
            error.message.includes('already exists') ||
            error.message.includes('duplicate')) {
          errorMessage = error.message;
        } else if (error.message.includes('invalid')) {
          errorMessage = `Неверный формат email адреса "${editUserData.email}". Проверьте правильность введенного email.`;
        } else {
          errorMessage = `Ошибка обновления пользователя: ${error.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async (userId, userName, userRole, isProtected) => {
    // Запрещаем удаление защищенных пользователей
    if (isProtected) {
      setError('Удаление защищенного пользователя запрещено');
      return;
    }

    if (!window.confirm(`Вы уверены, что хотите архивировать пользователя "${userName}"?\n\nПользователь будет скрыт из списка, но его данные (лендинги, креативы) останутся в системе. Вы сможете восстановить пользователя из архива.`)) {
      return;
    }

    try {
      setDeleting(userId);
      setError('');
      await userService.deleteUser(userId);
      await loadUsers();
      setSuccess(`Пользователь "${userName}" успешно архивирован`);
    } catch (error) {
      setError('Ошибка архивирования пользователя: ' + error.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleRestoreUser = async (userId, userName) => {
    if (!window.confirm(`Вы уверены, что хотите восстановить пользователя "${userName}"?`)) {
      return;
    }

    try {
      setRestoring(userId);
      setError('');
      await userService.restoreUser(userId);
      await loadUsers();
      setSuccess(`Пользователь "${userName}" успешно восстановлен`);
    } catch (error) {
      setError('Ошибка восстановления пользователя: ' + error.message);
    } finally {
      setRestoring(null);
    }
  };

  // Обновленная функция для форматирования времени по киевскому часовому поясу
  const formatKyivTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        timeZone: 'Europe/Kiev',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return new Date(dateString).toLocaleDateString('ru-RU', {
        timeZone: 'Europe/Kiev'
      });
    }
  };

  // Получить сегодняшнюю дату по Киеву в формате YYYY-MM-DD
  const getTodayKyiv = () => {
    const now = new Date();
    const kyivDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
    const year = kyivDate.getFullYear();
    const month = String(kyivDate.getMonth() + 1).padStart(2, '0');
    const day = String(kyivDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Проверить, истек ли доступ канала
  const isChannelExpired = (accessLimited) => {
    if (!accessLimited) return false;
    const today = getTodayKyiv();
    return accessLimited < today;
  };

  // Получить количество дней с момента истечения доступа
  const getDaysExpired = (accessLimited) => {
    if (!accessLimited) return 0;
    const today = new Date(getTodayKyiv());
    const expiredDate = new Date(accessLimited);
    const diffTime = today - expiredDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Получить количество дней активности канала (от access_granted до сегодня или access_limited)
  const getDaysActive = (accessGranted, accessLimited) => {
    if (!accessGranted) return 0;
    const startDate = new Date(accessGranted);
    const endDate = accessLimited ? new Date(accessLimited) : new Date(getTodayKyiv());
    const diffTime = endDate - startDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Склонение дней
  const pluralizeDays = (days) => {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
  };

  // Сортировка каналов: активные сверху, просроченные снизу
  const sortChannelsByExpiration = (channels) => {
    if (!channels || channels.length === 0) return [];
    return [...channels].sort((a, b) => {
      const aExpired = isChannelExpired(a.access_limited);
      const bExpired = isChannelExpired(b.access_limited);
      if (aExpired && !bExpired) return 1;
      if (!aExpired && bExpired) return -1;
      return 0;
    });
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'buyer':
        return 'Media Buyer';
      case 'editor':
        return 'Video Designer';
      case 'designer':
        return 'Designer';
      case 'teamlead':
        return 'Team Lead';
      case 'search_manager':
        return 'Search Manager';
      case 'content_manager':
        return 'Content Manager';
      case 'product_manager':
        return 'Product Manager';
      case 'proofreader':
        return 'Editor';
      case 'gif_creator':
        return 'GIF Creator';
      default:
        return 'Unknown';
    }
  };

  // Отображение роли с отделом для Team Lead
  const getRoleDisplayWithDepartment = (role, department) => {
    if (role === 'teamlead' && department) {
      return `TL ${department}`;
    }
    return getRoleDisplayName(role);
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'buyer':
        return <AdIcon className="h-6 w-6 text-blue-600" />;
      case 'editor':
        return <Video className="h-6 w-6 text-purple-600" />;
      case 'designer':
        return <Palette className="h-6 w-6 text-pink-600" />;
      case 'teamlead':
        return <Shield className="h-6 w-6 text-green-600" />;
      case 'search_manager':
        return <Search className="h-6 w-6 text-orange-600" />;
      case 'content_manager':
        return <Code2 className="h-6 w-6 text-indigo-600" />;
      case 'product_manager':
        return <Package className="h-6 w-6 text-amber-600" />;
      case 'proofreader':
        return <Pencil className="h-6 w-6 text-teal-600" />;
      case 'gif_creator':
        return <Image className="h-6 w-6 text-cyan-600" />;
      default:
        return <User className="h-6 w-6 text-gray-600" />;
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'buyer':
        return 'bg-blue-100 text-blue-800';
      case 'editor':
        return 'bg-purple-100 text-purple-800';
      case 'designer':
        return 'bg-pink-100 text-pink-800';
      case 'teamlead':
        return 'bg-green-100 text-green-800';
      case 'search_manager':
        return 'bg-orange-100 text-orange-800';
      case 'content_manager':
        return 'bg-indigo-100 text-indigo-800';
      case 'product_manager':
        return 'bg-amber-100 text-amber-800';
      case 'proofreader':
        return 'bg-teal-100 text-teal-800';
      case 'gif_creator':
        return 'bg-cyan-100 text-cyan-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Цвет фона аватара по роли
  const getRoleAvatarBg = (role) => {
    switch (role) {
      case 'buyer':
        return 'bg-blue-100';
      case 'editor':
        return 'bg-purple-100';
      case 'designer':
        return 'bg-pink-100';
      case 'teamlead':
        return 'bg-green-100';
      case 'search_manager':
        return 'bg-orange-100';
      case 'content_manager':
        return 'bg-indigo-100';
      case 'product_manager':
        return 'bg-amber-100';
      case 'proofreader':
        return 'bg-teal-100';
      case 'gif_creator':
        return 'bg-cyan-100';
      default:
        return 'bg-gray-100';
    }
  };

  // Цвет верхней полоски карточки по роли
  const getRoleStripeColor = (role) => {
    switch (role) {
      case 'buyer':
        return 'bg-blue-400';
      case 'editor':
        return 'bg-purple-400';
      case 'designer':
        return 'bg-pink-400';
      case 'teamlead':
        return 'bg-green-400';
      case 'search_manager':
        return 'bg-orange-400';
      case 'content_manager':
        return 'bg-indigo-400';
      case 'product_manager':
        return 'bg-amber-400';
      case 'proofreader':
        return 'bg-teal-400';
      case 'gif_creator':
        return 'bg-cyan-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getUserStats = () => {
    const buyersCount = users.filter(u => u.role === 'buyer').length;
    const editorsCount = users.filter(u => u.role === 'editor').length;
    const designersCount = users.filter(u => u.role === 'designer').length;
    const searchManagersCount = users.filter(u => u.role === 'search_manager').length;
    const contentManagersCount = users.filter(u => u.role === 'content_manager').length;
    const productManagersCount = users.filter(u => u.role === 'product_manager').length;
    const proofreadersCount = users.filter(u => u.role === 'proofreader').length;
    const gifCreatorsCount = users.filter(u => u.role === 'gif_creator').length;
    const teamleadCount = users.filter(u => u.role === 'teamlead').length;
    return { buyersCount, editorsCount, designersCount, searchManagersCount, contentManagersCount, productManagersCount, proofreadersCount, gifCreatorsCount, teamleadCount };
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
    setShowPassword(false);
    setFieldErrors({});
  };

  const { buyersCount, editorsCount, designersCount, searchManagersCount, contentManagersCount, productManagersCount, proofreadersCount, gifCreatorsCount, teamleadCount } = getUserStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка пользователей...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
                Управление пользователями
                {showArchived && activeTab === 'users' && (
                  <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                    <Archive className="h-4 w-4 mr-1" />
                    Архив
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {activeTab === 'users' && (showArchived
                  ? 'Архивированные пользователи - восстановите при необходимости'
                  : 'Создание и управление аккаунтами'
                )}
                {activeTab === 'roles' && 'Управление ролями и их правами'}
                {activeTab === 'departments' && 'Управление отделами'}
              </p>
            </div>
            <div className="flex space-x-3">
              {activeTab === 'users' && !showArchived && (
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    clearMessages();
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить пользователя
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1 border-t border-gray-100">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4" />
            Пользователи
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'roles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="h-4 w-4" />
            Роли
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'departments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Отделы
          </button>
        </div>
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && <RolesPanel user={user} />}

      {/* Departments Tab */}
      {activeTab === 'departments' && <DepartmentsPanel user={user} />}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <>
          {/* Success Messages - только когда модалки закрыты (ошибки только внутри модалок) */}
          {success && !showCreateModal && !showEditModal && (
            <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm flex items-center">
              <Check className="h-4 w-4 mr-2 flex-shrink-0" />
              {success}
            </div>
          )}

          {/* Stats */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AdIcon className="h-8 w-8 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Media Buyers
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {buyersCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Video className="h-8 w-8 text-purple-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Video Designers
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {editorsCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Palette className="h-8 w-8 text-pink-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Designers
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {designersCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Search className="h-8 w-8 text-orange-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Search Managers
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {searchManagersCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Code2 className="h-8 w-8 text-indigo-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Content Managers
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {contentManagersCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Package className="h-8 w-8 text-amber-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Product Managers
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {productManagersCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Pencil className="h-8 w-8 text-teal-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Editors
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {proofreadersCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Image className="h-8 w-8 text-cyan-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      GIF Creators
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {gifCreatorsCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Team Leads
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {teamleadCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Shield className="h-8 w-8 text-gray-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Всего активных
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {users.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Вкладки Активные/Архив - сверху списка, на всю ширину */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-lg">
          <button
            onClick={() => setShowArchived(false)}
            className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              !showArchived
                ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Активные
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              showArchived
                ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Архив
          </button>
        </div>

        {/* Users List */}
        <div className="bg-white shadow-sm rounded-b-lg border border-t-0 border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            {/* Поиск пользователей */}
            <div className="mb-4">
              <div className="relative w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Поиск по имени или email..."
                  className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setDebouncedSearch('');
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Минимальная высота для предотвращения мерцания при переключении вкладок */}
            <div className="min-h-[200px]">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                {debouncedSearch ? (
                  <>
                    <p className="text-gray-500 mb-2">По запросу "{debouncedSearch}" ничего не найдено</p>
                    <p className="text-gray-400 text-sm mb-4">Попробуйте изменить поисковый запрос</p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setDebouncedSearch('');
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Сбросить поиск
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-gray-500 mb-4">Пользователи не найдены</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Создать первого пользователя
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Отделы */}
                {Object.entries(groupedUsers.departments).map(([deptName, dept]) => {
                  const isExpanded = expandedDepartments[deptName] !== false; // По умолчанию раскрыт
                  const totalUsers = Object.values(dept.teamLeads).reduce((sum, tl) => sum + (tl.user ? 1 : 0) + tl.subordinates.length, 0) + dept.noTeamLead.length;

                  return (
                    <div key={deptName} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                      {/* Заголовок отдела */}
                      <button
                        onClick={() => toggleDepartment(deptName)}
                        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Building2 className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">{deptName}</div>
                            <div className="text-xs text-gray-500">{totalUsers} сотрудников</div>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </button>

                      {/* Содержимое отдела */}
                      {isExpanded && (
                        <div className="p-3 space-y-2">
                          {/* Тимлиды с подчинёнными */}
                          {Object.entries(dept.teamLeads).map(([tlId, tlData]) => {
                            const isTeamLeadExpanded = expandedTeamLeads[tlId] !== false;
                            const teamLead = tlData.user;
                            const subordinates = tlData.subordinates;

                            // Если тимлида нет в этом отделе, но есть подчинённые
                            if (!teamLead && subordinates.length === 0) return null;

                            return (
                              <div key={tlId} className="border border-gray-100 rounded-lg overflow-hidden">
                                {/* Тимлид */}
                                {teamLead && (
                                  <div className="bg-green-50 border-b border-green-100">
                                    <div className="flex items-center p-3">
                                      {subordinates.length > 0 && (
                                        <button
                                          onClick={() => toggleTeamLead(tlId)}
                                          className="mr-2 p-1 hover:bg-green-100 rounded"
                                        >
                                          {isTeamLeadExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4 text-green-600" />
                                          )}
                                        </button>
                                      )}
                                      {subordinates.length === 0 && <div className="w-8" />}

                                      {/* Аватар */}
                                      <div className={`h-9 w-9 rounded-full overflow-hidden bg-green-100 flex items-center justify-center flex-shrink-0`}>
                                        <Shield className="h-5 w-5 text-green-600" />
                                      </div>

                                      {/* Имя */}
                                      <div className="min-w-0 ml-3 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-semibold text-gray-900">{teamLead.name}</span>
                                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Team Lead</span>
                                          {teamLead.is_protected && (
                                            <Shield className="h-3.5 w-3.5 text-yellow-500" />
                                          )}
                                        </div>
                                        <div className="text-xs text-gray-500">{teamLead.email}</div>
                                      </div>

                                      {/* Роль */}
                                      <div className="mr-4 hidden sm:block">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getRoleBadgeColor(teamLead.role)}`}>
                                          {getRoleDisplayName(teamLead.role)}
                                        </span>
                                      </div>

                                      {/* Команда */}
                                      <div className="mr-4 text-xs text-gray-500">
                                        <Users className="h-3.5 w-3.5 inline mr-1" />
                                        {subordinates.length} чел.
                                      </div>

                                      {/* Действия */}
                                      <div className="flex items-center space-x-1">
                                        {!showArchived && (
                                          <>
                                            <button
                                              onClick={() => handleEditUser(teamLead)}
                                              disabled={teamLead.is_protected}
                                              className={`p-1.5 rounded-lg transition-colors ${teamLead.is_protected ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                            >
                                              <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteUser(teamLead.id, teamLead.name, teamLead.role, teamLead.is_protected)}
                                              disabled={deleting === teamLead.id || teamLead.is_protected}
                                              className={`p-1.5 rounded-lg transition-colors ${teamLead.is_protected ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                                            >
                                              <Archive className="h-4 w-4" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Подчинённые */}
                                {isTeamLeadExpanded && subordinates.length > 0 && (
                                  <div className="bg-gray-50">
                                    {subordinates.map((sub, idx) => (
                                      <div
                                        key={sub.id}
                                        className={`flex items-center p-3 pl-12 hover:bg-gray-100 transition-colors ${idx !== subordinates.length - 1 ? 'border-b border-gray-100' : ''}`}
                                      >
                                        {/* Линия связи */}
                                        <div className="absolute left-6 w-4 border-l-2 border-b-2 border-gray-300 h-4 rounded-bl" style={{ marginTop: '-8px' }} />

                                        {/* Аватар */}
                                        <div className={`h-8 w-8 rounded-full overflow-hidden ${getRoleAvatarBg(sub.role)} flex items-center justify-center flex-shrink-0`}>
                                          {getRoleIcon(sub.role)}
                                        </div>

                                        {/* Имя */}
                                        <div className="min-w-0 ml-3 flex-1">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium text-gray-900">{sub.name}</span>
                                            {sub.is_protected && (
                                              <Shield className="h-3 w-3 text-yellow-500" />
                                            )}
                                          </div>
                                          <div className="text-xs text-gray-500">{sub.email}</div>
                                        </div>

                                        {/* Роль */}
                                        <div className="mr-4 hidden sm:block">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getRoleBadgeColor(sub.role)}`}>
                                            {getRoleDisplayName(sub.role)}
                                          </span>
                                        </div>

                                        {/* Действия */}
                                        <div className="flex items-center space-x-1">
                                          {showArchived ? (
                                            <button
                                              onClick={() => handleRestoreUser(sub.id, sub.name)}
                                              disabled={restoring === sub.id}
                                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-lg text-white bg-green-600 hover:bg-green-700"
                                            >
                                              <RotateCcw className="h-3 w-3 mr-1" />
                                              Восстановить
                                            </button>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => handleEditUser(sub)}
                                                disabled={sub.is_protected}
                                                className={`p-1.5 rounded-lg transition-colors ${sub.is_protected ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                              >
                                                <Edit className="h-4 w-4" />
                                              </button>
                                              <button
                                                onClick={() => handleDeleteUser(sub.id, sub.name, sub.role, sub.is_protected)}
                                                disabled={deleting === sub.id || sub.is_protected}
                                                className={`p-1.5 rounded-lg transition-colors ${sub.is_protected ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                                              >
                                                <Archive className="h-4 w-4" />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Пользователи без тимлида */}
                          {dept.noTeamLead.length > 0 && (
                            <div className="border border-dashed border-gray-200 rounded-lg p-3">
                              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Без Team Lead
                              </div>
                              <div className="space-y-2">
                                {dept.noTeamLead.map(u => (
                                  <div key={u.id} className="flex items-center p-2 bg-white rounded-lg border border-gray-100">
                                    <div className={`h-8 w-8 rounded-full overflow-hidden ${getRoleAvatarBg(u.role)} flex items-center justify-center flex-shrink-0`}>
                                      {getRoleIcon(u.role)}
                                    </div>
                                    <div className="min-w-0 ml-3 flex-1">
                                      <div className="text-sm font-medium text-gray-900">{u.name}</div>
                                      <div className="text-xs text-gray-500">{u.email}</div>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium mr-3 ${getRoleBadgeColor(u.role)}`}>
                                      {getRoleDisplayName(u.role)}
                                    </span>
                                    <div className="flex items-center space-x-1">
                                      <button onClick={() => handleEditUser(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                                        <Edit className="h-4 w-4" />
                                      </button>
                                      <button onClick={() => handleDeleteUser(u.id, u.name, u.role, u.is_protected)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                                        <Archive className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Пользователи без отдела */}
                {(Object.keys(groupedUsers.noDepartment.teamLeads).length > 0 || groupedUsers.noDepartment.noTeamLead.length > 0) && (
                  <div className="border border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
                    <div className="p-4 border-b border-gray-200 bg-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-200 rounded-lg">
                          <AlertCircle className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-700">Без отдела</div>
                          <div className="text-xs text-gray-500">Пользователи не привязаны к отделу</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      {Object.entries(groupedUsers.noDepartment.teamLeads).map(([tlId, tlData]) => {
                        if (!tlData.user && tlData.subordinates.length === 0) return null;
                        return (
                          <div key={tlId} className="bg-white rounded-lg border border-gray-200 p-3">
                            {tlData.user && (
                              <div className="flex items-center mb-2">
                                <Shield className="h-5 w-5 text-green-600 mr-2" />
                                <span className="font-medium">{tlData.user.name}</span>
                                <span className="text-xs text-gray-500 ml-2">({tlData.subordinates.length} подчинённых)</span>
                              </div>
                            )}
                            {tlData.subordinates.map(sub => (
                              <div key={sub.id} className="flex items-center p-2 pl-8 border-t border-gray-100">
                                <div className={`h-7 w-7 rounded-full ${getRoleAvatarBg(sub.role)} flex items-center justify-center mr-2`}>
                                  {getRoleIcon(sub.role)}
                                </div>
                                <span className="text-sm flex-1">{sub.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${getRoleBadgeColor(sub.role)}`}>{getRoleDisplayName(sub.role)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {groupedUsers.noDepartment.noTeamLead.map(u => (
                        <div key={u.id} className="flex items-center p-3 bg-white rounded-lg border border-gray-200">
                          <div className={`h-8 w-8 rounded-full ${getRoleAvatarBg(u.role)} flex items-center justify-center mr-3`}>
                            {getRoleIcon(u.role)}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded mr-3 ${getRoleBadgeColor(u.role)}`}>{getRoleDisplayName(u.role)}</span>
                          <button onClick={() => handleEditUser(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-10 pb-10">
          <div className="relative w-full max-w-2xl mx-4 shadow-2xl rounded-2xl bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900">
                Создать пользователя
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUser({
                    name: '',
                    email: '',
                    password: '',
                    role: 'buyer',
                    department: '',
                    department_id: null,
                    custom_permissions: [],
                    team_lead_id: null,
                    team_lead_name: null,
                    buyer_settings: {
                      traffic_channels: []
                    }
                  });
                  setNewUserRolePermissions([]);
                  clearMessages();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Messages inside modal */}
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {success && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center">
                  <Check className="h-4 w-4 mr-2 flex-shrink-0" />
                  {success}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${fieldErrors.name ? 'text-red-600' : 'text-gray-700'}`}>
                    Имя пользователя *
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => {
                    setNewUser({ ...newUser, name: e.target.value });
                    clearMessages();
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    fieldErrors.name
                      ? 'border-red-500 focus:ring-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Введите имя"
                  maxLength={100}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${fieldErrors.email ? 'text-red-600' : 'text-gray-700'}`}>
                  Email *
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => {
                    setNewUser({ ...newUser, email: e.target.value });
                    clearMessages();
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    fieldErrors.email
                      ? 'border-red-500 focus:ring-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="user@example.com"
                  maxLength={200}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Используйте корректный email адрес
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${fieldErrors.password ? 'text-red-600' : 'text-gray-700'}`}>
                  Пароль *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(e) => {
                      setNewUser({ ...newUser, password: e.target.value });
                      clearMessages();
                    }}
                    className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      fieldErrors.password
                        ? 'border-red-500 focus:ring-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="Минимум 6 символов"
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Пароль должен содержать минимум 6 символов
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Роль
                </label>
                <RoleSelector
                  value={newUser.role}
                  onChange={(newRole) => {
                    setNewUser({ ...newUser, role: newRole });
                    clearMessages();
                  }}
                  roles={roles}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-left hover:border-gray-300 transition-colors"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {roles.find(r => r.code === newUser.role)?.description || 'Выберите роль'}
                </p>
              </div>

              {/* Отдел для Team Lead */}
              {newUser.role === 'teamlead' && (
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${fieldErrors.department ? 'text-red-600' : 'text-gray-700'}`}>
                    Отдел *
                  </label>
                  <input
                    type="text"
                    value={newUser.department}
                    onChange={(e) => {
                      setNewUser({ ...newUser, department: e.target.value });
                      clearMessages();
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      fieldErrors.department
                        ? 'border-red-500 focus:ring-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="Например: Media Buying, Design, Content"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Название отдела, которым руководит Team Lead
                  </p>
                </div>
              )}

              {/* Выбор Team Lead (только для не-тимлидов) */}
              {newUser.role !== 'teamlead' && (
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${fieldErrors.team_lead_id ? 'text-red-600' : 'text-gray-700'}`}>
                    Team Lead *
                  </label>
                  <TeamLeadSelector
                    value={newUser.team_lead_id}
                    onChange={(selectedId, selectedName) => {
                      setNewUser({
                        ...newUser,
                        team_lead_id: selectedId,
                        team_lead_name: selectedName
                      });
                      clearMessages();
                    }}
                    teamLeads={teamLeads}
                    className={`w-full px-3 py-2.5 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm text-left hover:border-gray-300 transition-colors ${
                      fieldErrors.team_lead_id
                        ? 'border-red-500 focus:ring-red-500 bg-red-50'
                        : 'border-gray-200 focus:ring-blue-500'
                    }`}
                  />
                  {/* Показываем отдел выбранного Team Lead */}
                  {newUser.team_lead_id && (() => {
                    const selectedTL = teamLeads.find(tl => tl.id === newUser.team_lead_id);
                    return selectedTL?.department ? (
                      <div className="mt-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="text-xs text-gray-400">Отдел</div>
                        <div className="text-sm text-gray-700 font-medium">{selectedTL.department}</div>
                      </div>
                    ) : null;
                  })()}
                  <p className="mt-1 text-xs text-gray-500">
                    Выберите Team Lead, к которому привязан пользователь
                  </p>
                </div>
              )}

              {/* Отдел (для пользователей с полными правами) */}
              {isFullAdmin && departments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">
                    Отдел
                  </label>
                  <DepartmentSelector
                    value={newUser.department_id}
                    onChange={(deptId) => {
                      setNewUser({ ...newUser, department_id: deptId });
                      clearMessages();
                    }}
                    departments={departments}
                    disabled={false}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-left hover:border-gray-300 transition-colors"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Отдел, к которому принадлежит пользователь
                  </p>
                </div>
              )}

              {/* Права доступа (для пользователей с полными правами) */}
              {isFullAdmin && (
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Дополнительные права доступа
                  </h4>
                  <PermissionsMatrix
                    permissions={newUser.custom_permissions}
                    onChange={(newPermissions) => {
                      setNewUser({ ...newUser, custom_permissions: newPermissions });
                    }}
                    rolePermissions={newUserRolePermissions}
                    disabled={false}
                    showRolePermissions={newUserRolePermissions.length > 0}
                  />
                </div>
              )}

              {/* Дополнительные поля для Media Buyer */}
              {newUser.role === 'buyer' && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-900">
                      Каналы трафика
                    </h4>
                    <span className="text-xs text-gray-500">
                      {newUser.buyer_settings.traffic_channels.length} {newUser.buyer_settings.traffic_channels.length === 1 ? 'канал' : newUser.buyer_settings.traffic_channels.length < 5 ? 'канала' : 'каналов'}
                    </span>
                  </div>

                  {/* Список каналов */}
                  {newUser.buyer_settings.traffic_channels.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {sortChannelsByExpiration(newUser.buyer_settings.traffic_channels).map((channel, sortedIndex) => {
                        const originalIndex = newUser.buyer_settings.traffic_channels.findIndex(c => c === channel);
                        const index = originalIndex !== -1 ? originalIndex : sortedIndex;
                        const expired = isChannelExpired(channel.access_limited);
                        const daysExpired = getDaysExpired(channel.access_limited);
                        const daysActive = getDaysActive(channel.access_granted, expired ? channel.access_limited : null);

                        return (
                        <div key={index} className={`relative border rounded-xl shadow-sm transition-shadow overflow-hidden ${
                          expired
                            ? 'bg-gray-50 border-gray-300 opacity-75'
                            : 'bg-white border-gray-200 hover:shadow-md'
                        }`}>
                          {/* Заголовок карточки с плашкой статуса */}
                          <div className={`flex items-center justify-between px-4 py-2 ${
                            expired ? 'bg-red-50 border-b border-red-100' : 'bg-green-50 border-b border-green-100'
                          }`}>
                            <div className="flex items-center gap-2">
                              {expired ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                  Неактивен {daysExpired} {pluralizeDays(daysExpired)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                  Активен {daysActive} {pluralizeDays(daysActive)}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newChannels = newUser.buyer_settings.traffic_channels.filter((_, i) => i !== index);
                                setNewUser({
                                  ...newUser,
                                  buyer_settings: {
                                    ...newUser.buyer_settings,
                                    traffic_channels: newChannels
                                  }
                                });
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Удалить канал"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Содержимое карточки */}
                          <div className="p-4">
                            {/* Строка 1: Источник + Валюта */}
                            <div className="flex gap-3 mb-3">
                              <div className="flex-1">
                                <label className={`block text-xs font-medium mb-1.5 ${fieldErrors[`channel_${index}_source`] ? 'text-red-600' : 'text-gray-600'}`}>
                                  Источник *
                                </label>
                                <SourceSelector
                                value={channel.source}
                                onChange={(newSource) => {
                                  const newChannels = [...newUser.buyer_settings.traffic_channels];
                                  newChannels[index].source = newSource;
                                  setNewUser({
                                    ...newUser,
                                    buyer_settings: {
                                      ...newUser.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                  clearMessages();
                                }}
                                className={`w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm text-left transition-colors ${
                                  fieldErrors[`channel_${index}_source`]
                                    ? 'border-red-500 focus:ring-red-500 bg-red-50'
                                    : 'border-gray-200 focus:ring-blue-500 hover:border-gray-300'
                                }`}
                              />
                            </div>
                            <div className="w-28">
                              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors[`channel_${index}_currency`] ? 'text-red-600' : 'text-gray-600'}`}>
                                Валюта *
                              </label>
                              <CurrencySelector
                                value={channel.currency}
                                onChange={(newCurrency) => {
                                  const newChannels = [...newUser.buyer_settings.traffic_channels];
                                  newChannels[index].currency = newCurrency;
                                  setNewUser({
                                    ...newUser,
                                    buyer_settings: {
                                      ...newUser.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                  clearMessages();
                                }}
                                className={`w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm text-left transition-colors ${
                                  fieldErrors[`channel_${index}_currency`]
                                    ? 'border-red-500 focus:ring-red-500 bg-red-50'
                                    : 'border-gray-200 focus:ring-blue-500 hover:border-gray-300'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Строка 2: ID канала + Название аккаунта */}
                          <div className="flex gap-3 mb-3">
                            <div className="flex-1">
                              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors[`channel_${index}_channel_id`] ? 'text-red-600' : 'text-gray-600'}`}>
                                ID канала *
                              </label>
                              <input
                                type="text"
                                value={channel.channel_id}
                                onChange={(e) => {
                                  const newChannels = [...newUser.buyer_settings.traffic_channels];
                                  newChannels[index].channel_id = e.target.value;
                                  setNewUser({
                                    ...newUser,
                                    buyer_settings: {
                                      ...newUser.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                  clearMessages();
                                }}
                                className={`w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-colors ${
                                  fieldErrors[`channel_${index}_channel_id`]
                                    ? 'border-red-500 focus:ring-red-500 bg-red-50'
                                    : 'border-gray-200 focus:ring-blue-500 hover:border-gray-300'
                                }`}
                                placeholder="654cb443baf00b..."
                              />
                            </div>
                            <div className="flex-1">
                              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors[`channel_${index}_account_name`] ? 'text-red-600' : 'text-gray-600'}`}>
                                Название аккаунта *
                              </label>
                              <input
                                type="text"
                                value={channel.account_name || ''}
                                onChange={(e) => {
                                  const newChannels = [...newUser.buyer_settings.traffic_channels];
                                  newChannels[index].account_name = e.target.value;
                                  setNewUser({
                                    ...newUser,
                                    buyer_settings: {
                                      ...newUser.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                  clearMessages();
                                }}
                                className={`w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-colors ${
                                  fieldErrors[`channel_${index}_account_name`]
                                    ? 'border-red-500 focus:ring-red-500 bg-red-50'
                                    : 'border-gray-200 focus:ring-blue-500 hover:border-gray-300'
                                }`}
                                placeholder="VL46 Akk1.1"
                              />
                            </div>
                          </div>

                          {/* Строка 3: Даты доступа */}
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                <Calendar className="inline h-3 w-3 mr-1" />
                                Доступ с
                              </label>
                              <input
                                type="date"
                                value={channel.access_granted}
                                onChange={(e) => {
                                  const newChannels = [...newUser.buyer_settings.traffic_channels];
                                  newChannels[index].access_granted = e.target.value;
                                  setNewUser({
                                    ...newUser,
                                    buyer_settings: {
                                      ...newUser.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm hover:border-gray-300 transition-colors"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                <Calendar className="inline h-3 w-3 mr-1" />
                                Доступ до
                              </label>
                              <input
                                type="date"
                                value={channel.access_limited || ''}
                                onChange={(e) => {
                                  const newChannels = [...newUser.buyer_settings.traffic_channels];
                                  newChannels[index].access_limited = e.target.value || null;
                                  setNewUser({
                                    ...newUser,
                                    buyer_settings: {
                                      ...newUser.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm hover:border-gray-300 transition-colors"
                                placeholder="Не ограничено"
                              />
                            </div>
                          </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Кнопка добавления канала */}
                  <button
                    type="button"
                    onClick={() => {
                      setNewUser({
                        ...newUser,
                        buyer_settings: {
                          ...newUser.buyer_settings,
                          traffic_channels: [
                            ...newUser.buyer_settings.traffic_channels,
                            {
                              source: 'Facebook',
                              channel_id: '',
                              account_name: '',
                              currency: 'USD',
                              access_granted: getTodayKyiv(),
                              access_limited: null
                            }
                          ]
                        }
                      });
                    }}
                    className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 hover:bg-white hover:border-blue-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    Добавить канал трафика
                  </button>
                </div>
              )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUser({
                    name: '',
                    email: '',
                    password: '',
                    role: 'buyer',
                    team_lead_id: null,
                    team_lead_name: null,
                    buyer_settings: {
                      traffic_channels: []
                    }
                  });
                  clearMessages();
                }}
                disabled={creating}
                className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 transition-all"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateUser}
                disabled={creating || !newUser.name?.trim() || !newUser.email?.trim() || !newUser.password}
                className="px-6 py-2.5 border border-transparent rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Создание...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Создать
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-10 pb-10">
          <div className="relative w-full max-w-2xl mx-4 shadow-2xl rounded-2xl bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900">
                Редактировать пользователя
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                  setEditUserData({
                    id: '',
                    name: '',
                    email: '',
                    password: '',
                    role: 'buyer',
                    is_protected: false,
                    team_lead_id: null,
                    team_lead_name: null,
                    buyer_settings: {
                      traffic_channels: []
                    }
                  });
                  clearMessages();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Messages inside modal */}
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {success && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center">
                  <Check className="h-4 w-4 mr-2 flex-shrink-0" />
                  {success}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${fieldErrors.name ? 'text-red-600' : 'text-gray-700'}`}>
                    Имя пользователя *
                </label>
                <input
                  type="text"
                  value={editUserData.name}
                  onChange={(e) => {
                    setEditUserData({ ...editUserData, name: e.target.value });
                    clearMessages();
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    fieldErrors.name
                      ? 'border-red-500 focus:ring-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Введите имя"
                  maxLength={100}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${fieldErrors.email ? 'text-red-600' : 'text-gray-700'}`}>
                  Email *
                </label>
                <input
                  type="email"
                  value={editUserData.email}
                  onChange={(e) => {
                    setEditUserData({ ...editUserData, email: e.target.value });
                    clearMessages();
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    fieldErrors.email
                      ? 'border-red-500 focus:ring-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="user@example.com"
                  maxLength={200}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Используйте корректный email адрес
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${fieldErrors.password ? 'text-red-600' : 'text-gray-700'}`}>
                  Новый пароль
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editUserData.password}
                    onChange={(e) => {
                      setEditUserData({ ...editUserData, password: e.target.value });
                      clearMessages();
                    }}
                    className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      fieldErrors.password
                        ? 'border-red-500 focus:ring-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="Оставьте пустым, чтобы не менять"
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {editUserData.password ? 'Новый пароль должен содержать минимум 6 символов' : 'Оставьте пустым, если не хотите менять пароль'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Роль
                </label>
                <RoleSelector
                  value={editUserData.role}
                  onChange={(newRole) => {
                    setEditUserData({ ...editUserData, role: newRole });
                    clearMessages();
                  }}
                  roles={roles}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-left hover:border-gray-300 transition-colors"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {roles.find(r => r.code === editUserData.role)?.description || 'Выберите роль'}
                </p>
              </div>

              {/* Отдел для Team Lead */}
              {editUserData.role === 'teamlead' && (
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${fieldErrors.department ? 'text-red-600' : 'text-gray-700'}`}>
                    Отдел *
                  </label>
                  <input
                    type="text"
                    value={editUserData.department}
                    onChange={(e) => {
                      setEditUserData({ ...editUserData, department: e.target.value });
                      clearMessages();
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      fieldErrors.department
                        ? 'border-red-500 focus:ring-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="Например: Media Buying, Design, Content"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Название отдела, которым руководит Team Lead
                  </p>
                </div>
              )}

              {/* Выбор Team Lead (только для не-тимлидов) */}
              {editUserData.role !== 'teamlead' && (
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${fieldErrors.team_lead_id ? 'text-red-600' : 'text-gray-700'}`}>
                    Team Lead *
                  </label>
                  <TeamLeadSelector
                    value={editUserData.team_lead_id}
                    onChange={(selectedId, selectedName) => {
                      setEditUserData({
                        ...editUserData,
                        team_lead_id: selectedId,
                        team_lead_name: selectedName
                      });
                      clearMessages();
                    }}
                    teamLeads={teamLeads}
                    className={`w-full px-3 py-2.5 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm text-left hover:border-gray-300 transition-colors ${
                      fieldErrors.team_lead_id
                        ? 'border-red-500 focus:ring-red-500 bg-red-50'
                        : 'border-gray-200 focus:ring-blue-500'
                    }`}
                  />
                  {/* Показываем отдел выбранного Team Lead */}
                  {editUserData.team_lead_id && (() => {
                    const selectedTL = teamLeads.find(tl => tl.id === editUserData.team_lead_id);
                    return selectedTL?.department ? (
                      <div className="mt-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="text-xs text-gray-400">Отдел</div>
                        <div className="text-sm text-gray-700 font-medium">{selectedTL.department}</div>
                      </div>
                    ) : null;
                  })()}
                  <p className="mt-1 text-xs text-gray-500">
                    Выберите Team Lead, к которому привязан пользователь
                  </p>
                </div>
              )}

              {/* Отдел */}
              {isFullAdmin && departments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">
                    Отдел
                  </label>
                  <DepartmentSelector
                    value={editUserData.department_id}
                    onChange={(deptId) => {
                      setEditUserData({ ...editUserData, department_id: deptId });
                      clearMessages();
                    }}
                    departments={departments}
                    disabled={!canChangeDepartment(editingUser)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-left hover:border-gray-300 transition-colors"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Отдел, к которому принадлежит пользователь
                  </p>
                </div>
              )}

              {/* Права доступа (Permissions Matrix) */}
              {isFullAdmin && (
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Дополнительные права доступа
                  </h4>
                  <PermissionsMatrix
                    permissions={editUserData.custom_permissions}
                    onChange={(newPermissions) => {
                      setEditUserData({ ...editUserData, custom_permissions: newPermissions });
                    }}
                    rolePermissions={rolePermissions}
                    disabled={!canEditUser(editingUser)}
                    showRolePermissions={rolePermissions.length > 0}
                  />
                </div>
              )}

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editUserData.is_protected}
                    onChange={(e) => {
                      setEditUserData({ ...editUserData, is_protected: e.target.checked });
                      clearMessages();
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    Защитить от удаления и редактирования
                  </span>
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Защищенные пользователи не могут быть отредактированы или удалены другими администраторами
                </p>
              </div>

              {/* Дополнительные поля для Media Buyer */}
              {editUserData.role === 'buyer' && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-900">
                      Каналы трафика
                    </h4>
                    <span className="text-xs text-gray-500">
                      {editUserData.buyer_settings.traffic_channels.length} {editUserData.buyer_settings.traffic_channels.length === 1 ? 'канал' : editUserData.buyer_settings.traffic_channels.length < 5 ? 'канала' : 'каналов'}
                    </span>
                  </div>

                  {/* Список каналов */}
                  {editUserData.buyer_settings.traffic_channels.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {sortChannelsByExpiration(editUserData.buyer_settings.traffic_channels).map((channel, sortedIndex) => {
                        const originalIndex = editUserData.buyer_settings.traffic_channels.findIndex(c => c === channel);
                        const index = originalIndex !== -1 ? originalIndex : sortedIndex;
                        const expired = isChannelExpired(channel.access_limited);
                        const daysExpired = getDaysExpired(channel.access_limited);
                        const daysActive = getDaysActive(channel.access_granted, expired ? channel.access_limited : null);

                        return (
                        <div key={index} className={`relative border rounded-xl shadow-sm transition-shadow overflow-hidden ${
                          expired
                            ? 'bg-gray-50 border-gray-300 opacity-75'
                            : 'bg-white border-gray-200 hover:shadow-md'
                        }`}>
                          {/* Заголовок карточки с плашкой статуса */}
                          <div className={`flex items-center justify-between px-4 py-2 ${
                            expired ? 'bg-red-50 border-b border-red-100' : 'bg-green-50 border-b border-green-100'
                          }`}>
                            <div className="flex items-center gap-2">
                              {expired ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                  Неактивен {daysExpired} {pluralizeDays(daysExpired)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                  Активен {daysActive} {pluralizeDays(daysActive)}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newChannels = editUserData.buyer_settings.traffic_channels.filter((_, i) => i !== index);
                                setEditUserData({
                                  ...editUserData,
                                  buyer_settings: {
                                    ...editUserData.buyer_settings,
                                    traffic_channels: newChannels
                                  }
                                });
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Удалить канал"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Содержимое карточки */}
                          <div className="p-4">
                            {/* Строка 1: Источник + Валюта */}
                            <div className="flex gap-3 mb-3">
                              <div className="flex-1">
                                <label className={`block text-xs font-medium mb-1.5 ${fieldErrors[`channel_${index}_source`] ? 'text-red-600' : 'text-gray-600'}`}>
                                  Источник *
                                </label>
                                <SourceSelector
                                value={channel.source || 'Facebook'}
                                onChange={(newSource) => {
                                  const newChannels = [...editUserData.buyer_settings.traffic_channels];
                                  newChannels[index].source = newSource;
                                  setEditUserData({
                                    ...editUserData,
                                    buyer_settings: {
                                      ...editUserData.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                  clearMessages();
                                }}
                                className={`w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm text-left transition-colors ${
                                  fieldErrors[`channel_${index}_source`]
                                    ? 'border-red-500 focus:ring-red-500 bg-red-50'
                                    : 'border-gray-200 focus:ring-blue-500 hover:border-gray-300'
                                }`}
                              />
                            </div>
                            <div className="w-28">
                              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors[`channel_${index}_currency`] ? 'text-red-600' : 'text-gray-600'}`}>
                                Валюта *
                              </label>
                              <CurrencySelector
                                value={channel.currency}
                                onChange={(newCurrency) => {
                                  const newChannels = [...editUserData.buyer_settings.traffic_channels];
                                  newChannels[index].currency = newCurrency;
                                  setEditUserData({
                                    ...editUserData,
                                    buyer_settings: {
                                      ...editUserData.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                  clearMessages();
                                }}
                                className={`w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm text-left transition-colors ${
                                  fieldErrors[`channel_${index}_currency`]
                                    ? 'border-red-500 focus:ring-red-500 bg-red-50'
                                    : 'border-gray-200 focus:ring-blue-500 hover:border-gray-300'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Строка 2: ID канала + Название аккаунта */}
                          <div className="flex gap-3 mb-3">
                            <div className="flex-1">
                              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors[`channel_${index}_channel_id`] ? 'text-red-600' : 'text-gray-600'}`}>
                                ID канала *
                              </label>
                              <input
                                type="text"
                                value={channel.channel_id}
                                onChange={(e) => {
                                  const newChannels = [...editUserData.buyer_settings.traffic_channels];
                                  newChannels[index].channel_id = e.target.value;
                                  setEditUserData({
                                    ...editUserData,
                                    buyer_settings: {
                                      ...editUserData.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                  clearMessages();
                                }}
                                className={`w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-colors ${
                                  fieldErrors[`channel_${index}_channel_id`]
                                    ? 'border-red-500 focus:ring-red-500 bg-red-50'
                                    : 'border-gray-200 focus:ring-blue-500 hover:border-gray-300'
                                }`}
                                placeholder="654cb443baf00b..."
                              />
                            </div>
                            <div className="flex-1">
                              <label className={`block text-xs font-medium mb-1.5 ${fieldErrors[`channel_${index}_account_name`] ? 'text-red-600' : 'text-gray-600'}`}>
                                Название аккаунта *
                              </label>
                              <input
                                type="text"
                                value={channel.account_name || ''}
                                onChange={(e) => {
                                  const newChannels = [...editUserData.buyer_settings.traffic_channels];
                                  newChannels[index].account_name = e.target.value;
                                  setEditUserData({
                                    ...editUserData,
                                    buyer_settings: {
                                      ...editUserData.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                  clearMessages();
                                }}
                                className={`w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-colors ${
                                  fieldErrors[`channel_${index}_account_name`]
                                    ? 'border-red-500 focus:ring-red-500 bg-red-50'
                                    : 'border-gray-200 focus:ring-blue-500 hover:border-gray-300'
                                }`}
                                placeholder="VL46 Akk1.1"
                              />
                            </div>
                          </div>

                          {/* Строка 3: Даты доступа */}
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                <Calendar className="inline h-3 w-3 mr-1" />
                                Доступ с
                              </label>
                              <input
                                type="date"
                                value={channel.access_granted}
                                onChange={(e) => {
                                  const newChannels = [...editUserData.buyer_settings.traffic_channels];
                                  newChannels[index].access_granted = e.target.value;
                                  setEditUserData({
                                    ...editUserData,
                                    buyer_settings: {
                                      ...editUserData.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm hover:border-gray-300 transition-colors"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                <Calendar className="inline h-3 w-3 mr-1" />
                                Доступ до
                              </label>
                              <input
                                type="date"
                                value={channel.access_limited || ''}
                                onChange={(e) => {
                                  const newChannels = [...editUserData.buyer_settings.traffic_channels];
                                  newChannels[index].access_limited = e.target.value || null;
                                  setEditUserData({
                                    ...editUserData,
                                    buyer_settings: {
                                      ...editUserData.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm hover:border-gray-300 transition-colors"
                                placeholder="Не ограничено"
                              />
                            </div>
                          </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Кнопка добавления канала */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditUserData({
                        ...editUserData,
                        buyer_settings: {
                          ...editUserData.buyer_settings,
                          traffic_channels: [
                            ...editUserData.buyer_settings.traffic_channels,
                            {
                              source: 'Facebook',
                              channel_id: '',
                              account_name: '',
                              currency: 'USD',
                              access_granted: getTodayKyiv(),
                              access_limited: null
                            }
                          ]
                        }
                      });
                    }}
                    className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 hover:bg-white hover:border-blue-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    Добавить канал трафика
                  </button>
                </div>
              )}

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Info className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-900">
                      Текущие данные
                    </h3>
                    <div className="mt-2 text-sm text-blue-700 space-y-1">
                      <p><span className="font-medium">Email:</span> {editingUser.email}</p>
                      <p><span className="font-medium">Роль:</span> {getRoleDisplayName(editingUser.role)}</p>
                      <p><span className="font-medium">Создан:</span> {formatKyivTime(editingUser.created_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                  setEditUserData({
                    id: '',
                    name: '',
                    email: '',
                    password: '',
                    role: 'buyer',
                    is_protected: false,
                    team_lead_id: null,
                    team_lead_name: null,
                    buyer_settings: {
                      traffic_channels: []
                    }
                  });
                  clearMessages();
                }}
                disabled={updating}
                className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 transition-all"
              >
                Отмена
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={updating || !editUserData.name?.trim() || !editUserData.email?.trim()}
                className="px-6 py-2.5 border border-transparent rounded-xl text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md flex items-center gap-2"
              >
                {updating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Сохранить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

    </div>
  );
}

export default UserManagement;
