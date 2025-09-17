// ВРЕМЕННАЯ тестовая версия CreativeAnalytics с mock данными
// Используйте эту версию для тестирования интерфейса без обращения к базе данных
// Замените содержимое src/components/CreativeAnalytics.js этим кодом ВРЕМЕННО

import React, { useState, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';

function CreativeAnalytics({ user }) {
  console.log('🧪 TEST CreativeAnalytics компонент загружен, пользователь:', user);
  
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

  // Mock данные для тестирования
  const mockData = {
    creatives: [
      {
        id: 1,
        article: 'TEST-001',
        work_types: ['Монтаж _Video', 'Превьюшка'],
        cof_rating: 1.2,
        editor_name: 'Тест Монтажер',
        created_at: new Date().toISOString(),
        links: ['https://test.com/1', 'https://test.com/2']
      },
      {
        id: 2,
        article: 'TEST-002',
        work_types: ['Статика 1', 'Ресайз St 1'],
        cof_rating: 1.2,
        editor_name: 'Тест Монтажер 2',
        created_at: new Date().toISOString(),
        links: ['https://test.com/3']
      }
    ],
    editors: [
      { id: 'ed1', name: 'Тест Монтажер', role: 'editor' },
      { id: 'ed2', name: 'Тест Монтажер 2', role: 'editor' }
    ]
  };

  const workTypeValues = {
    'Монтаж _Video': 1,
    'Превьюшка': 0.2,
    'Статика 1': 1,
    'Ресайз St 1': 0.2
  };

  const getCOFBadgeColor = (cof) => {
    if (cof >= 4) return 'bg-red-600 text-white border-red-600';
    if (cof >= 3) return 'bg-red-300 text-red-800 border-red-300';
    if (cof >= 2) return 'bg-yellow-300 text-yellow-800 border-yellow-300';
    if (cof >= 1.01) return 'bg-green-200 text-green-800 border-green-200';
    return 'bg-green-500 text-white border-green-500';
  };

  const formatCOF = (cof) => {
    return cof % 1 === 0 ? cof.toString() : cof.toFixed(1);
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
      return new Date(dateString).toLocaleDateString('ru-RU');
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
    return 'bg-gray-100 text-gray-800';
  };

  const loadMockAnalytics = () => {
    console.log('🧪 Загружаем mock данные...');
    setLoading(true);
    
    // Симуляция задержки API
    setTimeout(() => {
      console.log('🧪 Mock данные загружены');
      
      const totalCOF = mockData.creatives.reduce((sum, c) => sum + c.cof_rating, 0);
      const avgCOF = mockData.creatives.length > 0 ? totalCOF / mockData.creatives.length : 0;

      setAnalytics({
        creatives: mockData.creatives,
        editors: mockData.editors,
        stats: {
          totalCreatives: mockData.creatives.length,
          totalEditors: mockData.editors.length,
          todayCreatives: mockData.creatives.length,
          weekCreatives: mockData.creatives.length,
          totalCOF: totalCOF,
          avgCOF: avgCOF,
          todayCOF: totalCOF,
          weekCOF: totalCOF
        },
        workTypeStats: {
          'Монтаж _Video': { count: 1, totalCOF: 1 },
          'Превьюшка': { count: 1, totalCOF: 0.2 },
          'Статика 1': { count: 1, totalCOF: 1 },
          'Ресайз St 1': { count: 1, totalCOF: 0.2 }
        },
        editorStats: {
          'ed1': {
            name: 'Тест Монтажер',
            count: 1,
            totalCOF: 1.2,
            avgCOF: 1.2,
            types: { 'Монтаж _Video': 1, 'Превьюшка': 1 }
          },
          'ed2': {
            name: 'Тест Монтажер 2', 
            count: 1,
            totalCOF: 1.2,
            avgCOF: 1.2,
            types: { 'Статика 1': 1, 'Ресайз St 1': 1 }
          }
        }
      });
      
      setLoading(false);
      console.log('🧪 Mock аналитика готова');
    }, 1000);
  };

  useEffect(() => {
    console.log('🧪 useEffect сработал, загружаем mock данные...');
    loadMockAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">🧪 Загрузка тестовых данных...</p>
          <p className="mt-2 text-xs text-gray-500">Это временная тестовая версия</p>
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
              🧪 Аналитика креативов (ТЕСТ)
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Тестовая версия с mock данными
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadMockAnalytics}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
            </button>
          </div>
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
                      {analytics.stats.totalCreatives}
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

        {/* Test Creatives Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              🧪 Тестовые креативы
            </h3>
            
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.creatives.map((creative) => {
                    return (
                      <tr key={creative.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {creative.article}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {creative.editor_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCOFBadgeColor(creative.cof_rating)}`}>
                            <span className="text-xs font-bold mr-1">COF</span>
                            {formatCOF(creative.cof_rating)}
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreativeAnalytics;
