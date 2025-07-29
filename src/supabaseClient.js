import { createClient } from '@supabase/supabase-js';

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
    const { data, error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        name: userData.name,
        role: userData.role
      }
    });

    if (error) throw error;

    // Создаем профиль в таблице users
    const { error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: data.user.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          created_at: new Date().toISOString()
        }
      ]);

    if (profileError) throw profileError;
    return data;
  },

  // Удалить пользователя
  async deleteUser(userId) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    
    if (error) throw error;
  },

  // Получить всех байеров (для тим лидов)
  async getAllBuyers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'buyer')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
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

  // Создать/обновить таблицу пользователя
  async saveUserTable(userId, htmlContent, cssContent) {
    const { data, error } = await supabase
      .from('tables')
      .upsert([
        {
          user_id: userId,
          html_content: htmlContent,
          css_content: cssContent,
          updated_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;
    return data;
  },

  // Получить все таблицы (для тим лидов)
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

  // Обновить ячейку
  async updateCell(tableId, rowIndex, columnIndex, value) {
    const { data, error } = await supabase
      .from('cells')
      .upsert([
        {
          table_id: tableId,
          row_index: rowIndex,
          column_index: columnIndex,
          value: value,
          updated_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;
    return data;
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
  }
};