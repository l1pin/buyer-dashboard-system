// Обновленный MetricsService - замените содержимое src/services/metricsService.js

// Определяем URL в зависимости от окружения
const getApiUrl = () => {
  // В продакшене используем Netlify функцию
  if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
    return '/.netlify/functions/metrics-proxy';
  }
  
  // В разработке тоже используем Netlify функцию если она доступна
  return '/.netlify/functions/metrics-proxy';
};

const METRICS_API_URL = getApiUrl();
const DB_SOURCE = "facebook";
const TIMEZONE = "Europe/Kiev";

export class MetricsService {
  /**
   * Построение SQL запроса для агрегированных данных по имени видео
   */
  static buildAggregateSqlForVideo(videoName, source = DB_SOURCE) {
    const escapedVideoName = this.sqlEscapeLiteral(videoName);
    const escapedSource = this.sqlEscapeLiteral(source);
    
    return `
      SELECT
        COALESCE(SUM(valid), 0)                       AS leads,
        COALESCE(SUM(cost), 0)                        AS cost,
        COALESCE(SUM(clicks_on_link_tracker), 0)      AS clicks,
        COALESCE(SUM(showed), 0)                      AS impressions
      FROM ads_collection
      WHERE source='${escapedSource}' AND video_name='${escapedVideoName}'
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
      console.log('📡 Запрос к прокси функции:', METRICS_API_URL);
      
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
        console.log('⚠️ Пустой ответ от прокси функции');
        return [];
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error('❌ Неверный JSON от прокси функции:', text.substring(0, 200));
        throw new Error("Неверный JSON от сервера: " + e.message);
      }

      // Проверяем на ошибки в ответе
      if (json && typeof json === "object" && json.error) {
        throw new Error("Ошибка API: " + (json.details || json.error));
      }

      const result = Array.isArray(json) ? json : [];
      console.log('✅ Успешный ответ от прокси функции, записей:', result.length);
      
      return result;
      
    } catch (error) {
      console.error('❌ Ошибка запроса через прокси:', error);
      
      // Более детальная обработка ошибок
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Сервис метрик недоступен. Проверьте подключение к интернету.');
      }
      
      throw error;
    }
  }

  /**
   * Нормализация ответа базы данных к объекту агрегатов
   */
  static normalizeAggregateRow(dbResponse) {
    if (!dbResponse || dbResponse.length === 0) {
      return {
        leads: 0,
        cost: 0,
        clicks: 0,
        impressions: 0
      };
    }

    // Случай A: массив объектов
    if (typeof dbResponse[0] === "object" && !Array.isArray(dbResponse[0])) {
      const row = dbResponse[0];
      return {
        leads: Number(row.leads) || 0,
        cost: Number(row.cost) || 0,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0
      };
    }

    // Случай B: [headers, ...rows]
    const headers = dbResponse[0];
    const dataRow = dbResponse[1] || [];
    const map = {};
    headers.forEach((h, i) => (map[h] = dataRow[i]));
    
    return {
      leads: Number(map.leads) || 0,
      cost: Number(map.cost) || 0,
      clicks: Number(map.clicks) || 0,
      impressions: Number(map.impressions) || 0
    };
  }

  /**
   * Вычисление производных метрик
   */
  static computeDerivedMetrics({ leads, cost, clicks, impressions }) {
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
    const formatMoney = (n) => (Number(n) || 0).toFixed(2).replace(".", ",");
    const formatPercent = (n) => (Number(n) || 0).toFixed(2).replace(".", ",") + "%";

    return {
      leads: formatInt(metrics.leads),
      cpl: formatMoney(metrics.cpl),
      cost: formatMoney(metrics.cost),
      ctr: formatPercent(metrics.ctr_percent),
      cpc: formatMoney(metrics.cpc),
      cpm: formatMoney(metrics.cpm),
      clicks: formatInt(metrics.clicks),
      impressions: formatInt(metrics.impressions)
    };
  }

  /**
   * Получение метрик для конкретного видео по названию
   */
  static async getVideoMetrics(videoName) {
    if (!videoName || typeof videoName !== 'string') {
      throw new Error('Название видео обязательно');
    }

    try {
      console.log(`🔍 Поиск метрик для видео: "${videoName}"`);
      
      const sql = this.buildAggregateSqlForVideo(videoName, DB_SOURCE);
      const dbResponse = await this.fetchFromDatabase(sql);
      
      if (!dbResponse || dbResponse.length === 0) {
        console.log(`❌ Не найдено метрик для видео: "${videoName}"`);
        return {
          found: false,
          error: 'Не найдено в базе данных'
        };
      }

      const aggregates = this.normalizeAggregateRow(dbResponse);
      
      // Проверяем что есть хоть какие-то данные
      if (aggregates.leads === 0 && aggregates.cost === 0 && aggregates.clicks === 0 && aggregates.impressions === 0) {
        console.log(`❌ Найдена запись, но все метрики равны 0 для видео: "${videoName}"`);
        return {
          found: false,
          error: 'Нет активности по этому видео'
        };
      }
      
      const metrics = this.computeDerivedMetrics(aggregates);
      const formatted = this.formatMetrics(metrics);
      
      console.log(`✅ Найдены метрики для видео: "${videoName}"`, formatted);
      
      return {
        found: true,
        data: {
          raw: metrics,
          formatted: formatted,
          videoName: videoName,
          source: DB_SOURCE,
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
      console.error(`❌ Ошибка получения метрик для видео: "${videoName}"`, error);
      return {
        found: false,
        error: error.message
      };
    }
  }

  /**
   * Получение метрик для множества видео (батчевая обработка)
   */
  static async getBatchVideoMetrics(videoNames) {
    if (!Array.isArray(videoNames)) {
      throw new Error('videoNames должен быть массивом');
    }

    console.log(`🔍 Батчевый поиск метрик для ${videoNames.length} видео`);

    const results = await Promise.allSettled(
      videoNames.map(async (videoName, index) => {
        try {
          // Небольшая задержка между запросами чтобы не перегружать прокси
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          const result = await this.getVideoMetrics(videoName);
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

    const successCount = finalResults.filter(r => r.found).length;
    console.log(`✅ Батчевая загрузка завершена: ${successCount}/${videoNames.length} видео с метриками`);

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
      console.log('🔍 Проверка статуса API метрик...');
      
      const testSql = "SELECT 1 as test LIMIT 1";
      const result = await this.fetchFromDatabase(testSql);
      
      console.log('✅ API метрик доступен');
      return { available: true };
    } catch (error) {
      console.error('❌ API метрик недоступен:', error.message);
      return { 
        available: false, 
        error: error.message 
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
