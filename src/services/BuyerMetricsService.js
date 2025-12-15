/**
 * Сервис для получения детальных метрик байера по офферу
 * Использует прямой доступ к БД API для получения данных за ВСЕ ВРЕМЯ
 *
 * Иерархия данных:
 * 1. campaign_name_tracker
 * 2. campaign_name
 * 3. adv_group_name
 * 4. adv_name
 *
 * Метрики: cost (расход), valid (лиды), CPL (cost / valid)
 */

import { articleOfferMappingService } from './OffersSupabase';

// Прямой доступ к API (CORS включен на сервере)
const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

/**
 * Универсальный fetch с оптимизированными таймаутами и retry
 * @param {string} sql - SQL запрос
 * @param {number} retryCount - Текущая попытка
 * @returns {Promise<Array>} - Массив объектов с данными
 */
async function getDataBySql(sql, retryCount = 0) {
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 1000; // 1 секунда между попытками
  const FETCH_TIMEOUT = 60000; // 60 секунд

  try {
    // Создаём контроллер для отмены по таймауту
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(CORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ assoc: true, sql: sql }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const code = response.status;
    const text = await response.text();

    console.log(`HTTP ${code}, ответ ${(text.length / 1024).toFixed(0)}KB`);

    // Если 500, 502, 503, 504 - пробуем повторить
    if ([500, 502, 503, 504].includes(code) && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`⚠️ HTTP ${code}, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return getDataBySql(sql, retryCount + 1);
    }

    if (code !== 200) {
      throw new Error(`HTTP ${code}: ${text.substring(0, 100)}`);
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

    // Если заголовки в первой строке
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
    // Обработка таймаутов и сетевых ошибок
    if (retryCount < MAX_RETRIES) {
      const isTimeout = error.name === 'AbortError';
      const isNetworkError = error.message.includes('fetch') || error.message.includes('network');

      if (isTimeout || isNetworkError) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`⚠️ ${isTimeout ? 'Timeout' : 'Network error'}, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return getDataBySql(sql, retryCount + 1);
      }
    }

    throw error;
  }
}

/**
 * Получить календарь метрик байера для оффера
 * @param {Array} sourceIds - Массив source_id байера
 * @param {string} article - Артикул оффера
 * @returns {Promise<Object>} - Данные календаря с иерархией
 */
export async function getBuyerMetricsCalendar(sourceIds, article) {
  try {
    console.log('📊 Загрузка календаря метрик байера...');
    console.log('Source IDs:', sourceIds);
    console.log('Article:', article);

    if (!sourceIds || sourceIds.length === 0) {
      console.warn('⚠️ Нет source_ids для байера');
      return {
        period: { start: null, end: null },
        data: [],
        hierarchy: {}
      };
    }

    // 1. Получаем offer_id_tracker по артикулу из Supabase
    const offerIdTracker = await articleOfferMappingService.getOfferIdByArticle(article);
    if (!offerIdTracker) {
      console.warn('⚠️ Не найден offer_id_tracker для артикула');
      return {
        period: { start: null, end: null },
        data: [],
        hierarchy: {}
      };
    }

    console.log('✅ Найден offer_id_tracker:', offerIdTracker);

    // 2. Найти первую и последнюю даты с расходом для этого байера и оффера (ВСЕ ВРЕМЯ)
    const sourceIdsStr = sourceIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    const dateRangeSql = `
      SELECT MIN(adv_date) as first_date, MAX(adv_date) as last_date
      FROM ads_collection
      WHERE offer_id_tracker = '${offerIdTracker.replace(/'/g, "''")}'
        AND source_id_tracker IN (${sourceIdsStr})
        AND cost > 0
    `;

    console.log('🔍 SQL для поиска периода:', dateRangeSql);

    const dateRangeData = await getDataBySql(dateRangeSql);
    console.log('📅 Результат поиска периода:', dateRangeData);

    if (!dateRangeData || dateRangeData.length === 0 || !dateRangeData[0] || !dateRangeData[0].last_date) {
      console.warn('⚠️ Нет данных о расходах для этого байера');
      return {
        period: { start: null, end: null },
        data: [],
        hierarchy: {}
      };
    }

    const firstDate = new Date(dateRangeData[0].first_date);
    const lastDate = new Date(dateRangeData[0].last_date);

    console.log('📅 Период данных (ВСЕ ВРЕМЯ):', {
      start: firstDate.toISOString().split('T')[0],
      end: lastDate.toISOString().split('T')[0]
    });

    // 3. Получить данные за весь период
    const startDateStr = firstDate.toISOString().split('T')[0];
    const endDateStr = lastDate.toISOString().split('T')[0];

    const dataSql = `
      SELECT
        adv_date,
        campaign_name_tracker,
        campaign_name,
        adv_group_name,
        adv_name,
        cost,
        valid
      FROM ads_collection
      WHERE offer_id_tracker = '${offerIdTracker.replace(/'/g, "''")}'
        AND source_id_tracker IN (${sourceIdsStr})
        AND adv_date >= '${startDateStr}'
        AND adv_date <= '${endDateStr}'
      ORDER BY adv_date ASC
    `;

    console.log('🔍 SQL для получения данных:', dataSql);

    const rawData = await getDataBySql(dataSql);
    console.log('✅ Получено записей:', rawData.length);

    // 4. Обработать данные и построить иерархию
    const hierarchy = buildHierarchy(rawData);

    console.log(`✅ Построена иерархия для ${Object.keys(hierarchy).length} дней`);

    return {
      period: {
        start: startDateStr,
        end: endDateStr
      },
      data: rawData,
      hierarchy: hierarchy
    };

  } catch (error) {
    console.error('❌ Ошибка получения календаря метрик:', error);
    throw error;
  }
}

