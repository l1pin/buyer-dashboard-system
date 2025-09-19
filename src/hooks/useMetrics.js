// Чистый хук для работы с метриками без отладки
// Замените содержимое src/hooks/useMetrics.js

import { useState, useEffect, useCallback, useRef } from 'react';
import { MetricsService } from '../services/metricsService';

/**
 * Хук для получения метрик одного видео по названию
 */
export function useVideoMetrics(videoTitle, autoLoad = true, period = 'all') {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadMetrics = useCallback(async () => {
    if (!videoTitle || videoTitle.startsWith('Видео ')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await MetricsService.getVideoMetrics(videoTitle, period);
      
      if (result.found) {
        setMetrics(result.data);
        setLastUpdated(new Date());
        setError('');
      } else {
        setError(result.error || 'Метрики не найдены');
        setMetrics(null);
      }
    } catch (err) {
      setError('Ошибка загрузки: ' + err.message);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [videoTitle, period]);

  useEffect(() => {
    if (autoLoad && videoTitle) {
      loadMetrics();
    }
  }, [videoTitle, autoLoad, period, loadMetrics]);

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
 * Хук для батчевой загрузки метрик множества креативов (с множественными видео каждый)
 */
export function useBatchMetrics(creatives, autoLoad = true, period = 'all') {
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
      // Собираем все названия видео из всех креативов
      const videoToCreativeMap = new Map();
      let totalVideos = 0;

      creatives.forEach(creative => {
        if (creative.link_titles && creative.link_titles.length > 0) {
          creative.link_titles.forEach((videoTitle, videoIndex) => {
            if (videoTitle && !videoTitle.startsWith('Видео ')) {
              totalVideos++;
              const videoKey = `${creative.id}_${videoIndex}`;
              videoToCreativeMap.set(videoTitle, {
                creativeId: creative.id,
                videoIndex: videoIndex,
                videoKey: videoKey
              });
            }
          });
        }
      });

      if (videoToCreativeMap.size === 0) {
        setError('Нет доступных названий видео для поиска метрик');
        setBatchMetrics(new Map());
        setStats({ total: 0, found: 0, notFound: 0 });
        return;
      }

      const videoNames = Array.from(videoToCreativeMap.keys());
      const results = await MetricsService.getBatchVideoMetrics(videoNames, period);
      
      const metricsMap = new Map();
      let successCount = 0;

      results.forEach(result => {
        const videoMapping = videoToCreativeMap.get(result.videoName);
        if (videoMapping) {
          const { videoKey, creativeId, videoIndex } = videoMapping;
          
          metricsMap.set(videoKey, {
            found: result.found,
            data: result.data,
            error: result.error,
            videoName: result.videoName,
            period: period,
            creativeId: creativeId,
            videoIndex: videoIndex
          });

          if (result.found) {
            successCount++;
          }
        }
      });

      setBatchMetrics(metricsMap);
      setStats({
        total: totalVideos,
        found: successCount,
        notFound: totalVideos - successCount
      });
      setLastUpdated(new Date());

    } catch (err) {
      setError('Ошибка загрузки: ' + err.message);
      setBatchMetrics(new Map());
    } finally {
      setLoading(false);
    }
  }, [creatives, period]);

  useEffect(() => {
    if (autoLoad && creatives) {
      loadBatchMetrics();
    }
  }, [creatives, autoLoad, period, loadBatchMetrics]);

  const getVideoMetrics = useCallback((creativeId, videoIndex) => {
    const videoKey = `${creativeId}_${videoIndex}`;
    return batchMetrics.get(videoKey) || null;
  }, [batchMetrics]);

  const getCreativeMetrics = useCallback((creativeId) => {
    const creativeMetrics = [];
    let videoIndex = 0;
    
    while (true) {
      const videoKey = `${creativeId}_${videoIndex}`;
      const metrics = batchMetrics.get(videoKey);
      
      if (metrics) {
        creativeMetrics.push({
          videoIndex,
          ...metrics
        });
        videoIndex++;
      } else if (videoIndex === 0) {
        break;
      } else {
        videoIndex++;
        if (videoIndex > 10) break;
      }
    }
    
    return creativeMetrics.length > 0 ? creativeMetrics : null;
  }, [batchMetrics]);

  const hasVideoMetrics = useCallback((creativeId, videoIndex) => {
    const metrics = getVideoMetrics(creativeId, videoIndex);
    return metrics && metrics.found;
  }, [getVideoMetrics]);

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
    getVideoMetrics,
    getCreativeMetrics,
    hasVideoMetrics,
    getSuccessRate
  };
}

/**
 * Хук для работы с API метрик (проверка статуса, общие операции)
 */
