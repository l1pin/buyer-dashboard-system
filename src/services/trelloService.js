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
    
    // Формат: https://trello.com/c/ABC123/название
    const match = trelloLink.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
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
      // Проверяем кэш
      const cached = this.cardCache.get(cardId);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }

      const url = `${this.baseUrl}/cards/${cardId}?key=${TRELLO_CONFIG.key}&token=${TRELLO_CONFIG.token}&fields=idList,name`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Карточка не найдена
        }
        throw new Error(`Trello API error: ${response.status}`);
      }

      const card = await response.json();
      
      // Получаем название колонки
      const lists = await this.getBoardLists();
      const list = lists.find(l => l.id === card.idList);
      
      const status = {
        listId: card.idList,
        listName: list ? list.name : 'Неизвестно',
        cardName: card.name
      };

      // Сохраняем в кэш
      this.cardCache.set(cardId, {
        data: status,
        timestamp: Date.now()
      });

      return status;
    } catch (error) {
      console.error(`Ошибка получения статуса карточки ${cardId}:`, error);
      return null;
    }
  }

  // Батчевое получение статусов карточек
  async getBatchCardStatuses(trelloLinks) {
    try {
      const cardIds = trelloLinks
        .map(link => this.extractCardId(link))
        .filter(id => id !== null);

      if (cardIds.length === 0) {
        return new Map();
      }

      // Получаем колонки один раз
      const lists = await this.getBoardLists();
      const listMap = new Map(lists.map(l => [l.id, l.name]));

      // Запрашиваем статусы параллельно
      const statusPromises = cardIds.map(async (cardId) => {
        try {
          const status = await this.getCardStatus(cardId);
          return { cardId, status };
        } catch (error) {
          console.error(`Ошибка получения статуса ${cardId}:`, error);
          return { cardId, status: null };
        }
      });

      const results = await Promise.all(statusPromises);

      // Формируем Map: cardId -> status
      const statusMap = new Map();
      results.forEach(({ cardId, status }) => {
        if (status) {
          statusMap.set(cardId, status);
        }
      });

      return statusMap;
    } catch (error) {
      console.error('Ошибка батчевого получения статусов:', error);
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
