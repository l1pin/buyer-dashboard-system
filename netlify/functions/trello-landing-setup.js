const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const TRELLO_KEY = process.env.TRELLO_API_KEY || 'e83894111117e54746d899c1fc2f7043';
const TRELLO_TOKEN = process.env.TRELLO_TOKEN || 'ATTAb29683ffc0c87de7b5d1ce766ca8c2d28a61b3c722660564d74dae0a955456aeED83F79A';

// Конфигурация досок для лендингов
const LANDING_BOARDS = {
  main: 'JWuFAH6M', // Основные лендинги
  test: 'zDMOMvHt'  // Тестовые лендинги
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

      results.main = {
        boardId: boardInfo.id,
        boardName: boardInfo.name,
        webhookId: webhook.id,
        lists: lists.length
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

      results.test = {
        boardId: boardInfo.id,
        boardName: boardInfo.name,
        webhookId: webhook.id,
        lists: lists.length
      };
      
      console.log('✅ Test board configured successfully');
      
    } catch (error) {
      console.error('❌ Error setting up test board:', error);
      results.errors.push({ board: 'test', error: error.message });
    }

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
