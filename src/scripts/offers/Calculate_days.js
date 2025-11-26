/**
 * ОПТИМИЗИРОВАННЫЙ скрипт для расчёта оставшихся дней продаж
 *
 * ПРОИЗВОДИТЕЛЬНОСТЬ v2.0:
 * – 🚀 4 запроса по 3 месяца вместо 12 по 1 месяцу (меньше HTTP overhead)
 * – 🚀 Улучшенная retry логика с exponential backoff (до 4 попыток)
 * – 🚀 Кэширование в localStorage (TTL 30 минут)
 * – 🚀 Инкрементальное обновление (только последние 14 дней)
 * – 🚀 Фильтрует по offer_id_tracker сразу в SQL (WHERE IN)
 * – 🚀 Выполняет запросы параллельно (Promise.all)
 *
 * ФУНКЦИОНАЛ:
 * – Загружает историю за 12 месяцев из SQL БД
 * – Экспоненциальное сглаживание прогноза (α = 0.3)
 * – Рассчитывает оставшиеся дни продаж: stock / прогноз
 * – Использует offer_id_tracker из БД API и маппинг article_offer_mapping
 */

// Используем Netlify Function для обхода CORS
const CORE_URL = '/.netlify/functions/sql-proxy';

// Ключи для кэширования
const CACHE_KEY = 'metrics_sql_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 минут
const INCREMENTAL_DAYS = 14; // Дней для инкрементального обновления

/**
 * Рассчитывает оставшиеся дни продаж для массива метрик
 *
 * @param {Array} metrics - Массив метрик офферов
 * @param {Object} articleOfferMap - Маппинг article -> offer_id из article_offer_mapping
 * @returns {Promise<Object>} - Объект с обновленными метриками и статистикой
 */
