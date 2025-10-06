// netlify/functions/metrics-worker.js
// Worker для обработки батча видео

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BATCH_SIZE = 100; // Видео за раз
const MAX_EXECUTION_TIME = 8000; // 8 секунд (оставляем запас)

exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  console.log('🔧 Worker запущен');

  try {
    const body = JSON.parse(event.body || '{}');
    const { 
      logId, 
      offset = 0, 
      totalVideos = 0,
      isManual = false 
    } = body;

    if (!logId) {
      throw new Error('logId обязателен');
    }

    // Получаем все креативы с видео
    const { data: creatives, error: creativesError } = await supabase
      .from('creatives')
      .select('id, article, link_titles, user_id');

    if (creativesError) throw creativesError;

    console.log(`📊 Получено ${creatives.length} креативов`);

    // Собираем все видео с метаданными
    const allVideos = [];
    creatives.forEach(creative => {
      if (creative.link_titles && creative.link_titles.length > 0) {
        creative.link_titles.forEach((title, index) => {
          if (title && !title.startsWith('Видео ')) {
            allVideos.push({
              creativeId: creative.id,
              article: creative.article,
              videoIndex: index,
              videoTitle: title
            });
          }
        });
      }
    });

    const total = allVideos.length;
    console.log(`📹 Всего видео: ${total}`);

    // Берем текущий батч
    const currentBatch = allVideos.slice(offset, offset + BATCH_SIZE);
    
    if (currentBatch.length === 0) {
      // Все обработано - завершаем
      console.log('✅ Все батчи обработаны');
      
      await supabase
        .from('metrics_auto_update_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          videos_total: total,
          videos_processed: total
        })
        .eq('id', logId);

      return {
        statusCode: 200,
        body: JSON.stringify({ 
          completed: true, 
          total, 
          processed: total 
        })
      };
    }

    console.log(`🔄 Обработка батча: видео ${offset + 1}-${offset + currentBatch.length} из ${total}`);

    // Получаем названия видео для батча
    const videoNames = currentBatch.map(v => v.videoTitle);

    // Запрос к metrics-proxy с force_refresh для автообновления
    const apiUrl = process.env.URL || `https://${event.headers.host}`;
    const metricsResponse = await fetch(`${apiUrl}/.netlify/functions/metrics-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_names: videoNames,
        kind: 'daily_first4_total',
        force_refresh: !isManual // Для автообновления всегда обновляем кэш
      })
    });

    if (!metricsResponse.ok) {
      throw new Error(`Metrics API error: ${metricsResponse.status}`);
    }

    const metricsData = await metricsResponse.json();
    console.log(`📥 Получено ${metricsData.length} записей метрик`);

    // Группируем по видео
    const metricsByVideo = new Map();
    metricsData.forEach(row => {
      if (!metricsByVideo.has(row.video_name)) {
        metricsByVideo.set(row.video_name, { daily: [], first4: null, total: null });
      }
      const entry = metricsByVideo.get(row.video_name);
      if (row.kind === 'daily') entry.daily.push(row);
      else if (row.kind === 'first4') entry.first4 = row;
      else if (row.kind === 'total') entry.total = row;
    });

    // Подготавливаем данные для сохранения
    const cacheDataAll = [];
    const cacheData4Days = [];
    let successCount = 0;

    currentBatch.forEach(video => {
      const metrics = metricsByVideo.get(video.videoTitle);
      
      if (!metrics || !metrics.daily || metrics.daily.length === 0) {
        return;
      }

      // Период "all"
      const allDaily = metrics.daily;
      const totalLeads = allDaily.reduce((sum, d) => sum + (Number(d.leads) || 0), 0);
      const totalCost = allDaily.reduce((sum, d) => sum + (Number(d.cost) || 0), 0);
      const totalClicks = allDaily.reduce((sum, d) => sum + (Number(d.clicks) || 0), 0);
      const totalImpressions = allDaily.reduce((sum, d) => sum + (Number(d.impressions) || 0), 0);
      const avgDuration = allDaily.length > 0 
        ? allDaily.reduce((sum, d) => sum + (Number(d.avg_duration) || 0), 0) / allDaily.length 
        : 0;

      cacheDataAll.push({
        creative_id: video.creativeId,
        article: video.article,
        video_index: video.videoIndex,
        video_title: video.videoTitle,
        period: 'all',
        leads: totalLeads,
        cost: totalCost,
        clicks: totalClicks,
        impressions: totalImpressions,
        avg_duration: avgDuration,
        days_count: allDaily.length,
        cached_at: new Date().toISOString()
      });

      // Период "4days"
      const first4Daily = allDaily.slice(0, 4);
      if (first4Daily.length > 0) {
        const leads4 = first4Daily.reduce((sum, d) => sum + (Number(d.leads) || 0), 0);
        const cost4 = first4Daily.reduce((sum, d) => sum + (Number(d.cost) || 0), 0);
        const clicks4 = first4Daily.reduce((sum, d) => sum + (Number(d.clicks) || 0), 0);
        const impressions4 = first4Daily.reduce((sum, d) => sum + (Number(d.impressions) || 0), 0);
        const avgDuration4 = first4Daily.reduce((sum, d) => sum + (Number(d.avg_duration) || 0), 0) / first4Daily.length;

        cacheData4Days.push({
          creative_id: video.creativeId,
          article: video.article,
          video_index: video.videoIndex,
          video_title: video.videoTitle,
          period: '4days',
          leads: leads4,
          cost: cost4,
          clicks: clicks4,
          impressions: impressions4,
          avg_duration: avgDuration4,
          days_count: first4Daily.length,
          cached_at: new Date().toISOString()
        });
      }

      successCount++;
    });

    // Сохраняем в кэш батчами
    const allCacheData = [...cacheDataAll, ...cacheData4Days];
    
    if (allCacheData.length > 0) {
      const { error: cacheError } = await supabase
        .from('metrics_cache')
        .upsert(allCacheData, {
          onConflict: 'creative_id,video_index,period'
        });

      if (cacheError) {
        console.error('❌ Ошибка сохранения в кэш:', cacheError);
      } else {
        console.log(`✅ Сохранено ${allCacheData.length} записей в кэш`);
      }
    }

    // Обновляем лог
    await supabase
      .from('metrics_auto_update_log')
      .update({
        videos_processed: offset + currentBatch.length,
        videos_success: successCount
      })
      .eq('id', logId);

    // Проверяем время выполнения
    const elapsed = Date.now() - startTime;
    const nextOffset = offset + BATCH_SIZE;
    
    if (nextOffset < total && elapsed < MAX_EXECUTION_TIME) {
      // Есть еще данные - вызываем себя снова
      console.log(`⏩ Запускаем следующий батч (offset: ${nextOffset})`);
      
      const apiUrl = process.env.URL || `https://${event.headers.host}`;
      const nextResponse = await fetch(`${apiUrl}/.netlify/functions/metrics-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logId,
          offset: nextOffset,
          totalVideos: total,
          isManual
        })
      });

      const nextResult = await nextResponse.json();
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          completed: nextResult.completed,
          processed: nextOffset + currentBatch.length,
          total
        })
      };
    }

    // Возвращаем прогресс
    return {
      statusCode: 200,
      body: JSON.stringify({
        completed: nextOffset >= total,
        processed: offset + currentBatch.length,
        total
      })
    };

  } catch (error) {
    console.error('❌ Ошибка в worker:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message 
      })
    };
  }
};