/**
 * Построить иерархию данных по дням
 * @param {Array} data - Сырые данные из БД
 * @returns {Object} - Иерархия по дням
 */
function buildHierarchy(data) {
  const hierarchy = {};

  // Группируем по датам
  const dateGroups = {};
  data.forEach(row => {
    const date = row.adv_date;
    if (!dateGroups[date]) {
      dateGroups[date] = [];
    }
    dateGroups[date].push(row);
  });

  // Строим иерархию для каждой даты
  Object.keys(dateGroups).forEach(date => {
    const rows = dateGroups[date];

    // Уровень 1: campaign_name_tracker
    const level1 = {};

    rows.forEach(row => {
      const tracker = row.campaign_name_tracker || 'Не указано';
      const campaign = row.campaign_name || 'Не указано';
      const group = row.adv_group_name || 'Не указано';
      const ad = row.adv_name || 'Не указано';
      const cost = parseFloat(row.cost) || 0;
      const valid = parseInt(row.valid) || 0;

      // Создаем структуру если не существует
      if (!level1[tracker]) {
        level1[tracker] = {
          cost: 0,
          valid: 0,
          cpl: 0,
          children: {}
        };
      }

      // Уровень 2: campaign_name
      if (!level1[tracker].children[campaign]) {
        level1[tracker].children[campaign] = {
          cost: 0,
          valid: 0,
          cpl: 0,
          children: {}
        };
      }

      // Уровень 3: adv_group_name
      if (!level1[tracker].children[campaign].children[group]) {
        level1[tracker].children[campaign].children[group] = {
          cost: 0,
          valid: 0,
          cpl: 0,
          children: {}
        };
      }

      // Уровень 4: adv_name
      if (!level1[tracker].children[campaign].children[group].children[ad]) {
        level1[tracker].children[campaign].children[group].children[ad] = {
          cost: 0,
          valid: 0,
          cpl: 0
        };
      }

      // Добавляем метрики
      level1[tracker].cost += cost;
      level1[tracker].valid += valid;

      level1[tracker].children[campaign].cost += cost;
      level1[tracker].children[campaign].valid += valid;

      level1[tracker].children[campaign].children[group].cost += cost;
      level1[tracker].children[campaign].children[group].valid += valid;

      level1[tracker].children[campaign].children[group].children[ad].cost += cost;
      level1[tracker].children[campaign].children[group].children[ad].valid += valid;
    });

    // Рассчитываем CPL для всех уровней
    Object.keys(level1).forEach(tracker => {
      level1[tracker].cpl = level1[tracker].valid > 0
        ? level1[tracker].cost / level1[tracker].valid
        : 0;

      Object.keys(level1[tracker].children).forEach(campaign => {
        level1[tracker].children[campaign].cpl = level1[tracker].children[campaign].valid > 0
          ? level1[tracker].children[campaign].cost / level1[tracker].children[campaign].valid
          : 0;

        Object.keys(level1[tracker].children[campaign].children).forEach(group => {
          level1[tracker].children[campaign].children[group].cpl =
            level1[tracker].children[campaign].children[group].valid > 0
              ? level1[tracker].children[campaign].children[group].cost /
                level1[tracker].children[campaign].children[group].valid
              : 0;

          Object.keys(level1[tracker].children[campaign].children[group].children).forEach(ad => {
            level1[tracker].children[campaign].children[group].children[ad].cpl =
              level1[tracker].children[campaign].children[group].children[ad].valid > 0
                ? level1[tracker].children[campaign].children[group].children[ad].cost /
                  level1[tracker].children[campaign].children[group].children[ad].valid
                : 0;
          });
        });
      });
    });

    hierarchy[date] = level1;
  });

  return hierarchy;
}

