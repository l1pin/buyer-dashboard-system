/**
 * PermissionsMatrix - Компонент для настройки прав доступа с тумблерами
 *
 * Отображает матрицу разделов (sections) с переключателями
 */

import React, { useMemo } from 'react';
import {
  Package,
  Globe,
  BarChart3,
  Activity,
  Users,
  Video,
  Palette,
  FileText
} from 'lucide-react';

// Определение разделов с иконками (новая структура)
const SECTIONS = [
  // Раздел: Офферы
  { code: 'section.offers_management', name: 'Управление офферами', icon: Package, category: 'Офферы', description: 'Панель управления офферами (Team Lead)' },
  { code: 'section.offers_buyer', name: 'Мои офферы (капы)', icon: Package, category: 'Офферы', description: 'Капы и офферы байера (Media Buyer)' },

  // Раздел: Отчеты
  { code: 'section.reports_management', name: 'Отчеты по байерам (управление)', icon: FileText, category: 'Отчеты', description: 'Просмотр отчетов всех байеров (Team Lead)' },
  { code: 'section.reports_buyer', name: 'Отчеты по действиям (создание)', icon: FileText, category: 'Отчеты', description: 'Создание отчетов по своим действиям (Media Buyer)' },

  // Раздел: Лендинги
  { code: 'section.landings_management', name: 'Лендинги (управление)', icon: Globe, category: 'Лендинги', description: 'Управление всеми лендингами (Team Lead)' },
  { code: 'section.landings_create', name: 'Лендинги (создание)', icon: Globe, category: 'Лендинги', description: 'Создание лендингов (Content Manager)' },
  { code: 'section.landings_edit', name: 'Лендинги (редактирование)', icon: Globe, category: 'Лендинги', description: 'Редактирование лендингов (Proofreader)' },
  { code: 'section.landings_analytics', name: 'Аналитика лендингов', icon: BarChart3, category: 'Лендинги', description: 'Аналитика по лендингам (Team Lead)' },

  // Раздел: Аналитика
  { code: 'section.metrics_analytics', name: 'Метрики аналитика', icon: Activity, category: 'Аналитика', description: 'Аналитика метрик (Team Lead)' },

  // Раздел: Администрирование
  { code: 'section.users', name: 'Пользователи', icon: Users, category: 'Администрирование', description: 'Управление пользователями (Team Lead)' },

  // Раздел: Контент
  { code: 'section.creatives_create', name: 'Креативы (создание)', icon: Palette, category: 'Контент', description: 'Создание креативов (Video Designer)' },
  { code: 'section.creatives_view', name: 'Мои креативы (просмотр)', icon: Video, category: 'Контент', description: 'Просмотр своих креативов (Media Buyer, Search Manager)' },
  { code: 'section.creatives_analytics', name: 'Аналитика креативов', icon: BarChart3, category: 'Контент', description: 'Аналитика креативов (Team Lead)' },
];

