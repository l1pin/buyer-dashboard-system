// src/scripts/offers/Seed_buyers_test.js
// Одноразовый скрипт для заполнения тестовых привязок байеров к офферам
// ВНИМАНИЕ: Запускать только один раз для тестирования!

import { supabase } from '../../supabaseClient';
import { offerBuyersService } from '../../services/OffersSupabase';

/**
 * Заполняет тестовыми данными привязки байеров к офферам
 * - Источник: facebook
 * - 5 случайных байеров к каждому офферу
 */
export async function seedBuyersToOffers() {
  console.log('🚀 Запуск скрипта заполнения тестовых привязок...');

  try {
    // 1. Получаем всех байеров
    console.log('📦 Загружаем список байеров...');
    const { data: buyers, error: buyersError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'buyer');

    if (buyersError) throw buyersError;

    if (!buyers || buyers.length === 0) {
      console.error('❌ Нет байеров в базе!');
      return { success: false, error: 'Нет байеров' };
    }

    console.log(`✅ Найдено ${buyers.length} байеров`);

    // 2. Получаем все офферы (из metrics)
    console.log('📦 Загружаем список офферов...');
    const { data: metrics, error: metricsError } = await supabase
      .from('metrics')
      .select('id, article, name');

    if (metricsError) throw metricsError;

    if (!metrics || metrics.length === 0) {
      console.error('❌ Нет офферов в базе!');
      return { success: false, error: 'Нет офферов' };
    }

    console.log(`✅ Найдено ${metrics.length} офферов`);

    // 3. Фильтруем байеров, у которых есть Facebook source_ids
    const buyersWithFacebook = buyers.filter(buyer => {
      const channels = buyer.buyer_settings?.traffic_channels || [];
      const fbChannels = channels.filter(ch => ch.source === 'facebook' && ch.channel_id);
      return fbChannels.length > 0;
    });

    console.log(`📱 Байеров с Facebook каналами: ${buyersWithFacebook.length}`);

    if (buyersWithFacebook.length < 5) {
      console.warn('⚠️ Недостаточно байеров с Facebook! Используем всех с фейковыми source_ids');
    }

    // 4. Получаем существующие привязки, чтобы не дублировать
    const existingAssignments = await offerBuyersService.getAllAssignments();
    const existingKeys = new Set(
      existingAssignments.map(a => `${a.offer_id}_${a.buyer_id}_${a.source}`)
    );
    console.log(`📋 Существующих привязок: ${existingAssignments.length}`);

    // 5. Для каждого оффера добавляем 5 случайных байеров
    let addedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const offer of metrics) {
      console.log(`\n📌 Оффер #${offer.id}: ${offer.name || offer.article}`);

      // Выбираем 5 случайных байеров
      const shuffled = [...(buyersWithFacebook.length >= 5 ? buyersWithFacebook : buyers)]
        .sort(() => Math.random() - 0.5);
      const selectedBuyers = shuffled.slice(0, 5);

      for (const buyer of selectedBuyers) {
        const key = `${offer.id}_${buyer.id}_facebook`;

        // Пропускаем если уже есть
        if (existingKeys.has(key)) {
          console.log(`  ⏭️ ${buyer.name} уже привязан`);
          skippedCount++;
          continue;
        }

        // Получаем source_ids для facebook
        const channels = buyer.buyer_settings?.traffic_channels || [];
        const fbChannels = channels.filter(ch => ch.source === 'facebook' && ch.channel_id);
        let sourceIds = fbChannels.map(ch => ch.channel_id);

        // Если нет реальных source_ids - генерируем тестовые
        if (sourceIds.length === 0) {
          sourceIds = [`test_${buyer.id.slice(0, 8)}_fb`];
        }

        try {
          await offerBuyersService.addAssignment(
            offer.id,
            buyer.id,
            buyer.name,
            'facebook',
            sourceIds
          );

          console.log(`  ✅ ${buyer.name} привязан (${sourceIds.length} source_ids)`);
          addedCount++;
          existingKeys.add(key); // Добавляем в set чтобы не дублировать

        } catch (err) {
          console.error(`  ❌ Ошибка для ${buyer.name}:`, err.message);
          errors.push({ buyer: buyer.name, offer: offer.id, error: err.message });
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 РЕЗУЛЬТАТ:');
    console.log(`   ✅ Добавлено привязок: ${addedCount}`);
    console.log(`   ⏭️ Пропущено (уже были): ${skippedCount}`);
    console.log(`   ❌ Ошибок: ${errors.length}`);
    console.log('='.repeat(50));

    return {
      success: true,
      added: addedCount,
      skipped: skippedCount,
      errors: errors
    };

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    return { success: false, error: error.message };
  }
}

// Экспорт по умолчанию для удобного импорта
export default seedBuyersToOffers;