/**
 * Найти байера для данного source_id и даты на основе периодов доступа
 * @param {Object} sourceIdToPeriods - Маппинг source_id -> [{buyerName, accessGranted, accessLimited}]
 * @param {string} sourceId - ID источника
 * @param {string} date - Дата в формате YYYY-MM-DD
 * @returns {string} - Имя байера или 'Неизвестный байер'
 */
function getBuyerForSourceIdAndDate(sourceIdToPeriods, sourceId, date) {
  const periods = sourceIdToPeriods[sourceId];
  if (!periods || periods.length === 0) {
    return 'Неизвестный байер';
  }

  // Ищем байера, у которого date попадает в период [accessGranted, accessLimited]
  for (const period of periods) {
    const accessGranted = period.accessGranted || '1970-01-01';
    const accessLimited = period.accessLimited; // может быть null

    // Проверяем: accessGranted <= date && (accessLimited === null || date <= accessLimited)
    if (date >= accessGranted && (!accessLimited || date <= accessLimited)) {
      return period.buyerName;
    }
  }

  // Если не нашли по датам - возвращаем первого (fallback для старых данных без дат)
  return periods[0].buyerName;
}

/**
 * Получить календарь метрик для ВСЕХ байеров оффера
 * @param {Array} allBuyers - Массив всех байеров [{buyerName, sourceIds, source, trafficChannels}]
 * @param {string} article - Артикул оффера
 * @param {string} selectedBuyerName - Имя выбранного байера (для сортировки)
 * @returns {Promise<Object>} - Данные календаря с иерархией по байерам
 */
