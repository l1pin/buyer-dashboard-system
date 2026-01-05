// src/components/OffersFilterPanel.js
// Панель фильтров для страницы офферов

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, X, Plus } from 'lucide-react';

// Конфигурация статусов с цветами (как в OffersSupabase)
const STATUS_CONFIG = [
  { value: 'Активный', label: 'Активный', color: 'bg-green-500' },
  { value: 'Пауза', label: 'Пауза', color: 'bg-yellow-500' },
  { value: 'Закончился', label: 'Закончился', color: 'bg-red-500' },
  { value: 'Отлежка', label: 'Отлежка', color: 'bg-purple-500' },
  { value: 'Передел', label: 'Передел', color: 'bg-blue-400' },
  { value: 'КЦ', label: 'КЦ', color: 'bg-teal-700' }
];

// Доступные периоды для фильтров CPL/Лиды/Расходы (соответствуют данным в leads_data)
const PERIOD_OPTIONS = [
  { value: '4', label: '4 дня' },
  { value: '7', label: '7 дней' },
  { value: '14', label: '14 дней' },
  { value: '30', label: '30 дней' },
  { value: '60', label: '60 дней' },
  { value: '90', label: '90 дней' },
];

// Кастомный Dropdown компонент
const CustomDropdown = ({ value, options, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Закрытие при клике вне компонента
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
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
      >
        <span className="text-slate-700">{selectedOption?.label || 'Выберите...'}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Выпадающий список */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-sm text-left hover:bg-blue-50 transition-colors ${
                option.value === value
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
          {count !== null && count > 0 && (
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
const FilterTag = ({ label, color, onRemove }) => (
  <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md">
    {color && <span className={`w-2 h-2 rounded-full ${color}`}></span>}
    {label}
    <button onClick={onRemove} className="hover:text-slate-900">
      <X className="h-3 w-3" />
    </button>
  </span>
);

// Компонент ввода только чисел
const NumberInput = ({ value, onChange, placeholder, className = '', allowDecimal = false }) => {
  const handleChange = (e) => {
    const val = e.target.value;
    // Разрешаем только цифры (и точку для десятичных) или пустую строку
    const pattern = allowDecimal ? /^(\d+\.?\d*)?$/ : /^\d*$/;
    if (pattern.test(val)) {
      onChange(val);
    }
  };

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={`px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
    />
  );
};

// Компонент фильтра с выбором периодов
const PeriodFilter = ({ title, periods, onChange, allowDecimal = false }) => {
  // Получаем список уже выбранных периодов
  const selectedPeriodValues = periods.map(p => p.period);

  // Доступные для добавления периоды
  const availablePeriods = PERIOD_OPTIONS.filter(
    opt => !selectedPeriodValues.includes(opt.value)
  );

  // Добавить новый период
  const handleAddPeriod = () => {
    if (availablePeriods.length === 0) return;

    // Берём первый доступный период
    const newPeriod = availablePeriods[0].value;
    onChange([...periods, { period: newPeriod, from: '', to: '' }]);
  };

  // Удалить период
  const handleRemovePeriod = (index) => {
    const newPeriods = periods.filter((_, i) => i !== index);
    onChange(newPeriods);
  };

  // Изменить период (dropdown)
  const handlePeriodChange = (index, newPeriodValue) => {
    const newPeriods = [...periods];
    newPeriods[index] = { ...newPeriods[index], period: newPeriodValue };
    onChange(newPeriods);
  };

  // Изменить значение от/до
  const handleValueChange = (index, field, value) => {
    const newPeriods = [...periods];
    newPeriods[index] = { ...newPeriods[index], [field]: value };
    onChange(newPeriods);
  };

  // Получить доступные периоды для конкретного dropdown (текущий + незанятые)
  const getAvailableOptionsForPeriod = (currentPeriod) => {
    return PERIOD_OPTIONS.filter(
      opt => opt.value === currentPeriod || !selectedPeriodValues.includes(opt.value)
    );
  };

  const activeCount = periods.filter(p => p.from !== '' || p.to !== '').length;

  return (
    <FilterSection title={title} count={activeCount}>
      <div className="space-y-3">
        {periods.map((periodItem, index) => (
          <div key={index} className="space-y-3">
            {/* Кастомный Dropdown выбора периода + кнопка удаления */}
            <div className="flex items-center gap-2">
              <CustomDropdown
                value={periodItem.period}
                options={getAvailableOptionsForPeriod(periodItem.period)}
                onChange={(value) => handlePeriodChange(index, value)}
                className="flex-1"
              />
              {periods.length > 1 && (
                <button
                  onClick={() => handleRemovePeriod(index)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Удалить период"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Диапазон значений */}
            <div className="flex items-center gap-2">
              <NumberInput
                value={periodItem.from}
                onChange={(val) => handleValueChange(index, 'from', val)}
                placeholder="От"
                className="w-full"
                allowDecimal={allowDecimal}
              />
              <span className="text-slate-400">—</span>
              <NumberInput
                value={periodItem.to}
                onChange={(val) => handleValueChange(index, 'to', val)}
                placeholder="До"
                className="w-full"
                allowDecimal={allowDecimal}
              />
            </div>

            {/* Разделитель между периодами */}
            {index < periods.length - 1 && (
              <div className="border-b border-slate-100 mt-2"></div>
            )}
          </div>
        ))}

        {/* Кнопка добавления периода */}
        {availablePeriods.length > 0 && (
          <button
            onClick={handleAddPeriod}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
          >
            <Plus className="h-4 w-4" />
            Добавить период
          </button>
        )}
      </div>
    </FilterSection>
  );
};

const OffersFilterPanel = ({ isOpen, onClose, filters, onFiltersChange, onApplyFilters }) => {
  // Локальное состояние фильтров (до применения)
  const [localFilters, setLocalFilters] = useState({
    // 1. Статус
    statuses: [],
    daysInStatusFrom: '',
    daysInStatusTo: '',
    // 2-4. CPL, Лиды, Расходы (с периодами)
    cplPeriods: [{ period: '4', from: '', to: '' }],
    leadsPeriods: [{ period: '4', from: '', to: '' }],
    costPeriods: [{ period: '4', from: '', to: '' }],
    // 5. Рейтинг
    ratings: [],
    // 6. ROI
    roiFrom: '',
    roiTo: '',
    // 7. Зоны
    zones: [],
    // 8. Прибыль
    profitFrom: '',
    profitTo: '',
    // 9. Дней продаж
    daysRemainingFrom: '',
    daysRemainingTo: '',
    // 10. Остаток
    stockFrom: '',
    stockTo: '',
    // 11. Дней до прихода
    daysToArrivalFrom: '',
    daysToArrivalTo: '',
    // 12. Апрув %
    approveFrom: '',
    approveTo: '',
    // 13. Выкуп %
    soldFrom: '',
    soldTo: '',
    // 14. Сезон
    seasons: [],
    // 15. Цена
    priceFrom: '',
    priceTo: '',
  });

  // Синхронизируем с внешними фильтрами при открытии
  useEffect(() => {
    if (filters) {
      setLocalFilters(filters);
    }
  }, [filters, isOpen]);

  // Обработчик изменения статусов
  const handleStatusChange = (statusValue, checked) => {
    setLocalFilters(prev => ({
      ...prev,
      statuses: checked
        ? [...prev.statuses, statusValue]
        : prev.statuses.filter(s => s !== statusValue)
    }));
  };

  // Удаление статуса из тегов
  const handleRemoveStatus = (statusValue) => {
    setLocalFilters(prev => ({
      ...prev,
      statuses: prev.statuses.filter(s => s !== statusValue)
    }));
  };

  // Обработчик применения фильтров
  const handleApply = () => {
    onFiltersChange(localFilters);
    // Передаём localFilters напрямую, чтобы избежать race condition с async setState
    onApplyFilters(localFilters);
  };

  // Обработчик сброса фильтров
  const handleReset = () => {
    const emptyFilters = {
      statuses: [],
      daysInStatusFrom: '',
      daysInStatusTo: '',
      cplPeriods: [{ period: '4', from: '', to: '' }],
      leadsPeriods: [{ period: '4', from: '', to: '' }],
      costPeriods: [{ period: '4', from: '', to: '' }],
      ratings: [],
      roiFrom: '',
      roiTo: '',
      zones: [],
      profitFrom: '',
      profitTo: '',
      daysRemainingFrom: '',
      daysRemainingTo: '',
      stockFrom: '',
      stockTo: '',
      daysToArrivalFrom: '',
      daysToArrivalTo: '',
      approveFrom: '',
      approveTo: '',
      soldFrom: '',
      soldTo: '',
      seasons: [],
      priceFrom: '',
      priceTo: '',
    };
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    // Передаём emptyFilters напрямую, чтобы избежать race condition с async setState
    onApplyFilters(emptyFilters);
  };

  // Подсчёт активных фильтров по секциям
  const statusFiltersCount = localFilters.statuses.length +
    (localFilters.daysInStatusFrom || localFilters.daysInStatusTo ? 1 : 0);

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
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* 1. Статусы */}
          <FilterSection title="Статус" defaultOpen={true} count={statusFiltersCount}>
            <div className="space-y-3">
              {/* Чекбоксы статусов */}
              <div className="space-y-1.5">
                {STATUS_CONFIG.map(status => (
                  <label
                    key={status.value}
                    className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-800 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={localFilters.statuses.includes(status.value)}
                      onChange={(e) => handleStatusChange(status.value, e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0"
                    />
                    <span className={`w-2.5 h-2.5 rounded-full ${status.color}`}></span>
                    {status.label}
                  </label>
                ))}
              </div>

              {/* Диапазон дней в статусе */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <label className="text-xs font-medium text-slate-500 mb-2 block">
                  Количество дней в статусе
                </label>
                <div className="flex items-center gap-2">
                  <NumberInput
                    value={localFilters.daysInStatusFrom}
                    onChange={(val) => setLocalFilters(prev => ({ ...prev, daysInStatusFrom: val }))}
                    placeholder="От"
                    className="w-full"
                  />
                  <span className="text-slate-400">—</span>
                  <NumberInput
                    value={localFilters.daysInStatusTo}
                    onChange={(val) => setLocalFilters(prev => ({ ...prev, daysInStatusTo: val }))}
                    placeholder="До"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </FilterSection>

          {/* 2. CPL с периодами */}
          <PeriodFilter
            title="CPL"
            periods={localFilters.cplPeriods || [{ period: '4', from: '', to: '' }]}
            onChange={(periods) => setLocalFilters(prev => ({ ...prev, cplPeriods: periods }))}
            allowDecimal={true}
          />

          {/* 3. Лиды с периодами */}
          <PeriodFilter
            title="Лиды"
            periods={localFilters.leadsPeriods || [{ period: '4', from: '', to: '' }]}
            onChange={(periods) => setLocalFilters(prev => ({ ...prev, leadsPeriods: periods }))}
            allowDecimal={false}
          />

          {/* 4. Расходы с периодами */}
          <PeriodFilter
            title="Расходы"
            periods={localFilters.costPeriods || [{ period: '4', from: '', to: '' }]}
            onChange={(periods) => setLocalFilters(prev => ({ ...prev, costPeriods: periods }))}
            allowDecimal={true}
          />

          {/* 5. Рейтинг */}
          <FilterSection title="Рейтинг" count={localFilters.ratings?.length || 0}>
            <div className="flex flex-wrap gap-2">
              {['A', 'B', 'C', 'D'].map(rating => (
                <label key={rating} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localFilters.ratings?.includes(rating) || false}
                    onChange={(e) => {
                      setLocalFilters(prev => ({
                        ...prev,
                        ratings: e.target.checked
                          ? [...(prev.ratings || []), rating]
                          : (prev.ratings || []).filter(r => r !== rating)
                      }));
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0"
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

          {/* 6. ROI */}
          <FilterSection title="ROI">
            <div className="flex items-center gap-2">
              <NumberInput
                value={localFilters.roiFrom}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, roiFrom: val }))}
                placeholder="От"
                className="w-full"
                allowDecimal={true}
              />
              <span className="text-slate-400">—</span>
              <NumberInput
                value={localFilters.roiTo}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, roiTo: val }))}
                placeholder="До"
                className="w-full"
                allowDecimal={true}
              />
            </div>
          </FilterSection>

          {/* 7. Зоны */}
          <FilterSection title="Зоны" count={localFilters.zones?.length || 0}>
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
                    checked={localFilters.zones?.includes(zone.id) || false}
                    onChange={(e) => {
                      setLocalFilters(prev => ({
                        ...prev,
                        zones: e.target.checked
                          ? [...(prev.zones || []), zone.id]
                          : (prev.zones || []).filter(z => z !== zone.id)
                      }));
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0"
                  />
                  <span className={`w-2.5 h-2.5 rounded-full ${zone.color}`}></span>
                  {zone.label}
                </label>
              ))}
            </div>
          </FilterSection>

          {/* 8. Прибыль */}
          <FilterSection title="Прибыль">
            <div className="flex items-center gap-2">
              <NumberInput
                value={localFilters.profitFrom}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, profitFrom: val }))}
                placeholder="От"
                className="w-full"
                allowDecimal={true}
              />
              <span className="text-slate-400">—</span>
              <NumberInput
                value={localFilters.profitTo}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, profitTo: val }))}
                placeholder="До"
                className="w-full"
                allowDecimal={true}
              />
            </div>
          </FilterSection>

          {/* 9. Дней продаж */}
          <FilterSection title="Дней продаж">
            <div className="flex items-center gap-2">
              <NumberInput
                value={localFilters.daysRemainingFrom}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, daysRemainingFrom: val }))}
                placeholder="От"
                className="w-full"
              />
              <span className="text-slate-400">—</span>
              <NumberInput
                value={localFilters.daysRemainingTo}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, daysRemainingTo: val }))}
                placeholder="До"
                className="w-full"
              />
            </div>
          </FilterSection>

          {/* 10. Остаток */}
          <FilterSection title="Остаток">
            <div className="flex items-center gap-2">
              <NumberInput
                value={localFilters.stockFrom}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, stockFrom: val }))}
                placeholder="От"
                className="w-full"
              />
              <span className="text-slate-400">—</span>
              <NumberInput
                value={localFilters.stockTo}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, stockTo: val }))}
                placeholder="До"
                className="w-full"
              />
            </div>
          </FilterSection>

          {/* 11. Дней до прихода */}
          <FilterSection title="Дней до прихода">
            <div className="flex items-center gap-2">
              <NumberInput
                value={localFilters.daysToArrivalFrom}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, daysToArrivalFrom: val }))}
                placeholder="От"
                className="w-full"
              />
              <span className="text-slate-400">—</span>
              <NumberInput
                value={localFilters.daysToArrivalTo}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, daysToArrivalTo: val }))}
                placeholder="До"
                className="w-full"
              />
            </div>
          </FilterSection>

          {/* 12. Апрув % */}
          <FilterSection title="Апрув %">
            <div className="flex items-center gap-2">
              <NumberInput
                value={localFilters.approveFrom}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, approveFrom: val }))}
                placeholder="От"
                className="w-full"
                allowDecimal={true}
              />
              <span className="text-slate-400">—</span>
              <NumberInput
                value={localFilters.approveTo}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, approveTo: val }))}
                placeholder="До"
                className="w-full"
                allowDecimal={true}
              />
            </div>
          </FilterSection>

          {/* 13. Выкуп % */}
          <FilterSection title="Выкуп %">
            <div className="flex items-center gap-2">
              <NumberInput
                value={localFilters.soldFrom}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, soldFrom: val }))}
                placeholder="От"
                className="w-full"
                allowDecimal={true}
              />
              <span className="text-slate-400">—</span>
              <NumberInput
                value={localFilters.soldTo}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, soldTo: val }))}
                placeholder="До"
                className="w-full"
                allowDecimal={true}
              />
            </div>
          </FilterSection>

          {/* 14. Сезон */}
          <FilterSection title="Сезон" count={localFilters.seasons?.length || 0}>
            <div className="space-y-1.5">
              {[
                { id: 'winter', label: 'Зима' },
                { id: 'spring', label: 'Весна' },
                { id: 'summer', label: 'Лето' },
                { id: 'autumn', label: 'Осень' },
                { id: 'all_year', label: 'Круглый год' },
              ].map(season => (
                <label key={season.id} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-800">
                  <input
                    type="checkbox"
                    checked={localFilters.seasons?.includes(season.id) || false}
                    onChange={(e) => {
                      setLocalFilters(prev => ({
                        ...prev,
                        seasons: e.target.checked
                          ? [...(prev.seasons || []), season.id]
                          : (prev.seasons || []).filter(s => s !== season.id)
                      }));
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0"
                  />
                  {season.label}
                </label>
              ))}
            </div>
          </FilterSection>

          {/* 15. Цена */}
          <FilterSection title="Цена">
            <div className="flex items-center gap-2">
              <NumberInput
                value={localFilters.priceFrom}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, priceFrom: val }))}
                placeholder="От"
                className="w-full"
                allowDecimal={true}
              />
              <span className="text-slate-400">—</span>
              <NumberInput
                value={localFilters.priceTo}
                onChange={(val) => setLocalFilters(prev => ({ ...prev, priceTo: val }))}
                placeholder="До"
                className="w-full"
                allowDecimal={true}
              />
            </div>
          </FilterSection>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-colors"
          >
            Сбросить
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};

export default OffersFilterPanel;
