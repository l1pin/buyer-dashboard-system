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
    console.log('📦 Webhook payload:', JSON.stringify(body, null, 2));

    const action = body.action;
    if (!action) {
      console.log('⚠️ No action in webhook payload');
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    // Обрабатываем только события перемещения карточки
    if (action.type === 'updateCard' && action.data.listAfter) {
      const cardId = action.data.card.id;
      const listAfter = action.data.listAfter;
      
      console.log(`🔄 Card moved: ${cardId} to list: ${listAfter.name} (${listAfter.id})`);

      // Находим креатив по trello_card_id
      const { data: existingStatus } = await supabase
        .from('trello_card_statuses')
        .select('creative_id, trello_card_id')
        .eq('trello_card_id', cardId)
        .single();

      if (existingStatus) {
        // Обновляем статус карточки
        const { error: updateError } = await supabase
          .from('trello_card_statuses')
          .update({
            list_id: listAfter.id,
            list_name: listAfter.name,
            last_updated: new Date().toISOString()
          })
          .eq('trello_card_id', cardId);

        if (updateError) {
          console.error('❌ Error updating card status:', updateError);
          throw updateError;
        }

        console.log(`✅ Updated status for creative ${existingStatus.creative_id}`);
      } else {
        console.log(`⚠️ No creative found for card ${cardId}`);
      }

      // Обновляем информацию о списке
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
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
