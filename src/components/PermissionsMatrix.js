/**
 * PermissionsMatrix - Компонент для настройки прав доступа с тумблерами
 *
 * Отображает матрицу прав:
 * - Разделы (sections) с переключателями View
 * - Действия с переключателями View / Edit / Export (если применимо)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Globe,
  BarChart3,
  Activity,
  Users,
  Video,
  Settings,
  Eye,
  Edit3,
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Определение разделов с иконками
const SECTIONS = [
  { code: 'section.offers_tl', name: 'Офферы (управление)', icon: Package, category: 'Офферы' },
  { code: 'section.offers_buyer', name: 'Мои офферы', icon: Package, category: 'Офферы' },
  { code: 'section.landing_teamlead', name: 'Лендинги (управление)', icon: Globe, category: 'Лендинги' },
  { code: 'section.landings', name: 'Лендинги (просмотр)', icon: Globe, category: 'Лендинги' },
  { code: 'section.landing_editor', name: 'Лендинги (редактор)', icon: Globe, category: 'Лендинги' },
  { code: 'section.landing_analytics', name: 'Аналитика лендингов', icon: BarChart3, category: 'Аналитика' },
  { code: 'section.analytics', name: 'Аналитика креативов', icon: BarChart3, category: 'Аналитика' },
  { code: 'section.metrics_analytics', name: 'Метрики аналитика', icon: Activity, category: 'Аналитика' },
  { code: 'section.users', name: 'Пользователи', icon: Users, category: 'Администрирование' },
  { code: 'section.creatives', name: 'Креативы', icon: Video, category: 'Контент' },
];

// Группы действий
const ACTION_GROUPS = [
  {
    name: 'Пользователи',
    actions: [
      { code: 'users.view', name: 'Просмотр', icon: Eye },
      { code: 'users.create', name: 'Создание', icon: Edit3 },
      { code: 'users.edit', name: 'Редактирование', icon: Edit3 },
      { code: 'users.delete', name: 'Архивирование', icon: Edit3 },
    ]
  },
  {
    name: 'Офферы',
    actions: [
      { code: 'offers.view', name: 'Просмотр', icon: Eye },
      { code: 'offers.create', name: 'Создание', icon: Edit3 },
      { code: 'offers.edit', name: 'Редактирование', icon: Edit3 },
    ]
  },
  {
    name: 'Лендинги',
    actions: [
      { code: 'landings.view', name: 'Просмотр', icon: Eye },
      { code: 'landings.create', name: 'Создание', icon: Edit3 },
      { code: 'landings.edit', name: 'Редактирование', icon: Edit3 },
    ]
  },
  {
    name: 'Креативы',
    actions: [
      { code: 'creatives.view', name: 'Просмотр', icon: Eye },
      { code: 'creatives.create', name: 'Создание', icon: Edit3 },
      { code: 'creatives.edit', name: 'Редактирование', icon: Edit3 },
    ]
  },
  {
    name: 'Аналитика',
    actions: [
      { code: 'analytics.view', name: 'Просмотр', icon: Eye },
      { code: 'analytics.export', name: 'Экспорт', icon: Download },
    ]
  },
];

// Компонент Toggle Switch
const Toggle = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`
      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      ${checked ? 'bg-blue-600' : 'bg-gray-200'}
    `}
  >
    <span
      className={`
        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
        transition duration-200 ease-in-out
        ${checked ? 'translate-x-5' : 'translate-x-0'}
      `}
    />
  </button>
);

// Компонент строки раздела
const SectionRow = ({ section, isEnabled, onToggle, disabled }) => {
  const Icon = section.icon;

  return (
    <div className={`
      flex items-center justify-between p-3 rounded-lg border transition-all
      ${isEnabled
        ? 'bg-blue-50 border-blue-200'
        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
      }
      ${disabled ? 'opacity-60' : ''}
    `}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isEnabled ? 'bg-blue-100' : 'bg-gray-200'}`}>
          <Icon className={`h-4 w-4 ${isEnabled ? 'text-blue-600' : 'text-gray-500'}`} />
        </div>
        <span className={`text-sm font-medium ${isEnabled ? 'text-blue-900' : 'text-gray-700'}`}>
          {section.name}
        </span>
      </div>
      <Toggle checked={isEnabled} onChange={onToggle} disabled={disabled} />
    </div>
  );
};

// Компонент группы действий
const ActionGroup = ({ group, permissions, onToggle, disabled }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const enabledCount = group.actions.filter(a => permissions.includes(a.code)).length;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{group.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            enabledCount > 0
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-200 text-gray-500'
          }`}>
            {enabledCount}/{group.actions.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-3 space-y-2 bg-white">
          {group.actions.map(action => {
            const isEnabled = permissions.includes(action.code);
            const Icon = action.icon;

            return (
              <div
                key={action.code}
                className={`
                  flex items-center justify-between p-2 rounded-lg transition-all
                  ${isEnabled ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'}
                  ${disabled ? 'opacity-60' : ''}
                `}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className={`text-sm ${isEnabled ? 'text-green-800' : 'text-gray-600'}`}>
                    {action.name}
                  </span>
                </div>
                <Toggle
                  checked={isEnabled}
                  onChange={(checked) => onToggle(action.code, checked)}
                  disabled={disabled}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Основной компонент
const PermissionsMatrix = ({
  permissions = [],
  onChange,
  rolePermissions = [], // Права от роли (только для отображения)
  disabled = false,
  showRolePermissions = true
}) => {
  const [activeTab, setActiveTab] = useState('sections'); // 'sections' | 'actions'

  // Группируем секции по категориям
  const sectionsByCategory = useMemo(() => {
    const grouped = {};
    SECTIONS.forEach(section => {
      if (!grouped[section.category]) {
        grouped[section.category] = [];
      }
      grouped[section.category].push(section);
    });
    return grouped;
  }, []);

  // Проверка, включена ли секция (учитываем и custom и role permissions)
  const isSectionEnabled = (code) => {
    return permissions.includes(code) || rolePermissions.includes(code);
  };

  // Проверка, это право от роли (нельзя отключить)
  const isRolePermission = (code) => {
    return rolePermissions.includes(code);
  };

  // Обработчик изменения права
  const handleToggle = (code, enabled) => {
    if (disabled || isRolePermission(code)) return;

    let newPermissions;
    if (enabled) {
      newPermissions = [...permissions, code];
    } else {
      newPermissions = permissions.filter(p => p !== code);
    }
    onChange(newPermissions);
  };

  // Подсчёт активных прав
  const activeSectionsCount = SECTIONS.filter(s => isSectionEnabled(s.code)).length;
  const totalActionsCount = ACTION_GROUPS.reduce((sum, g) => sum + g.actions.length, 0);
  const activeActionsCount = ACTION_GROUPS.reduce((sum, g) =>
    sum + g.actions.filter(a => permissions.includes(a.code) || rolePermissions.includes(a.code)).length, 0
  );

  return (
    <div className="space-y-4">
      {/* Header с табами */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'sections'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Разделы
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
            activeSectionsCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {activeSectionsCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('actions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'actions'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Действия
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
            activeActionsCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {activeActionsCount}/{totalActionsCount}
          </span>
        </button>
      </div>

      {/* Инфо о правах роли */}
      {showRolePermissions && rolePermissions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            <span className="font-medium">Права от роли</span> — отмечены автоматически и не могут быть отключены.
            Здесь вы можете добавить дополнительные права.
          </p>
        </div>
      )}

      {/* Контент табов */}
      {activeTab === 'sections' ? (
        <div className="space-y-4">
          {Object.entries(sectionsByCategory).map(([category, sections]) => (
            <div key={category}>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {category}
              </h5>
              <div className="space-y-2">
                {sections.map(section => (
                  <SectionRow
                    key={section.code}
                    section={section}
                    isEnabled={isSectionEnabled(section.code)}
                    onToggle={(checked) => handleToggle(section.code, checked)}
                    disabled={disabled || isRolePermission(section.code)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {ACTION_GROUPS.map(group => (
            <ActionGroup
              key={group.name}
              group={group}
              permissions={[...permissions, ...rolePermissions]}
              onToggle={handleToggle}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PermissionsMatrix;
