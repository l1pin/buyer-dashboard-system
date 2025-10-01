// scripts/getCacheStats.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Не найдены переменные окружения для Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getCacheStats() {
  try {
    console.log('📊 Получение статистики кеша...\n');

    // Общее количество записей
    const { count, error: countError } = await supabase
      .from('metrics_cache')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`📝 Всего закешировано видео: ${count}`);

    // Последнее обновление
    const { data: lastUpdate, error: lastError } = await supabase
      .from('metrics_cache')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    if (!lastError && lastUpdate) {
      console.log(`🕐 Последнее обновление: ${new Date(lastUpdate.last_updated).toLocaleString('ru-RU')}`);
    }

    // Логи обновлений
    const { data: logs, error: logsError } = await supabase
      .from('metrics_cache_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5);

    if (!logsError && logs && logs.length > 0) {
      console.log('\n📋 Последние 5 обновлений:');
      logs.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.update_type === 'auto' ? '🤖 Авто' : '👤 Ручное'} - ${log.videos_updated} успешно, ${log.videos_failed} ошибок - ${new Date(log.started_at).toLocaleString('ru-RU')}`);
      });
    }

    console.log('\n✅ Статистика получена');

  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error.message);
    process.exit(1);
  }
}

getCacheStats();
