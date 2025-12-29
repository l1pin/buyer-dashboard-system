// src/components/OffersFilterPanel.js
// Панель фильтров для страницы офферов

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

// Компонент сворачиваемой секции
const FilterSection = ({ title, children, defaultOpen = false, count = null }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-medium text-slate-700">{title}</span>
        <div className="flex items-center gap-2">
          {count !== null && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              {count}
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-3">
          {children}
        </div>
      )}
    </div>
  );
};

// Компонент тега фильтра
const FilterTag = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md">
    {label}
    <button onClick={onRemove} className="hover:text-slate-900">
      <X className="h-3 w-3" />
    </button>
  </span>
);

const OffersFilterPanel = ({ isOpen, onClose }) => {
  // Заглушки для состояния фильтров
  const [selectedStatuses, setSelectedStatuses] = useState(['Активный', 'На паузе']);
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedBuyers, setSelectedBuyers] = useState([]);

  return (
    <div
      className={`bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen
          ? 'w-72 min-w-[288px] opacity-100'
          : 'w-0 min-w-0 opacity-0 border-r-0'
      }`}
      style={{
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
      }}
    >
      <div className={`flex flex-col h-full transition-opacity duration-200 ${isOpen ? 'opacity-100 delay-150' : 'opacity-0'}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Фильтры</h2>
        <div className="flex items-center gap-3">
          <button className="text-xs text-slate-500 hover:text-slate-700">
            Сбросить
          </button>
          <span className="text-slate-300">•</span>
          <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            Сохранить
          </button>
        </div>
      </div>

      {/* Saved Filters */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Загрузить фильтр</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">1</span>
          <ChevronDown className="h-3 w-3 text-slate-400 ml-auto" />
        </div>
        <input
          type="text"
          placeholder="Название фильтра..."
          className="mt-2 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Статусы */}
        <FilterSection title="Статусы" defaultOpen={true} count={selectedStatuses.length}>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {selectedStatuses.map((status, i) => (
                <FilterTag
                  key={i}
                  label={status}
                  onRemove={() => setSelectedStatuses(prev => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
            <div className="space-y-1.5 mt-2">
              {['Активный', 'На паузе', 'Тест', 'Стоп', 'Архив'].map(status => (
                <label key={status} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-800">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStatuses(prev => [...prev, status]);
                      } else {
                        setSelectedStatuses(prev => prev.filter(s => s !== status));
                      }
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {status}
                </label>
              ))}
            </div>
          </div>
        </FilterSection>

        {/* Зоны */}
        <FilterSection title="Зоны эффективности" count={selectedZones.length}>
          <div className="space-y-1.5">
            {[
              { id: 'green', label: 'Зелёная зона', color: 'bg-green-500' },
              { id: 'gold', label: 'Золотая зона', color: 'bg-yellow-500' },
              { id: 'pink', label: 'Розовая зона', color: 'bg-pink-500' },
              { id: 'red', label: 'Красная зона', color: 'bg-red-500' },
              { id: 'sos', label: 'SOS зона', color: 'bg-black' },
            ].map(zone => (
              <label key={zone.id} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-800">
                <input
                  type="checkbox"
                  checked={selectedZones.includes(zone.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedZones(prev => [...prev, zone.id]);
                    } else {
                      setSelectedZones(prev => prev.filter(z => z !== zone.id));
                    }
                  }}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`w-2.5 h-2.5 rounded-full ${zone.color}`}></span>
                {zone.label}
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Рейтинг */}
        <FilterSection title="Рейтинг">
          <div className="flex flex-wrap gap-2">
            {['A', 'B', 'C', 'D'].map(rating => (
              <label key={rating} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  rating === 'A' ? 'bg-green-100 text-green-800' :
                  rating === 'B' ? 'bg-yellow-100 text-yellow-800' :
                  rating === 'C' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {rating}
                </span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Байеры */}
        <FilterSection title="Байеры" count={selectedBuyers.length}>
          <input
            type="text"
            placeholder="Поиск байера..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
          />
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {['Иван Петров', 'Мария Сидорова', 'Алексей Козлов', 'Елена Новикова'].map(buyer => (
              <label key={buyer} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-800">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {buyer}
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Сезон */}
        <FilterSection title="Сезон">
          <div className="flex flex-wrap gap-2">
            {[
              { emoji: '☀️', label: 'Лето' },
              { emoji: '🍁', label: 'Осень' },
              { emoji: '❄️', label: 'Зима' },
              { emoji: '🌱', label: 'Весна' },
            ].map(season => (
              <label key={season.emoji} className="flex items-center gap-1.5 px-2 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{season.emoji}</span>
                <span className="text-xs text-slate-600">{season.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* CPL */}
        <FilterSection title="CPL (4 дня)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="От"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-slate-400">—</span>
            <input
              type="number"
              placeholder="До"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </FilterSection>

        {/* Лиды */}
        <FilterSection title="Лиды (4 дня)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="От"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-slate-400">—</span>
            <input
              type="number"
              placeholder="До"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </FilterSection>

        {/* Остаток */}
        <FilterSection title="Остаток">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="От"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-slate-400">—</span>
            <input
              type="number"
              placeholder="До"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </FilterSection>

        {/* Дней продаж */}
        <FilterSection title="Дней продаж">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="От"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-slate-400">—</span>
            <input
              type="number"
              placeholder="До"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </FilterSection>

        {/* Апрув % */}
        <FilterSection title="Апрув %">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="От"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-slate-400">—</span>
            <input
              type="number"
              placeholder="До"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </FilterSection>

        {/* Выкуп % */}
        <FilterSection title="Выкуп %">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="От"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-slate-400">—</span>
            <input
              type="number"
              placeholder="До"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </FilterSection>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
        <button className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Применить фильтры
        </button>
      </div>
      </div>
    </div>
  );
};

export default OffersFilterPanel;
