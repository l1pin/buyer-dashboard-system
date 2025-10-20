// src/utils/creativeBroadcast.js
/**
 * Утилита для broadcast обновлений креативов между компонентами/табами
 */

const CHANNEL_NAME = 'creative-updates';

let broadcastChannel = null;

// Инициализация канала
export const initCreativeBroadcast = () => {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    console.log('📡 BroadcastChannel инициализирован');
  } else {
    console.warn('⚠️ BroadcastChannel не поддерживается браузером');
  }
};

// Отправка события о новом креативе
export const broadcastNewCreative = (creativeData) => {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: 'NEW_CREATIVE',
      data: creativeData,
      timestamp: Date.now()
    });
    console.log('📤 Broadcast: новый креатив', creativeData.article);
  }
};

// Отправка события об обновлении креатива
export const broadcastUpdateCreative = (creativeData) => {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: 'UPDATE_CREATIVE',
      data: creativeData,
      timestamp: Date.now()
    });
    console.log('📤 Broadcast: обновление креатива', creativeData.article);
  }
};

// Отправка события об удалении креатива
export const broadcastDeleteCreative = (creativeId) => {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: 'DELETE_CREATIVE',
      data: { id: creativeId },
      timestamp: Date.now()
    });
    console.log('📤 Broadcast: удаление креатива', creativeId);
  }
};

// Подписка на события
export const subscribeToCreativeUpdates = (callback) => {
  if (!broadcastChannel) {
    initCreativeBroadcast();
  }
  
  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      console.log('📥 Получено broadcast сообщение:', event.data.type);
      callback(event.data);
    };
    
    return () => {
      if (broadcastChannel) {
        broadcastChannel.onmessage = null;
      }
    };
  }
  
  return () => {};
};

// Закрытие канала
export const closeCreativeBroadcast = () => {
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
    console.log('📡 BroadcastChannel закрыт');
  }
};
