/**
 * PermissionsMatrix - Компонент для настройки прав доступа
 *
 * Вкладка "Разделы" - определяет видимость вкладок в сайдбаре
 * Вкладка "Пользователи" - права на работу с пользователями
 */

import React, { useState, useMemo } from 'react';
import {
  Package,
  Globe,
  BarChart3,
  Activity,
  Users,
  Video,
  Palette,
  FileText,
  Eye,
  Edit3,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Archive,
  Shield,
  Building2
} from 'lucide-react';

// ============================================
// РАЗДЕЛЫ (определяют видимость вкладок в сайдбаре)
// ============================================
const SECTIONS = [
  // Раздел: Офферы
  {
    code: 'section.offers_management',
    name: 'Управление офферами',
    icon: Package,
    category: 'Офферы',
    description: 'Вкладка "Офферы" для Team Lead',
    defaultRole: 'teamlead'
  },
  {
    code: 'section.offers_buyer',
    name: 'Мои офферы (капы)',
    icon: Package,
    category: 'Офферы',
    description: 'Вкладка "Мои офферы" для Media Buyer',
    defaultRole: 'buyer'
  },

  // Раздел: Отчеты
  {
    code: 'section.reports_management',
    name: 'Отчеты по байерам (управление)',
    icon: FileText,
    category: 'Отчеты',
    description: 'Вкладка "Отчеты по байерам" для Team Lead',
    defaultRole: 'teamlead'
  },
  {
    code: 'section.reports_buyer',
    name: 'Отчеты по действиям (создание)',
    icon: FileText,
    category: 'Отчеты',
    description: 'Вкладка "Отчеты по действиям" для Media Buyer',
    defaultRole: 'buyer'
  },

  // Раздел: Лендинги
  {
    code: 'section.landings_management',
    name: 'Лендинги (управление)',
    icon: Globe,
    category: 'Лендинги',
    description: 'Панель LandingTeamLead.js - все лендинги',
    defaultRole: 'teamlead'
  },
  {
    code: 'section.landings_create',
    name: 'Лендинги (создание)',
    icon: Globe,
    category: 'Лендинги',
    description: 'Панель LandingPanel.js - создание лендингов',
    defaultRole: 'content_manager'
  },
  {
    code: 'section.landings_edit',
    name: 'Лендинги (редактирование)',
    icon: Globe,
    category: 'Лендинги',
    description: 'Панель LandingEditor.js - редактирование',
    defaultRole: 'proofreader'
  },
  {
    code: 'section.landings_analytics',
    name: 'Аналитика лендингов',
    icon: BarChart3,
    category: 'Лендинги',
    description: 'Панель LandingAnalytics.js',
    defaultRole: 'teamlead'
  },

  // Раздел: Аналитика
  {
    code: 'section.metrics_analytics',
    name: 'Метрики аналитика',
    icon: Activity,
    category: 'Аналитика',
    description: 'Вкладка "Метрики аналитика" для Team Lead',
    defaultRole: 'teamlead'
  },

  // Раздел: Администрирование
  {
    code: 'section.users',
    name: 'Пользователи',
    icon: Users,
    category: 'Администрирование',
    description: 'Вкладка "Пользователи" для Team Lead',
    defaultRole: 'teamlead'
  },

  // Раздел: Контент
  {
    code: 'section.creatives_create',
    name: 'Креативы (создание)',
    icon: Palette,
    category: 'Контент',
    description: 'Панель CreativePanel.js - создание',
    defaultRole: 'editor'
  },
  {
    code: 'section.creatives_view',
    name: 'Мои креативы (просмотр)',
    icon: Video,
    category: 'Контент',
    description: 'CreativeBuyer.js / CreativeSearch.js',
    defaultRole: 'buyer' // buyer и search_manager
  },
  {
    code: 'section.creatives_analytics',
    name: 'Аналитика креативов',
    icon: BarChart3,
    category: 'Контент',
    description: 'Панель CreativeAnalytics.js',
    defaultRole: 'teamlead'
  },
];

