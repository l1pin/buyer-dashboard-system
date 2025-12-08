// src/hooks/useGlobalMetricsStatus.js
// Хук для отслеживания глобального статуса обновления метрик с Realtime подпиской

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, metricsAnalyticsService } from '../supabaseClient';

/**
 * Хук для получения и отслеживания глобального статуса обновления метрик
 * Автоматически обновляется через Supabase Realtime при изменении данных
 *
 * @returns {Object} - { lastUpdate, isAuto, status, shouldRefreshMetrics, ... }
 */
export function useGlobalMetricsStatus() {
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isAuto, setIsAuto] = useState(false);
  const [status, setStatus] = useState('idle');
  const [videosUpdated, setVideosUpdated] = useState(0);
  const [loading, setLoading] = useState(true);

  // Флаг для сигнала компонентам о необходимости обновить метрики
  const [shouldRefreshMetrics, setShouldRefreshMetrics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Храним предыдущее время обновления для сравнения
  const prevLastUpdateRef = useRef(null);

  // Функция для обновления состояния из данных
  const updateStateFromData = useCallback((data) => {
    if (data) {
      const newLastUpdate = data.last_updated || null;

      // Проверяем, изменилось ли время обновления
      if (newLastUpdate && prevLastUpdateRef.current && newLastUpdate !== prevLastUpdateRef.current) {
        // Метрики были обновлены! Сигнализируем компонентам
        console.log('🔄 Обнаружено обновление метрик! Старое:', prevLastUpdateRef.current, 'Новое:', newLastUpdate);

        // Показываем спиннер на секунду, затем обновляем данные
        setIsRefreshing(true);
        setShouldRefreshMetrics(true);

        // Через секунду сбрасываем спиннер
        setTimeout(() => {
          setIsRefreshing(false);
        }, 1000);
      }

      prevLastUpdateRef.current = newLastUpdate;
      setLastUpdate(newLastUpdate);
      setIsAuto(data.is_auto || false);
      setStatus(data.status || 'idle');
      setVideosUpdated(data.videos_updated || 0);
    }
  }, []);

  // Сброс флага обновления (вызывается компонентами после перезагрузки данных)
  const resetRefreshFlag = useCallback(() => {
    setShouldRefreshMetrics(false);
  }, []);

  // Загрузка начального состояния
  const loadInitialStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await metricsAnalyticsService.getMetricsLastUpdate();
      if (data) {
        prevLastUpdateRef.current = data.last_updated;
        setLastUpdate(data.last_updated || null);
        setIsAuto(data.is_auto || false);
        setStatus(data.status || 'idle');
        setVideosUpdated(data.videos_updated || 0);
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса метрик:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Ручное обновление
  const refresh = useCallback(async () => {
    await loadInitialStatus();
  }, [loadInitialStatus]);

  // Инициализация и подписка на Realtime
  useEffect(() => {
    // Загружаем начальное состояние
    loadInitialStatus();

    // Подписываемся на Realtime изменения в metrics_last_update
    const channel = supabase
      .channel('metrics-last-update-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'metrics_last_update',
          filter: 'id=eq.1'
        },
        (payload) => {
          console.log('📡 Realtime: metrics_last_update изменилась', payload);
          updateStateFromData(payload.new);
        }
      )
      .subscribe();

    // Отписка при размонтировании
    return () => {
      supabase.removeChannel(channel);
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

    // Флаги для автообновления
    shouldRefreshMetrics,
    isRefreshing,
    resetRefreshFlag,

    // Форматированные данные
    formattedLastUpdate,
    statusText,

    // Методы
    refresh
  };
}

/**
 * Хук для подписки на изменения в metrics_cache конкретных креативов
 * Автоматически обновляет метрики при изменении кэша
 *
 * @param {Array} creativeIds - массив ID креативов для отслеживания
 * @param {Function} onCacheUpdate - callback при обновлении кэша
 */
export function useMetricsCacheRealtime(creativeIds, onCacheUpdate) {
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!creativeIds || creativeIds.length === 0) return;

    // Подписываемся на изменения в metrics_cache
    const channel = supabase
      .channel('metrics-cache-realtime-' + creativeIds.slice(0, 3).join('-'))
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
            console.log('📡 Realtime: metrics_cache обновлен для креатива', payload.new.creative_id);
            setIsUpdating(true);

            if (onCacheUpdate && typeof onCacheUpdate === 'function') {
              onCacheUpdate(payload.new);
            }

            // Сбрасываем флаг через секунду
            setTimeout(() => {
              setIsUpdating(false);
            }, 1000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [creativeIds, onCacheUpdate]);

  return { isUpdating };
}

export default useGlobalMetricsStatus;
