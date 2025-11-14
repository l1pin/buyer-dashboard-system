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

    // Обновляем метрики с рассчитанными днями
    const updatedMetrics = metrics.map(metric => {
      const article = metric.article;
      const status = metric.status;
      const stock = metric.stock_quantity;

      if (status === 'Вкл' && article && stock != null) {
        const forecast = forecastMap[article];

        if (!forecast) {
          return {
            ...metric,
            days_remaining: 'недостаточно дней для анализа',
            days_remaining_value: null
          };
        }

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
 * Достаёт данные за последние 12 месяцев и собирает всё в один массив.
 * Оптимизировано для быстрой загрузки без таймаутов.
 */
async function fetchTrackerAll() {
  // Загружаем только последние 12 месяцев для ускорения
  const end = new Date(); // до сегодня
  const start = new Date();
  start.setMonth(start.getMonth() - 12); // 12 месяцев назад

  // 2) Составляем список месячных интервалов
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

  console.log(`Будет загружено периодов: ${periods.length}`);

  // 3) Для каждого месяца — SQL и конкатенация (ПОСЛЕДОВАТЕЛЬНО, как в Google Apps Script)
  let all = [];

  for (const p of periods) {
    const sql =
      "SELECT offer_name, adv_date, valid, cost " +
      "FROM ads_collection " +
      `WHERE adv_date BETWEEN '${p.from}' AND '${p.to}'`;

    console.log(`Запрос ${p.from}..${p.to}`);

    const chunk = await getDataBySql(sql);
    console.log(`  строк: ${chunk.length}`);

    all = all.concat(chunk.map(it => ({
      offer: it.offer_name || '',
      date: new Date(it.adv_date),
      leads: Number(it.valid) || 0,
      cost: Number(it.cost) || 0
    })));
  }

  console.log(`✅ Загружено ${all.length} записей за ${periods.length} периодов`);

  return all;
}

/**
 * Универсальный fetch + преобразование [[headers], [row], …] → [{…},…]
 * С retry логикой для обработки нестабильных ответов
 */
async function getDataBySql(strSQL, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 секунды базовая задержка

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

    console.log(`HTTP ${code}, ответ длиной ${text.length}`);

    // Если 500 или 502 - пробуем повторить
    if ((code === 500 || code === 502) && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Экспоненциальный backoff
      console.log(`⚠️ Ошибка ${code}, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
      await new Promise(resolve => setTimeout(resolve, delay));
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
      console.log(`⚠️ Сетевая ошибка, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return getDataBySql(strSQL, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Группирует записи по артикулу
 */
function buildTrackerIndex(tracker) {
  const map = {};

  tracker.forEach(({ offer, date, leads, cost }) => {
    if (!offer || cost <= 0) return;

    const art = extractArticle(offer);

    if (!map[art]) {
      map[art] = [];
    }

    map[art].push({ date, leads });
  });

  return map;
}

/**
 * Извлекает артикул из названия оффера
 */
function extractArticle(offer) {
  const m = offer.match(/^[A-Za-z0-9_-]+/);
  return m ? m[0] : offer;
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
