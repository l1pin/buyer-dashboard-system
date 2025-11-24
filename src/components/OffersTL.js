// src/components/OffersTL.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { metricsAnalyticsService, userService } from '../supabaseClient';
import { offerStatusService, offerBuyersService } from '../services/OffersSupabase';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { updateStocksFromYml as updateStocksFromYmlScript } from '../scripts/offers/Offers_stock';
import { calculateRemainingDays as calculateRemainingDaysScript } from '../scripts/offers/Calculate_days';
import { updateLeadsFromSql as updateLeadsFromSqlScript } from '../scripts/offers/Sql_leads';
import DraggableTooltip from './DraggableTooltip';
import OfferRow from './OfferRow';

function OffersTL({ user }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [openTooltips, setOpenTooltips] = useState([]); // Массив открытых tooltip'ов
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [loadingLeadsData, setLoadingLeadsData] = useState(false); // Единое состояние для CPL, Лидов и Рейтинга
  const [stockData, setStockData] = useState({});
  const [allBuyers, setAllBuyers] = useState([]); // Все байеры для офферов
  const [offerStatuses, setOfferStatuses] = useState({}); // Статусы офферов (с днями)
  const [allAssignments, setAllAssignments] = useState({}); // Все привязки байеров к офферам (по offer_id)

  // Загружаем ВСЁ параллельно при монтировании
  useEffect(() => {
    loadAllData();
  }, []);

  // Главная функция загрузки - всё параллельно
  const loadAllData = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('🔄 Загружаем все данные параллельно...');

      // Запускаем ВСЕ запросы параллельно
      const [metricsResult, buyersResult, statusesResult, assignmentsResult] = await Promise.all([
        metricsAnalyticsService.getAllMetricsLarge().catch(e => ({ metrics: [], error: e })),
        userService.getUsersByRole('buyer').catch(e => []),
        offerStatusService.getAllStatuses().catch(e => []),
        offerBuyersService.getAllAssignments().catch(e => [])
      ]);

      // Устанавливаем метрики
      const metricsData = metricsResult.metrics || [];
      setMetrics(metricsData);
      setLastUpdated(metricsResult.lastUpdated);

      // Устанавливаем байеров
      setAllBuyers(buyersResult || []);

      // Обрабатываем статусы
      const statusesMap = {};
      (statusesResult || []).forEach(status => {
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

      // Группируем привязки по offer_id
      const grouped = {};
      (assignmentsResult || []).forEach(a => {
        if (!grouped[a.offer_id]) {
          grouped[a.offer_id] = [];
        }
        grouped[a.offer_id].push(a);
      });
      setAllAssignments(grouped);

      if (metricsData.length > 0) {
        setSuccess(`✅ Загружено ${metricsData.length} офферов`);
      }

      console.log('✅ Все данные загружены');

    } catch (error) {
      console.error('❌ Ошибка загрузки:', error);
      setError('Ошибка загрузки: ' + error.message);
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  // Callback для обновления привязок после изменения
  const handleAssignmentsChange = useCallback((offerId, newAssignments) => {
    setAllAssignments(prev => ({
      ...prev,
      [offerId]: newAssignments
    }));
  }, []);

  // Обновление статусов после изменения
  const handleStatusChange = async (offerId, newStatus) => {
    // Обновляем локально без перезагрузки
    setOfferStatuses(prev => ({
      ...prev,
      [offerId]: {
        ...prev[offerId],
        current_status: newStatus,
        days_in_status: 0
      }
    }));
  };

  // Функция для открытия нового tooltip
  const openTooltip = useCallback((type, index, data, event) => {
    const tooltipId = `${type}-${index}`;

    let position = { x: 100, y: 100 };
    if (event && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      position = {
        x: rect.left + rect.width + 10,
        y: rect.top
      };
    }

    setOpenTooltips(prev => {
      if (prev.find(t => t.id === tooltipId)) {
        return prev;
      }
      const finalPosition = event && event.currentTarget ? position : {
        x: position.x + prev.length * 30,
        y: position.y + prev.length * 30
      };
      return [...prev, {
        id: tooltipId,
        type,
        index,
        data,
        position: finalPosition,
        zIndex: 1000 + prev.length
      }];
    });
  }, []);

  // Функция для закрытия tooltip
  const closeTooltip = useCallback((tooltipId) => {
    setOpenTooltips(prev => prev.filter(t => t.id !== tooltipId));
  }, []);

  const updateStocksFromYml = async () => {
    try {
      setLoadingStocks(true);
      setError('');

      // Используем функцию из отдельного скрипта
      const result = await updateStocksFromYmlScript(metrics);

      setMetrics(result.metrics);
      setStockData(result.skuData); // Сохраняем данные о модификациях
      setSuccess(`✅ Остатки успешно обновлены для ${result.totalArticles} артикулов`);

    } catch (error) {
      console.error('❌ Ошибка загрузки остатков:', error);
      setError('Ошибка загрузки остатков: ' + error.message);
    } finally {
      setLoadingStocks(false);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const calculateDays = async () => {
    try {
      setLoadingDays(true);
      setError('');

      // Используем функцию из отдельного скрипта
      const result = await calculateRemainingDaysScript(metrics);

      setMetrics(result.metrics);
      setSuccess(`✅ Дни продаж рассчитаны для ${result.processedCount} офферов`);

    } catch (error) {
      console.error('❌ Ошибка расчета дней продаж:', error);
      setError('Ошибка расчета дней продаж: ' + error.message);
    } finally {
      setLoadingDays(false);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  // Единая функция для обновления ТРЕХ колонок: CPL 4дн, Лиды 4дн, Рейтинг
  const updateLeadsData = async () => {
    try {
      setLoadingLeadsData(true);
      setError('');

      // Универсальный скрипт обновляет ВСЕ ТРИ колонки одним запросом
      const result = await updateLeadsFromSqlScript(metrics);

      setMetrics(result.metrics);
      setSuccess(`✅ Обновлены CPL, Лиды и Рейтинг для ${result.processedCount} офферов`);

    } catch (error) {
      console.error('❌ Ошибка загрузки данных из БД:', error);
      setError('Ошибка загрузки данных: ' + error.message);
    } finally {
      setLoadingLeadsData(false);
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

  const formatFullDate = useCallback((dateString) => {
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
  }, []);

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

  // Компонент тултипа с модификациями товара
  const StockTooltip = ({ article, onClose }) => {
    const baseArticle = article ? article.split("-")[0] : null;
    const modifications = baseArticle && stockData[baseArticle]?.modificationsDisplay || [];

    return (
      <div className="absolute z-50 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-4 min-w-max"
           style={{ left: '50%', top: '100%', transform: 'translateX(-50%)', marginTop: '8px' }}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Модификации товара</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {modifications.length > 0 ? (
            modifications.map((mod, index) => (
              <div key={index} className="text-xs text-gray-700">
                {mod}
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-500 italic">Нет данных о модификациях</div>
          )}
        </div>
      </div>
    );
  };

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

  // Функция для рендера содержимого tooltip в зависимости от типа
  const renderTooltipContent = useCallback((tooltip) => {
    switch (tooltip.type) {
      case 'rating':
        return (
          <div className="flex flex-col gap-2">
            {tooltip.data.ratingHistory && tooltip.data.ratingHistory.length > 0 ? (
              tooltip.data.ratingHistory.map((item, index) => (
                <div key={index} className="flex items-center gap-3 text-xs border-b border-gray-100 pb-2 last:border-b-0">
                  <span className="text-gray-600 w-20">{item.month} {item.year}</span>
                  <span className={`font-semibold px-2 py-1 rounded ${getRatingColor(item.rating)}`}>
                    {item.rating}
                  </span>
                  <span className="text-gray-700 font-mono">CPL: {item.cpl > 0 ? item.cpl.toFixed(2) : '—'}</span>
                  <span className="text-gray-700">Лиды: {item.leads}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500 italic">Нет данных за предыдущие месяцы</div>
            )}
          </div>
        );
      case 'cpl':
        return (
          <div className="w-full">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1 px-2 font-semibold text-gray-700">Период</th>
                  <th className="text-right py-1 px-2 font-semibold text-gray-700">CPL</th>
                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Расход</th>
                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Лидов</th>
                </tr>
              </thead>
              <tbody>
                {[7, 14, 30, 60, 90].map(days => {
                  const data = tooltip.data.leadsData?.[days];
                  if (!data) return null;
                  return (
                    <tr key={days} className="border-b border-gray-100">
                      <td className="py-1 px-2 text-gray-900">{data.label}</td>
                      <td className="py-1 px-2 text-right font-mono text-gray-900">{data.cpl.toFixed(2)}</td>
                      <td className="py-1 px-2 text-right font-mono text-gray-900">{data.cost.toFixed(2)}</td>
                      <td className="py-1 px-2 text-right font-mono text-gray-900">{data.leads}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      case 'leads':
        return (
          <div className="w-full">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1 px-2 font-semibold text-gray-700">Период</th>
                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Лидов</th>
                  <th className="text-right py-1 px-2 font-semibold text-gray-700">CPL</th>
                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Расход</th>
                </tr>
              </thead>
              <tbody>
                {[7, 14, 30, 60, 90].map(days => {
                  const data = tooltip.data.leadsData?.[days];
                  if (!data) return null;
                  return (
                    <tr key={days} className="border-b border-gray-100">
                      <td className="py-1 px-2 text-gray-900">{data.label}</td>
                      <td className="py-1 px-2 text-right font-mono text-gray-900">{data.leads}</td>
                      <td className="py-1 px-2 text-right font-mono text-gray-900">{data.cpl.toFixed(2)}</td>
                      <td className="py-1 px-2 text-right font-mono text-gray-900">{data.cost.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      case 'stock':
        const baseArticle = tooltip.data.article ? tooltip.data.article.split("-")[0] : null;
        const modifications = baseArticle && stockData[baseArticle]?.modificationsDisplay || [];
        return (
          <div className="flex flex-col gap-1.5">
            {modifications.length > 0 ? (
              modifications.map((mod, index) => (
                <div key={index} className="text-xs text-gray-700">
                  {mod}
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500 italic">Нет данных о модификациях</div>
            )}
          </div>
        );
      case 'date':
        return (
          <div className="text-sm text-gray-900 font-mono">
            {tooltip.data.date ? formatFullDate(tooltip.data.date) : 'Нет данных'}
          </div>
        );
      case 'zone':
        const metric = tooltip.data.metric;
        return (
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
        );
      case 'status_history':
        const statusHistory = tooltip.data.statusHistory || [];
        return (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
            {statusHistory.length > 0 ? (
              statusHistory.map((entry, index) => {
                const statusConfig = offerStatusService.getStatusColor(entry.status);
                const isCurrentStatus = index === 0;

                // Форматируем даты
                const formatDateTime = (dateString) => {
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

                return (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-2 ${isCurrentStatus ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}
                  >
                    {/* Статус и badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-3 h-3 rounded-full ${statusConfig.color}`}></span>
                      <span className="text-sm font-semibold text-gray-900">{entry.status}</span>
                      {isCurrentStatus && (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                          Текущий
                        </span>
                      )}
                    </div>

                    {/* Даты "с" и "до" */}
                    <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">С:</span>
                        <span className="font-mono">{formatDateTime(entry.from_date)}</span>
                      </div>
                      <span>→</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">До:</span>
                        <span className="font-mono">{formatDateTime(entry.to_date)}</span>
                      </div>
                    </div>

                    {/* Длительность */}
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">Длительность:</span>{' '}
                      <span className="font-semibold">{entry.days_in_status} дн.</span>
                    </div>

                    {/* Комментарий */}
                    {entry.comment && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-700 italic">"{entry.comment}"</p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-gray-500 italic text-center py-4">
                История статусов пуста
              </div>
            )}
          </div>
        );
      default:
        return <div>Неизвестный тип tooltip</div>;
    }
  }, [stockData, getRatingColor, formatFullDate, getZoneColorsByType]);

  // Функция для получения заголовка tooltip
  const getTooltipTitle = useCallback((tooltip) => {
    const article = tooltip.data.article;

    // Стилизованный артикул в виде голубой плашки (как в Trello)
    const articleBadge = article ? (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        {article}
      </span>
    ) : null;

    switch (tooltip.type) {
      case 'rating':
        return (
          <div className="flex items-center gap-2">
            <span>История рейтинга</span>
            {articleBadge}
          </div>
        );
      case 'cpl':
        return (
          <div className="flex items-center gap-2">
            <span>Статистика CPL</span>
            {articleBadge}
          </div>
        );
      case 'leads':
        return (
          <div className="flex items-center gap-2">
            <span>Статистика лидов</span>
            {articleBadge}
          </div>
        );
      case 'stock':
        return (
          <div className="flex items-center gap-2">
            <span>Модификации товара</span>
            {articleBadge}
          </div>
        );
      case 'date':
        return (
          <div className="flex items-center gap-2">
            <span>Дата прихода</span>
            {articleBadge}
          </div>
        );
      case 'zone':
        return (
          <div className="flex items-center gap-2">
            <span>Цена лида в зоне</span>
            {articleBadge}
          </div>
        );
      case 'status_history':
        return (
          <div className="flex items-center gap-2">
            <span>История статусов</span>
            {articleBadge}
          </div>
        );
      default:
        return 'Информация';
    }
  }, []);


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
              onClick={loadAllData}
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
                <div className="w-32 flex-shrink-0">Статус</div>
                <div className="w-20 flex-shrink-0 flex items-center justify-center gap-1">
                  <span>CPL 4дн</span>
                  <button
                    onClick={updateLeadsData}
                    disabled={loadingLeadsData}
                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    title="Обновить CPL и лиды из БД"
                  >
                    <RefreshCw className={`h-4 w-4 text-gray-700 ${loadingLeadsData ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="w-20 flex-shrink-0 flex items-center justify-center gap-1">
                  <span>Лиды 4дн</span>
                  <button
                    onClick={updateLeadsData}
                    disabled={loadingLeadsData}
                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    title="Обновить CPL и лиды из БД"
                  >
                    <RefreshCw className={`h-4 w-4 text-gray-700 ${loadingLeadsData ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="w-12 flex-shrink-0" title="Продажи на 1 заявку">
                  <svg className="text-gray-700 w-5 h-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                </div>
                <div className="w-12 flex-shrink-0 flex items-center justify-center gap-1">
                  <svg className="text-gray-700 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" title="Рейтинг">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M12 17.75l-6.172 3.245 1.179-6.873-4.993-4.867 6.9-1.002L12 2l3.086 6.253 6.9 1.002-4.993 4.867 1.179 6.873z" />
                  </svg>
                  <button
                    onClick={updateLeadsData}
                    disabled={loadingLeadsData}
                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    title="Обновить CPL, Лиды и Рейтинг из БД"
                  >
                    <RefreshCw className={`h-4 w-4 text-gray-700 ${loadingLeadsData ? 'animate-spin' : ''}`} />
                  </button>
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
                <div className="w-16 flex-shrink-0 flex items-center justify-center gap-1" title="Дней продаж">
                  <svg className="text-gray-700 w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z"/>
                    <rect x="4" y="5" width="16" height="16" rx="2" />
                    <line x1="16" y1="3" x2="16" y2="7" />
                    <line x1="8" y1="3" x2="8" y2="7" />
                    <line x1="4" y1="11" x2="20" y2="11" />
                    <line x1="10" y1="16" x2="14" y2="16" />
                    <line x1="12" y1="14" x2="12" y2="18" />
                  </svg>
                  <button
                    onClick={calculateDays}
                    disabled={loadingDays}
                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    title="Рассчитать дни продаж"
                  >
                    <RefreshCw className={`h-4 w-4 text-gray-700 ${loadingDays ? 'animate-spin' : ''}`} />
                  </button>
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
                  <OfferRow
                    key={metric.id}
                    metric={metric}
                    index={index}
                    offerStatus={offerStatuses[metric.id]}
                    loadingLeadsData={loadingLeadsData}
                    loadingDays={loadingDays}
                    loadingStocks={loadingStocks}
                    onOpenTooltip={openTooltip}
                    onStatusChange={handleStatusChange}
                    userName={user?.full_name || user?.email || 'User'}
                    allBuyers={allBuyers}
                    initialAssignments={allAssignments[metric.id] || []}
                    onAssignmentsChange={handleAssignmentsChange}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Рендер всех открытых tooltip'ов поверх всей страницы */}
      {openTooltips.map(tooltip => (
        <DraggableTooltip
          key={tooltip.id}
          title={getTooltipTitle(tooltip)}
          onClose={() => closeTooltip(tooltip.id)}
          initialPosition={tooltip.position}
          zIndex={tooltip.zIndex}
        >
          {renderTooltipContent(tooltip)}
        </DraggableTooltip>
      ))}
    </div>
  );
}

export default OffersTL;