export const calculateRemainingDays = async (metrics, articleOfferMap = {}) => {
  try {
    console.log('🔄 Начинаем расчет оставшихся дней продаж...');

    // 🔍 ДИАГНОСТИКА: Проверяем совпадение артикулов metrics с articleOfferMap
    const mappingArticles = Object.keys(articleOfferMap);
    const metricsArticles = metrics.filter(m => m.article).map(m => m.article);

    const matchedArticles = metricsArticles.filter(a => articleOfferMap[a]);
    const unmatchedArticles = metricsArticles.filter(a => !articleOfferMap[a]);

    console.log(`📊 Проверка маппинга:`);
    console.log(`   - Артикулов в маппинге: ${mappingArticles.length}`);
    console.log(`   - Артикулов в метриках: ${metricsArticles.length}`);
    console.log(`   - Совпадений: ${matchedArticles.length}`);
    console.log(`   - Без маппинга: ${unmatchedArticles.length}`);

    if (matchedArticles.length === 0 && metricsArticles.length > 0 && mappingArticles.length > 0) {
      console.warn(`⚠️ ВНИМАНИЕ: Артикулы в маппинге НЕ совпадают с артикулами в метриках!`);
      console.warn(`   Примеры артикулов в маппинге: ${mappingArticles.slice(0, 5).join(', ')}`);
      console.warn(`   Примеры артикулов в метриках: ${metricsArticles.slice(0, 5).join(', ')}`);
      console.warn(`   💡 Решение: В модальном окне "Миграция" введите артикулы из метрик (первый столбец) и соответствующие offer_id.`);
    }

    // Создаем обратный маппинг: offer_id -> article (для тех кто совпал)
    const offerIdArticleMap = {};
    Object.keys(articleOfferMap).forEach(article => {
      const offerId = articleOfferMap[article];
      offerIdArticleMap[offerId] = article;
    });
    console.log(`📊 Загружено ${Object.keys(offerIdArticleMap).length} маппингов Offer ID -> Артикул`);

    // Получаем всю историю по частям (с фильтрацией по offer_id)
    const tracker = await fetchTrackerAll(offerIdArticleMap);
    console.log(`Всего строк истории: ${tracker.length}`);

    // Группируем по артикулу
    const index = buildTrackerIndex(tracker);

    // Экспоненциальное сглаживание (α = 0.3)
    const alpha = 0.3;
    const forecastMap = {};

    Object.keys(index).forEach(art => {
      const arr = index[art];
      if (arr.length < 10) return; // Недостаточно данных

      // Сортируем по дате
      arr.sort((a, b) => a.date - b.date);

      // Применяем экспоненциальное сглаживание
      let f = arr[0].leads;
      arr.forEach(({ leads }) => {
        f = alpha * leads + (1 - alpha) * f;
      });

      forecastMap[art] = Math.max(f, 0.1);
    });

    console.log(`Ключей в forecastMap: ${Object.keys(forecastMap).length}`);

    // Отладка: выводим примеры артикулов
    const forecastArticles = Object.keys(forecastMap).slice(0, 5);
    console.log('📋 Примеры артикулов в forecastMap:', forecastArticles);

    const sampleMetricsArticles = metrics
      .filter(m => m.article)
      .slice(0, 5)
      .map(m => m.article);
    console.log('📋 Примеры артикулов в метриках:', sampleMetricsArticles);

    // Подсчет метрик с наличием артикула и остатков
    const activeMetrics = metrics.filter(m => m.article && m.stock_quantity != null);
    console.log(`📊 Активных метрик для обработки: ${activeMetrics.length}`);

    // Отладка: проверяем совпадения
    let matchedCount = 0;
    let notFoundCount = 0;

    // Обновляем метрики с рассчитанными днями
    const updatedMetrics = metrics.map(metric => {
      const article = metric.article;
      const stock = metric.stock_quantity;

      if (article && stock != null) {
        const forecast = forecastMap[article];

        if (!forecast) {
          notFoundCount++;
          if (notFoundCount <= 5) {
            console.log(`⚠️ Не найден прогноз для артикула: "${article}"`);
          }
          return {
            ...metric,
            days_remaining: 'Нет данных',
            days_remaining_value: null
          };
        }

        matchedCount++;

        const days = stock / forecast;

        if (days < 0) {
          return {
            ...metric,
            days_remaining: 'тренд указывает на падение продаж',
            days_remaining_value: null
          };
        }

        return {
          ...metric,
          days_remaining: Math.round(days),
          days_remaining_value: Math.round(days)
        };
      }

      return {
        ...metric,
        days_remaining: null,
        days_remaining_value: null
      };
    });

    console.log(`📊 Статистика совпадений: найдено ${matchedCount}, не найдено ${notFoundCount}`);

    const processedCount = updatedMetrics.filter(m => m.days_remaining_value !== null).length;
    console.log(`✅ Обработано офферов: ${processedCount}`);

    // 🎯 ОПТИМИЗАЦИЯ: Возвращаем сырые данные для повторного использования в Sql_leads.js
    console.log(`📦 Возвращаем ${tracker.length} агрегированных записей (с source_id) для CPL/Лидов/Рейтинга`);

    return {
      metrics: updatedMetrics,
      processedCount: processedCount,
      totalArticles: Object.keys(forecastMap).length,
      rawData: tracker // Агрегированные данные за 12 месяцев с source_id_tracker
    };

  } catch (error) {
    console.error('❌ Ошибка расчета дней продаж:', error);
    throw error;
  }
};

/**
 * 🚀 ОПТИМИЗИРОВАННАЯ ФУНКЦИЯ загрузки данных за 12 месяцев
 *
 * ОПТИМИЗАЦИИ v2.0:
 * - 4 запроса по 3 месяца вместо 12 по 1 (меньше HTTP overhead)
 * - Кэширование в localStorage с TTL 30 минут
 * - Инкрементальное обновление (только последние 14 дней при наличии кэша)
 * - Улучшенная retry логика с exponential backoff
 *
 * @param {Object} offerIdArticleMap - Обратный маппинг offer_id -> article
 */
