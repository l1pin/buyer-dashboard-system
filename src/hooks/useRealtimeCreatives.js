import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Хук для подписки на realtime обновления креативов
 * @param {Function} onInsert - Callback при создании нового креатива
 * @param {Function} onUpdate - Callback при обновлении креатива
 * @param {Function} onDelete - Callback при удалении креатива
 * @param {string|null} userId - ID пользователя для фильтрации (null = все креативы)
 */
export const useRealtimeCreatives = (onInsert, onUpdate, onDelete, userId = null) => {
  useEffect(() => {
    console.log('🔌 Подключение к realtime креативам', userId ? `для пользователя ${userId}` : 'для всех');
    
    // Создаем канал для подписки
    const channelName = userId ? `creatives_${userId}` : 'creatives_all';
    
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'creatives',
          filter: userId ? `user_id=eq.${userId}` : undefined
        },
        (payload) => {
          console.log('🆕 Realtime INSERT:', payload.new.article);
          if (onInsert) {
            onInsert(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'creatives',
          filter: userId ? `user_id=eq.${userId}` : undefined
        },
        (payload) => {
          console.log('🔄 Realtime UPDATE:', payload.new.article);
          if (onUpdate) {
            onUpdate(payload.new, payload.old);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'creatives',
          filter: userId ? `user_id=eq.${userId}` : undefined
        },
        (payload) => {
          console.log('🗑️ Realtime DELETE:', payload.old.id);
          if (onDelete) {
            onDelete(payload.old);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime статус:', status);
      });
    
    // Отписываемся при размонтировании
    return () => {
      console.log('🔌 Отключение от realtime креативов');
      subscription.unsubscribe();
    };
  }, [userId, onInsert, onUpdate, onDelete]);
};
