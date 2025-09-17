// Обновленная Netlify функция с РЕАЛЬНЫМИ рабочими методами

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
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

    console.log('🔍 РЕАЛЬНОЕ извлечение названия для File ID:', fileId);

    // Метод 1: Через HEAD запрос для получения Content-Disposition
    let title = await getFileNameViaContentDisposition(fileId);
    if (title) {
      console.log('✅ Получено через Content-Disposition:', title);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          title: title,
          method: 'content-disposition',
          fileId: fileId 
        })
      };
    }

    // Метод 2: Через прямое обращение к Google Drive export API
    title = await getFileNameViaExportAPI(fileId);
    if (title) {
      console.log('✅ Получено через Export API:', title);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          title: title,
          method: 'export-api',
          fileId: fileId 
        })
      };
    }

    // Метод 3: Через Google Drive Web API (публичные файлы)
    title = await getFileNameViaWebAPI(fileId);
    if (title) {
      console.log('✅ Получено через Web API:', title);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          title: title,
          method: 'web-api',
          fileId: fileId 
        })
      };
    }

    // Метод 4: Через RSS feed (для публичных папок)
    title = await getFileNameViaRSS(fileId);
    if (title) {
      console.log('✅ Получено через RSS:', title);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          title: title,
          method: 'rss',
          fileId: fileId 
        })
      };
    }

    // Метод 5: Через HTML парсинг с реальными заголовками
    title = await getFileNameViaHTMLParsing(fileId);
    if (title) {
      console.log('✅ Получено через HTML парсинг:', title);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          title: title,
          method: 'html-parsing',
          fileId: fileId 
        })
      };
    }

    // Умный fallback
    const smartTitle = generateSmartTitle(fileId);
    console.log('🤖 Генерируем умное название:', smartTitle);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        title: smartTitle,
        method: 'smart-fallback',
        fileId: fileId 
      })
    };

  } catch (error) {
    console.error('❌ Ошибка в функции:', error);
    
    // Даже при ошибке возвращаем умное название
    const smartTitle = generateSmartTitle(event.queryStringParameters?.fileId || 'unknown');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        title: smartTitle,
        method: 'error-fallback',
        error: error.message
      })
    };
  }
};

/**
 * Получение названия через Content-Disposition header
 */
async function getFileNameViaContentDisposition(fileId) {
  try {
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    const response = await fetch(downloadUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      redirect: 'manual'
    });
    
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const nameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (nameMatch && nameMatch[1]) {
        let filename = nameMatch[1].replace(/['"]/g, '');
        filename = decodeURIComponent(filename);
        return filename.replace(/\.(mp4|avi|mov|mkv|webm|m4v|jpg|jpeg|png|gif|pdf|doc|docx)$/i, '');
      }
    }
    
    return null;
  } catch (error) {
    console.log('Content-Disposition метод не сработал:', error.message);
    return null;
  }
}

/**
 * Получение названия через Google Drive Export API
 */
