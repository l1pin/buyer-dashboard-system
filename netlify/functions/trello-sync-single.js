const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const TRELLO_KEY = process.env.TRELLO_API_KEY || 'e83894111117e54746d899c1fc2f7043';
const TRELLO_TOKEN = process.env.TRELLO_TOKEN || 'ATTAb29683ffc0c87de7b5d1ce766ca8c2d28a61b3c722660564d74dae0a955456aeED83F79A';

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
    const { creativeId, trelloLink } = JSON.parse(event.body || '{}');

    if (!creativeId || !trelloLink) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required parameters',
          message: 'creativeId and trelloLink are required'
        })
      };
    }

    console.log('🔄 Синхронизация Trello карточки для креатива:', creativeId);
    console.log('🔗 Trello link:', trelloLink);

    // КРИТИЧНО: Извлекаем короткий ID из ОРИГИНАЛЬНОГО URL (до нормализации)
    // Формат: /c/SHORT_ID/... (короткий ID всегда латиница и цифры)
    const shortIdMatch = trelloLink.match(/\/c\/([a-zA-Z0-9]+)(?:\/|$)/);
    if (!shortIdMatch) {
      throw new Error('Неверный формат ссылки Trello');
    }

    const shortId = shortIdMatch[1];
    console.log('🆔 Extracted short ID from original URL:', shortId);

    // КРИТИЧНО: Trello API работает с короткими ID напрямую
    // Получаем информацию о карточке через API
    console.log('📡 Запрос к Trello API для карточки...');
    const cardUrl = `https://api.trello.com/1/cards/${shortId}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&fields=id,idList,name`;
    const cardResponse = await fetch(cardUrl);

    if (!cardResponse.ok) {
      const errorText = await cardResponse.text();
      console.error('❌ Ошибка API Trello (card):', cardResponse.status, errorText);
      throw new Error(`Не удалось получить информацию о карточке: ${cardResponse.status}`);
    }

    const card = await cardResponse.json();
    console.log('📋 Card data:', { id: card.id, name: card.name, idList: card.idList });

    // Получаем информацию о списке
    console.log('📡 Запрос к Trello API для списка...');
    const listUrl = `https://api.trello.com/1/lists/${card.idList}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&fields=name`;
    const listResponse = await fetch(listUrl);

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('❌ Ошибка API Trello (list):', listResponse.status, errorText);
      throw new Error(`Не удалось получить информацию о списке: ${listResponse.status}`);
    }

    const list = await listResponse.json();
    console.log('📂 List data:', { id: list.id, name: list.name });

    // Обновляем информацию о списке в базе
    await supabase
      .from('trello_lists')
      .upsert({
        list_id: card.idList,
        list_name: list.name,
        board_id: 'JWuFAH6M', // ID доски из env
        position: 0
      }, {
        onConflict: 'list_id'
      });

    // Обновляем статус в базе
    console.log('💾 Сохранение статуса в БД...');
    const { data, error } = await supabase
      .from('trello_card_statuses')
      .upsert({
        creative_id: creativeId,
        trello_card_id: card.id,
        list_id: card.idList,
        list_name: list.name,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'creative_id'
      })
      .select();

    if (error) {
      console.error('❌ Ошибка сохранения в БД:', error);
      throw error;
    }

    console.log('✅ Статус сохранен в БД:', data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        listName: list.name,
        cardId: card.id,
        listId: card.idList
      })
    };

  } catch (error) {
    console.error('❌ Sync error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Sync failed',
        message: error.message
      })
    };
  }
};
