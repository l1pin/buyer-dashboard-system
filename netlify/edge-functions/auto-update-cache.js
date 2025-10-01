export default async (request, context) => {
  console.log('🚀 Автоматическое обновление кеша метрик в 04:00');
  
  try {
    const siteUrl = new URL(request.url).origin;
    const response = await fetch(`${siteUrl}/.netlify/functions/update-all-metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Обновлено видео: ${result.updated}, ошибок: ${result.failed}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Ошибка автообновления:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  schedule: '0 1 * * *' // 04:00 по Киеву (зимнее время) = 01:00 UTC, 03:00 UTC (летнее время) = 04:00 Киев
};
