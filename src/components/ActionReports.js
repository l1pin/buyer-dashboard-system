// src/components/ActionReports.js
// Вкладка "Отчеты по действию" для Тим лида и Байера

import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  SlidersHorizontal
} from 'lucide-react';

function ActionReports({ user }) {
  // Состояния
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [articlesInput, setArticlesInput] = useState('');

  // Состояние календаря
  const [calendarStartDate, setCalendarStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7); // Начинаем с недели назад
    return today;
  });

  // Генерация дней для календаря (14 дней)
  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(calendarStartDate);
      date.setDate(date.getDate() + i);
      days.push({
        date: date,
        day: date.getDate(),
        month: date.toLocaleString('ru', { month: 'short' }),
        isToday: date.toDateString() === new Date().toDateString(),
        // Пока заглушка для данных
        label: i % 3 === 0 ? 'Товаров' : 'Задач',
        count: Math.floor(Math.random() * 50) + 10
      });
    }
    return days;
  }, [calendarStartDate]);

  // Навигация по календарю
  const handleCalendarPrev = () => {
    const newDate = new Date(calendarStartDate);
    newDate.setDate(newDate.getDate() - 7);
    setCalendarStartDate(newDate);
  };

  const handleCalendarNext = () => {
    const newDate = new Date(calendarStartDate);
    newDate.setDate(newDate.getDate() + 7);
    setCalendarStartDate(newDate);
  };

  // Фильтры (заглушки)
  const filterButtons = [
    { id: 'statuses', label: 'Статусы' },
    { id: 'zones', label: 'Зоны эффек-ти' },
    { id: 'change-status', label: 'Поменять статус' }
  ];

  const presetButtons = [
    { id: 'filter1', label: 'Фильтр1' },
    { id: 'filter2', label: 'Фильтр1' },
    { id: 'filter3', label: 'Фильтр1' },
    { id: 'filter4', label: 'Фильтр1' },
    { id: 'filter5', label: 'Фильтр1' },
    { id: 'filter6', label: 'Фильтр1' }
  ];

  const sortButtons = [
    { id: 'sort', label: 'Сортировка' },
    { id: 'f1', label: 'Фильтр1' },
    { id: 'f2', label: 'Фильтр2' },
    { id: 'f3', label: 'Фильтр3' },
    { id: 'f4', label: 'Фильтр4' },
    { id: 'f5', label: 'Фильтр5' }
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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue="all"
            >
              <option value="all">Все байеры</option>
            </select>
          </div>

          <div className="text-sm text-gray-500">
            Последние 7 дней
          </div>
        </div>
      </div>

      {/* Календарь задач */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">Календарь задач</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCalendarPrev}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="h-4 w-4 text-gray-500" />
            </button>
            <button
              onClick={handleCalendarNext}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex space-x-2 overflow-x-auto pb-2">
          {calendarDays.map((day, index) => (
            <div
              key={index}
              className={`flex-shrink-0 w-20 px-3 py-2 rounded-lg border text-center cursor-pointer transition-colors ${
                day.isToday
                  ? 'bg-green-50 border-green-300'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-xs text-gray-500">{day.label}</div>
              <div className={`text-lg font-semibold ${day.isToday ? 'text-green-600' : 'text-gray-700'}`}>
                {day.day}
              </div>
              <div className="text-xs text-gray-500">{day.month}</div>
              <div className="text-xs text-gray-400 mt-1">{day.count}</div>
            </div>
          ))}
        </div>

        {/* Прогресс-бар под календарем */}
        <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-400 via-green-400 to-green-500" style={{ width: '60%' }} />
        </div>
      </div>

      {/* Панель поиска и фильтров */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Поиск */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Поиск название или СКУ"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 pl-3 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
            <button className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors">
              Применить
            </button>
          </div>

          {/* Фильтры */}
          <div className="flex items-center space-x-2">
            {filterButtons.map(btn => (
              <button
                key={btn.id}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {btn.label}
              </button>
            ))}
            <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-1">
              <span>Отправить приход</span>
            </button>
          </div>

          {/* Кнопка создания отчета */}
          <div className="ml-auto">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Создать отчет</span>
            </button>
          </div>
        </div>

        {/* Вторая строка фильтров */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Пресеты слева */}
          <div className="flex items-center space-x-2">
            {presetButtons.slice(0, 6).map(btn => (
              <button
                key={btn.id}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Сортировка и фильтры справа */}
          <div className="ml-auto flex items-center space-x-2">
            {sortButtons.map(btn => (
              <button
                key={btn.id}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Заголовки таблицы (заглушка) */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex items-center text-xs text-gray-500 space-x-4">
          <span className="w-12">***</span>
          <span className="w-20">***</span>
          <span className="w-32">***</span>
          <span className="w-16">***</span>
          <span className="w-16">***</span>
          <span className="w-16">***</span>
          <span className="w-16">***</span>
          <span className="w-16">***</span>
          <span className="w-16">***</span>
          <span className="w-16">***</span>
          <span className="w-16">***</span>
          <span className="w-16">***</span>
          <span className="w-16">***</span>
          <span className="w-16">***</span>
        </div>
      </div>

      {/* Основной контент (пока пустой) */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="text-center text-gray-500 py-12">
          <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-lg font-medium">Нет данных для отображения</p>
          <p className="text-sm mt-1">Нажмите "Создать отчет" чтобы добавить артикулы</p>
        </div>
      </div>

      {/* Модальное окно создания отчета */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            {/* Header модального окна */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Создать отчет</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Body модального окна */}
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Артикулы
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Введите артикулы, по одному в каждой строке
              </p>
              <textarea
                value={articlesInput}
                onChange={(e) => setArticlesInput(e.target.value)}
                placeholder="C01063&#10;C01064&#10;C01065"
                className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
              />
              <p className="text-xs text-gray-400 mt-2">
                {articlesInput.split('\n').filter(a => a.trim()).length} артикул(ов)
              </p>
            </div>

            {/* Footer модального окна */}
            <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
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
