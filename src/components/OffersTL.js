// src/components/OffersTL.js
import React, { useState, useEffect } from 'react';
import { metricsAnalyticsService } from '../supabaseClient';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Package,
  Clock,
  Percent,
  Snowflake,
  BarChart3,
  Star,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Кастомная иконка Ad
const AdIcon = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z"/>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 15v-4a2 2 0 0 1 4 0v4" />
    <line x1="7" y1="13" x2="11" y2="13" />
    <path d="M17 9v6h-1.5a1.5 1.5 0 1 1 1.5 -1.5" />
  </svg>
);

function OffersTL({ user }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [loadingStats, setLoadingStats] = useState({
    actualCount: 0,
    totalRecords: 0,
    databaseCount: 0
  });

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('🔄 Начинаем загрузку метрик для офферов...');

      const data = await metricsAnalyticsService.getAllMetricsLarge();
      setMetrics(data.metrics || []);
      setLastUpdated(data.lastUpdated);

      setLoadingStats({
        actualCount: data.actualCount,
        totalRecords: data.totalRecords,
        databaseCount: data.databaseCount || data.actualCount
      });

      if (data.actualCount > 0) {
        setSuccess(`✅ Успешно загружено ${data.actualCount.toLocaleString('ru-RU')} офферов`);
      }

    } catch (error) {
      console.error('❌ Ошибка загрузки метрик:', error);
      setError('Ошибка загрузки метрик: ' + error.message);
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  // Функция для получения цветов зон
  const getZoneColors = (zoneName) => {
    if (!zoneName) return null;
    const name = zoneName.toLowerCase();
    if (name.includes('sos')) return { bg: 'bg-black', text: 'text-yellow-400', border: 'border-black' };
    if (name.includes('красн')) return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' };
    if (name.includes('розов')) return { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' };
    if (name.includes('золот')) return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
    if (name.includes('зелен')) return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' };
    return null;
  };

  const ZoneBadge = ({ zone }) => {
    const colors = getZoneColors(zone);
    if (!colors) {
      return <span className="text-gray-600 font-semibold text-xs">{zone}</span>;
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
        {zone}
      </span>
    );
  };

  const formatKyivTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        timeZone: 'Europe/Kiev',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      return new Date(dateString).toLocaleDateString('ru-RU');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU');
    } catch (error) {
      return '—';
    }
  };

  // Фильтрация и сортировка
  const filteredMetrics = metrics.filter(metric => {
    const matchesSearch = searchTerm === '' ||
      metric.article?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      metric.offer?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }).sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStats = () => {
    const totalItems = filteredMetrics.length;
    const withActualLead = filteredMetrics.filter(m => m.actual_lead !== null && m.actual_lead !== 'нет данных').length;
    const avgROI = filteredMetrics.reduce((sum, m) => sum + (m.actual_roi_percent || 0), 0) / (totalItems || 1);

    return { totalItems, withActualLead, avgROI };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка офферов...</p>
          <p className="mt-2 text-sm text-gray-500">Это может занять некоторое время</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Офферы
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Просмотр офферов в удобном формате карточек
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadMetrics}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm flex items-center">
          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Stats */}
      {metrics.length > 0 && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BarChart3 className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Всего офферов
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {stats.totalItems.toLocaleString('ru-RU')}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Target className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        С данными по лидам
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {stats.withActualLead.toLocaleString('ru-RU')}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-purple-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Средний ROI
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {stats.avgROI.toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {lastUpdated && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Последнее обновление: {formatKyivTime(lastUpdated)}
              </div>
              <div className="text-xs text-gray-500">
                Отображено офферов: {filteredMetrics.length.toLocaleString('ru-RU')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по артикулу или названию оффера..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Сортировать:</span>
            <button
              onClick={() => handleSort('id')}
              className={`px-3 py-2 text-sm rounded-md ${sortField === 'id' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
            >
              По №
              {sortField === 'id' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3 ml-1" /> : <ChevronDown className="inline h-3 w-3 ml-1" />)}
            </button>
            <button
              onClick={() => handleSort('article')}
              className={`px-3 py-2 text-sm rounded-md ${sortField === 'article' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}
            >
              По артикулу
              {sortField === 'article' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3 ml-1" /> : <ChevronDown className="inline h-3 w-3 ml-1" />)}
            </button>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="flex-1 overflow-auto p-6">
        {metrics.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Нет данных офферов
              </h3>
              <p className="text-gray-600 mb-4">
                Данные офферов будут загружены из метрик аналитика
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMetrics.map((metric, index) => (
              <div
                key={index}
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-4"
              >
                <div className="grid grid-cols-12 gap-3 items-center">
                  {/* № */}
                  <div className="col-span-1 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-500 mb-1">№</span>
                    <span className="font-semibold text-gray-900">{metric.id}</span>
                  </div>

                  {/* Артикул */}
                  <div className="col-span-1 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-500 mb-1">Артикул</span>
                    <span className="font-mono text-xs text-gray-900">{metric.article || '—'}</span>
                  </div>

                  {/* Название */}
                  <div className="col-span-2 flex flex-col justify-center">
                    <span className="text-xs text-gray-500 mb-1">Название</span>
                    <span className="font-medium text-sm text-gray-900 truncate" title={metric.offer}>
                      {metric.offer || '—'}
                    </span>
                  </div>

                  {/* Статус (Зона) */}
                  <div className="col-span-1 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-500 mb-1">Статус</span>
                    <ZoneBadge zone={metric.offer_zone} />
                  </div>

                  {/* CPL 4 дн. */}
                  <div className="col-span-1 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-500 mb-1">CPL</span>
                    <div className="flex items-center">
                      <DollarSign className="h-3 w-3 text-green-600 mr-0.5" />
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {metric.actual_lead === 'нет данных' ? '—' : (metric.actual_lead ? `$${Number(metric.actual_lead).toFixed(2)}` : '—')}
                      </span>
                    </div>
                  </div>

                  {/* Продажи на 1 заявку (K лид) */}
                  <div className="col-span-1 flex flex-col items-center justify-center" title="Продажи на 1 заявку">
                    <span className="text-xs text-gray-500 mb-1">K лид</span>
                    <div className="flex items-center">
                      <Target className="h-3 w-3 text-blue-600 mr-0.5" />
                      <span className="font-mono text-xs text-gray-900">
                        {metric.k_lead ? Number(metric.k_lead).toFixed(2) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Рейтинг (ROI) */}
                  <div className="col-span-1 flex flex-col items-center justify-center" title="Рейтинг (ROI %)">
                    <span className="text-xs text-gray-500 mb-1">ROI</span>
                    <div className="flex items-center">
                      <Star className="h-3 w-3 text-yellow-500 mr-0.5" />
                      <span className="font-mono text-xs text-gray-900">
                        {metric.actual_roi_percent ? `${Number(metric.actual_roi_percent).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Остаток */}
                  <div className="col-span-1 flex flex-col items-center justify-center" title="Большой остаток">
                    <span className="text-xs text-gray-500 mb-1">Остаток</span>
                    <div className="flex items-center">
                      <Package className="h-3 w-3 text-orange-600 mr-0.5" />
                      <span className="text-xs text-gray-900">
                        {metric.high_stock_high_mcpl || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Дней до прихода */}
                  <div className="col-span-1 flex flex-col items-center justify-center" title="Дней до прихода">
                    <span className="text-xs text-gray-500 mb-1">Приход</span>
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 text-purple-600 mr-0.5" />
                      <span className="text-xs text-gray-900">
                        {formatDate(metric.next_calculated_arrival)}
                      </span>
                    </div>
                  </div>

                  {/* % отказа от продаж */}
                  <div className="col-span-1 flex flex-col items-center justify-center" title="% отказа от продаж">
                    <span className="text-xs text-gray-500 mb-1">Отказ</span>
                    <div className="flex items-center">
                      <Percent className="h-3 w-3 text-red-600 mr-0.5" />
                      <span className="font-mono text-xs text-gray-900">
                        {metric.refusal_sales_percent ? `${Number(metric.refusal_sales_percent).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* % невыкупа */}
                  <div className="col-span-1 flex flex-col items-center justify-center" title="% невыкупа">
                    <span className="text-xs text-gray-500 mb-1">Невыкуп</span>
                    <div className="flex items-center">
                      <Percent className="h-3 w-3 text-gray-600 mr-0.5" />
                      <span className="font-mono text-xs text-gray-900">
                        {metric.no_pickup_percent ? `${Number(metric.no_pickup_percent).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Сезонность */}
                  <div className="col-span-1 flex flex-col items-center justify-center" title="Сезонность товара">
                    <span className="text-xs text-gray-500 mb-1">Сезон</span>
                    <div className="flex items-center">
                      <Snowflake className="h-3 w-3 text-cyan-600 mr-0.5" />
                      <span className="text-xs text-gray-900">
                        {metric.special_season_start && metric.special_season_end
                          ? `${metric.special_season_start}-${metric.special_season_end}`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Цена */}
                  <div className="col-span-1 flex flex-col items-center justify-center" title="Цена товара">
                    <span className="text-xs text-gray-500 mb-1">Цена</span>
                    <div className="flex items-center">
                      <DollarSign className="h-3 w-3 text-green-700 mr-0.5" />
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {metric.offer_price ? `${Number(metric.offer_price).toFixed(2)}₴` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OffersTL;
