/**
 * Скрипт для получения данных о лидах за разные периоды из RedTrack API
 * – Загружает данные за 90 дней одним запросом (оптимизация)
 * – Агрегирует данные на клиенте для периодов: 4, 7, 14, 30, 60, 90 дней
 * – Использует пагинацию для получения всех данных
 * – Группирует по offer и date для последующей агрегации
 */

const REDTRACK_API_KEY = 'SY5wfZkzhZ0tu0YiKi9B';
const REDTRACK_API_URL = 'https://api.redtrack.io/report';

// Периоды для агрегации данных
const PERIODS = [
  { days: 4, label: '4 дня' },
  { days: 7, label: '7 дней' },
  { days: 14, label: '14 дней' },
  { days: 30, label: '30 дней' },
  { days: 60, label: '60 дней' },
  { days: 90, label: '90 дней' }
];

// Настройки для обработки rate limiting
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
 * Оптимизированная версия: один запрос на 90 дней + агрегация на клиенте
 *
 * @param {Array} metrics - Массив метрик офферов
 * @returns {Promise<Object>} - Объект с обновленными метриками
 */
export const updateLeadsFromRedtrack = async (metrics) => {
  try {
    console.log('🔄 Начинаем загрузку данных о лидах из RedTrack за 90 дней...');

    // Загружаем все данные за 90 дней одним запросом
    const allData = await fetchRedtrackDataFor90Days();
    console.log(`✅ Загружено ${allData.length} записей за 90 дней`);

    // Группируем данные по offer и date для быстрой агрегации
    const dataByOfferAndDate = groupDataByOfferAndDate(allData);

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

        // Проходим по всем офферам и датам
        Object.keys(dataByOfferAndDate).forEach(offerName => {
          // Проверяем, содержит ли название оффера артикул
          if (offerName.includes(article)) {
            const offerData = dataByOfferAndDate[offerName];

            // Суммируем данные за период
            Object.keys(offerData).forEach(dateStr => {
              const recordDate = new Date(dateStr);
              recordDate.setHours(0, 0, 0, 0);

              if (recordDate >= startDate && recordDate <= today) {
                totalLeads += offerData[dateStr].leads;
                totalCost += offerData[dateStr].cost;
              }
            });
          }
        });

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
 * Группирует данные по offer и date для быстрой агрегации
 * @param {Array} data - Массив записей с данными
 * @returns {Object} - Объект вида { offerName: { date: { leads, cost } } }
 */
function groupDataByOfferAndDate(data) {
  const grouped = {};

  data.forEach(record => {
    const offerName = record.offer || '';
    const date = record.date || '';
    const leads = record.convtype7 || 0;
    const cost = record.cost || 0;

    if (!offerName || !date) return;

    if (!grouped[offerName]) {
      grouped[offerName] = {};
    }

    if (!grouped[offerName][date]) {
      grouped[offerName][date] = { leads: 0, cost: 0 };
    }

    grouped[offerName][date].leads += leads;
    grouped[offerName][date].cost += cost;
  });

  return grouped;
}

/**
 * Получает данные из RedTrack API за 90 дней с пагинацией
 * Группирует по offer и date для последующей агрегации на клиенте
 * С обработкой rate limiting и задержками между запросами
 *
 * @returns {Promise<Array>} - Массив результатов
 */
async function fetchRedtrackDataFor90Days() {
  // Период выборки - 90 дней включая сегодня
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - 89); // 90 дней, включая сегодня

  const dateFrom = formatDate(startDate);
  const dateTo = formatDate(today);

  console.log(`📅 Загрузка данных с ${dateFrom} по ${dateTo} (90 дней)...`);

  const pageSize = 1000;
  let page = 1;
  let allResults = [];

  // Цикл для получения всех данных с пагинацией
  while (true) {
    // Группируем по offer и date для детализации по дням
    const url = `${REDTRACK_API_URL}?api_key=${REDTRACK_API_KEY}&group=offer,date&date_from=${dateFrom}&date_to=${dateTo}&page=${page}&limit=${pageSize}`;

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
            console.log(`  ⚠️ Rate limit (429), попытка ${retryCount}/${MAX_RETRIES_ON_429}, пауза ${DELAY_ON_RATE_LIMIT}мс...`);
            await sleep(DELAY_ON_RATE_LIMIT);
            continue;
          } else {
            console.log(`  ❌ Превышен лимит попыток при rate limiting. Возвращаем частичные данные.`);
            return allResults;
          }
        }

        if (code !== 200) {
          console.log(`  Запрос вернул код ${code}. Остановка.`);
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
          console.log(`  ✅ Загружено всего ${allResults.length} записей (${page - 1} страниц)`);
          return allResults;
        }

        allResults = allResults.concat(results);
        console.log(`  📄 Страница ${page}: загружено ${results.length} записей (всего: ${allResults.length})`);
        page++;
        success = true;

        // Задержка между страницами
        if (page > 2) {
          await sleep(DELAY_BETWEEN_PAGES);
        }

      } catch (error) {
        console.error(`  ❌ Ошибка при загрузке страницы ${page}:`, error);
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
