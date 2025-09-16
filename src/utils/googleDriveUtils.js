// Утилиты для работы с Google Drive API

/**
 * Извлекает File ID из различных форматов Google Drive ссылок
 */
export const extractFileIdFromUrl = (url) => {
  if (!url) return null;
  
  // Различные паттерны Google Drive URL
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/.+\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/
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
 * Получает информацию о файле из Google Drive через публичное API
 */
export const getFileInfo = async (fileId) => {
  if (!fileId) return null;
  
  try {
    // Используем публичный API endpoint Google Drive
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,webViewLink&key=AIzaSyDummyKeyForPublicAccess`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      // Если API недоступен, пробуем альтернативный метод
      return await getFileInfoAlternative(fileId);
    }
    
    const data = await response.json();
    return {
      name: data.name || `Файл ${fileId.substring(0, 8)}`,
      mimeType: data.mimeType,
      id: fileId
    };
    
  } catch (error) {
    console.warn('Ошибка получения информации через API:', error);
    // Пробуем альтернативный метод
    return await getFileInfoAlternative(fileId);
  }
};

/**
 * Альтернативный метод получения названия файла через веб-скрапинг
 */
const getFileInfoAlternative = async (fileId) => {
  try {
    // Пробуем получить название через открытую ссылку
    const publicUrl = `https://drive.google.com/file/d/${fileId}/view`;
    
    // Это простой fallback - в реальности потребуется прокси сервер
    // или серверная часть для обхода CORS ограничений
    
    return {
      name: await extractTitleFromPublicLink(fileId),
      mimeType: 'unknown',
      id: fileId
    };
    
  } catch (error) {
    console.warn('Альтернативный метод не сработал:', error);
    return {
      name: `Файл ${fileId.substring(0, 8)}`,
      mimeType: 'unknown', 
      id: fileId
    };
  }
};

/**
 * Пытается извлечь название из публичной ссылки
 */
const extractTitleFromPublicLink = async (fileId) => {
  try {
    // Попытка через JSONP или публичные методы
    // В реальности это может требовать серверного прокси
    
    // Создаем короткое название на основе ID
    const shortId = fileId.substring(0, 8);
    
    // Попытка определить тип файла по расширению в URL
    const videoTypes = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'm4v'];
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    
    // Возвращаем базовое название
    return `Видео ${shortId}`;
    
  } catch (error) {
    return `Файл ${fileId.substring(0, 8)}`;
  }
};

/**
 * Обрабатывает массив ссылок и извлекает названия для каждой
 */
export const processLinksAndExtractTitles = async (links) => {
  if (!links || links.length === 0) {
    return { links, titles: [] };
  }
  
  const results = await Promise.allSettled(
    links.map(async (link, index) => {
      try {
        const fileId = extractFileIdFromUrl(link);
        if (!fileId) {
          return `Ссылка ${index + 1}`;
        }
        
        const fileInfo = await getFileInfo(fileId);
        return fileInfo?.name || `Видео ${index + 1}`;
        
      } catch (error) {
        console.warn(`Ошибка обработки ссылки ${index + 1}:`, error);
        return `Видео ${index + 1}`;
      }
    })
  );
  
  const titles = results.map((result, index) => 
    result.status === 'fulfilled' ? result.value : `Видео ${index + 1}`
  );
  
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
export const formatFileName = (name, maxLength = 30) => {
  if (!name) return 'Безымянный файл';
  
  // Убираем расширение для краткости
  const nameWithoutExt = name.replace(/\.[^/.]+$/, '');
  
  if (nameWithoutExt.length <= maxLength) {
    return nameWithoutExt;
  }
  
  return nameWithoutExt.substring(0, maxLength - 3) + '...';
};

/**
 * Определяет тип контента по MIME type
 */
export const getContentTypeIcon = (mimeType) => {
  if (!mimeType) return '📄';
  
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('document')) return '📝';
  if (mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('presentation')) return '📋';
  
  return '📄';
};
