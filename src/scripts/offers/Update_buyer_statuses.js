/**
 * ОПТИМИЗИРОВАННЫЙ скрипт для обновления статусов байеров
 * Адаптировано из Google Apps Script под систему
 *
 * СТАТУСЫ:
 * - "active" (зеленый) - есть расходы (cost > 0) сегодня
 * - "not_configured" (красный) - были расходы раньше, но сегодня нет
 * - "not_in_tracker" (фиолетовый) - нет данных в трекере вообще за всю историю
 *
 * ЛОГИКА:
 * 1. По offer_id (ID в системе) получаем article из metrics
 * 2. По article получаем offer_id_tracker из articleOfferMap (Supabase)
 * 3. Ищем в БД API по offer_id_tracker + source_id_tracker
 * 4. Проверяем cost за сегодня
 */

// Прямой доступ к API (CORS включен на сервере)
const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

// Настройки
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const FETCH_TIMEOUT = 60000;
const CHUNK_SIZE = 500;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatDate(dt);
}

/**
 * ГЛАВНАЯ ФУНКЦИЯ: Обновляет статусы всех байеров
 *
 * @param {Array} allAssignments - Все привязки байеров [{offer_id, buyer_id, source_ids, ...}]
 * @param {Object} articleOfferMap - Маппинг article -> offer_id_tracker (из Supabase)
 * @param {Array} metrics - Массив метрик офферов (для получения article по offer_id)
 * @returns {Promise<Object>} - Map: assignmentKey -> {status, date}
 */
