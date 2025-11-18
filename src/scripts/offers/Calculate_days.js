/**
 * Скрипт для расчёта оставшихся дней продаж на основе всей истории из SQL-API
 * – Достаём данные за последние 12 месяцев по частям
 * – Экспоненциальное сглаживание прогноза (α = 0.3)
 * – Возвращает результаты для обновления метрик
 *
 * Портировано с Google Apps Script
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

    if (!metrics || metrics.length === 0) {
      console.log('⚠️ Нет метрик для обработки');
      return {
        metrics: [],
        processedCount: 0,
        totalArticles: 0
      };
    }

    // 1. Получаем всю историю по частям (как в Google Script)
    const tracker = await fetchTrackerAll();
    console.log(`Всего строк истории: ${tracker.length}`);

    if (tracker.length === 0) {
      console.warn('⚠️ История пуста, расчет невозможен');
      return {
        metrics: metrics,
        processedCount: 0,
        totalArticles: 0
      };
    }

    // 2. Группируем по артикулу (buildTrackerIndex)
    const index = buildTrackerIndex(tracker);
    console.log(`Уникальных артикулов в истории: ${Object.keys(index).length}`);

    // 3. Экспоненциальное сглаживание (α = 0.3) - ТОЧНО КАК В GOOGLE SCRIPT
    const alpha = 0.3;
    const forecastMap = {};

    Object.keys(index).forEach(art => {
      const arr = index[art];
      if (arr.length < 10) return; // Недостаточно данных для прогноза

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

    // ОТЛАДКА: Примеры артикулов
    const forecastSample = Object.keys(forecastMap).slice(0, 10);
    console.log('📋 Примеры артикулов в forecastMap:', forecastSample);

    const metricsWithArticles = metrics
      .filter(m => m.article && m.article.trim())
      .slice(0, 10)
      .map(m => ({
        article: m.article,
        trimmed: m.article.trim(),
        status: m.status,
        stock: m.stock_quantity
      }));
    console.log('📋 Примеры метрик с артикулами:', metricsWithArticles);

    // Подсчет активных метрик
    const activeCount = metrics.filter(m =>
      m.status === 'Вкл' &&
      m.article &&
      m.article.trim() !== '' &&
      m.stock_quantity != null
    ).length;
    console.log(`📊 Активных метрик (Вкл + артикул + остаток): ${activeCount}`);

    // 4. Считаем дни и обновляем метрики - ТОЧНО КАК В GOOGLE SCRIPT
    let processedCount = 0;
    let notFoundCount = 0;

    const updatedMetrics = metrics.map(metric => {
      // Берем артикул и trim() - ВАЖНО!
      const art = metric.article ? metric.article.trim() : null;
      const stat = metric.status;
      const stock = metric.stock_quantity;

      // Проверка условий (как в Google Script: stat === 'Вкл' && art && stock != null)
      if (stat === 'Вкл' && art && stock != null) {
        const f = forecastMap[art];

        if (!f) {
          // Артикул не найден в прогнозе
          notFoundCount++;
          if (notFoundCount <= 10) {
            console.log(`⚠️ Артикул "${art}" не найден в forecastMap (статус: ${stat}, остаток: ${stock})`);
          }
          return {
            ...metric,
            days_remaining: 'недостаточно дней для анализа',
            days_remaining_value: null
          };
        }

        // Рассчитываем дни
        const days = stock / f;
        processedCount++;

        if (days < 0) {
          return {
            ...metric,
            days_remaining: 'тренд указывает на падение продаж',
            days_remaining_value: null
          };
        }

        // Возвращаем число с 2 знаками после запятой
        return {
          ...metric,
          days_remaining: Number(days.toFixed(2)),
          days_remaining_value: Number(days.toFixed(2))
        };
      }

      // Если условия не выполнены - пустое значение
      return {
        ...metric,
        days_remaining: null,
        days_remaining_value: null
      };
    });

    console.log(`📊 Найдено совпадений: ${processedCount}`);
    console.log(`⚠️ Не найдено в forecastMap: ${notFoundCount}`);
    console.log(`✅ Обработано офферов: ${processedCount}`);

    return {
      metrics: updatedMetrics,
      processedCount: processedCount,
      totalArticles: Object.keys(forecastMap).length
    };

  } catch (error) {
    console.error('❌ Ошибка расчета дней продаж:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

/**
 * Достаёт данные за последние 12 месяцев по частям
 * Итерирует по месяцам и собирает всё в один массив
 * Портировано с fetchTrackerAll() из Google Apps Script
 */
