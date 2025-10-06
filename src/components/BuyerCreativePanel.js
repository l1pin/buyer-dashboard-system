import React, { useState, useEffect } from 'react';
import { creativeService, creativeHistoryService } from '../supabaseClient';
import { useBatchMetrics } from '../hooks/useMetrics';
import { useZoneData } from '../hooks/useZoneData';
import {
  Video,
  RefreshCw,
  AlertCircle,
  MessageCircle,
  ExternalLink,
  X,
  User,
  Search,
  Eye,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Calendar
} from 'lucide-react';

function BuyerCreativePanel({ user }) {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creativesWithHistory, setCreativesWithHistory] = useState(new Set());
  const [expandedWorkTypes, setExpandedWorkTypes] = useState(new Set());
  const [metricsPeriod, setMetricsPeriod] = useState('all');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const workTypeValues = {
    'Монтаж _Video': 1,
    'Монтаж > 21s': 0.4,
    'Upscale_Video': 0.2,
    'Ресайз 1': 0.4,
    'Озвучка': 0.2,
    'Субтитры': 0.2,
    'Ресайз 2': 0.4,
    'Написання_Sub': 0.2,
    'Video_Avarat': 0.4,
    'Правки_video': 0.2,
    'Превьюшка': 0.2,
    'Статика 1': 1,
    'Статика 2': 1,
    'Статика 3': 1,
    'Статика 4': 1,
    'Ресайз St 1': 0.2,
    'Ресайз St 2': 0.2,
    'Ресайз St 3': 0.2,
    'Ресайз St 4': 0.2,
    'Правки Статика': 0.2,
    'Доп. 0,2': 0.2,
    'Доп. 0,4': 0.4,
    'Доп. 0,6': 0.6,
    'Доп. 0,8': 0.8,
    'Доп. 1': 1,
    'Доп. 2': 2
  };

  const { 
    batchMetrics, 
    loading: metricsLoading,
    refresh: refreshMetrics,
    getCreativeMetrics
  } = useBatchMetrics(creatives, true, metricsPeriod);

  const {
    getZoneDataForArticle,
    refresh: refreshZoneData
  } = useZoneData(creatives, true);

  useEffect(() => {
    loadCreatives();
  }, [user.id]);

  const loadCreatives = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('📡 Загрузка креативов для байера:', user.id);

      const allCreatives = await creativeService.getAllCreatives();
      
      // Фильтруем только креативы этого байера
      const buyerCreatives = allCreatives.filter(c => c.buyer_id === user.id);

      console.log(`✅ Найдено ${buyerCreatives.length} креативов для байера`);

      // Проверяем историю для каждого креатива
      const creativesWithHistorySet = new Set();
      for (const creative of buyerCreatives) {
        const hasHistory = await creativeHistoryService.hasHistory(creative.id);
        if (hasHistory) {
          creativesWithHistorySet.add(creative.id);
        }
      }
      setCreativesWithHistory(creativesWithHistorySet);

      setCreatives(buyerCreatives);
    } catch (error) {
      console.error('❌ Ошибка загрузки креативов:', error);
      setError('Ошибка загрузки креативов: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateCOF = (workTypes) => {
    if (!workTypes || !Array.isArray(workTypes)) return 0;
    return workTypes.reduce((total, workType) => {
      const value = workTypeValues[workType] || 0;
      return total + value;
    }, 0);
  };

  const formatCOF = (cof) => {
    return cof % 1 === 0 ? cof.toString() : cof.toFixed(1);
  };

  const getCOFBadgeColor = () => {
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const formatKyivTime = (dateString) => {
    try {
      const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
      if (!match) throw new Error('Invalid date format');
      
      const [_, year, month, day, hours, minutes] = match;
      const dateStr = `${day}.${month}.${year}`;
      const timeStr = `${hours}:${minutes}`;
      
      return { date: dateStr, time: timeStr };
    } catch (error) {
      console.error('Error formatting date:', error);
      return { date: '00.00.0000', time: '00:00' };
    }
  };

  const showComment = (creative) => {
    setSelectedComment({
      article: creative.article,
      comment: creative.comment,
      createdAt: creative.created_at,
      editorName: creative.editor_name
    });
    setShowCommentModal(true);
  };

  const showHistory = async (creative) => {
    setLoadingHistory(true);
    setShowHistoryModal(true);
    setSelectedHistory(creative);
    
    try {
      const history = await creativeHistoryService.getCreativeHistory(creative.id);
      setHistoryData(history);
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
      setError('Ошибка загрузки истории: ' + error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleWorkTypes = (creativeId) => {
    const newExpanded = new Set(expandedWorkTypes);
    if (newExpanded.has(creativeId)) {
      newExpanded.delete(creativeId);
    } else {
      newExpanded.add(creativeId);
    }
    setExpandedWorkTypes(newExpanded);
  };

  const getAggregatedCreativeMetrics = (creative) => {
    const creativeMetrics = getCreativeMetrics(creative.id);
    
    if (!creativeMetrics || creativeMetrics.length === 0) {
      return null;
    }

    const validMetrics = creativeMetrics.filter(metric => metric.found && metric.data);
    
    if (validMetrics.length === 0) {
      return null;
    }

    const aggregated = validMetrics.reduce((acc, metric) => {
      const data = metric.data.raw;
      return {
        leads: acc.leads + (data.leads || 0),
        cost: acc.cost + (data.cost || 0),
        clicks: acc.clicks + (data.clicks || 0),
        impressions: acc.impressions + (data.impressions || 0),
        avg_duration: acc.avg_duration + (data.avg_duration || 0),
        days_count: Math.max(acc.days_count, data.days_count || 0)
      };
    }, {
      leads: 0,
      cost: 0,
      clicks: 0,
      impressions: 0,
      avg_duration: 0,
      days_count: 0
    });

    const avgDuration = validMetrics.length > 0 ? aggregated.avg_duration / validMetrics.length : 0;
    const cpl = aggregated.leads > 0 ? aggregated.cost / aggregated.leads : 0;
    const ctr = aggregated.impressions > 0 ? (aggregated.clicks / aggregated.impressions) * 100 : 0;
    const cpc = aggregated.clicks > 0 ? aggregated.cost / aggregated.clicks : 0;
    const cpm = aggregated.impressions > 0 ? (aggregated.cost / aggregated.impressions) * 1000 : 0;

    return {
      found: true,
      videoCount: validMetrics.length,
      data: {
        raw: {
          ...aggregated,
          avg_duration: Number(avgDuration.toFixed(2)),
          cpl: Number(cpl.toFixed(2)),
          ctr_percent: Number(ctr.toFixed(2)),
          cpc: Number(cpc.toFixed(2)),
          cpm: Number(cpm.toFixed(2))
        },
        formatted: {
          leads: String(Math.round(aggregated.leads)),
          cpl: aggregated.leads > 0 ? `${cpl.toFixed(2)}$` : '0.00$',
          cost: `${aggregated.cost.toFixed(2)}$`,
          ctr: `${ctr.toFixed(2)}%`,
          cpc: `${cpc.toFixed(2)}$`,
          cpm: `${cpm.toFixed(2)}$`,
          clicks: String(Math.round(aggregated.clicks)),
          impressions: String(Math.round(aggregated.impressions)),
          avg_duration: `${avgDuration.toFixed(1)}с`,
          days: String(aggregated.days_count)
        }
      }
    };
  };

  const ZoneDataDisplay = ({ article }) => {
    const zoneData = getZoneDataForArticle(article);
    
    if (!zoneData) {
      return (
        <div className="text-center">
          <span className="text-gray-400 text-xs">—</span>
        </div>
      );
    }

    const zones = [];
    if (zoneData.red !== '—') zones.push({ color: 'red', value: zoneData.red, bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' });
    if (zoneData.pink !== '—') zones.push({ color: 'pink', value: zoneData.pink, bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' });
    if (zoneData.gold !== '—') zones.push({ color: 'gold', value: zoneData.gold, bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' });
    if (zoneData.green !== '—') zones.push({ color: 'green', value: zoneData.green, bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' });

    if (zones.length === 0) {
      return (
        <div className="text-center">
          <span className="text-gray-400 text-xs">—</span>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-1 w-24 mx-auto">
        {zones.map((zone) => (
          <span 
            key={zone.color}
            className={`font-mono font-bold flex items-center justify-center w-11 h-6 rounded-full text-xs border ${zone.bg} ${zone.text} ${zone.border} text-center`}
            style={{ fontSize: '10px' }}
          >
            {zone.value}
          </span>
        ))}
      </div>
    );
  };

  const getCurrentZoneByMetrics = (article, cplValue) => {
    const zoneData = getZoneDataForArticle(article);
    
    if (!zoneData || !cplValue || cplValue <= 0 || isNaN(cplValue)) {
      return null;
    }

    const zones = [];
    
    if (zoneData.red !== '—') {
      const price = parseFloat(zoneData.red.replace('$', ''));
      if (!isNaN(price)) zones.push({ zone: 'red', price, name: 'Красная' });
    }
    
    if (zoneData.pink !== '—') {
      const price = parseFloat(zoneData.pink.replace('$', ''));
      if (!isNaN(price)) zones.push({ zone: 'pink', price, name: 'Розовая' });
    }
    
    if (zoneData.gold !== '—') {
      const price = parseFloat(zoneData.gold.replace('$', ''));
      if (!isNaN(price)) zones.push({ zone: 'gold', price, name: 'Золотая' });
    }
    
    if (zoneData.green !== '—') {
      const price = parseFloat(zoneData.green.replace('$', ''));
      if (!isNaN(price)) zones.push({ zone: 'green', price, name: 'Зеленая' });
    }

    if (zones.length === 0) return null;

    zones.sort((a, b) => a.price - b.price);

    for (let i = 0; i < zones.length; i++) {
      const currentZone = zones[i];
      
      if (i === 0) {
        if (cplValue < currentZone.price) {
          return {
            zone: currentZone.zone,
            name: currentZone.name,
            price: currentZone.price
          };
        }
      } else {
        const prevZone = zones[i - 1];
        if (cplValue >= prevZone.price && cplValue < currentZone.price) {
          return {
            zone: currentZone.zone,
            name: currentZone.name,
            price: currentZone.price
          };
        }
      }
    }

    const mostExpensive = zones[zones.length - 1];
    return {
      zone: mostExpensive.zone,
      name: mostExpensive.name,
      price: mostExpensive.price
    };
  };

  const CurrentZoneDisplay = ({ article, metricsData }) => {
    if (!metricsData?.found || !metricsData.data) {
      return (
        <div className="text-center">
          <span className="text-gray-400 text-xs">—</span>
        </div>
      );
    }

    const cplString = metricsData.data.formatted.cpl;
    const cplValue = parseFloat(cplString.replace('$', ''));

    if (isNaN(cplValue)) {
      return (
        <div className="text-center">
          <span className="text-gray-400 text-xs">—</span>
        </div>
      );
    }

    const currentZone = getCurrentZoneByMetrics(article, cplValue);

    if (!currentZone) {
      return (
        <div className="text-center">
          <span className="text-gray-400 text-xs">—</span>
        </div>
      );
    }

    const getZoneColors = (zone) => {
      switch (zone) {
        case 'red':
          return { bg: 'bg-red-500', text: 'text-white', border: 'border-red-500' };
        case 'pink':
          return { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-500' };
        case 'gold':
          return { bg: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-500' };
        case 'green':
          return { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' };
        default:
          return { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-500' };
      }
    };

    const colors = getZoneColors(currentZone.zone);

    return (
      <div className="text-center">
        <span 
          className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold border ${colors.bg} ${colors.text} ${colors.border}`}
          title={`CPL: $${cplValue.toFixed(2)} ≤ $${currentZone.price.toFixed(2)}`}
        >
          {currentZone.name}
        </span>
      </div>
    );
  };

  const UkraineFlag = () => (
    <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-300 flex-shrink-0">
      <div className="w-full h-3 bg-blue-500"></div>
      <div className="w-full h-3 bg-yellow-400"></div>
    </div>
  );

  const PolandFlag = () => (
    <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-300 flex-shrink-0">
      <div className="w-full h-3 bg-white"></div>
      <div className="w-full h-3 bg-red-500"></div>
    </div>
  );

  const handleRefreshAll = async () => {
    await loadCreatives();
    await refreshMetrics();
    await refreshZoneData();
  };

  const handlePeriodChange = (period) => {
    setMetricsPeriod(period);
    setShowPeriodDropdown(false);
  };

  const getPeriodButtonText = () => {
    return metricsPeriod === 'all' ? 'За все время' : 'Первые 4 дня';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка креативов...</p>
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
              Мои креативы
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Креативы, в которых вы указаны как Media Buyer
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="period-trigger inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Метрики: {getPeriodButtonText()}
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showPeriodDropdown && (
                <div className="period-dropdown absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <div className="py-1">
                    <button
                      onClick={() => handlePeriodChange('all')}
                      className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                        metricsPeriod === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Все время
                    </button>
                    <button
                      onClick={() => handlePeriodChange('4days')}
                      className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                        metricsPeriod === '4days' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      4 дня
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleRefreshAll}
              disabled={loading || metricsLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(loading || metricsLoading) ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {creatives.length === 0 ? (
          <div className="text-center py-12">
            <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Креативов пока нет
            </h3>
            <p className="text-gray-600">
              Креативы будут отображаться здесь, когда монтажеры укажут вас как Media Buyer
            </p>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 text-center">
                Список креативов ({creatives.length})
              </h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                    <tr>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Дата
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Артикул
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Монтажер
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Видео
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Зона
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Лиды
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        CPL
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Расходы
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        CTR
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Зоны
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        COF
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Trello
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {creatives
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                      .map((creative) => {
                        const cof = typeof creative.cof_rating === 'number' 
                          ? creative.cof_rating 
                          : calculateCOF(creative.work_types || []);
                        
                        const aggregatedMetrics = getAggregatedCreativeMetrics(creative);
                        const isWorkTypesExpanded = expandedWorkTypes.has(creative.id);
                        const formattedDateTime = formatKyivTime(creative.created_at);
                        
                        return (
                          <tr 
                            key={creative.id}
                            className="transition-colors duration-200 hover:bg-gray-50"
                          >
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              <div className="cursor-text select-text">
                                <div className="font-medium">{formattedDateTime.date}</div>
                                <div className="text-xs text-gray-500">{formattedDateTime.time}</div>
                              </div>
                            </td>
                            
                            <td className="px-3 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                  {creative.comment && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        showComment(creative);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
                                      title="Показать комментарий"
                                    >
                                      <MessageCircle className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                                
                                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                  {creativesWithHistory.has(creative.id) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        showHistory(creative);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
                                      title="Показать историю изменений"
                                    >
                                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                        <path stroke="none" d="M0 0h24v24H0z"/>
                                        <polyline points="12 8 12 12 14 14" />
                                        <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                                
                                {creative.is_poland ? <PolandFlag /> : <UkraineFlag />}
                                
                                <div className="text-sm font-medium text-gray-900 cursor-text select-text">
                                  {creative.article}
                                </div>
                              </div>
                            </td>
                            
                            <td className="px-3 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  <User className="h-3 w-3 text-gray-400" />
                                </div>
                                <span className="text-sm text-gray-900 cursor-text select-text">
                                  {creative.editor_name || 'Неизвестен'}
                                </span>
                              </div>
                            </td>
                            
                            <td className="px-3 py-4 text-sm text-gray-900">
                              <div className="space-y-1">
                                {creative.link_titles && creative.link_titles.length > 0 ? (
                                  creative.link_titles.map((title, index) => (
                                    <div key={index} className="flex items-center min-h-[24px]">
                                      <span 
                                        className="block text-left flex-1 mr-2 cursor-text select-text truncate whitespace-nowrap overflow-hidden"
                                        title={title}
                                      >
                                        {title}
                                      </span>
                                      <a
                                        href={creative.links[index]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                                        title="Открыть в Google Drive"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center">
                                    <span className="text-gray-400 cursor-text select-text">Нет видео</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-3 py-4 text-sm text-gray-900 text-center">
                              <CurrentZoneDisplay 
                                article={creative.article} 
                                metricsData={aggregatedMetrics}
                              />
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : aggregatedMetrics?.found ? (
                                <span className="font-bold text-sm cursor-text select-text text-black">
                                  {aggregatedMetrics.data.formatted.leads}
                                </span>
                              ) : (
                                <span className="text-gray-400 cursor-text select-text">—</span>
                              )}
                            </td>
                            
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : aggregatedMetrics?.found ? (
                                <span className="font-bold text-sm cursor-text select-text text-black">
                                  {aggregatedMetrics.data.formatted.cpl}
                                </span>
                              ) : (
                                <span className="text-gray-400 cursor-text select-text">—</span>
                              )}
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : aggregatedMetrics?.found ? (
                                <span className="font-bold text-sm cursor-text select-text text-black">
                                  {aggregatedMetrics.data.formatted.cost}
                                </span>
                              ) : (
                                <span className="text-gray-400 cursor-text select-text">—</span>
                              )}
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : aggregatedMetrics?.found ? (
                                <span className="font-bold text-sm cursor-text select-text text-black">
                                  {aggregatedMetrics.data.formatted.ctr}
                                </span>
                              ) : (
                                <span className="text-gray-400 cursor-text select-text">—</span>
                              )}
                            </td>

                            <td className="px-3 py-4 text-sm text-gray-900 text-center">
                              <ZoneDataDisplay article={creative.article} />
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-center">
                              {creative.work_types && creative.work_types.length > 0 ? (
                                <div className="space-y-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getCOFBadgeColor(cof)} cursor-text select-text`}>
                                    <span className="text-xs font-bold mr-1">COF</span>
                                    {formatCOF(cof)}
                                  </span>
                                  
                                  <div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleWorkTypes(creative.id);
                                      }}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200 transition-colors duration-200"
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      <span>
                                        {isWorkTypesExpanded 
                                          ? `Скрыть работы` 
                                          : `Работы (${creative.work_types.length})`
                                        }
                                      </span>
                                      {isWorkTypesExpanded ? (
                                        <ChevronUp className="h-3 w-3 ml-1" />
                                      ) : (
                                        <ChevronDown className="h-3 w-3 ml-1" />
                                      )}
                                    </button>
                                  </div>
                                  
                                  {isWorkTypesExpanded && (
                                    <div className="mt-2 space-y-1 max-w-xs">
                                      {creative.work_types.map((workType, index) => (
                                        <div key={index} className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded flex items-center justify-between">
                                          <span className="truncate cursor-text select-text">{workType}</span>
                                          <span className="text-gray-500 ml-1 flex-shrink-0 cursor-text select-text">
                                            {formatCOF(workTypeValues[workType] || 0)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 cursor-text select-text">—</span>
                              )}
                            </td>
                            
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {creative.trello_link ? (
                                <a 
                                  href={creative.trello_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-3 py-1 border border-blue-300 text-xs font-medium rounded-md shadow-sm text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Карточка
                                </a>
                              ) : (
                                <span className="text-gray-400 cursor-text select-text">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comment Modal */}
      {showCommentModal && selectedComment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <MessageCircle className="h-5 w-5 mr-2 text-blue-600" />
                Комментарий
              </h3>
              <button
                onClick={() => setShowCommentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Артикул:</label>
                <p className="text-gray-900 font-medium">{selectedComment.article}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Автор:</label>
                <p className="text-gray-900">{selectedComment.editorName}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Дата создания:</label>
                <p className="text-gray-600 text-sm">{formatKyivTime(selectedComment.createdAt).date} {formatKyivTime(selectedComment.createdAt).time}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Комментарий:</label>
                <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedComment.comment}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowCommentModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedHistory && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-5 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white my-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <svg className="h-5 w-5 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z"/>
                  <polyline points="12 8 12 12 14 14" />
                  <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
                </svg>
                История изменений: {selectedHistory.article}
              </h3>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedHistory(null);
                  setHistoryData([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Загрузка истории...</p>
                </div>
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">История изменений пуста</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {historyData.map((entry, index) => {
                  const formattedDateTime = formatKyivTime(entry.changed_at);
                  const isFirst = index === historyData.length - 1;
                  
                  return (
                    <div key={entry.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            entry.change_type === 'created' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {entry.change_type === 'created' ? 'Создано' : 'Изменено'}
                          </span>
                          {isFirst && (
                            <span className="text-xs text-gray-500">(Исходная версия)</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          <div className="font-medium">{formattedDateTime.date} {formattedDateTime.time}</div>
                          <div className="text-xs">Автор: {entry.changed_by_name || 'Неизвестно'}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-700">Видео:</label>
                          <div className="mt-1 space-y-1">
                            {entry.link_titles && entry.link_titles.length > 0 ? (
                              entry.link_titles.map((title, idx) => (
                                <div key={idx} className="text-sm text-gray-900 truncate" title={title}>
                                  {title}
                                </div>
                              ))
                            ) : (
                              <span className="text-sm text-gray-500">—</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700">Страна:</label>
                          <div className="mt-1 flex items-center space-x-2">
                            {entry.is_poland ? <PolandFlag /> : <UkraineFlag />}
                            <span className="text-sm text-gray-900">{entry.is_poland ? 'Poland' : 'Ukraine'}</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700">COF:</label>
                          <div className="mt-1">
                            <span className="text-sm text-gray-900">{formatCOF(entry.cof_rating || 0)}</span>
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-gray-700">Типы работ:</label>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {entry.work_types && entry.work_types.length > 0 ? (
                              entry.work_types.map((type, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                                  {type}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-500">—</span>
                            )}
                          </div>
                        </div>

                        {entry.comment && (
                          <div className="md:col-span-2">
                            <label className="text-xs font-medium text-gray-700">Комментарий:</label>
                            <div className="mt-1 p-2 bg-white border border-gray-200 rounded">
                              <p className="text-sm text-gray-900 whitespace-pre-wrap">{entry.comment}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedHistory(null);
                  setHistoryData([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BuyerCreativePanel;
