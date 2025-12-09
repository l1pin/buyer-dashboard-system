// CreativePanel.js - ОБНОВЛЕННАЯ ВЕРСИЯ с переключением метрик в той же строке
// Замените содержимое src/components/CreativePanel.js

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase, creativeService, userService, creativeHistoryService, metricsAnalyticsService, trelloService } from '../supabaseClient';
import { 
  processLinksAndExtractTitles, 
  formatFileName, 
  ensureGoogleAuth,
  isGoogleDriveUrl
} from '../utils/googleDriveUtils';
import CreativeMetrics from './CreativeMetrics';
import MetricsLastUpdateBadge from './MetricsLastUpdateBadge';
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
  Pencil,
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

function CreativePanel({ user }) {
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
  const [syncingCreatives, setSyncingCreatives] = useState(new Set()); // Отслеживание синхронизирующихся креативов

  // Правки креативов
  const [creativeEdits, setCreativeEdits] = useState(new Map()); // Map<creative_id, Edit[]>
  const [expandedEdits, setExpandedEdits] = useState(new Set()); // Set<creative_id> - раскрытые правки

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
  const [buyers, setBuyers] = useState([]);
  const [searchers, setSearchers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [showSearcherDropdown, setShowSearcherDropdown] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Состояния для модального окна "Добавить правку"
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [searchingArticle, setSearchingArticle] = useState('');
  const [articleSuggestions, setArticleSuggestions] = useState([]);
  const [showArticleSuggestions, setShowArticleSuggestions] = useState(false);
  const [selectedCreativeForEdit, setSelectedCreativeForEdit] = useState(null);
  const [addEditCreative, setAddEditCreative] = useState({
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
  const [showAddEditBuyerDropdown, setShowAddEditBuyerDropdown] = useState(false);
  const [showAddEditSearcherDropdown, setShowAddEditSearcherDropdown] = useState(false);
  const [showAddEditWorkTypesDropdown, setShowAddEditWorkTypesDropdown] = useState(false);
  const [creatingEdit, setCreatingEdit] = useState(false);
  const [addEditLinkType, setAddEditLinkType] = useState('new'); // 'new' или 'reupload'

  // Состояние для подсветки креатива при переходе от правки
  const [highlightedCreativeId, setHighlightedCreativeId] = useState(null);
  const creativeRefs = useRef(new Map()); // Map<creative_id, HTMLTableRowElement>

  // Функция для скролла к креативу и его подсветки
  const scrollToCreative = useCallback((creativeId) => {
    const row = creativeRefs.current.get(creativeId);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedCreativeId(creativeId);
      // Убираем подсветку через 2 секунды
      setTimeout(() => setHighlightedCreativeId(null), 2000);
    }
  }, []);

  // Вычисляем диапазон дат для текущего фильтра
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);

    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - daysToMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
    thisWeekEnd.setHours(23, 59, 59);

    const last7DaysStart = new Date(now);
    last7DaysStart.setDate(now.getDate() - 6);
    last7DaysStart.setHours(0, 0, 0, 0);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    switch (selectedPeriod) {
      case 'today': return { start: todayStart, end: todayEnd };
      case 'yesterday': return { start: yesterdayStart, end: yesterdayEnd };
      case 'this_week': return { start: thisWeekStart, end: thisWeekEnd };
      case 'last_7_days': return { start: last7DaysStart, end: todayEnd };
      case 'this_month': return { start: thisMonthStart, end: thisMonthEnd };
      case 'last_month': return { start: lastMonthStart, end: lastMonthEnd };
      case 'custom':
        if (customDateFrom && customDateTo) {
          const customFrom = new Date(customDateFrom);
          customFrom.setHours(0, 0, 0, 0);
          const customTo = new Date(customDateTo);
          customTo.setHours(23, 59, 59);
          return { start: customFrom, end: customTo };
        }
        return null;
      default: return null; // 'all' - без фильтрации
    }
  }, [selectedPeriod, customDateFrom, customDateTo]);

  // Хелпер для проверки попадания даты в диапазон фильтра
  const isDateInFilterRange = useCallback((dateStr, range) => {
    if (!range) return true;
    const date = new Date(dateStr);
    return date >= range.start && date <= range.end;
  }, []);

  // Используем useMemo для оптимизации фильтрации креативов
  const filteredCreatives = useMemo(() => {
    let creativesToFilter = creatives;

    // Фильтрация по байеру
    if (selectedBuyer !== 'all') {
      creativesToFilter = creativesToFilter.filter(c => c.buyer_id === selectedBuyer);
    }

    // Фильтрация по серчеру
    if (selectedSearcher !== 'all') {
      creativesToFilter = creativesToFilter.filter(c => c.searcher_id === selectedSearcher);
    }

    // Фильтрация по дате: креатив показывается, если его дата ИЛИ дата правки попадает в диапазон
    if (dateRange) {
      creativesToFilter = creativesToFilter.filter(c => {
        // Проверяем дату создания креатива
        const creativeInRange = isDateInFilterRange(c.created_at, dateRange);

        // Проверяем даты правок этого креатива
        const edits = creativeEdits.get(c.id) || [];
        const hasEditInRange = edits.some(edit => isDateInFilterRange(edit.created_at, dateRange));

        return creativeInRange || hasEditInRange;
      });
    }

    return creativesToFilter;
  }, [creatives, selectedBuyer, selectedSearcher, dateRange, isDateInFilterRange, creativeEdits]);

  // Список отдельных правок для отображения
  const standaloneEdits = useMemo(() => {
    const result = [];

    filteredCreatives.forEach(creative => {
      const edits = creativeEdits.get(creative.id) || [];

      if (edits.length > 0) {
        // Если нет фильтра по дате - показываем все правки
        if (!dateRange) {
          edits.forEach(edit => {
            result.push({
              ...edit,
              parentCreative: creative,
              parentCreativeId: creative.id
            });
          });
        } else {
          // Если есть фильтр - показываем правки только когда И креатив И правка в диапазоне
          const creativeInRange = isDateInFilterRange(creative.created_at, dateRange);
          if (creativeInRange) {
            edits.forEach(edit => {
              if (isDateInFilterRange(edit.created_at, dateRange)) {
                result.push({
                  ...edit,
                  parentCreative: creative,
                  parentCreativeId: creative.id
                });
              }
            });
          }
        }
      }
    });

    // Сортируем по дате (новые сверху)
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [filteredCreatives, creativeEdits, dateRange, isDateInFilterRange]);

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
    loadFromCache,
    loadMetricsForSingleCreative,
    loadingCreativeIds, // 🆕 Set с ID креативов, для которых идет загрузка
    isAutoRefreshing // 🔄 Realtime: Флаг автообновления метрик
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


  // Загрузка статусов Trello карточек
  const loadTrelloStatuses = async () => {
    try {
      console.log('🟢 loadTrelloStatuses СТАРТ');
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
      } else {
        console.warn('⚠️ НЕТ креативов для загрузки статусов!');
      }
      
      console.log('🏁 loadTrelloStatuses ЗАВЕРШЕН');
    } catch (error) {
      console.error('❌ Ошибка загрузки Trello статусов:', error);
      console.error('Stack:', error.stack);
    }
  };

  // Синхронизация только креативов без статуса
  const syncMissingTrelloStatuses = async () => {
    try {
      console.log('🔄 Синхронизация креативов без статуса...');
      
      // Находим креативы с trello_link, но без статуса (статус "—")
      const creativesWithoutStatus = filteredCreatives.filter(creative => {
        const hasLink = !!creative.trello_link;
        const status = getTrelloListName(creative.id);
        const hasStatus = status && status !== '—';
        return hasLink && !hasStatus;
      });
      
      if (creativesWithoutStatus.length === 0) {
        console.log('✅ Все креативы уже имеют статусы');
        setSuccess('Все креативы уже синхронизированы');
        setTimeout(() => setSuccess(''), 3000);
        return;
      }
      
      console.log(`⚠️ Найдено ${creativesWithoutStatus.length} креативов без статуса`);
      console.log('📋 Артикулы:', creativesWithoutStatus.map(c => c.article).join(', '));
      
      // Помечаем креативы как синхронизирующиеся
      const syncingIds = new Set(creativesWithoutStatus.map(c => c.id));
      setSyncingCreatives(syncingIds);
      
      // Синхронизируем каждый креатив
      let successCount = 0;
      let errorCount = 0;
      
      for (const creative of creativesWithoutStatus) {
        try {
          console.log(`🔄 Синхронизация ${creative.article}...`);
          
          const result = await trelloService.syncSingleCreative(
            creative.id,
            creative.trello_link
          );
          
          if (result.success) {
            console.log(`✅ Статус синхронизирован: ${result.listName}`);
            
            // Обновляем статус в локальном состоянии сразу
            setTrelloStatuses(prev => {
              const updated = new Map(prev);
              updated.set(creative.id, {
                creative_id: creative.id,
                list_name: result.listName,
                list_id: result.listId,
                trello_card_id: result.cardId,
                last_updated: new Date().toISOString()
              });
              return updated;
            });
            
            successCount++;
          }
        } catch (error) {
          console.error(`❌ Ошибка синхронизации ${creative.article}:`, error.message);
          errorCount++;
        }
        
        // Задержка между запросами (300ms)
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Убираем спиннеры
      setSyncingCreatives(new Set());
      
      // Показываем результат
      if (successCount > 0 || errorCount > 0) {
        const message = `Синхронизация завершена: успешно ${successCount}, ошибок ${errorCount}`;
        console.log(`🎉 ${message}`);
        setSuccess(message);
        setTimeout(() => setSuccess(''), 5000);
      }
      
    } catch (error) {
      console.error('❌ Ошибка синхронизации:', error);
      setSyncingCreatives(new Set());
      setError(`Ошибка синхронизации: ${error.message}`);
      setTimeout(() => setError(''), 5000);
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
      console.log('📡 Загрузка креативов пользователя...');
      const data = await creativeService.getUserCreatives(user.id);

      // Фильтруем: показываем только оригиналы (не is_edit)
      const originalsOnly = data.filter(c => !c.is_edit);
      setCreatives(originalsOnly);
      console.log(`✅ Загружено ${originalsOnly.length} креативов (из ${data.length} всего)`);

      // Батчевая проверка истории для всех креативов одним запросом
      const creativeIds = originalsOnly.map(c => c.id);
      const creativesWithHistorySet = await creativeHistoryService.checkHistoryBatch(creativeIds);
      setCreativesWithHistory(creativesWithHistorySet);

      // Загружаем правки для креативов с has_edits = true
      const creativesWithEdits = originalsOnly.filter(c => c.has_edits).map(c => c.id);
      if (creativesWithEdits.length > 0) {
        const editsMap = await creativeService.getEditsForCreatives(creativesWithEdits);
        setCreativeEdits(new Map(Object.entries(editsMap)));
        console.log(`✅ Загружено правок для ${Object.keys(editsMap).length} креативов`);
      }

      // Возвращаем загруженные креативы для дальнейшего использования
      return originalsOnly;
    } catch (error) {
      console.error('❌ Ошибка загрузки креативов:', error);
      setError('Ошибка загрузки креативов: ' + error.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      console.log('👥 Загрузка пользователей...');
      
      const [buyersData, searchersData] = await Promise.all([
        userService.getUsersByRole('buyer'),
        userService.getUsersByRole('search_manager')
      ]);
      
      setBuyers(buyersData);
      setSearchers(searchersData);
      console.log(`✅ Загружено ${buyersData.length} байеров и ${searchersData.length} серчеров`);
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

      const newCreativeData = await creativeService.createCreative({
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

      console.log('✅ Креатив создан в БД:', newCreativeData);

      // 🆕 СИНХРОНИЗАЦИЯ TRELLO ЧЕРЕЗ NETLIFY FUNCTION
      if (newCreativeData.trello_link) {
        console.log('🔄 Синхронизация Trello статуса через Netlify Function...');
        try {
          const syncResponse = await fetch('/.netlify/functions/trello-sync-single', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              creativeId: newCreativeData.id,
              trelloLink: newCreativeData.trello_link
            })
          });

          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            console.log('✅ Trello статус синхронизирован:', syncResult.listName);
            
            // Добавляем статус в локальное состояние сразу
            setTrelloStatuses(prev => {
              const updated = new Map(prev);
              updated.set(newCreativeData.id, {
                creative_id: newCreativeData.id,
                list_name: syncResult.listName,
                list_id: syncResult.listId,
                trello_card_id: syncResult.cardId,
                last_updated: new Date().toISOString()
              });
              return updated;
            });
          } else {
            const errorText = await syncResponse.text();
            console.error('❌ Ошибка синхронизации Trello:', errorText);
          }
        } catch (syncError) {
          console.error('❌ Ошибка вызова Netlify Function:', syncError);
        }
      }

      // 🎯 ДОБАВЛЯЕМ НОВЫЙ КРЕАТИВ В СУЩЕСТВУЮЩИЙ МАССИВ (БЕЗ ПЕРЕЗАГРУЗКИ ВСЕХ)
      console.log('➕ Добавляем новый креатив в таблицу БЕЗ перезагрузки всех креативов');
      setCreatives(prevCreatives => [newCreativeData, ...prevCreatives]);

      // Очищаем форму и закрываем модалку
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

      // 🔥 ЗАГРУЗКА МЕТРИК И ЗОН ТОЛЬКО ДЛЯ НОВОГО КРЕАТИВА
      console.log('🚀 Загружаем метрики и зоны ТОЛЬКО для нового креатива...');
      setSuccess(`Креатив создан! Загружаем метрики и зональные данные...`);
      
      // Загружаем метрики только для этого креатива
      await loadMetricsForSingleCreative(newCreativeData);
      console.log('✅ Метрики загружены только для нового креатива');
      
      // Загружаем зональные данные только для этого креатива
      await refreshZoneData();
      console.log('✅ Зональные данные обновлены');
      
      const successCount = extractedTitles.length;
      const totalCount = titles.length;
      const cof = calculateCOF(newCreative.work_types);
      const country = newCreative.is_poland ? 'PL' : 'UA';
      setSuccess(`Креатив создан! COF: ${formatCOF(cof)} | Страна: ${country} | Названий извлечено: ${successCount}/${totalCount} | Метрики загружены`);
      
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

  // ==================== ФУНКЦИИ ДЛЯ "ДОБАВИТЬ ПРАВКУ" ====================

  // Поиск креативов по артикулу
  const searchCreativesByArticle = async (searchText) => {
    if (!searchText || searchText.length < 2) {
      setArticleSuggestions([]);
      setShowArticleSuggestions(false);
      return;
    }

    try {
      // Ищем среди существующих креативов (только оригиналы, не правки, только свои)
      const searchLower = searchText.toLowerCase();
      const filtered = creatives
        .filter(c => !c.is_edit && c.user_id === user.id && c.article.toLowerCase().includes(searchLower))
        .slice(0, 10); // Ограничиваем 10 результатами

      setArticleSuggestions(filtered);
      setShowArticleSuggestions(true);
    } catch (error) {
      console.error('Ошибка поиска креативов:', error);
      setArticleSuggestions([]);
      setShowArticleSuggestions(false);
    }
  };

  // Выбор креатива для правки
  const selectCreativeForEdit = (creative) => {
    console.log('📝 Выбран креатив для правки:', creative);
    setSelectedCreativeForEdit(creative);
    setSearchingArticle(creative.article);

    // Автозаполнение полей из родительского креатива
    setAddEditCreative({
      article: creative.article,
      links: [''], // Новые ссылки для правки
      work_types: [], // Пользователь должен выбрать дополнительные типы работ
      link_titles: [],
      comment: '',
      is_poland: creative.is_poland,
      trello_link: creative.trello_link || '',
      buyer_id: creative.buyer_id,
      searcher_id: creative.searcher_id
    });

    setShowArticleSuggestions(false);
  };

  // Добавление поля ссылки в модальном окне правки
  const addEditLinkField = () => {
    setAddEditCreative({
      ...addEditCreative,
      links: [...addEditCreative.links, '']
    });
  };

  // Удаление поля ссылки в модальном окне правки
  const removeEditLinkField = (index) => {
    const newLinks = addEditCreative.links.filter((_, i) => i !== index);
    setAddEditCreative({
      ...addEditCreative,
      links: newLinks.length === 0 ? [''] : newLinks
    });
  };

  // Обновление ссылки в модальном окне правки
  const updateEditLink = (index, value) => {
    const newLinks = [...addEditCreative.links];
    newLinks[index] = value;
    setAddEditCreative({
      ...addEditCreative,
      links: newLinks
    });
    clearFieldError('links');
  };

  // Обработка изменения типа работ для правки
  const handleAddEditWorkTypeChange = (workType, isChecked) => {
    let updatedWorkTypes;
    if (isChecked) {
      updatedWorkTypes = [...addEditCreative.work_types, workType];
    } else {
      updatedWorkTypes = addEditCreative.work_types.filter(type => type !== workType);
    }

    setAddEditCreative({
      ...addEditCreative,
      work_types: updatedWorkTypes
    });
    clearFieldError('work_types');
  };

  // Валидация полей для правки
  const validateAddEditFields = () => {
    const errors = {};
    const errorMessages = [];

    if (!selectedCreativeForEdit) {
      errors.article = true;
      errorMessages.push('Необходимо выбрать креатив из списка');
    }

    // Проверяем ссылки только если выбраны "Новые ссылки"
    if (addEditLinkType === 'new') {
      const nonEmptyLinks = addEditCreative.links.filter(link => link.trim());
      if (nonEmptyLinks.length === 0) {
        errors.links = true;
        errorMessages.push('Добавьте хотя бы одну Google Drive ссылку');
      }

      // Проверяем валидность ссылок Google Drive
      const invalidLinks = nonEmptyLinks.filter(link => !isGoogleDriveUrl(link));
      if (invalidLinks.length > 0) {
        errors.links = true;
        errorMessages.push('Все ссылки должны быть действительными Google Drive ссылками');
      }
    }

    // Проверяем типы работ (обязательно для правки)
    if (addEditCreative.work_types.length === 0) {
      errors.work_types = true;
      errorMessages.push('Необходимо выбрать хотя бы один дополнительный тип работы');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(errorMessages.join('. '));
      return false;
    }

    return true;
  };

  // Создание правки креатива
  const handleCreateAddEdit = async () => {
    if (!validateAddEditFields()) {
      return;
    }

    try {
      setCreatingEdit(true);
      setError('');
      setSuccess('');

      let finalLinks = [];
      let finalTitles = [];

      // Если выбраны "Новые ссылки" - обрабатываем ссылки
      if (addEditLinkType === 'new') {
        const { validLinks } = validateGoogleDriveLinks(addEditCreative.links);

        setAuthorizing(true);
        const authSuccess = await ensureGoogleAuth();
        setAuthorizing(false);

        if (!authSuccess) {
          setError('Необходима авторизация Google для извлечения названий файлов');
          setCreatingEdit(false);
          return;
        }

        setExtractingTitles(true);
        const { links, titles } = await processLinksAndExtractTitles(validLinks, true);
        setExtractingTitles(false);

        const extractedTitles = titles.filter(title => !title.startsWith('Видео '));
        if (extractedTitles.length === 0) {
          setError('Не удалось извлечь названия из ваших ссылок. Проверьте что ссылки ведут на доступные файлы Google Drive.');
          setCreatingEdit(false);
          return;
        }

        finalLinks = links;
        finalTitles = titles;
      }

      // COF считаем только из ДОПОЛНИТЕЛЬНЫХ типов работ
      const cofRating = calculateCOF(addEditCreative.work_types);
      const editDate = new Date().toISOString();

      // 1. Создаем запись в creative_edits
      const editData = await creativeService.createCreativeEdit({
        creative_id: selectedCreativeForEdit.id,
        user_id: user.id,
        editor_name: user.name,
        work_types: addEditCreative.work_types,
        links: finalLinks,
        link_titles: finalTitles,
        comment: addEditCreative.comment.trim() || null,
        cof_rating: cofRating
      });

      console.log('✅ Правка создана в creative_edits:', editData);

      // 2. Обновляем родительский креатив
      let updatedParent;
      if (finalLinks.length > 0) {
        // Если есть новые ссылки - добавляем их к родителю
        updatedParent = await creativeService.updateCreativeWithEdit(
          selectedCreativeForEdit.id,
          finalLinks,
          finalTitles,
          editData.id,
          editDate
        );
      } else {
        // Просто помечаем что есть правки
        updatedParent = await creativeService.markCreativeHasEdits(selectedCreativeForEdit.id);
      }

      console.log('✅ Родительский креатив обновлен:', updatedParent);

      // 3. Обновляем локальное состояние - обновляем родительский креатив
      setCreatives(prevCreatives =>
        prevCreatives.map(c =>
          c.id === selectedCreativeForEdit.id ? { ...c, ...updatedParent } : c
        )
      );

      // 4. Добавляем правку в кэш правок
      setCreativeEdits(prev => {
        const updated = new Map(prev);
        const existingEdits = updated.get(selectedCreativeForEdit.id) || [];
        updated.set(selectedCreativeForEdit.id, [editData, ...existingEdits]);
        return updated;
      });

      // Сбрасываем форму
      setAddEditCreative({
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
      setSelectedCreativeForEdit(null);
      setSearchingArticle('');
      setShowAddEditModal(false);

      const country = selectedCreativeForEdit.is_poland ? 'PL' : 'UA';
      const videoCount = finalTitles.length > 0 ? finalTitles.length : '—';
      setSuccess(`Правка добавлена! COF: ${formatCOF(cofRating)} | Страна: ${country} | Новых видео: ${videoCount}`);

    } catch (error) {
      setError('Ошибка создания правки: ' + error.message);
      setExtractingTitles(false);
      setAuthorizing(false);
    } finally {
      setCreatingEdit(false);
    }
  };

  // Сброс модального окна правки
  const resetAddEditModal = () => {
    setShowAddEditModal(false);
    setSelectedCreativeForEdit(null);
    setSearchingArticle('');
    setArticleSuggestions([]);
    setShowArticleSuggestions(false);
    setAddEditCreative({
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
    setShowAddEditBuyerDropdown(false);
    setShowAddEditSearcherDropdown(false);
    setShowAddEditWorkTypesDropdown(false);
    setAddEditLinkType('new');
    clearMessages();
  };

  // ==================== КОНЕЦ ФУНКЦИЙ ДЛЯ "ДОБАВИТЬ ПРАВКУ" ====================

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
      // Создаём Date объект из строки (браузер корректно распарсит UTC)
      const date = new Date(dateString);

      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }

      // Используем Intl.DateTimeFormat для конвертации в киевское время
      const formatter = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Kyiv',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(date);
      const getValue = (type) => parts.find(p => p.type === type)?.value;

      const day = getValue('day');
      const month = getValue('month');
      const year = getValue('year');
      const hour = getValue('hour');
      const minute = getValue('minute');

      const dateStr = `${day}.${month}.${year}`;
      const timeStr = `${hour}:${minute}`;

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
              <h1 className="text-2xl font-semibold text-gray-900">Креативы</h1>
              <p className="text-sm text-gray-600 mt-1">
                {user?.name}
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
              Обновить метрики
            </button>

            {/* Кнопка "Добавить правку" - желтая с иконкой карандаша */}
            <button
              onClick={() => setShowAddEditModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-900 bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors duration-200"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Добавить правку
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать креатив
            </button>
          </div>
        </div>
      </div>

      {/* Информационная панель с временем обновления */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MetricsLastUpdateBadge />
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

            <div className="relative">
              <button
                onClick={() => setShowSearcherDropdown(!showSearcherDropdown)}
                className="searcher-trigger inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <div className="flex items-center space-x-2">
                  {selectedSearcher === 'all' ? (
                    <Search className="h-4 w-4 text-gray-500" />
                  ) : (
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                      {getSearcherAvatar(selectedSearcher) ? (
                        <img
                          src={getSearcherAvatar(selectedSearcher)}
                          alt="Searcher"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center ${getSearcherAvatar(selectedSearcher) ? 'hidden' : ''}`}>
                        <Search className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>
                  )}
                  <span>{selectedSearcher === 'all' ? 'Все серчеры' : getSearcherName(selectedSearcher)}</span>
                </div>
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showSearcherDropdown && (
                <div className="searcher-dropdown absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSelectedSearcher('all');
                        setShowSearcherDropdown(false);
                      }}
                      className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                        selectedSearcher === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <Search className="h-5 w-5 mr-3 text-gray-500" />
                      Все серчеры
                    </button>
                    
                    {searchers.map(searcher => (
                      <button
                        key={searcher.id}
                        onClick={() => {
                          setSelectedSearcher(searcher.id);
                          setShowSearcherDropdown(false);
                        }}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                          selectedSearcher === searcher.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0 mr-3">
                          {searcher.avatar_url ? (
                            <img
                              src={searcher.avatar_url}
                              alt={searcher.name}
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
                        <span className="truncate">{searcher.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>


        </div>

      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-auto">

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
              Создайте свой первый креатив с Google Drive ссылками
            </p>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => setShowAddEditModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-900 bg-yellow-400 hover:bg-yellow-500"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Добавить правку
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Создать креатив
              </button>
            </div>
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
                      <th className="px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50" style={{ width: '90px' }}>
                        Правки
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <svg className="h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <path stroke="none" d="M0 0h24v24H0z"/>
                          <path d="M4 20h4l10.5 -10.5a1.5 1.5 0 0 0 -4 -4l-10.5 10.5v4" />
                          <line x1="13.5" y1="6.5" x2="17.5" y2="10.5" />
                        </svg>
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Дата
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Артикул
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
                    {/* Отдельные строки правок, попавших в фильтр дат */}
                    {standaloneEdits.map((edit) => {
                      const editDate = new Date(edit.created_at);
                      const formattedEditDate = editDate.toLocaleDateString('uk-UA', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      });
                      const formattedEditTime = editDate.toLocaleTimeString('uk-UA', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      const edits = creativeEdits.get(edit.parentCreativeId) || [];
                      const editIndex = edits.findIndex(e => e.id === edit.id);
                      const editNumber = edits.length - editIndex;

                      return (
                        <tr
                          key={`standalone-edit-${edit.id}`}
                          className="hover:bg-yellow-100/50 transition-colors"
                          style={{ backgroundColor: '#fffffe66' }}
                        >
                          {/* Желтый бейдж ПРАВКА для правки */}
                          <td className="px-1 py-3 whitespace-nowrap text-sm text-center" style={{ backgroundColor: '#fffffe66' }}>
                            <div className="flex flex-col items-center justify-center">
                              <div
                                className="inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-sm border border-yellow-300"
                                title="Правка"
                              >
                                <span className="tracking-wide">ПРАВКА</span>
                              </div>
                            </div>
                          </td>

                          {/* Пустая ячейка для редактирования */}
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>

                          {/* Дата правки */}
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-center" style={{ backgroundColor: '#fffffe66', color: '#a16207' }}>
                            <div className="cursor-text select-text">
                              <div className="font-medium">{formattedEditDate}</div>
                              <div className="text-xs" style={{ color: '#a16207' }}>{formattedEditTime}</div>
                            </div>
                          </td>

                          {/* Артикул + Правка #N */}
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}>
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                {edit.comment && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedComment({
                                        article: `Правка #${editNumber}`,
                                        comment: edit.comment,
                                        createdAt: edit.created_at,
                                        editorName: edit.editor_name
                                      });
                                      setShowCommentModal(true);
                                    }}
                                    className="hover:opacity-70 transition-opacity p-1 rounded-full"
                                    style={{ color: '#a16207' }}
                                    title={edit.comment}
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <div className="w-6 h-6 flex-shrink-0"></div>
                              <span style={{ color: '#a16207' }} className="text-sm font-medium">
                                {edit.parentCreative?.article} → Правка #{editNumber}
                              </span>
                            </div>
                          </td>

                          {/* Видео из правки */}
                          <td className="px-3 py-3 text-sm" style={{ backgroundColor: '#fffffe66', color: '#a16207' }}>
                            <div className="space-y-1">
                              {edit.link_titles && edit.link_titles.length > 0 ? (
                                edit.link_titles.map((title, idx) => (
                                  <div key={idx} className="flex items-center min-h-[24px]">
                                    <span
                                      className="block text-left flex-1 mr-2 cursor-text select-text truncate whitespace-nowrap overflow-hidden"
                                      style={{ color: '#a16207' }}
                                      title={title}
                                    >
                                      {title}
                                    </span>
                                    {edit.links && edit.links[idx] && (
                                      <a
                                        href={edit.links[idx]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 hover:opacity-70"
                                        style={{ color: '#a16207' }}
                                        title="Открыть в Google Drive"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <span style={{ color: '#a16207' }}>Перезалив</span>
                              )}
                            </div>
                          </td>

                          {/* Зона - кнопка Показать */}
                          <td className="px-3 py-3 text-center" style={{ backgroundColor: '#fffffe66' }}>
                            <button
                              onClick={() => scrollToCreative(edit.parentCreativeId)}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-gray-900 bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors duration-200"
                              title="Показать материнский креатив"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Показать
                            </button>
                          </td>
                          {/* Пустые ячейки для метрик */}
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>

                          {/* COF */}
                          <td className="px-3 py-3 whitespace-nowrap text-center" style={{ backgroundColor: '#fffffe66' }}>
                            {edit.work_types && edit.work_types.length > 0 ? (
                              <div className="space-y-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getCOFBadgeColor(edit.cof_rating || 0)} cursor-text select-text`}>
                                  <span className="text-xs font-bold mr-1">+COF</span>
                                  {formatCOF(edit.cof_rating || 0)}
                                </span>
                                <div className="text-xs mt-1" style={{ color: '#a16207' }}>
                                  {edit.work_types.join(', ')}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#a16207' }}>—</span>
                            )}
                          </td>

                          {/* Trello, Status, Buyer, Searcher */}
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                        </tr>
                      );
                    })}

                    {/* Креативы */}
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
                        
                        const hasEdits = creative.has_edits || creativeEdits.has(creative.id);
                        const editsCount = creativeEdits.get(creative.id)?.length || 0;
                        const isEditsExpanded = expandedEdits.has(creative.id);

                        return (
                          <React.Fragment key={creative.id}>
                          <tr
                            ref={(el) => {
                              if (el) creativeRefs.current.set(creative.id, el);
                            }}
                            className={`transition-all duration-500 ease-in-out hover:bg-gray-50 ${
                              highlightedCreativeId === creative.id
                                ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-[1.002]'
                                : ''
                            }`}
                          >
                            {/* Колонка "Тип" с бейджем E и стрелкой - ПЕРВАЯ */}
                            <td className="px-1 py-4 whitespace-nowrap text-sm text-center">
                              <div className="flex flex-col items-center justify-center">
                                {hasEdits && (() => {
                                  // Get the last edit date
                                  const edits = creativeEdits.get(creative.id) || [];
                                  const lastEdit = edits.length > 0 ? edits[0] : null; // First is newest after sorting
                                  const lastEditDate = lastEdit?.created_at
                                    ? new Date(lastEdit.created_at).toLocaleDateString('uk-UA', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: '2-digit'
                                      })
                                    : null;

                                  return (
                                    <>
                                      {/* РЕД Badge - blue-violet gradient for parent creative */}
                                      <div
                                        title={`${editsCount} правок`}
                                        className="inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-sm border border-blue-400 flex-shrink-0 hover:shadow-lg transition-shadow duration-200"
                                      >
                                        <span className="tracking-wide">РЕД</span>
                                      </div>

                                      {/* Last edit date */}
                                      {lastEditDate && (
                                        <span className="text-sm text-black font-semibold mt-1.5">{lastEditDate}</span>
                                      )}

                                      {/* Arrow + counter */}
                                      <button
                                        onClick={() => {
                                          setExpandedEdits(prev => {
                                            const updated = new Set(prev);
                                            if (updated.has(creative.id)) {
                                              updated.delete(creative.id);
                                            } else {
                                              updated.add(creative.id);
                                            }
                                            return updated;
                                          });
                                        }}
                                        className="flex items-center text-black hover:text-gray-700 transition-colors mt-1"
                                        title={isEditsExpanded ? 'Скрыть правки' : 'Показать правки'}
                                      >
                                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isEditsExpanded ? 'rotate-180' : ''}`} />
                                        <span className="text-xs ml-0.5 font-bold">{editsCount}</span>
                                      </button>
                                    </>
                                  );
                                })()}
                              </div>
                            </td>

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                              <button
                                onClick={() => handleEditCreative(creative)}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
                                title="Редактировать креатив"
                              >
                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                  <path stroke="none" d="M0 0h24v24H0z"/>
                                  <path d="M4 20h4l10.5 -10.5a1.5 1.5 0 0 0 -4 -4l-10.5 10.5v4" />
                                  <line x1="13.5" y1="6.5" x2="17.5" y2="10.5" />
                                </svg>
                              </button>
                            </td>
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

                            <td className="px-3 py-4 text-sm text-gray-900">
                              <div className="space-y-1">
                                {creative.link_titles && creative.link_titles.length > 0 ? (
                                  creative.link_titles.map((title, index) => {
                                    // Check if this video was added from an edit by finding matching entry in link_metadata
                                    // link_metadata is an array of objects with link_index or title fields
                                    const linkMeta = Array.isArray(creative.link_metadata)
                                      ? creative.link_metadata.find(meta => meta && (meta.link_index === index || meta.title === title))
                                      : null;
                                    const isFromEdit = linkMeta && linkMeta.edit_id;

                                    return (
                                      <div key={index} className="flex items-center min-h-[24px]">
                                        <span
                                          className="block text-left flex-1 mr-2 cursor-text select-text truncate whitespace-nowrap overflow-hidden"
                                          style={isFromEdit ? { color: '#a16207' } : {}}
                                          title={title}
                                        >
                                          {title}
                                        </span>
                                        <a
                                          href={creative.links[index]}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex-shrink-0 hover:opacity-70"
                                          style={isFromEdit ? { color: '#a16207' } : { color: '#2563eb' }}
                                          title="Открыть в Google Drive"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </div>
                                    );
                                  })
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
                              {(metricsLoading || loadingCreativeIds.has(creative.id)) ? (
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
                              {(metricsLoading || loadingCreativeIds.has(creative.id)) ? (
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
                              {(metricsLoading || loadingCreativeIds.has(creative.id)) ? (
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
                              {(metricsLoading || loadingCreativeIds.has(creative.id)) ? (
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
                              {(metricsLoading || loadingCreativeIds.has(creative.id)) ? (
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
                              {(metricsLoading || loadingCreativeIds.has(creative.id)) ? (
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
                              {(metricsLoading || loadingCreativeIds.has(creative.id)) ? (
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
                              {(metricsLoading || loadingCreativeIds.has(creative.id)) ? (
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
                              {(metricsLoading || loadingCreativeIds.has(creative.id)) ? (
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
                              {(metricsLoading || loadingCreativeIds.has(creative.id)) ? (
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
                              {syncingCreatives.has(creative.id) ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                  <span className="ml-2 text-xs text-blue-600">Синхронизация...</span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 cursor-text select-text">
                                  {getTrelloListName(creative.id)}
                                </span>
                              )}
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

                          {/* Expandable Edit History Rows */}
                          {isEditsExpanded && (() => {
                            const edits = creativeEdits.get(creative.id) || [];
                            const totalEdits = edits.length;

                            return edits.map((edit, editIndex) => {
                              const editDate = new Date(edit.created_at);
                              const formattedEditDate = editDate.toLocaleDateString('uk-UA', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              });
                              const formattedEditTime = editDate.toLocaleTimeString('uk-UA', {
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                              // Numbering: newest first, so #totalEdits, #totalEdits-1, ..., #1
                              const editNumber = totalEdits - editIndex;

                              return (
                                <tr
                                  key={edit.id || editIndex}
                                  className="border-l-4 border-yellow-400 hover:bg-yellow-100/50 transition-colors"
                                  style={{ backgroundColor: '#fffffe66' }}
                                >
                                  {/* Tree structure indicator */}
                                  <td className="px-1 py-2 whitespace-nowrap text-sm" style={{ backgroundColor: '#fffffe66' }}>
                                    <div className="flex items-center justify-center pl-4">
                                      <span className="text-yellow-500 text-lg">└─</span>
                                    </div>
                                  </td>

                                  {/* Empty cell for edit button column */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>

                                  {/* Date of edit */}
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-center" style={{ backgroundColor: '#fffffe66', color: '#a16207' }}>
                                    <div className="cursor-text select-text">
                                      <div className="font-medium">{formattedEditDate}</div>
                                      <div className="text-xs" style={{ color: '#a16207' }}>{formattedEditTime}</div>
                                    </div>
                                  </td>

                                  {/* Edit number column (Article column) - comment icon first, then Правка #N */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}>
                                    <div className="flex items-center space-x-2">
                                      {/* Comment icon - same position as parent creative */}
                                      <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                        {edit.comment && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedComment({
                                                article: `Правка #${editNumber}`,
                                                comment: edit.comment,
                                                createdAt: edit.created_at,
                                                editorName: edit.editor_name
                                              });
                                              setShowCommentModal(true);
                                            }}
                                            className="hover:opacity-70 transition-opacity p-1 rounded-full"
                                            style={{ color: '#a16207' }}
                                            title={edit.comment}
                                          >
                                            <MessageCircle className="h-4 w-4" />
                                          </button>
                                        )}
                                      </div>

                                      {/* Empty space for history icon alignment */}
                                      <div className="w-6 h-6 flex-shrink-0"></div>

                                      {/* Edit number text */}
                                      <span style={{ color: '#a16207' }} className="text-sm font-medium">Правка #{editNumber}</span>
                                    </div>
                                  </td>

                                  {/* Video titles from this edit */}
                                  <td className="px-3 py-2 text-sm" style={{ backgroundColor: '#fffffe66', color: '#a16207' }}>
                                    <div className="space-y-1">
                                      {edit.link_titles && edit.link_titles.length > 0 ? (
                                        edit.link_titles.map((title, idx) => (
                                          <div key={idx} className="flex items-center min-h-[24px]">
                                            <span
                                              className="block text-left flex-1 mr-2 cursor-text select-text truncate whitespace-nowrap overflow-hidden"
                                              style={{ color: '#a16207' }}
                                              title={title}
                                            >
                                              {title}
                                            </span>
                                            {edit.links && edit.links[idx] && (
                                              <a
                                                href={edit.links[idx]}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-shrink-0 hover:opacity-70"
                                                style={{ color: '#a16207' }}
                                                title="Открыть в Google Drive"
                                              >
                                                <ExternalLink className="h-3 w-3" />
                                              </a>
                                            )}
                                          </div>
                                        ))
                                      ) : (
                                        <span style={{ color: '#a16207' }}>Перезалив</span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Empty cells for metrics columns - with light yellow bg */}
                                  {/* Зона */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* BarChart3 */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* Лиды */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* CPL */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* Расходы */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* Клики */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* CPC */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* CTR */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* CPM */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* Показы */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* Время */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* Дней */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* Зоны */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>

                                  {/* Work types from this edit with COF - in COF column */}
                                  <td className="px-3 py-2 whitespace-nowrap text-center" style={{ backgroundColor: '#fffffe66' }}>
                                    {edit.work_types && edit.work_types.length > 0 ? (
                                      <div className="space-y-1">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getCOFBadgeColor(edit.cof_rating || 0)} cursor-text select-text`}>
                                          <span className="text-xs font-bold mr-1">+COF</span>
                                          {formatCOF(edit.cof_rating || 0)}
                                        </span>
                                        <div className="text-xs text-yellow-700 mt-1">
                                          {edit.work_types.join(', ')}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-yellow-500">—</span>
                                    )}
                                  </td>

                                  {/* Trello and Status columns - with light yellow bg */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>

                                  {/* Buyer and Searcher columns - with yellow background */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                </tr>
                              );
                            });
                          })()}
                          </React.Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      </div>

      {/* Create Modal */}
      {showCreateModal && (
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

      {/* Edit Modal */}
      {showEditModal && editingCreative && (
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

      {/* Add Edit Modal - Модальное окно для добавления правки */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-5 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white my-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Pencil className="h-5 w-5 mr-2 text-yellow-600" />
                Добавить правку креатива
              </h3>
              <button
                onClick={resetAddEditModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Индикатор режима правки */}
            <div className="mb-4 bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-md text-sm flex items-center">
              <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              Создание правки для существующего креатива
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Артикул + Страна в одной строке */}
              <div className="grid grid-cols-3 gap-4">
                {/* Поиск артикула */}
                <div className="col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${fieldErrors.article ? 'text-red-600' : 'text-gray-700'}`}>
                    Артикул *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchingArticle}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearchingArticle(value);
                        clearFieldError('article');

                        // Сбрасываем выбор при изменении
                        if (selectedCreativeForEdit) {
                          setSelectedCreativeForEdit(null);
                          setAddEditCreative({
                            ...addEditCreative,
                            article: '',
                            buyer_id: null,
                            searcher_id: null,
                            trello_link: '',
                            is_poland: false,
                            work_types: []
                          });
                        }

                        // Запускаем поиск
                        if (value.length >= 2) {
                          searchCreativesByArticle(value);
                        } else {
                          setArticleSuggestions([]);
                          setShowArticleSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        if (searchingArticle.length >= 2) {
                          searchCreativesByArticle(searchingArticle);
                        }
                      }}
                      disabled={!!selectedCreativeForEdit}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                        selectedCreativeForEdit
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300'
                          : fieldErrors.article
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder-red-400'
                          : 'border-yellow-300 focus:ring-yellow-500 focus:border-transparent bg-white'
                      }`}
                      placeholder="Введите артикул для поиска"
                    />

                    {/* Dropdown с результатами поиска */}
                    {!selectedCreativeForEdit && showArticleSuggestions && articleSuggestions.length > 0 && (
                      <div className="article-suggestions absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {articleSuggestions.map((creative) => (
                          <button
                            key={creative.id}
                            type="button"
                            onClick={() => selectCreativeForEdit(creative)}
                            className="w-full px-3 py-2 text-left hover:bg-yellow-50 flex items-center justify-between border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 flex items-center">
                                {creative.is_poland ? <PolandFlag /> : <UkraineFlag />}
                                <span className="ml-2">{creative.article}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                <div>Дата: {new Date(creative.created_at).toLocaleDateString('ru-RU')}</div>
                                <div className="mt-0.5">Видео: {creative.link_titles?.join(', ') || '—'}</div>
                                {creative.trello_link && (
                                  <a
                                    href={creative.trello_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-600 hover:underline mt-0.5 inline-block"
                                  >
                                    Trello карточка
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 ml-2 text-right">
                              {creative.buyer || '—'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Показываем если нет результатов */}
                    {!selectedCreativeForEdit && showArticleSuggestions && articleSuggestions.length === 0 && searchingArticle.length >= 2 && (
                      <div className="article-suggestions absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
                        <div className="px-3 py-4 text-center text-sm text-gray-500">
                          Креативы не найдены
                        </div>
                      </div>
                    )}
                  </div>
                  {selectedCreativeForEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCreativeForEdit(null);
                        setSearchingArticle('');
                        setAddEditCreative({
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
                      }}
                      className="mt-1 text-xs text-red-600 hover:text-red-800"
                    >
                      Сбросить выбор
                    </button>
                  )}
                </div>

                {/* Страна */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Страна
                  </label>
                  <div className={`flex items-center px-3 py-2 border rounded-md h-[42px] ${
                    selectedCreativeForEdit
                      ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                      : 'border-gray-200 bg-gray-50 text-gray-400'
                  }`}>
                    {selectedCreativeForEdit ? (
                      <>
                        {selectedCreativeForEdit.is_poland ? <PolandFlag /> : <UkraineFlag />}
                        <span className="ml-2">{selectedCreativeForEdit.is_poland ? 'Poland' : 'Ukraine'}</span>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Слайдер выбора типа ссылок */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тип ссылок
                </label>
                <div className="flex items-center justify-between bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setAddEditLinkType('new')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      addEditLinkType === 'new'
                        ? 'bg-white text-yellow-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Новые ссылки
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddEditLinkType('reupload')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      addEditLinkType === 'reupload'
                        ? 'bg-white text-yellow-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Перезалил по старым
                  </button>
                </div>
              </div>

              {/* Google Drive ссылки - только если выбраны "Новые ссылки" */}
              {addEditLinkType === 'new' && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.links ? 'text-red-600' : 'text-gray-700'}`}>
                  Google Drive ссылки *
                </label>
                <div className="space-y-2">
                  {addEditCreative.links.map((link, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => updateEditLink(index, e.target.value)}
                        className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm ${
                          fieldErrors.links
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder-red-400'
                            : 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500 bg-white'
                        }`}
                        placeholder="https://drive.google.com/file/d/..."
                      />
                      {addEditCreative.links.length > 1 && (
                        <button
                          onClick={() => removeEditLinkField(index)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addEditLinkField}
                  className="mt-2 inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить ссылку
                </button>
                <p className="mt-2 text-xs text-blue-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Используйте только ссылки на Google Drive файлы
                </p>
              </div>
              )}

              {/* Автозаполненные поля (неактивные) - после ссылок */}
              {selectedCreativeForEdit && (
                <>
                  {/* Карточка Trello */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      Карточка Trello
                    </label>
                    <div className="flex items-center">
                      <input
                        type="url"
                        value={selectedCreativeForEdit.trello_link || '—'}
                        disabled
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                      />
                      {selectedCreativeForEdit.trello_link && (
                        <a
                          href={selectedCreativeForEdit.trello_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-md transition-colors"
                          title="Открыть карточку Trello"
                        >
                          <ExternalLink className="h-5 w-5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Buyer */}
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-2">
                        Buyer
                      </label>
                      <input
                        type="text"
                        value={selectedCreativeForEdit.buyer || getBuyerName(selectedCreativeForEdit.buyer_id) || '—'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Searcher */}
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-2">
                        Searcher
                      </label>
                      <input
                        type="text"
                        value={selectedCreativeForEdit.searcher || getSearcherName(selectedCreativeForEdit.searcher_id) || '—'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Дополнительные типы работ (обязательные) - с предвыбранными из оригинала */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.work_types ? 'text-red-600' : 'text-gray-700'}`}>
                  Дополнительные типы работ *
                </label>
                <div className={`max-h-72 overflow-y-auto border rounded-md p-3 ${
                  fieldErrors.work_types ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-gray-50'
                }`}>
                  <div className="grid grid-cols-1 gap-2">
                    {workTypes.map((type) => {
                      const isFromParent = selectedCreativeForEdit?.work_types?.includes(type);
                      const isNewlySelected = addEditCreative.work_types.includes(type);

                      return (
                        <label
                          key={type}
                          className={`flex items-center justify-between p-2 rounded ${
                            isFromParent
                              ? 'bg-gray-200 cursor-not-allowed'
                              : 'hover:bg-white cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isFromParent || isNewlySelected}
                              disabled={isFromParent}
                              onChange={(e) => {
                                if (!isFromParent) {
                                  handleAddEditWorkTypeChange(type, e.target.checked);
                                }
                              }}
                              className={`h-4 w-4 border-gray-300 rounded ${
                                isFromParent
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'text-yellow-600 focus:ring-yellow-500'
                              }`}
                            />
                            <span className={`text-sm select-none ${isFromParent ? 'text-gray-500' : 'text-gray-700'}`}>
                              {type}
                              {isFromParent && <span className="ml-1 text-xs text-gray-400">(из оригинала)</span>}
                            </span>
                          </div>
                          <span className={`text-xs font-medium ${isFromParent ? 'text-gray-400' : 'text-gray-500'}`}>
                            {formatCOF(workTypeValues[type] || 0)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                {addEditCreative.work_types.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {addEditCreative.work_types.map((type, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-200 text-yellow-800">
                        {type} ({formatCOF(workTypeValues[type] || 0)})
                        <button
                          type="button"
                          onClick={() => handleAddEditWorkTypeChange(type, false)}
                          className="ml-1 text-yellow-600 hover:text-yellow-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Комментарий */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Комментарий
                </label>
                <textarea
                  value={addEditCreative.comment}
                  onChange={(e) => setAddEditCreative({ ...addEditCreative, comment: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white resize-none"
                  placeholder="Добавьте комментарий к правке..."
                />
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={resetAddEditModal}
                disabled={creatingEdit}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
              >
                Отменить
              </button>
              <button
                onClick={handleCreateAddEdit}
                disabled={creatingEdit || !selectedCreativeForEdit}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-900 bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
              >
                {creatingEdit ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                    {authorizing ? 'Авторизация Google...' :
                     extractingTitles ? 'Извлечение названий...' :
                     'Создание правки...'}
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Pencil className="h-4 w-4 mr-2" />
                    <span>Внести правку</span>
                    {addEditCreative.work_types.length > 0 && selectedCreativeForEdit && (
                      <span className="ml-2 text-xs opacity-75">
                        (COF: {formatCOF(calculateCOF(addEditCreative.work_types))})
                      </span>
                    )}
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

export default CreativePanel;