export async function updateBuyerStatuses(allAssignments = [], articleOfferMap = {}, metrics = []) {
  try {
    console.log('🔄 Начинаем обновление статусов байеров...');
    console.log(`📊 articleOfferMap keys (первые 5):`, Object.keys(articleOfferMap).slice(0, 5));
    console.log(`📊 metrics count:`, metrics.length);

    if (!allAssignments || allAssignments.length === 0) {
      console.log('⚠️ Нет привязок байеров для обработки');
      return {};
    }

    // Создаем маппинг: offer_id (ID в системе) -> article (из metrics)
    const offerIdToArticle = {};
    metrics.forEach(m => {
      if (m.id && m.article) {
        offerIdToArticle[m.id] = m.article;
      }
    });
    console.log(`📊 offerIdToArticle (первые 5):`, Object.entries(offerIdToArticle).slice(0, 5));

    // Группируем привязки и собираем данные
    // Формат: { offerIdTracker: { sourceIds: Set, assignments: [], article: string } }
    const trackerGroups = {};
    // ВАЖНО: Инициализируем statusesMap сразу для ВСЕХ байеров со статусом 'not_in_tracker'
    // Это гарантирует что у каждого байера будет статус (не fallback 'active'!)
    const statusesMap = {};
    let skippedNoArticle = 0;
    let skippedNoOfferIdTracker = 0;

    allAssignments.forEach(assignment => {
      const assignmentKey = `${assignment.offer_id}-${assignment.buyer_id}-${assignment.source}`;

      // 1. Получаем article по offer_id из metrics
      const article = offerIdToArticle[assignment.offer_id];
      if (!article) {
        console.warn(`⚠️ Не найден артикул для offer_id: ${assignment.offer_id}`);
        skippedNoArticle++;
        // ВАЖНО: Не пропускаем! Устанавливаем статус 'not_in_tracker'
        statusesMap[assignmentKey] = {
          status: 'not_in_tracker',
          date: null,
          message: 'Нет артикула в метриках'
        };
        return;
      }

      // 2. Получаем offer_id_tracker по article из articleOfferMap
      const offerIdTracker = articleOfferMap[article];
      if (!offerIdTracker) {
        console.warn(`⚠️ Не найден offer_id_tracker для артикула: ${article}`);
        skippedNoOfferIdTracker++;
        // ВАЖНО: Не пропускаем! Устанавливаем статус 'not_in_tracker'
        statusesMap[assignmentKey] = {
          status: 'not_in_tracker',
          date: null,
          message: 'Нет в трекере (нет маппинга)'
        };
        return;
      }

      if (!trackerGroups[offerIdTracker]) {
        trackerGroups[offerIdTracker] = {
          sourceIds: new Set(),
          assignments: [],
          article: article
        };
      }

      // Добавляем source_ids байера
      if (assignment.source_ids && Array.isArray(assignment.source_ids)) {
        assignment.source_ids.forEach(id => trackerGroups[offerIdTracker].sourceIds.add(id));
      }

      trackerGroups[offerIdTracker].assignments.push({
        ...assignment,
        article: article,
        offerIdTracker: offerIdTracker
      });
    });

    console.log(`📊 Пропущено: без артикула=${skippedNoArticle}, без offer_id_tracker=${skippedNoOfferIdTracker}`);

    const offerIdTrackers = Object.keys(trackerGroups);
    console.log(`📊 Уникальных offer_id_tracker: ${offerIdTrackers.length}`);

    if (offerIdTrackers.length === 0) {
      console.log('⚠️ Нет offer_id_tracker для проверки');
      // statusesMap уже заполнен статусами 'not_in_tracker' для всех байеров
      return statusesMap;
    }

    // Собираем ВСЕ уникальные source_ids
    const allSourceIds = new Set();
    Object.values(trackerGroups).forEach(group => {
      group.sourceIds.forEach(id => allSourceIds.add(id));
    });

    const sourceIdsList = Array.from(allSourceIds);
    console.log(`📊 Всего ${sourceIdsList.length} уникальных source_ids`);
    console.log(`📊 Примеры source_ids:`, sourceIdsList.slice(0, 3));
    console.log(`📊 Примеры offer_id_tracker:`, offerIdTrackers.slice(0, 3));

    // Загружаем данные о расходах по offer_id_tracker + source_id_tracker
    const spendData = await fetchSpendDataByOfferIds(sourceIdsList, offerIdTrackers);
    console.log(`✅ Получены данные для ${Object.keys(spendData).length} комбинаций`);

    // Определяем статусы для каждой привязки (statusesMap уже частично заполнен выше)
    const todayStr = formatDate(new Date());

    allAssignments.forEach(assignment => {
      const article = offerIdToArticle[assignment.offer_id];
      const offerIdTracker = article ? articleOfferMap[article] : null;
      const sourceIds = assignment.source_ids || [];
      const assignmentKey = `${assignment.offer_id}-${assignment.buyer_id}-${assignment.source}`;

      // Пропускаем если уже установлен статус ранее (для байеров без маппинга)
      if (statusesMap[assignmentKey]) {
        return;
      }

      if (!article || !offerIdTracker) {
        statusesMap[assignmentKey] = {
          status: 'not_in_tracker',
          date: null,
          message: 'Нет маппинга'
        };
        return;
      }

      if (sourceIds.length === 0) {
        statusesMap[assignmentKey] = {
          status: 'not_configured',
          date: null,
          message: 'Нет source_id'
        };
        return;
      }

      // Проверяем данные для каждого source_id этого байера по этому offer_id_tracker
      let hasSpendToday = false;
      let lastSpendDate = null;
      let foundInTracker = false;

      sourceIds.forEach(sourceId => {
        const key = `${offerIdTracker}:${sourceId}`;
        const data = spendData[key];

        if (data) {
          foundInTracker = true;

          if (data.spend_today > 0) {
            hasSpendToday = true;
          }

          if (data.last_spend) {
            if (!lastSpendDate || data.last_spend > lastSpendDate) {
              lastSpendDate = data.last_spend;
            }
          }
        }
      });

      // Определяем статус (как в оригинальном скрипте)
      if (!foundInTracker) {
        // Нет записей вообще в трекере по этому offer_id_tracker + source_ids
        statusesMap[assignmentKey] = {
          status: 'not_in_tracker',
          date: null,
          message: 'Нет в трекере'
        };
      } else if (hasSpendToday || lastSpendDate === todayStr) {
        // Есть расходы сегодня - активный
        statusesMap[assignmentKey] = {
          status: 'active',
          date: null,
          message: 'Активный'
        };
      } else if (lastSpendDate) {
        // Были расходы раньше, но сегодня нет
        const noSpendSince = addDays(lastSpendDate, 1);
        statusesMap[assignmentKey] = {
          status: 'not_configured',
          date: noSpendSince,
          message: `Нет расходов с ${noSpendSince}`
        };
      } else {
        // Данные есть, но cost всегда был 0
        statusesMap[assignmentKey] = {
          status: 'not_configured',
          date: null,
          message: 'Нет расходов'
        };
      }
    });

    console.log(`✅ Статусы определены для ${Object.keys(statusesMap).length} привязок`);

    const stats = { active: 0, not_configured: 0, not_in_tracker: 0 };
    Object.values(statusesMap).forEach(s => stats[s.status]++);
    console.log(`📊 Статистика: Активных: ${stats.active}, Не настроено: ${stats.not_configured}, Нет в трекере: ${stats.not_in_tracker}`);

    return statusesMap;

  } catch (error) {
    console.error('❌ Ошибка обновления статусов байеров:', error);
    throw error;
  }
}