async function fetchTrackerAll(offerIdArticleMap = {}) {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 12);

  // Получаем список всех offer_id из маппинга
  const offerIds = Object.keys(offerIdArticleMap);

  if (offerIds.length === 0) {
    console.warn('⚠️ Маппинг пуст! Невозможно загрузить данные без Offer ID');
    return [];
  }

  console.log(`📊 Будем фильтровать по ${offerIds.length} Offer ID`);

  // 🎯 ОПТИМИЗАЦИЯ: Проверяем кэш
  const cached = getCachedData();
  const now = Date.now();

  if (cached && cached.data && cached.timestamp) {
    const cacheAge = now - cached.timestamp;
    const cacheAgeMinutes = Math.round(cacheAge / 60000);

    if (cacheAge < CACHE_TTL) {
      console.log(`📦 Используем кэш (возраст: ${cacheAgeMinutes} мин), загружаем только последние ${INCREMENTAL_DAYS} дней...`);

      // Инкрементальная загрузка - только последние 14 дней
      const incrementalData = await fetchIncrementalData(offerIdArticleMap);

      if (incrementalData.length > 0) {
        // Объединяем: старые данные (без последних 14 дней) + новые данные
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - INCREMENTAL_DAYS);

        const oldData = cached.data.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate < cutoffDate;
        });

        const mergedData = [...oldData, ...incrementalData];
        console.log(`✅ Инкрементальное обновление: ${oldData.length} старых + ${incrementalData.length} новых = ${mergedData.length} записей`);

        // Обновляем кэш
        saveCachedData(mergedData);

        return mergedData;
      }

      // Если инкрементальная загрузка не удалась, используем кэш как есть
      console.log(`📦 Используем полный кэш (${cached.data.length} записей)`);
      return cached.data;
    } else {
      console.log(`⏰ Кэш устарел (${cacheAgeMinutes} мин > ${CACHE_TTL / 60000} мин), загружаем заново...`);
    }
  }

  // Полная загрузка
  return await fetchFullData(offerIdArticleMap, start, end);
}

/**
 * Инкрементальная загрузка последних N дней
 */
async function fetchIncrementalData(offerIdArticleMap) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - INCREMENTAL_DAYS);

  const offerIds = Object.keys(offerIdArticleMap);
  const offerIdsList = offerIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

  console.log(`⚡ Инкрементальная загрузка: ${formatDate(start)} - ${formatDate(end)}`);

  const sql = `
    SELECT
      offer_id_tracker,
      DATE(adv_date) as adv_date,
      SUM(valid) as total_leads,
      SUM(cost) as total_cost,
      source_id_tracker
    FROM ads_collection
    WHERE adv_date BETWEEN '${formatDate(start)}' AND '${formatDate(end)}'
      AND offer_id_tracker IN (${offerIdsList})
      AND cost > 0
    GROUP BY offer_id_tracker, DATE(adv_date), source_id_tracker
  `;

  try {
    const chunk = await getDataBySql(sql);
    console.log(`✅ Инкрементально загружено: ${chunk.length} записей`);

    return chunk.map(it => ({
      article: offerIdArticleMap[it.offer_id_tracker] || '',
      offerId: it.offer_id_tracker || '',
      date: new Date(it.adv_date),
      leads: Number(it.total_leads) || 0,
      cost: Number(it.total_cost) || 0,
      source_id: it.source_id_tracker || 'unknown'
    }));
  } catch (error) {
    console.warn(`⚠️ Ошибка инкрементальной загрузки: ${error.message}`);
    return [];
  }
}

/**
 * Полная загрузка данных за 12 месяцев (6 периодов по 2 месяца)
 * Уменьшены периоды для избежания "Response payload size exceeded" на Netlify
 */
