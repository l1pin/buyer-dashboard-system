/**
 * ОПТИМИЗИРОВАННЫЙ скрипт для получения данных о лидах и рейтинга из SQL базы данных
 *
 * ПРОИЗВОДИТЕЛЬНОСТЬ:
 * – 🚀 Фильтрует по offer_id_tracker сразу в SQL (WHERE IN) - индекс работает эффективно
 * – 🚀 Выполняет запросы параллельно (Promise.all) вместо последовательно
 * – 🚀 Загружает только нужные offer_id, а не всю таблицу
 *
 * ФУНКЦИОНАЛ:
 * – Загружает данные за 90 дней для CPL, Лидов и Рейтинга
 * – Агрегирует данные на клиенте для периодов: 4, 7, 14, 30, 60, 90 дней
 * – Рассчитывает рейтинг (A/B/C/D) на основе CPL за 4 дня и "Цены лида в зоне" (red_zone_price)
 * – Если red_zone_price отсутствует, используется константа 3.5
 * – Использует offer_id_tracker из БД API и маппинг article_offer_mapping
 * – Обновляет ТРИ колонки одним запросом: CPL 4дн, Лиды 4дн, Рейтинг
 * – Также агрегирует данные по source_id_tracker для метрик байеров
 */

// Прямой доступ к API (CORS включен на сервере)
const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

// Периоды для агрегации данных
const PERIODS = [
  { days: 4, label: '4 дня' },
  { days: 7, label: '7 дней' },
  { days: 14, label: '14 дней' },
  { days: 30, label: '30 дней' },
  { days: 60, label: '60 дней' },
  { days: 90, label: '90 дней' }
];

// Настройки для retry логики
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000; // 3 секунды

/**
 * Задержка выполнения
 * @param {number} ms - Время задержки в миллисекундах
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * ГЛАВНАЯ ФУНКЦИЯ: Обновляет данные для всех трех колонок
 * @param {Array} metrics - Массив метрик офферов
 * @param {Object} articleOfferMap - Маппинг article -> offer_id из article_offer_mapping
 * @param {Array} preloadedData - Опционально: предзагруженные агрегированные данные из Calculate_days.js
 * @returns {Promise<Object>} - Объект с обновленными метриками
 */
