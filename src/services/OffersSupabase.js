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

      // Спочатку отримуємо загальну кількість
      const { count, error: countError } = await supabase
        .from('offer_statuses')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const totalCount = count || 0;
      const pageSize = 1000;
      const totalPages = Math.ceil(totalCount / pageSize);

      if (totalCount === 0) return [];

      // Завантажуємо всі сторінки паралельно
      const pagePromises = [];
      for (let page = 0; page < totalPages; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        pagePromises.push(
          supabase
            .from('offer_statuses')
            .select('*')
            .order('offer_id', { ascending: true })
            .range(from, to)
        );
      }

      const results = await Promise.all(pagePromises);

      // Збираємо всі дані
      let allData = [];
      results.forEach(result => {
        if (!result.error && result.data) {
          allData = allData.concat(result.data);
        }
      });

      console.log(`✅ Загружено ${allData.length} статусов офферов`);
      return allData;

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
   * @param {string} changedBy - Имя пользователя (полное имя, не email)
   * @param {string} changedById - UUID пользователя
   * @param {string} comment - Комментарий (опционально)
   * @returns {Promise<Object>} Обновленный объект статуса
   */
  async upsertOfferStatus(offerId, status, article = null, offerName = null, changedBy = 'System', changedById = null, comment = null) {
    try {
      console.log(`📝 Обновляем статус оффера ${offerId} на "${status}" (изменил: ${changedBy})...`);

      // Проверяем, существует ли уже запись
      const existingStatus = await this.getOfferStatus(offerId);

      if (existingStatus) {
        // Обновляем существующую запись и добавляем в историю
        const newHistoryEntry = {
          status: status,
          changed_at: new Date().toISOString(),
          changed_by: changedBy,
          changed_by_id: changedById,
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
          changed_by_id: changedById,
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
   * Получить все привязки байеров к офферам (с пагинацией)
   * @returns {Promise<Array>} Массив привязок
   */
  async getAllAssignments() {
    try {
      console.log('📊 Загружаем все привязки байеров к офферам...');

      // Сначала получаем общее количество
      const { count, error: countError } = await supabase
        .from('offer_buyers')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const totalCount = count || 0;
      const pageSize = 1000;
      const totalPages = Math.ceil(totalCount / pageSize);

      if (totalCount === 0) {
        console.log('✅ Привязок нет');
        return [];
      }

      console.log(`📊 Всего привязок: ${totalCount}, страниц: ${totalPages}`);

      // Загружаем все страницы параллельно
      const pagePromises = [];
      for (let page = 0; page < totalPages; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        pagePromises.push(
          supabase
            .from('offer_buyers')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to)
        );
      }

      const results = await Promise.all(pagePromises);

      // Собираем все данные
      let allData = [];
      results.forEach(result => {
        if (!result.error && result.data) {
          allData = allData.concat(result.data);
        }
      });

      console.log(`✅ Загружено ${allData.length} привязок`);
      return allData;

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
   * @param {string} assignedBy - Имя тимлида, который привязал байера
   * @returns {Promise<Object>} Созданная привязка
   */
  async addAssignment(offerId, buyerId, buyerName, source, sourceIds = [], assignedBy = null) {
    try {
      console.log(`📝 Привязываем байера ${buyerName} к офферу ${offerId} (${source})...`);
      console.log(`   Source IDs: ${JSON.stringify(sourceIds)}`);
      console.log(`   Assigned by: ${assignedBy}`);

      const now = new Date().toISOString();

      // Создаём первую запись в истории
      const historyEntry = {
        action: 'assigned',
        timestamp: now,
        user_name: assignedBy || 'Неизвестно'
      };

      const { data, error } = await supabase
        .from('offer_buyers')
        .insert({
          offer_id: offerId,
          buyer_id: buyerId,
          buyer_name: buyerName,
          source: source,
          source_ids: sourceIds,
          history: [historyEntry]
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
   * Удалить привязку байера к офферу (полное удаление без сохранения истории)
   * @param {number} assignmentId - ID привязки
   * @returns {Promise<Object>} Результат операции
   * @deprecated Используйте hideEarlyAssignment или archiveAssignment
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
   * Скрыть привязку (удаление в первые 3 минуты)
   * Запись сохраняется в БД с историей, но не отображается в интерфейсе
   * @param {number} assignmentId - ID привязки
   * @param {string} removedBy - Имя тимлида, который удалил байера
   * @returns {Promise<Object>} Обновленная привязка
   */
  async hideEarlyAssignment(assignmentId, removedBy = null) {
    try {
      console.log(`👻 Скрываем раннюю привязку ${assignmentId}...`);

      // Сначала получаем текущую запись для добавления в историю
      const { data: current, error: fetchError } = await supabase
        .from('offer_buyers')
        .select('history')
        .eq('id', assignmentId)
        .single();

      if (fetchError) throw fetchError;

      const now = new Date().toISOString();

      // Создаём запись истории для раннего удаления
      const historyEntry = {
        action: 'removed_early',
        timestamp: now,
        user_name: removedBy || 'Неизвестно',
        reason: 'Удалено в первые 3 минуты'
      };

      // Добавляем к существующей истории
      const updatedHistory = [...(current.history || []), historyEntry];

      const { data, error } = await supabase
        .from('offer_buyers')
        .update({
          hidden: true,
          hidden_at: now,
          history: updatedHistory
        })
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Привязка ${assignmentId} скрыта (раннее удаление)`);
      return data;

    } catch (error) {
      console.error(`❌ Ошибка скрытия привязки ${assignmentId}:`, error);
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
  },

  /**
   * Архивировать привязку байера (не удалять, а пометить как неактивную)
   * Используется когда у байера был расход (cost > 0)
   * @param {number} assignmentId - ID привязки
   * @param {string} removedBy - Имя тимлида, который удалил байера
   * @param {string} reason - Причина удаления (Передумал, Мисклик, Другое)
   * @param {string} reasonDetails - Детали причины (для "Другое")
   * @returns {Promise<Object>} Обновленная привязка
   */
  async archiveAssignment(assignmentId, removedBy = null, reason = null, reasonDetails = null) {
    try {
      console.log(`📦 Архивируем привязку ${assignmentId}...`);

      // Сначала получаем текущую запись для добавления в историю
      const { data: current, error: fetchError } = await supabase
        .from('offer_buyers')
        .select('history')
        .eq('id', assignmentId)
        .single();

      if (fetchError) throw fetchError;

      const now = new Date().toISOString();

      // Создаём запись истории для архивации
      const historyEntry = {
        action: 'archived',
        timestamp: now,
        user_name: removedBy || 'Неизвестно',
        reason: reason || null,
        reason_details: reasonDetails || null
      };

      // Добавляем к существующей истории
      const updatedHistory = [...(current.history || []), historyEntry];

      const { data, error } = await supabase
        .from('offer_buyers')
        .update({
          archived: true,
          archived_at: now,
          history: updatedHistory
        })
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Привязка ${assignmentId} архивирована`);
      return data;

    } catch (error) {
      console.error(`❌ Ошибка архивации привязки ${assignmentId}:`, error);
      throw error;
    }
  },

  /**
   * Восстановить архивированную привязку байера
   * @param {number} assignmentId - ID привязки
   * @returns {Promise<Object>} Обновленная привязка
   */
  async unarchiveAssignment(assignmentId) {
    try {
      console.log(`♻️ Восстанавливаем привязку ${assignmentId}...`);

      const { data, error } = await supabase
        .from('offer_buyers')
        .update({
          archived: false,
          archived_at: null
        })
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Привязка ${assignmentId} восстановлена`);
      return data;

    } catch (error) {
      console.error(`❌ Ошибка восстановления привязки ${assignmentId}:`, error);
      throw error;
    }
  }
};

/**
 * Сервис для работы с маппингом артикулов и Offer ID
 * Таблица article_offer_mapping
 */
export const articleOfferMappingService = {
  /**
   * Получить все маппинги артикулов и Offer ID
   * @returns {Promise<Object>} Объект с маппингом article -> offer_id
   */
  async getAllMappings() {
    try {
      console.log('📊 Загружаем маппинг артикулов и Offer ID...');

      // Спочатку отримуємо загальну кількість
      const { count, error: countError } = await supabase
        .from('article_offer_mapping')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const totalCount = count || 0;
      const pageSize = 1000;
      const totalPages = Math.ceil(totalCount / pageSize);

      if (totalCount === 0) return {};

      // Завантажуємо всі сторінки паралельно
      const pagePromises = [];
      for (let page = 0; page < totalPages; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        pagePromises.push(
          supabase
            .from('article_offer_mapping')
            .select('*')
            .range(from, to)
        );
      }

      const results = await Promise.all(pagePromises);

      // Збираємо всі дані та перетворюємо в об'єкт
      const mappingMap = {};
      results.forEach(result => {
        if (!result.error && result.data) {
          result.data.forEach(item => {
            mappingMap[item.article] = item.offer_id;
          });
        }
      });

      console.log(`✅ Загружено ${Object.keys(mappingMap).length} маппингов`);
      return mappingMap;

    } catch (error) {
      console.error('❌ Ошибка загрузки маппингов:', error);
      return {}; // Возвращаем пустой объект при ошибке
    }
  },

  /**
   * Получить Offer ID по артикулу
   * @param {string} article - Артикул
   * @returns {Promise<string|null>} Offer ID или null
   */
  async getOfferIdByArticle(article) {
    try {
      const { data, error } = await supabase
        .from('article_offer_mapping')
        .select('offer_id')
        .eq('article', article)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

      return data?.offer_id || null;

    } catch (error) {
      console.error(`❌ Ошибка получения Offer ID для артикула ${article}:`, error);
      return null;
    }
  }
};

/**
 * Сервис для работы с сезонами офферов
 * Сезоны хранятся как массив эмодзи: ['☀️', '🍁', '❄️', '🌱']
 * ☀️ - лето, 🍁 - осень, ❄️ - зима, 🌱 - весна
 */
export const offerSeasonService = {
  /**
   * Получить все сезоны офферов (с пагинацией)
   * @returns {Promise<Array>} Массив сезонов офферов
   */
  async getAllSeasons() {
    try {
      console.log('🌿 Загружаем все сезоны офферов...');

      // Сначала получаем общее количество записей
      const { count, error: countError } = await supabase
        .from('offer_seasons')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const totalCount = count || 0;
      const pageSize = 1000;
      const totalPages = Math.ceil(totalCount / pageSize);

      console.log(`📊 Всего сезонов: ${totalCount}, страниц: ${totalPages}`);

      if (totalCount === 0) return [];

      // Загружаем все страницы параллельно
      const pagePromises = [];
      for (let page = 0; page < totalPages; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        pagePromises.push(
          supabase
            .from('offer_seasons')
            .select('*')
            .order('article', { ascending: true })
            .range(from, to)
        );
      }

      const results = await Promise.all(pagePromises);

      // Собираем все данные
      let allData = [];
      results.forEach(result => {
        if (!result.error && result.data) {
          allData = allData.concat(result.data);
        }
      });

      console.log(`✅ Загружено ${allData.length} записей сезонов`);
      return allData;

    } catch (error) {
      console.error('❌ Ошибка загрузки сезонов офферов:', error);
      throw error;
    }
  },

  /**
   * Получить сезон конкретного оффера по артикулу
   * @param {string} article - Артикул оффера
   * @returns {Promise<Object|null>} Объект сезона или null
   */
  async getSeasonByArticle(article) {
    try {
      const { data, error } = await supabase
        .from('offer_seasons')
        .select('*')
        .eq('article', article)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

      return data || null;

    } catch (error) {
      console.error(`❌ Ошибка загрузки сезона для артикула ${article}:`, error);
      throw error;
    }
  },

  /**
   * Создать или обновить сезон оффера
   * @param {string} article - Артикул оффера
   * @param {Array<string>} seasons - Массив эмодзи сезонов ['☀️', '🍁', '❄️', '🌱']
   * @returns {Promise<Object>} Созданная/обновленная запись
   */
  async upsertSeason(article, seasons) {
    try {
      console.log(`🌿 Сохраняем сезоны для ${article}:`, seasons);

      const { data, error } = await supabase
        .from('offer_seasons')
        .upsert({
          article,
          seasons,
          updated_at: new Date().toISOString()
        }, { onConflict: 'article' })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Сезоны для ${article} сохранены`);
      return data;

    } catch (error) {
      console.error(`❌ Ошибка сохранения сезонов для ${article}:`, error);
      throw error;
    }
  },

  /**
   * Массовое обновление сезонов
   * @param {Array<{article: string, seasons: Array<string>}>} records - Массив записей
   * @returns {Promise<Object>} Результат операции
   */
  async bulkUpsertSeasons(records) {
    try {
      console.log(`🌿 Массовое сохранение сезонов для ${records.length} артикулов...`);

      const { data, error } = await supabase
        .from('offer_seasons')
        .upsert(records.map(r => ({
          article: r.article,
          seasons: r.seasons,
          updated_at: new Date().toISOString()
        })), { onConflict: 'article' })
        .select();

      if (error) throw error;

      console.log(`✅ Сезоны сохранены для ${data?.length || 0} артикулов`);
      return { success: true, count: data?.length || 0 };

    } catch (error) {
      console.error('❌ Ошибка массового сохранения сезонов:', error);
      throw error;
    }
  },

  /**
   * Удалить сезон оффера
   * @param {string} article - Артикул оффера
   * @returns {Promise<boolean>} Успех операции
   */
  async deleteSeason(article) {
    try {
      const { error } = await supabase
        .from('offer_seasons')
        .delete()
        .eq('article', article);

      if (error) throw error;

      console.log(`✅ Сезон для ${article} удален`);
      return true;

    } catch (error) {
      console.error(`❌ Ошибка удаления сезона для ${article}:`, error);
      throw error;
    }
  },

  /**
   * Парсинг строки эмодзи в массив
   * Пример: "☀️🍁❄️🌱" -> ['☀️', '🍁', '❄️', '🌱']
   * @param {string} emojiString - Строка с эмодзи
   * @returns {Array<string>} Массив эмодзи
   */
  parseEmojiString(emojiString) {
    if (!emojiString) return [];

    // Используем регулярное выражение для разбиения на эмодзи
    // Это работает с эмодзи, которые могут состоять из нескольких code points
    const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;
    const matches = emojiString.match(emojiRegex);

    return matches || [];
  },

  /**
   * Получить описание сезона по эмодзи
   * @param {string} emoji - Эмодзи сезона
   * @returns {string} Описание сезона
   */
  getSeasonLabel(emoji) {
    const seasonLabels = {
      '☀️': 'Лето',
      '🍁': 'Осень',
      '❄️': 'Зима',
      '🌱': 'Весна'
    };
    return seasonLabels[emoji] || emoji;
  },

  /**
   * Получить все доступные сезоны
   * @returns {Array<{emoji: string, label: string}>}
   */
  getAvailableSeasons() {
    return [
      { emoji: '☀️', label: 'Лето' },
      { emoji: '🍁', label: 'Осень' },
      { emoji: '❄️', label: 'Зима' },
      { emoji: '🌱', label: 'Весна' }
    ];
  }
};