// ============================================
// ДЕЙСТВИЯ (права на работу с пользователями)
// ============================================
const ACTION_GROUPS = [
  {
    name: 'Просмотр пользователей',
    description: 'Определяет кого видит пользователь в списке',
    actions: [
      {
        code: 'users.view.own_department',
        name: 'Свой отдел',
        icon: Eye,
        description: 'Видеть пользователей своего отдела'
      },
      {
        code: 'users.view.all',
        name: 'Все отделы',
        icon: Eye,
        description: 'Видеть всех пользователей'
      },
    ]
  },
  {
    name: 'Редактирование пользователей',
    description: 'Определяет кого можно редактировать',
    actions: [
      {
        code: 'users.edit.subordinates',
        name: 'Только подчинённые',
        icon: Edit3,
        description: 'Редактировать только своих подчинённых'
      },
      {
        code: 'users.edit.own_department',
        name: 'Свой отдел',
        icon: Edit3,
        description: 'Редактировать пользователей своего отдела'
      },
      {
        code: 'users.edit.all',
        name: 'Все пользователи',
        icon: Edit3,
        description: 'Редактировать любых пользователей'
      },
    ]
  },
  {
    name: 'Управление пользователями',
    description: 'Дополнительные возможности',
    actions: [
      {
        code: 'users.create',
        name: 'Создание',
        icon: UserPlus,
        description: 'Если неактивно - нет кнопки "Добавить пользователя"'
      },
      {
        code: 'users.delete',
        name: 'Архивирование',
        icon: Archive,
        description: 'Если неактивно - нет кнопки архивации и вкладки "Архивные"'
      },
      {
        code: 'users.manage_roles',
        name: 'Управление ролями',
        icon: Shield,
        description: 'Если неактивно - нет вкладки "Роли"'
      },
      {
        code: 'users.manage_departments',
        name: 'Управление отделами',
        icon: Building2,
        description: 'Если неактивно - нет вкладки "Отделы"'
      },
    ]
  },
];

// Алиасы для обратной совместимости
const PERMISSION_ALIASES = {
  'section.offers_tl': 'section.offers_management',
  'section.landing_teamlead': 'section.landings_management',
  'section.landings': 'section.landings_create',
  'section.landing_editor': 'section.landings_edit',
  'section.landing_analytics': 'section.landings_analytics',
  'section.analytics': 'section.creatives_analytics',
  'section.creatives': 'section.creatives_create',
};

// ============================================
// КОМПОНЕНТЫ
// ============================================

// Toggle Switch
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

// Строка раздела
const SectionRow = ({ section, isEnabled, onToggle, disabled, isRolePermission, isExcluded }) => {
  const Icon = section.icon;

  const getStyles = () => {
    if (isExcluded) {
      return {
        bg: 'bg-red-50 border-red-200',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        textColor: 'text-red-900'
      };
    }
    if (isEnabled && isRolePermission) {
      return {
        bg: 'bg-amber-50 border-amber-200',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        textColor: 'text-amber-900'
      };
    }
    if (isEnabled) {
      return {
        bg: 'bg-blue-50 border-blue-200',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        textColor: 'text-blue-900'
      };
    }
    return {
      bg: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
      iconBg: 'bg-gray-200',
      iconColor: 'text-gray-500',
      textColor: 'text-gray-700'
    };
  };

  const styles = getStyles();

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${styles.bg} ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${styles.iconBg}`}>
          <Icon className={`h-4 w-4 ${styles.iconColor}`} />
        </div>
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${styles.textColor}`}>
            {section.name}
            {isExcluded && <span className="ml-2 text-xs text-red-600 font-normal">(отключено)</span>}
            {isRolePermission && !isExcluded && <span className="ml-2 text-xs text-amber-600 font-normal">(от роли)</span>}
          </span>
          {section.description && (
            <span className="text-xs text-gray-500">{section.description}</span>
          )}
        </div>
      </div>
      <Toggle checked={isEnabled} onChange={onToggle} disabled={disabled} />
    </div>
  );
};

