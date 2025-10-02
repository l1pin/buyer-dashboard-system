// ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ MetricsService.js - МГНОВЕННАЯ клиентская фильтрация
// Замените содержимое src/services/metricsService.js

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
   * Построение SQL запроса для получения всех дневных данных по видео - ТОЛЬКО ЗА ВСЕ ВРЕМЯ
   */
  static buildDetailedSqlForVideo(videoName) {
    const escapedVideoName = this.sqlEscapeLiteral(videoName);
    
    return `
      SELECT
        adv_date,
        COALESCE(SUM(valid), 0) AS leads,
        COALESCE(SUM(cost), 0) AS cost,
        COALESCE(SUM(clicks_on_link_tracker), 0) AS clicks,
        COALESCE(SUM(showed), 0) AS impressions,
        COALESCE(AVG(average_time_on_video), 0) AS avg_duration
      FROM ads_collection
      WHERE video_name='${escapedVideoName}'
        AND (cost > 0 OR valid > 0 OR showed > 0 OR clicks_on_link_tracker > 0)
      GROUP BY adv_date
      ORDER BY adv_date ASC
    `;
  }

  /**
   * Экранирование строки для SQL
   */
  static sqlEscapeLiteral(str) {
    return String(str).replace(/'/g, "''");
  }

  /**
   * Отправка запроса к API базы данных через Netlify прокси
   */
  static async fetchFromDatabase(sql) {
    if (!/^(\s*select\b)/i.test(sql)) {
      throw new Error("Разрешены только SELECT-запросы.");
    }

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ sql }),
    };

    try {
      console.log('📡 Отправка запроса к прокси:', METRICS_API_URL);
      
      const response = await fetch(METRICS_API_URL, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.details || `HTTP ${response.status}`;
          
          // Детальное логирование для отладки
          console.error('❌ Ошибка от прокси:', {
            status: response.status,
            error: errorJson.error,
            details: errorJson.details,
            type: errorJson.type
          });
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          console.error('❌ Ошибка от прокси (не JSON):', response.status, errorText.substring(0, 200));
        }
        
        // Более дружелюбные сообщения для пользователя
        if (response.status === 502) {
          throw new Error('API метрик временно недоступен. Попробуйте позже.');
        } else if (response.status === 504) {
          throw new Error('Превышено время ожидания. Попробуйте обновить данные.');
        } else if (response.status === 500) {
          throw new Error('Внутренняя ошибка сервера метрик.');
        } else {
          throw new Error(errorMessage);
        }
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        console.log('⚠️ Пустой ответ от API');
        return [];
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error('❌ Неверный JSON:', e.message, text.substring(0, 200));
        throw new Error("Неверный ответ от API метрик");
      }

      if (json && typeof json === "object" && json.error) {
        console.error('❌ Ошибка в ответе API:', json.error);
        throw new Error("Ошибка API: " + (json.details || json.error));
      }

      return Array.isArray(json) ? json : [];
      
    } catch (error) {
      // Обработка ошибок сети
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        console.error('🌐 Ошибка сети:', error);
        throw new Error('Не удается подключиться к сервису метрик. Проверьте интернет-соединение.');
      }
      
      console.error('❌ Ошибка fetchFromDatabase:', error);
      throw error;
    }
  }

  /**
   * Нормализация подробного ответа базы данных к массиву дней
   */
  static normalizeDetailedRows(dbResponse) {
    if (!dbResponse || dbResponse.length === 0) {
      return [];
    }

    let normalizedRows = [];

    // Случай A: массив объектов
    if (typeof dbResponse[0] === "object" && !Array.isArray(dbResponse[0])) {
      normalizedRows = dbResponse.map(row => ({
        date: row.adv_date,
        leads: Number(row.leads) || 0,
        cost: Number(row.cost) || 0,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        avg_duration: Number(row.avg_duration) || 0
      }));
    } else {
      // Случай B: [headers, ...rows]
      const headers = dbResponse[0];
      const dataRows = dbResponse.slice(1);
      
      normalizedRows = dataRows.map(row => {
        const map = {};
        headers.forEach((h, i) => (map[h] = row[i]));
        
        return {
          date: map.adv_date,
          leads: Number(map.leads) || 0,
          cost: Number(map.cost) || 0,
          clicks: Number(map.clicks) || 0,
          impressions: Number(map.impressions) || 0,
          avg_duration: Number(map.avg_duration) || 0
        };
      });
    }

    // Сортируем по дате (первые дни сначала)
    normalizedRows.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return normalizedRows;
  }

  /**
   * КЛЮЧЕВОЙ МЕТОД: Клиентская фильтрация данных по периоду - МГНОВЕННО
   */
  static filterDataByPeriod(dailyData, period) {
    if (!dailyData || dailyData.length === 0) {
      return [];
    }

    if (period === 'all') {
      return dailyData;
    }

    if (period === '4days') {
      // Берем только первые 4 дня активности - МГНОВЕННО на клиенте
      return dailyData.slice(0, 4);
    }

    // Добавьте другие периоды если нужно
    return dailyData;
  }

  /**
   * НОВЫЙ МЕТОД: Клиентская фильтрация уже загруженных метрик по периоду
   */
  static filterRawMetricsByPeriod(rawMetrics, targetPeriod) {
    if (!rawMetrics || !rawMetrics.found || !rawMetrics.data) {
      return {
        found: false,
        error: 'Нет сырых данных для фильтрации'
      };
    }

    // КРИТИЧНО: Если период 'all' И данные из кэша (нет allDailyData), возвращаем как есть
    const allDailyData = rawMetrics.data.allDailyData || rawMetrics.data.dailyData || [];
    const isFromCache = rawMetrics.data.fromCache || rawMetrics.fromCache;
    
    if (targetPeriod === 'all' && allDailyData.length === 0 && isFromCache) {
      console.log('✅ Данные из кэша для периода "all" - возвращаем без фильтрации');
      return {
        found: true,
        data: rawMetrics.data
      };
    }
    
    if (allDailyData.length === 0) {
      return {
        found: false,
        error: 'Нет дневных данных для фильтрации'
      };
    }

    // МГНОВЕННАЯ фильтрация на клиенте
    const filteredData = this.filterDataByPeriod(allDailyData, targetPeriod);
    
    if (filteredData.length === 0) {
      return {
        found: false,
        error: `Нет данных за период: ${targetPeriod === '4days' ? 'первые 4 дня' : targetPeriod}`
      };
    }

    // Агрегируем отфильтрованные данные
    const aggregates = this.aggregateDailyData(filteredData);
    
    // Проверяем что есть хоть какая-то активность
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
        dailyData: filteredData, // Отфильтрованные дневные данные
        allDailyData: allDailyData, // Сохраняем оригинальные данные для повторной фильтрации
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
   * Агрегирование дневных данных в общие метрики
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
   * Форматирование метрик для отображения
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
   * ПЕРЕПИСАННЫЙ метод: Получение метрик для конкретного видео - ТОЛЬКО за все время
   */
  static async getVideoMetricsRaw(videoName, useCache = true, creativeId = null, videoIndex = null, article = null) {
    if (!videoName || typeof videoName !== 'string') {
      throw new Error('Название видео обязательно');
    }

    // Проверяем кэш, если разрешено
    if (useCache && creativeId && videoIndex !== null) {
      try {
        const cached = await metricsAnalyticsService.getMetricsCache(creativeId, videoIndex, 'all');
        if (cached && cached.metrics_data) {
          console.log(`✅ Загружены метрики из кэша для: ${videoName}`);
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
      console.log(`🔍 Загружаем сырые данные ЗА ВСЕ ВРЕМЯ из API для: ${videoName}`);
      
      // ВСЕГДА получаем данные за ВСЕ время
      const sql = this.buildDetailedSqlForVideo(videoName);
      const dbResponse = await this.fetchFromDatabase(sql);
      
      if (!dbResponse || dbResponse.length === 0) {
        return {
          found: false,
          error: 'Не найдено в базе данных'
        };
      }

      // Нормализуем подробные данные по дням
      const allDailyData = this.normalizeDetailedRows(dbResponse);
      
      if (allDailyData.length === 0) {
        return {
          found: false,
          error: 'Нет данных активности'
        };
      }

      // Агрегируем данные за ВСЕ время для проверки активности
      const aggregates = this.aggregateDailyData(allDailyData);
      
      // Проверяем что есть хоть какая-то активность
      if (aggregates.leads === 0 && aggregates.cost === 0 && 
          aggregates.clicks === 0 && aggregates.impressions === 0) {
        return {
          found: false,
          error: 'Нет активности за всё время'
        };
      }
      
      const metrics = this.computeDerivedMetrics(aggregates);
      const formatted = this.formatMetrics(metrics);
      
      console.log(`✅ Сырые данные загружены: ${allDailyData.length} дней активности`);
      
      const result = {
        found: true,
        data: {
          raw: metrics,
          formatted: formatted,
          allDailyData: allDailyData, // КЛЮЧЕВОЕ: сохраняем ВСЕ дневные данные для фильтрации
          dailyData: allDailyData, // По умолчанию показываем все дни
          videoName: videoName,
          period: 'all', // Сырые данные всегда за все время
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

      // Сохраняем в кэш, если указаны параметры
      if (creativeId && videoIndex !== null) {
        try {
          console.log(`💾 Сохранение метрик в кэш:`, {
            creativeId,
            article: article || videoName,
            videoIndex,
            videoName,
            period: 'all',
            hasData: !!result.data,
            dataKeys: result.data ? Object.keys(result.data) : [],
            rawLeads: result.data?.raw?.leads,
            rawCost: result.data?.raw?.cost
          });

          await metricsAnalyticsService.saveMetricsCache(
            creativeId,
            article || videoName,
            videoIndex,
            videoName,
            result.data,
            'all'
          );
          
          console.log(`✅ Метрики успешно сохранены в кэш для: ${videoName}`);
          
          // Проверяем что сохранилось
          const checkCache = await metricsAnalyticsService.getMetricsCache(creativeId, videoIndex, 'all');
          console.log(`🔍 Проверка сохраненного кэша:`, {
            found: !!checkCache,
            hasMetricsData: !!checkCache?.metrics_data,
            hasLeads: 'leads' in checkCache,
            leadsValue: checkCache?.leads,
            costValue: checkCache?.cost
          });
          
        } catch (saveError) {
          console.error('❌ ОШИБКА сохранения метрик в кэш:', saveError);
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
   * УСТАРЕВШИЙ метод - больше не используется для избежания запросов
   */
  static async getVideoMetrics(videoName, period = 'all') {
    console.warn('⚠️ getVideoMetrics используется напрямую - используйте getVideoMetricsRaw + filterRawMetricsByPeriod');
    
    // Для обратной совместимости
    const rawResult = await this.getVideoMetricsRaw(videoName);
    
    if (!rawResult.found) {
      return rawResult;
    }

    return this.filterRawMetricsByPeriod(rawResult, period);
  }

  /**
   * ПЕРЕПИСАННЫЙ метод: Батчевая загрузка - ТОЛЬКО за все время
   */
  static async getBatchVideoMetricsRaw(videoNames) {
    if (!Array.isArray(videoNames)) {
      throw new Error('videoNames должен быть массивом');
    }

    console.log(`🚀 Батчевая загрузка сырых данных для ${videoNames.length} видео`);

    const results = await Promise.allSettled(
      videoNames.map(async (videoName, index) => {
        try {
          // Небольшая задержка между запросами чтобы не перегружать прокси
          if (index > 0 && index % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          } else if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // ВАЖНО: получаем только сырые данные за ВСЕ время
          const result = await this.getVideoMetricsRaw(videoName);
          
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

    const finalResults = results.map((result, index) => ({
      videoName: videoNames[index],
      ...(result.status === 'fulfilled' ? result.value : {
        found: false,
        error: 'Неизвестная ошибка при обработке'
      })
    }));

    console.log(`✅ Батчевая загрузка завершена: ${finalResults.filter(r => r.found).length}/${finalResults.length} успешно`);

    return finalResults;
  }

  /**
   * УСТАРЕВШИЙ метод - больше не используется
   */
  static async getBatchVideoMetrics(videoNames, period = 'all') {
    console.warn('⚠️ getBatchVideoMetrics используется с периодом - используйте getBatchVideoMetricsRaw + клиентскую фильтрацию');
    
    // Для обратной совместимости
    const rawResults = await this.getBatchVideoMetricsRaw(videoNames);
    
    if (period === 'all') {
      return rawResults;
    }

    // Применяем фильтрацию ко всем результатам
    return rawResults.map(rawResult => {
      if (!rawResult.found) {
        return {
          ...rawResult,
          period
        };
      }

      const filtered = this.filterRawMetricsByPeriod(rawResult, period);
      return {
        videoName: rawResult.videoName,
        period,
        ...filtered
      };
    });
  }

  /**
   * Извлечение имени файла без расширения (если нужно)
   */
  static extractVideoName(fileName) {
    if (!fileName) return '';
    
    // Убираем расширения видео файлов
    const cleanName = fileName.replace(/\.(mp4|avi|mov|mkv|webm|m4v)$/i, '');
    return cleanName.trim();
  }

  /**
   * Проверка статуса API
   */
  static async checkApiStatus() {
    try {
      const testSql = "SELECT 1 as test LIMIT 1";
      const result = await this.fetchFromDatabase(testSql);
      
      if (result && Array.isArray(result)) {
        return { available: true, message: 'API работает корректно' };
      } else {
        return { available: true, message: 'API доступен, но результат неожиданный' };
      }
    } catch (error) {
      return { 
        available: false, 
        error: error.message,
        message: 'API недоступен или работает некорректно'
      };
    }
  }

  /**
   * Получить URL API для отладки
   */
  static getApiUrl() {
    return METRICS_API_URL;
  }
}

export default MetricsService;
