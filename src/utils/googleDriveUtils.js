// Простой рабочий googleDriveUtils.js с вашими API ключами
// Замените содержимое src/utils/googleDriveUtils.js

/**
 * Извлекает File ID из ссылки
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
 * Получает название файла
 */
export const getFileInfo = async (fileId) => {
  if (!fileId) return null;
  
  console.log(`Ищем название для файла: ${fileId}`);

  // Метод 1: Google Drive API с вашими ключами
  try {
    const title = await getFileNameViaAPI(fileId);
    if (title && isValidTitle(title)) {
      console.log(`Получено через API: "${title}"`);
      return { name: title, mimeType: 'video/mp4', id: fileId };
    }
  } catch (error) {
    console.log('API метод не сработал:', error.message);
  }

  // Метод 2: Через Netlify функцию
  try {
    const title = await getFileNameViaNetlify(fileId);
    if (title && isValidTitle(title)) {
      console.log(`Получено через Netlify: "${title}"`);
      return { name: title, mimeType: 'video/mp4', id: fileId };
    }
  } catch (error) {
    console.log('Netlify метод не сработал:', error.message);
  }

  // Fallback
  const smartName = generateFallback(fileId);
  console.log(`Используем fallback: "${smartName}"`);
  
  return { name: smartName, mimeType: 'video/mp4', id: fileId };
};

/**
 * Google Drive API с вашими ключами
 */
const getFileNameViaAPI = async (fileId) => {
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

      if (response.ok) {
        const data = await response.json();
        if (data.name) {
          return cleanFileName(data.name);
        }
      } else if (response.status === 403) {
        continue;
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
};

/**
 * Через Netlify функцию
 */
const getFileNameViaNetlify = async (fileId) => {
  try {
    const response = await fetch(`/.netlify/functions/get-drive-title?fileId=${fileId}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.title && isValidTitle(data.title)) {
        return cleanFileName(data.title);
      }
    }
  } catch (error) {
    throw error;
  }
  
  return null;
};

/**
 * Проверка валидности
 */
const isValidTitle = (title) => {
  if (!title || typeof title !== 'string') return false;
  
  const cleaned = title.trim();
  
  const invalidPatterns = [
    /^untitled$/i,
    /^без названия$/i,
    /sign in/i,
    /войти/i,
    /access denied/i,
    /error/i,
    /loading/i
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(cleaned)) {
      return false;
    }
  }

  return cleaned.length > 0 && cleaned.length < 300;
};

/**
 * Очистка названия
 */
const cleanFileName = (filename) => {
  if (!filename) return filename;
  
  let cleaned = filename.trim();
  
  // Убираем расширения
  cleaned = cleaned.replace(/\.(mp4|avi|mov|mkv|webm|m4v|jpg|jpeg|png|gif|pdf|doc|docx)$/i, '');
  
  // Убираем лишние пробелы
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

/**
 * Fallback название
 */
const generateFallback = (fileId) => {
  const templates = [
    'Видеопрезентация',
    'Демонстрационный_материал',
    'Обучающий_контент',
    'Рекламный_ролик',
    'Корпоративное_видео',
    'Презентация_продукта'
  ];
  
  let hash = 0;
  for (let i = 0; i < fileId.length; i++) {
    hash = ((hash << 5) - hash + fileId.charCodeAt(i)) & 0xffffffff;
  }
  
  const templateIndex = Math.abs(hash) % templates.length;
  const template = templates[templateIndex];
  
  const shortId = fileId.substring(0, 6).toUpperCase();
  
  return `${template}_${shortId}`;
};

/**
 * Обработка массива ссылок
 */
export const processLinksAndExtractTitles = async (links) => {
  if (!links || links.length === 0) {
    return { links, titles: [] };
  }
  
  console.log('Начинаем извлечение названий для', links.length, 'ссылок...');
  
  const results = await Promise.allSettled(
    links.map(async (link, index) => {
      try {
        console.log(`Обрабатываем ссылку ${index + 1}:`, link);
        
        const fileId = extractFileIdFromUrl(link);
        
        if (!fileId) {
          console.log(`Не удалось извлечь File ID из ссылки ${index + 1}`);
          return `Ссылка_${index + 1}`;
        }
        
        const fileInfo = await getFileInfo(fileId);
        
        if (fileInfo?.name && isValidTitle(fileInfo.name)) {
          console.log(`Успех! Название: "${fileInfo.name}"`);
          return fileInfo.name;
        } else {
          const fallback = generateFallback(fileId);
          console.log(`Fallback: "${fallback}"`);
          return fallback;
        }
        
      } catch (error) {
        console.error(`Ошибка обработки ссылки ${index + 1}:`, error);
        const fileId = extractFileIdFromUrl(link);
        return fileId ? generateFallback(fileId) : `Ссылка_${index + 1}`;
      }
    })
  );
  
  const titles = results.map((result, index) => 
    result.status === 'fulfilled' ? result.value : `Ссылка_${index + 1}`
  );
  
  console.log('Извлечение завершено. Названия:', titles);
  
  return { links, titles };
};

/**
 * Форматирование для отображения
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
 * Проверка Google Drive ссылки
 */
export const isGoogleDriveUrl = (url) => {
  if (!url) return false;
  return /(?:drive|docs)\.google\.com/.test(url);
};
