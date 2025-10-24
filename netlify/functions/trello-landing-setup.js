const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const TRELLO_KEY = process.env.TRELLO_API_KEY || 'e83894111117e54746d899c1fc2f7043';
const TRELLO_TOKEN = process.env.TRELLO_TOKEN || 'ATTAb29683ffc0c87de7b5d1ce766ca8c2d28a61b3c722660564d74dae0a955456aeED83F79A';

// Конфигурация досок для лендингов
const LANDING_BOARDS = {
  main: '642bf848f1f26d0ecc5231da', // Основные лендинги
  test: '63f75d0ae75b1dc37ad0252b'  // Тестовые лендинги
};

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Разрешаем и GET и POST запросы для удобства
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🚀 Starting Trello setup for landing boards...');
    
    const results = {
      main: null,
      test: null,
      errors: []
    };

    // Настраиваем основную доску
    try {
      console.log('📋 Setting up MAIN landing board...');
      const mainBoardId = LANDING_BOARDS.main;
      
      // Получаем информацию о доске
      const boardInfoUrl = `https://api.trello.com/1/boards/${mainBoardId}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
      const boardInfoResponse = await fetch(boardInfoUrl);
      
      if (!boardInfoResponse.ok) {
        throw new Error('Failed to fetch main board info');
      }
      
      const boardInfo = await boardInfoResponse.json();
      
      // Настраиваем webhook
      const webhookUrl = `${process.env.URL}/.netlify/functions/trello-landing-webhook`;
      
      // Удаляем старые webhooks
      const checkWebhooksUrl = `https://api.trello.com/1/tokens/${TRELLO_TOKEN}/webhooks?key=${TRELLO_KEY}`;
      const existingWebhooksResponse = await fetch(checkWebhooksUrl);
      
      if (existingWebhooksResponse.ok) {
        const existingWebhooks = await existingWebhooksResponse.json();
        for (const webhook of existingWebhooks) {
          if (webhook.idModel === boardInfo.id && webhook.callbackURL === webhookUrl) {
            await fetch(`https://api.trello.com/1/webhooks/${webhook.id}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`, {
              method: 'DELETE'
            });
          }
        }
      }

      // Создаем новый webhook
      const createWebhookUrl = `https://api.trello.com/1/webhooks?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
      const webhookResponse = await fetch(createWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'Main Landing Board Webhook',
          callbackURL: webhookUrl,
          idModel: boardInfo.id
        })
      });

      if (!webhookResponse.ok) {
        throw new Error('Failed to create webhook for main board');
      }

      const webhook = await webhookResponse.json();

      // Синхронизируем списки
      const listsUrl = `https://api.trello.com/1/boards/${boardInfo.id}/lists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
      const listsResponse = await fetch(listsUrl);
      
      if (!listsResponse.ok) {
        throw new Error('Failed to fetch lists for main board');
      }
      
      const lists = await listsResponse.json();
      
      // Сохраняем списки
      for (const list of lists) {
        await supabase
          .from('trello_landing_lists')
          .upsert({
            list_id: list.id,
            list_name: list.name,
            board_id: boardInfo.id,
            board_type: 'main',
            position: list.pos
          }, {
            onConflict: 'list_id'
          });
      }

      // Получаем карточки доски
      const cardsUrl = `https://api.trello.com/1/boards/${boardInfo.id}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
      const cardsResponse = await fetch(cardsUrl);
      const cards = cardsResponse.ok ? await cardsResponse.json() : [];

      results.main = {
        boardId: boardInfo.id,
        boardName: boardInfo.name,
        webhookId: webhook.id,
        lists: lists.length,
        cards: cards.length
      };
      
      console.log('✅ Main board configured successfully');
      
    } catch (error) {
      console.error('❌ Error setting up main board:', error);
      results.errors.push({ board: 'main', error: error.message });
    }

    // Настраиваем тестовую доску
    try {
      console.log('📋 Setting up TEST landing board...');
      const testBoardId = LANDING_BOARDS.test;
      
      // Получаем информацию о доске
      const boardInfoUrl = `https://api.trello.com/1/boards/${testBoardId}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
      const boardInfoResponse = await fetch(boardInfoUrl);
      
      if (!boardInfoResponse.ok) {
        throw new Error('Failed to fetch test board info');
      }
      
      const boardInfo = await boardInfoResponse.json();
      
      // Настраиваем webhook
      const webhookUrl = `${process.env.URL}/.netlify/functions/trello-landing-webhook`;
      
      // Удаляем старые webhooks
      const checkWebhooksUrl = `https://api.trello.com/1/tokens/${TRELLO_TOKEN}/webhooks?key=${TRELLO_KEY}`;
      const existingWebhooksResponse = await fetch(checkWebhooksUrl);
      
      if (existingWebhooksResponse.ok) {
        const existingWebhooks = await existingWebhooksResponse.json();
        for (const webhook of existingWebhooks) {
          if (webhook.idModel === boardInfo.id && webhook.callbackURL === webhookUrl) {
            await fetch(`https://api.trello.com/1/webhooks/${webhook.id}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`, {
              method: 'DELETE'
            });
          }
        }
      }

      // Создаем новый webhook
      const createWebhookUrl = `https://api.trello.com/1/webhooks?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
      const webhookResponse = await fetch(createWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'Test Landing Board Webhook',
          callbackURL: webhookUrl,
          idModel: boardInfo.id
        })
      });

      if (!webhookResponse.ok) {
        throw new Error('Failed to create webhook for test board');
      }

      const webhook = await webhookResponse.json();

      // Синхронизируем списки
      const listsUrl = `https://api.trello.com/1/boards/${boardInfo.id}/lists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
      const listsResponse = await fetch(listsUrl);
      
      if (!listsResponse.ok) {
        throw new Error('Failed to fetch lists for test board');
      }
      
      const lists = await listsResponse.json();
      
      // Сохраняем списки
      for (const list of lists) {
        await supabase
          .from('trello_landing_lists')
          .upsert({
            list_id: list.id,
            list_name: list.name,
            board_id: boardInfo.id,
            board_type: 'test',
            position: list.pos
          }, {
            onConflict: 'list_id'
          });
      }

      // Получаем карточки доски
      const cardsUrl = `https://api.trello.com/1/boards/${boardInfo.id}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
      const cardsResponse = await fetch(cardsUrl);
      const cards = cardsResponse.ok ? await cardsResponse.json() : [];

      results.test = {
        boardId: boardInfo.id,
        boardName: boardInfo.name,
        webhookId: webhook.id,
        lists: lists.length,
        cards: cards.length
      };
      
      console.log('✅ Test board configured successfully');
      
    } catch (error) {
      console.error('❌ Error setting up test board:', error);
      results.errors.push({ board: 'test', error: error.message });
    }

    // Если это GET запрос, возвращаем красивую HTML страницу
    if (event.httpMethod === 'GET') {
      const htmlResponse = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Trello Landing Boards Setup</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 0;
              padding: 20px;
            }
            .container {
              background: white;
              border-radius: 20px;
              padding: 40px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              max-width: 600px;
              width: 100%;
            }
            h1 {
              color: #333;
              margin-bottom: 10px;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .success { color: #10b981; }
            .error { color: #ef4444; }
            .board {
              background: #f3f4f6;
              padding: 20px;
              border-radius: 10px;
              margin: 20px 0;
            }
            .board h3 {
              margin-top: 0;
              color: #1f2937;
            }
            .stat {
              display: flex;
              justify-content: space-between;
              padding: 5px 0;
            }
            .stat-label { color: #6b7280; }
            .stat-value { 
              font-weight: bold;
              color: #1f2937;
            }
            .errors {
              background: #fee;
              border: 1px solid #fcc;
              padding: 15px;
              border-radius: 10px;
              margin-top: 20px;
            }
            .success-icon {
              color: #10b981;
              font-size: 24px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
            a {
              color: #667eea;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>
              <span class="success-icon">✅</span>
              Trello Landing Boards Setup
            </h1>
            <p style="color: #6b7280; margin-bottom: 30px;">
              Настройка интеграции с досками Trello для лендингов
            </p>

            ${results.main ? `
              <div class="board">
                <h3>📋 Основная доска лендингов</h3>
                <div class="stat">
                  <span class="stat-label">Board ID:</span>
                  <span class="stat-value">${results.main.boardId}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Название:</span>
                  <span class="stat-value">${results.main.boardName}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Webhook ID:</span>
                  <span class="stat-value">${results.main.webhookId.substring(0, 8)}...</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Колонок:</span>
                  <span class="stat-value">${results.main.lists}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Карточек:</span>
                  <span class="stat-value">${results.main.cards}</span>
                </div>
              </div>
            ` : ''}

            ${results.test ? `
              <div class="board">
                <h3>🧪 Тестовая доска лендингов</h3>
                <div class="stat">
                  <span class="stat-label">Board ID:</span>
                  <span class="stat-value">${results.test.boardId}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Название:</span>
                  <span class="stat-value">${results.test.boardName}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Webhook ID:</span>
                  <span class="stat-value">${results.test.webhookId.substring(0, 8)}...</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Колонок:</span>
                  <span class="stat-value">${results.test.lists}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Карточек:</span>
                  <span class="stat-value">${results.test.cards}</span>
                </div>
              </div>
            ` : ''}

            ${results.errors.length > 0 ? `
              <div class="errors">
                <h3 style="color: #ef4444; margin-top: 0;">⚠️ Ошибки</h3>
                ${results.errors.map(err => `
                  <div style="margin: 10px 0;">
                    <strong>${err.board}:</strong> ${err.error}
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <div class="footer">
              <p>🎉 Интеграция успешно настроена!</p>
              <p>
                <a href="/">← Вернуться в приложение</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'text/html; charset=utf-8'
        },
        body: htmlResponse
      };
    }

    // Для POST запроса возвращаем JSON
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        results
      })
    };

  } catch (error) {
    console.error('❌ Setup error:', error);
    
    // Если это GET запрос, возвращаем HTML страницу с ошибкой
    if (event.httpMethod === 'GET') {
      const errorHtml = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ошибка настройки Trello</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 0;
              padding: 20px;
            }
            .container {
              background: white;
              border-radius: 20px;
              padding: 40px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              max-width: 600px;
              width: 100%;
              text-align: center;
            }
            h1 { color: #ef4444; }
            .error-message {
              background: #fee;
              border: 1px solid #fcc;
              padding: 20px;
              border-radius: 10px;
              margin: 20px 0;
              color: #dc2626;
            }
            a {
              color: #667eea;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Ошибка настройки</h1>
            <div class="error-message">
              ${error.message}
            </div>
            <p>
              <a href="/">← Вернуться в приложение</a>
            </p>
          </div>
        </body>
        </html>
      `;

      return {
        statusCode: 500,
        headers: {
          ...headers,
          'Content-Type': 'text/html; charset=utf-8'
        },
        body: errorHtml
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Setup failed',
        message: error.message
      })
    };
  }
};
