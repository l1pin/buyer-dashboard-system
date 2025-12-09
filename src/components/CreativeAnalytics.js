import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase, creativeService, userService, creativeHistoryService, metricsAnalyticsService, trelloService } from '../supabaseClient';
import { useBatchMetrics, useMetricsStats, useMetricsApi } from '../hooks/useMetrics';
import MetricsLastUpdateBadge from './MetricsLastUpdateBadge';
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
  Award,
  Search,
  Pencil
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
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [selectedEditor, setSelectedEditor] = useState('all');
  const [selectedBuyer, setSelectedBuyer] = useState('all');
  const [selectedSearcher, setSelectedSearcher] = useState('all');
  const [skuSearch, setSkuSearch] = useState('');
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
  const [metricsPeriod, setMetricsPeriod] = useState('all');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showEditorDropdown, setShowEditorDropdown] = useState(false);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [showSearcherDropdown, setShowSearcherDropdown] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [expandedWorkTypes, setExpandedWorkTypes] = useState(new Set());
  const [deletingCreative, setDeletingCreative] = useState(null);
  const [trelloStatuses, setTrelloStatuses] = useState(new Map());
  const [trelloLists, setTrelloLists] = useState([]);
  
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creativesWithHistory, setCreativesWithHistory] = useState(new Set());

  // Состояния для редактирования даты креатива (только для teamlead)
  const [showDateEditModal, setShowDateEditModal] = useState(false);
  const [editingCreative, setEditingCreative] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [savingDate, setSavingDate] = useState(false);
  const [dateEditError, setDateEditError] = useState('');
  const [dateEditCalendarMonth, setDateEditCalendarMonth] = useState(new Date());

  // Правки креативов
  const [creativeEdits, setCreativeEdits] = useState(new Map()); // Map<creative_id, Edit[]>
  const [expandedEdits, setExpandedEdits] = useState(new Set()); // Set<creative_id> - раскрытые правки

  // Состояние для подсветки креатива при переходе от правки
  const [highlightedCreativeId, setHighlightedCreativeId] = useState(null);
  const creativeRefs = useRef(new Map()); // Map<creative_id, HTMLTableRowElement>

  // Функция для скролла к креативу и его подсветки
  const scrollToCreative = useCallback((creativeId) => {
    const row = creativeRefs.current.get(creativeId);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedCreativeId(creativeId);
      setTimeout(() => setHighlightedCreativeId(null), 2000);
    }
  }, []);

  // Месячная фильтрация ОТКЛЮЧЕНА
  // const [selectedMonth, setSelectedMonth] = useState(null);
  // const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  
