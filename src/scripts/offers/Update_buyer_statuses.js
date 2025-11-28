/**
 * ОПТИМИЗИРОВАННЫЙ скрипт для обновления статусов байеров
 *
 * СТАТУСЫ:
 * - "active" (зеленый) - есть расходы сегодня
 * - "not_configured" (красный) - нет расходов сегодня, но были раньше
 * - "not_in_tracker" (фиолетовый) - нет данных в трекере вообще
 *
 * ОПТИМИЗАЦИИ:
 * - 🚀 Один SQL запрос на ВСЕ source_ids (вместо отдельных запросов)
 * - 🚀 GROUP BY source_id_tracker для быстрой агрегации
 * - 🚀 Параллельная загрузка по чанкам (по 500 source_ids)
 * - 🚀 Таймаут 60с, быстрый retry
 */

// Прямой доступ к API (CORS включен на сервере)
const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

// Настройки
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const FETCH_TIMEOUT = 60000;
const CHUNK_SIZE = 500; // Сколько source_ids в одном запросе

/**
 * Задержка выполнения
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Форматирует дату в YYYY-MM-DD
 */
function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Добавляет дни к дате в формате YYYY-MM-DD
 */
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
 * @param {Object} articleOfferMap - Маппинг article -> offer_id
 * @returns {Promise<Object>} - Map: assignmentKey -> {status, date}
 */
