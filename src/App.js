import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { supabaseTrelloService } from './services/supabaseTrelloService';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 🚀 Инициализация Trello синхронизации через Supabase
  useEffect(() => {
    console.log('🚀 Инициализация Supabase Trello Service...');
    
    // Инициализируем сервис (выборы лидера + синхронизация)
    supabaseTrelloService.initialize();
    
    // Cleanup при закрытии приложения/вкладки
    return () => {
      console.log('🧹 Cleanup Supabase Trello Service...');
      supabaseTrelloService.cleanup();
    };
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Пользователь не найден в таблице, создаем...');
        await createUserProfile(userId);
      } else {
        setUser(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const createUserProfile = async (userId) => {
    try {
      const { data: authUser } = await supabase.auth.getUser();

      // Определяем роль по умолчанию (можно изменить логику)
      let defaultRole = 'buyer';

      // Если это первый пользователь в системе, делаем его тим-лидом
      const { data: existingUsers, error: countError } = await supabase
        .from('users')
        .select('id', { count: 'exact' });

      if (!countError && existingUsers && existingUsers.length === 0) {
        defaultRole = 'teamlead';
      }

      const { error } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            email: authUser.user.email,
            name: authUser.user.user_metadata?.name || 'Новый пользователь',
            role: authUser.user.user_metadata?.role || defaultRole,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);

      if (!error) {
        setUser({
          id: userId,
          email: authUser.user.email,
          name: authUser.user.user_metadata?.name || 'Новый пользователь',
          role: authUser.user.user_metadata?.role || defaultRole,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  };

  // Функция для обновления пользователя (вызывается из Settings)
  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка приложения...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Router>
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/admin/tables" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/admin/users" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/workspace/creatives" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/analytics/creatives" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/analytics/metrics" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/settings" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/" element={<Navigate to="/settings" replace />} />
        <Route path="*" element={<Navigate to="/settings" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
