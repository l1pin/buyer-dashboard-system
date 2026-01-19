// src/components/SqlQueryBuilder.js
// Конструктор SQL запросов для таблицы ads_collection

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Plus, Trash2, Play, Download, Table2, Loader2, ChevronDown, AlertCircle, FileSpreadsheet, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

// URL API
const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

// Доступные колонки таблицы ads_collection
const AVAILABLE_COLUMNS = [
  { name: 'id', type: 'number' },
  { name: 'source', type: 'string' },
  { name: 'offer_name', type: 'string' },
  { name: 'campaign_name_tracker', type: 'string' },
  { name: 'campaign_name', type: 'string' },
  { name: 'adv_group_name', type: 'string' },
  { name: 'adv_name', type: 'string' },
  { name: 'adv_date', type: 'date' },
  { name: 'adv_group_id', type: 'string' },
  { name: 'campaign_id', type: 'string' },
  { name: 'frequency', type: 'number' },
  { name: 'ctr', type: 'number' },
  { name: 'cpm', type: 'number' },
  { name: 'clicks_on_link', type: 'number' },
  { name: 'clicks_on_link_tracker', type: 'number' },
  { name: 'cpc', type: 'number' },
  { name: 'cpc_tracker', type: 'number' },
  { name: 'average_time_on_video', type: 'number' },
  { name: 'video_name', type: 'string' },
  { name: 'target_url', type: 'string' },
  { name: 'adv_group_budjet', type: 'number' },
  { name: 'adv_group_budjet_tupe', type: 'string' },
  { name: 'adv_id', type: 'string' },
  { name: 'adv_track_template', type: 'string' },
  { name: 'currency', type: 'string' },
  { name: 'engagement_rate', type: 'number' },
  { name: 'engagement_view', type: 'number' },
  { name: 'showed', type: 'number' },
  { name: 'viewed', type: 'number' },
  { name: 'viewed_tracker', type: 'number' },
  { name: 'video_start_viewed', type: 'number' },
  { name: 'video_half_viewed', type: 'number' },
  { name: 'video_almost_viewed', type: 'number' },
  { name: 'video_full_viewed', type: 'number' },
  { name: 'valid_cpa', type: 'number' },
  { name: 'valid', type: 'number' },
  { name: 'cost', type: 'number' },
  { name: 'valid_cr', type: 'number' },
  { name: 'fraud', type: 'number' },
  { name: 'fraud_cpa', type: 'number' },
  { name: 'offer_id_tracker', type: 'string' },
  { name: 'campaign_id_tracker', type: 'string' },
  { name: 'network_tracker', type: 'string' },
  { name: 'network_id_tracker', type: 'string' },
  { name: 'source_tracker', type: 'string' },
  { name: 'source_id_tracker', type: 'string' },
  { name: 'cost_from_sources', type: 'number' },
  { name: 'account_id', type: 'string' },
  { name: 'account_name', type: 'string' },
  { name: 'video_id', type: 'string' },
  { name: 'age', type: 'string' }
];

// Условия фильтрации
const CONDITION_OPTIONS = [
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
  { value: '>', label: '>' },
  { value: '>=', label: '≥' },
  { value: '<', label: '<' },
  { value: '<=', label: '≤' },
  { value: 'LIKE', label: 'содержит' },
  { value: 'NOT LIKE', label: 'не содержит' },
  { value: 'IS NULL', label: 'пусто' },
  { value: 'IS NOT NULL', label: 'не пусто' }
];

