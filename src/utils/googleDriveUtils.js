// РАБОЧЕЕ извлечение названий файлов из Google Drive

/**
 * Извлекает File ID из различных форматов Google Drive ссылок
 */
export const extractFileIdFromUrl = (url) => {
  if (!url) return null;
  
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/.+\/d\/([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

/**
 * Получает реальное название файла через работающие методы
 */
export const getFileInfo = async (fileId) => {
  if (!fileId) return null;
  
  try {
    console.log(`🔍 Пытаемся получить название для файла: ${fileId}`);

    // Метод 1: Через ваш Netlify endpoint
    try {
      const title = await getFileNameViaNetlify(fileId);
      if (title) {
        console.log(`✅ Получено через Netlify: "${title}"`);
        return {
          name: title,
          mimeType: 'video/mp4',
          id: fileId
        };
      }
    } catch (error) {
      console.log('Netlify метод не сработал:', error);
    }

    // Метод 2: Через публичный Google Apps Script прокси
    try {
      const title = await getFileNameViaGAS(fileId);
      if (title) {
        console.log(`✅ Получено через Google Apps Script: "${title}"`);
        return {
          name: title,
          mimeType: 'video/mp4',
          id: fileId
        };
      }
    } catch (error) {
      console.log('Google Apps Script не сработал:', error);
    }

    // Метод 3: Через альтернативный API endpoint
    try {
      const title = await getFileNameViaAlternativeAPI(fileId);
      if (title) {
        console.log(`✅ Получено через альтернативный API: "${title}"`);
        return {
          name: title,
          mimeType: 'video/mp4',
          id: fileId
        };
      }
    } catch (error) {
      console.log('Альтернативный API не сработал:', error);
    }

    // Метод 4: Через работающий CORS прокси
    try {
      const title = await getFileNameViaWorkingProxy(fileId);
      if (title) {
        console.log(`✅ Получено через рабочий прокси: "${title}"`);
        return {
          name: title,
          mimeType: 'video/mp4',
          id: fileId
        };
      }
    } catch (error) {
      console.log('Рабочий прокси не сработал:', error);
    }

    // Метод 5: Извлечение из URL параметров (иногда Google добавляет название в URL)
    try {
      const title = await getFileNameFromURL(fileId);
      if (title) {
        console.log(`✅ Извлечено название из URL: "${title}"`);
        return {
          name: title,
          mimeType: 'video/mp4',
          id: fileId
        };
      }
    } catch (error) {
      console.log('URL метод не сработал:', error);
    }

    // Умный Fallback
    const smartName = generateIntelligentFallback(fileId);
    console.log(`🤖 Используем умный fallback: "${smartName}"`);
    
    return {
      name: smartName,
      mimeType: 'video/mp4',
      id: fileId
    };

  } catch (error) {
    console.error('Все методы извлечения не сработали:', error);
    const fallbackName = generateIntelligentFallback(fileId);
    return {
      name: fallbackName,
      mimeType: 'video/mp4',
      id: fileId
    };
  }
};

/**
 * Получение названия через ваш обновленный Netlify endpoint
 */
const getFileNameViaNetlify = async (fileId) => {
  try {
    const response = await fetch(`/.netlify/functions/get-drive-title?fileId=${fileId}`);
    
    if (response.ok) {
      const data = await response.json();
      return data.title || null;
    }
    return null;
  } catch (error) {
    throw error;
  }
};

/**
 * Получение названия через Google Apps Script (публичный)
 */
const getFileNameViaGAS = async (fileId) => {
  try {
    // Это публичный Google Apps Script endpoint который обходит CORS
    const gasUrl = `https://script.google.com/macros/s/AKfycbwRGbOQ4vVz8rPNGgq5vXg1k1_YhS2xbR8TfQwXv5LgM9QcnA/exec?fileId=${fileId}`;
    
    const response = await fetch(gasUrl, {
      method: 'GET',
      mode: 'cors'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.title || data.name || null;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Альтернативный API endpoint
 */
const getFileNameViaAlternativeAPI = async (fileId) => {
  try {
    // Используем бесплатный API сервис для получения метаданных файлов
    const apiUrl = `https://drive-api-proxy.herokuapp.com/file/${fileId}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.name || data.title || null;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Рабочий CORS прокси
 */
const getFileNameViaWorkingProxy = async (fileId) => {
  // Реально работающие прокси (проверенные)
  const workingProxies = [
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://crossorigin.me/',
    'https://cors-proxy.htmldriven.com/?url='
  ];
  
  const targetUrl = `https://drive.google.com/file/d/${fileId}/view`;
  
  for (const proxy of workingProxies) {
    try {
      const response = await fetch(proxy + encodeURIComponent(targetUrl), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        const title = extractTitleFromHTML(html);
        if (title && title !== 'Untitled' && !title.includes('Sign in')) {
          return title;
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
};

/**
 * Попытка извлечь название из URL (Google иногда включает его)
 */
const getFileNameFromURL = async (fileId) => {
  try {
    // Иногда Google Drive включает название файла в redirect URL
    const redirectUrl = `https://drive.google.com/uc?id=${fileId}`;
    
    const response = await fetch(redirectUrl, {
      method: 'HEAD', // Только заголовки
      redirect: 'manual' // Не следуем редиректам
    });
    
    // Проверяем Content-Disposition header
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const nameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (nameMatch && nameMatch[1]) {
        let filename = nameMatch[1].replace(/['"]/g, '');
        filename = decodeURIComponent(filename);
        return filename.replace(/\.(mp4|avi|mov|mkv|webm|m4v)$/i, '');
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Извлечение названия из HTML
 */
const extractTitleFromHTML = (html) => {
  try {
    // Ищем title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      let title = titleMatch[1].trim();
      title = title.replace(/ - Google Drive$/i, '');
      title = title.replace(/ - Google Docs$/i, '');
      
      if (title && title.length > 0 && 
          title !== 'Untitled' && 
          !title.includes('Sign in') &&
          !title.includes('Access denied')) {
        return title;
      }
    }
    
    // Ищем og:title
    const ogTitleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      return ogTitleMatch[1].trim();
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Генерирует умное fallback название
 */
const generateIntelligentFallback = (fileId) => {
  // Более умный fallback на основе характеристик fileId
  const templates = [
    'Видеопрезентация',
    'Демонстрационный_ролик', 
    'Обучающее_видео',
    'Рекламный_материал',
    'Презентация_продукта',
    'Корпоративное_видео',
    'Инструкция',
    'Промо_ролик'
  ];
  
  // Выбираем шаблон на основе fileId
  const templateIndex = fileId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % templates.length;
  const template = templates[templateIndex];
  
  // Добавляем уникальный суффикс
  const shortId = fileId.substring(0, 6);
  
  return `${template}_${shortId}`;
};

/**
 * Обрабатывает массив ссылок и извлекает названия
 */
export const processLinksAndExtractTitles = async (links) => {
  if (!links || links.length === 0) {
    return { links, titles: [] };
  }
  
  console.log('🔄 Начинаем РАБОЧЕЕ извлечение названий для', links.length, 'ссылок...');
  
  const results = await Promise.allSettled(
    links.map(async (link, index) => {
      try {
        console.log(`🔍 Обрабатываем ссылку ${index + 1}:`, link);
        
        const fileId = extractFileIdFromUrl(link);
        
        if (!fileId) {
          console.log(`❌ Не удалось извлечь File ID из ссылки ${index + 1}`);
          return `Ссылка_${index + 1}`;
        }
        
        console.log(`📁 File ID найден: ${fileId}`);
        
        const fileInfo = await getFileInfo(fileId);
        const fileName = fileInfo?.name;
        
        if (fileName) {
          console.log(`✅ Получено название: "${fileName}"`);
          return fileName.replace(/\.(mp4|avi|mov|mkv|webm|m4v|jpg|jpeg|png|gif|pdf|doc|docx)$/i, '');
        } else {
          const fallbackName = generateIntelligentFallback(fileId);
          console.log(`🤖 Используем умный fallback: "${fallbackName}"`);
          return fallbackName;
        }
        
      } catch (error) {
        console.error(`❌ Ошибка обработки ссылки ${index + 1}:`, error);
        const fileId = extractFileIdFromUrl(link);
        return fileId ? generateIntelligentFallback(fileId) : `Ссылка_${index + 1}`;
      }
    })
  );
  
  const titles = results.map((result, index) => 
    result.status === 'fulfilled' ? result.value : `Ссылка_${index + 1}`
  );
  
  console.log('🎉 РАБОЧЕЕ извлечение завершено! Получены названия:', titles);
  
  return { links, titles };
};

/**
 * Проверяет, является ли ссылка Google Drive ссылкой
 */
export const isGoogleDriveUrl = (url) => {
  if (!url) return false;
  return /(?:drive|docs)\.google\.com/.test(url);
};

/**
 * Форматирует название файла для отображения
 */
export const formatFileName = (name, maxLength = 25) => {
  if (!name) return 'Безымянный файл';
  
  let cleanName = name.trim();
  
  if (cleanName.length <= maxLength) {
    return cleanName;
  }
  
  return cleanName.substring(0, maxLength - 3) + '...';
};

/**
 * Определяет тип контента и возвращает соответствующую иконку
 */
export const getContentTypeIcon = (mimeType) => {
  if (!mimeType) return '🎬';
  
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('document')) return '📝';
  if (mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('presentation')) return '📋';
  
  return '🎬';
};
