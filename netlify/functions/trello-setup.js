const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const TRELLO_KEY = process.env.TRELLO_API_KEY || 'e83894111117e54746d899c1fc2f7043';
const TRELLO_TOKEN = process.env.TRELLO_TOKEN || 'ATTAb29683ffc0c87de7b5d1ce766ca8c2d28a61b3c722660564d74dae0a955456aeED83F79A';
const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID || 'JWuFAH6M';

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
    console.log('🚀 Starting Trello setup...');

    // 1. Получаем webhook URL
    const webhookUrl = `${process.env.URL}/.netlify/functions/trello-webhook`;
    console.log('🔗 Webhook URL:', webhookUrl);

    // 2. Проверяем существующие webhooks
    const checkWebhooksUrl = `https://api.trello.com/1/tokens/${TRELLO_TOKEN}/webhooks?key=${TRELLO_KEY}`;
    const existingWebhooks = await fetch(checkWebhooksUrl).then(r => r.json());
    
    console.log('📋 Existing webhooks:', existingWebhooks.length);

    // 3. Удаляем старые webhooks для этой доски
    for (const webhook of existingWebhooks) {
      if (webhook.idModel === TRELLO_BOARD_ID) {
        console.log('🗑️ Deleting old webhook:', webhook.id);
        await fetch(`https://api.trello.com/1/webhooks/${webhook.id}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`, {
          method: 'DELETE'
        });
      }
    }

    // 4. Создаем новый webhook
    console.log('📝 Creating new webhook...');
    const createWebhookUrl = `https://api.trello.com/1/webhooks?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
    const webhookResponse = await fetch(createWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Buyer Dashboard Webhook',
        callbackURL: webhookUrl,
        idModel: TRELLO_BOARD_ID
      })
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('❌ Webhook creation failed:', errorText);
      throw new Error(`Failed to create webhook: ${errorText}`);
    }

    const webhook = await webhookResponse.json();
    console.log('✅ Webhook created:', webhook.id);

    // 5. Синхронизируем списки (колонки)
    console.log('📥 Fetching lists...');
    const listsUrl = `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/lists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
    const lists = await fetch(listsUrl).then(r => r.json());
    
    console.log(`📋 Found ${lists.length} lists`);

    // Сохраняем списки в базу
    for (const list of lists) {
      await supabase
        .from('trello_lists')
        .upsert({
          list_id: list.id,
          list_name: list.name,
          board_id: TRELLO_BOARD_ID,
          position: list.pos
        }, {
          onConflict: 'list_id'
        });
    }

    console.log('✅ Lists synced to database');

    // 6. Синхронизируем карточки
    console.log('📥 Fetching cards...');
    const cardsUrl = `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
    const cards = await fetch(cardsUrl).then(r => r.json());
    
    console.log(`🎴 Found ${cards.length} cards`);

    // Получаем все креативы с trello_link
    const { data: creatives, error: creativesError } = await supabase
      .from('creatives')
      .select('id, trello_link')
      .not('trello_link', 'is', null);

    if (creativesError) {
      console.error('❌ Error fetching creatives:', creativesError);
      throw creativesError;
    }

    console.log(`📦 Found ${creatives?.length || 0} creatives with Trello links`);

    // Создаем карту карточек по URL
    const cardsByUrl = new Map();
    cards.forEach(card => {
      cardsByUrl.set(card.shortUrl, card);
      cardsByUrl.set(card.url, card);
    });

    // Обновляем статусы карточек
    let syncedCount = 0;
    for (const creative of creatives || []) {
      const trelloUrl = creative.trello_link;
      const card = cardsByUrl.get(trelloUrl);
      
      if (card) {
        const list = lists.find(l => l.id === card.idList);
        if (list) {
          await supabase
            .from('trello_card_statuses')
            .upsert({
              creative_id: creative.id,
              trello_card_id: card.id,
              list_id: list.id,
              list_name: list.name,
              last_updated: new Date().toISOString()
            }, {
              onConflict: 'creative_id'
            });
          
          syncedCount++;
        }
      }
    }

    console.log(`✅ Synced ${syncedCount} card statuses`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        webhook: {
          id: webhook.id,
          url: webhookUrl
        },
        stats: {
          lists: lists.length,
          cards: cards.length,
          synced: syncedCount
        }
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
