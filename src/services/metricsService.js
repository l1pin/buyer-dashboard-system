// Чистый MetricsService.js - загружаем за все время, фильтруем на клиенте
// Замените содержимое src/services/metricsService.js

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
   * Построение SQL запроса для получения всех дневных данных по видео
   */
  static buildDetailedSqlForVideo(videoName) {
    const escapedVideoName = this.sqlEscapeLiteral(videoName);
    
    return `
      SELECT
        adv_date,
        COALESCE(SUM(valid), 0) AS leads,
        COALESCE(SUM(cost), 0) AS cost,
        COALESCE(SUM(clicks_on_link_tracker), 0) AS clicks,
        COALESCE(SUM(showed), 0) AS impressions
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
      const response = await fetch(METRICS_API_URL, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.details || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        return [];
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error("Неверный JSON от сервера: " + e.message);
      }

      if (json && typeof json === "object" && json.error) {
        throw new Error("Ошибка API: " + (json.details || json.error));
      }

      return Array.isArray(json) ? json : [];
      
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Сервис метрик недоступен. Проверьте подключение к интернету.');
      }
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
        impressions: Number(row.impressions) || 0
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
          impressions: Number(map.impressions) || 0
        };
      });
    }

    // Сортируем по дате (первые дни сначала)
    normalizedRows.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return normalizedRows;
  }

  /**
   * Фильтрация данных по периоду на стороне клиента
   */
  static filterDataByPeriod(dailyData, period) {
    if (period === 'all' || !dailyData || dailyData.length === 0) {
      return dailyData;
    }

    if (period === '4days') {
      // Берем первые 4 дня активности
      return dailyData.slice(0, 4);
    }

    return dailyData;
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
        days_count: 0
      };
    }

    return dailyData.reduce((acc, day) => ({
      leads: acc.leads + day.leads,
      cost: acc.cost + day.cost,
      clicks: acc.clicks + day.clicks,
      impressions: acc.impressions + day.impressions,
      days_count: acc.days_count + 1
    }), {
      leads: 0,
      cost: 0,
      clicks: 0,
      impressions: 0,
      days_count: 0
    });
  }

  /**
   * Вычисление производных метрик
   */
  static computeDerivedMetrics({ leads, cost, clicks, impressions, days_count }) {
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

    return {
      leads: formatInt(metrics.leads),
      cpl: formatMoney(metrics.cpl),
      cost: formatMoney(metrics.cost),
      ctr: formatPercent(metrics.ctr_percent),
      cpc: formatMoney(metrics.cpc),
      cpm: formatMoney(metrics.cpm),
      clicks: formatInt(metrics.clicks),
      impressions: formatInt(metrics.impressions),
      days: formatInt(metrics.days_count) + " дн."
    };
  }

  /**
   * Получение метрик для конкретного видео по названию с поддержкой периода
   */
  static async getVideoMetrics(videoName, period = 'all') {
    if (!videoName || typeof videoName !== 'string') {
      throw new Error('Название видео обязательно');
    }

    try {
      // Получаем подробные данные за все время
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

      // Фильтруем данные по выбранному периоду
      const filteredData = this.filterDataByPeriod(allDailyData, period);
      
      if (filteredData.length === 0) {
        return {
          found: false,
          error: `Нет данных за период: ${period === '4days' ? 'первые 4 дня' : period}`
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
          videoName: videoName,
          period: period,
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
    } catch (error) {
      return {
        found: false,
        error: error.message
      };
    }
  }

  /**
   * Получение метрик для множества видео (батчевая обработка) с поддержкой периода
   */
  static async getBatchVideoMetrics(videoNames, period = 'all') {
    if (!Array.isArray(videoNames)) {
      throw new Error('videoNames должен быть массивом');
    }

    const results = await Promise.allSettled(
      videoNames.map(async (videoName, index) => {
        try {
          // Небольшая задержка между запросами чтобы не перегружать прокси
          if (index > 0 && index % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          } else if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          const result = await this.getVideoMetrics(videoName, period);
          
          return {
            videoName,
            period,
            ...result
          };
        } catch (error) {
          return {
            videoName,
            period,
            found: false,
            error: error.message
          };
        }
      })
    );

    const finalResults = results.map((result, index) => ({
      videoName: videoNames[index],
      period,
      ...(result.status === 'fulfilled' ? result.value : {
        found: false,
        error: 'Неизвестная ошибка при обработке'
      })
    }));

    return finalResults;
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
