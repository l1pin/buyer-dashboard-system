/**
 * Скрипт для обновления остатков товаров из YML файла
 *
 * ОПТИМИЗАЦИИ v2.0:
 * - 🚀 Кэширование в localStorage с TTL 60 минут
 * - 🚀 Retry логика с exponential backoff (до 3 попыток)
 * - 🚀 Таймаут запроса 30 секунд
 *
 * Этот модуль содержит функцию для загрузки и парсинга YML файла с остатками товаров,
 * группировки остатков по базовым артикулам и обновления метрик.
 */

const YML_URL = "https://senik.salesdrive.me/export/yml/export.yml?publicKey=wlOjIqfmiP78HuTVF_8fc1r4s-9vK6pxPt9m6x7dAt4z43lCe8O4erQlcPv7vQx_PRX4KTareAu";

// Настройки кэширования
const YML_CACHE_KEY = 'yml_stock_cache';
const YML_CACHE_TTL = 60 * 60 * 1000; // 60 минут
const FETCH_TIMEOUT = 30000; // 30 секунд
const MAX_RETRIES = 3;

/**
 * Обновляет остатки товаров из YML файла
 *
 * @param {Array} metrics - Массив метрик офферов
 * @returns {Promise<Array>} - Обновленный массив метрик с остатками
 * @throws {Error} - Выбрасывает ошибку при проблемах с загрузкой или парсингом
 */
