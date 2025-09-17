// Красивый и компактный компонент для отображения метрик отдельных видео
// Замените содержимое src/components/CreativeMetrics.js

import React, { useState, useEffect } from 'react';
import { MetricsService } from '../services/metricsService';
import { 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  TrendingUp,
  Eye,
  MousePointer,
  DollarSign,
  Target
} from 'lucide-react';

/**
 * Компонент для отображения метрик отдельного видео в красивом компактном виде
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
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="flex items-center text-gray-500 text-sm">
          <BarChart3 className="h-4 w-4 mr-2" />
          <span>Название не определено</span>
        </div>
      </div>
    );
  }

  // Состояние загрузки
  if (loading) {
    return (
      <div className="metrics-loading-card">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-blue-700 text-sm font-medium">Загрузка метрик...</span>
        </div>
      </div>
    );
  }

  // Состояние ошибки
  if (error) {
    return (
      <div className="metrics-error-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>Нет метрик</span>
          </div>
          {showRefresh && (
            <button
              onClick={handleRefresh}
              className="metric-refresh-btn text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100"
              title="Повторить попытку"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
        {!compact && (
          <div className="text-xs text-red-600 mt-1 opacity-75">{error}</div>
        )}
      </div>
    );
  }

  // Состояние без метрик
  if (!metrics) {
    return (
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-gray-600 text-sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            <span>Метрики недоступны</span>
          </div>
          {showRefresh && (
            <button
              onClick={handleRefresh}
              className="metric-refresh-btn text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
              title="Попробовать загрузить"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Отображение метрик в красивом компактном виде
  return (
    <div className="creative-metrics-compact metrics-success-card">
      {/* Заголовок с кнопкой обновления */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center text-green-700">
          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
          <span className="font-semibold text-sm">Метрики рекламы</span>
        </div>
        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <div className="flex items-center text-gray-500 text-xs">
              <Clock className="h-3 w-3 mr-1" />
              <span>
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
              className="metric-refresh-btn text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-white/50"
              title="Обновить метрики"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Основные метрики в сетке 3x2 */}
      <div className="metrics-grid mb-3">
        {/* Первый ряд - главные метрики */}
        <div className="metric-card-mini metric-leads">
          <div className="flex items-center justify-center mb-1">
            <Target className="h-3 w-3 text-blue-600 metric-icon" />
          </div>
          <div className="metric-value-large text-blue-700">
            {metrics.formatted.leads}
          </div>
          <div className="metric-label-mini text-blue-600">Лиды</div>
        </div>

        <div className="metric-card-mini metric-cpl">
          <div className="flex items-center justify-center mb-1">
            <DollarSign className="h-3 w-3 text-green-600 metric-icon" />
          </div>
          <div className="metric-value-large text-green-700">
            {metrics.formatted.cpl}
          </div>
          <div className="metric-label-mini text-green-600">CPL</div>
        </div>

        <div className="metric-card-mini metric-cost">
          <div className="flex items-center justify-center mb-1">
            <DollarSign className="h-3 w-3 text-purple-600 metric-icon" />
          </div>
          <div className="metric-value-large text-purple-700">
            {metrics.formatted.cost}
          </div>
          <div className="metric-label-mini text-purple-600">Расходы</div>
        </div>

        {/* Второй ряд - показы, клики, CTR */}
        <div className="metric-card-mini metric-shows">
          <div className="flex items-center justify-center mb-1">
            <Eye className="h-3 w-3 text-indigo-600 metric-icon" />
          </div>
          <div className="metric-value-medium text-indigo-700">
            {metrics.formatted.impressions}
          </div>
          <div className="metric-label-mini text-indigo-600">Показы</div>
        </div>

        <div className="metric-card-mini metric-clicks">
          <div className="flex items-center justify-center mb-1">
            <MousePointer className="h-3 w-3 text-orange-600 metric-icon" />
          </div>
          <div className="metric-value-medium text-orange-700">
            {metrics.formatted.clicks}
          </div>
          <div className="metric-label-mini text-orange-600">Клики</div>
        </div>

        <div className="metric-card-mini metric-ctr">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="h-3 w-3 text-pink-600 metric-icon" />
          </div>
          <div className="metric-value-medium text-pink-700">
            {metrics.formatted.ctr}
          </div>
          <div className="metric-label-mini text-pink-600">CTR</div>
        </div>
      </div>

      {/* Дополнительные метрики в одну строку */}
      <div className="metrics-grid-additional">
        <div className="text-center">
          <div className="text-xs font-medium text-gray-700">{metrics.formatted.cpc}</div>
          <div className="text-xs text-gray-500 font-medium">CPC</div>
        </div>
        
        <div className="text-center">
          <div className="text-xs font-medium text-gray-700">{metrics.formatted.cpm}</div>
          <div className="text-xs text-gray-500 font-medium">CPM</div>
        </div>
        
        <div className="text-center">
          <div className="text-xs font-medium text-gray-700">{metrics.formatted.days}</div>
          <div className="text-xs text-gray-500 font-medium">Дней</div>
        </div>
      </div>

      {/* Дополнительная информация */}
      {!compact && metrics.videoName && (
        <div className="mt-3 pt-2 border-t border-white/30">
          <div className="text-xs text-gray-600 truncate" title={metrics.videoName}>
            <span className="font-medium">Видео:</span> {metrics.videoName}
          </div>
          {metrics.updatedAt && (
            <div className="text-xs text-gray-500 mt-1">
              Обновлено: {metrics.updatedAt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CreativeMetrics;
