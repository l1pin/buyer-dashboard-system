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

// Преобразование массива массивов в массив объектов
function transformArrayResponse(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  // Первый элемент - заголовки
  const headers = data[0];
  if (!Array.isArray(headers)) {
    console.log('⚠️ Некорректный формат заголовков');
    return [];
  }

  // Остальные элементы - строки данных
  const rows = data.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

// Fetch с повторами
async function fetchWithRetry(sql, retries = CONFIG.MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

      console.log(`📤 Попытка ${attempt + 1}: отправка SQL запроса`);

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
          console.log(`⏳ Повтор через ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`API error ${response.status}`);
      }

      const text = await response.text();
      console.log(`📥 Получен ответ (${text.length} символов)`);

      if (!text || !text.trim()) {
        console.log('⚠️ Пустой ответ от API');
        return [];
      }

      const parsed = JSON.parse(text);
      console.log(`✅ Распарсено ${Array.isArray(parsed) ? parsed.length : 'не массив'} записей`);
      
      // КРИТИЧЕСКИ ВАЖНО: API возвращает массив массивов, нужно преобразовать
      if (!Array.isArray(parsed)) {
        console.log('⚠️ API вернул не массив');
        return [];
      }

      const transformed = transformArrayResponse(parsed);
      console.log(`🔄 Преобразовано в ${transformed.length} объектов`);
      
      return transformed;

    } catch (error) {
      console.error(`❌ Ошибка на попытке ${attempt + 1}:`, error.message);
      
      if (error.name === 'AbortError' && attempt < retries) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (attempt === retries) throw error;
    }
  }
}

// Получение ВСЕХ пар (adv_id, date_of_click) из conversions_collection
async function getAdvIdsFromConversions(uuids) {
  console.log(`🔍 Поиск ВСЕХ пар (adv_id, date_of_click) для ${uuids.length} UUID в conversions_collection...`);
  console.log('📋 Искомые UUID:', uuids);

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

  console.log('📝 SQL для conversions_collection (ВСЕ пары adv_id + date_of_click):', sql);

  try {
    const results = await fetchWithRetry(sql);
    
    if (!Array.isArray(results)) {
      console.error('❌ conversions API вернул не массив:', typeof results);
      return [];
    }
    
    console.log(`✅ Найдено ${results.length} записей (uuid, source, adv_id, date_of_click)`);
    
    if (results.length > 0) {
      console.log('📊 Первые 10 записей:');
      results.slice(0, 10).forEach((row, index) => {
        console.log(`  [${index}] uuid=${row.uuid}, source=${row.source}, adv_id=${row.adv_id}, date=${row.date_of_click}`);
      });
      
      // Подсчет уникальных пар (adv_id, date)
      const uniquePairs = new Set();
      results.forEach(r => {
        uniquePairs.add(`${r.adv_id}_${r.date_of_click}`);
      });
      console.log(`📊 Уникальных пар (adv_id, date_of_click): ${uniquePairs.size}`);
    } else {
      console.warn('⚠️ Не найдено ни одной записи!');
    }
    
    return results;
  } catch (error) {
    console.error('❌ Ошибка получения данных из conversions:', error);
    return [];
  }
}

// Получение метрик из ads_collection по КОНКРЕТНЫМ парам (adv_id, adv_date)
async function getMetricsFromAdsCollection(conversionsData, dateFrom = null, dateTo = null) {
  console.log(`🔍 Поиск метрик для ${conversionsData.length} пар (adv_id, date) в ads_collection...`);

  // Создаем условия для поиска по КОНКРЕТНЫМ парам (adv_id, adv_date)
  const conditions = conversionsData
    .filter(conv => conv.adv_id && conv.date_of_click)
    .map(conv => {
      return `(t.adv_id = '${escapeString(conv.adv_id)}' AND t.adv_date = '${escapeString(conv.date_of_click)}')`;
    })
    .join(' OR ');

  if (!conditions) {
    console.warn('⚠️ Нет валидных пар (adv_id, date_of_click) для поиска');
    return [];
  }

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
    WHERE (${conditions})
      AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
      ${dateFilter}
    GROUP BY t.adv_id, t.adv_date
    ORDER BY t.adv_id, t.adv_date
  `;

  console.log('📝 SQL для ads_collection (первые 1000 символов):', sql.substring(0, 1000));

  try {
    const results = await fetchWithRetry(sql);
    
    if (!Array.isArray(results)) {
      console.error('❌ ads API вернул не массив:', typeof results);
      return [];
    }
    
    console.log(`✅ Получено ${results.length} записей метрик из ads_collection`);
    
    // Логируем детали найденных метрик
    if (results.length > 0) {
      console.log('📊 Первые 5 найденных метрик:');
      results.slice(0, 5).forEach((r, i) => {
        console.log(`  [${i}] adv_id=${r.adv_id}, date=${r.adv_date}, leads=${r.leads}, cost=${r.cost}`);
      });
      
      const metricsByAdvId = {};
      results.forEach(r => {
        metricsByAdvId[r.adv_id] = (metricsByAdvId[r.adv_id] || 0) + 1;
      });
      console.log('📊 Распределение по adv_id:', metricsByAdvId);
    }
    
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

    console.log(`📊 Получено conversions: ${conversions.length}`);

    if (conversions.length === 0) {
      console.log('⚠️ Не найдено соответствий в conversions_collection');
      console.log('🔍 Проверяем, существуют ли вообще записи с такими UUID...');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: [] })
      };
    }

    // Шаг 2: Фильтруем валидные записи
    const validConversions = conversions.filter(c => c.adv_id && c.date_of_click);

    if (validConversions.length === 0) {
      console.log('⚠️ Нет валидных пар (adv_id, date_of_click)');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: [] })
      };
    }

    console.log(`📊 Найдено ${validConversions.length} пар (adv_id, date_of_click) для запроса метрик`);

    // Группируем по (uuid, source, adv_id) и собираем все даты для каждого adv_id
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

    console.log(`📊 Сгруппировано в ${groupedData.size} уникальных комбинаций (uuid, source, adv_id)`);

    // Логируем каждую комбинацию с её датами
    groupedData.forEach((data, key) => {
      console.log(`📋 ${key}: даты = [${Array.from(data.dates).sort().join(', ')}]`);
    });

    // Шаг 3: Получаем метрики из ads_collection
    const metrics = await getMetricsFromAdsCollection(validConversions, date_from, date_to);

    console.log(`✅ Получено ${metrics.length} записей метрик из ads_collection`);

    // Создаем Map для быстрого поиска метрик по (adv_id, date)
    const metricsByAdvIdAndDate = new Map();
    metrics.forEach(metric => {
      const key = `${metric.adv_id}_${metric.adv_date}`;
      metricsByAdvIdAndDate.set(key, {
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

    console.log(`📊 Создан Map метрик: ${metricsByAdvIdAndDate.size} записей`);

    // Шаг 4: Группируем по (uuid, source) и суммируем метрики со ВСЕХ adv_id
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

      // Добавляем adv_id в список
      resultsByUuidSource.get(resultKey).adv_ids.push(adv_id);

      // Собираем метрики для каждой даты этого adv_id
      dates.forEach(date => {
        const metricsKey = `${adv_id}_${date}`;
        const dayMetrics = metricsByAdvIdAndDate.get(metricsKey);

        if (dayMetrics) {
          console.log(`✅ Найдены метрики: adv_id=${adv_id}, date=${date}, leads=${dayMetrics.leads}, cost=${dayMetrics.cost}`);
          resultsByUuidSource.get(resultKey).daily.push(dayMetrics);
        } else {
          console.log(`⚠️ НЕ найдены метрики: adv_id=${adv_id}, date=${date}`);
        }
      });
    });

    // Шаг 5: Формируем финальный массив результатов
    const results = [];

    resultsByUuidSource.forEach((data) => {
      console.log(`📊 UUID=${data.uuid}, source=${data.source}:`);
      console.log(`   adv_ids=[${data.adv_ids.join(', ')}]`);
      console.log(`   дневных записей метрик: ${data.daily.length}`);

      results.push({
        uuid: data.uuid,
        source: data.source,
        adv_id: data.adv_ids.join(','),
        found: data.daily.length > 0,
        daily: data.daily
      });
    });

    console.log(`✅ Сформировано ${results.length} финальных результатов`);

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
