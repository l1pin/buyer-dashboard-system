// Обновленный CreativeAnalytics.js с исправленной интеграцией метрик
// Замените содержимое src/components/CreativeAnalytics.js

import React, { useState, useEffect } from 'react';
import { creativeService, userService } from '../supabaseClient';
import { useBatchMetrics, useMetricsStats, useMetricsApi } from '../hooks/useMetrics';
import { formatFileName } from '../utils/googleDriveUtils';
import CreativeMetrics from './CreativeMetrics';
import { 
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  Video,
  Image as ImageIcon,
  Monitor,
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
  Globe
} from 'lucide-react';

function CreativeAnalytics({ user }) {
  console.log('✅ CreativeAnalytics компонент загружен с метриками');
  
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
      weekCOF: 0
    },
    workTypeStats: {},
    editorStats: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedEditor, setSelectedEditor] = useState('all');
  const [showMetrics, setShowMetrics] = useState(true);

  // Хуки for метрик - ИСПРАВЛЕНО: добавлена деструктуризация getCreativeMetrics
  const { 
    batchMetrics, 
    loading: metricsLoading, 
    error: metricsError,
    stats: metricsStats,
    getCreativeMetrics,
    refresh: refreshMetrics 
  } = useBatchMetrics(analytics.creatives, showMetrics);
  
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

  const loadAnalytics = async () => {
    console.log('🚀 Начинаем загрузку аналитики с метриками...');
    
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

      // Вычисляем COF статистику с защитой от ошибок
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

      const stats = {
        totalCreatives: filteredCreatives.length,
        totalEditors: editors.length,
        todayCreatives: todayCreatives.length,
        weekCreatives: weekCreatives.length,
        totalCOF: totalCOF,
        avgCOF: avgCOF,
        todayCOF: todayCOF,
        weekCOF: weekCOF
      };

      console.log('📈 Статистика COF:', stats);

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

      // Статистика по монтажерам с защитой от ошибок
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
            types: {}
          };
        }

        editorStats[editorId].count += 1;
        
        const cof = calculateCreativeCOF(creative);
        editorStats[editorId].totalCOF += cof;
        
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
      console.error('📍 Детали ошибки:', error.message);
      console.error('🔍 Stack trace:', error.stack);
      
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
          weekCOF: 0
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

  const formatKyivTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        timeZone: 'Europe/Kiev',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return new Date(dateString).toLocaleDateString('ru-RU', {
        timeZone: 'Europe/Kiev'
      });
    }
  };

  const getWorkTypeIcon = (workTypes) => {
    const workType = Array.isArray(workTypes) ? workTypes[0] : workTypes;
    if (workType && (workType.toLowerCase().includes('video') || workType.toLowerCase().includes('монтаж'))) {
      return <Video className="h-4 w-4" />;
    }
    if (workType && workType.toLowerCase().includes('статика')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <Eye className="h-4 w-4" />;
  };

  const getWorkTypeColor = (workTypes) => {
    const workType = Array.isArray(workTypes) ? workTypes[0] : workTypes;
    if (workType && (workType.toLowerCase().includes('video') || workType.toLowerCase().includes('монтаж'))) {
      return 'bg-blue-100 text-blue-800';
    }
    if (workType && workType.toLowerCase().includes('статика')) {
      return 'bg-green-100 text-green-800';
    }
    if (workType && workType.toLowerCase().includes('доп')) {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const exportReport = () => {
    try {
      const reportData = {
        period: selectedPeriod,
        editor: selectedEditor === 'all' ? 'Все монтажеры' : analytics.editors.find(e => e.id === selectedEditor)?.name,
        generated: new Date().toISOString(),
        stats: analytics.stats,
        metricsStats: aggregatedMetricsStats,
        workTypes: analytics.workTypeStats,
        editors: analytics.editorStats,
        metricsApiStatus: apiStatus,
        creativesWithMetrics: metricsStats?.found || 0,
        creativesWithoutMetrics: (metricsStats?.total || 0) - (metricsStats?.found || 0)
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creatives-report-${selectedPeriod}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка при экспорте отчета:', error);
    }
  };

  const handleRefreshAll = async () => {
    await loadAnalytics();
    if (showMetrics) {
      refreshMetrics();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка аналитики...</p>
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
              Статистика работы монтажеров, COF анализ и метрики рекламы
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                showMetrics 
                  ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              <Activity className="h-4 w-4 mr-2" />
              {showMetrics ? 'Скрыть метрики' : 'Показать метрики'}
            </button>
            
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
          {showMetrics && (
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
          )}
        </div>
      </div>

      {/* Error Message */}
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-6">
          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BarChart3 className="h-8 w-8 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Креативов
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {analytics.creatives.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">COF</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Общий COF
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatCOF(analytics.stats.totalCOF)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Target className="h-8 w-8 text-orange-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Средний COF
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatCOF(analytics.stats.avgCOF)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Метрики рекламы */}
          {showMetrics && hasMetricsData && (
            <>
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-8 w-8 text-purple-500" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Лидов
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {formatStats().totalLeads}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DollarSign className="h-8 w-8 text-green-500" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Расходы
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {formatStats().totalCost}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <TrendingUp className="h-8 w-8 text-indigo-500" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Ср. CPL
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {formatStats().avgCPL}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Fallback для метрик если нет данных */}
          {showMetrics && !hasMetricsData && (
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Monitor className="h-8 w-8 text-red-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Метрики
                      </dt>
                      <dd className="text-sm font-medium text-red-600">
                        {metricsLoading ? 'Загрузка...' : 'Недоступны'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Work Types Stats */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Статистика по типам работ
              </h3>
              
              {Object.keys(analytics.workTypeStats).length === 0 ? (
                <p className="text-gray-500 text-center py-4">Нет данных за выбранный период</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(analytics.workTypeStats)
                    .sort(([,a], [,b]) => b.totalCOF - a.totalCOF)
                    .slice(0, 10)
                    .map(([workType, stats]) => (
                    <div key={workType} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getWorkTypeColor(workType)}`}>
                          {getWorkTypeIcon(workType)}
                          <span className="ml-1">{workType}</span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-600">{stats.count}x</span>
                        <span className="text-sm font-medium text-green-600">
                          {formatCOF(stats.totalCOF)} COF
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor Stats */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Рейтинг монтажеров по COF
              </h3>
              
              {Object.keys(analytics.editorStats).length === 0 ? (
                <p className="text-gray-500 text-center py-4">Нет данных за выбранный период</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(analytics.editorStats)
                    .sort(([,a], [,b]) => b.totalCOF - a.totalCOF)
                    .map(([editorId, stats], index) => (
                    <div key={editorId} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium">
                            {index + 1}
                          </div>
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-gray-900">{stats.name}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-gray-600">{stats.count} креативов</span>
                          <span className="text-sm font-medium text-green-600">
                            {formatCOF(stats.totalCOF)} COF
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(stats.types).slice(0, 3).map(([type, count]) => (
                            <span key={type} className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {type}: {count}
                            </span>
                          ))}
                          {Object.keys(stats.types).length > 3 && (
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                              +{Object.keys(stats.types).length - 3} еще
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          Ср. COF: {formatCOF(stats.avgCOF)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Creatives with Metrics */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              {showMetrics ? 'Креативы с высоким COF и метриками' : 'Креативы с высоким COF'}
            </h3>
            
            {analytics.creatives.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Нет креативов за выбранный период</p>
            ) : (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Артикул
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Монтажер
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Типы работ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Создан
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Файлы
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analytics.creatives
                      .sort((a, b) => {
                        const cofA = typeof a.cof_rating === 'number' ? a.cof_rating : calculateCOF(a.work_types || []);
                        const cofB = typeof b.cof_rating === 'number' ? b.cof_rating : calculateCOF(b.work_types || []);
                        return cofB - cofA;
                      })
                      .slice(0, 10)
                      .map((creative) => {
                        const editorName = creative.editor_name || creative.users?.name || 'Неизвестен';
                        const cof = typeof creative.cof_rating === 'number' 
                          ? creative.cof_rating 
                          : calculateCOF(creative.work_types || []);
                        
                        // ИСПРАВЛЕНО: Используем getCreativeMetrics напрямую
                        const creativeMetrics = showMetrics ? getCreativeMetrics(creative.id) : null;
                        
                        return (
                          <tr key={creative.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {creative.article}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {editorName}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCOFBadgeColor(cof)}`}>
                                <span className="text-xs font-bold mr-1">COF</span>
                                {formatCOF(cof)}
                              </span>
                            </td>
                            
                            {/* Метрики рекламы */}
                            {showMetrics && (
                              <>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {creativeMetrics?.found ? 
                                    creativeMetrics.data.formatted.leads : 
                                    <span className="text-gray-400">—</span>
                                  }
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {creativeMetrics?.found ? 
                                    creativeMetrics.data.formatted.cpl : 
                                    <span className="text-gray-400">—</span>
                                  }
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {creativeMetrics?.found ? 
                                    creativeMetrics.data.formatted.ctr : 
                                    <span className="text-gray-400">—</span>
                                  }
                                </td>
                              </>
                            )}
                            
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWorkTypeColor(creative.work_types || [])}`}>
                                {getWorkTypeIcon(creative.work_types || [])}
                                <span className="ml-1">{(creative.work_types && creative.work_types[0]) || 'Не указано'}</span>
                                {creative.work_types && creative.work_types.length > 1 && (
                                  <span className="ml-1">+{creative.work_types.length - 1}</span>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>{formatKyivTime(creative.created_at)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {(creative.links && creative.links.length) || 0} ссылок
                              {showMetrics && creativeMetrics && (
                                <div className={`mt-1 text-xs ${creativeMetrics.found ? 'text-green-600' : 'text-red-600'}`}>
                                  {creativeMetrics.found ? 'Метрики ✓' : 'Нет метрик'}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreativeAnalytics;
