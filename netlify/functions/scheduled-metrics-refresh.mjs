// netlify/functions/scheduled-metrics-refresh.mjs
// Scheduled Function - триггерит background function каждые 15 минут
// Сама выполняется за секунды, вся работа в background-metrics-refresh.mjs

// ==================== КОНФИГ ====================
export const config = {
  schedule: "*/15 * * * *"  // Каждые 15 минут
};

// ==================== HANDLER ====================
export default async function handler(event, context) {
  console.log('========================================');
  console.log('🕐 SCHEDULED TRIGGER - запуск background function');
  console.log(`⏰ Время: ${new Date().toISOString()}`);
  console.log('========================================');

  try {
    // Получаем URL сайта из контекста или env
    const siteUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    const backgroundUrl = `${siteUrl}/.netlify/functions/background-metrics-refresh`;

    console.log(`📡 Вызываем: ${backgroundUrl}`);

    // Вызываем background function (она вернёт 202 сразу, работа в фоне)
    const response = await fetch(backgroundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trigger-Source': 'scheduled'
      },
      body: JSON.stringify({ triggered_at: new Date().toISOString() })
    });

    console.log(`✅ Background function запущена, статус: ${response.status}`);

    // Scheduled function завершается, background продолжает работать
    return;

  } catch (error) {
    console.error('❌ Ошибка запуска background function:', error.message);
    return;
  }
}
