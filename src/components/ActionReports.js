// src/components/ActionReports.js
// Вкладка "Отчеты по действию" для Тим лида и Байера

import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import {
  Search,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ChevronDown,
  Trash2,
  AlertCircle,
  Loader2,
  Star,
  RefreshCw,
  User
} from 'lucide-react';
import { metricsAnalyticsService, userService } from '../supabaseClient';
import { offerStatusService, articleOfferMappingService, offerSeasonService, actionReportsService } from '../services/OffersSupabase';
import { effectivityZonesService } from '../services/effectivityZonesService';
import { updateStocksFromYml } from '../scripts/offers/Offers_stock';
import { calculateRemainingDays } from '../scripts/offers/Calculate_days';
import { updateLeadsFromSql } from '../scripts/offers/Sql_leads';
import TooltipManager from './TooltipManager';

// Иконка информации
const InfoIcon = memo(({ onClick, className = "text-gray-500 w-3 h-3" }) => (
  <svg
    className={`${className} cursor-pointer hover:text-gray-700`}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
));

// Компонент skeleton для ячейки таблицы
function SkeletonCell({ width = 'w-10' }) {
  return (
    <div className={`${width} h-4 bg-slate-200 rounded animate-pulse mx-auto`} />
  );
}

// Расчет дней до прихода
const calculateDaysUntilArrival = (dateString) => {
  if (!dateString) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const arrivalDate = new Date(dateString);
    arrivalDate.setHours(0, 0, 0, 0);
    const diffTime = arrivalDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (error) {
    return null;
  }
};

// Опции для действий
const ACTION_OPTIONS = [
  { value: 'enabled_from_arrival', label: 'Вкл с прихода' },
  { value: 'reconfigured', label: 'Перенастроил' },
  { value: 'new_product', label: 'Новинка' },
  { value: 'out_of_stock', label: 'Закончились' },
  { value: 'tz', label: 'ТЗ' }
];

// Опции для "Перенастроил"
const RECONFIGURED_OPTIONS = [
  { value: 'new_account', label: 'Новый акк' },
  { value: 'target', label: 'Таргет' },
  { value: 'creative', label: 'Крео' },
  { value: 'audience', label: 'Аудитория' },
  { value: 'landing', label: 'Ленд' },
  { value: 'budget', label: 'Бюджет' },
  { value: 'duplicate', label: 'Дубль' },
  { value: 'other', label: 'Другое' }
];

// Опции для "Новинка"
const NEW_PRODUCT_OPTIONS = [
  { value: 'from_old', label: 'Из старого' },
  { value: 'from_new', label: 'Из нового' }
];

