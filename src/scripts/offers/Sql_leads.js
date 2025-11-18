/**
 * Универсальный скрипт для получения данных о лидах и рейтинга из SQL базы данных
 * – Загружает данные за 90 дней для CPL, Лидов и Рейтинга
 * – Агрегирует данные на клиенте для периодов: 4, 7, 14, 30, 60, 90 дней
 * – Рассчитывает рейтинг (A/B/C/D) на основе CPL за 4 дня и "Цены лида в зоне" (red_zone_price)
 * – Если red_zone_price отсутствует, используется константа 3.5
 * – Извлекает артикул из offer_name (формат: "C01829 - Жіноча блуза")
 * – Обновляет ТРИ колонки одним запросом: CPL 4дн, Лиды 4дн, Рейтинг
 */

// Используем Netlify Function для обхода CORS
const CORE_URL = '/.netlify/functions/sql-proxy';

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
 * @returns {Promise<Object>} - Объект с обновленными метриками
 */
export const updateLeadsFromSql = async (metrics) => {
  try {
    console.log('🔄 Начинаем загрузку данных из БД (CPL, Лиды, Рейтинг)...');

    // 1. Загружаем данные за 90 дней для CPL, Лидов и Рейтинга
    const data90Days = await fetchDataFor90Days();
    console.log(`✅ Загружено ${data90Days.length} записей за 90 дней`);

    // 2. Группируем данные
    const dataByArticleAndDate = groupDataByArticleAndDate(data90Days);

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
      processedCount: processedCount
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
 */
async function fetchDataFor90Days() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 89);

  const periods = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cur <= end) {
    const from = formatDate(cur);
    const tmp = new Date(cur);
    tmp.setMonth(tmp.getMonth() + 1);
    tmp.setDate(tmp.getDate() - 1);

    if (tmp > end) tmp.setTime(end.getTime());

    const to = formatDate(tmp);
    periods.push({ from, to });

    cur.setMonth(cur.getMonth() + 1);
    cur.setDate(1);
  }

  console.log(`📅 Загрузка 90 дней (${periods.length} периодов) для CPL, Лидов и Рейтинга...`);

  let allData = [];
  let successCount = 0;
  let failedPeriods = [];

  for (const p of periods) {
    const sql =
      `SELECT offer_name, adv_date, valid, cost ` +
      `FROM ads_collection ` +
      `WHERE adv_date BETWEEN '${p.from}' AND '${p.to}' ` +
      `AND valid > 0`;

    console.log(`  📆 ${p.from}..${p.to}`);

    try {
      const rawData = await getDataBySql(sql);
      console.log(`    ✅ ${rawData.length} записей`);

      const processedChunk = rawData.map(row => ({
        article: extractArticle(row.offer_name || ''),
        date: new Date(row.adv_date),
        leads: Number(row.valid) || 0,
        cost: Number(row.cost) || 0
      })).filter(item => item.article && item.leads > 0);

      allData = allData.concat(processedChunk);
      successCount++;
    } catch (error) {
      console.warn(`    ⚠️ Пропуск ${p.from}..${p.to}: ${error.message}`);
      failedPeriods.push(`${p.from}..${p.to}`);
    }
  }

  if (failedPeriods.length > 0) {
    console.warn(`⚠️ Пропущено ${failedPeriods.length} периодов`);
  }

  console.log(`✅ 90 дней: ${allData.length} записей (${successCount}/${periods.length} периодов)`);

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
      body: JSON.stringify({ sql: strSQL })
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
