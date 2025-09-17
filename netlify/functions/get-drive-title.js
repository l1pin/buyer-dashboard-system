// Netlify функция для извлечения названий Google Drive файлов

exports.handler = async (event, context) => {
  // Разрешаем CORS для всех доменов
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  try {
    // Получаем fileId из параметров запроса
    const fileId = event.queryStringParameters?.fileId;
    
    if (!fileId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'fileId parameter is required',
          title: null 
        })
      };
    }

    console.log('🔍 Извлекаем название для File ID:', fileId);

    // Метод 1: Прямой запрос к Google Drive API
    let title = await getFileNameViaAPI(fileId);
    
    if (title) {
      console.log('✅ Получено через API:', title);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          title: title,
          method: 'api',
          fileId: fileId 
        })
      };
    }

    // Метод 2: Через HTML парсинг
    title = await getFileNameViaHTML(fileId);
    
    if (title) {
      console.log('✅ Получено через HTML парсинг:', title);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          title: title,
          method: 'html',
          fileId: fileId 
        })
      };
    }

    // Метод 3: Через oEmbed
    title = await getFileNameViaOEmbed(fileId);
    
    if (title) {
      console.log('✅ Получено через oEmbed:', title);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          title: title,
          method: 'oembed',
          fileId: fileId 
        })
      };
    }

    // Если ничего не сработало
    console.log('❌ Не удалось извлечь название, возвращаем null');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        title: null,
        method: 'none',
        fileId: fileId,
        message: 'Could not extract title'
      })
    };

  } catch (error) {
    console.error('❌ Ошибка в функции:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        title: null 
      })
    };
  }
};

/**
 * Получение названия через Google Drive API
 */
async function getFileNameViaAPI(fileId) {
  try {
    // Пробуем несколько публичных API ключей
    const apiKeys = [
      'AIzaSyDi9tJUzxU1Db6rIV3NkWs1LnlHoY1nXKQ', // Публичный ключ 1
      'AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI', // Публичный ключ 2
      'AIzaSyDLLdXzzRk7FgqG6lM6Y8bPhQztP3iLgzs'  // Публичный ключ 3
    ];

    for (const apiKey of apiKeys) {
      try {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name&key=${apiKey}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NetlifyBot/1.0)'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.name) {
            return data.name;
          }
        } else if (response.status === 403) {
          console.log(`API ключ ${apiKey} исчерпан или недействителен`);
          continue;
        }
      } catch (error) {
        console.log(`Ошибка с API ключом ${apiKey}:`, error.message);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Ошибка в getFileNameViaAPI:', error);
    return null;
  }
}

/**
 * Получение названия через HTML парсинг
 */
async function getFileNameViaHTML(fileId) {
  try {
    const url = `https://drive.google.com/file/d/${fileId}/view`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return extractTitleFromHTML(html);

  } catch (error) {
    console.error('Ошибка в getFileNameViaHTML:', error);
    return null;
  }
}

/**
 * Получение названия через oEmbed API
 */
async function getFileNameViaOEmbed(fileId) {
  try {
    const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const oembedUrl = `https://docs.google.com/oembed?url=${encodeURIComponent(driveUrl)}&format=json`;
    
    const response = await fetch(oembedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NetlifyBot/1.0)'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.title || null;
    }

    return null;
  } catch (error) {
    console.error('Ошибка в getFileNameViaOEmbed:', error);
    return null;
  }
}

/**
 * Извлечение названия из HTML
 */
function extractTitleFromHTML(html) {
  try {
    // Ищем title tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      let title = titleMatch[1].trim();
      
      // Убираем " - Google Drive" и подобные суффиксы
      title = title.replace(/ - Google Drive$/i, '');
      title = title.replace(/ - Google Docs$/i, '');
      title = title.replace(/ - Google Sheets$/i, '');
      title = title.replace(/ - Google Slides$/i, '');
      
      if (title && 
          title.length > 0 && 
          title !== 'Untitled' && 
          !title.includes('Sign in') &&
          !title.includes('Access denied') &&
          !title.includes('Error')) {
        return title;
      }
    }

    // Ищем og:title meta tag
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      const title = ogTitleMatch[1].trim();
      if (title && title !== 'Untitled') {
        return title;
      }
    }

    // Ищем в data-title атрибутах
    const dataTitleMatch = html.match(/data-title=["']([^"']+)["']/i);
    if (dataTitleMatch && dataTitleMatch[1]) {
      return dataTitleMatch[1].trim();
    }

    // Ищем в JSON-LD структурированных данных
    const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        if (jsonData.name) {
          return jsonData.name;
        }
      } catch (e) {
        // Игнорируем ошибки парсинга JSON
      }
    }

    return null;
  } catch (error) {
    console.error('Ошибка в extractTitleFromHTML:', error);
    return null;
  }
}
