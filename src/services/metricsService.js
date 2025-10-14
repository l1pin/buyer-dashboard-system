// src/services/metricsService.js - БАТЧЕВАЯ ВЕРСИЯ
// Использует новый оптимизированный API с чанкингом на сервере

import { metricsAnalyticsService } from "../supabaseClient";

const getApiUrl = () => {
  if (
    process.env.NODE_ENV === "production" ||
    window.location.hostname !== "localhost"
  ) {
    return "/.netlify/functions/metrics-proxy";
  }
  return "/.netlify/functions/metrics-proxy";
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
      kind = "daily_first4_total", // daily | first4 | total | daily_first4_total
      useCache = true,
      useLike = false, // 🆕 Режим LIKE поиска
    } = options;

    if (!videoNames || videoNames.length === 0) {
      console.warn("⚠️ getBatchVideoMetrics: пустой массив videoNames");
      return { success: false, results: [] };
    }

    console.log(
      `🚀 БАТЧЕВАЯ загрузка: ${videoNames.length} видео, kind=${kind}, LIKE=${useLike}`
    );

    try {
      // Отправляем один запрос с массивом имён
      const requestBody = {
        video_names: videoNames,
        kind: kind,
        use_like: useLike, // 🆕 Передаем флаг LIKE
      };

      if (dateFrom) requestBody.date_from = dateFrom;
      if (dateTo) requestBody.date_to = dateTo;

      const startTime = Date.now();

      const response = await fetch(METRICS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      console.log(`📥 Получен ответ от API:`, {
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : "not array",
        firstItem: Array.isArray(data) && data.length > 0 ? data[0] : null,
      });
      const elapsed = Date.now() - startTime;

      // Логируем метаданные
      const cacheStatus = response.headers.get("X-Cache");
      const chunksProcessed = response.headers.get("X-Chunks-Processed");
      const totalRecords = response.headers.get("X-Total-Records");

      console.log(`✅ БАТЧЕВАЯ загрузка завершена за ${elapsed}ms:`, {
        cache: cacheStatus,
        chunks: chunksProcessed,
        records: totalRecords || data.length,
        videosRequested: videoNames.length,
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
          records: data.length,
        },
      };
    } catch (error) {
      console.error("❌ Ошибка батчевой загрузки:", error);
      return {
        success: false,
        error: error.message,
        results: [],
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

      const metrics = {
        date: adv_date,
        leads: Number(row.valid) || 0,
        cost: Number(cost) || 0,
        clicks: Number(row.clicks_on_link_tracker) || 0,
        impressions: Number(row.showed) || 0,
        avg_duration: Number(row.average_time_on_video) || 0,
        cost_from_sources: Number(row.cost_from_sources) || 0,
        clicks_on_link: Number(row.clicks_on_link) || 0,
      };

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

      // Преобразуем к старому формату для совместимости
      const allDailyData = videoData.daily.map((d) => ({
        date: d.date,
        leads: d.valid || d.leads,
        cost: d.cost,
        clicks: d.clicks_on_link_tracker || d.clicks,
        impressions: d.showed || d.impressions,
        avg_duration: d.average_time_on_video || d.avg_duration,
        cost_from_sources: d.cost_from_sources,
        clicks_on_link: d.clicks_on_link,
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
        error: `Нет данных за период: ${
          targetPeriod === "4days" ? "первые 4 дня" : targetPeriod
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
        cost_from_sources: 0,
        clicks_on_link: 0,
      };
    }

    const result = dailyData.reduce(
      (acc, day) => ({
        valid: acc.valid + day.valid,
        cost: acc.cost + day.cost,
        clicks_on_link_tracker:
          acc.clicks_on_link_tracker + day.clicks_on_link_tracker,
        showed: acc.showed + day.showed,
        duration_sum: acc.duration_sum + (day.average_time_on_video || 0),
        days_count: acc.days_count + 1,
        cost_from_sources: acc.cost_from_sources + (day.cost_from_sources || 0),
        clicks_on_link: acc.clicks_on_link + (day.clicks_on_link || 0),
      }),
      {
        valid: 0,
        cost: 0,
        clicks_on_link_tracker: 0,
        showed: 0,
        duration_sum: 0,
        days_count: 0,
        cost_from_sources: 0,
        clicks_on_link: 0,
      }
    );

    return {
      valid: result.valid,
      cost: result.cost,
      clicks_on_link_tracker: result.clicks_on_link_tracker,
      showed: result.showed,
      average_time_on_video:
        result.days_count > 0 ? result.duration_sum / result.days_count : 0,
      days_count: result.days_count,
      cost_from_sources: result.cost_from_sources,
      clicks_on_link: result.clicks_on_link,
    };
  }

  /**
   * Вычисление производных метрик
   */
  static computeDerivedMetrics({
    valid,
    cost,
    clicks_on_link_tracker,
    showed,
    average_time_on_video,
    days_count,
    cost_from_sources,
    clicks_on_link,
  }) {
    const fix2 = (x) => (Number.isFinite(x) ? Number(x.toFixed(2)) : 0);

    const CPL = valid > 0 ? cost / valid : 0;
    const CTR = showed > 0 ? (clicks_on_link / showed) * 100 : 0;
    const CPC = clicks_on_link > 0 ? cost_from_sources / clicks_on_link : 0;
    const CPM = showed > 0 ? (cost_from_sources / showed) * 1000 : 0;

    return {
      valid,
      cost: fix2(cost),
      clicks_on_link_tracker,
      showed,
      average_time_on_video: fix2(average_time_on_video),
      days_count,
      cost_from_sources: fix2(cost_from_sources),
      clicks_on_link,
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
      leads: formatInt(metrics.valid),
      cpl: formatMoney(metrics.cpl),
      cost: formatMoney(metrics.cost),
      ctr: formatPercent(metrics.ctr_percent),
      cpc: formatMoney(metrics.cpc),
      cpm: formatMoney(metrics.cpm),
      clicks: formatInt(metrics.clicks_on_link_tracker),
      impressions: formatInt(metrics.showed),
      avg_duration: formatDuration(metrics.average_time_on_video),
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
