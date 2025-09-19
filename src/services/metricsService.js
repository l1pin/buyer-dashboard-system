// Упрощенный MetricsService.js - загружаем все данные, фильтруем на клиенте
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
   * Построение SQL запроса для получения ВСЕХ данных по видео (без фильтрации по дням)
   * Фильтрацию будем делать на клиенте
   */
  static buildDetailedSqlForVideo(videoName) {
    const escapedVideoName = this.sqlEscapeLiteral(videoName);
    
    return `
      SELECT
        adv_date,
        COALESCE(SUM(valid), 0)                       AS leads,
        COALESCE(SUM(cost), 0)                        AS cost,
        COALESCE(SUM(clicks_on_link_tracker), 0)      AS clicks,
        COALESCE(SUM(showed), 0)                      AS impressions
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
   * Нормализация подробного ответа базы данных к массиву дней
   */
  static normalizeDetailedRows(dbResponse) {
    if (!dbResponse || dbResponse.length === 0) {
      console.log('⚠️ Пустой ответ от базы данных');
      return [];
    }

    console.log('🔄 Нормализация подробных данных:', JSON.stringify(dbResponse.slice(0, 2), null, 2));

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

    console.log('✅ Нормализовано дней:', normalizedRows.length);
    if (normalizedRows.length > 0) {
      console.log('📅 Первый день:', normalizedRows[0].date, normalizedRows[0]);
      console.log('📅 Последний день:', normalizedRows[normalizedRows.length - 1].date, normalizedRows[normalizedRows.length - 1]);
    }
    
    return normalizedRows;
  }

  /**
   * Фильтрация данных по периоду на стороне клиента
   */
  static filterDataByPeriod(dailyData, period) {
    if (period === 'all' || !dailyData || dailyData.length === 0) {
      console.log(`🔄 Используем все ${dailyData?.length || 0} дней данных`);
      return dailyData;
    }

    if (period === '4days') {
      // Берем первые 4 дня активности
      const filtered = dailyData.slice(0, 4);
      console.log(`🔄 Фильтрация: взяли первые 4 дня из ${dailyData.length} доступных`);
      console.log('📅 Выбранные дни:', filtered.map(d => d.date));
      return filtered;
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

    const aggregated = dailyData.reduce((acc, day) => ({
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

    console.log('📊 Агрегированные данные:', aggregated);
    return aggregated;
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
   * НОВЫЙ ПОДХОД: загружаем все данные, фильтруем на клиенте
   */
  static async getVideoMetrics(videoName, period = 'all') {
    if (!videoName || typeof videoName !== 'string') {
      throw new Error('Название видео обязательно');
    }

    console.log(`🔍 Поиск метрик для видео: "${videoName}" за период: ${period}`);
    
    try {
      // Получаем подробные данные за все время
      const sql = this.buildDetailedSqlForVideo(videoName);
      console.log('🔍 Построенный SQL:', sql);
      
      const dbResponse = await this.fetchFromDatabase(sql);
      
      if (!dbResponse || dbResponse.length === 0) {
        console.log(`❌ Пустой результат для видео: "${videoName}"`);
        return {
          found: false,
          error: 'Не найдено в базе данных'
        };
      }

      // Нормализуем подробные данные по дням
      const allDailyData = this.normalizeDetailedRows(dbResponse);
      
      if (allDailyData.length === 0) {
        console.log(`❌ Нет дневных данных для видео: "${videoName}"`);
        return {
          found: false,
          error: 'Нет данных активности'
        };
      }

      // Фильтруем данные по выбранному периоду
      const filteredData = this.filterDataByPeriod(allDailyData, period);
      
      if (filteredData.length === 0) {
        console.log(`❌ После фильтрации нет данных для периода: ${period}`);
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
        console.log(`❌ Все метрики равны 0 для видео: "${videoName}" за период: ${period}`);
        return {
          found: false,
          error: 'Нет активности за выбранный период'
        };
      }
      
      const metrics = this.computeDerivedMetrics(aggregates);
      const formatted = this.formatMetrics(metrics);
      
      console.log(`✅ Найдены метрики для видео: "${videoName}" за период: ${period}`);
      console.log(`📊 Использовано дней: ${filteredData.length} из ${allDailyData.length} доступных`);
      
      return {
        found: true,
        data: {
          raw: metrics,
          formatted: formatted,
          videoName: videoName,
          period: period,
          dailyData: filteredData, // Сохраняем подробные данные для отладки
          totalDaysAvailable: allDailyData.length,
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
          
          console.log(`${result.found ? '✅' : '❌'} Видео ${index + 1}: ${result.found ? `найдены метрики (${result.data?.dailyData?.length || 0} дней)` : result.error}`);
          
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
    
    // Показываем статистику по дням для успешных результатов
    const successfulResults = finalResults.filter(r => r.found);
    if (successfulResults.length > 0) {
      const totalDays = successfulResults.reduce((sum, r) => sum + (r.data?.dailyData?.length || 0), 0);
      const avgDays = totalDays / successfulResults.length;
      console.log(`📅 Среднее количество дней на видео: ${avgDays.toFixed(1)}`);
    }
    
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
   * УЛУЧШЕННЫЙ МЕТОД: Тестирование запроса для конкретного видео с подробной информацией
   */
  static async testVideoQuery(videoName, period = 'all') {
    console.log(`🧪 Тестирование запроса для видео: "${videoName}" за период: ${period}`);
    
    try {
      // Строим простой SQL запрос (без подзапросов!)
      const sql = this.buildDetailedSqlForVideo(videoName);
      console.log('🔍 SQL запрос для тестирования (простой, без подзапросов):', sql);
      
      const result = await this.fetchFromDatabase(sql);
      console.log('📊 Сырой результат тестирования:', result);
      
      if (result && result.length > 0) {
        const dailyData = this.normalizeDetailedRows(result);
        console.log('📅 Нормализованные дневные данные:', dailyData);
        
        // Показываем как работает фильтрация
        const allPeriodData = this.filterDataByPeriod(dailyData, 'all');
        const fourDaysData = this.filterDataByPeriod(dailyData, '4days');
        
        console.log('🔄 Данные за все время:', allPeriodData.length, 'дней');
        console.log('🔄 Данные за первые 4 дня:', fourDaysData.length, 'дней');
        
        // Агрегируем для выбранного периода
        const selectedData = period === '4days' ? fourDaysData : allPeriodData;
        const aggregated = this.aggregateDailyData(selectedData);
        console.log('📈 Агрегированные данные для периода:', aggregated);
        
        const computed = this.computeDerivedMetrics(aggregated);
        console.log('🎯 Вычисленные метрики:', computed);
        
        const formatted = this.formatMetrics(computed);
        console.log('🎨 Отформатированные метрики:', formatted);
        
        return { 
          success: true, 
          data: formatted, 
          sql, 
          rawResult: result,
          dailyData: selectedData,
          totalDaysAvailable: dailyData.length,
          daysUsed: selectedData.length
        };
      } else {
        console.log('❌ Пустой результат для тестового запроса');
        return { success: false, message: 'Пустой результат', sql };
      }
    } catch (error) {
      console.error('❌ Ошибка в тестовом запросе:', error);
      return { success: false, error: error.message, sql: this.buildDetailedSqlForVideo(videoName) };
    }
  }
}

export default MetricsService;
