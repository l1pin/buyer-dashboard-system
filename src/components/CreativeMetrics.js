// Компонент для отображения метрик креативов
// Создайте файл: src/components/CreativeMetrics.js

import React, { useState, useEffect } from 'react';
import { MetricsService } from '../services/metricsService';
import { 
  TrendingUp, 
  DollarSign, 
  MousePointer, 
  Eye, 
  Users, 
  Zap,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Activity
} from 'lucide-react';

/**
 * Компонент для отображения метрик отдельного креатива
 */
function CreativeMetrics({ creative, showDetails = true, size = 'normal' }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const isCompact = size === 'compact';

  useEffect(() => {
    if (creative?.link_titles && creative.link_titles.length > 0) {
      loadMetrics();
    }
  }, [creative]);

  const loadMetrics = async () => {
    if (!creative?.link_titles || creative.link_titles.length === 0) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Берем первое название из массива link_titles
      const firstVideoName = creative.link_titles[0];
      
      if (!firstVideoName || firstVideoName.startsWith('Видео ')) {
        setError('Название видео не определено');
        return;
      }

      console.log(`🔍 Загрузка метрик для креатива: ${creative.article}, видео: ${firstVideoName}`);
      
      const result = await MetricsService.getVideoMetrics(firstVideoName);
      
      if (result.found) {
        setMetrics(result.data);
        setLastUpdated(new Date());
        setError('');
      } else {
        setError(result.error || 'Метрики не найдены');
        setMetrics(null);
      }
    } catch (err) {
      console.error('Ошибка загрузки метрик:', err);
      setError('Ошибка загрузки: ' + err.message);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadMetrics();
  };

  const getMetricColor = (metric, value) => {
    const numValue = parseFloat(value.replace(',', '.'));
    
    switch (metric) {
      case 'cpl':
        if (numValue <= 50) return 'text-green-600';
        if (numValue <= 100) return 'text-yellow-600';
        return 'text-red-600';
      case 'ctr':
        if (numValue >= 2) return 'text-green-600';
        if (numValue >= 1) return 'text-yellow-600';
        return 'text-red-600';
      case 'leads':
        if (parseInt(value) >= 10) return 'text-green-600';
        if (parseInt(value) >= 5) return 'text-yellow-600';
        return 'text-red-600';
      default:
        return 'text-gray-900';
    }
  };

  if (!creative?.link_titles || creative.link_titles.length === 0) {
    return (
      <div className={`${isCompact ? 'p-2' : 'p-3'} bg-gray-50 rounded-md border border-gray-200`}>
        <div className="flex items-center text-sm text-gray-500">
          <AlertCircle className="h-4 w-4 mr-1" />
          Нет названий видео
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${isCompact ? 'p-2' : 'p-3'} bg-blue-50 rounded-md border border-blue-200`}>
        <div className="flex items-center text-sm text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          Загрузка метрик...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${isCompact ? 'p-2' : 'p-3'} bg-red-50 rounded-md border border-red-200`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mr-1" />
            {error}
          </div>
          <button
            onClick={handleRefresh}
            className="text-red-600 hover:text-red-800 transition-colors duration-200"
            title="Повторить попытку"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={`${isCompact ? 'p-2' : 'p-3'} bg-gray-50 rounded-md border border-gray-200`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-500">
            <BarChart3 className="h-4 w-4 mr-1" />
            Метрики недоступны
          </div>
          <button
            onClick={handleRefresh}
            className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
            title="Попробовать загрузить"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  if (isCompact) {
    return (
      <div className="p-2 bg-green-50 rounded-md border border-green-200">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center text-xs text-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Метрики загружены
          </div>
          <button
            onClick={handleRefresh}
            className="text-green-600 hover:text-green-800 transition-colors duration-200"
            title="Обновить метрики"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className={`font-medium ${getMetricColor('leads', metrics.formatted.leads)}`}>
              {metrics.formatted.leads}
            </div>
            <div className="text-gray-500">лидов</div>
          </div>
          <div className="text-center">
            <div className={`font-medium ${getMetricColor('cpl', metrics.formatted.cpl)}`}>
              {metrics.formatted.cpl}₴
            </div>
            <div className="text-gray-500">CPL</div>
          </div>
          <div className="text-center">
            <div className={`font-medium ${getMetricColor('ctr', metrics.formatted.ctr)}`}>
              {metrics.formatted.ctr}
            </div>
            <div className="text-gray-500">CTR</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Activity className="h-5 w-5 text-blue-600 mr-2" />
          <h4 className="text-sm font-medium text-gray-900">
            Метрики рекламы
          </h4>
        </div>
        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <div className="flex items-center text-xs text-gray-500">
              <Clock className="h-3 w-3 mr-1" />
              {lastUpdated.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
          <button
            onClick={handleRefresh}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            title="Обновить метрики"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-blue-50 rounded-md">
          <div className="flex items-center justify-center mb-1">
            <Users className="h-4 w-4 text-blue-600 mr-1" />
            <span className="text-xs font-medium text-blue-600">Лиды</span>
          </div>
          <div className={`text-lg font-bold ${getMetricColor('leads', metrics.formatted.leads)}`}>
            {metrics.formatted.leads}
          </div>
        </div>

        <div className="text-center p-2 bg-green-50 rounded-md">
          <div className="flex items-center justify-center mb-1">
            <DollarSign className="h-4 w-4 text-green-600 mr-1" />
            <span className="text-xs font-medium text-green-600">CPL</span>
          </div>
          <div className={`text-lg font-bold ${getMetricColor('cpl', metrics.formatted.cpl)}`}>
            {metrics.formatted.cpl}₴
          </div>
        </div>

        <div className="text-center p-2 bg-orange-50 rounded-md">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="h-4 w-4 text-orange-600 mr-1" />
            <span className="text-xs font-medium text-orange-600">CTR</span>
          </div>
          <div className={`text-lg font-bold ${getMetricColor('ctr', metrics.formatted.ctr)}`}>
            {metrics.formatted.ctr}
          </div>
        </div>
      </div>

      {/* Дополнительные метрики */}
      {showDetails && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center">
              <DollarSign className="h-3 w-3 text-gray-500 mr-1" />
              <span className="text-gray-600">Расходы:</span>
            </div>
            <span className="font-medium text-gray-900">{metrics.formatted.cost}₴</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center">
              <MousePointer className="h-3 w-3 text-gray-500 mr-1" />
              <span className="text-gray-600">CPC:</span>
            </div>
            <span className="font-medium text-gray-900">{metrics.formatted.cpc}₴</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center">
              <Eye className="h-3 w-3 text-gray-500 mr-1" />
              <span className="text-gray-600">CPM:</span>
            </div>
            <span className="font-medium text-gray-900">{metrics.formatted.cpm}₴</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center">
              <MousePointer className="h-3 w-3 text-gray-500 mr-1" />
              <span className="text-gray-600">Клики:</span>
            </div>
            <span className="font-medium text-gray-900">{metrics.formatted.clicks}</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center">
              <Eye className="h-3 w-3 text-gray-500 mr-1" />
              <span className="text-gray-600">Показы:</span>
            </div>
            <span className="font-medium text-gray-900">{metrics.formatted.impressions}</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
            <div className="flex items-center">
              <Zap className="h-3 w-3 text-blue-500 mr-1" />
              <span className="text-blue-600">Источник:</span>
            </div>
            <span className="font-medium text-blue-700 capitalize">{metrics.source}</span>
          </div>
        </div>
      )}

      {/* Информация о видео */}
      {metrics.videoName && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            <span className="font-medium">Видео:</span> {metrics.videoName}
          </div>
          {metrics.updatedAt && (
            <div className="text-xs text-gray-400 mt-1">
              Обновлено: {metrics.updatedAt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Компонент для отображения батчевых метрик множества креативов
 */
function BatchCreativeMetrics({ creatives, onMetricsLoaded }) {
  const [batchMetrics, setBatchMetrics] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (creatives && creatives.length > 0) {
      loadBatchMetrics();
    }
  }, [creatives]);

  const loadBatchMetrics = async () => {
    if (!creatives || creatives.length === 0) return;

    setLoading(true);
    setError('');

    try {
      // Собираем названия видео из всех креативов
      const videoNames = [];
      const creativeVideoMap = new Map();

      creatives.forEach(creative => {
        if (creative.link_titles && creative.link_titles.length > 0) {
          const firstVideoName = creative.link_titles[0];
          if (firstVideoName && !firstVideoName.startsWith('Видео ')) {
            videoNames.push(firstVideoName);
            creativeVideoMap.set(firstVideoName, creative.id);
          }
        }
      });

      if (videoNames.length === 0) {
        setError('Нет доступных названий видео для поиска метрик');
        return;
      }

      console.log(`🔍 Батчевая загрузка метрик для ${videoNames.length} видео`);

      const results = await MetricsService.getBatchVideoMetrics(videoNames);
      
      const metricsMap = new Map();
      let successCount = 0;

      results.forEach(result => {
        const creativeId = creativeVideoMap.get(result.videoName);
        if (creativeId) {
          metricsMap.set(creativeId, {
            found: result.found,
            data: result.data,
            error: result.error,
            videoName: result.videoName
          });

          if (result.found) {
            successCount++;
          }
        }
      });

      setBatchMetrics(metricsMap);
      
      if (onMetricsLoaded) {
        onMetricsLoaded({
          total: videoNames.length,
          found: successCount,
          notFound: videoNames.length - successCount
        });
      }

      console.log(`✅ Загружено метрик: ${successCount}/${videoNames.length}`);

    } catch (err) {
      console.error('Ошибка батчевой загрузки метрик:', err);
      setError('Ошибка загрузки: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCreativeMetrics = (creativeId) => {
    return batchMetrics.get(creativeId) || null;
  };

  return {
    loading,
    error,
    getCreativeMetrics,
    refresh: loadBatchMetrics,
    stats: {
      total: batchMetrics.size,
      found: Array.from(batchMetrics.values()).filter(m => m.found).length
    }
  };
}

export default CreativeMetrics;
export { BatchCreativeMetrics };
