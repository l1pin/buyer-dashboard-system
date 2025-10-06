// netlify/functions/scheduled-metrics-update.js
// CRON функция - запускается каждый час

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  console.log('⏰ CRON: Автообновление метрик запущено');

  try {
    // Создаем запись в логе
    const { data: logEntry, error: logError } = await supabase
      .from('metrics_auto_update_log')
      .insert([{
        started_at: new Date().toISOString(),
        status: 'running',
        is_manual: false
      }])
      .select()
      .single();

    if (logError) throw logError;

    console.log(`📝 Создан лог #${logEntry.id}`);

    // Запускаем worker
    const apiUrl = process.env.URL || `https://${event.headers.host}`;
    const workerUrl = `${apiUrl}/.netlify/functions/metrics-worker`;
    
    console.log(`🚀 Запуск worker по URL: ${workerUrl}`);
    
    const workerResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logId: logEntry.id,
        offset: 0,
        isManual: false
      })
    });

    if (!workerResponse.ok) {
      throw new Error(`Worker error: ${workerResponse.status}`);
    }

    const result = await workerResponse.json();
    console.log('✅ Worker запущен:', result);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        logId: logEntry.id,
        message: 'Автообновление метрик запущено'
      })
    };

  } catch (error) {
    console.error('❌ Ошибка CRON:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
