// LandingPanel.js - Полностью переписанная версия для лендингов
// Заменяет все упоминания креативов на лендинги

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, landingService, userService, landingHistoryService, metricsAnalyticsService, trelloService } from '../supabaseClient';
import { useBatchMetrics, useMetricsStats } from '../hooks/useMetrics';
import { useZoneData } from '../hooks/useZoneData';
import { 
  Plus, 
  X, 
  Calendar,
  Eye,
  Trash2,
  RefreshCw,
  AlertCircle,
  Video,
  User,
  TrendingUp,
  BarChart3,
  MessageCircle,
  ExternalLink,
  Clock,
  MoreHorizontal,
  Edit,
  Users,
  Target,
  DollarSign,
  MousePointer,
  ChevronDown,
  ChevronUp,
  Globe,
  Star,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Palette
} from 'lucide-react';

function LandingPanel({ user }) {
  const [landings, setLandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLanding, setEditingLanding] = useState(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [landingsWithHistory, setLandingsWithHistory] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [metricsPeriod, setMetricsPeriod] = useState('all');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [expandedTags, setExpandedTags] = useState(new Set());
  const [openDropdowns, setOpenDropdowns] = useState(new Set());
  const [trelloStatuses, setTrelloStatuses] = useState(new Map());
  const [trelloLists, setTrelloLists] = useState([]);
  const [syncingLandings, setSyncingLandings] = useState(new Set());
  
  // Состояния для фильтрации по периоду дат
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
  
  // Состояния для переключения метрик
  const [detailMode, setDetailMode] = useState(new Map());
  const [currentVideoIndex, setCurrentVideoIndex] = useState(new Map());
  
  const [selectedBuyer, setSelectedBuyer] = useState('all');
  const [selectedSearcher, setSelectedSearcher] = useState('all');
  
  const [newLanding, setNewLanding] = useState({
    article: '',
    template: '',
    tags: [],
    comment: '',
    is_poland: false,
    trello_link: '',
    designer_id: null,
    buyer_id: null,
    searcher_id: null
  });

  const [editLanding, setEditLanding] = useState({
    article: '',
    template: '',
    tags: [],
    comment: '',
    is_poland: false,
    trello_link: '',
    designer_id: null,
    buyer_id: null,
    searcher_id: null
  });
  
  const [buyers, setBuyers] = useState([]);
  const [searchers, setSearchers] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [showSearcherDropdown, setShowSearcherDropdown] = useState(false);
  const [showDesignerDropdown, setShowDesignerDropdown] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Доступные теги для лендингов
  const availableTags = [
    'SEO',
    'Адаптив',
    'Анимация',
    'Форма',
    'Интеграция',
    'Мультиязычность'
  ];

  // Доступные шаблоны
  const templateOptions = [
    'Шаблон 1',
    'Шаблон 2',
    'Шаблон 3',
    'Шаблон 4',
    'Шаблон 5'
  ];

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

  // Фильтрация лендингов
  const filteredLandings = useMemo(() => {
    let landingsToFilter = landings;
    
    // Фильтрация по байеру
    if (selectedBuyer !== 'all') {
      landingsToFilter = landingsToFilter.filter(l => l.buyer_id === selectedBuyer);
    }
    
    // Фильтрация по серчеру
    if (selectedSearcher !== 'all') {
      landingsToFilter = landingsToFilter.filter(l => l.searcher_id === selectedSearcher);
    }
    
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

    if (selectedPeriod === 'today') {
      landingsToFilter = landingsToFilter.filter(l => {
        const createdDate = new Date(l.created_at);
        return createdDate >= todayStart && createdDate <= todayEnd;
      });
    } else if (selectedPeriod === 'yesterday') {
      landingsToFilter = landingsToFilter.filter(l => {
        const createdDate = new Date(l.created_at);
        return createdDate >= yesterdayStart && createdDate <= yesterdayEnd;
      });
    } else if (selectedPeriod === 'this_week') {
      landingsToFilter = landingsToFilter.filter(l => {
        const createdDate = new Date(l.created_at);
        return createdDate >= thisWeekStart && createdDate <= thisWeekEnd;
      });
    } else if (selectedPeriod === 'last_7_days') {
      landingsToFilter = landingsToFilter.filter(l => {
        const createdDate = new Date(l.created_at);
        return createdDate >= last7DaysStart && createdDate <= todayEnd;
      });
    } else if (selectedPeriod === 'this_month') {
      landingsToFilter = landingsToFilter.filter(l => {
        const createdDate = new Date(l.created_at);
        return createdDate >= thisMonthStart && createdDate <= thisMonthEnd;
      });
    } else if (selectedPeriod === 'last_month') {
      landingsToFilter = landingsToFilter.filter(l => {
        const createdDate = new Date(l.created_at);
        return createdDate >= lastMonthStart && createdDate <= lastMonthEnd;
      });
    } else if (selectedPeriod === 'custom' && customDateFrom && customDateTo) {
      const customFrom = new Date(customDateFrom);
      customFrom.setHours(0, 0, 0, 0);
      const customTo = new Date(customDateTo);
      customTo.setHours(23, 59, 59);
      
      landingsToFilter = landingsToFilter.filter(l => {
        const createdDate = new Date(l.created_at);
        return createdDate >= customFrom && createdDate <= customTo;
      });
    }
    
    return landingsToFilter;
  }, [landings, selectedBuyer, selectedSearcher, selectedPeriod, customDateFrom, customDateTo]);

  // Хуки для метрик
  const [metricsLastUpdate, setMetricsLastUpdate] = useState(null);

  const { 
    batchMetrics, 
    loading: metricsLoading, 
    error: metricsError,
    stats: metricsStats,
    getCreativeMetrics,
    refresh: refreshMetrics,
    loadFromCache,
    loadMetricsForSingleCreative,
    loadingCreativeIds
  } = useBatchMetrics(filteredLandings, true, metricsPeriod);

  const { 
    stats: aggregatedMetricsStats,
    formatStats,
    hasData: hasMetricsData 
  } = useMetricsStats(filteredLandings, batchMetrics);

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
  } = useZoneData(filteredLandings, true);

  // Получение агрегированных метрик для лендинга
  const getAggregatedLandingMetrics = (landing) => {
    const landingMetrics = getCreativeMetrics(landing.id);
    
    if (!landingMetrics || landingMetrics.length === 0) {
      return null;
    }

    const validMetrics = landingMetrics.filter(metric => metric.found && metric.data);
    
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

    const avgDuration = validMetrics.length > 0 ? aggregated.avg_duration / validMetrics.length : 0;

    const cpl = aggregated.leads > 0 ? aggregated.cost / aggregated.leads : 0;
    const ctr = aggregated.impressions > 0 ? (aggregated.clicks_on_link / aggregated.impressions) * 100 : 0;
    const cpc = aggregated.clicks > 0 ? aggregated.cost / aggregated.clicks : 0;
    const cpm = aggregated.impressions > 0 ? (aggregated.cost_from_sources / aggregated.impressions) * 1000 : 0;

    return {
      found: true,
      videoCount: validMetrics.length,
      totalVideos: landingMetrics.length,
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

  // Компонент отображения зональных данных
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

  // Статистика по тегам
  const getTagsStats = (landingsData) => {
    const allTags = landingsData.reduce((acc, landing) => {
      if (landing.tags && Array.isArray(landing.tags)) {
        landing.tags.forEach(tag => {
          acc[tag] = (acc[tag] || 0) + 1;
        });
      }
      return acc;
    }, {});
    
    return allTags;
  };

  // Подсчет по странам
  const getCountryStats = (landingsData) => {
    const ukraineCount = landingsData.filter(l => !l.is_poland).length;
    const polandCount = landingsData.filter(l => l.is_poland).length;
    return { ukraineCount, polandCount };
  };

  // Подсчет по зонам
  const getZoneStats = (landingsData) => {
    const zoneCount = { red: 0, pink: 0, gold: 0, green: 0 };
    
    landingsData.forEach(landing => {
      const aggregatedMetrics = getAggregatedLandingMetrics(landing);
      if (aggregatedMetrics?.found && aggregatedMetrics.data) {
        const cplString = aggregatedMetrics.data.formatted.cpl;
        const cplValue = parseFloat(cplString.replace('$', ''));
        
        if (!isNaN(cplValue)) {
          const currentZone = getCurrentZoneByMetrics(landing.article, cplValue);
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

  useEffect(() => {
    loadUsers();
    loadLandings();
    loadLastUpdateTime();
    
    // Подписка на создание новых лендингов
    const landingsSubscription = supabase
      .channel('landings_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'landings'
        },
        async (payload) => {
          console.log('🆕 Новый лендинг создан:', payload.new.article);
          
          if (payload.new.trello_link) {
            console.log('⏳ Ждем синхронизации Trello статуса для', payload.new.article);
            
            setTimeout(async () => {
              try {
                console.log('🔍 Проверяем статус для', payload.new.id);
                const status = await trelloService.getCardStatus(payload.new.id);
                
                if (status) {
                  console.log('✅ Статус получен:', status.list_name);
                  setTrelloStatuses(prev => {
                    const newMap = new Map(prev);
                    newMap.set(payload.new.id, status);
                    return newMap;
                  });
                } else {
                  console.log('⚠️ Статус еще не синхронизирован, перезагружаем все статусы...');
                  loadTrelloStatuses();
                }
              } catch (error) {
                console.error('❌ Ошибка получения статуса:', error);
                loadTrelloStatuses();
              }
            }, 2000);
          }
        }
      )
      .subscribe();
    
    // Подписка на изменения статусов Trello
    const trelloSubscription = trelloService.subscribeToCardStatuses((payload) => {
      console.log('🔄 Trello status changed:', payload);
      
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        console.log('➕ Обновляем статус для лендинга:', payload.new.creative_id);
        setTrelloStatuses(prev => {
          const newMap = new Map(prev);
          newMap.set(payload.new.creative_id, payload.new);
          return newMap;
        });
      } else if (payload.eventType === 'DELETE') {
        console.log('➖ Удаляем статус для лендинга:', payload.old.creative_id);
        setTrelloStatuses(prev => {
          const newMap = new Map(prev);
          newMap.delete(payload.old.creative_id);
          return newMap;
        });
      }
    });
    
    return () => {
      landingsSubscription.unsubscribe();
      trelloSubscription.unsubscribe();
    };
  }, []);

  // Загрузка Trello статусов после загрузки лендингов
  useEffect(() => {
    if (landings && landings.length > 0) {
      console.log('🟢 Запускаем loadTrelloStatuses...');
      loadTrelloStatuses();
    }
  }, [landings]);

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
      
      const lists = await trelloService.getAllLists();
      setTrelloLists(lists);
      console.log(`✅ Загружено ${lists.length} списков Trello`);
      
      const landingIds = landings.map(l => l.id);
      console.log(`🔍 Запрос статусов для ${landingIds.length} лендингов`);
      
      if (landingIds.length > 0) {
        const statusMap = await trelloService.getBatchCardStatuses(landingIds);
        setTrelloStatuses(statusMap);
        console.log(`✅ Установлено ${statusMap.size} статусов в состояние`);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки Trello статусов:', error);
    }
  };

  // Синхронизация только лендингов без статуса
  const syncMissingTrelloStatuses = async () => {
    try {
      console.log('🔄 Синхронизация лендингов без статуса...');
      
      const landingsWithoutStatus = filteredLandings.filter(landing => {
        const hasLink = !!landing.trello_link;
        const status = getTrelloListName(landing.id);
        const hasStatus = status && status !== '—';
        return hasLink && !hasStatus;
      });
      
      if (landingsWithoutStatus.length === 0) {
        console.log('✅ Все лендинги уже имеют статусы');
        setSuccess('Все лендинги уже синхронизированы');
        setTimeout(() => setSuccess(''), 3000);
        return;
      }
      
      console.log(`⚠️ Найдено ${landingsWithoutStatus.length} лендингов без статуса`);
      
      const syncingIds = new Set(landingsWithoutStatus.map(l => l.id));
      setSyncingLandings(syncingIds);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const landing of landingsWithoutStatus) {
        try {
          console.log(`🔄 Синхронизация ${landing.article}...`);
          
          const result = await trelloService.syncSingleCreative(
            landing.id,
            landing.trello_link
          );
          
          if (result.success) {
            console.log(`✅ Статус синхронизирован: ${result.listName}`);
            
            setTrelloStatuses(prev => {
              const updated = new Map(prev);
              updated.set(landing.id, {
                creative_id: landing.id,
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
          console.error(`❌ Ошибка синхронизации ${landing.article}:`, error.message);
          errorCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      setSyncingLandings(new Set());
      
      if (successCount > 0 || errorCount > 0) {
        const message = `Синхронизация завершена: успешно ${successCount}, ошибок ${errorCount}`;
        console.log(`🎉 ${message}`);
        setSuccess(message);
        setTimeout(() => setSuccess(''), 5000);
      }
      
    } catch (error) {
      console.error('❌ Ошибка синхронизации:', error);
      setSyncingLandings(new Set());
      setError(`Ошибка синхронизации: ${error.message}`);
      setTimeout(() => setError(''), 5000);
    }
  };

  // Получить название списка для лендинга
  const getTrelloListName = (landingId) => {
    const status = trelloStatuses.get(landingId);
    return status?.list_name || '—';
  };

  const loadLandings = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('📡 Загрузка лендингов пользователя...');
      const data = await landingService.getUserLandings(user.id);
      setLandings(data);
      console.log(`✅ Загружено ${data.length} лендингов`);
      
      const landingsWithHistorySet = new Set();
      for (const landing of data) {
        const hasHistory = await landingHistoryService.hasHistory(landing.id);
        if (hasHistory) {
          landingsWithHistorySet.add(landing.id);
        }
      }
      setLandingsWithHistory(landingsWithHistorySet);
      
      return data;
    } catch (error) {
      console.error('❌ Ошибка загрузки лендингов:', error);
      setError('Ошибка загрузки лендингов: ' + error.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      console.log('👥 Загрузка пользователей...');
      
      const [buyersData, searchersData, designersData] = await Promise.all([
        userService.getUsersByRole('buyer'),
        userService.getUsersByRole('search_manager'),
        userService.getUsersByRole('designer')
      ]);
      
      setBuyers(buyersData);
      setSearchers(searchersData);
      setDesigners(designersData);
      console.log(`✅ Загружено ${buyersData.length} байеров, ${searchersData.length} серчеров и ${designersData.length} дизайнеров`);
    } catch (error) {
      console.error('❌ Ошибка загрузки пользователей:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateLanding = async () => {
    if (!validateFields()) {
      return;
    }

    try {
      setCreating(true);
      setError('');
      setSuccess('');

      const buyerName = newLanding.buyer_id ? getBuyerName(newLanding.buyer_id) : null;
      const searcherName = newLanding.searcher_id ? getSearcherName(newLanding.searcher_id) : null;
      const designerName = newLanding.designer_id ? getDesignerName(newLanding.designer_id) : null;

      const newLandingData = await landingService.createLanding({
        user_id: user.id,
        content_manager_name: user.name,
        article: newLanding.article.trim(),
        template: newLanding.template,
        tags: newLanding.tags,
        comment: newLanding.comment.trim() || null,
        is_poland: newLanding.is_poland,
        trello_link: newLanding.trello_link.trim(),
        designer_id: newLanding.designer_id,
        buyer_id: newLanding.buyer_id,
        searcher_id: newLanding.searcher_id,
        designer: designerName !== '—' ? designerName : null,
        buyer: buyerName !== '—' ? buyerName : null,
        searcher: searcherName !== '—' ? searcherName : null
      });

      console.log('✅ Лендинг создан в БД:', newLandingData);

      if (newLandingData.trello_link) {
        console.log('🔄 Синхронизация Trello статуса через Netlify Function...');
        try {
          const syncResponse = await fetch('/.netlify/functions/trello-sync-single', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              creativeId: newLandingData.id,
              trelloLink: newLandingData.trello_link
            })
          });

          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            console.log('✅ Trello статус синхронизирован:', syncResult.listName);
            
            setTrelloStatuses(prev => {
              const updated = new Map(prev);
              updated.set(newLandingData.id, {
                creative_id: newLandingData.id,
                list_name: syncResult.listName,
                list_id: syncResult.listId,
                trello_card_id: syncResult.cardId,
                last_updated: new Date().toISOString()
              });
              return updated;
            });
          }
        } catch (syncError) {
          console.error('❌ Ошибка вызова Netlify Function:', syncError);
        }
      }

      setLandings(prevLandings => [newLandingData, ...prevLandings]);

      setNewLanding({
        article: '',
        template: '',
        tags: [],
        comment: '',
        is_poland: false,
        trello_link: '',
        designer_id: null,
        buyer_id: null,
        searcher_id: null
      });
      setShowCreateModal(false);

      await loadMetricsForSingleCreative(newLandingData);
      await refreshZoneData();
      
      const country = newLanding.is_poland ? 'PL' : 'UA';
      setSuccess(`Лендинг создан! Страна: ${country} | Шаблон: ${newLanding.template} | Теги: ${newLanding.tags.length}`);
      
    } catch (error) {
      setError('Ошибка создания лендинга: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEditLanding = (landing) => {
    console.log('✏️ Открытие редактирования лендинга:', landing.article);
    
    setEditingLanding(landing);
    setEditLanding({
      article: landing.article,
      template: landing.template || '',
      tags: landing.tags || [],
      comment: landing.comment || '',
      is_poland: landing.is_poland || false,
      trello_link: landing.trello_link || '',
      designer_id: landing.designer_id || null,
      buyer_id: landing.buyer_id || null,
      searcher_id: landing.searcher_id || null
    });
    setShowEditModal(true);
    clearMessages();
  };

  const handleUpdateLanding = async () => {
    if (!validateEditFields()) {
      return;
    }

    try {
      setUpdating(true);
      setError('');
      setSuccess('');

      const buyerName = editLanding.buyer_id ? getBuyerName(editLanding.buyer_id) : null;
      const searcherName = editLanding.searcher_id ? getSearcherName(editLanding.searcher_id) : null;
      const designerName = editLanding.designer_id ? getDesignerName(editLanding.designer_id) : null;

      // Сохраняем старое состояние в историю ПЕРЕД обновлением
      await landingHistoryService.createHistoryEntry({
        landing_id: editingLanding.id,
        article: editingLanding.article,
        template: editingLanding.template,
        tags: editingLanding.tags,
        comment: editingLanding.comment,
        is_poland: editingLanding.is_poland,
        trello_link: editingLanding.trello_link,
        designer_id: editingLanding.designer_id,
        buyer_id: editingLanding.buyer_id,
        searcher_id: editingLanding.searcher_id,
        designer: editingLanding.designer,
        buyer: editingLanding.buyer,
        searcher: editingLanding.searcher,
        changed_by_id: user.id,
        changed_by_name: user.name,
        change_type: 'updated'
      });

      await landingService.updateLanding(editingLanding.id, {
        template: editLanding.template,
        tags: editLanding.tags,
        comment: editLanding.comment.trim() || null,
        is_poland: editLanding.is_poland,
        trello_link: editLanding.trello_link.trim(),
        designer_id: editLanding.designer_id,
        buyer_id: editLanding.buyer_id,
        searcher_id: editLanding.searcher_id,
        designer: designerName !== '—' ? designerName : null,
        buyer: buyerName !== '—' ? buyerName : null,
        searcher: searcherName !== '—' ? searcherName : null
      });

      setEditLanding({
        article: '',
        template: '',
        tags: [],
        comment: '',
        is_poland: false,
        trello_link: '',
        designer_id: null,
        buyer_id: null,
        searcher_id: null
      });
      setEditingLanding(null);
      setShowEditModal(false);

      await loadLandings();
      
      const country = editLanding.is_poland ? 'PL' : 'UA';
      setSuccess(`Лендинг обновлен! Страна: ${country} | Шаблон: ${editLanding.template} | Теги: ${editLanding.tags.length}`);
    } catch (error) {
      setError('Ошибка обновления лендинга: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteLanding = async (landingId, article) => {
    if (!window.confirm(`Вы уверены, что хотите удалить лендинг "${article}"?`)) {
      return;
    }

    try {
      await landingService.deleteLanding(landingId);
      await loadLandings();
      setSuccess('Лендинг удален');
    } catch (error) {
      setError('Ошибка удаления лендинга: ' + error.message);
    }
  };

  const handleTagChange = (tag, isChecked) => {
    let updatedTags;
    if (isChecked) {
      updatedTags = [...newLanding.tags, tag];
    } else {
      updatedTags = newLanding.tags.filter(t => t !== tag);
    }
    
    setNewLanding({
      ...newLanding,
      tags: updatedTags
    });
    clearFieldError('tags');
  };

  const showComment = (landing) => {
    setSelectedComment({
      article: landing.article,
      comment: landing.comment,
      createdAt: landing.created_at,
      contentManagerName: landing.content_manager_name
    });
    setShowCommentModal(true);
  };

  const showHistory = async (landing) => {
    setLoadingHistory(true);
    setShowHistoryModal(true);
    setSelectedHistory(landing);
    
    try {
      const history = await landingHistoryService.getLandingHistory(landing.id);
      setHistoryData(history);
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
      setError('Ошибка загрузки истории: ' + error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleTags = (landingId) => {
    const newExpanded = new Set(expandedTags);
    if (newExpanded.has(landingId)) {
      newExpanded.delete(landingId);
    } else {
      newExpanded.add(landingId);
    }
    setExpandedTags(newExpanded);
  };

  const toggleDropdown = (landingId) => {
    const newOpenDropdowns = new Set(openDropdowns);
    if (newOpenDropdowns.has(landingId)) {
      newOpenDropdowns.delete(landingId);
    } else {
      newOpenDropdowns.add(landingId);
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
  };

  const getPeriodButtonText = () => {
    return metricsPeriod === 'all' ? 'Все время' : '4 дня';
  };

  const formatKyivTime = (dateString) => {
    try {
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

  const clearMessages = () => {
    setError('');
    setSuccess('');
    setFieldErrors({});
  };

  const clearFieldError = (fieldName) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  };

  const validateEditFields = () => {
    const errors = {};
    const errorMessages = [];

    if (!editLanding.template) {
      errors.template = true;
      errorMessages.push('Необходимо выбрать шаблон');
    }

    if (!editLanding.designer_id) {
      errors.designer_id = true;
      errorMessages.push('Необходимо выбрать дизайнера');
    }

    if (!editLanding.searcher_id) {
      errors.searcher_id = true;
      errorMessages.push('Необходимо выбрать серчера');
    }

    if (!editLanding.buyer_id) {
      errors.buyer_id = true;
      errorMessages.push('Необходимо выбрать байера');
    }

    if (editLanding.tags.length === 0) {
      errors.tags = true;
      errorMessages.push('Необходимо выбрать хотя бы один тег');
    }

    if (!editLanding.trello_link.trim()) {
      errors.trello_link = true;
      errorMessages.push('Карточка Trello обязательна для заполнения');
    } else {
      const trimmedTrelloLink = editLanding.trello_link.trim();
      if (!trimmedTrelloLink.startsWith('https://trello.com/c/') && 
          !trimmedTrelloLink.startsWith('trello.com/c/')) {
        errors.trello_link = true;
        errorMessages.push('Проверьте правильность ссылки на Trello');
      }
    }

    setFieldErrors(errors);
    
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

    if (!newLanding.article.trim()) {
      errors.article = true;
      errorMessages.push('Артикул обязателен для заполнения');
    }

    if (!newLanding.template) {
      errors.template = true;
      errorMessages.push('Выберите шаблон');
    }

    if (!newLanding.designer_id) {
      errors.designer_id = true;
      errorMessages.push('Выберите дизайнера');
    }

    if (!newLanding.searcher_id) {
      errors.searcher_id = true;
      errorMessages.push('Выберите серчера');
    }

    if (!newLanding.buyer_id) {
      errors.buyer_id = true;
      errorMessages.push('Выберите байера');
    }

    if (newLanding.tags.length === 0) {
      errors.tags = true;
      errorMessages.push('Выберите хотя бы один тег');
    }

    if (!newLanding.trello_link.trim()) {
      errors.trello_link = true;
      errorMessages.push('Карточка Trello обязательна для заполнения');
    } else {
      const trimmedTrelloLink = newLanding.trello_link.trim();
      if (!trimmedTrelloLink.startsWith('https://trello.com/c/') && 
          !trimmedTrelloLink.startsWith('trello.com/c/')) {
        errors.trello_link = true;
        errorMessages.push('Проверьте правильность ссылки на Trello');
      }
    }

    setFieldErrors(errors);
    
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

  const getDesignerName = (designerId) => {
    if (!designerId) return '—';
    const designer = designers.find(d => d.id === designerId);
    return designer ? designer.name : 'Удален';
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

  const getDesignerAvatar = (designerId) => {
    if (!designerId) return null;
    const designer = designers.find(d => d.id === designerId);
    return designer ? designer.avatar_url : null;
  };

  const getSelectedBuyer = () => {
    if (!newLanding.buyer_id) return null;
    return buyers.find(b => b.id === newLanding.buyer_id);
  };

  const getSelectedSearcher = () => {
    if (!newLanding.searcher_id) return null;
    return searchers.find(s => s.id === newLanding.searcher_id);
  };

  const getSelectedDesigner = () => {
    if (!newLanding.designer_id) return null;
    return designers.find(d => d.id === newLanding.designer_id);
  };

  const handleRefreshAll = async () => {
    console.log(`🔄 Обновление только метрик и зональных данных (период: ${metricsPeriod})`);
    await refreshMetrics();
    await refreshZoneData();
    await loadLastUpdateTime();
  };

  const tagsStats = getTagsStats(filteredLandings);
  const countryStats = getCountryStats(filteredLandings);
  const zoneStats = getZoneStats(filteredLandings);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка лендингов...</p>
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
              <h1 className="text-2xl font-semibold text-gray-900">Лендинги</h1>
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
              
              {/* Выпадающее меню с календарем */}
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
                              <ChevronLeft className="h-4 w-4" />
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
                                  <ChevronRight className="h-4 w-4" />
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
                                  <ChevronLeft className="h-4 w-4" />
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
                              <ChevronRight className="h-4 w-4" />
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

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать лендинг
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

      {/* КАРТОЧКИ СТАТИСТИКИ В ДВА РЯДА */}
      {filteredLandings.length > 0 && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          {/* ПЕРВАЯ СТРОКА */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-2 sm:gap-3 md:gap-4 mb-4">
            {/* Лендингов */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Globe className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Лендингов
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {filteredLandings.length}
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
                        {filteredLandings.filter(l => l.comment && l.comment.trim()).length}
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

            {/* Пустая карточка (заполнитель) */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 opacity-0 pointer-events-none">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="h-full"></div>
              </div>
            </div>

            {/* Пустая карточка (заполнитель) */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 opacity-0 pointer-events-none">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="h-full"></div>
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
                          {hasMetricsData ? (filteredLandings.length > 0 && aggregatedMetricsStats.totalLeads > 0 ? 
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
                      <MousePointer className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
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
                          {hasMetricsData ? (filteredLandings.length > 0 ? Math.round(aggregatedMetricsStats.totalLeads / filteredLandings.length) : 0) : '—'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

            </div>
        </div>
      )}

      {/* Content - таблица лендингов */}
      <div className="flex-1 p-6">
        {filteredLandings.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Нет лендингов
            </h3>
            <p className="text-gray-600 mb-4">
              Создайте свой первый лендинг
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать лендинг
            </button>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 text-center">
                Полная аналитика лендингов
              </h3>
              
              <div className="overflow-x-auto" style={{maxHeight: 'calc(100vh - 400px)', overflowY: 'auto'}}>
                <p className="text-center text-gray-500 py-8">Таблица в разработке...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
{showCreateModal && (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div className="relative top-5 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white my-5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Создать новый лендинг
        </h3>
        <button
          onClick={() => {
            setShowCreateModal(false);
            setNewLanding({
              article: '',
              template: '',
              tags: [],
              comment: '',
              is_poland: false,
              trello_link: '',
              designer_id: null,
              buyer_id: null,
              searcher_id: null
            });
            setShowBuyerDropdown(false);
            setShowSearcherDropdown(false);
            setShowDesignerDropdown(false);
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
                value={newLanding.article}
                onChange={(e) => {
                  setNewLanding({ ...newLanding, article: e.target.value });
                  clearFieldError('article');
                }}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  fieldErrors.article 
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder-red-400' 
                    : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                }`}
                placeholder="Введите артикул лендинга"
              />
            </div>
            
            <button
              type="button"
              onClick={() => {
                setNewLanding({ ...newLanding, is_poland: !newLanding.is_poland });
              }}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 border ${
                newLanding.is_poland
                  ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
              }`}
              title={newLanding.is_poland ? 'Переключить на Украину' : 'Переключить на Польшу'}
            >
              {newLanding.is_poland ? <PolandFlag /> : <UkraineFlag />}
              <span className="ml-2">
                {newLanding.is_poland ? 'Poland' : 'Ukraine'}
              </span>
            </button>
          </div>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${fieldErrors.template ? 'text-red-600' : 'text-gray-700'}`}>
            Шаблон *
          </label>
          <select
            value={newLanding.template}
            onChange={(e) => {
              setNewLanding({ ...newLanding, template: e.target.value });
              clearFieldError('template');
            }}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              fieldErrors.template 
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900' 
                : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
            }`}
          >
            <option value="">Выберите шаблон</option>
            {templateOptions.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${fieldErrors.tags ? 'text-red-600' : 'text-gray-700'}`}>
            Теги * ({newLanding.tags.length} выбрано)
          </label>
          <div className={`max-h-48 overflow-y-auto border rounded-md p-3 bg-gray-50 ${
            fieldErrors.tags ? 'border-red-300' : 'border-gray-300'
          }`}>
            <div className="grid grid-cols-1 gap-2">
              {availableTags.map((tag) => (
                <label key={tag} className="flex items-center p-2 hover:bg-white rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newLanding.tags.includes(tag)}
                    onChange={(e) => {
                      let updatedTags;
                      if (e.target.checked) {
                        updatedTags = [...newLanding.tags, tag];
                      } else {
                        updatedTags = newLanding.tags.filter(t => t !== tag);
                      }
                      setNewLanding({ ...newLanding, tags: updatedTags });
                      clearFieldError('tags');
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 select-none">{tag}</span>
                </label>
              ))}
            </div>
          </div>
          {newLanding.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {newLanding.tags.map((tag, index) => (
                <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      const updatedTags = newLanding.tags.filter(t => t !== tag);
                      setNewLanding({ ...newLanding, tags: updatedTags });
                    }}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${fieldErrors.trello_link ? 'text-red-600' : 'text-gray-700'}`}>
            Карточка Trello *
          </label>
          <input
            type="url"
            value={newLanding.trello_link}
            onChange={(e) => {
              setNewLanding({ ...newLanding, trello_link: e.target.value });
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

        <div className="grid grid-cols-3 gap-4">
          {/* Designer Dropdown */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${fieldErrors.designer_id ? 'text-red-600' : 'text-gray-700'}`}>
              Designer *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!loadingUsers) {
                    setShowDesignerDropdown(!showDesignerDropdown);
                    setShowBuyerDropdown(false);
                    setShowSearcherDropdown(false);
                  }
                }}
                disabled={loadingUsers}
                className="designer-trigger w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50"
              >
                <div className="flex items-center space-x-2 flex-1">
                  {getSelectedDesigner() ? (
                    <>
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                        {getSelectedDesigner().avatar_url ? (
                          <img
                            src={getSelectedDesigner().avatar_url}
                            alt="Designer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center ${getSelectedDesigner().avatar_url ? 'hidden' : ''}`}>
                          <User className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      <span className="text-gray-900 truncate">{getSelectedDesigner().name}</span>
                    </>
                  ) : (
                    <span className="text-gray-500">Выберите</span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {getSelectedDesigner() && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewLanding({ ...newLanding, designer_id: null });
                        clearFieldError('designer_id');
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
              
              {showDesignerDropdown && !loadingUsers && (
                <div className="designer-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {designers.map((designer) => (
                    <button
                      key={designer.id}
                      type="button"
                      onClick={() => {
                        setNewLanding({ ...newLanding, designer_id: designer.id });
                        setShowDesignerDropdown(false);
                        clearFieldError('designer_id');
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                        {designer.avatar_url ? (
                          <img
                            src={designer.avatar_url}
                            alt="Designer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center ${designer.avatar_url ? 'hidden' : ''}`}>
                          <User className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      <span className="text-gray-900 truncate">{designer.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Buyer Dropdown */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${fieldErrors.buyer_id ? 'text-red-600' : 'text-gray-700'}`}>
              Buyer *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!loadingUsers) {
                    setShowBuyerDropdown(!showBuyerDropdown);
                    setShowSearcherDropdown(false);
                    setShowDesignerDropdown(false);
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
                      <span className="text-gray-900 truncate">{getSelectedBuyer().name}</span>
                    </>
                  ) : (
                    <span className="text-gray-500">Выберите</span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {getSelectedBuyer() && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewLanding({ ...newLanding, buyer_id: null });
                        clearFieldError('buyer_id');
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
                        setNewLanding({ ...newLanding, buyer_id: buyer.id });
                        setShowBuyerDropdown(false);
                        clearFieldError('buyer_id');
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
                      <span className="text-gray-900 truncate">{buyer.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Searcher Dropdown */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${fieldErrors.searcher_id ? 'text-red-600' : 'text-gray-700'}`}>
              Searcher *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!loadingUsers) {
                    setShowSearcherDropdown(!showSearcherDropdown);
                    setShowBuyerDropdown(false);
                    setShowDesignerDropdown(false);
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
                      <span className="text-gray-900 truncate">{getSelectedSearcher().name}</span>
                    </>
                  ) : (
                    <span className="text-gray-500">Выберите</span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {getSelectedSearcher() && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewLanding({ ...newLanding, searcher_id: null });
                        clearFieldError('searcher_id');
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
                        setNewLanding({ ...newLanding, searcher_id: searcher.id });
                        setShowSearcherDropdown(false);
                        clearFieldError('searcher_id');
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
                      <span className="text-gray-900 truncate">{searcher.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Комментарий
          </label>
          <textarea
            value={newLanding.comment}
            onChange={(e) => {
              setNewLanding({ ...newLanding, comment: e.target.value });
            }}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Добавьте комментарий к лендингу (необязательно)"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={() => {
            setShowCreateModal(false);
            setNewLanding({
              article: '',
              template: '',
              tags: [],
              comment: '',
              is_poland: false,
              trello_link: '',
              designer_id: null,
              buyer_id: null,
              searcher_id: null
            });
            setShowBuyerDropdown(false);
            setShowSearcherDropdown(false);
            setShowDesignerDropdown(false);
            clearMessages();
          }}
          disabled={creating}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Отменить
        </button>
        <button
          onClick={handleCreateLanding}
          disabled={creating}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {creating ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Создание...
            </div>
          ) : (
            <div className="flex items-center">
              <span>Создать лендинг</span>
              <div className="ml-2">
                {newLanding.is_poland ? <PolandFlag /> : <UkraineFlag />}
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  </div>
)}

{/* Edit Modal - ПОЛНАЯ ВЕРСИЯ */}
{showEditModal && editingLanding && (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div className="relative top-5 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white my-5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Редактировать лендинг
        </h3>
        <button
          onClick={() => {
            setShowEditModal(false);
            setEditingLanding(null);
            setEditLanding({
              article: '',
              template: '',
              tags: [],
              comment: '',
              is_poland: false,
              trello_link: '',
              designer_id: null,
              buyer_id: null,
              searcher_id: null
            });
            setShowBuyerDropdown(false);
            setShowSearcherDropdown(false);
            setShowDesignerDropdown(false);
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
                value={editLanding.article}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
              />
            </div>
            
            <button
              type="button"
              onClick={() => {
                setEditLanding({ ...editLanding, is_poland: !editLanding.is_poland });
              }}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 border ${
                editLanding.is_poland
                  ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
              }`}
              title={editLanding.is_poland ? 'Переключить на Украину' : 'Переключить на Польшу'}
            >
              {editLanding.is_poland ? <PolandFlag /> : <UkraineFlag />}
              <span className="ml-2">
                {editLanding.is_poland ? 'Poland' : 'Ukraine'}
              </span>
            </button>
          </div>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${fieldErrors.template ? 'text-red-600' : 'text-gray-700'}`}>
            Шаблон *
          </label>
          <select
            value={editLanding.template}
            onChange={(e) => {
              setEditLanding({ ...editLanding, template: e.target.value });
              clearFieldError('template');
            }}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              fieldErrors.template 
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900' 
                : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
            }`}
          >
            <option value="">Выберите шаблон</option>
            {templateOptions.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${fieldErrors.tags ? 'text-red-600' : 'text-gray-700'}`}>
            Теги * ({editLanding.tags.length} выбрано)
          </label>
          <div className={`max-h-48 overflow-y-auto border rounded-md p-3 bg-gray-50 ${
            fieldErrors.tags ? 'border-red-300' : 'border-gray-300'
          }`}>
            <div className="grid grid-cols-1 gap-2">
              {availableTags.map((tag) => (
                <label key={tag} className="flex items-center p-2 hover:bg-white rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editLanding.tags.includes(tag)}
                    onChange={(e) => {
                      let updatedTags;
                      if (e.target.checked) {
                        updatedTags = [...editLanding.tags, tag];
                      } else {
                        updatedTags = editLanding.tags.filter(t => t !== tag);
                      }
                      setEditLanding({ ...editLanding, tags: updatedTags });
                      clearFieldError('tags');
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 select-none">{tag}</span>
                </label>
              ))}
            </div>
          </div>
          {editLanding.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {editLanding.tags.map((tag, index) => (
                <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      const updatedTags = editLanding.tags.filter(t => t !== tag);
                      setEditLanding({ ...editLanding, tags: updatedTags });
                    }}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${fieldErrors.trello_link ? 'text-red-600' : 'text-gray-700'}`}>
            Карточка Trello *
          </label>
          <input
            type="url"
            value={editLanding.trello_link}
            onChange={(e) => {
              setEditLanding({ ...editLanding, trello_link: e.target.value });
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

        <div className="grid grid-cols-3 gap-4">
          {/* Designer Dropdown */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${fieldErrors.designer_id ? 'text-red-600' : 'text-gray-700'}`}>
              Designer *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!loadingUsers) {
                    setShowDesignerDropdown(!showDesignerDropdown);
                    setShowBuyerDropdown(false);
                    setShowSearcherDropdown(false);
                  }
                }}
                disabled={loadingUsers}
                className="designer-trigger w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50"
              >
                <div className="flex items-center space-x-2 flex-1">
                  {editLanding.designer_id ? (
                    <>
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                        {getDesignerAvatar(editLanding.designer_id) ? (
                          <img
                            src={getDesignerAvatar(editLanding.designer_id)}
                            alt="Designer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center ${getDesignerAvatar(editLanding.designer_id) ? 'hidden' : ''}`}>
                          <User className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      <span className="text-gray-900 truncate">{getDesignerName(editLanding.designer_id)}</span>
                    </>
                  ) : (
                    <span className="text-gray-500">Выберите</span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {editLanding.designer_id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditLanding({ ...editLanding, designer_id: null });
                        clearFieldError('designer_id');
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
              
              {showDesignerDropdown && !loadingUsers && (
                <div className="designer-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {designers.map((designer) => (
                    <button
                      key={designer.id}
                      type="button"
                      onClick={() => {
                        setEditLanding({ ...editLanding, designer_id: designer.id });
                        setShowDesignerDropdown(false);
                        clearFieldError('designer_id');
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                        {designer.avatar_url ? (
                          <img
                            src={designer.avatar_url}
                            alt="Designer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center ${designer.avatar_url ? 'hidden' : ''}`}>
                          <User className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      <span className="text-gray-900 truncate">{designer.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {loadingUsers && (
              <p className="mt-1 text-xs text-gray-500">Загрузка дизайнеров...</p>
            )}
          </div>

          {/* Buyer Dropdown */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${fieldErrors.buyer_id ? 'text-red-600' : 'text-gray-700'}`}>
              Buyer *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!loadingUsers) {
                    setShowBuyerDropdown(!showBuyerDropdown);
                    setShowSearcherDropdown(false);
                    setShowDesignerDropdown(false);
                  }
                }}
                disabled={loadingUsers}
                className="buyer-trigger w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50"
              >
                <div className="flex items-center space-x-2 flex-1">
                  {editLanding.buyer_id ? (
                    <>
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                        {getBuyerAvatar(editLanding.buyer_id) ? (
                          <img
                            src={getBuyerAvatar(editLanding.buyer_id)}
                            alt="Buyer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center ${getBuyerAvatar(editLanding.buyer_id) ? 'hidden' : ''}`}>
                          <User className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      <span className="text-gray-900 truncate">{getBuyerName(editLanding.buyer_id)}</span>
                    </>
                  ) : (
                    <span className="text-gray-500">Выберите</span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {editLanding.buyer_id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditLanding({ ...editLanding, buyer_id: null });
                        clearFieldError('buyer_id');
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
                        setEditLanding({ ...editLanding, buyer_id: buyer.id });
                        setShowBuyerDropdown(false);
                        clearFieldError('buyer_id');
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
                      <span className="text-gray-900 truncate">{buyer.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {loadingUsers && (
              <p className="mt-1 text-xs text-gray-500">Загрузка байеров...</p>
            )}
          </div>

          {/* Searcher Dropdown */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${fieldErrors.searcher_id ? 'text-red-600' : 'text-gray-700'}`}>
              Searcher *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!loadingUsers) {
                    setShowSearcherDropdown(!showSearcherDropdown);
                    setShowBuyerDropdown(false);
                    setShowDesignerDropdown(false);
                  }
                }}
                disabled={loadingUsers}
                className="searcher-trigger w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50"
              >
                <div className="flex items-center space-x-2 flex-1">
                  {editLanding.searcher_id ? (
                    <>
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                        {getSearcherAvatar(editLanding.searcher_id) ? (
                          <img
                            src={getSearcherAvatar(editLanding.searcher_id)}
                            alt="Searcher"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center ${getSearcherAvatar(editLanding.searcher_id) ? 'hidden' : ''}`}>
                          <Search className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      <span className="text-gray-900 truncate">{getSearcherName(editLanding.searcher_id)}</span>
                    </>
                  ) : (
                    <span className="text-gray-500">Выберите</span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {editLanding.searcher_id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditLanding({ ...editLanding, searcher_id: null });
                        clearFieldError('searcher_id');
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
                        setEditLanding({ ...editLanding, searcher_id: searcher.id });
                        setShowSearcherDropdown(false);
                        clearFieldError('searcher_id');
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
                      <span className="text-gray-900 truncate">{searcher.name}</span>
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
            value={editLanding.comment}
            onChange={(e) => {
              setEditLanding({ ...editLanding, comment: e.target.value });
            }}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Добавьте комментарий к лендингу (необязательно)"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={() => {
            setShowEditModal(false);
            setEditingLanding(null);
            setEditLanding({
              article: '',
              template: '',
              tags: [],
              comment: '',
              is_poland: false,
              trello_link: '',
              designer_id: null,
              buyer_id: null,
              searcher_id: null
            });
            setShowBuyerDropdown(false);
            setShowSearcherDropdown(false);
            setShowDesignerDropdown(false);
            clearMessages();
          }}
          disabled={updating}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Отменить
        </button>
        <button
          onClick={handleUpdateLanding}
          disabled={updating}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {updating ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Обновление...
            </div>
          ) : (
            <div className="flex items-center">
              <span>Обновить лендинг</span>
              <div className="ml-2">
                {editLanding.is_poland ? <PolandFlag /> : <UkraineFlag />}
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
          <p className="text-gray-600 text-sm">
            {formatKyivTime(selectedComment.createdAt).date} {formatKyivTime(selectedComment.createdAt).time}
          </p>
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
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Закрыть
        </button>
      </div>
    </div>
  </div>
)}

{/* History Modal - ПОЛНАЯ РЕАЛИЗАЦИЯ */}
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
          <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path stroke="none" d="M0 0h24v24H0z"/>
            <polyline points="12 8 12 12 14 14" />
            <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
          </svg>
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
                    <label className="text-xs font-medium text-gray-700">Шаблон:</label>
                    <div className="mt-1">
                      <span className="text-sm text-gray-900">{entry.template || '—'}</span>
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
                    <label className="text-xs font-medium text-gray-700">Designer:</label>
                    <div className="mt-1">
                      <span className="text-sm text-gray-900">{entry.designer || '—'}</span>
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
                    <label className="text-xs font-medium text-gray-700">Trello:</label>
                    <div className="mt-1">
                      {entry.trello_link ? (
                        <a 
                          href={entry.trello_link}
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

                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-700">Теги:</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.tags && entry.tags.length > 0 ? (
                        entry.tags.map((tag, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                            {tag}
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

export default LandingPanel;
