import React, { useState, useEffect } from 'react';
import { userService } from '../supabaseClient';
import {
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Users,
  Shield,
  User,
  X,
  Check,
  Eye,
  EyeOff,
  Monitor,
  Video,
  Settings,
  Info
} from 'lucide-react';

function UserManagement({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfigInfo, setShowConfigInfo] = useState(false);
  const [supabaseConfig, setSupabaseConfig] = useState(null);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'buyer'
  });

  useEffect(() => {
    loadUsers();
    checkSupabaseConfiguration();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersData = await userService.getAllUsers();
      // Исключаем тимлидов из списка для отображения
      const filteredUsers = usersData.filter(u => u.role !== 'teamlead');
      setUsers(filteredUsers);
    } catch (error) {
      setError('Ошибка загрузки пользователей: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkSupabaseConfiguration = async () => {
    try {
      const config = await userService.checkSupabaseConfig();
      setSupabaseConfig(config);
      console.log('🔧 Конфигурация Supabase:', config);
    } catch (error) {
      console.error('Ошибка проверки конфигурации:', error);
    }
  };

  const validateUserData = () => {
    if (!newUser.name?.trim()) {
      setError('Имя пользователя обязательно для заполнения');
      return false;
    }

    if (!newUser.email?.trim()) {
      setError('Email адрес обязателен для заполнения');
      return false;
    }

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email.trim())) {
      setError('Введите корректный email адрес (например: user@example.com)');
      return false;
    }

    if (!newUser.password || newUser.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return false;
    }

    // Проверка на существующий email
    const existingUser = users.find(u => u.email.toLowerCase() === newUser.email.trim().toLowerCase());
    if (existingUser) {
      setError('Пользователь с таким email уже существует');
      return false;
    }

    return true;
  };

  const handleCreateUser = async () => {
    if (!validateUserData()) {
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

      await userService.createUser({
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role
      });

      // Очищаем форму и закрываем модал
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'buyer'
      });
      setShowCreateModal(false);

      // Обновляем список пользователей
      await loadUsers();
      
      setSuccess(`Пользователь "${newUser.name.trim()}" успешно создан`);

    } catch (error) {
      console.error('❌ Ошибка создания пользователя:', error);
      
      // Улучшенная обработка различных типов ошибок
      let errorMessage = 'Неизвестная ошибка создания пользователя';
      
      if (error.message) {
        if (error.message.includes('Email address') && error.message.includes('invalid')) {
          errorMessage = `Неверный формат email адреса "${newUser.email}". Проверьте правильность введенного email.`;
        } else if (error.message.includes('signup is disabled')) {
          errorMessage = 'Регистрация новых пользователей отключена в настройках Supabase. Обратитесь к системному администратору.';
        } else if (error.message.includes('email confirmation')) {
          errorMessage = 'В Supabase включено обязательное подтверждение email. Необходимо настроить систему или использовать админ API.';
        } else if (error.message.includes('User already registered')) {
          errorMessage = `Пользователь с email "${newUser.email}" уже зарегистрирован в системе.`;
        } else if (error.message.includes('password')) {
          errorMessage = 'Ошибка с паролем. Убедитесь, что пароль содержит минимум 6 символов.';
        } else {
          errorMessage = `Ошибка создания пользователя: ${error.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Вы уверены, что хотите удалить пользователя "${userName}"?\n\nЭто действие нельзя отменить. Все данные пользователя (таблицы, креативы) будут удалены.`)) {
      return;
    }

    try {
      setDeleting(userId);
      setError('');
      await userService.deleteUser(userId);
      await loadUsers();
      setSuccess(`Пользователь "${userName}" успешно удален`);
    } catch (error) {
      setError('Ошибка удаления пользователя: ' + error.message);
    } finally {
      setDeleting(null);
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

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'buyer':
        return 'Байер';
      case 'editor':
        return 'Монтажер';
      case 'teamlead':
        return 'Тим лид';
      default:
        return 'Пользователь';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'buyer':
        return <Users className="h-6 w-6 text-blue-600" />;
      case 'editor':
        return <Monitor className="h-6 w-6 text-purple-600" />;
      case 'teamlead':
        return <Shield className="h-6 w-6 text-green-600" />;
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
      case 'teamlead':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserStats = () => {
    const buyersCount = users.filter(u => u.role === 'buyer').length;
    const editorsCount = users.filter(u => u.role === 'editor').length;
    return { buyersCount, editorsCount };
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const { buyersCount, editorsCount } = getUserStats();

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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Управление пользователями
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Создание и удаление аккаунтов байеров и монтажеров
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowConfigInfo(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Settings className="h-4 w-4 mr-2" />
              Настройки
            </button>
            
            <button
              onClick={loadUsers}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
            
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
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-start">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm flex items-center">
          <Check className="h-4 w-4 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Config Warning */}
      {supabaseConfig && !supabaseConfig.signUpEnabled && (
        <div className="mx-6 mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm flex items-start">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Внимание:</strong> Регистрация новых пользователей отключена в настройках Supabase. 
            Для создания пользователей необходимо настроить аутентификацию в панели Supabase или добавить Service Role Key.
            <button 
              onClick={() => setShowConfigInfo(true)}
              className="ml-2 underline hover:no-underline"
            >
              Подробнее
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Байеров
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
                  <Monitor className="h-8 w-8 text-purple-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Монтажеров
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
                  <Shield className="h-8 w-8 text-green-500" />
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

        {/* Users List */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Список пользователей
            </h3>

            {users.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Пользователи не найдены</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Создать первого пользователя
                </button>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Пользователь
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Роль
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Создан
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((currentUser) => (
                      <tr key={currentUser.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center">
                                {currentUser.avatar_url ? (
                                  <img
                                    src={currentUser.avatar_url}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className={`w-full h-full flex items-center justify-center ${currentUser.avatar_url ? 'hidden' : ''}`}>
                                  {getRoleIcon(currentUser.role)}
                                </div>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {currentUser.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{currentUser.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(currentUser.role)}`}>
                            {getRoleDisplayName(currentUser.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatKyivTime(currentUser.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDeleteUser(currentUser.id, currentUser.name)}
                            disabled={deleting === currentUser.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 p-2"
                            title="Удалить пользователя"
                          >
                            {deleting === currentUser.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Создать нового пользователя
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  clearMessages();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя пользователя *
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => {
                    setNewUser({ ...newUser, name: e.target.value });
                    clearMessages();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Введите имя"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => {
                    setNewUser({ ...newUser, email: e.target.value });
                    clearMessages();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@example.com"
                  maxLength={200}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Используйте корректный email адрес
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Минимум 6 символов"
                    minLength={6}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Роль
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => {
                    setNewUser({ ...newUser, role: e.target.value });
                    clearMessages();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="buyer">Байер</option>
                  <option value="editor">Монтажер</option>
                  <option value="teamlead">Тим лид</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {newUser.role === 'buyer' && 'Доступ к рабочим таблицам'}
                  {newUser.role === 'editor' && 'Доступ к управлению креативами'}
                  {newUser.role === 'teamlead' && 'Полный доступ ко всем функциям'}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  clearMessages();
                }}
                disabled={creating}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateUser}
                disabled={creating || !newUser.name?.trim() || !newUser.email?.trim() || !newUser.password}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {creating ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Создание...
                  </div>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Создать
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Info Modal */}
      {showConfigInfo && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white m-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Настройки Supabase Auth
              </h3>
              <button
                onClick={() => setShowConfigInfo(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {supabaseConfig && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium text-gray-900 mb-3">Текущая конфигурация:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Регистрация пользователей:</span>
                      <span className={supabaseConfig.signUpEnabled ? 'text-green-600' : 'text-red-600'}>
                        {supabaseConfig.signUpEnabled ? '✅ Включена' : '❌ Отключена'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Подтверждение email:</span>
                      <span className={supabaseConfig.emailConfirmationRequired ? 'text-yellow-600' : 'text-green-600'}>
                        {supabaseConfig.emailConfirmationRequired ? '⚠️ Требуется' : '✅ Не требуется'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Admin API:</span>
                      <span className={supabaseConfig.adminApiAvailable ? 'text-green-600' : 'text-red-600'}>
                        {supabaseConfig.adminApiAvailable ? '✅ Доступен' : '❌ Недоступен'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-md">
                <h4 className="font-medium text-blue-900 mb-3">💡 Как исправить проблемы:</h4>
                <div className="text-sm text-blue-800 space-y-3">
                  <div>
                    <strong>1. Если регистрация отключена:</strong>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      <li>Перейдите в панель Supabase → Authentication → Settings</li>
                      <li>Включите "Enable email confirmations" (если нужно)</li>
                      <li>В разделе "User signup" выберите "Allow new signups"</li>
                    </ul>
                  </div>
                  
                  <div>
                    <strong>2. Если требуется подтверждение email:</strong>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      <li>Отключите "Enable email confirmations" в настройках Authentication</li>
                      <li>Или настройте SMTP для отправки писем подтверждения</li>
                      <li>Или добавьте Service Role Key в переменные окружения</li>
                    </ul>
                  </div>

                  <div>
                    <strong>3. Для использования Admin API:</strong>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      <li>Получите Service Role Key из настроек проекта Supabase</li>
                      <li>Добавьте его в .env как REACT_APP_SUPABASE_SERVICE_ROLE_KEY</li>
                      <li>Перезапустите приложение</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-md">
                <h4 className="font-medium text-yellow-900 mb-2">⚠️ Важно:</h4>
                <p className="text-sm text-yellow-800">
                  Service Role Key дает полный доступ к базе данных. Используйте его только в безопасном окружении 
                  и никогда не коммитьте в публичные репозитории.
                </p>
              </div>

              {supabaseConfig?.error && (
                <div className="bg-red-50 p-4 rounded-md">
                  <h4 className="font-medium text-red-900 mb-2">❌ Последняя ошибка:</h4>
                  <p className="text-sm text-red-800 font-mono">{supabaseConfig.error}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowConfigInfo(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
