/**
 * Скрипт для получения данных CPL за последние 4 дня из RedTrack API
 * – Использует пагинацию для получения всех данных
 * – Группирует по offer
 * – Суммирует type7_cpa для каждого артикула
 */

const REDTRACK_API_KEY = 'SY5wfZkzhZ0tu0YiKi9B';
const REDTRACK_API_URL = 'https://api.redtrack.io/report';

/**
 * Получает данные CPL за последние 4 дня для массива метрик
 *
 * @param {Array} metrics - Массив метрик офферов
 * @returns {Promise<Object>} - Объект с обновленными метриками
 */
export const updateCplFrom4Days = async (metrics) => {
  try {
    console.log('🔄 Начинаем загрузку CPL за последние 4 дня из RedTrack...');

    // Получаем все данные из RedTrack API
    const allResults = await fetchRedtrackData();
    console.log(`📊 Получено записей из RedTrack: ${allResults.length}`);

    // Обновляем метрики с данными CPL
    let processedCount = 0;

    const updatedMetrics = metrics.map(metric => {
      const article = metric.article;

      if (!article) {
        return metric;
      }

      // Ищем офферы, которые содержат этот артикул в названии
      const matchingOffers = allResults.filter(offer => {
        const offerName = offer.offer || '';
        return offerName.includes(article);
      });

      if (matchingOffers.length === 0) {
        return {
          ...metric,
          cpl_4days: 0
        };
      }

      // Суммируем type7_cpa для всех найденных офферов
      const totalCpa = matchingOffers.reduce((sum, offer) => {
        return sum + (offer.type7_cpa || 0);
      }, 0);

      processedCount++;

      return {
        ...metric,
        cpl_4days: totalCpa
      };
    });

    console.log(`✅ Обновлено офферов с CPL: ${processedCount}`);

    return {
      metrics: updatedMetrics,
      processedCount: processedCount,
      totalRecords: allResults.length
    };

  } catch (error) {
    console.error('❌ Ошибка загрузки CPL за 4 дня:', error);
    throw error;
  }
};

/**
 * Получает все данные из RedTrack API с пагинацией
 *
 * @returns {Promise<Array>} - Массив всех результатов
 */
async function fetchRedtrackData() {
  // Период выборки - последние 4 дня, включая сегодняшний
  const today = new Date();
  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(today.getDate() - 3); // 4 дня, включая сегодня

  const dateFrom = formatDate(fourDaysAgo);
  const dateTo = formatDate(today);

  console.log(`📅 Период загрузки: ${dateFrom} - ${dateTo}`);

  const pageSize = 1000;
  let page = 1;
  let allResults = [];

  // Цикл для получения всех данных с пагинацией
  while (true) {
    const url = `${REDTRACK_API_URL}?api_key=${REDTRACK_API_KEY}&group=offer&date_from=${dateFrom}&date_to=${dateTo}&page=${page}&limit=${pageSize}`;

    console.log(`📄 Загрузка страницы ${page}...`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const code = response.status;
      console.log(`HTTP ${code}`);

      if (code !== 200) {
        console.log(`Запрос вернул код ${code}. Остановка.`);
        break;
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
        console.log('✅ Получены все данные. Выход из цикла.');
        break;
      }

      console.log(`  Получено записей на странице ${page}: ${results.length}`);
      allResults = allResults.concat(results);
      page++;

    } catch (error) {
      console.error(`Ошибка при загрузке страницы ${page}:`, error);
      break;
    }
  }

  return allResults;
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
