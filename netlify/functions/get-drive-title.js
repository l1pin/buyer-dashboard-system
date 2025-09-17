// Обновленная Netlify функция с простым fallback
// Замените содержимое netlify/functions/get-drive-title.js

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

    console.log('Извлекаем название для File ID:', fileId);

    // Метод 1: Google Drive API v3 с вашими ключами
    let title = await getFileNameViaAPI(fileId);
    if (title && isValidTitle(title)) {
      console.log('✓ Получено через API:', title);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          title: cleanTitle(title),
          method: 'google-api',
          fileId: fileId 
        })
      };
    }

    // Метод 2: Content-Disposition
    title = await getFileNameViaHeaders(fileId);
    if (title && isValidTitle(title)) {
      console.log('✓ Получено через headers:', title);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          title: cleanTitle(title),
          method: 'content-disposition',
          fileId: fileId 
        })
      };
    }

    // Возвращаем null если не удалось извлечь название
    // Клиент сам решит, как назвать файл (Видео 1, Видео 2...)
    console.log('✗ Не удалось получить название для файла:', fileId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        title: null,
        method: 'not-found',
        fileId: fileId 
      })
    };

  } catch (error) {
    console.error('Ошибка в функции:', error);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        title: null,
        method: 'error',
        error: error.message,
        fileId: event.queryStringParameters?.fileId || 'unknown'
      })
    };
  }
};

/**
 * Google Drive API v3 с вашими ключами
 */
async function getFileNameViaAPI(fileId) {
  // ВАШИ API ключи
  const apiKeys = [
    'AIzaSyAgBZt6xX69phg8vD2NUcrXtsVCFxrVV1w',
    'AIzaSyDxrdk_ipzlUefe49uiEslMWt7laGdz4OU'
  ];

  for (const apiKey of apiKeys) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name&key=${apiKey}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        const data = await response.json();
        if (data.name) {
          return data.name;
        }
      } else if (response.status === 403) {
        continue; // Пробуем следующий ключ
      } else if (response.status === 404) {
        break; // Файл не найден, не пробуем другие ключи
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

/**
 * Content-Disposition метод
 */
async function getFileNameViaHeaders(fileId) {
  try {
    const response = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, {
      method: 'HEAD',
      redirect: 'manual'
    });
    
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const nameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (nameMatch && nameMatch[1]) {
        let filename = nameMatch[1].replace(/['"]/g, '');
        filename = decodeURIComponent(filename);
        return filename.replace(/\.(mp4|avi|mov|mkv|webm|m4v)$/i, '');
      }
    }
  } catch (error) {
    // Игнорируем ошибки
  }
  
  return null;
}

/**
 * Проверка валидности названия
 */
function isValidTitle(title) {
  if (!title || typeof title !== 'string') return false;
  
  const cleaned = title.trim();
  
  if (cleaned.length === 0 || cleaned.length > 300) return false;
  
  const invalidPatterns = [
    /^untitled$/i,
    /^без названия$/i,
    /sign in/i,
    /войти/i,
    /access denied/i,
    /error/i,
    /loading/i,
    /file not found/i,
    /not found/i
  ];

  return !invalidPatterns.some(pattern => pattern.test(cleaned));
}

/**
 * Очистка названия
 */
function cleanTitle(title) {
  if (!title) return title;
  
  let cleaned = title.trim();
  
  // Убираем расширения
  cleaned = cleaned.replace(/\.(mp4|avi|mov|mkv|webm|m4v|jpg|jpeg|png|gif|pdf|doc|docx)$/i, '');
  
  // Убираем лишние пробелы
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Убираем специальные символы в начале/конце
  cleaned = cleaned.replace(/^[-_\s]+|[-_\s]+$/g, '');
  
  return cleaned;
}
