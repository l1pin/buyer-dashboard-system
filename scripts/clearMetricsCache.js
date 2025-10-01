// scripts/clearMetricsCache.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Не найдены переменные окружения для Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearCache() {
  try {
    console.log('🧹 Очистка кеша метрик...');

    const { error } = await supabase
      .from('metrics_cache')
      .delete()
      .neq('id', 0);

    if (error) {
      throw error;
    }

    console.log('✅ Кеш успешно очищен');

  } catch (error) {
    console.error('❌ Ошибка очистки кеша:', error.message);
    process.exit(1);
  }
}

clearCache();
