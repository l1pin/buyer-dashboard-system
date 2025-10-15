// CreativePanel.js - ОБНОВЛЕННАЯ ВЕРСИЯ с переключением метрик в той же строке
// Замените содержимое src/components/CreativePanel.js

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, creativeService, userService, creativeHistoryService, metricsAnalyticsService, trelloService } from '../supabaseClient';
import { 
  processLinksAndExtractTitles, 
  formatFileName, 
  ensureGoogleAuth,
  isGoogleDriveUrl
} from '../utils/googleDriveUtils';
import CreativeMetrics from './CreativeMetrics';
import { useBatchMetrics, useMetricsStats } from '../hooks/useMetrics';
import { useZoneData } from '../hooks/useZoneData';
import { MetricsService } from '../services/metricsService';
import { 
  Plus, 
  X, 
  Link as LinkIcon,
  Calendar,
  Eye,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Video,
  Image as ImageIcon,
  User,
  Play,
  TrendingUp,
  BarChart3,
  Activity,
  MessageCircle,
  FileText,
  ExternalLink,
  Clock,
  MoreHorizontal,
  Edit,
  Users,
  Target,
  DollarSign,
  MousePointer,
  Layers,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Globe,
  Star,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter
} from 'lucide-react';

function CreativeSearch({ user }) {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCreative, setEditingCreative] = useState(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creativesWithHistory, setCreativesWithHistory] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [metricsPeriod, setMetricsPeriod] = useState('all');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [expandedWorkTypes, setExpandedWorkTypes] = useState(new Set());
  const [openDropdowns, setOpenDropdowns] = useState(new Set());
  const [trelloStatuses, setTrelloStatuses] = useState(new Map());
  const [trelloLists, setTrelloLists] = useState([]);
  
  // Новая система фильтрации по периоду (как в CreativeAnalytics)
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [customDateFrom, setCustomDateFrom] = useState(null);
  const [customDateTo, setCustomDateTo] = useState(null);
  const [tempCustomDateFrom, setTempCustomDateFrom] = useState(null);
  const [tempCustomDateTo, setTempCustomDateTo] = useState(null);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth1, setCalendarMonth1] = useState(new Date());
  const [calendarMonth2, setCalendarMonth2] = useState(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next;
  });
  const [selectingDate, setSelectingDate] = useState(null);
  
  // НОВЫЕ состояния для переключения метрик в той же строке
  const [detailMode, setDetailMode] = useState(new Map()); // 'aggregated' (по умолчанию) или 'individual'
  const [currentVideoIndex, setCurrentVideoIndex] = useState(new Map()); // индекс текущего видео для каждого креатива
  
  const [selectedEditor, setSelectedEditor] = useState('all');
  const [selectedBuyer, setSelectedBuyer] = useState('all');
  const [selectedSearcher, setSelectedSearcher] = useState('all');
  
  const [newCreative, setNewCreative] = useState({
    article: '',
    links: [''],
    work_types: [],
    link_titles: [],
    comment: '',
    is_poland: false,
    trello_link: '',
    buyer_id: null,
    searcher_id: null
  });

  const [editCreative, setEditCreative] = useState({
    article: '',
    links: [''],
    work_types: [],
    link_titles: [],
    comment: '',
    is_poland: false,
    trello_link: '',
    buyer_id: null,
    searcher_id: null
  });

  const [extractingTitles, setExtractingTitles] = useState(false);
  const [editors, setEditors] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [searchers, setSearchers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showEditorDropdown, setShowEditorDropdown] = useState(false);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [showSearcherDropdown, setShowSearcherDropdown] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Используем useMemo для оптимизации фильтрации креативов
  const filteredCreatives = useMemo(() => {
    // КРИТИЧНО: Показываем ТОЛЬКО креативы, где текущий пользователь - searcher
    let creativesToFilter = creatives.filter(c => c.searcher_id === user.id);
    
    // Фильтрация по монтажеру
    if (selectedEditor !== 'all') {
      creativesToFilter = creativesToFilter.filter(c => c.user_id === selectedEditor);
    }
    
    // Фильтрация по байеру (оставляем для дополнительной фильтрации)
    if (selectedBuyer !== 'all') {
      creativesToFilter = creativesToFilter.filter(c => c.buyer_id === selectedBuyer);
    }
    
    // Убираем фильтрацию по серчеру, так как показываем только креативы текущего пользователя
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    // Вчера
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
    
    // Эта неделя (понедельник - воскресенье)
    const dayOfWeek = now.getDay(); // 0 = воскресенье, 1 = понедельник, ...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - daysToMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
    thisWeekEnd.setHours(23, 59, 59);
    
    // Последние 7 дней (включая сегодня)
    const last7DaysStart = new Date(now);
    last7DaysStart.setDate(now.getDate() - 6);
    last7DaysStart.setHours(0, 0, 0, 0);
    
    // Этот месяц
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // Последний месяц (предыдущий)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    if (selectedPeriod === 'today') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        return createdDate >= todayStart && createdDate <= todayEnd;
      });
    } else if (selectedPeriod === 'yesterday') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        return createdDate >= yesterdayStart && createdDate <= yesterdayEnd;
      });
    } else if (selectedPeriod === 'this_week') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        return createdDate >= thisWeekStart && createdDate <= thisWeekEnd;
      });
    } else if (selectedPeriod === 'last_7_days') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        return createdDate >= last7DaysStart && createdDate <= todayEnd;
      });
    } else if (selectedPeriod === 'this_month') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        return createdDate >= thisMonthStart && createdDate <= thisMonthEnd;
      });
    } else if (selectedPeriod === 'last_month') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        return createdDate >= lastMonthStart && createdDate <= lastMonthEnd;
      });
    } else if (selectedPeriod === 'custom' && customDateFrom && customDateTo) {
      const customFrom = new Date(customDateFrom);
      customFrom.setHours(0, 0, 0, 0);
      const customTo = new Date(customDateTo);
      customTo.setHours(23, 59, 59);
      
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        return createdDate >= customFrom && createdDate <= customTo;
      });
    }
    // Если selectedPeriod === 'all', то не фильтруем по дате
    
    return creativesToFilter;
  }, [creatives, selectedEditor, selectedBuyer, selectedSearcher, selectedPeriod, customDateFrom, customDateTo]);

  // Хуки для метрик - используем отфильтрованные креативы
  const [metricsLastUpdate, setMetricsLastUpdate] = useState(null);

  const { 
    batchMetrics, 
    loading: metricsLoading, 
    error: metricsError,
    stats: metricsStats,
    getVideoMetrics,
    getCreativeMetrics,
    refresh: refreshMetrics,
    loadFromCache
  } = useBatchMetrics(filteredCreatives, true, metricsPeriod);

  const { 
    stats: aggregatedMetricsStats,
    formatStats,
    hasData: hasMetricsData 
  } = useMetricsStats(filteredCreatives, batchMetrics);

  // Хук для зональных данных - используем отфильтрованные креативы
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
  } = useZoneData(filteredCreatives, true);

  const workTypes = [
    'Монтаж _Video',
    'Upscale_Video', 
    'Ресайз 1',
    'Озвучка',
    'Субтитры',
    'Ресайз 2',
    'Написання_Sub',
    'Video_Avarat',
    'Монтаж > 21s',
    'Правки_video',
    'Превьюшка',
    'Статика 1',
    'Статика 2', 
    'Статика 3',
    'Статика 4',
    'Ресайз St 1',
    'Ресайз St 2',
    'Ресайз St 3', 
    'Ресайз St 4',
    'Правки Статика',
    'Доп. 0,2',
    'Доп. 0,4',
    'Доп. 0,6',
    'Доп. 0,8',
    'Доп. 1',
    'Доп. 2'
  ];

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
          avg_duration: acc.avg_duration + (data.avg_duration || 0),
          days_count: Math.max(acc.days_count, data.days_count || 0),
          cost_from_sources: acc.cost_from_sources + (data.cost_from_sources || 0),
          clicks_on_link: acc.clicks_on_link + (data.clicks_on_link || 0)
        };
      }, {
        leads: 0,
        cost: 0,
        clicks: 0,
        impressions: 0,
        avg_duration: 0,
        days_count: 0,
        cost_from_sources: 0,
        clicks_on_link: 0
      });

    // Вычисляем среднее время просмотра
    const avgDuration = validMetrics.length > 0 ? aggregated.avg_duration / validMetrics.length : 0;

    const cpl = aggregated.leads > 0 ? aggregated.cost / aggregated.leads : 0;
    const ctr = aggregated.impressions > 0 ? (aggregated.clicks_on_link / aggregated.impressions) * 100 : 0;
    const cpc = aggregated.clicks > 0 ? aggregated.cost / aggregated.clicks : 0;
    const cpm = aggregated.impressions > 0 ? (aggregated.cost_from_sources / aggregated.impressions) * 1000 : 0;

    return {
      found: true,
      videoCount: validMetrics.length,
      totalVideos: creativeMetrics.length,
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

  // НОВАЯ ФУНКЦИЯ: Получение метрик для конкретного видео
  const getIndividualVideoMetrics = (creative, videoIndex) => {
    if (!creative.link_titles || videoIndex >= creative.link_titles.length) {
      return null;
    }
    
    const videoKey = `${creative.id}_${videoIndex}`;
    const metric = batchMetrics.get(videoKey);
    
    if (!metric || !metric.found || !metric.data) {
      return null;
    }

    return {
      found: true,
      videoTitle: creative.link_titles[videoIndex] || `Видео ${videoIndex + 1}`,
      videoIndex: videoIndex + 1,
      totalVideos: creative.link_titles.length,
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

  // НОВАЯ ФУНКЦИЯ: Переключение на предыдущее видео
  const previousVideo = (creativeId, creative) => {
    const newCurrentVideoIndex = new Map(currentVideoIndex);
    const currentIndex = newCurrentVideoIndex.get(creativeId) || 0;
    const maxIndex = (creative.link_titles?.length || 1) - 1;
    
    const newIndex = currentIndex > 0 ? currentIndex - 1 : maxIndex;
    newCurrentVideoIndex.set(creativeId, newIndex);
    setCurrentVideoIndex(newCurrentVideoIndex);
  };

  // НОВАЯ ФУНКЦИЯ: Переключение на следующее видео
  const nextVideo = (creativeId, creative) => {
    const newCurrentVideoIndex = new Map(currentVideoIndex);
    const currentIndex = newCurrentVideoIndex.get(creativeId) || 0;
    const maxIndex = (creative.link_titles?.length || 1) - 1;
    
    const newIndex = currentIndex < maxIndex ? currentIndex + 1 : 0;
    newCurrentVideoIndex.set(creativeId, newIndex);
    setCurrentVideoIndex(newCurrentVideoIndex);
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
    if (!creative.link_titles || creative.link_titles.length === 0) {
      return [];
    }
    
    const videoCount = creative.link_titles.length;
    const allMetrics = [];
    
    // КРИТИЧНО: Создаем массив для ВСЕХ видео, даже если метрик нет
    for (let index = 0; index < videoCount; index++) {
      const videoKey = `${creative.id}_${index}`;
      const metric = batchMetrics.get(videoKey);
      
      allMetrics.push({
        videoIndex: index,
        videoTitle: creative.link_titles[index] || `Видео ${index + 1}`,
        found: metric?.found || false,
        data: metric?.found ? metric.data : null
      });
    }
    
    return allMetrics;
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

    // Собираем доступные зоны
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
        {zones.map((zone, index) => (
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

    // КРИТИЧНО: Сортируем от МЕНЬШЕГО к БОЛЬШЕМУ
    zones.sort((a, b) => a.price - b.price);

    // ПРАВИЛЬНАЯ логика:
    // Зеленая: CPL < green_price
    // Золотая: green_price <= CPL < gold_price
    // Розовая: gold_price <= CPL < pink_price
    // Красная: pink_price <= CPL < red_price
    // Вне зон: CPL >= red_price (возвращаем красную или null)

    // Ищем зону, в которую попадает CPL
    for (let i = 0; i < zones.length; i++) {
      const currentZone = zones[i];
      
      if (i === 0) {
        // Первая зона (самая дешевая, обычно зеленая)
        if (cplValue < currentZone.price) {
          return {
            zone: currentZone.zone,
            name: currentZone.name,
            price: currentZone.price
          };
        }
      } else {
        // Остальные зоны: проверяем диапазон между предыдущей и текущей
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

    // Если CPL >= самой дорогой зоны, возвращаем самую дорогую (красную)
    const mostExpensive = zones[zones.length - 1];
    return {
      zone: mostExpensive.zone,
      name: mostExpensive.name,
      price: mostExpensive.price
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

  // ИЗМЕНЕН: COF теперь нейтральные цвета
  const getCOFBadgeColor = (cof) => {
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getCOFStats = (creativesData) => {
    const totalCOF = creativesData.reduce((sum, creative) => {
      return sum + calculateCOF(creative.work_types);
    }, 0);

    const avgCOF = creativesData.length > 0 ? totalCOF / creativesData.length : 0;
    
    return {
      totalCOF: totalCOF,
      avgCOF: avgCOF,
      maxCOF: Math.max(...creativesData.map(c => calculateCOF(c.work_types)), 0),
      minCOF: creativesData.length > 0 ? Math.min(...creativesData.map(c => calculateCOF(c.work_types))) : 0
    };
  };

  // НОВЫЕ ФУНКЦИИ: Подсчет по странам и зонам
  const getCountryStats = (creativesData) => {
    const ukraineCount = creativesData.filter(c => !c.is_poland).length;
    const polandCount = creativesData.filter(c => c.is_poland).length;
    return { ukraineCount, polandCount };
  };

  const getZoneStats = (creativesData) => {
    const zoneCount = { red: 0, pink: 0, gold: 0, green: 0 };
    
    creativesData.forEach(creative => {
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

  // Функции для календаря
  const getPeriodLabel = () => {
    const formatDate = (date) => {
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const now = new Date();

    switch(selectedPeriod) {
      case 'today': {
        return `${formatDate(now)}`;
      }
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return `${formatDate(yesterday)}`;
      }
      case 'this_week': {
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - daysToMonday);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
      }
      case 'last_7_days': {
        const last7Start = new Date(now);
        last7Start.setDate(now.getDate() - 6);
        return `${formatDate(last7Start)} - ${formatDate(now)}`;
      }
      case 'this_month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return `${formatDate(monthStart)} - ${formatDate(monthEnd)}`;
      }
      case 'last_month': {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return `${formatDate(lastMonthStart)} - ${formatDate(lastMonthEnd)}`;
      }
      case 'custom': {
        if (customDateFrom && customDateTo) {
          return `${formatDate(customDateFrom)} - ${formatDate(customDateTo)}`;
        }
        return 'Выбрать период';
      }
      case 'all': return 'Все время';
      default: return 'Выбрать период';
    }
  };

  const handlePeriodSelect = (period) => {
    setSelectedPeriod(period);
    if (period === 'custom') {
      setShowCalendar(true);
      setTempCustomDateFrom(customDateFrom);
      setTempCustomDateTo(customDateTo);
    } else {
      setShowCalendar(false);
      setCustomDateFrom(null);
      setCustomDateTo(null);
      setTempCustomDateFrom(null);
      setTempCustomDateTo(null);
      setShowPeriodMenu(false);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const handleDateClick = (date) => {
    if (!selectingDate) {
      setTempCustomDateFrom(date);
      setSelectingDate(date);
      setTempCustomDateTo(null);
    } else {
      if (date < selectingDate) {
        setTempCustomDateFrom(date);
        setTempCustomDateTo(selectingDate);
      } else {
        setTempCustomDateTo(date);
      }
      setSelectingDate(null);
    }
  };

  const isDateInRange = (date) => {
    if (!tempCustomDateFrom || !tempCustomDateTo) return false;
    return date >= tempCustomDateFrom && date <= tempCustomDateTo;
  };

  const isDateSelected = (date) => {
    if (!tempCustomDateFrom) return false;
    if (tempCustomDateFrom.toDateString() === date.toDateString()) return true;
    if (tempCustomDateTo && tempCustomDateTo.toDateString() === date.toDateString()) return true;
    return false;
  };

  const applyCustomPeriod = () => {
    if (tempCustomDateFrom && tempCustomDateTo) {
      setCustomDateFrom(tempCustomDateFrom);
      setCustomDateTo(tempCustomDateTo);
      setSelectedPeriod('custom');
      setShowCalendar(false);
      setShowPeriodMenu(false);
    }
  };

  const resetCalendar = () => {
    setTempCustomDateFrom(null);
    setTempCustomDateTo(null);
    setSelectingDate(null);
    setShowCalendar(false);
  };

  // Функция больше не нужна, используем useMemo выше

  useEffect(() => {
    loadUsers();
    loadCreatives();
    loadLastUpdateTime();
    
    // Подписка на создание новых креативов
    const creativesSubscription = supabase
      .channel('creatives_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'creatives'
        },
        async (payload) => {
          console.log('🆕 Новый креатив создан:', payload.new.article);
          
          // Если у нового креатива есть Trello ссылка, ждем появления статуса
          if (payload.new.trello_link) {
            console.log('⏳ Ждем синхронизации Trello статуса для', payload.new.article);
            
            // Даем время на синхронизацию (2 секунды)
            setTimeout(async () => {
              try {
                console.log('🔍 Проверяем статус для', payload.new.id);
                const status = await trelloService.getCardStatus(payload.new.id);
                
                if (status) {
                  console.log('✅ Статус получен:', status.list_name);
                  setTrelloStatuses(prev => {
                    const newMap = new Map(prev);
                    newMap.set(payload.new.id, status);
                    console.log('🗺️ Обновлен Map, новый размер:', newMap.size);
                    return newMap;
                  });
                } else {
                  console.log('⚠️ Статус еще не синхронизирован, перезагружаем все статусы...');
                  loadTrelloStatuses();
                }
              } catch (error) {
                console.error('❌ Ошибка получения статуса:', error);
                // При ошибке просто перезагружаем все статусы
                loadTrelloStatuses();
              }
            }, 2000); // Ждем 2 секунды
          }
        }
      )
      .subscribe();
    
    // Подписка на изменения статусов Trello в реальном времени
    const trelloSubscription = trelloService.subscribeToCardStatuses((payload) => {
      console.log('🔄 Trello status changed:', payload);
      
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        console.log('➕ Обновляем статус для креатива:', payload.new.creative_id);
        setTrelloStatuses(prev => {
          const newMap = new Map(prev);
          newMap.set(payload.new.creative_id, payload.new);
          console.log('🗺️ Map обновлен, размер:', newMap.size);
          return newMap;
        });
      } else if (payload.eventType === 'DELETE') {
        console.log('➖ Удаляем статус для креатива:', payload.old.creative_id);
        setTrelloStatuses(prev => {
          const newMap = new Map(prev);
          newMap.delete(payload.old.creative_id);
          return newMap;
        });
      }
    });
    
    return () => {
      creativesSubscription.unsubscribe();
      trelloSubscription.unsubscribe();
    };
  }, []);

  // Отдельный useEffect для загрузки Trello статусов ПОСЛЕ загрузки креативов
  useEffect(() => {
    console.log('🔵 useEffect для Trello, creatives:', creatives?.length);
    
    if (creatives && creatives.length > 0) {
      console.log('🟢 Запускаем loadTrelloStatuses с автосинхронизацией...');
      loadTrelloStatuses(true); // true = автоматически синхронизировать пропущенные
    } else {
      console.log('⚠️ creatives пуст, ждем...');
    }
  }, [creatives]);

  const loadLastUpdateTime = async () => {
    try {
      const lastUpdate = await metricsAnalyticsService.getMetricsLastUpdate();
      setMetricsLastUpdate(lastUpdate);
    } catch (error) {
      console.error('Ошибка загрузки времени последнего обновления:', error);
    }
  };

  // 🆕 НОВАЯ ФУНКЦИЯ: Синхронизация пропущенных статусов
  const syncMissingTrelloStatuses = async (currentStatusMap) => {
    try {
      console.log('🔄 Проверка пропущенных Trello статусов...');
      
      // Находим креативы с trello_link, но без статуса
      const creativesWithoutStatus = creatives.filter(creative => {
        const hasLink = !!creative.trello_link;
        const hasStatus = currentStatusMap.has(creative.id);
        return hasLink && !hasStatus;
      });
      
      if (creativesWithoutStatus.length === 0) {
        console.log('✅ Все креативы с Trello ссылками имеют статусы');
        return 0;
      }
      
      console.log(`⚠️ Найдено ${creativesWithoutStatus.length} креативов БЕЗ статуса, но с Trello ссылкой`);
      console.log('📋 Артикулы:', creativesWithoutStatus.map(c => c.article).join(', '));
      
      // Синхронизируем каждый креатив
      let successCount = 0;
      let errorCount = 0;
      const newStatuses = new Map();
      
      for (const creative of creativesWithoutStatus) {
        try {
          console.log(`🔄 Синхронизация статуса для ${creative.article}...`);
          
          const result = await trelloService.syncSingleCreative(
            creative.id,
            creative.trello_link
          );
          
          if (result.success) {
            console.log(`✅ Статус синхронизирован: ${result.listName}`);
            
            // Сохраняем в временный Map
            newStatuses.set(creative.id, {
              creative_id: creative.id,
              list_name: result.listName,
              list_id: result.listId,
              trello_card_id: result.cardId,
              last_updated: new Date().toISOString()
            });
            
            successCount++;
          }
        } catch (error) {
          console.error(`❌ Ошибка синхронизации ${creative.article}:`, error.message);
          errorCount++;
        }
        
        // Задержка между запросами к API Trello (избегаем rate limit)
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Обновляем Map одним вызовом
      if (newStatuses.size > 0) {
        setTrelloStatuses(prev => {
          const updated = new Map(prev);
          newStatuses.forEach((value, key) => {
            updated.set(key, value);
          });
          console.log('🗺️ Map обновлен, новый размер:', updated.size);
          return updated;
        });
      }
      
      console.log(`🎉 Автосинхронизация завершена: успешно ${successCount}, ошибок ${errorCount}`);
      return successCount;
      
    } catch (error) {
      console.error('❌ Ошибка автосинхронизации статусов:', error);
      return 0;
    }
  };

  // Загрузка статусов Trello карточек
  const loadTrelloStatuses = async (shouldSyncMissing = false) => {
    try {
      console.log('🟢 loadTrelloStatuses СТАРТ, shouldSyncMissing:', shouldSyncMissing);
      console.log('📊 creatives:', creatives?.length || 0);
      
      // Получаем списки
      const lists = await trelloService.getAllLists();
      setTrelloLists(lists);
      console.log(`✅ Загружено ${lists.length} списков Trello`);
      
      // Получаем статусы для ВСЕХ креативов
      const creativeIds = creatives.map(c => c.id);
      console.log(`🔍 Запрос статусов для ${creativeIds.length} креативов`);
      console.log('🆔 Первые 3 ID:', creativeIds.slice(0, 3));
      
      if (creativeIds.length > 0) {
        const statusMap = await trelloService.getBatchCardStatuses(creativeIds);
        
        console.log('🟡 ПЕРЕД setTrelloStatuses, размер Map:', statusMap.size);
        
        setTrelloStatuses(statusMap);
        
        console.log('🟢 ПОСЛЕ setTrelloStatuses');
        console.log(`✅ Установлено ${statusMap.size} статусов в состояние`);
        
        // Выводим пример для отладки
        if (statusMap.size > 0) {
          const firstEntry = Array.from(statusMap.entries())[0];
          console.log('📦 Первая пара [ID, статус]:', firstEntry);
        }
        
        // 🚀 НОВОЕ: Автоматическая синхронизация пропущенных статусов
        if (shouldSyncMissing) {
          const syncedCount = await syncMissingTrelloStatuses(statusMap);
          return syncedCount;
        }
      } else {
        console.warn('⚠️ НЕТ креативов для загрузки статусов!');
      }
      
      console.log('🏁 loadTrelloStatuses ЗАВЕРШЕН');
      return 0;
    } catch (error) {
      console.error('❌ Ошибка загрузки Trello статусов:', error);
      console.error('Stack:', error.stack);
      return 0;
    }
  };

  // Получить название списка для креатива
  const getTrelloListName = (creativeId) => {
    // Временное логирование для первого креатива
    const isFirstCall = !window.__trelloDebugCalled;
    if (isFirstCall) {
      window.__trelloDebugCalled = true;
      console.log('🔴 getTrelloListName ПЕРВЫЙ ВЫЗОВ');
      console.log('📊 trelloStatuses.size:', trelloStatuses.size);
      console.log('🆔 Ищем creativeId:', creativeId);
      console.log('🗺️ Все ключи Map:', Array.from(trelloStatuses.keys()));
    }
    
    const status = trelloStatuses.get(creativeId);
    
    if (!status) {
      if (isFirstCall) {
        console.log('❌ Статус НЕ НАЙДЕН для', creativeId);
      }
      return '—';
    }
    
    if (isFirstCall) {
      console.log('✅ Статус НАЙДЕН:', status);
    }
    
    return status.list_name || '—';
  };

  const loadCreatives = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('📡 Загрузка креативов для Search Manager...');
      
      // Загружаем креативы через прямой запрос
      const { data: directData, error: directError } = await supabase
        .from('creatives')
        .select('*')
        .eq('searcher_id', user.id);
      
      if (directError) {
        throw directError;
      }
      
      console.log(`✅ Загружено ${directData.length} креативов для Search Manager`);
      
      setCreatives(directData);
      
      // Проверяем наличие истории для каждого креатива
      const creativesWithHistorySet = new Set();
      for (const creative of directData) {
        const hasHistory = await creativeHistoryService.hasHistory(creative.id);
        if (hasHistory) {
          creativesWithHistorySet.add(creative.id);
        }
      }
      setCreativesWithHistory(creativesWithHistorySet);
    } catch (error) {
      console.error('❌ Ошибка загрузки креативов:', error);
      setError('Ошибка загрузки креативов: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      console.log('👥 Загрузка пользователей...');
      
      const [editorsData, buyersData, searchersData] = await Promise.all([
        userService.getUsersByRole('editor'),
        userService.getUsersByRole('buyer'),
        userService.getUsersByRole('search_manager')
      ]);
      
      setEditors(editorsData);
      setBuyers(buyersData);
      setSearchers(searchersData);
      console.log(`✅ Загружено ${editorsData.length} монтажеров, ${buyersData.length} байеров и ${searchersData.length} серчеров`);
    } catch (error) {
      console.error('❌ Ошибка загрузки пользователей:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const validateGoogleDriveLinks = (links) => {
    const validLinks = links.filter(link => link.trim() !== '');
    const invalidLinks = [];

    for (const link of validLinks) {
      const trimmedLink = link.trim();
      if (!trimmedLink.startsWith('https://drive.google.com/file/d/') && 
          !trimmedLink.startsWith('drive.google.com/file/d/')) {
        invalidLinks.push(link);
      }
    }

    return { validLinks, invalidLinks };
  };

  const handleCreateCreative = async () => {
    if (!validateFields()) {
      return;
    }

    const { validLinks, invalidLinks } = validateGoogleDriveLinks(newCreative.links);
    const trimmedTrelloLink = newCreative.trello_link.trim();

    try {
      setCreating(true);
      setError('');
      setSuccess('');

      setAuthorizing(true);
      const authSuccess = await ensureGoogleAuth();
      setAuthorizing(false);

      if (!authSuccess) {
        setError('Необходима авторизация Google для извлечения названий файлов');
        setCreating(false);
        return;
      }

      setExtractingTitles(true);
      const { links, titles } = await processLinksAndExtractTitles(validLinks, true);
      setExtractingTitles(false);

      const extractedTitles = titles.filter(title => !title.startsWith('Видео '));
      if (extractedTitles.length === 0) {
        setError('Не удалось извлечь названия из ваших ссылок. Проверьте что ссылки ведут на доступные файлы Google Drive и попробуйте еще раз, или обратитесь к администратору.');
        setCreating(false);
        return;
      }

      const cofRating = calculateCOF(newCreative.work_types);

      // Получаем имена байера и серчера по их ID
      const buyerName = newCreative.buyer_id ? getBuyerName(newCreative.buyer_id) : null;
      const searcherName = newCreative.searcher_id ? getSearcherName(newCreative.searcher_id) : null;

      await creativeService.createCreative({
        user_id: user.id,
        editor_name: user.name,
        article: newCreative.article.trim(),
        links: links,
        link_titles: titles,
        work_types: newCreative.work_types,
        cof_rating: cofRating,
        comment: newCreative.comment.trim() || null,
        is_poland: newCreative.is_poland,
        trello_link: newCreative.trello_link.trim(),
        buyer_id: newCreative.buyer_id,
        searcher_id: newCreative.searcher_id,
        buyer: buyerName !== '—' ? buyerName : null,
        searcher: searcherName !== '—' ? searcherName : null
      });

      setNewCreative({
        article: '',
        links: [''],
        work_types: [],
        link_titles: [],
        comment: '',
        is_poland: false,
        trello_link: '',
        buyer_id: null,
        searcher_id: null
      });
      setShowCreateModal(false);

      // Загружаем креативы
      await loadCreatives();
      
      // 🔥 АВТОМАТИЧЕСКАЯ ЗАГРУЗКА МЕТРИК И ЗОН ДЛЯ НОВОГО КРЕАТИВА
      console.log('🚀 Автоматическая загрузка метрик и зон для нового креатива...');
      setSuccess(`Креатив создан! Загружаем метрики и зональные данные...`);
      
      // Загружаем метрики (это обновит все креативы, включая новый)
      await refreshMetrics();
      console.log('✅ Метрики загружены');
      
      // Загружаем зональные данные
      await refreshZoneData();
      console.log('✅ Зональные данные загружены');
      
      const successCount = extractedTitles.length;
      const totalCount = titles.length;
      const cof = calculateCOF(newCreative.work_types);
      const country = newCreative.is_poland ? 'PL' : 'UA';
      setSuccess(`Креатив создан! COF: ${formatCOF(cof)} | Страна: ${country} | Названий извлечено: ${successCount}/${totalCount} | Метрики и зоны загружены автоматически`);
    } catch (error) {
      setError('Ошибка создания креатива: ' + error.message);
      setExtractingTitles(false);
      setAuthorizing(false);
    } finally {
      setCreating(false);
    }
  };

  const handleEditCreative = (creative) => {
    console.log('✏️ Открытие редактирования креатива:', creative.article);
    
    setEditingCreative(creative);
    setEditCreative({
      article: creative.article,
      links: creative.links || [''],
      work_types: creative.work_types || [],
      link_titles: creative.link_titles || [],
      comment: creative.comment || '',
      is_poland: creative.is_poland || false,
      trello_link: creative.trello_link || '',
      buyer_id: creative.buyer_id || null,
      searcher_id: creative.searcher_id || null
    });
    setShowEditModal(true);
    clearMessages();
  };

  const handleUpdateCreative = async () => {
    if (!validateEditFields()) {
      return;
    }

    const { validLinks, invalidLinks } = validateGoogleDriveLinks(editCreative.links);

    try {
      setUpdating(true);
      setError('');
      setSuccess('');

      setAuthorizing(true);
      const authSuccess = await ensureGoogleAuth();
      setAuthorizing(false);

      if (!authSuccess) {
        setError('Необходима авторизация Google для извлечения названий файлов');
        setUpdating(false);
        return;
      }

      setExtractingTitles(true);
      const { links, titles } = await processLinksAndExtractTitles(validLinks, true);
      setExtractingTitles(false);

      const extractedTitles = titles.filter(title => !title.startsWith('Видео '));
      if (extractedTitles.length === 0) {
        setError('Не удалось извлечь названия из ваших ссылок. Проверьте что ссылки ведут на доступные файлы Google Drive и попробуйте еще раз, или обратитесь к администратору.');
        setUpdating(false);
        return;
      }

      const cofRating = calculateCOF(editCreative.work_types);

      const buyerName = editCreative.buyer_id ? getBuyerName(editCreative.buyer_id) : null;
      const searcherName = editCreative.searcher_id ? getSearcherName(editCreative.searcher_id) : null;

      // Сохраняем старое состояние в историю ПЕРЕД обновлением
      await creativeHistoryService.createHistoryEntry({
        creative_id: editingCreative.id,
        article: editingCreative.article,
        links: editingCreative.links,
        link_titles: editingCreative.link_titles,
        work_types: editingCreative.work_types,
        cof_rating: editingCreative.cof_rating,
        comment: editingCreative.comment,
        is_poland: editingCreative.is_poland,
        trello_link: editingCreative.trello_link,
        buyer_id: editingCreative.buyer_id,
        searcher_id: editingCreative.searcher_id,
        buyer: editingCreative.buyer,
        searcher: editingCreative.searcher,
        changed_by_id: user.id,
        changed_by_name: user.name,
        change_type: 'updated'
      });

      await creativeService.updateCreative(editingCreative.id, {
        links: links,
        link_titles: titles,
        work_types: editCreative.work_types,
        cof_rating: cofRating,
        comment: editCreative.comment.trim() || null,
        is_poland: editCreative.is_poland,
        trello_link: editCreative.trello_link.trim(),
        buyer_id: editCreative.buyer_id,
        searcher_id: editCreative.searcher_id,
        buyer: buyerName !== '—' ? buyerName : null,
        searcher: searcherName !== '—' ? searcherName : null
      });

      setEditCreative({
        article: '',
        links: [''],
        work_types: [],
        link_titles: [],
        comment: '',
        is_poland: false,
        trello_link: '',
        buyer_id: null,
        searcher_id: null
      });
      setEditingCreative(null);
      setShowEditModal(false);

      await loadCreatives();
      
      const successCount = extractedTitles.length;
      const totalCount = titles.length;
      const cof = calculateCOF(editCreative.work_types);
      const country = editCreative.is_poland ? 'PL' : 'UA';
      setSuccess(`Креатив обновлен! COF: ${formatCOF(cof)} | Страна: ${country} | Названий извлечено: ${successCount}/${totalCount}`);
    } catch (error) {
      setError('Ошибка обновления креатива: ' + error.message);
      setExtractingTitles(false);
      setAuthorizing(false);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCreative = async (creativeId, article) => {
    if (!window.confirm(`Вы уверены, что хотите удалить креатив "${article}"?`)) {
      return;
    }

    try {
      await creativeService.deleteCreative(creativeId);
      await loadCreatives();
      setSuccess('Креатив удален');
    } catch (error) {
      setError('Ошибка удаления креатива: ' + error.message);
    }
  };

  const addLinkField = () => {
    setNewCreative({
      ...newCreative,
      links: [...newCreative.links, '']
    });
  };

  const removeLinkField = (index) => {
    const newLinks = newCreative.links.filter((_, i) => i !== index);
    setNewCreative({
      ...newCreative,
      links: newLinks.length === 0 ? [''] : newLinks
    });
  };

  const updateLink = (index, value) => {
    const newLinks = [...newCreative.links];
    newLinks[index] = value;
    setNewCreative({
      ...newCreative,
      links: newLinks
    });
    clearFieldError('links');
  };

  const handleWorkTypeChange = (workType, isChecked) => {
    let updatedWorkTypes;
    if (isChecked) {
      updatedWorkTypes = [...newCreative.work_types, workType];
    } else {
      updatedWorkTypes = newCreative.work_types.filter(type => type !== workType);
    }
    
    setNewCreative({
      ...newCreative,
      work_types: updatedWorkTypes
    });
    clearFieldError('work_types');
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

  const toggleDropdown = (creativeId) => {
    const newOpenDropdowns = new Set(openDropdowns);
    if (newOpenDropdowns.has(creativeId)) {
      newOpenDropdowns.delete(creativeId);
    } else {
      newOpenDropdowns.add(creativeId);
    }
    setOpenDropdowns(newOpenDropdowns);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-menu') && !event.target.closest('.dropdown-trigger')) {
        setOpenDropdowns(new Set());
      }
      if (!event.target.closest('.period-dropdown') && !event.target.closest('.period-trigger')) {
        setShowPeriodDropdown(false);
      }
      if (!event.target.closest('.editor-dropdown') && !event.target.closest('.editor-trigger')) {
        setShowEditorDropdown(false);
      }
      
      if (!event.target.closest('.buyer-dropdown') && !event.target.closest('.buyer-trigger')) {
        setShowBuyerDropdown(false);
      }
      
      if (!event.target.closest('.searcher-dropdown') && !event.target.closest('.searcher-trigger')) {
        setShowSearcherDropdown(false);
      }
      
      // Закрываем меню периодов при клике вне его
      const periodMenuContainer = event.target.closest('.period-menu-container');
      if (!periodMenuContainer && showPeriodMenu) {
        setShowPeriodMenu(false);
        setTempCustomDateFrom(customDateFrom);
        setTempCustomDateTo(customDateTo);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPeriodMenu, customDateFrom, customDateTo]);

  const handlePeriodChange = (period) => {
    console.log(`🔄 МГНОВЕННАЯ смена периода метрик: ${metricsPeriod} -> ${period}`);
    setMetricsPeriod(period);
    setShowPeriodDropdown(false);
    clearMessages();
    
    if (period === '4days') {
      console.log('⚡ Включен режим "4 дня" - фильтрация на клиенте без запросов к БД');
    }
  };

  const getPeriodButtonText = () => {
    return metricsPeriod === 'all' ? 'Все время' : '4 дня';
  };

  const formatKyivTime = (dateString) => {
    try {
      // Парсим строку напрямую БЕЗ создания Date объекта
      // Формат: 2025-09-29 06:34:24.19675+00 или 2025-09-29T06:34:24.19675+00:00
      const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
      
      if (!match) {
        throw new Error('Invalid date format');
      }
      
      const [_, year, month, day, hours, minutes] = match;
      
      const dateStr = `${day}.${month}.${year}`;
      const timeStr = `${hours}:${minutes}`;
      
      return { date: dateStr, time: timeStr };
    } catch (error) {
      console.error('Error formatting date:', error);
      return { date: '00.00.0000', time: '00:00' };
    }
  };

  const getWorkTypeIcon = (workTypes) => {
    const firstType = workTypes[0] || '';
    if (firstType.toLowerCase().includes('video') || firstType.toLowerCase().includes('монтаж')) {
      return <Video className="h-4 w-4" />;
    }
    if (firstType.toLowerCase().includes('статика')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <Eye className="h-4 w-4" />;
  };

  const getWorkTypeColor = (workTypes) => {
    const firstType = workTypes[0] || '';
    if (firstType.toLowerCase().includes('video') || firstType.toLowerCase().includes('монтаж')) {
      return 'bg-blue-100 text-blue-800';
    }
    if (firstType.toLowerCase().includes('статика')) {
      return 'bg-green-100 text-green-800';
    }
    if (firstType.toLowerCase().includes('доп')) {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
    setFieldErrors({});
  };

  const clearErrorMessage = () => {
    setError('');
  };

  const clearFieldError = (fieldName) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  };

  const isAllFieldsValid = () => {
    const { validLinks, invalidLinks } = validateGoogleDriveLinks(newCreative.links);
    
    return (
      newCreative.article.trim() &&
      validLinks.length > 0 &&
      invalidLinks.length === 0 &&
      newCreative.work_types.length > 0 &&
      newCreative.trello_link.trim() &&
      (newCreative.trello_link.trim().startsWith('https://trello.com/c/') || 
       newCreative.trello_link.trim().startsWith('trello.com/c/'))
    );
  };

  const validateEditFields = () => {
    const errors = {};
    const errorMessages = [];

    // Артикул не проверяем, так как он не редактируется

    // Проверяем ссылки
    const { validLinks, invalidLinks } = validateGoogleDriveLinks(editCreative.links);
    if (validLinks.length === 0) {
      errors.links = true;
      errorMessages.push('Необходимо добавить хотя бы одну ссылку на Google Drive');
    } else if (invalidLinks.length > 0) {
      errors.links = true;
      errorMessages.push('Проверьте правильность ссылок на Google Drive');
    }

    // Проверяем типы работ
    if (editCreative.work_types.length === 0) {
      errors.work_types = true;
      errorMessages.push('Необходимо выбрать хотя бы один тип работы');
    }

    // Проверяем Trello ссылку
    if (!editCreative.trello_link.trim()) {
      errors.trello_link = true;
      errorMessages.push('Карточка Trello обязательна для заполнения');
    } else {
      const trimmedTrelloLink = editCreative.trello_link.trim();
      if (!trimmedTrelloLink.startsWith('https://trello.com/c/') && 
          !trimmedTrelloLink.startsWith('trello.com/c/')) {
        errors.trello_link = true;
        errorMessages.push('Проверьте правильность ссылки на Trello');
      }
    }

    setFieldErrors(errors);
    
    // Устанавливаем сообщение об ошибке
    if (errorMessages.length > 0) {
      if (errorMessages.length === 1) {
        setError(errorMessages[0]);
      } else {
        setError('Пожалуйста, исправьте следующие ошибки: ' + errorMessages.join(', '));
      }
    }
    
    return Object.keys(errors).length === 0;
  };

  const validateFields = () => {
    const errors = {};
    const errorMessages = [];

    // Проверяем артикул
    if (!newCreative.article.trim()) {
      errors.article = true;
      errorMessages.push('Артикул обязателен для заполнения');
    }

    // Проверяем ссылки
    const { validLinks, invalidLinks } = validateGoogleDriveLinks(newCreative.links);
    if (validLinks.length === 0) {
      errors.links = true;
      errorMessages.push('Необходимо добавить хотя бы одну ссылку на Google Drive');
    } else if (invalidLinks.length > 0) {
      errors.links = true;
      errorMessages.push('Проверьте правильность ссылок на Google Drive');
    }

    // Проверяем типы работ
    if (newCreative.work_types.length === 0) {
      errors.work_types = true;
      errorMessages.push('Необходимо выбрать хотя бы один тип работы');
    }

    // Проверяем Trello ссылку
    if (!newCreative.trello_link.trim()) {
      errors.trello_link = true;
      errorMessages.push('Карточка Trello обязательна для заполнения');
    } else {
      const trimmedTrelloLink = newCreative.trello_link.trim();
      if (!trimmedTrelloLink.startsWith('https://trello.com/c/') && 
          !trimmedTrelloLink.startsWith('trello.com/c/')) {
        errors.trello_link = true;
        errorMessages.push('Проверьте правильность ссылки на Trello');
      }
    }

    setFieldErrors(errors);
    
    // Устанавливаем сообщение об ошибке
    if (errorMessages.length > 0) {
      if (errorMessages.length === 1) {
        setError(errorMessages[0]);
      } else {
        setError('Пожалуйста, исправьте следующие ошибки: ' + errorMessages.join(', '));
      }
    }
    
    return Object.keys(errors).length === 0;
  };

  const getEditorName = (editorId) => {
    if (!editorId || editorId === 'all') return 'Все монтажеры';
    const editor = editors.find(e => e.id === editorId);
    return editor ? editor.name : 'Неизвестный';
  };

  const getEditorAvatar = (editorId) => {
    if (!editorId || editorId === 'all') return null;
    const editor = editors.find(e => e.id === editorId);
    return editor ? editor.avatar_url : null;
  };

  const getBuyerName = (buyerId) => {
    if (!buyerId) return '—';
    const buyer = buyers.find(b => b.id === buyerId);
    return buyer ? buyer.name : 'Удален';
  };

  const getSearcherName = (searcherId) => {
    if (!searcherId) return '—';
    const searcher = searchers.find(s => s.id === searcherId);
    return searcher ? searcher.name : 'Удален';
  };

  const getBuyerAvatar = (buyerId) => {
    if (!buyerId) return null;
    const buyer = buyers.find(b => b.id === buyerId);
    return buyer ? buyer.avatar_url : null;
  };

  const getSearcherAvatar = (searcherId) => {
    if (!searcherId) return null;
    const searcher = searchers.find(s => s.id === searcherId);
    return searcher ? searcher.avatar_url : null;
  };

  const getSelectedBuyer = () => {
    if (!newCreative.buyer_id) return null;
    return buyers.find(b => b.id === newCreative.buyer_id);
  };

  const getSelectedSearcher = () => {
    if (!newCreative.searcher_id) return null;
    return searchers.find(s => s.id === newCreative.searcher_id);
  };

  const handleRefreshAll = async () => {
    console.log(`🔄 Обновление только метрик и зональных данных (период: ${metricsPeriod})`);
    await refreshMetrics();
    await refreshZoneData();
    await loadLastUpdateTime();
  };

  const cofStats = getCOFStats(filteredCreatives);
  const countryStats = getCountryStats(filteredCreatives);
  const zoneStats = getZoneStats(filteredCreatives);

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
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center ${user?.avatar_url ? 'hidden' : ''}`}>
                <User className="h-6 w-6 text-gray-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Мои креативы</h1>
              <p className="text-sm text-gray-600 mt-1">
                {user?.name} — Креативы где я указан как Searcher
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* Кнопка выбора периода дат */}
            <div className="relative period-menu-container">
              <button
                onClick={() => setShowPeriodMenu(!showPeriodMenu)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {getPeriodLabel()}
                <ChevronDown className="h-4 w-4 ml-2" />
              </button>
              
              {/* Выпадающее меню с календарем ВНУТРИ */}
              {showPeriodMenu && (
                <div className="absolute left-1/2 transform -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50" style={{width: '850px'}}>
                  <div className="grid grid-cols-3">
                    {/* Левая колонка - список периодов */}
                    <div className="border-r border-gray-200 py-2">
                      <button
                        onClick={() => handlePeriodSelect('today')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          selectedPeriod === 'today' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Сегодня
                      </button>
                      
                      <button
                        onClick={() => handlePeriodSelect('yesterday')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          selectedPeriod === 'yesterday' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Вчера
                      </button>
                      
                      <button
                        onClick={() => handlePeriodSelect('this_week')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          selectedPeriod === 'this_week' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Эта неделя
                      </button>
                      
                      <button
                        onClick={() => handlePeriodSelect('last_7_days')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          selectedPeriod === 'last_7_days' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Последние 7 дней
                      </button>
                      
                      <button
                        onClick={() => handlePeriodSelect('this_month')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          selectedPeriod === 'this_month' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Этот месяц
                      </button>
                      
                      <button
                        onClick={() => handlePeriodSelect('last_month')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          selectedPeriod === 'last_month' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Последний месяц
                      </button>
                      
                      <div className="border-t border-gray-200 my-1"></div>
                      
                      <button
                        onClick={() => handlePeriodSelect('all')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          selectedPeriod === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Все время
                      </button>
                    </div>
                    
                    {/* Правая колонка - календарь (2 месяца) */}
                    <div className="col-span-2 p-4">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Первый календарь */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <button
                              onClick={() => {
                                const prev = new Date(calendarMonth1);
                                prev.setMonth(prev.getMonth() - 1);
                                setCalendarMonth1(prev);
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <ChevronDown className="h-4 w-4 transform rotate-90" />
                            </button>
                            <div className="text-sm font-medium">
                              {calendarMonth1.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                            </div>
                            {(() => {
                              const nextMonth = new Date(calendarMonth1);
                              nextMonth.setMonth(nextMonth.getMonth() + 1);
                              const hasGap = (calendarMonth2.getFullYear() - nextMonth.getFullYear()) * 12 + 
                                           (calendarMonth2.getMonth() - nextMonth.getMonth()) >= 1;
                              
                              return hasGap ? (
                                <button
                                  onClick={() => {
                                    const next = new Date(calendarMonth1);
                                    next.setMonth(next.getMonth() + 1);
                                    setCalendarMonth1(next);
                                  }}
                                  className="p-1 hover:bg-gray-200 rounded"
                                >
                                  <ChevronDown className="h-4 w-4 transform -rotate-90" />
                                </button>
                              ) : (
                                <div className="w-6"></div>
                              );
                            })()}
                          </div>
                          
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                                {day}
                              </div>
                            ))}
                          </div>
                          
                          <div className="grid grid-cols-7 gap-1">
                            {(() => {
                              const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(calendarMonth1);
                              const days = [];
                              
                              const adjustedStartDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
                              
                              for (let i = 0; i < adjustedStartDay; i++) {
                                days.push(<div key={`empty-${i}`} className="aspect-square"></div>);
                              }
                              
                              for (let day = 1; day <= daysInMonth; day++) {
                                const date = new Date(year, month, day);
                                const isSelected = isDateSelected(date);
                                const isInRange = isDateInRange(date);
                                const isToday = date.toDateString() === new Date().toDateString();
                                
                                days.push(
                                  <button
                                    key={day}
                                    onClick={() => handleDateClick(date)}
                                    className={`aspect-square flex items-center justify-center text-sm rounded transition-colors
                                      ${isSelected ? 'bg-blue-500 text-white font-medium' : ''}
                                      ${isInRange && !isSelected ? 'bg-blue-100 text-blue-700' : ''}
                                      ${!isSelected && !isInRange ? 'hover:bg-gray-100 text-gray-700' : ''}
                                      ${isToday && !isSelected ? 'border border-blue-500' : ''}
                                    `}
                                  >
                                    {day}
                                  </button>
                                );
                              }
                              
                              return days;
                            })()}
                          </div>
                        </div>
                        
                        {/* Второй календарь */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            {(() => {
                              const prevMonth = new Date(calendarMonth2);
                              prevMonth.setMonth(prevMonth.getMonth() - 1);
                              const hasGap = (prevMonth.getFullYear() - calendarMonth1.getFullYear()) * 12 + 
                                           (prevMonth.getMonth() - calendarMonth1.getMonth()) >= 1;
                              
                              return hasGap ? (
                                <button
                                  onClick={() => {
                                    const prev = new Date(calendarMonth2);
                                    prev.setMonth(prev.getMonth() - 1);
                                    setCalendarMonth2(prev);
                                  }}
                                  className="p-1 hover:bg-gray-200 rounded"
                                >
                                  <ChevronDown className="h-4 w-4 transform rotate-90" />
                                </button>
                              ) : (
                                <div className="w-6"></div>
                              );
                            })()}
                            <div className="text-sm font-medium">
                              {calendarMonth2.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                            </div>
                            <button
                              onClick={() => {
                                const next = new Date(calendarMonth2);
                                next.setMonth(next.getMonth() + 1);
                                setCalendarMonth2(next);
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <ChevronDown className="h-4 w-4 transform -rotate-90" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                                {day}
                              </div>
                            ))}
                          </div>
                          
                          <div className="grid grid-cols-7 gap-1">
                            {(() => {
                              const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(calendarMonth2);
                              const days = [];
                              
                              const adjustedStartDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
                              
                              for (let i = 0; i < adjustedStartDay; i++) {
                                days.push(<div key={`empty-${i}`} className="aspect-square"></div>);
                              }
                              
                              for (let day = 1; day <= daysInMonth; day++) {
                                const date = new Date(year, month, day);
                                const isSelected = isDateSelected(date);
                                const isInRange = isDateInRange(date);
                                const isToday = date.toDateString() === new Date().toDateString();
                                
                                days.push(
                                  <button
                                    key={day}
                                    onClick={() => handleDateClick(date)}
                                    className={`aspect-square flex items-center justify-center text-sm rounded transition-colors
                                      ${isSelected ? 'bg-blue-500 text-white font-medium' : ''}
                                      ${isInRange && !isSelected ? 'bg-blue-100 text-blue-700' : ''}
                                      ${!isSelected && !isInRange ? 'hover:bg-gray-100 text-gray-700' : ''}
                                      ${isToday && !isSelected ? 'border border-blue-500' : ''}
                                    `}
                                  >
                                    {day}
                                  </button>
                                );
                              }
                              
                              return days;
                            })()}
                          </div>
                        </div>
                      </div>
                      
                      {/* Кнопка применить для custom периода */}
                      {(tempCustomDateFrom || tempCustomDateTo) && (
                        <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-200">
                          <button
                            onClick={applyCustomPeriod}
                            disabled={!tempCustomDateFrom || !tempCustomDateTo}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            Применить
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

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
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(loading || metricsLoading) ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>
        </div>
      </div>

      {/* Информационная панель с временем обновления */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {metricsLastUpdate && (
              <>
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-500">
                  Обновлено: {new Date(metricsLastUpdate).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </>
            )}
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

          <button
              onClick={async () => {
                if (window.confirm('Синхронизировать статусы всех креативов с Trello?\n\nЭто может занять некоторое время для креативов без статуса.')) {
                  console.log('🔄 Ручная синхронизация всех статусов...');
                  try {
                    const syncedCount = await loadTrelloStatuses(true); // true = синхронизировать пропущенные
                    if (syncedCount > 0) {
                      alert(`Синхронизация завершена!\n\nОбновлено статусов: ${syncedCount}`);
                    } else {
                      alert('Синхронизация завершена!\n\nВсе статусы уже актуальны.');
                    }
                  } catch (error) {
                    console.error('Ошибка синхронизации:', error);
                    alert('Ошибка синхронизации. Проверьте консоль.');
                  }
                }
              }}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200"
              title="Синхронизировать все статусы Trello"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Синхронизировать Trello
            </button>

            <div className="relative">
              <button
                onClick={() => setShowEditorDropdown(!showEditorDropdown)}
                className="editor-trigger inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <div className="flex items-center space-x-2">
                  {selectedEditor === 'all' ? (
                    <Video className="h-4 w-4 text-gray-500" />
                  ) : (
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                      {getEditorAvatar(selectedEditor) ? (
                        <img
                          src={getEditorAvatar(selectedEditor)}
                          alt="Editor"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center ${getEditorAvatar(selectedEditor) ? 'hidden' : ''}`}>
                        <User className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>
                  )}
                  <span>{getEditorName(selectedEditor)}</span>
                </div>
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showEditorDropdown && (
                <div className="editor-dropdown absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSelectedEditor('all');
                        setShowEditorDropdown(false);
                      }}
                      className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                        selectedEditor === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <Video className="h-5 w-5 mr-3 text-gray-500" />
                      Все монтажеры
                    </button>
                    
                    {editors.map(editor => (
                      <button
                        key={editor.id}
                        onClick={() => {
                          setSelectedEditor(editor.id);
                          setShowEditorDropdown(false);
                        }}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                          selectedEditor === editor.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0 mr-3">
                          {editor.avatar_url ? (
                            <img
                              src={editor.avatar_url}
                              alt={editor.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${editor.avatar_url ? 'hidden' : ''}`}>
                            <User className="h-3 w-3 text-gray-400" />
                          </div>
                        </div>
                        <span className="truncate">{editor.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="relative">
              <button
                onClick={() => setShowBuyerDropdown(!showBuyerDropdown)}
                className="buyer-trigger inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <div className="flex items-center space-x-2">
                  {selectedBuyer === 'all' ? (
                    <User className="h-4 w-4 text-gray-500" />
                  ) : (
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                      {getBuyerAvatar(selectedBuyer) ? (
                        <img
                          src={getBuyerAvatar(selectedBuyer)}
                          alt="Buyer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center ${getBuyerAvatar(selectedBuyer) ? 'hidden' : ''}`}>
                        <User className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>
                  )}
                  <span>{selectedBuyer === 'all' ? 'Все байеры' : getBuyerName(selectedBuyer)}</span>
                </div>
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showBuyerDropdown && (
                <div className="buyer-dropdown absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSelectedBuyer('all');
                        setShowBuyerDropdown(false);
                      }}
                      className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                        selectedBuyer === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <User className="h-5 w-5 mr-3 text-gray-500" />
                      Все байеры
                    </button>
                    
                    {buyers.map(buyer => (
                      <button
                        key={buyer.id}
                        onClick={() => {
                          setSelectedBuyer(buyer.id);
                          setShowBuyerDropdown(false);
                        }}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                          selectedBuyer === buyer.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0 mr-3">
                          {buyer.avatar_url ? (
                            <img
                              src={buyer.avatar_url}
                              alt={buyer.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${buyer.avatar_url ? 'hidden' : ''}`}>
                            <User className="h-3 w-3 text-gray-400" />
                          </div>
                        </div>
                        <span className="truncate">{buyer.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            
          </div>

          
        </div>
        
      </div>

      {/* НОВЫЕ КАРТОЧКИ СТАТИСТИКИ В ДВА РЯДА */}
      {filteredCreatives.length > 0 && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          {/* ПЕРВАЯ СТРОКА */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-2 sm:gap-3 md:gap-4 mb-4">
            {/* Креативов */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Video className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Креативов
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {filteredCreatives.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* С комментарием */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        С комментарием
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {filteredCreatives.filter(c => c.comment && c.comment.trim()).length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* UA/PL */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Globe className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        UA/PL
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
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
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-[8px] sm:text-[9px] md:text-[10px]">COF</span>
                    </div>
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Общий COF
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {formatCOF(cofStats.totalCOF)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Средний COF */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Target className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Средний COF
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {formatCOF(cofStats.avgCOF)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Красная зона */}
            <div className="bg-red-500 overflow-hidden shadow-sm rounded-lg border border-red-600">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-red-100 truncate">
                        Красная зона
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-white">
                        {zoneStats.red}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Розовая зона */}
            <div className="bg-pink-500 overflow-hidden shadow-sm rounded-lg border border-pink-600">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-pink-100 truncate">
                        Розовая зона
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-white">
                        {zoneStats.pink}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Золотая зона */}
            <div className="bg-yellow-500 overflow-hidden shadow-sm rounded-lg border border-yellow-600">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-black" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-yellow-800 truncate">
                        Золотая зона
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-black">
                        {zoneStats.gold}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Зеленая зона */}
            <div className="bg-green-500 overflow-hidden shadow-sm rounded-lg border border-green-600">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-green-100 truncate">
                        Зеленая зона
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-white">
                        {zoneStats.green}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ВТОРАЯ СТРОКА - метрики */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-2 sm:gap-3 md:gap-4">
              {/* Лидов */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                    </div>
                    <div className="ml-2 sm:ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          Лидов
                        </dt>
                        <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                          {hasMetricsData ? formatStats().totalLeads : '—'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* CPL */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-[8px] sm:text-[9px] md:text-[10px]">CPL</span>
                      </div>
                    </div>
                    <div className="ml-2 sm:ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CPL
                        </dt>
                        <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                          {hasMetricsData ? (filteredCreatives.length > 0 && aggregatedMetricsStats.totalLeads > 0 ? 
                          (aggregatedMetricsStats.totalCost / aggregatedMetricsStats.totalLeads).toFixed(2) + '$' : 
                          '0.00$') : '—'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Расходы */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                    </div>
                    <div className="ml-2 sm:ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          Расходы
                        </dt>
                        <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                          {hasMetricsData ? formatStats().totalCost : '—'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Клики */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                    </div>
                    <div className="ml-2 sm:ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          Клики
                        </dt>
                        <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                          {hasMetricsData ? Math.round(aggregatedMetricsStats.totalClicks).toLocaleString() : '—'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* CPC */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-[8px] sm:text-[9px] md:text-[10px]">CPC</span>
                      </div>
                    </div>
                    <div className="ml-2 sm:ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CPC
                        </dt>
                        <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                          {hasMetricsData ? (aggregatedMetricsStats.totalClicks > 0 ? 
                          (aggregatedMetricsStats.totalCost / aggregatedMetricsStats.totalClicks).toFixed(2) + '$' : 
                          '0.00$') : '—'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTR */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-[8px] sm:text-[9px] md:text-[10px]">CTR</span>
                      </div>
                    </div>
                    <div className="ml-2 sm:ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CTR
                        </dt>
                        <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                          {hasMetricsData ? formatStats().avgCTR : '—'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* CPM */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-[8px] sm:text-[9px] md:text-[10px]">CPM</span>
                      </div>
                    </div>
                    <div className="ml-2 sm:ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CPM
                        </dt>
                        <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                          {hasMetricsData ? (aggregatedMetricsStats.totalImpressions > 0 ? 
                          ((aggregatedMetricsStats.totalCost / aggregatedMetricsStats.totalImpressions) * 1000).toFixed(2) + '$' : 
                          '0.00$') : '—'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Показы */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                    </div>
                    <div className="ml-2 sm:ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          Показы
                        </dt>
                        <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                          {hasMetricsData ? Math.round(aggregatedMetricsStats.totalImpressions).toLocaleString() : '—'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ср. лидов */}
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <polyline points="17 11 19 13 23 9" />
                      </svg>
                    </div>
                    <div className="ml-2 sm:ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          Ср. лидов
                        </dt>
                        <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                          {hasMetricsData ? (filteredCreatives.length > 0 ? Math.round(aggregatedMetricsStats.totalLeads / filteredCreatives.length) : 0) : '—'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

            </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-6">
        {filteredCreatives.length === 0 ? (
          <div className="text-center py-12">
            <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Нет креативов
            </h3>
            <p className="text-gray-600 mb-4">
              Вы еще не указаны как Searcher ни в одном креативе
            </p>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 text-center">
                Полная аналитика креативов
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
                        Время
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
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Trello
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Статус
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Buyer
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Searcher
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCreatives
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))
                      .map((creative) => {
                        const cof = typeof creative.cof_rating === 'number' 
                          ? creative.cof_rating 
                          : calculateCOF(creative.work_types || []);
                        
                        const currentDisplayData = getCurrentMetricsForDisplay(creative);
                        const currentMode = detailMode.get(creative.id) || 'aggregated';
                        const allVideoMetrics = getAllVideoMetrics(creative);
                        const isWorkTypesExpanded = expandedWorkTypes.has(creative.id);
                        const isDropdownOpen = openDropdowns.has(creative.id);
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
                                  {getEditorAvatar(creative.user_id) ? (
                                    <img
                                      src={getEditorAvatar(creative.user_id)}
                                      alt="Editor"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${getEditorAvatar(creative.user_id) ? 'hidden' : ''}`}>
                                    <User className="h-3 w-3 text-gray-400" />
                                  </div>
                                </div>
                                <span className="text-sm text-gray-900 cursor-text select-text">
                                  {creative.editor_name || creative.users?.name || 'Неизвестен'}
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
                              {metricsLoading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              ) : currentMode === 'aggregated' ? (
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
                                      {currentMode === 'individual' ? (
                                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                          <path stroke="none" d="M0 0h24v24H0z"/>
                                          <polyline points="5 9 9 9 9 5" />
                                          <line x1="3" y1="3" x2="9" y2="9" />
                                          <polyline points="5 15 9 15 9 19" />
                                          <line x1="3" y1="21" x2="9" y2="15" />
                                          <polyline points="19 9 15 9 15 5" />
                                          <line x1="15" y1="9" x2="21" y2="3" />
                                          <polyline points="19 15 15 15 15 19" />
                                          <line x1="15" y1="15" x2="21" y2="21" />
                                        </svg>
                                      ) : (
                                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                          <path stroke="none" d="M0 0h24v24H0z"/>
                                          <polyline points="16 4 20 4 20 8" />
                                          <line x1="14" y1="10" x2="20" y2="4" />
                                          <polyline points="8 20 4 20 4 16" />
                                          <line x1="4" y1="20" x2="10" y2="14" />
                                          <polyline points="16 20 20 20 20 16" />
                                          <line x1="14" y1="14" x2="20" y2="20" />
                                          <polyline points="8 4 4 4 4 8" />
                                          <line x1="4" y1="4" x2="10" y2="10" />
                                        </svg>
                                      )}
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
                                          <span className="font-bold text-sm cursor-text select-text text-black-700">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black-700">
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
                                  <span 
                                    className="font-bold text-sm cursor-text select-text text-black relative group"
                                  >
                                    {currentDisplayData.metrics.data.formatted.cost}
                                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                      Расход FB: {currentDisplayData.metrics.data.raw.cost_from_sources?.toFixed(2)}$
                                    </span>
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
                                          <span 
                                            className="font-bold text-sm cursor-text select-text text-black relative group"
                                          >
                                            {videoMetric.data.formatted.cost}
                                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                              Расход FB: {videoMetric.data.raw.cost_from_sources?.toFixed(2)}$
                                            </span>
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
                                  <span 
                                    className="font-bold text-sm cursor-text select-text text-black relative group"
                                  >
                                    {currentDisplayData.metrics.data.formatted.clicks}
                                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                      Клики FB: {currentDisplayData.metrics.data.raw.clicks_on_link}
                                    </span>
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
                                          <span 
                                            className="font-bold text-sm cursor-text select-text text-black relative group"
                                          >
                                            {videoMetric.data.formatted.clicks}
                                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                              Клики FB: {videoMetric.data.raw.clicks_on_link}
                                            </span>
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
                                          <span className="font-bold text-sm cursor-text select-text text-black-700">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black-700">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black-700">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black-700">
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
                                    {currentDisplayData.metrics.data.formatted.avg_duration || '0.0с'}
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
                                          <span className="font-bold text-sm cursor-text select-text text-black-700">
                                            {videoMetric.data.formatted.avg_duration || '0.0с'}
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
                                          <span className="font-bold text-sm cursor-text select-text text-black-700">
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
                            
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {creative.trello_link ? (
                                <div className="space-y-2">
                                  <div>
                                    
                                     <a href={creative.trello_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-3 py-1 border border-blue-300 text-xs font-medium rounded-md shadow-sm text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      Карточка
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400 cursor-text select-text">—</span>
                              )}
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 cursor-text select-text">
                                {getTrelloListName(creative.id)}
                              </span>
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {(creative.buyer_id || creative.buyer) ? (
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    {getBuyerAvatar(creative.buyer_id) ? (
                                      <img
                                        src={getBuyerAvatar(creative.buyer_id)}
                                        alt="Buyer"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.nextSibling.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div className={`w-full h-full flex items-center justify-center ${getBuyerAvatar(creative.buyer_id) ? 'hidden' : ''}`}>
                                      <User className="h-3 w-3 text-gray-400" />
                                    </div>
                                  </div>
                                  <span className="text-sm text-gray-900 cursor-text select-text">
                                    {creative.buyer_id ? getBuyerName(creative.buyer_id) : creative.buyer}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 cursor-text select-text">—</span>
                              )}
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              {(creative.searcher_id || creative.searcher) ? (
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    {getSearcherAvatar(creative.searcher_id) ? (
                                      <img
                                        src={getSearcherAvatar(creative.searcher_id)}
                                        alt="Searcher"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.nextSibling.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div className={`w-full h-full flex items-center justify-center ${getSearcherAvatar(creative.searcher_id) ? 'hidden' : ''}`}>
                                      <Search className="h-3 w-3 text-gray-400" />
                                    </div>
                                  </div>
                                  <span className="text-sm text-gray-900 cursor-text select-text">
                                    {creative.searcher_id ? getSearcherName(creative.searcher_id) : creative.searcher}
                                  </span>
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

      {/* Create Modal - Hidden for Search Manager */}
      {false && showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-5 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white my-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                Создать новый креатив
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCreative({
                    article: '',
                    links: [''],
                    work_types: [],
                    link_titles: [],
                    comment: '',
                    is_poland: false,
                    trello_link: '',
                    buyer_id: null,
                    searcher_id: null
                  });
                  setExtractingTitles(false);
                  setShowBuyerDropdown(false);
                  setShowSearcherDropdown(false);
                  clearMessages();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.article ? 'text-red-600' : 'text-gray-700'}`}>
                  Артикул *
                </label>
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={newCreative.article}
                      onChange={(e) => {
                        setNewCreative({ ...newCreative, article: e.target.value });
                        clearFieldError('article');
                      }}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                        fieldErrors.article 
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder-red-400' 
                          : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                      }`}
                      placeholder="Введите артикул"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setNewCreative({ ...newCreative, is_poland: !newCreative.is_poland });
                    }}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 border ${
                      newCreative.is_poland
                        ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                    }`}
                    title={newCreative.is_poland ? 'Переключить на Украину' : 'Переключить на Польшу'}
                  >
                    {newCreative.is_poland ? <PolandFlag /> : <UkraineFlag />}
                    <span className="ml-2">
                      {newCreative.is_poland ? 'Poland' : 'Ukraine'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.links ? 'text-red-600' : 'text-gray-700'}`}>
                  Google Drive ссылки *
                </label>
                <div className="space-y-2">
                  {newCreative.links.map((link, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => updateLink(index, e.target.value)}
                        className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm ${
                          fieldErrors.links 
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder-red-400' 
                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                        placeholder="https://drive.google.com/file/d/..."
                      />
                      {newCreative.links.length > 1 && (
                        <button
                          onClick={() => removeLinkField(index)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addLinkField}
                  className="mt-2 inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить ссылку
                </button>
                <p className="mt-2 text-xs text-blue-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Используйте только ссылки на Google Drive файлы
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.trello_link ? 'text-red-600' : 'text-gray-700'}`}>
                  Карточка Trello *
                </label>
                <input
                  type="url"
                  value={newCreative.trello_link}
                  onChange={(e) => {
                    setNewCreative({ ...newCreative, trello_link: e.target.value });
                    clearFieldError('trello_link');
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    fieldErrors.trello_link 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder-red-400' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                  }`}
                  placeholder="https://trello.com/c/..."
                />
                <p className="mt-1 text-xs text-blue-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Укажите ссылку на карточку Trello
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buyer
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (!loadingUsers) {
                          setShowBuyerDropdown(!showBuyerDropdown);
                          setShowSearcherDropdown(false);
                        }
                      }}
                      disabled={loadingUsers}
                      className="buyer-trigger w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50"
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        {getSelectedBuyer() ? (
                          <>
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {getSelectedBuyer().avatar_url ? (
                                <img
                                  src={getSelectedBuyer().avatar_url}
                                  alt="Buyer"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${getSelectedBuyer().avatar_url ? 'hidden' : ''}`}>
                                <User className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-gray-900">{getSelectedBuyer().name}</span>
                          </>
                        ) : (
                          <span className="text-gray-500">Выберите байера</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        {getSelectedBuyer() && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewCreative({ ...newCreative, buyer_id: null });
                            }}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
                            title="Очистить выбор"
                          >
                            <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                          </button>
                        )}
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </div>
                    </button>
                    
                    {showBuyerDropdown && !loadingUsers && (
                      <div className="buyer-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {buyers.map((buyer) => (
                          <button
                            key={buyer.id}
                            type="button"
                            onClick={() => {
                              setNewCreative({ ...newCreative, buyer_id: buyer.id });
                              setShowBuyerDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {buyer.avatar_url ? (
                                <img
                                  src={buyer.avatar_url}
                                  alt="Buyer"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${buyer.avatar_url ? 'hidden' : ''}`}>
                                <User className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-gray-900">{buyer.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {loadingUsers && (
                    <p className="mt-1 text-xs text-gray-500">Загрузка байеров...</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Searcher
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (!loadingUsers) {
                          setShowSearcherDropdown(!showSearcherDropdown);
                          setShowBuyerDropdown(false);
                        }
                      }}
                      disabled={loadingUsers}
                      className="searcher-trigger w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50"
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        {getSelectedSearcher() ? (
                          <>
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {getSelectedSearcher().avatar_url ? (
                                <img
                                  src={getSelectedSearcher().avatar_url}
                                  alt="Searcher"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${getSelectedSearcher().avatar_url ? 'hidden' : ''}`}>
                                <Search className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-gray-900">{getSelectedSearcher().name}</span>
                          </>
                        ) : (
                          <span className="text-gray-500">Выберите серчера</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        {getSelectedSearcher() && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewCreative({ ...newCreative, searcher_id: null });
                            }}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
                            title="Очистить выбор"
                          >
                            <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                          </button>
                        )}
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </div>
                    </button>
                    
                    {showSearcherDropdown && !loadingUsers && (
                      <div className="searcher-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {searchers.map((searcher) => (
                          <button
                            key={searcher.id}
                            type="button"
                            onClick={() => {
                              setNewCreative({ ...newCreative, searcher_id: searcher.id });
                              setShowSearcherDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {searcher.avatar_url ? (
                                <img
                                  src={searcher.avatar_url}
                                  alt="Searcher"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${searcher.avatar_url ? 'hidden' : ''}`}>
                                <Search className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-gray-900">{searcher.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {loadingUsers && (
                    <p className="mt-1 text-xs text-gray-500">Загрузка серчеров...</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Комментарий
                </label>
                <textarea
                  value={newCreative.comment}
                  onChange={(e) => {
                    setNewCreative({ ...newCreative, comment: e.target.value });
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Добавьте комментарий к креативу (необязательно)"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`block text-sm font-medium ${fieldErrors.work_types ? 'text-red-600' : 'text-gray-700'}`}>
                    Типы работ * ({newCreative.work_types.length} выбрано)
                  </label>
                  {newCreative.work_types.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500">COF:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getCOFBadgeColor(calculateCOF(newCreative.work_types))}`}>
                        {formatCOF(calculateCOF(newCreative.work_types))}
                      </span>
                    </div>
                  )}
                </div>
                <div className={`max-h-72 overflow-y-auto border rounded-md p-3 bg-gray-50 ${
                  fieldErrors.work_types ? 'border-red-300' : 'border-gray-300'
                }`}>
                  <div className="grid grid-cols-1 gap-2">
                    {workTypes.map((type) => (
                      <label key={type} className="flex items-center justify-between p-2 hover:bg-white rounded cursor-pointer">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={newCreative.work_types.includes(type)}
                            onChange={(e) => handleWorkTypeChange(type, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 select-none">{type}</span>
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          {formatCOF(workTypeValues[type] || 0)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {newCreative.work_types.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {newCreative.work_types.map((type, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                        {type} ({formatCOF(workTypeValues[type] || 0)})
                        <button
                          type="button"
                          onClick={() => handleWorkTypeChange(type, false)}
                          className="ml-1 text-gray-600 hover:text-gray-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCreative({
                    article: '',
                    links: [''],
                    work_types: [],
                    link_titles: [],
                    comment: '',
                    is_poland: false,
                    trello_link: '',
                    buyer_id: null,
                    searcher_id: null
                  });
                  setExtractingTitles(false);
                  setShowBuyerDropdown(false);
                  setShowSearcherDropdown(false);
                  clearMessages();
                }}
                disabled={creating}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Отменить
              </button>
              <button
                onClick={handleCreateCreative}
                disabled={creating}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {creating ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {authorizing ? 'Авторизация Google...' : 
                     extractingTitles ? 'Извлечение названий...' : 
                     'Создание...'}
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span>Создать креатив</span>
                    {newCreative.work_types.length > 0 && (
                      <span className="ml-2 text-xs opacity-75">
                        (COF: {formatCOF(calculateCOF(newCreative.work_types))})
                      </span>
                    )}
                    <div className="ml-2">
                      {newCreative.is_poland ? <PolandFlag /> : <UkraineFlag />}
                    </div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal - Hidden for Search Manager */}
      {false && showEditModal && editingCreative && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-5 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white my-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                Редактировать креатив
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCreative(null);
                  setEditCreative({
                    article: '',
                    links: [''],
                    work_types: [],
                    link_titles: [],
                    comment: '',
                    is_poland: false,
                    trello_link: '',
                    buyer_id: null,
                    searcher_id: null
                  });
                  setExtractingTitles(false);
                  setShowBuyerDropdown(false);
                  setShowSearcherDropdown(false);
                  clearMessages();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Артикул
                </label>
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editCreative.article}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setEditCreative({ ...editCreative, is_poland: !editCreative.is_poland });
                    }}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 border ${
                      editCreative.is_poland
                        ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                    }`}
                    title={editCreative.is_poland ? 'Переключить на Украину' : 'Переключить на Польшу'}
                  >
                    {editCreative.is_poland ? <PolandFlag /> : <UkraineFlag />}
                    <span className="ml-2">
                      {editCreative.is_poland ? 'Poland' : 'Ukraine'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.links ? 'text-red-600' : 'text-gray-700'}`}>
                  Google Drive ссылки *
                </label>
                <div className="space-y-2">
                  {editCreative.links.map((link, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => {
                          const newLinks = [...editCreative.links];
                          newLinks[index] = e.target.value;
                          setEditCreative({ ...editCreative, links: newLinks });
                          clearFieldError('links');
                        }}
                        className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm ${
                          fieldErrors.links 
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder-red-400' 
                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                        placeholder="https://drive.google.com/file/d/..."
                      />
                      {editCreative.links.length > 1 && (
                        <button
                          onClick={() => {
                            const newLinks = editCreative.links.filter((_, i) => i !== index);
                            setEditCreative({ ...editCreative, links: newLinks.length === 0 ? [''] : newLinks });
                          }}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setEditCreative({ ...editCreative, links: [...editCreative.links, ''] });
                  }}
                  className="mt-2 inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить ссылку
                </button>
                <p className="mt-2 text-xs text-blue-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Используйте только ссылки на Google Drive файлы
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.trello_link ? 'text-red-600' : 'text-gray-700'}`}>
                  Карточка Trello *
                </label>
                <input
                  type="url"
                  value={editCreative.trello_link}
                  onChange={(e) => {
                    setEditCreative({ ...editCreative, trello_link: e.target.value });
                    clearFieldError('trello_link');
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    fieldErrors.trello_link 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder-red-400' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                  }`}
                  placeholder="https://trello.com/c/..."
                />
                <p className="mt-1 text-xs text-blue-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Укажите ссылку на карточку Trello
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buyer
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (!loadingUsers) {
                          setShowBuyerDropdown(!showBuyerDropdown);
                          setShowSearcherDropdown(false);
                        }
                      }}
                      disabled={loadingUsers}
                      className="buyer-trigger w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50"
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        {editCreative.buyer_id ? (
                          <>
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {getBuyerAvatar(editCreative.buyer_id) ? (
                                <img
                                  src={getBuyerAvatar(editCreative.buyer_id)}
                                  alt="Buyer"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${getBuyerAvatar(editCreative.buyer_id) ? 'hidden' : ''}`}>
                                <User className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-gray-900">{getBuyerName(editCreative.buyer_id)}</span>
                          </>
                        ) : (
                          <span className="text-gray-500">Выберите байера</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        {editCreative.buyer_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditCreative({ ...editCreative, buyer_id: null });
                            }}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
                            title="Очистить выбор"
                          >
                            <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                          </button>
                        )}
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </div>
                    </button>
                    
                    {showBuyerDropdown && !loadingUsers && (
                      <div className="buyer-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {buyers.map((buyer) => (
                          <button
                            key={buyer.id}
                            type="button"
                            onClick={() => {
                              setEditCreative({ ...editCreative, buyer_id: buyer.id });
                              setShowBuyerDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {buyer.avatar_url ? (
                                <img
                                  src={buyer.avatar_url}
                                  alt="Buyer"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${buyer.avatar_url ? 'hidden' : ''}`}>
                                <User className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-gray-900">{buyer.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {loadingUsers && (
                    <p className="mt-1 text-xs text-gray-500">Загрузка байеров...</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Searcher
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (!loadingUsers) {
                          setShowSearcherDropdown(!showSearcherDropdown);
                          setShowBuyerDropdown(false);
                        }
                      }}
                      disabled={loadingUsers}
                      className="searcher-trigger w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50"
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        {editCreative.searcher_id ? (
                          <>
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {getSearcherAvatar(editCreative.searcher_id) ? (
                                <img
                                  src={getSearcherAvatar(editCreative.searcher_id)}
                                  alt="Searcher"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${getSearcherAvatar(editCreative.searcher_id) ? 'hidden' : ''}`}>
                                <Search className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-gray-900">{getSearcherName(editCreative.searcher_id)}</span>
                          </>
                        ) : (
                          <span className="text-gray-500">Выберите серчера</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        {editCreative.searcher_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditCreative({ ...editCreative, searcher_id: null });
                            }}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
                            title="Очистить выбор"
                          >
                            <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                          </button>
                        )}
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </div>
                    </button>
                    
                    {showSearcherDropdown && !loadingUsers && (
                      <div className="searcher-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {searchers.map((searcher) => (
                          <button
                            key={searcher.id}
                            type="button"
                            onClick={() => {
                              setEditCreative({ ...editCreative, searcher_id: searcher.id });
                              setShowSearcherDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {searcher.avatar_url ? (
                                <img
                                  src={searcher.avatar_url}
                                  alt="Searcher"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${searcher.avatar_url ? 'hidden' : ''}`}>
                                <Search className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-gray-900">{searcher.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {loadingUsers && (
                    <p className="mt-1 text-xs text-gray-500">Загрузка серчеров...</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Комментарий
                </label>
                <textarea
                  value={editCreative.comment}
                  onChange={(e) => {
                    setEditCreative({ ...editCreative, comment: e.target.value });
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Добавьте комментарий к креативу (необязательно)"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`block text-sm font-medium ${fieldErrors.work_types ? 'text-red-600' : 'text-gray-700'}`}>
                    Типы работ * ({editCreative.work_types.length} выбрано)
                  </label>
                  {editCreative.work_types.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500">COF:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getCOFBadgeColor(calculateCOF(editCreative.work_types))}`}>
                        {formatCOF(calculateCOF(editCreative.work_types))}
                      </span>
                    </div>
                  )}
                </div>
                <div className={`max-h-72 overflow-y-auto border rounded-md p-3 bg-gray-50 ${
                  fieldErrors.work_types ? 'border-red-300' : 'border-gray-300'
                }`}>
                  <div className="grid grid-cols-1 gap-2">
                    {workTypes.map((type) => (
                      <label key={type} className="flex items-center justify-between p-2 hover:bg-white rounded cursor-pointer">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={editCreative.work_types.includes(type)}
                            onChange={(e) => {
                              let updatedWorkTypes;
                              if (e.target.checked) {
                                updatedWorkTypes = [...editCreative.work_types, type];
                              } else {
                                updatedWorkTypes = editCreative.work_types.filter(t => t !== type);
                              }
                              setEditCreative({ ...editCreative, work_types: updatedWorkTypes });
                              clearFieldError('work_types');
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 select-none">{type}</span>
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          {formatCOF(workTypeValues[type] || 0)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {editCreative.work_types.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {editCreative.work_types.map((type, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                        {type} ({formatCOF(workTypeValues[type] || 0)})
                        <button
                          type="button"
                          onClick={() => {
                            const updatedWorkTypes = editCreative.work_types.filter(t => t !== type);
                            setEditCreative({ ...editCreative, work_types: updatedWorkTypes });
                          }}
                          className="ml-1 text-gray-600 hover:text-gray-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCreative(null);
                  setEditCreative({
                    article: '',
                    links: [''],
                    work_types: [],
                    link_titles: [],
                    comment: '',
                    is_poland: false,
                    trello_link: '',
                    buyer_id: null,
                    searcher_id: null
                  });
                  setExtractingTitles(false);
                  setShowBuyerDropdown(false);
                  setShowSearcherDropdown(false);
                  clearMessages();
                }}
                disabled={updating}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Отменить
              </button>
              <button
                onClick={handleUpdateCreative}
                disabled={updating}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {updating ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {authorizing ? 'Авторизация Google...' : 
                     extractingTitles ? 'Извлечение названий...' : 
                     'Обновление...'}
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span>Обновить креатив</span>
                    {editCreative.work_types.length > 0 && (
                      <span className="ml-2 text-xs opacity-75">
                        (COF: {formatCOF(calculateCOF(editCreative.work_types))})
                      </span>
                    )}
                    <div className="ml-2">
                      {editCreative.is_poland ? <PolandFlag /> : <UkraineFlag />}
                    </div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                          <label className="text-xs font-medium text-gray-700">Trello:</label>
                          <div className="mt-1">
                            {entry.trello_link ? (
                              
                                <a href={entry.trello_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 truncate block"
                              >
                                Открыть карточку
                              </a>
                            ) : (
                              <span className="text-sm text-gray-500">—</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700">Buyer:</label>
                          <div className="mt-1">
                            <span className="text-sm text-gray-900">{entry.buyer || '—'}</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700">Searcher:</label>
                          <div className="mt-1">
                            <span className="text-sm text-gray-900">{entry.searcher || '—'}</span>
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

export default CreativeSearch;
