import React, { useState, useEffect } from 'react';
import { supabase, userService } from '../supabaseClient';
import { 
  Save, 
  User, 
  Mail, 
  Shield, 
  Key, 
  AlertCircle, 
  CheckCircle,
  Eye,
  EyeOff,
  Upload,
  Camera,
  Trash2
} from 'lucide-react';

function Settings({ user, updateUser }) {
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    avatar_url: user?.avatar_url || ''
  });

  // Обновляем profileData когда user изменяется
  React.useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        avatar_url: user.avatar_url || ''
      });
    }
  }, [user]);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Проверяем, является ли пользователь с ограниченными правами
  const isLimitedUser = user?.role === 'editor' || user?.role === 'designer' || user?.role === 'buyer' || user?.role === 'search_manager' || user?.role === 'content_manager';

  const handleProfileUpdate = async () => {
    if (!profileData.name) {
      setError('Имя пользователя обязательно для заполнения');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const updatedUser = await userService.updateUserProfile(user.id, {
        name: profileData.name
      });

      // Обновляем состояние пользователя в App
      if (updateUser) {
        updateUser({ ...user, name: profileData.name });
      }

      setSuccess('Профиль успешно обновлен');
    } catch (error) {
      setError('Ошибка обновления профиля: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (files) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    // Проверяем размер файла (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не должен превышать 5MB');
      return;
    }

    try {
      setAvatarLoading(true);
      setError('');

      const updatedUser = await userService.uploadAvatar(user.id, file);
      
      setProfileData({
        ...profileData,
        avatar_url: updatedUser.avatar_url
      });

      // Обновляем состояние пользователя в App
      if (updateUser) {
        updateUser({ ...user, avatar_url: updatedUser.avatar_url });
      }

      setSuccess('Аватар успешно обновлен');
    } catch (error) {
      setError('Ошибка загрузки аватара: ' + error.message);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить аватар?')) {
      return;
    }

    try {
      setAvatarLoading(true);
      setError('');

      await userService.updateUserProfile(user.id, {
        avatar_url: null
      });

      setProfileData({
        ...profileData,
        avatar_url: ''
      });

      // Обновляем состояние пользователя в App
      if (updateUser) {
        updateUser({ ...user, avatar_url: null });
      }

      setSuccess('Аватар удален');
    } catch (error) {
      setError('Ошибка удаления аватара: ' + error.message);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('Все поля для смены пароля обязательны');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Новый пароль и подтверждение не совпадают');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('Новый пароль должен содержать минимум 6 символов');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const { error: passwordError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (passwordError) throw passwordError;

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      setSuccess('Пароль успешно изменен');
    } catch (error) {
      setError('Ошибка смены пароля: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Функция для форматирования времени по киевскому часовому поясу
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

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Настройки</h1>
          <p className="text-sm text-gray-600 mt-1">
            {isLimitedUser ? 'Управление фото профиля' : 'Управление профилем и настройками аккаунта'}
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            {success}
          </div>
        )}

        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Фото профиля
              </h3>
              
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                    {profileData.avatar_url ? (
                      <img
                        src={profileData.avatar_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center ${profileData.avatar_url ? 'hidden' : ''}`}>
                      <User className="h-12 w-12 text-gray-400" />
                    </div>
                  </div>
                  
                  {avatarLoading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col space-y-3">
                  <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
                    <Camera className="h-4 w-4 mr-2" />
                    {profileData.avatar_url ? 'Изменить фото' : 'Загрузить фото'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleAvatarUpload(e.target.files)}
                      className="sr-only"
                      disabled={avatarLoading}
                    />
                  </label>

                  {profileData.avatar_url && (
                    <button
                      onClick={handleAvatarDelete}
                      disabled={avatarLoading}
                      className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Удалить фото
                    </button>
                  )}

                  <p className="text-xs text-gray-500">
                    JPG, PNG или GIF. Максимум 5MB.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Settings - только для тим лидов */}
          {!isLimitedUser && (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Информация профиля
                </h3>
                
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="h-4 w-4 inline mr-1" />
                      Имя пользователя
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => {
                        setProfileData({ ...profileData, name: e.target.value });
                        clearMessages();
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Введите ваше имя"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Mail className="h-4 w-4 inline mr-1" />
                      Email адрес
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Email адрес нельзя изменить. Обратитесь к администратору.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Shield className="h-4 w-4 inline mr-1" />
                      Роль
                    </label>
                    <input
                      type="text"
                      value={user?.role === 'teamlead' ? 'Team Lead' : user?.role === 'editor' ? 'Video Designer' : user?.role === 'designer' ? 'Editor' : user?.role === 'buyer' ? 'Media Buyer' : user?.role === 'search_manager' ? 'Search Manager' : 'Content Manager'}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleProfileUpdate}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Сохранить профиль
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Profile Info for Limited Users - только чтение */}
          {isLimitedUser && (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Информация профиля
                </h3>
                
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="h-4 w-4 inline mr-1" />
                      Имя пользователя
                    </label>
                    <input
                      type="text"
                      value={user?.name || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Имя пользователя может изменить только Team Lead.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Mail className="h-4 w-4 inline mr-1" />
                      Email адрес
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Shield className="h-4 w-4 inline mr-1" />
                      Роль
                    </label>
                    <input
                      type="text"
                      value={user?.role === 'teamlead' ? 'Team Lead' : user?.role === 'editor' ? 'Video Designer' : user?.role === 'designer' ? 'Editor' : user?.role === 'buyer' ? 'Media Buyer' : user?.role === 'search_manager' ? 'Search Manager' : 'Content Manager'}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">
                        Ограниченные права доступа
                      </h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>
                          Вы можете изменить только фото профиля. 
                          Для изменения других данных обратитесь к Team Lead.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Password Change - только для тим лидов */}
          {!isLimitedUser && (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Изменение пароля
                </h3>
                
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Текущий пароль
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => {
                          setPasswordData({ ...passwordData, currentPassword: e.target.value });
                          clearMessages();
                        }}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Введите текущий пароль"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Новый пароль
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => {
                          setPasswordData({ ...passwordData, newPassword: e.target.value });
                          clearMessages();
                        }}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Минимум 6 символов"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Подтверждение нового пароля
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => {
                        setPasswordData({ ...passwordData, confirmPassword: e.target.value });
                        clearMessages();
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Повторите новый пароль"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={handlePasswordChange}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Key className="h-4 w-4 mr-2" />
                    )}
                    Изменить пароль
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Account Info - только для тим лидов */}
          {!isLimitedUser && (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Информация об аккаунте
                </h3>
                
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">ID пользователя</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono">{user?.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Дата создания</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user?.created_at ? formatKyivTime(user.created_at) : 'Не указана'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Статус аккаунта</dt>
                    <dd className="mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Активный
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Последнее обновление</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user?.updated_at ? formatKyivTime(user.updated_at) : 'Не указана'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
