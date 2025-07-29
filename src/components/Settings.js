import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Save, 
  User, 
  Mail, 
  Shield, 
  Key, 
  AlertCircle, 
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

function Settings({ user }) {
  const [loading, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleProfileUpdate = async () => {
    if (!profileData.name) {
      setError('Имя пользователя обязательно для заполнения');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Обновляем профиль в таблице users
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: profileData.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccess('Профиль успешно обновлен');
    } catch (error) {
      setError('Ошибка обновления профиля: ' + error.message);
    } finally {
      setSaving(false);
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
      setSaving(true);
      setError('');
      setSuccess('');

      // Обновляем пароль через Supabase Auth
      const { error: passwordError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (passwordError) throw passwordError;

      // Очищаем форму смены пароля
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      setSuccess('Пароль успешно изменен');
    } catch (error) {
      setError('Ошибка смены пароля: ' + error.message);
    } finally {
      setSaving(false);
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
            Управление профилем и настройками аккаунта
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
          {/* Profile Settings */}
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
                    value={profileData.email}
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
                    value={user?.role === 'teamlead' ? 'Тим лид' : 'Байер'}
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

          {/* Password Change */}
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

          {/* Account Info */}
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
                    {user?.created_at ? new Date(user.created_at).toLocaleString('ru-RU') : 'Не указана'}
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
                  <dt className="text-sm font-medium text-gray-500">Версия системы</dt>
                  <dd className="mt-1 text-sm text-gray-900">v1.0</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;