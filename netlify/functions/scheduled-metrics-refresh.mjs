// netlify/functions/scheduled-metrics-refresh.mjs
// Background Scheduled Function для автоматического обновления метрик каждые 15 минут
// Требует Netlify Pro - background functions работают до 15 минут (вместо 60 сек)

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

  // LIKE поиск - можно больший батч с background function
  LIKE_BATCH_SIZE: 50,

  // Таймауты
  API_TIMEOUT_MS: 25000,
  RETRY_COUNT: 2,
  RETRY_DELAY_MS: 2000,

  // Максимальное время выполнения функции (14 мин, background functions до 15 мин)
  MAX_EXECUTION_TIME_MS: 840000,

  // API метрик
  METRICS_API_URL: 'https://api.trll-notif.com.ua/adsreportcollector/core.php'
};

// Время начала выполнения
let executionStartTime = null;

// Проверка оставшегося времени
function hasTimeLeft(minRequiredMs = 5000) {
  if (!executionStartTime) return true;
  const elapsed = Date.now() - executionStartTime;
  return (CONFIG.MAX_EXECUTION_TIME_MS - elapsed) > minRequiredMs;
}

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

// SQL для периода "all" (все данные) - ТОЧНОЕ СОВПАДЕНИЕ
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

// SQL для периода "4days" (первые 4 дня) - ТОЧНОЕ СОВПАДЕНИЕ
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

// ==================== LIKE SQL BUILDER ====================
// SQL для LIKE поиска (период "all")
function buildLikeAllPeriodSQL(videoNamesWithoutExt) {
  // Строим OR условия для каждого видео
  const likeConditions = videoNamesWithoutExt
    .map(name => `t.video_name LIKE '%${escapeSQL(name)}%'`)
    .join(' OR ');

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
WHERE (${likeConditions})
  AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
GROUP BY t.video_name
ORDER BY t.video_name`;
}

// SQL для LIKE поиска (период "4days")
function buildLike4DaysPeriodSQL(videoNamesWithoutExt) {
  const likeConditions = videoNamesWithoutExt
    .map(name => `t.video_name LIKE '%${escapeSQL(name)}%'`)
    .join(' OR ');

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
  WHERE (${likeConditions})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
  GROUP BY t.video_name, t.adv_date
) ranked_daily
WHERE rn <= 4
GROUP BY video_name
ORDER BY video_name`;
}

