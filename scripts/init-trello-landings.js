const SITE_URL = process.argv[2] || 'https://buyers-dashbord-test.netlify.app';

async function initializeTrelloLandings() {
  console.log('🚀 Инициализация Trello интеграции для лендингов...');
  console.log('🌐 Site URL:', SITE_URL);
  
  try {
    const setupUrl = `${SITE_URL}/.netlify/functions/trello-landing-setup`;
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
    
    if (result.results.main) {
      console.log('📋 Основная доска лендингов:');
      console.log('   - ID:', result.results.main.boardId);
      console.log('   - Название:', result.results.main.boardName);
      console.log('   - Webhook ID:', result.results.main.webhookId);
      console.log('   - Колонок:', result.results.main.lists);
    }
    
    if (result.results.test) {
      console.log('\n📋 Тестовая доска лендингов:');
      console.log('   - ID:', result.results.test.boardId);
      console.log('   - Название:', result.results.test.boardName);
      console.log('   - Webhook ID:', result.results.test.webhookId);
      console.log('   - Колонок:', result.results.test.lists);
    }
    
    if (result.results.errors.length > 0) {
      console.log('\n⚠️ Ошибки:');
      result.results.errors.forEach(err => {
        console.log(`   - ${err.board}: ${err.error}`);
      });
    }
    
    console.log('\n🎉 Trello интеграция для лендингов активна!\n');
    
  } catch (error) {
    console.error('\n❌ ОШИБКА НАСТРОЙКИ:', error.message);
    process.exit(1);
  }
}

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

initializeTrelloLandings();
