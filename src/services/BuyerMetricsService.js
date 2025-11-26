/**
 * Сервис для получения детальных метрик байера по офферу
 * Использует БД API для получения данных за последние 30 дней
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

const CORE_URL = '/.netlify/functions/sql-proxy';

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

    // 2. Найти последнюю дату с расходом для этого байера и оффера
    const sourceIdsStr = sourceIds.map(id => `'${id}'`).join(',');
    const lastDateWithCostSql = `
      SELECT MAX(adv_date) as last_date
      FROM \`ads_collection\`
      WHERE \`offer_id_tracker\` = '${offerIdTracker}'
        AND \`source_id_tracker\` IN (${sourceIdsStr})
        AND \`cost\` > 0
    `;

    console.log('🔍 SQL для поиска последней даты:', lastDateWithCostSql);

    const lastDateResponse = await fetch(CORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: lastDateWithCostSql })
    });

    if (!lastDateResponse.ok) {
      throw new Error('Ошибка получения последней даты с расходом');
    }

    const lastDateData = await lastDateResponse.json();
    console.log('📅 Результат поиска последней даты:', lastDateData);

    if (!lastDateData || lastDateData.length === 0 || !lastDateData[0] || !lastDateData[0].last_date) {
      console.warn('⚠️ Нет данных о расходах для этого байера');
      return {
        period: { start: null, end: null },
        data: [],
        hierarchy: {}
      };
    }

    const lastDate = new Date(lastDateData[0].last_date);
    const startDate = new Date(lastDate);
    startDate.setDate(startDate.getDate() - 29); // 30 дней включительно

    console.log('📅 Период данных:', {
      start: startDate.toISOString().split('T')[0],
      end: lastDate.toISOString().split('T')[0]
    });

    // 2. Получить данные за период
    const startDateStr = startDate.toISOString().split('T')[0];
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
      FROM \`ads_collection\`
      WHERE \`offer_id_tracker\` = '${offerIdTracker}'
        AND \`source_id_tracker\` IN (${sourceIdsStr})
        AND \`adv_date\` >= '${startDateStr}'
        AND \`adv_date\` <= '${endDateStr}'
      ORDER BY adv_date ASC
    `;

    console.log('🔍 SQL для получения данных:', dataSql);

    const dataResponse = await fetch(CORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: dataSql })
    });

    if (!dataResponse.ok) {
      throw new Error('Ошибка получения данных метрик');
    }

    const rawData = await dataResponse.json();
    console.log('✅ Получено записей:', rawData.length);

    // 3. Обработать данные и построить иерархию
    const hierarchy = buildHierarchy(rawData);

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
