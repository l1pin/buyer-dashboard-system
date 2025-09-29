// CreativePanel.js - ОБНОВЛЕННАЯ ВЕРСИЯ с переключением метрик в той же строке
// Замените содержимое src/components/CreativePanel.js

import React, { useState, useEffect } from 'react';
import { creativeService, userService } from '../supabaseClient';
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
  Bug,
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
  Search
} from 'lucide-react';

function CreativePanel({ user }) {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [creating, setCreating] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [metricsPeriod, setMetricsPeriod] = useState('all');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [expandedWorkTypes, setExpandedWorkTypes] = useState(new Set());
  const [openDropdowns, setOpenDropdowns] = useState(new Set());
  const [debugMode, setDebugMode] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null); // null = текущий месяц
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  
  // НОВЫЕ состояния для переключения метрик в той же строке
  const [detailMode, setDetailMode] = useState(new Map()); // 'aggregated' (по умолчанию) или 'individual'
  const [currentVideoIndex, setCurrentVideoIndex] = useState(new Map()); // индекс текущего видео для каждого креатива
  
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

  const [extractingTitles, setExtractingTitles] = useState(false);
  const [buyers, setBuyers] = useState([]);
  const [searchers, setSearchers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [showSearcherDropdown, setShowSearcherDropdown] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Хуки для метрик
  const { 
    batchMetrics, 
    loading: metricsLoading, 
    error: metricsError,
    stats: metricsStats,
    getVideoMetrics,
    getCreativeMetrics,
    refresh: refreshMetrics 
  } = useBatchMetrics(creatives, true, metricsPeriod);

  const { 
    stats: aggregatedMetricsStats,
    formatStats,
    hasData: hasMetricsData 
  } = useMetricsStats(creatives, batchMetrics);

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
  } = useZoneData(creatives, true);

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

    // Вычисляем среднее время просмотра
    const avgDuration = validMetrics.length > 0 ? aggregated.avg_duration / validMetrics.length : 0;

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

  const getCOFStats = () => {
    const totalCOF = creatives.reduce((sum, creative) => {
      return sum + calculateCOF(creative.work_types);
    }, 0);

    const avgCOF = creatives.length > 0 ? totalCOF / creatives.length : 0;
    
    return {
      totalCOF: totalCOF,
      avgCOF: avgCOF,
      maxCOF: Math.max(...creatives.map(c => calculateCOF(c.work_types)), 0),
      minCOF: creatives.length > 0 ? Math.min(...creatives.map(c => calculateCOF(c.work_types))) : 0
    };
  };

  // НОВЫЕ ФУНКЦИИ: Подсчет по странам и зонам
  const getCountryStats = () => {
    const ukraineCount = creatives.filter(c => !c.is_poland).length;
    const polandCount = creatives.filter(c => c.is_poland).length;
    return { ukraineCount, polandCount };
  };

  const getZoneStats = () => {
    const zoneCount = { red: 0, pink: 0, gold: 0, green: 0 };
    
    creatives.forEach(creative => {
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

  // Получить список всех доступных месяцев из креативов
  const getAvailableMonths = () => {
    if (creatives.length === 0) return [];
    
    const monthsSet = new Set();
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    
    creatives.forEach(creative => {
      const match = creative.created_at.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [_, year, month] = match;
        const monthIndex = parseInt(month) - 1;
        const monthYear = `${months[monthIndex]}, ${year}`;
        const monthKey = `${year}-${month}`;
        monthsSet.add(JSON.stringify({ display: monthYear, key: monthKey }));
      }
    });
    
    const monthsList = Array.from(monthsSet)
      .map(item => JSON.parse(item))
      .sort((a, b) => b.key.localeCompare(a.key)); // Сортировка от нового к старому
    
    return monthsList;
  };

  // Получить отображаемое название месяца
  const getDisplayMonthYear = () => {
    if (selectedMonth === null) {
      return getCurrentMonthYear();
    }
    
    const availableMonths = getAvailableMonths();
    const found = availableMonths.find(m => m.key === selectedMonth);
    return found ? found.display : getCurrentMonthYear();
  };

  // Фильтровать креативы по выбранному месяцу
  const getFilteredCreatives = () => {
    if (selectedMonth === null) {
      // Текущий месяц
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentMonthKey = `${currentYear}-${currentMonth}`;
      
      return creatives.filter(creative => {
        const match = creative.created_at.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const [_, year, month] = match;
          const creativeMonthKey = `${year}-${month}`;
          return creativeMonthKey === currentMonthKey;
        }
        return false;
      });
    }
    
    // Выбранный месяц
    return creatives.filter(creative => {
      const match = creative.created_at.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [_, year, month] = match;
        const creativeMonthKey = `${year}-${month}`;
        return creativeMonthKey === selectedMonth;
      }
      return false;
    });
  };

  useEffect(() => {
    loadCreatives();
    loadUsers();
  }, []);

  const loadCreatives = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('📡 Загрузка креативов пользователя...');
      const data = await creativeService.getUserCreatives(user.id);
      setCreatives(data);
      console.log(`✅ Загружено ${data.length} креативов`);
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

      await loadCreatives();
      
      const successCount = extractedTitles.length;
      const totalCount = titles.length;
      const cof = calculateCOF(newCreative.work_types);
      const country = newCreative.is_poland ? 'PL' : 'UA';
      setSuccess(`Креатив создан! COF: ${formatCOF(cof)} | Страна: ${country} | Названий извлечено: ${successCount}/${totalCount}`);
    } catch (error) {
      setError('Ошибка создания креатива: ' + error.message);
      setExtractingTitles(false);
      setAuthorizing(false);
    } finally {
      setCreating(false);
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
      if (!event.target.closest('.month-dropdown') && !event.target.closest('.month-trigger')) {
        setShowMonthDropdown(false);
      }
      if (!event.target.closest('.buyer-dropdown') && !event.target.closest('.buyer-trigger')) {
        setShowBuyerDropdown(false);
      }
      if (!event.target.closest('.searcher-dropdown') && !event.target.closest('.searcher-trigger')) {
        setShowSearcherDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  const debugCreativeMetrics = async (creative) => {
    if (!creative.link_titles || creative.link_titles.length === 0) {
      console.log('❌ У креатива нет названий видео для отладки');
      return;
    }

    console.log(`🐛 === ОТЛАДКА МЕТРИК ДЛЯ КРЕАТИВА "${creative.article}" ===`);
    console.log('📋 Информация о креативе:');
    console.log('  - ID:', creative.id);
    console.log('  - Артикул:', creative.article);
    console.log('  - Видео:', creative.link_titles);
    console.log('  - Период:', metricsPeriod);
    
    for (let i = 0; i < creative.link_titles.length; i++) {
      const videoTitle = creative.link_titles[i];
      if (videoTitle && !videoTitle.startsWith('Видео ')) {
        console.log(`🔍 Тестирование метрик для видео ${i + 1}: "${videoTitle}"`);
        try {
          const result = await MetricsService.getVideoMetrics(videoTitle, metricsPeriod);
          console.log(`📊 Результат теста для видео ${i + 1}:`, result);
        } catch (error) {
          console.error(`❌ Ошибка теста для видео ${i + 1}:`, error);
        }
      }
    }
    
    console.log('🐛 === КОНЕЦ ОТЛАДКИ МЕТРИК ===');
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
    console.log(`🔄 Полное обновление данных (период: ${metricsPeriod})`);
    await loadCreatives();
    refreshMetrics();
    refreshZoneData();
  };

  const filteredCreatives = getFilteredCreatives();
  const availableMonths = getAvailableMonths();
  
  const cofStats = getCOFStats();
  const countryStats = getCountryStats();
  const zoneStats = getZoneStats();

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
            <div className="relative">
              <button
                onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                className="month-trigger inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {getDisplayMonthYear()}
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showMonthDropdown && availableMonths.length > 0 && (
                <div className="month-dropdown absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSelectedMonth(null);
                        setShowMonthDropdown(false);
                      }}
                      className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                        selectedMonth === null ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      {getCurrentMonthYear()} (текущий)
                    </button>
                    {availableMonths.map((month) => (
                      <button
                        key={month.key}
                        onClick={() => {
                          setSelectedMonth(month.key);
                          setShowMonthDropdown(false);
                        }}
                        className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                          selectedMonth === month.key ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        {month.display}
                      </button>
                    ))}
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
                {getPeriodButtonText()}
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showPeriodDropdown && (
                <div className="period-dropdown absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-50">
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

            {metricsPeriod === '4days' && (
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  debugMode 
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
                title="Включить режим отладки метрик"
              >
                <Bug className="h-4 w-4 mr-2" />
                {debugMode ? 'Отладка ВКЛ' : 'Отладка'}
              </button>
            )}
            
            <button
              onClick={handleRefreshAll}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
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
                      <span className="text-white font-bold text-xs sm:text-xs md:text-xs">COF</span>
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
                        <span className="text-white font-bold text-xs sm:text-xs md:text-xs">CPL</span>
                      </div>
                    </div>
                    <div className="ml-2 sm:ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CPL
                        </dt>
                        <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                          {hasMetricsData ? (creatives.length > 0 && aggregatedMetricsStats.totalLeads > 0 ? 
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
                        <span className="text-white font-bold text-xs sm:text-xs md:text-xs">CPC</span>
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
                        <span className="text-white font-bold text-xs sm:text-xs md:text-xs">CTR</span>
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
                        <span className="text-white font-bold text-xs sm:text-xs md:text-xs">CPM</span>
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
                          {hasMetricsData ? (creatives.length > 0 ? Math.round(aggregatedMetricsStats.totalLeads / creatives.length) : 0) : '—'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

            </div>
        </div>
      )}
      
      {/* Messages */}
      {success && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm flex items-center">
          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {success}
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
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать креатив
            </button>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 text-center">
                {getDisplayMonthYear()}
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
                        Buyer
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
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
                                  {debugMode && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        debugCreativeMetrics(creative);
                                      }}
                                      className="ml-2 text-yellow-600 hover:text-yellow-800"
                                      title="Отладить метрики для этого креатива"
                                    >
                                      🐛
                                    </button>
                                  )}
                                </div>
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
                                          <span className="font-bold text-sm cursor-text select-text text-black-700">
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
                                          <span className="font-bold text-sm cursor-text select-text text-black-700">
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
        <a
          href={creative.trello_link}
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
                              {(creative.buyer_id || creative.buyer) ? (
                                <div className="flex items-center justify-center space-x-2">
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

                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {(creative.searcher_id || creative.searcher) ? (
                                <div className="flex items-center justify-center space-x-2">
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

export default CreativePanel;
