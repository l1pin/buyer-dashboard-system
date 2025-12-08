// src/services/metricsService.js - БАТЧЕВАЯ ВЕРСИЯ
// Использует новый оптимизированный API с чанкингом на сервере

import { metricsAnalyticsService } from "../supabaseClient";

// Прямое подключение к API базы данных (без прокси)
const METRICS_API_URL = "https://api.trll-notif.com.ua/adsreportcollector/core.php";
const TIMEZONE = "Europe/Kiev";

// SQL Builder для прямых запросов к БД
class SQLBuilder {
  static escapeString(str) {
    return String(str).replace(/'/g, "''");
  }

  static buildBatchSQL(videoNames, dateFrom = null, dateTo = null, kind = 'daily') {
    if (!videoNames || videoNames.length === 0) {
      throw new Error('videoNames не может быть пустым');
    }

    console.log('🔨 Формирование SQL для', videoNames.length, 'видео, kind:', kind);

    // Фильтр по датам
    let dateFilter = '';
    if (dateFrom && dateTo) {
      dateFilter = `AND t.adv_date >= '${this.escapeString(dateFrom)}'
      AND t.adv_date <= '${this.escapeString(dateTo)}'`;
    }

    // IN clause для видео
    const inClause = videoNames
      .map(name => `'${this.escapeString(name)}'`)
      .join(',');

    // Выбираем шаблон SQL в зависимости от kind
    if (kind === 'daily_first4_total') {
      return this._buildDailyFirst4TotalSQL(inClause, dateFilter);
    } else if (kind === 'daily') {
      return this._buildDailySQL(inClause, dateFilter);
    } else {
      return this._buildDailySQL(inClause, dateFilter);
    }
  }

  static _buildDailySQL(inClause, dateFilter) {
    return `
SELECT
  'daily' as kind,
  t.video_name,
  t.adv_date,
  COALESCE(SUM(t.valid), 0) AS leads,
  COALESCE(SUM(t.cost), 0) AS cost,
  COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
  COALESCE(SUM(t.showed), 0) AS impressions,
  COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
  COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
  COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
FROM ads_collection t
WHERE t.video_name IN (${inClause})
  AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
  ${dateFilter}
GROUP BY t.video_name, t.adv_date
ORDER BY t.video_name, t.adv_date`;
  }

  static _buildDailyFirst4TotalSQL(inClause, dateFilter) {
    return `
SELECT 'daily' as kind, video_name, adv_date, leads, cost, clicks, impressions, avg_duration, cost_from_sources, clicks_on_link
FROM (
  SELECT
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
    COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
  FROM ads_collection t
  WHERE t.video_name IN (${inClause})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data
UNION ALL
SELECT 'first4' as kind, video_name, NULL as adv_date, SUM(leads) as leads, SUM(cost) as cost, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(avg_duration) as avg_duration, SUM(cost_from_sources) as cost_from_sources, SUM(clicks_on_link) as clicks_on_link
FROM (
  SELECT
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
    COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link,
    ROW_NUMBER() OVER (PARTITION BY t.video_name ORDER BY t.adv_date ASC) as rn
  FROM ads_collection t
  WHERE t.video_name IN (${inClause})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) ranked_daily
WHERE rn <= 4
GROUP BY video_name
UNION ALL
SELECT 'total' as kind, video_name, NULL as adv_date, SUM(leads) as leads, SUM(cost) as cost, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(avg_duration) as avg_duration, SUM(cost_from_sources) as cost_from_sources, SUM(clicks_on_link) as clicks_on_link
FROM (
  SELECT
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
    COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
  FROM ads_collection t
  WHERE t.video_name IN (${inClause})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data2
GROUP BY video_name
ORDER BY video_name, kind, adv_date`;
  }

  // LIKE поиск для видео без расширения (фоллбэк метод)
  static buildLikeSQL(videoNames, dateFrom = null, dateTo = null, kind = 'daily_first4_total') {
    if (!videoNames || videoNames.length === 0) {
      throw new Error('videoNames не может быть пустым для LIKE поиска');
    }

    console.log('🔍 Формирование LIKE SQL для', videoNames.length, 'видео');

    // Фильтр по датам
    let dateFilter = '';
    if (dateFrom && dateTo) {
      dateFilter = `AND t.adv_date >= '${this.escapeString(dateFrom)}'
      AND t.adv_date <= '${this.escapeString(dateTo)}'`;
    }

    // Убираем расширения и создаем LIKE условия
    const likeConditions = videoNames.map(name => {
      // Убираем расширение (.mp4, .mov и т.д.)
      const nameWithoutExt = name.replace(/\.(mp4|avi|mov|mkv|webm|m4v)$/i, '');
      const escaped = this.escapeString(nameWithoutExt);
      return `t.video_name LIKE '%${escaped}%'`;
    }).join(' OR ');

    console.log('📝 LIKE условия сформированы для', videoNames.length, 'названий');

    // Используем тот же формат daily_first4_total
    return `
SELECT 'daily' as kind, video_name, adv_date, leads, cost, clicks, impressions, avg_duration, cost_from_sources, clicks_on_link
FROM (
  SELECT
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
    COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
  FROM ads_collection t
  WHERE (${likeConditions})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data
UNION ALL
SELECT 'first4' as kind, video_name, NULL as adv_date, SUM(leads) as leads, SUM(cost) as cost, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(avg_duration) as avg_duration, SUM(cost_from_sources) as cost_from_sources, SUM(clicks_on_link) as clicks_on_link
FROM (
  SELECT
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
    COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link,
    ROW_NUMBER() OVER (PARTITION BY t.video_name ORDER BY t.adv_date ASC) as rn
  FROM ads_collection t
  WHERE (${likeConditions})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) ranked_daily
WHERE rn <= 4
GROUP BY video_name
UNION ALL
SELECT 'total' as kind, video_name, NULL as adv_date, SUM(leads) as leads, SUM(cost) as cost, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(avg_duration) as avg_duration, SUM(cost_from_sources) as cost_from_sources, SUM(clicks_on_link) as clicks_on_link
FROM (
  SELECT
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
    COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
  FROM ads_collection t
  WHERE (${likeConditions})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data2
GROUP BY video_name
ORDER BY video_name, kind, adv_date`;
  }
}

export class MetricsService {
  /**
   * НОВЫЙ БАТЧЕВЫЙ МЕТОД: Загрузка метрик для множества видео одним запросом
   * С поддержкой чанкинга и параллельных запросов
   */
  static async getBatchVideoMetrics(videoNames, options = {}) {
    const {
      dateFrom = null,
      dateTo = null,
      kind = "daily_first4_total",
      useCache = true,
      timeout = 30000, // Увеличен базовый таймаут
      chunkSize = 50, // Размер батча (50 видео за раз)
    } = options;

    if (!videoNames || videoNames.length === 0) {
      console.warn("⚠️ getBatchVideoMetrics: пустой массив videoNames");
      return { success: false, results: [] };
    }

    console.log(
      `🚀 ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА: ${videoNames.length} видео, батчи по ${chunkSize}`
    );

    const startTime = Date.now();

    try {
      // ============ ЭТАП 1: ТОЧНОЕ СОВПАДЕНИЕ (БАТЧАМИ) ============
      console.log('📍 ЭТАП 1: Поиск по точному совпадению (батчами)...');

      // Разбиваем на чанки
      const exactChunks = this._chunkArray(videoNames, chunkSize);
      console.log(`📦 Разбито на ${exactChunks.length} батчей для точного поиска`);

      // Параллельные запросы для всех чанков
      const exactPromises = exactChunks.map((chunk, index) =>
        this._fetchChunk(chunk, dateFrom, dateTo, kind, timeout, `Exact-${index + 1}`)
      );

      const exactResults = await Promise.all(exactPromises);
      const normalizedExact = exactResults.flat();

      console.log(`✅ ЭТАП 1 завершен: найдено ${normalizedExact.length} записей`);

      // Группируем результаты точного поиска
      const exactGrouped = this._groupBatchResults(normalizedExact, videoNames);

      // Определяем, для каких видео НЕ найдены метрики
      const notFoundVideos = exactGrouped
        .filter(result => !result.found || result.noData)
        .map(result => result.videoName);

      console.log(`📊 Не найдено метрик для ${notFoundVideos.length} из ${videoNames.length} видео`);

      let combinedData = normalizedExact;

      // ============ ЭТАП 2: LIKE ПОИСК (БАТЧАМИ) ============
      if (notFoundVideos.length > 0) {
        console.log('📍 ЭТАП 2: LIKE поиск для не найденных видео (батчами)...');

        // Разбиваем на чанки для LIKE поиска
        const likeChunks = this._chunkArray(notFoundVideos, Math.min(chunkSize, 30)); // Меньше для LIKE
        console.log(`📦 Разбито на ${likeChunks.length} батчей для LIKE поиска`);

        try {
          // Параллельные LIKE запросы
          const likePromises = likeChunks.map((chunk, index) =>
            this._fetchLikeChunk(chunk, dateFrom, dateTo, kind, timeout + 15000, `LIKE-${index + 1}`)
          );

          const likeResults = await Promise.all(likePromises);
          const normalizedLike = likeResults.flat();

          console.log(`✅ ЭТАП 2 завершен: найдено ${normalizedLike.length} записей через LIKE`);

          // Объединяем данные
          combinedData = [...normalizedExact, ...normalizedLike];
        } catch (likeError) {
          console.error('⚠️ Ошибка LIKE поиска:', likeError.message);
          // Продолжаем с результатами точного поиска
        }
      }

      const elapsed = Date.now() - startTime;

      // Финальная группировка всех результатов
      const finalResults = this._groupBatchResults(combinedData, videoNames);

      // Статистика
      const foundCount = finalResults.filter(r => r.found && !r.noData).length;
      const exactFoundCount = exactGrouped.filter(r => r.found && !r.noData).length;

      console.log(`
📊 ИТОГОВАЯ СТАТИСТИКА:
  ✅ Найдено всего: ${foundCount}/${videoNames.length}
  🎯 Точное совпадение: ${exactFoundCount}
  🔍 LIKE поиск: ${foundCount - exactFoundCount}
  ❌ Не найдено: ${videoNames.length - foundCount}
  📦 Батчей обработано: ${exactChunks.length}
  ⏱️ Время: ${elapsed}ms
      `);

      return {
        success: true,
        results: finalResults,
        metadata: {
          elapsed,
          total: videoNames.length,
          found: foundCount,
          exactMatch: exactFoundCount,
          likeMatch: foundCount - exactFoundCount,
          notFound: videoNames.length - foundCount,
          chunksProcessed: exactChunks.length,
        },
      };
    } catch (error) {
      const isTimeout = error.message.includes('Таймаут');
      console.error(`❌ Ошибка загрузки ${isTimeout ? '(TIMEOUT)' : ''}:`, error.message);

      return {
        success: false,
        error: error.message,
        isTimeout: isTimeout,
        results: [],
      };
    }
  }