async function fetchFullData(offerIdArticleMap, start, end) {
  const offerIds = Object.keys(offerIdArticleMap);
  const offerIdsList = offerIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

  // 🚀 ОПТИМИЗАЦИЯ: 6 периодов по 2 месяца (вместо 4 по 3 - слишком большие ответы!)
  const periods = createBiMonthlyPeriods(start, end);

  console.log(`📅 Загрузка ${periods.length} периодов (по 2 месяца) ПАРАЛЛЕЛЬНО...`);

  // Запускаем все запросы параллельно
  const promises = periods.map(async (p, i) => {
    const sql = `
      SELECT
        offer_id_tracker,
        DATE(adv_date) as adv_date,
        SUM(valid) as total_leads,
        SUM(cost) as total_cost,
        source_id_tracker
      FROM ads_collection
      WHERE adv_date BETWEEN '${p.from}' AND '${p.to}'
        AND offer_id_tracker IN (${offerIdsList})
        AND cost > 0
      GROUP BY offer_id_tracker, DATE(adv_date), source_id_tracker
    `;

    console.log(`📦 [${i + 1}/${periods.length}] ${p.from}..${p.to}`);

    try {
      const chunk = await getDataBySql(sql);
      console.log(`  ✅ ${chunk.length} строк`);

      const mapped = chunk.map(it => ({
        article: offerIdArticleMap[it.offer_id_tracker] || '',
        offerId: it.offer_id_tracker || '',
        date: new Date(it.adv_date),
        leads: Number(it.total_leads) || 0,
        cost: Number(it.total_cost) || 0,
        source_id: it.source_id_tracker || 'unknown'
      }));

      return { success: true, data: mapped, period: `${p.from}..${p.to}` };
    } catch (error) {
      console.warn(`  ⚠️ Пропуск ${p.from}..${p.to}: ${error.message.substring(0, 100)}`);
      return { success: false, data: [], period: `${p.from}..${p.to}`, error: error.message };
    }
  });

  // Ждем завершения всех запросов
  const results = await Promise.all(promises);

  // Собираем данные
  let all = [];
  let successCount = 0;
  let failedPeriods = [];

  results.forEach(result => {
    if (result.success) {
      all = all.concat(result.data);
      successCount++;
    } else {
      failedPeriods.push(result.period);
    }
  });

  if (failedPeriods.length > 0) {
    console.warn(`⚠️ Пропущено ${failedPeriods.length}/${periods.length} периодов: ${failedPeriods.join(', ')}`);
  }

  console.log(`✅ Загружено ${all.length} записей за ${successCount}/${periods.length} периодов 🚀`);

  // НЕ сохраняем в localStorage если данных слишком много (> 50000 записей или > 5MB)
  if (all.length < 50000) {
    saveCachedData(all);
  } else {
    console.log(`⚠️ Кэш не сохранён: слишком много данных (${all.length} записей)`);
  }

  return all;
}

/**
 * Создаёт периоды по 3 месяца (4 запроса на 12 месяцев)
 * Меньше HTTP overhead, но достаточно маленькие для избежания 502
 */
function createQuarterlyPeriods(start, end) {
  const periods = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cur <= end) {
    const from = formatDate(cur);

    // Добавляем 3 месяца (последний день)
    const tmp = new Date(cur.getFullYear(), cur.getMonth() + 3, 0);

    if (tmp > end) {
      tmp.setTime(end.getTime());
    }

    const to = formatDate(tmp);
    periods.push({ from, to });

    // Следующий квартал
    cur.setMonth(cur.getMonth() + 3);
  }

  return periods;
}

/**
 * Получает кэшированные данные из localStorage
 */
function getCachedData() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached);

    // Восстанавливаем даты
    if (parsed.data) {
      parsed.data = parsed.data.map(item => ({
        ...item,
        date: new Date(item.date)
      }));
    }

    return parsed;
  } catch (error) {
    console.warn('⚠️ Ошибка чтения кэша:', error.message);
    return null;
  }
}

/**
 * Сохраняет данные в кэш localStorage
 */
function saveCachedData(data) {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data: data
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log(`💾 Кэш сохранён: ${data.length} записей`);
  } catch (error) {
    console.warn('⚠️ Ошибка сохранения кэша:', error.message);
    // Если localStorage переполнен, очищаем старые данные
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (e) {}
  }
}

/**
 * Создаёт периоды по 2 месяца для параллельной загрузки
 * 12 месяцев = 6 запросов (баланс между скоростью и размером ответа)
 * Предотвращает HTTP 502 из-за превышения размера ответа
 */
function createBiMonthlyPeriods(start, end) {
  const periods = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cur <= end) {
    const from = formatDate(cur);

    // Добавляем 2 месяца
    const tmp = new Date(cur.getFullYear(), cur.getMonth() + 2, 0);

    if (tmp > end) {
      tmp.setTime(end.getTime());
    }

    const to = formatDate(tmp);
    periods.push({ from, to });

    // Следующий период (+2 месяца)
    cur.setMonth(cur.getMonth() + 2);
  }

  return periods;
}

/**
 * Создаёт периоды по 1 месяцу для параллельной загрузки
 * 12 месяцев = 12 запросов (с GROUP BY размер ответа приемлемый)
 */
function createMonthlyPeriods(start, end) {
  const periods = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cur <= end) {
    const from = formatDate(cur);

    // Последний день месяца
    const tmp = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);

    if (tmp > end) {
      tmp.setTime(end.getTime());
    }

    const to = formatDate(tmp);
    periods.push({ from, to });

    // Следующий месяц
    cur.setMonth(cur.getMonth() + 1);
  }

  return periods;
}

