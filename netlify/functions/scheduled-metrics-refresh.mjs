// netlify/functions/scheduled-metrics-refresh.mjs
// Scheduled Function для автоматического обновления метрик каждые 15 минут
// Требует Netlify Pro для scheduled functions

import { createClient } from '@supabase/supabase-js';

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY,

  // Пагинация Supabase
  PAGE_SIZE: 1000,

  // Батчинг для API запросов
  BATCH_SIZE: 150,

  // Таймауты
  API_TIMEOUT_MS: 25000,
  RETRY_COUNT: 2,
  RETRY_DELAY_MS: 2000,

  // API метрик
  METRICS_API_URL: 'https://api.trll-notif.com.ua/adsreportcollector/core.php'
};

// ==================== SUPABASE CLIENT ====================
let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SERVICE_KEY) {
      throw new Error('Supabase credentials not configured. SUPABASE_URL=' + CONFIG.SUPABASE_URL + ', KEY=' + (CONFIG.SUPABASE_SERVICE_KEY ? 'SET' : 'NOT SET'));
    }

    supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabase;
}

// ==================== ПОЛУЧЕНИЕ ВСЕХ КРЕАТИВОВ С ПАГИНАЦИЕЙ ====================
async function getAllCreativesWithPagination() {
  const client = getSupabaseClient();
  let allCreatives = [];
  let offset = 0;
  let hasMore = true;

  console.log('📦 Начинаем загрузку всех креативов с пагинацией...');

  while (hasMore) {
    const { data, error } = await client
      .from('creatives')
      .select('id, article, link_titles')
      .not('link_titles', 'is', null)
      .range(offset, offset + CONFIG.PAGE_SIZE - 1);

    if (error) {
      console.error(`❌ Ошибка загрузки креативов (offset ${offset}):`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allCreatives = [...allCreatives, ...data];
      console.log(`📄 Загружено ${data.length} креативов (всего: ${allCreatives.length})`);
      offset += CONFIG.PAGE_SIZE;
      hasMore = data.length === CONFIG.PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Всего загружено ${allCreatives.length} креативов`);
  return allCreatives;
}

// ==================== СБОР УНИКАЛЬНЫХ ВИДЕО ====================
function collectUniqueVideos(creatives) {
  const videoMap = new Map();

  for (const creative of creatives) {
    if (!creative.link_titles || !Array.isArray(creative.link_titles)) continue;

    creative.link_titles.forEach((title, index) => {
      if (!title || title.startsWith('Видео ')) return;

      if (!videoMap.has(title)) {
        videoMap.set(title, []);
      }

      videoMap.get(title).push({
        creativeId: creative.id,
        article: creative.article,
        videoIndex: index
      });
    });
  }

  console.log(`📊 Собрано ${videoMap.size} уникальных видео`);
  return videoMap;
}

// ==================== SQL BUILDER ====================
function escapeSQL(str) {
  return String(str).replace(/'/g, "''");
}

// SQL для периода "all" (все данные)
function buildAllPeriodSQL(videoNames) {
  const inClause = videoNames
    .map(name => `'${escapeSQL(name)}'`)
    .join(',');

  return `
SELECT
  t.video_name,
  COALESCE(SUM(t.valid), 0) AS leads,
  COALESCE(SUM(t.cost), 0) AS cost,
  COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
  COALESCE(SUM(t.showed), 0) AS impressions,
  COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
  COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
  COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link,
  COUNT(DISTINCT t.adv_date) as days_count
FROM ads_collection t
WHERE t.video_name IN (${inClause})
  AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
GROUP BY t.video_name
ORDER BY t.video_name`;
}

// SQL для периода "4days" (первые 4 дня)
function build4DaysPeriodSQL(videoNames) {
  const inClause = videoNames
    .map(name => `'${escapeSQL(name)}'`)
    .join(',');

  return `
SELECT video_name, SUM(leads) as leads, SUM(cost) as cost, SUM(clicks) as clicks,
       SUM(impressions) as impressions, AVG(avg_duration) as avg_duration,
       SUM(cost_from_sources) as cost_from_sources, SUM(clicks_on_link) as clicks_on_link,
       COUNT(*) as days_count
FROM (
  SELECT
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
    COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link,
    ROW_NUMBER() OVER (PARTITION BY t.video_name ORDER BY t.adv_date ASC) as rn
  FROM ads_collection t
  WHERE t.video_name IN (${inClause})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
  GROUP BY t.video_name, t.adv_date
) ranked_daily
WHERE rn <= 4
GROUP BY video_name
ORDER BY video_name`;
}

// ==================== FETCH С РЕТРАЯМИ ====================
async function fetchWithRetry(sql, retries = CONFIG.RETRY_COUNT) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);

      const response = await fetch(CONFIG.METRICS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Netlify-Scheduled-Metrics/1.0'
        },
        body: JSON.stringify({ sql }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if ((response.status === 502 || response.status === 504) && attempt < retries) {
          const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(`⚠️ ${response.status}, ретрай ${attempt + 1}/${retries} через ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`API error ${response.status}`);
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        console.log('⚠️ Пустой ответ от API');
        return [];
      }

      const parsed = JSON.parse(text);

      // API возвращает массив массивов: первый элемент - заголовки, остальные - данные
      // Нужно преобразовать в массив объектов
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Проверяем формат: массив массивов или массив объектов
        if (Array.isArray(parsed[0])) {
          // Формат: [[headers], [row1], [row2], ...]
          const headers = parsed[0];
          const dataRows = parsed.slice(1);

          console.log(`📊 API вернул ${dataRows.length} записей данных (+ 1 строка заголовков)`);

          // Преобразуем в массив объектов
          const objects = dataRows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = row[index];
            });
            return obj;
          });

          if (objects.length > 0) {
            console.log(`   Пример данных:`, JSON.stringify(objects[0]));
          }

          return objects;
        } else if (typeof parsed[0] === 'object') {
          // Уже массив объектов
          console.log(`📊 API вернул ${parsed.length} объектов`);
          return parsed;
        }
      }

      console.log('⚠️ Неожиданный формат ответа:', typeof parsed);
      return [];

    } catch (error) {
      if (error.name === 'AbortError') {
        if (attempt < retries) {
          const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(`⏱️ Таймаут, ретрай ${attempt + 1}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      if (attempt === retries) {
        console.error('❌ Все ретраи исчерпаны:', error.message);
        return [];
      }
    }
  }
  return [];
}

// ==================== ОБРАБОТКА БАТЧА ====================
async function processBatch(videoNames, videoMap, period = 'all') {
  if (videoNames.length === 0) return [];

  const sql = period === '4days'
    ? build4DaysPeriodSQL(videoNames)
    : buildAllPeriodSQL(videoNames);

  const results = await fetchWithRetry(sql);

  const cacheEntries = [];
  const now = new Date().toISOString();
  let foundCount = 0;

  // Обрабатываем результаты
  for (const row of results) {
    if (!row.video_name) continue;

    const creatives = videoMap.get(row.video_name);
    if (!creatives) continue;

    foundCount++;

    for (const creative of creatives) {
      cacheEntries.push({
        creative_id: creative.creativeId,
        article: creative.article,
        video_index: creative.videoIndex,
        video_title: row.video_name,
        period: period,
        leads: Number(row.leads) || 0,
        cost: Number(row.cost) || 0,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        avg_duration: Number(row.avg_duration) || 0,
        days_count: Number(row.days_count) || 0,
        cost_from_sources: Number(row.cost_from_sources) || 0,
        clicks_on_link: Number(row.clicks_on_link) || 0,
        cached_at: now
      });
    }
  }

  // Для видео без данных - создаём записи с NULL
  const foundVideos = new Set(results.map(r => r.video_name));
  for (const videoName of videoNames) {
    if (foundVideos.has(videoName)) continue;

    const creatives = videoMap.get(videoName);
    if (!creatives) continue;

    for (const creative of creatives) {
      cacheEntries.push({
        creative_id: creative.creativeId,
        article: creative.article,
        video_index: creative.videoIndex,
        video_title: videoName,
        period: period,
        leads: null,
        cost: null,
        clicks: null,
        impressions: null,
        avg_duration: null,
        days_count: null,
        cost_from_sources: null,
        clicks_on_link: null,
        cached_at: now
      });
    }
  }

  console.log(`   → Период ${period}: найдено ${foundCount} видео с данными из ${videoNames.length}`);

  return cacheEntries;
}

// ==================== СОХРАНЕНИЕ В КЭШ ====================
async function saveBatchToCache(entries) {
  if (entries.length === 0) return 0;

  const client = getSupabaseClient();
  const SAVE_BATCH_SIZE = 100;
  let totalSaved = 0;
  let totalErrors = 0;

  for (let i = 0; i < entries.length; i += SAVE_BATCH_SIZE) {
    const batch = entries.slice(i, i + SAVE_BATCH_SIZE);

    const { data, error } = await client
      .from('metrics_cache')
      .upsert(batch, {
        onConflict: 'creative_id,video_index,period'
      })
      .select();

    if (error) {
      console.error(`❌ Ошибка сохранения батча ${i}-${i + batch.length}:`, error.message);
      totalErrors++;
      continue;
    }

    totalSaved += batch.length;
  }

  if (totalErrors > 0) {
    console.log(`⚠️ Ошибок при сохранении: ${totalErrors}`);
  }

  return totalSaved;
}

// ==================== ОБНОВЛЕНИЕ СТАТУСА ====================
async function updateMetricsStatus(status, videosUpdated = 0, isAuto = true) {
  const client = getSupabaseClient();

  const { error } = await client
    .from('metrics_last_update')
    .upsert([{
      id: 1,
      last_updated: new Date().toISOString(),
      is_auto: isAuto,
      videos_updated: videosUpdated,
      status: status
    }], {
      onConflict: 'id'
    });

  if (error) {
    console.error('❌ Ошибка обновления статуса:', error);
  }
}

// ==================== ОСНОВНАЯ ФУНКЦИЯ ====================
async function refreshAllMetrics() {
  console.log('🚀 Запуск автоматического обновления метрик...');
  console.log(`⏰ Время: ${new Date().toISOString()}`);

  try {
    // Устанавливаем статус "running"
    await updateMetricsStatus('running', 0, true);

    // Шаг 1: Получаем все креативы
    const creatives = await getAllCreativesWithPagination();

    if (creatives.length === 0) {
      console.log('⚠️ Нет креативов для обновления');
      await updateMetricsStatus('completed', 0, true);
      return { success: true, videosUpdated: 0 };
    }

    // Шаг 2: Собираем уникальные видео
    const videoMap = collectUniqueVideos(creatives);
    const videoTitles = [...videoMap.keys()];

    if (videoTitles.length === 0) {
      console.log('⚠️ Нет видео для обновления');
      await updateMetricsStatus('completed', 0, true);
      return { success: true, videosUpdated: 0 };
    }

    console.log(`📊 Всего уникальных видео: ${videoTitles.length}`);

    // Шаг 3: Обрабатываем батчами для ОБОИХ периодов
    const allCacheEntries = [];
    const totalBatches = Math.ceil(videoTitles.length / CONFIG.BATCH_SIZE);

    for (let i = 0; i < videoTitles.length; i += CONFIG.BATCH_SIZE) {
      const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
      const batch = videoTitles.slice(i, i + CONFIG.BATCH_SIZE);

      console.log(`📦 Обработка батча ${batchNum}/${totalBatches} (${batch.length} видео)...`);

      // Загружаем для периода "all"
      const entriesAll = await processBatch(batch, videoMap, 'all');
      allCacheEntries.push(...entriesAll);

      // Загружаем для периода "4days"
      const entries4days = await processBatch(batch, videoMap, '4days');
      allCacheEntries.push(...entries4days);

      // Пауза между батчами
      if (i + CONFIG.BATCH_SIZE < videoTitles.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Шаг 4: Сохраняем в кэш
    console.log(`💾 Сохранение ${allCacheEntries.length} записей в кэш...`);
    const savedCount = await saveBatchToCache(allCacheEntries);

    // Шаг 5: Обновляем статус
    await updateMetricsStatus('completed', savedCount, true);

    console.log(`✅ Обновление завершено! Сохранено: ${savedCount} записей`);

    return {
      success: true,
      creativesProcessed: creatives.length,
      uniqueVideos: videoTitles.length,
      cacheEntriesSaved: savedCount
    };

  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
    await updateMetricsStatus('failed', 0, true);

    return {
      success: false,
      error: error.message
    };
  }
}

// ==================== NETLIFY SCHEDULED FUNCTION CONFIG ====================
export const config = {
  schedule: "*/15 * * * *"
};

// ==================== HANDLER ====================
// Scheduled functions должны возвращать undefined или Response
export default async function handler(event, context) {
  console.log('========================================');
  console.log('🕐 SCHEDULED METRICS REFRESH TRIGGERED');
  console.log('========================================');

  const result = await refreshAllMetrics();

  console.log('========================================');
  console.log('📊 РЕЗУЛЬТАТ:', JSON.stringify(result, null, 2));
  console.log('========================================');

  // Scheduled functions должны возвращать undefined
  // НЕ возвращаем объект { statusCode, body }
}
