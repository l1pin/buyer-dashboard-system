// Обновленный googleDriveUtils.js с улучшенной валидацией Google Drive ссылок
// Замените содержимое src/utils/googleDriveUtils.js

// Конфигурация Google OAuth
const GOOGLE_CONFIG = {
  client_id: '570232776340-q495aojp96lvg75vbb54ud9ltp8u2kmn.apps.googleusercontent.com',
  api_key: 'AIzaSyAgBZt6xX69phg8vD2NUcrXtsVCFxrVV1w',
  scope: 'https://www.googleapis.com/auth/drive.metadata.readonly'
};

let gapi = null;
let tokenClient = null;
let isGapiInitialized = false;
let currentAccessToken = null;

// Ключи для localStorage
const STORAGE_KEY = 'google_drive_access_token';
const STORAGE_EXPIRY_KEY = 'google_drive_token_expiry';

/**
 * Сохранение токена в localStorage
 */
const saveTokenToStorage = (token, expiresIn = 3600) => {
  const expiryTime = Date.now() + (expiresIn * 1000);
  localStorage.setItem(STORAGE_KEY, token);
  localStorage.setItem(STORAGE_EXPIRY_KEY, expiryTime.toString());
};

/**
 * Загрузка токена из localStorage
 */
const loadTokenFromStorage = () => {
  const token = localStorage.getItem(STORAGE_KEY);
  const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY);
  
  if (!token || !expiry) return null;
  
  const expiryTime = parseInt(expiry);
  if (Date.now() >= expiryTime) {
    // Токен истек
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_EXPIRY_KEY);
    return null;
  }
  
  return token;
};

/**
 * Очистка токена из localStorage
 */
const clearTokenFromStorage = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_EXPIRY_KEY);
};

/**
 * Загрузка Google API скриптов
 */
const loadGoogleScripts = async () => {
  // Загружаем Google API Script
  if (!window.gapi) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Загружаем Google Identity Services Script
  if (!window.google?.accounts) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
};

/**
 * Инициализация Google API и GIS
 */
const initializeGoogleAPI = async () => {
  if (isGapiInitialized) {
    return { gapi, tokenClient };
  }

  try {
    // Загружаем скрипты
    await loadGoogleScripts();
    
    gapi = window.gapi;

    // Инициализируем gapi client
    await new Promise((resolve) => {
      gapi.load('client', resolve);
    });

    await gapi.client.init({
      apiKey: GOOGLE_CONFIG.api_key,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
    });

    // Инициализируем OAuth токен клиент
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CONFIG.client_id,
      scope: GOOGLE_CONFIG.scope,
      callback: (response) => {
        if (response.access_token) {
          currentAccessToken = response.access_token;
          gapi.client.setToken({ access_token: response.access_token });
          
          // Сохраняем токен в localStorage
          const expiresIn = response.expires_in || 3600;
          saveTokenToStorage(response.access_token, expiresIn);
          
          console.log('Google авторизация сохранена');
        }
      },
      error_callback: (error) => {
        console.error('Ошибка OAuth:', error);
        currentAccessToken = null;
        clearTokenFromStorage();
      }
    });

    // Проверяем сохраненный токен при инициализации
    const savedToken = loadTokenFromStorage();
    if (savedToken) {
      currentAccessToken = savedToken;
      gapi.client.setToken({ access_token: savedToken });
      console.log('Восстановлен сохраненный токен авторизации');
    }

    isGapiInitialized = true;
    console.log('Google API и GIS инициализированы');
    
    return { gapi, tokenClient };
  } catch (error) {
    console.error('Ошибка инициализации Google API:', error);
    throw error;
  }
};

/**
 * Проверка авторизации
 */
export const checkGoogleAuth = async () => {
  try {
    await initializeGoogleAPI();
    return !!currentAccessToken;
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error);
    return false;
  }
};

/**
 * Запрос авторизации пользователя
 */
export const requestGoogleAuth = async () => {
  try {
    await initializeGoogleAPI();
    
    return new Promise((resolve, reject) => {
      // Обновляем callback для этого конкретного запроса
      tokenClient.callback = (response) => {
        if (response.access_token) {
          currentAccessToken = response.access_token;
          gapi.client.setToken({ access_token: response.access_token });
          console.log('Google авторизация выполнена');
          resolve(true);
        } else {
          reject(new Error('Не получен access token'));
        }
      };
      
      tokenClient.error_callback = (error) => {
        console.error('Ошибка авторизации:', error);
        currentAccessToken = null;
        reject(error);
      };

      // Запрашиваем авторизацию
      if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({ prompt: '' });
      }
    });
  } catch (error) {
    console.error('Ошибка запроса авторизации:', error);
    return false;
  }
};