export function useMetricsApi() {
  const [apiStatus, setApiStatus] = useState('unknown');
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
      setApiStatus('unavailable');
      return 'unavailable';
    } finally {
      setChecking(false);
    }
  }, [apiStatus]);

  useEffect(() => {
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
export function useMetricsStats(creatives, batchMetricsMap = null) {
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalCost: 0,
    totalClicks: 0,
    totalImpressions: 0,
    totalDays: 0,
    avgCPL: 0,
    avgCTR: 0,
    avgCPC: 0,
    avgCPM: 0,
    videosWithMetrics: 0,
    videosWithoutMetrics: 0,
    creativesWithMetrics: 0,
    creativesWithoutMetrics: 0
  });

  useEffect(() => {
    if (!creatives || creatives.length === 0 || !batchMetricsMap) {
      setStats({
        totalLeads: 0,
        totalCost: 0,
        totalClicks: 0,
        totalImpressions: 0,
        totalDays: 0,
        avgCPL: 0,
        avgCTR: 0,
        avgCPC: 0,
        avgCPM: 0,
        videosWithMetrics: 0,
        videosWithoutMetrics: 0,
        creativesWithMetrics: 0,
        creativesWithoutMetrics: 0
      });
      return;
    }

    let totalLeads = 0;
    let totalCost = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalDays = 0;
    let videosWithMetrics = 0;
    let videosWithoutMetrics = 0;
    let creativesWithMetrics = 0;
    let creativesWithoutMetrics = 0;

    creatives.forEach(creative => {
      let creativeHasMetrics = false;
      const videoCount = creative.link_titles ? creative.link_titles.length : 0;
      
      for (let videoIndex = 0; videoIndex < videoCount; videoIndex++) {
        const videoKey = `${creative.id}_${videoIndex}`;
        const metrics = batchMetricsMap.get(videoKey);
        
        if (metrics && metrics.found && metrics.data) {
          const data = metrics.data.raw;
          totalLeads += data.leads || 0;
          totalCost += data.cost || 0;
          totalClicks += data.clicks || 0;
          totalImpressions += data.impressions || 0;
          totalDays += data.days_count || 0;
          videosWithMetrics++;
          creativeHasMetrics = true;
        } else {
          videosWithoutMetrics++;
        }
      }
      
      if (creativeHasMetrics) {
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
      totalDays,
      avgCPL: Number(avgCPL.toFixed(2)),
      avgCTR: Number(avgCTR.toFixed(2)),
      avgCPC: Number(avgCPC.toFixed(2)),
      avgCPM: Number(avgCPM.toFixed(2)),
      videosWithMetrics,
      videosWithoutMetrics,
      creativesWithMetrics,
      creativesWithoutMetrics
    });

  }, [creatives, batchMetricsMap]);

  const formatStats = useCallback(() => {
    const formatInt = (n) => String(Math.round(Number(n) || 0));
    const formatMoney = (n) => (Number(n) || 0).toFixed(2) + "$";
    const formatPercent = (n) => (Number(n) || 0).toFixed(2) + "%";

    return {
      totalLeads: formatInt(stats.totalLeads),
      totalCost: formatMoney(stats.totalCost),
      totalClicks: formatInt(stats.totalClicks),
      totalImpressions: formatInt(stats.totalImpressions),
      totalDays: formatInt(stats.totalDays) + " дн.",
      avgCPL: formatMoney(stats.avgCPL),
      avgCTR: formatPercent(stats.avgCTR),
      avgCPC: formatMoney(stats.avgCPC),
      avgCPM: formatMoney(stats.avgCPM),
      videosWithMetrics: formatInt(stats.videosWithMetrics),
      videosWithoutMetrics: formatInt(stats.videosWithoutMetrics),
      creativesWithMetrics: formatInt(stats.creativesWithMetrics),
      creativesWithoutMetrics: formatInt(stats.creativesWithoutMetrics),
      totalVideos: formatInt(stats.videosWithMetrics + stats.videosWithoutMetrics),
      totalCreatives: formatInt(stats.creativesWithMetrics + stats.creativesWithoutMetrics),
      videoMetricsSuccessRate: formatPercent(
        stats.videosWithMetrics + stats.videosWithoutMetrics > 0
          ? (stats.videosWithMetrics / (stats.videosWithMetrics + stats.videosWithoutMetrics)) * 100
          : 0
      ),
      creativeMetricsSuccessRate: formatPercent(
        stats.creativesWithMetrics + stats.creativesWithoutMetrics > 0
          ? (stats.creativesWithMetrics / (stats.creativesWithMetrics + stats.creativesWithoutMetrics)) * 100
          : 0
      )
    };
  }, [stats]);

  return {
    stats,
    formatStats,
    hasData: stats.videosWithMetrics > 0
  };
}
