// ИСПРАВЛЕННЫЕ хуки для метрик - с правильным сохранением в кэш
// Замените содержимое src/hooks/useMetrics.js

import { useState, useEffect, useCallback, useRef } from 'react';
import { MetricsService } from '../services/metricsService';
import { metricsAnalyticsService } from '../supabaseClient';

/**
 * Хук для получения метрик одного видео по названию
 */
export function useVideoMetrics(videoTitle, autoLoad = true, period = 'all', creativeId = null, videoIndex = null) {
  const [rawMetrics, setRawMetrics] = useState(null);
  const [filteredMetrics, setFilteredMetrics] = useState(null);
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
      
      // ✅ ИСПРАВЛЕНО: Передаем creativeId и videoIndex для сохранения в кэш
      const result = await MetricsService.getVideoMetricsRaw(
        videoTitle,
        true, // useCache
        creativeId,
        videoIndex,
        null // article - пока null, так как в useVideoMetrics нет доступа к article
      );
      
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
  }, [videoTitle, creativeId, videoIndex]);

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

  useEffect(() => {
    if (autoLoad && videoTitle) {
      loadRawMetrics();
    }
  }, [videoTitle, autoLoad, loadRawMetrics]);

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
    refresh: loadRawMetrics,
    hasMetrics: filteredMetrics?.found || false,
    period: period
  };
}

/**
 * ✅ ИСПРАВЛЕННЫЙ хук для батчевой загрузки метрик
 */