export async function getAllBuyersMetricsCalendar(allBuyers, article, selectedBuyerName) {
  try {
    console.log('📊 Загрузка календаря метрик для ВСЕХ байеров...');
    console.log('Всего байеров:', allBuyers.length);
    console.log('Article:', article);

    if (!allBuyers || allBuyers.length === 0) {
      console.warn('⚠️ Нет байеров для загрузки');
      return {
        period: { start: null, end: null },
        data: [],
        hierarchy: {},
        buyerOrder: []
      };
    }

    // 1. Получаем offer_id_tracker по артикулу из Supabase
    const offerIdTracker = await articleOfferMappingService.getOfferIdByArticle(article);
    if (!offerIdTracker) {
      console.warn('⚠️ Не найден offer_id_tracker для артикула');
      return {
        period: { start: null, end: null },
        data: [],
        hierarchy: {},
        buyerOrder: []
      };
    }

    console.log('✅ Найден offer_id_tracker:', offerIdTracker);

    // 2. Собираем ВСЕ source_ids от всех байеров С ПЕРИОДАМИ ДОСТУПА
    const allSourceIds = [];
    const sourceIdToPeriods = {}; // source_id -> [{buyerName, accessGranted, accessLimited}]

    allBuyers.forEach(buyer => {
      const trafficChannels = buyer.trafficChannels || [];

      // Для каждого source_id из привязки находим соответствующий traffic_channel с датами
      (buyer.sourceIds || []).forEach(sourceId => {
        if (!allSourceIds.includes(sourceId)) {
          allSourceIds.push(sourceId);
        }

        // Ищем channel с этим source_id в traffic_channels байера
        const channel = trafficChannels.find(ch => ch.channel_id === sourceId);

        if (!sourceIdToPeriods[sourceId]) {
          sourceIdToPeriods[sourceId] = [];
        }

        // Добавляем период доступа этого байера к этому source_id
        sourceIdToPeriods[sourceId].push({
          buyerName: buyer.buyerName,
          accessGranted: channel?.access_granted || '2020-01-01',
          accessLimited: channel?.access_limited || null
        });
      });
    });

    console.log('📋 sourceIdToPeriods:', JSON.stringify(sourceIdToPeriods, null, 2));

    if (allSourceIds.length === 0) {
      console.warn('⚠️ Нет source_ids ни у одного байера');
      return {
        period: { start: null, end: null },
        data: [],
        hierarchy: {},
        buyerOrder: []
      };
    }

    console.log('📋 Всего source_ids:', allSourceIds.length);

    // 3. Найти первую и последнюю даты с расходом для ВСЕХ байеров
    const sourceIdsStr = allSourceIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    const dateRangeSql = `
      SELECT MIN(adv_date) as first_date, MAX(adv_date) as last_date
      FROM ads_collection
      WHERE offer_id_tracker = '${offerIdTracker.replace(/'/g, "''")}'
        AND source_id_tracker IN (${sourceIdsStr})
        AND cost > 0
    `;

    console.log('🔍 SQL для поиска периода (все байеры):', dateRangeSql);

    const dateRangeData = await getDataBySql(dateRangeSql);
    console.log('📅 Результат поиска периода:', dateRangeData);

    if (!dateRangeData || dateRangeData.length === 0 || !dateRangeData[0] || !dateRangeData[0].last_date) {
      console.warn('⚠️ Нет данных о расходах для байеров');
      return {
        period: { start: null, end: null },
        data: [],
        hierarchy: {},
        buyerOrder: []
      };
    }

    const firstDate = new Date(dateRangeData[0].first_date);
    const lastDate = new Date(dateRangeData[0].last_date);

    console.log('📅 Период данных (ВСЕ ВРЕМЯ, все байеры):', {
      start: firstDate.toISOString().split('T')[0],
      end: lastDate.toISOString().split('T')[0]
    });

    // 4. Получить данные за весь период с source_id_tracker для маппинга
    const startDateStr = firstDate.toISOString().split('T')[0];
    const endDateStr = lastDate.toISOString().split('T')[0];

    const dataSql = `
      SELECT
        adv_date,
        source_id_tracker,
        campaign_name_tracker,
        campaign_name,
        adv_group_name,
        adv_name,
        cost,
        valid
      FROM ads_collection
      WHERE offer_id_tracker = '${offerIdTracker.replace(/'/g, "''")}'
        AND source_id_tracker IN (${sourceIdsStr})
        AND adv_date >= '${startDateStr}'
        AND adv_date <= '${endDateStr}'
      ORDER BY adv_date ASC
    `;

    console.log('🔍 SQL для получения данных (все байеры):', dataSql);

    const rawData = await getDataBySql(dataSql);
    console.log('✅ Получено записей:', rawData.length);

    // 5. Обработать данные и построить иерархию С УРОВНЕМ БАЙЕРА (с учётом дат доступа)
    const hierarchy = buildHierarchyWithBuyers(rawData, sourceIdToPeriods);

    // 6. Сортируем байеров - выбранный первый
    const buyerOrder = Object.keys(hierarchy).reduce((acc, date) => {
      Object.keys(hierarchy[date]).forEach(buyerName => {
        if (!acc.includes(buyerName)) {
          acc.push(buyerName);
        }
      });
      return acc;
    }, []);

    // Перемещаем выбранного байера в начало
    const selectedIndex = buyerOrder.indexOf(selectedBuyerName);
    if (selectedIndex > 0) {
      buyerOrder.splice(selectedIndex, 1);
      buyerOrder.unshift(selectedBuyerName);
    }

    console.log(`✅ Построена иерархия для ${Object.keys(hierarchy).length} дней, ${buyerOrder.length} байеров`);
    console.log('📋 Порядок байеров:', buyerOrder);

    return {
      period: {
        start: startDateStr,
        end: endDateStr
      },
      data: rawData,
      hierarchy: hierarchy,
      buyerOrder: buyerOrder
    };

  } catch (error) {
    console.error('❌ Ошибка получения календаря метрик для всех байеров:', error);
    throw error;
  }
}

/**
 * Построить иерархию данных по дням С УРОВНЕМ БАЙЕРА (level 0)
 * Определяет байера для каждой записи на основе даты и периодов доступа
 * @param {Array} data - Сырые данные из БД
 * @param {Object} sourceIdToPeriods - Маппинг source_id -> [{buyerName, accessGranted, accessLimited}]
 * @returns {Object} - Иерархия по дням с байерами
 */
