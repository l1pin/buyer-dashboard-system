// src/services/metricsAnalyticsService.js
import { supabase } from '../supabaseClient';

class MetricsAnalyticsService {
  /**
   * Получить зональные данные для списка артикулов (батчевый запрос)
   */
  async getZoneDataByArticles(articles) {
    try {
      if (!articles || articles.length === 0) {
        return new Map();
      }

      console.log(`🎯 Батчевый поиск зональных данных для ${articles.length} артикулов`);

      const { data, error } = await supabase
        .from('metrics_analytics')
        .select('article, red_zone_price, pink_zone_price, gold_zone_price, green_zone_price, offer_zone')
        .in('article', articles);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        console.log(`❌ Зональные данные не найдены ни для одного из ${articles.length} артикулов`);
        return new Map();
      }

      console.log(`✅ Найдены зональные данные для ${data.length}/${articles.length} артикулов`);
      console.log('📦 Пример данных из БД:', data[0]);

      // Создаем Map для быстрого доступа
      const zoneDataMap = new Map();
      data.forEach(item => {
        // Преобразуем строковые значения цен в числа
        const processedItem = {
          ...item,
          red_zone_price: item.red_zone_price ? parseFloat(item.red_zone_price) : null,
          pink_zone_price: item.pink_zone_price ? parseFloat(item.pink_zone_price) : null,
          gold_zone_price: item.gold_zone_price ? parseFloat(item.gold_zone_price) : null,
          green_zone_price: item.green_zone_price ? parseFloat(item.green_zone_price) : null
        };
        
        console.log(`📊 Обработка зон для ${item.article}:`, {
          red: processedItem.red_zone_price,
          pink: processedItem.pink_zone_price,
          gold: processedItem.gold_zone_price,
          green: processedItem.green_zone_price
        });
        
        zoneDataMap.set(item.article, processedItem);
      });

      return zoneDataMap;
    } catch (error) {
      console.error('❌ Ошибка получения зональных данных:', error);
      throw error;
    }
  }

  /**
   * Форматирование зональных данных для отображения
   */
  formatZoneData(zoneData) {
    if (!zoneData) {
      return null;
    }

    // Функция для безопасного преобразования значения в число
    const parsePrice = (value) => {
      if (value === null || value === undefined || value === '' || value === '—') {
        return null;
      }
      
      // Если уже число
      if (typeof value === 'number') {
        return value;
      }
      
      // Если строка - парсим
      const parsed = parseFloat(String(value).replace(',', '.'));
      return isNaN(parsed) ? null : parsed;
    };

    const redPrice = parsePrice(zoneData.red_zone_price);
    const pinkPrice = parsePrice(zoneData.pink_zone_price);
    const goldPrice = parsePrice(zoneData.gold_zone_price);
    const greenPrice = parsePrice(zoneData.green_zone_price);

    console.log(`🎨 Форматирование зон для ${zoneData.article}:`, {
      red: redPrice,
      pink: pinkPrice,
      gold: goldPrice,
      green: greenPrice
    });

    return {
      red: redPrice !== null ? `$${redPrice.toFixed(2)}` : '—',
      pink: pinkPrice !== null ? `$${pinkPrice.toFixed(2)}` : '—',
      gold: goldPrice !== null ? `$${goldPrice.toFixed(2)}` : '—',
      green: greenPrice !== null ? `$${greenPrice.toFixed(2)}` : '—',
      currentZone: zoneData.offer_zone || '—'
    };
  }

  /**
   * Получить все метрики (для страницы Метрики аналитика)
   */
  async getAllMetricsLarge() {
    try {
      console.log('🔄 Загрузка метрик из таблицы metrics_analytics...');

      const { data, error, count } = await supabase
        .from('metrics_analytics')
        .select('*', { count: 'exact' })
        .order('id', { ascending: true });

      if (error) {
        throw error;
      }

      // Получаем последнее обновление
      const { data: lastUpdate } = await supabase
        .from('metrics_analytics')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        metrics: data || [],
        lastUpdated: lastUpdate?.created_at || null,
        actualCount: data?.length || 0,
        totalRecords: count || 0,
        databaseCount: data?.length || 0
      };
    } catch (error) {
      console.error('❌ Ошибка загрузки метрик:', error);
      throw error;
    }
  }

  /**
   * Загрузить метрики из CSV
   */
  async uploadMetrics(metrics) {
    try {
      console.log(`📤 Загрузка ${metrics.length} записей метрик...`);

      // Удаляем все старые записи
      const { error: deleteError } = await supabase
        .from('metrics_analytics')
        .delete()
        .neq('id', 0); // Удаляем все записи

      if (deleteError) {
        console.error('❌ Ошибка удаления старых записей:', deleteError);
        throw deleteError;
      }

      console.log('✅ Старые записи удалены');

      // Вставляем новые записи батчами по 1000
      const batchSize = 1000;
      let inserted = 0;

      for (let i = 0; i < metrics.length; i += batchSize) {
        const batch = metrics.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('metrics_analytics')
          .insert(batch);

        if (insertError) {
          console.error(`❌ Ошибка вставки батча ${i}-${i + batch.length}:`, insertError);
          throw insertError;
        }

        inserted += batch.length;
        console.log(`✅ Вставлено ${inserted}/${metrics.length} записей`);
      }

      return {
        count: inserted,
        total: metrics.length
      };
    } catch (error) {
      console.error('❌ Ошибка загрузки метрик:', error);
      throw error;
    }
  }

  /**
   * Получить время последнего обновления метрик
   */
  async getMetricsLastUpdate() {
    try {
      const { data, error } = await supabase
        .from('metrics_analytics')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      return data?.created_at || null;
    } catch (error) {
      console.error('❌ Ошибка получения времени обновления:', error);
      return null;
    }
  }

  /**
   * Получить метрики из кэша
   */
  async getMetricsCache(creativeId, videoIndex, period) {
    try {
      const { data, error } = await supabase
        .from('metrics_cache')
        .select('*')
        .eq('creative_id', creativeId)
        .eq('video_index', videoIndex)
        .eq('period', period)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Запись не найдена
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ Ошибка чтения кэша метрик:', error);
      return null;
    }
  }

  /**
   * Сохранить метрики в кэш
   */
  async saveMetricsCache(creativeId, article, videoIndex, videoName, metricsData, period) {
    try {
      const cacheEntry = {
        creative_id: creativeId,
        article: article,
        video_index: videoIndex,
        video_name: videoName,
        period: period,
        metrics_data: metricsData,
        cached_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('metrics_cache')
        .upsert(cacheEntry, {
          onConflict: 'creative_id,video_index,period'
        });

      if (error) throw error;

      console.log(`✅ Метрики сохранены в кэш для ${videoName} (${period})`);
    } catch (error) {
      console.error('❌ Ошибка сохранения в кэш:', error);
      throw error;
    }
  }
}

// Создаем единственный экземпляр сервиса
const metricsAnalyticsService = new MetricsAnalyticsService();

export { metricsAnalyticsService };
export default metricsAnalyticsService;
