import React, { useState, useEffect } from 'react';
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
  RotateCcw
} from 'lucide-react';

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

function UserManagement({ user }) {
  const [users, setUsers] = useState([]);
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

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'buyer',
    buyer_settings: {
      traffic_channels: [
        {
          channel_id: '',
          currency: 'USD',
          access_granted: '2020-01-01',
          access_limited: null
        }
      ]
    }
  });

  const [editUserData, setEditUserData] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    role: 'buyer',
    is_protected: false,
    buyer_settings: {
      traffic_channels: [
        {
          channel_id: '',
          currency: 'USD',
          access_granted: '2020-01-01',
          access_limited: null
        }
      ]
    }
  });

  useEffect(() => {
    loadUsers();
  }, [showArchived]); // Перезагружаем при переключении архива

  const loadUsers = async () => {
    try {
      setLoading(true);
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


  const validateUserData = (userData, isEdit = false) => {
    if (!userData.name?.trim()) {
      setError('Имя пользователя обязательно для заполнения');
      return false;
    }

    if (!userData.email?.trim()) {
      setError('Email адрес обязателен для заполнения');
      return false;
    }

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email.trim())) {
      setError('Введите корректный email адрес (например: user@example.com)');
      return false;
    }

    // Для создания пароль обязателен, для редактирования - нет
    if (!isEdit && (!userData.password || userData.password.length < 6)) {
      setError('Пароль должен содержать минимум 6 символов');
      return false;
    }

    // Для редактирования проверяем пароль только если он указан
    if (isEdit && userData.password && userData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
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
      setError('Пользователь с таким email уже существует');
      return false;
    }

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
      const userData = {
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role,
        created_by_id: user.id,
        created_by_name: user.name || user.email
      };

      // Добавляем buyer_settings только для Media Buyer
      if (newUser.role === 'buyer') {
        // Фильтруем пустые ID каналов и форматируем данные
        const validChannels = newUser.buyer_settings.traffic_channels
          .filter(channel => channel.channel_id.trim())
          .map(channel => ({
            channel_id: channel.channel_id.trim(),
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
        buyer_settings: {
          traffic_channels: [
            {
              channel_id: '',
              currency: 'USD',
              access_granted: '2020-01-01',
              access_limited: null
            }
          ]
        }
      });
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
              buyer_settings: {
                traffic_channel_ids: [''],
                currency: 'USD',
                access_granted: '2020-01-01',
                access_limited: null
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

  const handleEditUser = (userToEdit) => {
    // Запрещаем редактирование защищенных пользователей
    if (userToEdit.is_protected) {
      setError('Редактирование защищенного пользователя запрещено');
      return;
    }

    setEditingUser(userToEdit);

    // Загружаем buyer_settings если пользователь - Media Buyer
    const buyerSettings = userToEdit.role === 'buyer' && userToEdit.buyer_settings
      ? {
          traffic_channels: userToEdit.buyer_settings.traffic_channels?.length > 0
            ? userToEdit.buyer_settings.traffic_channels
            : [
                {
                  channel_id: '',
                  currency: 'USD',
                  access_granted: '2020-01-01',
                  access_limited: null
                }
              ]
        }
      : {
          traffic_channels: [
            {
              channel_id: '',
              currency: 'USD',
              access_granted: '2020-01-01',
              access_limited: null
            }
          ]
        };

    setEditUserData({
      id: userToEdit.id,
      name: userToEdit.name || '',
      email: userToEdit.email || '',
      password: '', // Пароль всегда пустой для безопасности
      role: userToEdit.role || 'buyer',
      is_protected: userToEdit.is_protected || false,
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
      const updateData = {
        id: editUserData.id,
        name: editUserData.name.trim(),
        email: editUserData.email.trim(),
        password: editUserData.password || undefined, // Только если пароль указан
        role: editUserData.role,
        is_protected: editUserData.is_protected
      };

      // Добавляем buyer_settings только для Media Buyer
      if (editUserData.role === 'buyer') {
        // Фильтруем пустые ID каналов и форматируем данные
        const validChannels = editUserData.buyer_settings.traffic_channels
          .filter(channel => channel.channel_id.trim())
          .map(channel => ({
            channel_id: channel.channel_id.trim(),
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
        buyer_settings: {
          traffic_channels: [
            {
              channel_id: '',
              currency: 'USD',
              access_granted: '2020-01-01',
              access_limited: null
            }
          ]
        }
      });
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
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
              Управление пользователями
              {showArchived && (
                <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                  <Archive className="h-4 w-4 mr-1" />
                  Архив
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {showArchived
                ? 'Архивированные пользователи - восстановите при необходимости'
                : 'Создание и управление аккаунтами байеров и монтажеров'
              }
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setShowArchived(!showArchived);
                clearMessages();
              }}
              className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                showArchived
                  ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              {showArchived ? (
                <>
                  <User className="h-4 w-4 mr-2" />
                  Активные
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Архив
                </>
              )}
            </button>

            <button
              onClick={loadUsers}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </button>

            {!showArchived && (
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Создатель
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((currentUser) => {
                      const isTeamLead = currentUser.role === 'teamlead';
                      return (
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
                                  {currentUser.is_protected && (
                                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      Защищен
                                    </span>
                                  )}
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-6 w-6">
                                <Shield className="h-4 w-4 text-gray-400" />
                              </div>
                              <div className="ml-2">
                                <div className="text-sm text-gray-900">
                                  {currentUser.created_by_name || 'Система'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              {showArchived ? (
                                // Кнопка восстановления для архивированных пользователей
                                <button
                                  onClick={() => handleRestoreUser(currentUser.id, currentUser.name)}
                                  disabled={restoring === currentUser.id}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                                  title="Восстановить пользователя"
                                >
                                  {restoring === currentUser.id ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                      Восстановление...
                                    </>
                                  ) : (
                                    <>
                                      <RotateCcw className="h-4 w-4 mr-1" />
                                      Восстановить
                                    </>
                                  )}
                                </button>
                              ) : (
                                // Кнопки редактирования и удаления для активных пользователей
                                <>
                                  <button
                                    onClick={() => handleEditUser(currentUser)}
                                    disabled={currentUser.is_protected}
                                    className={`p-2 ${currentUser.is_protected
                                      ? 'text-gray-400 cursor-not-allowed'
                                      : 'text-blue-600 hover:text-blue-900'
                                    }`}
                                    title={currentUser.is_protected ? "Пользователь защищен от редактирования" : "Редактировать пользователя"}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(currentUser.id, currentUser.name, currentUser.role, currentUser.is_protected)}
                                    disabled={deleting === currentUser.id || currentUser.is_protected}
                                    className={`p-2 ${currentUser.is_protected
                                      ? 'text-gray-400 cursor-not-allowed'
                                      : 'text-red-600 hover:text-red-900'
                                    } disabled:opacity-50`}
                                    title={currentUser.is_protected ? "Пользователь защищен от удаления" : "Архивировать пользователя"}
                                  >
                                    {deleting === currentUser.id ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                    ) : (
                                      <Archive className="h-4 w-4" />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
          <div className="relative top-20 mx-auto p-5 border w-[700px] shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Создать нового пользователя
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUser({
                    name: '',
                    email: '',
                    password: '',
                    role: 'buyer',
                    buyer_settings: {
                      traffic_channel_ids: [''],
                      currency: 'USD',
                      access_granted: '2020-01-01',
                      access_limited: null
                    }
                  });
                  clearMessages();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Messages inside modal */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-start">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm flex items-center">
                <Check className="h-4 w-4 mr-2 flex-shrink-0" />
                {success}
              </div>
            )}

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
                  <option value="buyer">Media Buyer</option>
                  <option value="editor">Video Designer</option>
                  <option value="designer">Designer</option>
                  <option value="search_manager">Search Manager</option>
                  <option value="content_manager">Content Manager</option>
                  <option value="product_manager">Product Manager</option>
                  <option value="proofreader">Editor</option>
                  <option value="gif_creator">GIF Creator</option>
                  <option value="teamlead">Team Lead</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {newUser.role === 'buyer' && 'Доступ к рабочим таблицам'}
                  {newUser.role === 'editor' && 'Доступ к управлению креативами'}
                  {newUser.role === 'designer' && 'Доступ к дизайну и креативам'}
                  {newUser.role === 'search_manager' && 'Доступ к поисковым кампаниям'}
                  {newUser.role === 'content_manager' && 'Доступ к управлению контентом'}
                  {newUser.role === 'product_manager' && 'Доступ к управлению продуктами'}
                  {newUser.role === 'proofreader' && 'Доступ к редактированию контента'}
                  {newUser.role === 'gif_creator' && 'Доступ к созданию GIF-файлов'}
                  {newUser.role === 'teamlead' && 'Полный доступ ко всем функциям'}
                </p>
              </div>

              {/* Дополнительные поля для Media Buyer */}
              {newUser.role === 'buyer' && (
                <>
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Настройки Media Buyer
                    </h4>

                    {/* Каналы трафика */}
                    <div className="space-y-4 mb-4">
                      {newUser.buyer_settings.traffic_channels.map((channel, index) => (
                        <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">
                              Канал #{index + 1}
                            </span>
                            {newUser.buyer_settings.traffic_channels.length > 1 && (
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
                                className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {/* ID канала */}
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                ID канала трафика *
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
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="Введите ID канала"
                              />
                            </div>

                            {/* Валюта */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Валюта
                              </label>
                              <select
                                value={channel.currency}
                                onChange={(e) => {
                                  const newChannels = [...newUser.buyer_settings.traffic_channels];
                                  newChannels[index].currency = e.target.value;
                                  setNewUser({
                                    ...newUser,
                                    buyer_settings: {
                                      ...newUser.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              >
                                <option value="USD">$ USD</option>
                                <option value="EUR">€ EUR</option>
                                <option value="UAH">₴ UAH</option>
                              </select>
                            </div>

                            {/* Доступ предоставлен */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              />
                            </div>

                            {/* Доступ ограничен */}
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Доступ до (опционально)
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Оставьте пустым для неограниченного доступа
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Кнопка добавления канала внизу */}
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
                                channel_id: '',
                                currency: 'USD',
                                access_granted: '2020-01-01',
                                access_limited: null
                              }
                            ]
                          }
                        });
                      }}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить канал
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUser({
                    name: '',
                    email: '',
                    password: '',
                    role: 'buyer',
                    buyer_settings: {
                      traffic_channel_ids: [''],
                      currency: 'USD',
                      access_granted: '2020-01-01',
                      access_limited: null
                    }
                  });
                  clearMessages();
                }}
                disabled={creating}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateUser}
                disabled={creating || !newUser.name?.trim() || !newUser.email?.trim() || !newUser.password}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Создание...
                  </>
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

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-[700px] shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
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
                    buyer_settings: {
                      traffic_channel_ids: [''],
                      currency: 'USD',
                      access_granted: '2020-01-01',
                      access_limited: null
                    }
                  });
                  clearMessages();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Messages inside modal */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-start">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm flex items-center">
                <Check className="h-4 w-4 mr-2 flex-shrink-0" />
                {success}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя пользователя *
                </label>
                <input
                  type="text"
                  value={editUserData.name}
                  onChange={(e) => {
                    setEditUserData({ ...editUserData, name: e.target.value });
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
                  value={editUserData.email}
                  onChange={(e) => {
                    setEditUserData({ ...editUserData, email: e.target.value });
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
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Оставьте пустым, чтобы не менять"
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
                  {editUserData.password ? 'Новый пароль должен содержать минимум 6 символов' : 'Оставьте пустым, если не хотите менять пароль'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Роль
                </label>
                <select
                  value={editUserData.role}
                  onChange={(e) => {
                    setEditUserData({ ...editUserData, role: e.target.value });
                    clearMessages();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="buyer">Media Buyer</option>
                  <option value="editor">Video Designer</option>
                  <option value="designer">Designer</option>
                  <option value="search_manager">Search Manager</option>
                  <option value="content_manager">Content Manager</option>
                  <option value="product_manager">Product Manager</option>
                  <option value="proofreader">Editor</option>
                  <option value="gif_creator">GIF Creator</option>
                  <option value="teamlead">Team Lead</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {editUserData.role === 'buyer' && 'Доступ к рабочим таблицам'}
                  {editUserData.role === 'editor' && 'Доступ к управлению креативами'}
                  {editUserData.role === 'designer' && 'Доступ к дизайну и креативам'}
                  {editUserData.role === 'search_manager' && 'Доступ к поисковым кампаниям'}
                  {editUserData.role === 'content_manager' && 'Доступ к управлению контентом'}
                  {editUserData.role === 'product_manager' && 'Доступ к управлению продуктами'}
                  {editUserData.role === 'proofreader' && 'Доступ к редактированию контента'}
                  {editUserData.role === 'gif_creator' && 'Доступ к созданию GIF-файлов'}
                  {editUserData.role === 'teamlead' && 'Полный доступ ко всем функциям'}
                </p>
              </div>

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
                <>
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Настройки Media Buyer
                    </h4>

                    {/* Каналы трафика */}
                    <div className="space-y-4 mb-4">
                      {editUserData.buyer_settings.traffic_channels.map((channel, index) => (
                        <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">
                              Канал #{index + 1}
                            </span>
                            {editUserData.buyer_settings.traffic_channels.length > 1 && (
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
                                className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {/* ID канала */}
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                ID канала трафика *
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
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="Введите ID канала"
                              />
                            </div>

                            {/* Валюта */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Валюта
                              </label>
                              <select
                                value={channel.currency}
                                onChange={(e) => {
                                  const newChannels = [...editUserData.buyer_settings.traffic_channels];
                                  newChannels[index].currency = e.target.value;
                                  setEditUserData({
                                    ...editUserData,
                                    buyer_settings: {
                                      ...editUserData.buyer_settings,
                                      traffic_channels: newChannels
                                    }
                                  });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              >
                                <option value="USD">$ USD</option>
                                <option value="EUR">€ EUR</option>
                                <option value="UAH">₴ UAH</option>
                              </select>
                            </div>

                            {/* Доступ предоставлен */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              />
                            </div>

                            {/* Доступ ограничен */}
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Доступ до (опционально)
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Оставьте пустым для неограниченного доступа
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Кнопка добавления канала внизу */}
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
                                channel_id: '',
                                currency: 'USD',
                                access_granted: '2020-01-01',
                                access_limited: null
                              }
                            ]
                          }
                        });
                      }}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить канал
                    </button>
                  </div>
                </>
              )}

              <div className="bg-blue-50 p-3 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Info className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Текущие данные:
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p><strong>Email:</strong> {editingUser.email}</p>
                      <p><strong>Роль:</strong> {getRoleDisplayName(editingUser.role)}</p>
                      <p><strong>Создан:</strong> {formatKyivTime(editingUser.created_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
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
                    buyer_settings: {
                      traffic_channel_ids: [''],
                      currency: 'USD',
                      access_granted: '2020-01-01',
                      access_limited: null
                    }
                  });
                  clearMessages();
                }}
                disabled={updating}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={updating || !editUserData.name?.trim() || !editUserData.email?.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {updating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Сохранить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default UserManagement;
