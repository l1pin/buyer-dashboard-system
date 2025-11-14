// src/components/OffersTL.js
import React, { useState, useEffect, useMemo } from 'react';
import { metricsAnalyticsService } from '../supabaseClient';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { updateStocksFromYml as updateStocksFromYmlScript } from '../../scripts/offers/Offers_stock';

function OffersTL({ user }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [openTooltip, setOpenTooltip] = useState(null);
  const [openDateTooltip, setOpenDateTooltip] = useState(null);
  const [loadingStocks, setLoadingStocks] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, []);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openTooltip !== null && !event.target.closest('.tooltip-container')) {
        setOpenTooltip(null);
      }
      if (openDateTooltip !== null && !event.target.closest('.date-tooltip-container')) {
        setOpenDateTooltip(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openTooltip, openDateTooltip]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('🔄 Начинаем загрузку метрик для офферов...');

      const data = await metricsAnalyticsService.getAllMetricsLarge();
      setMetrics(data.metrics || []);
      setLastUpdated(data.lastUpdated);

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

  const updateStocksFromYml = async () => {
    try {
      setLoadingStocks(true);
      setError('');

      // Используем функцию из отдельного скрипта
      const result = await updateStocksFromYmlScript(metrics);

      setMetrics(result.metrics);
      setSuccess(`✅ Остатки успешно обновлены для ${result.totalArticles} артикулов`);

    } catch (error) {
      console.error('❌ Ошибка загрузки остатков:', error);
      setError('Ошибка загрузки остатков: ' + error.message);
    } finally {
      setLoadingStocks(false);
      setTimeout(() => setSuccess(''), 5000);
    }
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
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    } catch (error) {
      return '—';
    }
  };

  const formatFullDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return '—';
    }
  };

  const calculateDaysUntilArrival = (dateString) => {
    if (!dateString) return null;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const arrivalDate = new Date(dateString);
      arrivalDate.setHours(0, 0, 0, 0);
      const diffTime = arrivalDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (error) {
      return null;
    }
  };

  // Фильтрация и сортировка
  const filteredMetrics = useMemo(() => {
    return metrics.filter(metric => {
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
  }, [metrics, searchTerm, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Функция для получения цветов зон
  const getZoneColors = (zoneName) => {
    if (!zoneName) return null;
    const name = zoneName.toLowerCase();
    if (name.includes('sos')) return { bg: 'bg-black', text: 'text-yellow-400', border: 'border-black' };
    if (name.includes('красн')) return { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' };
    if (name.includes('розов')) return { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' };
    if (name.includes('золот')) return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
    if (name.includes('зелен')) return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
    return null;
  };

  // Функция для получения цветов зон по типу
  const getZoneColorsByType = (zoneType) => {
    switch (zoneType) {
      case 'red': return { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' };
      case 'pink': return { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' };
      case 'gold': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
      case 'green': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
      default: return null;
    }
  };

  // Компонент тултипа с информацией о зонах
  const ZonesTooltip = ({ metric, onClose }) => {
    return (
      <div className="absolute z-50 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-4 min-w-max"
           style={{ left: '50%', top: '100%', transform: 'translateX(-50%)', marginTop: '8px' }}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Цена лида в зоне</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {/* Красная зона */}
          {metric.red_zone_price !== null && metric.red_zone_price !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-20">Красная:</span>
              <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${getZoneColorsByType('red').bg} ${getZoneColorsByType('red').text} ${getZoneColorsByType('red').border}`}>
                ${Number(metric.red_zone_price).toFixed(2)}
              </span>
            </div>
          )}
          {/* Розовая зона */}
          {metric.pink_zone_price !== null && metric.pink_zone_price !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-20">Розовая:</span>
              <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${getZoneColorsByType('pink').bg} ${getZoneColorsByType('pink').text} ${getZoneColorsByType('pink').border}`}>
                ${Number(metric.pink_zone_price).toFixed(2)}
              </span>
            </div>
          )}
          {/* Золотая зона */}
          {metric.gold_zone_price !== null && metric.gold_zone_price !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-20">Золотая:</span>
              <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${getZoneColorsByType('gold').bg} ${getZoneColorsByType('gold').text} ${getZoneColorsByType('gold').border}`}>
                ${Number(metric.gold_zone_price).toFixed(2)}
              </span>
            </div>
          )}
          {/* Зеленая зона */}
          {metric.green_zone_price !== null && metric.green_zone_price !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-20">Зеленая:</span>
              <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${getZoneColorsByType('green').bg} ${getZoneColorsByType('green').text} ${getZoneColorsByType('green').border}`}>
                ${Number(metric.green_zone_price).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Компонент тултипа с датой прихода
  const DateTooltip = ({ dateString, onClose }) => {
    return (
      <div className="absolute z-50 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-4 min-w-max"
           style={{ left: '50%', top: '100%', transform: 'translateX(-50%)', marginTop: '8px' }}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Дата прихода</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="text-sm text-gray-900 font-mono">
          {formatFullDate(dateString)}
        </div>
      </div>
    );
  };


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


      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-20">
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

      {/* Cards with Header Row */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {metrics.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Нет данных офферов
              </h3>
              <p className="text-gray-600 mb-4">
                Данные офферов будут загружены из метрик аналитика
              </p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4">
            {/* Horizontal Scroll Container */}
            <div className="overflow-x-auto">
              {/* Header Row */}
              <div className="bg-gray-100 rounded-lg border border-gray-300 mb-2 p-2 sticky top-0 z-10">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 text-center min-w-max">
                <div className="w-12 flex-shrink-0">№</div>
                <div className="w-24 flex-shrink-0">Артикул</div>
                <div className="w-48 flex-shrink-0 text-left">Название</div>
                <div className="w-20 flex-shrink-0">Статус</div>
                <div className="w-20 flex-shrink-0">CPL 4дн</div>
                <div className="w-20 flex-shrink-0">Лиды 4дн</div>
                <div className="w-12 flex-shrink-0" title="Продажи на 1 заявку">
                  <svg className="text-gray-700 w-5 h-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                </div>
                <div className="w-12 flex-shrink-0" title="Рейтинг">
                  <svg className="text-gray-700 w-5 h-5 mx-auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M12 17.75l-6.172 3.245 1.179-6.873-4.993-4.867 6.9-1.002L12 2l3.086 6.253 6.9 1.002-4.993 4.867 1.179 6.873z" />
                  </svg>
                </div>
                <div className="w-12 flex-shrink-0" title="Реклама">
                  <svg className="text-gray-700 w-5 h-5 mx-auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M7 15v-4a2 2 0 0 1 4 0v4" />
                    <line x1="7" y1="13" x2="11" y2="13" />
                    <path d="M17 9v6h-1.5a1.5 1.5 0 1 1 1.5 -1.5" />
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0" title="Зона эффективности">
                  <svg className="text-gray-700 w-5 h-5 mx-auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <ellipse cx="12" cy="6" rx="8" ry="3"></ellipse>
                    <path d="M4 6v6a8 3 0 0 0 16 0v-6" />
                    <path d="M4 12v6a8 3 0 0 0 16 0v-6" />
                  </svg>
                </div>
                <div className="w-20 flex-shrink-0" title="Цена лида в зоне">
                  <svg className="text-gray-700 w-5 h-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0" title="Дней продаж">
                  <svg className="text-gray-700 w-5 h-5 mx-auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <rect x="4" y="5" width="16" height="16" rx="2" />
                    <line x1="16" y1="3" x2="16" y2="7" />
                    <line x1="8" y1="3" x2="8" y2="7" />
                    <line x1="4" y1="11" x2="20" y2="11" />
                    <line x1="10" y1="16" x2="14" y2="16" />
                    <line x1="12" y1="14" x2="12" y2="18" />
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0 flex items-center justify-center gap-1" title="Остаток">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M3 21v-13l9-4l9 4v13" />
                    <path d="M13 13h4v8h-10v-6h6" />
                    <path d="M13 21v-9a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v3" />
                  </svg>
                  <button
                    onClick={updateStocksFromYml}
                    disabled={loadingStocks}
                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    title="Обновить остатки из YML"
                  >
                    <RefreshCw className={`h-4 w-4 text-gray-700 ${loadingStocks ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="w-20 flex-shrink-0" title="Дней до прихода">
                  <svg className="text-gray-700 w-5 h-5 mx-auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <circle cx="7" cy="17" r="2" />
                    <circle cx="17" cy="17" r="2" />
                    <path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5" />
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0" title="% отказа от продаж">
                  <svg className="text-gray-700 w-5 h-5 mx-auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="5" x2="5" y2="19" />
                    <circle cx="6.5" cy="6.5" r="2.5" />
                    <circle cx="17.5" cy="17.5" r="2.5" />
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0" title="% невыкупа">
                  <svg className="text-gray-700 w-5 h-5 mx-auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M9 5H7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2V7a2 2 0 0 0 -2 -2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="2" />
                    <path d="M10 12l4 4m0 -4l-4 4" />
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0">Сезон</div>
                <div className="w-20 flex-shrink-0" title="Цена">
                  <svg className="text-gray-700 w-5 h-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                </div>
              </div>

              {/* Cards */}
              <div className="space-y-1">
              {filteredMetrics.map((metric, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-2"
                >
                  <div className="flex items-center gap-2 text-sm text-center min-w-max">
                    {/* № */}
                    <div className="w-12 flex-shrink-0 text-gray-900">{metric.id}</div>

                    {/* Артикул */}
                    <div className="w-24 flex-shrink-0 font-mono text-xs text-gray-900">{metric.article || '—'}</div>

                    {/* Название */}
                    <div className="w-48 flex-shrink-0 text-left">
                      <span className="text-sm text-gray-900 truncate block" title={metric.offer}>
                        {metric.offer || '—'}
                      </span>
                    </div>

                    {/* Статус */}
                    <div className="w-20 flex-shrink-0 text-xs text-gray-600 flex items-center justify-center gap-1">
                      <span>—</span>
                      <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>

                    {/* CPL 4 дн. */}
                    <div className="w-20 flex-shrink-0 text-xs text-gray-600 flex items-center justify-center gap-1">
                      <span>—</span>
                      <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>

                    {/* Лиды 4 дн. */}
                    <div className="w-20 flex-shrink-0 text-xs text-gray-600 flex items-center justify-center gap-1">
                      <span>—</span>
                      <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>

                    {/* Продажи на 1 заявку */}
                    <div className="w-12 flex-shrink-0 text-xs text-gray-900 text-center">
                      {metric.k_lead !== null && metric.k_lead !== undefined ? Number(metric.k_lead).toFixed(2) : '—'}
                    </div>

                    {/* Рейтинг */}
                    <div className="w-12 flex-shrink-0 text-xs text-gray-600 flex items-center justify-center gap-1">
                      <span>—</span>
                      <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>

                    {/* Реклама */}
                    <div className="w-12 flex-shrink-0 text-xs text-gray-600 flex items-center justify-center gap-1">
                      <span>—</span>
                      <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>

                    {/* Зона эффективности (Факт ROI) */}
                    <div className="w-16 flex-shrink-0 flex items-center justify-center gap-1">
                      {(() => {
                        const zoneColors = getZoneColors(metric.offer_zone);
                        if (zoneColors && metric.actual_roi_percent) {
                          return (
                            <>
                              <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${zoneColors.bg} ${zoneColors.text} ${zoneColors.border}`}>
                                {Number(metric.actual_roi_percent).toFixed(1)}%
                              </span>
                              <svg className="text-gray-500 w-3 h-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            </>
                          );
                        }
                        return (
                          <>
                            <span className="font-mono text-xs text-gray-900">{metric.actual_roi_percent ? `${Number(metric.actual_roi_percent).toFixed(1)}%` : '—'}</span>
                            <svg className="text-gray-500 w-3 h-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                          </>
                        );
                      })()}
                    </div>

                    {/* Цена лида в зоне (Красная зона) */}
                    <div className="w-20 flex-shrink-0 flex items-center justify-center gap-1 relative tooltip-container">
                      {(() => {
                        // Используем цену из красной зоны
                        const redZonePrice = metric.red_zone_price;
                        const zoneColors = getZoneColorsByType('red');

                        if (redZonePrice === null || redZonePrice === undefined) {
                          return (
                            <>
                              <span className="text-gray-500 italic text-xs">нет данных</span>
                              <svg
                                className="text-gray-500 w-3 h-3 flex-shrink-0 cursor-pointer hover:text-gray-700"
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenTooltip(openTooltip === index ? null : index);
                                }}
                              >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            </>
                          );
                        }

                        return (
                          <>
                            <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${zoneColors.bg} ${zoneColors.text} ${zoneColors.border}`}>
                              ${Number(redZonePrice).toFixed(2)}
                            </span>
                            <svg
                              className="text-gray-500 w-3 h-3 flex-shrink-0 cursor-pointer hover:text-gray-700"
                              xmlns="http://www.w3.org/2000/svg"
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenTooltip(openTooltip === index ? null : index);
                              }}
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                          </>
                        );
                      })()}
                      {openTooltip === index && (
                        <ZonesTooltip
                          metric={metric}
                          onClose={() => setOpenTooltip(null)}
                        />
                      )}
                    </div>

                    {/* Дней продаж */}
                    <div className="w-16 flex-shrink-0 text-xs text-gray-600 flex items-center justify-center gap-1">
                      <span>—</span>
                      <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>

                    {/* Остаток */}
                    <div className="w-16 flex-shrink-0 text-xs flex items-center justify-center gap-1">
                      {loadingStocks ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      ) : (
                        <>
                          <span className={`font-mono ${metric.stock_quantity !== null && metric.stock_quantity !== undefined ? 'text-gray-900' : 'text-gray-600'}`}>
                            {metric.stock_quantity !== null && metric.stock_quantity !== undefined ? metric.stock_quantity : '—'}
                          </span>
                          <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </>
                      )}
                    </div>

                    {/* Дней до прихода (Расчетный приход) */}
                    <div className="w-20 flex-shrink-0 font-mono text-xs flex items-center justify-center gap-1 relative date-tooltip-container">
                      {(() => {
                        const daysUntil = calculateDaysUntilArrival(metric.next_calculated_arrival);
                        if (daysUntil === null) {
                          return (
                            <>
                              <span className="text-gray-900">—</span>
                              <svg
                                className="text-gray-500 w-3 h-3 cursor-pointer hover:text-gray-700"
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDateTooltip(openDateTooltip === index ? null : index);
                                }}
                              >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            </>
                          );
                        }
                        const textColor = daysUntil < 0 ? 'text-red-600' : 'text-green-600';
                        const displayValue = `${daysUntil}`;
                        return (
                          <>
                            <span className={textColor}>{displayValue}</span>
                            <svg
                              className="text-gray-500 w-3 h-3 cursor-pointer hover:text-gray-700"
                              xmlns="http://www.w3.org/2000/svg"
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDateTooltip(openDateTooltip === index ? null : index);
                              }}
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                          </>
                        );
                      })()}
                      {openDateTooltip === index && (
                        <DateTooltip
                          dateString={metric.next_calculated_arrival}
                          onClose={() => setOpenDateTooltip(null)}
                        />
                      )}
                    </div>

                    {/* % отказа от продаж */}
                    <div className="w-16 flex-shrink-0 font-mono text-xs text-gray-900 flex items-center justify-center gap-1">
                      <span>{metric.refusal_sales_percent ? `${Number(metric.refusal_sales_percent).toFixed(1)}%` : '—'}</span>
                      <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>

                    {/* % невыкупа */}
                    <div className="w-16 flex-shrink-0 font-mono text-xs text-gray-900 flex items-center justify-center gap-1">
                      <span>{metric.no_pickup_percent ? `${Number(metric.no_pickup_percent).toFixed(1)}%` : '—'}</span>
                      <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>

                    {/* Сезон */}
                    <div className="w-16 flex-shrink-0 text-xs text-gray-600 flex items-center justify-center gap-1">
                      <span>—</span>
                      <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>

                    {/* Цена (Цена оффера) */}
                    <div className="w-20 flex-shrink-0 font-mono text-xs text-gray-900 flex items-center justify-center gap-1">
                      <span>{metric.offer_price ? `${Number(metric.offer_price).toFixed(0)}₴` : '—'}</span>
                      <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OffersTL;
