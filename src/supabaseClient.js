// Обновленный supabaseClient.js с поддержкой комментариев к креативам
// Замените содержимое src/supabaseClient.js

import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'supabase.auth.token',
    storage: window.localStorage,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Функции для работы с пользователями
export const userService = {
  // Получить профиль пользователя
  async getUserProfile(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Создать нового пользователя (только для тим лидов)
  async createUser(userData) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          name: userData.name,
          role: userData.role
        }
      }
    });

    if (authError) throw authError;

    if (authData.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            created_at: new Date().toISOString()
          }
        ]);

      if (profileError) throw profileError;
    }

    return authData;
  },

  // Удалить пользователя
  async deleteUser(userId) {
    await supabase.from('tables').delete().eq('user_id', userId);
    await supabase.from('creatives').delete().eq('user_id', userId);
    
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    
    if (error) throw error;
  },

  // Обновить профиль пользователя
  async updateUserProfile(userId, updates) {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Загрузить аватар пользователя
  async uploadAvatar(userId, file) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Загружаем файл в Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Получаем публичный URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Обновляем профиль пользователя
      const updatedUser = await this.updateUserProfile(userId, {
        avatar_url: publicUrl
      });

      return updatedUser;
    } catch (error) {
      throw error;
    }
  },

  // Получить всех байеров
  async getAllBuyers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'buyer')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Получить всех пользователей
  async getAllUsers() {
    try {
      console.log('📡 Запрос к таблице users...');
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Ошибка в getAllUsers:', error);
        console.error('📋 Детали ошибки:', {
          code: error.code,
          message: error.message,
          details: error.details
        });
        throw error;
      }
      
      const result = data || [];
      console.log('✅ getAllUsers завершен успешно, получено пользователей:', result.length);
      
      // Показываем сколько монтажеров найдено
      const editors = result.filter(u => u.role === 'editor');
      console.log('👥 Найдено монтажеров:', editors.length);
      
      return result;
      
    } catch (error) {
      console.error('💥 Критическая ошибка в getAllUsers:', error);
      return [];
    }
  }
};

