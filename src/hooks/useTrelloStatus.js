// src/hooks/useTrelloStatus.js
// Хук для получения статусов карточек Trello

import { useState, useEffect, useCallback } from 'react';
import { trelloService } from '../services/trelloService';

export const useTrelloStatus = (creatives, autoLoad = true) => {
  const [statusMap, setStatusMap] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Загрузка статусов
  const loadStatuses = useCallback(async () => {
    if (!creatives || creatives.length === 0) {
      setStatusMap(new Map());
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Извлекаем все ссылки на Trello
      const trelloLinks = creatives
        .map(c => c.trello_link)
        .filter(link => link && link.trim());

      if (trelloLinks.length === 0) {
        setStatusMap(new Map());
        setLoading(false);
        return;
      }

      console.log(`🔄 Загрузка статусов Trello для ${trelloLinks.length} карточек...`);

      // Получаем статусы батчем
      const statuses = await trelloService.getBatchCardStatuses(trelloLinks);

      console.log(`✅ Загружено ${statuses.size} статусов Trello`);

      // Создаем Map: trello_link -> status
      const newStatusMap = new Map();
      creatives.forEach(creative => {
        if (creative.trello_link) {
          const cardId = trelloService.extractCardId(creative.trello_link);
          if (cardId && statuses.has(cardId)) {
            newStatusMap.set(creative.trello_link, statuses.get(cardId));
          }
        }
      });

      setStatusMap(newStatusMap);
    } catch (err) {
      console.error('Ошибка загрузки статусов Trello:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [creatives]);

  // Автозагрузка при монтировании
  useEffect(() => {
    if (autoLoad) {
      loadStatuses();
    }
  }, [autoLoad, loadStatuses]);

  // Получить статус для конкретного креатива
  const getStatus = useCallback((trelloLink) => {
    if (!trelloLink) return null;
    return statusMap.get(trelloLink) || null;
  }, [statusMap]);

  // Обновить статусы
  const refresh = useCallback(() => {
    trelloService.clearCache();
    return loadStatuses();
  }, [loadStatuses]);

  return {
    statusMap,
    loading,
    error,
    getStatus,
    refresh
  };
};
