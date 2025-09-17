// Сервис для работы с API метрик рекламы
// Создайте файл: src/services/metricsService.js

const METRICS_API_URL = "https://api.trll-notif.com.ua/adsreportcollector/core.php";
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
   * Отправка запроса к API базы данных
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
        throw new Error(`HTTP ${response.status}: сервер БД недоступен`);
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        throw new Error("Пустой ответ от сервера БД");
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error("Неверный JSON от сервера БД: " + e.message);
      }

      if (json && typeof json === "object" && json.error) {
        throw new Error("Ошибка БД: " + json.error);
      }

      return Array.isArray(json) ? json : [];
    } catch (error) {
      console.error('Ошибка запроса к БД:', error);
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
          // Небольшая задержка между запросами чтобы не перегружать API
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
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

    return results.map((result, index) => ({
      videoName: videoNames[index],
      ...(result.status === 'fulfilled' ? result.value : {
        found: false,
        error: 'Неизвестная ошибка при обработке'
      })
    }));
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
      await this.fetchFromDatabase(testSql);
      return { available: true };
    } catch (error) {
      return { 
        available: false, 
        error: error.message 
      };
    }
  }
}

export default MetricsService;