async function fetchTrackerAll() {
  // Берем последние 12 месяцев для ускорения
  const end = new Date(); // до сегодня
  const start = new Date();
  start.setMonth(start.getMonth() - 12); // 12 месяцев назад

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

  console.log(`Будет загружено периодов: ${periods.length}`);

  // Для каждого месяца — SQL и конкатенация (ПОСЛЕДОВАТЕЛЬНО)
  let all = [];
  let successCount = 0;
  let failedPeriods = [];

  for (const p of periods) {
    const sql =
      "SELECT offer_name, adv_date, valid, cost " +
      "FROM ads_collection " +
      `WHERE adv_date BETWEEN '${p.from}' AND '${p.to}'`;

    console.log(`Запрос ${p.from}..${p.to}`);

    try {
      const chunk = await getDataBySql(sql);
      console.log(`  ✅ ${p.from}..${p.to}: ${chunk.length} строк`);

      // Преобразуем как в Google Script
      all = all.concat(chunk.map(it => ({
        offer: it.offer_name || '',
        date: new Date(it.adv_date),
        leads: Number(it.valid) || 0,
        cost: Number(it.cost) || 0
      })));

      successCount++;
    } catch (error) {
      // Пропускаем проблемный период и продолжаем
      console.warn(`⚠️ Пропускаем период ${p.from}..${p.to}: ${error.message}`);
      failedPeriods.push(`${p.from}..${p.to}`);
    }
  }

  if (failedPeriods.length > 0) {
    console.warn(`⚠️ Не удалось загрузить ${failedPeriods.length} периодов: ${failedPeriods.join(', ')}`);
  }

  console.log(`✅ Загружено ${all.length} записей за ${successCount}/${periods.length} периодов`);

  return all;
}

/**
 * Универсальный fetch + преобразование [[headers], [row], …] → [{…},…]
 * Портировано с getDataBySql() из Google Apps Script
 * + Добавлена retry логика для обработки нестабильных ответов
 */
async function getDataBySql(strSQL, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 3000; // 3 секунды

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

    // Если заголовки в первой строке - преобразуем
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
 * Портировано с buildTrackerIndex() из Google Apps Script
 */
function buildTrackerIndex(tracker) {
  const map = {};
  let processedCount = 0;
  let skippedCount = 0;

  tracker.forEach(({ offer, date, leads, cost }) => {
    // Пропускаем если нет оффера или cost <= 0 (как в Google Script)
    if (!offer || cost <= 0) {
      skippedCount++;
      return;
    }

    const art = extractArticle(offer);

    if (!art) {
      skippedCount++;
      return;
    }

    // Создаем массив если еще нет (как в Google Script: (map[art] = map[art] || []))
    if (!map[art]) {
      map[art] = [];
    }

    map[art].push({ date, leads });
    processedCount++;
  });

  console.log(`🔍 buildTrackerIndex: обработано ${processedCount}, пропущено ${skippedCount}`);

  // ОТЛАДКА: Примеры извлечения
  const samples = tracker
    .filter(t => t.offer && t.cost > 0)
    .slice(0, 10);

  if (samples.length > 0) {
    console.log('📋 Примеры извлечения артикулов из offer_name:');
    samples.forEach(({ offer }) => {
      const extracted = extractArticle(offer);
      console.log(`  "${offer}" -> "${extracted}"`);
    });
  }

  return map;
}

/**
 * Извлекает артикул из названия оффера
 * ТОЧНО КАК В GOOGLE APPS SCRIPT!
 *
 * @param {string} offer - Название оффера (например: "C01829 - Жіноча блуза")
 * @returns {string} - Артикул (например: "C01829")
 */
function extractArticle(offer) {
  if (!offer) return '';

  // ПРОСТОЙ паттерн как в Google Script: /^[A-Za-z0-9_-]+/
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
