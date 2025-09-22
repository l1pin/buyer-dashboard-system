// Полностью обновленный supabaseClient.js с исправлениями для метрик аналитики
// Замените полностью содержимое src/supabaseClient.js

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
      cof_rating: creativeData.cof_rating,
      is_poland: creativeData.is_poland
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
          comment: creativeData.comment || null, // Добавляем поддержку комментария
          is_poland: creativeData.is_poland || false // Добавляем поддержку флага страны
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

// ИСПРАВЛЕННЫЕ функции для работы с метриками аналитики
export const metricsAnalyticsService = {
  // Загрузить метрики из CSV
  async uploadMetrics(metricsData) {
    try {
      console.log('📊 Загружаем метрики аналитики:', metricsData.length, 'записей');

      // Очищаем старые данные
      const { error: deleteError } = await supabase
        .from('metrics_analytics')
        .delete()
        .neq('id', 0); // Удаляем все записи

      if (deleteError) {
        console.error('Ошибка очистки старых метрик:', deleteError);
      }

      // Добавляем новые данные батчами с лучшей обработкой ошибок
      const batchSize = 50; // Уменьшили размер батча для надежности
      let successfullyInserted = 0;
      
      for (let i = 0; i < metricsData.length; i += batchSize) {
        const batch = metricsData.slice(i, i + batchSize);
        console.log(`📤 Загрузка батча ${Math.floor(i/batchSize) + 1}/${Math.ceil(metricsData.length/batchSize)} (записи ${i + 1}-${Math.min(i + batchSize, metricsData.length)})`);
        
        const { data, error: insertError } = await supabase
          .from('metrics_analytics')
          .insert(batch)
          .select('id');

        if (insertError) {
          console.error(`❌ Ошибка вставки батча ${i + 1}-${i + batchSize}:`, insertError);
          // Продолжаем загрузку следующих батчей
          continue;
        }
        
        successfullyInserted += data?.length || batch.length;
        console.log(`✅ Батч успешно загружен, всего записей: ${successfullyInserted}`);
      }

      // Обновляем время последнего обновления
      const { error: updateError } = await supabase
        .from('metrics_analytics_meta')
        .upsert([
          {
            id: 1,
            last_updated: new Date().toISOString(),
            total_records: successfullyInserted
          }
        ], {
          onConflict: 'id'
        });

      if (updateError) {
        console.error('Ошибка обновления метаданных:', updateError);
      }

      console.log(`✅ Метрики аналитики успешно загружены: ${successfullyInserted} из ${metricsData.length} записей`);
      return { success: true, count: successfullyInserted, total: metricsData.length };

    } catch (error) {
      console.error('❌ Ошибка загрузки метрик аналитики:', error);
      throw error;
    }
  },

  // Получить все метрики с поддержкой большого количества записей
  async getAllMetrics() {
    try {
      console.log('📡 Запрос метрик аналитики...');

      // Сначала получаем общее количество записей
      const { count, error: countError } = await supabase
        .from('metrics_analytics')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('Ошибка подсчета записей:', countError);
      }

      console.log(`📊 Всего записей в базе: ${count}`);

      // Получаем все метрики с увеличенным лимитом
      const { data: metrics, error: metricsError } = await supabase
        .from('metrics_analytics')
        .select('*')
        .order('id', { ascending: true })
        .limit(10000); // Увеличили лимит до 10000

      if (metricsError) {
        console.error('Ошибка получения метрик:', metricsError);
        throw metricsError;
      }

      // Получаем метаданные
      const { data: meta, error: metaError } = await supabase
        .from('metrics_analytics_meta')
        .select('*')
        .eq('id', 1)
        .single();

      if (metaError && metaError.code !== 'PGRST116') {
        console.error('Ошибка получения метаданных:', metaError);
      }

      const actualCount = metrics?.length || 0;
      console.log(`✅ Получены метрики аналитики: ${actualCount} записей`);
      
      // Предупреждение если получили меньше записей чем ожидали
      if (count && actualCount < count) {
        console.warn(`⚠️ Получено ${actualCount} записей из ${count} в базе. Возможно, нужна пагинация.`);
      }

      return {
        metrics: metrics || [],
        lastUpdated: meta?.last_updated,
        totalRecords: meta?.total_records || actualCount,
        actualCount: actualCount,
        databaseCount: count
      };

    } catch (error) {
      console.error('❌ Ошибка получения метрик аналитики:', error);
      return {
        metrics: [],
        lastUpdated: null,
        totalRecords: 0,
        actualCount: 0,
        databaseCount: 0
      };
    }
  },

  // Получить метрики с пагинацией (новый метод для очень больших таблиц)
  async getMetricsWithPagination(page = 0, pageSize = 1000) {
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      console.log(`📡 Запрос метрик: страница ${page + 1}, записи ${from + 1}-${to + 1}`);

      const { data: metrics, error: metricsError, count } = await supabase
        .from('metrics_analytics')
        .select('*', { count: 'exact' })
        .order('id', { ascending: true })
        .range(from, to);

      if (metricsError) {
        throw metricsError;
      }

      return {
        metrics: metrics || [],
        totalCount: count,
        page: page,
        pageSize: pageSize,
        hasMore: count ? (to + 1) < count : false
      };

    } catch (error) {
      console.error('❌ Ошибка получения метрик с пагинацией:', error);
      throw error;
    }
  },

  // Получить все метрики для больших таблиц (с автоматической пагинацией)
  async getAllMetricsLarge() {
    try {
      console.log('📡 Запрос всех метрик (режим больших таблиц)...');
      
      let allMetrics = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const result = await this.getMetricsWithPagination(page, pageSize);
        allMetrics = [...allMetrics, ...result.metrics];
        hasMore = result.hasMore;
        page++;
        
        console.log(`📄 Загружена страница ${page}, всего записей: ${allMetrics.length}`);
        
        // Защита от бесконечного цикла
        if (page > 50) {
          console.warn('⚠️ Достигнут лимит страниц (50), прерываем загрузку');
          break;
        }
      }

      // Получаем метаданные
      const { data: meta, error: metaError } = await supabase
        .from('metrics_analytics_meta')
        .select('*')
        .eq('id', 1)
        .single();

      console.log(`✅ Загружены все метрики: ${allMetrics.length} записей`);

      return {
        metrics: allMetrics,
        lastUpdated: meta?.last_updated,
        totalRecords: meta?.total_records || allMetrics.length,
        actualCount: allMetrics.length
      };

    } catch (error) {
      console.error('❌ Ошибка получения всех метрик:', error);
      return {
        metrics: [],
        lastUpdated: null,
        totalRecords: 0,
        actualCount: 0
      };
    }
  },

  // Получить статистику по метрикам
  async getMetricsStats() {
    try {
      const { data, error } = await supabase
        .from('metrics_analytics')
        .select('offer_zone, actual_roi_percent, actual_lead')
        .not('actual_lead', 'eq', 'нет данных')
        .limit(10000); // Увеличили лимит

      if (error) throw error;

      const stats = {
        totalItems: data.length,
        zones: [...new Set(data.map(item => item.offer_zone).filter(Boolean))],
        avgROI: data.reduce((sum, item) => sum + (item.actual_roi_percent || 0), 0) / data.length || 0,
        withLeadData: data.filter(item => item.actual_lead !== null).length
      };

      return stats;

    } catch (error) {
      console.error('Ошибка получения статистики метрик:', error);
      return {
        totalItems: 0,
        zones: [],
        avgROI: 0,
        withLeadData: 0
      };
    }
  },

  // Удалить все метрики
  async clearAllMetrics() {
    try {
      const { error: deleteError } = await supabase
        .from('metrics_analytics')
        .delete()
        .neq('id', 0);

      if (deleteError) throw deleteError;

      // Очищаем метаданные
      const { error: metaError } = await supabase
        .from('metrics_analytics_meta')
        .delete()
        .eq('id', 1);

      if (metaError && metaError.code !== 'PGRST116') {
        console.error('Ошибка очистки метаданных:', metaError);
      }

      console.log('✅ Все метрики аналитики удалены');
      return { success: true };

    } catch (error) {
      console.error('❌ Ошибка удаления метрик аналитики:', error);
      throw error;
    }
  }
};
