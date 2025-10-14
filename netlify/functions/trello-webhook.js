const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // Разрешаем CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS'
  };

  // Обработка preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // HEAD запрос для верификации webhook (Trello делает это при создании)
  if (event.httpMethod === 'HEAD') {
    console.log('✅ Trello webhook verification HEAD request');
    return { statusCode: 200, headers, body: '' };
  }

  // GET запрос для проверки работоспособности
  if (event.httpMethod === 'GET') {
    console.log('✅ Trello webhook health check');
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ 
        status: 'ok', 
        message: 'Trello webhook endpoint is working',
        timestamp: new Date().toISOString()
      }) 
    };
  }

  try {
    console.log('📥 Received webhook from Trello');
    
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const body = JSON.parse(event.body);
    console.log('📦 Webhook event type:', body.action?.type);

    const action = body.action;
    if (!action) {
      console.log('⚠️ No action in webhook payload');
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    // Обрабатываем события перемещения карточки
    if (action.type === 'updateCard') {
      const cardId = action.data.card.id;
      const cardUrl = action.data.card.shortUrl || action.data.card.url;
      
      console.log('📋 Card update:', {
        id: cardId,
        url: cardUrl,
        hasListAfter: !!action.data.listAfter,
        hasListBefore: !!action.data.listBefore
      });

      // Проверяем, было ли изменение списка
      if (action.data.listAfter && action.data.listBefore) {
        const listAfter = action.data.listAfter;
        const listBefore = action.data.listBefore;
        
        console.log(`🔄 Card moved: ${cardId}`);
        console.log(`   From: ${listBefore.name} (${listBefore.id})`);
        console.log(`   To: ${listAfter.name} (${listAfter.id})`);

        // Обновляем информацию о списках
        await supabase
          .from('trello_lists')
          .upsert([
            {
              list_id: listBefore.id,
              list_name: listBefore.name,
              board_id: action.data.board.id,
              position: 0
            },
            {
              list_id: listAfter.id,
              list_name: listAfter.name,
              board_id: action.data.board.id,
              position: 0
            }
          ], {
            onConflict: 'list_id'
          });

        // Находим креативы по trello_card_id ИЛИ по URL
        let updatedCount = 0;
        
        // Вариант 1: Поиск по trello_card_id
        const { data: statusByCardId, error: error1 } = await supabase
          .from('trello_card_statuses')
          .update({
            list_id: listAfter.id,
            list_name: listAfter.name,
            last_updated: new Date().toISOString()
          })
          .eq('trello_card_id', cardId)
          .select();

        if (statusByCardId && statusByCardId.length > 0) {
          updatedCount += statusByCardId.length;
          console.log(`✅ Updated ${statusByCardId.length} status(es) by card ID`);
        }

        // Вариант 2: Поиск по URL в таблице креативов
        if (cardUrl && updatedCount === 0) {
          console.log('🔍 Searching by URL:', cardUrl);
          
          // Нормализуем URL из webhook
          const normalizeUrl = (url) => {
            if (!url) return '';
            let normalized = url.split('?')[0].split('#')[0];
            normalized = normalized.replace(/^https?:\/\//, '');
            normalized = normalized.replace(/\/$/, '');
            return normalized.toLowerCase();
          };
          
          const normalizedCardUrl = normalizeUrl(cardUrl);
          console.log('🔍 Normalized URL:', normalizedCardUrl);
          
          // Получаем все креативы с trello_link
          const { data: allCreatives, error: creativesError } = await supabase
            .from('creatives')
            .select('id, trello_link')
            .not('trello_link', 'is', null);

          if (creativesError) {
            console.error('❌ Error fetching creatives:', creativesError);
          } else if (allCreatives && allCreatives.length > 0) {
            console.log(`📦 Checking ${allCreatives.length} creatives with Trello links`);
            
            // Ищем совпадение по нормализованному URL
            const matchedCreatives = allCreatives.filter(creative => {
              const normalizedCreativeUrl = normalizeUrl(creative.trello_link);
              return normalizedCreativeUrl === normalizedCardUrl;
            });
            
            console.log(`📦 Found ${matchedCreatives.length} matching creative(s)`);
            
            for (const creative of matchedCreatives) {
              console.log(`✅ Updating creative: ${creative.id}`);
              
              const { error: upsertError } = await supabase
                .from('trello_card_statuses')
                .upsert({
                  creative_id: creative.id,
                  trello_card_id: cardId,
                  list_id: listAfter.id,
                  list_name: listAfter.name,
                  last_updated: new Date().toISOString()
                }, {
                  onConflict: 'creative_id'
                });

              if (!upsertError) {
                updatedCount++;
                console.log(`✅ Updated status for creative ${creative.id}`);
              } else {
                console.error('⚠️ Error upserting status:', upsertError);
              }
            }
          }
        }

        if (updatedCount > 0) {
          console.log(`✅ Total updated: ${updatedCount} status(es)`);
        } else {
          console.log(`⚠️ No creative found for card ${cardId} (${cardUrl})`);
        }
      } else if (action.data.listAfter) {
        // Карточка добавлена в список (создание)
        const listAfter = action.data.listAfter;
        console.log(`➕ Card added to list: ${listAfter.name}`);
        
        // Обновляем список
        await supabase
          .from('trello_lists')
          .upsert({
            list_id: listAfter.id,
            list_name: listAfter.name,
            board_id: action.data.board.id,
            position: 0
          }, {
            onConflict: 'list_id'
          });
      }
    }

    // Обрабатываем создание карточки
    if (action.type === 'createCard') {
      const card = action.data.card;
      const list = action.data.list;
      
      console.log(`➕ New card created: ${card.name} in ${list.name}`);
      
      // Обновляем список
      await supabase
        .from('trello_lists')
        .upsert({
          list_id: list.id,
          list_name: list.name,
          board_id: action.data.board.id,
          position: 0
        }, {
          onConflict: 'list_id'
        });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
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
