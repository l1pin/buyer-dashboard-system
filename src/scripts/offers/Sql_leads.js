/**
 * МАКСИМАЛЬНО ОПТИМІЗОВАНИЙ скрипт для отримання даних про ліди та рейтинг з SQL БД
 *
 * ПРОДУКТИВНІСТЬ (без лімітів Netlify):
 * – 🚀 Фільтрує по offer_id_tracker в SQL (WHERE IN) - індекс працює ефективно
 * – 🚀 3 паралельних запити по 30 днів (замість 6 по 15) - менше HTTP overhead
 * – 🚀 Використовує preloadedData з Calculate_days.js (економія запитів!)
 * – 🚀 Таймаут 60с (без обмеження Netlify 26с)
 *
 * ФУНКЦІОНАЛ:
 * – Завантажує дані за 90 днів для CPL, Лідів та Рейтингу
 * – Агрегує дані на клієнті для періодів: 4, 7, 14, 30, 60, 90 днів
 * – Розраховує рейтинг (A/B/C/D) на основі CPL за 4 дні та "Ціни ліда в зоні" (red_zone_price)
 * – Якщо red_zone_price відсутній, використовується константа 3.5
 * – Оновлює ТРИ колонки одним запитом: CPL 4дн, Ліди 4дн, Рейтинг
 * – Також агрегує дані по source_id_tracker для метрик байерів
 */

// Прямой доступ к API (CORS включен на сервере)
const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

// Кэш для мемоизации результатов (оптимизация производительности)
const metricsCache = new Map();
const consecutiveDaysCache = new Map();

// Очистка кэша (вызывать при обновлении данных)
export function clearMetricsCache() {
  metricsCache.clear();
  consecutiveDaysCache.clear();
}

// Периоды для агрегации данных
const PERIODS = [
  { days: 4, label: '4 дня' },
  { days: 7, label: '7 дней' },
  { days: 14, label: '14 дней' },
  { days: 30, label: '30 дней' },
  { days: 60, label: '60 дней' },
  { days: 90, label: '90 дней' }
];

// 🚀 Оптимізовані налаштування (без лімітів Netlify)
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;   // 1с між спробами (швидше)
const FETCH_TIMEOUT = 60000; // 60 секунд

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
    // 🎯 ВАЖНО: Используем ВСЕ данные (preloadedData), а не только 90 дней
    // Это нужно для расчёта статистики за последние 14 АКТИВНЫХ дней байера
    const dataForBuyers = preloadedData && preloadedData.length > 0 ? preloadedData : data90Days;
    const dataBySourceIdAndDate = groupDataBySourceIdAndDate(dataForBuyers);
    console.log(`📊 Уникальных source_id: ${Object.keys(dataBySourceIdAndDate).length} (данных за ${preloadedData ? '12 месяцев' : '90 дней'})`);

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
 * Агрегирует метрики за последние N АКТИВНЫХ дней байера (дни с cost > 0)
 * В отличие от aggregateMetricsBySourceIds, эта функция считает не календарные дни,
 * а именно дни, когда у байера был расход
 * @param {string} article - Артикул оффера
 * @param {Array} sourceIds - Массив source_id байера
 * @param {Object} dataBySourceIdAndDate - Сгруппированные данные { article: { source_id: { date: { leads, cost } } } }
 * @param {number} activeDaysCount - Количество активных дней для агрегации (по умолчанию 14)
 * @param {Object|null} accessDatesMap - Маппинг source_id -> {accessGranted, accessLimited} для фильтрации по датам доступа каждого канала
 * @returns {Object} - { leads, cost, cpl, activeDays: количество реально использованных активных дней }
 */
