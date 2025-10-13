// src/hooks/useTrelloStatus.js
// Хук для получения статусов карточек Trello + AUTO-REFRESH

import { useState, useEffect, useCallback, useRef } from 'react';
import { trelloService } from '../services/trelloService';

export const useTrelloStatus = (creatives, autoLoad = true, autoRefresh = true, refreshInterval = 30000) => {
  const [statusMap, setStatusMap] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);

  // Загрузка статусов
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

      // Извлекаем все ссылки на Trello
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

      if (!silent) {
        console.log(`🔄 Загрузка статусов Trello для ${trelloLinks.length} карточек...`);
      } else {
        console.log(`🔄 [Фоновое обновление] Загрузка статусов Trello для ${trelloLinks.length} карточек...`);
      }

      // Получаем статусы батчем
      const statuses = await trelloService.getBatchCardStatuses(trelloLinks);

      if (!silent) {
        console.log(`✅ Загружено ${statuses.size} статусов Trello`);
      }

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
      console.error('Ошибка загрузки статусов Trello:', err);
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [creatives]);

  // Автозагрузка при монтировании
  useEffect(() => {
    if (autoLoad) {
      loadStatuses();
    }
  }, [autoLoad, loadStatuses]);

  // 🔥 AUTO-REFRESH: Автоматическое обновление каждые N секунд
  useEffect(() => {
    if (autoRefresh && creatives && creatives.length > 0) {
      console.log(`⏰ Включен auto-refresh Trello статусов каждые ${refreshInterval / 1000} секунд`);
      
      intervalRef.current = setInterval(() => {
        console.log('🔄 Auto-refresh Trello статусов...');
        loadStatuses(true); // silent = true (без лоадера)
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          console.log('⏹️ Auto-refresh Trello статусов остановлен');
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [autoRefresh, refreshInterval, loadStatuses, creatives]);

  // Получить статус для конкретного креатива
  const getStatus = useCallback((trelloLink) => {
    if (!trelloLink) return null;
    return statusMap.get(trelloLink) || null;
  }, [statusMap]);

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
    getStatus,
    refresh
  };
};
