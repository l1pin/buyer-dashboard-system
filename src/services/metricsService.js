// src/services/metricsService.js - БАТЧЕВАЯ ВЕРСИЯ
// Использует новый оптимизированный API с чанкингом на сервере

import { metricsAnalyticsService } from '../supabaseClient';

const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
    return '/.netlify/functions/metrics-proxy';
  }
  return '/.netlify/functions/metrics-proxy';
};

const METRICS_API_URL = getApiUrl();
const TIMEZONE = "Europe/Kiev";

export class MetricsService {
  /**
   * НОВЫЙ БАТЧЕВЫЙ МЕТОД: Загрузка метрик для множества видео одним запросом
   */
  static async getBatchVideoMetrics(videoNames, options = {}) {
    const {
      dateFrom = null,
      dateTo = null,
      kind = 'daily_first4_total', // daily | first4 | total | daily_first4_total
      useCache = true
    } = options;

    if (!videoNames || videoNames.length === 0) {
      console.warn('⚠️ getBatchVideoMetrics: пустой массив videoNames');
      return { success: false, results: [] };
    }

    console.log(`🚀 БАТЧЕВАЯ загрузка: ${videoNames.length} видео, kind=${kind}`);

    try {
      // Отправляем один запрос с массивом имён
      const requestBody = {
        video_names: videoNames,
        kind: kind
      };

      if (dateFrom) requestBody.date_from = dateFrom;
      if (dateTo) requestBody.date_to = dateTo;

      const startTime = Date.now();

      const response = await fetch(METRICS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      console.log(`📥 Получен ответ от API:`, {
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 'not array',
        firstItem: Array.isArray(data) && data.length > 0 ? data[0] : null
      });
      const elapsed = Date.now() - startTime;

      // Логируем метаданные
      const cacheStatus = response.headers.get('X-Cache');
      const chunksProcessed = response.headers.get('X-Chunks-Processed');
      const totalRecords = response.headers.get('X-Total-Records');

      console.log(`✅ БАТЧЕВАЯ загрузка завершена за ${elapsed}ms:`, {
        cache: cacheStatus,
        chunks: chunksProcessed,
        records: totalRecords || data.length,
        videosRequested: videoNames.length
      });

      // Группируем результаты по video_name и kind
      const resultsByVideo = this._groupBatchResults(data, videoNames);

      return {
        success: true,
        results: resultsByVideo,
        metadata: {
          elapsed,
          cache: cacheStatus,
          chunks: chunksProcessed,
          records: data.length
        }
      };

    } catch (error) {
      console.error('❌ Ошибка батчевой загрузки:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Группировка результатов по видео и типу (daily/first4/total)
   */
  static _groupBatchResults(data, videoNames) {
    const grouped = new Map();

    console.log(`🔍 ДИАГНОСТИКА _groupBatchResults:`, {
      dataCount: data?.length,
      videoNamesCount: videoNames?.length,
      dataType: typeof data,
      isArray: Array.isArray(data)
    });

    // Инициализируем для всех запрошенных видео
    videoNames.forEach(name => {
      grouped.set(name, {
        videoName: name,
        daily: [],
        first4: null,
        total: null,
        found: false,
        noData: true
      });
    });

    console.log(`📦 Инициализировано ${grouped.size} видео в Map`);
    
    if (!data || data.length === 0) {
      console.warn('⚠️ Нет данных для группировки!');
      return Array.from(grouped.values());
    }

    // Детальное логирование первых записей
    console.log('📋 Первые 3 записи из data:');
    for (let i = 0; i < Math.min(3, data.length); i++) {
      console.log(`  [${i}]:`, {
        video_name: data[i].video_name,
        kind: data[i].kind,
        leads: data[i].leads,
        cost: data[i].cost,
        allKeys: Object.keys(data[i])
      });
    }

    // Логируем первые 3 видео из videoNames
    console.log('📋 Первые 3 названия из videoNames:', videoNames.slice(0, 3));

    // Группируем данные
    let processedCount = 0;
    let skippedNoVideoName = 0;
    let newVideosAdded = 0;
    
    data.forEach((row, index) => {
      const { video_name, kind, adv_date, leads, cost, clicks, impressions, avg_duration } = row;
      
      if (!video_name) {
        console.warn(`⚠️ Строка ${index} не содержит video_name:`, row);
        skippedNoVideoName++;
        return;
      }
      
      // КРИТИЧНО: Проверяем точное совпадение
      const hasExactMatch = grouped.has(video_name);
      
      if (!hasExactMatch) {
        // Проверяем похожие названия для диагностики
        const similarNames = videoNames.filter(name => 
          name.toLowerCase().includes(video_name.toLowerCase()) || 
          video_name.toLowerCase().includes(name.toLowerCase())
        );
        
        if (similarNames.length > 0) {
          console.warn(`⚠️ Не найдено точное совпадение для "${video_name}", похожие:`, similarNames);
        } else {
          console.warn(`⚠️ Видео "${video_name}" не было в videoNames, добавляем`);
        }
        
        grouped.set(video_name, {
          videoName: video_name,
          daily: [],
          first4: null,
          total: null,
          found: false,
          noData: true
        });
        newVideosAdded++;
      }

      const entry = grouped.get(video_name);
      entry.found = true;
      entry.noData = false;
      processedCount++;

      const metrics = {
        date: adv_date,
        leads: Number(leads) || 0,
        cost: Number(cost) || 0,
        clicks: Number(clicks) || 0,
        impressions: Number(impressions) || 0,
        avg_duration: Number(avg_duration) || 0
      };

      if (kind === 'daily') {
        entry.daily.push(metrics);
      } else if (kind === 'first4') {
        entry.first4 = metrics;
      } else if (kind === 'total') {
        entry.total = metrics;
      }
    });

    console.log(`✅ Обработано ${processedCount} записей`);
    console.log(`⚠️ Пропущено ${skippedNoVideoName} записей без video_name`);
    console.log(`➕ Добавлено ${newVideosAdded} новых видео (не было в videoNames)`);
    
    // Детальная статистика
    const foundCount = Array.from(grouped.values()).filter(v => v.found).length;
    const notFoundCount = grouped.size - foundCount;
    console.log(`📊 ИТОГОВАЯ СТАТИСТИКА:`);
    console.log(`  ✅ Найдено: ${foundCount}`);
    console.log(`  ❌ Не найдено: ${notFoundCount}`);
    console.log(`  📦 Всего в Map: ${grouped.size}`);

    // Логируем примеры не найденных видео
    if (notFoundCount > 0) {
      const notFound = Array.from(grouped.values()).filter(v => !v.found);
      console.log('❌ Примеры НЕ НАЙДЕННЫХ видео:', notFound.slice(0, 3).map(v => v.videoName));
    }

    return Array.from(grouped.values());
  }

  /**
   * НОВЫЙ МЕТОД: Fuzzy-поиск метрик (LIKE вместо точного совпадения)
   */
  static async getFuzzyVideoMetrics(videoNamesWithoutExt, options = {}) {
    const {
      dateFrom = null,
      dateTo = null,
      kind = 'daily_first4_total'
    } = options;

    if (!videoNamesWithoutExt || videoNamesWithoutExt.length === 0) {
      console.warn('⚠️ getFuzzyVideoMetrics: пустой массив');
      return { success: false, results: [] };
    }

    console.log(`🔍 FUZZY поиск метрик для ${videoNamesWithoutExt.length} видео (без расширений)`);

    try {
      const requestBody = {
        video_names: videoNamesWithoutExt,
        kind: kind,
        fuzzy_search: true // КРИТИЧНО: включаем LIKE поиск
      };

      if (dateFrom) requestBody.date_from = dateFrom;
      if (dateTo) requestBody.date_to = dateTo;

      const startTime = Date.now();

      const response = await fetch(METRICS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;

      console.log(`✅ FUZZY поиск завершен за ${elapsed}ms: ${data.length} записей`);

      // Группируем результаты по video_name
      const resultsByVideo = this._groupBatchResults(data, videoNamesWithoutExt);

      return {
        success: true,
        results: resultsByVideo,
        metadata: { elapsed, fuzzy: true }
      };

    } catch (error) {
      console.error('❌ Ошибка fuzzy поиска:', error);
      return { success: false, error: error.message, results: [] };
    }
  }

  /**
   * Извлечение имени файла без расширения и очистка
   */
  static extractVideoName(fileName) {
    if (!fileName) return '';
    
    // Убираем расширение
    let cleanName = fileName.replace(/\.(mp4|avi|mov|mkv|webm|m4v)$/i, '');
    
    // Убираем окончания типа " (1)", " (2)" и т.д.
    cleanName = cleanName.replace(/\s*\(\d+\)\s*$/i, '');
    
    // Убираем префиксы типа "cropped_original_..."
    // Ищем первое вхождение артикула (например AN00174, J00056, X00915)
    const articleMatch = cleanName.match(/[A-Z]\d{5}/);
    if (articleMatch) {
      const articleIndex = cleanName.indexOf(articleMatch[0]);
      if (articleIndex > 0) {
        // Обрезаем все до артикула
        cleanName = cleanName.substring(articleIndex);
      }
    }
    
    return cleanName.trim();
  }

  /**
   * Получение метрик для одного видео (обёртка над батчевым методом)
   */
  static async getVideoMetricsRaw(videoName, useCache = true, creativeId = null, videoIndex = null, article = null) {
    if (!videoName || typeof videoName !== 'string') {
      throw new Error('Название видео обязательно');
    }

    // Проверяем кэш Supabase
    if (useCache && creativeId && videoIndex !== null) {
      try {
        const cached = await metricsAnalyticsService.getMetricsCache(creativeId, videoIndex, 'all');
        if (cached && cached.metrics_data) {
          console.log(`✅ Загружены метрики из кэша Supabase для: ${videoName}`);
          return {
            found: true,
            data: cached.metrics_data,
            fromCache: true,
            cachedAt: cached.cached_at
          };
        }
      } catch (cacheError) {
        console.warn('⚠️ Ошибка чтения кэша, загружаем из API:', cacheError);
      }
    }

    try {
      console.log(`🔍 Загружаем метрики через батчевый API для: ${videoName}`);
      
      // Используем батчевый метод для одного видео
      const batchResult = await this.getBatchVideoMetrics([videoName], {
        kind: 'daily_first4_total',
        useCache: true
      });

      if (!batchResult.success || batchResult.results.length === 0) {
        return {
          found: false,
          error: batchResult.error || 'Не найдено в базе данных'
        };
      }

      const videoData = batchResult.results[0];
      
      if (!videoData.found || !videoData.daily || videoData.daily.length === 0) {
        return {
          found: false,
          error: 'Нет данных активности'
        };
      }

      // Преобразуем к старому формату для совместимости
      const allDailyData = videoData.daily.map(d => ({
        date: d.date,
        leads: d.leads,
        cost: d.cost,
        clicks: d.clicks,
        impressions: d.impressions,
        avg_duration: d.avg_duration
      }));

      // Вычисляем метрики для "all"
      const aggregatesAll = this.aggregateDailyData(allDailyData);
      const metricsAll = this.computeDerivedMetrics(aggregatesAll);
      const formattedAll = this.formatMetrics(metricsAll);

      const result = {
        found: true,
        data: {
          raw: metricsAll,
          formatted: formattedAll,
          allDailyData: allDailyData,
          dailyData: allDailyData,
          videoName: videoName,
          period: 'all',
          updatedAt: new Date().toLocaleString('ru-RU', {
            timeZone: TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        },
        fromCache: false
      };

      // Сохраняем в кэш Supabase
      if (creativeId && videoIndex !== null) {
        try {
          console.log(`💾 Сохранение метрик в кэш (все время)`);

          // Период "all"
          await metricsAnalyticsService.saveMetricsCache(
            creativeId,
            article || videoName,
            videoIndex,
            videoName,
            result.data,
            'all'
          );

          // Период "4days" (если есть first4 в батчевом результате)
          if (videoData.first4) {
            const first4Metrics = {
              leads: videoData.first4.leads,
              cost: videoData.first4.cost,
              clicks: videoData.first4.clicks,
              impressions: videoData.first4.impressions,
              avg_duration: videoData.first4.avg_duration,
              days_count: Math.min(4, allDailyData.length)
            };

            const derivedFirst4 = this.computeDerivedMetrics(first4Metrics);
            const formattedFirst4 = this.formatMetrics(derivedFirst4);

            const data4Days = {
              raw: derivedFirst4,
              formatted: formattedFirst4,
              allDailyData: allDailyData.slice(0, 4),
              dailyData: allDailyData.slice(0, 4),
              videoName: videoName,
              period: '4days',
              updatedAt: result.data.updatedAt
            };

            await metricsAnalyticsService.saveMetricsCache(
              creativeId,
              article || videoName,
              videoIndex,
              videoName,
              data4Days,
              '4days'
            );

            console.log(`✅ Метрики "4 дня" сохранены в кэш`);
          }

        } catch (saveError) {
          console.error('❌ Ошибка сохранения в кэш:', saveError);
        }
      }

      return result;

    } catch (error) {
      return {
        found: false,
        error: error.message
      };
    }
  }

  /**
   * Клиентская фильтрация по периоду (без новых запросов к API)
   */
  static filterRawMetricsByPeriod(rawMetrics, targetPeriod) {
    if (!rawMetrics || !rawMetrics.found || !rawMetrics.data) {
      return {
        found: false,
        error: 'Нет сырых данных для фильтрации'
      };
    }

    // Если данные из кэша для нужного периода, возвращаем как есть
    const isFromCache = rawMetrics.data?.fromCache || rawMetrics.fromCache;
    const cachedPeriod = rawMetrics.data?.period || rawMetrics.period;
    
    if (isFromCache && cachedPeriod === targetPeriod) {
      console.log(`✅ Данные из кэша для периода "${targetPeriod}"`);
      return {
        found: true,
        data: {
          ...rawMetrics.data,
          period: targetPeriod
        }
      };
    }
    
    const allDailyData = rawMetrics.data.allDailyData || rawMetrics.data.dailyData || [];
    
    if (allDailyData.length === 0) {
      return {
        found: false,
        error: 'Нет дневных данных для фильтрации'
      };
    }

    // Мгновенная фильтрация на клиенте
    const filteredData = this.filterDataByPeriod(allDailyData, targetPeriod);
    
    if (filteredData.length === 0) {
      return {
        found: false,
        error: `Нет данных за период: ${targetPeriod === '4days' ? 'первые 4 дня' : targetPeriod}`
      };
    }

    const aggregates = this.aggregateDailyData(filteredData);
    
    if (aggregates.leads === 0 && aggregates.cost === 0 && 
        aggregates.clicks === 0 && aggregates.impressions === 0) {
      return {
        found: false,
        error: 'Нет активности за выбранный период'
      };
    }
    
    const metrics = this.computeDerivedMetrics(aggregates);
    const formatted = this.formatMetrics(metrics);
    
    return {
      found: true,
      data: {
        raw: metrics,
        formatted: formatted,
        dailyData: filteredData,
        allDailyData: allDailyData,
        period: targetPeriod,
        updatedAt: new Date().toLocaleString('ru-RU', {
          timeZone: TIMEZONE,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    };
  }

  /**
   * Фильтрация дневных данных по периоду
   */
  static filterDataByPeriod(dailyData, period) {
    if (!dailyData || dailyData.length === 0) {
      return [];
    }

    if (period === 'all') {
      return dailyData;
    }

    if (period === '4days') {
      const daysToTake = Math.min(4, dailyData.length);
      return dailyData.slice(0, daysToTake);
    }

    return dailyData;
  }

  /**
   * Агрегирование дневных данных
   */
  static aggregateDailyData(dailyData) {
    if (!dailyData || dailyData.length === 0) {
      return {
        leads: 0,
        cost: 0,
        clicks: 0,
        impressions: 0,
        avg_duration: 0,
        days_count: 0
      };
    }

    const result = dailyData.reduce((acc, day) => ({
      leads: acc.leads + day.leads,
      cost: acc.cost + day.cost,
      clicks: acc.clicks + day.clicks,
      impressions: acc.impressions + day.impressions,
      duration_sum: acc.duration_sum + (day.avg_duration || 0),
      days_count: acc.days_count + 1
    }), {
      leads: 0,
      cost: 0,
      clicks: 0,
      impressions: 0,
      duration_sum: 0,
      days_count: 0
    });

    return {
      leads: result.leads,
      cost: result.cost,
      clicks: result.clicks,
      impressions: result.impressions,
      avg_duration: result.days_count > 0 ? result.duration_sum / result.days_count : 0,
      days_count: result.days_count
    };
  }

  /**
   * Вычисление производных метрик
   */
  static computeDerivedMetrics({ leads, cost, clicks, impressions, avg_duration, days_count }) {
    const fix2 = (x) => Number.isFinite(x) ? Number(x.toFixed(2)) : 0;
    
    const CPL = leads > 0 ? cost / leads : 0;
    const CTR = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const CPC = clicks > 0 ? cost / clicks : 0;
    const CPM = impressions > 0 ? (cost / impressions) * 1000 : 0;

    return {
      leads,
      cost: fix2(cost),
      clicks,
      impressions,
      avg_duration: fix2(avg_duration),
      days_count,
      cpl: fix2(CPL),
      ctr_percent: fix2(CTR),
      cpc: fix2(CPC),
      cpm: fix2(CPM)
    };
  }

  /**
   * Форматирование метрик
   */
  static formatMetrics(metrics) {
    const formatInt = (n) => String(Math.round(Number(n) || 0));
    const formatMoney = (n) => (Number(n) || 0).toFixed(2) + "$";
    const formatPercent = (n) => (Number(n) || 0).toFixed(2) + "%";
    const formatDuration = (n) => (Number(n) || 0).toFixed(1) + "с";

    return {
      leads: formatInt(metrics.leads),
      cpl: formatMoney(metrics.cpl),
      cost: formatMoney(metrics.cost),
      ctr: formatPercent(metrics.ctr_percent),
      cpc: formatMoney(metrics.cpc),
      cpm: formatMoney(metrics.cpm),
      clicks: formatInt(metrics.clicks),
      impressions: formatInt(metrics.impressions),
      avg_duration: formatDuration(metrics.avg_duration),
      days: formatInt(metrics.days_count) + " дн."
    };
  }

  /**
   * Проверка статуса API
   */
  static async checkApiStatus() {
    try {
      const response = await fetch(METRICS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          video_names: ['test_api_status_check']
        })
      });
      
      if (response.ok) {
        return { available: true, message: 'API работает корректно' };
      } else {
        return { 
          available: false, 
          message: `API вернул статус ${response.status}`
        };
      }
    } catch (error) {
      return { 
        available: false, 
        error: error.message,
        message: 'API недоступен'
      };
    }
  }

  /**
   * Получить URL API
   */
  static getApiUrl() {
    return METRICS_API_URL;
  }

  }

export default MetricsService;
