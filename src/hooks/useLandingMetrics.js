// src/hooks/useLandingMetrics.js
// Хук для работы с метриками лендингов

import { useState, useCallback, useRef } from 'react';
import { LandingMetricsService } from '../services/landingMetricsService';
import { landingMetricsService } from '../supabaseClient';

export function useLandingMetrics(landings, autoLoad = false, period = 'all') {
  const [landingMetrics, setLandingMetrics] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stats, setStats] = useState({ total: 0, found: 0, notFound: 0 });
  const loadingCancelRef = useRef(false);

  /**
   * Загрузка метрик для всех лендингов
   */
  const loadLandingMetrics = useCallback(async (forceRefresh = false) => {
    if (!landings || landings.length === 0) {
      setLandingMetrics(new Map());
      setStats({ total: 0, found: 0, notFound: 0 });
      return;
    }

    setLoading(true);
    setError('');
    loadingCancelRef.current = false;

    try {
      console.log(`🚀 Загрузка метрик для ${landings.length} лендингов...`);

      const landingUuids = landings.map(l => l.id);
      const metricsMap = new Map();

      // Шаг 1: Проверяем кэш (если не форсированное обновление)
      if (!forceRefresh) {
        console.log('📦 Проверка кэша метрик лендингов...');
        
        try {
          const cachedData = await landingMetricsService.getBatchLandingMetricsCache(
            landingUuids,
            period
          );

          if (cachedData && cachedData.length > 0) {
            console.log(`📦 Найдено в кэше: ${cachedData.length} метрик`);

            cachedData.forEach(cache => {
              if (!cache) return;

              const key = `${cache.landing_id}_${cache.source}`;
              metricsMap.set(key, cache);
            });

            // Если все в кэше - возвращаем
            const cachedCount = metricsMap.size;
            const expectedCount = landingUuids.length; // Примерно

            if (cachedCount > 0) {
              console.log(`✅ Используем ${cachedCount} метрик из кэша`);
              setLandingMetrics(metricsMap);
              setLastUpdated(new Date());
              setLoading(false);

              const foundCount = Array.from(metricsMap.values()).filter(m => m.found).length;
              setStats({
                total: cachedCount,
                found: foundCount,
                notFound: cachedCount - foundCount
              });

              return;
            }
          }
        } catch (cacheError) {
          console.error('❌ Ошибка чтения кэша:', cacheError);

          if (!forceRefresh) {
            setError(`Ошибка кэша: ${cacheError.message}. Нажмите "Обновить" для загрузки.`);
            setLoading(false);
            return;
          }
        }
      }

      // Шаг 2: Загружаем из API
      console.log('🌐 Загрузка метрик из API через landing-metrics-proxy...');

      const batchResult = await LandingMetricsService.getBatchLandingMetrics(landingUuids);

      if (!batchResult.success || !batchResult.results) {
        throw new Error(batchResult.error || 'Не удалось загрузить метрики');
      }

      console.log(`✅ Получено ${batchResult.results.length} результатов из API`);
      console.log('📊 Пример результата:', batchResult.results[0]);

      // Обрабатываем результаты
      batchResult.results.forEach(result => {
        const { uuid, source, adv_id, found, daily } = result;

        console.log(`🔍 Обработка: uuid=${uuid}, source=${source}, adv_id=${adv_id}, found=${found}, daily=${daily?.length || 0}`);

        const key = `${uuid}_${source}`;

        if (found && daily && daily.length > 0) {
          // Вычисляем метрики
          const allDailyData = daily.map(d => ({
            date: d.date,
            leads: Number(d.leads) || 0,
            cost: Number(d.cost) || 0,
            clicks: Number(d.clicks) || 0,
            impressions: Number(d.impressions) || 0,
            avg_duration: Number(d.avg_duration) || 0,
            cost_from_sources: Number(d.cost_from_sources) || 0,
            clicks_on_link: Number(d.clicks_on_link) || 0
          }));

          console.log(`📊 Агрегирование ${allDailyData.length} дневных записей для ${uuid}_${source}`);

          const aggregates = LandingMetricsService.aggregateDailyData(allDailyData);
          const metrics = LandingMetricsService.computeDerivedMetrics(aggregates);
          const formatted = LandingMetricsService.formatMetrics(metrics);

          console.log(`✅ Метрики для ${uuid}_${source}:`, { leads: metrics.leads, cost: metrics.cost });

          metricsMap.set(key, {
            landing_id: uuid,
            source: source,
            adv_id: adv_id,
            found: true,
            data: {
              raw: metrics,
              formatted: formatted,
              allDailyData: allDailyData,
              dailyData: allDailyData,
              period: period,
              updatedAt: new Date().toISOString()
            },
            error: null,
            fromCache: false
          });
        } else {
          console.log(`⚠️ Нет данных для ${uuid}_${source}`);
          metricsMap.set(key, {
            landing_id: uuid,
            source: source,
            adv_id: adv_id,
            found: false,
            data: null,
            error: 'Нет данных',
            fromCache: false
          });
        }
      });

      // Шаг 3: Сохраняем в кэш
      const metricsToSave = [];

      metricsMap.forEach((metric) => {
        const landing = landings.find(l => l.id === metric.landing_id);
        if (!landing) return;

        if (metric.found && metric.data) {
          metricsToSave.push({
            landingId: metric.landing_id,
            article: landing.article,
            source: metric.source,
            advId: metric.adv_id,
            period: period,
            metricsData: metric.data,
            hasData: true
          });
        } else {
          metricsToSave.push({
            landingId: metric.landing_id,
            article: landing.article,
            source: metric.source,
            advId: metric.adv_id,
            period: period,
            metricsData: null,
            hasData: false
          });
        }
      });

      if (metricsToSave.length > 0) {
        console.log(`💾 Сохранение ${metricsToSave.length} метрик в кэш...`);
        await landingMetricsService.saveBatchLandingMetrics(metricsToSave);
      }

      // Обновляем время последнего обновления
      await landingMetricsService.updateLandingMetricsLastUpdate();
      setLastUpdated(new Date());

      setLandingMetrics(metricsMap);

      const foundCount = Array.from(metricsMap.values()).filter(m => m.found).length;
      setStats({
        total: metricsMap.size,
        found: foundCount,
        notFound: metricsMap.size - foundCount
      });

      console.log(`✅ Метрики загружены: ${foundCount}/${metricsMap.size}`);

    } catch (err) {
      console.error('❌ Ошибка загрузки метрик лендингов:', err);
      setError('Ошибка загрузки: ' + err.message);
      setLandingMetrics(new Map());
    } finally {
      setLoading(false);
      loadingCancelRef.current = false;
    }
  }, [landings, period]);

  /**
   * Получить метрики для конкретного лендинга и источника
   */
  const getLandingMetrics = useCallback((landingId, source) => {
    const key = `${landingId}_${source}`;
    return landingMetrics.get(key) || null;
  }, [landingMetrics]);

  /**
   * Получить все метрики для лендинга (все источники)
   */
  const getAllLandingMetrics = useCallback((landingId) => {
    const metrics = [];

    for (const [key, metric] of landingMetrics) {
      if (key.startsWith(`${landingId}_`)) {
        metrics.push(metric);
      }
    }

    return metrics;
  }, [landingMetrics]);

  /**
   * Проверить наличие метрик
   */
  const hasMetrics = useCallback((landingId) => {
    const metrics = getAllLandingMetrics(landingId);
    return metrics.some(m => m.found);
  }, [getAllLandingMetrics]);

  /**
   * Обновить метрики
   */
  const refresh = useCallback(async () => {
    console.log('🔄 Принудительное обновление метрик лендингов...');
    loadingCancelRef.current = true;
    await new Promise(resolve => setTimeout(resolve, 100));
    await loadLandingMetrics(true);
  }, [loadLandingMetrics]);

  return {
    landingMetrics,
    loading,
    error,
    stats,
    lastUpdated,
    refresh,
    getLandingMetrics,
    getAllLandingMetrics,
    hasMetrics
  };
}

export default useLandingMetrics;
