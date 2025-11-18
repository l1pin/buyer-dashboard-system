/**
 * Скрипт для расчёта оставшихся дней продаж на основе всей истории из SQL-API
 * – Достаём сначала MIN(adv_date), затем по месяцам всё накопительно
 * – Экспоненциальное сглаживание прогноза
 * – Возвращает результаты для обновления метрик
 */

// Используем Netlify Function для обхода CORS
const CORE_URL = '/.netlify/functions/sql-proxy';

/**
 * Рассчитывает оставшиеся дни продаж для массива метрик
 *
 * @param {Array} metrics - Массив метрик офферов
 * @returns {Promise<Object>} - Объект с обновленными метриками и статистикой
 */
export const calculateRemainingDays = async (metrics) => {
  try {
    console.log('🔄 Начинаем расчет оставшихся дней продаж...');

    // Получаем всю историю по частям
    const tracker = await fetchTrackerAll();
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
            days_remaining: 'недостаточно дней для анализа',
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
          days_remaining: Number(days.toFixed(2)),
          days_remaining_value: Number(days.toFixed(2))
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

    return {
      metrics: updatedMetrics,
      processedCount: processedCount,
      totalArticles: Object.keys(forecastMap).length
    };

  } catch (error) {
    console.error('❌ Ошибка расчета дней продаж:', error);
    throw error;
  }
};

/**
 * Достаёт данные за последние 12 месяцев с АГРЕГАЦИЕЙ на SQL сервере.
 * КРИТИЧЕСКИЕ ОПТИМИЗАЦИИ под лимиты Netlify Functions (6MB на ответ):
 * 1. ДВОЙНАЯ агрегация SQL: GROUP BY + округление дат до недель
 * 2. Последовательные запросы по месяцам (не параллельно из-за лимита)
 * 3. Задержки между запросами для снижения нагрузки
 */
async function fetchTrackerAll() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 12);

  // Создаём периоды по 1 месяцу
  const periods = createMonthlyPeriods(start, end);

  console.log(`📅 Будет загружено ${periods.length} месяцев (последовательно)`);

  let all = [];
  let successCount = 0;
  let failedPeriods = [];
  const DELAY_BETWEEN_REQUESTS = 500; // 0.5 сек между запросами

  // ПОСЛЕДОВАТЕЛЬНАЯ загрузка по месяцам
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];

    // SQL с ДВОЙНОЙ агрегацией:
    // 1. DATE(adv_date) - группировка по дням
    // 2. SUM() - суммирование лидов и расходов
    const sql = `
      SELECT
        offer_name,
        DATE(adv_date) as adv_date,
        SUM(valid) as total_leads,
        SUM(cost) as total_cost
      FROM ads_collection
      WHERE adv_date BETWEEN '${p.from}' AND '${p.to}'
        AND cost > 0
      GROUP BY offer_name, DATE(adv_date)
    `;

    console.log(`📦 [${i + 1}/${periods.length}] ${p.from}..${p.to}`);

    try {
      const chunk = await getDataBySql(sql);
      console.log(`  ✅ ${chunk.length} строк`);

      const mapped = chunk.map(it => ({
        offer: it.offer_name || '',
        date: new Date(it.adv_date),
        leads: Number(it.total_leads) || 0,
        cost: Number(it.total_cost) || 0
      }));

      all = all.concat(mapped);
      successCount++;

      // Задержка между запросами для снижения нагрузки
      if (i < periods.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }

    } catch (error) {
      console.warn(`  ⚠️ Пропуск: ${error.message.substring(0, 100)}`);
      failedPeriods.push(`${p.from}..${p.to}`);

      // Продолжаем даже при ошибке
      continue;
    }
  }

  if (failedPeriods.length > 0) {
    console.warn(`⚠️ Пропущено ${failedPeriods.length}/${periods.length} месяцев`);
  }

  console.log(`✅ Загружено ${all.length} записей за ${successCount}/${periods.length} месяцев`);

  return all;
}

/**
 * Создаёт периоды по 1 месяцу для последовательной загрузки
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
 */
function buildTrackerIndex(tracker) {
  const map = {};
  let processedCount = 0;
  let skippedNoCost = 0;
  let skippedNoOffer = 0;

  tracker.forEach(({ offer, date, leads, cost }) => {
    if (!offer) {
      skippedNoOffer++;
      return;
    }

    if (cost <= 0) {
      skippedNoCost++;
      return;
    }

    const art = extractArticle(offer);

    if (!map[art]) {
      map[art] = [];
    }

    map[art].push({ date, leads });
    processedCount++;
  });

  console.log(`🔍 buildTrackerIndex: обработано ${processedCount}, пропущено без offer: ${skippedNoOffer}, пропущено без cost: ${skippedNoCost}`);

  // Выводим примеры извлеченных артикулов
  const sampleOffers = tracker
    .filter(t => t.offer && t.cost > 0)
    .slice(0, 5);

  if (sampleOffers.length > 0) {
    console.log('📋 Примеры извлечения артикулов:');
    sampleOffers.forEach(({ offer }) => {
      console.log(`  "${offer}" -> "${extractArticle(offer)}"`);
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
