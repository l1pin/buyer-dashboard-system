// netlify/functions/landing-metrics-proxy.js
// Прокси для получения метрик лендингов через conversions_collection и ads_collection

const CONFIG = {
  API_URL: 'https://api.trll-notif.com.ua/adsreportcollector/core.php',
  FETCH_TIMEOUT_MS: 30000,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000
};

// Экранирование строк для SQL
function escapeString(str) {
  return String(str).replace(/'/g, "''");
}

// Fetch с повторами
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
      if (!text || !text.trim()) return [];

      return JSON.parse(text);

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

// Получение adv_id из conversions_collection
async function getAdvIdsFromConversions(uuids) {
  console.log(`🔍 Поиск adv_id для ${uuids.length} UUID в conversions_collection...`);

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
      END as adv_id
    FROM conversions_collection
    WHERE sub16 IN (${uuidConditions})
      AND source IN ('facebook', 'google', 'tiktok')
      AND (
        (source = 'facebook' AND sub1 IS NOT NULL AND sub1 != '') OR
        (source = 'google' AND sub5 IS NOT NULL AND sub5 != '') OR
        (source = 'tiktok' AND sub4 IS NOT NULL AND sub4 != '')
      )
  `;

  console.log('📝 SQL для conversions_collection:', sql.substring(0, 500));

  try {
    const results = await fetchWithRetry(sql);
    console.log(`✅ Найдено ${results.length} соответствий в conversions_collection`);
    return results;
  } catch (error) {
    console.error('❌ Ошибка получения adv_id:', error);
    return [];
  }
}

// Получение метрик из ads_collection по adv_id
async function getMetricsFromAdsCollection(advIds, dateFrom = null, dateTo = null) {
  console.log(`🔍 Поиск метрик для ${advIds.length} adv_id в ads_collection...`);

  const advIdConditions = advIds.map(id => `'${escapeString(id)}'`).join(',');

  let dateFilter = '';
  if (dateFrom && dateTo) {
    dateFilter = `AND t.adv_date >= '${escapeString(dateFrom)}' AND t.adv_date <= '${escapeString(dateTo)}'`;
  }

  const sql = `
    SELECT 
      'daily' as kind,
      t.adv_id,
      t.adv_date,
      COALESCE(SUM(t.valid), 0) AS leads,
      COALESCE(SUM(t.cost), 0) AS cost,
      COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
      COALESCE(SUM(t.showed), 0) AS impressions,
      COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
      COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
      COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
    FROM ads_collection t
    WHERE t.adv_id IN (${advIdConditions})
      AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
      ${dateFilter}
    GROUP BY t.adv_id, t.adv_date
    ORDER BY t.adv_id, t.adv_date
  `;

  console.log('📝 SQL для ads_collection (первые 500 символов):', sql.substring(0, 500));

  try {
    const results = await fetchWithRetry(sql);
    console.log(`✅ Получено ${results.length} записей метрик из ads_collection`);
    return results;
  } catch (error) {
    console.error('❌ Ошибка получения метрик:', error);
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
    const { landing_uuids, date_from, date_to } = JSON.parse(event.body);

    if (!landing_uuids || !Array.isArray(landing_uuids) || landing_uuids.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'landing_uuids обязателен и должен быть массивом' })
      };
    }

    console.log(`🚀 Запрос метрик для ${landing_uuids.length} лендингов`);

    // Шаг 1: Получаем adv_id из conversions_collection
    const conversions = await getAdvIdsFromConversions(landing_uuids);

    if (conversions.length === 0) {
      console.log('⚠️ Не найдено соответствий в conversions_collection');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: [] })
      };
    }

    // Группируем по UUID
    const uuidToAdvIds = new Map();
    conversions.forEach(conv => {
      if (!conv.adv_id) return;
      
      if (!uuidToAdvIds.has(conv.uuid)) {
        uuidToAdvIds.set(conv.uuid, []);
      }
      
      uuidToAdvIds.get(conv.uuid).push({
        source: conv.source,
        adv_id: conv.adv_id
      });
    });

    // Шаг 2: Получаем метрики из ads_collection
    const allAdvIds = conversions.map(c => c.adv_id).filter(Boolean);
    const uniqueAdvIds = [...new Set(allAdvIds)];

    if (uniqueAdvIds.length === 0) {
      console.log('⚠️ Нет валидных adv_id для поиска');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: [] })
      };
    }

    const metrics = await getMetricsFromAdsCollection(uniqueAdvIds, date_from, date_to);

    // Шаг 3: Группируем метрики по adv_id
    const metricsByAdvId = new Map();
    metrics.forEach(metric => {
      if (!metricsByAdvId.has(metric.adv_id)) {
        metricsByAdvId.set(metric.adv_id, []);
      }
      metricsByAdvId.get(metric.adv_id).push({
        date: metric.adv_date,
        leads: Number(metric.leads) || 0,
        cost: Number(metric.cost) || 0,
        clicks: Number(metric.clicks) || 0,
        impressions: Number(metric.impressions) || 0,
        avg_duration: Number(metric.avg_duration) || 0,
        cost_from_sources: Number(metric.cost_from_sources) || 0,
        clicks_on_link: Number(metric.clicks_on_link) || 0
      });
    });

    // Шаг 4: Формируем результаты по UUID
    const results = [];
    
    uuidToAdvIds.forEach((advIdList, uuid) => {
      advIdList.forEach(({ source, adv_id }) => {
        const dailyMetrics = metricsByAdvId.get(adv_id) || [];
        
        results.push({
          uuid: uuid,
          source: source,
          adv_id: adv_id,
          found: dailyMetrics.length > 0,
          daily: dailyMetrics
        });
      });
    });

    console.log(`✅ Сформировано ${results.length} результатов`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results })
    };

  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
