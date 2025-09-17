// Хук для работы с метриками рекламы
// Создайте файл: src/hooks/useMetrics.js

import { useState, useEffect, useCallback, useRef } from 'react';
import { MetricsService } from '../services/metricsService';

/**
 * Хук для получения метрик одного креатива
 */
export function useCreativeMetrics(creative, autoLoad = true) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadMetrics = useCallback(async () => {
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
        setMetrics(null);
        return;
      }

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
  }, [creative]);

  useEffect(() => {
    if (autoLoad && creative) {
      loadMetrics();
    }
  }, [creative, autoLoad, loadMetrics]);

  return {
    metrics,
    loading,
    error,
    lastUpdated,
    refresh: loadMetrics,
    hasMetrics: !!metrics
  };
}

/**
 * Хук для батчевой загрузки метрик множества креативов
 */
export function useBatchMetrics(creatives, autoLoad = true) {
  const [batchMetrics, setBatchMetrics] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ total: 0, found: 0, notFound: 0 });
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadBatchMetrics = useCallback(async () => {
    if (!creatives || creatives.length === 0) {
      setBatchMetrics(new Map());
      setStats({ total: 0, found: 0, notFound: 0 });
      return;
    }

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
        setBatchMetrics(new Map());
        setStats({ total: 0, found: 0, notFound: 0 });
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
      setStats({
        total: videoNames.length,
        found: successCount,
        notFound: videoNames.length - successCount
      });
      setLastUpdated(new Date());
      
      console.log(`✅ Загружено метрик: ${successCount}/${videoNames.length}`);

    } catch (err) {
      console.error('Ошибка батчевой загрузки метрик:', err);
      setError('Ошибка загрузки: ' + err.message);
      setBatchMetrics(new Map());
    } finally {
      setLoading(false);
    }
  }, [creatives]);

  useEffect(() => {
    if (autoLoad && creatives) {
      loadBatchMetrics();
    }
  }, [creatives, autoLoad, loadBatchMetrics]);

  const getCreativeMetrics = useCallback((creativeId) => {
    return batchMetrics.get(creativeId) || null;
  }, [batchMetrics]);

  const hasMetrics = useCallback((creativeId) => {
    const metrics = batchMetrics.get(creativeId);
    return metrics && metrics.found;
  }, [batchMetrics]);

  const getSuccessRate = useCallback(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.found / stats.total) * 100);
  }, [stats]);

  return {
    batchMetrics,
    loading,
    error,
    stats,
    lastUpdated,
    refresh: loadBatchMetrics,
    getCreativeMetrics,
    hasMetrics,
    getSuccessRate
  };
}

/**
 * Хук для работы с API метрик (проверка статуса, общие операции)
 */
export function useMetricsApi() {
  const [apiStatus, setApiStatus] = useState('unknown'); // 'unknown', 'available', 'unavailable'
  const [checking, setChecking] = useState(false);
  const lastCheck = useRef(null);

  const checkApiStatus = useCallback(async (force = false) => {
    // Кэшируем проверку на 5 минут
    const now = Date.now();
    if (!force && lastCheck.current && (now - lastCheck.current) < 300000) {
      return apiStatus;
    }

    setChecking(true);
    
    try {
      const result = await MetricsService.checkApiStatus();
      const status = result.available ? 'available' : 'unavailable';
      setApiStatus(status);
      lastCheck.current = now;
      return status;
    } catch (error) {
      console.error('Ошибка проверки статуса API:', error);
      setApiStatus('unavailable');
      return 'unavailable';
    } finally {
      setChecking(false);
    }
  }, [apiStatus]);

  useEffect(() => {
    // Проверяем статус API при первой загрузке
    checkApiStatus();
  }, [checkApiStatus]);

  return {
    apiStatus,
    checking,
    checkApiStatus,
    isAvailable: apiStatus === 'available',
    isUnavailable: apiStatus === 'unavailable'
  };
}

/**
 * Хук для агрегированной статистики метрик
 */
