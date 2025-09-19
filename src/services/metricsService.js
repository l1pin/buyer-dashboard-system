// Исправленный MetricsService.js с корректной логикой для периода "4 дня"
// Замените содержимое src/services/metricsService.js

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
const TIMEZONE = "Europe/Kiev";

export class MetricsService {
  /**
   * Построение SQL запроса для агрегированных данных по имени видео с фильтрацией по периоду
   * ИСПРАВЛЕНО: теперь берет последние 4 дня активности, а не первые
   */
  static buildAggregateSqlForVideo(videoName, period = 'all') {
    const escapedVideoName = this.sqlEscapeLiteral(videoName);
    
    let dateFilter = '';
    if (period === '4days') {
      // ИСПРАВЛЕНИЕ: берем последние 4 дня активности (DESC вместо ASC)
      dateFilter = `
        AND adv_date IN (
          SELECT adv_date 
          FROM ads_collection 
          WHERE video_name='${escapedVideoName}' 
            AND (cost > 0 OR valid > 0 OR showed > 0 OR clicks_on_link_tracker > 0)
          ORDER BY adv_date DESC 
          LIMIT 4
        )
      `;
    }
    
    return `
      SELECT
        COALESCE(SUM(valid), 0)                       AS leads,
        COALESCE(SUM(cost), 0)                        AS cost,
        COALESCE(SUM(clicks_on_link_tracker), 0)      AS clicks,
        COALESCE(SUM(showed), 0)                      AS impressions,
        COUNT(DISTINCT adv_date)                      AS days_count
      FROM ads_collection
      WHERE video_name='${escapedVideoName}'${dateFilter}
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
   * УЛУЧШЕНО: добавлено больше логирования для отладки
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
      console.log('🔍 SQL запрос:', sql.substring(0, 200) + (sql.length > 200 ? '...' : ''));
      
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
        
        console.error('❌ Ошибка ответа от прокси:', errorMessage);
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
        console.error('❌ Ошибка API:', json.error, json.details);
        throw new Error("Ошибка API: " + (json.details || json.error));
      }

      const result = Array.isArray(json) ? json : [];
      console.log('✅ Успешный ответ от прокси функции, записей:', result.length);
      
      // Дополнительное логирование для отладки
      if (result.length > 0) {
        console.log('📋 Пример данных:', JSON.stringify(result[0], null, 2));
      }
      
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
      console.log('⚠️ Пустой ответ от базы данных');
      return {
        leads: 0,
        cost: 0,
        clicks: 0,
        impressions: 0,
        days_count: 0
      };
    }

    console.log('🔄 Нормализация ответа базы данных:', JSON.stringify(dbResponse, null, 2));

    // Случай A: массив объектов
    if (typeof dbResponse[0] === "object" && !Array.isArray(dbResponse[0])) {
      const row = dbResponse[0];
      const normalized = {
        leads: Number(row.leads) || 0,
        cost: Number(row.cost) || 0,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        days_count: Number(row.days_count) || 0
      };
      console.log('✅ Нормализовано (объект):', normalized);
      return normalized;
    }

    // Случай B: [headers, ...rows]
    const headers = dbResponse[0];
    const dataRow = dbResponse[1] || [];
    const map = {};
    headers.forEach((h, i) => (map[h] = dataRow[i]));
    
    const normalized = {
      leads: Number(map.leads) || 0,
      cost: Number(map.cost) || 0,
      clicks: Number(map.clicks) || 0,
      impressions: Number(map.impressions) || 0,
      days_count: Number(map.days_count) || 0
    };
    console.log('✅ Нормализовано (массив):', normalized);
    return normalized;
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

    const computed = {
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
    
    console.log('📊 Вычисленные метрики:', computed);
    return computed;
  }

  /**
   * Форматирование метрик для отображения
   */
  static formatMetrics(metrics) {
    const formatInt = (n) => String(Math.round(Number(n) || 0));
    const formatMoney = (n) => (Number(n) || 0).toFixed(2) + "$";
    const formatPercent = (n) => (Number(n) || 0).toFixed(2) + "%";

    const formatted = {
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
    
    console.log('🎨 Отформатированные метрики:', formatted);
    return formatted;
  }

  /**
   * Получение метрик для конкретного видео по названию с поддержкой периода
   * УЛУЧШЕНО: добавлено детальное логирование для отладки
   */
  static async getVideoMetrics(videoName, period = 'all') {
    if (!videoName || typeof videoName !== 'string') {
      throw new Error('Название видео обязательно');
    }

    console.log(`🔍 Поиск метрик для видео: "${videoName}" за период: ${period}`);
    
    try {
      const sql = this.buildAggregateSqlForVideo(videoName, period);
      console.log('🔍 Построенный SQL:', sql);
      
      const dbResponse = await this.fetchFromDatabase(sql);
      
      if (!dbResponse || dbResponse.length === 0) {
        console.log(`❌ Пустой результат для видео: "${videoName}" за период: ${period}`);
        return {
          found: false,
          error: 'Не найдено в базе данных'
        };
      }

      const aggregates = this.normalizeAggregateRow(dbResponse);
      
      // Проверяем что есть хоть какие-то данные
      if (aggregates.leads === 0 && aggregates.cost === 0 && 
          aggregates.clicks === 0 && aggregates.impressions === 0) {
        console.log(`❌ Все метрики равны 0 для видео: "${videoName}" за период: ${period}`);
        console.log('📋 Агрегированные данные:', aggregates);
        return {
          found: false,
          error: 'Нет активности по этому видео за выбранный период'
        };
      }
      
      const metrics = this.computeDerivedMetrics(aggregates);
      const formatted = this.formatMetrics(metrics);
      
      console.log(`✅ Найдены метрики для видео: "${videoName}" за период: ${period}`);
      console.log('📊 Итоговые метрики:', formatted);
      
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
      console.error(`❌ Ошибка получения метрик для видео: "${videoName}" за период: ${period}`, error);
      return {
        found: false,
        error: error.message
      };
    }
  }

  /**
   * Получение метрик для множества видео (батчевая обработка) с поддержкой периода
   * УЛУЧШЕНО: добавлено больше логирования и статистики
   */
  static async getBatchVideoMetrics(videoNames, period = 'all') {
    if (!Array.isArray(videoNames)) {
      throw new Error('videoNames должен быть массивом');
    }

    console.log(`🔍 Батчевый поиск метрик для ${videoNames.length} видео за период: ${period}`);
    console.log('📋 Список видео для поиска:', videoNames.slice(0, 5).map(v => `"${v}"`).join(', ') + (videoNames.length > 5 ? '...' : ''));

    const results = await Promise.allSettled(
      videoNames.map(async (videoName, index) => {
        try {
          // Небольшая задержка между запросами чтобы не перегружать прокси
          if (index > 0 && index % 5 === 0) {
            console.log(`⏳ Пауза после ${index} запросов...`);
            await new Promise(resolve => setTimeout(resolve, 500));
          } else if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          console.log(`📹 Обрабатываем видео ${index + 1}/${videoNames.length}: "${videoName}"`);
          
          const result = await this.getVideoMetrics(videoName, period);
          
          console.log(`${result.found ? '✅' : '❌'} Видео ${index + 1}: ${result.found ? 'найдены метрики' : result.error}`);
          
          return {
            videoName,
            period,
            ...result
          };
        } catch (error) {
          console.error(`❌ Ошибка для видео ${index + 1}: "${videoName}"`, error);
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

    const successCount = finalResults.filter(r => r.found).length;
    const failureCount = finalResults.length - successCount;
    
    console.log(`✅ Батчевая загрузка завершена: ${successCount}/${videoNames.length} видео с метриками за период: ${period}`);
    console.log(`📊 Статистика: успешно - ${successCount}, неудачно - ${failureCount}`);
    
    // Показываем примеры неудачных результатов для отладки
    if (failureCount > 0) {
      const failures = finalResults.filter(r => !r.found).slice(0, 3);
      console.log('❌ Примеры неудачных запросов:');
      failures.forEach(f => {
        console.log(`  - "${f.videoName}": ${f.error}`);
      });
    }

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
   * УЛУЧШЕНО: добавлена проверка работоспособности с реальным запросом
   */
  static async checkApiStatus() {
    try {
      console.log('🔍 Проверка статуса API метрик...');
      
      // Делаем простой тестовый запрос
      const testSql = "SELECT 1 as test LIMIT 1";
      const result = await this.fetchFromDatabase(testSql);
      
      if (result && Array.isArray(result)) {
        console.log('✅ API метрик доступен и работает');
        return { available: true, message: 'API работает корректно' };
      } else {
        console.log('⚠️ API метрик доступен, но возвращает неожиданный результат');
        return { available: true, message: 'API доступен, но результат неожиданный' };
      }
    } catch (error) {
      console.error('❌ API метрик недоступен:', error.message);
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

  /**
   * НОВЫЙ МЕТОД: Тестирование SQL запроса для конкретного видео
   * Полезно для отладки проблем с периодами
   */
  static async testVideoQuery(videoName, period = 'all') {
    console.log(`🧪 Тестирование запроса для видео: "${videoName}" за период: ${period}`);
    
    try {
      const sql = this.buildAggregateSqlForVideo(videoName, period);
      console.log('🔍 SQL запрос для тестирования:', sql);
      
      const result = await this.fetchFromDatabase(sql);
      console.log('📊 Результат тестирования:', result);
      
      if (result && result.length > 0) {
        const normalized = this.normalizeAggregateRow(result);
        console.log('📈 Нормализованные данные:', normalized);
        
        const computed = this.computeDerivedMetrics(normalized);
        console.log('🎯 Вычисленные метрики:', computed);
        
        const formatted = this.formatMetrics(computed);
        console.log('🎨 Отформатированные метрики:', formatted);
        
        return { success: true, data: formatted, sql, rawResult: result };
      } else {
        console.log('❌ Пустой результат для тестового запроса');
        return { success: false, message: 'Пустой результат', sql };
      }
    } catch (error) {
      console.error('❌ Ошибка в тестовом запросе:', error);
      return { success: false, error: error.message, sql: '' };
    }
  }
}

export default MetricsService;
