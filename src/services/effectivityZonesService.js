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
      console.log(`✅ Получены данные для ${data.length} офферов`);

      // Преобразуем в Map для быстрого доступа по SKU
      const zonesMap = new Map();

      for (const row of data) {
        const sku = row.salesdrive_sku;
        if (!sku) continue;

        try {
          // Парсим JSON поля
          const effectivityZone = row.effectivity_zone
            ? JSON.parse(row.effectivity_zone)
            : null;

          const lastResultConversions = row.last_result_conversions
            ? JSON.parse(row.last_result_conversions)
            : null;

          const investPrice = parseFloat(row.av_offer_invest_price) || 0;

          // Рассчитываем цены лидов для каждой зоны
          const zonePrices = this.calculateZonePrices(
            effectivityZone,
            lastResultConversions,
            investPrice
          );

          // Рассчитываем Отказ и Невыкуп
          const approvePercent = parseFloat(row.approve_percent_oper);
          const soldPercent = parseFloat(row.sold_percent_oper);

          // Отказ = 100% - approve%
          const refusalPercent = !isNaN(approvePercent) ? Math.round((100 - approvePercent) * 100) / 100 : null;
          // Невыкуп = 100% - sold%
          const noPickupPercent = !isNaN(soldPercent) ? Math.round((100 - soldPercent) * 100) / 100 : null;

          zonesMap.set(sku, {
            sku,
            offer_name: row.offer_name,
            invest_price: investPrice,
            effectivity_zone: effectivityZone,
            roi_type: lastResultConversions?.effectivity_zone?.roi_type || lastResultConversions?.roi_type || 'UAH',
            // Отказ и Невыкуп
            refusal_sales_percent: refusalPercent,
            no_pickup_percent: noPickupPercent,
            ...zonePrices
          });

        } catch (parseError) {
          console.warn(`⚠️ Ошибка парсинга данных для SKU ${sku}:`, parseError);
        }
      }

      return zonesMap;

    } catch (error) {
      console.error('❌ Ошибка получения зон эффективности:', error);
      throw error;
    }
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
        green_zone_price: null,  // first = зелёная (лучшая)
        gold_zone_price: null,   // second = золотая
        pink_zone_price: null,   // third = розовая
        red_zone_price: null,    // fourth = красная (худшая)
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
      // Маппинг: first=зелёная, second=золотая, third=розовая, fourth=красная
      green_zone_price: calculatePrice(effectivityZone.first),
      gold_zone_price: calculatePrice(effectivityZone.second),
      pink_zone_price: calculatePrice(effectivityZone.third),
      red_zone_price: calculatePrice(effectivityZone.fourth),
      zone_thresholds: {
        green: effectivityZone.first,
        gold: effectivityZone.second,
        pink: effectivityZone.third,
        red: effectivityZone.fourth
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

    // Зоны от лучшей к худшей: green > gold > pink > red > SOS
    if (actualRoi >= thresholds.green) return 'Зелёная зона';
    if (actualRoi >= thresholds.gold) return 'Золотая зона';
    if (actualRoi >= thresholds.pink) return 'Розовая зона';
    if (actualRoi >= thresholds.red) return 'Красная зона';
    return 'SOS зона';
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

        // Определяем текущую зону по факт. ROI
        const currentZone = this.determineOfferZone(
          metric.actual_roi_percent,
          zoneData.zone_thresholds
        );

        return {
          ...metric,
          // Обновляем цены зон
          red_zone_price: zoneData.red_zone_price,
          pink_zone_price: zoneData.pink_zone_price,
          gold_zone_price: zoneData.gold_zone_price,
          green_zone_price: zoneData.green_zone_price,
          // Обновляем зону если есть факт. ROI
          offer_zone: currentZone || metric.offer_zone,
          // Обновляем Отказ и Невыкуп
          refusal_sales_percent: zoneData.refusal_sales_percent,
          no_pickup_percent: zoneData.no_pickup_percent,
          // Дополнительные данные
          zone_thresholds: zoneData.zone_thresholds,
          zone_roi_type: zoneData.roi_type,
          invest_price: zoneData.invest_price,
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
