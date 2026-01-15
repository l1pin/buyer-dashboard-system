// src/components/ActionReports.js
// Вкладка "Отчеты по действию" для Тим лида и Байера

import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { metricsAnalyticsService } from '../supabaseClient';
import { offerStatusService } from '../services/OffersSupabase';

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
function ArticleConfigRow({ article, config, onChange, onRemove, isInvalid = false, metricData = null }) {
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

      {/* Название оффера (если найден) */}
      {metricData && (
        <div className="w-40 flex-shrink-0 text-sm text-slate-600 truncate" title={metricData.offer}>
          {metricData.offer}
        </div>
      )}

      {/* Действие */}
      <div className="flex-1 flex flex-wrap items-center gap-2">
        {!isInvalid && (
          <>
            <CustomDropdown
              value={config.action}
              options={ACTION_OPTIONS}
              onChange={(val) => onChange({ ...config, action: val, subAction: '', customText: '', trelloLink: '' })}
              placeholder="Выберите действие"
              className="w-40"
            />

            {/* Дополнительные поля в зависимости от выбора */}
            {config.action === 'reconfigured' && (
              <CustomDropdown
                value={config.subAction}
                options={RECONFIGURED_OPTIONS}
                onChange={(val) => onChange({ ...config, subAction: val, customText: '' })}
                placeholder="Что изменили?"
                className="w-36"
              />
            )}

            {config.action === 'reconfigured' && config.subAction === 'other' && (
              <input
                type="text"
                value={config.customText || ''}
                onChange={(e) => onChange({ ...config, customText: e.target.value })}
                placeholder="Укажите что..."
                className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            {config.action === 'new_product' && (
              <CustomDropdown
                value={config.subAction}
                options={NEW_PRODUCT_OPTIONS}
                onChange={(val) => onChange({ ...config, subAction: val })}
                placeholder="Откуда?"
                className="w-36"
              />
            )}

            {config.action === 'tz' && (
              <input
                type="text"
                value={config.trelloLink || ''}
                onChange={(e) => onChange({ ...config, trelloLink: e.target.value })}
                placeholder="Ссылка на Trello..."
                className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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

  // Данные офферов из БД
  const [allMetrics, setAllMetrics] = useState([]);
  const [allStatuses, setAllStatuses] = useState({});
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [validatingArticles, setValidatingArticles] = useState(false);

  // Ошибки валидации
  const [invalidArticles, setInvalidArticles] = useState([]);
  const [validationError, setValidationError] = useState('');

  // Ref для горизонтального скролла календаря
  const calendarRef = useRef(null);

  // Загрузка данных офферов при монтировании
  useEffect(() => {
    loadOffersData();
  }, []);

  const loadOffersData = async () => {
    try {
      setLoadingMetrics(true);

      // Загружаем метрики и статусы параллельно
      const [metricsResult, statusesResult] = await Promise.all([
        metricsAnalyticsService.getAllMetrics(),
        offerStatusService.getAllStatuses()
      ]);

      setAllMetrics(metricsResult.metrics || []);

      // Преобразуем статусы в map
      const statusesMap = {};
      (statusesResult || []).forEach(status => {
        statusesMap[status.offer_id] = status;
      });
      setAllStatuses(statusesMap);

    } catch (error) {
      console.error('Ошибка загрузки данных офферов:', error);
    } finally {
      setLoadingMetrics(false);
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

  // Генерация дней для календаря (сегодня слева, прошлые даты справа)
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Сегодня + 30 дней назад
    for (let i = 0; i < 31; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i); // Минус i дней (в прошлое)
      days.push({
        date: date,
        day: date.getDate(),
        weekday: date.toLocaleString('ru', { weekday: 'short' }),
        month: date.toLocaleString('ru', { month: 'short' }),
        isToday: i === 0,
        isYesterday: i === 1,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        daysAgo: i,
        // Считаем реальные задачи на этот день
        tasksCount: savedReports.filter(r => {
          const reportDate = new Date(r.createdAt);
          reportDate.setHours(0, 0, 0, 0);
          return reportDate.getTime() === date.getTime();
        }).length
      });
    }
    return days;
  }, [savedReports]);

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
  const handleSaveReport = () => {
    // Сохраняем только валидные артикулы
    const validConfigs = Object.entries(articleConfigs).filter(([_, config]) => !config.isInvalid);

    const reports = validConfigs.map(([article, config]) => {
      const metric = config.metric;
      const status = allStatuses[metric?.id];

      return {
        id: `${article}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        article,
        action: config.action,
        subAction: config.subAction,
        customText: config.customText,
        trelloLink: config.trelloLink,
        createdAt: new Date().toISOString(),
        // Реальные данные из БД
        metric: metric,
        status: status
      };
    });

    setSavedReports(prev => [...prev, ...reports]);

    // Закрываем модальное окно и сбрасываем состояние
    setShowCreateModal(false);
    setModalStep(1);
    setArticlesInput('');
    setArticleConfigs({});
    setInvalidArticles([]);
    setValidationError('');
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setShowCreateModal(false);
    setModalStep(1);
    setArticlesInput('');
    setArticleConfigs({});
    setInvalidArticles([]);
    setValidationError('');
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

  // Проверка, все ли валидные артикулы имеют выбранное действие
  const allArticlesConfigured = useMemo(() => {
    const validArticles = Object.entries(articleConfigs).filter(([_, config]) => !config.isInvalid);
    if (validArticles.length === 0) return false;
    return validArticles.every(([_, config]) => config.action !== '');
  }, [articleConfigs]);

  // Есть ли хотя бы один валидный артикул
  const hasValidArticles = useMemo(() => {
    return Object.values(articleConfigs).some(config => !config.isInvalid);
  }, [articleConfigs]);

  // Фильтрация отчетов по поиску
  const filteredReports = useMemo(() => {
    if (!searchTerm) return savedReports;
    const term = searchTerm.toLowerCase();
    return savedReports.filter(r =>
      r.article.toLowerCase().includes(term) ||
      r.metric?.offer?.toLowerCase().includes(term)
    );
  }, [savedReports, searchTerm]);

  // Получение цвета статуса
  const getStatusDisplay = (report) => {
    const status = report.status?.current_status;
    if (!status) return { label: '—', className: 'bg-slate-100 text-slate-500' };

    const config = offerStatusService.getStatusColor(status);
    return {
      label: status,
      className: `${config.color} ${config.bgColor} ${config.textColor}`
    };
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Отчеты по действию
            </h1>
          </div>
          <div className="flex items-center space-x-3">
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

      {/* Календарь задач */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-700">Календарь задач</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleCalendarScroll('left')}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            </button>
            <button
              onClick={() => handleCalendarScroll('right')}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Горизонтально скроллящийся календарь */}
        <div
          ref={calendarRef}
          className="flex space-x-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
          style={{ scrollbarWidth: 'thin' }}
        >
          {calendarDays.map((day, index) => (
            <div
              key={index}
              className={`flex-shrink-0 w-16 px-2 py-2.5 rounded-xl text-center cursor-pointer transition-all duration-200 ${
                day.isToday
                  ? 'bg-gradient-to-b from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 scale-105'
                  : day.isWeekend
                  ? 'bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                  : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div className={`text-[10px] uppercase font-medium ${day.isToday ? 'text-blue-100' : 'text-slate-400'}`}>
                {day.isToday ? 'сегодня' : day.isYesterday ? 'вчера' : day.weekday}
              </div>
              <div className={`text-xl font-bold ${day.isToday ? 'text-white' : 'text-slate-700'}`}>
                {day.day}
              </div>
              <div className={`text-[10px] ${day.isToday ? 'text-blue-100' : 'text-slate-400'}`}>
                {day.month}
              </div>
              {day.tasksCount > 0 && (
                <div className={`mt-1 text-[10px] font-medium ${day.isToday ? 'text-white' : 'text-slate-500'}`}>
                  {day.tasksCount} задач
                </div>
              )}
            </div>
          ))}
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
        <div className="flex items-center text-xs font-semibold text-slate-600 text-center">
          <div className="w-[7%] min-w-[65px]">Артикул</div>
          <div className="w-[16%] min-w-[140px] text-left">Название</div>
          <div className="w-[8%] min-w-[70px]">Статус</div>
          <div className="w-[6%] min-w-[50px]">CPL</div>
          <div className="w-[5%] min-w-[45px]">Лиды</div>
          <div className="w-[5%] min-w-[45px]">ROI</div>
          <div className="w-[7%] min-w-[55px]">Прибыль</div>
          <div className="w-[5%] min-w-[40px]">Дни</div>
          <div className="w-[5%] min-w-[40px]">Ост.</div>
          <div className="w-[6%] min-w-[45px]">Приход</div>
          <div className="w-[5%] min-w-[45px]">Апрув</div>
          <div className="w-[5%] min-w-[45px]">Выкуп</div>
          <div className="w-[6%] min-w-[50px]">Сезон</div>
          <div className="w-[6%] min-w-[50px]">Цена</div>
          <div className="w-[4%] min-w-[35px]"></div>
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
            {filteredReports.map((report) => {
              const statusDisplay = getStatusDisplay(report);
              const metric = report.metric || {};

              return (
                <div
                  key={report.id}
                  className="flex items-center text-sm bg-white rounded-lg border border-slate-200 mb-2 px-3 py-3 hover:shadow-md transition-shadow"
                >
                  <div className="w-[7%] min-w-[65px] text-center">
                    <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {report.article}
                    </span>
                  </div>
                  <div className="w-[16%] min-w-[140px] text-left text-slate-700 truncate pr-2" title={metric.offer}>
                    {metric.offer || '—'}
                  </div>
                  <div className="w-[8%] min-w-[70px] text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.className}`}>
                      {statusDisplay.label}
                    </span>
                  </div>
                  <div className="w-[6%] min-w-[50px] text-center font-mono text-slate-700">
                    {metric.leads_data?.[4]?.cpl?.toFixed(2) || '—'}
                  </div>
                  <div className="w-[5%] min-w-[45px] text-center font-mono text-slate-700">
                    {metric.leads_data?.[4]?.leads || '—'}
                  </div>
                  <div className="w-[5%] min-w-[45px] text-center font-mono text-slate-700">
                    {metric.actual_roi_percent != null ? `${metric.actual_roi_percent}%` : '—'}
                  </div>
                  <div className="w-[7%] min-w-[55px] text-center font-mono text-green-600 font-medium">
                    {metric.profit != null ? `$${metric.profit}` : '—'}
                  </div>
                  <div className="w-[5%] min-w-[40px] text-center text-slate-700">
                    {metric.days_remaining ?? '—'}
                  </div>
                  <div className="w-[5%] min-w-[40px] text-center text-slate-700">
                    {metric.stock ?? '—'}
                  </div>
                  <div className="w-[6%] min-w-[45px] text-center text-slate-700">
                    {metric.days_to_arrival ?? '—'}
                  </div>
                  <div className="w-[5%] min-w-[45px] text-center text-slate-700">
                    {metric.approve_percent != null ? `${metric.approve_percent}%` : '—'}
                  </div>
                  <div className="w-[5%] min-w-[45px] text-center text-slate-700">
                    {metric.sold_percent != null ? `${metric.sold_percent}%` : '—'}
                  </div>
                  <div className="w-[6%] min-w-[50px] text-center text-slate-700">
                    {metric.season || '—'}
                  </div>
                  <div className="w-[6%] min-w-[50px] text-center font-mono text-slate-700">
                    {metric.price != null ? `$${metric.price}` : '—'}
                  </div>
                  <div className="w-[4%] min-w-[35px] text-center">
                    <button
                      onClick={() => setSavedReports(prev => prev.filter(r => r.id !== report.id))}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
                        onChange={(newConfig) => updateArticleConfig(article, newConfig)}
                        onRemove={() => removeArticle(article)}
                        isInvalid={config.isInvalid}
                        metricData={config.metric}
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
    </div>
  );
}

export default ActionReports;