/**
 * Загружает данные о расходах по offer_id_tracker + source_id_tracker
 * Прямой поиск по колонкам БД API
 */
async function fetchSpendDataByOfferIds(sourceIds, offerIdTrackers) {
  const result = {};
  const todayStr = formatDate(new Date());

  if (sourceIds.length === 0 || offerIdTrackers.length === 0) {
    return result;
  }

  // Разбиваем source_ids на чанки
  const chunks = [];
  for (let i = 0; i < sourceIds.length; i += CHUNK_SIZE) {
    chunks.push(sourceIds.slice(i, i + CHUNK_SIZE));
  }

  console.log(`📦 Загрузка данных: ${chunks.length} чанк(ов)`);

  // Загружаем чанки параллельно
  const promises = chunks.map(async (chunk, idx) => {
    const sourceIdsSql = chunk.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    const offerIdsSql = offerIdTrackers.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

    // SQL запрос - ищем по offer_id_tracker и source_id_tracker
    const sql = `
      SELECT
        offer_id_tracker,
        source_id_tracker,
        MAX(CASE WHEN cost > 0 THEN adv_date END) AS last_spend,
        SUM(CASE WHEN adv_date = '${todayStr}' THEN cost ELSE 0 END) AS spend_today
      FROM ads_collection
      WHERE source_id_tracker IN (${sourceIdsSql})
        AND offer_id_tracker IN (${offerIdsSql})
      GROUP BY offer_id_tracker, source_id_tracker
    `;

    console.log(`  📆 Чанк ${idx + 1}/${chunks.length}: ${chunk.length} source_ids, ${offerIdTrackers.length} offer_ids`);

    try {
      const rows = await getDataBySql(sql);
      console.log(`    ✅ Получено ${rows.length} записей`);

      // Отладка - показать первые результаты
      if (rows.length > 0 && idx === 0) {
        console.log(`    📋 Пример данных:`, rows.slice(0, 2));
      }

      return rows.map(row => ({
        offerIdTracker: row.offer_id_tracker,
        sourceId: row.source_id_tracker,
        last_spend: row.last_spend ? String(row.last_spend).slice(0, 10) : null,
        spend_today: Number(row.spend_today || 0)
      }));
    } catch (error) {
      console.warn(`    ⚠️ Ошибка чанка ${idx + 1}: ${error.message}`);
      return [];
    }
  });

  const results = await Promise.all(promises);

  // Объединяем результаты
  results.flat().forEach(row => {
    if (row.offerIdTracker && row.sourceId) {
      const key = `${row.offerIdTracker}:${row.sourceId}`;
      result[key] = {
        last_spend: row.last_spend,
        spend_today: row.spend_today
      };
    }
  });

  return result;
}

/**
 * Универсальный fetch с retry и timeout
 */
