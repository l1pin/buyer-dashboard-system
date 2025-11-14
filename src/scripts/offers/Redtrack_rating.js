/**
 * Скрипт для расчета рейтинга лидов за последние 3 полных месяца из RedTrack API
 * – Загружает данные с группировкой по offer и month
 * – Рассчитывает рейтинг (A/B/C/D) на основе CPL и порогов
 * – Использует пагинацию для получения всех данных
 */

const REDTRACK_API_KEY = 'SY5wfZkzhZ0tu0YiKi9B';
const REDTRACK_API_URL = 'https://api.redtrack.io/report';
const PER_PAGE = 1000;

// Настройки для обработки rate limiting
const DELAY_BETWEEN_PAGES_RATING = 500; // 0.5 секунды между страницами
const DELAY_ON_RATE_LIMIT_RATING = 5000; // 5 секунд при получении 429
const MAX_RETRIES_ON_429_RATING = 3; // Максимум 3 попытки при 429

/**
 * Задержка выполнения
 * @param {number} ms - Время задержки в миллисекундах
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Получает последние 3 полных месяца в формате YYYY-MM
 * @returns {Array<string>} Массив строк вида ['2024-08', '2024-09', '2024-10']
 */
function getLast3FullMonths() {
  const today = new Date();
  const firstDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const months = [];

  for (let i = 3; i >= 1; i--) {
    const d = new Date(firstDay);
    d.setUTCMonth(d.getUTCMonth() - i);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
  }

  console.log('📅 Последние 3 месяца:', months.join(', '));
  return months;
}

/**
 * Получает последний день месяца в формате YYYY-MM-DD
 * @param {string} ym - Месяц в формате YYYY-MM
 * @returns {string} Последний день месяца
 */
function getLastDayString(ym) {
  const [year, month] = ym.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${ym}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Конвертирует название месяца из RedTrack в формат YYYY-MM
 * @param {string} monthName - Название месяца (например, 'Jan', 'Feb')
 * @param {string} dateFrom - Дата начала периода
 * @param {string} dateTo - Дата конца периода
 * @returns {string|null} Месяц в формате YYYY-MM
 */
function convertMonthNameToYYYYMM(monthName, dateFrom, dateTo) {
  const monthMap = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };

  if (!monthMap[monthName]) return null;

  const monthNum = monthMap[monthName];
  const startYear = parseInt(dateFrom.split('-')[0]);
  const endYear = parseInt(dateTo.split('-')[0]);

  // Если период пересекает границу года
  if (startYear !== endYear) {
    // Для месяцев Jan-Jun используем endYear, для Jul-Dec - startYear
    const year = ['01','02','03','04','05','06'].includes(monthNum) ? endYear : startYear;
    return `${year}-${monthNum}`;
  }

  return `${startYear}-${monthNum}`;
}

/**
 * Извлекает код оффера (первая часть до пробела или дефиса)
 * @param {string} offer - Название оффера
 * @returns {string} Код оффера
 */
function extractOfferCode(offer) {
  if (!offer) return '';
  const match = offer.match(/^([A-Z0-9]+)(?:\s|-)/);
  return match ? match[1] : offer;
}

/**
 * Рассчитывает рейтинг на основе CPL и порогов
 * @param {number} cpl - CPL (стоимость за лид)
 * @param {number} valV - Порог AC
 * @param {number} valU - Порог AB
 * @param {number} valX - Порог AF
 * @returns {string} Рейтинг (A/B/C/D/N/A)
 */
function calculateRating(cpl, valV, valU, valX) {
  if (isNaN(cpl) || cpl === 0) {
    return 'N/A';
  }

  let base = valV || valU || valX || 3.5;
  if (valV !== null && valU !== null && valX !== null) {
    base = valV > valX ? valV : valU;
  }

  const pct = (cpl / base) * 100;

  if (pct <= 35) return 'A';
  if (pct <= 65) return 'B';
  if (pct <= 90) return 'C';
  return 'D';
}

/**
 * Получает данные из RedTrack API за последние 3 полных месяца
 * @param {Array<string>} monthKeys - Массив месяцев в формате YYYY-MM
 * @returns {Promise<Object>} Карта данных {offerCode: {month: cpl}}
 */
