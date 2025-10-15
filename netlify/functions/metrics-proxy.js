// netlify/functions/metrics-proxy.js - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ
// Батчевая загрузка метрик с чанкингом, параллелизмом и кэшированием

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
  // Лимиты SQL
  MAX_SQL_BYTES: 250000,        // 250 KB на один SQL-запрос
  NAMES_PER_CHUNK_SOFT: 300,    // Мягкий лимит имён на чанк
  MAX_VIDEO_NAMES: 50000,       // Максимум имён в одном запросе
  
  // Параллелизм
  PARALLEL_CHUNKS: 4,            // Количество параллельных SQL-запросов
  
  // Таймауты и ретраи
  FETCH_TIMEOUT_MS: 15000,       // 15 секунд на один SQL-запрос (обычный)
  LIKE_FETCH_TIMEOUT_MS: 25000,  // 25 секунд для LIKE запросов
  MAX_RETRIES: 2,                // Количество повторов при ошибках
  RETRY_DELAY_MS: 1000,          // Базовая задержка для экспоненциального бэкофа
  
  // Кэширование
  CACHE_TTL_MS: 90000,           // 90 секунд TTL для кэша
  CACHE_MAX_SIZE: 100,           // Максимум записей в LRU кэше
  
  // LIKE поиск
  MAX_LIKE_NAMES: 300,           // Максимум имён для LIKE запроса (увеличено для батчей)
  
  // API
  API_URL: 'https://api.trll-notif.com.ua/adsreportcollector/core.php'
};

// ==================== IN-MEMORY LRU КЭШ ====================
class LRUCache {
  constructor(maxSize = CONFIG.CACHE_MAX_SIZE, ttlMs = CONFIG.CACHE_TTL_MS) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  _hash(key) {
    // Простой хэш для ключа
    return JSON.stringify(key);
  }

  get(key) {
    const hashKey = this._hash(key);
    const entry = this.cache.get(hashKey);
    
    if (!entry) return null;
    
    // Проверяем TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(hashKey);
      return null;
    }
    
    // Обновляем позицию (LRU)
    this.cache.delete(hashKey);
    this.cache.set(hashKey, entry);
    
