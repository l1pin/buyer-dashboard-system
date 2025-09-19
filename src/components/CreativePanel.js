// Исправленный CreativePanel.js с улучшенной отладкой метрик
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
import { useBatchMetrics, useMetricsApi } from '../hooks/useMetrics';
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
  Info
} from 'lucide-react';

function CreativePanel({ user }) {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [creating, setCreating] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);
  const [expandedWorkTypes, setExpandedWorkTypes] = useState(new Set());
  const [openDropdowns, setOpenDropdowns] = useState(new Set());
  const [debugInfo, setDebugInfo] = useState(null);
  
  const [newCreative, setNewCreative] = useState({
    article: '',
    links: [''],
    work_types: [],
    link_titles: [],
    comment: ''
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
  } = useBatchMetrics(creatives, showMetrics);

  // API статус
  const { 
    apiStatus, 
    checking: checkingApi, 
    checkApiStatus,
    isAvailable: isMetricsApiAvailable 
  } = useMetricsApi();

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

  /**
   * Вычисление COF для креатива
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

  /**
   * Получение цвета для COF бейджа
   */
  const getCOFBadgeColor = (cof) => {
    if (cof >= 4) return 'bg-red-600 text-white border-red-600';
    if (cof >= 3) return 'bg-red-300 text-red-800 border-red-300';
    if (cof >= 2) return 'bg-yellow-300 text-yellow-800 border-yellow-300';
    if (cof >= 1.01) return 'bg-green-200 text-green-800 border-green-200';
    return 'bg-green-500 text-white border-green-500';
  };

  /**
   * Вычисление общей статистики COF
   */
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

  /**
   * НОВАЯ ФУНКЦИЯ: Генерация отладочной информации
   */
  const generateDebugInfo = () => {
    const debugData = {
      timestamp: new Date().toISOString(),
      user: {
        id: user?.id,
        name: user?.name,
        role: user?.role
      },
      creatives: {
        total: creatives.length,
        withLinkTitles: creatives.filter(c => c.link_titles && c.link_titles.length > 0).length,
        withValidTitles: creatives.filter(c => 
          c.link_titles && 
          c.link_titles.some(title => title && !title.startsWith('Видео '))
        ).length,
        withFallbackTitles: creatives.filter(c => 
          c.link_titles && 
          c.link_titles.every(title => !title || title.startsWith('Видео '))
        ).length
      },
      metrics: {
        enabled: showMetrics,
        loading: metricsLoading,
        error: metricsError,
        apiStatus: apiStatus,
        apiAvailable: isMetricsApiAvailable,
        stats: metricsStats,
        batchSize: batchMetrics?.size || 0
      },
      samples: creatives.slice(0, 3).map(creative => ({
        id: creative.id,
        article: creative.article,
        link_titles: creative.link_titles,
        hasValidTitles: creative.link_titles && creative.link_titles.some(title => 
          title && !title.startsWith('Видео ')
        ),
        firstVideoMetrics: getVideoMetrics(creative.id, 0)
      }))
    };

    console.log('🐛 Debug Info:', debugData);
    return debugData;
  };

  useEffect(() => {
    loadCreatives();
  }, []);

  // Генерируем отладочную информацию при изменении данных
  useEffect(() => {
    if (creatives.length > 0) {
      setDebugInfo(generateDebugInfo());
    }
  }, [creatives, batchMetrics, metricsLoading, apiStatus]);

  const loadCreatives = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await creativeService.getUserCreatives(user.id);
      setCreatives(data);
      console.log('✅ Креативы загружены:', data.length);
      
      // Выводим информацию о названиях видео для отладки
      data.forEach((creative, index) => {
        console.log(`Креатив ${index + 1} (${creative.article}):`, {
          link_titles: creative.link_titles,
          hasValidTitles: creative.link_titles && creative.link_titles.some(title => 
            title && !title.startsWith('Видео ')
          )
        });
      });
    } catch (error) {
      setError('Ошибка загрузки креативов: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Валидация Google Drive ссылок
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

      // Проверяем что удалось извлечь хотя бы одно реальное название
      const extractedTitles = titles.filter(title => !title.startsWith('Видео '));
      console.log('📝 Извлеченные названия:', {
        всего: titles.length,
        извлечено: extractedTitles.length,
        fallback: titles.length - extractedTitles.length,
        titles: titles
      });

      // Вычисляем COF для сохранения в базе данных
      const cofRating = calculateCOF(newCreative.work_types);

      await creativeService.createCreative({
        user_id: user.id,
        editor_name: user.name,
        article: newCreative.article.trim(),
        links: links,
        link_titles: titles,
        work_types: newCreative.work_types,
        cof_rating: cofRating,
        comment: newCreative.comment.trim() || null
      });

      setNewCreative({
        article: '',
        links: [''],
        work_types: [],
        link_titles: [],
        comment: ''
      });
      setShowCreateModal(false);

      await loadCreatives();
      
      const successCount = extractedTitles.length;
      const totalCount = titles.length;
      const cof = calculateCOF(newCreative.work_types);
      let message = `Креатив создан! COF: ${formatCOF(cof)} | Названий извлечено: ${successCount}/${totalCount}`;
      
      if (successCount === 0) {
        message += ' ⚠️ Все названия fallback - метрики могут быть недоступны';
      }
      
      setSuccess(message);
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

  // Функция для переключения раскрытия типов работ
  const toggleWorkTypes = (creativeId) => {
    const newExpanded = new Set(expandedWorkTypes);
    if (newExpanded.has(creativeId)) {
      newExpanded.delete(creativeId);
    } else {
      newExpanded.add(creativeId);
    }
    setExpandedWorkTypes(newExpanded);
  };

  // Функция для переключения выпадающего меню
  const toggleDropdown = (creativeId) => {
    const newOpenDropdowns = new Set(openDropdowns);
    if (newOpenDropdowns.has(creativeId)) {
      newOpenDropdowns.delete(creativeId);
    } else {
      newOpenDropdowns.add(creativeId);
    }
    setOpenDropdowns(newOpenDropdowns);
  };

  // Закрытие всех выпадающих меню при клике вне их
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-menu') && !event.target.closest('.dropdown-trigger')) {
        setOpenDropdowns(new Set());
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
    await loadCreatives();
    if (showMetrics) {
      refreshMetrics();
    }
  };

  // Получаем статистику COF
  const cofStats = getCOFStats();

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
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* НОВАЯ КНОПКА ОТЛАДКИ */}
            <button
              onClick={() => setShowDebugModal(true)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-yellow-100 text-yellow-700 border border-yellow-300 hover:bg-yellow-200"
              title="Показать информацию для отладки"
            >
              <Bug className="h-4 w-4 mr-2" />
              Отладка
            </button>

            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                showMetrics 
                  ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {showMetrics ? 'Скрыть метрики' : 'Показать метрики'}
            </button>
            
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

      {/* COF Statistics */}
      {creatives.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Статистика COF:</span>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <div>
                  <span className="text-gray-500">Общий:</span>
                  <span className="ml-1 font-medium text-gray-900">{formatCOF(cofStats.totalCOF)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Средний:</span>
                  <span className="ml-1 font-medium text-gray-900">{formatCOF(cofStats.avgCOF)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Макс:</span>
                  <span className="ml-1 font-medium text-gray-900">{formatCOF(cofStats.maxCOF)}</span>
                </div>
              </div>
            </div>
            
            {showMetrics && (
              <div className="flex items-center space-x-2 text-sm">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-blue-600">
                  {metricsLoading ? 'Загрузка метрик...' : 
                   metricsStats ? `Метрики: ${metricsStats.found}/${metricsStats.total}` : 
                   'Метрики включены'}
                </span>
                
                {/* API Status */}
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
                    <AlertCircle className="h-3 w-3" />
                  )}
                  <span>
                    {checkingApi ? 'Проверка...' : 
                     isMetricsApiAvailable ? 'API ОК' : 
                     'API недоступен'}
                  </span>
                </div>
              </div>
            )}
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

      {/* Metrics Error */}
      {showMetrics && metricsError && (
        <div className="mx-6 mt-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md text-sm flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          Ошибка загрузки метрик: {metricsError}
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
          /* Таблица креативов */
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Мои креативы ({creatives.length})
              </h3>
              
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Дата
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Артикул
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Видео
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Типы работ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Комментарий
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        COF
                      </th>
                      {showMetrics && (
                        <>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Лиды
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            CPL
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            CTR
                          </th>
                        </>
                      )}
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        
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
                        
                        // ИСПРАВЛЕННАЯ ЛОГИКА: получаем метрики для первого видео
                        const firstVideoMetrics = showMetrics ? getVideoMetrics(creative.id, 0) : null;
                        const isWorkTypesExpanded = expandedWorkTypes.has(creative.id);
                        const isDropdownOpen = openDropdowns.has(creative.id);
                        const formattedDateTime = formatKyivTime(creative.created_at);
                        
                        // ОТЛАДОЧНАЯ ИНФОРМАЦИЯ
                        if (showMetrics && creative.id) {
                          console.log(`🔍 Креатив ${creative.article}:`, {
                            id: creative.id,
                            link_titles: creative.link_titles,
                            hasValidTitles: creative.link_titles && creative.link_titles.some(title => 
                              title && !title.startsWith('Видео ')
                            ),
                            firstVideoMetrics: firstVideoMetrics,
                            metricFound: firstVideoMetrics?.found
                          });
                        }
                        
                        return (
                          <tr key={creative.id} className="hover:bg-gray-50">
                            {/* Дата */}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="text-center">
                                <div className="font-medium">{formattedDateTime.date}</div>
                                <div className="text-xs text-gray-500">{formattedDateTime.time}</div>
                              </div>
                            </td>
                            
                            {/* Артикул */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {creative.article}
                              </div>
                            </td>
                            
                            {/* Видео - все названия */}
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="space-y-1">
                                {creative.link_titles && creative.link_titles.length > 0 ? (
                                  creative.link_titles.map((title, index) => (
                                    <div key={index} className="flex items-center justify-between">
                                      <div className="flex items-center space-x-1">
                                        <span className="block">{title}</span>
                                        {/* ИНДИКАТОР ВАЛИДНОСТИ НАЗВАНИЯ */}
                                        {title && !title.startsWith('Видео ') ? (
                                          <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800" title="Реальное название">
                                            ✓
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800" title="Fallback название">
                                            ⚠
                                          </span>
                                        )}
                                      </div>
                                      <a
                                        href={creative.links[index]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-2 text-blue-600 hover:text-blue-800 flex-shrink-0"
                                        title="Открыть в Google Drive"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-gray-400">Нет видео</span>
                                )}
                              </div>
                            </td>
                            
                            {/* Типы работ - раскрывающиеся */}
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {creative.work_types && creative.work_types.length > 0 ? (
                                <div>
                                  <button
                                    onClick={() => toggleWorkTypes(creative.id)}
                                    className="flex items-center text-blue-600 hover:text-blue-800 focus:outline-none"
                                  >
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWorkTypeColor(creative.work_types)}`}>
                                      {getWorkTypeIcon(creative.work_types)}
                                      <span className="ml-1">
                                        {isWorkTypesExpanded 
                                          ? `Скрыть (${creative.work_types.length})` 
                                          : `${creative.work_types[0]} ${creative.work_types.length > 1 ? `+${creative.work_types.length - 1}` : ''}`
                                        }
                                      </span>
                                    </span>
                                  </button>
                                  {isWorkTypesExpanded && (
                                    <div className="mt-2 space-y-1">
                                      {creative.work_types.map((workType, index) => (
                                        <div key={index} className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded">
                                          {workType}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            
                            {/* Комментарий */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              {creative.comment ? (
                                <button
                                  onClick={() => showComment(creative)}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors duration-200"
                                  title="Показать комментарий"
                                >
                                  <MessageCircle className="h-3 w-3 mr-1" />
                                  Есть
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            
                            {/* COF */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCOFBadgeColor(cof)}`}>
                                <span className="text-xs font-bold mr-1">COF</span>
                                {formatCOF(cof)}
                              </span>
                            </td>
                            
                            {/* Метрики рекламы - ИСПРАВЛЕННАЯ ЛОГИКА */}
                            {showMetrics && (
                              <>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {firstVideoMetrics?.found ? (
                                    <span className="font-medium text-blue-600">
                                      {firstVideoMetrics.data.formatted.leads}
                                    </span>
                                  ) : (
                                    <div className="flex items-center space-x-1">
                                      <span className="text-gray-400">—</span>
                                      {/* ИНДИКАТОР ПРИЧИНЫ */}
                                      {!creative.link_titles || creative.link_titles.every(title => !title || title.startsWith('Видео ')) ? (
                                        <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800" title="Fallback названия - метрики недоступны">
                                          ⚠
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800" title="Видео не найдено в базе метрик">
                                          ❌
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {firstVideoMetrics?.found ? (
                                    <span className="font-medium text-green-600">
                                      {firstVideoMetrics.data.formatted.cpl}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {firstVideoMetrics?.found ? (
                                    <span className="font-medium text-orange-600">
                                      {firstVideoMetrics.data.formatted.ctr}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                              </>
                            )}
                            
                            {/* Меню действий */}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="relative">
                                <button
                                  onClick={() => toggleDropdown(creative.id)}
                                  className="dropdown-trigger text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                                
                                {isDropdownOpen && (
                                  <div className="dropdown-menu absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                                    <div className="py-1">
                                      <button
                                        onClick={() => {
                                          // TODO: Добавить функционал редактирования
                                          console.log('Редактировать креатив:', creative.id);
                                          toggleDropdown(creative.id);
                                        }}
                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Редактировать
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleDeleteCreative(creative.id, creative.article);
                                          toggleDropdown(creative.id);
                                        }}
                                        className="flex items-center w-full px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors duration-200"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Удалить
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
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

      {/* Debug Modal - НОВОЕ ОКНО ОТЛАДКИ */}
      {showDebugModal && debugInfo && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Bug className="h-5 w-5 mr-2 text-yellow-600" />
                Отладочная информация
              </h3>
              <button
                onClick={() => setShowDebugModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Общая информация */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Общая информация:</h4>
                <div className="bg-gray-50 p-3 rounded-md text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <strong>Пользователь:</strong> {debugInfo.user.name} ({debugInfo.user.role})
                    </div>
                    <div>
                      <strong>Время:</strong> {new Date(debugInfo.timestamp).toLocaleString('ru-RU')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Статистика креативов */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Статистика креативов:</h4>
                <div className="bg-blue-50 p-3 rounded-md text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div><strong>Всего:</strong> {debugInfo.creatives.total}</div>
                    <div><strong>С link_titles:</strong> {debugInfo.creatives.withLinkTitles}</div>
                    <div><strong>С валидными названиями:</strong> {debugInfo.creatives.withValidTitles}</div>
                    <div><strong>С fallback названиями:</strong> {debugInfo.creatives.withFallbackTitles}</div>
                  </div>
                </div>
              </div>

              {/* Статистика метрик */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Статистика метрик:</h4>
                <div className="bg-green-50 p-3 rounded-md text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div><strong>Включены:</strong> {debugInfo.metrics.enabled ? '✅' : '❌'}</div>
                    <div><strong>Загрузка:</strong> {debugInfo.metrics.loading ? '⏳' : '✅'}</div>
                    <div><strong>API статус:</strong> {debugInfo.metrics.apiStatus}</div>
                    <div><strong>API доступен:</strong> {debugInfo.metrics.apiAvailable ? '✅' : '❌'}</div>
                    <div><strong>Найдено метрик:</strong> {debugInfo.metrics.stats?.found || 0}</div>
                    <div><strong>Всего запросов:</strong> {debugInfo.metrics.stats?.total || 0}</div>
                  </div>
                  {debugInfo.metrics.error && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-red-700">
                      <strong>Ошибка:</strong> {debugInfo.metrics.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Примеры креативов */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Примеры креативов:</h4>
                <div className="space-y-3">
                  {debugInfo.samples.map((sample, index) => (
                    <div key={index} className="bg-yellow-50 p-3 rounded-md text-sm">
                      <div className="font-medium">{sample.article}</div>
                      <div className="text-gray-600 mt-1">
                        <div><strong>Названия видео:</strong> {JSON.stringify(sample.link_titles)}</div>
                        <div><strong>Валидные названия:</strong> {sample.hasValidTitles ? '✅' : '❌'}</div>
                        <div><strong>Метрики первого видео:</strong> {sample.firstVideoMetrics?.found ? '✅ Найдены' : '❌ Не найдены'}</div>
                        {sample.firstVideoMetrics && (
                          <div className="mt-1 text-xs">
                            <pre>{JSON.stringify(sample.firstVideoMetrics, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Рекомендации */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Рекомендации:</h4>
                <div className="bg-indigo-50 p-3 rounded-md text-sm">
                  <ul className="list-disc list-inside space-y-1">
                    {debugInfo.creatives.withFallbackTitles > 0 && (
                      <li>У вас есть креативы с fallback названиями ("Видео 1", "Видео 2") - для них метрики недоступны</li>
                    )}
                    {!debugInfo.metrics.apiAvailable && (
                      <li>API метрик недоступен - проверьте подключение к интернету</li>
                    )}
                    {debugInfo.metrics.enabled && debugInfo.metrics.stats?.found === 0 && (
                      <li>Не найдено метрик ни для одного видео - возможно названия не совпадают с базой данных</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDebugModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
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
                    comment: ''
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
              {/* Article */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Артикул *
                </label>
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

              {/* Links */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Google Drive ссылки * (метрики будут показаны для каждой)
                  </label>
                  <button
                    onClick={addLinkField}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Добавить
                  </button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {newCreative.links.map((link, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => updateLink(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                <p className="mt-1 text-xs text-yellow-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Используйте только ссылки на Google Drive файлы
                </p>
              </div>

              {/* Comment */}
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

              {/* Work Types */}
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
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
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
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                        {type} ({formatCOF(workTypeValues[type] || 0)})
                        <button
                          type="button"
                          onClick={() => handleWorkTypeChange(type, false)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Error в модале */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            {/* Modal Footer */}
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
                  <>
                    Создать креатив
                    {newCreative.work_types.length > 0 && (
                      <span className="ml-2 text-xs opacity-75">
                        (COF: {formatCOF(calculateCOF(newCreative.work_types))})
                      </span>
                    )}
                  </>
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
                <p className="text-gray-600 text-sm">{formatKyivTime(selectedComment.createdAt)}</p>
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
