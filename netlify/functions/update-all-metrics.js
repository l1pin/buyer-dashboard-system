const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const METRICS_PROXY_URL = '/.netlify/functions/metrics-proxy';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Метод не поддерживается' })
    };
  }

  const startTime = Date.now();

  try {
    console.log('📊 Получение всех креативов...');

    const { data: creatives, error } = await supabase
      .from('creatives')
      .select('link_titles');

    if (error) throw error;

    // Собираем уникальные названия видео
    const videoNames = new Set();
    creatives.forEach(creative => {
      if (creative.link_titles && Array.isArray(creative.link_titles)) {
        creative.link_titles.forEach(title => {
          if (title && !title.startsWith('Видео ')) {
            videoNames.add(title);
          }
        });
      }
    });

    const uniqueVideos = Array.from(videoNames);
    console.log(`🎯 Найдено ${uniqueVideos.length} уникальных видео`);

    if (uniqueVideos.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ updated: 0, failed: 0 })
      };
    }

    let updated = 0;
    let failed = 0;
    const BATCH_SIZE = 5;
    const BATCH_DELAY = 1000;

    for (let i = 0; i < uniqueVideos.length; i += BATCH_SIZE) {
      const batch = uniqueVideos.slice(i, i + BATCH_SIZE);
      console.log(`Батч ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uniqueVideos.length / BATCH_SIZE)}`);

      const results = await Promise.allSettled(
        batch.map(async (videoName) => {
          const sql = buildSql(videoName);
          const metricsResponse = await fetch(
            `https://${event.headers.host}${METRICS_PROXY_URL}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sql })
            }
          );

          if (!metricsResponse.ok) throw new Error(`HTTP ${metricsResponse.status}`);

          const rawData = await metricsResponse.json();
          if (!rawData || rawData.length === 0) throw new Error('Нет данных');

          const processedData = processMetrics(rawData, videoName);

          await supabase
            .from('metrics_cache')
            .upsert({
              video_name: videoName,
              metrics_data: processedData,
              last_updated: new Date().toISOString()
            }, { onConflict: 'video_name' });

          return { success: true };
        })
      );

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          updated++;
        } else {
          failed++;
        }
      });

      if (i + BATCH_SIZE < uniqueVideos.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Завершено за ${duration}с: ${updated} успешно, ${failed} ошибок`);

    await supabase.from('metrics_cache_logs').insert({
      update_type: 'auto',
      videos_updated: updated,
      videos_failed: failed,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ updated, failed, duration: `${duration}s` })
    };

  } catch (error) {
    console.error('❌ Ошибка:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function buildSql(videoName) {
  const escaped = videoName.replace(/'/g, "''");
  return `
    SELECT
      adv_date,
      COALESCE(SUM(valid), 0) AS leads,
      COALESCE(SUM(cost), 0) AS cost,
      COALESCE(SUM(clicks_on_link_tracker), 0) AS clicks,
      COALESCE(SUM(showed), 0) AS impressions,
      COALESCE(AVG(average_time_on_video), 0) AS avg_duration
    FROM ads_collection
    WHERE video_name='${escaped}'
      AND (cost > 0 OR valid > 0 OR showed > 0 OR clicks_on_link_tracker > 0)
    GROUP BY adv_date
    ORDER BY adv_date ASC
  `;
}

function processMetrics(rawData, videoName) {
  const dailyData = normalizeDailyData(rawData);
  const agg = aggregate(dailyData);
  const metrics = compute(agg);
  const formatted = format(metrics);

  return {
    raw: metrics,
    formatted,
    allDailyData: dailyData,
    dailyData,
    videoName,
    period: 'all',
    updatedAt: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Kiev' })
  };
}

function normalizeDailyData(data) {
  if (!data || data.length === 0) return [];
  
  let normalized = [];
  if (typeof data[0] === 'object' && !Array.isArray(data[0])) {
    normalized = data.map(r => ({
      date: r.adv_date,
      leads: Number(r.leads) || 0,
      cost: Number(r.cost) || 0,
      clicks: Number(r.clicks) || 0,
      impressions: Number(r.impressions) || 0,
      avg_duration: Number(r.avg_duration) || 0
    }));
  } else {
    const headers = data[0];
    normalized = data.slice(1).map(row => {
      const m = {};
      headers.forEach((h, i) => (m[h] = row[i]));
      return {
        date: m.adv_date,
        leads: Number(m.leads) || 0,
        cost: Number(m.cost) || 0,
        clicks: Number(m.clicks) || 0,
        impressions: Number(m.impressions) || 0,
        avg_duration: Number(m.avg_duration) || 0
      };
    });
  }
  
  return normalized.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function aggregate(daily) {
  const r = daily.reduce((a, d) => ({
    leads: a.leads + d.leads,
    cost: a.cost + d.cost,
    clicks: a.clicks + d.clicks,
    impressions: a.impressions + d.impressions,
    dur_sum: a.dur_sum + d.avg_duration,
    days: a.days + 1
  }), { leads: 0, cost: 0, clicks: 0, impressions: 0, dur_sum: 0, days: 0 });
  
  return {
    leads: r.leads,
    cost: r.cost,
    clicks: r.clicks,
    impressions: r.impressions,
    avg_duration: r.days > 0 ? r.dur_sum / r.days : 0,
    days_count: r.days
  };
}

function compute({ leads, cost, clicks, impressions, avg_duration, days_count }) {
  const f = x => Number.isFinite(x) ? Number(x.toFixed(2)) : 0;
  return {
    leads,
    cost: f(cost),
    clicks,
    impressions,
    avg_duration: f(avg_duration),
    days_count,
    cpl: f(leads > 0 ? cost / leads : 0),
    ctr_percent: f(impressions > 0 ? (clicks / impressions) * 100 : 0),
    cpc: f(clicks > 0 ? cost / clicks : 0),
    cpm: f(impressions > 0 ? (cost / impressions) * 1000 : 0)
  };
}

function format(m) {
  return {
    leads: String(Math.round(m.leads)),
    cpl: m.cpl.toFixed(2) + '$',
    cost: m.cost.toFixed(2) + '$',
    ctr: m.ctr_percent.toFixed(2) + '%',
    cpc: m.cpc.toFixed(2) + '$',
    cpm: m.cpm.toFixed(2) + '$',
    clicks: String(Math.round(m.clicks)),
    impressions: String(Math.round(m.impressions)),
    avg_duration: m.avg_duration.toFixed(1) + 'с',
    days: String(m.days_count) + ' дн.'
  };
}
