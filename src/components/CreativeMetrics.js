// Упрощенный компонент для отображения метрик отдельных видео
// Замените содержимое src/components/CreativeMetrics.js

import React, { useState, useEffect } from 'react';
import { MetricsService } from '../services/metricsService';
import { 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react';

/**
 * Компонент для отображения метрик отдельного видео простым текстом
 */
function CreativeMetrics({ videoTitle, showRefresh = true, compact = false }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (videoTitle && !videoTitle.startsWith('Видео ')) {
      loadMetrics();
    }
  }, [videoTitle]);

  const loadMetrics = async () => {
    if (!videoTitle || videoTitle.startsWith('Видео ')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log(`🔍 Загрузка метрик для видео: ${videoTitle}`);
      
      const result = await MetricsService.getVideoMetrics(videoTitle);
      
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

  // Если название видео не определено
  if (!videoTitle || videoTitle.startsWith('Видео ')) {
    return (
      <div className={`text-xs text-gray-500 ${compact ? 'space-y-1' : 'space-y-1'}`}>
        <div>Название не определено</div>
      </div>
    );
  }

  // Состояние загрузки
  if (loading) {
    return (
      <div className={`text-xs ${compact ? 'space-y-1' : 'space-y-1'}`}>
        <div className="flex items-center text-blue-600">
          <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 mr-1"></div>
          <span>Загрузка метрик...</span>
        </div>
      </div>
    );
  }

  // Состояние ошибки
  if (error) {
    return (
      <div className={`text-xs ${compact ? 'space-y-1' : 'space-y-1'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            <span>Нет метрик</span>
          </div>
          {showRefresh && (
            <button
              onClick={handleRefresh}
              className="text-red-600 hover:text-red-800 transition-colors duration-200"
              title="Повторить попытку"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
        {!compact && (
          <div className="text-xs text-red-500">{error}</div>
        )}
      </div>
    );
  }

  // Состояние без метрик
  if (!metrics) {
    return (
      <div className={`text-xs ${compact ? 'space-y-1' : 'space-y-1'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center text-gray-500">
            <BarChart3 className="h-3 w-3 mr-1" />
            <span>Метрики недоступны</span>
          </div>
          {showRefresh && (
            <button
              onClick={handleRefresh}
              className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
              title="Попробовать загрузить"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Отображение метрик простым текстом
  return (
    <div className={`text-xs ${compact ? 'space-y-0.5' : 'space-y-1'}`}>
      {/* Заголовок с обновлением */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center text-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          <span className="font-medium">Метрики:</span>
        </div>
        <div className="flex items-center space-x-1">
          {lastUpdated && (
            <div className="flex items-center text-gray-400">
              <Clock className="h-2 w-2 mr-1" />
              <span className="text-xs">
                {lastUpdated.toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}
          {showRefresh && (
            <button
              onClick={handleRefresh}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              title="Обновить метрики"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Метрики простым текстом в столбик */}
      <div className="space-y-0.5">
        <div>
          <span className="font-medium text-gray-700">Лиды:</span>
          <span className="ml-1 text-blue-700 font-medium">{metrics.formatted.leads}</span>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">CPL:</span>
          <span className="ml-1 text-green-700 font-medium">{metrics.formatted.cpl}</span>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">Расх.:</span>
          <span className="ml-1 text-purple-700 font-medium">{metrics.formatted.cost}</span>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">CTR:</span>
          <span className="ml-1 text-orange-700 font-medium">{metrics.formatted.ctr}</span>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">CPC:</span>
          <span className="ml-1 text-indigo-700 font-medium">{metrics.formatted.cpc}</span>
        </div>
        
        <div>
          <span className="font-medium text-gray-700">CPM:</span>
          <span className="ml-1 text-pink-700 font-medium">{metrics.formatted.cpm}</span>
        </div>

        {/* Количество дней */}
        <div>
          <span className="font-medium text-gray-700">Дней:</span>
          <span className="ml-1 text-gray-800 font-medium">{metrics.formatted.days}</span>
        </div>
      </div>

      {/* Дополнительная информация */}
      {!compact && metrics.videoName && (
        <div className="mt-2 pt-1 border-t border-gray-100">
          <div className="text-xs text-gray-500 truncate" title={metrics.videoName}>
            <span className="font-medium">Видео:</span> {metrics.videoName}
          </div>
          {metrics.updatedAt && (
            <div className="text-xs text-gray-400 mt-0.5">
              Обновлено: {metrics.updatedAt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CreativeMetrics;