export const updateLeadsFromSql = async (metrics, articleOfferMap = {}, preloadedData = null) => {
  try {
    let data90Days;

    // 🎯 ОПТИМИЗАЦИЯ: Используем предзагруженные данные, если они есть
    if (preloadedData && preloadedData.length > 0) {
      console.log('🚀 Используем предзагруженные данные из Calculate_days.js...');
      console.log(`📊 Получено ${preloadedData.length} агрегированных записей за 12 месяцев`);

      // Фильтруем последние 90 дней
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 89);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      data90Days = preloadedData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= start && itemDate <= end;
      });

      console.log(`✅ Отфильтровано ${data90Days.length} записей за последние 90 дней (экономия 6 SQL запросов!)`);
    } else {
      // Старый способ: загружаем данные из БД
      console.log('🔄 Загружаем данные из БД (CPL, Лиды, Рейтинг)...');

      // Создаем обратный маппинг: offer_id -> article
      const offerIdArticleMap = {};
      Object.keys(articleOfferMap).forEach(article => {
        const offerId = articleOfferMap[article];
        offerIdArticleMap[offerId] = article;
      });
      console.log(`📊 Загружено ${Object.keys(offerIdArticleMap).length} маппингов Offer ID -> Артикул`);

      // 1. Загружаем данные за 90 дней для CPL, Лидов и Рейтинга
      data90Days = await fetchDataFor90Days(offerIdArticleMap);
      console.log(`✅ Загружено ${data90Days.length} записей за 90 дней`);
    }

    // 2. Группируем данные по артикулу
    const dataByArticleAndDate = groupDataByArticleAndDate(data90Days);

    // 3. Группируем данные по source_id для метрик байеров
    const dataBySourceIdAndDate = groupDataBySourceIdAndDate(data90Days);
    console.log(`📊 Уникальных source_id: ${Object.keys(dataBySourceIdAndDate).length}`);

    // 3. Обновляем метрики с данными о лидах, CPL и рейтингах
    let processedCount = 0;

    const updatedMetrics = metrics.map(metric => {
      const article = metric.article;

      if (!article) {
        return metric;
      }

      // === ЧАСТЬ 1: CPL и Лиды за разные периоды (4, 7, 14, 30, 60, 90 дней) ===
      const leadsData = {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      PERIODS.forEach(period => {
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (period.days - 1));

        let totalLeads = 0;
        let totalCost = 0;

        const articleData = dataByArticleAndDate[article];
        if (articleData) {
          Object.keys(articleData).forEach(dateStr => {
            const recordDate = new Date(dateStr);
            recordDate.setHours(0, 0, 0, 0);

            if (recordDate >= startDate && recordDate <= today) {
              totalLeads += articleData[dateStr].leads;
              totalCost += articleData[dateStr].cost;
            }
          });
        }

        const cpl = totalLeads > 0 ? totalCost / totalLeads : 0;

        leadsData[period.days] = {
          leads: totalLeads,
          cost: totalCost,
          cpl: cpl,
          label: period.label
        };
      });

      // === ЧАСТЬ 2: Рейтинг на основе CPL за 4 дня ===

      // Получаем базовый порог из колонки "Цена лида в зоне" (красная зона)
      // Если нет значения, используем константу 3.5
      const baseThreshold = metric.red_zone_price || 3.5;

      // Получаем CPL за 4 дня (уже рассчитан выше)
      const cpl4days = leadsData[4].cpl;

      // Рассчитываем рейтинг
      let rating = 'N/A';
      if (cpl4days !== null && cpl4days > 0) {
        rating = calculateRating(cpl4days, baseThreshold);
      }

      // === ЧАСТЬ 3: Рейтинг за три предыдущих месяца ===
      const ratingHistory = calculateMonthlyRatings(article, dataByArticleAndDate, baseThreshold, today);

      processedCount++;

      return {
        ...metric,
        leads_4days: leadsData[4].leads,
        leads_data: leadsData,        // Все данные для тултипа
        lead_rating: rating,          // Рейтинг
        rating_cpl: cpl4days,         // CPL за 4 дня для рейтинга
        rating_history: ratingHistory // История рейтинга за 3 месяца
      };
    });

    console.log(`✅ Обновлено офферов: ${processedCount}`);

    return {
      metrics: updatedMetrics,
      processedCount: processedCount,
      dataBySourceIdAndDate: dataBySourceIdAndDate // Для метрик байеров
    };

  } catch (error) {
    console.error('❌ Ошибка загрузки данных из БД:', error);
    throw error;
  }
};

/**
 * Группирует данные по артикулу и дате для быстрой агрегации
 */
function groupDataByArticleAndDate(data) {
  const grouped = {};

  data.forEach(record => {
    const article = record.article;
    const date = record.date;
    const leads = record.leads;
    const cost = record.cost;

    if (!article || !date) return;

    if (!grouped[article]) {
      grouped[article] = {};
    }

    const dateStr = formatDate(date);

    if (!grouped[article][dateStr]) {
      grouped[article][dateStr] = { leads: 0, cost: 0 };
    }

    grouped[article][dateStr].leads += leads;
    grouped[article][dateStr].cost += cost;
  });

  return grouped;
}

/**
 * Группирует данные по source_id_tracker и дате для метрик байеров
 * Теперь группирует по артикулу -> source_id -> дате
 * @param {Array} data - Массив записей с source_id
 * @returns {Object} - { article: { source_id: { date: { leads, cost } } } }
 */
function groupDataBySourceIdAndDate(data) {
  const grouped = {};

  data.forEach(record => {
    const article = record.article;
    const sourceId = record.source_id;
    const date = record.date;
    const leads = record.leads;
    const cost = record.cost;

    if (!article || !sourceId || sourceId === 'unknown' || !date) return;

    if (!grouped[article]) {
      grouped[article] = {};
    }

    if (!grouped[article][sourceId]) {
      grouped[article][sourceId] = {};
    }

    const dateStr = formatDate(date);

    if (!grouped[article][sourceId][dateStr]) {
      grouped[article][sourceId][dateStr] = { leads: 0, cost: 0 };
    }

    grouped[article][sourceId][dateStr].leads += leads;
    grouped[article][sourceId][dateStr].cost += cost;
  });

  return grouped;
}

