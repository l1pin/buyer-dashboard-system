// src/components/ProfitCheckDebug.js
// Отладочный интерфейс для просмотра сырых данных по Offer ID

import React, { useState } from 'react';
import { Search, Loader2, Database, Table, Play, Calendar, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';

// URL API
const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

// Функция выполнения SQL запроса
async function executeQuery(sql) {
  const response = await fetch(CORE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assoc: true, sql }),
    cache: 'no-store'
  });

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
    const errorMsg = typeof json.error === 'object'
      ? JSON.stringify(json.error)
      : json.error;
    throw new Error(errorMsg);
  }

  return json;
}

// Получить дату N дней назад
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// Компонент для отображения значения
function ValueDisplay({ value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (value === null) return <span className="text-gray-400 italic">null</span>;
  if (value === undefined) return <span className="text-gray-400 italic">undefined</span>;
  if (value === '') return <span className="text-gray-400 italic">(empty)</span>;

  const strValue = String(value);
  const isLong = strValue.length > 50;

  return (
    <div className="flex items-start gap-1 group">
      <span className={`font-mono text-sm ${isLong ? 'break-all' : ''}`}>
        {isLong ? strValue.substring(0, 100) + '...' : strValue}
      </span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 rounded transition-opacity"
        title="Копировать"
      >
        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
      </button>
    </div>
  );
}

// Компонент таблицы данных
function DataTable({ tableName, tableInfo, expanded, onToggle }) {
  const { data = [], error } = tableInfo || {};

  // Показать ошибку
  if (error) {
    return (
      <div className="border rounded-lg mb-4 bg-white border-red-200">
        <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
          <Database size={16} className="text-red-500" />
          <span className="font-medium">{tableName}</span>
          <span className="text-red-500 text-sm">(ошибка)</span>
        </div>
        <div className="p-4 text-red-600 text-sm font-mono">
          {error}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="border rounded-lg mb-4 bg-white">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
          <Table size={16} className="text-gray-500" />
          <span className="font-medium">{tableName}</span>
          <span className="text-gray-400 text-sm">(0 записей)</span>
        </div>
      </div>
    );
  }

  const fields = Object.keys(data[0]);
  const isExpanded = expanded[tableName] !== false; // по умолчанию раскрыто

  return (
    <div className="border rounded-lg mb-4 bg-white overflow-hidden">
      <div
        className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2 cursor-pointer hover:bg-gray-100"
        onClick={() => onToggle(tableName)}
      >
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Database size={16} className="text-blue-500" />
        <span className="font-medium">{tableName}</span>
        <span className="text-gray-500 text-sm">({data.length} записей, {fields.length} полей)</span>
      </div>

      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">#</th>
                {fields.map(field => (
                  <th key={field} className="px-3 py-2 text-left font-medium text-gray-600 border-b whitespace-nowrap">
                    {field}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-blue-50 border-b last:border-b-0">
                  <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                  {fields.map(field => (
                    <td key={field} className="px-3 py-2 max-w-xs">
                      <ValueDisplay value={row[field]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProfitCheckDebug() {
  // Состояния
  const [offerId, setOfferId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ show: false, message: '', current: 0, total: 0 });

  // Фильтры
  const [dateFrom, setDateFrom] = useState(getDateDaysAgo(30));
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Данные из разных таблиц
  const [tableData, setTableData] = useState({});
  const [expanded, setExpanded] = useState({});

  // Список таблиц для загрузки
  const tables = [
    {
      name: 'ads_collection',
      query: (offerId, dateFrom, dateTo) => `
        SELECT * FROM ads_collection
        WHERE offer_id_tracker = '${offerId}'
        AND date >= '${dateFrom}' AND date <= '${dateTo}'
        ORDER BY date DESC
        LIMIT 100
      `
    },
    {
      name: 'conversions_collection',
      query: (offerId, dateFrom, dateTo) => `
        SELECT * FROM conversions_collection
        WHERE offer_id_tracker = '${offerId}'
        AND date >= '${dateFrom}' AND date <= '${dateTo}'
        ORDER BY date DESC
        LIMIT 100
      `
    },
    {
      name: 'sales_collection',
      query: (offerId, dateFrom, dateTo) => `
        SELECT * FROM sales_collection
        WHERE offer_id = '${offerId}'
        AND created_at >= '${dateFrom}' AND created_at <= '${dateTo}'
        ORDER BY created_at DESC
        LIMIT 100
      `
    },
    {
      name: 'operational_cost_collection',
      query: (offerId, dateFrom, dateTo) => `
        SELECT * FROM operational_cost_collection
        WHERE offer_id = '${offerId}'
        ORDER BY month DESC
        LIMIT 100
      `
    }
  ];

  // Загрузка данных
  const loadData = async () => {
    if (!offerId.trim()) {
      setError('Введите Offer ID');
      return;
    }

    setLoading(true);
    setError(null);
    setTableData({});
    setProgress({ show: true, message: 'Начинаю загрузку...', current: 0, total: tables.length + 1 });

    try {
      const results = {};

      // Загрузка данных из каждой таблицы
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        setProgress({
          show: true,
          message: `Загрузка ${table.name}...`,
          current: i + 1,
          total: tables.length + 1
        });

        try {
          const sql = table.query(offerId.trim(), dateFrom, dateTo);
          console.log(`SQL for ${table.name}:`, sql);
          const data = await executeQuery(sql);
          results[table.name] = { data: Array.isArray(data) ? data : [], error: null };
        } catch (err) {
          console.error(`Error loading ${table.name}:`, err);
          results[table.name] = { data: [], error: err.message };
        }
      }

      // Загрузка данных байеров из Supabase
      setProgress({
        show: true,
        message: 'Загрузка данных байеров из Supabase...',
        current: tables.length + 1,
        total: tables.length + 1
      });

      try {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, email, avatar_url, buyer_settings')
          .not('buyer_settings', 'is', null);

        if (usersError) throw usersError;

        // Преобразуем данные для отображения traffic_channels
        const buyersWithChannels = usersData.map(user => {
          const settings = typeof user.buyer_settings === 'string'
            ? JSON.parse(user.buyer_settings)
            : user.buyer_settings;

          const channels = settings?.traffic_channels || [];

          return {
            user_id: user.id,
            name: user.name,
            email: user.email,
            channels_count: channels.length,
            traffic_channels: JSON.stringify(channels)
          };
        }).filter(u => u.channels_count > 0);

        results['supabase_users (traffic_channels)'] = { data: buyersWithChannels, error: null };
      } catch (err) {
        console.error('Error loading users:', err);
        results['supabase_users (traffic_channels)'] = { data: [], error: err.message };
      }

      setTableData(results);
      setProgress({ show: false, message: '', current: 0, total: 0 });

    } catch (err) {
      setError(err.message);
      setProgress({ show: false, message: '', current: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (tableName) => {
    setExpanded(prev => ({
      ...prev,
      [tableName]: !prev[tableName] === false ? true : !prev[tableName]
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      loadData();
    }
  };

  // Подсчет общего количества записей
  const totalRecords = Object.values(tableData).reduce((sum, info) => sum + (info?.data?.length || 0), 0);

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      {/* Заголовок */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Database className="text-blue-500" />
          Profit Check Debug
        </h1>
        <p className="text-gray-500 mt-1">
          Просмотр сырых данных из таблиц по Offer ID
        </p>
      </div>

      {/* Форма поиска */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Offer ID */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Offer ID (offer_id_tracker)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={offerId}
                onChange={(e) => setOfferId(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Введите Offer ID..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Дата с */}
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={14} className="inline mr-1" />
              Дата с
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Дата по */}
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={14} className="inline mr-1" />
              Дата по
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Кнопка загрузки */}
          <button
            onClick={loadData}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2 font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Загрузка...
              </>
            ) : (
              <>
                <Play size={18} />
                Загрузить
              </>
            )}
          </button>
        </div>

        {/* Прогресс */}
        {progress.show && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{progress.message}</span>
              <span>{progress.current}/{progress.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Статистика */}
      {Object.keys(tableData).length > 0 && (
        <div className="mb-4 flex items-center gap-4 text-sm text-gray-600">
          <span>
            <strong>{Object.keys(tableData).length}</strong> таблиц
          </span>
          <span>•</span>
          <span>
            <strong>{totalRecords}</strong> записей всего
          </span>
        </div>
      )}

      {/* Данные по таблицам */}
      {Object.entries(tableData).map(([tableName, tableInfo]) => (
        <DataTable
          key={tableName}
          tableName={tableName}
          tableInfo={tableInfo}
          expanded={expanded}
          onToggle={toggleExpanded}
        />
      ))}

      {/* Пустое состояние */}
      {!loading && Object.keys(tableData).length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Database size={48} className="mx-auto mb-4 opacity-30" />
          <p>Введите Offer ID и нажмите "Загрузить"</p>
          <p className="text-sm mt-1">Данные будут загружены из всех связанных таблиц</p>
        </div>
      )}
    </div>
  );
}

export default ProfitCheckDebug;