    return entry.data;
  }

  set(key, data) {
    const hashKey = this._hash(key);
    
    // Удаляем старые записи, если превышен лимит
    if (this.cache.size >= this.maxSize && !this.cache.has(hashKey)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(hashKey, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

const cache = new LRUCache();

// ==================== SQL ГЕНЕРАТОР ====================
class SQLBuilder {
  static escapeString(str) {
    // Экранируем апострофы для SQL
    return String(str).replace(/'/g, "''");
  }

  static estimateSQLSize(videoNames, dateFrom, dateTo, kind) {
    // Оценка размера SQL-запроса в байтах
    const baseQuery = 1500; // Базовый шаблон SQL
    const perName = 15;     // Средний размер на одно имя ('name'),
    const dateFilter = dateFrom && dateTo ? 100 : 0;
    const kindOverhead = kind === 'daily_first4_total' ? 1000 : 200;
    
    return baseQuery + (videoNames.length * perName) + dateFilter + kindOverhead;
  }

  static buildBatchSQL(videoNames, dateFrom = null, dateTo = null, kind = 'daily', useLike = false) {
    if (!videoNames || videoNames.length === 0) {
      throw new Error('videoNames не может быть пустым');
    }

    console.log('🔨 Формирование SQL для', videoNames.length, 'видео, kind:', kind, 'useLike:', useLike);
    console.log('📋 ВСЕ названия видео:');
    videoNames.forEach((name, i) => {
      console.log(`  [${i}]: "${name}"`);
    });

    // Фильтр по датам
    let dateFilter = '';
    if (dateFrom && dateTo) {
      dateFilter = `AND t.adv_date >= '${this.escapeString(dateFrom)}' 
      AND t.adv_date <= '${this.escapeString(dateTo)}'`;
    }

    // LIKE запрос или обычный IN
    if (useLike) {
      return this._buildLikeSQL(videoNames, dateFilter, kind);
    }

    // VALUES список для video_list CTE
    const valuesClause = videoNames
      .map(name => `('${this.escapeString(name)}')`)
      .join(',\n    ');
    
    console.log('📝 ПОЛНЫЙ VALUES clause:');
    console.log(valuesClause);

    // Выбираем шаблон SQL в зависимости от kind
    if (kind === 'daily_first4_total') {
      return this._buildDailyFirst4TotalSQL(valuesClause, dateFilter);
    } else if (kind === 'daily') {
      return this._buildDailySQL(valuesClause, dateFilter);
    } else if (kind === 'first4') {
      return this._buildFirst4SQL(valuesClause, dateFilter);
    } else if (kind === 'total') {
      return this._buildTotalSQL(valuesClause, dateFilter);
    } else {
      // По умолчанию - daily
      return this._buildDailySQL(valuesClause, dateFilter);
    }
  }

  static _buildDailySQL(valuesClause, dateFilter) {
    // НЕ используем replace - он удаляет скобки из названий видео!
    // Вместо этого извлекаем названия из VALUES и формируем IN напрямую
    const names = valuesClause.match(/'([^']|'')+'/g) || [];
    const inClause = names.join(',');
    
    console.log('📋 IN clause для daily:');
    console.log(inClause);
    
    return `
SELECT 
  'daily' as kind,
  t.video_name,
  t.adv_date,
  COALESCE(SUM(t.valid), 0) AS leads,
  COALESCE(SUM(t.cost), 0) AS cost,
  COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
  COALESCE(SUM(t.showed), 0) AS impressions,
  COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
  COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
  COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
FROM ads_collection t
WHERE t.video_name IN (${inClause})
  AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
  ${dateFilter}
GROUP BY t.video_name, t.adv_date
ORDER BY t.video_name, t.adv_date`;
  }

  static _buildFirst4SQL(valuesClause, dateFilter) {
    const names = valuesClause.match(/'([^']|'')+'/g) || [];
    const inClause = names.join(',');
    
    return `
SELECT 
  'first4' as kind,
  video_name,
  NULL as adv_date,
  SUM(leads) as leads,
  SUM(cost) as cost,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  AVG(avg_duration) as avg_duration,
  SUM(cost_from_sources) as cost_from_sources,
  SUM(clicks_on_link) as clicks_on_link
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
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) ranked_daily
WHERE rn <= 4
GROUP BY video_name
ORDER BY video_name`;
  }

  static _buildTotalSQL(valuesClause, dateFilter) {
    const names = valuesClause.match(/'([^']|'')+'/g) || [];
    const inClause = names.join(',');
    
    return `
SELECT 
  'total' as kind,
  video_name,
  NULL as adv_date,
  SUM(leads) as leads,
  SUM(cost) as cost,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  AVG(avg_duration) as avg_duration,
  SUM(cost_from_sources) as cost_from_sources,
  SUM(clicks_on_link) as clicks_on_link
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
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
  FROM ads_collection t
  WHERE t.video_name IN (${inClause})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data
GROUP BY video_name
ORDER BY video_name`;
  }

  static _buildDailyFirst4TotalSQL(valuesClause, dateFilter) {
    const names = valuesClause.match(/'([^']|'')+'/g) || [];
    const inClause = names.join(',');
    
    return `
SELECT 'daily' as kind, video_name, adv_date, leads, cost, clicks, impressions, avg_duration, cost_from_sources, clicks_on_link 
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
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
  FROM ads_collection t
  WHERE t.video_name IN (${inClause})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data
UNION ALL
SELECT 'first4' as kind, video_name, NULL as adv_date, SUM(leads) as leads, SUM(cost) as cost, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(avg_duration) as avg_duration, SUM(cost_from_sources) as cost_from_sources, SUM(clicks_on_link) as clicks_on_link
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
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) ranked_daily
WHERE rn <= 4
GROUP BY video_name
UNION ALL
SELECT 'total' as kind, video_name, NULL as adv_date, SUM(leads) as leads, SUM(cost) as cost, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(avg_duration) as avg_duration, SUM(cost_from_sources) as cost_from_sources, SUM(clicks_on_link) as clicks_on_link
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
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
  FROM ads_collection t
  WHERE t.video_name IN (${inClause})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data2
GROUP BY video_name
ORDER BY video_name, kind, adv_date`;
  }

  static _buildLikeSQL(videoNames, dateFilter, kind) {
    console.log('🔍 Формирование LIKE SQL для', videoNames.length, 'видео');
    
    // Обрезаем расширения и создаем LIKE условия
    const likeConditions = videoNames.map(name => {
      // Убираем расширение (.mp4, .mov и т.д.)
      const nameWithoutExt = name.replace(/\.(mp4|avi|mov|mkv|webm|m4v)$/i, '');
      const escaped = this.escapeString(nameWithoutExt);
      return `t.video_name LIKE '%${escaped}%'`;
    }).join(' OR ');
    
    console.log('📝 LIKE условия сформированы для', videoNames.length, 'названий');
    
    // Используем LIKE вместо IN
    if (kind === 'daily_first4_total') {
      return `
SELECT 'daily' as kind, video_name, adv_date, leads, cost, clicks, impressions, avg_duration, cost_from_sources, clicks_on_link 
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
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
  FROM ads_collection t
  WHERE (${likeConditions})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data
UNION ALL
SELECT 'first4' as kind, video_name, NULL as adv_date, SUM(leads) as leads, SUM(cost) as cost, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(avg_duration) as avg_duration, SUM(cost_from_sources) as cost_from_sources, SUM(clicks_on_link) as clicks_on_link
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
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) ranked_daily
WHERE rn <= 4
GROUP BY video_name
UNION ALL
SELECT 'total' as kind, video_name, NULL as adv_date, SUM(leads) as leads, SUM(cost) as cost, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(avg_duration) as avg_duration, SUM(cost_from_sources) as cost_from_sources, SUM(clicks_on_link) as clicks_on_link
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
    COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
  FROM ads_collection t
  WHERE (${likeConditions})
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data2
GROUP BY video_name
ORDER BY video_name, kind, adv_date`;
    } else {
      // Для остальных kind - просто daily с LIKE
      return `
SELECT 
  'daily' as kind,
  t.video_name,
  t.adv_date,
  COALESCE(SUM(t.valid), 0) AS leads,
  COALESCE(SUM(t.cost), 0) AS cost,
  COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
  COALESCE(SUM(t.showed), 0) AS impressions,
  COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
  COALESCE(SUM(t.cost_from_sources), 0) AS cost_from_sources,
  COALESCE(SUM(t.clicks_on_link), 0) AS clicks_on_link
FROM ads_collection t
WHERE (${likeConditions})
  AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
  ${dateFilter}
GROUP BY t.video_name, t.adv_date
ORDER BY t.video_name, t.adv_date`;
    }
  }
}