export const updateStocksFromYml = async (metrics) => {
  try {
    const startTime = performance.now();
    console.log('🔄 Начинаем загрузку остатков из YML...');

    // 🎯 ОПТИМИЗАЦИЯ: Проверяем кэш
    const cached = getYmlCache();
    let xmlString;

    if (cached && cached.xmlString && (Date.now() - cached.timestamp) < YML_CACHE_TTL) {
      const cacheAge = Math.round((Date.now() - cached.timestamp) / 60000);
      console.log(`📦 Используем кэшированный YML (возраст: ${cacheAge} мин)`);
      xmlString = cached.xmlString;
    } else {
      // Загружаем YML файл с retry логикой
      xmlString = await fetchYmlWithRetry();
      // Сохраняем в кэш
      saveYmlCache(xmlString);
    }
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    // Проверка на ошибки парсинга
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Ошибка парсинга XML");
    }

    // Парсинг категорий
    const categoriesMap = {};
    const categoryNodes = xmlDoc.querySelectorAll("shop > categories > category");
    categoryNodes.forEach((categoryEl) => {
      const categoryId = categoryEl.getAttribute("id");
      const categoryName = categoryEl.textContent.trim();
      categoriesMap[categoryId] = categoryName;
    });
    console.log(`Найдено категорий: ${Object.keys(categoriesMap).length}`);

    // Парсинг офферов
    const offerNodes = xmlDoc.querySelectorAll("shop > offers > offer");
    console.log(`Найдено офферов: ${offerNodes.length}`);

    const skuData = {};

    offerNodes.forEach((offerEl) => {
      const articleElem = offerEl.querySelector("article");
      if (!articleElem) return;

      const article = articleElem.textContent.trim();
      if (!article) return;

      const qtyEl = offerEl.querySelector("quantity_in_stock");
      const priceEl = offerEl.querySelector("price");
      const nameEl = offerEl.querySelector("name");
      const categoryEl = offerEl.querySelector("categoryId");

      const quantity = qtyEl && qtyEl.textContent ? parseInt(qtyEl.textContent) : 0;
      const price = priceEl && priceEl.textContent ? parseFloat(priceEl.textContent) : 0;
      const name = nameEl && nameEl.textContent ? nameEl.textContent.trim() : "Неизвестный товар";
      const categoryId = categoryEl && categoryEl.textContent ? categoryEl.textContent.trim() : "";

      // Игнорируем категорию 52
      if (categoryId === "52") return;

      const baseArticle = article.split("-")[0];
      const offerId = offerEl.getAttribute("id") || article;

      if (!skuData[baseArticle]) {
        skuData[baseArticle] = {
          total: 0,
          modifications: [],
          modificationsDisplay: [], // Для отображения в UI без цены
          categories: new Set(),
          categoryDetails: []
        };
      }

      skuData[baseArticle].total += quantity;

      // Не добавляем в комментарии если в названии есть "[" или "]"
      if (!name.includes("[") && !name.includes("]")) {
        skuData[baseArticle].modifications.push(`${name} ${quantity} шт - ${price.toFixed(2)} грн`);
        skuData[baseArticle].modificationsDisplay.push(`${name} - ${quantity} шт.`);
      }

      // Добавляем категорию если она есть, не равна "52" и в названии нет "[" или "]"
      if (categoryId && categoryId !== "52" && !name.includes("[") && !name.includes("]")) {
        skuData[baseArticle].categories.add(categoryId);
        const categoryName = categoriesMap[categoryId] || `Категория ${categoryId}`;
        skuData[baseArticle].categoryDetails.push(`${offerId} - ${categoryName}`);
      }
    });

    // Обновляем метрики с остатками и категориями
    const updatedMetrics = metrics.map(metric => {
      if (skuData.hasOwnProperty(metric.article)) {
        const articleData = skuData[metric.article];
        const categories = Array.from(articleData.categories);

        // Выбираем главную категорию: приоритет - не 52, не 55, не 16
        let mainCategory = "";
        const priorityCategory = categories.find(cat => cat !== "52" && cat !== "55" && cat !== "16");
        if (priorityCategory) {
          mainCategory = categoriesMap[priorityCategory] || "";
        } else {
          // Если нет приоритетной, приоритет: сначала 55, потом 16
          if (categories.includes("55")) {
            mainCategory = categoriesMap["55"] || "";
          } else if (categories.includes("16")) {
            mainCategory = categoriesMap["16"] || "";
          }
        }

        return {
          ...metric,
          stock_quantity: articleData.total,
          category: mainCategory,
          categoryDetails: articleData.categoryDetails
        };
      }
      return metric;
    });

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Остатки обновлены для ${Object.keys(skuData).length} артикулов за ${elapsed}с`);

    return {
      metrics: updatedMetrics,
      skuData: skuData,
      totalArticles: Object.keys(skuData).length
    };

  } catch (error) {
    console.error('❌ Ошибка загрузки остатков:', error);
    throw error;
  }
};

/**
 * 🚀 Загрузка YML с retry логикой и таймаутом
 */
async function fetchYmlWithRetry(retryCount = 0) {
  const RETRY_DELAY = 2000; // 2 секунды

  try {
    // Создаём контроллер для отмены по таймауту
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const startTime = performance.now();
    console.log(`📡 Загрузка YML файла (попытка ${retryCount + 1}/${MAX_RETRIES})...`);

    const response = await fetch(YML_URL, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ YML загружен: ${(text.length / 1024).toFixed(0)}KB за ${elapsed}с`);

    return text;
  } catch (error) {
    // Retry логика
    if (retryCount < MAX_RETRIES - 1) {
      const isTimeout = error.name === 'AbortError';
      const delay = RETRY_DELAY * Math.pow(2, retryCount);

      console.log(`⚠️ ${isTimeout ? 'Таймаут' : error.message}, повтор через ${delay / 1000}с...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchYmlWithRetry(retryCount + 1);
    }

    throw new Error(`Ошибка загрузки YML после ${MAX_RETRIES} попыток: ${error.message}`);
  }
}

/**
 * Получает кэш YML из localStorage
 */
function getYmlCache() {
  try {
    const cached = localStorage.getItem(YML_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (error) {
    return null;
  }
}

/**
 * Сохраняет YML в кэш localStorage
 */
function saveYmlCache(xmlString) {
  try {
    const cacheData = {
      timestamp: Date.now(),
      xmlString: xmlString
    };
    localStorage.setItem(YML_CACHE_KEY, JSON.stringify(cacheData));
    console.log(`💾 YML кэш сохранён`);
  } catch (error) {
    console.warn('⚠️ Не удалось сохранить YML кэш:', error.message);
  }
}

/**
 * Получает информацию о модификациях товара по артикулу
 *
 * @param {string} article - Артикул товара
 * @param {Object} skuData - Данные о товарах из YML
 * @returns {Array} - Массив модификаций товара
 */
export const getModificationsByArticle = (article, skuData) => {
  const baseArticle = article.split("-")[0];
  return skuData[baseArticle]?.modifications || [];
};

/**
 * Получает категории товара по артикулу
 *
 * @param {string} article - Артикул товара
 * @param {Object} skuData - Данные о товарах из YML
 * @returns {Array} - Массив категорий товара
 */
export const getCategoriesByArticle = (article, skuData) => {
  const baseArticle = article.split("-")[0];
  return skuData[baseArticle]?.categoryDetails || [];
};
