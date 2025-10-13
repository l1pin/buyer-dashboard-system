// src/services/supabaseTrelloService.js
// Сервис для работы с Trello статусами через Supabase

import { supabase } from '../supabaseClient';
import { trelloService } from './trelloService';

class SupabaseTrelloService {
  constructor() {
    this.isLeader = false;
    this.leaderCheckInterval = null;
    this.updateInterval = null;
    this.leaderKey = 'trello_sync_leader';
    this.leaderTimeout = 10000; // 10 секунд
    this.subscriptions = new Map();
  }

  // 🔥 Проверить, кто лидер (выборы лидера)
  async electLeader() {
    try {
      const now = Date.now();
      const leaderData = localStorage.getItem(this.leaderKey);
      
      if (leaderData) {
        const { timestamp, tabId } = JSON.parse(leaderData);
        const currentTabId = this.getTabId();
        
        // Если это наша вкладка или лидер "умер" (более 10 сек назад)
        if (tabId === currentTabId || (now - timestamp > this.leaderTimeout)) {
          this.becomeLeader();
          return true;
        }
        return false;
      } else {
        // Нет лидера - становимся им
        this.becomeLeader();
        return true;
      }
    } catch (error) {
      console.error('Ошибка выборов лидера:', error);
      return false;
    }
  }

  // Стать лидером
  becomeLeader() {
    const tabId = this.getTabId();
    this.isLeader = true;
    
    localStorage.setItem(this.leaderKey, JSON.stringify({
      timestamp: Date.now(),
      tabId: tabId
    }));
    
    console.log(`👑 Эта вкладка (${tabId}) стала ЛИДЕРОМ для синхронизации Trello`);
    
    // Обновляем метку времени каждые 3 секунды
    this.leaderCheckInterval = setInterval(() => {
      if (this.isLeader) {
        localStorage.setItem(this.leaderKey, JSON.stringify({
          timestamp: Date.now(),
          tabId: tabId
        }));
      }
    }, 3000);
    
    // Запускаем синхронизацию
    this.startSync();
  }

  // Перестать быть лидером
  resignLeader() {
    this.isLeader = false;
    
    if (this.leaderCheckInterval) {
      clearInterval(this.leaderCheckInterval);
      this.leaderCheckInterval = null;
    }
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    const currentTabId = this.getTabId();
    const leaderData = localStorage.getItem(this.leaderKey);
    
    if (leaderData) {
      const { tabId } = JSON.parse(leaderData);
      if (tabId === currentTabId) {
        localStorage.removeItem(this.leaderKey);
        console.log(`👋 Вкладка ${currentTabId} перестала быть лидером`);
      }
    }
  }