export function useMetricsStats(creatives) {
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalCost: 0,
    totalClicks: 0,
    totalImpressions: 0,
    avgCPL: 0,
    avgCTR: 0,
    avgCPC: 0,
    avgCPM: 0,
    creativesWithMetrics: 0,
    creativesWithoutMetrics: 0
  });

  const { batchMetrics, loading } = useBatchMetrics(creatives, true);

  useEffect(() => {
    if (loading || !creatives || creatives.length === 0) {
      return;
    }

    let totalLeads = 0;
    let totalCost = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let creativesWithMetrics = 0;
    let creativesWithoutMetrics = 0;

    creatives.forEach(creative => {
      const metrics = batchMetrics.get(creative.id);
      
      if (metrics && metrics.found && metrics.data) {
        const data = metrics.data.raw;
        totalLeads += data.leads || 0;
        totalCost += data.cost || 0;
        totalClicks += data.clicks || 0;
        totalImpressions += data.impressions || 0;
        creativesWithMetrics++;
      } else {
        creativesWithoutMetrics++;
      }
    });

    const avgCPL = totalLeads > 0 ? totalCost / totalLeads : 0;
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCPC = totalClicks > 0 ? totalCost / totalClicks : 0;
    const avgCPM = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0;

    setStats({
      totalLeads,
      totalCost,
      totalClicks,
      totalImpressions,
      avgCPL: Number(avgCPL.toFixed(2)),
      avgCTR: Number(avgCTR.toFixed(2)),
      avgCPC: Number(avgCPC.toFixed(2)),
      avgCPM: Number(avgCPM.toFixed(2)),
      creativesWithMetrics,
      creativesWithoutMetrics
    });

  }, [creatives, batchMetrics, loading]);

  const formatStats = useCallback(() => {
    const formatInt = (n) => String(Math.round(Number(n) || 0));
    const formatMoney = (n) => (Number(n) || 0).toFixed(2).replace(".", ",");
    const formatPercent = (n) => (Number(n) || 0).toFixed(2).replace(".", ",") + "%";

    return {
      totalLeads: formatInt(stats.totalLeads),
      totalCost: formatMoney(stats.totalCost),
      totalClicks: formatInt(stats.totalClicks),
      totalImpressions: formatInt(stats.totalImpressions),
      avgCPL: formatMoney(stats.avgCPL),
      avgCTR: formatPercent(stats.avgCTR),
      avgCPC: formatMoney(stats.avgCPC),
      avgCPM: formatMoney(stats.avgCPM),
      creativesWithMetrics: formatInt(stats.creativesWithMetrics),
      creativesWithoutMetrics: formatInt(stats.creativesWithoutMetrics),
      totalCreatives: formatInt(stats.creativesWithMetrics + stats.creativesWithoutMetrics),
      metricsSuccessRate: formatPercent(
        stats.creativesWithMetrics + stats.creativesWithoutMetrics > 0
          ? (stats.creativesWithMetrics / (stats.creativesWithMetrics + stats.creativesWithoutMetrics)) * 100
          : 0
      )
    };
  }, [stats]);

  return {
    stats,
    formatStats,
    loading,
    hasData: stats.creativesWithMetrics > 0
  };
}

/**
 * Хук для кэширования метрик
 */
export function useMetricsCache(cacheKey, ttlMinutes = 30) {
  const [cache, setCache] = useState(new Map());

  const getCachedData = useCallback((key) => {
    const fullKey = `${cacheKey}_${key}`;
    const cached = cache.get(fullKey);
    
    if (!cached) return null;
    
    // Проверяем TTL
    if (Date.now() - cached.timestamp > ttlMinutes * 60 * 1000) {
      cache.delete(fullKey);
      setCache(new Map(cache));
      return null;
    }
    
    return cached.data;
  }, [cache, cacheKey, ttlMinutes]);

  const setCachedData = useCallback((key, data) => {
    const fullKey = `${cacheKey}_${key}`;
    const newCache = new Map(cache);
    newCache.set(fullKey, {
      data,
      timestamp: Date.now()
    });
    setCache(newCache);
  }, [cache, cacheKey]);

  const clearCache = useCallback(() => {
    setCache(new Map());
  }, []);

  const getCacheSize = useCallback(() => {
    return cache.size;
  }, [cache]);

  return {
    getCachedData,
    setCachedData,
    clearCache,
    getCacheSize
  };
}
