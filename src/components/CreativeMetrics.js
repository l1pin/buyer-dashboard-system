// Компактный и красивый компонент для отображения метрик отдельных видео
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
 * Компонент для отображения метрик отдельного видео в компактном виде
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
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 animate-pulse">
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
      <div className="bg-red-50 rounded-lg p-3 border border-red-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>Нет метрик</span>
          </div>
          {showRefresh && (
            <button
              onClick={handleRefresh}
              className="text-red-600 hover:text-red-800 transition-colors duration-200 p-1 rounded hover:bg-red-100"
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
              className="text-gray-500 hover:text-gray-700 transition-colors duration-200 p-1 rounded hover:bg-gray-100"
              title="Попробовать загрузить"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Отображение метрик в компактном красивом виде
  return (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-4 border border-green-200 shadow-sm">
      {/* Заголовок с обновлением */}
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
              className="text-gray-500 hover:text-gray-700 transition-colors duration-200 p-1 rounded-full hover:bg-white/50"
              title="Обновить метрики"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Сетка метрик - 2 ряда по 3 карточки */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Первый ряд */}
        <div className="bg-white/60 backdrop-blur-sm rounded-md p-2 text-center border border-white/40">
          <div className="flex items-center justify-center mb-1">
            <Target className="h-3 w-3 text-blue-600 mr-1" />
          </div>
          <div className="text-lg font-bold text-blue-700 leading-none">
            {metrics.formatted.leads}
          </div>
          <div className="text-xs text-blue-600 font-medium">Лиды</div>
        </div>

        <div className="bg-white/60 backdrop-blur-sm rounded-md p-2 text-center border border-white/40">
          <div className="flex items-center justify-center mb-1">
            <DollarSign className="h-3 w-3 text-green-600 mr-1" />
          </div>
          <div className="text-lg font-bold text-green-700 leading-none">
            {metrics.formatted.cpl}
          </div>
          <div className="text-xs text-green-600 font-medium">CPL</div>
        </div>

        <div className="bg-white/60 backdrop-blur-sm rounded-md p-2 text-center border border-white/40">
          <div className="flex items-center justify-center mb-1">
            <DollarSign className="h-3 w-3 text-purple-600 mr-1" />
          </div>
          <div className="text-lg font-bold text-purple-700 leading-none">
            {metrics.formatted.cost}
          </div>
          <div className="text-xs text-purple-600 font-medium">Расходы</div>
        </div>

        {/* Второй ряд */}
        <div className="bg-white/60 backdrop-blur-sm rounded-md p-2 text-center border border-white/40">
          <div className="flex items-center justify-center mb-1">
            <Eye className="h-3 w-3 text-indigo-600 mr-1" />
          </div>
          <div className="text-sm font-bold text-indigo-700 leading-none">
            {metrics.formatted.impressions}
          </div>
          <div className="text-xs text-indigo-600 font-medium">Показы</div>
        </div>

        <div className="bg-white/60 backdrop-blur-sm rounded-md p-2 text-center border border-white/40">
          <div className="flex items-center justify-center mb-1">
            <MousePointer className="h-3 w-3 text-orange-600 mr-1" />
          </div>
          <div className="text-sm font-bold text-orange-700 leading-none">
            {metrics.formatted.clicks}
          </div>
          <div className="text-xs text-orange-600 font-medium">Клики</div>
        </div>

        <div className="bg-white/60 backdrop-blur-sm rounded-md p-2 text-center border border-white/40">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="h-3 w-3 text-pink-600 mr-1" />
          </div>
          <div className="text-sm font-bold text-pink-700 leading-none">
            {metrics.formatted.ctr}
          </div>
          <div className="text-xs text-pink-600 font-medium">CTR</div>
        </div>
      </div>

      {/* Дополнительные метрики в одну строку */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <div className="text-gray-600 font-medium">{metrics.formatted.cpc}</div>
          <div className="text-gray-500">CPC</div>
        </div>
        
        <div className="text-center">
          <div className="text-gray-600 font-medium">{metrics.formatted.cpm}</div>
          <div className="text-gray-500">CPM</div>
        </div>
        
        <div className="text-center">
          <div className="text-gray-600 font-medium">{metrics.formatted.days}</div>
          <div className="text-gray-500">Дней</div>
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
