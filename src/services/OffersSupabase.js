// src/services/OffersSupabase.js
// Серверная логика для работы со статусами офферов

import { supabase } from '../supabaseClient';

/**
 * Сервис для работы со статусами офферов
 * Все операции с БД Supabase для вкладки "Офферы"
 */
export const offerStatusService = {
  /**
   * Получить все статусы офферов
   * @returns {Promise<Array>} Массив статусов офферов
   */
  async getAllStatuses() {
    try {
      console.log('📊 Загружаем все статусы офферов...');

      const { data, error } = await supabase
        .from('offer_statuses')
        .select('*')
        .order('offer_id', { ascending: true });

      if (error) throw error;

      console.log(`✅ Загружено ${data?.length || 0} статусов офферов`);
      return data || [];

    } catch (error) {
      console.error('❌ Ошибка загрузки статусов офферов:', error);
      throw error;
    }
  },

  /**
   * Получить статус конкретного оффера
   * @param {number} offerId - ID оффера
   * @returns {Promise<Object|null>} Объект статуса или null
   */
  async getOfferStatus(offerId) {
    try {
      const { data, error } = await supabase
        .from('offer_statuses')
        .select('*')
        .eq('offer_id', offerId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

      return data || null;

    } catch (error) {
      console.error(`❌ Ошибка загрузки статуса оффера ${offerId}:`, error);
      throw error;
    }
  },

  /**
   * Получить статусы для списка офферов
   * @param {Array<number>} offerIds - Массив ID офферов
   * @returns {Promise<Array>} Массив статусов
   */
  async getOfferStatuses(offerIds) {
    try {
      if (!offerIds || offerIds.length === 0) return [];

      const { data, error } = await supabase
        .from('offer_statuses')
        .select('*')
        .in('offer_id', offerIds);

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('❌ Ошибка загрузки статусов офферов:', error);
      throw error;
    }
  },

  /**
   * Создать или обновить статус оффера
   * @param {number} offerId - ID оффера
   * @param {string} status - Новый статус
   * @param {string} article - Артикул оффера
   * @param {string} offerName - Название оффера
   * @param {string} changedBy - Кто изменил
   * @param {string} comment - Комментарий (опционально)
   * @returns {Promise<Object>} Обновленный объект статуса
   */
  async upsertOfferStatus(offerId, status, article = null, offerName = null, changedBy = 'System', comment = null) {
    try {
      console.log(`📝 Обновляем статус оффера ${offerId} на "${status}"...`);

      // Проверяем, существует ли уже запись
      const existingStatus = await this.getOfferStatus(offerId);

      if (existingStatus) {
        // Обновляем существующую запись и добавляем в историю
        const newHistoryEntry = {
          status: status,
          changed_at: new Date().toISOString(),
          changed_by: changedBy,
          comment: comment
        };

        const updatedHistory = [newHistoryEntry, ...existingStatus.status_history];

        const { data, error } = await supabase
          .from('offer_statuses')
          .update({
            current_status: status,
            status_history: updatedHistory,
            article: article || existingStatus.article,
            offer_name: offerName || existingStatus.offer_name
          })
          .eq('offer_id', offerId)
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ Статус оффера ${offerId} обновлен на "${status}"`);
        return data;

      } else {
        // Создаем новую запись
        const initialHistoryEntry = {
          status: status,
          changed_at: new Date().toISOString(),
          changed_by: changedBy,
          comment: comment || 'Начальный статус'
        };

        const { data, error } = await supabase
          .from('offer_statuses')
          .insert({
            offer_id: offerId,
            article: article,
            offer_name: offerName,
            current_status: status,
            status_history: [initialHistoryEntry]
          })
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ Создан новый статус для оффера ${offerId}: "${status}"`);
        return data;
      }

    } catch (error) {
      console.error(`❌ Ошибка обновления статуса оффера ${offerId}:`, error);
      throw error;
    }
  },

  /**
   * Получить историю статусов оффера с расчетом дат "с" и "до"
   * @param {number} offerId - ID оффера
   * @returns {Promise<Array>} Массив истории с датами
   */
  async getOfferStatusHistory(offerId) {
    try {
      const offerStatus = await this.getOfferStatus(offerId);

      if (!offerStatus) {
        return [];
      }

      // Рассчитываем количество дней и даты "с" и "до" для каждого статуса
      const history = offerStatus.status_history.map((entry, index) => {
        const fromDate = new Date(entry.changed_at);
        const nextEntry = offerStatus.status_history[index + 1];

        let toDate;
        let daysInStatus;

        if (index === 0) {
          // Для текущего статуса "до" = сегодня
          toDate = new Date();
          daysInStatus = Math.floor((toDate - fromDate) / (1000 * 60 * 60 * 24));
        } else if (nextEntry) {
          // Для прошлых статусов "до" = дата следующего изменения
          toDate = new Date(nextEntry.changed_at);
          daysInStatus = Math.floor((fromDate - toDate) / (1000 * 60 * 60 * 24));
        } else {
          toDate = fromDate;
          daysInStatus = 0;
        }

        return {
          ...entry,
          from_date: fromDate.toISOString(),
          to_date: toDate.toISOString(),
          days_in_status: daysInStatus
        };
      });

      return history;

    } catch (error) {
      console.error(`❌ Ошибка загрузки истории статусов оффера ${offerId}:`, error);
      throw error;
    }
  },

  /**
   * Получить количество дней в текущем статусе
   * @param {number} offerId - ID оффера
   * @returns {Promise<number>} Количество дней
   */
  async getDaysInCurrentStatus(offerId) {
    try {
      const offerStatus = await this.getOfferStatus(offerId);

      if (!offerStatus || !offerStatus.status_history || offerStatus.status_history.length === 0) {
        return 0;
      }

      const currentStatusEntry = offerStatus.status_history[0];
      const changedAt = new Date(currentStatusEntry.changed_at);
      const now = new Date();

      return Math.floor((now - changedAt) / (1000 * 60 * 60 * 24));

    } catch (error) {
      console.error(`❌ Ошибка расчета дней в статусе для оффера ${offerId}:`, error);
      return 0;
    }
  },

  /**
   * Получить доступные статусы с цветами
   * @returns {Array} Массив конфигураций статусов
   */
  getAvailableStatuses() {
    return [
      { value: 'Активный', label: 'Активный', color: 'bg-green-500', textColor: 'text-white' },
      { value: 'Пауза', label: 'Пауза', color: 'bg-yellow-500', textColor: 'text-white' },
      { value: 'Закончился', label: 'Закончился', color: 'bg-red-500', textColor: 'text-white' },
      { value: 'Отлежка', label: 'Отлежка', color: 'bg-purple-500', textColor: 'text-white' },
      { value: 'Передел', label: 'Передел', color: 'bg-blue-400', textColor: 'text-white' },
      { value: 'КЦ', label: 'КЦ', color: 'bg-teal-700', textColor: 'text-white' }
    ];
  },

  /**
   * Получить цвет для статуса
   * @param {string} status - Название статуса
   * @returns {Object} Конфигурация статуса с цветами
   */
  getStatusColor(status) {
    const statuses = this.getAvailableStatuses();
    const statusConfig = statuses.find(s => s.value === status);
    return statusConfig || { value: status, label: status, color: 'bg-gray-500', textColor: 'text-white' };
  },

  /**
   * Удалить статус оффера
   * @param {number} offerId - ID оффера
   * @returns {Promise<Object>} Результат операции
   */
  async deleteOfferStatus(offerId) {
    try {
      console.log(`🗑️ Удаляем статус оффера ${offerId}...`);

      const { error } = await supabase
        .from('offer_statuses')
        .delete()
        .eq('offer_id', offerId);

      if (error) throw error;

      console.log(`✅ Статус оффера ${offerId} удален`);
      return { success: true };

    } catch (error) {
      console.error(`❌ Ошибка удаления статуса оффера ${offerId}:`, error);
      throw error;
    }
  }
};