async function fetchRedtrackData(monthKeys = getLast3FullMonths()) {
  console.log('🔄 Начинаем загрузку данных рейтинга из RedTrack...');

  const map = {};
  let page = 1;
  const dateFrom = `${monthKeys[0]}-01`;
  const dateTo = getLastDayString(monthKeys[2]);

  console.log(`  📅 Период: ${dateFrom} - ${dateTo}`);

  while (true) {
    const url = `${REDTRACK_API_URL}?api_key=${REDTRACK_API_KEY}&group=offer,month&date_from=${dateFrom}&date_to=${dateTo}&tracks_view=true&page=${page}&per=${PER_PAGE}`;

    console.log(`  📄 Загрузка страницы ${page}...`);

    let retryCount = 0;
    let success = false;

    // Retry логика для обработки 429
    while (retryCount <= MAX_RETRIES_ON_429_RATING && !success) {
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
          if (retryCount <= MAX_RETRIES_ON_429_RATING) {
            console.log(`    ⚠️ Rate limit (429), попытка ${retryCount}/${MAX_RETRIES_ON_429_RATING}, пауза ${DELAY_ON_RATE_LIMIT_RATING}мс...`);
            await sleep(DELAY_ON_RATE_LIMIT_RATING);
            continue;
          } else {
            console.log(`    ❌ Превышен лимит попыток при rate limiting. Останавливаемся.`);
            return map;
          }
        }

        if (code !== 200) {
          console.log(`    Запрос вернул код ${code}. Остановка.`);
          return map;
        }

        const json = await response.json();

        if (!Array.isArray(json) || json.length === 0) {
          console.log('  ✅ Получены все данные');
          return map;
        }

        // Обработка данных
        json.forEach(row => {
          const offer = (row.offer || '').toString().trim();
          const offerCode = extractOfferCode(offer);
          const monthName = (row.month || '').toString().trim();
          const month = convertMonthNameToYYYYMM(monthName, dateFrom, dateTo);
          const cpl = parseFloat(row.type7_cpa || 0);

          if (!offerCode || !month || isNaN(cpl) || !monthKeys.includes(month)) {
            return;
          }

          if (!map[offerCode]) map[offerCode] = {};
          map[offerCode][month] = cpl;
        });

        console.log(`    ✅ Обработано ${json.length} записей`);

        if (json.length < PER_PAGE) {
          console.log('  ✅ Последняя страница');
          return map;
        }

        page++;
        success = true;

        // Задержка между страницами
        if (page > 1) {
          await sleep(DELAY_BETWEEN_PAGES_RATING);
        }

      } catch (error) {
        console.error(`    Ошибка при загрузке страницы ${page}:`, error);
        return map;
      }
    }

    if (!success) {
      return map;
    }
  }
}

/**
 * Обновляет рейтинги для массива метрик
 * @param {Array} metrics - Массив метрик офферов
 * @returns {Promise<Object>} Объект с обновленными метриками
 */
export const updateLeadRatings = async (metrics) => {
  try {
    console.log('🔄 Начинаем обновление рейтингов лидов...');

    // Получаем последние 3 месяца
    const monthKeys = getLast3FullMonths();

    // Получаем данные из RedTrack
    const redtrackMap = await fetchRedtrackData(monthKeys);
    console.log(`📊 Получено данных для ${Object.keys(redtrackMap).length} офферов`);

    // Обновляем метрики с рейтингами
    let processedCount = 0;

    const updatedMetrics = metrics.map(metric => {
      const article = metric.article;

      if (!article) {
        return metric;
      }

      // Извлекаем первую часть артикула (до пробела или дефиса)
      const offerCode = article.split(/\s|-/)[0];

      // Получаем пороги
      const valV = metric.ac_threshold; // AC
      const valU = metric.ab_threshold; // AB
      const valX = metric.af_threshold; // AF

      // Получаем CPL для последнего месяца
      const lastMonth = monthKeys[2]; // Последний из 3 месяцев
      const cpl = (redtrackMap[offerCode] && redtrackMap[offerCode][lastMonth] !== undefined)
        ? redtrackMap[offerCode][lastMonth]
        : null;

      // Рассчитываем рейтинг
      let rating = 'N/A';
      if (cpl !== null) {
        rating = calculateRating(cpl, valV, valU, valX);
        processedCount++;
      }

      return {
        ...metric,
        lead_rating: rating,
        rating_cpl: cpl
      };
    });

    console.log(`✅ Обновлено рейтингов: ${processedCount}`);

    return {
      metrics: updatedMetrics,
      processedCount: processedCount
    };

  } catch (error) {
    console.error('❌ Ошибка обновления рейтингов:', error);
    throw error;
  }
};
