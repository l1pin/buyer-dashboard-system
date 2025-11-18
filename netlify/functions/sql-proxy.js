/**
 * Netlify Function для проксирования запросов к SQL API
 * Решает проблему CORS при обращении к api.trll-notif.com.ua
 * ОПТИМИЗИРОВАНО для больших запросов с таймаутами и retry
 */

const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';
const MAX_RETRIES = 2; // Retry на стороне функции
const RETRY_DELAY = 1000; // 1 секунда между попытками
const FETCH_TIMEOUT = 24000; // 24 секунды (запас перед Netlify таймаутом 26сек)

// Вспомогательная функция задержки
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch с таймаутом
async function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

exports.handler = async (event, context) => {
  // Обработка CORS preflight запросов
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Разрешаем только POST запросы
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Получаем SQL запрос из тела запроса
    const { sql } = JSON.parse(event.body);

    if (!sql) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'SQL query is required' })
      };
    }

    console.log('📡 SQL запрос:', sql.substring(0, 150) + '...');

    // Пробуем выполнить запрос с retry
    let lastError = null;
    let response = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Попытка ${attempt + 1}/${MAX_RETRIES + 1}...`);
          await sleep(RETRY_DELAY * attempt);
        }

        response = await fetchWithTimeout(
          CORE_URL,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql })
          },
          FETCH_TIMEOUT
        );

        // Если получили ответ, выходим из цикла
        if (response.status === 200) {
          break;
        }

        // Если 500/502/503, пробуем ещё раз
        if ([500, 502, 503, 504].includes(response.status) && attempt < MAX_RETRIES) {
          console.warn(`⚠️ HTTP ${response.status}, повтор...`);
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }

        // Другие коды ошибок - возвращаем сразу
        break;

      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          console.warn(`⚠️ Ошибка: ${error.message}, повтор...`);
          continue;
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Не удалось выполнить запрос');
    }

    const text = await response.text();
    console.log(`✅ HTTP ${response.status}, ответ ${(text.length / 1024).toFixed(1)}KB`);

    // Возвращаем ответ с CORS заголовками
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: text
    };

  } catch (error) {
    console.error('❌ Ошибка проксирования:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        type: error.name
      })
    };
  }
};