// Компонент выпадающего списка с фиксированным позиционированием
function CustomDropdown({ value, options, onChange, placeholder = 'Выберите...', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Обновляем позицию dropdown при открытии
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-left text-sm border rounded-lg flex items-center justify-between transition-colors ${
          value
            ? 'bg-white border-slate-300 text-slate-700'
            : 'bg-slate-50 border-slate-200 text-slate-400'
        } hover:border-slate-400`}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-auto"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                value === option.value ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Компонент строки артикула в конфигурации
function ArticleConfigRow({ article, config, onChange, onRemove, isInvalid = false, validationErrors = {} }) {
  const hasActionError = validationErrors.action;
  const hasSubActionError = validationErrors.subAction;
  const hasCustomTextError = validationErrors.customText;
  const hasTrelloLinkError = validationErrors.trelloLink;

  return (
    <div className={`flex items-start gap-3 py-3 border-b last:border-b-0 ${isInvalid ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
      {/* Артикул */}
      <div className="w-24 flex-shrink-0">
        <span className={`font-mono text-sm font-medium px-2 py-1 rounded ${
          isInvalid
            ? 'text-red-700 bg-red-100 border border-red-300'
            : 'text-slate-700 bg-slate-100'
        }`}>
          {article}
        </span>
      </div>

      {/* Действие */}
      <div className="flex-1 flex flex-wrap items-center gap-2">
        {!isInvalid && (
          <>
            <div className="flex flex-col">
              <CustomDropdown
                value={config.action}
                options={ACTION_OPTIONS}
                onChange={(val) => onChange({ ...config, action: val, subAction: '', customText: '', trelloLink: '' })}
                placeholder="Выберите действие"
                className={`w-40 ${hasActionError ? 'ring-2 ring-red-500 rounded-lg' : ''}`}
              />
              {hasActionError && <span className="text-xs text-red-500 mt-1">Обязательное поле</span>}
            </div>

            {/* Дополнительные поля в зависимости от выбора */}
            {config.action === 'reconfigured' && (
              <div className="flex flex-col">
                <CustomDropdown
                  value={config.subAction}
                  options={RECONFIGURED_OPTIONS}
                  onChange={(val) => onChange({ ...config, subAction: val, customText: '' })}
                  placeholder="Что изменили?"
                  className={`w-36 ${hasSubActionError ? 'ring-2 ring-red-500 rounded-lg' : ''}`}
                />
                {hasSubActionError && <span className="text-xs text-red-500 mt-1">Обязательное поле</span>}
              </div>
            )}

            {config.action === 'reconfigured' && config.subAction === 'other' && (
              <div className="flex flex-col">
                <input
                  type="text"
                  value={config.customText || ''}
                  onChange={(e) => onChange({ ...config, customText: e.target.value })}
                  placeholder="Укажите что..."
                  className={`w-32 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    hasCustomTextError ? 'border-red-500 ring-2 ring-red-500' : 'border-slate-300'
                  }`}
                />
                {hasCustomTextError && <span className="text-xs text-red-500 mt-1">Обязательное поле</span>}
              </div>
            )}

            {config.action === 'new_product' && (
              <div className="flex flex-col">
                <CustomDropdown
                  value={config.subAction}
                  options={NEW_PRODUCT_OPTIONS}
                  onChange={(val) => onChange({ ...config, subAction: val })}
                  placeholder="Откуда?"
                  className={`w-36 ${hasSubActionError ? 'ring-2 ring-red-500 rounded-lg' : ''}`}
                />
                {hasSubActionError && <span className="text-xs text-red-500 mt-1">Обязательное поле</span>}
              </div>
            )}

            {config.action === 'tz' && (
              <div className="flex flex-col flex-1">
                <input
                  type="text"
                  value={config.trelloLink || ''}
                  onChange={(e) => onChange({ ...config, trelloLink: e.target.value })}
                  placeholder="https://trello.com/c/..."
                  className={`min-w-[200px] px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    hasTrelloLinkError ? 'border-red-500 ring-2 ring-red-500' : 'border-slate-300'
                  }`}
                />
                {hasTrelloLinkError && <span className="text-xs text-red-500 mt-1">Введите ссылку: https://trello.com/c/...</span>}
              </div>
            )}
          </>
        )}

        {isInvalid && (
          <span className="text-sm text-red-600">Артикул не найден в базе</span>
        )}
      </div>

      {/* Кнопка удаления */}
      <button
        onClick={onRemove}
        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function ActionReports({ user }) {
  // Состояния
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [articlesInput, setArticlesInput] = useState('');
  const [modalStep, setModalStep] = useState(1); // 1 = ввод артикулов, 2 = конфигурация
  const [articleConfigs, setArticleConfigs] = useState({}); // { article: { action, subAction, customText, trelloLink } }
  const [savedReports, setSavedReports] = useState([]); // Сохраненные отчеты
  const [selectedDate, setSelectedDate] = useState(() => {
    // По умолчанию выбран сегодняшний день
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [reportsCountByDay, setReportsCountByDay] = useState({}); // { 'YYYY-MM-DD': count }
  const [loadingReports, setLoadingReports] = useState(false); // Загрузка отчетов из БД
  const [savingReports, setSavingReports] = useState(false); // Сохранение отчетов в БД
  const [calendarScrollPercent, setCalendarScrollPercent] = useState(100); // Позиция слайдера (100 = справа)

  // Данные офферов из БД
  const [allMetrics, setAllMetrics] = useState([]);
  const [allStatuses, setAllStatuses] = useState({});
  const [allUsers, setAllUsers] = useState([]); // Список пользователей для аватарок
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [validatingArticles, setValidatingArticles] = useState(false);

  // Маппинг артикулов -> offer_id для API запросов
  const [articleOfferMap, setArticleOfferMap] = useState({});

  // Состояния загрузки для каждой группы колонок
  const [loadingCplLeads, setLoadingCplLeads] = useState(false); // CPL, Лиды, Рейтинг
  const [loadingDays, setLoadingDays] = useState(false); // Дни
  const [loadingStock, setLoadingStock] = useState(false); // Ост., Приход
  const [loadingZones, setLoadingZones] = useState(false); // ROI, Апрув, Выкуп

  // Обновленные данные для отчетов (метрики после обновления)
  const [updatedMetricsMap, setUpdatedMetricsMap] = useState({}); // { article: updatedMetric }
  const [offerSeasons, setOfferSeasons] = useState({}); // { article: seasons[] }
  const [stockData, setStockData] = useState({}); // Данные об остатках для тултипа

  // Ref для tooltip менеджера
  const tooltipManagerRef = useRef(null);

  // Ошибки валидации
  const [invalidArticles, setInvalidArticles] = useState([]);
  const [validationError, setValidationError] = useState('');
  const [configValidationErrors, setConfigValidationErrors] = useState({}); // { article: { action: true, subAction: true, ... } }

  // Ref для горизонтального скролла календаря
  const calendarRef = useRef(null);

  // Загрузка данных офферов и отчетов при монтировании
  useEffect(() => {
    loadOffersData();
    loadReportsFromDB();
  }, []);

  const loadOffersData = async () => {
    try {
      setLoadingMetrics(true);

      // Загружаем метрики, статусы, маппинги, сезоны и пользователей параллельно
      const [metricsResult, statusesResult, mappingsResult, seasonsResult, usersResult] = await Promise.all([
        metricsAnalyticsService.getAllMetrics(),
        offerStatusService.getAllStatuses(),
        articleOfferMappingService.getAllMappings(),
        offerSeasonService.getAllSeasons(),
        userService.getAllUsers()
      ]);

      setAllMetrics(metricsResult.metrics || []);
      setAllUsers(usersResult || []);

      // Преобразуем статусы в map с расчетом дней в статусе
      const statusesMap = {};
      (statusesResult || []).forEach(status => {
        let daysInStatus = 0;
        if (status.status_history && status.status_history.length > 0) {
          const currentStatusEntry = status.status_history[0];
          const changedAt = new Date(currentStatusEntry.changed_at);
          const now = new Date();
          daysInStatus = Math.floor((now - changedAt) / (1000 * 60 * 60 * 24));
        }
        statusesMap[status.offer_id] = {
          ...status,
          days_in_status: daysInStatus
        };
      });
      setAllStatuses(statusesMap);

      // Сохраняем маппинг артикулов -> offer_id
      setArticleOfferMap(mappingsResult || {});
      console.log(`📊 Загружено ${Object.keys(mappingsResult || {}).length} маппингов артикулов`);

      // Обрабатываем сезоны (article -> seasons[])
      const seasonsMap = {};
      (seasonsResult || []).forEach(season => {
        seasonsMap[season.article] = season.seasons || [];
      });
      setOfferSeasons(seasonsMap);
      console.log(`🌿 Загружено ${Object.keys(seasonsMap).length} сезонов`);

    } catch (error) {
      console.error('Ошибка загрузки данных офферов:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Загрузка отчетов из БД
  const loadReportsFromDB = async (date = null) => {
    try {
      setLoadingReports(true);

      // Загружаем отчеты и статистику параллельно
      const [reports, countByDay] = await Promise.all([
        date
          ? actionReportsService.getReportsByDate(date)
          : actionReportsService.getAllReports(),
        actionReportsService.getReportsCountByDays(60) // 60 дней для календаря
      ]);

      // Преобразуем отчеты из БД в формат компонента
      // action и subAction уже хранятся на русском языке
      // Метрики подтягиваются динамически через getReportMetric
      const formattedReports = reports.map(r => ({
        id: r.id,
        article: r.article,
        action: r.action_type,  // Русский лейбл из БД
        subAction: r.sub_action,  // Русский лейбл из БД
        customText: r.custom_text,
        trelloLink: r.trello_link,
        createdAt: r.created_at,
        createdBy: r.created_by,
        createdByName: r.created_by_name
      }));

      setSavedReports(formattedReports);
      setReportsCountByDay(countByDay);
      console.log(`📋 Загружено ${formattedReports.length} отчетов из БД`);

    } catch (error) {
      console.error('Ошибка загрузки отчетов из БД:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  // Карта артикулов для быстрого поиска
  const articlesMap = useMemo(() => {
    const map = {};
    allMetrics.forEach(metric => {
      if (metric.article) {
        map[metric.article.toLowerCase()] = metric;
      }
    });
    return map;
  }, [allMetrics]);

  // Генерация дней для календаря (от первого дня с товарами до сегодня)
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Для байеров показываем только их собственные отчеты
    const isUserTeamlead = user?.role === 'teamlead';
    const userReports = (!isUserTeamlead && user?.id)
      ? savedReports.filter(r => r.createdBy === user.id)
      : savedReports;

    // Находим самую раннюю дату с отчетами
    let startDate = today;
    if (userReports.length > 0) {
      const reportDates = userReports.map(r => {
        const d = new Date(r.createdAt);
        d.setHours(0, 0, 0, 0);
        return d;
      });
      startDate = new Date(Math.min(...reportDates.map(d => d.getTime())));
    }

    // Генерируем дни от startDate до today
    const currentDate = new Date(startDate);
    while (currentDate <= today) {
      const date = new Date(currentDate);
      const dateKey = date.toISOString().split('T')[0];
      const daysAgo = Math.floor((today - date) / (1000 * 60 * 60 * 24));

      days.push({
        date: date,
        dateKey: dateKey,
        day: date.getDate(),
        weekday: date.toLocaleString('ru', { weekday: 'short' }),
        month: date.toLocaleString('ru', { month: 'short' }),
        isToday: daysAgo === 0,
        isYesterday: daysAgo === 1,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        daysAgo: daysAgo,
        // Считаем товары из userReports (отфильтрованных по пользователю)
        tasksCount: userReports.filter(r => {
          const reportDate = new Date(r.createdAt);
          reportDate.setHours(0, 0, 0, 0);
          return reportDate.getTime() === date.getTime();
        }).length
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Если нет отчетов - показываем только сегодня
    if (days.length === 0) {
      days.push({
        date: today,
        dateKey: today.toISOString().split('T')[0],
        day: today.getDate(),
        weekday: today.toLocaleString('ru', { weekday: 'short' }),
        month: today.toLocaleString('ru', { month: 'short' }),
        isToday: true,
        isYesterday: false,
        isWeekend: today.getDay() === 0 || today.getDay() === 6,
        daysAgo: 0,
        tasksCount: 0
      });
    }

    return days;
  }, [savedReports, user]);

  // Скролл календаря вправо при загрузке (чтобы видеть свежие даты)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (calendarRef.current) {
        const maxScroll = calendarRef.current.scrollWidth - calendarRef.current.clientWidth;
        calendarRef.current.scrollLeft = maxScroll;
        setCalendarScrollPercent(100);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [calendarDays]);

  // Обработка клика по дню в календаре
  const handleDayClick = (day) => {
    if (selectedDate && selectedDate.getTime() === day.date.getTime()) {
      // Повторный клик — снять выбор (показать все)
      setSelectedDate(null);
    } else {
      setSelectedDate(day.date);
    }
  };

  // Навигация по календарю
  const handleCalendarScroll = (direction) => {
    if (calendarRef.current) {
      const scrollAmount = 300;
      calendarRef.current.scrollBy({
        left: direction === 'right' ? scrollAmount : -scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Пресеты фильтров (заглушки)
  const presetButtons = [
    { id: 'preset1', label: 'Пресет 1' },
    { id: 'preset2', label: 'Пресет 2' },
    { id: 'preset3', label: 'Пресет 3' },
    { id: 'preset4', label: 'Пресет 4' },
    { id: 'preset5', label: 'Пресет 5' }
  ];

  // Список артикулов из ввода
  const parsedArticles = useMemo(() => {
    return articlesInput
      .split('\n')
      .map(a => a.trim())
      .filter(a => a.length > 0);
  }, [articlesInput]);

  // Обработка нажатия "Применить" - валидация и переход к шагу 2
  const handleApplyArticles = async () => {
    setValidatingArticles(true);
    setValidationError('');
    setInvalidArticles([]);

    try {
      const valid = [];
      const invalid = [];

      // Проверяем каждый артикул
      parsedArticles.forEach(article => {
        const metric = articlesMap[article.toLowerCase()];
        if (metric) {
          valid.push({ article: metric.article, metric }); // Используем оригинальный регистр из БД
        } else {
          invalid.push(article);
        }
      });

      if (invalid.length > 0) {
        setInvalidArticles(invalid);
        setValidationError(`Артикул${invalid.length > 1 ? 'ы' : ''} не найден${invalid.length > 1 ? 'ы' : ''}: ${invalid.join(', ')}`);
      }

      // Инициализируем конфигурации для валидных артикулов
      const configs = {};
      valid.forEach(({ article, metric }) => {
        configs[article] = {
          action: '',
          subAction: '',
          customText: '',
          trelloLink: '',
          metric // Сохраняем данные метрики
        };
      });

      // Добавляем невалидные с пометкой
      invalid.forEach(article => {
        configs[article] = {
          action: '',
          subAction: '',
          customText: '',
          trelloLink: '',
          metric: null,
          isInvalid: true
        };
      });

      setArticleConfigs(configs);
      setModalStep(2);

    } finally {
      setValidatingArticles(false);
    }
  };

  // Обновление конфигурации артикула
  const updateArticleConfig = (article, config) => {
    setArticleConfigs(prev => ({
      ...prev,
      [article]: { ...prev[article], ...config }
    }));
  };

  // Удаление артикула из списка
  const removeArticle = (article) => {
    setArticleConfigs(prev => {
      const newConfigs = { ...prev };
      delete newConfigs[article];
      return newConfigs;
    });
    // Убираем из списка невалидных
    setInvalidArticles(prev => prev.filter(a => a !== article));
  };

  // Обработка сохранения
  const handleSaveReport = async () => {
    // Сначала валидируем все конфигурации
    const validConfigs = Object.entries(articleConfigs).filter(([_, config]) => !config.isInvalid);
    const newValidationErrors = {};
    let hasErrors = false;

    validConfigs.forEach(([article, config]) => {
      const errors = validateArticleConfig(config);
      if (Object.keys(errors).length > 0) {
        newValidationErrors[article] = errors;
        hasErrors = true;
      }
    });

    setConfigValidationErrors(newValidationErrors);

    if (hasErrors) {
      setValidationError('Пожалуйста, заполните все обязательные поля');
      return;
    }

    // Подготавливаем отчеты для сохранения в БД
    const reportsToSave = validConfigs.map(([article, config]) => {
      // Находим русские лейблы для action и subAction
      const actionOption = ACTION_OPTIONS.find(a => a.value === config.action);
      const actionLabel = actionOption?.label || config.action;

      let subActionLabel = null;
      if (config.subAction) {
        if (config.action === 'reconfigured') {
          const subOption = RECONFIGURED_OPTIONS.find(s => s.value === config.subAction);
          subActionLabel = subOption?.label || config.subAction;
        } else if (config.action === 'new_product') {
          const subOption = NEW_PRODUCT_OPTIONS.find(s => s.value === config.subAction);
          subActionLabel = subOption?.label || config.subAction;
        }
      }

      return {
        article,
        action_type: actionLabel,  // Сохраняем русский лейбл
        sub_action: subActionLabel,  // Сохраняем русский лейбл
        custom_text: config.customText || null,
        trello_link: config.trelloLink || null,
        created_by: user?.id,
        created_by_name: user?.name || 'Неизвестно'
        // metric_snapshot убран - данные подтягиваются динамически
      };
    });

    // Сохраняем в БД
    setSavingReports(true);
    try {
      const savedToDB = await actionReportsService.createReports(reportsToSave);

      // Преобразуем сохраненные отчеты для отображения
      const reports = savedToDB.map(r => {
        return {
          id: r.id,
          article: r.article,
          action: r.action_type,  // Уже русский лейбл
          subAction: r.sub_action,  // Уже русский лейбл
          customText: r.custom_text,
          trelloLink: r.trello_link,
          createdAt: r.created_at,
          createdBy: r.created_by,
          createdByName: r.created_by_name
          // Данные метрик подтягиваются динамически через getReportMetric
        };
      });

      setSavedReports(prev => [...prev, ...reports]);

      // Обновляем статистику по дням для календаря
      const countByDay = await actionReportsService.getReportsCountByDays(60);
      setReportsCountByDay(countByDay);

      console.log(`✅ Сохранено ${reports.length} отчетов в БД`);
    } catch (error) {
      console.error('❌ Ошибка сохранения отчетов:', error);
      setValidationError('Ошибка сохранения в базу данных');
      return;
    } finally {
      setSavingReports(false);
    }

    // Закрываем модальное окно и сбрасываем состояние
    setShowCreateModal(false);
    setModalStep(1);
    setArticlesInput('');
    setArticleConfigs({});
    setInvalidArticles([]);
    setValidationError('');
    setConfigValidationErrors({});
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setShowCreateModal(false);
    setModalStep(1);
    setArticlesInput('');
    setArticleConfigs({});
    setInvalidArticles([]);
    setValidationError('');
    setConfigValidationErrors({});
  };

  // Удаление отчета
  const handleDeleteReport = async (reportId) => {
    try {
      // Удаляем из БД
      await actionReportsService.deleteReport(reportId);

      // Удаляем из локального состояния
      setSavedReports(prev => prev.filter(r => r.id !== reportId));

      // Обновляем статистику по дням для календаря
      const countByDay = await actionReportsService.getReportsCountByDays(60);
      setReportsCountByDay(countByDay);

      console.log(`✅ Отчет ${reportId} удалён`);
    } catch (error) {
      console.error('❌ Ошибка удаления отчета:', error);
    }
  };

  // Получение текста действия для отображения
  const getActionLabel = (report) => {
    const action = ACTION_OPTIONS.find(a => a.value === report.action);
    let label = action?.label || '—';

    if (report.action === 'reconfigured' && report.subAction) {
      const sub = RECONFIGURED_OPTIONS.find(s => s.value === report.subAction);
      if (report.subAction === 'other' && report.customText) {
        label = `Перенастроил: ${report.customText}`;
      } else {
        label += `: ${sub?.label || ''}`;
      }
    }

    if (report.action === 'new_product' && report.subAction) {
      const sub = NEW_PRODUCT_OPTIONS.find(s => s.value === report.subAction);
      label += ` (${sub?.label || ''})`;
    }

    return label;
  };

  // Валидация Trello ссылки
  const isValidTrelloLink = (link) => {
    if (!link || link.trim() === '') return false;
    // Ссылка должна начинаться с https://trello.com/c/
    return /^https:\/\/trello\.com\/c\/[a-zA-Z0-9]+/.test(link.trim());
  };

  // Валидация конфигурации одного артикула
  const validateArticleConfig = (config) => {
    const errors = {};

    // Действие обязательно
    if (!config.action) {
      errors.action = true;
    }

    // Для "Перенастроил" обязательно выбрать подкатегорию
    if (config.action === 'reconfigured' && !config.subAction) {
      errors.subAction = true;
    }

    // Для "Перенастроил" -> "Другое" обязательно заполнить текст
    if (config.action === 'reconfigured' && config.subAction === 'other' && !config.customText?.trim()) {
      errors.customText = true;
    }

    // Для "Новинка" обязательно выбрать откуда
    if (config.action === 'new_product' && !config.subAction) {
      errors.subAction = true;
    }

    // Для "ТЗ" обязательна валидная Trello ссылка
    if (config.action === 'tz' && !isValidTrelloLink(config.trelloLink)) {
      errors.trelloLink = true;
    }

    return errors;
  };

  // Проверка, все ли валидные артикулы полностью настроены
  const allArticlesConfigured = useMemo(() => {
    const validArticles = Object.entries(articleConfigs).filter(([_, config]) => !config.isInvalid);
    if (validArticles.length === 0) return false;

    return validArticles.every(([_, config]) => {
      const errors = validateArticleConfig(config);
      return Object.keys(errors).length === 0;
    });
  }, [articleConfigs]);

  // Есть ли хотя бы один валидный артикул
  const hasValidArticles = useMemo(() => {
    return Object.values(articleConfigs).some(config => !config.isInvalid);
  }, [articleConfigs]);

  // Фильтрация отчетов по дате, поиску и пользователю
  const filteredReports = useMemo(() => {
    let reports = savedReports;

    // Для байеров показываем только их собственные действия
    const isUserTeamlead = user?.role === 'teamlead';
    if (!isUserTeamlead && user?.id) {
      reports = reports.filter(r => r.createdBy === user.id);
    }

    // Фильтруем по выбранной дате
    if (selectedDate) {
      reports = reports.filter(r => {
        const reportDate = new Date(r.createdAt);
        reportDate.setHours(0, 0, 0, 0);
        const selected = new Date(selectedDate);
        selected.setHours(0, 0, 0, 0);
        return reportDate.getTime() === selected.getTime();
      });
    }

    // Затем по поисковому запросу
    if (!searchTerm) return reports;
    const term = searchTerm.toLowerCase();
    return reports.filter(r =>
      r.article.toLowerCase().includes(term) ||
      r.metric?.offer?.toLowerCase().includes(term)
    );
  }, [savedReports, searchTerm, selectedDate, user]);

  // Получение цвета статуса и дней в статусе - данные подтягиваются динамически
  const getStatusDisplay = (report) => {
    // Ищем метрику по артикулу чтобы получить offer_id
    const articleLower = report.article?.toLowerCase();
    const metric = allMetrics.find(m => m.article?.toLowerCase() === articleLower);

    // Получаем статус по offer_id
    const statusData = metric?.id ? allStatuses[metric.id] : null;
    const status = statusData?.current_status;
    const daysInStatus = statusData?.days_in_status ?? null;

    if (!status) return { color: 'bg-slate-300', days: null, status: null };

    const config = offerStatusService.getStatusColor(status);
    return {
      color: config.color, // например 'bg-green-500'
      days: daysInStatus,
      status: status
    };
  };

  // Получение актуальных метрик для отчета - данные подтягиваются динамически
  const getReportMetric = useCallback((report) => {
    // Если есть обновленные данные из updateVisibleReportsMetrics - приоритет им
    if (updatedMetricsMap[report.article]) {
      return updatedMetricsMap[report.article];
    }

    // Иначе ищем в загруженных метриках по артикулу
    const articleLower = report.article?.toLowerCase();
    const baseMetric = allMetrics.find(m => m.article?.toLowerCase() === articleLower) || {};

    return baseMetric;
  }, [updatedMetricsMap, allMetrics]);

  // Проверка, идет ли какое-либо обновление
  const isAnyLoading = loadingCplLeads || loadingDays || loadingStock || loadingZones;

  // ========== ГЛАВНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ МЕТРИК ДЛЯ ВИДИМЫХ ОТЧЕТОВ ==========
  const updateVisibleReportsMetrics = useCallback(async (forDate = null) => {
    // Фильтруем отчеты по дате если указана
    let reportsToUpdate = savedReports;
    if (forDate) {
      reportsToUpdate = savedReports.filter(r => {
        const reportDate = new Date(r.createdAt);
        reportDate.setHours(0, 0, 0, 0);
        const targetDate = new Date(forDate);
        targetDate.setHours(0, 0, 0, 0);
        return reportDate.getTime() === targetDate.getTime();
      });
      console.log(`📅 Фильтруем отчеты для даты ${forDate.toLocaleDateString('ru')}: найдено ${reportsToUpdate.length} отчетов`);
    }

    // Получаем уникальные артикулы из отфильтрованных отчетов
    const uniqueArticles = [...new Set(reportsToUpdate.map(r => r.article))];

    if (uniqueArticles.length === 0) {
      console.log('⚠️ Нет артикулов для обновления');
      return;
    }

    console.log(`🔄 Обновляем метрики для ${uniqueArticles.length} артикулов...`);

    // Создаем массив метрик только для видимых артикулов
    // Данные берём из загруженных allMetrics по артикулу
    const visibleMetrics = uniqueArticles.map(article => {
      const articleLower = article.toLowerCase();
      const baseMetric = allMetrics.find(m => m.article?.toLowerCase() === articleLower) || {};
      return {
        id: baseMetric.id,
        article: article,
        offer: baseMetric.offer || baseMetric.offer_name,
        stock_quantity: baseMetric.stock_quantity,
        offer_price: baseMetric.offer_price,
        ...baseMetric
      };
    }).filter(m => m.article);

    // Создаем карту артикулов -> offer_id только для видимых
    const visibleArticleOfferMap = {};
    uniqueArticles.forEach(article => {
      if (articleOfferMap[article]) {
        visibleArticleOfferMap[article] = articleOfferMap[article];
      }
    });

    console.log(`📊 Доступно ${Object.keys(visibleArticleOfferMap).length} маппингов для видимых артикулов`);

    try {
      // ШАГ 1: Загружаем остатки (Ост., Приход)
      setLoadingStock(true);
      let updatedMetrics = [...visibleMetrics];

      try {
        const stocksResult = await updateStocksFromYml(updatedMetrics);
        updatedMetrics = stocksResult.metrics;
        setStockData(stocksResult.skuData || {}); // Сохраняем данные для тултипа
        console.log('✅ Остатки обновлены');
      } catch (error) {
        console.error('❌ Ошибка загрузки остатков:', error);
      } finally {
        setLoadingStock(false);
      }

      // ШАГ 2: Загружаем зоны эффективности (ROI, Апрув, Выкуп, red_zone_price)
      // ВАЖНО: Зоны должны быть загружены ДО расчета рейтинга, т.к. рейтинг зависит от red_zone_price
      setLoadingZones(true);

      try {
        const zonesResult = await effectivityZonesService.enrichMetricsWithZones(updatedMetrics);
        updatedMetrics = zonesResult;
        console.log('✅ Зоны эффективности обновлены');
      } catch (error) {
        console.error('❌ Ошибка загрузки зон:', error);
      } finally {
        setLoadingZones(false);
      }

      // ШАГ 3: Рассчитываем дни продаж (Дни)
      setLoadingDays(true);
      let rawData = null;

      try {
        const daysResult = await calculateRemainingDays(updatedMetrics, visibleArticleOfferMap);
        updatedMetrics = daysResult.metrics;
        rawData = daysResult.rawData; // Сохраняем для следующего шага
        console.log('✅ Дни продаж рассчитаны');
      } catch (error) {
        console.error('❌ Ошибка расчета дней:', error);
      } finally {
        setLoadingDays(false);
      }

      // ШАГ 4: Обновляем CPL, Лиды, Рейтинг
      // Теперь red_zone_price уже доступен из шага 2, рейтинг будет рассчитан корректно
      setLoadingCplLeads(true);

      try {
        const leadsResult = await updateLeadsFromSql(updatedMetrics, visibleArticleOfferMap, rawData);
        updatedMetrics = leadsResult.metrics;
        console.log('✅ CPL, Лиды, Рейтинг обновлены');
      } catch (error) {
        console.error('❌ Ошибка загрузки CPL/Лидов:', error);
      } finally {
        setLoadingCplLeads(false);
      }

      // Сохраняем обновленные метрики в map по артикулу
      const newMetricsMap = {};
      updatedMetrics.forEach(metric => {
        if (metric.article) {
          newMetricsMap[metric.article] = metric;
        }
      });

      setUpdatedMetricsMap(prev => ({ ...prev, ...newMetricsMap }));
      console.log(`✅ Обновлено ${Object.keys(newMetricsMap).length} метрик`);

    } catch (error) {
      console.error('❌ Ошибка обновления метрик:', error);
    }
  }, [savedReports, articleOfferMap, allMetrics]);

  // ========== АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ МЕТРИК ==========

  // Автоматическое обновление при загрузке отчетов из БД
  useEffect(() => {
    if (savedReports.length > 0 && !loadingReports && Object.keys(articleOfferMap).length > 0) {
      // Обновляем метрики для выбранной даты или сегодня при первой загрузке
      const dateToUpdate = selectedDate || new Date();
      console.log(`🚀 Автообновление метрик для ${dateToUpdate.toLocaleDateString('ru')}`);
      updateVisibleReportsMetrics(dateToUpdate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingReports, articleOfferMap]);

  // Автоматическое обновление при смене выбранной даты
  useEffect(() => {
    if (selectedDate && savedReports.length > 0 && Object.keys(articleOfferMap).length > 0 && !isAnyLoading) {
      console.log(`📅 Смена даты: обновляем метрики для ${selectedDate.toLocaleDateString('ru')}`);
      updateVisibleReportsMetrics(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // ========== СИСТЕМА ТУЛТИПОВ ==========

  // Функция генерации заголовка тултипа
  const getTooltipTitleSync = (type, article) => {
    const articleBadge = article ? (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        {article}
      </span>
    ) : null;
    const titles = {
      cpl: 'CPL по периодам',
      leads: 'Лиды по периодам',
      rating: 'История рейтинга',
      zone: 'Зоны эффективности',
      stock: 'Остатки по модификациям',
      date: 'Дата прихода',
      season: 'Сезонность'
    };
    return <div className="flex items-center gap-2"><span>{titles[type] || 'Информация'}</span>{articleBadge}</div>;
  };

  // Функция генерации контента тултипа
  const renderTooltipContentSync = useCallback((type, data) => {
    const getRatingColorLocal = (rating) => {
      switch (rating) {
        case 'A': return 'bg-green-100 text-green-800';
        case 'B': return 'bg-yellow-100 text-yellow-800';
        case 'C': return 'bg-orange-100 text-orange-800';
        case 'D': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-400';
      }
    };
    const getZoneColorsLocal = (zoneType) => {
      switch (zoneType) {
        case 'red': return { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' };
        case 'pink': return { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' };
        case 'gold': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
        case 'green': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
        default: return null;
      }
    };
    const formatDateLocal = (dateString) => {
      if (!dateString) return '—';
      try { return new Date(dateString).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
      catch { return '—'; }
    };

    switch (type) {
      case 'rating':
        return (
          <div className="flex flex-col gap-2">
            {data.ratingHistory?.length > 0 ? data.ratingHistory.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-xs border-b border-gray-100 pb-2 last:border-b-0">
                <span className="text-gray-600 w-20">{item.month} {item.year}</span>
                <span className={`font-semibold px-2 py-1 rounded ${getRatingColorLocal(item.rating)}`}>{item.rating}</span>
                <span className="text-gray-700 font-mono">CPL: {item.cpl > 0 ? item.cpl.toFixed(2) : '—'}</span>
                <span className="text-gray-700">Лиды: {item.leads}</span>
              </div>
            )) : <div className="text-xs text-gray-500 italic">Нет данных</div>}
          </div>
        );
      case 'cpl':
      case 'leads':
        return (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left py-1 px-2">Период</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'CPL' : 'Лидов'}</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'Расход' : 'CPL'}</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'Лидов' : 'Расход'}</th>
            </tr></thead>
            <tbody>
              {[7, 14, 30, 60, 90].map(days => {
                const d = data.leadsData?.[days];
                if (!d) return null;
                return <tr key={days} className="border-b border-gray-100">
                  <td className="py-1 px-2">{d.label}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? d.cpl.toFixed(2) : d.leads}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? d.cost.toFixed(2) : d.cpl.toFixed(2)}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? d.leads : d.cost.toFixed(2)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        );
      case 'stock':
        const baseArticle = data.article?.split("-")[0];
        const mods = baseArticle && stockData[baseArticle]?.modificationsDisplay || [];
        return <div className="flex flex-col gap-1.5">
          {mods.length > 0 ? mods.map((m, i) => <div key={i} className="text-xs text-gray-700">{m}</div>) : <div className="text-xs text-gray-500 italic">Нет данных</div>}
        </div>;
      case 'date':
        return <div className="text-sm text-gray-900 font-mono">{data.date ? formatDateLocal(data.date) : 'Нет данных'}</div>;
      case 'zone':
        const m = data.metric;
        return <div className="flex flex-col gap-2">
          {['red', 'pink', 'gold', 'green'].map(z => {
            const price = m[`${z}_zone_price`];
            if (price == null) return null;
            const c = getZoneColorsLocal(z);
            return <div key={z} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-20 capitalize">{z === 'red' ? 'Красная' : z === 'pink' ? 'Розовая' : z === 'gold' ? 'Золотая' : 'Зеленая'}:</span>
              <span className={`font-mono px-2 py-1 rounded-full text-xs border ${c.bg} ${c.text} ${c.border}`}>${Number(price).toFixed(2)}</span>
            </div>;
          })}
        </div>;
      case 'season':
        return <div className="flex flex-col gap-3">
          <div><div className="text-xs font-medium text-gray-600 mb-1">Категория:</div><div className="text-sm">{data.category || '—'}</div></div>
          {data.categoryDetails?.length > 0 && <div><div className="text-xs font-medium text-gray-600 mb-1">Категории товаров:</div>
            {data.categoryDetails.map((d, i) => <div key={i} className="text-xs text-gray-700">{d}</div>)}
          </div>}
          <div><div className="text-xs font-medium text-gray-600 mb-1">Спецсезон:</div>
            {data.specialSeasonStart || data.specialSeasonEnd ? <div className="text-sm font-mono">{data.specialSeasonStart || '—'} — {data.specialSeasonEnd || '—'}</div> : <div className="text-sm text-gray-500 italic">Не задан</div>}
          </div>
        </div>;
      default:
        return <div>Неизвестный тип</div>;
    }
  }, [stockData]);

  // Функция открытия тултипа
  const openTooltip = useCallback((type, index, data, event) => {
    if (!tooltipManagerRef.current) return;

    const tooltipId = `${type}-${index}`;
    let position = { x: 100, y: 100 };
    if (event && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      position = { x: rect.left + rect.width + 10, y: rect.top };
    }

    const title = getTooltipTitleSync(type, data.article);
    const content = renderTooltipContentSync(type, data);

    tooltipManagerRef.current.open(tooltipId, title, content, position);
  }, [renderTooltipContentSync]);

  // Автообновление метрик при добавлении новых отчетов
  const prevReportsCountRef = useRef(0);
  useEffect(() => {
    const currentCount = savedReports.length;
    const prevCount = prevReportsCountRef.current;

    // Если добавились новые отчеты - запускаем обновление сразу
    if (currentCount > prevCount) {
      console.log(`📈 Добавлено ${currentCount - prevCount} новых отчетов, запускаем обновление...`);
      // Сразу ставим loading для всех колонок
      setLoadingStock(true);
      setLoadingDays(true);
      setLoadingCplLeads(true);
      setLoadingZones(true);
      updateVisibleReportsMetrics();
    }

    prevReportsCountRef.current = currentCount;
  }, [savedReports.length, updateVisibleReportsMetrics]);

  // Определяем название панели в зависимости от роли
  const isTeamlead = user?.role === 'teamlead';
  const panelTitle = isTeamlead ? 'Отчеты по байерам' : 'Отчет по действиям';

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {panelTitle}
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            {/* Кнопка обновления метрик */}
            <button
              onClick={updateVisibleReportsMetrics}
              disabled={isAnyLoading || savedReports.length === 0}
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 transition-all duration-200 shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isAnyLoading ? 'animate-spin' : ''}`} />
              Обновить метрики
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              disabled={loadingMetrics}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm disabled:opacity-50"
            >
              {loadingMetrics ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Создать отчет
            </button>
          </div>
        </div>
      </div>

      {/* Календарь - горизонтальные карточки */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        {/* Карточки дней с snap-скроллом */}
        <div
          ref={calendarRef}
          className="flex space-x-2 overflow-x-auto pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          onScroll={(e) => {
            const el = e.target;
            const scrollPercent = el.scrollLeft / (el.scrollWidth - el.clientWidth) * 100;
            setCalendarScrollPercent(scrollPercent || 0);
          }}
        >
          {calendarDays.map((day, index) => {
            const isSelected = selectedDate && selectedDate.getTime() === day.date.getTime();
            const isToday = day.isToday;

            let containerClass = '';
            let dateClass = '';
            let countClass = '';

            if (isSelected) {
              containerClass = 'bg-blue-500 border-blue-500 shadow-md shadow-blue-200';
              dateClass = 'bg-blue-400 text-white';
              countClass = 'text-white';
            } else if (isToday) {
              containerClass = 'bg-white border-2 border-blue-400 shadow-sm';
              dateClass = 'bg-slate-100 text-blue-600';
              countClass = 'text-slate-600';
            } else {
              containerClass = 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm';
              dateClass = 'bg-slate-100 text-slate-500';
              countClass = 'text-slate-600';
            }

            return (
              <div
                key={index}
                onClick={() => handleDayClick(day)}
                className={`flex-shrink-0 flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 snap-start ${containerClass}`}
              >
                <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-md text-xs font-medium ${dateClass}`}>
                  <span className="text-sm font-bold leading-none">{day.day}</span>
                  <span className="text-[10px] leading-none mt-0.5">{day.month}</span>
                </div>
                <div className={`flex items-center gap-1.5 ${countClass}`}>
                  <span className="text-sm font-medium">Товаров</span>
                  <span className="text-lg font-bold">{day.tasksCount}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Простой слайдер */}
        <div className="mt-3 px-2">
          <input
            type="range"
            min="0"
            max={calendarDays.length - 1}
            value={Math.round((calendarScrollPercent / 100) * (calendarDays.length - 1))}
            onChange={(e) => {
              const dayIndex = Number(e.target.value);
              const percent = (dayIndex / (calendarDays.length - 1)) * 100;
              setCalendarScrollPercent(percent);

              // Скроллим карточки
              if (calendarRef.current) {
                const maxScroll = calendarRef.current.scrollWidth - calendarRef.current.clientWidth;
                calendarRef.current.scrollLeft = (percent / 100) * maxScroll;
              }

              // Выбираем день
              if (calendarDays[dayIndex]) {
                setSelectedDate(calendarDays[dayIndex].date);
              }
            }}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>

      {/* Панель поиска и фильтров - стиль как в OffersTL */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
        <div className="flex items-center space-x-4">
          {/* Кнопка фильтров */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-lg border transition-all duration-200 ${
              showFilters
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
            title="Фильтры"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12L5 4" />
              <path d="M19 20L19 17" />
              <path d="M5 20L5 16" />
              <path d="M19 13L19 4" />
              <path d="M12 7L12 4" />
              <path d="M12 20L12 11" />
              <circle cx="5" cy="14" r="2" />
              <circle cx="12" cy="9" r="2" />
              <circle cx="19" cy="15" r="2" />
            </svg>
          </button>

          {/* Поиск */}
          <div className="w-72 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по артикулу или названию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 hover:bg-white transition-colors"
            />
          </div>

          {/* Кнопка пресетов и панель пресетов */}
          <div className="flex items-center">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium rounded-lg border transition-all duration-200 ${
                showPresets
                  ? 'bg-blue-50 border-blue-300 text-blue-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              Пресеты
              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${showPresets ? 'rotate-180' : ''}`} />
            </button>

            {/* Панель пресетов с анимацией */}
            <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-in-out ${
              showPresets ? 'max-w-[600px] opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'
            }`}>
              {presetButtons.map((preset) => (
                <button
                  key={preset.id}
                  className="px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Заголовки таблицы - стиль как в OffersTL */}
      <div className="bg-slate-100 border-b border-slate-300 px-4 py-2.5 overflow-hidden">
        <div className="flex items-center text-xs font-semibold text-slate-600">
          <div className="w-[3%] min-w-[25px] text-center">№</div>
          <div className="w-[6%] min-w-[55px] text-center">Артикул</div>
          <div className={`${isTeamlead ? 'w-[12%] min-w-[90px]' : 'w-[20%] min-w-[150px]'} text-left`}>Название</div>
          <div className="w-[5%] min-w-[45px] text-center">Статус</div>
          {isTeamlead && <div className="w-[8%] min-w-[70px] text-center">Байер</div>}
          <div className="w-[5%] min-w-[42px] text-center">CPL</div>
          <div className="w-[4%] min-w-[35px] text-center">Лиды</div>
          <div className="w-[3%] min-w-[30px] text-center" title="Рейтинг">
            <Star className="h-3.5 w-3.5 mx-auto text-slate-500" />
          </div>
          <div className="w-[5%] min-w-[38px] text-center">ROI</div>
          <div className="w-[6%] min-w-[50px] text-center">CPL зона</div>
          <div className="w-[5%] min-w-[42px] text-center">Прибыль</div>
          <div className="w-[4%] min-w-[32px] text-center">Дни</div>
          <div className="w-[4%] min-w-[32px] text-center">Ост.</div>
          <div className="w-[5%] min-w-[38px] text-center">Приход</div>
          <div className="w-[5%] min-w-[40px] text-center">Апрув</div>
          <div className="w-[5%] min-w-[40px] text-center">Выкуп</div>
          <div className="w-[5%] min-w-[55px] text-center">Сезон</div>
          <div className="w-[5%] min-w-[50px] text-center">Цена</div>
          <div className="w-[5%] min-w-[35px]"></div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 overflow-auto">
        {filteredReports.length === 0 ? (
          <div className="text-center text-slate-500 py-12">
            <Calendar className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Нет данных для отображения
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Нажмите "Создать отчет" чтобы добавить артикулы
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={loadingMetrics}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать отчет
            </button>
          </div>
        ) : (
          <div className="px-4 py-2">
            {filteredReports.map((report, index) => {
              const statusDisplay = getStatusDisplay(report);
              const metric = getReportMetric(report);

              // Определение цвета рейтинга
              const getRatingColor = (rating) => {
                switch (rating) {
                  case 'A': return 'bg-green-100 text-green-800';
                  case 'B': return 'bg-yellow-100 text-yellow-800';
                  case 'C': return 'bg-orange-100 text-orange-800';
                  case 'D': return 'bg-red-100 text-red-800';
                  default: return 'bg-gray-100 text-gray-400';
                }
              };

              // Цвет для типа действия
              const getActionColor = (action) => {
                switch (action) {
                  case 'Перенастроил': return 'bg-blue-50 text-blue-700 border-blue-200';
                  case 'Новинка': return 'bg-green-50 text-green-700 border-green-200';
                  case 'ТЗ': return 'bg-purple-50 text-purple-700 border-purple-200';
                  case 'Выключил': return 'bg-red-50 text-red-700 border-red-200';
                  case 'Включил': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  default: return 'bg-slate-50 text-slate-600 border-slate-200';
                }
              };

              // Формирование текста действия
              const actionText = report.subAction
                ? `${report.action}: ${report.subAction}${report.customText ? ` — ${report.customText}` : ''}`
                : report.action || '—';

              return (
                <div
                  key={report.id}
                  className="bg-white rounded-lg border border-slate-200 mb-2 hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Основная строка с метриками */}
                  <div className="flex items-center text-sm px-4 py-3">
                    <div className="w-[3%] min-w-[25px] text-center text-slate-500 font-medium">
                    {index + 1}
                  </div>
                  <div className="w-[6%] min-w-[55px] text-center">
                    <span className="font-mono text-xs text-slate-800">
                      {report.article}
                    </span>
                  </div>
                  <div className={`${isTeamlead ? 'w-[12%] min-w-[90px]' : 'w-[20%] min-w-[150px]'} text-left text-slate-700 truncate pr-2`} title={metric.offer}>
                    {metric.offer || '—'}
                  </div>
                  {/* Статус - кружок + дни */}
                  <div className="w-[5%] min-w-[45px] flex items-center justify-center gap-1" title={statusDisplay.status ? `${statusDisplay.status} • ${statusDisplay.days ?? 0} дней` : ''}>
                    <span className={`w-3 h-3 rounded-full ${statusDisplay.color} shadow-sm border border-white`}></span>
                    <span className="text-xs font-medium text-slate-700">
                      {statusDisplay.days !== null ? `${statusDisplay.days}д` : '—'}
                    </span>
                  </div>
                  {/* Байер - аватар + имя (только для тимлида) */}
                  {isTeamlead && (
                    <div className="w-[8%] min-w-[70px] flex items-center justify-center gap-1.5">
                      {(() => {
                        const buyerUser = allUsers.find(u => u.id === report.createdBy);
                        const avatarUrl = buyerUser?.avatar_url;
                        const buyerName = report.createdByName || buyerUser?.name || '—';
                        return (
                          <>
                            <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={buyerName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${avatarUrl ? 'hidden' : ''}`}>
                                <User className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-xs text-slate-700 truncate" title={buyerName}>
                              {buyerName.split(' ')[0]}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}

                    {/* CPL - loading при loadingCplLeads */}
                    <div className="w-[5%] min-w-[42px] flex items-center justify-center gap-1">
                      {loadingCplLeads ? (
                        <SkeletonCell width="w-10" />
                      ) : (
                        <>
                          <span className={`font-mono text-xs ${metric.leads_data?.[4]?.cpl != null ? 'text-slate-800' : 'text-slate-400'}`}>
                            {metric.leads_data?.[4]?.cpl?.toFixed(2) || '—'}
                          </span>
                          {metric.leads_data && <InfoIcon onClick={(e) => openTooltip('cpl', index, { leadsData: metric.leads_data, article: report.article }, e)} />}
                        </>
                      )}
                    </div>

                    {/* Лиды - loading при loadingCplLeads */}
                    <div className="w-[4%] min-w-[35px] flex items-center justify-center gap-1">
                      {loadingCplLeads ? (
                        <SkeletonCell width="w-8" />
                      ) : (
                        <>
                          <span className={`font-mono text-xs ${metric.leads_data?.[4]?.leads != null ? 'text-slate-800' : 'text-slate-400'}`}>
                            {metric.leads_data?.[4]?.leads || '—'}
                          </span>
                          {metric.leads_data && <InfoIcon onClick={(e) => openTooltip('leads', index, { leadsData: metric.leads_data, article: report.article }, e)} />}
                        </>
                      )}
                    </div>

                    {/* Рейтинг - loading при loadingCplLeads */}
                    <div className="w-[3%] min-w-[30px] flex items-center justify-center gap-1">
                      {loadingCplLeads ? (
                        <SkeletonCell width="w-6" />
                      ) : (
                        <>
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${getRatingColor(metric.lead_rating)}`}>
                            {metric.lead_rating || '—'}
                          </span>
                          {metric.rating_history?.length > 0 && <InfoIcon onClick={(e) => openTooltip('rating', index, { ratingHistory: metric.rating_history, article: report.article }, e)} />}
                        </>
                      )}
                    </div>

                    {/* ROI - loading при loadingZones */}
                    <div className="w-[5%] min-w-[38px] text-center text-xs font-mono text-slate-700">
                      {loadingZones ? (
                        <SkeletonCell width="w-10" />
                      ) : (
                        metric.actual_roi_percent != null ? `${metric.actual_roi_percent}%` : '—'
                      )}
                    </div>

                    {/* CPL зона - loading при loadingZones */}
                    <div className="w-[6%] min-w-[50px] flex items-center justify-center gap-1">
                      {loadingZones ? (
                        <SkeletonCell width="w-12" />
                      ) : (
                        <>
                          {metric.red_zone_price != null ? (
                            <span className="font-mono inline-flex items-center px-1 py-0.5 rounded-full text-[10px] border bg-red-100 text-red-800 border-red-200">
                              ${Number(metric.red_zone_price).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                          <InfoIcon onClick={(e) => openTooltip('zone', index, { metric, article: report.article }, e)} />
                        </>
                      )}
                    </div>

                    {/* Прибыль */}
                    <div className="w-[5%] min-w-[42px] text-center text-xs font-mono text-green-600 font-medium">
                      {metric.profit != null ? `$${metric.profit}` : '—'}
                    </div>

                    {/* Дни - loading при loadingDays */}
                    <div className="w-[4%] min-w-[32px] text-center text-xs text-slate-700">
                      {loadingDays ? (
                        <SkeletonCell width="w-8" />
                      ) : (
                        metric.days_remaining ?? '—'
                      )}
                    </div>

                    {/* Ост. - loading при loadingStock */}
                    <div className="w-[4%] min-w-[32px] text-center text-xs font-mono text-slate-800">
                      {loadingStock ? (
                        <SkeletonCell width="w-8" />
                      ) : (
                        metric.stock_quantity ?? '—'
                      )}
                    </div>

                    {/* Приход - дней до прихода */}
                    <div className="w-[5%] min-w-[38px] text-center text-xs font-mono">
                      {(() => {
                        const daysUntil = calculateDaysUntilArrival(metric.next_calculated_arrival);
                        if (daysUntil === null) {
                          return <span className="text-slate-400">—</span>;
                        }
                        return (
                          <span className={daysUntil < 0 ? 'text-red-600' : 'text-green-600'}>
                            {daysUntil}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Апрув - loading при loadingZones */}
                    <div className="w-[5%] min-w-[40px] text-center text-xs text-slate-700">
                      {loadingZones ? (
                        <SkeletonCell width="w-10" />
                      ) : (
                        metric.approve_percent != null ? `${metric.approve_percent}%` : '—'
                      )}
                    </div>

                    {/* Выкуп - loading при loadingZones */}
                    <div className="w-[5%] min-w-[40px] text-center text-xs text-slate-700">
                      {loadingZones ? (
                        <SkeletonCell width="w-10" />
                      ) : (
                        metric.sold_percent != null ? `${metric.sold_percent}%` : '—'
                      )}
                    </div>

                    {/* Сезон */}
                    <div className="w-[5%] min-w-[55px] text-center whitespace-nowrap">
                      <span className="text-sm">{offerSeasons[report.article]?.length > 0
                        ? offerSeasons[report.article].join('')
                        : <span className="text-slate-400 text-xs">—</span>
                      }</span>
                    </div>
                    {/* Цена */}
                    <div className="w-[5%] min-w-[50px] text-center font-mono text-xs text-slate-800">
                      {metric.offer_price ? `${Number(metric.offer_price).toFixed(0)}₴` : '—'}
                    </div>
                    <div className="w-[5%] min-w-[35px] text-center">
                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Удалить отчет"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Панель с типом действия */}
                  <div className={`px-4 py-2 border-t ${getActionColor(report.action)} flex items-center gap-3`}>
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-60">Действие:</span>
                    <span className="text-sm font-medium">{actionText}</span>
                    {report.trelloLink && (
                      <a
                        href={report.trelloLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM10.5 17.25a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5v-10.5a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5v10.5zm9-4.5a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5v-6a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5v6z"/>
                        </svg>
                        Trello
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модальное окно создания отчета */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-white rounded-xl shadow-2xl mx-4 transition-all duration-300 ${
            modalStep === 1 ? 'w-full max-w-md' : 'w-full max-w-3xl'
          }`}>
            {/* Header модального окна */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  {modalStep === 1 ? 'Создать отчет' : 'Настройка артикулов'}
                </h3>
                {modalStep === 2 && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                    {Object.values(articleConfigs).filter(c => !c.isInvalid).length} артикул(ов)
                  </span>
                )}
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Ошибка валидации */}
            {modalStep === 2 && validationError && (
              <div className="mx-6 mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Ошибка валидации</p>
                  <p className="text-sm text-red-600">{validationError}</p>
                </div>
              </div>
            )}

            {/* Body модального окна */}
            <div className="px-6 py-4 max-h-[60vh] overflow-auto">
              {modalStep === 1 ? (
                <>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Артикулы
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    Введите артикулы, по одному в каждой строке
                  </p>
                  <textarea
                    value={articlesInput}
                    onChange={(e) => setArticlesInput(e.target.value)}
                    placeholder={"R00009\nC01063\nC01064"}
                    className="w-full h-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono bg-slate-50"
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    {parsedArticles.length} артикул(ов)
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500 mb-4">
                    Укажите действие для каждого артикула
                  </p>
                  <div className="space-y-1">
                    {Object.entries(articleConfigs).map(([article, config]) => (
                      <ArticleConfigRow
                        key={article}
                        article={article}
                        config={config}
                        onChange={(newConfig) => {
                          updateArticleConfig(article, newConfig);
                          // Очищаем ошибки валидации при изменении
                          setConfigValidationErrors(prev => {
                            const next = { ...prev };
                            delete next[article];
                            return next;
                          });
                        }}
                        onRemove={() => removeArticle(article)}
                        isInvalid={config.isInvalid}
                        validationErrors={configValidationErrors[article] || {}}
                      />
                    ))}
                  </div>
                  {Object.keys(articleConfigs).length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      Нет артикулов для настройки
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer модального окна */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <div>
                {modalStep === 2 && (
                  <button
                    onClick={() => {
                      setModalStep(1);
                      setValidationError('');
                      setInvalidArticles([]);
                      setConfigValidationErrors({});
                    }}
                    className="text-sm text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    ← Назад к вводу артикулов
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Отмена
                </button>
                {modalStep === 1 ? (
                  <button
                    onClick={handleApplyArticles}
                    disabled={parsedArticles.length === 0 || validatingArticles}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {validatingArticles && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Применить
                  </button>
                ) : (
                  <button
                    onClick={handleSaveReport}
                    disabled={!allArticlesConfigured || !hasValidArticles}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Сохранить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Менеджер тултипов */}
      <TooltipManager ref={tooltipManagerRef} />
    </div>
  );
}

export default ActionReports;