// Функции для работы с таблицами
export const tableService = {
  // Получить таблицу пользователя
  async getUserTable(userId) {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Создать таблицу из CSV
  async createTableFromCSV(userId, csvContent) {
    try {
      // Парсим CSV
      const parsedData = Papa.parse(csvContent, {
        header: false,
        skipEmptyLines: true,
        delimiter: ';'
      });

      if (!parsedData.data || parsedData.data.length === 0) {
        throw new Error('CSV файл пуст или содержит ошибки');
      }

      // Создаем или обновляем запись таблицы
      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .upsert([
          {
            user_id: userId,
            html_content: null,
            css_content: null,
            updated_at: new Date().toISOString()
          }
        ], {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (tableError) throw tableError;

      // Полностью удаляем старые ячейки
      const { error: deleteError } = await supabase
        .from('cells')
        .delete()
        .eq('table_id', tableData.id);

      if (deleteError) throw deleteError;

      // Создаем новые ячейки из CSV данных
      const cellsToInsert = [];
      
      parsedData.data.forEach((row, rowIndex) => {
        row.forEach((cellValue, colIndex) => {
          if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
            cellsToInsert.push({
              table_id: tableData.id,
              row_index: rowIndex,
              column_index: colIndex,
              value: String(cellValue).trim(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        });
      });

      // Вставляем ячейки батчами
      if (cellsToInsert.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < cellsToInsert.length; i += batchSize) {
          const batch = cellsToInsert.slice(i, i + batchSize);
          const { error: cellsError } = await supabase
            .from('cells')
            .insert(batch);
          
          if (cellsError) {
            console.error('Error inserting cells batch:', cellsError);
            throw cellsError;
          }
        }
      }

      return tableData;
    } catch (error) {
      console.error('Error creating table from CSV:', error);
      throw error;
    }
  },

  // Получить все таблицы
  async getAllTables() {
    const { data, error } = await supabase
      .from('tables')
      .select(`
        *,
        users(name, email)
      `)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
};

// Функции для работы с ячейками
export const cellService = {
  // Получить все ячейки таблицы
  async getTableCells(tableId) {
    const { data, error } = await supabase
      .from('cells')
      .select('*')
      .eq('table_id', tableId)
      .order('row_index')
      .order('column_index');
    
    if (error) throw error;
    return data;
  },

  // Получить данные для AG Grid
  async getTableDataForGrid(tableId) {
    const cells = await this.getTableCells(tableId);
    
    if (cells.length === 0) {
      return { columnDefs: [], rowData: [] };
    }

    // Определяем размеры таблицы
    const maxRow = Math.max(...cells.map(cell => cell.row_index));
    const maxCol = Math.max(...cells.map(cell => cell.column_index));

    // Создаем двумерный массив
    const grid = Array(maxRow + 1).fill(null).map(() => Array(maxCol + 1).fill(''));

    // Заполняем сетку данными
    cells.forEach(cell => {
      grid[cell.row_index][cell.column_index] = cell.value;
    });

    // Создаем определения колонок из первой строки
    const columnDefs = [];
    if (grid.length > 0) {
      grid[0].forEach((header, index) => {
        columnDefs.push({
          headerName: header || `Колонка ${index + 1}`,
          field: `col_${index}`,
          editable: true,
          minWidth: 100,
          flex: 1,
          cellStyle: { 
            fontSize: '11px',
            padding: '2px 4px' 
          }
        });
      });
    }

    // Создаем данные строк (пропускаем заголовки)
    const rowData = [];
    for (let i = 1; i < grid.length; i++) {
      const rowObj = {};
      grid[i].forEach((cellValue, colIndex) => {
        rowObj[`col_${colIndex}`] = cellValue;
      });
      rowData.push({
        ...rowObj,
        _rowIndex: i
      });
    }

    return { columnDefs, rowData };
  },

  // Обновить ячейку
  async updateCell(tableId, rowIndex, columnIndex, value) {
    try {
      // Сначала пытаемся обновить существующую ячейку
      const { data: existingCell, error: selectError } = await supabase
        .from('cells')
        .select('id')
        .eq('table_id', tableId)
        .eq('row_index', rowIndex)
        .eq('column_index', columnIndex)
        .single();

      if (existingCell) {
        // Ячейка существует - обновляем
        const { data, error } = await supabase
          .from('cells')
          .update({
            value: String(value),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCell.id)
          .select();

        if (error) throw error;
        return data;
      } else {
        // Ячейка не существует - создаем новую
        const { data, error } = await supabase
          .from('cells')
          .insert([
            {
              table_id: tableId,
              row_index: rowIndex,
              column_index: columnIndex,
              value: String(value),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ])
          .select();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error updating cell:', error);
      throw error;
    }
  },

  // Обновить ячейку по полю AG Grid
  async updateCellByField(tableId, rowIndex, field, value) {
    const columnIndex = parseInt(field.replace('col_', ''));
    return this.updateCell(tableId, rowIndex, columnIndex, value);
  },

  // Подписаться на изменения ячеек
  subscribeToTableChanges(tableId, callback) {
    return supabase
      .channel(`table_${tableId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cells',
          filter: `table_id=eq.${tableId}`
        },
        callback
      )
      .subscribe();
  },

  // Экспортировать данные в CSV
  async exportTableToCSV(tableId) {
    const cells = await this.getTableCells(tableId);
    
    if (cells.length === 0) {
      return '';
    }

    // Определяем размеры таблицы
    const maxRow = Math.max(...cells.map(cell => cell.row_index));
    const maxCol = Math.max(...cells.map(cell => cell.column_index));

    // Создаем двумерный массив
    const grid = Array(maxRow + 1).fill(null).map(() => Array(maxCol + 1).fill(''));

    // Заполняем сетку данными
    cells.forEach(cell => {
      grid[cell.row_index][cell.column_index] = cell.value;
    });

    // Конвертируем в CSV
    return Papa.unparse(grid, {
      delimiter: ';',
      skipEmptyLines: false
    });
  }
};

// Функции для работы с креативами - ОБНОВЛЕНО с поддержкой комментариев
export const creativeService = {
  // Создать новый креатив
  async createCreative(creativeData) {
    console.log('📝 Создание креатива с данными:', {
      article: creativeData.article,
      linksCount: creativeData.links?.length || 0,
      workTypesCount: creativeData.work_types?.length || 0,
      hasComment: !!creativeData.comment,
      cof_rating: creativeData.cof_rating
    });

    const { data, error } = await supabase
      .from('creatives')
      .insert([
        {
          user_id: creativeData.user_id,
          editor_name: creativeData.editor_name,
          article: creativeData.article,
          links: creativeData.links,
          link_titles: creativeData.link_titles || [],
          work_types: creativeData.work_types,
          cof_rating: creativeData.cof_rating,
          comment: creativeData.comment || null // Добавляем поддержку комментария
          // created_at и updated_at установятся автоматически через DEFAULT NOW()
        }
      ])
      .select();

    if (error) {
      console.error('❌ Ошибка создания креатива:', error);
      throw error;
    }

    console.log('✅ Креатив создан успешно:', data[0]);
    return data[0];
  },

  // Получить креативы пользователя
  async getUserCreatives(userId) {
    try {
      console.log('📡 Запрос креативов пользователя:', userId);
      
      const { data, error } = await supabase
        .from('creatives')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Ошибка в getUserCreatives:', error);
        throw error;
      }
      
      const result = data || [];
      console.log('✅ getUserCreatives завершен, получено креативов:', result.length);
      
      // Показываем статистику комментариев
      const withComments = result.filter(c => c.comment && c.comment.trim());
      console.log('💬 Креативов с комментариями:', withComments.length);
      
      return result;
      
    } catch (error) {
      console.error('💥 Критическая ошибка в getUserCreatives:', error);
      return [];
    }
  },

  // Получить все креативы (для админов)
  async getAllCreatives() {
    try {
      console.log('📡 Запрос к таблице creatives...');
      
      const { data, error } = await supabase
        .from('creatives')
        .select(`
          *,
          users(name, email)
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Ошибка в getAllCreatives:', error);
        console.error('📋 Детали ошибки:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      const result = data || [];
      console.log('✅ getAllCreatives завершен успешно, получено записей:', result.length);
      
      // Выводим пример первой записи для отладки
      if (result.length > 0) {
        console.log('📋 Пример записи креатива:', {
          id: result[0].id,
          article: result[0].article,
          work_types: result[0].work_types,
          cof_rating: result[0].cof_rating,
          editor_name: result[0].editor_name,
          hasComment: !!result[0].comment,
          hasUsers: !!result[0].users
        });
      }
      
      // Показываем статистику комментариев
      const withComments = result.filter(c => c.comment && c.comment.trim());
      console.log('💬 Креативов с комментариями:', withComments.length);
      
      return result;
      
    } catch (error) {
      console.error('💥 Критическая ошибка в getAllCreatives:', error);
      // Возвращаем пустой массив вместо null для предотвращения ошибок
      return [];
    }
  },

  // Обновить креатив
  async updateCreative(creativeId, updates) {
    console.log('📝 Обновление креатива:', creativeId, updates);

    const { data, error } = await supabase
      .from('creatives')
      .update({
        ...updates
        // updated_at обновится автоматически через триггер
      })
      .eq('id', creativeId)
      .select();

    if (error) {
      console.error('❌ Ошибка обновления креатива:', error);
      throw error;
    }

    console.log('✅ Креатив обновлен:', data[0]);
    return data[0];
  },

  // Обновить комментарий к креативу
  async updateCreativeComment(creativeId, comment) {
    return this.updateCreative(creativeId, { 
      comment: comment && comment.trim() ? comment.trim() : null 
    });
  },

  // Удалить креатив
  async deleteCreative(creativeId) {
    console.log('🗑️ Удаление креатива:', creativeId);

    const { error } = await supabase
      .from('creatives')
      .delete()
      .eq('id', creativeId);
    
    if (error) {
      console.error('❌ Ошибка удаления креатива:', error);
      throw error;
    }

    console.log('✅ Креатив удален');
  },

  // Подписаться на изменения креативов пользователя
  subscribeToUserCreatives(userId, callback) {
    return supabase
      .channel(`user_creatives_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'creatives',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  },

  // Получить креативы с метриками рекламы (новый метод)
  async getCreativesWithMetrics(userId = null) {
    try {
      let query = supabase
        .from('creatives')
        .select(`
          *,
          users(name, email)
        `)
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      const result = data || [];
      console.log(`✅ Получено ${result.length} креативов для загрузки метрик`);
      
      return result;
      
    } catch (error) {
      console.error('💥 Ошибка получения креативов с метриками:', error);
      return [];
    }
  }
};

// Сервис для работы с метриками рекламы (интеграция с внешним API через прокси)
export const metricsService = {
  // Определяем URL в зависимости от окружения
  getApiUrl() {
    // В продакшене используем Netlify функцию
    if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
      return '/.netlify/functions/metrics-proxy';
    }
    
    // В разработке тоже используем Netlify функцию если она доступна
    return '/.netlify/functions/metrics-proxy';
  },
  
  API_URL: null, // Будет установлен динамически
  DB_SOURCE: "facebook",
  TIMEZONE: "Europe/Kiev",

  /**
   * Построение SQL запроса для агрегированных данных по имени видео
   */
  buildAggregateSqlForVideo(videoName, source = null) {
    const escapedVideoName = this.sqlEscapeLiteral(videoName);
    const escapedSource = this.sqlEscapeLiteral(source || this.DB_SOURCE);
    
    return `
      SELECT
        COALESCE(SUM(valid), 0)                       AS leads,
        COALESCE(SUM(cost), 0)                        AS cost,
        COALESCE(SUM(clicks_on_link_tracker), 0)      AS clicks,
        COALESCE(SUM(showed), 0)                      AS impressions
      FROM ads_collection
      WHERE source='${escapedSource}' AND video_name='${escapedVideoName}'
    `;
  },

  /**
   * Экранирование строки для SQL
   */
  sqlEscapeLiteral(str) {
    return String(str).replace(/'/g, "''");
  },

  /**
   * Отправка запроса к API базы данных через Netlify прокси
   */
  async fetchFromDatabase(sql) {
    if (!/^(\s*select\b)/i.test(sql)) {
      throw new Error("Разрешены только SELECT-запросы.");
    }

    // Устанавливаем URL если не установлен
    if (!this.API_URL) {
      this.API_URL = this.getApiUrl();
    }

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ sql }),
    };

    try {
      console.log('📡 Запрос к прокси функции:', this.API_URL);
      
      const response = await fetch(this.API_URL, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.details || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        console.log('⚠️ Пустой ответ от прокси функции');
        return [];
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error('❌ Неверный JSON от прокси функции:', text.substring(0, 200));
        throw new Error("Неверный JSON от сервера: " + e.message);
      }

      // Проверяем на ошибки в ответе
      if (json && typeof json === "object" && json.error) {
        throw new Error("Ошибка API: " + (json.details || json.error));
      }

      const result = Array.isArray(json) ? json : [];
      console.log('✅ Успешный ответ от прокси функции, записей:', result.length);
      
      return result;
      
    } catch (error) {
      console.error('❌ Ошибка запроса через прокси:', error);
      
      // Более детальная обработка ошибок
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Сервис метрик недоступен. Проверьте подключение к интернету.');
      }
      
      throw error;
    }
  },

  /**
   * Нормализация ответа базы данных к объекту агрегатов
   */
  normalizeAggregateRow(dbResponse) {
    if (!dbResponse || dbResponse.length === 0) {
      return {
        leads: 0,
        cost: 0,
        clicks: 0,
        impressions: 0
      };
    }

    // Случай A: массив объектов
    if (typeof dbResponse[0] === "object" && !Array.isArray(dbResponse[0])) {
      const row = dbResponse[0];
      return {
        leads: Number(row.leads) || 0,
        cost: Number(row.cost) || 0,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0
      };
    }

    // Случай B: [headers, ...rows]
    const headers = dbResponse[0];
    const dataRow = dbResponse[1] || [];
    const map = {};
    headers.forEach((h, i) => (map[h] = dataRow[i]));
    
    return {
      leads: Number(map.leads) || 0,
      cost: Number(map.cost) || 0,
      clicks: Number(map.clicks) || 0,
      impressions: Number(map.impressions) || 0
    };
  },

  /**
   * Вычисление производных метрик
   */
  computeDerivedMetrics({ leads, cost, clicks, impressions }) {
    const fix2 = (x) => Number.isFinite(x) ? Number(x.toFixed(2)) : 0;
    
    const CPL = leads > 0 ? cost / leads : 0;
    const CTR = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const CPC = clicks > 0 ? cost / clicks : 0;
    const CPM = impressions > 0 ? (cost / impressions) * 1000 : 0;

    return {
      leads,
      cost: fix2(cost),
      clicks,
      impressions,
      cpl: fix2(CPL),
      ctr_percent: fix2(CTR),
      cpc: fix2(CPC),
      cpm: fix2(CPM)
    };
  },

  /**
   * Форматирование метрик для отображения
   */
  formatMetrics(metrics) {
    const formatInt = (n) => String(Math.round(Number(n) || 0));
    const formatMoney = (n) => (Number(n) || 0).toFixed(2).replace(".", ",");
    const formatPercent = (n) => (Number(n) || 0).toFixed(2).replace(".", ",") + "%";

    return {
      leads: formatInt(metrics.leads),
      cpl: formatMoney(metrics.cpl),
      cost: formatMoney(metrics.cost),
      ctr: formatPercent(metrics.ctr_percent),
      cpc: formatMoney(metrics.cpc),
      cpm: formatMoney(metrics.cpm),
      clicks: formatInt(metrics.clicks),
      impressions: formatInt(metrics.impressions)
    };
  },

  /**
   * Получение метрик для конкретного видео по названию
   */
  async getVideoMetrics(videoName) {
    if (!videoName || typeof videoName !== 'string') {
      throw new Error('Название видео обязательно');
    }

    try {
      console.log(`🔍 Поиск метрик для видео: "${videoName}"`);
      
      const sql = this.buildAggregateSqlForVideo(videoName, this.DB_SOURCE);
      const dbResponse = await this.fetchFromDatabase(sql);
      
      if (!dbResponse || dbResponse.length === 0) {
        console.log(`❌ Не найдено метрик для видео: "${videoName}"`);
        return {
          found: false,
          error: 'Не найдено в базе данных'
        };
      }

      const aggregates = this.normalizeAggregateRow(dbResponse);
      
      // Проверяем что есть хоть какие-то данные
      if (aggregates.leads === 0 && aggregates.cost === 0 && aggregates.clicks === 0 && aggregates.impressions === 0) {
        console.log(`❌ Найдена запись, но все метрики равны 0 для видео: "${videoName}"`);
        return {
          found: false,
          error: 'Нет активности по этому видео'
        };
      }
      
      const metrics = this.computeDerivedMetrics(aggregates);
      const formatted = this.formatMetrics(metrics);
      
      console.log(`✅ Найдены метрики для видео: "${videoName}"`, formatted);
      
      return {
        found: true,
        data: {
          raw: metrics,
          formatted: formatted,
          videoName: videoName,
          source: this.DB_SOURCE,
          updatedAt: new Date().toLocaleString('ru-RU', {
            timeZone: this.TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      };
    } catch (error) {
      console.error(`❌ Ошибка получения метрик для видео: "${videoName}"`, error);
      return {
        found: false,
        error: error.message
      };
    }
  },

  /**
   * Получение метрик для множества видео (батчевая обработка)
   */
  async getBatchVideoMetrics(videoNames) {
    if (!Array.isArray(videoNames)) {
      throw new Error('videoNames должен быть массивом');
    }

    console.log(`🔍 Батчевый поиск метрик для ${videoNames.length} видео`);

    const results = await Promise.allSettled(
      videoNames.map(async (videoName, index) => {
        try {
          // Небольшая задержка между запросами чтобы не перегружать прокси
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          const result = await this.getVideoMetrics(videoName);
          return {
            videoName,
            ...result
          };
        } catch (error) {
          return {
            videoName,
            found: false,
            error: error.message
          };
        }
      })
    );

    const finalResults = results.map((result, index) => ({
      videoName: videoNames[index],
      ...(result.status === 'fulfilled' ? result.value : {
        found: false,
        error: 'Неизвестная ошибка при обработке'
      })
    }));

    const successCount = finalResults.filter(r => r.found).length;
    console.log(`✅ Батчевая загрузка завершена: ${successCount}/${videoNames.length} видео с метриками`);

    return finalResults;
  },

  /**
   * Извлечение имени файла без расширения (если нужно)
   */
  extractVideoName(fileName) {
    if (!fileName) return '';
    
    // Убираем расширения видео файлов
    const cleanName = fileName.replace(/\.(mp4|avi|mov|mkv|webm|m4v)$/i, '');
    return cleanName.trim();
  },

  /**
   * Проверка статуса API
   */
  async checkApiStatus() {
    try {
      console.log('🔍 Проверка статуса API метрик...');
      
      const testSql = "SELECT 1 as test LIMIT 1";
      const result = await this.fetchFromDatabase(testSql);
      
      console.log('✅ API метрик доступен');
      return { available: true };
    } catch (error) {
      console.error('❌ API метрик недоступен:', error.message);
      return { 
        available: false, 
        error: error.message 
      };
    }
  }
};