async function getDataBySql(strSQL, retryCount = 0) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(CORE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assoc: true, sql: strSQL }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const code = response.status;
    const text = await response.text();

    if ([500, 502, 503, 504].includes(code) && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`⚠️ HTTP ${code}, повтор ${retryCount + 1}/${MAX_RETRIES}...`);
      await sleep(delay);
      return getDataBySql(strSQL, retryCount + 1);
    }

    if (code !== 200) {
      throw new Error(`HTTP ${code}: ${text.substring(0, 200)}`);
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
    if (retryCount < MAX_RETRIES) {
      const isTimeout = error.name === 'AbortError';
      const isNetworkError = error.message.includes('fetch') || error.message.includes('network');

      if (isTimeout || isNetworkError) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`⚠️ ${isTimeout ? 'Таймаут' : 'Сетевая ошибка'}, повтор...`);
        await sleep(delay);
        return getDataBySql(strSQL, retryCount + 1);
      }
    }
    throw error;
  }
}

/**
 * Генерирует ключ для привязки
 */
export function getAssignmentKey(offerId, buyerId, source) {
  return `${offerId}-${buyerId}-${source}`;
}

/**
 * Конфигурация статусов для UI
 */
export const BUYER_STATUS_CONFIG = {
  active: {
    label: 'Активный',
    color: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-200'
  },
  not_configured: {
    label: 'Не настроено',
    color: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-200'
  },
  not_in_tracker: {
    label: 'Нет в трекере',
    color: 'bg-purple-100',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-200'
  }
};

/**
 * ОПТИМИЗИРОВАННАЯ ФУНКЦИЯ: Обновляет статус ОДНОГО байера для конкретного оффера
 * Используется при добавлении нового байера к офферу
 *
 * @param {Object} assignment - Привязка байера {offer_id, buyer_id, source, source_ids}
 * @param {string} article - Артикул оффера
 * @param {string} offerIdTracker - ID оффера в трекере
 * @returns {Promise<Object>} - {status, date, message}
 */
export async function updateSingleBuyerStatus(assignment, article, offerIdTracker) {
  try {
    console.log(`🔄 Обновляем статус для байера ${assignment.buyer_name || assignment.buyer_id}...`);

    const sourceIds = assignment.source_ids || [];
    const assignmentKey = getAssignmentKey(assignment.offer_id, assignment.buyer_id, assignment.source);

    // Проверяем наличие данных
    if (!article || !offerIdTracker) {
      console.log(`⚠️ Нет маппинга для оффера ${assignment.offer_id}`);
      return {
        key: assignmentKey,
        status: {
          status: 'not_in_tracker',
          date: null,
          message: 'Нет маппинга'
        }
      };
    }

    if (sourceIds.length === 0) {
      console.log(`⚠️ У байера нет source_ids`);
      return {
        key: assignmentKey,
        status: {
          status: 'not_configured',
          date: null,
          message: 'Нет source_id'
        }
      };
    }

    // Загружаем данные о расходах для этого байера и оффера
    const spendData = await fetchSpendDataForSingleBuyer(sourceIds, offerIdTracker);
    console.log(`✅ Получены данные для ${Object.keys(spendData).length} комбинаций source_id`);

    // Определяем статус
    const todayStr = formatDate(new Date());
    let hasSpendToday = false;
    let lastSpendDate = null;
    let foundInTracker = false;

    sourceIds.forEach(sourceId => {
      const key = `${offerIdTracker}:${sourceId}`;
      const data = spendData[key];

      if (data) {
        foundInTracker = true;

        if (data.spend_today > 0) {
          hasSpendToday = true;
        }

        if (data.last_spend) {
          if (!lastSpendDate || data.last_spend > lastSpendDate) {
            lastSpendDate = data.last_spend;
          }
        }
      }
    });

    // Определяем итоговый статус
    let result;
    if (!foundInTracker) {
      result = {
        status: 'not_in_tracker',
        date: null,
        message: 'Нет в трекере'
      };
    } else if (hasSpendToday || lastSpendDate === todayStr) {
      result = {
        status: 'active',
        date: null,
        message: 'Активный'
      };
    } else if (lastSpendDate) {
      const noSpendSince = addDays(lastSpendDate, 1);
      result = {
        status: 'not_configured',
        date: noSpendSince,
        message: `Нет расходов с ${noSpendSince}`
      };
    } else {
      result = {
        status: 'not_configured',
        date: null,
        message: 'Нет расходов'
      };
    }

    console.log(`✅ Статус байера ${assignment.buyer_name}: ${result.status}`);

    return {
      key: assignmentKey,
      status: result
    };

  } catch (error) {
    console.error('❌ Ошибка обновления статуса байера:', error);
    const assignmentKey = getAssignmentKey(assignment.offer_id, assignment.buyer_id, assignment.source);
    return {
      key: assignmentKey,
      status: {
        status: 'not_in_tracker',
        date: null,
        message: 'Ошибка загрузки'
      }
    };
  }
}