export async function updateBuyerStatuses(allAssignments = [], articleOfferMap = {}) {
  try {
    console.log('🔄 Начинаем обновление статусов байеров...');

    if (!allAssignments || allAssignments.length === 0) {
      console.log('⚠️ Нет привязок байеров для обработки');
      return {};
    }

    // Создаем обратный маппинг: offer_id -> article
    const offerIdToArticle = {};
    Object.entries(articleOfferMap).forEach(([article, offerId]) => {
      offerIdToArticle[offerId] = article;
    });

    // Собираем ВСЕ уникальные source_ids и offer_ids
    const allSourceIds = new Set();
    const allOfferIds = new Set();

    allAssignments.forEach(assignment => {
      if (assignment.source_ids && Array.isArray(assignment.source_ids)) {
        assignment.source_ids.forEach(id => allSourceIds.add(id));
      }
      if (assignment.offer_id) {
        allOfferIds.add(String(assignment.offer_id));
      }
    });

    const sourceIdsList = Array.from(allSourceIds);
    const offerIdsList = Array.from(allOfferIds);

    console.log(`📊 Всего ${sourceIdsList.length} уникальных source_ids, ${offerIdsList.length} offer_ids`);

    if (sourceIdsList.length === 0) {
      console.log('⚠️ Нет source_ids для проверки');
      return {};
    }

    // Загружаем данные о расходах по всем source_ids
    const spendData = await fetchSpendDataBulk(sourceIdsList, offerIdsList);
    console.log(`✅ Получены данные для ${Object.keys(spendData).length} комбинаций source_id+offer_id`);

    // Определяем статусы для каждой привязки
    const todayStr = formatDate(new Date());
    const statusesMap = {};

    allAssignments.forEach(assignment => {
      const offerId = String(assignment.offer_id);
      const sourceIds = assignment.source_ids || [];
      const assignmentKey = `${assignment.offer_id}-${assignment.buyer_id}-${assignment.source}`;

      if (sourceIds.length === 0) {
        // Нет source_ids - статус "не настроено"
        statusesMap[assignmentKey] = {
          status: 'not_configured',
          date: null,
          message: 'Нет source_id'
        };
        return;
      }

      // Проверяем данные для каждого source_id этого байера по этому офферу
      let hasSpendToday = false;
      let lastSpendDate = null;
      let foundInTracker = false;

      sourceIds.forEach(sourceId => {
        const key = `${sourceId}:${offerId}`;
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

      // Определяем статус
      if (!foundInTracker) {
        statusesMap[assignmentKey] = {
          status: 'not_in_tracker',
          date: null,
          message: 'Нет в трекере'
        };
      } else if (hasSpendToday || lastSpendDate === todayStr) {
        statusesMap[assignmentKey] = {
          status: 'active',
          date: null,
          message: 'Активный'
        };
      } else if (lastSpendDate) {
        // Нет расходов сегодня, но были раньше
        const noSpendSince = addDays(lastSpendDate, 1);
        statusesMap[assignmentKey] = {
          status: 'not_configured',
          date: noSpendSince,
          message: `Нет расходов с ${noSpendSince}`
        };
      } else {
        // Данные есть, но никогда не было расходов
        statusesMap[assignmentKey] = {
          status: 'not_configured',
          date: null,
          message: 'Нет расходов'
        };
      }
    });

    console.log(`✅ Статусы определены для ${Object.keys(statusesMap).length} привязок`);

    // Статистика
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
 * Загружает данные о расходах для ВСЕХ source_ids одним bulk-запросом
 *
 * @param {Array} sourceIds - Массив source_id_tracker
 * @param {Array} offerIds - Массив offer_id_tracker
 * @returns {Object} - Map: "sourceId:offerId" -> {last_spend, spend_today}
 */
async function fetchSpendDataBulk(sourceIds, offerIds) {
  const result = {};
  const todayStr = formatDate(new Date());

  // Разбиваем на чанки если слишком много
  const chunks = [];
  for (let i = 0; i < sourceIds.length; i += CHUNK_SIZE) {
    chunks.push(sourceIds.slice(i, i + CHUNK_SIZE));
  }

  console.log(`📦 Загрузка данных: ${chunks.length} чанк(ов) по ${CHUNK_SIZE} source_ids`);

  // Загружаем все чанки параллельно
  const promises = chunks.map(async (chunk, idx) => {
    const sourceIdsSql = chunk.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    const offerIdsSql = offerIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

    // SQL запрос: получаем последнюю дату с расходами и сумму за сегодня
    // GROUP BY source_id_tracker, offer_id_tracker для быстрой агрегации
    const sql = `
      SELECT
        source_id_tracker,
        offer_id_tracker,
        MAX(CASE WHEN cost > 0 THEN adv_date END) AS last_spend,
        SUM(CASE WHEN adv_date = '${todayStr}' THEN cost ELSE 0 END) AS spend_today
      FROM ads_collection
      WHERE source_id_tracker IN (${sourceIdsSql})
        AND offer_id_tracker IN (${offerIdsSql})
      GROUP BY source_id_tracker, offer_id_tracker
    `;

    console.log(`  📆 Чанк ${idx + 1}/${chunks.length}: ${chunk.length} source_ids`);

    try {
      const rows = await getDataBySql(sql);
      console.log(`    ✅ Получено ${rows.length} записей`);

      return rows.map(row => ({
        sourceId: row.source_id_tracker,
        offerId: row.offer_id_tracker,
        last_spend: row.last_spend ? String(row.last_spend).slice(0, 10) : null,
        spend_today: Number(row.spend_today || 0)
      }));
    } catch (error) {
      console.warn(`    ⚠️ Ошибка чанка ${idx + 1}: ${error.message}`);
      return [];
    }
  });

  const results = await Promise.all(promises);

  // Объединяем результаты в Map
  results.flat().forEach(row => {
    if (row.sourceId && row.offerId) {
      const key = `${row.sourceId}:${row.offerId}`;
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
      console.log(`⚠️ HTTP ${code}, повтор ${retryCount + 1}/${MAX_RETRIES} через ${delay}мс...`);
      await sleep(delay);
      return getDataBySql(strSQL, retryCount + 1);
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
    if (retryCount < MAX_RETRIES) {
      const isTimeout = error.name === 'AbortError';
      const isNetworkError = error.message.includes('fetch') || error.message.includes('network');

      if (isTimeout || isNetworkError) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`⚠️ ${isTimeout ? 'Таймаут' : 'Сетевая ошибка'}, повтор ${retryCount + 1}/${MAX_RETRIES}...`);
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