/**
 * 🚀 УЛУЧШЕННАЯ функция запроса к SQL API
 *
 * ОПТИМИЗАЦИИ:
 * - 4 попытки с exponential backoff (2s, 4s, 8s, 16s)
 * - Таймаут 45 секунд (для больших запросов)
 * - Обработка 502, 503, 504, таймаутов и сетевых ошибок
 */
async function getDataBySql(strSQL, retryCount = 0) {
  const MAX_RETRIES = 4; // 4 попытки для устойчивости
  const RETRY_DELAY = 2000; // Стартовая задержка 2 секунды
  const FETCH_TIMEOUT = 45000; // Таймаут 45 секунд для больших запросов

  try {
    // Создаём контроллер для отмены по таймауту
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const startTime = performance.now();

    const response = await fetch(CORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: strSQL }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const code = response.status;
    const text = await response.text();
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

    console.log(`HTTP ${code}, ${(text.length / 1024).toFixed(0)}KB за ${elapsed}с`);

    // Если 500, 502, 503, 504 - пробуем повторить
    if ([500, 502, 503, 504].includes(code) && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Экспоненциальный backoff: 2s, 4s, 8s, 16s
      console.log(`⚠️ HTTP ${code}, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay / 1000}с...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return getDataBySql(strSQL, retryCount + 1);
    }

    if (code !== 200) {
      throw new Error(`HTTP ${code}: ${text.substring(0, 100)}`);
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }

    if (json.error) {
      throw new Error(`API error: ${json.error}`);
    }

    if (!Array.isArray(json)) {
      throw new Error('Неподдерживаемый формат данных');
    }

    // если заголовки в первой строке
    if (Array.isArray(json[0])) {
      const [headers, ...rows] = json;
      return rows.map(row =>
        headers.reduce((o, h, i) => {
          o[h] = row[i];
          return o;
        }, {})
      );
    }

    return json;
  } catch (error) {
    // Обработка таймаутов и сетевых ошибок
    if (retryCount < MAX_RETRIES) {
      const isTimeout = error.name === 'AbortError';
      const isNetworkError = error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed');

      if (isTimeout || isNetworkError) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        const errorType = isTimeout ? 'Таймаут' : 'Сетевая ошибка';
        console.log(`⚠️ ${errorType}, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay / 1000}с...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return getDataBySql(strSQL, retryCount + 1);
      }
    }
    throw error;
  }
}

/**
 * Группирует записи по артикулу
 * ОПТИМИЗИРОВАННАЯ ВЕРСИЯ: использует article напрямую (уже получен из маппинга)
 */
function buildTrackerIndex(tracker) {
  const map = {};
  let processedCount = 0;
  let skippedNoCost = 0;
  let skippedNoArticle = 0;

  tracker.forEach(({ article, date, leads, cost }) => {
    if (!article) {
      skippedNoArticle++;
      return;
    }

    if (cost <= 0) {
      skippedNoCost++;
      return;
    }

    if (!map[article]) {
      map[article] = [];
    }

    map[article].push({ date, leads });
    processedCount++;
  });

  console.log(`🔍 buildTrackerIndex: обработано ${processedCount}, пропущено без article: ${skippedNoArticle}, пропущено без cost: ${skippedNoCost}`);

  // Выводим примеры артикулов
  const sampleArticles = tracker
    .filter(t => t.article && t.cost > 0)
    .slice(0, 5);

  if (sampleArticles.length > 0) {
    console.log('📋 Примеры артикулов из маппинга:');
    sampleArticles.forEach(({ article, offerId }) => {
      console.log(`  Offer ID: "${offerId}" -> Артикул: "${article}"`);
    });
  }

  return map;
}

/**
 * Извлекает артикул из названия оффера
 * Формат: "C01829 - Жіноча блуза" -> "C01829"
 */
function extractArticle(offer) {
  if (!offer) return '';
  const match = offer.match(/^([A-Za-z0-9_-]+)(?:\s|$)/);
  return match ? match[1] : offer.split(/[\s-]/)[0];
}

/**
 * Форматирует дату в формат YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