// ==================== ЧАНКИНГ ====================
class Chunker {
  static splitIntoChunks(videoNames, dateFrom, dateTo, kind) {
    const chunks = [];
    let currentChunk = [];
    
    for (const name of videoNames) {
      currentChunk.push(name);
      
      // Проверяем размер потенциального SQL
      const estimatedSize = SQLBuilder.estimateSQLSize(currentChunk, dateFrom, dateTo, kind);
      
      if (estimatedSize > CONFIG.MAX_SQL_BYTES || currentChunk.length >= CONFIG.NAMES_PER_CHUNK_SOFT) {
        // Если добавление этого имени превышает лимит, откатываемся
        if (currentChunk.length > 1) {
          currentChunk.pop();
          chunks.push([...currentChunk]);
          currentChunk = [name];
        } else {
          // Одно имя само по себе слишком длинное - всё равно добавляем
          chunks.push([...currentChunk]);
          currentChunk = [];
        }
      }
    }
    
    // Добавляем последний чанк
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
}

// ==================== FETCH С РЕТРАЯМИ ====================
async function fetchWithRetry(sql, retries = CONFIG.MAX_RETRIES, isLike = false) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log('🔍 ОТПРАВКА К PHP API:');
      console.log('  📍 URL:', CONFIG.API_URL);
      console.log('  📋 SQL длина:', sql?.length, 'байт');
      console.log('  📋 SQL (первые 200 символов):', sql?.substring(0, 200));
      console.log('  🔥 LIKE режим:', isLike);
      
