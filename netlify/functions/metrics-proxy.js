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
  FETCH_TIMEOUT_MS: 40000,       // 40 секунд на один SQL-запрос (для fuzzy)
  MAX_RETRIES: 1,                // Уменьшили количество повторов (не тратим время)
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

  /**
   * НОВАЯ ФУНКЦИЯ: Парсинг структуры названия видео
   * Извлекает артикул, дату, расширение
   * Примеры:
   * - Y02026 Набор для лепки 150825 VovaK 4x5.mp4
   * - Y01452-Мягкая игрушка 300925 Daria 4x5.mp4
   * - C01850 PL - Набір мисок (2шт.) 110925 DimaP v9_16.mp4
   */
  static parseVideoStructure(fileName) {
    if (!fileName) return null;
    
    const result = {
      original: fileName,
      article: null,
      date: null,
      format: null,      // НОВОЕ: 4x5, 9x16, 1x1
      suffix: null,      // НОВОЕ: bp, v, и т.д.
      extension: null,
      hasStructure: false
    };
    
    // АРТИКУЛ: Буква + 4-5 цифр в НАЧАЛЕ
    const articleMatch = fileName.match(/^([A-Z]\d{4,5})(?=[\s\-–—_])/i);
    if (articleMatch) {
      result.article = articleMatch[1].toUpperCase();
    }
    
    // ДАТА: 6 цифр между пробелами
    const dateMatch = fileName.match(/\s(\d{6})(?=\s)/);
    if (dateMatch) {
      result.date = dateMatch[1];
    }
    
    // ФОРМАТ: XxY (4x5, 9x16, 1x1 и т.д.) перед расширением
    const formatMatch = fileName.match(/(\d+x\d+)/i);
    if (formatMatch) {
      result.format = formatMatch[1].toLowerCase();
    }
    
    // СУФФИКС: bp, v, _v и т.д. после формата
    // Паттерн: пробел или _ затем 1-3 буквы перед расширением
    const suffixMatch = fileName.match(/[\s_](bp|v|_v|v_)[\s\.]?(?=\.[a-z]{3,4}$)/i);
    if (suffixMatch) {
      result.suffix = suffixMatch[1].toLowerCase().replace('_', '');
    }
    
    // РАСШИРЕНИЕ
    const extMatch = fileName.match(/\.(mp4|avi|mov|mkv|webm|m4v)$/i);
    if (extMatch) {
      result.extension = extMatch[0].toLowerCase();
    }
    
    result.hasStructure = !!(result.article && result.date && result.format);
    
    // ДИАГНОСТИКА
    if (result.hasStructure) {
      console.log(`✅ Полная структура: ${fileName} → article="${result.article}", date="${result.date}", format="${result.format}", suffix="${result.suffix}"`);
    } else {
      console.log(`⚠️ Неполная структура: ${fileName} → article=${result.article}, date=${result.date}, format=${result.format}`);
    }
    
    return result;
  }

  static estimateSQLSize(videoNames, dateFrom, dateTo, kind) {
    // Оценка размера SQL-запроса в байтах
    const baseQuery = 1500; // Базовый шаблон SQL
    const perName = 15;     // Средний размер на одно имя ('name'),
    const dateFilter = dateFrom && dateTo ? 100 : 0;
    const kindOverhead = kind === 'daily_first4_total' ? 1000 : 200;
    
    return baseQuery + (videoNames.length * perName) + dateFilter + kindOverhead;
  }

  static buildBatchSQL(videoNames, dateFrom = null, dateTo = null, kind = 'daily', fuzzySearch = false) {
    if (!videoNames || videoNames.length === 0) {
      throw new Error('videoNames не может быть пустым');
    }

    console.log('🔨 Формирование SQL для', videoNames.length, 'видео, kind:', kind, 'fuzzy:', fuzzySearch);
    console.log('📋 ВСЕ названия видео:');
    videoNames.forEach((name, i) => {
      console.log(`  [${i}]: "${name}"`);
    });

    // VALUES список для video_list CTE
    const valuesClause = videoNames
      .map(name => `('${this.escapeString(name)}')`)
      .join(',\n    ');
    
    console.log('📝 ПОЛНЫЙ VALUES clause:');
    console.log(valuesClause);

    // Фильтр по датам
    let dateFilter = '';
    if (dateFrom && dateTo) {
      dateFilter = `AND t.adv_date >= '${this.escapeString(dateFrom)}' 
      AND t.adv_date <= '${this.escapeString(dateTo)}'`;
    }

    // Выбираем шаблон SQL в зависимости от kind
    if (kind === 'daily_first4_total') {
      return this._buildDailyFirst4TotalSQL(valuesClause, dateFilter, fuzzySearch);
    } else if (kind === 'daily') {
      return this._buildDailySQL(valuesClause, dateFilter, fuzzySearch);
    } else if (kind === 'first4') {
      return this._buildFirst4SQL(valuesClause, dateFilter, fuzzySearch);
    } else if (kind === 'total') {
      return this._buildTotalSQL(valuesClause, dateFilter, fuzzySearch);
    } else {
      // По умолчанию - daily
      return this._buildDailySQL(valuesClause, dateFilter, fuzzySearch);
    }
  }

  static _buildDailySQL(valuesClause, dateFilter, fuzzySearch = false) {
    // НЕ используем replace - он удаляет скобки из названий видео!
    // Вместо этого извлекаем названия из VALUES и формируем IN напрямую
    const names = valuesClause.match(/'([^']|'')+'/g) || [];
    
    if (fuzzySearch) {
      // Для fuzzy search используем LIKE с % с обеих сторон
      const likeConditions = names.map(name => {
        // Убираем кавычки из имени и добавляем % с обеих сторон
        const cleanName = name.replace(/^'|'$/g, '');
        return `t.video_name LIKE '%${cleanName}%'`;
      }).join(' OR ');
      
      console.log('🔍 LIKE clause для daily (fuzzy):');
      console.log(likeConditions);
      
      return `
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
WHERE (${likeConditions})
  AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
  ${dateFilter}
GROUP BY t.video_name, t.adv_date
ORDER BY t.video_name, t.adv_date`;
    }
    
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
  COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration
