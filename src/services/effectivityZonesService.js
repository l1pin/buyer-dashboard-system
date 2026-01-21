// src/services/effectivityZonesService.js
// Сервис для получения зон эффективности из API offers_collection

const OFFERS_API_URL = "https://api.trll-notif.com.ua/adsreportcollector/core.php";

class EffectivityZonesService {
  /**
   * Экранирование строки для SQL
   */
  escapeString(str) {
    return String(str).replace(/'/g, "''");
  }

  /**
   * Получить данные зон эффективности по списку SKU (артикулов)
   * @param {string[]} skuList - массив артикулов
   * @returns {Promise<Map<string, object>>} - Map с данными по SKU
   */
  async getEffectivityZonesBySKU(skuList) {
    if (!skuList || skuList.length === 0) {
      console.log('⚠️ Пустой список SKU для получения зон');
      return new Map();
    }

    // Фильтруем пустые и null значения
    const validSkuList = skuList.filter(sku => sku && sku.trim());
    if (validSkuList.length === 0) {
      return new Map();
    }

    console.log(`📊 Запрос зон эффективности для ${validSkuList.length} артикулов`);

    // Формируем IN clause
    const inClause = validSkuList
      .map(sku => `'${this.escapeString(sku.trim())}'`)
      .join(',');

    const sql = `
      SELECT
        salesdrive_sku,
        offer_name,
        effectivity_zone,
        last_result_conversions,
        av_offer_invest_price,
        approve_percent_oper,
        sold_percent_oper
      FROM offers_collection
      WHERE salesdrive_sku IN (${inClause})
    `;

    try {
      const response = await fetch(OFFERS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assoc: true,
          sql: sql
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      // Проверяем что data - это массив
      if (!Array.isArray(data)) {
        console.warn('⚠️ API вернул не массив:', typeof data, data);
        // Если это объект с полем data - используем его
        const dataArray = data?.data || data?.rows || data?.result || [];
        if (!Array.isArray(dataArray)) {
          console.error('❌ Не удалось получить массив данных из API');
          return new Map();
        }
        console.log(`✅ Получены данные для ${dataArray.length} офферов (из вложенного поля)`);
        return this.processApiData(dataArray);
      }

      console.log(`✅ Получены данные для ${data.length} офферов`);
      return this.processApiData(data);

    } catch (error) {
      console.error('❌ Ошибка получения зон эффективности:', error);
      throw error;
    }
  }

  /**
   * Обработать массив данных от API и преобразовать в Map
   * @param {array} data - массив данных от API
   * @returns {Map} - Map с данными по SKU
   */
  processApiData(data) {
    const zonesMap = new Map();

    for (const row of data) {
      const sku = row.salesdrive_sku;
      if (!sku) continue;

      try {
        // Парсим JSON поля (могут быть строками или уже объектами)
        let effectivityZoneRoot = null;
        if (row.effectivity_zone) {
          effectivityZoneRoot = typeof row.effectivity_zone === 'string'
            ? JSON.parse(row.effectivity_zone)
            : row.effectivity_zone;
        }

        let lastResultConversions = null;
        if (row.last_result_conversions) {
          lastResultConversions = typeof row.last_result_conversions === 'string'
            ? JSON.parse(row.last_result_conversions)
            : row.last_result_conversions;
        }

        // ВАЖНО: Берём зоны напрямую из effectivity_zone (там CPL зоны!)
        const effectivityZone = effectivityZoneRoot;

        // Цены зон берём напрямую (это уже CPL значения)
        const zonePrices = {
          red_zone_price: effectivityZone?.first ? parseFloat(effectivityZone.first) : null,
          pink_zone_price: effectivityZone?.second ? parseFloat(effectivityZone.second) : null,
          gold_zone_price: effectivityZone?.third ? parseFloat(effectivityZone.third) : null,
          green_zone_price: effectivityZone?.fourth ? parseFloat(effectivityZone.fourth) : null,
        };

        // Получаем Апрув и Выкуп напрямую
        const approvePercent = parseFloat(row.approve_percent_oper);
        const soldPercent = parseFloat(row.sold_percent_oper);

        // Апрув и Выкуп - просто значения из API
        const approveValue = !isNaN(approvePercent) ? Math.round(approvePercent * 100) / 100 : null;
        const soldValue = !isNaN(soldPercent) ? Math.round(soldPercent * 100) / 100 : null;

        zonesMap.set(sku, {
          sku,
          offer_name: row.offer_name,
          // Апрув и Выкуп (напрямую из API)
          approve_percent: approveValue,
          sold_percent: soldValue,
          // CPL зоны
          ...zonePrices
        });

      } catch (parseError) {
        console.warn(`⚠️ Ошибка парсинга данных для SKU ${sku}:`, parseError);
      }
    }

    return zonesMap;
  }

  /**
   * Рассчитать цены лидов для каждой зоны
   * @param {object} effectivityZone - пороги зон {first, second, third, fourth}
   * @param {object} lastResultConversions - метаданные с roi_type
   * @param {number} investPrice - инвестиционная цена
   * @returns {object} - цены для каждой зоны
   */
  calculateZonePrices(effectivityZone, lastResultConversions, investPrice) {
    if (!effectivityZone) {
      return {
        red_zone_price: null,    // first = красная (худшая)
        pink_zone_price: null,   // second = розовая
        gold_zone_price: null,   // third = золотая
        green_zone_price: null,  // fourth = зелёная (лучшая)
        zone_thresholds: null
      };
    }

    // Определяем тип ROI (UAH или %)
    const metaZone = lastResultConversions?.effectivity_zone || lastResultConversions || {};
    const roiType = metaZone.roi_type || 'UAH';

    // Функция расчёта цены лида
    const calculatePrice = (zoneValue) => {
      if (zoneValue == null) return null;

      if (roiType === 'UAH') {
        // Значение уже в гривнах
        return Math.round(zoneValue * 100) / 100;
      } else {
        // Значение в процентах - рассчитываем от инвест. цены
        return Math.round((investPrice * (zoneValue / 100)) * 100) / 100;
      }
    };

    return {
      // Маппинг ОБРАТНЫЙ: first=красная, second=розовая, third=золотая, fourth=зелёная
      red_zone_price: calculatePrice(effectivityZone.first),
      pink_zone_price: calculatePrice(effectivityZone.second),
      gold_zone_price: calculatePrice(effectivityZone.third),
      green_zone_price: calculatePrice(effectivityZone.fourth),
      zone_thresholds: {
        red: effectivityZone.first,
        pink: effectivityZone.second,
        gold: effectivityZone.third,
        green: effectivityZone.fourth
      },
      roi_type: roiType
    };
  }

  /**
   * Определить текущую зону оффера на основе факт. ROI
   * @param {number} actualRoi - фактический ROI
   * @param {object} thresholds - пороги зон
   * @returns {string} - название зоны
   */
  determineOfferZone(actualRoi, thresholds) {
    if (!thresholds || actualRoi == null) return null;

    // Зоны от лучшей к худшей: green (fourth) > gold (third) > pink (second) > red (first) > SOS
    if (actualRoi >= thresholds.green) return 'Зелёная зона';
    if (actualRoi >= thresholds.gold) return 'Золотая зона';
    if (actualRoi >= thresholds.pink) return 'Розовая зона';
    if (actualRoi >= thresholds.red) return 'Красная зона';
    return 'SOS зона';
  }

  /**
   * Получить zone_history по offer_id
   * @param {string} offerId - ID оффера в offers_collection
   * @returns {Promise<object|null>} - объект zone_history или null
   */
  async getZoneHistoryByOfferId(offerId) {
    if (!offerId) {
      return null;
    }

    const sql = `
      SELECT zone_history
      FROM offers_collection
      WHERE id = '${this.escapeString(offerId)}'
    `;

    try {
      const response = await fetch(OFFERS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assoc: true, sql })
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const row = data?.[0];

      if (!row?.zone_history) {
        return null;
      }

      // Парсим JSON если это строка
      const zoneHistory = typeof row.zone_history === 'string'
        ? JSON.parse(row.zone_history)
        : row.zone_history;

      return zoneHistory;

    } catch (error) {
      console.error('❌ Ошибка получения zone_history:', error);
      return null;
    }
  }

  /**
   * Рассчитать среднюю first зону за указанные даты
   * @param {object} zoneHistory - объект zone_history
   * @param {string[]} dates - массив дат (формат YYYY-MM-DD)
   * @returns {object} - { avgFirstZone, zonesByDate }
   */
  calculateAvgZoneForDates(zoneHistory, dates) {
    if (!zoneHistory || !dates?.length) {
      return { avgFirstZone: null, zonesByDate: [] };
    }

    const zonesByDate = [];
    let totalFirst = 0;
    let countFirst = 0;

    for (const date of dates) {
      const dayData = zoneHistory[date];
      if (dayData?.effectivity_zone) {
        const zone = dayData.effectivity_zone;
        // Проверяем что зоны не нулевые
        if (zone.first && zone.first > 0) {
          zonesByDate.push({
            date,
            first: parseFloat(zone.first) || 0,
            second: parseFloat(zone.second) || 0,
            third: parseFloat(zone.third) || 0,
            fourth: parseFloat(zone.fourth) || 0
          });
          totalFirst += parseFloat(zone.first) || 0;
          countFirst++;
        }
      }
    }

    // Сортируем по дате (от новых к старым)
    zonesByDate.sort((a, b) => new Date(b.date) - new Date(a.date));

    const avgFirstZone = countFirst > 0 ? totalFirst / countFirst : null;

    return {
      avgFirstZone: avgFirstZone ? Math.round(avgFirstZone * 100) / 100 : null,
      zonesByDate
    };
  }

  /**
   * Обновить метрики с данными зон эффективности
   * @param {array} metrics - массив метрик с полем article
   * @returns {Promise<array>} - метрики с добавленными данными зон
   */
  async enrichMetricsWithZones(metrics) {
    if (!metrics || metrics.length === 0) {
      return metrics;
    }

    // Собираем уникальные артикулы
    const uniqueSkus = [...new Set(metrics.map(m => m.article).filter(Boolean))];

    if (uniqueSkus.length === 0) {
      console.log('⚠️ Нет артикулов для обогащения метрик');
      return metrics;
    }

    console.log(`🔄 Обогащение ${metrics.length} метрик данными зон для ${uniqueSkus.length} артикулов`);

    try {
      const zonesMap = await this.getEffectivityZonesBySKU(uniqueSkus);

      // Обогащаем метрики данными зон
      return metrics.map(metric => {
        const zoneData = zonesMap.get(metric.article);

        if (!zoneData) {
          return metric; // Оставляем как есть если нет данных
        }

        return {
          ...metric,
          // CPL зоны (напрямую из effectivity_zone)
          red_zone_price: zoneData.red_zone_price,
          pink_zone_price: zoneData.pink_zone_price,
          gold_zone_price: zoneData.gold_zone_price,
          green_zone_price: zoneData.green_zone_price,
          // Апрув и Выкуп (напрямую из API)
          approve_percent: zoneData.approve_percent,
          sold_percent: zoneData.sold_percent,
          // Флаг что данные обновлены из API
          zones_from_api: true
        };
      });

    } catch (error) {
      console.error('❌ Ошибка обогащения метрик:', error);
      // В случае ошибки возвращаем исходные метрики
      return metrics;
    }
  }
}

export const effectivityZonesService = new EffectivityZonesService();
export default effectivityZonesService;
