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

// Получение adv_id и date_of_click из conversions_collection
async function getAdvIdsFromConversions(uuids) {
  console.log(`🔍 Поиск adv_id и date_of_click для ${uuids.length} UUID в conversions_collection...`);
  console.log('📋 Искомые UUID:', uuids);

  const uuidConditions = uuids.map(uuid => `'${escapeString(uuid)}'`).join(',');

  const sql = `
    SELECT 
      sub16 as uuid,
      source,
      sub1,
      sub5,
      sub4,
      date_of_click,
      CASE 
        WHEN source = 'facebook' THEN sub1
        WHEN source = 'google' THEN sub5
        WHEN source = 'tiktok' THEN sub4
        ELSE NULL
      END as adv_id
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

  console.log('📝 SQL для conversions_collection (полный):', sql);

  try {
    const results = await fetchWithRetry(sql);
    
    // ВАЖНО: Проверяем что results это массив
    if (!Array.isArray(results)) {
      console.error('❌ conversions API вернул не массив:', typeof results);
      return [];
    }
    
    console.log(`✅ Найдено ${results.length} соответствий в conversions_collection`);
    
    // НОВОЕ: Детальное логирование каждой найденной записи
    if (results.length > 0) {
      console.log('📊 Детали найденных записей:');
      results.forEach((row, index) => {
        console.log(`  [${index}] uuid=${row.uuid}, source=${row.source}, sub1=${row.sub1}, sub5=${row.sub5}, sub4=${row.sub4}, adv_id=${row.adv_id}, date_of_click=${row.date_of_click}`);
      });
    } else {
      console.warn('⚠️ Не найдено ни одной записи! Проверяем первые 5 записей из conversions_collection...');
      
      // Диагностический запрос
      const diagnosticSql = `SELECT sub16, source, sub1, sub5, sub4, date_of_click FROM conversions_collection LIMIT 5`;
      console.log('🔍 Диагностический SQL:', diagnosticSql);
      
      try {
        const diagnosticResults = await fetchWithRetry(diagnosticSql);
        console.log('📊 Первые 5 записей из conversions_collection:', diagnosticResults);
      } catch (diagError) {
        console.error('❌ Ошибка диагностического запроса:', diagError);
      }
    }
    
    return results;
  } catch (error) {
    console.error('❌ Ошибка получения adv_id:', error);
    return [];
  }
}

// Получение метрик из ads_collection по adv_id и date_of_click
async function getMetricsFromAdsCollection(conversionsData, dateFrom = null, dateTo = null) {
  console.log(`🔍 Поиск метрик для ${conversionsData.length} записей в ads_collection...`);

  // Создаем условия для поиска по парам (adv_id, date_of_click)
  const conditions = conversionsData
    .filter(conv => conv.adv_id && conv.date_of_click)
    .map(conv => {
      return `(t.adv_id = '${escapeString(conv.adv_id)}' AND t.adv_date = '${escapeString(conv.date_of_click)}')`;
    })
    .join(' OR ');

  if (!conditions) {
    console.warn('⚠️ Нет валидных условий для поиска в ads_collection');
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

  console.log('📝 SQL для ads_collection (первые 500 символов):', sql.substring(0, 500));

  try {
    const results = await fetchWithRetry(sql);
    
    // ВАЖНО: Проверяем что results это массив
    if (!Array.isArray(results)) {
      console.error('❌ ads API вернул не массив:', typeof results);
      return [];
    }
    
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

    // Группируем по UUID и собираем УНИКАЛЬНЫЕ комбинации (source, adv_id, date_of_click)
    const uuidToAdvIds = new Map();
    const uniqueCombinations = new Set();
    
    conversions.forEach(conv => {
      console.log(`🔄 Обработка конверсии: uuid=${conv.uuid}, source=${conv.source}, adv_id=${conv.adv_id}, date_of_click=${conv.date_of_click}`);
      
      if (!conv.adv_id) {
        console.warn(`⚠️ Пропущена конверсия без adv_id: uuid=${conv.uuid}, source=${conv.source}`);
        return;
      }

      if (!conv.date_of_click) {
        console.warn(`⚠️ Пропущена конверсия без date_of_click: uuid=${conv.uuid}, source=${conv.source}, adv_id=${conv.adv_id}`);
        return;
      }
      
      // Создаем уникальный ключ для комбинации
      const combinationKey = `${conv.uuid}_${conv.source}_${conv.adv_id}_${conv.date_of_click}`;
      
      // Пропускаем дубликаты
      if (uniqueCombinations.has(combinationKey)) {
        console.log(`⏭️ Пропущен дубликат: ${combinationKey}`);
        return;
      }
      
      uniqueCombinations.add(combinationKey);
      
      if (!uuidToAdvIds.has(conv.uuid)) {
        uuidToAdvIds.set(conv.uuid, []);
      }
      
      uuidToAdvIds.get(conv.uuid).push({
        source: conv.source,
        adv_id: conv.adv_id,
        date_of_click: conv.date_of_click
      });
    });

    console.log(`📊 Уникальных UUID с adv_id: ${uuidToAdvIds.size}`);
    console.log('📋 Мапинг UUID → adv_id → date:', Array.from(uuidToAdvIds.entries()).map(([uuid, advIds]) => ({
      uuid,
      advIds: advIds.map(a => `${a.source}:${a.adv_id}:${a.date_of_click}`)
    })));

    // Шаг 2: Получаем метрики из ads_collection
    const validConversions = conversions.filter(c => c.adv_id && c.date_of_click);

    if (validConversions.length === 0) {
      console.log('⚠️ Нет валидных пар (adv_id, date_of_click) для поиска');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: [] })
      };
    }

    const metrics = await getMetricsFromAdsCollection(validConversions, date_from, date_to);

    // Шаг 3: Создаем Map для метрик по (adv_id, date) для быстрого поиска
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

    // Шаг 4: Группируем по (uuid, source, adv_id) и собираем все даты
    const groupedResults = new Map();
    
    uuidToAdvIds.forEach((advIdList, uuid) => {
      advIdList.forEach(({ source, adv_id, date_of_click }) => {
        const groupKey = `${uuid}_${source}_${adv_id}`;
        
        if (!groupedResults.has(groupKey)) {
          groupedResults.set(groupKey, {
            uuid: uuid,
            source: source,
            adv_id: adv_id,
            daily: []
          });
        }
        
        // Ищем метрики для этой конкретной даты
        const metricsKey = `${adv_id}_${date_of_click}`;
        const dayMetrics = metricsByAdvIdAndDate.get(metricsKey);
        
        if (dayMetrics) {
          groupedResults.get(groupKey).daily.push(dayMetrics);
        }
      });
    });

    // Шаг 5: Формируем итоговый массив результатов
    const results = [];
    
    groupedResults.forEach((value) => {
      results.push({
        uuid: value.uuid,
        source: value.source,
        adv_id: value.adv_id,
        found: value.daily.length > 0,
        daily: value.daily
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