/**
 * Агрегирует метрики по артикулу оффера и массиву source_ids за указанный период
 * @param {string} article - Артикул оффера
 * @param {Array} sourceIds - Массив source_id байера
 * @param {Object} dataBySourceIdAndDate - Сгруппированные данные { article: { source_id: { date: { leads, cost } } } }
 * @param {number} periodDays - Количество дней для агрегации
 * @returns {Object} - { leads, cost, cpl }
 */
export function aggregateMetricsBySourceIds(article, sourceIds, dataBySourceIdAndDate, periodDays = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (periodDays - 1));

  let totalLeads = 0;
  let totalCost = 0;

  // Получаем данные для конкретного артикула
  const articleData = dataBySourceIdAndDate[article];
  if (!articleData) {
    return { leads: 0, cost: 0, cpl: 0 };
  }

  sourceIds.forEach(sourceId => {
    const sourceData = articleData[sourceId];
    if (!sourceData) return;

    Object.keys(sourceData).forEach(dateStr => {
      const recordDate = new Date(dateStr);
      recordDate.setHours(0, 0, 0, 0);

      if (recordDate >= startDate && recordDate <= today) {
        totalLeads += sourceData[dateStr].leads;
        totalCost += sourceData[dateStr].cost;
      }
    });
  });

  const cpl = totalLeads > 0 ? totalCost / totalLeads : 0;

  return {
    leads: totalLeads,
    cost: totalCost,
    cpl: cpl
  };
}

/**
 * Рассчитывает рейтинг на основе CPL и базового порога
 * @param {number} cpl - CPL за 4 дня
 * @param {number} base - Базовый порог (red_zone_price или 3.5)
 */
function calculateRating(cpl, base) {
  if (isNaN(cpl) || cpl === 0 || isNaN(base) || base === 0) {
    return 'N/A';
  }

  const pct = (cpl / base) * 100;

  if (pct <= 35) return 'A';
  if (pct <= 65) return 'B';
  if (pct <= 90) return 'C';
  return 'D';
}

/**
 * Рассчитывает рейтинг за три предыдущих месяца
 * @param {string} article - Артикул оффера
 * @param {Object} dataByArticleAndDate - Данные сгруппированные по артикулу и дате
 * @param {number} baseThreshold - Базовый порог для расчета рейтинга
 * @param {Date} today - Текущая дата
 * @returns {Array} - Массив с рейтингами за 3 месяца
 */
function calculateMonthlyRatings(article, dataByArticleAndDate, baseThreshold, today) {
  const monthlyRatings = [];
  const articleData = dataByArticleAndDate[article];

  // Функция для получения названия месяца на русском
  const getMonthName = (monthIndex) => {
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return months[monthIndex];
  };

  // Рассчитываем данные для каждого из 3 предыдущих месяцев
  for (let i = 1; i <= 3; i++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    let totalLeads = 0;
    let totalCost = 0;

    // Суммируем лиды и расходы за месяц
    if (articleData) {
      Object.keys(articleData).forEach(dateStr => {
        const recordDate = new Date(dateStr);
        recordDate.setHours(0, 0, 0, 0);

        if (recordDate >= monthStart && recordDate <= monthEnd) {
          totalLeads += articleData[dateStr].leads;
          totalCost += articleData[dateStr].cost;
        }
      });
    }

    const cpl = totalLeads > 0 ? totalCost / totalLeads : 0;
    const rating = cpl > 0 ? calculateRating(cpl, baseThreshold) : 'N/A';

    monthlyRatings.push({
      month: getMonthName(monthDate.getMonth()),
      year: monthDate.getFullYear(),
      rating: rating,
      cpl: cpl,
      leads: totalLeads,
      cost: totalCost
    });
  }

  return monthlyRatings;
}

/**
 * Получает данные из SQL БД за 90 дней для CPL, Лидов и Рейтинга
 * ОПТИМИЗИРОВАННАЯ ВЕРСИЯ:
 * - Фильтрует по offer_id_tracker сразу в SQL (WHERE IN)
 * - Выполняет запросы параллельно (Promise.all)
 * @param {Object} offerIdArticleMap - Обратный маппинг offer_id -> article
 */