/**
 * Выход из Google аккаунта
 */
export const signOutGoogle = async () => {
  try {
    if (gapi && currentAccessToken) {
      gapi.client.setToken(null);
      
      // Отзываем токен
      window.google.accounts.oauth2.revoke(currentAccessToken, () => {
        console.log('Токен отозван');
      });
      
      // Очищаем из памяти и localStorage
      currentAccessToken = null;
      clearTokenFromStorage();
      
      console.log('Выход из Google аккаунта выполнен');
    }
  } catch (error) {
    console.error('Ошибка выхода из Google:', error);
  }
};

/**
 * Убеждается в наличии авторизации Google (для использования в процессе создания креатива)
 */
export const ensureGoogleAuth = async () => {
  try {
    await initializeGoogleAPI();
    
    // Если уже авторизован, возвращаем true
    if (currentAccessToken) {
      return true;
    }
    
    // Запрашиваем авторизацию
    return await requestGoogleAuth();
  } catch (error) {
    console.error('Ошибка обеспечения авторизации:', error);
    return false;
  }
};

/**
 * Проверка является ли URL ссылкой на Google Drive - УЛУЧШЕНО
 */
export const isGoogleDriveUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  
  // Более строгая проверка Google Drive URLs
  const googleDrivePatterns = [
    /^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+/,
    /^https:\/\/drive\.google\.com\/open\?id=[a-zA-Z0-9_-]+/,
    /^https:\/\/docs\.google\.com\/.+\/d\/[a-zA-Z0-9_-]+/,
    /^https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]+/
  ];
  
  return googleDrivePatterns.some(pattern => pattern.test(url.trim()));
};

/**
 * Извлекает File ID из ссылки - УЛУЧШЕНО
 */
export const extractFileIdFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  const trimmedUrl = url.trim();
  
  // Проверяем что это действительно Google Drive URL
  if (!isGoogleDriveUrl(trimmedUrl)) {
    console.warn('URL не является ссылкой на Google Drive:', trimmedUrl);
    return null;
  }
  
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/.+\/d\/([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  console.warn('Не удалось извлечь File ID из Google Drive URL:', trimmedUrl);
  return null;
};

/**
 * Получает название файла через OAuth (новый GIS способ)
 */
const getFileNameViaOAuth = async (fileId) => {
  try {
    await initializeGoogleAPI();
    
    if (!currentAccessToken) {
      console.log('Требуется авторизация для доступа к приватным файлам');
      return null;
    }

    // Устанавливаем токен перед запросом
    gapi.client.setToken({ access_token: currentAccessToken });

    // Получаем информацию о файле
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      fields: 'name,mimeType'
    });

    if (response.result && response.result.name) {
      return cleanFileName(response.result.name);
    }
  } catch (error) {
    console.log('OAuth метод не сработал:', error);
    // Если файл не найден или нет доступа, возвращаем null
    if (error.status === 404 || error.status === 403) {
      return null;
    }
    // Если токен истек, сбрасываем его
    if (error.status === 401) {
      currentAccessToken = null;
      gapi.client.setToken(null);
    }
  }
  
  return null;
};

/**
 * Получает название файла через публичный API
 */
const getFileNameViaPublicAPI = async (fileId) => {
  const apiKeys = [
    'AIzaSyAgBZt6xX69phg8vD2NUcrXtsVCFxrVV1w',
    'AIzaSyDxrdk_ipzlUefe49uiEslMWt7laGdz4OU'
  ];

  for (const apiKey of apiKeys) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType&key=${apiKey}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.name) {
          return cleanFileName(data.name);
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
};

/**
 * Получает информацию о файле - УЛУЧШЕНО с детальным логированием
 */