// НОВЫЕ состояния для переключения метрик в той же строке
  const [detailMode, setDetailMode] = useState(new Map()); // 'aggregated' (по умолчанию) или 'individual'
  const [currentVideoIndex, setCurrentVideoIndex] = useState(new Map()); // индекс текущего видео для каждого креатива

  const [buyers, setBuyers] = useState([]);
  const [searchers, setSearchers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Вычисляем диапазон дат для текущего фильтра
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch (selectedPeriod) {
      case 'today':
        return { start: todayStart, end: todayEnd };
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          start: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
          end: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
        };
      }
      case 'this_week': {
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - daysToMonday);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59);
        return { start: weekStart, end: weekEnd };
      }
      case 'last_7_days': {
        const last7Start = new Date(now);
        last7Start.setDate(now.getDate() - 6);
        last7Start.setHours(0, 0, 0, 0);
        return { start: last7Start, end: todayEnd };
      }
      case 'this_month':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        };
      case 'last_month':
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
        };
      case 'custom':
        if (customDateFrom && customDateTo) {
          const customFrom = new Date(customDateFrom);
          customFrom.setHours(0, 0, 0, 0);
          const customTo = new Date(customDateTo);
          customTo.setHours(23, 59, 59);
          return { start: customFrom, end: customTo };
        }
        return null;
      default:
        return null;
    }
  }, [selectedPeriod, customDateFrom, customDateTo]);

  // Хелпер для проверки даты в диапазоне фильтра
  const isDateInFilterRange = useCallback((dateStr, range) => {
    if (!range) return true;
    const date = new Date(dateStr);
    return date >= range.start && date <= range.end;
  }, []);

  const filteredCreativesByMonth = useMemo(() => {
    let creativesToFilter = analytics.creatives;
    
    if (selectedEditor !== 'all') {
      creativesToFilter = creativesToFilter.filter(c => c.user_id === selectedEditor);
    }
    
    if (selectedBuyer !== 'all') {
      creativesToFilter = creativesToFilter.filter(c => c.buyer_id === selectedBuyer);
    }
    
    if (selectedSearcher !== 'all') {
      creativesToFilter = creativesToFilter.filter(c => c.searcher_id === selectedSearcher);
    }

    // Фильтрация по SKU (артикулу)
    if (skuSearch.trim()) {
      const searchTerm = skuSearch.trim().toLowerCase();
      creativesToFilter = creativesToFilter.filter(c =>
        c.article && c.article.toLowerCase().includes(searchTerm)
      );
    }

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
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // если воскресенье, то 6 дней назад был понедельник
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

    // Функция для проверки, есть ли у креатива правки в заданном диапазоне дат
    const hasEditsInRange = (creativeId, startDate, endDate) => {
      const edits = creativeEdits.get(String(creativeId)) || [];
      return edits.some(edit => {
        const editDate = new Date(edit.created_at);
        return editDate >= startDate && editDate <= endDate;
      });
    };

    if (selectedPeriod === 'today') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        const inRange = createdDate >= todayStart && createdDate <= todayEnd;
        return inRange || hasEditsInRange(c.id, todayStart, todayEnd);
      });
    } else if (selectedPeriod === 'yesterday') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        const inRange = createdDate >= yesterdayStart && createdDate <= yesterdayEnd;
        return inRange || hasEditsInRange(c.id, yesterdayStart, yesterdayEnd);
      });
    } else if (selectedPeriod === 'this_week') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        const inRange = createdDate >= thisWeekStart && createdDate <= thisWeekEnd;
        return inRange || hasEditsInRange(c.id, thisWeekStart, thisWeekEnd);
      });
    } else if (selectedPeriod === 'last_7_days') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        const inRange = createdDate >= last7DaysStart && createdDate <= todayEnd;
        return inRange || hasEditsInRange(c.id, last7DaysStart, todayEnd);
      });
    } else if (selectedPeriod === 'this_month') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        const inRange = createdDate >= thisMonthStart && createdDate <= thisMonthEnd;
        return inRange || hasEditsInRange(c.id, thisMonthStart, thisMonthEnd);
      });
    } else if (selectedPeriod === 'last_month') {
      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        const inRange = createdDate >= lastMonthStart && createdDate <= lastMonthEnd;
        return inRange || hasEditsInRange(c.id, lastMonthStart, lastMonthEnd);
      });
    } else if (selectedPeriod === 'custom' && customDateFrom && customDateTo) {
      const customFrom = new Date(customDateFrom);
      customFrom.setHours(0, 0, 0, 0);
      const customTo = new Date(customDateTo);
      customTo.setHours(23, 59, 59);

      creativesToFilter = creativesToFilter.filter(c => {
        const createdDate = new Date(c.created_at);
        const inRange = createdDate >= customFrom && createdDate <= customTo;
        return inRange || hasEditsInRange(c.id, customFrom, customTo);
      });
    }

    // Сортировка от новых к старым
    // Для каждого креатива берём максимальную дату (его дату или дату последней правки)
    return creativesToFilter.sort((a, b) => {
      const editsA = creativeEdits.get(String(a.id)) || [];
      const editsB = creativeEdits.get(String(b.id)) || [];

      let maxDateA = new Date(a.created_at);
      editsA.forEach(edit => {
        const editDate = new Date(edit.created_at);
        if (editDate > maxDateA) maxDateA = editDate;
      });

      let maxDateB = new Date(b.created_at);
      editsB.forEach(edit => {
        const editDate = new Date(edit.created_at);
        if (editDate > maxDateB) maxDateB = editDate;
      });

      return maxDateB - maxDateA;
    });
  }, [analytics.creatives, selectedEditor, selectedBuyer, selectedSearcher, skuSearch, selectedPeriod, customDateFrom, customDateTo, creativeEdits]);

  // Отдельные правки для отображения как самостоятельные строки (в пределах выбранного периода)
  // Показываем standalone правки только когда:
  // 1. Нет фильтра по дате - показываем все
  // 2. Есть фильтр и (материнский креатив в диапазоне И правка в диапазоне)
  // 3. Есть фильтр и несколько правок в диапазоне
  const standaloneEdits = useMemo(() => {
    const edits = [];

    // При поиске по SKU не показываем standalone правки
    if (skuSearch.trim()) {
      return edits;
    }

    creativeEdits.forEach((editList, creativeId) => {
      const creative = analytics.creatives.find(c => String(c.id) === String(creativeId));
      if (!creative) return;

      // Проверяем, проходит ли креатив через фильтры пользователей
      if (selectedEditor !== 'all' && creative.user_id !== selectedEditor) return;
      if (selectedBuyer !== 'all' && creative.buyer_id !== selectedBuyer) return;
      if (selectedSearcher !== 'all' && creative.searcher_id !== selectedSearcher) return;

      if (!dateRange) {
        // Если нет фильтра по дате - показываем все правки
        editList.forEach(edit => {
          edits.push({ ...edit, creative });
        });
      } else {
        const creativeInRange = isDateInFilterRange(creative.created_at, dateRange);
        const editsInRange = editList.filter(edit => isDateInFilterRange(edit.created_at, dateRange));

        // Показываем standalone правки если:
        // - Материнский креатив в диапазоне И есть правка в диапазоне
        // - ИЛИ 2+ правки в диапазоне (даже если материнский не в диапазоне)
        if ((creativeInRange && editsInRange.length > 0) || editsInRange.length >= 2) {
          editsInRange.forEach(edit => {
            edits.push({ ...edit, creative });
          });
        }
      }
    });

    // Сортируем по дате создания правки (новые сверху)
    return edits.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [creativeEdits, dateRange, analytics.creatives, selectedEditor, selectedBuyer, selectedSearcher, isDateInFilterRange, skuSearch]);

  const [metricsLastUpdate, setMetricsLastUpdate] = useState(null);

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
      // Сбрасываем временные даты при открытии календаря
      setTempCustomDateFrom(customDateFrom);
      setTempCustomDateTo(customDateTo);
    } else {
      setShowCalendar(false);
      setCustomDateFrom(null);
      setCustomDateTo(null);
      setTempCustomDateFrom(null);
      setTempCustomDateTo(null);
      setShowPeriodMenu(false); // Закрываем меню для обычных периодов
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
      setShowPeriodMenu(false); // Закрываем панель выбора дат
    }
  };

  const resetCalendar = () => {
    setTempCustomDateFrom(null);
    setTempCustomDateTo(null);
    setSelectingDate(null);
    setShowCalendar(false);
  };

  const {
    batchMetrics,
    loading: metricsLoading,
    error: metricsError,
    stats: metricsStats,
    getCreativeMetrics,
    refresh: refreshMetrics,
    loadFromCache,
    isAutoRefreshing // 🔄 Realtime: Флаг автообновления метрик
  } = useBatchMetrics(filteredCreativesByMonth, true, metricsPeriod);
  
  const { 
    stats: aggregatedMetricsStats,
    formatStats,
    hasData: hasMetricsData 
  } = useMetricsStats(filteredCreativesByMonth, batchMetrics);

  const { 
    apiStatus, 
    checking: checkingApi, 
    checkApiStatus,
    isAvailable: isMetricsApiAvailable 
  } = useMetricsApi();

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
  } = useZoneData(filteredCreativesByMonth, true);

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

  const getEditorName = (editorId) => {
    if (!editorId || editorId === 'all') return 'Все монтажеры';
    const editor = analytics.editors.find(e => e.id === editorId);
    return editor ? editor.name : 'Неизвестный';
  };

  const getEditorAvatar = (editorId) => {
    if (!editorId || editorId === 'all') return null;
    const editor = analytics.editors.find(e => e.id === editorId);
    return editor ? editor.avatar_url : null;
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

  const toggleDetailMode = (creativeId) => {
    const newDetailMode = new Map(detailMode);
    const currentMode = newDetailMode.get(creativeId) || 'aggregated';
    
    if (currentMode === 'aggregated') {
      newDetailMode.set(creativeId, 'individual');
      const newCurrentVideoIndex = new Map(currentVideoIndex);
      newCurrentVideoIndex.set(creativeId, 0);
      setCurrentVideoIndex(newCurrentVideoIndex);
    } else {
      newDetailMode.set(creativeId, 'aggregated');
    }
    
    setDetailMode(newDetailMode);
  };

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

  const getCOFBadgeColor = (cof) => {
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getCountryStats = () => {
    const ukraineCount = filteredCreativesByMonth.filter(c => !c.is_poland).length;
    const polandCount = filteredCreativesByMonth.filter(c => c.is_poland).length;
    return { ukraineCount, polandCount };
  };

  const getZoneStats = () => {
    const zoneCount = { red: 0, pink: 0, gold: 0, green: 0 };
    
    filteredCreativesByMonth.forEach(creative => {
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

  const getEditorZoneStats = () => {
    const editorZones = {};
    
    filteredCreativesByMonth.forEach(creative => {
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

  // ФУНКЦИИ МЕСЯЦЕВ ОТКЛЮЧЕНЫ
  /*
  const getCurrentMonthYear = () => { ... };
  const getAvailableMonths = () => { ... };
  const getDisplayMonthYear = () => { ... };
  */

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

  // Функции для редактирования даты креатива (только для teamlead)
  const openDateEditModal = (creative) => {
    const dateObj = new Date(creative.created_at);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    setEditingCreative(creative);
    setEditDate(`${year}-${month}-${day}`);
    setEditTime(`${hours}:${minutes}`);
    setDateEditCalendarMonth(dateObj);
    setDateEditError('');
    setShowDateEditModal(true);
  };

  const closeDateEditModal = () => {
    setShowDateEditModal(false);
    setEditingCreative(null);
    setEditDate('');
    setEditTime('');
    setDateEditError('');
    setSavingDate(false);
  };

  const handleDateEditCalendarClick = (day, month, year) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    setEditDate(`${year}-${formattedMonth}-${formattedDay}`);
  };

  const getDaysInMonthForEdit = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Понедельник = 0

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const saveCreativeDate = async () => {
    if (!editingCreative || !editDate || !editTime) {
      setDateEditError('Выберите дату и время');
      return;
    }

    setSavingDate(true);
    setDateEditError('');

    try {
      // Определяем киевский offset для выбранной даты
      // Создаём дату и проверяем, какой offset действует в Киеве для этой даты
      const [year, month, day] = editDate.split('-').map(Number);
      const [hours, minutes] = editTime.split(':').map(Number);

      // Создаём дату для проверки offset
      const testDate = new Date(year, month - 1, day, hours, minutes);
      const utcDate = new Date(testDate.toLocaleString('en-US', { timeZone: 'UTC' }));
      const kyivDate = new Date(testDate.toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
      const diffHours = Math.round((kyivDate - utcDate) / (1000 * 60 * 60));
      const kyivOffset = diffHours === 3 ? '+03:00' : '+02:00';

      // Формируем дату в формате ISO с киевским offset
      const formattedDate = editDate;
      const formattedTime = `${editTime}:00`;
      const newDateTime = `${formattedDate}T${formattedTime}${kyivOffset}`;

      console.log('📅 Сохранение новой даты (Киев):', newDateTime, 'для креатива:', editingCreative.id);

      await creativeService.updateCreativeDate(editingCreative.id, newDateTime);

      // Обновляем локальное состояние
      setAnalytics(prevAnalytics => ({
        ...prevAnalytics,
        creatives: prevAnalytics.creatives.map(c =>
          c.id === editingCreative.id
            ? { ...c, created_at: newDateTime }
            : c
        )
      }));

      console.log('✅ Дата креатива успешно обновлена');
      closeDateEditModal();
    } catch (error) {
      console.error('❌ Ошибка обновления даты:', error);
      setDateEditError('Ошибка сохранения: ' + error.message);
    } finally {
      setSavingDate(false);
    }
  };

  const handleDeleteCreative = async (creative) => {
    const confirmMessage = `Вы уверены, что хотите удалить креатив "${creative.article}"?\n\nБудут удалены:\n• Креатив\n• История изменений\n• Кэш метрик\n\nЭто действие нельзя отменить!`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setDeletingCreative(creative.id);
      setError('');
      console.log('🗑️ Удаление креатива:', creative.id, creative.article);
      
      // Удаляем из базы данных
      await creativeService.deleteCreative(creative.id);
      
      console.log('✅ Креатив успешно удален из БД');
      
      // 🚀 МОМЕНТАЛЬНО обновляем UI - удаляем креатив из состояния
      setAnalytics(prevAnalytics => {
        // Фильтруем креативы, исключая удаленный
        const updatedCreatives = prevAnalytics.creatives.filter(c => c.id !== creative.id);
        
        // Пересчитываем статистику
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const todayCreatives = updatedCreatives.filter(c => new Date(c.created_at) >= todayStart);
        const weekCreatives = updatedCreatives.filter(c => new Date(c.created_at) >= weekStart);

        const calculateCreativeCOF = (creative) => {
          if (typeof creative.cof_rating === 'number') {
            return creative.cof_rating;
          }
          return calculateCOF(creative.work_types || []);
        };

        const totalCOF = updatedCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
        const todayCOF = todayCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
        const weekCOF = weekCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
        const avgCOF = updatedCreatives.length > 0 ? totalCOF / updatedCreatives.length : 0;

        const creativesWithComments = updatedCreatives.filter(c => c.comment && c.comment.trim()).length;

        return {
          ...prevAnalytics,
          creatives: updatedCreatives,
          stats: {
            ...prevAnalytics.stats,
            totalCreatives: updatedCreatives.length,
            todayCreatives: todayCreatives.length,
            weekCreatives: weekCreatives.length,
            totalCOF: totalCOF,
            avgCOF: avgCOF,
            todayCOF: todayCOF,
            weekCOF: weekCOF,
            creativesWithComments: creativesWithComments
          }
        };
      });

      // Удаляем из creativesWithHistory если был там
      setCreativesWithHistory(prev => {
        const updated = new Set(prev);
        updated.delete(creative.id);
        return updated;
      });

      console.log('✅ UI обновлен моментально');
      
    } catch (error) {
      console.error('❌ Ошибка удаления креатива:', error);
      setError(`Ошибка удаления креатива: ${error.message}`);
      alert(`Не удалось удалить креатив: ${error.message}`);
    } finally {
      setDeletingCreative(null);
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


  // 🆕 НОВАЯ ФУНКЦИЯ: Синхронизация пропущенных статусов
  const syncMissingTrelloStatuses = async (currentStatusMap) => {
    try {
      console.log('🔄 Проверка пропущенных Trello статусов...');

      // Находим креативы с trello_link, но без статуса
      const creativesWithoutStatus = analytics.creatives.filter(creative => {
        const hasLink = !!creative.trello_link;
        const hasStatus = currentStatusMap.has(creative.id);
        return hasLink && !hasStatus;
      });

      if (creativesWithoutStatus.length === 0) {
        console.log('✅ Все креативы с Trello ссылками имеют статусы');
        return 0;
      }

      console.log(`⚠️ Найдено ${creativesWithoutStatus.length} креативов БЕЗ статуса, но с Trello ссылкой`);

      // 🚀 ОПТИМИЗАЦИЯ: Параллельная загрузка батчами по 5 креативов
      const BATCH_SIZE = 5;
      let successCount = 0;
      let errorCount = 0;
      const newStatuses = new Map();

      // Разбиваем на батчи
      const batches = [];
      for (let i = 0; i < creativesWithoutStatus.length; i += BATCH_SIZE) {
        batches.push(creativesWithoutStatus.slice(i, i + BATCH_SIZE));
      }

      console.log(`📦 Разбито на ${batches.length} батчей по ${BATCH_SIZE} креативов`);

      // Обрабатываем батчи последовательно, но внутри батча - параллельно
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`🔄 Батч ${batchIndex + 1}/${batches.length}: синхронизация ${batch.length} креативов...`);

        // Параллельная обработка внутри батча
        const results = await Promise.allSettled(
          batch.map(async (creative) => {
            try {
              const result = await trelloService.syncSingleCreative(
                creative.id,
                creative.trello_link
              );

              if (result.success) {
                return {
                  success: true,
                  creativeId: creative.id,
                  status: {
                    creative_id: creative.id,
                    list_name: result.listName,
                    list_id: result.listId,
                    trello_card_id: result.cardId,
                    last_updated: new Date().toISOString()
                  }
                };
              }
              return { success: false, creativeId: creative.id };
            } catch (error) {
              console.error(`❌ Ошибка синхронизации ${creative.article}:`, error.message);
              return { success: false, creativeId: creative.id, error: error.message };
            }
          })
        );

        // Собираем результаты батча
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.success) {
            newStatuses.set(result.value.creativeId, result.value.status);
            successCount++;
          } else {
            errorCount++;
          }
        });

        // Обновляем UI после каждого батча для отзывчивости
        if (newStatuses.size > 0) {
          setTrelloStatuses(prev => {
            const updated = new Map(prev);
            newStatuses.forEach((value, key) => {
              updated.set(key, value);
            });
            return updated;
          });
        }

        // Небольшая задержка между батчами для избежания rate limit
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
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
      console.log('📊 analytics.creatives:', analytics.creatives?.length || 0);
      
      // Получаем списки
      const lists = await trelloService.getAllLists();
      setTrelloLists(lists);
      console.log(`✅ Загружено ${lists.length} списков Trello`);
      
      // Получаем статусы для ВСЕХ креативов (не только filtered)
      const creativeIds = analytics.creatives.map(c => c.id);
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

  const loadAnalytics = async (forceRefresh = false) => {
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

      const safeCreatives = creativesData || [];
      const safeEditors = editorsData || [];

      const editors = safeEditors.filter(u => u.role === 'editor');

      // Батчевая проверка истории для всех креативов одним запросом
      const creativeIds = safeCreatives.map(c => c.id);
      const creativesWithHistorySet = await creativeHistoryService.checkHistoryBatch(creativeIds);
      setCreativesWithHistory(creativesWithHistorySet);

      // Загружаем правки для креативов с has_edits = true (как в CreativePanel)
      const creativesWithEdits = safeCreatives.filter(c => c.has_edits).map(c => c.id);
      if (creativesWithEdits.length > 0) {
        const editsMap = await creativeService.getEditsForCreatives(creativesWithEdits);
        setCreativeEdits(new Map(Object.entries(editsMap)));
        console.log(`✅ Загружено правок для ${Object.keys(editsMap).length} креативов`);
      } else {
        setCreativeEdits(new Map());
        console.log('📝 Нет креативов с правками');
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const todayCreatives = safeCreatives.filter(c => new Date(c.created_at) >= todayStart);
      const weekCreatives = safeCreatives.filter(c => new Date(c.created_at) >= weekStart);

      const calculateCreativeCOF = (creative) => {
        if (typeof creative.cof_rating === 'number') {
          return creative.cof_rating;
        }
        return calculateCOF(creative.work_types || []);
      };

      const totalCOF = safeCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
      const todayCOF = todayCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
      const weekCOF = weekCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
      const avgCOF = safeCreatives.length > 0 ? totalCOF / safeCreatives.length : 0;

      const creativesWithComments = safeCreatives.filter(c => c.comment && c.comment.trim()).length;

      const stats = {
        totalCreatives: safeCreatives.length,
        totalEditors: editors.length,
        todayCreatives: todayCreatives.length,
        weekCreatives: weekCreatives.length,
        totalCOF: totalCOF,
        avgCOF: avgCOF,
        todayCOF: todayCOF,
        weekCOF: weekCOF,
        creativesWithComments: creativesWithComments
      };

      const analyticsData = {
        creatives: safeCreatives,
        editors,
        stats,
        workTypeStats: {},
        editorStats: {}
      };

      setAnalytics(analyticsData);

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
    loadUsers();
    loadAnalytics();
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
          console.log('⏳ Ждем 6 секунд, пока CreativePanel.js загрузит метрики в кеш БД...');
          
          // ⏳ ЖДЕМ 6 СЕКУНД - CreativePanel.js за это время загрузит метрики в кеш БД
          setTimeout(() => {
            console.log('✅ Прошло 6 секунд, добавляем креатив в аналитику С метриками из кеша');
            
            // 🚀 ДОБАВЛЯЕМ НОВЫЙ КРЕАТИВ В АНАЛИТИКУ ПОСЛЕ ЗАГРУЗКИ МЕТРИК
            let updatedAnalyticsData = null;
            
            setAnalytics(prevAnalytics => {
              const newCreative = {
                ...payload.new,
                // Добавляем имя редактора из пользователей
                editor_name: prevAnalytics.editors.find(e => e.id === payload.new.user_id)?.name || 'Неизвестен'
              };
              
              // Добавляем в начало массива
              const updatedCreatives = [newCreative, ...prevAnalytics.creatives];
              
              // Пересчитываем статистику
              const now = new Date();
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

              const todayCreatives = updatedCreatives.filter(c => new Date(c.created_at) >= todayStart);
              const weekCreatives = updatedCreatives.filter(c => new Date(c.created_at) >= weekStart);

              const calculateCreativeCOF = (creative) => {
                if (typeof creative.cof_rating === 'number') {
                  return creative.cof_rating;
                }
                return calculateCOF(creative.work_types || []);
              };

              const totalCOF = updatedCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
              const todayCOF = todayCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
              const weekCOF = weekCreatives.reduce((sum, c) => sum + calculateCreativeCOF(c), 0);
              const avgCOF = updatedCreatives.length > 0 ? totalCOF / updatedCreatives.length : 0;

              const creativesWithComments = updatedCreatives.filter(c => c.comment && c.comment.trim()).length;

              const newAnalyticsState = {
                ...prevAnalytics,
                creatives: updatedCreatives,
                stats: {
                  ...prevAnalytics.stats,
                  totalCreatives: updatedCreatives.length,
                  todayCreatives: todayCreatives.length,
                  weekCreatives: weekCreatives.length,
                  totalCOF: totalCOF,
                  avgCOF: avgCOF,
                  todayCOF: todayCOF,
                  weekCOF: weekCOF,
                  creativesWithComments: creativesWithComments
                }
              };
              
              // Сохраняем во внешнюю переменную для последующего сохранения в кеш
              updatedAnalyticsData = newAnalyticsState;
              
              return newAnalyticsState;
            });
            
            console.log('✅ Новый креатив добавлен в аналитику');
            console.log('🤖 Хук useBatchMetrics автоматически загрузит метрики из кеша БД');
          }, 6000); // Ждем 6 секунд
          
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

  // Отдельный useEffect для загрузки Trello статусов ПОСЛЕ загрузки аналитики
  useEffect(() => {
    console.log('🔵 useEffect для Trello, analytics.creatives:', analytics.creatives?.length);
    
    if (analytics.creatives && analytics.creatives.length > 0) {
      console.log('🟢 Запускаем loadTrelloStatuses с автосинхронизацией...');
      loadTrelloStatuses(true); // true = автоматически синхронизировать пропущенные
    } else {
      console.log('⚠️ analytics.creatives пуст, ждем...');
    }
  }, [analytics.creatives]);

  // Функция больше не нужна, autoLoad делает это автоматически

  const loadLastUpdateTime = async () => {
    try {
      const lastUpdate = await metricsAnalyticsService.getMetricsLastUpdate();
      setMetricsLastUpdate(lastUpdate);
    } catch (error) {
      console.error('Ошибка загрузки времени последнего обновления:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
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
        // Сбрасываем временные даты если не применили
        setTempCustomDateFrom(customDateFrom);
        setTempCustomDateTo(customDateTo);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPeriodMenu, customDateFrom, customDateTo]);

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

  const exportReport = () => {
    try {
      const reportData = {
        period: selectedPeriod,
        metricsPeriod: metricsPeriod,
        editor: selectedEditor === 'all' ? 'Все монтажеры' : analytics.editors.find(e => e.id === selectedEditor)?.name,
        generated: new Date().toISOString(),
        stats: analytics.stats,
        metricsStats: aggregatedMetricsStats,
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
    console.log('🔄 Обновление только метрик и зональных данных...');
    await refreshMetrics();
    await refreshZoneData();
    await loadLastUpdateTime();
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
    return metricsPeriod === 'all' ? 'За все время' : 'Первые 4 дня';
  };

  // const availableMonths = getAvailableMonths(); // ОТКЛЮЧЕНО
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
                        Прошлый месяц
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

            <button
              onClick={exportReport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
            >
              <Download className="h-4 w-4 mr-2" />
              Экспорт
            </button>
          </div>
        </div>
      </div>

      {/* Информационная панель с временем обновления и статусом API */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between">
          <MetricsLastUpdateBadge />

          <div className="flex items-center space-x-2">
            <Globe className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500">API:</span>
            <div className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs ${
              isMetricsApiAvailable 
                ? 'bg-green-50 text-green-600' 
                : apiStatus === 'unavailable' 
                  ? 'bg-red-50 text-red-600'
                  : 'bg-gray-100 text-gray-500'
            }`}>
              {checkingApi ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
              ) : isMetricsApiAvailable ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              <span>
                {checkingApi ? 'Проверка' : 
                 isMetricsApiAvailable ? 'OK' : 
                 apiStatus === 'unavailable' ? 'Недоступен' : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Фильтры:</span>
            </div>

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
                    
                    {analytics.editors.map(editor => (
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

            {/* Поиск по SKU */}
            <div className="relative">
              <input
                type="text"
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                placeholder="Поиск по артикулу..."
                className="w-48 pl-8 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              {skuSearch && (
                <button
                  onClick={() => setSkuSearch('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>


        </div>

      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-auto">

      {/* Statistics Cards */}
      {filteredCreativesByMonth.length > 0 && (
        <div className="bg-gray-50 px-6 py-2">
          {/* ПЕРВАЯ СТРОКА */}
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-4 mb-4">
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Video className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">Креативов</dt>
                      <dd className="text-lg font-semibold text-gray-900">{filteredCreativesByMonth.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MessageCircle className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">С комментарием</dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {filteredCreativesByMonth.filter(c => c.comment && c.comment.trim()).length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Globe className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">UA/PL</dt>
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
                      <dt className="text-xs font-medium text-gray-500 truncate">Общий COF</dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {formatCOF(filteredCreativesByMonth.reduce((sum, c) => sum + (c.cof_rating || calculateCOF(c.work_types || [])), 0))}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Target className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">Средний COF</dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {formatCOF(filteredCreativesByMonth.length > 0 
                          ? filteredCreativesByMonth.reduce((sum, c) => sum + (c.cof_rating || calculateCOF(c.work_types || [])), 0) / filteredCreativesByMonth.length
                          : 0
                        )}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-red-500 overflow-hidden shadow-sm rounded-lg border border-red-600">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-red-100 truncate">Красная зона</dt>
                      <dd className="text-lg font-semibold text-white">{zoneStats.red}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-pink-500 overflow-hidden shadow-sm rounded-lg border border-pink-600">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-pink-100 truncate">Розовая зона</dt>
                      <dd className="text-lg font-semibold text-white">{zoneStats.pink}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-500 overflow-hidden shadow-sm rounded-lg border border-yellow-600">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-6 w-6 text-black" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-yellow-800 truncate">Золотая зона</dt>
                      <dd className="text-lg font-semibold text-black">{zoneStats.gold}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-green-500 overflow-hidden shadow-sm rounded-lg border border-green-600">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-green-100 truncate">Зеленая зона</dt>
                      <dd className="text-lg font-semibold text-white">{zoneStats.green}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ВТОРАЯ СТРОКА - метрики */}
          {hasMetricsData && (
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-4">
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">Лидов</dt>
                        <dd className="text-lg font-semibold text-gray-900">{formatStats().totalLeads}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

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
                        <dt className="text-xs font-medium text-gray-500 truncate">CPL</dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {aggregatedMetricsStats.totalLeads > 0 ? 
                          (aggregatedMetricsStats.totalCost / aggregatedMetricsStats.totalLeads).toFixed(2) + '$' : 
                          '0.00$'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DollarSign className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">Расходы</dt>
                        <dd className="text-lg font-semibold text-gray-900">{formatStats().totalCost}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <MousePointer className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">Клики</dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {Math.round(aggregatedMetricsStats.totalClicks).toLocaleString()}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

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
                        <dt className="text-xs font-medium text-gray-500 truncate">CPC</dt>
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
                        <dt className="text-xs font-medium text-gray-500 truncate">CTR</dt>
                        <dd className="text-lg font-semibold text-gray-900">{formatStats().avgCTR}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

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
                        <dt className="text-xs font-medium text-gray-500 truncate">CPM</dt>
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

              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Eye className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">Показы</dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {Math.round(aggregatedMetricsStats.totalImpressions).toLocaleString()}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">Ср. лидов</dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          {filteredCreativesByMonth.length > 0 ? Math.round(aggregatedMetricsStats.totalLeads / filteredCreativesByMonth.length) : 0}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Рейтинги монтажеров */}
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
                        const editorsMap = new Map();
                        
                        filteredCreativesByMonth.forEach(creative => {
                          const editorId = creative.user_id || 'unknown';
                          const editorName = creative.editor_name || creative.users?.name || 'Неизвестный';
                          
                          if (!editorsMap.has(editorId)) {
                            editorsMap.set(editorId, {
                              name: editorName,
                              zones: editorZoneStats[editorId] || { red: 0, pink: 0, gold: 0, green: 0 },
                              count: 0
                            });
                          }
                          
                          editorsMap.get(editorId).count++;
                        });
                        
                        return Array.from(editorsMap.values())
                          .sort((a, b) => b.count - a.count)
                          .slice(0, 8)
                          .map((editor, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-2 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    {(() => {
                                      const editorData = analytics.editors.find(e => e.name === editor.name);
                                      const avatarUrl = editorData?.avatar_url;
                                      return avatarUrl ? (
                                        <img
                                          src={avatarUrl}
                                          alt={editor.name}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                      ) : null;
                                    })()}
                                    <div className={`w-full h-full flex items-center justify-center ${(() => {
                                      const editorData = analytics.editors.find(e => e.name === editor.name);
                                      return editorData?.avatar_url ? 'hidden' : '';
                                    })()}`}>
                                      <User className="h-3 w-3 text-gray-400" />
                                    </div>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900 truncate">
                                    {editor.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-red-600">
                                  {editor.zones.red}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-pink-600">
                                  {editor.zones.pink}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-yellow-600">
                                  {editor.zones.gold}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-green-600">
                                  {editor.zones.green}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span className="text-sm font-bold text-blue-600">
                                  {editor.count}
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
                        const editorsMap = new Map();
                        
                        filteredCreativesByMonth.forEach(creative => {
                          const editorId = creative.user_id || 'unknown';
                          const editorName = creative.editor_name || creative.users?.name || 'Неизвестный';
                          
                          if (!editorsMap.has(editorId)) {
                            editorsMap.set(editorId, {
                              name: editorName,
                              totalCOF: 0,
                              totalLeads: 0,
                              totalCost: 0,
                              totalClicks: 0,
                              totalImpressions: 0,
                              commentsCount: 0,
                              cost_from_sources: 0,
                              clicks_on_link: 0
                            });
                          }
                          
                          const editor = editorsMap.get(editorId);
                          editor.totalCOF += creative.cof_rating || calculateCOF(creative.work_types || []);
                          
                          if (creative.comment && creative.comment.trim()) {
                            editor.commentsCount++;
                          }
                          
                          const metrics = getAggregatedCreativeMetrics(creative);
                          if (metrics?.found && metrics.data) {
                            editor.totalLeads += metrics.data.raw.leads || 0;
                            editor.totalCost += metrics.data.raw.cost || 0;
                            editor.totalClicks += metrics.data.raw.clicks || 0;
                            editor.totalImpressions += metrics.data.raw.impressions || 0;
                            editor.cost_from_sources += metrics.data.raw.cost_from_sources || 0;
                            editor.clicks_on_link += metrics.data.raw.clicks_on_link || 0;
                          }
                        });
                        
                        return Array.from(editorsMap.values())
                          .sort((a, b) => b.totalCOF - a.totalCOF)
                          .slice(0, 8)
                          .map((editor, index) => {
                            const avgCPL = editor.totalLeads > 0 ? editor.totalCost / editor.totalLeads : 0;
                            const avgCTR = editor.totalImpressions > 0 ? (editor.clicks_on_link / editor.totalImpressions) * 100 : 0;
                            const avgCPC = editor.totalClicks > 0 ? editor.totalCost / editor.totalClicks : 0;
                            
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                      {(() => {
                                        const editorData = analytics.editors.find(e => e.name === editor.name);
                                        const avatarUrl = editorData?.avatar_url;
                                        return avatarUrl ? (
                                          <img
                                            src={avatarUrl}
                                            alt={editor.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              e.target.style.display = 'none';
                                              e.target.nextSibling.style.display = 'flex';
                                            }}
                                          />
                                        ) : null;
                                      })()}
                                      <div className={`w-full h-full flex items-center justify-center ${(() => {
                                        const editorData = analytics.editors.find(e => e.name === editor.name);
                                        return editorData?.avatar_url ? 'hidden' : '';
                                      })()}`}>
                                        <User className="h-3 w-3 text-gray-400" />
                                      </div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {editor.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${getCOFBadgeColor(editor.totalCOF)}`}>
                                    {formatCOF(editor.totalCOF)}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <span className="text-sm font-bold text-gray-900">
                                    {Math.round(editor.totalLeads)}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <span className="text-sm font-bold text-gray-900">
                                    {avgCPL > 0 ? avgCPL.toFixed(2) : '0.00'}$
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <span className="text-sm font-bold text-gray-900">
                                    {editor.totalCost.toFixed(2)}$
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <span className="text-sm font-bold text-gray-900">
                                    {avgCTR > 0 ? avgCTR.toFixed(2) + '%' : '0.00%'}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <span className="text-sm font-bold text-gray-900">
                                    {avgCPC > 0 ? avgCPC.toFixed(2) : '0.00'}$
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <span className={`text-sm font-bold ${
                                    editor.commentsCount > 0 ? 'text-indigo-600' : 'text-gray-400'
                                  }`}>
                                    {editor.commentsCount}
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content - Table */}
      <div className="px-6 pt-0 pb-6">
        {filteredCreativesByMonth.length === 0 ? (
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
            <div className="px-0 py-0">
              <div className="overflow-x-auto" style={{maxHeight: 'calc(100vh - 280px)', overflowY: 'auto'}}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                    <tr>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50" style={{ width: '90px' }}>
                        Правки
                      </th>
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
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Отдельные строки с правками - стиль как в CreativePanel */}
                    {standaloneEdits.map((edit) => {
                      const editDateTime = formatKyivTime(edit.created_at);
                      // Вычисляем номер правки
                      const allEdits = creativeEdits.get(String(edit.creative_id)) || [];
                      const editIndex = allEdits.findIndex(e => e.id === edit.id);
                      const editNumber = allEdits.length - editIndex;

                      return (
                        <tr
                          key={`edit-${edit.id}`}
                          className="hover:bg-yellow-100/50 transition-colors"
                          style={{ backgroundColor: '#fffffe66' }}
                        >
                          {/* Колонка Правки - бейдж ПРАВКА - кликабельный */}
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-center" style={{ backgroundColor: '#fffffe66' }}>
                            <div className="flex flex-col items-center justify-center">
                              <button
                                onClick={() => scrollToCreative(edit.creative_id)}
                                className="inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-sm border border-yellow-300 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                                title="Показать материнский креатив"
                              >
                                <span className="tracking-wide">ПРАВКА</span>
                              </button>
                            </div>
                          </td>
                          {/* Дата правки - как у обычных креативов с местом для карандаша */}
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900" style={{ backgroundColor: '#fffffe66' }}>
                            <div className="flex items-center justify-center gap-1">
                              <div className="cursor-text select-text">
                                <div className="font-medium">{editDateTime.date}</div>
                                <div className="text-xs text-gray-500">{editDateTime.time}</div>
                              </div>
                              {/* Placeholder для карандаша - как у обычных креативов */}
                              <div className="ml-1 p-1 w-[22px] h-[22px]"></div>
                            </div>
                          </td>
                          {/* Артикул → Правка #N */}
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
                                    className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
                                    title={edit.comment}
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <div className="w-6 h-6 flex-shrink-0"></div>
                              <span className="text-sm font-medium text-gray-900">
                                {edit.creative?.article} → Правка #{editNumber}
                              </span>
                            </div>
                          </td>
                          {/* Монтажер с аватаркой */}
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}>
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                {getEditorAvatar(edit.creative?.user_id) ? (
                                  <img
                                    src={getEditorAvatar(edit.creative?.user_id)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className={`w-full h-full flex items-center justify-center ${getEditorAvatar(edit.creative?.user_id) ? 'hidden' : ''}`}>
                                  <User className="h-3 w-3 text-gray-400" />
                                </div>
                              </div>
                              <span className="text-sm text-gray-900">
                                {edit.creative?.editor_name || getEditorName(edit.creative?.user_id) || '—'}
                              </span>
                            </div>
                          </td>
                          {/* Видео из правки */}
                          <td className="px-3 py-3 text-sm text-gray-900" style={{ backgroundColor: '#fffffe66' }}>
                            <div className="space-y-1">
                              {edit.link_titles && edit.link_titles.length > 0 ? (
                                edit.link_titles.map((title, idx) => (
                                  <div key={idx} className="flex items-center min-h-[24px]">
                                    <span
                                      className="block text-left flex-1 mr-2 cursor-text select-text truncate whitespace-nowrap overflow-hidden"
                                      title={title}
                                    >
                                      {title}
                                    </span>
                                    {edit.links && edit.links[idx] && (
                                      <a
                                        href={edit.links[idx]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 hover:opacity-70 text-blue-600 hover:text-blue-800"
                                        title="Открыть в Google Drive"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <span className="text-gray-500">Перезалив</span>
                              )}
                            </div>
                          </td>
                          {/* Пустые ячейки для метрик - без "—" */}
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
                          {/* Пустая ячейка для колонки Зоны */}
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          {/* COF с типами работ */}
                          <td className="px-3 py-3 whitespace-nowrap text-center" style={{ backgroundColor: '#fffffe66' }}>
                            {edit.work_types && edit.work_types.length > 0 ? (
                              <div className="space-y-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getCOFBadgeColor(edit.cof_rating || 0)} cursor-text select-text`}>
                                  <span className="text-xs font-bold mr-1">+COF</span>
                                  {formatCOF(edit.cof_rating || 0)}
                                </span>
                                <div className="text-xs mt-1 text-gray-600">
                                  {edit.work_types.join(', ')}
                                </div>
                              </div>
                            ) : null}
                          </td>
                          {/* Trello, Статус, Buyer, Searcher - пустые */}
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                          {/* Действия - пустая */}
                          <td className="px-3 py-3" style={{ backgroundColor: '#fffffe66' }}></td>
                        </tr>
                      );
                    })}
                    {filteredCreativesByMonth
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
                        const edits = creativeEdits.get(String(creative.id)) || [];
                        const hasEdits = edits.length > 0;
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
                            {/* Колонка "Правки" - ПЕРВАЯ. Бейдж РЕД для материнского креатива */}
                            <td className="px-2 py-4 whitespace-nowrap text-sm text-center">
                              <div className="flex flex-col items-center justify-center">
                                {hasEdits && (() => {
                                  const editsCount = edits.length;
                                  // Get the last edit date
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

                            {/* Колонка "Дата" */}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <div className="cursor-text select-text">
                                  <div className="font-medium">{formattedDateTime.date}</div>
                                  <div className="text-xs text-gray-500">{formattedDateTime.time}</div>
                                </div>
                                {user?.role === 'teamlead' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDateEditModal(creative);
                                    }}
                                    className="ml-1 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                                    title="Редактировать дату"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Колонка "Артикул" */}
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
                                  (() => {
                                    // Собираем все названия видео из правок
                                    const editVideoTitles = new Set();
                                    edits.forEach(edit => {
                                      if (edit.link_titles && edit.link_titles.length > 0) {
                                        edit.link_titles.forEach(t => editVideoTitles.add(t));
                                      }
                                    });

                                    return creative.link_titles.map((title, index) => {
                                      const isFromEdit = editVideoTitles.has(title);
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
                                            className={`flex-shrink-0 hover:opacity-70 ${isFromEdit ? '' : 'text-blue-600 hover:text-blue-800'}`}
                                            style={isFromEdit ? { color: '#a16207' } : {}}
                                            title="Открыть в Google Drive"
                                          >
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        </div>
                                      );
                                    });
                                  })()
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
                            
                            {/* КОЛОНКИ МЕТРИК */}
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
                                          <span className="font-bold text-sm cursor-text select-text text-black">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black">
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

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCreative(creative);
                                }}
                                disabled={deletingCreative === creative.id}
                                className="inline-flex items-center justify-center p-2 rounded-full transition-colors duration-200 text-red-600 hover:text-red-800 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Удалить креатив"
                              >
                                {deletingCreative === creative.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                ) : (
                                  <svg 
                                    className="h-5 w-5" 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                  </svg>
                                )}
                              </button>
                            </td>

                          </tr>
                          {/* Раскрытые правки - стиль как в CreativePanel */}
                          {isEditsExpanded && (() => {
                            const totalEdits = edits.length;
                            return edits.map((edit, editIndex) => {
                              const editDateTime = formatKyivTime(edit.created_at);
                              // Numbering: newest first, so #totalEdits, #totalEdits-1, ..., #1
                              const editNumber = totalEdits - editIndex;

                              return (
                                <tr
                                  key={`edit-expanded-${edit.id}`}
                                  className="border-l-4 border-yellow-400 hover:bg-yellow-100/50 transition-colors"
                                  style={{ backgroundColor: '#fffffe66' }}
                                >
                                  {/* Колонка "Правки" - индикатор дерева └─ */}
                                  <td className="px-1 py-2 whitespace-nowrap text-sm" style={{ backgroundColor: '#fffffe66' }}>
                                    <div className="flex items-center justify-center pl-4">
                                      <span className="text-yellow-500 text-lg">└─</span>
                                    </div>
                                  </td>
                                  {/* Дата правки - как у обычных креативов с местом для карандаша */}
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-center" style={{ backgroundColor: '#fffffe66' }}>
                                    <div className="flex items-center justify-center gap-1">
                                      <div className="cursor-text select-text">
                                        <div className="font-medium" style={{ color: '#a16207' }}>{editDateTime.date}</div>
                                        <div className="text-xs" style={{ color: '#a16207' }}>{editDateTime.time}</div>
                                      </div>
                                      {/* Placeholder для карандаша - как у обычных креативов */}
                                      <div className="ml-1 p-1 w-[22px] h-[22px]"></div>
                                    </div>
                                  </td>
                                  {/* Артикул - "Правка #N" с иконкой комментария */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}>
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
                                      <span style={{ color: '#a16207' }} className="text-sm font-medium">Правка #{editNumber}</span>
                                    </div>
                                  </td>
                                  {/* Монтажер с аватаркой */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}>
                                    <div className="flex items-center space-x-2">
                                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                        {getEditorAvatar(creative.user_id) ? (
                                          <img
                                            src={getEditorAvatar(creative.user_id)}
                                            alt=""
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
                                      <span className="text-sm" style={{ color: '#a16207' }}>
                                        {edit.editor_name || creative.editor_name || getEditorName(creative.user_id) || '—'}
                                      </span>
                                    </div>
                                  </td>
                                  {/* Видео из правки */}
                                  <td className="px-3 py-2 text-sm" style={{ backgroundColor: '#fffffe66' }}>
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
                                  {/* Пустые ячейки для метрик */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* Пустая ячейка для колонки Зоны */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  {/* COF с типами работ */}
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
                                    ) : null}
                                  </td>
                                  {/* Trello, Статус, Buyer, Searcher, Действия - пустые */}
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
                                  <td className="px-3 py-2" style={{ backgroundColor: '#fffffe66' }}></td>
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

      {/* Date Edit Modal */}
      {showDateEditModal && editingCreative && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                Редактировать дату
              </h3>
              <button
                onClick={closeDateEditModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Креатив: <span className="font-medium text-gray-900">{editingCreative.article}</span>
              </p>
            </div>

            {dateEditError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{dateEditError}</p>
              </div>
            )}

            {/* Calendar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => {
                    const newMonth = new Date(dateEditCalendarMonth);
                    newMonth.setMonth(newMonth.getMonth() - 1);
                    setDateEditCalendarMonth(newMonth);
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronUp className="h-5 w-5 text-gray-600 rotate-[-90deg]" />
                </button>
                <span className="font-medium text-gray-900">
                  {dateEditCalendarMonth.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => {
                    const newMonth = new Date(dateEditCalendarMonth);
                    newMonth.setMonth(newMonth.getMonth() + 1);
                    setDateEditCalendarMonth(newMonth);
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronDown className="h-5 w-5 text-gray-600 rotate-[-90deg]" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
                <div>Пн</div>
                <div>Вт</div>
                <div>Ср</div>
                <div>Чт</div>
                <div>Пт</div>
                <div>Сб</div>
                <div>Нд</div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonthForEdit(dateEditCalendarMonth);
                  const days = [];

                  // Empty cells for days before the first day of the month
                  for (let i = 0; i < startingDayOfWeek; i++) {
                    days.push(<div key={`empty-${i}`} className="p-2"></div>);
                  }

                  // Days of the month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = editDate === dateStr;
                    const isToday = new Date().toISOString().slice(0, 10) === dateStr;

                    days.push(
                      <button
                        key={day}
                        onClick={() => handleDateEditCalendarClick(day, month, year)}
                        className={`p-2 text-sm rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : isToday
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  }

                  return days;
                })()}
              </div>
            </div>

            {/* Time Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="h-4 w-4 inline mr-1" />
                Время
              </label>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Selected Date/Time Preview */}
            <div className="mb-6 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                Новая дата и время:{' '}
                <span className="font-medium text-gray-900">
                  {editDate && editTime
                    ? `${editDate.split('-').reverse().join('.')} ${editTime}`
                    : 'Не выбрано'}
                </span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeDateEditModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Отмена
              </button>
              <button
                onClick={saveCreativeDate}
                disabled={savingDate || !editDate || !editTime}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  savingDate || !editDate || !editTime
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {savingDate ? (
                  <span className="flex items-center">
                    <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                    Сохранение...
                  </span>
                ) : (
                  'Сохранить'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      {/* End Scrollable Content Area */}
    </div>
  );
}

export default CreativeAnalytics;
