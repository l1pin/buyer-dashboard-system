// LandingPanel.js - Полностью переписанная версия для лендингов
// Заменяет все упоминания креативов на лендинги

import React, { useState, useEffect, useMemo } from 'react';
import IntegrationChecker from './IntegrationChecker';
import { supabase, landingService, userService, landingHistoryService, metricsAnalyticsService, trelloLandingService, landingTemplatesService, landingTagsService } from '../supabaseClient';
import { useBatchMetrics, useMetricsStats } from '../hooks/useMetrics';
import { useLandingMetrics } from '../hooks/useLandingMetrics';
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
  Palette,
  CheckCircle
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
  const [showUuidModal, setShowUuidModal] = useState(false);
  const [selectedLandingUuid, setSelectedLandingUuid] = useState(null);
  const [copiedUuid, setCopiedUuid] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [metricsPeriod, setMetricsPeriod] = useState('all');
  const [metricsDisplayPeriod, setMetricsDisplayPeriod] = useState('all');
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
    searcher_id: null,
    is_test: false,
    product_manager_id: null,
    gifer_id: null
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
    searcher_id: null,
    gifer_id: null
  });

  const [buyers, setBuyers] = useState([]);
  const [searchers, setSearchers] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [showSearcherDropdown, setShowSearcherDropdown] = useState(false);
  const [showDesignerDropdown, setShowDesignerDropdown] = useState(false);
  const [showFilterBuyerDropdown, setShowFilterBuyerDropdown] = useState(false);
  const [showFilterSearcherDropdown, setShowFilterSearcherDropdown] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);  
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showGiferDropdown, setShowGiferDropdown] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [productManagers, setProductManagers] = useState([]);
  const [gifers, setGifers] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [verifiedUrls, setVerifiedUrls] = useState([]);
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [landingsWithIntegration, setLandingsWithIntegration] = useState(new Map());

  // Динамические теги и шаблоны из БД
  const [availableTags, setAvailableTags] = useState([]);
  const [templateOptions, setTemplateOptions] = useState([]);
  const [templatesList, setTemplatesList] = useState([]); // Полные объекты шаблонов
  const [tagsList, setTagsList] = useState([]); // Полные объекты тегов
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);

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

  const TestBadge = () => (
    <div className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-md border border-orange-300 flex-shrink-0 hover:shadow-lg transition-shadow duration-200">
      <span className="tracking-wide">T</span>
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

  // Хук для метрик лендингов
  const {
    landingMetrics,
    loading: landingMetricsLoading,
    error: landingMetricsError,
    stats: landingMetricsStats,
    refresh: refreshLandingMetrics,
    getLandingMetrics,
    getAllLandingMetrics,
    hasMetrics: hasLandingMetrics
  } = useLandingMetrics(filteredLandings, false, metricsPeriod);

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
    console.log(`🔍 Получение метрик для лендинга: ${landing.id} (${landing.article})`);

    // Получаем все метрики для этого лендинга (по всем источникам)
    const allMetricsForLanding = getAllLandingMetrics(landing.id);

    console.log(`📊 Найдено метрик для ${landing.id}:`, allMetricsForLanding.length);

    if (!allMetricsForLanding || allMetricsForLanding.length === 0) {
      console.log(`⚠️ Нет метрик для ${landing.id}`);
      return null;
    }

    const validMetrics = allMetricsForLanding.filter(metric => {
      const isValid = metric.found && metric.data && metric.data.allDailyData;
      if (!isValid) {
        console.log(`❌ Пропущена невалидная метрика для ${landing.id}:`, {
          found: metric.found,
          hasData: !!metric.data,
          hasAllDailyData: metric.data ? !!metric.data.allDailyData : false
        });
      }
      return isValid;
    });

    console.log(`✅ Валидных метрик для ${landing.id}:`, validMetrics.length);

    if (validMetrics.length === 0) {
      console.log(`⚠️ Нет валидных метрик для отображения для ${landing.id}`);
      return null;
    }

    // Собираем все дневные данные из всех источников
    const allDailyDataCombined = validMetrics.flatMap(metric => metric.data.allDailyData || []);

    console.log(`📊 Всего дневных записей до фильтрации: ${allDailyDataCombined.length}`);

    // Фильтруем по периоду отображения
    const filteredDailyData = filterMetricsByDisplayPeriod(allDailyDataCombined, metricsDisplayPeriod);

    console.log(`📊 Отфильтровано дневных записей для периода ${metricsDisplayPeriod}: ${filteredDailyData.length}`);

    if (filteredDailyData.length === 0) {
      console.log(`⚠️ Нет данных после фильтрации для ${landing.id}`);
      return null;
    }

    // Собираем уникальные даты
    const uniqueDates = new Set();
    
    const aggregated = filteredDailyData.reduce((acc, day) => {
      // Добавляем дату в Set уникальных дат
      if (day.date) {
        uniqueDates.add(day.date);
      }
      
      return {
        leads: acc.leads + (day.leads || 0),
        cost: acc.cost + (day.cost || 0),
        clicks: acc.clicks + (day.clicks || 0),
        impressions: acc.impressions + (day.impressions || 0),
        duration_sum: acc.duration_sum + (day.avg_duration || 0),
        cost_from_sources: acc.cost_from_sources + (day.cost_from_sources || 0),
        clicks_on_link: acc.clicks_on_link + (day.clicks_on_link || 0)
      };
    }, {
      leads: 0,
      cost: 0,
      clicks: 0,
      impressions: 0,
      duration_sum: 0,
      cost_from_sources: 0,
      clicks_on_link: 0
    });

    // Количество уникальных дней
    const uniqueDaysCount = uniqueDates.size;

    console.log(`📈 Итоговые агрегированные метрики для ${landing.id}:`, {
      ...aggregated,
      days_count: uniqueDaysCount
    });

    const avgDuration = uniqueDaysCount > 0 ? aggregated.duration_sum / uniqueDaysCount : 0;

    const cpl = aggregated.leads > 0 ? aggregated.cost / aggregated.leads : 0;
    const ctr = aggregated.impressions > 0 ? (aggregated.clicks_on_link / aggregated.impressions) * 100 : 0;
    const cpc = aggregated.clicks > 0 ? aggregated.cost / aggregated.clicks : 0;
    const cpm = aggregated.impressions > 0 ? (aggregated.cost_from_sources / aggregated.impressions) * 1000 : 0;

    const result = {
      found: true,
      videoCount: validMetrics.length,
      totalVideos: allMetricsForLanding.length,
      data: {
        raw: {
          leads: aggregated.leads,
          cost: aggregated.cost,
          clicks: aggregated.clicks,
          impressions: aggregated.impressions,
          avg_duration: Number(avgDuration.toFixed(2)),
          days_count: uniqueDaysCount,
          cost_from_sources: aggregated.cost_from_sources,
          clicks_on_link: aggregated.clicks_on_link,
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
          days: String(uniqueDaysCount)
        }
      }
    };

    console.log(`✅ Возвращаем агрегированные метрики для ${landing.id}:`, {
      leads: result.data.formatted.leads,
      cost: result.data.formatted.cost,
      cpl: result.data.formatted.cpl,
      days: result.data.formatted.days
    });

    return result;
  };