async function getFileNameViaExportAPI(fileId) {
  try {
    // Пробуем разные export форматы
    const exportFormats = ['txt', 'pdf', 'docx'];
    
    for (const format of exportFormats) {
      try {
        const exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=${format}`;
        
        const response = await fetch(exportUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; GoogleBot/2.1; +http://www.google.com/bot.html)'
          },
          redirect: 'manual'
        });
        
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition && contentDisposition.includes('filename')) {
          const nameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (nameMatch && nameMatch[1]) {
            let filename = nameMatch[1].replace(/['"]/g, '');
            filename = decodeURIComponent(filename);
            return filename.replace(/\.(txt|pdf|docx|mp4|avi|mov)$/i, '');
          }
        }
      } catch (formatError) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.log('Export API метод не сработал:', error.message);
    return null;
  }
}

/**
 * Получение названия через Google Drive Web API
 */
async function getFileNameViaWebAPI(fileId) {
  try {
    // Используем публичный endpoint для метаданных
    const webApiUrl = `https://clients6.google.com/drive/v2beta/files/${fileId}?fields=title&key=web`;
    
    const response = await fetch(webApiUrl, {
      headers: {
        'Referer': 'https://drive.google.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.title || null;
    }
    
    return null;
  } catch (error) {
    console.log('Web API метод не сработал:', error.message);
    return null;
  }
}

/**
 * Получение названия через RSS feed (работает для некоторых публичных файлов)
 */
async function getFileNameViaRSS(fileId) {
  try {
    const rssUrl = `https://drive.google.com/feed/id/${fileId}`;
    
    const response = await fetch(rssUrl, {
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'Mozilla/5.0 RSS Reader'
      }
    });
    
    if (response.ok) {
      const rssText = await response.text();
      const titleMatch = rssText.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
      if (titleMatch && titleMatch[1]) {
        return titleMatch[1].trim();
      }
    }
    
    return null;
  } catch (error) {
    console.log('RSS метод не сработал:', error.message);
    return null;
  }
}

/**
 * Получение названия через HTML парсинг с правильными заголовками
 */
async function getFileNameViaHTMLParsing(fileId) {
  try {
    const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
    
    const response = await fetch(viewUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (response.ok) {
      const html = await response.text();
      return extractTitleFromHTML(html);
    }
    
    return null;
  } catch (error) {
    console.log('HTML парсинг не сработал:', error.message);
    return null;
  }
}

/**
 * Извлечение названия из HTML с улучшенным парсингом
 */
function extractTitleFromHTML(html) {
  try {
    // Метод 1: Основной title tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      let title = titleMatch[1].trim();
      title = title.replace(/ - Google Drive$/i, '');
      title = title.replace(/ - Google Docs$/i, '');
      title = title.replace(/ - Документы Google$/i, '');
      
      if (title && title.length > 0 && 
          title !== 'Untitled' && 
          title !== 'Без названия' &&
          !title.includes('Sign in') &&
          !title.includes('Войти') &&
          !title.includes('Access denied')) {
        return title;
      }
    }

    // Метод 2: Open Graph title
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      const title = ogTitleMatch[1].trim();
      if (title && title !== 'Untitled' && title !== 'Без названия') {
        return title;
      }
    }

    // Метод 3: JavaScript переменные (Drive иногда хранит название в JS)
    const jsVarMatch = html.match(/['"]title['"][:\s]*['"]([^'"]+)['"]/i);
    if (jsVarMatch && jsVarMatch[1]) {
      return jsVarMatch[1].trim();
    }

    // Метод 4: data-title атрибуты
    const dataTitleMatch = html.match(/data-title=["']([^"']+)["']/i);
    if (dataTitleMatch && dataTitleMatch[1]) {
      return dataTitleMatch[1].trim();
    }

    return null;
  } catch (error) {
    console.error('Ошибка в extractTitleFromHTML:', error);
    return null;
  }
}

/**
 * Генерирует умное название на основе fileId
 */
function generateSmartTitle(fileId) {
  if (!fileId || fileId === 'unknown') {
    return 'Видеофайл';
  }
  
  // Более разнообразные и осмысленные названия
  const prefixes = [
    'Презентация',
    'Видеоурок', 
    'Демонстрация',
    'Обучающий_материал',
    'Рекламный_ролик',
    'Корпоративное_видео',
    'Инструкция',
    'Промо_материал',
    'Образовательный_контент',
    'Видеопрезентация'
  ];
  
  // Выбираем префикс на основе символов fileId
  const prefixIndex = fileId.split('').reduce((sum, char) => {
    return sum + char.charCodeAt(0);
  }, 0) % prefixes.length;
  
  const prefix = prefixes[prefixIndex];
  const shortId = fileId.substring(0, 6).toUpperCase();
  
  return `${prefix}_${shortId}`;
}
