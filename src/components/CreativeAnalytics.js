// Обновленный CreativeAnalytics.js с поддержкой COF аналитики
// Замените содержимое src/components/CreativeAnalytics.js

import React, { useState, useEffect } from 'react';
import { creativeService, userService } from '../supabaseClient';
import { formatFileName } from '../utils/googleDriveUtils';
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
  DollarSign,
  Target,
  Activity
} from 'lucide-react';

function CreativeAnalytics({ user }) {
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
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedEditor, setSelectedEditor] = useState('all');

  // Оценки типов работ для подсчета COF (те же, что в CreativePanel)
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

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod, selectedEditor]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const [creativesData, editorsData] = await Promise.all([
        creativeService.getAllCreatives(),
        userService.getAllUsers()
      ]);

      const editors = editorsData.filter(u => u.role === 'editor');
      
      let filteredCreatives = creativesData;
      if (selectedEditor !== 'all') {
        filteredCreatives = creativesData.filter(c => c.user_id === selectedEditor);
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

      // Вычисляем COF статистику
      const todayCreatives = filteredCreatives.filter(c => new Date(c.created_at) >= todayStart);
      const weekCreatives = filteredCreatives.filter(c => new Date(c.created_at) >= weekStart);

      const totalCOF = filteredCreatives.reduce((sum, c) => sum + calculateCOF(c.work_types), 0);
      const todayCOF = todayCreatives.reduce((sum, c) => sum + calculateCOF(c.work_types), 0);
      const weekCOF = weekCreatives.reduce((sum, c) => sum + calculateCOF(c.work_types), 0);
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

      // Статистика по типам работ с COF
      const workTypeStats = {};
      periodCreatives.forEach(creative => {
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
      });

      // Статистика по монтажерам с COF
      const editorStats = {};
      editors.forEach(editor => {
        const editorCreatives = periodCreatives.filter(c => c.user_id === editor.id);
        if (editorCreatives.length > 0) {
          const editorCOF = editorCreatives.reduce((sum, c) => sum + calculateCOF(c.work_types), 0);
          
          editorStats[editor.id] = {
            name: editor.name,
            count: editorCreatives.length,
            totalCOF: editorCOF,
            avgCOF: editorCreatives.length > 0 ? editorCOF / editorCreatives.length : 0,
            types: {}
          };
          
          editorCreatives.forEach(creative => {
            creative.work_types.forEach(workType => {
              editorStats[editor.id].types[workType] = 
                (editorStats[editor.id].types[workType] || 0) + 1;
            });
          });
        }
      });

      setAnalytics({
        creatives: periodCreatives,
        editors,
        stats,
        workTypeStats,
        editorStats
      });

    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

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
    if (workType && workType.toLowerCase().includes('video') || workType && workType.toLowerCase().includes('монтаж')) {
      return <Video className="h-4 w-4" />;
    }
    if (workType && workType.toLowerCase().includes('статика')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <Eye className="h-4 w-4" />;
  };

  const getWorkTypeColor = (workTypes) => {
    const workType = Array.isArray(workTypes) ? workTypes[0] : workTypes;
    if (workType && workType.toLowerCase().includes('video') || workType && workType.toLowerCase().includes('монтаж')) {
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
    const reportData = {
      period: selectedPeriod,
      editor: selectedEditor === 'all' ? 'Все монтажеры' : analytics.editors.find(e => e.id === selectedEditor)?.name,
      generated: new Date().toISOString(),
      stats: analytics.stats,
      workTypes: analytics.workTypeStats,
      editors: analytics.editorStats
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creatives-report-${selectedPeriod}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка аналитики...</p>
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
              Статистика работы монтажеров и COF анализ
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadAnalytics}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
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
      </div>

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
                  <DollarSign className="h-8 w-8 text-green-500" />
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

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Calendar className="h-8 w-8 text-purple-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      COF сегодня
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatCOF(analytics.stats.todayCOF)}
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
                      COF за неделю
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatCOF(analytics.stats.weekCOF)}
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
                  <Monitor className="h-8 w-8 text-red-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Активных монтажеров
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {Object.keys(analytics.editorStats).length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
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

        {/* Recent Creatives */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Последние креативы с COF
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
                      .sort((a, b) => calculateCOF(b.work_types) - calculateCOF(a.work_types))
                      .slice(0, 10)
                      .map((creative) => {
                      const editor = analytics.editors.find(e => e.id === creative.user_id);
                      const cof = calculateCOF(creative.work_types);
                      
                      return (
                        <tr key={creative.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {creative.article}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {editor?.name || 'Неизвестен'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <DollarSign className="h-3 w-3 mr-1" />
                              {formatCOF(cof)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWorkTypeColor(creative.work_types)}`}>
                              {getWorkTypeIcon(creative.work_types)}
                              <span className="ml-1">{creative.work_types[0]}</span>
                              {creative.work_types.length > 1 && (
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
                            {creative.links.length} ссылок
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
