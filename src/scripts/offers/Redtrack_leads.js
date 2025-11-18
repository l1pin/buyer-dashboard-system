/**
 * Скрипт для получения данных о лидах за разные периоды из RedTrack API
 * – Загружает данные за 4, 7, 14, 30, 60 и 90 дней
 * – Использует пагинацию для получения всех данных
 * – Группирует по offer
 * – Суммирует convtype7 (лиды) и cost (расход) для каждого артикула
 */

const REDTRACK_API_KEY = 'SY5wfZkzhZ0tu0YiKi9B';
const REDTRACK_API_URL = 'https://api.redtrack.io/report';

// Периоды для загрузки данных
const PERIODS = [
  { days: 4, label: '4 дня' },
  { days: 7, label: '7 дней' },
  { days: 14, label: '14 дней' },
  { days: 30, label: '30 дней' },
  { days: 60, label: '60 дней' },
  { days: 90, label: '90 дней' }
];

// Настройки для обработки rate limiting
const DELAY_BETWEEN_PERIODS = 2000; // 2 секунды между периодами
const DELAY_BETWEEN_PAGES = 500; // 0.5 секунды между страницами
const DELAY_ON_RATE_LIMIT = 5000; // 5 секунд при получении 429
const MAX_RETRIES_ON_429 = 3; // Максимум 3 попытки при 429

/**
 * Задержка выполнения
 * @param {number} ms - Время задержки в миллисекундах
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Получает данные о лидах за все периоды для массива метрик
 *
 * @param {Array} metrics - Массив метрик офферов
 * @returns {Promise<Object>} - Объект с обновленными метриками
 */
export const updateLeadsFromRedtrack = async (metrics) => {
  try {
    console.log('🔄 Начинаем загрузку данных о лидах из RedTrack за разные периоды...');

    // Загружаем данные для всех периодов с задержками
    const periodData = {};

    for (let i = 0; i < PERIODS.length; i++) {
      const period = PERIODS[i];
      console.log(`📅 Загрузка данных за ${period.label}...`);

      const data = await fetchRedtrackDataForPeriod(period.days);
      periodData[period.days] = data;
      console.log(`  ✅ Загружено ${data.length} записей за ${period.label}`);

      // Задержка между периодами (кроме последнего)
      if (i < PERIODS.length - 1) {
        console.log(`  ⏳ Пауза ${DELAY_BETWEEN_PERIODS}мс перед следующим периодом...`);
        await sleep(DELAY_BETWEEN_PERIODS);
      }
    }

    // Обновляем метрики с данными о лидах
    let processedCount = 0;

    const updatedMetrics = metrics.map(metric => {
      const article = metric.article;

      if (!article) {
        return metric;
      }

      // Рассчитываем данные для каждого периода
      const leadsData = {};

      PERIODS.forEach(period => {
        const results = periodData[period.days];

        // Ищем офферы, которые содержат этот артикул в названии
        const matchingOffers = results.filter(offer => {
          const offerName = offer.offer || '';
          return offerName.includes(article);
        });

        // Суммируем лиды и расход
        const totalLeads = matchingOffers.reduce((sum, offer) => {
          return sum + (offer.convtype7 || 0);
        }, 0);

        const totalCost = matchingOffers.reduce((sum, offer) => {
          return sum + (offer.cost || 0);
        }, 0);

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
    console.error('❌ Ошибка загрузки данных о лидах:', error);
    throw error;
  }
};

/**
 * Получает данные из RedTrack API за указанный период с пагинацией
 * С обработкой rate limiting и задержками между запросами
 *
 * @param {number} daysCount - Количество дней для загрузки (включая сегодняшний)
 * @returns {Promise<Array>} - Массив результатов
 */
async function fetchRedtrackDataForPeriod(daysCount) {
  // Период выборки
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - (daysCount - 1)); // N дней, включая сегодня

  const dateFrom = formatDate(startDate);
  const dateTo = formatDate(today);

  const pageSize = 1000;
  let page = 1;
  let allResults = [];

  // Цикл для получения всех данных с пагинацией
  while (true) {
    const url = `${REDTRACK_API_URL}?api_key=${REDTRACK_API_KEY}&group=offer&date_from=${dateFrom}&date_to=${dateTo}&page=${page}&limit=${pageSize}`;

    let retryCount = 0;
    let success = false;

    // Retry логика для обработки 429
    while (retryCount <= MAX_RETRIES_ON_429 && !success) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        const code = response.status;

        // Обработка rate limiting
        if (code === 429) {
          retryCount++;
          if (retryCount <= MAX_RETRIES_ON_429) {
            console.log(`    ⚠️ Rate limit (429), попытка ${retryCount}/${MAX_RETRIES_ON_429}, пауза ${DELAY_ON_RATE_LIMIT}мс...`);
            await sleep(DELAY_ON_RATE_LIMIT);
            continue;
          } else {
            console.log(`    ❌ Превышен лимит попыток при rate limiting. Пропускаем оставшиеся данные.`);
            return allResults;
          }
        }

        if (code !== 200) {
          console.log(`    Запрос вернул код ${code}. Остановка.`);
          return allResults;
        }

        const data = await response.json();
        let results = [];

        // Обработка разных форматов ответа
        if (Array.isArray(data)) {
          results = data;
        } else if (data && data.data && data.data.report) {
          results = data.data.report;
        }

        if (results.length === 0) {
          return allResults;
        }

        allResults = allResults.concat(results);
        page++;
        success = true;

        // Задержка между страницами (кроме первой)
        if (page > 2) {
          await sleep(DELAY_BETWEEN_PAGES);
        }

      } catch (error) {
        console.error(`    Ошибка при загрузке страницы ${page} за ${daysCount} дней:`, error);
        return allResults;
      }
    }

    if (!success) {
      return allResults;
    }
  }
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
