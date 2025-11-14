/**
 * Скрипт для обновления остатков товаров из YML файла
 *
 * Этот модуль содержит функцию для загрузки и парсинга YML файла с остатками товаров,
 * группировки остатков по базовым артикулам и обновления метрик.
 */

const YML_URL = "https://senik.salesdrive.me/export/yml/export.yml?publicKey=wlOjIqfmiP78HuTVF_8fc1r4s-9vK6pxPt9m6x7dAt4z43lCe8O4erQlcPv7vQx_PRX4KTareAu";

/**
 * Обновляет остатки товаров из YML файла
 *
 * @param {Array} metrics - Массив метрик офферов
 * @returns {Promise<Array>} - Обновленный массив метрик с остатками
 * @throws {Error} - Выбрасывает ошибку при проблемах с загрузкой или парсингом
 */
export const updateStocksFromYml = async (metrics) => {
  try {
    console.log('🔄 Начинаем загрузку остатков из YML...');

    // Загружаем YML файл
    const response = await fetch(YML_URL);
    if (!response.ok) {
      throw new Error(`Ошибка загрузки YML-файла. Код ответа: ${response.status}`);
    }

    const xmlString = await response.text();
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
          categories: new Set(),
          categoryDetails: []
        };
      }

      skuData[baseArticle].total += quantity;

      // Не добавляем в комментарии если в названии есть "[" или "]"
      if (!name.includes("[") && !name.includes("]")) {
        skuData[baseArticle].modifications.push(`${name} ${quantity} шт - ${price.toFixed(2)} грн`);
      }

      // Добавляем категорию если она есть, не равна "52" и в названии нет "[" или "]"
      if (categoryId && categoryId !== "52" && !name.includes("[") && !name.includes("]")) {
        skuData[baseArticle].categories.add(categoryId);
        const categoryName = categoriesMap[categoryId] || `Категория ${categoryId}`;
        skuData[baseArticle].categoryDetails.push(`${offerId} - ${categoryName}`);
      }
    });

    // Обновляем метрики с остатками
    const updatedMetrics = metrics.map(metric => {
      if (skuData.hasOwnProperty(metric.article)) {
        return {
          ...metric,
          stock_quantity: skuData[metric.article].total
        };
      }
      return metric;
    });

    console.log(`✅ Остатки обновлены для ${Object.keys(skuData).length} артикулов`);

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