  // Получить ID вкладки
  getTabId() {
    if (!window.tabId) {
      window.tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return window.tabId;
  }

  // 🚀 Запустить синхронизацию (только для лидера)
  startSync() {
    if (!this.isLeader) {
      console.warn('⚠️ Только лидер может запускать синхронизацию');
      return;
    }

    console.log('🚀 Лидер запускает синхронизацию Trello каждые 5 секунд...');
    
    // Первый запуск сразу
    this.syncTrelloToSupabase();
    
    // Затем каждые 5 секунд
    this.updateInterval = setInterval(() => {
      this.syncTrelloToSupabase();
    }, 5000);
  }

  // 📡 Синхронизация: Trello → Supabase
  async syncTrelloToSupabase() {
    try {
      console.log('🔄 [LEADER] Синхронизация Trello → Supabase...');
      
      // Получаем все активные карточки из креативов
      const { data: creatives, error: creativesError } = await supabase
        .from('creatives')
        .select('trello_link')
        .not('trello_link', 'is', null);

      if (creativesError) {
        console.error('Ошибка загрузки креативов:', creativesError);
        return;
      }

      if (!creatives || creatives.length === 0) {
        console.log('📭 Нет креативов с Trello ссылками');
        return;
      }

      const trelloLinks = creatives
        .map(c => c.trello_link)
        .filter(link => link && link.trim());

      const cardIds = trelloLinks
        .map(link => trelloService.extractCardId(link))
        .filter(id => id !== null);

      if (cardIds.length === 0) {
        console.log('📭 Нет валидных card ID');
        return;
      }

      console.log(`🔍 [LEADER] Проверка ${cardIds.length} карточек...`);

      // Получаем статусы из Trello
      const statuses = await trelloService.getBatchCardStatuses(trelloLinks);

      if (statuses.size === 0) {
        console.log('📭 Статусы не получены');
        return;
      }

      console.log(`✅ [LEADER] Получено ${statuses.size} статусов из Trello`);

      // Формируем данные для Supabase
      const statusRecords = Array.from(statuses.entries()).map(([cardId, status]) => ({
        card_id: cardId,
        card_name: status.cardName || '',
        list_id: status.listId,
        list_name: status.listName,
        updated_at: new Date().toISOString()
      }));

      // Сохраняем в Supabase (upsert)
      const { error: upsertError } = await supabase
        .from('trello_card_statuses')
        .upsert(statusRecords, {
          onConflict: 'card_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('❌ [LEADER] Ошибка сохранения в Supabase:', upsertError);
      } else {
        console.log(`✅ [LEADER] Сохранено ${statusRecords.length} статусов в Supabase`);
      }

    } catch (error) {
      console.error('❌ [LEADER] Ошибка синхронизации:', error);
    }
  }

  // 📊 Получить статусы из Supabase
  async getStatusesFromSupabase(cardIds) {
    try {
      const { data, error } = await supabase
        .from('trello_card_statuses')
        .select('*')
        .in('card_id', cardIds);

      if (error) {
        console.error('Ошибка загрузки статусов из Supabase:', error);
        return new Map();
      }

      const statusMap = new Map();
      
      if (data) {
        data.forEach(record => {
          statusMap.set(record.card_id, {
            listId: record.list_id,
            listName: record.list_name,
            cardName: record.card_name,
            updatedAt: new Date(record.updated_at)
          });
        });
      }

      return statusMap;
    } catch (error) {
      console.error('Ошибка getStatusesFromSupabase:', error);
      return new Map();
    }
  }

  // 🔔 Подписаться на realtime обновления
  subscribeToRealtime(callback) {
    const subscription = supabase
      .channel('trello_status_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trello_card_statuses'
        },
        (payload) => {
          console.log('🔔 Realtime обновление:', payload);
          
          if (payload.new) {
            callback({
              cardId: payload.new.card_id,
              status: {
                listId: payload.new.list_id,
                listName: payload.new.list_name,
                cardName: payload.new.card_name,
                updatedAt: new Date(payload.new.updated_at)
              }
            });
          }
        }
      )
      .subscribe();

    const subscriptionId = Date.now().toString();
    this.subscriptions.set(subscriptionId, subscription);

    console.log('✅ Подписка на Realtime создана:', subscriptionId);
    
    return subscriptionId;
  }

  // Отписаться от realtime
  unsubscribeFromRealtime(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (subscription) {
      supabase.removeChannel(subscription);
      this.subscriptions.delete(subscriptionId);
      console.log('✅ Отписка от Realtime:', subscriptionId);
    }
  }

  // Инициализация при старте приложения
  async initialize() {
    console.log('🚀 Инициализация Supabase Trello Service...');
    
    // Проверяем, можем ли стать лидером
    await this.electLeader();
    
    // Перепроверка лидерства каждые 5 секунд
    setInterval(() => {
      if (!this.isLeader) {
        this.electLeader();
      }
    }, 5000);
  }

  // Очистка при закрытии вкладки
  cleanup() {
    this.resignLeader();
    this.subscriptions.forEach((subscription) => {
      supabase.removeChannel(subscription);
    });
    this.subscriptions.clear();
  }
}

export const supabaseTrelloService = new SupabaseTrelloService();
