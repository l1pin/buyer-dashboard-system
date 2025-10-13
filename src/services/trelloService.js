// src/services/trelloService.js
// Сервис для работы с Trello API

const TRELLO_CONFIG = {
  key: "e83894111117e54746d899c1fc2f7043",
  token: "ATTAb29683ffc0c87de7b5d1ce766ca8c2d28a61b3c722660564d74dae0a955456aeED83F79A",
  boardId: "JWuFAH6M"
};

class TrelloService {
  constructor() {
    this.baseUrl = 'https://api.trello.com/1';
    this.listCache = new Map(); // Кэш колонок
    this.cardCache = new Map(); // Кэш статусов карточек
    this.cacheExpiry = 5 * 60 * 1000; // 5 минут
  }

  // Извлечь ID карточки из ссылки Trello
  extractCardId(trelloLink) {
    if (!trelloLink) return null;
    
    const link = trelloLink.trim();
    
    // Поддерживаем разные форматы:
    // https://trello.com/c/ABC123/название
    // https://trello.com/c/ABC123
    // trello.com/c/ABC123/название
    // trello.com/c/ABC123
    const patterns = [
      /trello\.com\/c\/([a-zA-Z0-9]+)/i,
      /\/c\/([a-zA-Z0-9]+)/,
      /^([a-zA-Z0-9]{8,})$/  // Просто ID
    ];
    
    for (const pattern of patterns) {
      const match = link.match(pattern);
      if (match) {
        console.log(`✅ Извлечен ID карточки: ${match[1]} из ${link}`);
        return match[1];
      }
    }
    
    console.warn(`⚠️ Не удалось извлечь ID из ссылки: ${link}`);
    return null;
  }

