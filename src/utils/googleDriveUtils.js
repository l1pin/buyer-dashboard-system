// Обновленный googleDriveUtils.js с OAuth авторизацией для Google Drive
// Замените содержимое src/utils/googleDriveUtils.js

// Конфигурация Google OAuth
const GOOGLE_CONFIG = {
  client_id: '1027516545893-5l0u9nr6l4u4ra4mj1rn5n5o2bhgk8va.apps.googleusercontent.com', // Замените на ваш Client ID
  api_key: 'AIzaSyAgBZt6xX69phg8vD2NUcrXtsVCFxrVV1w',
  discovery_docs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  scopes: 'https://www.googleapis.com/auth/drive.metadata.readonly'
};

let gapi = null;
let isGapiInitialized = false;

/**
 * Инициализация Google API
 */
const initializeGoogleAPI = async () => {
  if (isGapiInitialized && gapi) {
    return gapi;
  }

  try {
    // Загружаем Google API Script
    if (!window.gapi) {
      await loadGoogleAPIScript();
    }

    gapi = window.gapi;

    // Инициализируем Google API
    await new Promise((resolve, reject) => {
      gapi.load('client:auth2', resolve);
    });

    await gapi.client.init({
      apiKey: GOOGLE_CONFIG.api_key,
      clientId: GOOGLE_CONFIG.client_id,
      discoveryDocs: GOOGLE_CONFIG.discovery_docs,
      scope: GOOGLE_CONFIG.scopes
    });

    isGapiInitialized = true;
    console.log('Google API инициализирован');
    return gapi;
  } catch (error) {
    console.error('Ошибка инициализации Google API:', error);
    throw error;
  }
};

/**
 * Загрузка Google API Script
 */
const loadGoogleAPIScript = () => {
  return new Promise((resolve, reject) => {
    if (window.gapi) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

/**
 * Авторизация пользователя в Google
 */
const authorizeGoogleUser = async () => {
  try {
    const gapi = await initializeGoogleAPI();
    const authInstance = gapi.auth2.getAuthInstance();
    
    if (authInstance.isSignedIn.get()) {
      console.log('Пользователь уже авторизован в Google');
      return authInstance.currentUser.get();
    }

    // Запрашиваем авторизацию
    const user = await authInstance.signIn();
    console.log('Пользователь авторизован в Google');
    return user;
  } catch (error) {
    console.error('Ошибка авторизации Google:', error);
    throw error;
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
 * Получает название файла через OAuth авторизацию
 */
const getFileNameViaOAuth = async (fileId) => {
  try {
    const gapi = await initializeGoogleAPI();
    const authInstance = gapi.auth2.getAuthInstance();

    // Проверяем авторизацию
    if (!authInstance.isSignedIn.get()) {
      console.log('Требуется авторизация для доступа к приватным файлам');
      await authorizeGoogleUser();
    }

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
    // Если файл не найден или нет доступа, не выбрасываем ошибку
    if (error.status === 404 || error.status === 403) {
      return null;
    }
    throw error;
  }
  
  return null;
};

/**
 * Получает название файла через публичный API (для публичных файлов)
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
 * Получает название файла через альтернативные методы
 */
const getFileNameViaAlternative = async (fileId) => {
  try {
    // Пытаемся получить название через встроенный просмотр
    const response = await fetch(`https://drive.google.com/file/d/${fileId}/view`, {
      method: 'HEAD',
      mode: 'no-cors'
    });
    
    // Этот метод может не работать из-за CORS, но попробуем
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Получает информацию о файле
 */
export const getFileInfo = async (fileId, showAuthPrompt = true) => {
  if (!fileId) return null;
  
  console.log(`Ищем название для файла: ${fileId}`);

  // Метод 1: Пробуем OAuth авторизацию
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
      if (data.title && isValidTitle(data.title)) {
        console.log(`✓ Получено через Netlify: "${data.title}"`);
        return { name: cleanFileName(data.title), mimeType: 'video/mp4', id: fileId };
      }
    }
  } catch (error) {
    console.log('Netlify метод не сработал:', error.message);
  }

  // Возвращаем null если ничего не получилось
  console.log(`✗ Не удалось получить название для файла ${fileId}`);
  return null;
};

/**
 * Проверка авторизации Google
 */
export const checkGoogleAuth = async () => {
  try {
    const gapi = await initializeGoogleAPI();
    const authInstance = gapi.auth2.getAuthInstance();
    return authInstance.isSignedIn.get();
  } catch (error) {
    return false;
  }
};

/**
 * Ручная авторизация Google (вызывается пользователем)
 */
export const requestGoogleAuth = async () => {
  try {
    await authorizeGoogleUser();
    return true;
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    return false;
  }
};

/**
 * Выход из Google аккаунта
 */
export const signOutGoogle = async () => {
  try {
    if (gapi) {
      const authInstance = gapi.auth2.getAuthInstance();
      await authInstance.signOut();
      console.log('Выход из Google аккаунта выполнен');
    }
  } catch (error) {
    console.error('Ошибка выхода из Google:', error);
  }
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
  
  console.log('Начинаем извлечение названий для', links.length, 'ссылок...');
  
  // Проверяем авторизацию Google один раз для всех ссылок
  let isAuthorized = false;
  if (showAuthPrompt) {
    try {
      isAuthorized = await checkGoogleAuth();
      if (!isAuthorized) {
        console.log('Авторизация Google не выполнена');
        // Можно показать пользователю кнопку для авторизации
      }
    } catch (error) {
      console.log('Не удалось проверить авторизацию Google');
    }
  }
  
  const results = await Promise.allSettled(
    links.map(async (link, index) => {
      try {
        console.log(`Обрабатываем ссылку ${index + 1}:`, link);
        
        const fileId = extractFileIdFromUrl(link);
        
        if (!fileId) {
          console.log(`Не удалось извлечь File ID из ссылки ${index + 1}`);
          return `Видео ${index + 1}`;
        }
        
        const fileInfo = await getFileInfo(fileId, showAuthPrompt);
        
        if (fileInfo?.name && isValidTitle(fileInfo.name)) {
          console.log(`✓ Название ${index + 1}: "${fileInfo.name}"`);
          return fileInfo.name;
        } else {
          console.log(`✗ Не удалось получить название ${index + 1}, используем fallback`);
          return `Видео ${index + 1}`;
        }
        
      } catch (error) {
        console.error(`Ошибка обработки ссылки ${index + 1}:`, error);
        return `Видео ${index + 1}`;
      }
    })
  );
  
  const titles = results.map((result, index) => 
    result.status === 'fulfilled' ? result.value : `Видео ${index + 1}`
  );
  
  console.log('Извлечение завершено. Названия:', titles);
  
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