// Группа действий
const ActionGroup = ({ group, permissions, rolePermissions = [], excludedPermissions = [], onToggle, disabled, allowExcludeRolePermissions = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isExcludedPerm = (code) => excludedPermissions.includes(code);

  const isActionEnabled = (code) => {
    if (isExcludedPerm(code)) return false;
    return permissions.includes(code) || rolePermissions.includes(code);
  };

  const isFromRole = (code) => rolePermissions.includes(code);

  const enabledCount = group.actions.filter(a => isActionEnabled(a.code)).length;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{group.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${enabledCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
              {enabledCount}/{group.actions.length}
            </span>
          </div>
          {group.description && (
            <span className="text-xs text-gray-500 mt-0.5">{group.description}</span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>

      {isExpanded && (
        <div className="p-3 space-y-2 bg-white">
          {group.actions.map(action => {
            const isEnabled = isActionEnabled(action.code);
            const isRolePerm = isFromRole(action.code);
            const isExcluded = isExcludedPerm(action.code);
            const Icon = action.icon;

            const getActionStyles = () => {
              if (isExcluded) return { bg: 'bg-red-50', iconColor: 'text-red-600', textColor: 'text-red-800' };
              if (isEnabled && isRolePerm) return { bg: 'bg-amber-50', iconColor: 'text-amber-600', textColor: 'text-amber-800' };
              if (isEnabled) return { bg: 'bg-green-50', iconColor: 'text-green-600', textColor: 'text-green-800' };
              return { bg: 'bg-gray-50 hover:bg-gray-100', iconColor: 'text-gray-400', textColor: 'text-gray-600' };
            };

            const actionStyles = getActionStyles();
            const canToggle = !disabled && (allowExcludeRolePermissions || !isRolePerm);

            return (
              <div key={action.code} className={`flex items-center justify-between p-2 rounded-lg transition-all ${actionStyles.bg} ${!canToggle ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2 flex-1">
                  <Icon className={`h-4 w-4 ${actionStyles.iconColor} flex-shrink-0`} />
                  <div className="flex flex-col">
                    <span className={`text-sm ${actionStyles.textColor}`}>
                      {action.name}
                      {isExcluded && <span className="ml-2 text-xs text-red-600 font-normal">(отключено)</span>}
                      {isRolePerm && !isExcluded && <span className="ml-2 text-xs text-amber-600 font-normal">(от роли)</span>}
                    </span>
                    {action.description && <span className="text-xs text-gray-500">{action.description}</span>}
                  </div>
                </div>
                <Toggle
                  checked={isEnabled || isExcluded}
                  onChange={(checked) => onToggle(action.code, checked)}
                  disabled={!canToggle}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================
const PermissionsMatrix = ({
  permissions = [],
  onChange,
  rolePermissions = [],
  excludedPermissions = [],
  onExcludedChange,
  disabled = false,
  showRolePermissions = true,
  allowExcludeRolePermissions = false
}) => {
  const [activeTab, setActiveTab] = useState('sections');

  // Группируем секции по категориям
  const sectionsByCategory = useMemo(() => {
    const categoryOrder = ['Офферы', 'Отчеты', 'Лендинги', 'Аналитика', 'Администрирование', 'Контент'];
    const grouped = {};

    categoryOrder.forEach(cat => { grouped[cat] = []; });

    SECTIONS.forEach(section => {
      if (!grouped[section.category]) grouped[section.category] = [];
      grouped[section.category].push(section);
    });

    Object.keys(grouped).forEach(key => {
      if (grouped[key].length === 0) delete grouped[key];
    });

    return grouped;
  }, []);

  // Нормализация кода права
  const normalizePermissionCode = (code) => PERMISSION_ALIASES[code] || code;

  // Проверка исключения (только если право есть в роли!)
  const isExcluded = (code) => {
    const normalizedCode = normalizePermissionCode(code);
    // Право считается "исключённым" только если:
    // 1. Оно есть в rolePermissions (т.е. это право роли)
    // 2. И оно добавлено в excludedPermissions
    const isInRole = rolePermissions.includes(code) || rolePermissions.includes(normalizedCode);
    if (!isInRole) return false; // Если права нет в роли - оно не может быть "исключено"
    return excludedPermissions.includes(code) || excludedPermissions.includes(normalizedCode);
  };

  // Проверка включения секции
  const isSectionEnabled = (code) => {
    if (isExcluded(code)) return false;
    const normalizedCode = normalizePermissionCode(code);
    return permissions.includes(code) || permissions.includes(normalizedCode) ||
           rolePermissions.includes(code) || rolePermissions.includes(normalizedCode);
  };

  // Проверка права от роли
  const isRolePermission = (code) => {
    const normalizedCode = normalizePermissionCode(code);
    return rolePermissions.includes(code) || rolePermissions.includes(normalizedCode);
  };

  // Проверка - право отключено на уровне роли (не в rolePermissions, но это "дефолтное" право для роли)
  // Используется только для визуального отображения
  const isDisabledByRole = (code) => {
    // Если право НЕ в rolePermissions - значит роль его не имеет
    // Пользователь может добавить его через custom_permissions
    return false; // Убираем эту логику - всё что не в роли, просто выключено и можно включить
  };

  // Обработчик переключения
  const handleToggle = (code, enabled) => {
    if (disabled) return;

    const isFromRole = isRolePermission(code);
    const currentlyExcluded = isExcluded(code);

    if (isFromRole) {
      // Право от роли - управляем через excluded
      if (!allowExcludeRolePermissions || !onExcludedChange) return;

      let newExcluded;
      if (enabled) {
        // Включаем - убираем из excluded
        const normalizedCode = normalizePermissionCode(code);
        newExcluded = excludedPermissions.filter(p => p !== code && p !== normalizedCode);
      } else {
        // Выключаем - добавляем в excluded
        newExcluded = [...excludedPermissions, code];
      }
      onExcludedChange(newExcluded);
      return;
    }

    // Право НЕ от роли - управляем через custom_permissions
    let newPermissions;
    if (enabled) {
      newPermissions = [...permissions, code];
    } else {
      const normalizedCode = normalizePermissionCode(code);
      newPermissions = permissions.filter(p => p !== code && p !== normalizedCode);
    }
    onChange(newPermissions);
  };

  // Проверка действия
  const isActionEnabled = (code) => {
    if (isExcluded(code)) return false;
    return permissions.includes(code) || rolePermissions.includes(code);
  };

  // Подсчёт
  const activeSectionsCount = SECTIONS.filter(s => isSectionEnabled(s.code)).length;
  const totalActionsCount = ACTION_GROUPS.reduce((sum, g) => sum + g.actions.length, 0);
  const activeActionsCount = ACTION_GROUPS.reduce((sum, g) => sum + g.actions.filter(a => isActionEnabled(a.code)).length, 0);

  return (
    <div className="space-y-4">
      {/* Табы */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'sections' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Разделы
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeSectionsCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {activeSectionsCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('actions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'actions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Пользователи
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeActionsCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {activeActionsCount}/{totalActionsCount}
          </span>
        </button>
      </div>

      {/* Информация о правах роли */}
      {showRolePermissions && rolePermissions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            <span className="font-medium">Права от роли</span> — отмечены оранжевым.
            {allowExcludeRolePermissions
              ? ' Вы можете отключить права роли для этого пользователя.'
              : ' Здесь вы можете добавить дополнительные права.'}
          </p>
        </div>
      )}

      {/* Информация об исключённых (только актуальные - те что есть в rolePermissions) */}
      {excludedPermissions.filter(code => {
        const normalizedCode = normalizePermissionCode(code);
        return rolePermissions.includes(code) || rolePermissions.includes(normalizedCode);
      }).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-800">
            <span className="font-medium">Отключено прав: {excludedPermissions.filter(code => {
              const normalizedCode = normalizePermissionCode(code);
              return rolePermissions.includes(code) || rolePermissions.includes(normalizedCode);
            }).length}</span> — эти права роли отключены для данного пользователя.
          </p>
        </div>
      )}

      {/* Контент табов */}
      {activeTab === 'sections' ? (
        <div className="space-y-4">
          {Object.entries(sectionsByCategory).map(([category, sections]) => (
            <div key={category}>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{category}</h5>
              <div className="space-y-2">
                {sections.map(section => {
                  const isFromRole = isRolePermission(section.code);
                  const canToggle = !disabled && (allowExcludeRolePermissions || !isFromRole);
                  return (
                    <SectionRow
                      key={section.code}
                      section={section}
                      isEnabled={isSectionEnabled(section.code)}
                      isRolePermission={isFromRole}
                      isExcluded={isExcluded(section.code)}
                      onToggle={(checked) => handleToggle(section.code, checked)}
                      disabled={!canToggle}
                    />
                  );
                })}
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
              permissions={permissions}
              rolePermissions={rolePermissions}
              excludedPermissions={excludedPermissions}
              onToggle={handleToggle}
              disabled={disabled}
              allowExcludeRolePermissions={allowExcludeRolePermissions}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PermissionsMatrix;
