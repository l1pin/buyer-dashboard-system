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
  const [loadingCreativeIds, setLoadingCreativeIds] = useState(new Set()); // 🆕 Креативы, для которых идет загрузка
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
        console.log('📋 Примеры названий для загрузки:', videosToLoadFromApi.slice(0, 5));
        
        const batchResult = await MetricsService.getBatchVideoMetrics(videosToLoadFromApi, {
          kind: 'daily_first4_total',
          useCache: true
        });

        console.log('🔍 ДИАГНОСТИКА batchResult:', {
          success: batchResult.success,
          resultsCount: batchResult.results?.length,
          resultsType: typeof batchResult.results,
          isArray: Array.isArray(batchResult.results),
          error: batchResult.error
        });

        if (batchResult.success && batchResult.results) {
          console.log(`✅ Батчевый запрос выполнен: ${batchResult.results.length} результатов`);
          
          // КРИТИЧНО: Логируем первые результаты
          console.log('📋 Первые 3 результата:');
          for (let i = 0; i < Math.min(3, batchResult.results.length); i++) {
            console.log(`  [${i}]:`, {
              videoName: batchResult.results[i].videoName,
              found: batchResult.results[i].found,
              dailyCount: batchResult.results[i].daily?.length,
              hasFirst4: !!batchResult.results[i].first4,
              hasTotal: !!batchResult.results[i].total
            });
          }
          
          // Обрабатываем результаты и добавляем в Map
          batchResult.results.forEach(videoResult => {
            // КРИТИЧНО: Проверяем точность совпадения названий
            const matchingKeys = [];
            
            videoMap.forEach((metadata, videoKey) => {
              // Точное совпадение
              if (metadata.videoTitle === videoResult.videoName) {
                matchingKeys.push(videoKey);
              }
            });
            
            if (matchingKeys.length === 0) {
              console.warn(`⚠️ Не найдено совпадений для видео "${videoResult.videoName}" в videoMap`);
              
              // Ищем похожие для диагностики
              const similar = [];
              videoMap.forEach((metadata, videoKey) => {
                if (metadata.videoTitle.toLowerCase().includes(videoResult.videoName.toLowerCase()) ||
                    videoResult.videoName.toLowerCase().includes(metadata.videoTitle.toLowerCase())) {
                  similar.push({ key: videoKey, title: metadata.videoTitle });
                }
              });
              
              if (similar.length > 0) {
                console.log(`  Похожие названия:`, similar);
              }
              
              return; // Пропускаем этот результат
            }
            
            console.log(`✅ Найдено ${matchingKeys.length} совпадений для "${videoResult.videoName}"`);
            
            // Обрабатываем все совпадения
            matchingKeys.forEach(videoKey => {
              const metadata = videoMap.get(videoKey);
              
              if (metadata.videoTitle === videoResult.videoName) {
                if (videoResult.found && videoResult.daily && videoResult.daily.length > 0) {
                  // Преобразуем к формату rawMetrics
                  const allDailyData = videoResult.daily.map(d => ({
                    date: d.date,
                    leads: d.leads,
                    cost: d.cost,
                    clicks: d.clicks,
                    impressions: d.impressions,
                    avg_duration: d.avg_duration,
                    cost_from_sources: d.cost_from_sources || 0,
                    clicks_on_link: d.clicks_on_link || 0
                  }));

                  // 🔥🔥🔥 КРИТИЧЕСКАЯ ДИАГНОСТИКА allDailyData
                  console.log('🔥🔥🔥 allDailyData ПЕРЕД aggregateDailyData (useMetrics.js строка ~310):', {
                    'length': allDailyData.length,
                    'первая запись': allDailyData[0],
                    'cost_from_sources первой записи': allDailyData[0]?.cost_from_sources,
                    'clicks_on_link первой записи': allDailyData[0]?.clicks_on_link,
                    'typeof cost_from_sources': typeof allDailyData[0]?.cost_from_sources,
                    'typeof clicks_on_link': typeof allDailyData[0]?.clicks_on_link
                  });

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
                    fromCache: false,
                    noData: false
                  });
                } else {
                  // КРИТИЧНО: Добавляем запись даже для видео без метрик
                  rawMetricsMap.set(videoKey, {
                    found: false,
                    data: null,
                    error: 'Нет данных',
                    videoName: metadata.videoTitle,
                    creativeId: metadata.creativeId,
                    videoIndex: metadata.videoIndex,
                    noData: true // Флаг отсутствия данных
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

      console.log('🔍 ФИНАЛЬНАЯ ДИАГНОСТИКА rawMetricsMap:');
      console.log(`  📦 Всего записей в Map: ${rawMetricsMap.size}`);
      console.log(`  ✅ С данными (found=true): ${Array.from(rawMetricsMap.values()).filter(m => m.found).length}`);
      console.log(`  ❌ Без данных (found=false): ${Array.from(rawMetricsMap.values()).filter(m => !m.found).length}`);
      
      // Примеры записей
      const entries = Array.from(rawMetricsMap.entries());
      if (entries.length > 0) {
        console.log('📋 Первые 3 записи в rawMetricsMap:');
        for (let i = 0; i < Math.min(3, entries.length); i++) {
          const [key, value] = entries[i];
          console.log(`  [${key}]:`, {
            found: value.found,
            videoName: value.videoName,
            hasData: !!value.data,
            leads: value.data?.raw?.leads
          });
        }
      }

      // 🆕 ШАГ 4: АДАПТИВНЫЙ LIKE поиск для видео без метрик (только при forceRefresh)
      console.log('🔥 ПРОВЕРКА: forceRefresh =', forceRefresh);
      
      if (forceRefresh) {
        console.log('🚀 ШАГ 4: Начинаем АДАПТИВНЫЙ LIKE поиск для видео без метрик');
        
        const videosWithoutMetrics = [];
        const videosWithoutMetricsMap = new Map();
        
        console.log('📊 Анализируем videoMap, размер:', videoMap.size);
        console.log('📊 Анализируем rawMetricsMap, размер:', rawMetricsMap.size);
        
        // 🎯 Группируем видео по креативам
        const creativeGroups = new Map(); // creativeId -> { hasMetrics: boolean, videos: [] }
        
        videoMap.forEach((metadata, videoKey) => {
          const creativeId = metadata.creativeId;
          
          if (!creativeGroups.has(creativeId)) {
            creativeGroups.set(creativeId, {
              hasMetrics: false,
              videos: []
            });
          }
          
          const group = creativeGroups.get(creativeId);
          const existingMetric = rawMetricsMap.get(videoKey);
          
          // Если хотя бы одно видео из креатива имеет метрики - помечаем креатив
          if (existingMetric && existingMetric.found && !existingMetric.noData) {
            group.hasMetrics = true;
          }
          
          group.videos.push({
            videoKey,
            videoTitle: metadata.videoTitle,
            metadata,
            hasMetrics: existingMetric && existingMetric.found && !existingMetric.noData
          });
        });
        
        console.log(`📦 Сгруппировано по креативам: ${creativeGroups.size} креативов`);
        
        // 🎯 Добавляем в LIKE поиск только видео из креативов БЕЗ метрик
        let creativesNeedingLike = 0;
        let creativesSkipped = 0;
        
        creativeGroups.forEach((group, creativeId) => {
          if (group.hasMetrics) {
            // Пропускаем креатив - хотя бы одно видео нашлось
            creativesSkipped++;
            console.log(`✅ Креатив ${creativeId}: ${group.videos.filter(v => v.hasMetrics).length}/${group.videos.length} видео найдено, LIKE не нужен`);
          } else {
            // Добавляем ВСЕ видео креатива в LIKE поиск
            creativesNeedingLike++;
            console.log(`❌ Креатив ${creativeId}: 0/${group.videos.length} видео найдено, добавляем в LIKE`);
            
            group.videos.forEach(video => {
              const videoTitle = video.videoTitle;
              const nameWithoutExt = videoTitle.replace(/\.(mp4|avi|mov|mkv|webm|m4v)$/i, '');
              
              videosWithoutMetrics.push(nameWithoutExt);
              videosWithoutMetricsMap.set(nameWithoutExt, {
                videoKey: video.videoKey,
                originalTitle: videoTitle,
                metadata: video.metadata
              });
            });
          }
        });
        
        console.log(`📊 ИТОГОВАЯ СТАТИСТИКА:`);
        console.log(`  ✅ Креативов с метриками (пропущено): ${creativesSkipped}`);
        console.log(`  ❌ Креативов БЕЗ метрик (LIKE поиск): ${creativesNeedingLike}`);
        console.log(`  📋 Видео для LIKE поиска: ${videosWithoutMetrics.length}`);
        
        console.log(`📋 ИТОГО для LIKE поиска: ${videosWithoutMetrics.length} видео`);
        
        if (videosWithoutMetrics.length > 0) {
          console.log('═══════════════════════════════════════════════');
          console.log('🔍 НАЧАЛО АДАПТИВНОГО LIKE ПОИСКА');
          console.log('═══════════════════════════════════════════════');
          console.log(`📊 Видео БЕЗ метрик: ${videosWithoutMetrics.length}`);
          
          try {
            // 🚀 АДАПТИВНАЯ СИСТЕМА БАТЧИНГА
            // Уровни агрессивности: 1 (агрессивный), 2 (сбалансированный), 3 (консервативный)
            const LEVELS = {
              1: { parallel: 3, batchSize: 25, timeout: 30000, delay: 0, name: 'Агрессивный' },
              2: { parallel: 2, batchSize: 20, timeout: 32000, delay: 150, name: 'Сбалансированный' },
              3: { parallel: 1, batchSize: 10, timeout: 35000, delay: 200, name: 'Консервативный' }
            };
            
            let currentLevel = 2; // Начинаем со сбалансированного уровня
            let errorRate = 0;
            let totalProcessed = 0;
            let totalErrors = 0;
            
            const allLikeResults = [];
            
            // Функция для обработки одного батча с повторами
            const processBatchWithRetry = async (batch, attempt = 1, maxAttempts = 3) => {
              const level = LEVELS[currentLevel];
              
              try {
                console.log(`📡 Попытка ${attempt}/${maxAttempts}: ${batch.length} видео (уровень: ${level.name})`);
                
                const likeBatchResult = await MetricsService.getBatchVideoMetrics(batch, {
                  kind: 'daily_first4_total',
                  useCache: false,
                  useLike: true
                });
                
                if (likeBatchResult.success && likeBatchResult.results) {
                  console.log(`✅ Батч успешно обработан: ${likeBatchResult.results.length} результатов`);
                  return { success: true, results: likeBatchResult.results };
                } else {
                  throw new Error(likeBatchResult.error || 'Нет результатов');
                }
                
              } catch (error) {
                console.error(`❌ Ошибка батча (попытка ${attempt}):`, error.message);
                
                // Если не последняя попытка и батч можно разделить
                if (attempt < maxAttempts && batch.length > 1) {
                  console.log(`🔄 Разбиваем батч пополам и повторяем...`);
                  
                  const mid = Math.ceil(batch.length / 2);
                  const batch1 = batch.slice(0, mid);
                  const batch2 = batch.slice(mid);
                  
                  // Обрабатываем половинки последовательно
                  const [result1, result2] = await Promise.allSettled([
                    processBatchWithRetry(batch1, attempt + 1, maxAttempts),
                    processBatchWithRetry(batch2, attempt + 1, maxAttempts)
                  ]);
                  
                  const combinedResults = [];
                  if (result1.status === 'fulfilled' && result1.value.success) {
                    combinedResults.push(...result1.value.results);
                  }
                  if (result2.status === 'fulfilled' && result2.value.success) {
                    combinedResults.push(...result2.value.results);
                  }
                  
                  return { success: true, results: combinedResults };
                }
                
                // Последняя попытка или батч из 1 видео
                return { success: false, error: error.message };
              }
            };
            
            // Разбиваем на батчи согласно текущему уровню
            const createBatches = (videos, batchSize) => {
              const batches = [];
              for (let i = 0; i < videos.length; i += batchSize) {
                batches.push(videos.slice(i, i + batchSize));
              }
              return batches;
            };
            
            let remainingVideos = [...videosWithoutMetrics];
            
            while (remainingVideos.length > 0) {
              const level = LEVELS[currentLevel];
              const batches = createBatches(remainingVideos, level.batchSize);
              
              console.log(`\n🎯 Уровень ${currentLevel} (${level.name}): ${level.parallel} параллельных × ${level.batchSize} видео`);
              console.log(`📦 Создано батчей: ${batches.length}, осталось видео: ${remainingVideos.length}`);
              
              // Обрабатываем батчи группами (по parallel штук параллельно)
              for (let i = 0; i < batches.length; i += level.parallel) {
                const batchGroup = batches.slice(i, i + level.parallel);
                console.log(`\n⚡ Параллельная группа ${Math.floor(i / level.parallel) + 1}: ${batchGroup.length} батчей`);
                
                const groupResults = await Promise.allSettled(
                  batchGroup.map(batch => processBatchWithRetry(batch))
                );
                
                // Собираем результаты
                groupResults.forEach((result, idx) => {
                  totalProcessed++;
                  
                  if (result.status === 'fulfilled' && result.value.success) {
                    allLikeResults.push(...result.value.results);
                    console.log(`✅ Батч ${i + idx + 1}: ${result.value.results.length} результатов`);
                  } else {
                    totalErrors++;
                    console.error(`❌ Батч ${i + idx + 1}: провал`);
                  }
                });
                
                // Пересчитываем error rate каждые 10 батчей
                if (totalProcessed > 0 && totalProcessed % 10 === 0) {
                  errorRate = totalErrors / totalProcessed;
                  console.log(`\n📊 Статистика: обработано ${totalProcessed}, ошибок ${totalErrors} (${(errorRate * 100).toFixed(1)}%)`);
                  
                  // Адаптация уровня
                  if (errorRate > 0.3 && currentLevel < 3) {
                    currentLevel++;
                    console.log(`⬇️ ДЕГРАДАЦИЯ до уровня ${currentLevel} (${LEVELS[currentLevel].name})`);
                  } else if (errorRate < 0.05 && currentLevel > 1) {
                    currentLevel--;
                    console.log(`⬆️ ПОВЫШЕНИЕ до уровня ${currentLevel} (${LEVELS[currentLevel].name})`);
                  }
                }
                
                // Задержка между группами батчей
                if (level.delay > 0 && i + level.parallel < batches.length) {
                  await new Promise(resolve => setTimeout(resolve, level.delay));
                }
              }
              
              // Удаляем обработанные видео
              const processedCount = batches.reduce((sum, b) => sum + b.length, 0);
              remainingVideos = remainingVideos.slice(processedCount);
            }
            
            console.log('═══════════════════════════════════════════════');
            console.log(`🎯 LIKE поиск завершен: всего найдено ${allLikeResults.length} результатов`);
            console.log('═══════════════════════════════════════════════');
            
            if (allLikeResults.length > 0) {
              console.log('═══════════════════════════════════════════════');
              console.log(`✅ Обработка ${allLikeResults.length} результатов LIKE поиска`);
              console.log('═══════════════════════════════════════════════');
              
              // Выводим ВСЕ найденные результаты
              console.log('📋 ВСЕ результаты LIKE поиска:');
              allLikeResults.forEach((result, idx) => {
                console.log(`  [${idx}]:`, {
                  videoName: result.videoName,
                  found: result.found,
                  dailyCount: result.daily?.length || 0
                });
              });
              
              // Обрабатываем результаты LIKE поиска
              let matchedCount = 0;
              let notMatchedCount = 0;
              
              allLikeResults.forEach((videoResult, resultIdx) => {
                console.log('─────────────────────────────────────────────');
                console.log(`🔍 Обработка результата [${resultIdx}]: "${videoResult.videoName}"`);
                console.log('  📊 Проверка данных:', {
                  found: videoResult.found,
                  hasDailyData: !!videoResult.daily,
                  dailyLength: videoResult.daily?.length || 0
                });
                
                if (!videoResult.found || !videoResult.daily || videoResult.daily.length === 0) {
                  console.log('  ⚠️ Пропускаем: нет данных');
                  notMatchedCount++;
                  return;
                }
                
                // Находим соответствующий videoKey по частичному совпадению
                let matchedVideoKey = null;
                let matchedMetadata = null;
                
                console.log('  🔎 Ищем совпадение среди', videosWithoutMetricsMap.size, 'названий без метрик...');
                
                for (const [nameWithoutExt, info] of videosWithoutMetricsMap.entries()) {
                  // Проверяем оба направления совпадения
                  const dbIncludesOurs = videoResult.videoName.includes(nameWithoutExt);
                  const oursIncludesDb = nameWithoutExt.includes(videoResult.videoName);
                  
                  console.log(`    🔍 Сравнение:`, {
                    nameWithoutExt: nameWithoutExt,
                    videoResultName: videoResult.videoName,
                    dbIncludesOurs: dbIncludesOurs,
                    oursIncludesDb: oursIncludesDb
                  });
                  
                  if (dbIncludesOurs || oursIncludesDb) {
                    matchedVideoKey = info.videoKey;
                    matchedMetadata = info.metadata;
                    console.log(`    ✅ НАЙДЕНО СОВПАДЕНИЕ!`);
                    console.log(`    📌 Оригинальное название: "${info.originalTitle}"`);
                    console.log(`    📌 Название из БД: "${videoResult.videoName}"`);
                    console.log(`    📌 videoKey: ${matchedVideoKey}`);
                    break;
                  }
                }
                
                if (!matchedVideoKey) {
                  console.log(`  ❌ НЕ НАЙДЕНО совпадение для: "${videoResult.videoName}"`);
                  console.log('  📋 Доступные названия для сопоставления:');
                  let counter = 0;
                  for (const [nameWithoutExt, info] of videosWithoutMetricsMap.entries()) {
                    console.log(`    [${counter++}]: "${nameWithoutExt}"`);
                    if (counter >= 5) {
                      console.log(`    ... и еще ${videosWithoutMetricsMap.size - counter} названий`);
                      break;
                    }
                  }
                  notMatchedCount++;
                  return;
                }
                
                console.log(`  🎯 Совпадение найдено! Обрабатываем метрики...`);
                matchedCount++;
                
                // Преобразуем к формату rawMetrics
const allDailyData = videoResult.daily.map(d => ({
              date: d.date,
              leads: d.leads,
              cost: d.cost,
              clicks: d.clicks,
              impressions: d.impressions,
              avg_duration: d.avg_duration,
              cost_from_sources: d.cost_from_sources || 0,
              clicks_on_link: d.clicks_on_link || 0
            }));

            const aggregates = MetricsService.aggregateDailyData(allDailyData);
                const metrics = MetricsService.computeDerivedMetrics(aggregates);
                const formatted = MetricsService.formatMetrics(metrics);

                // Обновляем rawMetricsMap найденными метриками
                rawMetricsMap.set(matchedVideoKey, {
                  found: true,
                  data: {
                    raw: metrics,
                    formatted: formatted,
                    allDailyData: allDailyData,
                    dailyData: allDailyData,
                    videoName: matchedMetadata.videoTitle,
                    period: 'all',
                    updatedAt: new Date().toISOString()
                  },
                  error: null,
                  videoName: matchedMetadata.videoTitle,
                  creativeId: matchedMetadata.creativeId,
                  videoIndex: matchedMetadata.videoIndex,
                  fromCache: false,
                  noData: false,
                  foundViaLike: true // 🏷️ Маркер LIKE поиска
                });
                
                console.log(`🎯 LIKE метрика добавлена для: ${matchedMetadata.videoTitle}`);
              });
              
              console.log('═══════════════════════════════════════════════');
              console.log('🎉 LIKE поиск завершен:');
              console.log(`  ✅ Совпадений найдено: ${matchedCount}`);
              console.log(`  ❌ Без совпадений: ${notMatchedCount}`);
              console.log(`  📦 Всего результатов: ${allLikeResults.length}`);
              console.log('═══════════════════════════════════════════════');
            } else {
              console.log('═══════════════════════════════════════════════');
              console.log('⚠️ LIKE поиск не дал результатов (все батчи пустые)');
              console.log('═══════════════════════════════════════════════');
            }
          } catch (likeError) {
            console.error('❌ Ошибка LIKE поиска:', likeError);
            // Не прерываем основной процесс
          }
        } else {
          console.log('✅ Все видео имеют метрики, LIKE поиск не требуется');
        }
      }

      setRawBatchMetrics(rawMetricsMap);

      // Шаг 3: БАТЧЕВОЕ сохранение в кэш Supabase (период "all" и "4days")
      // Сохраняем ВСЕ метрики, включая видео БЕЗ данных (с NULL)
      const allMetricsToSave = Array.from(rawMetricsMap.values()).filter(m => 
        !m.fromCache // Только новые, не из кэша
      );

      if (allMetricsToSave.length > 0) {
        console.log(`💾 Батчевое сохранение ${allMetricsToSave.length} метрик в кэш (включая видео без данных)...`);
        
        // Разделяем на метрики с данными и без данных
        const metricsWithData = allMetricsToSave.filter(m => m.found && m.data);
        const metricsWithoutData = allMetricsToSave.filter(m => !m.found || !m.data);

        console.log(`📊 С данными: ${metricsWithData.length}, без данных: ${metricsWithoutData.length}`);
        
        // === СОХРАНЯЕМ ПЕРИОД "ALL" ===
        
        // Метрики С ДАННЫМИ для периода "all"
        const metricsToSaveAll = metricsWithData.map(m => ({
          creativeId: m.creativeId,
          article: videoMap.get(`${m.creativeId}_${m.videoIndex}`)?.article || m.videoName,
          videoIndex: m.videoIndex,
          videoTitle: m.videoName,
          metricsData: m.data,
          period: 'all',
          hasData: true
        }));

        // Метрики БЕЗ ДАННЫХ для периода "all" (с NULL)
        const metricsToSaveAllNoData = metricsWithoutData.map(m => ({
          creativeId: m.creativeId,
          article: videoMap.get(`${m.creativeId}_${m.videoIndex}`)?.article || m.videoName,
          videoIndex: m.videoIndex,
          videoTitle: m.videoName,
          metricsData: null,
          period: 'all',
          hasData: false
        }));

        // Объединяем и сохраняем все метрики периода "all"
        const allPeriodAll = [...metricsToSaveAll, ...metricsToSaveAllNoData];
        
        if (allPeriodAll.length > 0) {
          await metricsAnalyticsService.saveBatchMetricsCache(allPeriodAll);
          console.log(`✅ Период "all" сохранен: ${metricsToSaveAll.length} с данными + ${metricsToSaveAllNoData.length} без данных`);
        }

        // === СОХРАНЯЕМ ПЕРИОД "4DAYS" ===
        
        // Метрики С ДАННЫМИ для периода "4days"
        const metricsToSave4Days = [];
        
        metricsWithData.forEach(m => {
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
              days_count: 0,
              cost_from_sources: 0,
              clicks_on_link: 0
            };
            
            first4Days.forEach(day => {
              aggregated.leads += day.leads || 0;
              aggregated.cost += day.cost || 0;
              aggregated.clicks += day.clicks || 0;
              aggregated.impressions += day.impressions || 0;
              aggregated.duration_sum += day.avg_duration || 0;
              aggregated.days_count += 1;
              aggregated.cost_from_sources += day.cost_from_sources || 0;
              aggregated.clicks_on_link += day.clicks_on_link || 0;
            });
            
            // Вычисляем производные метрики
            const avg_duration = aggregated.days_count > 0 ? aggregated.duration_sum / aggregated.days_count : 0;
            const cpl = aggregated.leads > 0 ? aggregated.cost / aggregated.leads : 0;
            const ctr_percent = aggregated.impressions > 0 ? (aggregated.clicks_on_link / aggregated.impressions) * 100 : 0;
            const cpc = aggregated.clicks > 0 ? aggregated.cost / aggregated.clicks : 0;
            const cpm = aggregated.impressions > 0 ? (aggregated.cost_from_sources / aggregated.impressions) * 1000 : 0;
            
            const raw = {
              leads: aggregated.leads,
              cost: Number(aggregated.cost.toFixed(2)),
              clicks: aggregated.clicks,
              impressions: aggregated.impressions,
              avg_duration: Number(avg_duration.toFixed(2)),
              days_count: aggregated.days_count,
              cost_from_sources: Number(aggregated.cost_from_sources.toFixed(2)),
              clicks_on_link: aggregated.clicks_on_link,
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
              period: '4days',
              hasData: true
            });
          }
        });

        // Метрики БЕЗ ДАННЫХ для периода "4days" (с NULL)
        const metricsToSave4DaysNoData = metricsWithoutData.map(m => ({
          creativeId: m.creativeId,
          article: videoMap.get(`${m.creativeId}_${m.videoIndex}`)?.article || m.videoName,
          videoIndex: m.videoIndex,
          videoTitle: m.videoName,
          metricsData: null,
          period: '4days',
          hasData: false
        }));

        // Объединяем и сохраняем все метрики периода "4days"
        const allPeriod4Days = [...metricsToSave4Days, ...metricsToSave4DaysNoData];
        
        if (allPeriod4Days.length > 0) {
          await metricsAnalyticsService.saveBatchMetricsCache(allPeriod4Days);
          console.log(`✅ Период "4days" сохранен: ${metricsToSave4Days.length} с данными + ${metricsToSave4DaysNoData.length} без данных`);
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

  /**
   * НОВАЯ ФУНКЦИЯ: Загрузка метрик только для одного креатива
   */
  const loadMetricsForSingleCreative = useCallback(async (creative) => {
    if (!creative || !creative.link_titles || creative.link_titles.length === 0) {
      console.warn('⚠️ loadMetricsForSingleCreative: нет видео для загрузки');
      return;
    }

    console.log(`🎯 Загрузка метрик ТОЛЬКО для креатива: ${creative.article}`);
    
    // 🆕 Добавляем креатив в список загружающихся
    setLoadingCreativeIds(prev => new Set(prev).add(creative.id));
    setError('');

    try {
      // Собираем названия видео только этого креатива
      const videoNames = creative.link_titles.filter(title => 
        title && !title.startsWith('Видео ')
      );

      if (videoNames.length === 0) {
        console.log('⚠️ Нет валидных названий видео');
        setLoading(false);
        return;
      }

      console.log(`📊 Загружаем метрики для ${videoNames.length} видео креатива ${creative.article}`);

      // ШАГ 1: ТОЧНОЕ СОВПАДЕНИЕ
      const batchResult = await MetricsService.getBatchVideoMetrics(videoNames, {
        kind: 'daily_first4_total',
        useCache: false,
        useLike: false
      });

      if (!batchResult.success || !batchResult.results || batchResult.results.length === 0) {
        console.log('⚠️ Не удалось загрузить метрики для нового креатива');
        setLoading(false);
        return;
      }

      console.log(`✅ Получены метрики для ${batchResult.results.length} видео`);

      // Обновляем rawBatchMetrics, добавляя только новые метрики
      const updatedRawMetrics = new Map(rawBatchMetrics);

      batchResult.results.forEach((videoResult, videoIndex) => {
        const videoKey = `${creative.id}_${videoIndex}`;

        if (videoResult.found && videoResult.daily && videoResult.daily.length > 0) {
          // Преобразуем к формату rawMetrics
          const allDailyData = videoResult.daily.map(d => ({
            date: d.date,
            leads: d.leads,
            cost: d.cost,
            clicks: d.clicks,
            impressions: d.impressions,
            avg_duration: d.avg_duration,
            cost_from_sources: d.cost_from_sources || 0,
            clicks_on_link: d.clicks_on_link || 0
          }));

          const aggregates = MetricsService.aggregateDailyData(allDailyData);
          const metrics = MetricsService.computeDerivedMetrics(aggregates);
          const formatted = MetricsService.formatMetrics(metrics);

          updatedRawMetrics.set(videoKey, {
            found: true,
            data: {
              raw: metrics,
              formatted: formatted,
              allDailyData: allDailyData,
              dailyData: allDailyData,
              videoName: creative.link_titles[videoIndex],
              period: 'all',
              updatedAt: new Date().toISOString()
            },
            error: null,
            videoName: creative.link_titles[videoIndex],
            creativeId: creative.id,
            videoIndex: videoIndex,
            fromCache: false,
            noData: false
          });
        } else {
          // Метрики не найдены
          updatedRawMetrics.set(videoKey, {
            found: false,
            data: null,
            error: 'Нет данных',
            videoName: creative.link_titles[videoIndex],
            creativeId: creative.id,
            videoIndex: videoIndex,
            noData: true
          });
        }
      });

      // ШАГ 2: АДАПТИВНЫЙ LIKE ПОИСК ДЛЯ НЕ НАЙДЕННЫХ
      console.log('🔥 ШАГ 2: АДАПТИВНЫЙ LIKE поиск для видео без метрик');
      
      const videosWithoutMetrics = [];
      const videosWithoutMetricsMap = new Map();
      
      videoNames.forEach((videoTitle, videoIndex) => {
        const videoKey = `${creative.id}_${videoIndex}`;
        const existingMetric = updatedRawMetrics.get(videoKey);
        
        // Если метрики НЕ найдены или найдены но пустые
        if (!existingMetric || !existingMetric.found || existingMetric.noData) {
          const nameWithoutExt = videoTitle.replace(/\.(mp4|avi|mov|mkv|webm|m4v)$/i, '');
          videosWithoutMetrics.push(nameWithoutExt);
          videosWithoutMetricsMap.set(nameWithoutExt, {
            videoKey: videoKey,
            originalTitle: videoTitle,
            videoIndex: videoIndex
          });
        }
      });
      
      console.log(`📊 Видео БЕЗ метрик после точного поиска: ${videosWithoutMetrics.length}`);
      
      if (videosWithoutMetrics.length > 0) {
        console.log('═══════════════════════════════════════════════');
        console.log('🔍 НАЧАЛО LIKE ПОИСКА ДЛЯ НОВОГО КРЕАТИВА');
        console.log('═══════════════════════════════════════════════');
        
        try {
          // Для одного креатива используем простой подход без адаптивности
          console.log(`📡 LIKE запрос для ${videosWithoutMetrics.length} видео...`);
          
          const likeBatchResult = await MetricsService.getBatchVideoMetrics(videosWithoutMetrics, {
            kind: 'daily_first4_total',
            useCache: false,
            useLike: true
          });
          
          if (likeBatchResult.success && likeBatchResult.results && likeBatchResult.results.length > 0) {
            console.log(`✅ LIKE поиск вернул ${likeBatchResult.results.length} результатов`);
            
            let matchedCount = 0;
            
            likeBatchResult.results.forEach((videoResult) => {
              if (!videoResult.found || !videoResult.daily || videoResult.daily.length === 0) {
                return;
              }
              
              // Находим соответствующий videoKey
              let matchedVideoKey = null;
              let matchedInfo = null;
              
              for (const [nameWithoutExt, info] of videosWithoutMetricsMap.entries()) {
                const dbIncludesOurs = videoResult.videoName.includes(nameWithoutExt);
                const oursIncludesDb = nameWithoutExt.includes(videoResult.videoName);
                
                if (dbIncludesOurs || oursIncludesDb) {
                  matchedVideoKey = info.videoKey;
                  matchedInfo = info;
                  console.log(`✅ LIKE совпадение: "${info.originalTitle}" ~ "${videoResult.videoName}"`);
                  break;
                }
              }
              
              if (!matchedVideoKey) {
                return;
              }
              
              matchedCount++;
              
              // Преобразуем к формату rawMetrics
              const allDailyData = videoResult.daily.map(d => ({
                date: d.date,
                leads: d.leads,
                cost: d.cost,
                clicks: d.clicks,
                impressions: d.impressions,
                avg_duration: d.avg_duration,
                cost_from_sources: d.cost_from_sources || 0,
                clicks_on_link: d.clicks_on_link || 0
              }));

              const aggregates = MetricsService.aggregateDailyData(allDailyData);
              const metrics = MetricsService.computeDerivedMetrics(aggregates);
              const formatted = MetricsService.formatMetrics(metrics);

              updatedRawMetrics.set(matchedVideoKey, {
                found: true,
                data: {
                  raw: metrics,
                  formatted: formatted,
                  allDailyData: allDailyData,
                  dailyData: allDailyData,
                  videoName: matchedInfo.originalTitle,
                  period: 'all',
                  updatedAt: new Date().toISOString()
                },
                error: null,
                videoName: matchedInfo.originalTitle,
                creativeId: creative.id,
                videoIndex: matchedInfo.videoIndex,
                fromCache: false,
                noData: false,
                foundViaLike: true
              });
            });
            
            console.log('═══════════════════════════════════════════════');
            console.log(`🎉 LIKE поиск завершен: найдено ${matchedCount} совпадений`);
            console.log('═══════════════════════════════════════════════');
          }
          
        } catch (likeError) {
          console.error('❌ Ошибка LIKE поиска:', likeError);
          // Продолжаем без LIKE результатов
        }
      } else {
        console.log('✅ Все видео найдены через точное совпадение, LIKE не требуется');
      }

      // Обновляем состояние с новыми метриками (включая LIKE результаты)
      setRawBatchMetrics(updatedRawMetrics);

      // Сохраняем в кэш Supabase (включая LIKE результаты)
      const metricsToSave = [];
      
      updatedRawMetrics.forEach((metric, videoKey) => {
        // Проверяем что это метрика этого креатива
        if (metric.creativeId === creative.id && metric.found && metric.data) {
          metricsToSave.push({
            creativeId: creative.id,
            article: creative.article,
            videoIndex: metric.videoIndex,
            videoTitle: metric.videoName,
            metricsData: metric.data,
            period: 'all',
            hasData: true
          });
        }
      });

      if (metricsToSave.length > 0) {
        await metricsAnalyticsService.saveBatchMetricsCache(metricsToSave);
        console.log(`💾 Сохранено ${metricsToSave.length} метрик нового креатива в кэш (включая LIKE)`);
      }

      // Обновляем время последнего обновления
      await metricsAnalyticsService.updateMetricsLastUpdate();
      setLastUpdated(new Date());

      const foundCount = Array.from(updatedRawMetrics.values()).filter(m => 
        m.creativeId === creative.id && m.found
      ).length;
      
      console.log(`✅ Метрики для креатива ${creative.article} успешно загружены: ${foundCount}/${videoNames.length} видео`);

    } catch (error) {
      console.error('❌ Ошибка загрузки метрик для одного креатива:', error);
      setError(`Ошибка загрузки метрик: ${error.message}`);
    } finally {
      // 🆕 Убираем креатив из списка загружающихся
      setLoadingCreativeIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(creative.id);
        return newSet;
      });
    }
  }, [rawBatchMetrics]);

  return {
    batchMetrics: filteredBatchMetrics,
    rawBatchMetrics,
    loading,
    error,
    stats,
    lastUpdated,
    refresh,
    loadFromCache: () => loadRawBatchMetrics(false),
    loadMetricsForSingleCreative,
    loadingCreativeIds, // 🆕 Set с ID креативов, для которых идет загрузка
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
