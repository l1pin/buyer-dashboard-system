import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
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
      const { error } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            email: authUser.user.email,
            name: 'Новый пользователь',
            role: 'buyer',
            avatar_url: null
          }
        ]);

      if (!error) {
        setUser({
          id: userId,
          email: authUser.user.email,
          name: 'Новый пользователь',
          role: 'buyer',
          avatar_url: null
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <Dashboard user={user} session={session} updateUser={updateUser} />;
}

export default App;