/**
 * ОПТИМИЗИРОВАННЫЙ скрипт для расчёта оставшихся дней продаж
 *
 * ПРОИЗВОДИТЕЛЬНОСТЬ:
 * – 🚀 Фильтрует по offer_id_tracker сразу в SQL (WHERE IN) - индекс работает эффективно
 * – 🚀 Выполняет запросы параллельно (Promise.all) вместо последовательно
 * – 🚀 Загружает только нужные offer_id, а не всю таблицу
 *
 * ФУНКЦИОНАЛ:
 * – Загружает историю за 12 месяцев из SQL БД
 * – Экспоненциальное сглаживание прогноза (α = 0.3)
 * – Рассчитывает оставшиеся дни продаж: stock / прогноз
 * – Использует offer_id_tracker из БД API и маппинг article_offer_mapping
 */

// Прямой доступ к API (CORS включен на сервере)
const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

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

    // Создаем обратный маппинг: offer_id -> article
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

    const metricsArticles = metrics
      .filter(m => m.article)
      .slice(0, 5)
      .map(m => m.article);
    console.log('📋 Примеры артикулов в метриках:', metricsArticles);

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
 * Достаёт данные за последние 12 месяцев с АГРЕГАЦИЕЙ на SQL сервере.
 * ОПТИМИЗИРОВАННАЯ ВЕРСИЯ:
 * - Фильтрует по offer_id_tracker сразу в SQL (WHERE IN) - индекс работает эффективно
 * - Выполняет запросы ПАРАЛЛЕЛЬНО (Promise.all) вместо последовательно
 * - Агрегирует данные на SQL уровне (GROUP BY)
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

  // Создаём SQL список для IN clause
  const offerIdsList = offerIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

  // 🚀 ОПТИМИЗАЦИЯ: Создаём периоды по 1 месяцу
  // 12 месяцев = 12 запросов, но с GROUP BY размер ответа приемлемый
  const periods = createMonthlyPeriods(start, end);

  console.log(`📅 Загрузка ${periods.length} периодов (по 1 месяцу) ПАРАЛЛЕЛЬНО...`);

  // 🚀 КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ: Запускаем все запросы параллельно
  const promises = periods.map(async (p, i) => {
    // 🎯 ОПТИМИЗАЦИЯ: GROUP BY с source_id_tracker для повторного использования в Sql_leads.js
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

    console.log(`📦 [${i + 1}/${periods.length}] ${p.from}..${p.to} (параллельно)`);

    try {
      const chunk = await getDataBySql(sql);
      console.log(`  ✅ ${chunk.length} строк`);

      const mapped = chunk.map(it => {
        const offerId = it.offer_id_tracker || '';
        const article = offerIdArticleMap[offerId] || '';

        return {
          article: article,
          offerId: offerId,
          date: new Date(it.adv_date),
          leads: Number(it.total_leads) || 0,
          cost: Number(it.total_cost) || 0,
          source_id: it.source_id_tracker || 'unknown' // Для метрик байеров и повторного использования
        };
      });

      return { success: true, data: mapped, period: `${p.from}..${p.to}` };
    } catch (error) {
      console.warn(`  ⚠️ Пропуск ${p.from}..${p.to}: ${error.message.substring(0, 100)}`);
      return { success: false, data: [], period: `${p.from}..${p.to}`, error: error.message };
    }
  });

  // Ждем завершения всех запросов параллельно
  const results = await Promise.all(promises);

  // Собираем данные и статистику
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

  console.log(`✅ Загружено ${all.length} записей за ${successCount}/${periods.length} периодов - ПАРАЛЛЕЛЬНО 🚀`);

  return all;
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
 * Универсальный fetch + преобразование [[headers], [row], …] → [{…},…]
 * С УЛУЧШЕННОЙ retry логикой и обработкой таймаутов
 */
async function getDataBySql(strSQL, retryCount = 0) {
  const MAX_RETRIES = 2; // 2 попытки для быстрого fail-over при последовательных запросах
  const RETRY_DELAY = 1500; // Стартовая задержка 1.5 секунды
  const FETCH_TIMEOUT = 20000; // Таймаут fetch 20 секунд

  try {
    // Создаём контроллер для отмены по таймауту
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

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

    console.log(`HTTP ${code}, ответ ${(text.length / 1024).toFixed(0)}KB`);

    // Если 500, 502, 503, 504 - пробуем повторить
    if ([500, 502, 503, 504].includes(code) && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Экспоненциальный backoff: 2s, 4s, 8s, 16s
      console.log(`⚠️ HTTP ${code}, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
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
      const isNetworkError = error.message.includes('fetch') || error.message.includes('network');

      if (isTimeout || isNetworkError) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        const errorType = isTimeout ? 'Таймаут' : 'Сетевая ошибка';
        console.log(`⚠️ ${errorType}, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
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