// Фильтрация метрик по периоду отображения
  const filterMetricsByDisplayPeriod = (allDailyData, displayPeriod) => {
    if (!allDailyData || allDailyData.length === 0) {
      return [];
    }

    if (displayPeriod === 'all') {
      return allDailyData;
    }

    let daysToTake = 0;
    let sortAscending = false; // false = новые первые, true = старые первые
    
    switch (displayPeriod) {
      case 'first_4days':
        daysToTake = 4;
        sortAscending = true; // Первые 4 дня (самые старые)
        break;
      case 'last_4days':
        daysToTake = 4;
        sortAscending = false; // Последние 4 дня (самые новые)
        break;
      case '14days':
        daysToTake = 14;
        sortAscending = false; // Последние 14 дней (самые новые)
        break;
      case '30days':
        daysToTake = 30;
        sortAscending = false; // Последние 30 дней (самые новые)
        break;
      default:
        return allDailyData;
    }

    // Шаг 1: Собираем все уникальные даты
    const allUniqueDates = new Set();
    allDailyData.forEach(item => {
      if (item.date) {
        allUniqueDates.add(item.date);
      }
    });

    // Шаг 2: Сортируем даты
    const sortedDates = Array.from(allUniqueDates).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return sortAscending ? dateA - dateB : dateB - dateA;
    });

    // Шаг 3: Берем нужное количество дат
    const selectedDates = sortedDates.slice(0, daysToTake);
    const selectedDatesSet = new Set(selectedDates);

    // Шаг 4: Фильтруем все записи, которые попадают в выбранные даты
    const filteredData = allDailyData.filter(item => 
      item.date && selectedDatesSet.has(item.date)
    );

    console.log(`📊 Фильтрация по периоду ${displayPeriod}:`);
    console.log(`   Всего уникальных дат: ${allUniqueDates.size}`);
    console.log(`   Выбрано дат: ${selectedDates.length}`);
    console.log(`   Отфильтровано записей: ${filteredData.length} из ${allDailyData.length}`);
    console.log(`   Выбранные даты:`, selectedDates);

    return filteredData;
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
      if (landing.tag_ids && Array.isArray(landing.tag_ids)) {
        const tagNames = getTagNames(landing.tag_ids);
        tagNames.forEach(tag => {
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

    switch (selectedPeriod) {
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
    const init = async () => {
      loadUsers();
      loadTemplates();
      loadTags();
      await loadLandings();
      loadLastUpdateTime();
    };

    init();
  }, []);

  // Автозагрузка метрик после загрузки лендингов
  useEffect(() => {
    if (filteredLandings.length > 0 && !landingMetricsLoading) {
      console.log('🔄 Автозагрузка метрик для загруженных лендингов');
      console.log(`📋 Количество лендингов для загрузки метрик: ${filteredLandings.length}`);
      refreshLandingMetrics();
    }
  }, [filteredLandings.length]);

  useEffect(() => {
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
                const status = await trelloLandingService.getCardStatus(payload.new.id);

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
    const trelloSubscription = trelloLandingService.subscribeToCardStatuses((payload) => {
      console.log('🔄 Trello status changed:', payload);

      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        console.log('➕ Обновляем статус для лендинга:', payload.new.landing_id);
        setTrelloStatuses(prev => {
          const newMap = new Map(prev);
          newMap.set(payload.new.landing_id, payload.new);
          return newMap;
        });

        // Обновляем лендинг в списке если он уже загружен
        setLandings(prevLandings => {
          return prevLandings.map(landing => {
            if (landing.id === payload.new.landing_id) {
              console.log(`🔄 Обновляем статус лендинга ${landing.article} на ${payload.new.list_name}`);
            }
            return landing;
          });
        });
      } else if (payload.eventType === 'DELETE') {
        console.log('➖ Удаляем статус для лендинга:', payload.old.landing_id);
        setTrelloStatuses(prev => {
          const newMap = new Map(prev);
          newMap.delete(payload.old.landing_id);
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

      const lists = await trelloLandingService.getAllLists();
      setTrelloLists(lists);
      console.log(`✅ Загружено ${lists.length} списков Trello`);

      const landingIds = landings.map(l => l.id);
      console.log(`🔍 Запрос статусов для ${landingIds.length} лендингов`);

      if (landingIds.length > 0) {
        const statusMap = await trelloLandingService.getBatchCardStatuses(landingIds);
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

          const result = await trelloLandingService.syncSingleLanding(
            landing.id,
            landing.trello_link,
            landing.is_test
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
      console.log('📡 Загрузка лендингов контент-менеджера...');
      const data = await landingService.getUserLandings(user.id);

      // Загружаем данные о verified_urls для каждого лендинга
      const landingsWithUrls = await Promise.all(
        data.map(async (landing) => {
          try {
            const { data: landingData, error } = await supabase
              .from('landings')
              .select('verified_urls')
              .eq('id', landing.id)
              .single();

            if (!error && landingData) {
              return { ...landing, verified_urls: landingData.verified_urls || [] };
            }
            return { ...landing, verified_urls: [] };
          } catch (err) {
            console.error(`Ошибка загрузки verified_urls для ${landing.id}:`, err);
            return { ...landing, verified_urls: [] };
          }
        })
      );

      setLandings(landingsWithUrls);
      console.log(`✅ Загружено ${landingsWithUrls.length} лендингов`);

      const landingIds = landingsWithUrls.map(l => l.id);
      const landingsWithHistorySet = await landingHistoryService.checkHistoryBatch(landingIds);
      setLandingsWithHistory(landingsWithHistorySet);

      return landingsWithUrls;
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

      const [buyersData, searchersData, designersData, productManagersData, gifersData] = await Promise.all([
        userService.getUsersByRole('buyer'),
        userService.getUsersByRole('search_manager'),
        userService.getUsersByRole('designer'),
        userService.getUsersByRole('product_manager'),
        userService.getUsersByRole('gif_creator')
      ]);

      setBuyers(buyersData);
      setSearchers(searchersData);
      setDesigners(designersData);
      setProductManagers(productManagersData);
      setGifers(gifersData);
      console.log(`✅ Загружено ${buyersData.length} байеров, ${searchersData.length} серчеров, ${designersData.length} дизайнеров, ${productManagersData.length} продакт менеджеров и ${gifersData.length} гиферов`);
    } catch (error) {
      console.error('❌ Ошибка загрузки пользователей:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Загрузка шаблонов из БД
  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      console.log('📋 Загрузка шаблонов лендингов...');

      const templatesData = await landingTemplatesService.getActiveTemplates();
      setTemplatesList(templatesData); // Сохраняем полные объекты
      setTemplateOptions(templatesData.map(t => t.name)); // Сохраняем только имена для отображения
      console.log(`✅ Загружено ${templatesData.length} шаблонов`);
    } catch (error) {
      console.error('❌ Ошибка загрузки шаблонов:', error);
      setTemplatesList([]);
      setTemplateOptions([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Загрузка тегов из БД
  const loadTags = async () => {
    try {
      setLoadingTags(true);
      console.log('🏷️ Загрузка тегов лендингов...');

      const tagsData = await landingTagsService.getActiveTags();
      setTagsList(tagsData); // Сохраняем полные объекты
      setAvailableTags(tagsData.map(t => t.name)); // Сохраняем только имена для отображения
      console.log(`✅ Загружено ${tagsData.length} тегов`);
    } catch (error) {
      console.error('❌ Ошибка загрузки тегов:', error);
      setTagsList([]);
      setAvailableTags([]);
    } finally {
      setLoadingTags(false);
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
      const productManagerName = newLanding.product_manager_id ? getProductManagerName(newLanding.product_manager_id) : null;
      const giferName = newLanding.gifer_id ? getGiferName(newLanding.gifer_id) : null;

      const newLandingData = await landingService.createLanding({
        user_id: user.id,
        content_manager_id: user.id,
        content_manager_name: user.name,
        article: newLanding.article.trim(),
        template: newLanding.template,
        tags: newLanding.tags,
        comment: newLanding.comment.trim() || null,
        is_poland: newLanding.is_poland,
        trello_link: newLanding.trello_link.trim(),
        designer_id: newLanding.designer_id,
        buyer_id: isTestMode ? null : newLanding.buyer_id,
        searcher_id: newLanding.searcher_id,
        gifer_id: newLanding.gifer_id,
        designer: designerName !== '—' ? designerName : null,
        buyer: isTestMode ? null : (buyerName !== '—' ? buyerName : null),
        searcher: searcherName !== '—' ? searcherName : null,
        gifer: giferName !== '—' ? giferName : null,
        is_test: isTestMode,
        editor_id: null,
        product_manager_id: isTestMode ? newLanding.product_manager_id : null,
        editor: null,
        product_manager: isTestMode ? (productManagerName !== '—' ? productManagerName : null) : null
      });

      console.log('✅ Лендинг создан в БД:', newLandingData);

      if (newLandingData.trello_link) {
        console.log('🔄 Синхронизация Trello статуса через Netlify Function...');
        try {
          const syncResponse = await fetch('/.netlify/functions/trello-landing-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              landingId: newLandingData.id,
              trelloLink: newLandingData.trello_link,
              isTest: isTestMode
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
        searcher_id: null,
        gifer_id: null
      });
      setShowCreateModal(false);

      await loadMetricsForSingleCreative(newLandingData);
      await refreshZoneData();

      const country = newLanding.is_poland ? 'PL' : 'UA';
      setSuccess(`Лендинг создан! Страна: ${country} | Шаблон: ${newLanding.template} | Теги: ${newLanding.tags.length}`);

      // Показываем модальное окно с UUID
      setSelectedLandingUuid(newLandingData.id);
      setShowUuidModal(true);
      setCopiedUuid(false);

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
      searcher_id: landing.searcher_id || null,
      gifer_id: landing.gifer_id || null,
      product_manager_id: landing.product_manager_id || null
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
      const giferName = editLanding.gifer_id ? getGiferName(editLanding.gifer_id) : null;
      const productManagerName = editLanding.product_manager_id ? getProductManagerName(editLanding.product_manager_id) : null;

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
        gifer_id: editingLanding.gifer_id,
        designer: editingLanding.designer,
        buyer: editingLanding.buyer,
        searcher: editingLanding.searcher,
        gifer: editingLanding.gifer,
        is_test: editingLanding.is_test,
        editor_id: null,
        product_manager_id: editingLanding.product_manager_id,
        editor: null,
        product_manager: editingLanding.product_manager,
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
        gifer_id: editLanding.gifer_id,
        product_manager_id: editLanding.product_manager_id,
        designer: designerName !== '—' ? designerName : null,
        buyer: buyerName !== '—' ? buyerName : null,
        searcher: searcherName !== '—' ? searcherName : null,
        gifer: giferName !== '—' ? giferName : null,
        product_manager: productManagerName !== '—' ? productManagerName : null
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
        searcher_id: null,
        gifer_id: null,
        product_manager_id: null
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

  const showUuidCode = async (landingId) => {
    setSelectedLandingUuid(landingId);
    setShowUuidModal(true);
    setCopiedUuid(false);
    setLoadingUrls(true);
    setVerifiedUrls([]);

    try {
      const urls = await landingService.getVerifiedUrls(landingId);
      setVerifiedUrls(urls);

      // Обновляем Map с информацией об интеграции
      setLandingsWithIntegration(prev => {
        const newMap = new Map(prev);
        newMap.set(landingId, urls && urls.length > 0);
        return newMap;
      });
    } catch (error) {
      console.error('Ошибка загрузки верифицированных URL:', error);
      setVerifiedUrls([]);
    } finally {
      setLoadingUrls(false);
    }
  };

  const handleCopyUuid = () => {
    const codeSnippet = `<div 
id="rt-meta" 
data-rt-sub16="${selectedLandingUuid}"
></div>`;

    navigator.clipboard.writeText(codeSnippet).then(() => {
      setCopiedUuid(true);
      setTimeout(() => setCopiedUuid(false), 2000);
    }).catch(err => {
      console.error('Ошибка копирования:', err);
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-menu') && !event.target.closest('.dropdown-trigger')) {
        setOpenDropdowns(new Set());
      }
      if (!event.target.closest('.period-dropdown') && !event.target.closest('.period-trigger')) {
        setShowPeriodDropdown(false);
      }
      // Модальные dropdowns
      if (!event.target.closest('.buyer-dropdown') && !event.target.closest('.buyer-trigger')) {
        setShowBuyerDropdown(false);
      }
      if (!event.target.closest('.searcher-dropdown') && !event.target.closest('.searcher-trigger')) {
        setShowSearcherDropdown(false);
      }
      // Фильтры dropdowns
      if (!event.target.closest('.filter-buyer-dropdown') && !event.target.closest('.filter-buyer-trigger')) {
        setShowFilterBuyerDropdown(false);
      }
      if (!event.target.closest('.filter-searcher-dropdown') && !event.target.closest('.filter-searcher-trigger')) {
        setShowFilterSearcherDropdown(false);
      }
      if (!event.target.closest('.designer-dropdown') && !event.target.closest('.designer-trigger')) {
        setShowDesignerDropdown(false);
      }
      if (!event.target.closest('.template-dropdown') && !event.target.closest('.template-trigger')) {
        setShowTemplateDropdown(false);
      }
      if (!event.target.closest('.tags-dropdown') && !event.target.closest('.tags-trigger')) {
        setShowTagsDropdown(false);
      }
      if (!event.target.closest('.product-dropdown') && !event.target.closest('.product-trigger')) {
        setShowProductDropdown(false);
      }
      if (!event.target.closest('.gifer-dropdown') && !event.target.closest('.gifer-trigger')) {
        setShowGiferDropdown(false);
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
  }, [showPeriodMenu, customDateFrom, customDateTo, showTemplateDropdown, showTagsDropdown, showDesignerDropdown, showFilterBuyerDropdown, showFilterSearcherDropdown, showBuyerDropdown, showSearcherDropdown, showProductDropdown, showGiferDropdown]);

  const handlePeriodChange = (period) => {
    console.log(`🔄 МГНОВЕННАЯ смена периода отображения метрик: ${metricsDisplayPeriod} -> ${period}`);
    setMetricsDisplayPeriod(period);
    setShowPeriodDropdown(false);
    clearMessages();
  };

  const getPeriodButtonText = () => {
    switch (metricsDisplayPeriod) {
      case 'first_4days': return '4 первых дня';
      case 'last_4days': return '4 последних дня';
      case '14days': return '14 последних дней';
      case '30days': return '30 последних дней';
      case 'all': return 'Все время';
      default: return 'Все время';
    }
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

  // Функция для обновления статуса интеграции после успешной проверки
  const handleIntegrationVerified = (landingId, urls) => {
    console.log('✅ Интеграция подтверждена для лендинга:', landingId, 'URLs:', urls);

    // Обновляем Map с информацией об интеграции
    setLandingsWithIntegration(prev => {
      const newMap = new Map(prev);
      newMap.set(landingId, true);
      return newMap;
    });

    // Обновляем список лендингов с новыми verified_urls
    setLandings(prevLandings =>
      prevLandings.map(landing =>
        landing.id === landingId
          ? { ...landing, verified_urls: urls }
          : landing
      )
    );
  };

  const validateEditFields = () => {
    const errors = {};
    const errorMessages = [];

    if (!editLanding.template) {
      errors.template = true;
      errorMessages.push('Необходимо выбрать шаблон');
    }

    if (!editLanding.gifer_id) {
      errors.gifer_id = true;
      errorMessages.push('Необходимо выбрать гифера');
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

    // Проверка в зависимости от режима
    if (editingLanding.is_test) {
      // Для тестового режима - обязателен только Product
      if (!editLanding.product_manager_id) {
        errors.product_manager_id = true;
        errorMessages.push('Необходимо выбрать продакт менеджера');
      }
    } else {
      // Для обычного режима - обязательны Designer, Searcher, Buyer
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

    // Общие обязательные поля
    if (!newLanding.article.trim()) {
      errors.article = true;
      errorMessages.push('Артикул обязателен для заполнения');
    }

    if (!newLanding.template) {
      errors.template = true;
      errorMessages.push('Выберите шаблон');
    }

    if (!newLanding.gifer_id) {
      errors.gifer_id = true;
      errorMessages.push('Выберите гифера');
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

    // Проверка в зависимости от режима
    if (isTestMode) {
      // Для тестового режима - обязательны только Product
      if (!newLanding.product_manager_id) {
        errors.product_manager_id = true;
        errorMessages.push('Выберите продакт менеджера');
      }
    } else {
      // Для обычного режима - обязательны Designer, Searcher, Buyer
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

  const getSelectedProductManager = () => {
    if (!newLanding.product_manager_id) return null;
    return productManagers.find(p => p.id === newLanding.product_manager_id);
  };

  const getSelectedProductManagerEdit = () => {
    if (!editLanding.product_manager_id) return null;
    return productManagers.find(p => p.id === editLanding.product_manager_id);
  };

  const getProductManagerName = (pmId) => {
    if (!pmId) return '—';
    const pm = productManagers.find(p => p.id === pmId);
    return pm ? pm.name : 'Удален';
  };

  const getProductManagerAvatar = (pmId) => {
    if (!pmId) return null;
    const pm = productManagers.find(p => p.id === pmId);
    return pm ? pm.avatar_url : null;
  };

  const getSelectedGifer = () => {
    if (!newLanding.gifer_id) return null;
    return gifers.find(g => g.id === newLanding.gifer_id);
  };

  const getGiferName = (giferId) => {
    if (!giferId) return '—';
    const gifer = gifers.find(g => g.id === giferId);
    return gifer ? gifer.name : 'Удален';
  };

  // Получить название шаблона по template_id
  const getTemplateName = (templateId) => {
    if (!templateId) return '—';
    const template = templatesList.find(t => t.id === templateId);
    return template ? template.name : 'Удален';
  };

  // Получить названия тегов по tag_ids
  const getTagNames = (tagIds) => {
    if (!tagIds || tagIds.length === 0) return [];
    return tagIds
      .map(tagId => {
        const tag = tagsList.find(t => t.id === tagId);
        return tag ? tag.name : null;
      })
      .filter(name => name !== null);
  };

  const getGiferAvatar = (giferId) => {
    if (!giferId) return null;
    const gifer = gifers.find(g => g.id === giferId);
    return gifer ? gifer.avatar_url : null;
  };

  // Проверка прав на редактирование лендинга
  const canEditLanding = (landing) => {
    return landing.user_id === user.id;
  };

  const handleRefreshAll = async () => {
    console.log(`🔄 ЗАПУСК ОБНОВЛЕНИЯ метрик лендингов (период: ${metricsPeriod})`);
    console.log(`📋 Лендингов для загрузки: ${filteredLandings.length}`);
    console.log(`📋 UUID лендингов:`, filteredLandings.map(l => l.id));

    setError('');
    setSuccess('');

    try {
      console.log('🚀 Вызов refreshLandingMetrics...');
      await refreshLandingMetrics();
      console.log('✅ Метрики лендингов обновлены');

      // Небольшая задержка для обновления состояния
      await new Promise(resolve => setTimeout(resolve, 500));

      setSuccess('Метрики успешно обновлены!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('❌ Ошибка обновления метрик лендингов:', error);
      setError('Ошибка обновления метрик: ' + error.message);
      setTimeout(() => setError(''), 5000);
    }

    try {
      await refreshZoneData();
      console.log('✅ Зональные данные обновлены');
    } catch (error) {
      console.error('❌ Ошибка обновления зональных данных:', error);
    }

    await loadLastUpdateTime();
  };

  const tagsStats = getTagsStats(filteredLandings);
  const countryStats = getCountryStats(filteredLandings);
  const zoneStats = getZoneStats(filteredLandings);

  // Подсчет общих метрик из лендингов
  const calculateTotalMetrics = () => {
    let totalLeads = 0;
    let totalCost = 0;
    let totalClicks = 0;
    let landingsWithMetrics = 0;

    filteredLandings.forEach(landing => {
      const metrics = getAggregatedLandingMetrics(landing);
      if (metrics?.found && metrics.data) {
        totalLeads += metrics.data.raw.leads || 0;
        totalCost += metrics.data.raw.cost || 0;
        totalClicks += metrics.data.raw.clicks || 0;
        landingsWithMetrics++;
      }
    });

    return {
      totalLeads,
      totalCost,
      totalClicks,
      landingsWithMetrics,
      avgLeads: landingsWithMetrics > 0 ? totalLeads / landingsWithMetrics : 0,
      avgCost: landingsWithMetrics > 0 ? totalCost / landingsWithMetrics : 0,
      avgClicks: landingsWithMetrics > 0 ? totalClicks / landingsWithMetrics : 0,
      cpl: totalLeads > 0 ? totalCost / totalLeads : 0,
      cr: totalClicks > 0 ? (totalLeads / totalClicks) * 100 : 0
    };
  };

  const totalMetrics = calculateTotalMetrics();

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
                <div className="absolute left-1/2 transform -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50" style={{ width: '850px' }}>
                  <div className="grid grid-cols-3">
                    {/* Левая колонка - список периодов */}
                    <div className="border-r border-gray-200 py-2">
                      <button
                        onClick={() => handlePeriodSelect('today')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${selectedPeriod === 'today' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Сегодня
                      </button>

                      <button
                        onClick={() => handlePeriodSelect('yesterday')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${selectedPeriod === 'yesterday' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Вчера
                      </button>

                      <button
                        onClick={() => handlePeriodSelect('this_week')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${selectedPeriod === 'this_week' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Эта неделя
                      </button>

                      <button
                        onClick={() => handlePeriodSelect('last_7_days')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${selectedPeriod === 'last_7_days' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Последние 7 дней
                      </button>

                      <button
                        onClick={() => handlePeriodSelect('this_month')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${selectedPeriod === 'this_month' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Этот месяц
                      </button>

                      <button
                        onClick={() => handlePeriodSelect('last_month')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${selectedPeriod === 'last_month' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Последний месяц
                      </button>

                      <div className="border-t border-gray-200 my-1"></div>

                      <button
                        onClick={() => handlePeriodSelect('all')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${selectedPeriod === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
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
                <div className="period-dropdown absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <div className="py-1">
                    <button
                      onClick={() => handlePeriodChange('first_4days')}
                      className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${metricsDisplayPeriod === 'first_4days' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      4 первых дня
                    </button>
                    <button
                      onClick={() => handlePeriodChange('last_4days')}
                      className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${metricsDisplayPeriod === 'last_4days' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      4 последних дня
                    </button>
                    <button
                      onClick={() => handlePeriodChange('14days')}
                      className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${metricsDisplayPeriod === '14days' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      14 последних дней
                    </button>
                    <button
                      onClick={() => handlePeriodChange('30days')}
                      className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${metricsDisplayPeriod === '30days' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      30 последних дней
                    </button>
                    <button
                      onClick={() => handlePeriodChange('all')}
                      className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${metricsDisplayPeriod === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Все время
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
                onClick={() => setShowFilterBuyerDropdown(!showFilterBuyerDropdown)}
                className="filter-buyer-trigger inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
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

              {showFilterBuyerDropdown && (
                <div className="filter-buyer-dropdown absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSelectedBuyer('all');
                        setShowFilterBuyerDropdown(false);
                      }}
                      className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${selectedBuyer === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
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
                          setShowFilterBuyerDropdown(false);
                        }}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${selectedBuyer === buyer.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
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
                onClick={() => setShowFilterSearcherDropdown(!showFilterSearcherDropdown)}
                className="filter-searcher-trigger inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
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

              {showFilterSearcherDropdown && (
                <div className="filter-searcher-dropdown absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSelectedSearcher('all');
                        setShowFilterSearcherDropdown(false);
                      }}
                      className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${selectedSearcher === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
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
                          setShowFilterSearcherDropdown(false);
                        }}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${selectedSearcher === searcher.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-2 sm:gap-3 md:gap-4 mb-4">
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

        {/* Типы лендингов */}
        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
          <div className="p-2 sm:p-3 md:p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Star className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
              </div>
              <div className="ml-2 sm:ml-3 w-0 flex-1">
                <dl>
                  <dt className="text-xs font-medium text-gray-500 truncate">
                    Осн/Тест/Ред
                  </dt>
                  <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                    <div className="flex items-center space-x-1">
                      <span>{filteredLandings.filter(l => !l.is_test && !l.is_edited).length}</span>
                      <span className="text-gray-400">/</span>
                      <span>{filteredLandings.filter(l => l.is_test).length}</span>
                      <span className="text-gray-400">/</span>
                      <span>{filteredLandings.filter(l => l.is_edited).length}</span>
                    </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-2 sm:gap-3 md:gap-4">
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
                        {Math.round(totalMetrics.totalLeads)}
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
                        {totalMetrics.cpl.toFixed(2)}$
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
                        {totalMetrics.totalCost.toFixed(2)}$
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
                        {Math.round(totalMetrics.totalClicks)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* CR */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-[8px] sm:text-[9px] md:text-[10px]">CR</span>
                    </div>
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        CR
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {totalMetrics.cr.toFixed(2)}%
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
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Ср. лидов
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {Math.round(totalMetrics.avgLeads)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Ср. расходы */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Ср. расходы
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {totalMetrics.avgCost.toFixed(2)}$
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Ср. клики */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MousePointer className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Ср. клики
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {Math.round(totalMetrics.avgClicks)}
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

              <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                    <tr>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <svg className="h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <path stroke="none" d="M0 0h24v24H0z" />
                          <path d="M4 20h4l10.5 -10.5a1.5 1.5 0 0 0 -4 -4l-10.5 10.5v4" />
                          <line x1="13.5" y1="6.5" x2="17.5" y2="10.5" />
                        </svg>
                      </th>

                      <th className="px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50" style={{ width: '40px' }}>
                        Тип
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Дата
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <svg className="h-4 w-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <MessageCircle className="h-4 w-4 mx-auto" />
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Артикул
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Версия
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Шаблон
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Теги
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
                        Клики
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        CR
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Дней
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Зоны
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Trello
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Статус
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Designer
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Buyer
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Searcher
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Product
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        GIFer
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLandings.map((landing) => {
                      const formattedDateTime = formatKyivTime(landing.created_at);
                      const aggregatedMetrics = getAggregatedLandingMetrics(landing);
                      const isExpanded = expandedTags.has(landing.id);
                      const isDropdownOpen = openDropdowns.has(landing.id);
                      const isSyncing = syncingLandings.has(landing.id);
                      const trelloStatus = getTrelloListName(landing.id);

                      return (
                        <tr
                          key={landing.id}
                          className="transition-colors duration-200 hover:bg-gray-50"
                        >
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                            {canEditLanding(landing) ? (
                              <button
                                onClick={() => handleEditLanding(landing)}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
                                title="Редактировать лендинг"
                              >
                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                  <path stroke="none" d="M0 0h24v24H0z" />
                                  <path d="M4 20h4l10.5 -10.5a1.5 1.5 0 0 0 -4 -4l-10.5 10.5v4" />
                                  <line x1="13.5" y1="6.5" x2="17.5" y2="10.5" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                disabled
                                className="text-gray-400 p-1 rounded-full cursor-not-allowed opacity-50"
                                title="Вы можете редактировать только свои лендинги"
                              >
                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                  <path stroke="none" d="M0 0h24v24H0z" />
                                  <path d="M4 20h4l10.5 -10.5a1.5 1.5 0 0 0 -4 -4l-10.5 10.5v4" />
                                  <line x1="13.5" y1="6.5" x2="17.5" y2="10.5" />
                                </svg>
                              </button>
                            )}
                          </td>

                          <td className="px-1 py-4 whitespace-nowrap text-sm text-center">
                            <div className="flex items-center justify-center space-x-1">
                              {landing.is_test && (
                                <div title="Тестовый лендинг">
                                  <TestBadge />
                                </div>
                              )}
                              {landing.is_edited && (
                                <div 
                                  title={`Лендинг отредактирован${landing.editor ? ` (${landing.editor})` : ''}`}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold bg-gradient-to-r from-purple-400 to-blue-400 text-white shadow-md border border-purple-300 flex-shrink-0 hover:shadow-lg transition-shadow duration-200"
                                >
                                  <span className="tracking-wide">E</span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="cursor-text select-text text-center">
                              <div className="font-medium">{formattedDateTime.date}</div>
                              <div className="text-xs text-gray-500">{formattedDateTime.time}</div>
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                            <div className="w-6 h-6 flex items-center justify-center mx-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showUuidCode(landing.id);
                                }}
                                className={`p-1 rounded-full transition-all duration-200 ${(landing.verified_urls && landing.verified_urls.length > 0) || landingsWithIntegration.get(landing.id)
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-900 hover:scale-110'
                                    : 'bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-900 hover:scale-110'
                                  }`}
                                title={
                                  (landing.verified_urls && landing.verified_urls.length > 0) || landingsWithIntegration.get(landing.id)
                                    ? `Интеграция подтверждена ${landing.verified_urls ? `(${landing.verified_urls.length} URL)` : ''}`
                                    : 'Интеграция не найдена'
                                }
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                              </button>
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                            <div className="w-6 h-6 flex items-center justify-center mx-auto">
                              {landing.comment && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showComment(landing);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
                                  title="Показать комментарий"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                {landingsWithHistory.has(landing.id) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      showHistory(landing);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
                                    title="Показать историю изменений"
                                  >
                                    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                      <path stroke="none" d="M0 0h24v24H0z" />
                                      <polyline points="12 8 12 12 14 14" />
                                      <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
                                    </svg>
                                  </button>
                                )}
                              </div>

                              {landing.is_poland ? <PolandFlag /> : <UkraineFlag />}

                              <div className="text-sm font-medium text-gray-900 cursor-text select-text">
                                {landing.article}
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="cursor-text select-text">
                              {landing.website || <div className="text-center"><span className="text-gray-400">—</span></div>}
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="cursor-text select-text">
                              {getTemplateName(landing.template_id) || <div className="text-center"><span className="text-gray-400">—</span></div>}
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-center">
                            {landing.tag_ids && landing.tag_ids.length > 0 ? (
                              <div className="space-y-1">
                                <div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTags(landing.id);
                                    }}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200 transition-colors duration-200"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    <span>
                                      {isExpanded
                                        ? `Скрыть теги`
                                        : `Теги (${landing.tag_ids.length})`
                                      }
                                    </span>
                                    {isExpanded ? (
                                      <ChevronUp className="h-3 w-3 ml-1" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3 ml-1" />
                                    )}
                                  </button>
                                </div>

                                {isExpanded && (
                                  <div className="mt-2 space-y-1 max-w-xs">
                                    {getTagNames(landing.tag_ids).map((tag, index) => {
                                      const tagStyles = {
                                        'SEO': { dot: 'bg-purple-500', border: 'border-purple-200', bg: 'bg-purple-50' },
                                        'Адаптив': { dot: 'bg-blue-500', border: 'border-blue-200', bg: 'bg-blue-50' },
                                        'Анимация': { dot: 'bg-green-500', border: 'border-green-200', bg: 'bg-green-50' },
                                        'Форма': { dot: 'bg-yellow-500', border: 'border-yellow-200', bg: 'bg-yellow-50' },
                                        'Интеграция': { dot: 'bg-red-500', border: 'border-red-200', bg: 'bg-red-50' },
                                        'Мультиязычность': { dot: 'bg-indigo-500', border: 'border-indigo-200', bg: 'bg-indigo-50' }
                                      };
                                      const style = tagStyles[tag] || { dot: 'bg-gray-500', border: 'border-gray-200', bg: 'bg-gray-50' };
                                      return (
                                        <div key={index} className={`text-xs text-gray-700 ${style.bg} px-2 py-1 rounded flex items-center border ${style.border}`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot} mr-1.5`}></span>
                                          <span className="truncate cursor-text select-text">{tag}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 text-sm text-gray-900 text-center">
                            <CurrentZoneDisplay article={landing.article} metricsData={aggregatedMetrics} />
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span className="font-bold text-sm cursor-text select-text text-black">
                                {aggregatedMetrics.data.formatted.leads}
                              </span>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span className="font-bold text-sm cursor-text select-text text-black">
                                {aggregatedMetrics.data.formatted.cpl}
                              </span>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span
                                className="font-bold text-sm cursor-text select-text text-black relative group"
                              >
                                {aggregatedMetrics.data.formatted.cost}
                                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                  Расход (источник): {aggregatedMetrics.data.raw.cost_from_sources?.toFixed(2)}$
                                </span>
                              </span>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span
                                className="font-bold text-sm cursor-text select-text text-black relative group"
                              >
                                {aggregatedMetrics.data.formatted.clicks}
                                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                  Клики (источник): {aggregatedMetrics.data.raw.clicks_on_link}
                                </span>
                              </span>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span
                                className="font-bold text-sm cursor-text select-text text-black relative group"
                              >
                                {aggregatedMetrics.data.raw.clicks > 0 
                                  ? ((aggregatedMetrics.data.raw.leads / aggregatedMetrics.data.raw.clicks) * 100).toFixed(2) + '%'
                                  : '0.00%'
                                }
                                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                  CR (источник): {aggregatedMetrics.data.raw.clicks_on_link > 0 
                                    ? ((aggregatedMetrics.data.raw.leads / aggregatedMetrics.data.raw.clicks_on_link) * 100).toFixed(2) + '%'
                                    : '0.00%'
                                  }
                                </span>
                              </span>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span className="font-bold text-sm cursor-text select-text text-black">
                                {aggregatedMetrics.data.formatted.days}
                              </span>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 text-sm text-gray-900 text-center">
                            <ZoneDataDisplay article={landing.article} />
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {landing.trello_link ? (
                              <div className="space-y-2">
                                <div>
                                  <a href={landing.trello_link}
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
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {syncingLandings.has(landing.id) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-xs text-blue-600">Синхронизация...</span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 cursor-text select-text">
                                {getTrelloListName(landing.id)}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {landing.designer_id ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  {getDesignerAvatar(landing.designer_id) ? (
                                    <img
                                      src={getDesignerAvatar(landing.designer_id)}
                                      alt="Designer"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${getDesignerAvatar(landing.designer_id) ? 'hidden' : ''}`}>
                                    <Palette className="h-3 w-3 text-gray-400" />
                                  </div>
                                </div>
                                <span className="text-sm text-gray-900">{getDesignerName(landing.designer_id)}</span>
                              </div>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 text-sm">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(landing.buyer_id || landing.buyer) ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  {getBuyerAvatar(landing.buyer_id) ? (
                                    <img
                                      src={getBuyerAvatar(landing.buyer_id)}
                                      alt="Buyer"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${getBuyerAvatar(landing.buyer_id) ? 'hidden' : ''}`}>
                                    <User className="h-3 w-3 text-gray-400" />
                                  </div>
                                </div>
                                <span className="text-sm text-gray-900 cursor-text select-text">
                                  {landing.buyer_id ? getBuyerName(landing.buyer_id) : landing.buyer}
                                </span>
                              </div>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(landing.searcher_id || landing.searcher) ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  {getSearcherAvatar(landing.searcher_id) ? (
                                    <img
                                      src={getSearcherAvatar(landing.searcher_id)}
                                      alt="Searcher"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${getSearcherAvatar(landing.searcher_id) ? 'hidden' : ''}`}>
                                    <Search className="h-3 w-3 text-gray-400" />
                                  </div>
                                </div>
                                <span className="text-sm text-gray-900 cursor-text select-text">
                                  {landing.searcher_id ? getSearcherName(landing.searcher_id) : landing.searcher}
                                </span>
                              </div>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(landing.product_manager_id || landing.product_manager) ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  {getProductManagerAvatar(landing.product_manager_id) ? (
                                    <img
                                      src={getProductManagerAvatar(landing.product_manager_id)}
                                      alt="Product"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${getProductManagerAvatar(landing.product_manager_id) ? 'hidden' : ''}`}>
                                    <Target className="h-3 w-3 text-gray-400" />
                                  </div>
                                </div>
                                <span className="text-sm text-gray-900 cursor-text select-text">
                                  {landing.product_manager_id ? getProductManagerName(landing.product_manager_id) : landing.product_manager}
                                </span>
                              </div>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(landing.gifer_id || landing.gifer) ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  {getGiferAvatar(landing.gifer_id) ? (
                                    <img
                                      src={getGiferAvatar(landing.gifer_id)}
                                      alt="GIFer"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${getGiferAvatar(landing.gifer_id) ? 'hidden' : ''}`}>
                                    <Palette className="h-3 w-3 text-gray-400" />
                                  </div>
                                </div>
                                <span className="text-sm text-gray-900 cursor-text select-text">
                                  {landing.gifer_id ? getGiferName(landing.gifer_id) : landing.gifer}
                                </span>
                              </div>
                            ) : (
                              <div className="text-center"><span className="text-gray-400 cursor-text select-text">—</span></div>
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-5 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white my-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                Создать новый лендинг
              </h3>

              {/* Тумблер */}
              <div className="flex items-center space-x-3">
                <span className={`text-sm font-medium transition-colors duration-300 ${!isTestMode ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                  Основной
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsTestMode(!isTestMode);
                    // Полная очистка формы при переключении режима
                    setNewLanding({
                      article: '',
                      template: '',
                      tags: [],
                      comment: '',
                      is_poland: false,
                      trello_link: '',
                      designer_id: null,
                      buyer_id: null,
                      searcher_id: null,
                      is_test: !isTestMode,
                      product_manager_id: null,
                      gifer_id: null
                    });
                    // Закрываем все dropdowns
                    setShowBuyerDropdown(false);
                    setShowSearcherDropdown(false);
                    setShowDesignerDropdown(false);
                    setShowTemplateDropdown(false);
                    setShowTagsDropdown(false);
                    setShowProductDropdown(false);
                    setShowGiferDropdown(false);
                    // Очищаем ошибки
                    clearMessages();
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${isTestMode ? 'bg-yellow-500 focus:ring-yellow-500' : 'bg-gray-200 focus:ring-gray-500'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${isTestMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
                <span className={`text-sm font-medium transition-colors duration-300 ${isTestMode ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                  Тест
                </span>
              </div>

              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setIsTestMode(false);
                  setNewLanding({
                    article: '',
                    template: '',
                    tags: [],
                    comment: '',
                    is_poland: false,
                    trello_link: '',
                    designer_id: null,
                    buyer_id: null,
                    searcher_id: null,
                    is_test: false,
                    product_manager_id: null,
                    gifer_id: null
                  });
                  setShowBuyerDropdown(false);
                  setShowSearcherDropdown(false);
                  setShowDesignerDropdown(false);
                  setShowProductDropdown(false);
                  setShowGiferDropdown(false);
                  clearMessages();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Индикатор тестового режима */}
            {isTestMode && (
              <div className="mb-4 bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-md text-sm flex items-center animate-pulse">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                Создание тестового лендинга
              </div>
            )}

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Артикул + страна */}
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
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${fieldErrors.article
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder-red-400'
                        : isTestMode
                          ? 'border-gray-300 focus:ring-yellow-500 focus:border-transparent'
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
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 border ${newLanding.is_poland
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

              {/* Карточка Trello */}
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
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${fieldErrors.trello_link
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder-red-400'
                    : isTestMode
                      ? 'border-gray-300 focus:ring-yellow-500 focus:border-transparent'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                    }`}
                  placeholder="https://trello.com/c/..."
                />
                <p className="mt-1 text-xs text-blue-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Укажите ссылку на карточку Trello
                </p>
              </div>

              {/* Шаблон - стилизованный dropdown */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.template ? 'text-red-600' : 'text-gray-700'}`}>
                  Шаблон *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    disabled={loadingTemplates}
                    className={`template-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-white text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed ${fieldErrors.template
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : isTestMode
                        ? 'border-gray-300 focus:ring-yellow-500 focus:border-transparent'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                      }`}
                  >
                    <span className={newLanding.template ? 'text-gray-900' : 'text-gray-500'}>
                      {loadingTemplates ? 'Загрузка шаблонов...' : (newLanding.template || 'Выберите шаблон')}
                    </span>
                    <div className="flex items-center space-x-1">
                      {newLanding.template && !loadingTemplates && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewLanding({ ...newLanding, template: '' });
                            clearFieldError('template');
                          }}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
                          title="Очистить выбор"
                        >
                          <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                        </button>
                      )}
                      {loadingTemplates ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {showTemplateDropdown && !loadingTemplates && templateOptions.length > 0 && (
                    <div className="template-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {templateOptions.map((template) => (
                        <button
                          key={template}
                          type="button"
                          onClick={() => {
                            setNewLanding({ ...newLanding, template });
                            setShowTemplateDropdown(false);
                            clearFieldError('template');
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          {template}
                        </button>
                      ))}
                    </div>
                  )}

                  {showTemplateDropdown && !loadingTemplates && templateOptions.length === 0 && (
                    <div className="template-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg p-3">
                      <p className="text-sm text-gray-500 text-center">Нет доступных шаблонов</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Designer */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.designer_id ? 'text-red-600' : 'text-gray-700'}`}>
                  Designer {!isTestMode && '*'}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (!loadingUsers) {
                        setShowDesignerDropdown(!showDesignerDropdown);
                        setShowBuyerDropdown(false);
                        setShowSearcherDropdown(false);
                        setShowTemplateDropdown(false);
                        setShowTagsDropdown(false);
                        setShowProductDropdown(false);
                      }
                    }}
                    disabled={loadingUsers}
                    className={`designer-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50 ${fieldErrors.designer_id
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : isTestMode
                        ? 'border-gray-300 focus:ring-yellow-500'
                        : 'border-gray-300 focus:ring-blue-500'
                      }`}
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
                        <span className="text-gray-500">Выберите дизайнера</span>
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

              {/* Searcher */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.searcher_id ? 'text-red-600' : 'text-gray-700'}`}>
                  Searcher {!isTestMode && '*'}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (!loadingUsers) {
                        setShowSearcherDropdown(!showSearcherDropdown);
                        setShowBuyerDropdown(false);
                        setShowDesignerDropdown(false);
                        setShowTemplateDropdown(false);
                        setShowTagsDropdown(false);
                        setShowProductDropdown(false);
                      }
                    }}
                    disabled={loadingUsers}
                    className={`searcher-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50 ${fieldErrors.searcher_id
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : isTestMode
                        ? 'border-gray-300 focus:ring-yellow-500'
                        : 'border-gray-300 focus:ring-blue-500'
                      }`}
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
                        <span className="text-gray-500">Выберите серчера</span>
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

              {/* GIFer - обязательное поле для обоих режимов */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.gifer_id ? 'text-red-600' : 'text-gray-700'}`}>
                  GIFer *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (!loadingUsers) {
                        setShowGiferDropdown(!showGiferDropdown);
                        setShowBuyerDropdown(false);
                        setShowSearcherDropdown(false);
                        setShowDesignerDropdown(false);
                        setShowTemplateDropdown(false);
                        setShowTagsDropdown(false);
                        setShowProductDropdown(false);
                      }
                    }}
                    disabled={loadingUsers}
                    className={`gifer-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50 ${fieldErrors.gifer_id
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : isTestMode
                        ? 'border-gray-300 focus:ring-yellow-500'
                        : 'border-gray-300 focus:ring-blue-500'
                      }`}
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      {getSelectedGifer() ? (
                        <>
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {getSelectedGifer().avatar_url ? (
                              <img
                                src={getSelectedGifer().avatar_url}
                                alt="GIFer"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center ${getSelectedGifer().avatar_url ? 'hidden' : ''}`}>
                              <Palette className="h-3 w-3 text-gray-400" />
                            </div>
                          </div>
                          <span className="text-gray-900 truncate">{getSelectedGifer().name}</span>
                        </>
                      ) : (
                        <span className="text-gray-500">Выберите гифера</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      {getSelectedGifer() && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewLanding({ ...newLanding, gifer_id: null });
                            clearFieldError('gifer_id');
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

                  {showGiferDropdown && !loadingUsers && (
                    <div className="gifer-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {gifers.map((gifer) => (
                        <button
                          key={gifer.id}
                          type="button"
                          onClick={() => {
                            setNewLanding({ ...newLanding, gifer_id: gifer.id });
                            setShowGiferDropdown(false);
                            clearFieldError('gifer_id');
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {gifer.avatar_url ? (
                              <img
                                src={gifer.avatar_url}
                                alt="GIFer"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center ${gifer.avatar_url ? 'hidden' : ''}`}>
                              <Palette className="h-3 w-3 text-gray-400" />
                            </div>
                          </div>
                          <span className="text-gray-900 truncate">{gifer.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Buyer ИЛИ + Product в зависимости от режима */}
              {!isTestMode ? (
                // Обычный режим - Buyer
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
                          setShowTemplateDropdown(false);
                          setShowTagsDropdown(false);
                          setShowProductDropdown(false);
                        }
                      }}
                      disabled={loadingUsers}
                      className={`buyer-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50 ${fieldErrors.buyer_id
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-blue-500'
                      }`}
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
                          <span className="text-gray-500">Выберите байера</span>
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
              ) : (
                // Тестовый режим - Product
                <>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${fieldErrors.product_manager_id ? 'text-red-600' : 'text-gray-700'}`}>
                      Product *
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (!loadingUsers) {
                            setShowProductDropdown(!showProductDropdown);
                            setShowBuyerDropdown(false);
                            setShowSearcherDropdown(false);
                            setShowDesignerDropdown(false);
                            setShowTemplateDropdown(false);
                            setShowTagsDropdown(false);
                          }
                        }}
                        disabled={loadingUsers}
                        className={`product-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50 ${fieldErrors.product_manager_id
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-yellow-500'
                        }`}
                      >
                      <div className="flex items-center space-x-2 flex-1">
                        {getSelectedProductManager() ? (
                          <>
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {getSelectedProductManager().avatar_url ? (
                                <img
                                  src={getSelectedProductManager().avatar_url}
                                  alt="Product"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${getSelectedProductManager().avatar_url ? 'hidden' : ''}`}>
                                <Target className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-gray-900 truncate">{getSelectedProductManager().name}</span>
                          </>
                          ) : (
                            <span className="text-gray-500">Выберите продакт менеджера</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          {getSelectedProductManager() && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewLanding({ ...newLanding, product_manager_id: null });
                                clearFieldError('product_manager_id');
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

                      {showProductDropdown && !loadingUsers && (
                        <div className="product-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          {productManagers.map((pm) => (
                            <button
                              key={pm.id}
                              type="button"
                              onClick={() => {
                                setNewLanding({ ...newLanding, product_manager_id: pm.id });
                                setShowProductDropdown(false);
                                clearFieldError('product_manager_id');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                {pm.avatar_url ? (
                                  <img
                                    src={pm.avatar_url}
                                    alt="Product"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className={`w-full h-full flex items-center justify-center ${pm.avatar_url ? 'hidden' : ''}`}>
                                  <Target className="h-3 w-3 text-gray-400" />
                                </div>
                              </div>
                              <span className="text-gray-900 truncate">{pm.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Комментарий */}
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
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${isTestMode ? 'focus:ring-yellow-500' : 'focus:ring-blue-500'
                    }`}
                  placeholder="Добавьте комментарий к лендингу (необязательно)"
                />
              </div>

              {/* Теги - красивый множественный dropdown */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Теги ({newLanding.tags.length} выбрано)
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTagsDropdown(!showTagsDropdown)}
                    className={`tags-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-white text-left ${isTestMode
                      ? 'border-gray-300 focus:ring-yellow-500 focus:border-transparent'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        {newLanding.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {newLanding.tags.map((tag, index) => {
                              const tagStyles = {
                                'SEO': { dot: 'bg-purple-500', border: 'border-purple-300', text: 'text-purple-700' },
                                'Адаптив': { dot: 'bg-blue-500', border: 'border-blue-300', text: 'text-blue-700' },
                                'Анимация': { dot: 'bg-green-500', border: 'border-green-300', text: 'text-green-700' },
                                'Форма': { dot: 'bg-yellow-500', border: 'border-yellow-300', text: 'text-yellow-700' },
                                'Интеграция': { dot: 'bg-red-500', border: 'border-red-300', text: 'text-red-700' },
                                'Мультиязычность': { dot: 'bg-indigo-500', border: 'border-indigo-300', text: 'text-indigo-700' }
                              };
                              const style = tagStyles[tag] || { dot: 'bg-gray-500', border: 'border-gray-300', text: 'text-gray-700' };
                              return (
                                <span
                                  key={index}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-white ${style.border} ${style.text}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot} mr-1.5`}></span>
                                  {tag}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-500">Выберите теги</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                        {newLanding.tags.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewLanding({ ...newLanding, tags: [] });
                            }}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
                            title="Очистить все теги"
                          >
                            <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                          </button>
                        )}
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </button>

                  {showTagsDropdown && (
                    <div className="tags-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg p-2 max-h-[220px] overflow-y-auto">
                      {availableTags.map((tag) => {
                        const tagStyles = {
                          'SEO': { dot: 'bg-purple-500', border: 'border-purple-300', text: 'text-purple-700', hover: 'hover:bg-purple-50' },
                          'Адаптив': { dot: 'bg-blue-500', border: 'border-blue-300', text: 'text-blue-700', hover: 'hover:bg-blue-50' },
                          'Анимация': { dot: 'bg-green-500', border: 'border-green-300', text: 'text-green-700', hover: 'hover:bg-green-50' },
                          'Форма': { dot: 'bg-yellow-500', border: 'border-yellow-300', text: 'text-yellow-700', hover: 'hover:bg-yellow-50' },
                          'Интеграция': { dot: 'bg-red-500', border: 'border-red-300', text: 'text-red-700', hover: 'hover:bg-red-50' },
                          'Мультиязычность': { dot: 'bg-indigo-500', border: 'border-indigo-300', text: 'text-indigo-700', hover: 'hover:bg-indigo-50' }
                        };
                        const style = tagStyles[tag] || { dot: 'bg-gray-500', border: 'border-gray-300', text: 'text-gray-700', hover: 'hover:bg-gray-50' };
                        const isSelected = newLanding.tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              let updatedTags;
                              if (isSelected) {
                                updatedTags = newLanding.tags.filter(t => t !== tag);
                              } else {
                                updatedTags = [...newLanding.tags, tag];
                              }
                              setNewLanding({ ...newLanding, tags: updatedTags });
                            }}
                            className={`w-full px-3 py-2 mb-1 text-left rounded-md transition-colors flex items-center justify-between ${isSelected
                              ? `bg-white border ${style.border} ${style.text}`
                              : `${style.hover} border border-transparent hover:border-gray-200`
                              }`}
                          >
                            <div className="flex items-center">
                              <span className={`w-2 h-2 rounded-full ${style.dot} mr-2`}></span>
                              <span className="text-sm font-medium">{tag}</span>
                            </div>
                            {isSelected && (
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setIsTestMode(false);
                  setNewLanding({
                    article: '',
                    template: '',
                    tags: [],
                    comment: '',
                    is_poland: false,
                    trello_link: '',
                    designer_id: null,
                    buyer_id: null,
                    searcher_id: null,
                    is_test: false,
                    product_manager_id: null,
                    gifer_id: null
                  });
                  setShowBuyerDropdown(false);
                  setShowSearcherDropdown(false);
                  setShowDesignerDropdown(false);
                  setShowTemplateDropdown(false);
                  setShowTagsDropdown(false);
                  setShowProductDropdown(false);
                  setShowGiferDropdown(false);
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
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${isTestMode
                  ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
              >
                {creating ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Создание...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span>{isTestMode ? 'Создать тестовый лендинг' : 'Создать лендинг'}</span>
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

      {/* Edit Modal */}
      {showEditModal && editingLanding && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-5 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white my-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                Редактировать лендинг
              </h3>

              {/* Тумблер для тестового режима (ТОЛЬКО ВИЗУАЛЬНЫЙ) */}
              <div className="flex items-center space-x-3">
                <span className={`text-sm font-medium transition-colors duration-300 ${!editingLanding.is_test ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                  Основной
                </span>
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${editingLanding.is_test ? 'bg-yellow-500' : 'bg-gray-200'
                  } cursor-not-allowed opacity-75`}>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${editingLanding.is_test ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </div>
                <span className={`text-sm font-medium transition-colors duration-300 ${editingLanding.is_test ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                  Тест
                </span>
              </div>

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
                    searcher_id: null,
                    gifer_id: null
                  });
                  setShowBuyerDropdown(false);
                  setShowSearcherDropdown(false);
                  setShowDesignerDropdown(false);
                  setShowTemplateDropdown(false);
                  setShowTagsDropdown(false);
                  setShowProductDropdown(false);
                  setShowGiferDropdown(false);
                  clearMessages();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Индикатор тестового режима */}
            {editingLanding.is_test && (
              <div className="mb-4 bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-md text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                Редактирование тестового лендинга
              </div>
            )}

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Артикул + страна */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Артикул *
                </label>
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editLanding.article}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                      placeholder="Артикул нельзя изменить"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditLanding({ ...editLanding, is_poland: !editLanding.is_poland });
                    }}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 border ${editLanding.is_poland
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

              {/* Карточка Trello */}
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
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${fieldErrors.trello_link
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900 placeholder-red-400'
                    : editingLanding.is_test
                      ? 'border-gray-300 focus:ring-yellow-500 focus:border-transparent'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                    }`}
                  placeholder="https://trello.com/c/..."
                />
                <p className="mt-1 text-xs text-blue-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Укажите ссылку на карточку Trello
                </p>
              </div>

              {/* Шаблон - стилизованный dropdown */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.template ? 'text-red-600' : 'text-gray-700'}`}>
                  Шаблон *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    disabled={loadingTemplates}
                    className={`template-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-white text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed ${fieldErrors.template
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : editingLanding.is_test
                        ? 'border-gray-300 focus:ring-yellow-500 focus:border-transparent'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                      }`}
                  >
                    <span className={editLanding.template ? 'text-gray-900' : 'text-gray-500'}>
                      {loadingTemplates ? 'Загрузка шаблонов...' : (editLanding.template || 'Выберите шаблон')}
                    </span>
                    <div className="flex items-center space-x-1">
                      {editLanding.template && !loadingTemplates && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditLanding({ ...editLanding, template: '' });
                            clearFieldError('template');
                          }}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
                          title="Очистить выбор"
                        >
                          <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                        </button>
                      )}
                      {loadingTemplates ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {showTemplateDropdown && !loadingTemplates && templateOptions.length > 0 && (
                    <div className="template-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {templateOptions.map((template) => (
                        <button
                          key={template}
                          type="button"
                          onClick={() => {
                            setEditLanding({ ...editLanding, template });
                            setShowTemplateDropdown(false);
                            clearFieldError('template');
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          {template}
                        </button>
                      ))}
                    </div>
                  )}

                  {showTemplateDropdown && !loadingTemplates && templateOptions.length === 0 && (
                    <div className="template-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg p-3">
                      <p className="text-sm text-gray-500 text-center">Нет доступных шаблонов</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Designer */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.designer_id ? 'text-red-600' : 'text-gray-700'}`}>
                  Designer {!editingLanding.is_test && '*'}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (!loadingUsers) {
                        setShowDesignerDropdown(!showDesignerDropdown);
                        setShowBuyerDropdown(false);
                        setShowSearcherDropdown(false);
                        setShowTemplateDropdown(false);
                        setShowTagsDropdown(false);
                        setShowProductDropdown(false);
                        setShowGiferDropdown(false);
                      }
                    }}
                    disabled={loadingUsers}
                    className={`designer-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50 ${fieldErrors.designer_id
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : editingLanding.is_test
                        ? 'border-gray-300 focus:ring-yellow-500'
                        : 'border-gray-300 focus:ring-blue-500'
                      }`}
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
                        <span className="text-gray-500">Выберите дизайнера</span>
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
              </div>

              {/* Searcher */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.searcher_id ? 'text-red-600' : 'text-gray-700'}`}>
                  Searcher {!editingLanding.is_test && '*'}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (!loadingUsers) {
                        setShowSearcherDropdown(!showSearcherDropdown);
                        setShowBuyerDropdown(false);
                        setShowDesignerDropdown(false);
                        setShowTemplateDropdown(false);
                        setShowTagsDropdown(false);
                        setShowProductDropdown(false);
                        setShowGiferDropdown(false);
                      }
                    }}
                    disabled={loadingUsers}
                    className={`searcher-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50 ${fieldErrors.searcher_id
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : editingLanding.is_test
                        ? 'border-gray-300 focus:ring-yellow-500'
                        : 'border-gray-300 focus:ring-blue-500'
                      }`}
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
                        <span className="text-gray-500">Выберите серчера</span>
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
              </div>

              {/* GIFer */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${fieldErrors.gifer_id ? 'text-red-600' : 'text-gray-700'}`}>
                  GIFer *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (!loadingUsers) {
                        setShowGiferDropdown(!showGiferDropdown);
                        setShowBuyerDropdown(false);
                        setShowSearcherDropdown(false);
                        setShowDesignerDropdown(false);
                        setShowTemplateDropdown(false);
                        setShowTagsDropdown(false);
                        setShowProductDropdown(false);
                        clearFieldError('gifer_id');
                      }
                    }}
                    disabled={loadingUsers}
                    className={`gifer-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50 ${fieldErrors.gifer_id
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : editingLanding.is_test
                        ? 'border-gray-300 focus:ring-yellow-500'
                        : 'border-gray-300 focus:ring-blue-500'
                      }`}
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      {editLanding.gifer_id ? (
                        <>
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {getGiferAvatar(editLanding.gifer_id) ? (
                              <img
                                src={getGiferAvatar(editLanding.gifer_id)}
                                alt="GIFer"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center ${getGiferAvatar(editLanding.gifer_id) ? 'hidden' : ''}`}>
                              <Palette className="h-3 w-3 text-gray-400" />
                            </div>
                          </div>
                          <span className="text-gray-900 truncate">{getGiferName(editLanding.gifer_id)}</span>
                        </>
                      ) : (
                        <span className="text-gray-500">Выберите гифера</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      {editLanding.gifer_id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditLanding({ ...editLanding, gifer_id: null });
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

                  {showGiferDropdown && !loadingUsers && (
                    <div className="gifer-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {gifers.map((gifer) => (
                        <button
                          key={gifer.id}
                          type="button"
                          onClick={() => {
                            setEditLanding({ ...editLanding, gifer_id: gifer.id });
                            setShowGiferDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {gifer.avatar_url ? (
                              <img
                                src={gifer.avatar_url}
                                alt="GIFer"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center ${gifer.avatar_url ? 'hidden' : ''}`}>
                              <Palette className="h-3 w-3 text-gray-400" />
                            </div>
                          </div>
                          <span className="text-gray-900 truncate">{gifer.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Buyer ИЛИ Product в зависимости от режима */}
              {!editingLanding.is_test ? (
                // Обычный режим - Buyer
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
                          setShowTemplateDropdown(false);
                          setShowTagsDropdown(false);
                          setShowProductDropdown(false);
                          setShowGiferDropdown(false);
                        }
                      }}
                      disabled={loadingUsers}
                      className={`buyer-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50 ${fieldErrors.buyer_id
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-blue-500'
                      }`}
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
                          <span className="text-gray-500">Выберите байера</span>
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
                </div>
              ) : (
                
                // Тестовый режим - Product
                <div>
                  <label className={`block text-sm font-medium mb-2 ${fieldErrors.product_manager_id ? 'text-red-600' : 'text-gray-700'}`}>
                    Product *
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (!loadingUsers) {
                          setShowProductDropdown(!showProductDropdown);
                          setShowBuyerDropdown(false);
                          setShowSearcherDropdown(false);
                          setShowDesignerDropdown(false);
                          setShowTemplateDropdown(false);
                          setShowTagsDropdown(false);
                          setShowGiferDropdown(false);
                          clearFieldError('product_manager_id');
                        }
                      }}
                      disabled={loadingUsers}
                      className={`product-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-left flex items-center justify-between disabled:opacity-50 ${fieldErrors.product_manager_id
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-yellow-500'
                      }`}
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        {editLanding.product_manager_id ? (
                          <>
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {getProductManagerAvatar(editLanding.product_manager_id) ? (
                                <img
                                  src={getProductManagerAvatar(editLanding.product_manager_id)}
                                  alt="Product"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${getProductManagerAvatar(editLanding.product_manager_id) ? 'hidden' : ''}`}>
                                <Target className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-gray-900 truncate">{getProductManagerName(editLanding.product_manager_id)}</span>
                          </>
                        ) : (
                          <span className="text-gray-500">Выберите продакт менеджера</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        {getSelectedProductManagerEdit() && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditLanding({ ...editLanding, product_manager_id: null });
                              clearFieldError('product_manager_id');
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

                    {showProductDropdown && !loadingUsers && (
                      <div className="product-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {productManagers.map((pm) => (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => {
                              setEditLanding({ ...editLanding, product_manager_id: pm.id });
                              setShowProductDropdown(false);
                              clearFieldError('product_manager_id');
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {pm.avatar_url ? (
                                <img
                                  src={pm.avatar_url}
                                  alt="Product"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${pm.avatar_url ? 'hidden' : ''}`}>
                                <Target className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-gray-900 truncate">{pm.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Комментарий */}
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
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${editingLanding.is_test ? 'focus:ring-yellow-500' : 'focus:ring-blue-500'
                    }`}
                  placeholder="Добавьте комментарий к лендингу (необязательно)"
                />
              </div>

              {/* Теги - красивый множественный dropdown */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Теги ({editLanding.tags.length} выбрано)
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTagsDropdown(!showTagsDropdown)}
                    className={`tags-trigger w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-white text-left ${editingLanding.is_test
                      ? 'border-gray-300 focus:ring-yellow-500 focus:border-transparent'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        {editLanding.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {editLanding.tags.map((tag, index) => {
                              const tagStyles = {
                                'SEO': { dot: 'bg-purple-500', border: 'border-purple-300', text: 'text-purple-700' },
                                'Адаптив': { dot: 'bg-blue-500', border: 'border-blue-300', text: 'text-blue-700' },
                                'Анимация': { dot: 'bg-green-500', border: 'border-green-300', text: 'text-green-700' },
                                'Форма': { dot: 'bg-yellow-500', border: 'border-yellow-300', text: 'text-yellow-700' },
                                'Интеграция': { dot: 'bg-red-500', border: 'border-red-300', text: 'text-red-700' },
                                'Мультиязычность': { dot: 'bg-indigo-500', border: 'border-indigo-300', text: 'text-indigo-700' }
                              };
                              const style = tagStyles[tag] || { dot: 'bg-gray-500', border: 'border-gray-300', text: 'text-gray-700' };
                              return (
                                <span
                                  key={index}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-white ${style.border} ${style.text}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot} mr-1.5`}></span>
                                  {tag}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-500">Выберите теги</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                        {editLanding.tags.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditLanding({ ...editLanding, tags: [] });
                            }}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
                            title="Очистить все теги"
                          >
                            <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                          </button>
                        )}
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </button>

                  {showTagsDropdown && (
                    <div className="tags-dropdown absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg p-2 max-h-[220px] overflow-y-auto">
                      {availableTags.map((tag) => {
                        const tagStyles = {
                          'SEO': { dot: 'bg-purple-500', border: 'border-purple-300', text: 'text-purple-700', hover: 'hover:bg-purple-50' },
                          'Адаптив': { dot: 'bg-blue-500', border: 'border-blue-300', text: 'text-blue-700', hover: 'hover:bg-blue-50' },
                          'Анимация': { dot: 'bg-green-500', border: 'border-green-300', text: 'text-green-700', hover: 'hover:bg-green-50' },
                          'Форма': { dot: 'bg-yellow-500', border: 'border-yellow-300', text: 'text-yellow-700', hover: 'hover:bg-yellow-50' },
                          'Интеграция': { dot: 'bg-red-500', border: 'border-red-300', text: 'text-red-700', hover: 'hover:bg-red-50' },
                          'Мультиязычность': { dot: 'bg-indigo-500', border: 'border-indigo-300', text: 'text-indigo-700', hover: 'hover:bg-indigo-50' }
                        };
                        const style = tagStyles[tag] || { dot: 'bg-gray-500', border: 'border-gray-300', text: 'text-gray-700', hover: 'hover:bg-gray-50' };
                        const isSelected = editLanding.tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              let updatedTags;
                              if (isSelected) {
                                updatedTags = editLanding.tags.filter(t => t !== tag);
                              } else {
                                updatedTags = [...editLanding.tags, tag];
                              }
                              setEditLanding({ ...editLanding, tags: updatedTags });
                            }}
                            className={`w-full px-3 py-2 mb-1 text-left rounded-md transition-colors flex items-center justify-between ${isSelected
                              ? `bg-white border ${style.border} ${style.text}`
                              : `${style.hover} border border-transparent hover:border-gray-200`
                              }`}
                          >
                            <div className="flex items-center">
                              <span className={`w-2 h-2 rounded-full ${style.dot} mr-2`}></span>
                              <span className="text-sm font-medium">{tag}</span>
                            </div>
                            {isSelected && (
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                    searcher_id: null,
                    gifer_id: null
                  });
                  setShowBuyerDropdown(false);
                  setShowSearcherDropdown(false);
                  setShowDesignerDropdown(false);
                  setShowTemplateDropdown(false);
                  setShowTagsDropdown(false);
                  setShowProductDropdown(false);
                  setShowGiferDropdown(false);
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
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${editingLanding.is_test
                  ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
              >
                {updating ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Обновление...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span>{editingLanding.is_test ? 'Обновить тестовый лендинг' : 'Обновить лендинг'}</span>
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

      {/* UUID Modal - Показ кода интеграции */}
      {showUuidModal && selectedLandingUuid && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div
            className="relative top-20 mx-auto p-6 border w-full max-w-3xl shadow-lg rounded-lg bg-white my-5"
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Код интеграции лендинга</h3>
              </div>
              <button
                onClick={() => {
                  setShowUuidModal(false);
                  setSelectedLandingUuid(null);
                  setCopiedUuid(false);
                  setVerifiedUrls([]);
                  setLoadingUrls(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2 font-medium">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Используйте этот код для интеграции:
                </p>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 relative">
                <pre className="text-sm text-green-400 font-mono overflow-x-auto">
                  {`<div 
id="rt-meta" 
data-rt-sub16="${selectedLandingUuid}"
></div>`}
                </pre>

                <button
                  onClick={handleCopyUuid}
                  className={`absolute top-3 right-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${copiedUuid ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  title="Копировать код"
                >
                  {copiedUuid ? (
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Скопировано!</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Копировать</span>
                    </div>
                  )}
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>UUID лендинга:</strong>
                </p>
                <p className="text-sm font-mono text-gray-900 bg-white px-3 py-2 rounded border border-gray-300">
                  {selectedLandingUuid}
                </p>
              </div>

              {/* Список верифицированных URL */}
              {verifiedUrls && verifiedUrls.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <h4 className="text-sm font-medium text-green-900">Верифицированные интеграции ({verifiedUrls.length})</h4>
                  </div>

                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {verifiedUrls.map((url, index) => (
                      <div key={index} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-green-100">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-green-600 hover:text-green-800 truncate flex items-center flex-1"
                        >
                          <ExternalLink className="h-3 w-3 mr-2 flex-shrink-0" />
                          <span className="truncate">{url}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loadingUrls && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  <span className="ml-2 text-sm text-gray-600">Загрузка верифицированных ссылок...</span>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Вставьте этот код в HTML вашего лендинга для правильной работы трекинга
                </p>
              </div>

              {/* Разделитель */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                  Проверка интеграции
                </h4>

                {/* Компонент проверки интеграции */}
                <IntegrationChecker
                  landingUuid={selectedLandingUuid}
                  onIntegrationVerified={(urls) => handleIntegrationVerified(selectedLandingUuid, urls)}
                />
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowUuidModal(false);
                  setSelectedLandingUuid(null);
                  setCopiedUuid(false);
                  setVerifiedUrls([]);
                  setLoadingUrls(false);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors font-medium"
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
                  <path stroke="none" d="M0 0h24v24H0z" />
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
                  <path stroke="none" d="M0 0h24v24H0z" />
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
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${entry.change_type === 'created'
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
                            <span className="text-sm text-gray-900">{getTemplateName(entry.template_id)}</span>
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
                            {entry.tag_ids && entry.tag_ids.length > 0 ? (
                              getTagNames(entry.tag_ids).map((tag, idx) => (
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
