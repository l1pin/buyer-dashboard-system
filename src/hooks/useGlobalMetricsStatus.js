// src/hooks/useGlobalMetricsStatus.js
// Хук для отслеживания глобального статуса обновления метрик с Realtime подпиской

import { useState, useEffect, useCallback } from 'react';
import { metricsAnalyticsService } from '../supabaseClient';

/**
 * Хук для получения и отслеживания глобального статуса обновления метрик
 * Автоматически обновляется через Supabase Realtime при изменении данных
 *
 * @returns {Object} - { lastUpdate, isAuto, status, videosUpdated, loading, refresh }
 */
export function useGlobalMetricsStatus() {
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isAuto, setIsAuto] = useState(false);
  const [status, setStatus] = useState('idle');
  const [videosUpdated, setVideosUpdated] = useState(0);
  const [loading, setLoading] = useState(true);

  // Функция для обновления состояния из данных
  const updateStateFromData = useCallback((data) => {
    if (data) {
      setLastUpdate(data.last_updated || null);
      setIsAuto(data.is_auto || false);
      setStatus(data.status || 'idle');
      setVideosUpdated(data.videos_updated || 0);
    }
  }, []);

  // Загрузка начального состояния
  const loadInitialStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await metricsAnalyticsService.getMetricsLastUpdate();
      updateStateFromData(data);
    } catch (error) {
      console.error('Ошибка загрузки статуса метрик:', error);
    } finally {
      setLoading(false);
    }
  }, [updateStateFromData]);

  // Ручное обновление
  const refresh = useCallback(async () => {
    await loadInitialStatus();
  }, [loadInitialStatus]);

  // Инициализация и подписка на Realtime
  useEffect(() => {
    // Загружаем начальное состояние
    loadInitialStatus();

    // Подписываемся на Realtime изменения
    const channel = metricsAnalyticsService.subscribeToMetricsLastUpdate((newData) => {
      console.log('🔄 Realtime обновление статуса метрик:', newData);
      updateStateFromData(newData);
    });

    // Отписка при размонтировании
    return () => {
      metricsAnalyticsService.unsubscribeFromMetricsLastUpdate(channel);
    };
  }, [loadInitialStatus, updateStateFromData]);

  // Форматирование даты для отображения
  const formattedLastUpdate = lastUpdate
    ? new Date(lastUpdate).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  // Текст статуса
  const statusText = isAuto ? 'Обновлено автоматически' : 'Обновлено';

  return {
    // Сырые данные
    lastUpdate,
    isAuto,
    status,
    videosUpdated,
    loading,

    // Форматированные данные
    formattedLastUpdate,
    statusText,

    // Методы
    refresh
  };
}

/**
 * Хук для подписки на изменения в metrics_cache
 * Автоматически обновляет метрики при изменении кэша
 *
 * @param {Array} creativeIds - массив ID креативов для отслеживания
 * @param {Function} onUpdate - callback при обновлении
 */
export function useMetricsCacheRealtime(creativeIds, onUpdate) {
  useEffect(() => {
    if (!creativeIds || creativeIds.length === 0) return;

    // Подписываемся на изменения в metrics_cache
    const { supabase } = require('../supabaseClient');

    const channel = supabase
      .channel('metrics-cache-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'metrics_cache'
        },
        (payload) => {
          // Проверяем, относится ли изменение к нашим креативам
          if (payload.new && creativeIds.includes(payload.new.creative_id)) {
            console.log('📡 Realtime: metrics_cache изменился для креатива', payload.new.creative_id);
            if (onUpdate && typeof onUpdate === 'function') {
              onUpdate(payload.new);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [creativeIds, onUpdate]);
}

export default useGlobalMetricsStatus;
