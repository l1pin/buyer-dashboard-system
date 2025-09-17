// Реальное извлечение названий файлов из Google Drive

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
 * Получает реальное название файла через метаданные Google Drive
 */
export const getFileInfo = async (fileId) => {
  if (!fileId) return null;
  
  try {
    // Метод 1: Через публичный API метаданных
    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType&key=AIzaSyC5MtQgTJvY9cZj8ggKhK5W3YqK1X2JH4k`;
    
    try {
      const response = await fetch(metadataUrl);
      if (response.ok) {
        const data = await response.json();
        return {
          name: data.name,
          mimeType: data.mimeType || 'video/mp4',
          id: fileId
        };
      }
    } catch (apiError) {
      console.log('API метод не сработал, пробуем альтернативный:', apiError);
    }

    // Метод 2: Через oEmbed API
    try {
      const title = await getFileNameViaOEmbed(fileId);
      if (title) {
        return {
          name: title,
          mimeType: 'video/mp4',
          id: fileId
        };
      }
    } catch (oembedError) {
      console.log('oEmbed не сработал:', oembedError);
    }

    // Метод 3: Через прямое обращение к метаданным (JSONP)
    try {
      const title = await getFileNameViaJSONP(fileId);
      if (title) {
        return {
          name: title,
          mimeType: 'video/mp4',
          id: fileId
        };
      }
    } catch (jsonpError) {
      console.log('JSONP не сработал:', jsonpError);
    }

    // Метод 4: Парсинг через прокси
    try {
      const title = await getFileNameViaProxy(fileId);
      if (title) {
        return {
          name: title,
          mimeType: 'video/mp4',
          id: fileId
        };
      }
    } catch (proxyError) {
      console.log('Прокси метод не сработал:', proxyError);
    }

    // Fallback - возвращаем короткий ID как название
    return {
      name: `Файл_${fileId.substring(0, 8)}`,
      mimeType: 'video/mp4',
      id: fileId
    };

  } catch (error) {
    console.error('Все методы извлечения не сработали:', error);
    return {
      name: `Файл_${fileId.substring(0, 8)}`,
      mimeType: 'video/mp4',
      id: fileId
    };
  }
};

/**
 * Получение названия через oEmbed API
 */
const getFileNameViaOEmbed = async (fileId) => {
  try {
    const oembedUrl = `https://docs.google.com/oembed?url=https://drive.google.com/file/d/${fileId}/view&format=json`;
    const response = await fetch(oembedUrl);
    
    if (response.ok) {
      const data = await response.json();
      return data.title || null;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Получение названия через JSONP вызов
 */
const getFileNameViaJSONP = async (fileId) => {
  return new Promise((resolve) => {
    try {
      const script = document.createElement('script');
      const callbackName = `gdrive_callback_${Date.now()}`;
      
      window[callbackName] = (data) => {
        document.head.removeChild(script);
        delete window[callbackName];
        
        if (data && data.name) {
          resolve(data.name);
        } else {
          resolve(null);
        }
      };
      
      script.src = `https://www.googleapis.com/drive/v3/files/${fileId}?callback=${callbackName}&fields=name&key=AIzaSyC5MtQgTJvY9cZj8ggKhK5W3YqK1X2JH4k`;
      script.onerror = () => {
        document.head.removeChild(script);
        delete window[callbackName];
        resolve(null);
      };
      
      document.head.appendChild(script);
      
      // Timeout через 5 секунд
      setTimeout(() => {
        if (window[callbackName]) {
          document.head.removeChild(script);
          delete window[callbackName];
          resolve(null);
        }
      }, 5000);
      
    } catch (error) {
      resolve(null);
    }
  });
};

/**
 * Получение названия через CORS прокси
 */
const getFileNameViaProxy = async (fileId) => {
  try {
    // Используем публичные CORS прокси
    const proxies = [
      'https://api.allorigins.win/raw?url=',
      'https://cors-anywhere.herokuapp.com/',
      'https://thingproxy.freeboard.io/fetch/'
    ];
    
    const targetUrl = `https://drive.google.com/file/d/${fileId}/view`;
    
    for (const proxy of proxies) {
      try {
        const response = await fetch(proxy + encodeURIComponent(targetUrl), {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          const title = extractTitleFromHTML(html);
          if (title && title !== 'Untitled') {
            return title;
          }
        }
      } catch (proxyError) {
        continue; // Пробуем следующий прокси
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Извлечение названия из HTML страницы Google Drive
 */
const extractTitleFromHTML = (html) => {
  try {
    // Ищем title в meta tags
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      let title = titleMatch[1].trim();
      
      // Убираем " - Google Drive" из конца
      title = title.replace(/ - Google Drive$/i, '');
      
      // Убираем другие суффиксы Google
      title = title.replace(/ - Google Docs$/i, '');
      title = title.replace(/ - Google Sheets$/i, '');
      title = title.replace(/ - Google Slides$/i, '');
      
      if (title && title.length > 0 && title !== 'Untitled') {
        return title;
      }
    }
    
    // Ищем в data-title атрибутах
    const dataTitleMatch = html.match(/data-title="([^"]+)"/i);
    if (dataTitleMatch && dataTitleMatch[1]) {
      return dataTitleMatch[1].trim();
    }
    
    // Ищем в JSON данных страницы
    const jsonMatch = html.match(/"title":"([^"]+)"/i);
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1].trim();
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Обрабатывает массив ссылок и извлекает РЕАЛЬНЫЕ названия
 */
export const processLinksAndExtractTitles = async (links) => {
  if (!links || links.length === 0) {
    return { links, titles: [] };
  }
  
  console.log('🔄 Начинаем извлечение реальных названий для', links.length, 'ссылок...');
  
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
        
        if (fileName && fileName !== `Файл_${fileId.substring(0, 8)}`) {
          console.log(`✅ Получено реальное название: "${fileName}"`);
          // Убираем расширения для краткости
          return fileName.replace(/\.(mp4|avi|mov|mkv|webm|m4v|jpg|jpeg|png|gif|pdf|doc|docx)$/i, '');
        } else {
          console.log(`⚠️ Не удалось получить реальное название, используем fallback`);
          return `Видео_${fileId.substring(0, 8)}`;
        }
        
      } catch (error) {
        console.error(`❌ Ошибка обработки ссылки ${index + 1}:`, error);
        const fileId = extractFileIdFromUrl(link);
        return fileId ? `Видео_${fileId.substring(0, 8)}` : `Ссылка_${index + 1}`;
      }
    })
  );
  
  const titles = results.map((result, index) => 
    result.status === 'fulfilled' ? result.value : `Видео_${index + 1}`
  );
  
  console.log('🎉 Извлечение завершено! Получены названия:', titles);
  
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