export function aggregateMetricsByActiveDays(article, sourceIds, dataBySourceIdAndDate, activeDaysCount = 14, accessDatesMap = null) {
  // Оптимизация: проверка кэша (включаем access dates map в ключ)
  const accessMapKey = accessDatesMap ? JSON.stringify(accessDatesMap) : '';
  const cacheKey = `${article}|${sourceIds.join(',')}|${activeDaysCount}|${accessMapKey}`;
  if (metricsCache.has(cacheKey)) {
    return metricsCache.get(cacheKey);
  }

  const articleData = dataBySourceIdAndDate[article];
  if (!articleData) {
    const emptyResult = { leads: 0, cost: 0, cpl: 0, activeDays: 0 };
    metricsCache.set(cacheKey, emptyResult);
    return emptyResult;
  }

  // Собираем все даты с данными для всех source_ids байера
  // Структура: { dateStr: { leads, cost } }
  const aggregatedByDate = {};

  sourceIds.forEach(sourceId => {
    const sourceData = articleData[sourceId];
    if (!sourceData) return;

    // Получаем даты доступа для ЭТОГО конкретного source_id
    const channelAccess = accessDatesMap?.[sourceId] || {};
    const accessStart = channelAccess.accessGranted ? new Date(channelAccess.accessGranted) : null;
    const accessEnd = channelAccess.accessLimited ? new Date(channelAccess.accessLimited) : null;
    if (accessStart) accessStart.setHours(0, 0, 0, 0);
    if (accessEnd) accessEnd.setHours(23, 59, 59, 999);

    Object.keys(sourceData).forEach(dateStr => {
      // Фильтруем по датам доступа для ЭТОГО канала
      const recordDate = new Date(dateStr);
      recordDate.setHours(0, 0, 0, 0);

      // Пропускаем если дата ВНЕ периода доступа для этого канала
      if (accessStart && recordDate < accessStart) return;
      if (accessEnd && recordDate > accessEnd) return;

      const dayData = sourceData[dateStr];
      if (!aggregatedByDate[dateStr]) {
        aggregatedByDate[dateStr] = { leads: 0, cost: 0 };
      }
      aggregatedByDate[dateStr].leads += dayData.leads || 0;
      aggregatedByDate[dateStr].cost += dayData.cost || 0;
    });
  });

  // Фильтруем только активные дни (где cost > 0)
  const activeDatesWithData = Object.entries(aggregatedByDate)
    .filter(([_, data]) => data.cost > 0)
    .map(([dateStr, data]) => ({
      date: new Date(dateStr),
      dateStr,
      leads: data.leads,
      cost: data.cost
    }));

  // Сортируем по дате от новых к старым
  activeDatesWithData.sort((a, b) => b.date - a.date);

  // Берём последние N активных дней
  const selectedDays = activeDatesWithData.slice(0, activeDaysCount);

  // Суммируем метрики
  let totalLeads = 0;
  let totalCost = 0;

  selectedDays.forEach(day => {
    totalLeads += day.leads;
    totalCost += day.cost;
  });

  const cpl = totalLeads > 0 ? totalCost / totalLeads : 0;

  const result = {
    leads: totalLeads,
    cost: totalCost,
    cpl: cpl,
    activeDays: selectedDays.length
  };

  // Сохраняем в кэш
  metricsCache.set(cacheKey, result);
  return result;
}

/**
 * Подсчитывает количество дней подряд (с конца) с cost > 0 для байера
 * Считает с сегодняшнего дня назад, пока cost > 0
 * @param {string} article - Артикул оффера
 * @param {Array} sourceIds - Массив source_id байера
 * @param {Object} dataBySourceIdAndDate - Сгруппированные данные { article: { source_id: { date: { leads, cost } } } }
 * @param {Object|null} accessDatesMap - Маппинг source_id -> {accessGranted, accessLimited} для фильтрации по датам доступа каждого канала
 * @returns {number} - Количество дней подряд с cost > 0
 */
