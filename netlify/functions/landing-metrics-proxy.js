// netlify/functions/landing-metrics-proxy.js
// Прокси для получения метрик лендингов через getOneClickForAd API и ads_collection

const CONFIG = {
  API_URL: 'https://api.trll-notif.com.ua/adsreportcollector/core.php',
  FETCH_TIMEOUT_MS: 30000,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
  DEBUG: false
};

// Экранирование строк для SQL
function escapeString(str) {
  return String(str).replace(/'/g, "''");
}

// Преобразование массива массивов в массив объектов
function transformArrayResponse(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const headers = data[0];
  if (!Array.isArray(headers)) {
    return [];
  }

  const rows = data.slice(1);
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

// Fetch с повторами (для SQL запросов)
async function fetchWithRetry(sql, retries = CONFIG.MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ sql }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if ((response.status === 502 || response.status === 504) && attempt < retries) {
          const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`API error ${response.status}`);
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        return [];
      }

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return transformArrayResponse(parsed);

    } catch (error) {
      if (error.name === 'AbortError' && attempt < retries) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (attempt === retries) throw error;
    }
  }
}

// ==================== НОВЫЙ МЕТОД (API) ====================
// Получение уникальных кликов через API getOneClickForAd
async function getAdvIdsFromConversionsAPI(uuids, dateFrom = null, dateTo = null) {
  console.log(`🔍 [API] getOneClickForAd: запрос для ${uuids.length} UUID`);

  try {
    const endDate = dateTo || new Date().toISOString().split('T')[0];
    const startDate = dateFrom || (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().split('T')[0];
    })();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        objReqConfig: {
          name: "getOneClickForAd",
          startDate: startDate,
          endDate: endDate
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const allClicks = await response.json();

    if (!Array.isArray(allClicks)) {
      console.error('❌ [API] вернул не массив');
      return [];
    }

    const uuidsSet = new Set(uuids);
    const filteredClicks = allClicks
      .filter(click => click.sub16 && uuidsSet.has(click.sub16))
      .filter(click => click.adv_id && click.click_time && click.source)
      .filter(click => ['facebook', 'google', 'tiktok'].includes(click.source))
      .map(click => ({
        uuid: click.sub16,
        source: click.source,
        adv_id: click.adv_id,
        date_of_click: click.click_time
      }));

    console.log(`✅ [API] getOneClickForAd: ${allClicks.length} всего → ${filteredClicks.length} для наших UUID`);

    return filteredClicks;
  } catch (error) {
    console.error('❌ [API] getOneClickForAd ошибка:', error.message);
    return [];
  }
}

// ==================== СТАРЫЙ МЕТОД (SQL) ====================
// Получение данных через SQL к conversions_collection
async function getAdvIdsFromConversionsSQL(uuids) {
  console.log(`🔍 [SQL] conversions_collection: запрос для ${uuids.length} UUID`);

  const uuidConditions = uuids.map(uuid => `'${escapeString(uuid)}'`).join(',');

  const sql = `
    SELECT
      sub16 as uuid,
      source,
      CASE
        WHEN source = 'facebook' THEN sub1
        WHEN source = 'google' THEN sub5
        WHEN source = 'tiktok' THEN sub4
        ELSE NULL
      END as adv_id,
      date_of_click
    FROM conversions_collection
    WHERE sub16 IN (${uuidConditions})
      AND source IN ('facebook', 'google', 'tiktok')
      AND date_of_click IS NOT NULL
      AND (
        (source = 'facebook' AND sub1 IS NOT NULL AND sub1 != '') OR
        (source = 'google' AND sub5 IS NOT NULL AND sub5 != '') OR
        (source = 'tiktok' AND sub4 IS NOT NULL AND sub4 != '')
      )
  `;

  try {
    const results = await fetchWithRetry(sql);
    console.log(`✅ [SQL] conversions_collection: ${results.length} записей`);
    return results;
  } catch (error) {
    console.error('❌ [SQL] conversions_collection ошибка:', error.message);
    return [];
  }
}

