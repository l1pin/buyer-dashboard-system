// src/hooks/useMetrics.js - БАТЧЕВАЯ ВЕРСИЯ
// Использует новый оптимизированный API с минимумом HTTP-запросов

import { useState, useEffect, useCallback, useRef } from 'react';
import { MetricsService } from '../services/metricsService';
import { metricsAnalyticsService } from '../supabaseClient';

/**
 * Хук для батчевой загрузки метрик (оптимизированный)
 */
export function useBatchMetrics(creatives, autoLoad = false, period = 'all') {
  const [rawBatchMetrics, setRawBatchMetrics] = useState(new Map());
  const [filteredBatchMetrics, setFilteredBatchMetrics] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stats, setStats] = useState({ total: 0, found: 0, notFound: 0 });
  const loadingCancelRef = useRef(false);

  /**
   * ОПТИМИЗИРОВАННАЯ батчевая загрузка - ОДИН запрос для всех видео
   */
  const loadRawBatchMetrics = useCallback(async (forceRefresh = false, targetPeriod = null) => {
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
      console.log(`🚀 БАТЧЕВАЯ загрузка метрик для ${creatives.length} креативов...`);

      // Собираем все видео с метаданными
      const videosToLoad = [];
      const videoMap = new Map(); // videoKey -> metadata

      creatives.forEach(creative => {
        if (creative.link_titles && creative.link_titles.length > 0) {
          creative.link_titles.forEach((videoTitle, videoIndex) => {
            if (videoTitle && !videoTitle.startsWith('Видео ')) {
              const videoKey = `${creative.id}_${videoIndex}`;
              videosToLoad.push(videoTitle);
              videoMap.set(videoKey, {
                videoTitle,
                creativeId: creative.id,
                article: creative.article,
                videoIndex
              });
            }
          });
        }
      });

      if (videosToLoad.length === 0) {
        setError('Нет доступных названий видео');
        setRawBatchMetrics(new Map());
        setFilteredBatchMetrics(new Map());
        setStats({ total: 0, found: 0, notFound: 0 });
        return;
      }

      console.log(`📊 Всего видео для загрузки: ${videosToLoad.length}`);

      // Шаг 1: Проверяем кэш Supabase для периода "all"
      const rawMetricsMap = new Map();
      const videosToLoadFromApi = [];
      
      if (!forceRefresh) {
        console.log(`📦 Проверка кэша Supabase для периода "all"...`);
        const creativeIds = creatives.map(c => c.id);
        
        try {
          const cachedData = await metricsAnalyticsService.getBatchMetricsCache(creativeIds, 'all');
          
          if (cachedData && cachedData.length > 0) {
            console.log(`📦 Найдено в кэше: ${cachedData.length} записей`);
            
            cachedData.forEach(cache => {
              if (cache && cache.found && cache.data) {
                const videoKey = `${cache.creative_id}_${cache.video_index}`;
                rawMetricsMap.set(videoKey, {
                  found: true,
                  data: cache.data,
                  error: null,
                  videoName: cache.video_title,
                  creativeId: cache.creative_id,
                  videoIndex: cache.video_index,
                  fromCache: true
                });
              }
            });

            // Определяем какие видео НЕ нашлись в кэше
            videoMap.forEach((metadata, videoKey) => {
              if (!rawMetricsMap.has(videoKey)) {
                videosToLoadFromApi.push(metadata.videoTitle);
              }
            });

            console.log(`✅ Из кэша: ${rawMetricsMap.size}, нужно загрузить из API: ${videosToLoadFromApi.length}`);

            // Если всё в кэше - возвращаемся
            if (videosToLoadFromApi.length === 0) {
              setRawBatchMetrics(rawMetricsMap);
              setLastUpdated(new Date());
              console.log(`✅ Все ${rawMetricsMap.size} метрик из кэша`);
              setLoading(false);
              return;
            }
          } else {
            console.log('⚠️ Кэш пуст, загружаем все из API');
            videosToLoadFromApi.push(...videosToLoad);
          }
          
        } catch (cacheError) {
          console.error('❌ Ошибка чтения кэша:', cacheError);
          
          if (!forceRefresh) {
            console.log('⚠️ Автозагрузка: возвращаем пустой результат при ошибке кэша');
            setRawBatchMetrics(new Map());
            setFilteredBatchMetrics(new Map());
            setStats({ total: 0, found: 0, notFound: 0 });
            setError(`Ошибка кэша: ${cacheError.message}. Нажмите "Обновить" для загрузки.`);
            setLoading(false);
            return;
          }
          
          videosToLoadFromApi.push(...videosToLoad);
        }
      } else {
        console.log('🔄 Форсированное обновление - загружаем ВСЕ из API');
        videosToLoadFromApi.push(...videosToLoad);
      }

      // КРИТИЧНО: Если не форсированное обновление и есть видео без кэша - НЕ загружаем
      if (!forceRefresh && videosToLoadFromApi.length > 0) {
        console.log(`⚠️ Автозагрузка: ${videosToLoadFromApi.length} видео без кэша - НЕ загружаем`);
        console.log(`✅ Возвращаем только ${rawMetricsMap.size} метрик из кэша`);
        
        setRawBatchMetrics(rawMetricsMap);
        setLastUpdated(new Date());
        setLoading(false);
        
        if (rawMetricsMap.size === 0) {
          setError(`Кэш пуст. Нажмите "Обновить" для загрузки метрик.`);
        } else {
          setError(`Загружено ${rawMetricsMap.size} метрик из кэша. Нажмите "Обновить" для загрузки остальных.`);
        }
        
        return;
      }

      // Шаг 2: ОДИН БАТЧЕВЫЙ ЗАПРОС для всех видео без кэша
      if (videosToLoadFromApi.length > 0) {
        console.log(`🌐 Батчевая загрузка ${videosToLoadFromApi.length} видео из API...`);
        
        const batchResult = await MetricsService.getBatchVideoMetrics(videosToLoadFromApi, {
          kind: 'daily_first4_total',
          useCache: true
        });

        if (batchResult.success && batchResult.results) {
          console.log(`✅ Батчевый запрос выполнен: ${batchResult.results.length} результатов`);
          
          // Обрабатываем результаты и добавляем в Map
          batchResult.results.forEach(videoResult => {
            // Находим все videoKey для этого videoName
            videoMap.forEach((metadata, videoKey) => {
              if (metadata.videoTitle === videoResult.videoName) {
                if (videoResult.found && videoResult.daily && videoResult.daily.length > 0) {
                  // Преобразуем к формату rawMetrics
                  const allDailyData = videoResult.daily.map(d => ({
                    date: d.date,
                    leads: d.leads,
                    cost: d.cost,
                    clicks: d.clicks,
                    impressions: d.impressions,
                    avg_duration: d.avg_duration
                  }));

                  const aggregates = MetricsService.aggregateDailyData(allDailyData);
                  const metrics = MetricsService.computeDerivedMetrics(aggregates);
                  const formatted = MetricsService.formatMetrics(metrics);

                  rawMetricsMap.set(videoKey, {
                    found: true,
                    data: {
                      raw: metrics,
                      formatted: formatted,
                      allDailyData: allDailyData,
                      dailyData: allDailyData,
                      videoName: metadata.videoTitle,
                      period: 'all',
                      updatedAt: new Date().toISOString()
                    },
                    error: null,
                    videoName: metadata.videoTitle,
                    creativeId: metadata.creativeId,
                    videoIndex: metadata.videoIndex,
                    fromCache: false
                  });
                } else {
                  rawMetricsMap.set(videoKey, {
                    found: false,
                    data: null,
                    error: 'Нет данных',
                    videoName: metadata.videoTitle,
                    creativeId: metadata.creativeId,
                    videoIndex: metadata.videoIndex
                  });
                }
              }
            });
          });
        } else {
          console.error('❌ Ошибка батчевого запроса:', batchResult.error);
          setError(`Ошибка API: ${batchResult.error}`);
        }
      }

      setRawBatchMetrics(rawMetricsMap);

      // Шаг 3: БАТЧЕВОЕ сохранение в кэш Supabase (период "all" и "4days")
      const newMetrics = Array.from(rawMetricsMap.values()).filter(m => 
        m.found && !m.fromCache && m.data
      );

      if (newMetrics.length > 0) {
        console.log(`💾 Батчевое сохранение ${newMetrics.length} метрик в кэш...`);
        
        // Сохраняем период "all"
        const metricsToSaveAll = newMetrics.map(m => ({
          creativeId: m.creativeId,
          article: videoMap.get(`${m.creativeId}_${m.videoIndex}`)?.article || m.videoName,
          videoIndex: m.videoIndex,
          videoTitle: m.videoName,
          metricsData: m.data,
          period: 'all'
        }));

        await metricsAnalyticsService.saveBatchMetricsCache(metricsToSaveAll);
        console.log(`✅ Период "all" сохранен: ${metricsToSaveAll.length} метрик`);

        // КРИТИЧНО: Сохраняем период "4days"
        const metricsToSave4Days = [];
        
        newMetrics.forEach(m => {
          const allDailyData = m.data.allDailyData || m.data.dailyData || [];
          
          if (allDailyData.length > 0) {
            // Берем первые 4 дня
            const first4Days = allDailyData.slice(0, Math.min(4, allDailyData.length));
            
            // Агрегируем данные за первые 4 дня
            const aggregated = {
              leads: 0,
              cost: 0,
              clicks: 0,
              impressions: 0,
              duration_sum: 0,
              days_count: 0
            };
            
            first4Days.forEach(day => {
              aggregated.leads += day.leads || 0;
              aggregated.cost += day.cost || 0;
              aggregated.clicks += day.clicks || 0;
              aggregated.impressions += day.impressions || 0;
              aggregated.duration_sum += day.avg_duration || 0;
              aggregated.days_count += 1;
            });
            
            // Вычисляем производные метрики
            const avg_duration = aggregated.days_count > 0 ? aggregated.duration_sum / aggregated.days_count : 0;
            const cpl = aggregated.leads > 0 ? aggregated.cost / aggregated.leads : 0;
            const ctr_percent = aggregated.impressions > 0 ? (aggregated.clicks / aggregated.impressions) * 100 : 0;
            const cpc = aggregated.clicks > 0 ? aggregated.cost / aggregated.clicks : 0;
            const cpm = aggregated.impressions > 0 ? (aggregated.cost / aggregated.impressions) * 1000 : 0;
            
            const raw = {
              leads: aggregated.leads,
              cost: Number(aggregated.cost.toFixed(2)),
              clicks: aggregated.clicks,
              impressions: aggregated.impressions,
              avg_duration: Number(avg_duration.toFixed(2)),
              days_count: aggregated.days_count,
              cpl: Number(cpl.toFixed(2)),
              ctr_percent: Number(ctr_percent.toFixed(2)),
              cpc: Number(cpc.toFixed(2)),
              cpm: Number(cpm.toFixed(2))
            };
            
            const formatted = {
              leads: String(Math.round(raw.leads)),
              cpl: raw.cpl.toFixed(2) + '$',
              cost: raw.cost.toFixed(2) + '$',
              ctr: raw.ctr_percent.toFixed(2) + '%',
              cpc: raw.cpc.toFixed(2) + '$',
              cpm: raw.cpm.toFixed(2) + '$',
              clicks: String(Math.round(raw.clicks)),
              impressions: String(Math.round(raw.impressions)),
              avg_duration: raw.avg_duration.toFixed(1) + 'с',
              days: String(raw.days_count) + ' дн.'
            };
            
            const data4Days = {
              raw: raw,
              formatted: formatted,
              allDailyData: first4Days,
              dailyData: first4Days,
              videoName: m.videoName,
              period: '4days',
              updatedAt: m.data.updatedAt
            };
            
            metricsToSave4Days.push({
              creativeId: m.creativeId,
              article: videoMap.get(`${m.creativeId}_${m.videoIndex}`)?.article || m.videoName,
              videoIndex: m.videoIndex,
              videoTitle: m.videoName,
              metricsData: data4Days,
              period: '4days'
            });
          }
        });
        
        if (metricsToSave4Days.length > 0) {
          await metricsAnalyticsService.saveBatchMetricsCache(metricsToSave4Days);
          console.log(`✅ Период "4days" сохранен: ${metricsToSave4Days.length} метрик`);
        }
      }

      // Обновляем время последнего обновления
      await metricsAnalyticsService.updateMetricsLastUpdate();
      setLastUpdated(new Date());
      
      const successCount = Array.from(rawMetricsMap.values()).filter(m => m.found).length;
      console.log(`✅ Загрузка завершена: ${successCount}/${videosToLoad.length} метрик`);

    } catch (err) {
      console.error('❌ Критическая ошибка загрузки:', err);
      setError('Ошибка загрузки: ' + err.message);
      setRawBatchMetrics(new Map());
      setFilteredBatchMetrics(new Map());
    } finally {
      setLoading(false);
      loadingCancelRef.current = false;
    }
  }, [creatives]);

  /**
   * Мгновенная фильтрация на клиенте при смене периода
   */
  const loadForPeriod = useCallback(async (targetPeriod) => {
    if (!rawBatchMetrics || rawBatchMetrics.size === 0) {
      console.log('⚠️ Нет сырых данных для смены периода');
      setFilteredBatchMetrics(new Map());
      setStats({ total: 0, found: 0, notFound: 0 });
      return;
    }

    console.log(`⚡ МГНОВЕННАЯ фильтрация на клиенте: период "${targetPeriod}"`);

    // Попытка загрузить из кэша Supabase для нового периода
    if (targetPeriod === '4days') {
      const creativeIds = [...new Set(
        Array.from(rawBatchMetrics.keys()).map(key => key.split('_')[0])
      )];

      try {
        console.log(`📦 Проверка кэша для периода "4days"...`);
        const cachedData = await metricsAnalyticsService.getBatchMetricsCache(creativeIds, '4days');

        if (cachedData && cachedData.length > 0) {
          console.log(`✅ Найдено в кэше ${cachedData.length} записей для "4days"`);
          
          const cachedMap = new Map();
          
          cachedData.forEach(cache => {
            if (cache && cache.found && cache.data) {
              const videoKey = `${cache.creative_id}_${cache.video_index}`;
              cachedMap.set(videoKey, {
                found: true,
                data: cache.data,
                error: null,
                videoName: cache.video_title,
                period: '4days',
                creativeId: cache.creative_id,
                videoIndex: cache.video_index,
                fromCache: true
              });
            }
          });

          // Если все данные из кэша - используем их
          if (cachedMap.size === rawBatchMetrics.size) {
            console.log(`✅ ВСЕ метрики загружены из кэша для "4days"`);
            setFilteredBatchMetrics(cachedMap);
            setStats({
              total: cachedMap.size,
              found: cachedMap.size,
              notFound: 0
            });
            return;
          }

          // Дополняем недостающие через фильтрацию
          console.log(`⚡ ${cachedMap.size} из кэша, остальные через фильтрацию...`);
          
          for (const [videoKey, rawMetric] of rawBatchMetrics) {
            if (cachedMap.has(videoKey)) continue;

            if (!rawMetric.found || !rawMetric.data) {
              cachedMap.set(videoKey, {
                ...rawMetric,
                period: targetPeriod
              });
              continue;
            }

            const filtered = MetricsService.filterRawMetricsByPeriod(rawMetric, targetPeriod);
            cachedMap.set(videoKey, {
              found: filtered.found,
              data: filtered.data,
              error: filtered.error,
              videoName: rawMetric.videoName,
              period: targetPeriod,
              creativeId: rawMetric.creativeId,
              videoIndex: rawMetric.videoIndex
            });
          }

          setFilteredBatchMetrics(cachedMap);
          const successCount = Array.from(cachedMap.values()).filter(m => m.found).length;
          setStats({
            total: cachedMap.size,
            found: successCount,
            notFound: cachedMap.size - successCount
          });

          console.log(`✅ Комбинированная загрузка: ${cachedMap.size} метрик`);
          return;
        }
      } catch (cacheError) {
        console.warn('⚠️ Ошибка кэша, используем фильтрацию:', cacheError);
      }
    }

    // Клиентская фильтрация для всех метрик
    const filteredMap = new Map();
    let successCount = 0;
    let totalCount = 0;

    for (const [videoKey, rawMetric] of rawBatchMetrics) {
      totalCount++;
      
      if (!rawMetric.found || !rawMetric.data) {
        filteredMap.set(videoKey, {
          ...rawMetric,
          period: targetPeriod
        });
        continue;
      }

      const filtered = MetricsService.filterRawMetricsByPeriod(rawMetric, targetPeriod);
      
      if (filtered.found) {
        filteredMap.set(videoKey, {
          found: true,
          data: filtered.data,
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
          error: filtered.error || `Нет данных за период: ${targetPeriod}`,
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
  }, [rawBatchMetrics]);

  // Автозагрузка
  useEffect(() => {
    if (autoLoad && creatives) {
      loadRawBatchMetrics();
    }
    
    return () => {
      loadingCancelRef.current = true;
    };
  }, [creatives, autoLoad, loadRawBatchMetrics]);

  // Фильтрация при смене периода
  useEffect(() => {
    if (rawBatchMetrics.size > 0) {
      loadForPeriod(period);
    } else {
      setFilteredBatchMetrics(new Map());
      setStats({ total: 0, found: 0, notFound: 0 });
    }
  }, [rawBatchMetrics, period, loadForPeriod]);

  const getVideoMetrics = useCallback((creativeId, videoIndex) => {
    const videoKey = `${creativeId}_${videoIndex}`;
    return filteredBatchMetrics.get(videoKey) || null;
  }, [filteredBatchMetrics]);

  const getCreativeMetrics = useCallback((creativeId) => {
    const creativeMetrics = [];
    
    for (const [videoKey, metrics] of filteredBatchMetrics) {
      if (videoKey.startsWith(`${creativeId}_`)) {
        const videoIndex = parseInt(videoKey.split('_').pop());
        
        if (!isNaN(videoIndex)) {
          creativeMetrics.push({
            videoIndex,
            ...metrics
          });
        }
      }
    }
    
    creativeMetrics.sort((a, b) => a.videoIndex - b.videoIndex);
    
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
    await loadRawBatchMetrics(true, period);
  }, [loadRawBatchMetrics, period]);

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
 * Остальные хуки без изменений
 */
export function useVideoMetrics(videoTitle, autoLoad = true, period = 'all', creativeId = null, videoIndex = null) {
  const [rawMetrics, setRawMetrics] = useState(null);
  const [filteredMetrics, setFilteredMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadRawMetrics = useCallback(async () => {
    if (!videoTitle || videoTitle.startsWith('Видео ')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log(`🔍 Загружаем метрики для: ${videoTitle}`);
      
      const result = await MetricsService.getVideoMetricsRaw(
        videoTitle,
        true,
        creativeId,
        videoIndex,
        null
      );
      
      if (result.found) {
        setRawMetrics(result);
        setLastUpdated(new Date());
        setError('');
        console.log(`✅ Метрики загружены для: ${videoTitle}`);
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

  const applyFilter = useCallback((rawData, targetPeriod) => {
    if (!rawData || !rawData.found) {
      setFilteredMetrics(null);
      return;
    }

    console.log(`⚡ Фильтрация для ${videoTitle}: ${targetPeriod}`);
    
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