export function calculateConsecutiveActiveDays(article, sourceIds, dataBySourceIdAndDate, accessDatesMap = null) {
  // Оптимизация: проверка кэша (включаем access dates map в ключ)
  const accessMapKey = accessDatesMap ? JSON.stringify(accessDatesMap) : '';
  const cacheKey = `${article}|${sourceIds.join(',')}|${accessMapKey}`;
  if (consecutiveDaysCache.has(cacheKey)) {
    return consecutiveDaysCache.get(cacheKey);
  }

  const articleData = dataBySourceIdAndDate[article];
  if (!articleData) {
    consecutiveDaysCache.set(cacheKey, 0);
    return 0;
  }

  // Собираем все даты с cost > 0 для всех source_ids байера (с учётом дат доступа каждого канала)
  const datesWithCost = new Set();
  // Также определяем максимальный accessLimited (для начальной точки) и минимальный accessGranted (для остановки)
  let latestAccessEnd = null;
  let earliestAccessStart = null;

  sourceIds.forEach(sourceId => {
    const sourceData = articleData[sourceId];
    if (!sourceData) return;

    // Получаем даты доступа для ЭТОГО конкретного source_id
    const channelAccess = accessDatesMap?.[sourceId] || {};
    const accessStart = channelAccess.accessGranted ? new Date(channelAccess.accessGranted) : null;
    const accessEnd = channelAccess.accessLimited ? new Date(channelAccess.accessLimited) : null;
    if (accessStart) accessStart.setHours(0, 0, 0, 0);
    if (accessEnd) accessEnd.setHours(23, 59, 59, 999);

    // Трекаем границы для всех каналов
    if (accessEnd && (!latestAccessEnd || accessEnd > latestAccessEnd)) {
      latestAccessEnd = accessEnd;
    }
    if (accessStart && (!earliestAccessStart || accessStart < earliestAccessStart)) {
      earliestAccessStart = accessStart;
    }

    Object.keys(sourceData).forEach(dateStr => {
      if (sourceData[dateStr].cost > 0) {
        // Фильтруем по датам доступа для ЭТОГО канала
        const recordDate = new Date(dateStr);
        recordDate.setHours(0, 0, 0, 0);

        // Пропускаем если дата ВНЕ периода доступа для этого канала
        if (accessStart && recordDate < accessStart) return;
        if (accessEnd && recordDate > accessEnd) return;

        datesWithCost.add(dateStr);
      }
    });
  });

  if (datesWithCost.size === 0) {
    consecutiveDaysCache.set(cacheKey, 0);
    return 0;
  }

  // Определяем начальную точку отсчёта
  // Если latestAccessEnd задан и меньше сегодня, начинаем с него
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate = new Date(today);
  if (latestAccessEnd && latestAccessEnd < today) {
    startDate = new Date(latestAccessEnd);
    startDate.setHours(0, 0, 0, 0);
  }

  let consecutiveDays = 0;
  let currentDate = new Date(startDate);

  // Идем назад от начальной даты
  for (let i = 0; i < 365; i++) { // Максимум 365 дней назад
    const dateStr = currentDate.toISOString().split('T')[0];

    // Если вышли за пределы earliestAccessStart - прекращаем
    if (earliestAccessStart && currentDate < earliestAccessStart) {
      break;
    }

    if (datesWithCost.has(dateStr)) {
      consecutiveDays++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break; // Прерываем, как только нашли день без cost
    }
  }

  // Сохраняем в кэш
  consecutiveDaysCache.set(cacheKey, consecutiveDays);
  return consecutiveDays;
}

/**
 * Находит последний активный день (с cost > 0) для байера в пределах периода доступа
 * @param {string} article - Артикул оффера
 * @param {Array} sourceIds - Массив source_id байера
 * @param {Object} dataBySourceIdAndDate - Сгруппированные данные { article: { source_id: { date: { leads, cost } } } }
 * @param {Object|null} accessDatesMap - Маппинг source_id -> {accessGranted, accessLimited} для фильтрации по датам доступа каждого канала
 * @returns {string|null} - Дата последнего активного дня (YYYY-MM-DD) или null если нет данных
 */
