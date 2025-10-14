const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const TRELLO_KEY = process.env.TRELLO_API_KEY || 'e83894111117e54746d899c1fc2f7043';
const TRELLO_TOKEN = process.env.TRELLO_TOKEN || 'ATTAb29683ffc0c87de7b5d1ce766ca8c2d28a61b3c722660564d74dae0a955456aeED83F79A';
const TRELLO_BOARD_SHORT_ID = process.env.TRELLO_BOARD_ID || 'JWuFAH6M';

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
    console.log('📋 Board Short ID:', TRELLO_BOARD_SHORT_ID);

    // 1. Получаем полную информацию о доске (включая полный ID)
    console.log('🔍 Fetching board info...');
    const boardInfoUrl = `https://api.trello.com/1/boards/${TRELLO_BOARD_SHORT_ID}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
    const boardInfoResponse = await fetch(boardInfoUrl);
    
    if (!boardInfoResponse.ok) {
      const errorText = await boardInfoResponse.text();
      console.error('❌ Failed to fetch board info:', errorText);
      throw new Error(`Failed to fetch board info: ${errorText}`);
    }
    
    const boardInfo = await boardInfoResponse.json();
    const TRELLO_BOARD_ID = boardInfo.id; // Полный ID доски
    
    console.log('✅ Board info:', {
      id: TRELLO_BOARD_ID,
      name: boardInfo.name,
      shortLink: boardInfo.shortLink
    });

    // 2. Получаем webhook URL
    const webhookUrl = `${process.env.URL}/.netlify/functions/trello-webhook`;
    console.log('🔗 Webhook URL:', webhookUrl);

    // 3. Проверяем существующие webhooks
    console.log('🔍 Checking existing webhooks...');
    const checkWebhooksUrl = `https://api.trello.com/1/tokens/${TRELLO_TOKEN}/webhooks?key=${TRELLO_KEY}`;
    const existingWebhooksResponse = await fetch(checkWebhooksUrl);
    
    if (!existingWebhooksResponse.ok) {
      console.error('⚠️ Failed to check webhooks, continuing anyway...');
    } else {
      const existingWebhooks = await existingWebhooksResponse.json();
      console.log('📋 Existing webhooks:', existingWebhooks.length);

      // 4. Удаляем старые webhooks для этой доски
      for (const webhook of existingWebhooks) {
        if (webhook.idModel === TRELLO_BOARD_ID || webhook.callbackURL === webhookUrl) {
          console.log('🗑️ Deleting old webhook:', webhook.id);
          try {
            await fetch(`https://api.trello.com/1/webhooks/${webhook.id}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`, {
              method: 'DELETE'
            });
          } catch (deleteError) {
            console.error('⚠️ Failed to delete webhook:', deleteError.message);
          }
        }
      }
    }

    // 5. Создаем новый webhook
    console.log('📝 Creating new webhook...');
    console.log('📦 Webhook data:', {
      idModel: TRELLO_BOARD_ID,
      callbackURL: webhookUrl,
      description: 'Buyer Dashboard Webhook'
    });
    
    const createWebhookUrl = `https://api.trello.com/1/webhooks?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
    const webhookResponse = await fetch(createWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Buyer Dashboard Webhook',
        callbackURL: webhookUrl,
        idModel: TRELLO_BOARD_ID // Используем ПОЛНЫЙ ID
      })
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('❌ Webhook creation failed:', errorText);
      throw new Error(`Failed to create webhook: ${errorText}`);
    }

    const webhook = await webhookResponse.json();
    console.log('✅ Webhook created:', {
      id: webhook.id,
      active: webhook.active,
      idModel: webhook.idModel
    });

    // 6. Синхронизируем списки (колонки)
    console.log('📥 Fetching lists...');
    const listsUrl = `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/lists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
    const listsResponse = await fetch(listsUrl);
    
    if (!listsResponse.ok) {
      const errorText = await listsResponse.text();
      console.error('❌ Failed to fetch lists:', errorText);
      throw new Error(`Failed to fetch lists: ${errorText}`);
    }
    
    const lists = await listsResponse.json();
    console.log(`📋 Found ${lists.length} lists:`, lists.map(l => l.name));

    // Сохраняем списки в базу
    for (const list of lists) {
      const { error: listError } = await supabase
        .from('trello_lists')
        .upsert({
          list_id: list.id,
          list_name: list.name,
          board_id: TRELLO_BOARD_ID,
          position: list.pos
        }, {
          onConflict: 'list_id'
        });
      
      if (listError) {
        console.error('⚠️ Error saving list:', list.name, listError);
      }
    }

    console.log('✅ Lists synced to database');

    // 7. Синхронизируем карточки
    console.log('📥 Fetching cards...');
    const cardsUrl = `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
    const cardsResponse = await fetch(cardsUrl);
    
    if (!cardsResponse.ok) {
      const errorText = await cardsResponse.text();
      console.error('❌ Failed to fetch cards:', errorText);
      throw new Error(`Failed to fetch cards: ${errorText}`);
    }
    
    const cards = await cardsResponse.json();
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
    const cardsByShortUrl = new Map();
    
    cards.forEach(card => {
      // Полный URL
      if (card.url) {
        cardsByUrl.set(card.url, card);
      }
      // Короткий URL
      if (card.shortUrl) {
        cardsByShortUrl.set(card.shortUrl, card);
      }
      // Вариант без протокола
      if (card.url) {
        const urlWithoutProtocol = card.url.replace(/^https?:\/\//, '');
        cardsByUrl.set(urlWithoutProtocol, card);
      }
      if (card.shortUrl) {
        const shortUrlWithoutProtocol = card.shortUrl.replace(/^https?:\/\//, '');
        cardsByShortUrl.set(shortUrlWithoutProtocol, card);
      }
    });

    console.log('🗺️ Card URL map created:', {
      totalCards: cards.length,
      urlMappings: cardsByUrl.size,
      shortUrlMappings: cardsByShortUrl.size
    });

    // Обновляем статусы карточек
    let syncedCount = 0;
    let notFoundCount = 0;
    
    for (const creative of creatives || []) {
      let trelloUrl = creative.trello_link;
      
      if (!trelloUrl) continue;
      
      // Нормализуем URL
      const normalizedUrl = trelloUrl.replace(/^https?:\/\//, '').trim();
      
      // Ищем карточку по разным вариантам URL
      let card = cardsByUrl.get(trelloUrl) || 
                 cardsByShortUrl.get(trelloUrl) ||
                 cardsByUrl.get(normalizedUrl) ||
                 cardsByShortUrl.get(normalizedUrl);
      
      if (card) {
        const list = lists.find(l => l.id === card.idList);
        if (list) {
          const { error: statusError } = await supabase
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
          
          if (statusError) {
            console.error('⚠️ Error syncing status:', statusError);
          } else {
            syncedCount++;
          }
        }
      } else {
        notFoundCount++;
        console.log('⚠️ Card not found for URL:', trelloUrl);
      }
    }

    console.log(`✅ Synced ${syncedCount} card statuses`);
    console.log(`⚠️ ${notFoundCount} cards not found`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        webhook: {
          id: webhook.id,
          url: webhookUrl,
          active: webhook.active
        },
        board: {
          id: TRELLO_BOARD_ID,
          name: boardInfo.name,
          shortLink: boardInfo.shortLink
        },
        stats: {
          lists: lists.length,
          cards: cards.length,
          synced: syncedCount,
          notFound: notFoundCount,
          creativesWithLinks: creatives?.length || 0
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
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
