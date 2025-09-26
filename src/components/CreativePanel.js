// CreativePanel.js - ОБНОВЛЕННАЯ ВЕРСИЯ с переключением метрик в той же строке
// Замените содержимое src/components/CreativePanel.js

import React, { useState, useEffect } from 'react';
import { creativeService } from '../supabaseClient';
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
  ChevronRight
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
  
  // НОВЫЕ состояния для переключения метрик в той же строке
  const [detailMode, setDetailMode] = useState(new Map()); // 'aggregated' (по умолчанию) или 'individual'
  const [currentVideoIndex, setCurrentVideoIndex] = useState(new Map()); // индекс текущего видео для каждого креатива
  
  const [newCreative, setNewCreative] = useState({
    article: '',
    links: [''],
    work_types: [],
    link_titles: [],
    comment: '',
    is_poland: false
  });

  const [extractingTitles, setExtractingTitles] = useState(false);

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
          cpl: aggregated.leads > 0 ? `$${cpl.toFixed(2)}` : '$0.00',
          cost: `$${aggregated.cost.toFixed(2)}`,
          ctr: `${ctr.toFixed(2)}%`,
          cpc: `$${cpc.toFixed(2)}`,
          cpm: `$${cpm.toFixed(2)}`,
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

  useEffect(() => {
    loadCreatives();
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

  const validateGoogleDriveLinks = (links) => {
    const validLinks = links.filter(link => link.trim() !== '');
    const invalidLinks = [];

    for (const link of validLinks) {
      if (!isGoogleDriveUrl(link)) {
        invalidLinks.push(link);
      }
    }

    return { validLinks, invalidLinks };
  };

  const handleCreateCreative = async () => {
    if (!newCreative.article.trim()) {
      setError('Артикул обязателен для заполнения');
      return;
    }

    const { validLinks, invalidLinks } = validateGoogleDriveLinks(newCreative.links);
    
    if (validLinks.length === 0) {
      setError('Необходимо добавить хотя бы одну ссылку на Google Drive');
      return;
    }

    if (invalidLinks.length > 0) {
      setError(`Неверные ссылки (должны быть Google Drive): ${invalidLinks.join(', ')}`);
      return;
    }

    if (newCreative.work_types.length === 0) {
      setError('Необходимо выбрать хотя бы один тип работы');
      return;
    }

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

      await creativeService.createCreative({
        user_id: user.id,
        editor_name: user.name,
        article: newCreative.article.trim(),
        links: links,
        link_titles: titles,
        work_types: newCreative.work_types,
        cof_rating: cofRating,
        comment: newCreative.comment.trim() || null,
        is_poland: newCreative.is_poland
      });

      setNewCreative({
        article: '',
        links: [''],
        work_types: [],
        link_titles: [],
        comment: '',
        is_poland: false
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
  };

  const handleRefreshAll = async () => {
    console.log(`🔄 Полное обновление данных (период: ${metricsPeriod})`);
    await loadCreatives();
    refreshMetrics();
    refreshZoneData();
  };

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
                {user?.name} • {creatives.length} креативов • COF: {formatCOF(cofStats.totalCOF)}
                {zoneDataStats.total > 0 && (
                  <span className="ml-2">• Зоны: {zoneDataStats.found}/{zoneDataStats.total}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
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
      {creatives.length > 0 && (
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
                        {creatives.length}
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
                        {creatives.filter(c => c.comment && c.comment.trim()).length}
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
                        {formatCOF(cofStats.totalCOF)}
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
                        {formatCOF(cofStats.avgCOF)}
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
                        <span className="text-white text-xs font-bold">CPL</span>
                      </div>
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CPL
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          ${creatives.length > 0 && aggregatedMetricsStats.totalLeads > 0 ? 
                            (aggregatedMetricsStats.totalCost / aggregatedMetricsStats.totalLeads).toFixed(2) : 
                            '0.00'}
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
                        <span className="text-white text-xs font-bold">CPC</span>
                      </div>
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CPC
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          ${aggregatedMetricsStats.totalClicks > 0 ? 
                            (aggregatedMetricsStats.totalCost / aggregatedMetricsStats.totalClicks).toFixed(2) : 
                            '0.00'}
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
                        <span className="text-white text-xs font-bold">CTR</span>
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
                        <span className="text-white text-xs font-bold">CPM</span>
                      </div>
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <dl>
                        <dt className="text-xs font-medium text-gray-500 truncate">
                          CPM
                        </dt>
                        <dd className="text-lg font-semibold text-gray-900">
                          ${aggregatedMetricsStats.totalImpressions > 0 ? 
                            ((aggregatedMetricsStats.totalCost / aggregatedMetricsStats.totalImpressions) * 1000).toFixed(2) : 
                            '0.00'}
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
                          {creatives.length > 0 ? Math.round(aggregatedMetricsStats.totalLeads / creatives.length) : 0}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm mt-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-blue-600">
                  {metricsLoading ? 'Загрузка метрик...' : 
                   metricsStats ? `Метрики (${getPeriodButtonText()}): ${metricsStats.found}/${metricsStats.total}` : 
                   `Метрики (${getPeriodButtonText()}) включены`}
                </span>
                {metricsPeriod === '4days' && metricsStats?.found === 0 && metricsStats?.total > 0 && (
                  <span className="text-red-600 text-xs font-medium">
                    (Возможно, нет данных за последние 4 дня)
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Layers className="h-4 w-4 text-emerald-500" />
                <span className="text-emerald-600">
                  {zoneDataLoading ? 'Загрузка зон...' : 
                   `Зоны: ${zoneDataStats.found}/${zoneDataStats.total}`}
                </span>
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {creatives.length === 0 ? (
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
                {getCurrentMonthYear()}
              </h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Дата
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Артикул
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Видео
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Зона
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <BarChart3 className="h-4 w-4 mx-auto" />
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Лиды
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CPL
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Расходы
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Клики
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CPC
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CTR
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CPM
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Показы
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Дней
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Зоны
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        COF
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                                  <div className="flex items-center space-x-2">
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
                                      <BarChart3 className="h-4 w-4" />
                                    </button>
                                    {currentMode === 'aggregated' && getAggregatedCreativeMetrics(creative)?.found && getAggregatedCreativeMetrics(creative).videoCount > 1 && (
                                      <span className="text-xs text-blue-600 bg-blue-100 px-1 rounded cursor-text select-text">
                                        {getAggregatedCreativeMetrics(creative).videoCount}
                                      </span>
                                    )}
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
                            
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-400 text-center">
                              <span className="cursor-text select-text">—</span>
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
          <div className="relative top-5 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white my-5">
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
                    is_poland: false
                  });
                  setExtractingTitles(false);
                  clearMessages();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Артикул *
                </label>
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={newCreative.article}
                      onChange={(e) => {
                        setNewCreative({ ...newCreative, article: e.target.value });
                        clearMessages();
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Введите артикул"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setNewCreative({ ...newCreative, is_poland: !newCreative.is_poland });
                      clearMessages();
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Drive ссылки *
                </label>
                <div className="space-y-2">
                  {newCreative.links.map((link, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => updateLink(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                <p className="mt-2 text-xs text-yellow-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Используйте только ссылки на Google Drive файлы
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Комментарий
                </label>
                <textarea
                  value={newCreative.comment}
                  onChange={(e) => {
                    setNewCreative({ ...newCreative, comment: e.target.value });
                    clearMessages();
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Добавьте комментарий к креативу (необязательно)"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
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
                <div className="max-h-72 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
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

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCreateModal(false);
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
