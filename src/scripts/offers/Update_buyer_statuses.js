/**
 * ОПТИМИЗИРОВАННЫЙ скрипт для обновления статусов байеров
 * Адаптировано из Google Apps Script под систему
 *
 * СТАТУСЫ:
 * - "active" (зеленый) - есть расходы сегодня (cost > 0)
 * - "not_configured" (красный) - были расходы раньше, но сегодня нет
 * - "not_in_tracker" (фиолетовый) - нет данных в трекере вообще за всю историю
 *
 * ЛОГИКА (как в оригинале):
 * - Извлекаем артикул из campaign_name_tracker (первое слово до разделителя)
 * - Проверяем по source_ids байера + артикулу оффера
 * - Если нет записей вообще -> "Нет в трекере"
 * - Если нет cost сегодня -> "Не настроено" + дата последнего расхода
 * - Если есть cost сегодня -> "Активный"
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
 * @param {Object} articleOfferMap - Маппинг article -> offer_id (нужен для получения артикула)
 * @param {Array} metrics - Массив метрик офферов (для получения артикула по offer_id)
 * @returns {Promise<Object>} - Map: assignmentKey -> {status, date}
 */
export async function updateBuyerStatuses(allAssignments = [], articleOfferMap = {}, metrics = []) {
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

    // Группируем привязки по артикулу + собираем source_ids
    // Формат: { article: { sourceIds: Set, assignments: [] } }
    const articleGroups = {};

    allAssignments.forEach(assignment => {
      const article = offerIdToArticle[assignment.offer_id];
      if (!article) {
        console.warn(`⚠️ Не найден артикул для offer_id: ${assignment.offer_id}`);
        return;
      }

      if (!articleGroups[article]) {
        articleGroups[article] = {
          sourceIds: new Set(),
          assignments: []
        };
      }

      // Добавляем source_ids байера
      if (assignment.source_ids && Array.isArray(assignment.source_ids)) {
        assignment.source_ids.forEach(id => articleGroups[article].sourceIds.add(id));
      }

      articleGroups[article].assignments.push(assignment);
    });

    const articles = Object.keys(articleGroups);
    console.log(`📊 Уникальных артикулов: ${articles.length}`);

    if (articles.length === 0) {
      console.log('⚠️ Нет артикулов для проверки');
      return {};
    }

    // Собираем ВСЕ уникальные source_ids
    const allSourceIds = new Set();
    Object.values(articleGroups).forEach(group => {
      group.sourceIds.forEach(id => allSourceIds.add(id));
    });

    const sourceIdsList = Array.from(allSourceIds);
    console.log(`📊 Всего ${sourceIdsList.length} уникальных source_ids`);

    // Загружаем данные о расходах - по артикулам из campaign_name_tracker
    const spendData = await fetchSpendDataByArticles(sourceIdsList, articles);
    console.log(`✅ Получены данные для ${Object.keys(spendData).length} комбинаций`);

    // Определяем статусы для каждой привязки
    const todayStr = formatDate(new Date());
    const statusesMap = {};

    allAssignments.forEach(assignment => {
      const article = offerIdToArticle[assignment.offer_id];
      const sourceIds = assignment.source_ids || [];
      const assignmentKey = `${assignment.offer_id}-${assignment.buyer_id}-${assignment.source}`;

      if (!article) {
        statusesMap[assignmentKey] = {
          status: 'not_in_tracker',
          date: null,
          message: 'Артикул не найден'
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

      // Проверяем данные для каждого source_id этого байера по этому артикулу
      let hasSpendToday = false;
      let lastSpendDate = null;
      let foundInTracker = false;

      sourceIds.forEach(sourceId => {
        const key = `${article}:${sourceId}`;
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
        // Нет записей вообще в трекере
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
 * Загружает данные о расходах по артикулам (извлеченным из campaign_name_tracker)
 * КАК В ОРИГИНАЛЬНОМ СКРИПТЕ
 */
async function fetchSpendDataByArticles(sourceIds, articles) {
  const result = {};
  const todayStr = formatDate(new Date());

  if (sourceIds.length === 0 || articles.length === 0) {
    return result;
  }

  // Разбиваем source_ids на чанки
  const chunks = [];
  for (let i = 0; i < sourceIds.length; i += CHUNK_SIZE) {
    chunks.push(sourceIds.slice(i, i + CHUNK_SIZE));
  }

  console.log(`📦 Загрузка данных: ${chunks.length} чанк(ов)`);

  // SQL выражение для очистки campaign_name (как в оригинале)
  const CLEAN_EXPR = `
    TRIM(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(campaign_name_tracker, CHAR(160), ' '),
            CHAR(9), ' '),
          CHAR(13), ' '),
        CHAR(10), ' '),
      '  ', ' ')
    )
  `;

  // SQL выражение для извлечения артикула (как в оригинале)
  const ARTIKUL_EXPR = `
    CASE
      WHEN INSTR(${CLEAN_EXPR}, '-') > 0 THEN TRIM(SUBSTRING_INDEX(${CLEAN_EXPR}, '-', 1))
      WHEN INSTR(${CLEAN_EXPR}, ' ') > 0 THEN TRIM(SUBSTRING_INDEX(${CLEAN_EXPR}, ' ', 1))
      WHEN INSTR(${CLEAN_EXPR}, '_') > 0 THEN TRIM(SUBSTRING_INDEX(${CLEAN_EXPR}, '_', 1))
      WHEN INSTR(${CLEAN_EXPR}, '|') > 0 THEN TRIM(SUBSTRING_INDEX(${CLEAN_EXPR}, '|', 1))
      WHEN INSTR(${CLEAN_EXPR}, ':') > 0 THEN TRIM(SUBSTRING_INDEX(${CLEAN_EXPR}, ':', 1))
      ELSE TRIM(${CLEAN_EXPR})
    END
  `;

  // Загружаем чанки параллельно
  const promises = chunks.map(async (chunk, idx) => {
    const sourceIdsSql = chunk.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    const articlesSql = articles.map(a => `'${a.replace(/'/g, "''")}'`).join(',');

    // SQL запрос как в оригинальном скрипте
    const sql = `
      SELECT
        artikul,
        source_id_tracker,
        MAX(CASE WHEN s > 0 THEN adv_date END) AS last_spend,
        SUM(CASE WHEN adv_date = '${todayStr}' THEN s ELSE 0 END) AS spend_today
      FROM (
        SELECT
          ${ARTIKUL_EXPR} AS artikul,
          source_id_tracker,
          adv_date,
          SUM(cost) AS s
        FROM ads_collection
        WHERE source_id_tracker IN (${sourceIdsSql})
          AND (${ARTIKUL_EXPR}) IN (${articlesSql})
        GROUP BY 1, 2, 3
      ) t
      GROUP BY artikul, source_id_tracker
    `;

    console.log(`  📆 Чанк ${idx + 1}/${chunks.length}: ${chunk.length} source_ids, ${articles.length} артикулов`);

    try {
      const rows = await getDataBySql(sql);
      console.log(`    ✅ Получено ${rows.length} записей`);

      return rows.map(row => ({
        article: row.artikul,
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
    if (row.article && row.sourceId) {
      const key = `${row.article}:${row.sourceId}`;
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