  /**
   * Разбивка массива на чанки
   */
  static _chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Получение чанка с точным поиском
   */
  static async _fetchChunk(videoNames, dateFrom, dateTo, kind, timeout, label) {
    try {
      console.log(`🔄 ${label}: Загрузка ${videoNames.length} видео...`);

      const sql = SQLBuilder.buildBatchSQL(videoNames, dateFrom, dateTo, kind);
      const data = await this._executeSQLQuery(sql, timeout);
      const normalized = this._normalizeApiResponse(data);

      console.log(`✅ ${label}: Получено ${normalized.length} записей`);
      return normalized;
    } catch (error) {
      console.error(`❌ ${label}: Ошибка -`, error.message);
      return []; // Возвращаем пустой массив при ошибке
    }
  }

  /**
   * Получение чанка с LIKE поиском
   */
  static async _fetchLikeChunk(videoNames, dateFrom, dateTo, kind, timeout, label) {
    try {
      console.log(`🔍 ${label}: LIKE поиск ${videoNames.length} видео...`);

      const sql = SQLBuilder.buildLikeSQL(videoNames, dateFrom, dateTo, kind);
      const data = await this._executeSQLQuery(sql, timeout);
      const normalized = this._normalizeApiResponse(data);

      console.log(`✅ ${label}: Получено ${normalized.length} записей`);
      return normalized;
    } catch (error) {
      console.error(`❌ ${label}: Ошибка -`, error.message);
      return []; // Возвращаем пустой массив при ошибке
    }
  }

