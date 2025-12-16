/**
 * Скрипт для обновления остатков товаров из API базы данных
 *
 * Этот модуль содержит функцию для загрузки остатков из offers_collection
 * через API и обновления метрик.
 */

const API_URL = "https://api.trll-notif.com.ua/adsreportcollector/core.php";

/**
 * Обновляет остатки товаров из API базы данных
 *
 * @param {Array} metrics - Массив метрик офферов
 * @returns {Promise<Object>} - Обновленный массив метрик с остатками
 * @throws {Error} - Выбрасывает ошибку при проблемах с загрузкой
 */
export const updateStocksFromYml = async (metrics) => {
  try {
    console.log('🔄 Начинаем загрузку остатков из БД...');

    // Собираем уникальные артикулы из метрик
    const articles = [...new Set(metrics.map(m => m.article).filter(Boolean))];

    if (articles.length === 0) {
      console.log('⚠️ Нет артикулов для загрузки остатков');
      return {
        metrics: metrics,
        skuData: {},
        totalArticles: 0
      };
    }

    console.log(`📦 Загружаем остатки для ${articles.length} артикулов`);

    // Разбиваем на батчи по 100 артикулов (ограничение SQL запроса)
    const BATCH_SIZE = 100;
    const batches = [];
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      batches.push(articles.slice(i, i + BATCH_SIZE));
    }

    const skuData = {};

    // Загружаем батчи параллельно (но не больше 5 одновременно)
    const PARALLEL_LIMIT = 5;
    for (let i = 0; i < batches.length; i += PARALLEL_LIMIT) {
      const batchPromises = batches.slice(i, i + PARALLEL_LIMIT).map(async (batch) => {
        // Формируем SQL запрос с IN
        const skuList = batch.map(sku => `'${sku}'`).join(', ');
        const sql = `SELECT salesdrive_sku, arr_modifications FROM offers_collection WHERE salesdrive_sku IN (${skuList})`;

        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            assoc: true,
            sql: sql
          })
        });

        if (!response.ok) {
          throw new Error(`Ошибка API: ${response.status}`);
        }

        return response.json();
      });

      const results = await Promise.all(batchPromises);

      // Обрабатываем результаты
      for (const data of results) {
        if (!Array.isArray(data)) continue;

        for (const row of data) {
          const sku = row.salesdrive_sku;
          if (!sku) continue;

          try {
            // Парсим arr_modifications (это JSON строка)
            const modifications = JSON.parse(row.arr_modifications || '{}');

            // Суммируем остатки по всем модификациям
            let totalStock = 0;
            let categoryName = '';
            const modificationsList = [];
            const modificationsDisplay = [];

            for (const [modKey, modData] of Object.entries(modifications)) {
              const stock = parseInt(modData.intStock) || 0;
              totalStock += stock;

              // Берем категорию из первой модификации
              if (!categoryName && modData.strCategoryName) {
                categoryName = modData.strCategoryName;
              }

              // Формируем список модификаций для отображения
              const name = modData.strName || modKey;
              const price = parseFloat(modData.intSellPrice) || 0;

              modificationsList.push(`${name} ${stock} шт - ${price.toFixed(2)} грн`);
              modificationsDisplay.push(`${name} - ${stock} шт.`);
            }

            skuData[sku] = {
              total: totalStock,
              modifications: modificationsList,
              modificationsDisplay: modificationsDisplay,
              categories: new Set([categoryName].filter(Boolean)),
              categoryDetails: categoryName ? [`${sku} - ${categoryName}`] : [],
              categoryName: categoryName
            };

          } catch (parseError) {
            console.warn(`⚠️ Ошибка парсинга модификаций для ${sku}:`, parseError);
          }
        }
      }
    }

    console.log(`✅ Загружено остатков для ${Object.keys(skuData).length} артикулов`);

    // Обновляем метрики с остатками
    const updatedMetrics = metrics.map(metric => {
      if (skuData.hasOwnProperty(metric.article)) {
        const articleData = skuData[metric.article];
        return {
          ...metric,
          stock_quantity: articleData.total,
          category: articleData.categoryName || metric.category,
          categoryDetails: articleData.categoryDetails
        };
      }
      return metric;
    });

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
 * @param {Object} skuData - Данные о товарах
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
 * @param {Object} skuData - Данные о товарах
 * @returns {Array} - Массив категорий товара
 */
export const getCategoriesByArticle = (article, skuData) => {
  const baseArticle = article.split("-")[0];
  return skuData[baseArticle]?.categoryDetails || [];
};