// Кастомный дропдаун с поиском
function SearchableDropdown({ value, onChange, options, placeholder, renderOption, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Закрытие при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Фильтрация опций
  const filteredOptions = options.filter(opt => {
    const label = typeof opt === 'string' ? opt : (opt.name || opt.label || opt.value);
    return label.toLowerCase().includes(search.toLowerCase());
  });

  // Текущий выбранный лейбл
  const selectedLabel = value
    ? (typeof options[0] === 'string'
        ? value
        : options.find(o => (o.name || o.value) === value)?.name || options.find(o => (o.name || o.value) === value)?.label || value)
    : '';

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={`w-full px-3 py-2 text-left bg-white border rounded-lg text-sm flex items-center justify-between transition-colors ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span className={value ? 'text-gray-800 font-mono' : 'text-gray-400'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Поле поиска */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Список опций */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400 text-center">Не найдено</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const optValue = typeof opt === 'string' ? opt : (opt.name || opt.value);
                const optLabel = typeof opt === 'string' ? opt : (opt.name || opt.label);
                const optType = typeof opt === 'object' ? opt.type : null;
                const isSelected = optValue === value;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onChange(optValue);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="font-mono">{optLabel}</span>
                    <div className="flex items-center gap-2">
                      {optType && <span className="text-xs text-gray-400">{optType}</span>}
                      {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Кастомный дропдаун для условий (без поиска)
function ConditionDropdown({ value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={dropdownRef} className="relative w-36">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-left bg-white border rounded-lg text-sm flex items-center justify-between transition-colors ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span className="text-gray-800">{selectedOption?.label || value}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SqlQueryBuilder({ user }) {
  // Выбранные колонки
  const [selectedColumns, setSelectedColumns] = useState(['adv_date', 'offer_id_tracker', 'source_id_tracker', 'valid', 'cost']);

  // Фильтры
  const [filters, setFilters] = useState([
    { column: 'adv_date', condition: '>=', value: getDefaultDateFrom() },
    { column: 'valid', condition: '>', value: '0' }
  ]);

  // LIMIT
  const [limit, setLimit] = useState(1000);

  // Состояние загрузки и результаты
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [generatedSql, setGeneratedSql] = useState('');

  // Прогресс
  const [progress, setProgress] = useState({ show: false, message: '', percent: 0 });

  // Дефолтная дата (30 дней назад)
  function getDefaultDateFrom() {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }

  // Добавить фильтр
  const addFilter = () => {
    setFilters([...filters, { column: '', condition: '=', value: '' }]);
  };

  // Удалить фильтр
  const removeFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  // Обновить фильтр
  const updateFilter = (index, field, value) => {
    const newFilters = [...filters];
    newFilters[index][field] = value;
    setFilters(newFilters);
  };

  // Переключить колонку
  const toggleColumn = (columnName) => {
    if (selectedColumns.includes(columnName)) {
      setSelectedColumns(selectedColumns.filter(c => c !== columnName));
    } else {
      setSelectedColumns([...selectedColumns, columnName]);
    }
  };

  // Выбрать все колонки
  const selectAllColumns = () => {
    setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.name));
  };

  // Снять выбор со всех колонок
  const deselectAllColumns = () => {
    setSelectedColumns([]);
  };

  // Построить SQL запрос
  const buildSqlQuery = useCallback(() => {
    if (selectedColumns.length === 0) {
      return null;
    }

    const columns = selectedColumns.map(col => `\`${col}\``).join(', ');

    const whereClauses = filters
      .filter(f => f.column && f.condition)
      .map(f => {
        const col = `\`${f.column}\``;
        if (f.condition === 'IS NULL' || f.condition === 'IS NOT NULL') {
          return `${col} ${f.condition}`;
        }
        if (f.condition === 'LIKE') {
          return `${col} LIKE '%${f.value.replace(/'/g, "''")}%'`;
        }
        if (f.condition === 'NOT LIKE') {
          return `${col} NOT LIKE '%${f.value.replace(/'/g, "''")}%'`;
        }
        return `${col} ${f.condition} '${f.value.replace(/'/g, "''")}'`;
      });

    let sql = `SELECT ${columns} FROM \`ads_collection\``;

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (limit && limit > 0) {
      sql += ` LIMIT ${limit}`;
    }

    return sql;
  }, [selectedColumns, filters, limit]);

  // Выполнить запрос
  const executeQuery = async () => {
    const sql = buildSqlQuery();

    if (!sql) {
      setError('Выберите хотя бы одну колонку');
      return;
    }

    setGeneratedSql(sql);
    setLoading(true);
    setError(null);
    setResults(null);
    setProgress({ show: true, message: 'Отправка запроса...', percent: 10 });

    try {
      setProgress({ show: true, message: 'Получение данных...', percent: 30 });

      const response = await fetch(CORE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ assoc: true, sql })
      });

      setProgress({ show: true, message: 'Обработка ответа...', percent: 70 });

      const code = response.status;
      const text = await response.text();

      if (code !== 200) {
        throw new Error(`HTTP ${code}: ${text}`);
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e.message}`);
      }

      if (json.error) {
        throw new Error(json.error);
      }

      if (!json || !Array.isArray(json)) {
        throw new Error('Неожиданный формат ответа');
      }

      setProgress({ show: true, message: 'Готово!', percent: 100 });

      // Обработка данных
      let headers = [];
      let rows = [];

      if (json.length > 0) {
        if (typeof json[0] === 'object' && !Array.isArray(json[0])) {
          // Формат: [{col1: val1}, ...]
          headers = Object.keys(json[0]);
          rows = json.map(row => headers.map(h => row[h]));
        } else if (Array.isArray(json[0])) {
          // Формат: [[headers], [values], ...]
          headers = json[0];
          rows = json.slice(1);
        }
      }

      setResults({ headers, rows, totalRows: rows.length });

      setTimeout(() => {
        setProgress({ show: false, message: '', percent: 0 });
      }, 1000);

    } catch (err) {
      setError(err.message);
      setProgress({ show: false, message: '', percent: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Экспорт в CSV
  const exportToCsv = () => {
    if (!results || results.rows.length === 0) return;

    const csvContent = [
      results.headers.join(','),
      ...results.rows.map(row =>
        row.map(cell => {
          const value = cell === null || cell === undefined ? '' : String(cell);
          // Escape quotes and wrap in quotes if contains comma or newline
          if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ads_collection_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Экспорт в XLSX
  const exportToXlsx = () => {
    if (!results || results.rows.length === 0) return;

    // Создаём данные для листа: заголовки + строки
    const wsData = [results.headers, ...results.rows];

    // Создаём worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Создаём workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ads_collection');

    // Скачиваем файл
    XLSX.writeFile(wb, `ads_collection_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-6 max-w-full pb-12">
      {/* Заголовок */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Table2 className="w-7 h-7 text-blue-600" />
          SQL Query Builder
        </h1>
        <p className="text-gray-500 mt-1">Конструктор запросов к таблице ads_collection</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая панель: Выбор колонок */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">Колонки</h2>
              <div className="flex gap-2">
                <button
                  onClick={selectAllColumns}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Все
                </button>
                <button
                  onClick={deselectAllColumns}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Сбросить
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {AVAILABLE_COLUMNS.map(col => (
                <label
                  key={col.name}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    selectedColumns.includes(col.name)
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.name)}
                    onChange={() => toggleColumn(col.name)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-mono">{col.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{col.type}</span>
                </label>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t text-sm text-gray-500">
              Выбрано: {selectedColumns.length} из {AVAILABLE_COLUMNS.length}
            </div>
          </div>
        </div>

        {/* Правая панель: Фильтры и запрос */}
        <div className="lg:col-span-2 space-y-6">
          {/* Фильтры */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">Фильтры</h2>
              <button
                onClick={addFilter}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            </div>

            <div className="space-y-3">
              {filters.map((filter, index) => (
                <div key={index} className="flex items-center gap-2">
                  {/* Колонка - кастомный дропдаун с поиском */}
                  <SearchableDropdown
                    value={filter.column}
                    onChange={(val) => updateFilter(index, 'column', val)}
                    options={AVAILABLE_COLUMNS}
                    placeholder="Выберите колонку"
                    className="flex-1"
                  />

                  {/* Условие - кастомный дропдаун */}
                  <ConditionDropdown
                    value={filter.condition}
                    onChange={(val) => updateFilter(index, 'condition', val)}
                    options={CONDITION_OPTIONS}
                  />

                  {/* Значение */}
                  {filter.condition !== 'IS NULL' && filter.condition !== 'IS NOT NULL' && (
                    <input
                      type="text"
                      value={filter.value}
                      onChange={(e) => updateFilter(index, 'value', e.target.value)}
                      placeholder="Значение"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}

                  {/* Удалить */}
                  <button
                    onClick={() => removeFilter(index)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {filters.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">
                  Нет фильтров. Нажмите "Добавить" чтобы создать.
                </p>
              )}
            </div>

            {/* LIMIT */}
            <div className="mt-4 pt-4 border-t flex items-center gap-4">
              <label className="text-sm text-gray-600">LIMIT:</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
                max="100000"
              />
            </div>
          </div>

          {/* Сгенерированный SQL */}
          {generatedSql && (
            <div className="bg-gray-900 rounded-xl p-4 text-green-400 font-mono text-sm overflow-x-auto">
              <div className="text-gray-500 text-xs mb-2">Generated SQL:</div>
              {generatedSql}
            </div>
          )}

          {/* Кнопки действий */}
          <div className="flex gap-3">
            <button
              onClick={executeQuery}
              disabled={loading || selectedColumns.length === 0}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
                loading || selectedColumns.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Выполнить запрос
                </>
              )}
            </button>

            {results && results.rows.length > 0 && (
              <>
                <button
                  onClick={exportToCsv}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  CSV
                </button>
                <button
                  onClick={exportToXlsx}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  XLSX
                </button>
              </>
            )}
          </div>

          {/* Прогресс */}
          {progress.show && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-700">{progress.message}</span>
                <span className="text-sm text-blue-600">{progress.percent}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Ошибка */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Ошибка</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Результаты - отдельный блок на всю ширину */}
      {results && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col" style={{ marginBottom: '60px' }}>
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between flex-shrink-0">
            <h2 className="font-semibold text-gray-700">
              Результаты: {results.totalRows} записей
            </h2>
            {results.rows.length > 100 && (
              <span className="text-sm text-gray-500">
                Показаны первые 100 записей. Скачайте CSV/XLSX для полных данных.
              </span>
            )}
          </div>

          {/* Контейнер таблицы с вертикальным и горизонтальным скроллом */}
          <div
            className="overflow-auto flex-1"
            style={{
              maxHeight: 'calc(100vh - 120px)',
              minHeight: '300px'
            }}
          >
            <table className="w-full text-sm" style={{ minWidth: 'max-content' }}>
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b bg-gray-100">#</th>
                  {results.headers.map((header, i) => (
                    <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b whitespace-nowrap bg-gray-100">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.rows.slice(0, 100).map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 text-xs">{rowIndex + 1}</td>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {cell === null || cell === undefined ? (
                          <span className="text-gray-300 italic">null</span>
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default SqlQueryBuilder;