async function fetchDataFor90Days(offerIdArticleMap = {}) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 89);

  // Получаем список всех offer_id из маппинга
  const offerIds = Object.keys(offerIdArticleMap);

  if (offerIds.length === 0) {
    console.warn('⚠️ Маппинг пуст! Невозможно загрузить данные без Offer ID');
    return [];
  }

  console.log(`📊 Будем фильтровать по ${offerIds.length} Offer ID`);

  // Создаем SQL список для IN clause
  const offerIdsList = offerIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

  // 🚀 ОПТИМИЗАЦИЯ: Разбиваем 90 дней на 6 периодов по 15 дней
  // Это предотвращает HTTP 502 из-за превышения размера ответа
  console.log(`📅 Разбиваем 90 дней на 6 периодов (по 15 дней) для параллельной загрузки...`);

  const periods = [];
  for (let i = 0; i < 6; i++) {
    const periodStart = new Date(start);
    periodStart.setDate(start.getDate() + (i * 15));

    const periodEnd = new Date(start);
    periodEnd.setDate(start.getDate() + ((i + 1) * 15) - 1);

    // Последний период может быть короче
    if (periodEnd > end) {
      periodEnd.setTime(end.getTime());
    }

    periods.push({
      from: formatDate(periodStart),
      to: formatDate(periodEnd)
    });
  }

  // 🚀 КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ: Запускаем все запросы параллельно
  const promises = periods.map(async (p) => {
    // 🔥 ФИЛЬТРАЦИЯ НА SQL УРОВНЕ - индекс работает эффективно!
    const sql =
      `SELECT offer_id_tracker, adv_date, valid, cost, source_id_tracker ` +
      `FROM ads_collection ` +
      `WHERE adv_date BETWEEN '${p.from}' AND '${p.to}' ` +
      `AND offer_id_tracker IN (${offerIdsList}) ` +
      `AND valid > 0`;

    console.log(`  📆 ${p.from}..${p.to} (параллельно)`);

    try {
      const rawData = await getDataBySql(sql);
      console.log(`    ✅ ${rawData.length} записей`);

      const processedChunk = rawData.map(row => {
        const offerId = row.offer_id_tracker || '';
        const article = offerIdArticleMap[offerId] || '';

        return {
          article: article,
          date: new Date(row.adv_date),
          leads: Number(row.valid) || 0,
          cost: Number(row.cost) || 0,
          source_id: row.source_id_tracker || 'unknown'
        };
      }).filter(item => item.article && item.leads > 0);

      return { success: true, data: processedChunk, period: `${p.from}..${p.to}` };
    } catch (error) {
      console.warn(`    ⚠️ Пропуск ${p.from}..${p.to}: ${error.message}`);
      return { success: false, data: [], period: `${p.from}..${p.to}`, error: error.message };
    }
  });

  // Ждем завершения всех запросов параллельно
  const results = await Promise.all(promises);

  // Собираем данные и статистику
  let allData = [];
  let successCount = 0;
  let failedPeriods = [];

  results.forEach(result => {
    if (result.success) {
      allData = allData.concat(result.data);
      successCount++;
    } else {
      failedPeriods.push(result.period);
    }
  });

  if (failedPeriods.length > 0) {
    console.warn(`⚠️ Пропущено ${failedPeriods.length} периодов: ${failedPeriods.join(', ')}`);
  }

  console.log(`✅ 90 дней: ${allData.length} записей (${successCount}/${periods.length} периодов) - загружено ПАРАЛЛЕЛЬНО 🚀`);

  return allData;
}

/**
 * Универсальный fetch к SQL API с retry логикой
 */
async function getDataBySql(strSQL, retryCount = 0) {
  try {
    const response = await fetch(CORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ assoc: true, sql: strSQL })
    });

    const code = response.status;
    const text = await response.text();

    // Если 500 или 502 - пробуем повторить
    if ((code === 500 || code === 502) && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`      ⚠️ HTTP ${code}, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
      await sleep(delay);
      return getDataBySql(strSQL, retryCount + 1);
    }

    if (code !== 200) {
      throw new Error(`HTTP ${code}`);
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
    // Если это сетевая ошибка и есть попытки - повторяем
    if (retryCount < MAX_RETRIES && error.message.includes('fetch')) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`      ⚠️ Сетевая ошибка, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
      await sleep(delay);
      return getDataBySql(strSQL, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Извлекает артикул из названия оффера
 * Формат: "C01829 - Жіноча блуза" -> "C01829"
 */
function extractArticle(offerName) {
  if (!offerName) return '';
  const match = offerName.match(/^([A-Za-z0-9_-]+)(?:\s|$)/);
  return match ? match[1] : offerName.split(/[\s-]/)[0];
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
