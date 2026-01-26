// src/components/CurrencyCollectionQuery.js
// Конструктор SQL запросов для таблицы currency_collection

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Plus, Trash2, Play, Download, Table2, Loader2, ChevronDown, AlertCircle, FileSpreadsheet, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

const AVAILABLE_COLUMNS = [
  { name: 'id', type: 'number' },
  { name: 'convert_from_currency', type: 'string' },
  { name: 'convert_to_currency', type: 'string' },
  { name: 'value', type: 'number' },
  { name: 'month', type: 'number' },
  { name: 'year', type: 'number' }
];

const CONDITION_OPTIONS = [
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
  { value: '>', label: '>' },
  { value: '>=', label: '≥' },
  { value: '<', label: '<' },
  { value: '<=', label: '≤' },
  { value: 'LIKE', label: 'содержит' },
  { value: 'IS NULL', label: 'пусто' },
  { value: 'IS NOT NULL', label: 'не пусто' }
];

function SearchableDropdown({ value, onChange, options, placeholder, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

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

  const filteredOptions = options.filter(opt => {
    const label = typeof opt === 'string' ? opt : (opt.name || opt.label || opt.value);
    return label.toLowerCase().includes(search.toLowerCase());
  });

  const selectedLabel = value
    ? (typeof options[0] === 'string'
        ? value
        : options.find(o => (o.name || o.value) === value)?.name || value)
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
          isOpen ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span className={value ? 'text-gray-800 font-mono' : 'text-gray-400'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

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
                      isSelected ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="font-mono">{optLabel}</span>
                    <div className="flex items-center gap-2">
                      {optType && <span className="text-xs text-gray-400">{optType}</span>}
                      {isSelected && <Check className="w-4 h-4 text-cyan-600" />}
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
          isOpen ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-gray-300 hover:border-gray-400'
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
                    isSelected ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-cyan-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CurrencyCollectionQuery({ user }) {
  const [selectedColumns, setSelectedColumns] = useState(['id', 'convert_from_currency', 'convert_to_currency', 'value', 'month', 'year']);
  const [filters, setFilters] = useState([
    { column: 'year', condition: '=', value: new Date().getFullYear().toString() }
  ]);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [generatedSql, setGeneratedSql] = useState('');
  const [progress, setProgress] = useState({ show: false, message: '', percent: 0 });

  const addFilter = () => setFilters([...filters, { column: '', condition: '=', value: '' }]);
  const removeFilter = (index) => setFilters(filters.filter((_, i) => i !== index));
  const updateFilter = (index, field, value) => {
    const newFilters = [...filters];
    newFilters[index][field] = value;
    setFilters(newFilters);
  };

  const toggleColumn = (columnName) => {
    if (selectedColumns.includes(columnName)) {
      setSelectedColumns(selectedColumns.filter(c => c !== columnName));
    } else {
      setSelectedColumns([...selectedColumns, columnName]);
    }
  };

  const selectAllColumns = () => setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.name));
  const deselectAllColumns = () => setSelectedColumns([]);

  const buildSqlQuery = useCallback(() => {
    if (selectedColumns.length === 0) return null;

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
        return `${col} ${f.condition} '${f.value.replace(/'/g, "''")}'`;
      });

    let sql = `SELECT ${columns} FROM \`currency_collection\``;
    if (whereClauses.length > 0) sql += ` WHERE ${whereClauses.join(' AND ')}`;
    sql += ` ORDER BY \`year\` DESC, \`month\` DESC`;
    if (limit && limit > 0) sql += ` LIMIT ${limit}`;

    return sql;
  }, [selectedColumns, filters, limit]);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assoc: true, sql })
      });

      setProgress({ show: true, message: 'Обработка ответа...', percent: 70 });
      const text = await response.text();
      if (response.status !== 200) throw new Error(`HTTP ${response.status}: ${text}`);

      const json = JSON.parse(text);
      if (json.error) throw new Error(json.error);
      if (!Array.isArray(json)) throw new Error('Неожиданный формат ответа');

      setProgress({ show: true, message: 'Готово!', percent: 100 });

      let headers = [], rows = [];
      if (json.length > 0) {
        if (typeof json[0] === 'object' && !Array.isArray(json[0])) {
          headers = Object.keys(json[0]);
          rows = json.map(row => headers.map(h => row[h]));
        }
      }

      setResults({ headers, rows, totalRows: rows.length });
      setTimeout(() => setProgress({ show: false, message: '', percent: 0 }), 1000);
    } catch (err) {
      setError(err.message);
      setProgress({ show: false, message: '', percent: 0 });
    } finally {
      setLoading(false);
    }
  };

  const exportToCsv = () => {
    if (!results?.rows.length) return;
    const csvContent = [
      results.headers.join(','),
      ...results.rows.map(row => row.map(cell => {
        const value = cell == null ? '' : String(cell);
        return value.includes(',') || value.includes('\n') || value.includes('"')
          ? `"${value.replace(/"/g, '""')}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `currency_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToXlsx = () => {
    if (!results?.rows.length) return;
    const ws = XLSX.utils.aoa_to_sheet([results.headers, ...results.rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'currency');
    XLSX.writeFile(wb, `currency_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getMonthName = (month) => {
    const months = ['', 'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
    return months[month] || month;
  };

  const getCurrencyFlag = (currency) => {
    const flags = { USD: '🇺🇸', UAH: '🇺🇦', EUR: '🇪🇺', PLN: '🇵🇱', GBP: '🇬🇧' };
    return flags[currency] || '💱';
  };

  return (
    <div className="p-6 max-w-full pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Table2 className="w-7 h-7 text-cyan-600" />
          SQL Query Builder
        </h1>
        <p className="text-gray-500 mt-1">Конструктор запросов к таблице currency_collection (курси валют)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">Колонки</h2>
              <div className="flex gap-2">
                <button onClick={selectAllColumns} className="text-xs text-cyan-600 hover:text-cyan-800">Все</button>
                <button onClick={deselectAllColumns} className="text-xs text-gray-500 hover:text-gray-700">Сбросить</button>
              </div>
            </div>

            <div className="space-y-1">
              {AVAILABLE_COLUMNS.map(col => (
                <label
                  key={col.name}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    selectedColumns.includes(col.name) ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.name)}
                    onChange={() => toggleColumn(col.name)}
                    className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm font-mono">{col.name}</span>
                  <span className="text-xs ml-auto text-gray-400">{col.type}</span>
                </label>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t text-sm text-gray-500">
              Выбрано: {selectedColumns.length} из {AVAILABLE_COLUMNS.length}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">Фильтры</h2>
              <button onClick={addFilter} className="flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-800">
                <Plus className="w-4 h-4" />Добавить
              </button>
            </div>

            <div className="space-y-3">
              {filters.map((filter, index) => (
                <div key={index} className="flex items-center gap-2">
                  <SearchableDropdown
                    value={filter.column}
                    onChange={(val) => updateFilter(index, 'column', val)}
                    options={AVAILABLE_COLUMNS}
                    placeholder="Колонка"
                    className="flex-1"
                  />
                  <ConditionDropdown
                    value={filter.condition}
                    onChange={(val) => updateFilter(index, 'condition', val)}
                    options={CONDITION_OPTIONS}
                  />
                  {filter.condition !== 'IS NULL' && filter.condition !== 'IS NOT NULL' && (
                    <input
                      type="text"
                      value={filter.value}
                      onChange={(e) => updateFilter(index, 'value', e.target.value)}
                      placeholder="Значение"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    />
                  )}
                  <button onClick={() => removeFilter(index)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {filters.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">Нет фильтров</p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t flex items-center gap-4">
              <label className="text-sm text-gray-600">LIMIT:</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500"
                min="0" max="100000"
              />
            </div>
          </div>

          {generatedSql && (
            <div className="bg-gray-900 rounded-xl p-4 text-green-400 font-mono text-sm overflow-x-auto">
              <div className="text-gray-500 text-xs mb-2">Generated SQL:</div>
              {generatedSql}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={executeQuery}
              disabled={loading || selectedColumns.length === 0}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
                loading || selectedColumns.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-cyan-600 text-white hover:bg-cyan-700'
              }`}
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Загрузка...</> : <><Play className="w-5 h-5" />Выполнить</>}
            </button>
            {results?.rows.length > 0 && (
              <>
                <button onClick={exportToCsv} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700">
                  <Download className="w-5 h-5" />CSV
                </button>
                <button onClick={exportToXlsx} className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700">
                  <FileSpreadsheet className="w-5 h-5" />XLSX
                </button>
              </>
            )}
          </div>

          {progress.show && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-cyan-700">{progress.message}</span>
                <span className="text-sm text-cyan-600">{progress.percent}%</span>
              </div>
              <div className="w-full bg-cyan-200 rounded-full h-2">
                <div className="bg-cyan-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          )}

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

      {results && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200" style={{ marginBottom: '60px' }}>
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Результаты: {results.totalRows} записей</h2>
          </div>
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 120px)', minHeight: '200px' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b bg-gray-100">#</th>
                  {results.headers.map((header, i) => (
                    <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b whitespace-nowrap bg-gray-100">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 text-xs">{rowIndex + 1}</td>
                    {row.map((cell, cellIndex) => {
                      const header = results.headers[cellIndex];
                      return (
                        <td key={cellIndex} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {cell == null ? <span className="text-gray-300 italic">null</span> :
                            header === 'value' ? <span className="text-cyan-600 font-medium">{parseFloat(cell).toFixed(4)}</span> :
                            header === 'month' ? getMonthName(parseInt(cell)) :
                            (header === 'convert_from_currency' || header === 'convert_to_currency') ?
                              <span>{getCurrencyFlag(cell)} {cell}</span> :
                            String(cell)}
                        </td>
                      );
                    })}
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

export default CurrencyCollectionQuery;
