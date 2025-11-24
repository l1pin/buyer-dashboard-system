// src/components/OffersTL.js
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { metricsAnalyticsService, userService } from '../supabaseClient';
import { offerStatusService, offerBuyersService } from '../services/OffersSupabase';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Package,
  Star,
  Tv
} from 'lucide-react';
import { updateStocksFromYml as updateStocksFromYmlScript } from '../scripts/offers/Offers_stock';
import { calculateRemainingDays as calculateRemainingDaysScript } from '../scripts/offers/Calculate_days';
import { updateLeadsFromSql as updateLeadsFromSqlScript } from '../scripts/offers/Sql_leads';
import TooltipManager from './TooltipManager';
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
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [loadingLeadsData, setLoadingLeadsData] = useState(false);
  const [stockData, setStockData] = useState({});
  const [allBuyers, setAllBuyers] = useState([]);
  const [offerStatuses, setOfferStatuses] = useState({});
  const [allAssignments, setAllAssignments] = useState({});
  const [buyerMetricsData, setBuyerMetricsData] = useState({});

  // Ref для изолированного менеджера tooltip'ов
  const tooltipManagerRef = useRef(null);

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

  // Функция для открытия tooltip через изолированный менеджер (без setState в OffersTL!)
  const openTooltip = useCallback((type, index, data, event) => {
    if (!tooltipManagerRef.current) return;

    const tooltipId = `${type}-${index}`;
    let position = { x: 100, y: 100 };
    if (event && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      position = { x: rect.left + rect.width + 10, y: rect.top };
    }

    // Генерируем title и content синхронно
    const title = getTooltipTitleSync(type, data.article);
    const content = renderTooltipContentSync(type, data);

    tooltipManagerRef.current.open(tooltipId, title, content, position);
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

      // Сохраняем данные по source_id для метрик байеров
      if (result.dataBySourceIdAndDate) {
        setBuyerMetricsData(result.dataBySourceIdAndDate);
        console.log(`📊 Сохранены метрики по ${Object.keys(result.dataBySourceIdAndDate).length} source_id`);
      }

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

  // Синхронная функция для генерации заголовка tooltip
  const getTooltipTitleSync = (type, article) => {
    const articleBadge = article ? (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        {article}
      </span>
    ) : null;
    const titles = {
      rating: 'История рейтинга',
      cpl: 'Статистика CPL',
      leads: 'Статистика лидов',
      stock: 'Модификации товара',
      date: 'Дата прихода',
      zone: 'Цена лида в зоне',
      status_history: 'История статусов',
      season: 'Сезон и категория'
    };
    return <div className="flex items-center gap-2"><span>{titles[type] || 'Информация'}</span>{articleBadge}</div>;
  };

  // Синхронная функция для генерации контента tooltip
  const renderTooltipContentSync = (type, data) => {
    const getRatingColorLocal = (rating) => {
      switch (rating) {
        case 'A': return 'bg-green-100 text-green-800';
        case 'B': return 'bg-blue-100 text-blue-800';
        case 'C': return 'bg-yellow-100 text-yellow-800';
        case 'D': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-400';
      }
    };
    const getZoneColorsLocal = (zoneType) => {
      switch (zoneType) {
        case 'red': return { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' };
        case 'pink': return { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' };
        case 'gold': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
        case 'green': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
        default: return null;
      }
    };
    const formatDateLocal = (dateString) => {
      if (!dateString) return '—';
      try { return new Date(dateString).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
      catch { return '—'; }
    };

    switch (type) {
      case 'rating':
        return (
          <div className="flex flex-col gap-2">
            {data.ratingHistory?.length > 0 ? data.ratingHistory.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-xs border-b border-gray-100 pb-2 last:border-b-0">
                <span className="text-gray-600 w-20">{item.month} {item.year}</span>
                <span className={`font-semibold px-2 py-1 rounded ${getRatingColorLocal(item.rating)}`}>{item.rating}</span>
                <span className="text-gray-700 font-mono">CPL: {item.cpl > 0 ? item.cpl.toFixed(2) : '—'}</span>
                <span className="text-gray-700">Лиды: {item.leads}</span>
              </div>
            )) : <div className="text-xs text-gray-500 italic">Нет данных</div>}
          </div>
        );
      case 'cpl':
      case 'leads':
        return (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left py-1 px-2">Период</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'CPL' : 'Лидов'}</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'Расход' : 'CPL'}</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'Лидов' : 'Расход'}</th>
            </tr></thead>
            <tbody>
              {[7, 14, 30, 60, 90].map(days => {
                const d = data.leadsData?.[days];
                if (!d) return null;
                return <tr key={days} className="border-b border-gray-100">
                  <td className="py-1 px-2">{d.label}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? d.cpl.toFixed(2) : d.leads}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? d.cost.toFixed(2) : d.cpl.toFixed(2)}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? d.leads : d.cost.toFixed(2)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        );
      case 'stock':
        const baseArticle = data.article?.split("-")[0];
        const mods = baseArticle && stockData[baseArticle]?.modificationsDisplay || [];
        return <div className="flex flex-col gap-1.5">
          {mods.length > 0 ? mods.map((m, i) => <div key={i} className="text-xs text-gray-700">{m}</div>) : <div className="text-xs text-gray-500 italic">Нет данных</div>}
        </div>;
      case 'date':
        return <div className="text-sm text-gray-900 font-mono">{data.date ? formatDateLocal(data.date) : 'Нет данных'}</div>;
      case 'zone':
        const m = data.metric;
        return <div className="flex flex-col gap-2">
          {['red', 'pink', 'gold', 'green'].map(z => {
            const price = m[`${z}_zone_price`];
            if (price == null) return null;
            const c = getZoneColorsLocal(z);
            return <div key={z} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-20 capitalize">{z === 'red' ? 'Красная' : z === 'pink' ? 'Розовая' : z === 'gold' ? 'Золотая' : 'Зеленая'}:</span>
              <span className={`font-mono px-2 py-1 rounded-full text-xs border ${c.bg} ${c.text} ${c.border}`}>${Number(price).toFixed(2)}</span>
            </div>;
          })}
        </div>;
      case 'status_history':
        return <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {(data.statusHistory || []).map((entry, i) => {
            const cfg = offerStatusService.getStatusColor(entry.status);
            return <div key={i} className={`p-3 rounded-lg border-2 ${i === 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-3 h-3 rounded-full ${cfg.color}`}></span>
                <span className="text-sm font-semibold">{entry.status}</span>
                {i === 0 && <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Текущий</span>}
              </div>
              <div className="text-xs text-gray-600">С: {formatDateLocal(entry.from_date)} → До: {formatDateLocal(entry.to_date)}</div>
              <div className="text-xs">Длительность: <b>{entry.days_in_status} дн.</b></div>
            </div>;
          })}
        </div>;
      case 'season':
        return <div className="flex flex-col gap-3">
          <div><div className="text-xs font-medium text-gray-600 mb-1">Категория:</div><div className="text-sm">{data.category || '—'}</div></div>
          {data.categoryDetails?.length > 0 && <div><div className="text-xs font-medium text-gray-600 mb-1">Категории товаров:</div>
            {data.categoryDetails.map((d, i) => <div key={i} className="text-xs text-gray-700">{d}</div>)}
          </div>}
          <div><div className="text-xs font-medium text-gray-600 mb-1">Спецсезон:</div>
            {data.specialSeasonStart || data.specialSeasonEnd ? <div className="text-sm font-mono">{data.specialSeasonStart || '—'} — {data.specialSeasonEnd || '—'}</div> : <div className="text-sm text-gray-500 italic">Не задан</div>}
          </div>
        </div>;
      default:
        return <div>Неизвестный тип</div>;
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

  // Мемоизированный список офферов (вынесен на верхний уровень для соблюдения правил хуков)
  const renderedOffersList = useMemo(() => (
    <div className="px-4 py-2 space-y-1">
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
          buyerMetricsData={buyerMetricsData}
        />
      ))}
    </div>
  ), [filteredMetrics, offerStatuses, loadingLeadsData, loadingDays, loadingStocks, openTooltip, handleStatusChange, user, allBuyers, allAssignments, handleAssignmentsChange, buyerMetricsData]);

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
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Офферы
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadAllData}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 transition-all duration-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center shadow-sm">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm flex items-center shadow-sm">
          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}


      {/* Filters */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по артикулу или названию оффера..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 hover:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-500 font-medium">Сортировка:</span>
            <button
              onClick={() => handleSort('id')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${sortField === 'id' ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              По №
              {sortField === 'id' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3 ml-1" /> : <ChevronDown className="inline h-3 w-3 ml-1" />)}
            </button>
            <button
              onClick={() => handleSort('article')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${sortField === 'article' ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              По артикулу
              {sortField === 'article' && (sortDirection === 'asc' ? <ChevronUp className="inline h-3 w-3 ml-1" /> : <ChevronDown className="inline h-3 w-3 ml-1" />)}
            </button>
          </div>
        </div>
      </div>

      {/* Cards with Sticky Header Row */}
      <div className="flex-1 overflow-auto">
        {metrics.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="h-16 w-16 text-slate-300 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Нет данных офферов
              </h3>
              <p className="text-slate-500 mb-4">
                Данные офферов будут загружены из метрик аналитика
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Sticky Header Row */}
            <div className="sticky top-0 z-10 bg-slate-100 border-b border-slate-300 px-4 py-2.5">
              <div className="flex items-center text-xs font-semibold text-slate-600 text-center">
                <div className="w-[3%] min-w-[32px]">№</div>
                <div className="w-[6%] min-w-[60px]">Артикул</div>
                <div className="w-[14%] min-w-[120px] text-left">Название</div>
                <div className="w-[8%] min-w-[80px]">Статус</div>
                <div className="w-[5%] min-w-[50px] flex items-center justify-center gap-1">
                  <span>CPL</span>
                  <button
                    onClick={updateLeadsData}
                    disabled={loadingLeadsData}
                    className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-50"
                    title="Обновить CPL и лиды из БД"
                  >
                    <RefreshCw className={`h-3 w-3 text-slate-500 ${loadingLeadsData ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="w-[4%] min-w-[40px]">Лиды</div>
                <div className="w-[4%] min-w-[36px]" title="Продажи на 1 заявку">
                  <Package className="h-3.5 w-3.5 mx-auto text-slate-500" />
                </div>
                <div className="w-[5%] min-w-[44px] flex items-center justify-center gap-1" title="Рейтинг">
                  <Star className="h-3.5 w-3.5 text-slate-500" />
                  <button
                    onClick={updateLeadsData}
                    disabled={loadingLeadsData}
                    className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-50"
                    title="Обновить рейтинг"
                  >
                    <RefreshCw className={`h-3 w-3 text-slate-500 ${loadingLeadsData ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="w-[4%] min-w-[36px]" title="Реклама">
                  <Tv className="h-3.5 w-3.5 mx-auto text-slate-500" />
                </div>
                <div className="w-[5%] min-w-[44px]" title="Зона эффективности">Зона</div>
                <div className="w-[6%] min-w-[56px]" title="Цена лида в зоне">CPL зона</div>
                <div className="w-[5%] min-w-[48px] flex items-center justify-center gap-1" title="Дней продаж">
                  Дни
                  <button
                    onClick={calculateDays}
                    disabled={loadingDays}
                    className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-50"
                    title="Рассчитать дни продаж"
                  >
                    <RefreshCw className={`h-3 w-3 text-slate-500 ${loadingDays ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="w-[5%] min-w-[48px] flex items-center justify-center gap-1" title="Остаток">
                  Ост.
                  <button
                    onClick={updateStocksFromYml}
                    disabled={loadingStocks}
                    className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-50"
                    title="Обновить остатки из YML"
                  >
                    <RefreshCw className={`h-3 w-3 text-slate-500 ${loadingStocks ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="w-[5%] min-w-[44px]" title="Дней до прихода">Приход</div>
                <div className="w-[5%] min-w-[44px]" title="% отказа">Отказ</div>
                <div className="w-[5%] min-w-[44px]" title="% невыкупа">Невык.</div>
                <div className="w-[5%] min-w-[44px]">Сезон</div>
                <div className="w-[6%] min-w-[50px]" title="Цена">Цена</div>
              </div>
            </div>

            {/* Cards - мемоизированный список */}
            {renderedOffersList}
          </>
        )}
      </div>

      {/* Изолированный менеджер tooltip'ов - не вызывает ре-рендер OffersTL */}
      <TooltipManager ref={tooltipManagerRef} />
    </div>
  );
}

export default OffersTL;