/**
 * Сервис для работы с привязками байеров к офферам
 * Таблица offer_buyers
 */
export const offerBuyersService = {
  /**
   * Получить все привязки байеров к офферам
   * @returns {Promise<Array>} Массив привязок
   */
  async getAllAssignments() {
    try {
      console.log('📊 Загружаем все привязки байеров к офферам...');

      const { data, error } = await supabase
        .from('offer_buyers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`✅ Загружено ${data?.length || 0} привязок`);
      return data || [];

    } catch (error) {
      console.error('❌ Ошибка загрузки привязок:', error);
      throw error;
    }
  },

  /**
   * Получить привязки для конкретного оффера
   * @param {number} offerId - ID оффера
   * @returns {Promise<Array>} Массив привязок для оффера
   */
  async getOfferAssignments(offerId) {
    try {
      const { data, error } = await supabase
        .from('offer_buyers')
        .select('*')
        .eq('offer_id', offerId)
        .order('source', { ascending: true });

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error(`❌ Ошибка загрузки привязок для оффера ${offerId}:`, error);
      throw error;
    }
  },

  /**
   * Получить офферы привязанные к байеру
   * @param {string} buyerId - UUID байера
   * @returns {Promise<Array>} Массив привязок (с offer_id)
   */
  async getBuyerOffers(buyerId) {
    try {
      console.log(`📊 Загружаем офферы для байера ${buyerId}...`);

      const { data, error } = await supabase
        .from('offer_buyers')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`✅ Загружено ${data?.length || 0} привязок для байера`);
      return data || [];

    } catch (error) {
      console.error(`❌ Ошибка загрузки офферов для байера ${buyerId}:`, error);
      throw error;
    }
  },

  /**
   * Добавить привязку байера к офферу
   * @param {number} offerId - ID оффера
   * @param {string} buyerId - UUID байера
   * @param {string} buyerName - Имя байера
   * @param {string} source - Источник трафика (Facebook, Google, TikTok)
   * @param {Array<string>} sourceIds - Массив всех source_id байера для данного источника
   * @returns {Promise<Object>} Созданная привязка
   */
  async addAssignment(offerId, buyerId, buyerName, source, sourceIds = []) {
    try {
      console.log(`📝 Привязываем байера ${buyerName} к офферу ${offerId} (${source})...`);
      console.log(`   Source IDs: ${JSON.stringify(sourceIds)}`);

      const { data, error } = await supabase
        .from('offer_buyers')
        .insert({
          offer_id: offerId,
          buyer_id: buyerId,
          buyer_name: buyerName,
          source: source,
          source_ids: sourceIds
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Байер ${buyerName} привязан к офферу ${offerId} с ${sourceIds.length} source_id`);
      return data;

    } catch (error) {
      console.error(`❌ Ошибка привязки байера к офферу:`, error);
      throw error;
    }
  },

  /**
   * Удалить привязку байера к офферу
   * @param {number} assignmentId - ID привязки
   * @returns {Promise<Object>} Результат операции
   */
  async removeAssignment(assignmentId) {
    try {
      console.log(`🗑️ Удаляем привязку ${assignmentId}...`);

      const { error } = await supabase
        .from('offer_buyers')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      console.log(`✅ Привязка ${assignmentId} удалена`);
      return { success: true };

    } catch (error) {
      console.error(`❌ Ошибка удаления привязки ${assignmentId}:`, error);
      throw error;
    }
  },

  /**
   * Удалить привязку по параметрам
   * @param {number} offerId - ID оффера
   * @param {string} buyerId - UUID байера
   * @param {string} source - Источник трафика
   * @returns {Promise<Object>} Результат операции
   */
  async removeAssignmentByParams(offerId, buyerId, source) {
    try {
      console.log(`🗑️ Удаляем привязку байера ${buyerId} от оффера ${offerId} (${source})...`);

      const { error } = await supabase
        .from('offer_buyers')
        .delete()
        .eq('offer_id', offerId)
        .eq('buyer_id', buyerId)
        .eq('source', source);

      if (error) throw error;

      console.log(`✅ Привязка удалена`);
      return { success: true };

    } catch (error) {
      console.error(`❌ Ошибка удаления привязки:`, error);
      throw error;
    }
  },

  /**
   * Получить уникальные offer_id для байера
   * @param {string} buyerId - UUID байера
   * @returns {Promise<Array<number>>} Массив offer_id
   */
  async getBuyerOfferIds(buyerId) {
    try {
      const assignments = await this.getBuyerOffers(buyerId);
      const offerIds = [...new Set(assignments.map(a => a.offer_id))];
      return offerIds;

    } catch (error) {
      console.error(`❌ Ошибка получения offer_id для байера:`, error);
      throw error;
    }
  }
};