  // Получить все колонки доски
  async getBoardLists() {
    try {
      // Проверяем кэш
      const cached = this.listCache.get('lists');
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }

      const url = `${this.baseUrl}/boards/${TRELLO_CONFIG.boardId}/lists?key=${TRELLO_CONFIG.key}&token=${TRELLO_CONFIG.token}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Trello API error: ${response.status}`);
      }

      const lists = await response.json();
      
      // Сохраняем в кэш
      this.listCache.set('lists', {
        data: lists,
        timestamp: Date.now()
      });

      return lists;
    } catch (error) {
      console.error('Ошибка получения колонок Trello:', error);
      return [];
    }
  }

  // Получить статус одной карточки
  async getCardStatus(cardId) {
    try {
      if (!cardId) {
        console.warn('⚠️ getCardStatus: cardId пустой');
        return null;
      }

      // Проверяем кэш
      const cached = this.cardCache.get(cardId);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log(`📦 Статус карточки ${cardId} из кэша`);
        return cached.data;
      }

      console.log(`🔄 Запрос статуса карточки ${cardId}...`);
      const url = `${this.baseUrl}/cards/${cardId}?key=${TRELLO_CONFIG.key}&token=${TRELLO_CONFIG.token}&fields=idList,name`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`⚠️ Карточка ${cardId} не найдена (404)`);
          return null;
        }
        if (response.status === 401) {
          console.error('❌ Ошибка авторизации Trello API (401) - проверьте ключ и токен');
          return null;
        }
        console.error(`❌ Trello API error ${response.status} для карточки ${cardId}`);
        throw new Error(`Trello API error: ${response.status}`);
      }

      const card = await response.json();
      console.log(`✅ Получены данные карточки ${cardId}:`, {
        name: card.name,
        listId: card.idList
      });
      
      // Получаем название колонки
      const lists = await this.getBoardLists();
      const list = lists.find(l => l.id === card.idList);
      
      if (!list) {
        console.warn(`⚠️ Колонка ${card.idList} не найдена для карточки ${cardId}`);
      }
      
      const status = {
        listId: card.idList,
        listName: list ? list.name : 'Неизвестная колонка',
        cardName: card.name
      };

      // Сохраняем в кэш
      this.cardCache.set(cardId, {
        data: status,
        timestamp: Date.now()
      });

      console.log(`✅ Статус карточки ${cardId}: ${status.listName}`);
      return status;
    } catch (error) {
      console.error(`❌ Критическая ошибка получения статуса карточки ${cardId}:`, error);
      return null;
    }
  }

  // Батчевое получение статусов карточек (ПАРАЛЛЕЛЬНО)
  async getBatchCardStatuses(trelloLinks) {
    try {
      console.log(`🎯 Батчевый запрос статусов для ${trelloLinks.length} ссылок...`);

      const cardIds = trelloLinks
        .map(link => {
          const id = this.extractCardId(link);
          if (!id) {
            console.warn(`⚠️ Не удалось извлечь ID из: ${link}`);
          }
          return id;
        })
        .filter(id => id !== null);

      console.log(`✅ Извлечено ${cardIds.length} валидных ID карточек из ${trelloLinks.length} ссылок`);

      if (cardIds.length === 0) {
        console.warn('⚠️ Нет валидных ID карточек для запроса');
        return new Map();
      }

      // Получаем колонки один раз
      console.log('📋 Получение списка колонок...');
      const lists = await this.getBoardLists();
      console.log(`✅ Получено ${lists.length} колонок:`, lists.map(l => l.name));

      // 🚀 ПАРАЛЛЕЛЬНЫЕ запросы статусов (БЫСТРО!)
      console.log('⚡ Запуск параллельных запросов...');
      const startTime = Date.now();
      
      const promises = cardIds.map(cardId => 
        this.getCardStatus(cardId).catch(error => {
          console.error(`❌ Ошибка получения статуса ${cardId}:`, error);
          return null;
        })
      );

      const results = await Promise.allSettled(promises);
      
      const statusMap = new Map();
      let successCount = 0;
      let failCount = 0;

      results.forEach((result, index) => {
        const cardId = cardIds[index];
        
        if (result.status === 'fulfilled' && result.value) {
          statusMap.set(cardId, result.value);
          successCount++;
        } else {
          failCount++;
        }
      });

      const duration = Date.now() - startTime;
      console.log(`🎉 Батчевый запрос завершен за ${duration}ms: успешно ${successCount}, ошибок ${failCount}`);
      
      return statusMap;

    } catch (error) {
      console.error('❌ Критическая ошибка батчевого получения статусов:', error);
      return new Map();
    }
  }

  // Получить последние действия на доске (для отслеживания изменений)
  async getBoardActions(since = null) {
    try {
      const sinceParam = since ? `&since=${since}` : '&limit=100';
      const url = `${this.baseUrl}/boards/${TRELLO_CONFIG.boardId}/actions?key=${TRELLO_CONFIG.key}&token=${TRELLO_CONFIG.token}&filter=updateCard${sinceParam}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Trello API error: ${response.status}`);
      }

      const actions = await response.json();
      
      // Фильтруем только изменения колонок (listAfter/listBefore)
      const cardMoves = actions.filter(action => 
        action.type === 'updateCard' && 
        action.data.listAfter && 
        action.data.listBefore &&
        action.data.listAfter.id !== action.data.listBefore.id
      );

      return cardMoves;
    } catch (error) {
      console.error('Ошибка получения действий доски:', error);
      return [];
    }
  }

  // Проверить изменения конкретных карточек
  async checkCardsForChanges(cardIds) {
    try {
      if (!cardIds || cardIds.length === 0) {
        return new Map();
      }

      console.log(`🔍 Проверка изменений для ${cardIds.length} карточек...`);
      
      // Получаем последние действия на доске
      const actions = await this.getBoardActions();
      
      // Находим карточки, которые изменились
      const changedCards = new Set();
      const changedStatuses = new Map();
      
      actions.forEach(action => {
        const cardId = action.data.card.id;
        
        if (cardIds.includes(cardId)) {
          changedCards.add(cardId);
          changedStatuses.set(cardId, {
            listId: action.data.listAfter.id,
            listName: action.data.listAfter.name,
            cardName: action.data.card.name,
            movedAt: new Date(action.date)
          });
        }
      });

      if (changedCards.size > 0) {
        console.log(`🔔 Обнаружены изменения в ${changedCards.size} карточках:`, Array.from(changedCards));
        
        // Обновляем кэш для измененных карточек
        changedStatuses.forEach((status, cardId) => {
          this.cardCache.set(cardId, {
            data: status,
            timestamp: Date.now()
          });
        });
      }

      return changedStatuses;
    } catch (error) {
      console.error('Ошибка проверки изменений карточек:', error);
      return new Map();
    }
  }

  // Очистить кэш
  clearCache() {
    this.listCache.clear();
    this.cardCache.clear();
  }
}

export const trelloService = new TrelloService();
