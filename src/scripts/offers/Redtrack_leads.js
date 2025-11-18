/**
 * Скрипт для получения данных о лидах за разные периоды из SQL базы данных
 * – Загружает данные за 90 дней одним запросом из ads_collection
 * – Агрегирует данные на клиенте для периодов: 4, 7, 14, 30, 60, 90 дней
 * – Извлекает артикул из offer_name (формат: "C01829 - Жіноча блуза")
 * – Рассчитывает CPL = cost / valid (расход / лиды)
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
 * Получает данные о лидах за все периоды для массива метрик
 * Оптимизированная версия: один запрос на 90 дней + агрегация на клиенте
 *
 * @param {Array} metrics - Массив метрик офферов
 * @returns {Promise<Object>} - Объект с обновленными метриками
 */
export const updateLeadsFromRedtrack = async (metrics) => {
  try {
    console.log('🔄 Начинаем загрузку данных о лидах из БД за 90 дней...');

    // Загружаем все данные за 90 дней одним запросом
    const allData = await fetchDataFor90Days();
    console.log(`✅ Загружено ${allData.length} записей за 90 дней из БД`);

    // Группируем данные по артикулу и дате для быстрой агрегации
    const dataByArticleAndDate = groupDataByArticleAndDate(allData);

    // Обновляем метрики с данными о лидах
    let processedCount = 0;

    const updatedMetrics = metrics.map(metric => {
      const article = metric.article;

      if (!article) {
        return metric;
      }

      // Рассчитываем данные для каждого периода на клиенте
      const leadsData = {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      PERIODS.forEach(period => {
        // Вычисляем дату начала периода
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (period.days - 1));

        // Фильтруем данные для текущего периода
        let totalLeads = 0;
        let totalCost = 0;

        // Проверяем есть ли данные для этого артикула
        const articleData = dataByArticleAndDate[article];
        if (articleData) {
          // Суммируем данные за период
          Object.keys(articleData).forEach(dateStr => {
            const recordDate = new Date(dateStr);
            recordDate.setHours(0, 0, 0, 0);

            if (recordDate >= startDate && recordDate <= today) {
              totalLeads += articleData[dateStr].leads;
              totalCost += articleData[dateStr].cost;
            }
          });
        }

        // Рассчитываем CPL (стоимость за лид)
        const cpl = totalLeads > 0 ? totalCost / totalLeads : 0;

        leadsData[period.days] = {
          leads: totalLeads,
          cost: totalCost,
          cpl: cpl,
          label: period.label
        };
      });

      processedCount++;

      return {
        ...metric,
        leads_4days: leadsData[4].leads,
        leads_data: leadsData // Все данные для тултипа
      };
    });

    console.log(`✅ Обновлено офферов с данными о лидах: ${processedCount}`);

    return {
      metrics: updatedMetrics,
      processedCount: processedCount
    };

  } catch (error) {
    console.error('❌ Ошибка загрузки данных о лидах из БД:', error);
    throw error;
  }
};

/**
 * Группирует данные по артикулу и дате для быстрой агрегации
 * @param {Array} data - Массив записей с данными
 * @returns {Object} - Объект вида { article: { date: { leads, cost } } }
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
 * Получает данные из SQL БД за 90 дней
 * Разбивает запрос на месячные периоды для избежания таймаутов
 *
 * @returns {Promise<Array>} - Массив результатов
 */
async function fetchDataFor90Days() {
  // Период выборки - 90 дней включая сегодня
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 89); // 90 дней, включая сегодня

  // Составляем список месячных интервалов
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

  console.log(`📅 Загрузка данных из БД за 90 дней (${periods.length} периодов)...`);

  // Загружаем данные по месяцам последовательно
  let allData = [];
  let successCount = 0;
  let failedPeriods = [];

  for (const p of periods) {
    const sql =
      `SELECT offer_name, adv_date, valid, cost ` +
      `FROM ads_collection ` +
      `WHERE adv_date BETWEEN '${p.from}' AND '${p.to}' ` +
      `AND valid > 0`; // Фильтруем только записи с лидами

    console.log(`  📆 Загрузка ${p.from}..${p.to}`);

    try {
      const rawData = await getDataBySql(sql);
      console.log(`    ✅ ${rawData.length} записей`);

      // Преобразуем данные в нужный формат
      const processedChunk = rawData.map(row => ({
        article: extractArticle(row.offer_name || ''),
        date: new Date(row.adv_date),
        leads: Number(row.valid) || 0,
        cost: Number(row.cost) || 0
      })).filter(item => item.article && item.leads > 0);

      allData = allData.concat(processedChunk);
      successCount++;
    } catch (error) {
      // Пропускаем проблемный период и продолжаем
      console.warn(`    ⚠️ Пропускаем период ${p.from}..${p.to}: ${error.message}`);
      failedPeriods.push(`${p.from}..${p.to}`);
    }
  }

  if (failedPeriods.length > 0) {
    console.warn(`⚠️ Не удалось загрузить ${failedPeriods.length} периодов: ${failedPeriods.join(', ')}`);
  }

  console.log(`✅ Загружено ${allData.length} записей за ${successCount}/${periods.length} периодов`);

  return allData;
}

/**
 * Универсальный fetch + преобразование [[headers], [row], …] → [{…},…]
 * С retry логикой для обработки нестабильных ответов
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

    console.log(`  HTTP ${code}, ответ длиной ${text.length}`);

    // Если 500 или 502 - пробуем повторить
    if ((code === 500 || code === 502) && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Экспоненциальный backoff
      console.log(`  ⚠️ Ошибка ${code}, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
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
      console.log(`  ⚠️ Сетевая ошибка, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
      await sleep(delay);
      return getDataBySql(strSQL, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Извлекает артикул из названия оффера
 * Формат: "C01829 - Жіноча блуза" -> "C01829"
 *
 * @param {string} offerName - Название оффера
 * @returns {string} - Артикул
 */
function extractArticle(offerName) {
  if (!offerName) return '';

  // Извлекаем артикул до первого пробела или тире
  const match = offerName.match(/^([A-Za-z0-9_-]+)(?:\s|$)/);
  return match ? match[1] : offerName.split(/[\s-]/)[0];
}

/**
 * Форматирует дату в формат YYYY-MM-DD
 *
 * @param {Date} date - Дата для форматирования
 * @returns {string} - Отформатированная дата
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