/**
 * Проверяет, был ли у байера расход (cost > 0) за все время
 * Используется для определения: архивировать или полностью удалять байера
 *
 * @param {Array} sourceIds - Массив source_id байера
 * @param {string} offerIdTracker - ID оффера в трекере
 * @returns {Promise<{hasSpend: boolean, totalCost: number}>}
 */
export async function checkBuyerHasSpend(sourceIds, offerIdTracker) {
  try {
    console.log(`🔍 Проверяем расход байера: ${sourceIds.length} source_ids, offer: ${offerIdTracker}`);

    if (!sourceIds || sourceIds.length === 0 || !offerIdTracker) {
      console.log('⚠️ Нет данных для проверки расхода');
      return { hasSpend: false, totalCost: 0 };
    }

    const sourceIdsSql = sourceIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    const offerIdSql = `'${offerIdTracker.replace(/'/g, "''")}'`;

    // SQL запрос - проверяем был ли расход за все время
    const sql = `
      SELECT
        SUM(cost) AS total_cost
      FROM ads_collection
      WHERE source_id_tracker IN (${sourceIdsSql})
        AND offer_id_tracker = ${offerIdSql}
        AND cost > 0
    `;

    const rows = await getDataBySql(sql);

    const totalCost = Number(rows[0]?.total_cost || 0);
    const hasSpend = totalCost > 0;

    console.log(`✅ Расход байера за все время: $${totalCost.toFixed(2)}, hasSpend: ${hasSpend}`);

    return { hasSpend, totalCost };

  } catch (error) {
    console.error('❌ Ошибка проверки расхода байера:', error);
    // В случае ошибки считаем что расход был (безопаснее архивировать)
    return { hasSpend: true, totalCost: 0 };
  }
}

/**
 * Загружает данные о расходах для ОДНОГО байера по его source_ids и одному offer_id_tracker
 */
async function fetchSpendDataForSingleBuyer(sourceIds, offerIdTracker) {
  const result = {};
  const todayStr = formatDate(new Date());

  if (sourceIds.length === 0 || !offerIdTracker) {
    return result;
  }

  const sourceIdsSql = sourceIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
  const offerIdSql = `'${offerIdTracker.replace(/'/g, "''")}'`;

  const sql = `
    SELECT
      offer_id_tracker,
      source_id_tracker,
      MAX(CASE WHEN cost > 0 THEN adv_date END) AS last_spend,
      SUM(CASE WHEN adv_date = '${todayStr}' THEN cost ELSE 0 END) AS spend_today
    FROM ads_collection
    WHERE source_id_tracker IN (${sourceIdsSql})
      AND offer_id_tracker = ${offerIdSql}
    GROUP BY offer_id_tracker, source_id_tracker
  `;

  console.log(`📊 Запрос статуса для ${sourceIds.length} source_ids и offer_id_tracker: ${offerIdTracker}`);

  try {
    const rows = await getDataBySql(sql);
    console.log(`✅ Получено ${rows.length} записей`);

    rows.forEach(row => {
      if (row.offer_id_tracker && row.source_id_tracker) {
        const key = `${row.offer_id_tracker}:${row.source_id_tracker}`;
        result[key] = {
          last_spend: row.last_spend ? String(row.last_spend).slice(0, 10) : null,
          spend_today: Number(row.spend_today || 0)
        };
      }
    });
  } catch (error) {
    console.warn(`⚠️ Ошибка загрузки данных: ${error.message}`);
  }

  return result;
}
