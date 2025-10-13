// src/hooks/useTrelloStatus.js
// Хук для получения статусов через Supabase + Realtime

import { useState, useEffect, useCallback, useRef } from 'react';
import { trelloService } from '../services/trelloService';
import { supabaseTrelloService } from '../services/supabaseTrelloService';

export const useTrelloStatus = (creatives, autoLoad = true) => {
  const [statusMap, setStatusMap] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [changedCards, setChangedCards] = useState(new Set());
  const subscriptionIdRef = useRef(null);

  // Загрузка статусов из Supabase
  const loadStatuses = useCallback(async (silent = false) => {
    if (!creatives || creatives.length === 0) {
      setStatusMap(new Map());
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      // Извлекаем card IDs
      const trelloLinks = creatives
        .map(c => c.trello_link)
        .filter(link => link && link.trim());

      if (trelloLinks.length === 0) {
        setStatusMap(new Map());
        if (!silent) {
          setLoading(false);
        }
        return;
      }

      const cardIds = trelloLinks
        .map(link => trelloService.extractCardId(link))
        .filter(id => id !== null);

      if (cardIds.length === 0) {
        setStatusMap(new Map());
        if (!silent) {
          setLoading(false);
        }
        return;
      }

      console.log(`📊 Загрузка статусов из Supabase для ${cardIds.length} карточек...`);

      // Получаем статусы из Supabase
      const statuses = await supabaseTrelloService.getStatusesFromSupabase(cardIds);

      console.log(`✅ Загружено ${statuses.size} статусов из Supabase`);

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
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Ошибка загрузки статусов:', err);
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [creatives]);

  // Обработчик realtime обновлений
  const handleRealtimeUpdate = useCallback((update) => {
    const { cardId, status } = update;
    
    console.log(`🔔 Realtime обновление карточки ${cardId}:`, status.listName);
    
    // Обновляем статус в Map
    setStatusMap(prevMap => {
      const newMap = new Map(prevMap);
      
      creatives.forEach(creative => {
        if (creative.trello_link) {
          const id = trelloService.extractCardId(creative.trello_link);
          if (id === cardId) {
            newMap.set(creative.trello_link, status);
          }
        }
      });
      
      return newMap;
    });

    // Помечаем карточку как измененную
    setChangedCards(prev => new Set(prev).add(cardId));
    
    // Убираем пометку через 3 секунды
    setTimeout(() => {
      setChangedCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardId);
        return newSet;
      });
    }, 3000);

    setLastUpdate(new Date());
  }, [creatives]);

  // Автозагрузка при монтировании
  useEffect(() => {
    if (autoLoad) {
      loadStatuses();
    }
  }, [autoLoad, loadStatuses]);

  // 🔔 Подписка на Realtime обновления
  useEffect(() => {
    if (creatives && creatives.length > 0) {
      console.log('🔔 Подписка на Realtime обновления Trello статусов...');
      
      subscriptionIdRef.current = supabaseTrelloService.subscribeToRealtime(handleRealtimeUpdate);

      return () => {
        if (subscriptionIdRef.current) {
          console.log('🔕 Отписка от Realtime обновлений');
          supabaseTrelloService.unsubscribeFromRealtime(subscriptionIdRef.current);
          subscriptionIdRef.current = null;
        }
      };
    }
  }, [creatives, handleRealtimeUpdate]);

  // Получить статус для конкретного креатива
  const getStatus = useCallback((trelloLink) => {
    if (!trelloLink) return null;
    return statusMap.get(trelloLink) || null;
  }, [statusMap]);

  // Проверить, изменилась ли карточка недавно
  const isCardChanged = useCallback((trelloLink) => {
    if (!trelloLink) return false;
    const cardId = trelloService.extractCardId(trelloLink);
    return cardId ? changedCards.has(cardId) : false;
  }, [changedCards]);

  // Обновить статусы вручную
  const refresh = useCallback(() => {
    return loadStatuses();
  }, [loadStatuses]);

  return {
    statusMap,
    loading,
    error,
    lastUpdate,
    changedCards,
    getStatus,
    isCardChanged,
    refresh
  };
};