export const getFileInfo = async (fileId, showAuthPrompt = true) => {
  if (!fileId) {
    console.warn('getFileInfo: fileId не предоставлен');
    return null;
  }
  
  console.log(`🔍 Ищем название для файла: ${fileId}`);

  // Метод 1: Пробуем OAuth авторизацию (новый GIS способ)
  if (showAuthPrompt) {
    try {
      const title = await getFileNameViaOAuth(fileId);
      if (title && isValidTitle(title)) {
        console.log(`✓ Получено через OAuth: "${title}"`);
        return { name: title, mimeType: 'video/mp4', id: fileId };
      }
    } catch (error) {
      console.log('OAuth метод не сработал:', error.message);
    }
  }

  // Метод 2: Публичный API для публичных файлов
  try {
    const title = await getFileNameViaPublicAPI(fileId);
    if (title && isValidTitle(title)) {
      console.log(`✓ Получено через публичный API: "${title}"`);
      return { name: title, mimeType: 'video/mp4', id: fileId };
    }
  } catch (error) {
    console.log('Публичный API не сработал:', error.message);
  }

  // Метод 3: Netlify функция
  try {
    const response = await fetch(`/.netlify/functions/get-drive-title?fileId=${fileId}`);
    if (response.ok) {
      const data = await response.json();
      
      if (data.title && data.title !== null && isValidTitle(data.title)) {
        console.log(`✓ Получено через Netlify: "${data.title}"`);
        return { name: cleanFileName(data.title), mimeType: 'video/mp4', id: fileId };
      }
      
      if (data.title === null) {
        console.log('❌ Netlify функция не смогла получить название (файл приватный или не найден)');
        return null;
      }
    }
  } catch (error) {
    console.log('❌ Ошибка запроса к Netlify функции:', error.message);
  }

  // Возвращаем null если ничего не получилось
  console.log(`❌ Не удалось получить название для файла ${fileId}`);
  return null;
};

/**
 * Проверка валидности названия - УЛУЧШЕНО
 */
const isValidTitle = (title) => {
  if (!title || typeof title !== 'string') return false;
  
  const cleaned = title.trim();
  
  // Проверяем длину
  if (cleaned.length === 0 || cleaned.length > 300) return false;
  
  // Паттерны невалидных названий
  const invalidPatterns = [
    /^untitled$/i,
    /^без названия$/i,
    /^document$/i,
    /^video$/i,
    /^file$/i,
    /sign in/i,
    /войти/i,
    /access denied/i,
    /доступ запрещен/i,
    /error/i,
    /ошибка/i,
    /loading/i,
    /загрузка/i,
    /file not found/i,
    /файл не найден/i,
    /not found/i,
    /не найден/i
  ];

  return !invalidPatterns.some(pattern => pattern.test(cleaned));
};

/**
 * Очистка названия файла - сохраняем расширения для лучшей идентификации
 */
const cleanFileName = (filename) => {
  if (!filename) return filename;
  
  let cleaned = filename.trim();
  
  // НЕ удаляем расширения видео файлов - оставляем как есть с расширением!
  // Убираем только лишние пробелы и невидимые символы
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Убираем специальные символы в начале/конце (но не точки от расширений)
  cleaned = cleaned.replace(/^[-_\s]+|[-_\s]+$/g, '');
  
  return cleaned;
};

/**
 * Обработка массива ссылок с извлечением названий - УЛУЧШЕНО
 */
