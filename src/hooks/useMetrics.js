// ПОЛНОСТЬЮ ПЕРЕПИСАННЫЕ хуки для метрик - ДИНАМИЧЕСКАЯ загрузка по очереди
// Замените содержимое src/hooks/useMetrics.js

import { useState, useEffect, useCallback, useRef } from 'react';
import { MetricsService } from '../services/metricsService';

/**
 * Хук для получения метрик одного видео по названию - ПЕРЕПИСАН
 */
export function useVideoMetrics(videoTitle, autoLoad = true, period = 'all') {
  const [rawMetrics, setRawMetrics] = useState(null); // Сырые данные за все время
  const [filteredMetrics, setFilteredMetrics] = useState(null); // Отфильтрованные данные
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Загрузка сырых данных - ТОЛЬКО один раз
  const loadRawMetrics = useCallback(async () => {
    if (!videoTitle || videoTitle.startsWith('Видео ')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log(`🔍 Загружаем сырые метрики для: ${videoTitle}`);
      const result = await MetricsService.getVideoMetricsRaw(videoTitle);
      
      if (result.found) {
        setRawMetrics(result);
        setLastUpdated(new Date());
        setError('');
        console.log(`✅ Сырые метрики загружены для: ${videoTitle}`);
      } else {
        setError(result.error || 'Метрики не найдены');
        setRawMetrics(null);
      }
    } catch (err) {
      setError('Ошибка загрузки: ' + err.message);
      setRawMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [videoTitle]);

  // Мгновенная фильтрация на клиенте при смене периода
  const applyFilter = useCallback((rawData, targetPeriod) => {
    if (!rawData || !rawData.found) {
      setFilteredMetrics(null);
      return;
    }

    console.log(`⚡ МГНОВЕННАЯ фильтрация для ${videoTitle}: ${targetPeriod}`);
    
    const filtered = MetricsService.filterRawMetricsByPeriod(rawData, targetPeriod);
    setFilteredMetrics(filtered);
  }, [videoTitle]);

  // Загружаем сырые данные только при смене videoTitle
  useEffect(() => {
    if (autoLoad && videoTitle) {
      loadRawMetrics();
    }
  }, [videoTitle, autoLoad, loadRawMetrics]); // period НЕТ в зависимостях!

  // Применяем фильтр при смене периода или сырых данных
  useEffect(() => {
    if (rawMetrics) {
      applyFilter(rawMetrics, period);
    } else {
      setFilteredMetrics(null);
    }
  }, [rawMetrics, period, applyFilter]);

  return {
    metrics: filteredMetrics?.found ? filteredMetrics.data : null,
    loading,
    error: filteredMetrics?.found === false ? filteredMetrics.error : error,
    lastUpdated,
    refresh: loadRawMetrics, // Обновляет только сырые данные
    hasMetrics: filteredMetrics?.found || false,
    period: period // Для отладки
  };
}

/**
 * ПЕРЕПИСАННЫЙ хук для батчевой загрузки метрик - ДИНАМИЧЕСКАЯ загрузка по очереди
 */
export function useBatchMetrics(creatives, autoLoad = true, period = 'all') {
  // Сырые данные за все время (загружаются один раз)
  const [rawBatchMetrics, setRawBatchMetrics] = useState(new Map());
  
  // Отфильтрованные данные (пересчитываются мгновенно)
  const [filteredBatchMetrics, setFilteredBatchMetrics] = useState(new Map());
  
  // НОВОЕ: Состояние для отслеживания какие креативы сейчас загружаются
  const [loadingCreatives, setLoadingCreatives] = useState(new Set());
  const [globalLoading, setGlobalLoading] = useState(false);
  
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stats, setStats] = useState({ total: 0, found: 0, notFound: 0 });

  // Ссылка для отмены загрузки
  const loadingCancelRef = useRef(false);

  const loadRawBatchMetrics = useCallback(async () => {
    if (!creatives || creatives.length === 0) {
      setRawBatchMetrics(new Map());
      setFilteredBatchMetrics(new Map());
      setLoadingCreatives(new Set());
      setStats({ total: 0, found: 0, notFound: 0 });
      return;
    }

    setGlobalLoading(true);
    setError('');
    loadingCancelRef.current = false;

    try {
      console.log('🚀 ДИНАМИЧЕСКАЯ батчевая загрузка данных...');
      
      // Сортируем креативы по дате создания (НОВЫЕ ПЕРВЫЕ!)
      const sortedCreatives = [...creatives].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );

      console.log(`📅 Креативы отсортированы по дате: свежие первые (${sortedCreatives.length} креативов)`);

      // Собираем все названия видео из всех креативов с привязкой к креативам
      const videoToCreativeMap = new Map();
      const creativeVideoMap = new Map(); // Для отслеживания видео по креативам
      let totalVideos = 0;

      sortedCreatives.forEach(creative => {
        const creativeVideos = [];
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
              creativeVideos.push({ videoTitle, videoKey, videoIndex });
            }
          });
        }
        if (creativeVideos.length > 0) {
          creativeVideoMap.set(creative.id, creativeVideos);
        }
      });

      if (videoToCreativeMap.size === 0) {
        setError('Нет доступных названий видео для поиска метрик');
        setRawBatchMetrics(new Map());
        setFilteredBatchMetrics(new Map());
        setLoadingCreatives(new Set());
        setStats({ total: 0, found: 0, notFound: 0 });
        return;
      }

      const rawMetricsMap = new Map();
      let processedCount = 0;
      let successCount = 0;

      // ДИНАМИЧЕСКАЯ загрузка по креативам (от новых к старым)
      for (const creative of sortedCreatives) {
        if (loadingCancelRef.current) {
          console.log('⏹️ Загрузка отменена пользователем');
          break;
        }

        const creativeVideos = creativeVideoMap.get(creative.id);
        if (!creativeVideos || creativeVideos.length === 0) {
          continue;
        }

        console.log(`🔄 Загружаем метрики для креатива: ${creative.article} (${creativeVideos.length} видео)`);
        
        // Помечаем креатив как загружающийся
        setLoadingCreatives(prev => new Set([...prev, creative.id]));

        // Загружаем все видео этого креатива параллельно
        const creativePromises = creativeVideos.map(async ({ videoTitle, videoKey, videoIndex }) => {
          try {
            // Небольшая задержка для визуального эффекта
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const result = await MetricsService.getVideoMetricsRaw(videoTitle);
            
            return {
              videoKey,
              result: {
                found: result.found,
                data: result.data,
                error: result.error,
                videoName: result.videoName || videoTitle,
                creativeId: creative.id,
                videoIndex: videoIndex
              }
            };
          } catch (err) {
            return {
              videoKey,
              result: {
                found: false,
                data: null,
                error: err.message,
                videoName: videoTitle,
                creativeId: creative.id,
                videoIndex: videoIndex
              }
            };
          }
        });

        // Ждем загрузки всех видео креатива
        const creativeResults = await Promise.all(creativePromises);
        
        // Обновляем результаты для этого креатива
        let creativeSuccessCount = 0;
        creativeResults.forEach(({ videoKey, result }) => {
          rawMetricsMap.set(videoKey, result);
          processedCount++;
          if (result.found) {
            successCount++;
            creativeSuccessCount++;
          }
        });

        // Обновляем состояние после обработки креатива
        setRawBatchMetrics(new Map(rawMetricsMap));
        
        // Убираем креатив из списка загружающихся
        setLoadingCreatives(prev => {
          const newSet = new Set(prev);
          newSet.delete(creative.id);
          return newSet;
        });

        console.log(`✅ Креатив "${creative.article}" обработан: ${creativeSuccessCount}/${creativeResults.length} видео с метриками`);

        // Небольшая пауза между креативами для плавности
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setLastUpdated(new Date());
      
      console.log(`🎉 ДИНАМИЧЕСКАЯ загрузка завершена: ${successCount}/${processedCount} метрик найдено`);

    } catch (err) {
      console.error('❌ Ошибка динамической загрузки:', err);
      setError('Ошибка загрузки: ' + err.message);
      setRawBatchMetrics(new Map());
      setFilteredBatchMetrics(new Map());
    } finally {
      setGlobalLoading(false);
      setLoadingCreatives(new Set());
      loadingCancelRef.current = false;
    }
  }, [creatives]);

  // МГНОВЕННАЯ фильтрация сырых данных по периоду
  const applyPeriodFilter = useCallback((rawMetrics, targetPeriod) => {
    if (!rawMetrics || rawMetrics.size === 0) {
      setFilteredBatchMetrics(new Map());
      setStats({ total: 0, found: 0, notFound: 0 });
      return;
    }

    console.log(`⚡ МГНОВЕННАЯ батчевая фильтрация для периода: ${targetPeriod}`);
    
    const filteredMap = new Map();
    let successCount = 0;
    let totalCount = 0;

    // Применяем фильтр к каждой записи НА КЛИЕНТЕ
    for (const [videoKey, rawMetric] of rawMetrics) {
      totalCount++;
      
      if (!rawMetric.found || !rawMetric.data) {
        // Если метрик нет, просто копируем как есть
        filteredMap.set(videoKey, {
          ...rawMetric,
          period: targetPeriod
        });
        continue;
      }

      try {
        // КЛИЕНТСКАЯ фильтрация без запросов к БД
        const filteredResult = MetricsService.filterRawMetricsByPeriod(rawMetric, targetPeriod);
        
        if (filteredResult.found) {
          filteredMap.set(videoKey, {
            found: true,
            data: filteredResult.data,
            error: null,
            videoName: rawMetric.videoName,
            period: targetPeriod,
            creativeId: rawMetric.creativeId,
            videoIndex: rawMetric.videoIndex
          });
          successCount++;
        } else {
          filteredMap.set(videoKey, {
            found: false,
            data: null,
            error: filteredResult.error || `Нет данных за период: ${targetPeriod}`,
            videoName: rawMetric.videoName,
            period: targetPeriod,
            creativeId: rawMetric.creativeId,
            videoIndex: rawMetric.videoIndex
          });
        }
      } catch (err) {
        // В случае ошибки фильтрации, показываем что метрик нет за этот период
        filteredMap.set(videoKey, {
          found: false,
          data: null,
          error: `Ошибка фильтрации: ${err.message}`,
          videoName: rawMetric.videoName,
          period: targetPeriod,
          creativeId: rawMetric.creativeId,
          videoIndex: rawMetric.videoIndex
        });
      }
    }

    setFilteredBatchMetrics(filteredMap);
    setStats({
      total: totalCount,
      found: successCount,
      notFound: totalCount - successCount
    });

    console.log(`✅ Клиентская фильтрация завершена МГНОВЕННО: ${successCount}/${totalCount} метрик найдено`);
  }, []);

  // Загружаем сырые данные только при изменении креативов (НЕ периода!)
  useEffect(() => {
    if (autoLoad && creatives) {
      loadRawBatchMetrics();
    }
    
    // Отмена загрузки при размонтировании или смене креативов
    return () => {
      loadingCancelRef.current = true;
    };
  }, [creatives, autoLoad, loadRawBatchMetrics]); // period убран из зависимостей!

  // Применяем фильтр при изменении периода или сырых данных - МГНОВЕННО
  useEffect(() => {
    if (rawBatchMetrics.size > 0) {
      applyPeriodFilter(rawBatchMetrics, period);
    } else {
      setFilteredBatchMetrics(new Map());
      setStats({ total: 0, found: 0, notFound: 0 });
    }
  }, [rawBatchMetrics, period, applyPeriodFilter]);

  const getVideoMetrics = useCallback((creativeId, videoIndex) => {
    const videoKey = `${creativeId}_${videoIndex}`;
    return filteredBatchMetrics.get(videoKey) || null;
  }, [filteredBatchMetrics]);

  const getCreativeMetrics = useCallback((creativeId) => {
    const creativeMetrics = [];
    let videoIndex = 0;
    
    while (true) {
      const videoKey = `${creativeId}_${videoIndex}`;
      const metrics = filteredBatchMetrics.get(videoKey);
      
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
  }, [filteredBatchMetrics]);

  const hasVideoMetrics = useCallback((creativeId, videoIndex) => {
    const metrics = getVideoMetrics(creativeId, videoIndex);
    return metrics && metrics.found;
  }, [getVideoMetrics]);

  // НОВАЯ функция: проверка загружается ли конкретный креатив
  const isCreativeLoading = useCallback((creativeId) => {
    return loadingCreatives.has(creativeId);
  }, [loadingCreatives]);

  const getSuccessRate = useCallback(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.found / stats.total) * 100);
  }, [stats]);

  const refresh = useCallback(async () => {
    console.log('🔄 Принудительное обновление с динамической загрузкой...');
    loadingCancelRef.current = true; // Отменяем текущую загрузку
    await new Promise(resolve => setTimeout(resolve, 100)); // Ждем отмены
    await loadRawBatchMetrics();
  }, [loadRawBatchMetrics]);

  return {
    batchMetrics: filteredBatchMetrics, // Возвращаем отфильтрованные данные
    rawBatchMetrics, // Для отладки
    loading: globalLoading, // Общий статус загрузки
    loadingCreatives, // Какие креативы сейчас загружаются
    isCreativeLoading, // Функция проверки загрузки конкретного креатива
    error,
    stats,
    lastUpdated,
    refresh,
    getVideoMetrics,
    getCreativeMetrics,
    hasVideoMetrics,
    getSuccessRate,
    currentPeriod: period // Для отладки
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