// Убираем расширение из названия видео
function removeExtension(videoName) {
  return videoName.replace(/\.(mp4|avi|mov|mkv|webm|m4v)$/i, '');
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

// ==================== ОБРАБОТКА БАТЧА (ТОЧНОЕ СОВПАДЕНИЕ) ====================
async function processBatch(videoNames, videoMap, period = 'all') {
  if (videoNames.length === 0) return { entries: [], foundVideos: new Set(), notFoundVideos: [] };

  const sql = period === '4days'
    ? build4DaysPeriodSQL(videoNames)
    : buildAllPeriodSQL(videoNames);

  const results = await fetchWithRetry(sql);

  const cacheEntries = [];
  const now = new Date().toISOString();
  const foundVideos = new Set();

  // Обрабатываем результаты
  for (const row of results) {
    if (!row.video_name) continue;

    const creatives = videoMap.get(row.video_name);
    if (!creatives) continue;

    foundVideos.add(row.video_name);

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

  // Собираем НЕ найденные видео (НЕ создаём NULL записи - они будут созданы после LIKE)
  const notFoundVideos = videoNames.filter(name => !foundVideos.has(name));

  console.log(`   → Период ${period}: точное совпадение ${foundVideos.size}/${videoNames.length}`);

  return { entries: cacheEntries, foundVideos, notFoundVideos };
}

// ==================== ОБРАБОТКА БАТЧА (LIKE ПОИСК) ====================
async function processLikeBatch(videoNames, videoMap, period = 'all') {
  if (videoNames.length === 0) return { entries: [], matchedVideos: new Set() };

  // Строим маппинг: название без расширения -> оригинальное название
  const nameWithoutExtMap = new Map();
  const namesWithoutExt = [];

  for (const videoName of videoNames) {
    const nameWithoutExt = removeExtension(videoName);
    nameWithoutExtMap.set(nameWithoutExt.toLowerCase(), videoName);
    namesWithoutExt.push(nameWithoutExt);
  }

  const sql = period === '4days'
    ? buildLike4DaysPeriodSQL(namesWithoutExt)
    : buildLikeAllPeriodSQL(namesWithoutExt);

  const results = await fetchWithRetry(sql);

  const cacheEntries = [];
  const now = new Date().toISOString();
  const matchedVideos = new Set();

  // Обрабатываем результаты LIKE
  for (const row of results) {
    if (!row.video_name) continue;

    // Ищем соответствие по частичному совпадению
    let matchedOriginalName = null;

    for (const [nameWithoutExtLower, originalName] of nameWithoutExtMap.entries()) {
      const dbNameLower = row.video_name.toLowerCase();

      // Проверяем оба направления
      if (dbNameLower.includes(nameWithoutExtLower) || nameWithoutExtLower.includes(dbNameLower)) {
        matchedOriginalName = originalName;
        // Удаляем из маппинга чтобы не находить повторно
        nameWithoutExtMap.delete(nameWithoutExtLower);
        break;
      }
    }

    if (!matchedOriginalName) continue;

    const creatives = videoMap.get(matchedOriginalName);
    if (!creatives) continue;

    matchedVideos.add(matchedOriginalName);

    for (const creative of creatives) {
      cacheEntries.push({
        creative_id: creative.creativeId,
        article: creative.article,
        video_index: creative.videoIndex,
        video_title: matchedOriginalName, // Сохраняем оригинальное название
        period: period,
        leads: Number(row.leads) || 0,
        cost: Number(row.cost) || 0,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        avg_duration: Number(row.avg_duration) || 0,
        days_count: Number(row.days_count) || 0,
        cost_from_sources: Number(row.cost_from_sources) || 0,
        clicks_on_link: Number(row.clicks_on_link) || 0,
        cached_at: now,
        found_via_like: true // Маркер LIKE поиска
      });
    }
  }

  console.log(`   → Период ${period}: LIKE совпадение ${matchedVideos.size}/${videoNames.length}`);

  return { entries: cacheEntries, matchedVideos };
}

// ==================== СОЗДАНИЕ NULL ЗАПИСЕЙ ====================
function createNullEntries(videoNames, videoMap, period, now, likeSearched = false) {
  const entries = [];

  for (const videoName of videoNames) {
    const creatives = videoMap.get(videoName);
    if (!creatives) continue;

    for (const creative of creatives) {
      entries.push({
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
        cached_at: now,
        like_searched: likeSearched // Флаг: был ли LIKE поиск
      });
    }
  }

  return entries;
}

// ==================== ПОЛУЧЕНИЕ ВИДЕО ДЛЯ LIKE ПОИСКА ====================
// Возвращает видео которые имеют NULL в кэше и ещё не были проверены через LIKE
async function getVideosNeedingLikeSearch(videoTitles, period = 'all') {
  const client = getSupabaseClient();

  // Получаем видео которые уже проверены LIKE (like_searched = true или имеют данные)
  const { data: checkedVideos, error } = await client
    .from('metrics_cache')
    .select('video_title')
    .eq('period', period)
    .or('like_searched.eq.true,leads.not.is.null');

  if (error) {
    console.error('❌ Ошибка получения проверенных видео:', error);
    return videoTitles; // При ошибке проверяем все
  }

  const checkedSet = new Set(checkedVideos?.map(v => v.video_title) || []);

  // Фильтруем - оставляем только непроверенные
  const needsCheck = videoTitles.filter(title => !checkedSet.has(title));

  console.log(`📊 Видео для LIKE: ${needsCheck.length} из ${videoTitles.length} (уже проверено: ${checkedSet.size})`);

  return needsCheck;
}

// ==================== ПОМЕТКА ВИДЕО КАК LIKE-ПРОВЕРЕННЫХ ====================
async function markVideosAsLikeSearched(videoTitles, period = 'all') {
  if (videoTitles.length === 0) return;

  const client = getSupabaseClient();

  // Обновляем like_searched = true для всех проверенных видео
  const { error } = await client
    .from('metrics_cache')
    .update({ like_searched: true })
    .eq('period', period)
    .in('video_title', videoTitles);

  if (error) {
    console.error('❌ Ошибка пометки видео:', error);
  } else {
    console.log(`✅ Помечено ${videoTitles.length} видео как LIKE-проверенные`);
  }
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
  // Засекаем время начала
  executionStartTime = Date.now();

  console.log('🚀 Запуск автоматического обновления метрик...');
  console.log(`⏰ Время: ${new Date().toISOString()}`);
  console.log(`⏱️ Лимит времени: ${CONFIG.MAX_EXECUTION_TIME_MS / 1000} сек`);

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

    // ==================== ШАГ 3: ТОЧНОЕ СОВПАДЕНИЕ ====================
    console.log('\n═══════════════════════════════════════════════');
    console.log('📍 ШАГ 3: ТОЧНОЕ СОВПАДЕНИЕ');
    console.log('═══════════════════════════════════════════════');

    const allCacheEntries = [];
    const allNotFoundAll = []; // Не найденные для периода "all"
    const allNotFound4days = []; // Не найденные для периода "4days"
    const totalBatches = Math.ceil(videoTitles.length / CONFIG.BATCH_SIZE);

    for (let i = 0; i < videoTitles.length; i += CONFIG.BATCH_SIZE) {
      const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
      const batch = videoTitles.slice(i, i + CONFIG.BATCH_SIZE);

      console.log(`📦 Батч ${batchNum}/${totalBatches} (${batch.length} видео)...`);

      // Точное совпадение для периода "all"
      const resultAll = await processBatch(batch, videoMap, 'all');
      allCacheEntries.push(...resultAll.entries);
      allNotFoundAll.push(...resultAll.notFoundVideos);

      // Точное совпадение для периода "4days"
      const result4days = await processBatch(batch, videoMap, '4days');
      allCacheEntries.push(...result4days.entries);
      allNotFound4days.push(...result4days.notFoundVideos);

      // Пауза между батчами
      if (i + CONFIG.BATCH_SIZE < videoTitles.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`\n📊 Результат точного совпадения:`);
    console.log(`   Найдено (all): ${videoTitles.length - allNotFoundAll.length}/${videoTitles.length}`);
    console.log(`   Найдено (4days): ${videoTitles.length - allNotFound4days.length}/${videoTitles.length}`);
    console.log(`   Не найдено (all): ${allNotFoundAll.length}`);

    // ==================== ШАГ 4: LIKE ПОИСК (ИНКРЕМЕНТАЛЬНЫЙ) ====================
    let likeSearchCompleted = false;
    let likeSearchSkipped = 0;
    let likeSearchedInThisRun = 0;
    const allLikeMatchedAll = new Set();
    const allLikeMatched4days = new Set();
    const processedInThisRun = []; // Видео обработанные в этом запуске

    if (allNotFoundAll.length > 0 && hasTimeLeft(15000)) {
      console.log('\n═══════════════════════════════════════════════');
      console.log('🔍 ШАГ 4: LIKE ПОИСК (ИНКРЕМЕНТАЛЬНЫЙ)');
      console.log('═══════════════════════════════════════════════');

      // Получаем только видео которые ещё НЕ были проверены через LIKE
      const needsLikeSearch = await getVideosNeedingLikeSearch(allNotFoundAll, 'all');

      if (needsLikeSearch.length === 0) {
        console.log('✅ Все видео уже проверены через LIKE в предыдущих запусках');
        likeSearchCompleted = true;
      } else {
        console.log(`📊 Всего не найдено точно: ${allNotFoundAll.length}`);
        console.log(`📊 Ещё не проверено LIKE: ${needsLikeSearch.length}`);
        console.log(`📊 Уже проверено ранее: ${allNotFoundAll.length - needsLikeSearch.length}`);
        console.log(`📦 Размер батча LIKE: ${CONFIG.LIKE_BATCH_SIZE}`);

        // Создаём Set для быстрого поиска
        const needsLikeSet = new Set(needsLikeSearch);
        // Фильтруем 4days список аналогично
        const needsLike4days = allNotFound4days.filter(v => needsLikeSet.has(v));

        const likeBatches = Math.ceil(needsLikeSearch.length / CONFIG.LIKE_BATCH_SIZE);

        for (let i = 0; i < needsLikeSearch.length; i += CONFIG.LIKE_BATCH_SIZE) {
          // Проверяем время перед каждым батчем
          if (!hasTimeLeft(10000)) {
            likeSearchSkipped = needsLikeSearch.length - i;
            console.log(`\n⏰ ТАЙМАУТ: Осталось мало времени, пропускаем ${likeSearchSkipped} видео`);
            console.log(`📊 В следующем запуске продолжим с этого места`);
            break;
          }

          const batchNum = Math.floor(i / CONFIG.LIKE_BATCH_SIZE) + 1;
          const batchAll = needsLikeSearch.slice(i, i + CONFIG.LIKE_BATCH_SIZE);
          const batch4days = needsLike4days.slice(i, i + CONFIG.LIKE_BATCH_SIZE);

          const elapsed = Math.round((Date.now() - executionStartTime) / 1000);
          console.log(`🔍 LIKE батч ${batchNum}/${likeBatches} (${batchAll.length} видео) [${elapsed}с]...`);

          // LIKE для периода "all"
          const likeResultAll = await processLikeBatch(batchAll, videoMap, 'all');
          allCacheEntries.push(...likeResultAll.entries);
          likeResultAll.matchedVideos.forEach(v => allLikeMatchedAll.add(v));

          // LIKE для периода "4days"
          const likeResult4days = await processLikeBatch(batch4days, videoMap, '4days');
          allCacheEntries.push(...likeResult4days.entries);
          likeResult4days.matchedVideos.forEach(v => allLikeMatched4days.add(v));

          // Запоминаем обработанные видео
          processedInThisRun.push(...batchAll);
          likeSearchedInThisRun += batchAll.length;

          // Пауза между LIKE батчами (они тяжелее)
          if (i + CONFIG.LIKE_BATCH_SIZE < needsLikeSearch.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        likeSearchCompleted = likeSearchSkipped === 0;

        console.log(`\n📊 Результат LIKE поиска (этот запуск):`);
        console.log(`   Обработано: ${likeSearchedInThisRun}/${needsLikeSearch.length}`);
        console.log(`   Найдено (all): ${allLikeMatchedAll.size}`);
        console.log(`   Найдено (4days): ${allLikeMatched4days.size}`);
        if (likeSearchSkipped > 0) {
          console.log(`   ⏰ Осталось на следующий запуск: ${likeSearchSkipped}`);
        }
      }
    } else if (allNotFoundAll.length > 0) {
      console.log('\n⏰ LIKE поиск пропущен - недостаточно времени');
      console.log(`📊 В следующем запуске обработаем ${allNotFoundAll.length} видео`);
      likeSearchSkipped = allNotFoundAll.length;
    } else {
      console.log('\n✅ Все видео найдены точным совпадением, LIKE поиск не требуется');
      likeSearchCompleted = true;
    }

    // ==================== ШАГ 5: NULL ЗАПИСИ (ТОЛЬКО ДЛЯ LIKE-ПРОВЕРЕННЫХ) ====================
    // Создаём NULL записи только для видео которые были LIKE-проверены в этом запуске и не нашлись
    const now = new Date().toISOString();

    // Видео которые были проверены через LIKE в этом запуске и НЕ найдены
    const processedSet = new Set(processedInThisRun);
    const likeCheckedNotFoundAll = allNotFoundAll.filter(v =>
      processedSet.has(v) && !allLikeMatchedAll.has(v)
    );
    const likeCheckedNotFound4days = allNotFound4days.filter(v =>
      processedSet.has(v) && !allLikeMatched4days.has(v)
    );

    if (likeCheckedNotFoundAll.length > 0 && hasTimeLeft(5000)) {
      console.log(`\n📝 Создание NULL записей для ${likeCheckedNotFoundAll.length} видео (LIKE-проверены, не найдены)...`);
      // like_searched = true - эти видео уже проверены через LIKE
      const nullEntriesAll = createNullEntries(likeCheckedNotFoundAll, videoMap, 'all', now, true);
      const nullEntries4days = createNullEntries(likeCheckedNotFound4days, videoMap, '4days', now, true);
      allCacheEntries.push(...nullEntriesAll);
      allCacheEntries.push(...nullEntries4days);
    }

    // ==================== ШАГ 6: СОХРАНЕНИЕ ====================
    console.log('\n═══════════════════════════════════════════════');
    console.log('💾 ШАГ 6: СОХРАНЕНИЕ В КЭШ');
    console.log('═══════════════════════════════════════════════');
    console.log(`💾 Сохранение ${allCacheEntries.length} записей в кэш...`);
    const savedCount = await saveBatchToCache(allCacheEntries);

    // Шаг 7: Обновляем статус
    await updateMetricsStatus('completed', savedCount, true);

    const totalElapsed = Math.round((Date.now() - executionStartTime) / 1000);
    const exactMatched = videoTitles.length - allNotFoundAll.length;
    const likeMatched = allLikeMatchedAll.size;

    console.log('\n═══════════════════════════════════════════════');
    console.log(`✅ ОБНОВЛЕНИЕ ЗАВЕРШЕНО за ${totalElapsed} сек!`);
    console.log(`   Креативов: ${creatives.length}`);
    console.log(`   Видео: ${videoTitles.length}`);
    console.log(`   Точное совпадение: ${exactMatched}`);
    console.log(`   LIKE обработано в этом запуске: ${likeSearchedInThisRun}`);
    console.log(`   LIKE найдено: ${likeMatched}`);
    if (likeSearchSkipped > 0) {
      console.log(`   ⏰ LIKE осталось на следующий запуск: ${likeSearchSkipped}`);
    }
    if (likeSearchCompleted) {
      console.log(`   ✅ Все видео проверены через LIKE`);
    }
    console.log(`   Сохранено записей: ${savedCount}`);
    console.log('═══════════════════════════════════════════════');

    return {
      success: true,
      creativesProcessed: creatives.length,
      uniqueVideos: videoTitles.length,
      exactMatched,
      likeMatched,
      likeSearchedInThisRun,
      likeSearchSkipped,
      likeSearchCompleted,
      cacheEntriesSaved: savedCount,
      elapsedSeconds: totalElapsed
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
  schedule: "*/15 * * * *",
  type: "background"  // До 15 минут вместо 60 секунд (требует Netlify Pro)
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
