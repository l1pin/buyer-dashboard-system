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
  RefreshCw
} from 'lucide-react';

function ActionReports({ user }) {
  // Состояния
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [articlesInput, setArticlesInput] = useState('');

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

  // Обработка создания отчета
  const handleCreateReport = () => {
    const articles = articlesInput
      .split('\n')
      .map(a => a.trim())
      .filter(a => a.length > 0);

    console.log('Создание отчета для артикулов:', articles);

    // Пока что просто закрываем модальное окно
    setShowCreateModal(false);
    setArticlesInput('');
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
          <div className="w-[8%] min-w-[70px]">Артикул</div>
          <div className="w-[16%] min-w-[140px] text-left">Название</div>
          <div className="w-[8%] min-w-[80px]">Статус</div>
          <div className="w-[6%] min-w-[60px]">CPL</div>
          <div className="w-[6%] min-w-[50px]">Лиды</div>
          <div className="w-[7%] min-w-[60px]">Расход</div>
          <div className="w-[6%] min-w-[50px]">ROI</div>
          <div className="w-[7%] min-w-[60px]">Прибыль</div>
          <div className="w-[6%] min-w-[50px]">Дни</div>
          <div className="w-[6%] min-w-[50px]">Остаток</div>
          <div className="w-[6%] min-w-[50px]">Приход</div>
          <div className="w-[6%] min-w-[50px]">Апрув</div>
          <div className="w-[6%] min-w-[50px]">Выкуп</div>
          <div className="w-[5%] min-w-[45px]">Действия</div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 overflow-auto px-4 py-4">
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
      </div>

      {/* Модальное окно создания отчета */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            {/* Header модального окна */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Создать отчет</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Body модального окна */}
            <div className="px-6 py-4">
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
              />
              <p className="text-xs text-slate-400 mt-2">
                {articlesInput.split('\n').filter(a => a.trim()).length} артикул(ов)
              </p>
            </div>

            {/* Footer модального окна */}
            <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateReport}
                disabled={!articlesInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActionReports;
