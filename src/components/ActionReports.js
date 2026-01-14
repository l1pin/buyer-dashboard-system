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
  Trash2
} from 'lucide-react';

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
  { value: 'other', label: 'Другое' }
];

// Опции для "Новинка"
const NEW_PRODUCT_OPTIONS = [
  { value: 'from_old', label: 'Из старого' },
  { value: 'from_new', label: 'Из нового' }
];

// Компонент выпадающего списка
function CustomDropdown({ value, options, onChange, placeholder = 'Выберите...', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
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
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
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
function ArticleConfigRow({ article, config, onChange, onRemove }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-b-0">
      {/* Артикул */}
      <div className="w-24 flex-shrink-0">
        <span className="font-mono text-sm font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
          {article}
        </span>
      </div>

      {/* Действие */}
      <div className="flex-1 flex flex-wrap items-center gap-2">
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

  // Ref для горизонтального скролла календаря
  const calendarRef = useRef(null);

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
        // Пока заглушка для данных
        tasksCount: Math.floor(Math.random() * 20)
      });
    }
    return days;
  }, []);

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

  // Обработка нажатия "Применить" - переход к шагу 2
  const handleApplyArticles = () => {
    // Инициализируем конфигурации для каждого артикула
    const configs = {};
    parsedArticles.forEach(article => {
      configs[article] = {
        action: '',
        subAction: '',
        customText: '',
        trelloLink: ''
      };
    });
    setArticleConfigs(configs);
    setModalStep(2);
  };

  // Обновление конфигурации артикула
  const updateArticleConfig = (article, config) => {
    setArticleConfigs(prev => ({
      ...prev,
      [article]: config
    }));
  };

  // Удаление артикула из списка
  const removeArticle = (article) => {
    setArticleConfigs(prev => {
      const newConfigs = { ...prev };
      delete newConfigs[article];
      return newConfigs;
    });
  };

  // Обработка сохранения
  const handleSaveReport = () => {
    const reports = Object.entries(articleConfigs).map(([article, config]) => ({
      id: `${article}-${Date.now()}`,
      article,
      ...config,
      createdAt: new Date().toISOString(),
      // Заглушки для метрик (в реальности загружаем из БД)
      metrics: {
        offer: `Товар ${article}`,
        status: 'active',
        cpl: (Math.random() * 10 + 5).toFixed(2),
        leads: Math.floor(Math.random() * 100),
        cost: Math.floor(Math.random() * 1000),
        roi: Math.floor(Math.random() * 50),
        profit: Math.floor(Math.random() * 5000),
        daysRemaining: Math.floor(Math.random() * 30),
        stock: Math.floor(Math.random() * 500),
        daysToArrival: Math.floor(Math.random() * 14),
        approve: Math.floor(Math.random() * 100),
        sold: Math.floor(Math.random() * 100)
      }
    }));

    setSavedReports(prev => [...prev, ...reports]);

    // Закрываем модальное окно и сбрасываем состояние
    setShowCreateModal(false);
    setModalStep(1);
    setArticlesInput('');
    setArticleConfigs({});
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setShowCreateModal(false);
    setModalStep(1);
    setArticlesInput('');
    setArticleConfigs({});
  };

  // Получение текста действия для отображения
  const getActionLabel = (report) => {
    const action = ACTION_OPTIONS.find(a => a.value === report.action);
    let label = action?.label || '—';

    if (report.action === 'reconfigured' && report.subAction) {
      const sub = RECONFIGURED_OPTIONS.find(s => s.value === report.subAction);
      label += `: ${sub?.label || report.customText || ''}`;
      if (report.subAction === 'other' && report.customText) {
        label = `Перенастроил: ${report.customText}`;
      }
    }

    if (report.action === 'new_product' && report.subAction) {
      const sub = NEW_PRODUCT_OPTIONS.find(s => s.value === report.subAction);
      label += ` (${sub?.label || ''})`;
    }

    return label;
  };

  // Проверка, все ли артикулы имеют выбранное действие
  const allArticlesConfigured = useMemo(() => {
    const articles = Object.keys(articleConfigs);
    if (articles.length === 0) return false;
    return articles.every(article => articleConfigs[article].action !== '');
  }, [articleConfigs]);

  // Фильтрация отчетов по поиску
  const filteredReports = useMemo(() => {
    if (!searchTerm) return savedReports;
    const term = searchTerm.toLowerCase();
    return savedReports.filter(r =>
      r.article.toLowerCase().includes(term) ||
      r.metrics.offer.toLowerCase().includes(term)
    );
  }, [savedReports, searchTerm]);

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
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
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
          <div className="w-[3%] min-w-[32px]">№</div>
          <div className="w-[7%] min-w-[70px]">Артикул</div>
          <div className="w-[14%] min-w-[120px] text-left">Название</div>
          <div className="w-[10%] min-w-[100px]">Действие</div>
          <div className="w-[8%] min-w-[70px]">Статус</div>
          <div className="w-[5%] min-w-[50px]">CPL</div>
          <div className="w-[5%] min-w-[45px]">Лиды</div>
          <div className="w-[6%] min-w-[55px]">Расход</div>
          <div className="w-[5%] min-w-[45px]">ROI</div>
          <div className="w-[6%] min-w-[55px]">Прибыль</div>
          <div className="w-[5%] min-w-[45px]">Дни</div>
          <div className="w-[5%] min-w-[45px]">Ост.</div>
          <div className="w-[5%] min-w-[45px]">Приход</div>
          <div className="w-[5%] min-w-[45px]">Апрув</div>
          <div className="w-[5%] min-w-[45px]">Выкуп</div>
          <div className="w-[5%] min-w-[40px]"></div>
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
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать отчет
            </button>
          </div>
        ) : (
          <div className="px-4 py-2">
            {filteredReports.map((report, index) => (
              <div
                key={report.id}
                className="flex items-center text-sm bg-white rounded-lg border border-slate-200 mb-2 px-3 py-3 hover:shadow-md transition-shadow"
              >
                <div className="w-[3%] min-w-[32px] text-center text-slate-500 font-medium">
                  {index + 1}
                </div>
                <div className="w-[7%] min-w-[70px] text-center">
                  <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {report.article}
                  </span>
                </div>
                <div className="w-[14%] min-w-[120px] text-left text-slate-700 truncate pr-2">
                  {report.metrics.offer}
                </div>
                <div className="w-[10%] min-w-[100px] text-center">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded truncate block">
                    {getActionLabel(report)}
                  </span>
                </div>
                <div className="w-[8%] min-w-[70px] text-center">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Активный
                  </span>
                </div>
                <div className="w-[5%] min-w-[50px] text-center font-mono text-slate-700">
                  ${report.metrics.cpl}
                </div>
                <div className="w-[5%] min-w-[45px] text-center font-mono text-slate-700">
                  {report.metrics.leads}
                </div>
                <div className="w-[6%] min-w-[55px] text-center font-mono text-slate-700">
                  ${report.metrics.cost}
                </div>
                <div className="w-[5%] min-w-[45px] text-center font-mono text-slate-700">
                  {report.metrics.roi}%
                </div>
                <div className="w-[6%] min-w-[55px] text-center font-mono text-green-600 font-medium">
                  ${report.metrics.profit}
                </div>
                <div className="w-[5%] min-w-[45px] text-center text-slate-700">
                  {report.metrics.daysRemaining}
                </div>
                <div className="w-[5%] min-w-[45px] text-center text-slate-700">
                  {report.metrics.stock}
                </div>
                <div className="w-[5%] min-w-[45px] text-center text-slate-700">
                  {report.metrics.daysToArrival}
                </div>
                <div className="w-[5%] min-w-[45px] text-center text-slate-700">
                  {report.metrics.approve}%
                </div>
                <div className="w-[5%] min-w-[45px] text-center text-slate-700">
                  {report.metrics.sold}%
                </div>
                <div className="w-[5%] min-w-[40px] text-center">
                  <button
                    onClick={() => setSavedReports(prev => prev.filter(r => r.id !== report.id))}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно создания отчета */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-white rounded-xl shadow-2xl mx-4 transition-all duration-300 ${
            modalStep === 1 ? 'w-full max-w-md' : 'w-full max-w-2xl'
          }`}>
            {/* Header модального окна */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  {modalStep === 1 ? 'Создать отчет' : 'Настройка артикулов'}
                </h3>
                {modalStep === 2 && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                    {Object.keys(articleConfigs).length} артикул(ов)
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
                    placeholder={"C01063\nC01064\nC01065"}
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
                    {Object.keys(articleConfigs).map((article) => (
                      <ArticleConfigRow
                        key={article}
                        article={article}
                        config={articleConfigs[article]}
                        onChange={(config) => updateArticleConfig(article, config)}
                        onRemove={() => removeArticle(article)}
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
                    onClick={() => setModalStep(1)}
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
                    disabled={parsedArticles.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Применить
                  </button>
                ) : (
                  <button
                    onClick={handleSaveReport}
                    disabled={!allArticlesConfigured || Object.keys(articleConfigs).length === 0}
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