      const controller = new AbortController();
      const timeoutMs = isLike ? CONFIG.LIKE_FETCH_TIMEOUT_MS : CONFIG.FETCH_TIMEOUT_MS;
      console.log('  ⏱️ Таймаут:', timeoutMs, 'мс');
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Netlify-Batch-Metrics-Proxy/2.0',
          'Connection': 'keep-alive'
        },
        body: JSON.stringify({ sql }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📡 Ответ от PHP API:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length')
        }
      });

      if (!response.ok) {
        // На 502/504 делаем ретрай
        if ((response.status === 502 || response.status === 504) && attempt < retries) {
          const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(`⚠️ ${response.status}, ретрай ${attempt + 1}/${retries} через ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        const errorText = await response.text();
        console.error('❌ Ошибка от API:', errorText.substring(0, 500));
        throw new Error(`API error ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const text = await response.text();
      
      // КРИТИЧНО: Детальное логирование ответа
      console.log('📨 СЫРОЙ ОТВЕТ от PHP API:', {
        length: text?.length,
        isEmpty: !text || text.trim() === '',
        preview: text?.substring(0, 1000), // Увеличили до 1000 символов
        fullText: text // ПОЛНЫЙ текст ответа для диагностики
      });
      
      if (!text || !text.trim()) {
        console.log('⚠️ Пустой ответ от API');
        return [];
      }

      const parsed = JSON.parse(text);
      
      // КРИТИЧНО: Логируем распарсенный ответ
      console.log('📋 Распарсенный ответ:', {
        type: typeof parsed,
        isArray: Array.isArray(parsed),
        keys: typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed) : [],
        length: Array.isArray(parsed) ? parsed.length : undefined,
        firstItem: Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : undefined
      });
      
      // КРИТИЧНО: Обрабатываем разные форматы ответа от PHP API
      if (Array.isArray(parsed)) {
        console.log('✅ Ответ - массив, возвращаем как есть');
        return parsed;
      }
      
      // Если ответ - объект с полем data
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.data)) {
        console.log('✅ Извлекаем массив из поля data');
        return parsed.data;
      }
      
      // Если ответ - объект с полем results
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.results)) {
        console.log('✅ Извлекаем массив из поля results');
        return parsed.results;
      }
      
      // Если это пустой объект
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length === 0) {
        console.log('⚠️ Пустой объект, возвращаем []');
        return [];
      }
      
      console.error('❌ Неожиданный формат ответа от API:', {
        type: typeof parsed,
        value: parsed
      });
      return [];
      
    } catch (error) {
      if (error.name === 'AbortError') {
        if (attempt < retries) {
          const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(`⏱️ Таймаут, ретрай ${attempt + 1}/${retries} через ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error('Таймаут запроса после всех ретраев');
      }
      
      if (attempt === retries) {
        throw error;
      }
    }
  }
}

// ==================== ПУЛ ВОРКЕРОВ ====================
class WorkerPool {
  constructor(concurrency = CONFIG.PARALLEL_CHUNKS) {
    this.concurrency = concurrency;
  }

  async processChunks(chunks, dateFrom, dateTo, kind, useLike = false) {
    const results = [];
    const queue = [...chunks];
    let processed = 0;

    console.log(`🚀 Запуск пула: ${chunks.length} чанков, параллелизм ${this.concurrency}, LIKE: ${useLike}`);

    const workers = [];
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(this._worker(queue, dateFrom, dateTo, kind, useLike, results, processed, chunks.length));
    }

    await Promise.allSettled(workers);
    
    console.log(`✅ Пул завершён: обработано ${results.length} чанков`);
    
    // Объединяем результаты
    return results.flat();
  }

  async _worker(queue, dateFrom, dateTo, kind, useLike, results, processed, total) {
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (!chunk) break;

      try {
        console.log(`📊 Обработка чанка ${++processed}/${total}, имён: ${chunk.length}`);
        console.log('📋 ВСЕ названия в чанке:');
        chunk.forEach((name, idx) => {
          console.log(`  [${idx}]: "${name}"`);
        });
        
        const sql = SQLBuilder.buildBatchSQL(chunk, dateFrom, dateTo, kind, useLike);
        console.log('🔍 SQL сформирован, длина:', sql.length, 'байт', useLike ? '(LIKE)' : '(IN)');
        console.log('=====================================');
        console.log('📝 ПОЛНЫЙ SQL:');
        console.log(sql);
        console.log('=====================================');
        
        console.log('🌐 Отправка SQL к PHP API...');
        const data = await fetchWithRetry(sql, CONFIG.MAX_RETRIES, useLike);
        
        console.log('📥 ДЕТАЛЬНЫЙ результат от БД:', {
          type: typeof data,
          isArray: Array.isArray(data),
          length: data?.length,
          firstItem: data?.[0],
          firstThreeItems: data?.slice(0, 3)
        });
        
        results.push(data);
        console.log(`✅ Чанк ${processed} выполнен, записей: ${data.length}`);
        
      } catch (error) {
        console.error(`❌ Ошибка чанка ${processed}:`, error.message);
        // Продолжаем обработку других чанков
      }
    }
  }
}

// ==================== ОСНОВНОЙ ОБРАБОТЧИК ====================
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
    'Connection': 'keep-alive'
  };

  // Preflight
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
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Неверный JSON' })
      };
    }

    // ===== ОБРАБОТКА FORCE_REFRESH =====
    const forceRefresh = requestBody.force_refresh === true;
    if (forceRefresh) {
      console.log('🔄 Форсированное обновление - очищаем кэш');
    }

    // ===== ОБРАТНАЯ СОВМЕСТИМОСТЬ: старый формат {sql: "..."} =====
    if (requestBody.sql && !requestBody.video_names) {
      console.log('🔄 Обратная совместимость: старый формат запроса');
      
      if (!/^\s*select\b/i.test(requestBody.sql)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Разрешены только SELECT запросы' })
        };
      }

      const data = await fetchWithRetry(requestBody.sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    // ===== НОВЫЙ ФОРМАТ: {video_names: [...], ...} =====
    const { video_names, date_from, date_to, kind = 'daily', use_like = false } = requestBody;

    console.log('🔍 ДИАГНОСТИКА ЗАПРОСА:');
    console.log('  📋 video_names тип:', typeof video_names, 'isArray:', Array.isArray(video_names));
    console.log('  📋 video_names длина:', video_names?.length);
    console.log('  📋 Первое название:', video_names?.[0]);
    console.log('  📋 Второе название:', video_names?.[1]);
    console.log('  📋 Третье название:', video_names?.[2]);
    console.log('  📋 date_from:', date_from);
    console.log('  📋 date_to:', date_to);
    console.log('  📋 kind:', kind);
    console.log('  📋 use_like:', use_like);

    if (!video_names || !Array.isArray(video_names) || video_names.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'video_names обязателен и должен быть непустым массивом',
          hint: 'Формат: {video_names: ["v1", "v2"], date_from: "2024-01-01", date_to: "2024-12-31", kind: "daily_first4_total"}'
        })
      };
    }

    // Проверка лимита
    if (video_names.length > CONFIG.MAX_VIDEO_NAMES) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `Превышен лимит: максимум ${CONFIG.MAX_VIDEO_NAMES} имён`,
          received: video_names.length,
          hint: 'Уменьшите количество имён или включите пагинацию'
        })
      };
    }

    // Проверка кэша (пропускаем если forceRefresh)
    const cacheKey = { video_names: video_names.sort(), date_from, date_to, kind };
    
    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log(`💾 Кэш HIT для ${video_names.length} имён (${cached.length} записей)`);
        
        // КРИТИЧНО: Не возвращаем пустой кэш!
        if (cached.length > 0) {
          return {
            statusCode: 200,
            headers: { ...headers, 'X-Cache': 'HIT' },
            body: JSON.stringify(cached)
          };
        } else {
          console.log('⚠️ Кэш содержит пустой массив, игнорируем');
        }
      }
    } else {
      console.log('🔄 Форсированное обновление - пропускаем кэш');
    }

    console.log(`📡 Новый запрос: ${video_names.length} имён, kind=${kind}`);

    // Разбиваем на чанки
    const chunks = Chunker.splitIntoChunks(video_names, date_from, date_to, kind);
    console.log(`📦 Создано чанков: ${chunks.length}`);

    // Обрабатываем через пул воркеров
    const pool = new WorkerPool(CONFIG.PARALLEL_CHUNKS);
    const results = await pool.processChunks(chunks, date_from, date_to, kind, use_like);

    // Нормализуем результаты
    const normalizedResults = normalizeResults(results);

    // Сохраняем в кэш
    cache.set(cacheKey, normalizedResults);

    console.log(`✅ Запрос выполнен: ${normalizedResults.length} записей`);

    return {
      statusCode: 200,
      headers: { 
        ...headers, 
        'X-Cache': 'MISS',
        'X-Chunks-Processed': chunks.length.toString(),
        'X-Total-Records': normalizedResults.length.toString()
      },
      body: JSON.stringify(normalizedResults)
    };

  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Внутренняя ошибка сервера',
        details: error.message
      })
    };
  }
};

// ==================== НОРМАЛИЗАЦИЯ РЕЗУЛЬТАТОВ ====================
function normalizeResults(rawResults) {
  const normalized = [];

  console.log('🔄 Нормализация результатов:', {
    rawResultsCount: rawResults?.length,
    firstItemType: rawResults?.[0] ? typeof rawResults[0] : 'undefined',
    firstItemIsArray: rawResults?.[0] ? Array.isArray(rawResults[0]) : false
  });

  if (!rawResults || rawResults.length === 0) {
    console.log('⚠️ normalizeResults: пустой массив результатов');
    return normalized;
  }

  // КРИТИЧНО: Логируем первые 3 элемента для диагностики
  console.log('🔍 ДИАГНОСТИКА: Первые 3 элемента rawResults:');
  for (let i = 0; i < Math.min(3, rawResults.length); i++) {
    console.log(`  [${i}]:`, {
      type: typeof rawResults[i],
      isArray: Array.isArray(rawResults[i]),
      value: rawResults[i],
      keys: typeof rawResults[i] === 'object' && !Array.isArray(rawResults[i]) 
        ? Object.keys(rawResults[i]) 
        : 'not an object'
    });
  }

  const firstItem = rawResults[0];
  
  // Случай A: Массив объектов {kind: "daily", video_name: "..."}
  if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
    console.log('✅ ФОРМАТ A: Массив объектов');
    console.log('📋 Пример объекта:', firstItem);
    
    let processedCount = 0;
    rawResults.forEach((row, index) => {
      if (!row.video_name) {
        console.warn(`⚠️ Строка ${index} не содержит video_name:`, row);
        return;
      }
      
      // 🔥🔥🔥 КРИТИЧЕСКАЯ ДИАГНОСТИКА
      const cost_from_sources_raw = row.cost_from_sources;
      const clicks_on_link_raw = row.clicks_on_link;
      const cost_from_sources_converted = Number(cost_from_sources_raw) || 0;
      const clicks_on_link_converted = Number(clicks_on_link_raw) || 0;
      
      if (processedCount < 3) {
        console.log(`🔥🔥🔥 NETLIFY NORMALIZE ROW ${processedCount}:`, {
          'row.cost_from_sources (RAW)': cost_from_sources_raw,
          'row.clicks_on_link (RAW)': clicks_on_link_raw,
          'typeof cost_from_sources': typeof cost_from_sources_raw,
          'typeof clicks_on_link': typeof clicks_on_link_raw,
          'Number(cost_from_sources)': cost_from_sources_converted,
          'Number(clicks_on_link)': clicks_on_link_converted,
          'video_name': row.video_name
        });
      }
      
      normalized.push({
        kind: row.kind || 'daily',
        video_name: row.video_name,
        adv_date: row.adv_date || null,
        leads: Number(row.leads) || 0,
        cost: Number(row.cost) || 0,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        avg_duration: Number(row.avg_duration) || 0,
        cost_from_sources: cost_from_sources_converted,
        clicks_on_link: clicks_on_link_converted
      });
      processedCount++;
    });
    
    console.log(`✅ Формат A: обработано ${processedCount} объектов`);
    return normalized;
  }
  
  // Случай B: Массив массивов [[headers], [row1], [row2], ...]
  if (firstItem && Array.isArray(firstItem)) {
    console.log('✅ ФОРМАТ B: Массив массивов');
    
    // КРИТИЧНО: Проверяем, все ли элементы - массивы
    const allArrays = rawResults.every(item => Array.isArray(item));
    console.log('🔍 Все элементы - массивы?', allArrays);
    
    if (!allArrays) {
      console.error('❌ НЕ ВСЕ элементы - массивы!');
      // Пробуем обработать как смешанный формат
      return normalized;
    }
    
    // Первый массив должен быть headers
    const headers = rawResults[0];
    console.log('📋 HEADERS:', headers);
    console.log('📋 HEADERS тип:', typeof headers, 'длина:', headers?.length);
    
    // Проверяем наличие обязательных полей
    const hasVideoName = headers.includes('video_name');
    const hasKind = headers.includes('kind');
    
    console.log('🔍 Проверка headers:', {
      hasVideoName,
      hasKind,
      headers
    });
    
    if (!hasVideoName && !hasKind) {
      console.error('❌ Headers не содержат обязательных полей!');
      // Возможно, это не headers, а данные
      console.log('🔍 Пробуем интерпретировать все элементы как данные (без headers)');
      
      // Предполагаем фиксированный порядок колонок: [kind, video_name, adv_date, leads, cost, clicks, impressions, avg_duration]
      const assumedHeaders = ['kind', 'video_name', 'adv_date', 'leads', 'cost', 'clicks', 'impressions', 'avg_duration'];
      
      rawResults.forEach((row, index) => {
        if (!Array.isArray(row)) {
          console.warn(`⚠️ Строка ${index} не массив:`, row);
          return;
        }
        
        const obj = {};
        assumedHeaders.forEach((header, i) => {
          obj[header] = row[i];
        });
        
        if (!obj.video_name) {
          console.warn(`⚠️ Строка ${index} не содержит video_name после маппинга:`, obj);
          return;
        }
        
        normalized.push({
          kind: obj.kind || 'daily',
          video_name: obj.video_name,
          adv_date: obj.adv_date || null,
          leads: Number(obj.leads) || 0,
          cost: Number(obj.cost) || 0,
          clicks: Number(obj.clicks) || 0,
          impressions: Number(obj.impressions) || 0,
          avg_duration: Number(obj.avg_duration) || 0,
          cost_from_sources: Number(obj.cost_from_sources) || 0,
          clicks_on_link: Number(obj.clicks_on_link) || 0
        });
      });
      
      console.log(`✅ Формат B (без headers): обработано ${normalized.length} строк`);
      return normalized;
    }
    
    // Стандартная обработка с headers
    const dataRows = rawResults.slice(1);
    console.log(`📊 Обработка ${dataRows.length} строк данных после headers`);
    
    if (dataRows.length === 0) {
      console.warn('⚠️ Нет строк данных после headers!');
      return normalized;
    }
    
    // Логируем первую строку данных
    console.log('📋 Первая строка данных:', dataRows[0]);
    
    let processedCount = 0;
    dataRows.forEach((row, index) => {
      if (!Array.isArray(row)) {
        console.warn(`⚠️ Строка ${index} не массив:`, row);
        return;
      }
      
      // Создаем объект из headers и row
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      
      // КРИТИЧНО: Проверяем наличие video_name
      if (!obj.video_name) {
        console.warn(`⚠️ Строка ${index} не содержит video_name:`, {
          row,
          obj,
          headers
        });
        return;
      }
      
      normalized.push({
        kind: obj.kind || 'daily',
        video_name: obj.video_name,
        adv_date: obj.adv_date || null,
        leads: Number(obj.leads) || 0,
        cost: Number(obj.cost) || 0,
        clicks: Number(obj.clicks) || 0,
        impressions: Number(obj.impressions) || 0,
        avg_duration: Number(obj.avg_duration) || 0,
        cost_from_sources: Number(obj.cost_from_sources) || 0,
        clicks_on_link: Number(obj.clicks_on_link) || 0
      });
      processedCount++;
    });
    
    console.log(`✅ Формат B: обработано ${processedCount} из ${dataRows.length} строк`);
    return normalized;
  }
  
  console.error('❌ НЕИЗВЕСТНЫЙ ФОРМАТ! Первый элемент:', firstItem);
  return normalized;
}