export function useBatchMetrics(creatives, autoLoad = false, period = 'all') {
  const [rawBatchMetrics, setRawBatchMetrics] = useState(new Map());
  const [filteredBatchMetrics, setFilteredBatchMetrics] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stats, setStats] = useState({ total: 0, found: 0, notFound: 0 });
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
      console.log(`🚀 Загрузка метрик для ${creatives.length} креативов...`);

      // Собираем все видео с их creativeId и videoIndex
      const videosToLoad = [];
      creatives.forEach(creative => {
        if (creative.link_titles && creative.link_titles.length > 0) {
          creative.link_titles.forEach((videoTitle, videoIndex) => {
            if (videoTitle && !videoTitle.startsWith('Видео ')) {
              videosToLoad.push({
                videoTitle,
                creativeId: creative.id,
                article: creative.article, // ✅ Добавляем артикул
                videoIndex,
                videoKey: `${creative.id}_${videoIndex}`
              });
            }
          });
        }
      });

      if (videosToLoad.length === 0) {
        setError('Нет доступных названий видео для поиска метрик');
        setRawBatchMetrics(new Map());
        setFilteredBatchMetrics(new Map());
        setStats({ total: 0, found: 0, notFound: 0 });
        return;
      }

      console.log(`📊 Всего видео для загрузки: ${videosToLoad.length}`);

      // Если не форсируем обновление, пытаемся загрузить из кэша
      const rawMetricsMap = new Map();
      let cacheHits = 0;
      const videosToLoadFromApi = []; // Видео которых нет в кэше
      
      if (!forceRefresh) {
        console.log('📦 Попытка БАТЧЕВОЙ загрузки из кэша...');
        const creativeIds = creatives.map(c => c.id);
        console.log('🔑 Creative IDs для батчевой загрузки:', creativeIds.length);
        
        try {
          const cachedData = await metricsAnalyticsService.getBatchMetricsCache(creativeIds, 'all');
          
          console.log('📦 Результат батчевого кэша:', {
            isArray: Array.isArray(cachedData),
            count: cachedData?.length || 0
          });
          
          if (cachedData && cachedData.length > 0) {
            // Создаем Map из всех возможных видео для быстрого поиска
            const videosMap = new Map();
            videosToLoad.forEach(video => {
              videosMap.set(video.videoKey, video);
            });

            // Обрабатываем кэшированные данные
            cachedData.forEach((cache) => {
              if (!cache || !cache.creative_id) return;

              const videoKey = `${cache.creative_id}_${cache.video_index}`;
              const videoInfo = videosMap.get(videoKey);
              
              if (!videoInfo) return; // Пропускаем если видео не в текущем списке

              if (cache.found && cache.data) {
                rawMetricsMap.set(videoKey, {
                  found: cache.found,
                  data: cache.data,
                  error: cache.error,
                  videoName: cache.video_title,
                  article: cache.article,
                  creativeId: cache.creative_id,
                  videoIndex: cache.video_index
                });
                cacheHits++;
              }
            });

            console.log(`📊 Батчевый кэш: загружено ${cacheHits} из ${videosToLoad.length} видео`);

            // Определяем какие видео нужно загрузить из API
            videosToLoad.forEach(video => {
              if (!rawMetricsMap.has(video.videoKey)) {
                videosToLoadFromApi.push(video);
              }
            });

            console.log(`🔄 Нужно загрузить из API: ${videosToLoadFromApi.length} видео`);

            // Если все найдено в кэше - возвращаемся
            if (videosToLoadFromApi.length === 0) {
              setRawBatchMetrics(rawMetricsMap);
              setLastUpdated(new Date());
              console.log(`✅ Все ${cacheHits} метрик загружены из кэша`);
              setLoading(false);
              return;
            }
          } else {
            // Кэш пуст - загружаем все из API
            videosToLoadFromApi.push(...videosToLoad);
            console.log('⚠️ Батчевый кэш пуст, загружаем все из API...');
          }
          
        } catch (cacheError) {
          console.error('❌ Ошибка батчевой загрузки из кэша:', cacheError);
          
          // Если НЕ форсированное обновление - возвращаем пустой результат, не загружаем из API
          if (!forceRefresh) {
            console.log('⚠️ Ошибка кэша без форсированного обновления - возвращаем пустой результат');
            setRawBatchMetrics(new Map());
            setFilteredBatchMetrics(new Map());
            setStats({ total: 0, found: 0, notFound: 0 });
            setError('Ошибка загрузки кэша метрик. Нажмите "Обновить" для загрузки из API.');
            setLoading(false);
            return;
          }
          
          // При форсированном обновлении - загружаем все из API
          console.log('⚠️ Ошибка кэша при форсированном обновлении - загружаем из API...');
          videosToLoadFromApi.push(...videosToLoad);
        }
      } else {
        console.log('🔄 Форсированное обновление из API...');
        videosToLoadFromApi.push(...videosToLoad);
      }

      // БАТЧЕВАЯ ЗАГРУЗКА с сохранением в кэш (только для видео которых нет в кэше)
      const BATCH_SIZE = 3;
      const BATCH_DELAY = 500;
      
      let successCount = cacheHits; // Начинаем с количества из кэша
      
      for (let i = 0; i < videosToLoadFromApi.length; i += BATCH_SIZE) {
        if (loadingCancelRef.current) {
          console.log('⚠️ Загрузка отменена');
          break;
        }
        
        const batch = videosToLoadFromApi.slice(i, i + BATCH_SIZE);
        console.log(`🔄 Батч ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(videosToLoadFromApi.length / BATCH_SIZE)}: ${batch.length} видео`);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (video) => {
            try {
              // ✅ ИСПРАВЛЕНО: Передаем creativeId и videoIndex для сохранения в кэш
              const result = await MetricsService.getVideoMetricsRaw(
                video.videoTitle,
                true, // useCache
                video.creativeId, // ✅ Передаем creativeId
                video.videoIndex, // ✅ Передаем videoIndex
                video.article     // ✅ Передаем article
              );
              
              return {
                ...video,
                ...result
              };
            } catch (error) {
              return {
                ...video,
                found: false,
                error: error.message
              };
            }
          })
        );
        
        // Обрабатываем результаты батча
        batchResults.forEach((result, batchIndex) => {
          const video = batch[batchIndex];
          const resultData = result.status === 'fulfilled' ? result.value : {
            found: false,
            error: 'Неизвестная ошибка'
          };
          
          rawMetricsMap.set(video.videoKey, {
            found: resultData.found,
            data: resultData.data,
            error: resultData.error,
            videoName: video.videoTitle,
            creativeId: video.creativeId,
            videoIndex: video.videoIndex
          });

          if (resultData.found) {
            successCount++;
          }
        });
        
        // Задержка между батчами
        if (i + BATCH_SIZE < videosToLoadFromApi.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }

      setRawBatchMetrics(rawMetricsMap);
      
      // ⚡ БАТЧЕВОЕ сохранение в кэш (только новых метрик из API)
      const newMetricsCount = successCount - cacheHits;
      if (newMetricsCount > 0 && forceRefresh) {
        console.log(`💾 Подготовка к батчевому сохранению ${successCount} метрик...`);
        
        const metricsToSave = [];
        rawMetricsMap.forEach((metrics, videoKey) => {
          if (metrics.found && metrics.data) {
            const [creativeId, videoIndex] = videoKey.split('_');
            const video = videosToLoad.find(v => v.videoKey === videoKey);
            if (video) {
              metricsToSave.push({
                creativeId: video.creativeId,
                article: video.article,
                videoIndex: parseInt(videoIndex),
                videoTitle: metrics.videoName,
                metricsData: metrics.data,
                period: 'all'
              });
            }
          }
        });

        if (metricsToSave.length > 0) {
          await metricsAnalyticsService.saveBatchMetricsCache(metricsToSave);
        }
      }
      
      // Сохраняем время последнего обновления
      await metricsAnalyticsService.updateMetricsLastUpdate();
      setLastUpdated(new Date());
      
      console.log(`✅ Загрузка завершена: ${cacheHits} из кэша + ${successCount - cacheHits} из API = ${successCount}/${videosToLoad.length} метрик`);

    } catch (err) {
      console.error('❌ Ошибка загрузки:', err);
      setError('Ошибка загрузки: ' + err.message);
      setRawBatchMetrics(new Map());
      setFilteredBatchMetrics(new Map());
    } finally {
      setLoading(false);
      loadingCancelRef.current = false;
    }
  }, [creatives]);

  // Мгновенная фильтрация
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

    for (const [videoKey, rawMetric] of rawMetrics) {
      totalCount++;
      
      if (!rawMetric.found || !rawMetric.data) {
        filteredMap.set(videoKey, {
          ...rawMetric,
          period: targetPeriod
        });
        continue;
      }

      // КРИТИЧНО: Если период 'all' И данные из кэша, пропускаем фильтрацию
      const isFromCache = rawMetric.data?.fromCache || rawMetric.fromCache;
      if (targetPeriod === 'all' && isFromCache) {
        console.log(`✅ Пропускаем фильтрацию для ${videoKey} - данные из кэша для периода "all"`);
        filteredMap.set(videoKey, {
          found: true,
          data: rawMetric.data,
          error: null,
          videoName: rawMetric.videoName,
          period: targetPeriod,
          creativeId: rawMetric.creativeId,
          videoIndex: rawMetric.videoIndex
        });
        successCount++;
        continue;
      }

      try {
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

    console.log(`✅ Клиентская фильтрация завершена: ${successCount}/${totalCount}`);
  }, []);

  useEffect(() => {
    if (autoLoad && creatives) {
      loadRawBatchMetrics();
    }
    
    return () => {
      loadingCancelRef.current = true;
    };
  }, [creatives, autoLoad, loadRawBatchMetrics]);

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
    console.log('🔄 Принудительное обновление...');
    loadingCancelRef.current = true;
    await new Promise(resolve => setTimeout(resolve, 100));
    await loadRawBatchMetrics(true);
  }, [loadRawBatchMetrics]);

  return {
    batchMetrics: filteredBatchMetrics,
    rawBatchMetrics,
    loading,
    error,
    stats,
    lastUpdated,
    refresh,
    loadFromCache: () => loadRawBatchMetrics(false),
    getVideoMetrics,
    getCreativeMetrics,
    hasVideoMetrics,
    getSuccessRate,
    currentPeriod: period
  };
}

/**
 * Хук для работы с API метрик
 */
export function useMetricsApi() {
  const [apiStatus, setApiStatus] = useState('unknown');
  const [checking, setChecking] = useState(false);
  const lastCheck = useRef(null);

  const checkApiStatus = useCallback(async (force = false) => {
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