FROM ads_collection t
WHERE t.video_name IN (${inClause})
  AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
  ${dateFilter}
GROUP BY t.video_name, t.adv_date
ORDER BY t.video_name, t.adv_date`;
  }

  static _buildFirst4SQL(valuesClause, dateFilter, fuzzySearch = false) {
    const names = valuesClause.match(/'([^']|'')+'/g) || [];
    
    let whereClause;
    if (fuzzySearch) {
      // УМНЫЙ КАСКАДНЫЙ ПОИСК по структуре видео
      const withStructure = [];
      const withoutStructure = [];
      
      names.forEach(name => {
        const cleanName = name.replace(/^'|'$/g, '');
        const parsed = this.parseVideoStructure(cleanName);
        
        if (parsed && parsed.hasStructure) {
          withStructure.push(parsed);
        } else {
          withoutStructure.push(cleanName);
        }
      });
      
      const conditions = [];
      
      // ПРИОРИТЕТ 1: Видео со структурой (артикул + дата + формат) - ТОЧНО
      if (withStructure.length > 0) {
        // Группируем по уникальной комбинации: артикул_дата_формат_суффикс
        const byUnique = new Map();
        
        withStructure.forEach(parsed => {
          // Создаём уникальный ключ с учётом ВСЕХ параметров
          const uniqueKey = `${parsed.article}_${parsed.date}_${parsed.format}_${parsed.suffix || 'none'}`;
          
          if (!byUnique.has(uniqueKey)) {
            byUnique.set(uniqueKey, []);
          }
          byUnique.get(uniqueKey).push(parsed);
        });
        
        byUnique.forEach((parsedList, uniqueKey) => {
          // Берём первый элемент (все в группе одинаковые)
          const parsed = parsedList[0];
          
          // Строим точное условие с учётом формата
          let condition = `(t.video_name LIKE '${this.escapeString(parsed.article)}%' AND t.video_name LIKE '% ${this.escapeString(parsed.date)} %'`;
          
          // Добавляем формат (ОБЯЗАТЕЛЬНО)
          if (parsed.format) {
            condition += ` AND t.video_name LIKE '%${this.escapeString(parsed.format)}%'`;
          }
          
          // Добавляем суффикс если есть
          if (parsed.suffix) {
            condition += ` AND t.video_name LIKE '%${this.escapeString(parsed.suffix)}%'`;
          }
          
          condition += ')';
          conditions.push(condition);
        });
      }
      
      // ПРИОРИТЕТ 2: Видео без структуры - fallback
      if (withoutStructure.length > 0) {
        const namesByLetter = new Map();
        
        withoutStructure.forEach(cleanName => {
          const articleMatch = cleanName.match(/^[A-Z]/);
          const letter = articleMatch ? articleMatch[0] : 'OTHER';
          
          if (!namesByLetter.has(letter)) {
            namesByLetter.set(letter, []);
          }
          namesByLetter.get(letter).push(cleanName);
        });
        
        const letterConditions = [];
        
        namesByLetter.forEach((namesGroup, letter) => {
          const likeList = namesGroup.map(n => `t.video_name LIKE '%${n}%'`).join(' OR ');
          
          if (letter !== 'OTHER') {
            letterConditions.push(`(t.video_name LIKE '${letter}%' AND (${likeList}))`);
          } else {
            letterConditions.push(`(${likeList})`);
          }
        });
        
        if (letterConditions.length > 0) {
          conditions.push(`(${letterConditions.join(' OR ')})`);
        }
      }
      
      whereClause = conditions.join(' OR ');
    } else {
      const inClause = names.join(',');
      whereClause = `t.video_name IN (${inClause})`;
    }
    
    return `
SELECT 
  'first4' as kind,
  video_name,
  NULL as adv_date,
  SUM(leads) as leads,
  SUM(cost) as cost,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  AVG(avg_duration) as avg_duration
FROM (
  SELECT 
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
    ROW_NUMBER() OVER (PARTITION BY t.video_name ORDER BY t.adv_date ASC) as rn
  FROM ads_collection t
  WHERE ${whereClause}
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) ranked_daily
WHERE rn <= 4
GROUP BY video_name
ORDER BY video_name`;
  }

  static _buildTotalSQL(valuesClause, dateFilter, fuzzySearch = false) {
    const names = valuesClause.match(/'([^']|'')+'/g) || [];
    
    let whereClause;
    if (fuzzySearch) {
      // УМНЫЙ КАСКАДНЫЙ ПОИСК по структуре видео
      const withStructure = [];
      const withoutStructure = [];
      
      names.forEach(name => {
        const cleanName = name.replace(/^'|'$/g, '');
        const parsed = this.parseVideoStructure(cleanName);
        
        if (parsed && parsed.hasStructure) {
          withStructure.push(parsed);
        } else {
          withoutStructure.push(cleanName);
        }
      });
      
      const conditions = [];
      
      // ПРИОРИТЕТ 1: Видео со структурой (артикул + дата + формат) - ТОЧНО
      if (withStructure.length > 0) {
        // Группируем по уникальной комбинации: артикул_дата_формат_суффикс
        const byUnique = new Map();
        
        withStructure.forEach(parsed => {
          // Создаём уникальный ключ с учётом ВСЕХ параметров
          const uniqueKey = `${parsed.article}_${parsed.date}_${parsed.format}_${parsed.suffix || 'none'}`;
          
          if (!byUnique.has(uniqueKey)) {
            byUnique.set(uniqueKey, []);
          }
          byUnique.get(uniqueKey).push(parsed);
        });
        
        byUnique.forEach((parsedList, uniqueKey) => {
          // Берём первый элемент (все в группе одинаковые)
          const parsed = parsedList[0];
          
          // Строим точное условие с учётом формата
          let condition = `(t.video_name LIKE '${this.escapeString(parsed.article)}%' AND t.video_name LIKE '% ${this.escapeString(parsed.date)} %'`;
          
          // Добавляем формат (ОБЯЗАТЕЛЬНО)
          if (parsed.format) {
            condition += ` AND t.video_name LIKE '%${this.escapeString(parsed.format)}%'`;
          }
          
          // Добавляем суффикс если есть
          if (parsed.suffix) {
            condition += ` AND t.video_name LIKE '%${this.escapeString(parsed.suffix)}%'`;
          }
          
          condition += ')';
          conditions.push(condition);
        });
      }
      
      // ПРИОРИТЕТ 2: Видео без структуры - fallback
      if (withoutStructure.length > 0) {
        const namesByLetter = new Map();
        
        withoutStructure.forEach(cleanName => {
          const articleMatch = cleanName.match(/^[A-Z]/);
          const letter = articleMatch ? articleMatch[0] : 'OTHER';
          
          if (!namesByLetter.has(letter)) {
            namesByLetter.set(letter, []);
          }
          namesByLetter.get(letter).push(cleanName);
        });
        
        const letterConditions = [];
        
        namesByLetter.forEach((namesGroup, letter) => {
          const likeList = namesGroup.map(n => `t.video_name LIKE '%${n}%'`).join(' OR ');
          
          if (letter !== 'OTHER') {
            letterConditions.push(`(t.video_name LIKE '${letter}%' AND (${likeList}))`);
          } else {
            letterConditions.push(`(${likeList})`);
          }
        });
        
        if (letterConditions.length > 0) {
          conditions.push(`(${letterConditions.join(' OR ')})`);
        }
      }
      
      whereClause = conditions.join(' OR ');
    } else {
      const inClause = names.join(',');
      whereClause = `t.video_name IN (${inClause})`;
    }
    
    return `
SELECT 
  'total' as kind,
  video_name,
  NULL as adv_date,
  SUM(leads) as leads,
  SUM(cost) as cost,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  AVG(avg_duration) as avg_duration
FROM (
  SELECT 
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration
  FROM ads_collection t
  WHERE ${whereClause}
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data
GROUP BY video_name
ORDER BY video_name`;
  }

  static _buildDailyFirst4TotalSQL(valuesClause, dateFilter, fuzzySearch = false) {
    const names = valuesClause.match(/'([^']|'')+'/g) || [];
    
    let whereClause;
    if (fuzzySearch) {
      // УМНЫЙ КАСКАДНЫЙ ПОИСК по структуре видео
      const withStructure = [];
      const withoutStructure = [];
      
      names.forEach(name => {
        const cleanName = name.replace(/^'|'$/g, '');
        const parsed = this.parseVideoStructure(cleanName);
        
        if (parsed && parsed.hasStructure) {
          withStructure.push(parsed);
        } else {
          withoutStructure.push(cleanName);
        }
      });
      
      const conditions = [];
      
      // ПРИОРИТЕТ 1: Видео со структурой (артикул + дата + формат) - ТОЧНО
      if (withStructure.length > 0) {
        // Группируем по уникальной комбинации: артикул_дата_формат_суффикс
        const byUnique = new Map();
        
        withStructure.forEach(parsed => {
          // Создаём уникальный ключ с учётом ВСЕХ параметров
          const uniqueKey = `${parsed.article}_${parsed.date}_${parsed.format}_${parsed.suffix || 'none'}`;
          
          if (!byUnique.has(uniqueKey)) {
            byUnique.set(uniqueKey, []);
          }
          byUnique.get(uniqueKey).push(parsed);
        });
        
        byUnique.forEach((parsedList, uniqueKey) => {
          // Берём первый элемент (все в группе одинаковые)
          const parsed = parsedList[0];
          
          // Строим точное условие с учётом формата
          let condition = `(t.video_name LIKE '${this.escapeString(parsed.article)}%' AND t.video_name LIKE '% ${this.escapeString(parsed.date)} %'`;
          
          // Добавляем формат (ОБЯЗАТЕЛЬНО)
          if (parsed.format) {
            condition += ` AND t.video_name LIKE '%${this.escapeString(parsed.format)}%'`;
          }
          
          // Добавляем суффикс если есть
          if (parsed.suffix) {
            condition += ` AND t.video_name LIKE '%${this.escapeString(parsed.suffix)}%'`;
          }
          
          condition += ')';
          conditions.push(condition);
        });
      }
      
      // ПРИОРИТЕТ 2: Видео без структуры - fallback
      if (withoutStructure.length > 0) {
        const namesByLetter = new Map();
        
        withoutStructure.forEach(cleanName => {
          const articleMatch = cleanName.match(/^[A-Z]/);
          const letter = articleMatch ? articleMatch[0] : 'OTHER';
          
          if (!namesByLetter.has(letter)) {
            namesByLetter.set(letter, []);
          }
          namesByLetter.get(letter).push(cleanName);
        });
        
        const letterConditions = [];
        
        namesByLetter.forEach((namesGroup, letter) => {
          const likeList = namesGroup.map(n => `t.video_name LIKE '%${n}%'`).join(' OR ');
          
          if (letter !== 'OTHER') {
            letterConditions.push(`(t.video_name LIKE '${letter}%' AND (${likeList}))`);
          } else {
            letterConditions.push(`(${likeList})`);
          }
        });
        
        if (letterConditions.length > 0) {
          conditions.push(`(${letterConditions.join(' OR ')})`);
        }
      }
      
      whereClause = conditions.join(' OR ');
    } else {
      const inClause = names.join(',');
      whereClause = `t.video_name IN (${inClause})`;
    }
    
    return `
SELECT 'daily' as kind, video_name, adv_date, leads, cost, clicks, impressions, avg_duration 
FROM (
  SELECT 
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration
  FROM ads_collection t
  WHERE ${whereClause}
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data
UNION ALL
SELECT 'first4' as kind, video_name, NULL as adv_date, SUM(leads) as leads, SUM(cost) as cost, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(avg_duration) as avg_duration
FROM (
  SELECT 
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration,
    ROW_NUMBER() OVER (PARTITION BY t.video_name ORDER BY t.adv_date ASC) as rn
  FROM ads_collection t
  WHERE ${whereClause}
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) ranked_daily
WHERE rn <= 4
GROUP BY video_name
UNION ALL
SELECT 'total' as kind, video_name, NULL as adv_date, SUM(leads) as leads, SUM(cost) as cost, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(avg_duration) as avg_duration
FROM (
  SELECT 
    t.video_name,
    t.adv_date,
    COALESCE(SUM(t.valid), 0) AS leads,
    COALESCE(SUM(t.cost), 0) AS cost,
    COALESCE(SUM(t.clicks_on_link_tracker), 0) AS clicks,
    COALESCE(SUM(t.showed), 0) AS impressions,
    COALESCE(AVG(t.average_time_on_video), 0) AS avg_duration
  FROM ads_collection t
  WHERE ${whereClause}
    AND (t.cost > 0 OR t.valid > 0 OR t.showed > 0 OR t.clicks_on_link_tracker > 0)
    ${dateFilter}
  GROUP BY t.video_name, t.adv_date
) daily_data2
GROUP BY video_name
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
      console.log('🔍 ОТПРАВКА К PHP API:');
      console.log('  📍 URL:', CONFIG.API_URL);
      console.log('  📋 SQL длина:', sql?.length, 'байт');
      console.log('  📋 SQL (первые 200 символов):', sql?.substring(0, 200));
      
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

  async processChunks(chunks, dateFrom, dateTo, kind, fuzzySearch = false) {
    const results = [];
    const queue = [...chunks];
    let processed = 0;

    console.log(`🚀 Запуск пула: ${chunks.length} чанков, параллелизм ${this.concurrency}`);

    const workers = [];
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(this._worker(queue, dateFrom, dateTo, kind, results, processed, chunks.length, fuzzySearch));
    }

    await Promise.allSettled(workers);
    
    console.log(`✅ Пул завершён: обработано ${results.length} чанков`);
    
    // Объединяем результаты
    return results.flat();
  }

  async _worker(queue, dateFrom, dateTo, kind, results, processed, total, fuzzySearch = false) {
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (!chunk) break;

      try {
        console.log(`📊 Обработка чанка ${++processed}/${total}, имён: ${chunk.length}`);
        console.log('📋 ВСЕ названия в чанке:');
        chunk.forEach((name, idx) => {
          console.log(`  [${idx}]: "${name}"`);
        });
        
        const sql = SQLBuilder.buildBatchSQL(chunk, dateFrom, dateTo, kind, fuzzySearch);
        console.log('🔍 SQL сформирован, длина:', sql.length, 'байт');
        console.log('=====================================');
        console.log('📝 ПОЛНЫЙ SQL:');
        console.log(sql);
        console.log('=====================================');
        
        console.log('🌐 Отправка SQL к PHP API...');
        const data = await fetchWithRetry(sql);
        
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
    const { video_names, date_from, date_to, kind = 'daily', fuzzy_search = false } = requestBody;

    console.log('🔍 ДИАГНОСТИКА ЗАПРОСА:');
    console.log('  📋 video_names тип:', typeof video_names, 'isArray:', Array.isArray(video_names));
    console.log('  📋 video_names длина:', video_names?.length);
    console.log('  📋 Первое название:', video_names?.[0]);
    console.log('  📋 Второе название:', video_names?.[1]);
    console.log('  📋 Третье название:', video_names?.[2]);
    console.log('  📋 date_from:', date_from);
    console.log('  📋 date_to:', date_to);
    console.log('  📋 kind:', kind);

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
    const results = await pool.processChunks(chunks, date_from, date_to, kind, fuzzy_search);

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
          avg_duration: Number(obj.avg_duration) || 0
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
        avg_duration: Number(obj.avg_duration) || 0
      });
      processedCount++;
    });
    
    console.log(`✅ Формат B: обработано ${processedCount} из ${dataRows.length} строк`);
    return normalized;
  }
  
  console.error('❌ НЕИЗВЕСТНЫЙ ФОРМАТ! Первый элемент:', firstItem);
  return normalized;
}
