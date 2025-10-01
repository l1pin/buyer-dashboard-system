// scripts/updateMetricsCache.js
const fetch = require('node-fetch');
require('dotenv').config();

const NETLIFY_URL = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';

async function updateCache() {
  try {
    console.log('🔄 Запуск обновления кеша метрик...');
    console.log(`📡 URL: ${NETLIFY_URL}/.netlify/functions/update-all-metrics`);

    const response = await fetch(`${NETLIFY_URL}/.netlify/functions/update-all-metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Обновление завершено:');
    console.log(`  📊 Обновлено: ${result.updated}`);
    console.log(`  ❌ Ошибок: ${result.failed}`);
    console.log(`  ⏱️  Время: ${result.duration}`);

  } catch (error) {
    console.error('❌ Ошибка обновления кеша:', error.message);
    process.exit(1);
  }
}

updateCache();
