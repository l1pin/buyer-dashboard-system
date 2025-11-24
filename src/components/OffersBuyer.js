// src/components/OffersBuyer.js
// Компонент для отображения офферов, привязанных к конкретному байеру
// Идентичен OffersTL, но без панели привязки байеров
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { metricsAnalyticsService } from '../supabaseClient';
import { offerStatusService, offerBuyersService } from '../services/OffersSupabase';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Package
} from 'lucide-react';
import { updateStocksFromYml as updateStocksFromYmlScript } from '../scripts/offers/Offers_stock';
import { calculateRemainingDays as calculateRemainingDaysScript } from '../scripts/offers/Calculate_days';
import { updateLeadsFromSql as updateLeadsFromSqlScript } from '../scripts/offers/Sql_leads';
import DraggableTooltip from './DraggableTooltip';
import OfferStatusBadge from './OfferStatusBadge';

function OffersBuyer({ user }) {
  const [metrics, setMetrics] = useState([]);
  const [buyerOfferIds, setBuyerOfferIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [openTooltips, setOpenTooltips] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [loadingLeadsData, setLoadingLeadsData] = useState(false);
  const [stockData, setStockData] = useState({});
  const [offerStatuses, setOfferStatuses] = useState({});

  useEffect(() => {
    if (user?.id) {
      loadAllData();
    }
  }, [user?.id]);

  const loadAllData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log('🔄 Загружаем офферы для байера:', user.name);

      // 1. Получаем привязки байера
      let assignments = [];
      try {
        assignments = await offerBuyersService.getBuyerOffers(user.id);
      } catch (e) {
        console.warn('Таблица offer_buyers не найдена:', e.message);
        assignments = [];
      }

      if (assignments.length === 0) {
        setMetrics([]);
        setBuyerOfferIds([]);
        setLoading(false);
        return;
      }

      const offerIds = [...new Set(assignments.map(a => a.offer_id))];
      setBuyerOfferIds(offerIds);

      // 2. Загружаем все данные параллельно
      const [metricsResult, statusesResult] = await Promise.all([
        metricsAnalyticsService.getAllMetricsLarge().catch(e => ({ metrics: [] })),
        offerStatusService.getAllStatuses().catch(e => [])
      ]);

      // 3. Фильтруем только привязанные офферы
      const allMetrics = metricsResult.metrics || [];
      const filteredMetrics = allMetrics.filter(m => offerIds.includes(m.id));
      setMetrics(filteredMetrics);
      setLastUpdated(metricsResult.lastUpdated);

      // 4. Обрабатываем статусы
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

      if (filteredMetrics.length > 0) {
        setSuccess(`✅ Загружено ${filteredMetrics.length} офферов`);
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

  const closeTooltip = useCallback((tooltipId) => {
    setOpenTooltips(prev => prev.filter(t => t.id !== tooltipId));
  }, []);

  const updateStocksFromYml = async () => {
    try {
      setLoadingStocks(true);
      setError('');
      const result = await updateStocksFromYmlScript(metrics);
      setMetrics(result.metrics);
      setStockData(result.skuData);
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

  const updateLeadsData = async () => {
    try {
      setLoadingLeadsData(true);
      setError('');
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

  const getZoneColorsByType = useCallback((zoneType) => {
    switch (zoneType) {
      case 'red': return { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' };
      case 'pink': return { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' };
      case 'gold': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
      case 'green': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
      default: return null;
    }
  }, []);

  const getRatingColor = useCallback((rating) => {
    switch (rating) {
      case 'A': return 'bg-green-100 text-green-800';
      case 'B': return 'bg-blue-100 text-blue-800';
      case 'C': return 'bg-yellow-100 text-yellow-800';
      case 'D': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-400';
    }
  }, []);

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
            {metric.red_zone_price !== null && metric.red_zone_price !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-20">Красная:</span>
                <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${getZoneColorsByType('red').bg} ${getZoneColorsByType('red').text} ${getZoneColorsByType('red').border}`}>
                  ${Number(metric.red_zone_price).toFixed(2)}
                </span>
              </div>
            )}
            {metric.pink_zone_price !== null && metric.pink_zone_price !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-20">Розовая:</span>
                <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${getZoneColorsByType('pink').bg} ${getZoneColorsByType('pink').text} ${getZoneColorsByType('pink').border}`}>
                  ${Number(metric.pink_zone_price).toFixed(2)}
                </span>
              </div>
            )}
            {metric.gold_zone_price !== null && metric.gold_zone_price !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-20">Золотая:</span>
                <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${getZoneColorsByType('gold').bg} ${getZoneColorsByType('gold').text} ${getZoneColorsByType('gold').border}`}>
                  ${Number(metric.gold_zone_price).toFixed(2)}
                </span>
              </div>
            )}
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
                const formatDateTime = (dateString) => {
                  if (!dateString) return '—';
                  try {
                    const date = new Date(dateString);
                    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  } catch (error) {
                    return '—';
                  }
                };
                return (
                  <div key={index} className={`p-3 rounded-lg border-2 ${isCurrentStatus ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-3 h-3 rounded-full ${statusConfig.color}`}></span>
                      <span className="text-sm font-semibold text-gray-900">{entry.status}</span>
                      {isCurrentStatus && (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Текущий</span>
                      )}
                    </div>
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
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">Длительность:</span>{' '}
                      <span className="font-semibold">{entry.days_in_status} дн.</span>
                    </div>
                    {entry.comment && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-700 italic">"{entry.comment}"</p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-gray-500 italic text-center py-4">История статусов пуста</div>
            )}
          </div>
        );
      default:
        return <div>Неизвестный тип tooltip</div>;
    }
  }, [stockData, getRatingColor, formatFullDate, getZoneColorsByType]);

  const getTooltipTitle = useCallback((tooltip) => {
    const article = tooltip.data.article;
    const articleBadge = article ? (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        {article}
      </span>
    ) : null;

    switch (tooltip.type) {
      case 'rating':
        return <div className="flex items-center gap-2"><span>История рейтинга</span>{articleBadge}</div>;
      case 'cpl':
        return <div className="flex items-center gap-2"><span>Статистика CPL</span>{articleBadge}</div>;
      case 'leads':
        return <div className="flex items-center gap-2"><span>Статистика лидов</span>{articleBadge}</div>;
      case 'stock':
        return <div className="flex items-center gap-2"><span>Модификации товара</span>{articleBadge}</div>;
      case 'date':
        return <div className="flex items-center gap-2"><span>Дата прихода</span>{articleBadge}</div>;
      case 'zone':
        return <div className="flex items-center gap-2"><span>Цена лида в зоне</span>{articleBadge}</div>;
      case 'status_history':
        return <div className="flex items-center gap-2"><span>История статусов</span>{articleBadge}</div>;
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
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6" />
              Мои офферы
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Всего: {filteredMetrics.length} офферов
            </p>
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
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Нет привязанных офферов
              </h3>
              <p className="text-gray-600 mb-4">
                Вам пока не назначены офферы для работы. Обратитесь к тимлиду.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4">
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
                    <button onClick={updateLeadsData} disabled={loadingLeadsData} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors" title="Обновить CPL и лиды из БД">
                      <RefreshCw className={`h-4 w-4 text-gray-700 ${loadingLeadsData ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="w-20 flex-shrink-0 flex items-center justify-center gap-1">
                    <span>Лиды 4дн</span>
                    <button onClick={updateLeadsData} disabled={loadingLeadsData} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors" title="Обновить CPL и лиды из БД">
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
                    <button onClick={updateLeadsData} disabled={loadingLeadsData} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors" title="Обновить CPL, Лиды и Рейтинг из БД">
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
                    <button onClick={calculateDays} disabled={loadingDays} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors" title="Рассчитать дни продаж">
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
                    <button onClick={updateStocksFromYml} disabled={loadingStocks} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors" title="Обновить остатки из YML">
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
                  <div key={index} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-2">
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
                      <div className="w-32 flex-shrink-0 text-xs flex items-center justify-center gap-1">
                        <OfferStatusBadge
                          offerId={metric.id}
                          article={metric.article}
                          offerName={metric.offer}
                          currentStatus={offerStatuses[metric.id]?.current_status}
                          daysInStatus={offerStatuses[metric.id]?.days_in_status}
                          onStatusChange={() => {}}
                          userName={user?.full_name || user?.email || 'User'}
                          readOnly={true}
                        />
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const buttonElement = e.currentTarget;
                            const rect = buttonElement.getBoundingClientRect();
                            const savedEvent = { currentTarget: buttonElement, clientX: rect.left + rect.width + 10, clientY: rect.top };
                            try {
                              const statusHistory = await offerStatusService.getOfferStatusHistory(metric.id);
                              openTooltip('status_history', index, { statusHistory, offerName: metric.offer, article: metric.article }, savedEvent);
                            } catch (error) {
                              console.error('Ошибка загрузки истории статусов:', error);
                            }
                          }}
                          className="text-gray-500 hover:text-blue-600 transition-colors"
                          title="Показать историю статусов"
                        >
                          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </button>
                      </div>

                      {/* CPL 4 дн. */}
                      <div className="w-20 flex-shrink-0 text-xs flex items-center justify-center gap-1 relative">
                        {loadingLeadsData ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        ) : (
                          <>
                            <span className={`font-mono ${metric.leads_data?.[4]?.cpl !== null && metric.leads_data?.[4]?.cpl !== undefined ? 'text-gray-900' : 'text-gray-600'}`}>
                              {metric.leads_data?.[4]?.cpl !== null && metric.leads_data?.[4]?.cpl !== undefined ? metric.leads_data[4].cpl.toFixed(2) : '—'}
                            </span>
                            {metric.leads_data && (
                              <svg className="text-gray-500 w-3 h-3 flex-shrink-0 cursor-pointer hover:text-gray-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                onClick={(e) => { e.stopPropagation(); openTooltip('cpl', index, { leadsData: metric.leads_data, offerName: metric.offer_name, article: metric.article }, e); }}>
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            )}
                          </>
                        )}
                      </div>

                      {/* Лиды 4 дн. */}
                      <div className="w-20 flex-shrink-0 text-xs flex items-center justify-center gap-1 relative">
                        {loadingLeadsData ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        ) : (
                          <>
                            <span className={`font-mono ${metric.leads_4days !== null && metric.leads_4days !== undefined ? 'text-gray-900' : 'text-gray-600'}`}>
                              {metric.leads_4days !== null && metric.leads_4days !== undefined ? metric.leads_4days : '—'}
                            </span>
                            {metric.leads_data && (
                              <svg className="text-gray-500 w-3 h-3 flex-shrink-0 cursor-pointer hover:text-gray-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                onClick={(e) => { e.stopPropagation(); openTooltip('leads', index, { leadsData: metric.leads_data, offerName: metric.offer_name, article: metric.article }, e); }}>
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            )}
                          </>
                        )}
                      </div>

                      {/* Продажи на 1 заявку */}
                      <div className="w-12 flex-shrink-0 text-xs text-gray-900 text-center">
                        {metric.k_lead !== null && metric.k_lead !== undefined ? Number(metric.k_lead).toFixed(2) : '—'}
                      </div>

                      {/* Рейтинг */}
                      <div className="w-12 flex-shrink-0 text-xs flex items-center justify-center gap-1 relative">
                        {loadingLeadsData ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        ) : (
                          <>
                            <span className={`font-semibold px-1.5 py-0.5 rounded ${
                              metric.lead_rating === 'A' ? 'bg-green-100 text-green-800' :
                              metric.lead_rating === 'B' ? 'bg-blue-100 text-blue-800' :
                              metric.lead_rating === 'C' ? 'bg-yellow-100 text-yellow-800' :
                              metric.lead_rating === 'D' ? 'bg-red-100 text-red-800' :
                              'text-gray-400'
                            }`} title={metric.rating_cpl ? `CPL: ${metric.rating_cpl.toFixed(2)}` : 'Нет данных'}>
                              {metric.lead_rating || 'N/A'}
                            </span>
                            {metric.rating_history && metric.rating_history.length > 0 && (
                              <svg className="text-gray-500 w-3 h-3 flex-shrink-0 cursor-pointer hover:text-gray-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                onClick={(e) => { e.stopPropagation(); openTooltip('rating', index, { ratingHistory: metric.rating_history, offerName: metric.offer_name, article: metric.article }, e); }}>
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            )}
                          </>
                        )}
                      </div>

                      {/* Реклама */}
                      <div className="w-12 flex-shrink-0 text-xs text-gray-600 flex items-center justify-center gap-1">
                        <span>—</span>
                        <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </div>

                      {/* Зона эффективности */}
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
                                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                              </>
                            );
                          }
                          return (
                            <>
                              <span className="font-mono text-xs text-gray-900">{metric.actual_roi_percent ? `${Number(metric.actual_roi_percent).toFixed(1)}%` : '—'}</span>
                              <svg className="text-gray-500 w-3 h-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            </>
                          );
                        })()}
                      </div>

                      {/* Цена лида в зоне */}
                      <div className="w-20 flex-shrink-0 flex items-center justify-center gap-1 relative">
                        {(() => {
                          const redZonePrice = metric.red_zone_price;
                          const zoneColors = getZoneColorsByType('red');
                          if (redZonePrice === null || redZonePrice === undefined) {
                            return (
                              <>
                                <span className="text-gray-500 italic text-xs">нет данных</span>
                                <svg className="text-gray-500 w-3 h-3 flex-shrink-0 cursor-pointer hover:text-gray-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                  onClick={(e) => { e.stopPropagation(); openTooltip('zone', index, { metric, offerName: metric.offer_name, article: metric.article }, e); }}>
                                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                              </>
                            );
                          }
                          return (
                            <>
                              <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${zoneColors.bg} ${zoneColors.text} ${zoneColors.border}`}>
                                ${Number(redZonePrice).toFixed(2)}
                              </span>
                              <svg className="text-gray-500 w-3 h-3 flex-shrink-0 cursor-pointer hover:text-gray-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                onClick={(e) => { e.stopPropagation(); openTooltip('zone', index, { metric, offerName: metric.offer_name, article: metric.article }, e); }}>
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            </>
                          );
                        })()}
                      </div>

                      {/* Дней продаж */}
                      <div className="w-16 flex-shrink-0 text-xs flex items-center justify-center gap-1">
                        {loadingDays ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        ) : (
                          <>
                            <span className={`font-mono ${
                              metric.days_remaining !== null && metric.days_remaining !== undefined
                                ? typeof metric.days_remaining === 'number' ? 'text-gray-900' : 'text-orange-600 text-xs italic'
                                : 'text-gray-600'
                            }`}>
                              {metric.days_remaining !== null && metric.days_remaining !== undefined
                                ? typeof metric.days_remaining === 'number' ? metric.days_remaining : metric.days_remaining
                                : '—'}
                            </span>
                            <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                          </>
                        )}
                      </div>

                      {/* Остаток */}
                      <div className="w-16 flex-shrink-0 text-xs flex items-center justify-center gap-1 relative">
                        {loadingStocks ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        ) : (
                          <>
                            <span className={`font-mono ${metric.stock_quantity !== null && metric.stock_quantity !== undefined ? 'text-gray-900' : 'text-gray-600'}`}>
                              {metric.stock_quantity !== null && metric.stock_quantity !== undefined ? metric.stock_quantity : '—'}
                            </span>
                            <svg className="text-gray-500 w-3 h-3 cursor-pointer hover:text-gray-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              onClick={(e) => { e.stopPropagation(); openTooltip('stock', index, { article: metric.article, offerName: metric.offer_name }, e); }}>
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                          </>
                        )}
                      </div>

                      {/* Дней до прихода */}
                      <div className="w-20 flex-shrink-0 font-mono text-xs flex items-center justify-center gap-1 relative">
                        {(() => {
                          const daysUntil = calculateDaysUntilArrival(metric.next_calculated_arrival);
                          if (daysUntil === null) {
                            return (
                              <>
                                <span className="text-gray-900">—</span>
                                <svg className="text-gray-500 w-3 h-3 cursor-pointer hover:text-gray-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                  onClick={(e) => { e.stopPropagation(); openTooltip('date', index, { date: metric.date_arrival, offerName: metric.offer_name, article: metric.article }, e); }}>
                                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                              </>
                            );
                          }
                          const textColor = daysUntil < 0 ? 'text-red-600' : 'text-green-600';
                          return (
                            <>
                              <span className={textColor}>{daysUntil}</span>
                              <svg className="text-gray-500 w-3 h-3 cursor-pointer hover:text-gray-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                onClick={(e) => { e.stopPropagation(); openTooltip('date', index, { date: metric.date_arrival, offerName: metric.offer_name, article: metric.article }, e); }}>
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            </>
                          );
                        })()}
                      </div>

                      {/* % отказа от продаж */}
                      <div className="w-16 flex-shrink-0 font-mono text-xs text-gray-900 flex items-center justify-center gap-1">
                        <span>{metric.refusal_sales_percent ? `${Number(metric.refusal_sales_percent).toFixed(1)}%` : '—'}</span>
                        <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </div>

                      {/* % невыкупа */}
                      <div className="w-16 flex-shrink-0 font-mono text-xs text-gray-900 flex items-center justify-center gap-1">
                        <span>{metric.no_pickup_percent ? `${Number(metric.no_pickup_percent).toFixed(1)}%` : '—'}</span>
                        <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </div>

                      {/* Сезон */}
                      <div className="w-16 flex-shrink-0 text-xs text-gray-600 flex items-center justify-center gap-1">
                        <span>—</span>
                        <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </div>

                      {/* Цена */}
                      <div className="w-20 flex-shrink-0 font-mono text-xs text-gray-900 flex items-center justify-center gap-1">
                        <span>{metric.offer_price ? `${Number(metric.offer_price).toFixed(0)}₴` : '—'}</span>
                        <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </div>
                    </div>
                    {/* Без панели привязки байеров для роли buyer */}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tooltips */}
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

export default OffersBuyer;
