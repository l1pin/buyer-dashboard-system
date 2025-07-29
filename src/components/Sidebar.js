import React, { useState } from 'react';
import { 
  Menu, 
  X, 
  Table, 
  Users, 
  Settings, 
  LogOut, 
  ChevronLeft,
  ChevronRight,
  Database,
  Shield
} from 'lucide-react';

function Sidebar({ user, activeSection, onSectionChange, onLogout }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    {
      id: 'table',
      label: user?.role === 'teamlead' ? 'Таблицы байеров' : 'Рабочая таблица',
      icon: user?.role === 'teamlead' ? Database : Table,
      show: true
    },
    {
      id: 'users',
      label: 'Пользователи',
      icon: Users,
      show: user?.role === 'teamlead'
    },
    {
      id: 'settings',
      label: 'Настройки',
      icon: Settings,
      show: true
    }
  ];

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`bg-white shadow-lg border-r border-gray-200 transition-all duration-300 ease-in-out ${
      isCollapsed ? 'w-16' : 'w-64'
    } min-h-screen flex flex-col`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500 rounded-lg p-2">
              <Table className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
              <p className="text-xs text-gray-500">v1.0</p>
            </div>
          </div>
        )}
        
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-200"
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* User Info */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-gray-200 rounded-full p-2">
              {user?.role === 'teamlead' ? (
                <Shield className="h-5 w-5 text-gray-600" />
              ) : (
                <Users className="h-5 w-5 text-gray-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || 'Пользователь'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.role === 'teamlead' ? 'Тим лид' : 'Байер'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {menuItems.filter(item => item.show).map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                  {!isCollapsed && (
                    <span className="ml-3">{item.label}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer - Logout */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={onLogout}
          className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
          title={isCollapsed ? 'Выйти' : ''}
        >
          <LogOut className="h-5 w-5 text-red-600" />
          {!isCollapsed && (
            <span className="ml-3">Выйти</span>
          )}
        </button>
      </div>

      {/* Collapse/Expand Button - Mobile */}
      {isCollapsed && (
        <div className="p-2 border-t border-gray-200 md:hidden">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default Sidebar;