  /**
   * Выполнение SQL запроса к API базы данных
   */
  static async _executeSQLQuery(sql, timeout = 30000) {
    console.log('📝 Выполнение SQL запроса, длина:', sql.length, 'байт');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(METRICS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ sql }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const text = await response.text();

      if (!text || !text.trim()) {
        console.log('⚠️ Пустой ответ от API');
        return [];
      }

      return JSON.parse(text);
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        throw new Error(`Таймаут ${timeout}ms превышен`);
      }
      throw fetchError;
    }
  }

  /**
   * Нормализация ответа от API базы данных
   */
  static _normalizeApiResponse(rawData) {
    const normalized = [];

    console.log('🔄 Нормализация ответа от API:', {
      rawDataType: typeof rawData,
      isArray: Array.isArray(rawData),
      length: Array.isArray(rawData) ? rawData.length : 'not array',
    });

    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      console.log('⚠️ Пустой ответ от API');
      return normalized;
    }

    const firstItem = rawData[0];

    // Случай A: Массив объектов {kind: "daily", video_name: "..."}
    if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
      console.log('✅ ФОРМАТ A: Массив объектов');

      rawData.forEach((row, index) => {
        if (!row.video_name) {
          console.warn(`⚠️ Строка ${index} не содержит video_name:`, row);
          return;
        }

        normalized.push({
          kind: row.kind || 'daily',
          video_name: row.video_name,
          adv_date: row.adv_date || null,
          leads: Number(row.leads) || 0,
          cost: Number(row.cost) || 0,
          clicks: Number(row.clicks) || 0,
          impressions: Number(row.impressions) || 0,
          avg_duration: Number(row.avg_duration) || 0,
          cost_from_sources: Number(row.cost_from_sources) || 0,
          clicks_on_link: Number(row.clicks_on_link) || 0,
        });
      });

      console.log(`✅ Нормализовано ${normalized.length} объектов`);
      return normalized;
    }

    // Случай B: Массив массивов [[headers], [row1], [row2], ...]
    if (firstItem && Array.isArray(firstItem)) {
      console.log('✅ ФОРМАТ B: Массив массивов');

      const headers = rawData[0];
      console.log('📋 Headers:', headers);

      const hasVideoName = headers.includes('video_name');
      const hasKind = headers.includes('kind');

      if (!hasVideoName && !hasKind) {
        console.error('❌ Headers не содержат обязательных полей!');
        return normalized;
      }

      const dataRows = rawData.slice(1);

      dataRows.forEach((row, index) => {
        if (!Array.isArray(row)) {
          console.warn(`⚠️ Строка ${index} не массив:`, row);
          return;
        }

        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = row[i];
        });

        if (!obj.video_name) {
          console.warn(`⚠️ Строка ${index} не содержит video_name`);
          return;
        }

        normalized.push({
          kind: obj.kind || 'daily',
          video_name: obj.video_name,
          adv_date: obj.adv_date || null,
          leads: Number(obj.leads) || 0,
          cost: Number(obj.cost) || 0,
          clicks: Number(obj.clicks) || 0,
          impressions: Number(obj.impressions) || 0,
          avg_duration: Number(obj.avg_duration) || 0,
          cost_from_sources: Number(obj.cost_from_sources) || 0,
          clicks_on_link: Number(obj.clicks_on_link) || 0,
        });
      });

      console.log(`✅ Нормализовано ${normalized.length} строк`);
      return normalized;
    }

    console.error('❌ Неизвестный формат данных!');
    return normalized;
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
      isArray: Array.isArray(data),
    });

    // Инициализируем для всех запрошенных видео
    videoNames.forEach((name) => {
      grouped.set(name, {
        videoName: name,
        daily: [],
        first4: null,
        total: null,
        found: false,
        noData: true,
      });
    });

    console.log(`📦 Инициализировано ${grouped.size} видео в Map`);

    if (!data || data.length === 0) {
      console.warn("⚠️ Нет данных для группировки!");
      return Array.from(grouped.values());
    }

    // Детальное логирование первых записей
    console.log("📋 Первые 3 записи из data:");
    for (let i = 0; i < Math.min(3, data.length); i++) {
      console.log(`  [${i}]:`, {
        video_name: data[i].video_name,
        kind: data[i].kind,
        leads: data[i].leads,
        cost: data[i].cost,
        allKeys: Object.keys(data[i]),
      });
    }

    // Логируем первые 3 видео из videoNames
    console.log("📋 Первые 3 названия из videoNames:", videoNames.slice(0, 3));

    // Группируем данные
    let processedCount = 0;
    let skippedNoVideoName = 0;
    let newVideosAdded = 0;

    // 🔥 ДИАГНОСТИКА: Проверяем первые 5 строк из БД API
    if (data && data.length > 0) {
      console.log("🔥🔥🔥 ПЕРВЫЕ 5 СТРОК ИЗ БД API:");
      for (let i = 0; i < Math.min(5, data.length); i++) {
        console.log(`Строка ${i}:`, {
          video_name: data[i].video_name,
          kind: data[i].kind,
          date: data[i].adv_date,
          leads: data[i].leads,
          cost: data[i].cost,
          cost_from_sources: data[i].cost_from_sources,
          clicks_on_link: data[i].clicks_on_link,
          "RAW cost_from_sources": data[i]["cost_from_sources"],
          "RAW clicks_on_link": data[i]["clicks_on_link"],
        });
      }
      console.log("🔥🔥🔥 ВСЕ КЛЮЧИ ПЕРВОЙ СТРОКИ:", Object.keys(data[0]));
    }

    data.forEach((row, index) => {
      const {
        video_name,
        kind,
        adv_date,
        leads,
        cost,
        clicks,
        impressions,
        avg_duration,
      } = row;

      // КРИТИЧНО: Извлекаем дополнительные поля напрямую из объекта
      const cost_from_sources =
        row.cost_from_sources || row["cost_from_sources"] || 0;
      const clicks_on_link = row.clicks_on_link || row["clicks_on_link"] || 0;

      // 🔥 ДИАГНОСТИКА: Логируем первые 3 строки после деструктуризации
      if (index < 3) {
        console.log(`🔥 СТРОКА ${index} ПОСЛЕ ДЕСТРУКТУРИЗАЦИИ:`, {
          video_name,
          kind,
          leads,
          cost,
          cost_from_sources,
          clicks_on_link,
          "RAW row.cost_from_sources": row.cost_from_sources,
          "RAW row.clicks_on_link": row.clicks_on_link,
        });
      }

      if (!video_name) {
        console.warn(`⚠️ Строка ${index} не содержит video_name:`, row);
        skippedNoVideoName++;
        return;
      }

      // КРИТИЧНО: Проверяем точное совпадение
      const hasExactMatch = grouped.has(video_name);

      if (!hasExactMatch) {
        // Проверяем похожие названия для диагностики
        const similarNames = videoNames.filter(
          (name) =>
            name.toLowerCase().includes(video_name.toLowerCase()) ||
            video_name.toLowerCase().includes(name.toLowerCase())
        );

        if (similarNames.length > 0) {
          console.warn(
            `⚠️ Не найдено точное совпадение для "${video_name}", похожие:`,
            similarNames
          );
        } else {
          console.warn(
            `⚠️ Видео "${video_name}" не было в videoNames, добавляем`
          );
        }

        grouped.set(video_name, {
          videoName: video_name,
          daily: [],
          first4: null,
          total: null,
          found: false,
          noData: true,
        });
        newVideosAdded++;
      }

      const entry = grouped.get(video_name);
      entry.found = true;
      entry.noData = false;
      processedCount++;

      // 🔥🔥🔥 КРИТИЧЕСКАЯ ДИАГНОСТИКА ДО создания объекта
      if (index < 3) {
        console.log(`🔥🔥🔥 ПЕРЕД СОЗДАНИЕМ METRICS ОБЪЕКТА ${index}:`, {
          "cost_from_sources (переменная)": cost_from_sources,
          "clicks_on_link (переменная)": clicks_on_link,
          "row.cost_from_sources": row.cost_from_sources,
          "row.clicks_on_link": row.clicks_on_link,
          'row["cost_from_sources"]': row["cost_from_sources"],
          'row["clicks_on_link"]': row["clicks_on_link"],
          "Number(cost_from_sources)": Number(cost_from_sources),
          "Number(clicks_on_link)": Number(clicks_on_link),
          "typeof cost_from_sources": typeof cost_from_sources,
          "typeof clicks_on_link": typeof clicks_on_link,
        });
      }

      const metrics = {
        date: adv_date,
        leads: Number(leads) || 0,
        cost: Number(cost) || 0,
        clicks: Number(clicks) || 0,
        impressions: Number(impressions) || 0,
        avg_duration: Number(avg_duration) || 0,
        cost_from_sources: Number(cost_from_sources) || 0,
        clicks_on_link: Number(clicks_on_link) || 0,
      };

      // 🔥 ДИАГНОСТИКА: Логируем созданный объект metrics для первых 3 строк
      if (index < 3) {
        console.log(`🔥🔥🔥 ОБЪЕКТ METRICS ПОСЛЕ СОЗДАНИЯ ${index}:`, {
          "metrics.cost_from_sources": metrics.cost_from_sources,
          "metrics.clicks_on_link": metrics.clicks_on_link,
          "полный объект": metrics,
        });
      }

      if (kind === "daily") {
        entry.daily.push(metrics);
      } else if (kind === "first4") {
        entry.first4 = metrics;
      } else if (kind === "total") {
        entry.total = metrics;
      }
    });

    console.log(`✅ Обработано ${processedCount} записей`);
    console.log(`⚠️ Пропущено ${skippedNoVideoName} записей без video_name`);
    console.log(
      `➕ Добавлено ${newVideosAdded} новых видео (не было в videoNames)`
    );

    // Детальная статистика
    const foundCount = Array.from(grouped.values()).filter(
      (v) => v.found
    ).length;
    const notFoundCount = grouped.size - foundCount;
    console.log(`📊 ИТОГОВАЯ СТАТИСТИКА:`);
    console.log(`  ✅ Найдено: ${foundCount}`);
    console.log(`  ❌ Не найдено: ${notFoundCount}`);
    console.log(`  📦 Всего в Map: ${grouped.size}`);

    // Логируем примеры не найденных видео
    if (notFoundCount > 0) {
      const notFound = Array.from(grouped.values()).filter((v) => !v.found);
      console.log(
        "❌ Примеры НЕ НАЙДЕННЫХ видео:",
        notFound.slice(0, 3).map((v) => v.videoName)
      );
    }

    return Array.from(grouped.values());
  }

  /**
   * Получение метрик для одного видео (обёртка над батчевым методом)
   */
  static async getVideoMetricsRaw(
    videoName,
    useCache = true,
    creativeId = null,
    videoIndex = null,
    article = null
  ) {
    if (!videoName || typeof videoName !== "string") {
      throw new Error("Название видео обязательно");
    }

    // Проверяем кэш Supabase
    if (useCache && creativeId && videoIndex !== null) {
      try {
        const cached = await metricsAnalyticsService.getMetricsCache(
          creativeId,
          videoIndex,
          "all"
        );
        if (cached && cached.metrics_data) {
          console.log(
            `✅ Загружены метрики из кэша Supabase для: ${videoName}`
          );
          return {
            found: true,
            data: cached.metrics_data,
            fromCache: true,
            cachedAt: cached.cached_at,
          };
        }
      } catch (cacheError) {
        console.warn("⚠️ Ошибка чтения кэша, загружаем из API:", cacheError);
      }
    }

    try {
      console.log(`🔍 Загружаем метрики через батчевый API для: ${videoName}`);

      // Используем батчевый метод для одного видео
      const batchResult = await this.getBatchVideoMetrics([videoName], {
        kind: "daily_first4_total",
        useCache: true,
      });

      if (!batchResult.success || batchResult.results.length === 0) {
        return {
          found: false,
          error: batchResult.error || "Не найдено в базе данных",
        };
      }

      const videoData = batchResult.results[0];

      if (
        !videoData.found ||
        !videoData.daily ||
        videoData.daily.length === 0
      ) {
        return {
          found: false,
          error: "Нет данных активности",
        };
      }

      // 🔥 ДИАГНОСТИКА: Проверяем videoData.daily ДО преобразования
      console.log("🔥 videoData.daily ПЕРВАЯ ЗАПИСЬ:", {
        data: videoData.daily[0],
        allKeys: Object.keys(videoData.daily[0] || {}),
        "RAW cost_from_sources": videoData.daily[0]?.cost_from_sources,
        "RAW clicks_on_link": videoData.daily[0]?.clicks_on_link,
      });

      // Преобразуем к старому формату для совместимости
      const allDailyData = videoData.daily.map((d) => {
        // КРИТИЧНО: Извлекаем дополнительные поля напрямую
        const cost_from_sources =
          d.cost_from_sources || d["cost_from_sources"] || 0;
        const clicks_on_link = d.clicks_on_link || d["clicks_on_link"] || 0;

        console.log("🔥 ВНУТРИ MAP, d:", {
          cost_from_sources: cost_from_sources,
          clicks_on_link: clicks_on_link,
          "RAW d.cost_from_sources": d.cost_from_sources,
          "RAW d.clicks_on_link": d.clicks_on_link,
          allKeys: Object.keys(d),
        });

        return {
          date: d.date,
          leads: d.leads,
          cost: d.cost,
          clicks: d.clicks,
          impressions: d.impressions,
          avg_duration: d.avg_duration,
          cost_from_sources: cost_from_sources,
          clicks_on_link: clicks_on_link,
        };
      });

      // 🔥 ДИАГНОСТИКА: Проверяем allDailyData
      console.log("🔥 allDailyData ПЕРВАЯ ЗАПИСЬ:", allDailyData[0]);

      // Вычисляем метрики для "all"
      const aggregatesAll = this.aggregateDailyData(allDailyData);

      // 🔥 ДИАГНОСТИКА: Проверяем aggregatesAll
      console.log("🔥 aggregatesAll ПОСЛЕ АГРЕГАЦИИ:", {
        cost_from_sources: aggregatesAll.cost_from_sources,
        clicks_on_link: aggregatesAll.clicks_on_link,
      });
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
          period: "all",
          updatedAt: new Date().toLocaleString("ru-RU", {
            timeZone: TIMEZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        fromCache: false,
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
            "all"
          );

          // Период "4days" (если есть first4 в батчевом результате)
          if (videoData.first4) {
            const first4Metrics = {
              leads: videoData.first4.leads,
              cost: videoData.first4.cost,
              clicks: videoData.first4.clicks,
              impressions: videoData.first4.impressions,
              avg_duration: videoData.first4.avg_duration,
              days_count: Math.min(4, allDailyData.length),
            };

            const derivedFirst4 = this.computeDerivedMetrics(first4Metrics);
            const formattedFirst4 = this.formatMetrics(derivedFirst4);

            const data4Days = {
              raw: derivedFirst4,
              formatted: formattedFirst4,
              allDailyData: allDailyData.slice(0, 4),
              dailyData: allDailyData.slice(0, 4),
              videoName: videoName,
              period: "4days",
              updatedAt: result.data.updatedAt,
            };

            await metricsAnalyticsService.saveMetricsCache(
              creativeId,
              article || videoName,
              videoIndex,
              videoName,
              data4Days,
              "4days"
            );

            console.log(`✅ Метрики "4 дня" сохранены в кэш`);
          }
        } catch (saveError) {
          console.error("❌ Ошибка сохранения в кэш:", saveError);
        }
      }

      return result;
    } catch (error) {
      return {
        found: false,
        error: error.message,
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
        error: "Нет сырых данных для фильтрации",
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
          period: targetPeriod,
        },
      };
    }

    const allDailyData =
      rawMetrics.data.allDailyData || rawMetrics.data.dailyData || [];

    if (allDailyData.length === 0) {
      return {
        found: false,
        error: "Нет дневных данных для фильтрации",
      };
    }

    // Мгновенная фильтрация на клиенте
    const filteredData = this.filterDataByPeriod(allDailyData, targetPeriod);

    if (filteredData.length === 0) {
      return {
        found: false,
        error: `Нет данных за период: ${targetPeriod === "4days" ? "первые 4 дня" : targetPeriod
          }`,
      };
    }

    const aggregates = this.aggregateDailyData(filteredData);

    if (
      aggregates.leads === 0 &&
      aggregates.cost === 0 &&
      aggregates.clicks === 0 &&
      aggregates.impressions === 0
    ) {
      return {
        found: false,
        error: "Нет активности за выбранный период",
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
        updatedAt: new Date().toLocaleString("ru-RU", {
          timeZone: TIMEZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    };
  }

  /**
   * Фильтрация дневных данных по периоду
   */
  static filterDataByPeriod(dailyData, period) {
    if (!dailyData || dailyData.length === 0) {
      return [];
    }

    if (period === "all") {
      return dailyData;
    }

    if (period === "4days") {
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
        days_count: 0,
      };
    }

    const result = dailyData.reduce(
      (acc, day) => {
        // КРИТИЧНО: Извлекаем дополнительные поля напрямую
        const cost_from_sources = Number(
          day.cost_from_sources || day["cost_from_sources"] || 0
        );
        const clicks_on_link = Number(
          day.clicks_on_link || day["clicks_on_link"] || 0
        );

        // 🔥 ДИАГНОСТИКА: Логируем каждый day
        if (acc.days_count === 0) {
          console.log("🔥 ПЕРВЫЙ day в reduce:", {
            cost_from_sources: cost_from_sources,
            clicks_on_link: clicks_on_link,
            "RAW day.cost_from_sources": day.cost_from_sources,
            "RAW day.clicks_on_link": day.clicks_on_link,
            allKeys: Object.keys(day),
          });
        }

        return {
          leads: acc.leads + day.leads,
          cost: acc.cost + day.cost,
          clicks: acc.clicks + day.clicks,
          impressions: acc.impressions + day.impressions,
          duration_sum: acc.duration_sum + (day.avg_duration || 0),
          days_count: acc.days_count + 1,
          cost_from_sources: acc.cost_from_sources + cost_from_sources,
          clicks_on_link: acc.clicks_on_link + clicks_on_link,
        };
      },
      {
        leads: 0,
        cost: 0,
        clicks: 0,
        impressions: 0,
        duration_sum: 0,
        days_count: 0,
        cost_from_sources: 0,
        clicks_on_link: 0,
      }
    );

    // 🔥 ДИАГНОСТИКА: Проверяем result после reduce
    console.log("🔥 result ПОСЛЕ reduce:", {
      cost_from_sources: result.cost_from_sources,
      clicks_on_link: result.clicks_on_link,
    });

    const aggregated = {
      leads: result.leads,
      cost: result.cost,
      clicks: result.clicks,
      impressions: result.impressions,
      avg_duration:
        result.days_count > 0 ? result.duration_sum / result.days_count : 0,
      days_count: result.days_count,
      cost_from_sources: result.cost_from_sources,
      clicks_on_link: result.clicks_on_link,
    };

    // 🔥 ДИАГНОСТИКА: Проверяем результат агрегации
    console.log("🔥 РЕЗУЛЬТАТ aggregateDailyData:", {
      cost_from_sources: aggregated.cost_from_sources,
      clicks_on_link: aggregated.clicks_on_link,
    });

    return aggregated;
  }

  /**
   * Вычисление производных метрик
   */
  static computeDerivedMetrics({
    leads,
    cost,
    clicks,
    impressions,
    avg_duration,
    days_count,
    cost_from_sources,
    clicks_on_link,
  }) {
    const fix2 = (x) => (Number.isFinite(x) ? Number(x.toFixed(2)) : 0);

    const CPL = leads > 0 ? cost / leads : 0;
    const CTR = impressions > 0 ? (clicks_on_link / impressions) * 100 : 0;
    const CPC = clicks > 0 ? cost / clicks : 0;
    const CPM = impressions > 0 ? (cost_from_sources / impressions) * 1000 : 0;

    // 🔥🔥🔥 КРИТИЧНО: Сохраняем дополнительные поля
    return {
      leads,
      cost: fix2(cost),
      clicks,
      impressions,
      avg_duration: fix2(avg_duration),
      days_count,
      cost_from_sources: fix2(cost_from_sources || 0),
      clicks_on_link: clicks_on_link || 0,
      cpl: fix2(CPL),
      ctr_percent: fix2(CTR),
      cpc: fix2(CPC),
      cpm: fix2(CPM),
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
      days: formatInt(metrics.days_count) + " дн.",
    };
  }

  /**
   * Проверка статуса API
   */
  static async checkApiStatus() {
    try {
      const response = await fetch(METRICS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          video_names: ["test_api_status_check"],
        }),
      });

      if (response.ok) {
        return { available: true, message: "API работает корректно" };
      } else {
        return {
          available: false,
          message: `API вернул статус ${response.status}`,
        };
      }
    } catch (error) {
      return {
        available: false,
        error: error.message,
        message: "API недоступен",
      };
    }
  }

  /**
   * Получить URL API
   */
  static getApiUrl() {
    return METRICS_API_URL;
  }

  /**
   * Извлечение имени файла без расширения
   */
  static extractVideoName(fileName) {
    if (!fileName) return "";
    const cleanName = fileName.replace(/\.(mp4|avi|mov|mkv|webm|m4v)$/i, "");
    return cleanName.trim();
  }
}

export default MetricsService;
