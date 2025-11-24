// src/components/OffersBuyer.js
// Компонент для отображения офферов, привязанных к конкретному байеру
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { metricsAnalyticsService } from '../supabaseClient';
import { offerStatusService, offerBuyersService } from '../services/OffersSupabase';
import { FacebookIcon, GoogleIcon, TiktokIcon } from './SourceIcons';
import {
  RefreshCw,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Package
} from 'lucide-react';
import OfferStatusBadge from './OfferStatusBadge';

function OffersBuyer({ user }) {
  const [metrics, setMetrics] = useState([]);
  const [buyerAssignments, setBuyerAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [offerStatuses, setOfferStatuses] = useState({});

  useEffect(() => {
    loadBuyerOffers();
  }, [user?.id]);

  const loadBuyerOffers = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError('');

      console.log('🔄 Загружаем офферы для байера:', user.name);

      // 1. Получаем привязки байера
      const assignments = await offerBuyersService.getBuyerOffers(user.id);
      setBuyerAssignments(assignments);

      if (assignments.length === 0) {
        setMetrics([]);
        setLoading(false);
        return;
      }

      // 2. Получаем уникальные offer_id
      const offerIds = [...new Set(assignments.map(a => a.offer_id))];

      // 3. Загружаем все метрики
      const data = await metricsAnalyticsService.getAllMetricsLarge();
      setLastUpdated(data.lastUpdated);

      // 4. Фильтруем только привязанные офферы
      const filteredMetrics = (data.metrics || []).filter(m => offerIds.includes(m.id));
      setMetrics(filteredMetrics);

      // 5. Загружаем статусы
      if (filteredMetrics.length > 0) {
        const statusesData = await offerStatusService.getOfferStatuses(offerIds);
        const statusesMap = {};
        statusesData.forEach(status => {
          let daysInStatus = 0;
          if (status.status_history && status.status_history.length > 0) {
            const currentStatusEntry = status.status_history[0];
            const changedAt = new Date(currentStatusEntry.changed_at);
            const now = new Date();
            daysInStatus = Math.floor((now - changedAt) / (1000 * 60 * 60 * 24));
          }
          statusesMap[status.offer_id] = {
            ...status,
            days_in_status: daysInStatus
          };
        });
        setOfferStatuses(statusesMap);
      }

      console.log(`✅ Загружено ${filteredMetrics.length} офферов для байера`);

    } catch (error) {
      console.error('❌ Ошибка загрузки офферов:', error);
      setError('Ошибка загрузки офферов: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Получаем источники для оффера
  const getOfferSources = useCallback((offerId) => {
    return buyerAssignments
      .filter(a => a.offer_id === offerId)
      .map(a => a.source);
  }, [buyerAssignments]);

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

  const handleSort = useCallback((field) => {
    setSortField(prevField => {
      if (prevField === field) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        return prevField;
      } else {
        setSortDirection('asc');
        return field;
      }
    });
  }, []);

  // Функция для получения цвета рейтинга
  const getRatingColor = useCallback((rating) => {
    switch (rating) {
      case 'A': return 'bg-green-100 text-green-800';
      case 'B': return 'bg-blue-100 text-blue-800';
      case 'C': return 'bg-yellow-100 text-yellow-800';
      case 'D': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-400';
    }
  }, []);

  // Функция для получения цветов зон по типу
  const getZoneColorsByType = useCallback((zoneType) => {
    switch (zoneType) {
      case 'red': return { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' };
      case 'pink': return { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' };
      case 'gold': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
      case 'green': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
      default: return null;
    }
  }, []);

  // Компонент иконки источника
  const SourceIcon = ({ source }) => {
    switch (source) {
      case 'Facebook':
        return <FacebookIcon className="w-4 h-4" />;
      case 'Google':
        return <GoogleIcon className="w-4 h-4" />;
      case 'TikTok':
        return <TiktokIcon className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Компонент заголовка таблицы
  const SortableHeader = ({ field, children, className = '' }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </div>
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">Загрузка офферов...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Заголовок */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-7 h-7" />
              Мои офферы
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Офферы, назначенные вам для работы
            </p>
          </div>
          <button
            onClick={loadBuyerOffers}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Обновить
          </button>
        </div>

        {lastUpdated && (
          <p className="text-xs text-gray-400 mt-2">
            Данные обновлены: {new Date(lastUpdated).toLocaleString('ru-RU')}
          </p>
        )}
      </div>

      {/* Сообщения */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Поиск */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по артикулу или названию..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Статистика */}
      <div className="mb-4 flex items-center gap-4 text-sm text-gray-600">
        <span>Всего офферов: <strong>{filteredMetrics.length}</strong></span>
        <span className="text-gray-300">|</span>
        <span>Привязок: <strong>{buyerAssignments.length}</strong></span>
      </div>

      {/* Пустое состояние */}
      {metrics.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Нет привязанных офферов</h3>
          <p className="text-gray-500">
            Вам пока не назначены офферы для работы. Обратитесь к тимлиду для назначения.
          </p>
        </div>
      ) : (
        /* Таблица офферов */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader field="article">Артикул</SortableHeader>
                  <SortableHeader field="offer">Название</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Источники</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Статус</th>
                  <SortableHeader field="stock_quantity">Остаток</SortableHeader>
                  <SortableHeader field="days_remaining">Дней</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Рейтинг</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Зоны CPL</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMetrics.map((metric) => {
                  const status = offerStatuses[metric.id];
                  const sources = getOfferSources(metric.id);

                  return (
                    <tr key={metric.id} className="hover:bg-gray-50 transition-colors">
                      {/* Артикул */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-gray-900">
                          {metric.article}
                        </span>
                      </td>

                      {/* Название */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={metric.offer}>
                          {metric.offer}
                        </div>
                      </td>

                      {/* Источники */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {sources.map((source, idx) => (
                            <div
                              key={idx}
                              className="p-1.5 bg-gray-100 rounded-md"
                              title={source}
                            >
                              <SourceIcon source={source} />
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Статус */}
                      <td className="px-4 py-3">
                        <OfferStatusBadge
                          offerId={metric.id}
                          currentStatus={status?.current_status || 'Активный'}
                          daysInStatus={status?.days_in_status || 0}
                          article={metric.article}
                          offerName={metric.offer}
                          user={user}
                          onStatusChange={() => {}}
                          readOnly={true}
                        />
                      </td>

                      {/* Остаток */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">
                          {metric.stock_quantity !== null && metric.stock_quantity !== undefined
                            ? metric.stock_quantity.toLocaleString('ru-RU')
                            : '—'}
                        </span>
                      </td>

                      {/* Дней продаж */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm font-mono ${
                          metric.days_remaining !== null && metric.days_remaining < 14
                            ? 'text-red-600 font-semibold'
                            : 'text-gray-900'
                        }`}>
                          {metric.days_remaining !== null && metric.days_remaining !== undefined
                            ? metric.days_remaining
                            : '—'}
                        </span>
                      </td>

                      {/* Рейтинг */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${getRatingColor(metric.lead_rating)}`}>
                          {metric.lead_rating || '—'}
                        </span>
                      </td>

                      {/* Зоны CPL */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-xs">
                          {metric.red_zone_price && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${getZoneColorsByType('red').bg} ${getZoneColorsByType('red').text}`}>
                              Красная: ${Number(metric.red_zone_price).toFixed(2)}
                            </span>
                          )}
                          {metric.pink_zone_price && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${getZoneColorsByType('pink').bg} ${getZoneColorsByType('pink').text}`}>
                              Розовая: ${Number(metric.pink_zone_price).toFixed(2)}
                            </span>
                          )}
                          {metric.gold_zone_price && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${getZoneColorsByType('gold').bg} ${getZoneColorsByType('gold').text}`}>
                              Золотая: ${Number(metric.gold_zone_price).toFixed(2)}
                            </span>
                          )}
                          {metric.green_zone_price && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${getZoneColorsByType('green').bg} ${getZoneColorsByType('green').text}`}>
                              Зеленая: ${Number(metric.green_zone_price).toFixed(2)}
                            </span>
                          )}
                          {!metric.red_zone_price && !metric.pink_zone_price && !metric.gold_zone_price && !metric.green_zone_price && (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default OffersBuyer;
