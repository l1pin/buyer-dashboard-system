// Скрипт для одноразовой начальной настройки Trello интеграции
// Запускается один раз после deploy

const SITE_URL = process.argv[2] || 'https://buyers-dashbord-test.netlify.app';

async function initializeTrello() {
  console.log('🚀 Инициализация Trello интеграции...');
  console.log('🌐 Site URL:', SITE_URL);
  
  try {
    const setupUrl = `${SITE_URL}/.netlify/functions/trello-setup`;
    console.log('📡 Вызов:', setupUrl);
    
    const response = await fetch(setupUrl, {
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
    
    console.log('\n✅ УСПЕШНО НАСТРОЕНО!\n');
    console.log('📋 Доска:', result.board.name);
    console.log('🔗 Webhook ID:', result.webhook.id);
    console.log('📊 Статистика:');
    console.log('   - Колонок:', result.stats.lists);
    console.log('   - Карточек в Trello:', result.stats.cards);
    console.log('   - Креативов с ссылками:', result.stats.creativesWithLinks);
    console.log('   - Синхронизировано:', result.stats.synced);
    console.log('   - Не найдено:', result.stats.notFound);
    console.log('\n🎉 Trello интеграция активна! Статусы будут обновляться автоматически.\n');
    
  } catch (error) {
    console.error('\n❌ ОШИБКА НАСТРОЙКИ:', error.message);
    console.error('\nПроверьте:');
    console.error('1. URL сайта правильный');
    console.error('2. Netlify Functions задеплоились');
    console.error('3. Environment Variables настроены в Netlify');
    console.error('4. Токен Trello имеет права на доску\n');
    process.exit(1);
  }
}

// Импорт fetch для Node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

initializeTrello();
