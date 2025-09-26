// ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ CreativeAnalytics.js с интерфейсом как в CreativePanel
// Замените полностью содержимое src/components/CreativeAnalytics.js

import React, { useState, useEffect } from 'react';
import { creativeService, userService } from '../supabaseClient';
import { useBatchMetrics, useMetricsStats, useMetricsApi } from '../hooks/useMetrics';
import { useZoneData } from '../hooks/useZoneData';
import { MetricsService } from '../services/metricsService';
import { 
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  Video,
  Image as ImageIcon,
  RefreshCw,
  Eye,
  Filter,
  Download,
  User,
  Clock,
  Target,
  Activity,
  AlertCircle,
  DollarSign,
  MousePointer,
  Zap,
  CheckCircle,
  XCircle,
  Globe,
  MessageCircle,
  FileText,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Star,
  Layers,
  Trophy,
  Award
} from 'lucide-react';

function CreativeAnalytics({ user }) {
  console.log('✅ CreativeAnalytics компонент загружен с полным функционалом');
  
  const [analytics, setAnalytics] = useState({
    creatives: [],
    editors: [],
    stats: {
      totalCreatives: 0,
      totalEditors: 0,
      todayCreatives: 0,
      weekCreatives: 0,
      totalCOF: 0,
      avgCOF: 0,
      todayCOF: 0,
      weekCOF: 0,
      creativesWithComments: 0
    },
    workTypeStats: {},
    editorStats: {}
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedEditor, setSelectedEditor] = useState('all');
  const [metricsPeriod, setMetricsPeriod] = useState('all');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [expandedWorkTypes, setExpandedWorkTypes] = useState(new Set());
  
  // НОВЫЕ состояния для переключения метрик в той же строке
  const [detailMode, setDetailMode] = useState(new Map()); // 'aggregated' (по умолчанию) или 'individual'
  const [currentVideoIndex, setCurrentVideoIndex] = useState(new Map()); // индекс текущего видео для каждого креатива

  // Хуки для метрик - с поддержкой периодов
  const { 
    batchMetrics, 
    loading: metricsLoading, 
    error: metricsError,
    stats: metricsStats,
    getCreativeMetrics,
    refresh: refreshMetrics 
  } = useBatchMetrics(analytics.creatives, true, metricsPeriod);
  
  const { 
    stats: aggregatedMetricsStats,
    formatStats,
    hasData: hasMetricsData 
  } = useMetricsStats(analytics.creatives, batchMetrics);

  const { 
    apiStatus, 
    checking: checkingApi, 
    checkApiStatus,
    isAvailable: isMetricsApiAvailable 
  } = useMetricsApi();

  // Хук для зональных данных
  const {
    zoneDataMap,
    loading: zoneDataLoading,
    error: zoneDataError,
    stats: zoneDataStats,
    getZoneDataForArticle,
    hasZoneData,
    getCurrentZone,
    getZonePricesString,
    refresh: refreshZoneData
  } = useZoneData(analytics.creatives, true);

  // Оценки типов работ для подсчета COF
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

  // Компоненты флагов
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

  // ОБНОВЛЕННАЯ ФУНКЦИЯ: Агрегация метрик по всем видео креатива
  const getAggregatedCreativeMetrics = (creative) => {
    const creativeMetrics = getCreativeMetrics(creative.id);
    
    if (!creativeMetrics || creativeMetrics.length === 0) {
      return null;
    }

    // Фильтруем только найденные метрики
    const validMetrics = creativeMetrics.filter(metric => metric.found && metric.data);
    
    if (validMetrics.length === 0) {
      return null;
    }

    // Агрегируем все метрики
    const aggregated = validMetrics.reduce((acc, metric) => {
      const data = metric.data.raw;
      return {
        leads: acc.leads + (data.leads || 0),
        cost: acc.cost + (data.cost || 0),
        clicks: acc.clicks + (data.clicks || 0),
        impressions: acc.impressions + (data.impressions || 0),
        days_count: Math.max(acc.days_count, data.days_count || 0)
      };
    }, {
      leads: 0,
      cost: 0,
      clicks: 0,
      impressions: 0,
      days_count: 0
    });

    // Вычисляем производные метрики
    const cpl = aggregated.leads > 0 ? aggregated.cost / aggregated.leads : 0;
    const ctr = aggregated.impressions > 0 ? (aggregated.clicks / aggregated.impressions) * 100 : 0;
    const cpc = aggregated.clicks > 0 ? aggregated.cost / aggregated.clicks : 0;
    const cpm = aggregated.impressions > 0 ? (aggregated.cost / aggregated.impressions) * 1000 : 0;

    return {
      found: true,
      videoCount: validMetrics.length,
      totalVideos: creativeMetrics.length,
      data: {
        raw: {
          ...aggregated,
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
          days: String(aggregated.days_count)
        }
      }
    };
  };

  // НОВАЯ ФУНКЦИЯ: Получение метрик для конкретного видео
  const getIndividualVideoMetrics = (creative, videoIndex) => {
    const creativeMetrics = getCreativeMetrics(creative.id);
    
    if (!creativeMetrics || creativeMetrics.length === 0 || videoIndex >= creativeMetrics.length) {
      return null;
    }

    const metric = creativeMetrics[videoIndex];
    
    if (!metric.found || !metric.data) {
      return null;
    }

    return {
      found: true,
      videoTitle: creative.link_titles?.[videoIndex] || `Видео ${videoIndex + 1}`,
      videoIndex: videoIndex + 1,
      totalVideos: creativeMetrics.length,
      data: metric.data
    };
  };

  // НОВАЯ ФУНКЦИЯ: Переключение режима отображения метрик
  const toggleDetailMode = (creativeId) => {
    const newDetailMode = new Map(detailMode);
    const currentMode = newDetailMode.get(creativeId) || 'aggregated';
    
    if (currentMode === 'aggregated') {
      newDetailMode.set(creativeId, 'individual');
      // Устанавливаем начальный индекс видео на 0
      const newCurrentVideoIndex = new Map(currentVideoIndex);
      newCurrentVideoIndex.set(creativeId, 0);
      setCurrentVideoIndex(newCurrentVideoIndex);
    } else {
      newDetailMode.set(creativeId, 'aggregated');
    }
    
    setDetailMode(newDetailMode);
  };

  // НОВАЯ ФУНКЦИЯ: Получение текущих метрик для отображения
  const getCurrentMetricsForDisplay = (creative) => {
    const currentMode = detailMode.get(creative.id) || 'aggregated';
    
    if (currentMode === 'aggregated') {
      return {
        type: 'aggregated',
        metrics: getAggregatedCreativeMetrics(creative)
      };
    } else {
      const videoIndex = currentVideoIndex.get(creative.id) || 0;
      return {
        type: 'individual',
        metrics: getIndividualVideoMetrics(creative, videoIndex),
        videoIndex: videoIndex
      };
    }
  };

  // НОВАЯ ФУНКЦИЯ: Получение всех метрик видео для отображения
  const getAllVideoMetrics = (creative) => {
    const creativeMetrics = getCreativeMetrics(creative.id);
    
    if (!creativeMetrics || creativeMetrics.length === 0) {
      return [];
    }

    return creativeMetrics.map((metric, index) => ({
      videoIndex: index,
      videoTitle: creative.link_titles?.[index] || `Видео ${index + 1}`,
      found: metric.found,
      data: metric.found ? metric.data : null
    }));
  };

  // Компонент отображения зональных данных - компактные цены в два ряда
  const ZoneDataDisplay = ({ article }) => {
    const zoneData = getZoneDataForArticle(article);
    
    if (!zoneData) {
      return (
        <div className="text-center">
          <span className="text-gray-400 text-xs">—</span>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-1">
        {zoneData.red !== '—' && (
          <span className="font-mono font-bold inline-flex items-center justify-center px-2 py-1 rounded-full text-xs border bg-red-100 text-red-800 border-red-200">
            {zoneData.red}
          </span>
        )}
        {zoneData.pink !== '—' && (
          <span className="font-mono font-bold inline-flex items-center justify-center px-2 py-1 rounded-full text-xs border bg-pink-100 text-pink-800 border-pink-200">
            {zoneData.pink}
          </span>
        )}
        {zoneData.gold !== '—' && (
          <span className="font-mono font-bold inline-flex items-center justify-center px-2 py-1 rounded-full text-xs border bg-yellow-100 text-yellow-800 border-yellow-200">
            {zoneData.gold}
          </span>
        )}
        {zoneData.green !== '—' && (
          <span className="font-mono font-bold inline-flex items-center justify-center px-2 py-1 rounded-full text-xs border bg-green-100 text-green-800 border-green-200">
            {zoneData.green}
          </span>
        )}
      </div>
    );
  };

  // Определение текущей зоны на основе CPL
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

    if (zones.length === 0) {
      return null;
    }

    zones.sort((a, b) => b.price - a.price);

    for (const zone of zones) {
      if (cplValue <= zone.price) {
        return {
          zone: zone.zone,
          name: zone.name,
          price: zone.price
        };
      }
    }

    return {
      zone: zones[0].zone,
      name: zones[0].name,
      price: zones[0].price
    };
  };

  // Отображение текущей зоны
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

  /**
   * Вычисление COF для креатива (fallback для старых записей)
   */
  const calculateCOF = (workTypes) => {
    if (!workTypes || !Array.isArray(workTypes)) return 0;
    
    return workTypes.reduce((total, workType) => {
      const value = workTypeValues[workType] || 0;
      return total + value;
    }, 0);
  };

  /**
   * Форматирование COF для отображения
   */
  const formatCOF = (cof) => {
    return cof % 1 === 0 ? cof.toString() : cof.toFixed(1);
  };

  // ИЗМЕНЕН: COF теперь нейтральные цвета
  const getCOFBadgeColor = (cof) => {
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // НОВЫЕ ФУНКЦИИ: Подсчет по странам и зонам
  const getCountryStats = () => {
    const ukraineCount = analytics.creatives.filter(c => !c.is_poland).length;
    const polandCount = analytics.creatives.filter(c => c.is_poland).length;
    return { ukraineCount, polandCount };
  };

  const getZoneStats = () => {
    const zoneCount = { red: 0, pink: 0, gold: 0, green: 0 };
    
    analytics.creatives.forEach(creative => {
      const aggregatedMetrics = getAggregatedCreativeMetrics(creative);
      if (aggregatedMetrics?.found && aggregatedMetrics.data) {
        const cplString = aggregatedMetrics.data.formatted.cpl;
        const cplValue = parseFloat(cplString.replace('$', ''));
        
        if (!isNaN(cplValue)) {
          const currentZone = getCurrentZoneByMetrics(creative.article, cplValue);
          if (currentZone) {
            zoneCount[currentZone.zone]++;
          }
        }
      }
    });
    
    return zoneCount;
  };

  // Подсчет зон для каждого байера
  const getEditorZoneStats = () => {
    const editorZones = {};
    
    analytics.creatives.forEach(creative => {
      const editorId = creative.user_id || 'unknown';
      
      if (!editorZones[editorId]) {
        editorZones[editorId] = { red: 0, pink: 0, gold: 0, green: 0 };
      }
      
      const aggregatedMetrics = getAggregatedCreativeMetrics(creative);
      if (aggregatedMetrics?.found && aggregatedMetrics.data) {
        const cplString = aggregatedMetrics.data.formatted.cpl;
        const cplValue = parseFloat(cplString.replace('$', ''));
        
        if (!isNaN(cplValue)) {
          const currentZone = getCurrentZoneByMetrics(creative.article, cplValue);
          if (currentZone) {
            editorZones[editorId][currentZone.zone]++;
          }
        }
      }
    });
    
    return editorZones;
  };

  const getCurrentMonthYear = () => {
    const now = new Date();
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    return `${month}, ${year}`;
  };

  // Функция для показа комментария
  const showComment = (creative) => {
    setSelectedComment({
      article: creative.article,
      comment: creative.comment,
      createdAt: creative.created_at,
      editorName: creative.editor_name
    });
    setShowCommentModal(true);
  };

  // Переключение детализации типов работ
  const toggleWorkTypes = (creativeId) => {
    const newExpanded = new Set(expandedWorkTypes);
    if (newExpanded.has(creativeId)) {
      newExpanded.delete(creativeId);
    } else {
      newExpanded.add(creativeId);
    }
    setExpandedWorkTypes(newExpanded);
  };

  const loadAnalytics = async () => {
    console.log('🚀 Начинаем загрузку полной аналитики креативов...');
    
    try {
      setLoading(true);
      setError('');
      
      console.log('📡 Запрос к базе данных...');
      const [creativesData, editorsData] = await Promise.all([
        creativeService.getAllCreatives(),
        userService.getAllUsers()
      ]);

      console.log('📊 Данные получены:', {
        креативов: creativesData?.length || 0,
        пользователей: editorsData?.length || 0
      });

      // Безопасное получение данных
      const safeCreatives = creativesData || [];
      const safeEditors = editorsData || [];
      
      const editors = safeEditors.filter(u => u.role === 'editor');
      
      let filteredCreatives = safeCreatives;
      if (selectedEditor !== 'all') {
        filteredCreatives = safeCreatives.filter(c => c.user_id === selectedEditor);
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let periodCreatives = filteredCreatives;
      if (selectedPeriod === 'today') {
        periodCreatives = filteredCreatives.filter(c => new Date(c.created_at) >= todayStart);
      } else if (selectedPeriod === 'week') {
        periodCreatives = filteredCreatives.filter(c => new Date(c.created_at) >= weekStart);
      } else if (selectedPeriod === 'month') {
        periodCreatives = filteredCreatives.filter(c => new Date(c.created_at) >= monthStart);
      }

      console.log('📅 Фильтрация по периоду:', {
        период: selectedPeriod,
        всего: filteredCreatives.length,
        заПериод: periodCreatives.length
      });

      // Вычисляем COF статистику
      const todayCreatives = filteredCreatives.filter(c => new Date(c.created_at) >= todayStart);
      const weekCreatives = filteredCreatives.filter(c => new Date(c.created_at) >= weekStart);

      const calculateCreativeCOF = (creative) => {
        if (typeof creative.cof_rating === 'number') {
          return creative.cof_rating;
        }
        return calculateCOF(creative.work_types || []);
      };

      const totalCOF = filteredCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
      const todayCOF = todayCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
      const weekCOF = weekCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
      const avgCOF = filteredCreatives.length > 0 ? totalCOF / filteredCreatives.length : 0;

      // Подсчитываем креативы с комментариями
      const creativesWithComments = filteredCreatives.filter(c => c.comment && c.comment.trim()).length;

      const stats = {
        totalCreatives: filteredCreatives.length,
        totalEditors: editors.length,
        todayCreatives: todayCreatives.length,
        weekCreatives: weekCreatives.length,
        totalCOF: totalCOF,
        avgCOF: avgCOF,
        todayCOF: todayCOF,
        weekCOF: weekCOF,
        creativesWithComments: creativesWithComments
      };

      console.log('📈 Статистика COF и комментариев:', stats);

      // Статистика по типам работ с COF
      const workTypeStats = {};
      periodCreatives.forEach(creative => {
        if (creative.work_types && Array.isArray(creative.work_types)) {
          creative.work_types.forEach(workType => {
            if (!workTypeStats[workType]) {
              workTypeStats[workType] = {
                count: 0,
                totalCOF: 0
              };
            }
            workTypeStats[workType].count += 1;
            workTypeStats[workType].totalCOF += (workTypeValues[workType] || 0);
          });
        }
      });

      // Статистика по монтажерам
      const editorStats = {};
      
      periodCreatives.forEach(creative => {
        let editorName = 'Неизвестный монтажер';
        let editorId = creative.user_id || 'unknown';

        if (creative.editor_name) {
          editorName = creative.editor_name;
        } else if (creative.users && creative.users.name) {
          editorName = creative.users.name;
        } else {
          const editor = editors.find(e => e.id === creative.user_id);
          if (editor) {
            editorName = editor.name;
          }
        }

        if (!editorStats[editorId]) {
          editorStats[editorId] = {
            name: editorName,
            count: 0,
            totalCOF: 0,
            avgCOF: 0,
            types: {},
            commentsCount: 0
          };
        }

        editorStats[editorId].count += 1;
        
        const cof = calculateCreativeCOF(creative);
        editorStats[editorId].totalCOF += cof;
        
        // Подсчитываем комментарии
        if (creative.comment && creative.comment.trim()) {
          editorStats[editorId].commentsCount += 1;
        }
        
        if (creative.work_types && Array.isArray(creative.work_types)) {
          creative.work_types.forEach(workType => {
            editorStats[editorId].types[workType] = 
              (editorStats[editorId].types[workType] || 0) + 1;
          });
        }
      });

      // Рассчитываем средний COF для каждого монтажера
      Object.keys(editorStats).forEach(editorId => {
        const statsData = editorStats[editorId];
        statsData.avgCOF = statsData.count > 0 ? statsData.totalCOF / statsData.count : 0;
      });

      console.log('👥 Статистика монтажеров:', Object.keys(editorStats).length);
      console.log('🎯 Типы работ:', Object.keys(workTypeStats).length);

      setAnalytics({
        creatives: periodCreatives,
        editors,
        stats,
        workTypeStats,
        editorStats
      });

      console.log('✅ Аналитика успешно загружена');

    } catch (error) {
      console.error('❌ Ошибка загрузки аналитики:', error);
      setError(`Ошибка загрузки данных: ${error.message}`);
      
      setAnalytics({
        creatives: [],
        editors: [],
        stats: {
          totalCreatives: 0,
          totalEditors: 0,
          todayCreatives: 0,
          weekCreatives: 0,
          totalCOF: 0,
          avgCOF: 0,
          todayCOF: 0,
          weekCOF: 0,
          creativesWithComments: 0
        },
        workTypeStats: {},
        editorStats: {}
      });
    } finally {
      console.log('🏁 Завершаем загрузку аналитики');
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔄 useEffect триггер:', { selectedPeriod, selectedEditor });
    loadAnalytics();
  }, [selectedPeriod, selectedEditor]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.period-dropdown') && !event.target.closest('.period-trigger')) {
        setShowPeriodDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatKyivTime = (dateString) => {
    try {
      const date = new Date(dateString);
      const dateStr = date.toLocaleDateString('ru-RU', {
        timeZone: 'Europe/Kiev',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('ru-RU', {
        timeZone: 'Europe/Kiev',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return { date: dateStr, time: timeStr };
    } catch (error) {
      console.error('Error formatting date:', error);
      const fallback = new Date(dateString).toLocaleDateString('ru-RU', {
        timeZone: 'Europe/Kiev'
      });
      return { date: fallback, time: '00:00' };
    }
  };

  const exportReport = () => {
    try {
      const reportData = {
        period: selectedPeriod,
        metricsPeriod: metricsPeriod,
        editor: selectedEditor === 'all' ? 'Все монтажеры' : analytics.editors.find(e => e.id === selectedEditor)?.name,
        generated: new Date().toISOString(),
        stats: analytics.stats,
        metricsStats: aggregatedMetricsStats,
        workTypes: analytics.workTypeStats,
        editors: analytics.editorStats,
        apiStatus: apiStatus,
        creativesWithMetrics: metricsStats?.found || 0,
        creativesWithoutMetrics: (metricsStats?.total || 0) - (metricsStats?.found || 0),
        creativesWithComments: analytics.stats.creativesWithComments,
        zoneStats: getZoneStats(),
        countryStats: getCountryStats()
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creatives-analytics-report-${selectedPeriod}-${metricsPeriod}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка при экспорте отчета:', error);
    }
  };

  const handleRefreshAll = async () => {
    await loadAnalytics();
    refreshMetrics();
    refreshZoneData();
  };

  const handlePeriodChange = (period) => {
    console.log(`🔄 МГНОВЕННАЯ смена периода метрик: ${metricsPeriod} -> ${period}`);
    setMetricsPeriod(period);
    setShowPeriodDropdown(false);
    
    if (period === '4days') {
      console.log('⚡ Включен режим "4 дня" - фильтрация на клиенте без запросов к БД');
    }
  };

  const getPeriodButtonText = () => {
    return metricsPeriod === 'all' ? 'Все время' : '4 дня';
  };

  const countryStats = getCountryStats();
  const zoneStats = getZoneStats();
  const editorZoneStats = getEditorZoneStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка аналитики креативов...</p>
          <p className="mt-2 text-xs text-gray-500">Проверьте консоль для отладки</p>
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
              Аналитика креативов
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Полная статистика работы монтажеров, COF анализ, метрики рекламы и зональные данные
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
                      <Clock className="h-4 w-4 mr-2" />
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
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(loading || metricsLoading) ? 'animate-spin' : ''}`} />
              Обновить
            </button>
            <button
              onClick={exportReport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Экспорт
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Фильтры:</span>
            </div>
            
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Сегодня</option>
              <option value="week">Неделя</option>
              <option value="month">Месяц</option>
              <option value="all">Все время</option>
            </select>

            <select
              value={selectedEditor}
              onChange={(e) => setSelectedEditor(e.target.value)}
              className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все монтажеры</option>
              {analytics.editors.map(editor => (
                <option key={editor.id} value={editor.id}>
                  {editor.name}
                </option>
              ))}
            </select>
          </div>

          {/* API Status */}
          <div className="flex items-center space-x-3 text-sm">
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">API метрик:</span>
            </div>
            <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
              isMetricsApiAvailable 
                ? 'bg-green-100 text-green-700' 
                : apiStatus === 'unavailable' 
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
            }`}>
              {checkingApi ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
              ) : isMetricsApiAvailable ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              <span>
                {checkingApi ? 'Проверка...' : 
                 isMetricsApiAvailable ? 'Доступен' : 
                 apiStatus === 'unavailable' ? 'Недоступен' : 'Неизвестно'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {metricsError && (
        <div className="mx-6 mt-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md text-sm flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          Ошибка загрузки метрик: {metricsError}
        </div>
      )}

      {zoneDataError && (
        <div className="mx-6 mt-4 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-md text-sm flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          Ошибка загрузки зональных данных: {zoneDataError}
        </div>
      )}

      {/* НОВЫЕ КАРТОЧКИ СТАТИСТИКИ В ДВА РЯДА */}
      {analytics.creatives.length > 0 && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          {/* ПЕРВАЯ СТРОКА */}
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-4 mb-4">
            {/* Креативов */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Video className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Креативов
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {analytics.creatives.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* С комментарием */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MessageCircle className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        С комментарием
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {analytics.stats.creativesWithComments}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* UA/PL */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Globe className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        UA/PL
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        <div className="flex items-center space-x-1">
                          <span>{countryStats.ukraineCount}</span>
                          <span className="text-gray-400">/</span>
                          <span>{countryStats.polandCount}</span>
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Общий COF */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold" style={{fontSize: '10px'}}>COF</span>
                    </div>
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Общий COF
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {formatCOF(analytics.stats.totalCOF)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Средний COF */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Target className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Средний COF
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {formatCOF(analytics.stats.avgCOF)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Красная зона */}
            <div className="bg-red-500 overflow-hidden shadow-sm rounded-lg border border-red-600">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-red-100 truncate">
                        Красная зона
                      </dt>
                      <dd className="text-lg font-semibold text-white">
                        {zoneStats.red}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Розовая зона */}
            <div className="bg-pink-500 overflow-hidden shadow-sm rounded-lg border border-pink-600">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-pink-100 truncate">
                        Розовая зона
                      </dt>
                      <dd className="text-lg font-semibold text-white">
                        {zoneStats.pink}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Золотая зона */}
            <div className="bg-yellow-500 overflow-hidden shadow-sm rounded-lg border border-yellow-600">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-6 w-6 text-black" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-yellow-800 truncate">
                        Золотая зона
                      </dt>
                      <dd className="text-lg font-semibold text-black">
                        {zoneStats.gold}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Зеленая зона */}
            <div className="bg-green-500 overflow-hidden shadow-sm rounded-lg border border-green-600">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-green-100 truncate">
                        Зеленая зона
                      </dt>
                      <dd className="text-lg font-semibold text-white">
                        {zoneStats.green}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ВТОРАЯ СТРОКА - метрики */}
          {hasMetricsData && (
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-4">
              {/* Лидов */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          Лидов
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {formatStats().totalLeads}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* CPL */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold" style={{fontSize: '10px'}}>CPL</span>
                      </div>
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CPL
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {analytics.creatives.length > 0 && aggregatedMetricsStats.totalLeads > 0 ? 
                          (aggregatedMetricsStats.totalCost / aggregatedMetricsStats.totalLeads).toFixed(2) + '$' : 
                          '0.00$'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Расходы */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DollarSign className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          Расходы
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {formatStats().totalCost}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Клики */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          Клики
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {Math.round(aggregatedMetricsStats.totalClicks).toLocaleString()}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* CPC */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold" style={{fontSize: '10px'}}>CPC</span>
                      </div>
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CPC
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {aggregatedMetricsStats.totalClicks > 0 ? 
                          (aggregatedMetricsStats.totalCost / aggregatedMetricsStats.totalClicks).toFixed(2) + '$' : 
                          '0.00$'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTR */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold" style={{fontSize: '10px'}}>CTR</span>
                      </div>
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CTR
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {formatStats().avgCTR}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* CPM */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold" style={{fontSize: '10px'}}>CPM</span>
                      </div>
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CPM
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {aggregatedMetricsStats.totalImpressions > 0 ? 
                          ((aggregatedMetricsStats.totalCost / aggregatedMetricsStats.totalImpressions) * 1000).toFixed(2) + '$' : 
                          '0.00$'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Показы */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Eye className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          Показы
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {Math.round(aggregatedMetricsStats.totalImpressions).toLocaleString()}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ср. лидов */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <polyline points="17 11 19 13 23 9" />
                      </svg>
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          Ср. лидов
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {analytics.creatives.length > 0 ? Math.round(aggregatedMetricsStats.totalLeads / analytics.creatives.length) : 0}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Рейтинг байеров по зонам и COF */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Рейтинг байеров по зонам */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2 text-blue-500" />
                  Рейтинг монтажеров по зонам
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Монтажер
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          <div className="w-3 h-3 bg-red-500 rounded-full mx-auto"></div>
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          <div className="w-3 h-3 bg-pink-500 rounded-full mx-auto"></div>
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto"></div>
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          <div className="w-3 h-3 bg-green-500 rounded-full mx-auto"></div>
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          Σ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(() => {
                        // Собираем агрегированные метрики для каждого монтажера
                        const editorsWithMetrics = Object.entries(analytics.editorStats).map(([editorId, stats]) => {
                          const editorCreatives = analytics.creatives.filter(c => c.user_id === editorId);
                          
                          let totalLeads = 0;
                          let totalCost = 0;
                          let totalClicks = 0;
                          let totalImpressions = 0;
                          let creativesWithMetrics = 0;
                          
                          editorCreatives.forEach(creative => {
                            const metrics = getAggregatedCreativeMetrics(creative);
                            if (metrics?.found && metrics.data) {
                              totalLeads += metrics.data.raw.leads || 0;
                              totalCost += metrics.data.raw.cost || 0;
                              totalClicks += metrics.data.raw.clicks || 0;
                              totalImpressions += metrics.data.raw.impressions || 0;
                              creativesWithMetrics++;
                            }
                          });
                          
                          const avgCPL = totalLeads > 0 ? totalCost / totalLeads : 0;
                          const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
                          
                          return {
                            editorId,
                            ...stats,
                            zones: editorZoneStats[editorId] || { red: 0, pink: 0, gold: 0, green: 0 },
                            metrics: {
                              totalLeads,
                              totalCost,
                              avgCPL,
                              avgCTR,
                              creativesWithMetrics
                            }
                          };
                        });
                        
                        return editorsWithMetrics
                          .sort((a, b) => b.totalCOF - a.totalCOF)
                          .slice(0, 8)
                          .map((stats, index) => (
                            <tr key={stats.editorId} className="hover:bg-gray-50">
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {stats.name}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-red-600">
                                  {stats.zones.red}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-pink-600">
                                  {stats.zones.pink}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-yellow-600">
                                  {stats.zones.gold}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-green-600">
                                  {stats.zones.green}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-blue-600">
                                  {stats.count}
                                </span>
                              </td>
                            </tr>
                          ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Статистика монтажеров по эффективности */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-green-500" />
                  Статистика монтажеров по эффективности
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Монтажер
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          COF
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          Лидов
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          CPL
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          Расходы
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          CTR
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          CPC
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          💬
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(() => {
                        // Собираем агрегированные метрики для каждого монтажера
                        const editorsWithMetrics = Object.entries(analytics.editorStats).map(([editorId, stats]) => {
                          const editorCreatives = analytics.creatives.filter(c => c.user_id === editorId);
                          
                          let totalLeads = 0;
                          let totalCost = 0;
                          let totalClicks = 0;
                          let totalImpressions = 0;
                          let creativesWithMetrics = 0;
                          
                          editorCreatives.forEach(creative => {
                            const metrics = getAggregatedCreativeMetrics(creative);
                            if (metrics?.found && metrics.data) {
                              totalLeads += metrics.data.raw.leads || 0;
                              totalCost += metrics.data.raw.cost || 0;
                              totalClicks += metrics.data.raw.clicks || 0;
                              totalImpressions += metrics.data.raw.impressions || 0;
                              creativesWithMetrics++;
                            }
                          });
                          
                          const avgCPL = totalLeads > 0 ? totalCost / totalLeads : 0;
                          const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
                          const avgCPC = totalClicks > 0 ? totalCost / totalClicks : 0;
                          
                          return {
                            editorId,
                            ...stats,
                            metrics: {
                              totalLeads,
                              totalCost,
                              avgCPL,
                              avgCTR,
                              avgCPC,
                              creativesWithMetrics
                            }
                          };
                        });
                        
                        return editorsWithMetrics
                          .sort((a, b) => b.totalCOF - a.totalCOF)
                          .slice(0, 8)
                          .map((stats, index) => (
                            <tr key={stats.editorId} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {stats.name}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className={`text-xs font-bold px-2 py-1 rounded ${getCOFBadgeColor(stats.totalCOF).replace('border-', '').replace('border', '')}`}>
                                  {formatCOF(stats.totalCOF)}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-gray-900">
                                  {Math.round(stats.metrics.totalLeads)}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-gray-900">
                                  {stats.metrics.avgCPL > 0 ? stats.metrics.avgCPL.toFixed(2) : '0.00'}$
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-gray-900">
                                  {stats.metrics.totalCost.toFixed(2)}$
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-gray-900">
                                  {stats.metrics.avgCTR > 0 ? stats.metrics.avgCTR.toFixed(2) + '%' : '0.00%'}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-gray-900">
                                  {stats.metrics.avgCPC > 0 ? stats.metrics.avgCPC.toFixed(2) : '0.00'}$
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className={`text-sm font-bold ${
                                  stats.commentsCount > 0 ? 'text-indigo-600' : 'text-gray-400'
                                }`}>
                                  {stats.commentsCount}
                                </span>
                              </td>
                            </tr>
                          ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {analytics.creatives.length === 0 ? (
          <div className="text-center py-12">
            <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Нет креативов за выбранный период
            </h3>
            <p className="text-gray-600 mb-4">
              Измените фильтры для просмотра данных
            </p>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 text-center">
                {getCurrentMonthYear()} - Полная аналитика креативов
              </h3>
              
              <div className="overflow-x-auto" style={{maxHeight: 'calc(100vh - 400px)', overflowY: 'auto'}}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                    <tr>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Дата
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Артикул
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Монтажер
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Видео
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Зона
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <BarChart3 className="h-4 w-4 mx-auto" />
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
                        Клики
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        CPC
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        CTR
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        CPM
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Показы
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Дней
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Зоны
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        COF
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analytics.creatives
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                      .map((creative) => {
                        const cof = typeof creative.cof_rating === 'number' 
                          ? creative.cof_rating 
                          : calculateCOF(creative.work_types || []);
                        
                        const currentDisplayData = getCurrentMetricsForDisplay(creative);
                        const currentMode = detailMode.get(creative.id) || 'aggregated';
                        const allVideoMetrics = getAllVideoMetrics(creative);
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
                            
                            <td className="px-3 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center space-x-2">
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
                                
                                {creative.is_poland ? <PolandFlag /> : <UkraineFlag />}
                                
                                <div className="text-sm font-medium text-gray-900 cursor-text select-text">
                                  {creative.article}
                                </div>
                              </div>
                            </td>
                            
                            <td className="px-3 py-4 whitespace-nowrap text-center">
                              <span className="text-sm text-gray-900 cursor-text select-text">
                                {creative.editor_name || creative.users?.name || 'Неизвестен'}
                              </span>
                            </td>
                            
                            <td className="px-3 py-4 text-sm text-gray-900">
                              <div className="space-y-1">
                                {creative.link_titles && creative.link_titles.length > 0 ? (
                                  creative.link_titles.map((title, index) => (
                                    <div key={index} className="flex items-center min-h-[24px]">
                                      <span className="block text-left flex-1 mr-2 cursor-text select-text">{title}</span>
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
                              {currentMode === 'aggregated' ? (
                                <CurrentZoneDisplay 
                                  article={creative.article} 
                                  metricsData={getAggregatedCreativeMetrics(creative)}
                                />
                              ) : (
                                allVideoMetrics.length > 0 ? (
                                  <div className="space-y-1">
                                    {allVideoMetrics.map((videoMetric, index) => (
                                      <div key={index} className="text-center min-h-[24px]">
                                        {videoMetric.found ? (
                                          <CurrentZoneDisplay 
                                            article={creative.article} 
                                            metricsData={{
                                              found: true,
                                              data: videoMetric.data
                                            }}
                                          />
                                        ) : (
                                          <div className="text-center">
                                            <span className="text-gray-400 text-xs">—</span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center">
                                    <span className="text-gray-400 text-xs">—</span>
                                  </div>
                                )
                              )}
                            </td>

                            {/* ОБНОВЛЕННАЯ колонка с кнопкой статистики */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              <div className="flex items-center justify-center">
                                {getAggregatedCreativeMetrics(creative)?.found && creative.link_titles && creative.link_titles.length > 1 ? (
                                  <div className="flex items-center justify-center space-x-2">
                                    <button
                                      onClick={() => toggleDetailMode(creative.id)}
                                      className={`cursor-pointer p-2 rounded-full transition-colors duration-200 ${
                                        currentMode === 'individual' 
                                          ? 'text-orange-600 hover:text-orange-800 bg-orange-100 hover:bg-orange-200' 
                                          : 'text-blue-600 hover:text-blue-800 hover:bg-blue-100'
                                      }`}
                                      title={currentMode === 'aggregated' 
                                        ? "Показать статистику по каждому видео" 
                                        : "Показать общую статистику"
                                      }
                                    >
                                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/>
                                      </svg>
                                    </button>
                                    <div className="min-w-[24px] flex justify-center">
                                      {getAggregatedCreativeMetrics(creative)?.found && getAggregatedCreativeMetrics(creative).videoCount > 1 && (
                                        <span className="text-xs text-blue-600 bg-blue-100 px-1 rounded cursor-text select-text">
                                          {getAggregatedCreativeMetrics(creative).videoCount}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-8 h-8"></div>
                                )}
                              </div>
                            </td>
                            
                            {/* ОБНОВЛЕННЫЕ колонки метрик */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : currentMode === 'aggregated' ? (
                                currentDisplayData.metrics?.found ? (
                                  <span className="font-bold text-sm cursor-text select-text text-black">
                                    {currentDisplayData.metrics.data.formatted.leads}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              ) : (
                                allVideoMetrics.length > 0 ? (
                                  <div className="space-y-1">
                                    {allVideoMetrics.map((videoMetric, index) => (
                                      <div key={index} className="text-center min-h-[24px]">
                                        {videoMetric.found ? (
                                          <span className="font-bold text-sm cursor-text select-text text-orange-700">
                                            {videoMetric.data.formatted.leads}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 text-sm cursor-text select-text">—</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              )}
                            </td>
                            
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : currentMode === 'aggregated' ? (
                                currentDisplayData.metrics?.found ? (
                                  <span className="font-bold text-sm cursor-text select-text text-black">
                                    {currentDisplayData.metrics.data.formatted.cpl}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              ) : (
                                allVideoMetrics.length > 0 ? (
                                  <div className="space-y-1">
                                    {allVideoMetrics.map((videoMetric, index) => (
                                      <div key={index} className="text-center min-h-[24px]">
                                        {videoMetric.found ? (
                                          <span className="font-bold text-sm cursor-text select-text text-orange-700">
                                            {videoMetric.data.formatted.cpl}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 text-sm cursor-text select-text">—</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              )}
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : currentMode === 'aggregated' ? (
                                currentDisplayData.metrics?.found ? (
                                  <span className="font-bold text-sm cursor-text select-text text-black">
                                    {currentDisplayData.metrics.data.formatted.cost}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              ) : (
                                allVideoMetrics.length > 0 ? (
                                  <div className="space-y-1">
                                    {allVideoMetrics.map((videoMetric, index) => (
                                      <div key={index} className="text-center min-h-[24px]">
                                        {videoMetric.found ? (
                                          <span className="font-bold text-sm cursor-text select-text text-orange-700">
                                            {videoMetric.data.formatted.cost}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 text-sm cursor-text select-text">—</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              )}
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : currentMode === 'aggregated' ? (
                                currentDisplayData.metrics?.found ? (
                                  <span className="font-bold text-sm cursor-text select-text text-black">
                                    {currentDisplayData.metrics.data.formatted.clicks}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              ) : (
                                allVideoMetrics.length > 0 ? (
                                  <div className="space-y-1">
                                    {allVideoMetrics.map((videoMetric, index) => (
                                      <div key={index} className="text-center min-h-[24px]">
                                        {videoMetric.found ? (
                                          <span className="font-bold text-sm cursor-text select-text text-orange-700">
                                            {videoMetric.data.formatted.clicks}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 text-sm cursor-text select-text">—</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              )}
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : currentMode === 'aggregated' ? (
                                currentDisplayData.metrics?.found ? (
                                  <span className="font-bold text-sm cursor-text select-text text-black">
                                    {currentDisplayData.metrics.data.formatted.cpc}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              ) : (
                                allVideoMetrics.length > 0 ? (
                                  <div className="space-y-1">
                                    {allVideoMetrics.map((videoMetric, index) => (
                                      <div key={index} className="text-center min-h-[24px]">
                                        {videoMetric.found ? (
                                          <span className="font-bold text-sm cursor-text select-text text-orange-700">
                                            {videoMetric.data.formatted.cpc}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 text-sm cursor-text select-text">—</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              )}
                            </td>
                            
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : currentMode === 'aggregated' ? (
                                currentDisplayData.metrics?.found ? (
                                  <span className="font-bold text-sm cursor-text select-text text-black">
                                    {currentDisplayData.metrics.data.formatted.ctr}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              ) : (
                                allVideoMetrics.length > 0 ? (
                                  <div className="space-y-1">
                                    {allVideoMetrics.map((videoMetric, index) => (
                                      <div key={index} className="text-center min-h-[24px]">
                                        {videoMetric.found ? (
                                          <span className="font-bold text-sm cursor-text select-text text-orange-700">
                                            {videoMetric.data.formatted.ctr}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 text-sm cursor-text select-text">—</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              )}
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : currentMode === 'aggregated' ? (
                                currentDisplayData.metrics?.found ? (
                                  <span className="font-bold text-sm cursor-text select-text text-black">
                                    {currentDisplayData.metrics.data.formatted.cpm}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              ) : (
                                allVideoMetrics.length > 0 ? (
                                  <div className="space-y-1">
                                    {allVideoMetrics.map((videoMetric, index) => (
                                      <div key={index} className="text-center min-h-[24px]">
                                        {videoMetric.found ? (
                                          <span className="font-bold text-sm cursor-text select-text text-orange-700">
                                            {videoMetric.data.formatted.cpm}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 text-sm cursor-text select-text">—</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              )}
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : currentMode === 'aggregated' ? (
                                currentDisplayData.metrics?.found ? (
                                  <span className="font-bold text-sm cursor-text select-text text-black">
                                    {currentDisplayData.metrics.data.formatted.impressions}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              ) : (
                                allVideoMetrics.length > 0 ? (
                                  <div className="space-y-1">
                                    {allVideoMetrics.map((videoMetric, index) => (
                                      <div key={index} className="text-center min-h-[24px]">
                                        {videoMetric.found ? (
                                          <span className="font-bold text-sm cursor-text select-text text-orange-700">
                                            {videoMetric.data.formatted.impressions}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 text-sm cursor-text select-text">—</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              )}
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : currentMode === 'aggregated' ? (
                                currentDisplayData.metrics?.found ? (
                                  <span className="font-bold text-sm cursor-text select-text text-black">
                                    {currentDisplayData.metrics.data.formatted.days}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              ) : (
                                allVideoMetrics.length > 0 ? (
                                  <div className="space-y-1">
                                    {allVideoMetrics.map((videoMetric, index) => (
                                      <div key={index} className="text-center min-h-[24px]">
                                        {videoMetric.found ? (
                                          <span className="font-bold text-sm cursor-text select-text text-orange-700">
                                            {videoMetric.data.formatted.days.replace(/\s*дн\./g, '')}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 text-sm cursor-text select-text">—</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 cursor-text select-text">—</span>
                                )
                              )}
                            </td>

                            <td className="px-3 py-4 text-sm text-gray-900 text-center">
                              <ZoneDataDisplay article={creative.article} />
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-center">
                              {creative.work_types && creative.work_types.length > 0 ? (
                                <div className="space-y-1">
                                  {/* Первая строка: COF рейтинг */}
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getCOFBadgeColor(cof)} cursor-text select-text`}>
                                    <span className="text-xs font-bold mr-1">COF</span>
                                    {formatCOF(cof)}
                                  </span>
                                  
                                  {/* Вторая строка: Работы (количество) с возможностью раскрытия */}
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
                                  
                                  {/* Расширенный список работ */}
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
    </div>
  );
}

export default CreativeAnalytics;