function buildHierarchyWithBuyers(data, sourceIdToPeriods) {
  const hierarchy = {};

  // Группируем по датам
  const dateGroups = {};
  data.forEach(row => {
    const date = row.adv_date;
    if (!dateGroups[date]) {
      dateGroups[date] = [];
    }
    dateGroups[date].push(row);
  });

  // Строим иерархию для каждой даты
  Object.keys(dateGroups).forEach(date => {
    const rows = dateGroups[date];

    // Уровень 0: Байер
    const level0 = {};

    rows.forEach(row => {
      // Определяем байера по source_id И ДАТЕ записи
      const buyerName = getBuyerForSourceIdAndDate(sourceIdToPeriods, row.source_id_tracker, date);
      const tracker = row.campaign_name_tracker || 'Не указано';
      const campaign = row.campaign_name || 'Не указано';
      const group = row.adv_group_name || 'Не указано';
      const ad = row.adv_name || 'Не указано';
      const cost = parseFloat(row.cost) || 0;
      const valid = parseInt(row.valid) || 0;

      // Уровень 0: Байер
      if (!level0[buyerName]) {
        level0[buyerName] = {
          cost: 0,
          valid: 0,
          cpl: 0,
          children: {}
        };
      }

      // Уровень 1: campaign_name_tracker
      if (!level0[buyerName].children[tracker]) {
        level0[buyerName].children[tracker] = {
          cost: 0,
          valid: 0,
          cpl: 0,
          children: {}
        };
      }

      // Уровень 2: campaign_name
      if (!level0[buyerName].children[tracker].children[campaign]) {
        level0[buyerName].children[tracker].children[campaign] = {
          cost: 0,
          valid: 0,
          cpl: 0,
          children: {}
        };
      }

      // Уровень 3: adv_group_name
      if (!level0[buyerName].children[tracker].children[campaign].children[group]) {
        level0[buyerName].children[tracker].children[campaign].children[group] = {
          cost: 0,
          valid: 0,
          cpl: 0,
          children: {}
        };
      }

      // Уровень 4: adv_name
      if (!level0[buyerName].children[tracker].children[campaign].children[group].children[ad]) {
        level0[buyerName].children[tracker].children[campaign].children[group].children[ad] = {
          cost: 0,
          valid: 0,
          cpl: 0
        };
      }

      // Добавляем метрики на всех уровнях
      level0[buyerName].cost += cost;
      level0[buyerName].valid += valid;

      level0[buyerName].children[tracker].cost += cost;
      level0[buyerName].children[tracker].valid += valid;

      level0[buyerName].children[tracker].children[campaign].cost += cost;
      level0[buyerName].children[tracker].children[campaign].valid += valid;

      level0[buyerName].children[tracker].children[campaign].children[group].cost += cost;
      level0[buyerName].children[tracker].children[campaign].children[group].valid += valid;

      level0[buyerName].children[tracker].children[campaign].children[group].children[ad].cost += cost;
      level0[buyerName].children[tracker].children[campaign].children[group].children[ad].valid += valid;
    });

    // Рассчитываем CPL для всех уровней
    Object.keys(level0).forEach(buyer => {
      level0[buyer].cpl = level0[buyer].valid > 0
        ? level0[buyer].cost / level0[buyer].valid
        : 0;

      Object.keys(level0[buyer].children).forEach(tracker => {
        level0[buyer].children[tracker].cpl = level0[buyer].children[tracker].valid > 0
          ? level0[buyer].children[tracker].cost / level0[buyer].children[tracker].valid
          : 0;

        Object.keys(level0[buyer].children[tracker].children).forEach(campaign => {
          level0[buyer].children[tracker].children[campaign].cpl =
            level0[buyer].children[tracker].children[campaign].valid > 0
              ? level0[buyer].children[tracker].children[campaign].cost / level0[buyer].children[tracker].children[campaign].valid
              : 0;

          Object.keys(level0[buyer].children[tracker].children[campaign].children).forEach(group => {
            level0[buyer].children[tracker].children[campaign].children[group].cpl =
              level0[buyer].children[tracker].children[campaign].children[group].valid > 0
                ? level0[buyer].children[tracker].children[campaign].children[group].cost /
                  level0[buyer].children[tracker].children[campaign].children[group].valid
                : 0;

            Object.keys(level0[buyer].children[tracker].children[campaign].children[group].children).forEach(ad => {
              level0[buyer].children[tracker].children[campaign].children[group].children[ad].cpl =
                level0[buyer].children[tracker].children[campaign].children[group].children[ad].valid > 0
                  ? level0[buyer].children[tracker].children[campaign].children[group].children[ad].cost /
                    level0[buyer].children[tracker].children[campaign].children[group].children[ad].valid
                  : 0;
            });
          });
        });
      });
    });

    hierarchy[date] = level0;
  });

  return hierarchy;
}

/**
 * Получить итоговые метрики за весь период
 * @param {Object} hierarchy - Иерархия данных
 * @returns {Object} - Итоговые метрики
 */
export function getTotalMetrics(hierarchy) {
  let totalCost = 0;
  let totalValid = 0;

  Object.keys(hierarchy).forEach(date => {
    Object.keys(hierarchy[date]).forEach(tracker => {
      totalCost += hierarchy[date][tracker].cost;
      totalValid += hierarchy[date][tracker].valid;
    });
  });

  return {
    cost: totalCost,
    valid: totalValid,
    cpl: totalValid > 0 ? totalCost / totalValid : 0
  };
}
