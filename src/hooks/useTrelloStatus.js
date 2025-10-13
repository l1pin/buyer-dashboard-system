// src/hooks/useTrelloStatus.js
// Хук для получения статусов карточек Trello + SMART REAL-TIME

import { useState, useEffect, useCallback, useRef } from 'react';
import { trelloService } from '../services/trelloService';

export const useTrelloStatus = (creatives, autoLoad = true, realtimeUpdates = true, checkInterval = 5000) => {
  const [statusMap, setStatusMap] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [changedCards, setChangedCards] = useState(new Set()); // Карточки с изменениями
  const intervalRef = useRef(null);
  const cardIdsRef = useRef([]);

  // Загрузка статусов
  const loadStatuses = useCallback(async (silent = false) => {
    if (!creatives || creatives.length === 0) {
      setStatusMap(new Map());
      cardIdsRef.current = [];
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      // Извлекаем все ссылки на Trello
      const trelloLinks = creatives
        .map(c => c.trello_link)
        .filter(link => link && link.trim());

      if (trelloLinks.length === 0) {
        setStatusMap(new Map());
        cardIdsRef.current = [];
        if (!silent) {
          setLoading(false);
        }
        return;
      }

      if (!silent) {
        console.log(`🔄 Загрузка статусов Trello для ${trelloLinks.length} карточек...`);
      }

      // Получаем статусы батчем
      const statuses = await trelloService.getBatchCardStatuses(trelloLinks);

      if (!silent) {
        console.log(`✅ Загружено ${statuses.size} статусов Trello`);
      }

      // Создаем Map: trello_link -> status
      const newStatusMap = new Map();
      const cardIds = [];
      
      creatives.forEach(creative => {
        if (creative.trello_link) {
          const cardId = trelloService.extractCardId(creative.trello_link);
          if (cardId) {
            cardIds.push(cardId);
            if (statuses.has(cardId)) {
              newStatusMap.set(creative.trello_link, statuses.get(cardId));
            }
          }
        }
      });

      cardIdsRef.current = cardIds;
      setStatusMap(newStatusMap);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Ошибка загрузки статусов Trello:', err);
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [creatives]);

  // 🔥 SMART REAL-TIME: Проверка изменений и обновление только измененных карточек
  const checkForChanges = useCallback(async () => {
    if (!cardIdsRef.current || cardIdsRef.current.length === 0) {
      return;
    }

    try {
      // Проверяем изменения
      const changedStatuses = await trelloService.checkCardsForChanges(cardIdsRef.current);
      
      if (changedStatuses.size > 0) {
        console.log(`⚡ REAL-TIME UPDATE: Обнаружены изменения в ${changedStatuses.size} карточках`);
        
        // Обновляем статусы только для измененных карточек
        setStatusMap(prevMap => {
          const newMap = new Map(prevMap);
          
          creatives.forEach(creative => {
            if (creative.trello_link) {
              const cardId = trelloService.extractCardId(creative.trello_link);
              if (cardId && changedStatuses.has(cardId)) {
                newMap.set(creative.trello_link, changedStatuses.get(cardId));
              }
            }
          });
          
          return newMap;
        });

        // Помечаем измененные карточки для анимации
        const changed = new Set(changedStatuses.keys());
        setChangedCards(changed);
        
        // Убираем пометку через 3 секунды
        setTimeout(() => {
          setChangedCards(new Set());
        }, 3000);

        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Ошибка проверки изменений:', err);
    }
  }, [creatives]);

  // Автозагрузка при монтировании
  useEffect(() => {
    if (autoLoad) {
      loadStatuses();
    }
  }, [autoLoad, loadStatuses]);

  // 🔥 SMART POLLING: Проверка изменений каждые N секунд
  useEffect(() => {
    if (realtimeUpdates && creatives && creatives.length > 0) {
      console.log(`⚡ Включен SMART REAL-TIME для Trello (проверка каждые ${checkInterval / 1000} сек)`);
      
      intervalRef.current = setInterval(() => {
        checkForChanges();
      }, checkInterval);

      return () => {
        if (intervalRef.current) {
          console.log('⏹️ SMART REAL-TIME остановлен');
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [realtimeUpdates, checkInterval, checkForChanges, creatives]);

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
    trelloService.clearCache();
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
