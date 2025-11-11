// src/components/OffersTL.js
import React, { useState, useEffect } from 'react';
import { metricsAnalyticsService } from '../supabaseClient';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

function OffersTL({ user }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

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
              <div className="bg-gray-100 rounded-lg border border-gray-300 mb-2 p-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 text-center min-w-max">
                <div className="w-12 flex-shrink-0">№</div>
                <div className="w-24 flex-shrink-0">Артикул</div>
                <div className="w-48 flex-shrink-0 text-left">Название</div>
                <div className="w-20 flex-shrink-0 flex items-center justify-center gap-1">
                  <span>Статус</span>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-20 flex-shrink-0 flex items-center justify-center gap-1">
                  <span>CPL 4дн</span>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-20 flex-shrink-0 flex items-center justify-center gap-1">
                  <span>Лиды 4дн</span>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-12 flex-shrink-0 flex flex-col items-center justify-center gap-1" title="Продажи на 1 заявку">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-12 flex-shrink-0 flex flex-col items-center justify-center gap-1" title="Рейтинг">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M12 17.75l-6.172 3.245 1.179-6.873-4.993-4.867 6.9-1.002L12 2l3.086 6.253 6.9 1.002-4.993 4.867 1.179 6.873z" />
                  </svg>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-12 flex-shrink-0 flex flex-col items-center justify-center gap-1" title="Реклама">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M7 15v-4a2 2 0 0 1 4 0v4" />
                    <line x1="7" y1="13" x2="11" y2="13" />
                    <path d="M17 9v6h-1.5a1.5 1.5 0 1 1 1.5 -1.5" />
                  </svg>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0 flex flex-col items-center justify-center gap-1" title="Зона эффективности">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <ellipse cx="12" cy="6" rx="8" ry="3"></ellipse>
                    <path d="M4 6v6a8 3 0 0 0 16 0v-6" />
                    <path d="M4 12v6a8 3 0 0 0 16 0v-6" />
                  </svg>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-1" title="Цена лида в зоне">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0 flex flex-col items-center justify-center gap-1" title="Дней продаж">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <rect x="4" y="5" width="16" height="16" rx="2" />
                    <line x1="16" y1="3" x2="16" y2="7" />
                    <line x1="8" y1="3" x2="8" y2="7" />
                    <line x1="4" y1="11" x2="20" y2="11" />
                    <line x1="10" y1="16" x2="14" y2="16" />
                    <line x1="12" y1="14" x2="12" y2="18" />
                  </svg>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0 flex flex-col items-center justify-center gap-1" title="Остаток">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M3 21v-13l9-4l9 4v13" />
                    <path d="M13 13h4v8h-10v-6h6" />
                    <path d="M13 21v-9a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v3" />
                  </svg>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-1" title="Дней до прихода">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <circle cx="7" cy="17" r="2" />
                    <circle cx="17" cy="17" r="2" />
                    <path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5" />
                  </svg>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0 flex flex-col items-center justify-center gap-1" title="% отказа от продаж">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="5" x2="5" y2="19" />
                    <circle cx="6.5" cy="6.5" r="2.5" />
                    <circle cx="17.5" cy="17.5" r="2.5" />
                  </svg>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0 flex flex-col items-center justify-center gap-1" title="% невыкупа">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M9 5H7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2V7a2 2 0 0 0 -2 -2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="2" />
                    <path d="M10 12l4 4m0 -4l-4 4" />
                  </svg>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-16 flex-shrink-0 flex items-center justify-center gap-1">
                  <span>Сезон</span>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-1" title="Цена">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
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
                    <div className="w-12 flex-shrink-0 font-semibold text-gray-900">{metric.id}</div>

                    {/* Артикул */}
                    <div className="w-24 flex-shrink-0 font-mono text-xs text-gray-900">{metric.article || '—'}</div>

                    {/* Название */}
                    <div className="w-48 flex-shrink-0 text-left">
                      <span className="font-medium text-sm text-gray-900 truncate block" title={metric.offer}>
                        {metric.offer || '—'}
                      </span>
                    </div>

                    {/* Статус */}
                    <div className="w-20 flex-shrink-0 text-xs text-gray-600">—</div>

                    {/* CPL 4 дн. */}
                    <div className="w-20 flex-shrink-0 text-xs text-gray-600">—</div>

                    {/* Лиды 4 дн. */}
                    <div className="w-20 flex-shrink-0 text-xs text-gray-600">—</div>

                    {/* Продажи на 1 заявку */}
                    <div className="w-12 flex-shrink-0 text-xs text-gray-600">—</div>

                    {/* Рейтинг */}
                    <div className="w-12 flex-shrink-0 text-xs text-gray-600">—</div>

                    {/* Реклама */}
                    <div className="w-12 flex-shrink-0 text-xs text-gray-600">—</div>

                    {/* Зона эффективности (Факт ROI) */}
                    <div className="w-16 flex-shrink-0 font-mono text-xs text-gray-900">
                      {metric.actual_roi_percent ? `${Number(metric.actual_roi_percent).toFixed(1)}%` : '—'}
                    </div>

                    {/* Цена лида в зоне (Факт лид) */}
                    <div className="w-20 flex-shrink-0 font-mono text-xs font-semibold text-gray-900">
                      {metric.actual_lead === 'нет данных' ? '—' : (metric.actual_lead ? `$${Number(metric.actual_lead).toFixed(2)}` : '—')}
                    </div>

                    {/* Дней продаж */}
                    <div className="w-16 flex-shrink-0 text-xs text-gray-600">—</div>

                    {/* Остаток */}
                    <div className="w-16 flex-shrink-0 text-xs text-gray-600">—</div>

                    {/* Дней до прихода (Расчетный приход) */}
                    <div className="w-20 flex-shrink-0 font-mono text-xs text-gray-900">
                      {formatDate(metric.next_calculated_arrival)}
                    </div>

                    {/* % отказа от продаж */}
                    <div className="w-16 flex-shrink-0 font-mono text-xs text-gray-900">
                      {metric.refusal_sales_percent ? `${Number(metric.refusal_sales_percent).toFixed(1)}%` : '—'}
                    </div>

                    {/* % невыкупа */}
                    <div className="w-16 flex-shrink-0 font-mono text-xs text-gray-900">
                      {metric.no_pickup_percent ? `${Number(metric.no_pickup_percent).toFixed(1)}%` : '—'}
                    </div>

                    {/* Сезон */}
                    <div className="w-16 flex-shrink-0 text-xs text-gray-600">—</div>

                    {/* Цена (Цена оффера) */}
                    <div className="w-20 flex-shrink-0 font-mono text-xs font-semibold text-gray-900">
                      {metric.offer_price ? `${Number(metric.offer_price).toFixed(0)}₴` : '—'}
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
