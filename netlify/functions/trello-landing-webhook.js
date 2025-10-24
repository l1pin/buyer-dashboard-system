const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'HEAD') {
    console.log('✅ Trello landing webhook verification HEAD request');
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    console.log('✅ Trello landing webhook health check');
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ 
        status: 'ok', 
        message: 'Trello landing webhook endpoint is working',
        timestamp: new Date().toISOString()
      }) 
    };
  }

  try {
    console.log('📥 Received landing webhook from Trello');
    
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const body = JSON.parse(event.body);
    console.log('📦 Landing webhook event type:', body.action?.type);

    const action = body.action;
    if (!action) {
      console.log('⚠️ No action in webhook payload');
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    // Обрабатываем события перемещения карточки
    if (action.type === 'updateCard') {
      const cardId = action.data.card.id;
      const cardUrl = action.data.card.shortUrl || action.data.card.url;
      
      console.log('📋 Landing card update:', {
        id: cardId,
        url: cardUrl,
        hasListAfter: !!action.data.listAfter,
        hasListBefore: !!action.data.listBefore
      });

      // Проверяем, было ли изменение списка
      if (action.data.listAfter) {
        const listAfter = action.data.listAfter;
        const boardId = action.data.board.id;
        
        // Определяем тип доски
        const LANDING_BOARDS = {
          main: '642bf848f1f26d0ecc5231da',
          test: '63f75d0ae75b1dc37ad0252b'
        };
        
        let boardType = null;
        if (boardId === LANDING_BOARDS.main) {
          boardType = 'main';
        } else if (boardId === LANDING_BOARDS.test) {
          boardType = 'test';
        }
        
        if (!boardType) {
          console.log('⚠️ Unknown board ID:', boardId);
          return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
        }

        console.log(`🔄 Landing card moved to: ${listAfter.name} on ${boardType} board`);

        // Обновляем информацию о списке
        await supabase
          .from('trello_landing_lists')
          .upsert({
            list_id: listAfter.id,
            list_name: listAfter.name,
            board_id: boardId,
            board_type: boardType,
            position: 0
          }, {
            onConflict: 'list_id'
          });

        // Извлекаем короткий ID из URL карточки
        let shortId = null;
        if (cardUrl) {
          const shortIdMatch = cardUrl.match(/\/c\/([a-zA-Z0-9]+)(?:\/|$)/);
          if (shortIdMatch) {
            shortId = shortIdMatch[1];
            console.log('🆔 Extracted short ID from card URL:', shortId);
          }
        }

        // Ищем лендинг по Trello card ID или по short ID в URL
        console.log('🔍 Searching for landing with card ID or URL...');
        
        // Сначала пробуем найти по card ID
        let result = await supabase
          .from('trello_landing_statuses')
          .select('landing_id')
          .eq('trello_card_id', cardId);

        let landingIds = result.data?.map(s => s.landing_id) || [];

        // Если не нашли по card ID и есть URL, ищем по URL в таблице landings
        if (landingIds.length === 0 && cardUrl) {
          console.log('🔍 Searching by URL pattern in landings table...');
          
          // Получаем все лендинги с trello_link
          const { data: landings } = await supabase
            .from('landings')
            .select('id, trello_link')
            .not('trello_link', 'is', null);

          if (landings) {
            // Проверяем каждый лендинг
            for (const landing of landings) {
              if (landing.trello_link) {
                // Извлекаем short ID из сохраненной ссылки
                const linkMatch = landing.trello_link.match(/\/c\/([a-zA-Z0-9]+)(?:\/|$)/);
                if (linkMatch && linkMatch[1] === shortId) {
                  landingIds.push(landing.id);
                  console.log(`✅ Found landing by URL match: ${landing.id}`);
                }
              }
            }
          }
        }

        if (landingIds.length > 0) {
          console.log(`✅ Found ${landingIds.length} landing(s) to update`);
          
          // Обновляем статус для всех найденных лендингов
          for (const landingId of landingIds) {
            const { error } = await supabase
              .from('trello_landing_statuses')
              .upsert({
                landing_id: landingId,
                trello_card_id: cardId,
                list_id: listAfter.id,
                list_name: listAfter.name,
                board_type: boardType,
                last_updated: new Date().toISOString()
              }, {
                onConflict: 'landing_id'
              });

            if (!error) {
              console.log(`✅ Updated status for landing ${landingId} to ${listAfter.name}`);
            } else {
              console.error(`⚠️ Error updating status for landing ${landingId}:`, error);
            }
          }
        } else {
          console.log(`⚠️ No landing found for card ${cardId}`);
        }
      }
    }

    // Обрабатываем создание карточки
    if (action.type === 'createCard') {
      const card = action.data.card;
      const list = action.data.list;
      const boardId = action.data.board.id;
      
      // Определяем тип доски
      const LANDING_BOARDS = {
        main: '6muoYGe8',
        test: 'zDMOMvHt'
      };
      
      let boardType = null;
      if (boardId === LANDING_BOARDS.main) {
        boardType = 'main';
      } else if (boardId === LANDING_BOARDS.test) {
        boardType = 'test';
      }
      
      if (boardType) {
        console.log(`➕ New landing card created: ${card.name} in ${list.name} on ${boardType} board`);
        
        await supabase
          .from('trello_landing_lists')
          .upsert({
            list_id: list.id,
            list_name: list.name,
            board_id: boardId,
            board_type: boardType,
            position: 0
          }, {
            onConflict: 'list_id'
          });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('❌ Landing webhook processing error:', error);
    console.error('Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
