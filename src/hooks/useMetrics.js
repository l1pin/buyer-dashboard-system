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
 * ПЕРЕПИСАННЫЙ хук для батчевой загрузки метрик - ОПТИМИЗИРОВАННАЯ батчевая обработка
 */
export function useBatchMetrics(creatives, autoLoad = false, period = 'all') {
  // Сырые данные за все время (загружаются один раз)
  const [rawBatchMetrics, setRawBatchMetrics] = useState(new Map());
  
  // Отфильтрованные данные (пересчитываются мгновенно)
  const [filteredBatchMetrics, setFilteredBatchMetrics] = useState(new Map());
  
  // Состояние загрузки
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stats, setStats] = useState({ total: 0, found: 0, notFound: 0 });

  // Ссылка для отмены загрузки
  const loadingCancelRef = useRef(false);

  const loadRawBatchMetrics = useCallback(async (forceRefresh = false) => {
    if (!creatives || creatives.length === 0) {
      setRawBatchMetrics(new Map());
      setFilteredBatchMetrics(new Map());
      setStats({ total: 0, found: 0, notFound: 0 });
      return;
    }

    setLoading(true);
    setError('');
    loadingCancelRef.current = false;

    try {
      // Если не форсируем обновление, пытаемся загрузить из кэша
      if (!forceRefresh) {
        console.log('📦 Загрузка метрик из кэша...');
        const creativeIds = creatives.map(c => c.id);
        const cachedData = await metricsAnalyticsService.getBatchMetricsCache(creativeIds, 'all');
        
        if (cachedData && cachedData.length > 0) {
          const rawMetricsMap = new Map();
          let successCount = 0;

          cachedData.forEach(cache => {
            const videoKey = `${cache.creative_id}_${cache.video_index}`;
            if (cache.metrics_data) {
              rawMetricsMap.set(videoKey, {
                found: true,
                data: {
                  ...cache.metrics_data,
                  fromCache: true,
                  cachedAt: cache.cached_at
                },
                error: null,
                videoName: cache.video_title,
                creativeId: cache.creative_id,
                videoIndex: cache.video_index
              });
              successCount++;
            }
          });

          if (rawMetricsMap.size > 0) {
            setRawBatchMetrics(rawMetricsMap);
            setLastUpdated(new Date());
            console.log(`✅ Загружено ${successCount} метрик из кэша`);
            setLoading(false);
            return;
          }
        }
        
        console.log('⚠️ Кэш пуст, загружаем из API...');
      } else {
        console.log('🔄 Форсированное обновление из API...');
      }

      console.log('🚀 ОПТИМИЗИРОВАННАЯ батчевая загрузка данных из API...');
      
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
        setRawBatchMetrics(new Map());
        setFilteredBatchMetrics(new Map());
        setStats({ total: 0, found: 0, notFound: 0 });
        return;
      }

      const videoNames = Array.from(videoToCreativeMap.keys());
      console.log(`📊 Запуск ОПТИМИЗИРОВАННОЙ загрузки ${videoNames.length} видео...`);
      
      // ОПТИМИЗИРОВАННАЯ батчевая загрузка с меньшими задержками
      // БАТЧЕВАЯ ОЧЕРЕДЬ - обработка по 3 запроса одновременно
      const BATCH_SIZE = 3; // Максимум 3 одновременных запроса
      const BATCH_DELAY = 500; // 500мс между батчами
      
      const results = [];
      
      for (let i = 0; i < videoNames.length; i += BATCH_SIZE) {
        // Проверка на отмену
        if (loadingCancelRef.current) {
          console.log('⚠️ Загрузка отменена');
          break;
        }
        
        const batch = videoNames.slice(i, i + BATCH_SIZE);
        console.log(`🔄 Обработка батча ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(videoNames.length / BATCH_SIZE)}: ${batch.length} видео`);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (videoName) => {
            try {
              const result = await MetricsService.getVideoMetricsRaw(videoName);
              return {
                videoName,
                ...result
              };
            } catch (error) {
              return {
                videoName,
                found: false,
                error: error.message
              };
            }
          })
        );
        
        results.push(...batchResults);
        
        // Задержка между батчами (кроме последнего)
        if (i + BATCH_SIZE < videoNames.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }

      const rawMetricsMap = new Map();
      let successCount = 0;

      results.forEach((result, index) => {
        const videoName = videoNames[index];
        const videoMapping = videoToCreativeMap.get(videoName);
        
        if (videoMapping) {
          const { videoKey, creativeId, videoIndex } = videoMapping;
          
          const resultData = result.status === 'fulfilled' ? result.value : {
            videoName,
            found: false,
            error: 'Неизвестная ошибка при обработке'
          };
          
          rawMetricsMap.set(videoKey, {
            found: resultData.found,
            data: resultData.data,
            error: resultData.error,
            videoName: resultData.videoName || videoName,
            creativeId: creativeId,
            videoIndex: videoIndex
          });

          if (resultData.found) {
            successCount++;
          }
        }
      });

      // Сохраняем сырые данные за все время
      setRawBatchMetrics(rawMetricsMap);
      
      // Сохраняем время последнего обновления в БД
      await metricsAnalyticsService.updateMetricsLastUpdate();
      setLastUpdated(new Date());
      
      console.log(`✅ ОПТИМИЗИРОВАННАЯ загрузка завершена: ${successCount}/${results.length} метрик найдено и сохранено в кэш`);

    } catch (err) {
      console.error('❌ Ошибка оптимизированной загрузки:', err);
      setError('Ошибка загрузки: ' + err.message);
      setRawBatchMetrics(new Map());
      setFilteredBatchMetrics(new Map());
    } finally {
      setLoading(false);
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

  const getSuccessRate = useCallback(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.found / stats.total) * 100);
  }, [stats]);

  const refresh = useCallback(async () => {
    console.log('🔄 Принудительное обновление с оптимизированной загрузкой...');
    loadingCancelRef.current = true; // Отменяем текущую загрузку
    await new Promise(resolve => setTimeout(resolve, 100)); // Ждем отмены
    await loadRawBatchMetrics(true); // Передаем true для форсированного обновления
  }, [loadRawBatchMetrics]);

  return {
    batchMetrics: filteredBatchMetrics,
    rawBatchMetrics,
    loading,
    error,
    stats,
    lastUpdated,
    refresh,
    loadFromCache: () => loadRawBatchMetrics(false), // Загрузить из кэша
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
