// Обновленный googleDriveUtils.js с новой Google Identity Services (GIS)
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
          console.log('Google авторизация успешна');
        }
      },
      error_callback: (error) => {
        console.error('Ошибка OAuth:', error);
        currentAccessToken = null;
      }
    });

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
      currentAccessToken = null;
      
      // Отзываем токен
      window.google.accounts.oauth2.revoke(currentAccessToken, () => {
        console.log('Токен отозван');
      });
      
      console.log('Выход из Google аккаунта выполнен');
    }
  } catch (error) {
    console.error('Ошибка выхода из Google:', error);
  }
};

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
 * Получает информацию о файле
 */
export const getFileInfo = async (fileId, showAuthPrompt = true) => {
  if (!fileId) return null;
  
  console.log(`Ищем название для файла: ${fileId}`);

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
        console.log('Netlify функция не смогла получить название (файл приватный или не найден)');
        return null;
      }
    }
  } catch (error) {
    console.log('Ошибка запроса к Netlify функции:', error.message);
  }

  // Возвращаем null если ничего не получилось
  console.log(`✗ Не удалось получить название для файла ${fileId}`);
  return null;
};

/**
 * Проверка валидности названия
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

  return !invalidPatterns.some(pattern => pattern.test(cleaned)) && 
         cleaned.length > 0 && 
         cleaned.length < 300;
};

/**
 * Очистка названия файла
 */
const cleanFileName = (filename) => {
  if (!filename) return filename;
  
  let cleaned = filename.trim();
  
  // Убираем расширения видео файлов
  cleaned = cleaned.replace(/\.(mp4|avi|mov|mkv|webm|m4v|flv|wmv)$/i, '');
  
  // Убираем лишние пробелы
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

/**
 * Обработка массива ссылок с извлечением названий
 */
export const processLinksAndExtractTitles = async (links, showAuthPrompt = true) => {
  if (!links || links.length === 0) {
    return { links, titles: [] };
  }
  
  console.log('🔍 Начинаем извлечение названий для', links.length, 'ссылок...');
  
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
    links.map(async (link, index) => {
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
          console.log(`📹 Fallback ${index + 1}: Видео ${index + 1}`);
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
  
  return { links, titles };
};

/**
 * Форматирование названия для отображения
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