// Получение метрик из ads_collection
async function getMetricsFromAdsCollection(conversionsData, dateFrom = null, dateTo = null) {
  // Создаем условия для поиска по КОНКРЕТНЫМ парам (adv_id, adv_date)
  const conditions = conversionsData
    .filter(conv => conv.adv_id && conv.date_of_click)
    .map(conv => `(t.adv_id = '${escapeString(conv.adv_id)}' AND t.adv_date = '${escapeString(conv.date_of_click)}')`)
    .join(' OR ');

  if (!conditions) {
    return [];
  }

  let dateFilter = '';
  if (dateFrom && dateTo) {
    dateFilter = `AND t.adv_date >= '${escapeString(dateFrom)}' AND t.adv_date <= '${escapeString(dateTo)}'`;
  }

  const sql = `
    SELECT
      t.adv_id,
      t.adv_date,
      t.source_id_tracker,
      COALESCE(SUM(t.valid), 0) AS leads,
      COALESCE(SUM(t.cost), 0) AS cost,
      COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
      COALESCE(SUM(t.showed), 0) AS impressions,
      COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
      COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
      COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
    FROM ads_collection t
    WHERE (${conditions})
      AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
      ${dateFilter}
    GROUP BY t.adv_id, t.adv_date, t.source_id_tracker
    ORDER BY t.adv_id, t.adv_date
  `;

  try {
    const results = await fetchWithRetry(sql);
    console.log(`✅ ads_collection: ${results.length} записей метрик`);
    return results;
  } catch (error) {
    console.error('❌ ads_collection ошибка:', error.message);
    return [];
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Только POST запросы' })
    };
  }

  try {
    const { landing_uuids, date_from, date_to, method = 'api' } = JSON.parse(event.body);

    if (!landing_uuids || !Array.isArray(landing_uuids) || landing_uuids.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'landing_uuids обязателен и должен быть массивом' })
      };
    }

    const useAPI = method === 'api';
    const startTime = Date.now();
    console.log(`🚀 Запрос метрик для ${landing_uuids.length} лендингов [метод: ${useAPI ? 'API' : 'SQL'}]`);

    // Шаг 1: Получаем клики (API или SQL в зависимости от параметра method)
    const conversions = useAPI
      ? await getAdvIdsFromConversionsAPI(landing_uuids, date_from, date_to)
      : await getAdvIdsFromConversionsSQL(landing_uuids);

    if (conversions.length === 0) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: [], method: useAPI ? 'api' : 'sql', duration })
      };
    }

    // Шаг 2: Фильтруем валидные записи
    const validConversions = conversions.filter(c => c.adv_id && c.date_of_click);

    if (validConversions.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: [] })
      };
    }

    // Группируем по (uuid, source, adv_id) и собираем все даты
    const groupedData = new Map();
    validConversions.forEach(conv => {
      const key = `${conv.uuid}_${conv.source}_${conv.adv_id}`;
      if (!groupedData.has(key)) {
        groupedData.set(key, {
          uuid: conv.uuid,
          source: conv.source,
          adv_id: conv.adv_id,
          dates: new Set()
        });
      }
      groupedData.get(key).dates.add(conv.date_of_click);
    });

    // Шаг 3: Получаем метрики из ads_collection
    const metrics = await getMetricsFromAdsCollection(validConversions, date_from, date_to);

    // Создаем Map для быстрого поиска метрик
    const metricsByAdvIdAndDate = new Map();
    metrics.forEach(metric => {
      const sourceIdTracker = metric.source_id_tracker || 'unknown';
      const key = `${metric.adv_id}_${metric.adv_date}_${sourceIdTracker}`;

      metricsByAdvIdAndDate.set(key, {
        date: metric.adv_date,
        source_id_tracker: sourceIdTracker,
        leads: Number(metric.leads) || 0,
        cost: Number(metric.cost) || 0,
        clicks: Number(metric.clicks) || 0,
        impressions: Number(metric.impressions) || 0,
        avg_duration: Number(metric.avg_duration) || 0,
        cost_from_sources: Number(metric.cost_from_sources) || 0,
        clicks_on_link: Number(metric.clicks_on_link) || 0
      });
    });

    // Шаг 4: Группируем по (uuid, source) и собираем метрики
    const resultsByUuidSource = new Map();

    groupedData.forEach((data) => {
      const { uuid, source, adv_id, dates } = data;
      const resultKey = `${uuid}_${source}`;

      if (!resultsByUuidSource.has(resultKey)) {
        resultsByUuidSource.set(resultKey, {
          uuid: uuid,
          source: source,
          adv_ids: [],
          daily: []
        });
      }

      resultsByUuidSource.get(resultKey).adv_ids.push(adv_id);

      // Собираем метрики для каждой даты
      dates.forEach(date => {
        metricsByAdvIdAndDate.forEach((dayMetrics, key) => {
          if (key.startsWith(`${adv_id}_${date}_`)) {
            resultsByUuidSource.get(resultKey).daily.push({
              date: dayMetrics.date,
              leads: dayMetrics.leads,
              cost: dayMetrics.cost,
              clicks: dayMetrics.clicks,
              impressions: dayMetrics.impressions,
              avg_duration: dayMetrics.avg_duration,
              cost_from_sources: dayMetrics.cost_from_sources,
              clicks_on_link: dayMetrics.clicks_on_link,
              source_id_tracker: dayMetrics.source_id_tracker
            });
          }
        });
      });
    });

    // Шаг 5: Формируем финальный массив результатов
    const results = [];
    resultsByUuidSource.forEach((data) => {
      results.push({
        uuid: data.uuid,
        source: data.source,
        adv_id: data.adv_ids.join(','),
        found: data.daily.length > 0,
        daily: data.daily
      });
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Готово: ${results.length} результатов для ${landing_uuids.length} лендингов [${duration}s]`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results, method: useAPI ? 'api' : 'sql', duration })
    };

  } catch (error) {
    console.error('💥 Ошибка:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
