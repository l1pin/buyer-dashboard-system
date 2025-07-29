import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import Sidebar from './Sidebar';
import WorkTable from './WorkTable';
import AdminPanel from './AdminPanel';
import UserManagement from './UserManagement';
import Settings from './Settings';

function Dashboard({ user, session }) {
  const [activeSection, setActiveSection] = useState('table');

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('rememberMe');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'table':
        if (user?.role === 'teamlead') {
          return <AdminPanel user={user} />;
        } else {
          return <WorkTable user={user} />;
        }
      case 'users':
        return user?.role === 'teamlead' ? <UserManagement user={user} /> : null;
      case 'settings':
        return <Settings user={user} />;
      default:
        return <WorkTable user={user} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={handleLogout}
      />
      
      <main className="flex-1 overflow-hidden">
        <div className="h-full">
          {renderActiveSection()}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;