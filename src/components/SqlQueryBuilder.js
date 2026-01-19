// src/components/SqlQueryBuilder.js
// Конструктор SQL запросов для таблицы ads_collection

import React, { useState, useCallback } from 'react';
import { Search, Plus, Trash2, Play, Download, Table2, Loader2, X, ChevronDown, AlertCircle } from 'lucide-react';

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

  return (
    <div className="p-6 max-w-full">
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
                  {/* Колонка */}
                  <select
                    value={filter.column}
                    onChange={(e) => updateFilter(index, 'column', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Выберите колонку</option>
                    {AVAILABLE_COLUMNS.map(col => (
                      <option key={col.name} value={col.name}>{col.name}</option>
                    ))}
                  </select>

                  {/* Условие */}
                  <select
                    value={filter.condition}
                    onChange={(e) => updateFilter(index, 'condition', e.target.value)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {CONDITION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

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
              <button
                onClick={exportToCsv}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
              >
                <Download className="w-5 h-5" />
                Скачать CSV
              </button>
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

          {/* Результаты */}
          {results && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-700">
                  Результаты: {results.totalRows} записей
                </h2>
              </div>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">#</th>
                      {results.headers.map((header, i) => (
                        <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b whitespace-nowrap">
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
                          <td key={cellIndex} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
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

                {results.rows.length > 100 && (
                  <div className="px-4 py-3 bg-gray-50 border-t text-center text-sm text-gray-500">
                    Показаны первые 100 записей из {results.totalRows}. Скачайте CSV для полных данных.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SqlQueryBuilder;