export const processLinksAndExtractTitles = async (links, showAuthPrompt = true) => {
  if (!links || links.length === 0) {
    return { links: [], titles: [] };
  }
  
  console.log('🔍 Начинаем извлечение названий для', links.length, 'ссылок...');
  
  // Валидируем все ссылки сразу
  const invalidLinks = [];
  const validLinks = [];
  
  links.forEach((link, index) => {
    if (!link || !link.trim()) {
      console.warn(`❌ Пустая ссылка ${index + 1}`);
      return;
    }
    
    const trimmedLink = link.trim();
    if (!isGoogleDriveUrl(trimmedLink)) {
      console.warn(`❌ Ссылка ${index + 1} не является Google Drive URL:`, trimmedLink);
      invalidLinks.push(trimmedLink);
      return;
    }
    
    validLinks.push(trimmedLink);
  });

  if (invalidLinks.length > 0) {
    throw new Error(`Найдены неверные ссылки (должны быть Google Drive): ${invalidLinks.slice(0, 3).join(', ')}${invalidLinks.length > 3 ? '...' : ''}`);
  }

  if (validLinks.length === 0) {
    throw new Error('Не найдено валидных Google Drive ссылок');
  }
  
  // Проверяем авторизацию Google один раз для всех ссылок
  let isAuthorized = false;
  if (showAuthPrompt) {
    try {
      isAuthorized = await checkGoogleAuth();
      if (isAuthorized) {
        console.log('✓ Google авторизация активна - можем работать с приватными файлами');
      } else {
        console.log('⚠ Google авторизация не выполнена - работаем только с публичными файлами');
      }
    } catch (error) {
      console.log('⚠ Не удалось проверить авторизацию Google');
    }
  }
  
  const results = await Promise.allSettled(
    validLinks.map(async (link, index) => {
      try {
        console.log(`📎 Ссылка ${index + 1}:`, link.substring(0, 50) + '...');
        
        const fileId = extractFileIdFromUrl(link);
        
        if (!fileId) {
          console.log(`❌ Не удалось извлечь File ID из ссылки ${index + 1}`);
          return `Видео ${index + 1}`;
        }
        
        console.log(`🔑 File ID ${index + 1}: ${fileId}`);
        
        const fileInfo = await getFileInfo(fileId, showAuthPrompt);
        
        if (fileInfo?.name && isValidTitle(fileInfo.name)) {
          console.log(`✅ Название ${index + 1}: "${fileInfo.name}"`);
          return fileInfo.name;
        } else {
          console.log(`❌ Fallback ${index + 1}: Видео ${index + 1}`);
          return `Видео ${index + 1}`;
        }
        
      } catch (error) {
        console.error(`❌ Ошибка обработки ссылки ${index + 1}:`, error);
        return `Видео ${index + 1}`;
      }
    })
  );
  
  const titles = results.map((result, index) => 
    result.status === 'fulfilled' ? result.value : `Видео ${index + 1}`
  );
  
  // Статистика
  const extractedCount = titles.filter(title => !title.startsWith('Видео ')).length;
  const fallbackCount = titles.length - extractedCount;
  
  console.log('📊 Результаты извлечения:');
  console.log(`  ✅ Извлечено названий: ${extractedCount}/${titles.length}`);
  console.log(`  📹 Fallback названий: ${fallbackCount}/${titles.length}`);
  console.log('📝 Итоговые названия:', titles);
  
  // Проверяем что удалось извлечь хотя бы одно название
  if (extractedCount === 0) {
    throw new Error('Не удалось извлечь ни одного названия файла. Проверьте что ссылки ведут на доступные файлы Google Drive.');
  }
  
  return { links: validLinks, titles };
};

/**
 * Форматирование названия для отображения - показываем полное название
 */
export const formatFileName = (name, maxLength = null) => {
  if (!name) return 'Безымянный файл';
  
  let cleanName = name.trim();
  
  // Если maxLength не указан или равен null - возвращаем полное название
  if (!maxLength || cleanName.length <= maxLength) {
    return cleanName;
  }
  
  // Если всё-таки нужно обрезать (для совместимости), то обрезаем
  return cleanName.substring(0, maxLength - 3) + '...';
};

/**
 * Валидация массива Google Drive ссылок - НОВАЯ ФУНКЦИЯ
 */
export const validateGoogleDriveLinks = (links) => {
  if (!Array.isArray(links)) {
    return { 
      isValid: false, 
      errors: ['Ссылки должны быть массивом'], 
      validLinks: [], 
      invalidLinks: [] 
    };
  }

  const errors = [];
  const validLinks = [];
  const invalidLinks = [];

  // Фильтруем пустые ссылки
  const nonEmptyLinks = links.filter(link => link && link.trim());

  if (nonEmptyLinks.length === 0) {
    return { 
      isValid: false, 
      errors: ['Необходимо добавить хотя бы одну ссылку'], 
      validLinks: [], 
      invalidLinks: [] 
    };
  }

  nonEmptyLinks.forEach((link, index) => {
    const trimmedLink = link.trim();
    
    if (!isGoogleDriveUrl(trimmedLink)) {
      invalidLinks.push(trimmedLink);
      errors.push(`Ссылка ${index + 1} не является Google Drive URL`);
    } else {
      const fileId = extractFileIdFromUrl(trimmedLink);
      if (!fileId) {
        invalidLinks.push(trimmedLink);
        errors.push(`Не удалось извлечь File ID из ссылки ${index + 1}`);
      } else {
        validLinks.push(trimmedLink);
      }
    }
  });

  return {
    isValid: validLinks.length > 0 && invalidLinks.length === 0,
    errors,
    validLinks,
    invalidLinks,
    summary: `Валидных ссылок: ${validLinks.length}, невалидных: ${invalidLinks.length}`
  };
};