// Алиасы старых кодов на новые (для обратной совместимости)
const PERMISSION_ALIASES = {
  'section.offers_tl': 'section.offers_management',
  'section.landing_teamlead': 'section.landings_management',
  'section.landings': 'section.landings_create',
  'section.landing_editor': 'section.landings_edit',
  'section.landing_analytics': 'section.landings_analytics',
  'section.analytics': 'section.creatives_analytics',
  'section.creatives': 'section.creatives_create',
};

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
const SectionRow = ({ section, isEnabled, onToggle, disabled, isRolePermission, isExcluded }) => {
  const Icon = section.icon;

  // Определяем стили в зависимости от состояния
  const getStyles = () => {
    if (isExcluded) {
      // Исключённое право роли (отключено пользователем)
      return {
        bg: 'bg-red-50 border-red-200',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        textColor: 'text-red-900'
      };
    }
    if (isEnabled && isRolePermission) {
      // Активное право от роли
      return {
        bg: 'bg-amber-50 border-amber-200',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        textColor: 'text-amber-900'
      };
    }
    if (isEnabled) {
      // Активное дополнительное право
      return {
        bg: 'bg-blue-50 border-blue-200',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        textColor: 'text-blue-900'
      };
    }
    // Неактивное
    return {
      bg: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
      iconBg: 'bg-gray-200',
      iconColor: 'text-gray-500',
      textColor: 'text-gray-700'
    };
  };

  const styles = getStyles();

  return (
    <div className={`
      flex items-center justify-between p-3 rounded-lg border transition-all
      ${styles.bg}
      ${disabled ? 'opacity-60' : ''}
    `}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${styles.iconBg}`}>
          <Icon className={`h-4 w-4 ${styles.iconColor}`} />
        </div>
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${styles.textColor}`}>
            {section.name}
            {isExcluded && (
              <span className="ml-2 text-xs text-red-600 font-normal">(отключено)</span>
            )}
            {isRolePermission && !isExcluded && (
              <span className="ml-2 text-xs text-amber-600 font-normal">(от роли)</span>
            )}
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

// Основной компонент
const PermissionsMatrix = ({
  permissions = [],
  onChange,
  rolePermissions = [], // Права от роли
  excludedPermissions = [], // Исключённые права роли
  onExcludedChange, // Callback для изменения исключений
  disabled = false,
  showRolePermissions = true,
  allowExcludeRolePermissions = false // Разрешить отключать права роли
}) => {
  // Группируем секции по категориям (с сохранением порядка)
  const sectionsByCategory = useMemo(() => {
    const categoryOrder = ['Офферы', 'Отчеты', 'Лендинги', 'Аналитика', 'Администрирование', 'Контент'];
    const grouped = {};

    // Инициализируем категории в правильном порядке
    categoryOrder.forEach(cat => {
      grouped[cat] = [];
    });

    SECTIONS.forEach(section => {
      if (!grouped[section.category]) {
        grouped[section.category] = [];
      }
      grouped[section.category].push(section);
    });

    // Удаляем пустые категории
    Object.keys(grouped).forEach(key => {
      if (grouped[key].length === 0) delete grouped[key];
    });

    return grouped;
  }, []);

  // Нормализация кода права (учитываем алиасы)
  const normalizePermissionCode = (code) => {
    return PERMISSION_ALIASES[code] || code;
  };

  // Проверка, исключено ли право
  const isExcluded = (code) => {
    const normalizedCode = normalizePermissionCode(code);
    return excludedPermissions.includes(code) || excludedPermissions.includes(normalizedCode);
  };

  // Проверка, включена ли секция (учитываем и custom и role permissions и алиасы и исключения)
  const isSectionEnabled = (code) => {
    // Если исключено - не включено
    if (isExcluded(code)) return false;

    const normalizedCode = normalizePermissionCode(code);
    // Проверяем оба кода - оригинальный и нормализованный
    return permissions.includes(code) ||
           permissions.includes(normalizedCode) ||
           rolePermissions.includes(code) ||
           rolePermissions.includes(normalizedCode);
  };

  // Проверка, это право от роли
  const isRolePermission = (code) => {
    const normalizedCode = normalizePermissionCode(code);
    return rolePermissions.includes(code) || rolePermissions.includes(normalizedCode);
  };

  // Обработчик изменения права
  const handleToggle = (code, enabled) => {
    if (disabled) return;

    const isFromRole = isRolePermission(code);

    // Если это право от роли
    if (isFromRole) {
      if (!allowExcludeRolePermissions || !onExcludedChange) return;

      // Переключаем исключение
      let newExcluded;
      if (enabled) {
        // Убираем из исключений (включаем обратно)
        const normalizedCode = normalizePermissionCode(code);
        newExcluded = excludedPermissions.filter(p => p !== code && p !== normalizedCode);
      } else {
        // Добавляем в исключения (отключаем)
        newExcluded = [...excludedPermissions, code];
      }
      onExcludedChange(newExcluded);
      return;
    }

    // Если это НЕ право от роли - работаем с custom_permissions
    let newPermissions;
    if (enabled) {
      newPermissions = [...permissions, code];
    } else {
      // Удаляем и оригинальный код и алиас
      const normalizedCode = normalizePermissionCode(code);
      newPermissions = permissions.filter(p => p !== code && p !== normalizedCode);
    }
    onChange(newPermissions);
  };

  // Подсчёт активных разделов
  const activeSectionsCount = SECTIONS.filter(s => isSectionEnabled(s.code)).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <h4 className="text-sm font-medium text-gray-900">
          Разделы
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
            activeSectionsCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {activeSectionsCount}/{SECTIONS.length}
          </span>
        </h4>
      </div>

      {/* Инфо о правах роли */}
      {showRolePermissions && rolePermissions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            <span className="font-medium">Права от роли</span> — отмечены оранжевым.
            {allowExcludeRolePermissions
              ? ' Вы можете отключить права роли для этого пользователя (будут отмечены красным).'
              : ' Здесь вы можете добавить дополнительные права.'}
          </p>
        </div>
      )}

      {/* Инфо об исключённых правах */}
      {excludedPermissions.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-800">
            <span className="font-medium">Отключено прав: {excludedPermissions.length}</span> — эти права роли отключены для данного пользователя.
          </p>
        </div>
      )}

      {/* Список разделов по категориям */}
      <div className="space-y-4">
        {Object.entries(sectionsByCategory).map(([category, sections]) => (
          <div key={category}>
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {category}
            </h5>
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
    </div>
  );
};

export default PermissionsMatrix;
