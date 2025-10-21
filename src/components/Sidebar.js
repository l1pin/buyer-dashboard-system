import React, { useState } from 'react';
import {
  Table,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Database,
  Shield,
  Video,
  BarChart3,
  Activity,
  Search,
  Code2,
  Palette
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

function Sidebar({ user, activeSection, onSectionChange, onLogout }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    {
      id: 'table',
      label: user?.role === 'teamlead' ? 'Управление таблицами' : 'Рабочая таблица',
      icon: user?.role === 'teamlead' ? Database : Table,
      show: user?.role === 'teamlead'
    },
    {
      id: 'users',
      label: 'Пользователи',
      icon: Users,
      show: user?.role === 'teamlead'
    },
    {
      id: 'creatives',
      label: 'Креативы',
      icon: Video,
      show: user?.role === 'editor' || user?.role === 'designer' || user?.role === 'search_manager' || user?.role === 'buyer'
    },
    {
      id: 'analytics',
      label: 'Аналитика креативов',
      icon: BarChart3,
      show: user?.role === 'teamlead'
    },
    {
      id: 'metrics-analytics',
      label: 'Метрики аналитика',
      icon: Activity,
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

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'teamlead':
        return 'Team Lead';
      case 'buyer':
        return 'Media Buyer';
      case 'editor':
        return 'Video Designer';
      case 'designer':
        return 'Designer';
      case 'search_manager':
        return 'Search Manager';
      case 'content_manager':
        return 'Content Manager';
      default:
        return 'Unknown';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'teamlead':
        return <Shield className="h-5 w-5 text-gray-600" />;
      case 'buyer':
        return <AdIcon className="h-5 w-5 text-gray-600" />;
      case 'editor':
        return <Video className="h-5 w-5 text-gray-600" />;
      case 'designer':
        return <Palette className="h-5 w-5 text-gray-600" />;
      case 'search_manager':
        return <Search className="h-5 w-5 text-gray-600" />;
      case 'content_manager':
        return <Code2 className="h-5 w-5 text-gray-600" />;
      default:
        return <Shield className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className={`bg-white shadow-lg border-r border-gray-200 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-64'
      } min-h-screen flex flex-col`}>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center space-x-3">
            <div>
              <svg xmlns="http://www.w3.org/2000/svg" width="34" height="32" viewBox="0 0 34 32" fill="none">
                <path d="M9.638 2.64557C9.05261 3.02736 8.56518 3.54105 8.21486 4.14515C7.8646 4.74925 7.66119 5.42701 7.62109 6.12391V10.0851C7.66119 10.782 7.8646 11.4598 8.21486 12.0639C8.56518 12.668 9.05261 13.1817 9.638 13.5634L13.8111 16.0187C14.918 16.6571 15.828 16.1333 15.828 14.8565V1.43428C15.828 0.15754 14.918 -0.366212 13.8111 0.272159L9.638 2.64557Z" fill="#667FF5" />
                <path d="M9.20287 14.4218C8.59696 14.1206 7.92746 13.9636 7.24845 13.9636C6.56945 13.9636 5.89994 14.1206 5.29404 14.4218L1.9584 16.3002C1.39002 16.6653 0.916712 17.1565 0.576536 17.7342C0.236418 18.3119 0.0389242 18.96 0 19.6264V24.2283C0 25.4493 0.883708 25.9502 1.9584 25.3397L13.2629 18.9221C14.3377 18.3116 14.3377 17.3176 13.2629 16.7071L9.20287 14.4218Z" fill="#667FF5" />
                <path d="M24.3629 2.64557C24.9483 3.02736 25.4357 3.54105 25.786 4.14515C26.1363 4.74925 26.3397 5.42701 26.3798 6.12391V10.0851C26.3397 10.782 26.1363 11.4598 25.786 12.0639C25.4357 12.668 24.9483 13.1817 24.3629 13.5634L20.1816 16.0187C19.0747 16.6571 18.1729 16.1333 18.1729 14.8565V1.43428C18.1729 0.15754 19.0747 -0.366212 20.1816 0.272159L24.3629 2.64557Z" fill="#667FF5" />
                <path d="M24.4165 14.4218C25.048 14.1206 25.7458 13.9636 26.4535 13.9636C27.1611 13.9636 27.859 14.1206 28.4905 14.4218L31.967 16.3002C32.5584 16.6657 33.0505 17.1572 33.4035 17.7349C33.7566 18.3127 33.9609 18.9606 33.9999 19.6264V24.2283C33.9999 25.4493 33.0872 25.9502 31.967 25.3397L20.1849 18.9221C19.0647 18.3116 19.0647 17.3176 20.1849 16.7071L24.4165 14.4218Z" fill="#667FF5" />
                <path d="M7.21365 31.5424C7.8199 31.8433 8.48976 32 9.16912 32C9.84853 32 10.5184 31.8433 11.1246 31.5424L14.4622 29.6588C15.0301 29.2921 15.5024 28.7998 15.8413 28.2216C16.1802 27.6434 16.3762 26.9952 16.4137 26.3292V21.7334C16.4137 20.5141 15.5376 20.0139 14.4622 20.6235L3.15123 27.0326C2.07589 27.6423 2.07589 28.6349 3.15123 29.2445L7.21365 31.5424Z" fill="#667FF5" />
                <path d="M17 26.333C17.0397 26.9974 17.2442 27.6438 17.5972 28.2202C17.9503 28.7967 18.442 29.2873 19.0329 29.6525L22.5095 31.5427C23.141 31.8434 23.8388 32 24.5465 32C25.2541 32 25.9519 31.8434 26.5834 31.5427L30.8151 29.2386C31.9352 28.6294 31.9352 27.6374 30.8151 27.0281L19.0329 20.6234C17.9127 20.0141 17 20.514 17 21.7325V26.333Z" fill="#667FF5" />
              </svg>
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
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center ${user?.avatar_url ? 'hidden' : ''}`}>
                {getRoleIcon(user?.role)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || 'Пользователь'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {getRoleDisplayName(user?.role)}
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
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${isActive
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
    </div>
  );
}

export default Sidebar;
