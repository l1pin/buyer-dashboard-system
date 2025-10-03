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
  FETCH_TIMEOUT_MS: 15000,       // 15 секунд на один SQL-запрос
  MAX_RETRIES: 2,                // Количество повторов при ошибках
  RETRY_DELAY_MS: 1000,          // Базовая задержка для экспоненциального бэкофа
  
  // Кэширование
  CACHE_TTL_MS: 90000,           // 90 секунд TTL для кэша
  CACHE_MAX_SIZE: 100,           // Максимум записей в LRU кэше
  
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

  static buildBatchSQL(videoNames, dateFrom = null, dateTo = null, kind = 'daily') {
    if (!videoNames || videoNames.length === 0) {
      throw new Error('videoNames не может быть пустым');
    }

    // VALUES список для video_list CTE
    const valuesClause = videoNames
      .map(name => `('${this.escapeString(name)}')`)
      .join(',\n    ');

    // Фильтр по датам
    let dateFilter = '';
    if (dateFrom && dateTo) {
      dateFilter = `AND t.adv_date >= '${this.escapeString(dateFrom)}' 
      AND t.adv_date <= '${this.escapeString(dateTo)}'`;
    }

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
    return `
WITH video_list(name) AS (
  VALUES 
    ${valuesClause}
)
SELECT 
  'daily' as kind,
  t.video_name,
  t.adv_date,
  COALESCE(SUM(t.valid), 0) AS leads,
  COALESCE(SUM(t.cost), 0) AS cost,
  COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
  COALESCE(SUM(t.showed), 0) AS impressions,
  COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration
FROM ads_collection t
INNER JOIN video_list v ON v.name = t.video_name
WHERE (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
  ${dateFilter}
GROUP BY t.video_name, t.adv_date
ORDER BY t.video_name, t.adv_date`;
  }

  static _buildFirst4SQL(valuesClause, dateFilter) {
    return `
WITH video_list(name) AS (
  VALUES 
    ${valuesClause}
),
daily_data AS (
  SELECT 
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration
  FROM ads_collection t
  INNER JOIN video_list v ON v.name = t.video_name
  WHERE (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
),
ranked_daily AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY video_name ORDER BY adv_date ASC) as rn
  FROM daily_data
)
SELECT 
  'first4' as kind,
  video_name,
  NULL as adv_date,
  SUM(leads) as leads,
  SUM(cost) as cost,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  AVG(avg_duration) as avg_duration
FROM ranked_daily
WHERE rn <= 4
GROUP BY video_name
ORDER BY video_name`;
  }

  static _buildTotalSQL(valuesClause, dateFilter) {
    return `
WITH video_list(name) AS (
  VALUES 
    ${valuesClause}
),
daily_data AS (
  SELECT 
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration
  FROM ads_collection t
  INNER JOIN video_list v ON v.name = t.video_name
  WHERE (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
)
SELECT 
  'total' as kind,
  video_name,
  NULL as adv_date,
  SUM(leads) as leads,
  SUM(cost) as cost,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  AVG(avg_duration) as avg_duration
FROM daily_data
GROUP BY video_name
ORDER BY video_name`;
  }

  static _buildDailyFirst4TotalSQL(valuesClause, dateFilter) {
    return `
WITH video_list(name) AS (
  VALUES 
    ${valuesClause}
),
daily_data AS (
  SELECT 
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration
  FROM ads_collection t
  INNER JOIN video_list v ON v.name = t.video_name
  WHERE (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
),
ranked_daily AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY video_name ORDER BY adv_date ASC) as rn
  FROM daily_data
),
first4_data AS (
  SELECT 
    video_name,
    NULL as adv_date,
    SUM(leads) as leads,
    SUM(cost) as cost,
    SUM(clicks) as clicks,
    SUM(impressions) as impressions,
    AVG(avg_duration) as avg_duration
  FROM ranked_daily
  WHERE rn <= 4
  GROUP BY video_name
),
total_data AS (
  SELECT 
    video_name,
    NULL as adv_date,
    SUM(leads) as leads,
    SUM(cost) as cost,
    SUM(clicks) as clicks,
    SUM(impressions) as impressions,
    AVG(avg_duration) as avg_duration
  FROM daily_data
  GROUP BY video_name
)
SELECT 'daily' as kind, video_name, adv_date, leads, cost, clicks, impressions, avg_duration FROM daily_data
UNION ALL
SELECT 'first4' as kind, video_name, adv_date, leads, cost, clicks, impressions, avg_duration FROM first4_data
UNION ALL
SELECT 'total' as kind, video_name, adv_date, leads, cost, clicks, impressions, avg_duration FROM total_data
ORDER BY video_name, kind, adv_date`;
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
async function fetchWithRetry(sql, retries = CONFIG.MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

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

      if (!response.ok) {
        // На 502/504 делаем ретрай
        if ((response.status === 502 || response.status === 504) && attempt < retries) {
          const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(`⚠️ ${response.status}, ретрай ${attempt + 1}/${retries} через ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        return [];
      }

      return JSON.parse(text);
      
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

  async processChunks(chunks, dateFrom, dateTo, kind) {
    const results = [];
    const queue = [...chunks];
    let processed = 0;

    console.log(`🚀 Запуск пула: ${chunks.length} чанков, параллелизм ${this.concurrency}`);

    const workers = [];
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(this._worker(queue, dateFrom, dateTo, kind, results, processed, chunks.length));
    }

    await Promise.allSettled(workers);
    
    console.log(`✅ Пул завершён: обработано ${results.length} чанков`);
    
    // Объединяем результаты
    return results.flat();
  }

  async _worker(queue, dateFrom, dateTo, kind, results, processed, total) {
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (!chunk) break;

      try {
        console.log(`📊 Обработка чанка ${++processed}/${total}, имён: ${chunk.length}`);
        
        const sql = SQLBuilder.buildBatchSQL(chunk, dateFrom, dateTo, kind);
        const data = await fetchWithRetry(sql);
        
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
    const { video_names, date_from, date_to, kind = 'daily' } = requestBody;

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

    // Проверка кэша
    const cacheKey = { video_names: video_names.sort(), date_from, date_to, kind };
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`💾 Кэш HIT для ${video_names.length} имён`);
      return {
        statusCode: 200,
        headers: { ...headers, 'X-Cache': 'HIT' },
        body: JSON.stringify(cached)
      };
    }

    console.log(`📡 Новый запрос: ${video_names.length} имён, kind=${kind}`);

    // Разбиваем на чанки
    const chunks = Chunker.splitIntoChunks(video_names, date_from, date_to, kind);
    console.log(`📦 Создано чанков: ${chunks.length}`);

    // Обрабатываем через пул воркеров
    const pool = new WorkerPool(CONFIG.PARALLEL_CHUNKS);
    const results = await pool.processChunks(chunks, date_from, date_to, kind);

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

  rawResults.forEach(result => {
    if (!result || result.length === 0) return;

    // Случай A: массив объектов
    if (typeof result[0] === 'object' && !Array.isArray(result[0])) {
      result.forEach(row => {
        normalized.push({
          kind: row.kind || 'daily',
          video_name: row.video_name,
          adv_date: row.adv_date || null,
          leads: Number(row.leads) || 0,
          cost: Number(row.cost) || 0,
          clicks: Number(row.clicks) || 0,
          impressions: Number(row.impressions) || 0,
          avg_duration: Number(row.avg_duration) || 0
        });
      });
    } 
    // Случай B: [headers, ...rows]
    else if (Array.isArray(result[0])) {
      const headers = result[0];
      const dataRows = result.slice(1);
      
      dataRows.forEach(row => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = row[i]));
        
        normalized.push({
          kind: obj.kind || 'daily',
          video_name: obj.video_name,
          adv_date: obj.adv_date || null,
          leads: Number(obj.leads) || 0,
          cost: Number(obj.cost) || 0,
          clicks: Number(obj.clicks) || 0,
          impressions: Number(obj.impressions) || 0,
          avg_duration: Number(obj.avg_duration) || 0
        });
      });
    }
  });

  // Сортировка для стабильности
  normalized.sort((a, b) => {
    if (a.video_name !== b.video_name) {
      return a.video_name.localeCompare(b.video_name);
    }
    if (a.kind !== b.kind) {
      const kindOrder = { daily: 1, first4: 2, total: 3 };
      return (kindOrder[a.kind] || 0) - (kindOrder[b.kind] || 0);
    }
    if (a.adv_date && b.adv_date) {
      return a.adv_date.localeCompare(b.adv_date);
    }
    return 0;
  });

  return normalized;
}
