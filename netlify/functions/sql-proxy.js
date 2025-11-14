/**
 * Netlify Function для проксирования запросов к SQL API
 * Решает проблему CORS при обращении к api.trll-notif.com.ua
 */

const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

exports.handler = async (event, context) => {
  // Разрешаем только POST запросы
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Получаем SQL запрос из тела запроса
    const { sql } = JSON.parse(event.body);

    if (!sql) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'SQL query is required' })
      };
    }

    console.log('Проксирование SQL запроса:', sql.substring(0, 100) + '...');

    // Выполняем запрос к SQL API
    const response = await fetch(CORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    });

    const text = await response.text();

    console.log(`HTTP ${response.status}, ответ длиной ${text.length}`);

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
    console.error('Ошибка проксирования:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};
