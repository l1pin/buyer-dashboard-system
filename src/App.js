import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import SqlQueryBuilder from './components/SqlQueryBuilder';
import OffersCollectionQuery from './components/OffersCollectionQuery';
import ConversionsCollectionQuery from './components/ConversionsCollectionQuery';
import SalesCollectionQuery from './components/SalesCollectionQuery';
import OperationalCostQuery from './components/OperationalCostQuery';
import CurrencyCollectionQuery from './components/CurrencyCollectionQuery';
import DatabaseMenu from './components/DatabaseMenu';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Ref для отслеживания текущего userId чтобы не перезагружать профиль лишний раз
  const currentUserIdRef = React.useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        currentUserIdRef.current = session.user.id;
        fetchUserProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Игнорируем события которые не требуют обновления UI
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        return;
      }

      // Для SIGNED_OUT - очищаем состояние
      if (event === 'SIGNED_OUT' || !session) {
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        return;
      }

      // Для SIGNED_IN или INITIAL_SESSION - загружаем профиль только если это новый пользователь
      if (currentUserIdRef.current !== session.user.id) {
        currentUserIdRef.current = session.user.id;
        setSession(session);
        fetchUserProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, roles:role_id(id, code, name, icon, color)')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Пользователь не найден в таблице, создаем...');
        await createUserProfile(userId);
      } else {
        // Проверяем, не архивирован ли пользователь
        if (data.archived === true) {
          console.log('Пользователь архивирован, выход из системы');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          return;
        }
        // Добавляем role_name из связанной таблицы roles
        const userWithRoleName = {
          ...data,
          role_name: data.roles?.name || null
        };
        setUser(userWithRoleName);
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
        <Route path="/workspace/landings" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/workspace/landing-editor" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/workspace/landing-teamlead" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/workspace/offers" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/analytics/landings" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/analytics/creatives" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/analytics/metrics" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/analytics/offers" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/reports/actions" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/db/ads_collection" element={
          <div className="h-screen w-screen overflow-auto bg-gray-50">
            <SqlQueryBuilder user={user} />
          </div>
        } />
        <Route path="/db/offers_collection" element={
          <div className="h-screen w-screen overflow-auto bg-gray-50">
            <OffersCollectionQuery user={user} />
          </div>
        } />
        <Route path="/db/conversions_collection" element={
          <div className="h-screen w-screen overflow-auto bg-gray-50">
            <ConversionsCollectionQuery user={user} />
          </div>
        } />
        <Route path="/db/sales_collection" element={
          <div className="h-screen w-screen overflow-auto bg-gray-50">
            <SalesCollectionQuery user={user} />
          </div>
        } />
        <Route path="/db/operational_cost_collection" element={
          <div className="h-screen w-screen overflow-auto bg-gray-50">
            <OperationalCostQuery user={user} />
          </div>
        } />
        <Route path="/db/currency_collection" element={
          <div className="h-screen w-screen overflow-auto bg-gray-50">
            <CurrencyCollectionQuery user={user} />
          </div>
        } />
        <Route path="/db" element={<DatabaseMenu />} />
        <Route path="/settings" element={<Dashboard user={user} session={session} updateUser={updateUser} />} />
        <Route path="/" element={<Navigate to="/settings" replace />} />
        <Route path="*" element={<Navigate to="/settings" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