export function findLastActiveDate(article, sourceIds, dataBySourceIdAndDate, accessDatesMap = null) {
  const articleData = dataBySourceIdAndDate[article];
  if (!articleData) {
    return null;
  }

  let lastActiveDate = null;

  sourceIds.forEach(sourceId => {
    const sourceData = articleData[sourceId];
    if (!sourceData) return;

    // Получаем даты доступа для ЭТОГО конкретного source_id
    const channelAccess = accessDatesMap?.[sourceId] || {};
    const accessStart = channelAccess.accessGranted ? new Date(channelAccess.accessGranted) : null;
    const accessEnd = channelAccess.accessLimited ? new Date(channelAccess.accessLimited) : null;
    if (accessStart) accessStart.setHours(0, 0, 0, 0);
    if (accessEnd) accessEnd.setHours(23, 59, 59, 999);

    Object.keys(sourceData).forEach(dateStr => {
      if (sourceData[dateStr].cost > 0) {
        // Фильтруем по датам доступа для ЭТОГО канала
        const recordDate = new Date(dateStr);
        recordDate.setHours(0, 0, 0, 0);

        // Пропускаем если дата ВНЕ периода доступа для этого канала
        if (accessStart && recordDate < accessStart) return;
        if (accessEnd && recordDate > accessEnd) return;

        // Обновляем lastActiveDate если эта дата позже
        if (!lastActiveDate || dateStr > lastActiveDate) {
          lastActiveDate = dateStr;
        }
      }
    });
  });

  return lastActiveDate;
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

  // 🚀 МАКСИМАЛЬНА ОПТИМІЗАЦІЯ: 3 періоди по 30 днів (замість 6 по 15)
  // Без лімітів Netlify можемо завантажувати більше за раз
  console.log(`📅 Розбиваємо 90 днів на 3 періоди (по 30 днів) для паралельного завантаження...`);

  const periods = [];
  for (let i = 0; i < 3; i++) {
    const periodStart = new Date(start);
    periodStart.setDate(start.getDate() + (i * 30));

    const periodEnd = new Date(start);
    periodEnd.setDate(start.getDate() + ((i + 1) * 30) - 1);

    // Останній період може бути коротшим
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

    console.log(`  📆 ${p.from}..${p.to} (30 днів, паралельно)`);

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

  console.log(`✅ 90 днів: ${allData.length} записів (${successCount}/${periods.length} періодів по 30 днів) - завантажено ПАРАЛЕЛЬНО 🚀`);

  return allData;
}

/**
 * Універсальний fetch з оптимізованими таймаутами
 * 🚀 БЕЗ ЛІМІТІВ NETLIFY: таймаут 60с, швидкий retry
 */
export async function getDataBySql(strSQL, retryCount = 0) {
  try {
    // Контролер для відміни по таймауту
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(CORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ assoc: true, sql: strSQL }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

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
    // Обробка таймаутів та мережевих помилок
    if (retryCount < MAX_RETRIES) {
      const isTimeout = error.name === 'AbortError';
      const isNetworkError = error.message.includes('fetch') || error.message.includes('network');

      if (isTimeout || isNetworkError) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        const errorType = isTimeout ? 'Таймаут' : 'Мережева помилка';
        console.log(`      ⚠️ ${errorType}, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
        await sleep(delay);
        return getDataBySql(strSQL, retryCount + 1);
      }
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

/**
 * ОПТИМИЗИРОВАННАЯ ФУНКЦИЯ: Загружает метрики для ОДНОГО байера за 14 дней
 * Используется при добавлении нового байера к офферу
 *
 * @param {Array} sourceIds - Массив source_id байера
 * @param {string} offerIdTracker - ID оффера в трекере
 * @param {string} article - Артикул оффера
 * @returns {Promise<Object>} - { dataBySourceIdAndDate, metrics: { leads, cost, cpl } }
 */
export async function fetchMetricsForSingleBuyer(sourceIds, offerIdTracker, article) {
  try {
    console.log(`📊 Загрузка метрик для байера: ${sourceIds.length} source_ids, offer: ${offerIdTracker}`);

    if (!sourceIds || sourceIds.length === 0 || !offerIdTracker) {
      return {
        dataBySourceIdAndDate: {},
        metrics: { leads: 0, cost: 0, cpl: 0 }
      };
    }

    // Период: 14 дней назад от сегодня
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 13); // 14 дней включая сегодня

    const fromStr = formatDate(startDate);
    const toStr = formatDate(today);

    // Формируем SQL запрос
    const sourceIdsSql = sourceIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    const offerIdSql = `'${offerIdTracker.replace(/'/g, "''")}'`;

    const sql = `
      SELECT offer_id_tracker, adv_date, valid, cost, source_id_tracker
      FROM ads_collection
      WHERE adv_date BETWEEN '${fromStr}' AND '${toStr}'
        AND offer_id_tracker = ${offerIdSql}
        AND source_id_tracker IN (${sourceIdsSql})
    `;

    console.log(`📆 Запрос метрик за ${fromStr}..${toStr}`);

    const rawData = await getDataBySql(sql);
    console.log(`✅ Получено ${rawData.length} записей`);

    // Группируем данные по source_id и дате
    const dataBySourceIdAndDate = {};

    if (!dataBySourceIdAndDate[article]) {
      dataBySourceIdAndDate[article] = {};
    }

    let totalLeads = 0;
    let totalCost = 0;

    rawData.forEach(row => {
      const sourceId = row.source_id_tracker;
      const dateStr = row.adv_date ? String(row.adv_date).slice(0, 10) : null;
      const leads = Number(row.valid) || 0;
      const cost = Number(row.cost) || 0;

      if (!sourceId || !dateStr) return;

      if (!dataBySourceIdAndDate[article][sourceId]) {
        dataBySourceIdAndDate[article][sourceId] = {};
      }

      if (!dataBySourceIdAndDate[article][sourceId][dateStr]) {
        dataBySourceIdAndDate[article][sourceId][dateStr] = { leads: 0, cost: 0 };
      }

      dataBySourceIdAndDate[article][sourceId][dateStr].leads += leads;
      dataBySourceIdAndDate[article][sourceId][dateStr].cost += cost;

      totalLeads += leads;
      totalCost += cost;
    });

    const cpl = totalLeads > 0 ? totalCost / totalLeads : 0;

    console.log(`✅ Метрики байера за 14 дней: Leads=${totalLeads}, Cost=${totalCost.toFixed(2)}, CPL=${cpl.toFixed(2)}`);

    return {
      dataBySourceIdAndDate,
      metrics: {
        leads: totalLeads,
        cost: totalCost,
        cpl: cpl
      }
    };

  } catch (error) {
    console.error('❌ Ошибка загрузки метрик байера:', error);
    return {
      dataBySourceIdAndDate: {},
      metrics: { leads: 0, cost: 0, cpl: 0 }
    };
  }
}

/**
 * Загружает метрики байеров за ВСЁ ВРЕМЯ (БЕЗ ограничения по датам!)
 * Просто ищет по offer_id и source_id
 * Используется для расчёта статистики за последние 14 активных дней
 *
 * @param {Object} articleOfferMap - Маппинг article -> offer_id_tracker
 * @param {Function} onProgress - Callback для прогрессивного обновления (получает частичные данные)
 * @returns {Promise<Object>} - Данные в формате { article: { source_id: { date: { leads, cost } } } }
 */
export async function fetchBuyerMetricsAllTime(articleOfferMap = {}, onProgress = null) {
  // Создаем обратный маппинг: offer_id -> article (как в updateLeadsFromSql)
  const offerIdArticleMap = {};
  Object.keys(articleOfferMap).forEach(article => {
    const offerId = articleOfferMap[article];
    if (offerId) {
      offerIdArticleMap[offerId] = article;
    }
  });

  const offerIds = Object.keys(offerIdArticleMap);

  if (offerIds.length === 0) {
    console.warn('⚠️ fetchBuyerMetricsAllTime: Маппинг пуст!');
    return {};
  }

  console.log(`📊 Загрузка метрик байеров за ВСЁ ВРЕМЯ для ${offerIds.length} офферов...`);

  // Создаем SQL список для IN clause (ВСЕ offer_ids)
  const offerIdsList = offerIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

  // Логируем примеры offer_id для отладки
  console.log(`🔍 Примеры offer_id: ${offerIds.slice(0, 3).join(', ')}...`);

  // ШАГ 1: Найти MIN/MAX даты для ВСЕХ офферов (БЕЗ ограничения по датам - как в календаре!)
  console.log('🔍 Поиск диапазона дат (MIN/MAX) для всех офферов...');
  const dateRangeSql = `
    SELECT MIN(adv_date) as first_date, MAX(adv_date) as last_date
    FROM ads_collection
    WHERE offer_id_tracker IN (${offerIdsList})
      AND cost > 0
  `;

  let firstDate, lastDate;
  try {
    console.log('📤 Отправляем запрос диапазона дат...');
    const dateRangeData = await getDataBySql(dateRangeSql);
    console.log('📥 Ответ диапазона дат:', JSON.stringify(dateRangeData));

    if (!dateRangeData || dateRangeData.length === 0 || !dateRangeData[0]?.last_date) {
      console.warn('⚠️ Нет данных о расходах для офферов (last_date пуст)');
      console.warn('⚠️ Проверьте, что offer_id_tracker в БД совпадает с данными из Supabase');
      return {};
    }
    firstDate = dateRangeData[0].first_date;
    lastDate = dateRangeData[0].last_date;
    console.log(`📅 Найден диапазон дат: ${firstDate} - ${lastDate}`);
  } catch (error) {
    console.error('❌ Ошибка поиска диапазона дат:', error);
    return {};
  }

  // ШАГ 2: Загружаем данные ЗА ВЕСЬ ПЕРИОД батчами по offer_id
  // 🚀 Оптимизация: увеличиваем батч для меньше HTTP-запросов
  const BATCH_SIZE = 200; // Увеличен с 100 до 200 (~15 батчей вместо 30)
  const CONCURRENT_LIMIT = 8; // 8 параллельных запросов

  const batches = [];
  for (let i = 0; i < offerIds.length; i += BATCH_SIZE) {
    batches.push(offerIds.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Загрузка данных: ${batches.length} батчей по ${BATCH_SIZE} офферов (по ${CONCURRENT_LIMIT} параллельно)`);

  // Накопительный объект для группировки
  const grouped = {};
  let totalRecords = 0;
  let completedBatches = 0;

  // Функция группировки данных батча
  const groupBatchData = (rawData) => {
    rawData.forEach(row => {
      const offerId = row.offer_id_tracker || '';
      const article = offerIdArticleMap[offerId] || '';
      const sourceId = row.source_id_tracker || 'unknown';
      const dateStr = row.adv_date ? String(row.adv_date).slice(0, 10) : null;
      const leads = Number(row.total_leads) || 0;
      const cost = Number(row.total_cost) || 0;

      if (!article || !sourceId || sourceId === 'unknown' || !dateStr) return;

      if (!grouped[article]) {
        grouped[article] = {};
      }
      if (!grouped[article][sourceId]) {
        grouped[article][sourceId] = {};
      }
      if (!grouped[article][sourceId][dateStr]) {
        grouped[article][sourceId][dateStr] = { leads: 0, cost: 0 };
      }

      grouped[article][sourceId][dateStr].leads += leads;
      grouped[article][sourceId][dateStr].cost += cost;
    });
  };

  // Функция для выполнения одного батча
  const fetchBatch = async (batchOfferIds, batchIndex) => {
    const batchOfferIdsList = batchOfferIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

    const sql = `
      SELECT
        offer_id_tracker,
        DATE(adv_date) as adv_date,
        SUM(valid) as total_leads,
        SUM(cost) as total_cost,
        source_id_tracker
      FROM ads_collection
      WHERE adv_date BETWEEN '${firstDate}' AND '${lastDate}'
        AND offer_id_tracker IN (${batchOfferIdsList})
        AND cost > 0
      GROUP BY offer_id_tracker, DATE(adv_date), source_id_tracker
    `;

    try {
      const rawData = await getDataBySql(sql);
      console.log(`  ✅ Батч ${batchIndex + 1}/${batches.length}: ${rawData.length} записей`);
      return rawData;
    } catch (error) {
      console.warn(`  ⚠️ Батч ${batchIndex + 1}/${batches.length} ошибка: ${error.message}`);
      return [];
    }
  };

  // Выполняем батчи с прогрессивным обновлением UI
  for (let i = 0; i < batches.length; i += CONCURRENT_LIMIT) {
    const chunk = batches.slice(i, i + CONCURRENT_LIMIT);
    const chunkPromises = chunk.map((batch, idx) => fetchBatch(batch, i + idx));
    const chunkResults = await Promise.all(chunkPromises);

    // Сразу группируем данные каждого батча
    chunkResults.forEach(batchData => {
      totalRecords += batchData.length;
      groupBatchData(batchData);
    });

    completedBatches += chunk.length;

    // 🚀 Прогрессивное обновление: отправляем данные в UI после каждой группы батчей
    if (onProgress) {
      const progress = Math.round((completedBatches / batches.length) * 100);
      console.log(`📊 Прогресс: ${progress}% (${completedBatches}/${batches.length} батчей, ${Object.keys(grouped).length} артикулов)`);
      onProgress({ ...grouped }, progress, completedBatches === batches.length);
    }

    // Небольшая пауза между группами батчей
    if (i + CONCURRENT_LIMIT < batches.length) {
      await new Promise(r => setTimeout(r, 50)); // Уменьшено с 100мс до 50мс
    }
  }

  console.log(`✅ Всего загружено ${totalRecords} записей за ВСЁ время`);

  console.log(`📊 Сгруппировано по ${Object.keys(grouped).length} артикулам`);

  return grouped;
}
