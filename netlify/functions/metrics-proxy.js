// Создайте файл: netlify/functions/metrics-proxy.js

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Обработка preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Проверяем что это POST запрос
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Метод не поддерживается' })
    };
  }

  try {
    // Парсим тело запроса
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (e) {
      console.error('❌ Неверный JSON:', e);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Неверный JSON в теле запроса' })
      };
    }

    // Проверяем наличие SQL запроса
    if (!requestBody.sql) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'SQL запрос обязателен' })
      };
    }

    // Проверяем что это SELECT запрос (безопасность)
    if (!/^\s*select\b/i.test(requestBody.sql)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Разрешены только SELECT запросы' })
      };
    }

    console.log('🔍 Прокси запрос к API метрик:', {
      sql: requestBody.sql.substring(0, 100) + '...'
    });

    // URL API метрик
    const API_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

    // ПРАВИЛЬНАЯ реализация таймаута для fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд

    let apiResponse;
    try {
      // Отправляем запрос к API метрик с таймаутом
      apiResponse = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Netlify-Functions-Proxy/1.0'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Обработка различных типов ошибок fetch
      if (fetchError.name === 'AbortError') {
        console.error('⏱️ Таймаут запроса к API метрик');
        return {
          statusCode: 504,
          headers,
          body: JSON.stringify({ 
            error: 'Таймаут запроса к API метрик',
            details: 'API не ответил в течение 30 секунд'
          })
        };
      }
      
      console.error('🌐 Ошибка сети при обращении к API:', fetchError.message);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ 
          error: 'API метрик недоступен',
          details: fetchError.message
        })
      };
    }

    clearTimeout(timeoutId);

    // Читаем ответ
    let responseText;
    try {
      responseText = await apiResponse.text();
    } catch (readError) {
      console.error('📖 Ошибка чтения ответа:', readError);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ 
          error: 'Ошибка чтения ответа от API',
          details: readError.message
        })
      };
    }
    
    // Проверяем статус ответа
    if (!apiResponse.ok) {
      console.error('❌ Ошибка API метрик:', apiResponse.status, responseText);
      return {
        statusCode: apiResponse.status,
        headers,
        body: JSON.stringify({ 
          error: `API error: ${apiResponse.status}`,
          details: responseText.substring(0, 500)
        })
      };
    }

    // Проверяем что ответ не пустой
    if (!responseText || !responseText.trim()) {
      console.log('⚠️ Пустой ответ от API метрик');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([])
      };
    }

    // Пытаемся парсить JSON
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Неверный JSON от API метрик:', parseError.message);
      console.error('Первые 200 символов ответа:', responseText.substring(0, 200));
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ 
          error: 'Неверный JSON от API метрик',
          details: parseError.message,
          rawResponse: responseText.substring(0, 200)
        })
      };
    }

    // Проверяем на ошибки в ответе API
    if (jsonResponse && typeof jsonResponse === 'object' && jsonResponse.error) {
      console.error('❌ Ошибка от API метрик:', jsonResponse.error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Database error',
          details: jsonResponse.error
        })
      };
    }

    const recordCount = Array.isArray(jsonResponse) ? jsonResponse.length : 'не массив';
    console.log(`✅ Успешный ответ от API метрик, записей: ${recordCount}`);

    // Возвращаем успешный ответ
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(jsonResponse)
    };

  } catch (error) {
    console.error('💥 Критическая ошибка в прокси функции:', error);
    console.error('Stack trace:', error.stack);
    
    // Определяем тип ошибки для лучшего ответа
    let statusCode = 500;
    let errorMessage = 'Внутренняя ошибка сервера';

    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      statusCode = 504;
      errorMessage = 'Таймаут запроса к API метрик';
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      statusCode = 502;
      errorMessage = 'API метрик недоступен';
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({ 
        error: errorMessage,
        details: error.message,
        type: error.name
      })
    };
  }
};
