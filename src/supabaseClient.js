// Полностью обновленный supabaseClient.js с исправленным созданием пользователей
// Замените полностью содержимое src/supabaseClient.js

import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

// Утилита для получения времени по Киеву с автоматическим учетом летнего/зимнего времени
const getKyivTime = () => {
  const now = new Date();
  
  // Получаем компоненты времени в часовом поясе Europe/Kiev
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kiev',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const getValue = (type) => parts.find(p => p.type === type)?.value;
  
  const year = getValue('year');
  const month = getValue('month');
  const day = getValue('day');
  const hour = getValue('hour');
  const minute = getValue('minute');
  const second = getValue('second');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  
  // Определяем текущий offset для Киева (зимой +02:00, летом +03:00)
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const kyivDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
  const diffHours = Math.round((kyivDate - utcDate) / (1000 * 60 * 60));
  const offset = diffHours === 3 ? '+03:00' : '+02:00';
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}${offset}`;
};

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;

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

// Административный клиент для создания пользователей (если доступен service role key)
let adminClient = null;
if (supabaseServiceRoleKey) {
  adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

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

  // ИСПРАВЛЕННАЯ функция создания нового пользователя
  async createUser(userData) {
    console.log('📝 Создание пользователя:', { email: userData.email, role: userData.role });

    try {
      // Сохраняем текущую сессию тим лида
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      console.log('💾 Сохраняем текущую сессию тим лида');

      // Полная проверка существующих пользователей (и в users, и в auth)
      const emailToCheck = userData.email.trim().toLowerCase();
      
      // Проверяем в таблице users
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('email, id')
        .eq('email', emailToCheck);

      if (checkError) {
        console.error('❌ Ошибка проверки users таблицы:', checkError);
      }

      if (existingUsers && existingUsers.length > 0) {
        throw new Error(`Пользователь с email "${userData.email}" уже существует в системе.`);
      }

      // Проверяем в auth.users через админ API
      if (adminClient) {
        try {
          const { data: { users: allAuthUsers }, error: listError } = await adminClient.auth.admin.listUsers();
          if (!listError) {
            const existingAuthUser = allAuthUsers?.find(u => u.email?.toLowerCase() === emailToCheck);
            if (existingAuthUser) {
              throw new Error(`Пользователь с email "${userData.email}" уже зарегистрирован в системе аутентификации.`);
            }
          }
        } catch (authCheckError) {
          console.warn('⚠️ Не удалось проверить auth пользователей:', authCheckError);
        }
      }

      // Метод 1: Используем административный клиент (рекомендуемый)
      if (adminClient) {
        console.log('🔧 Используем административный клиент...');
        
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true, // Автоматически подтверждаем email
          user_metadata: {
            name: userData.name,
            role: userData.role
          }
        });

        if (authError) {
          console.error('❌ Ошибка админ API:', authError);
          
          if (authError.message?.includes('already registered') || 
              authError.message?.includes('already exists') ||
              authError.message?.includes('User already registered')) {
            throw new Error(`Пользователь с email "${userData.email}" уже зарегистрирован в системе.`);
          }
          
          throw new Error(`Ошибка создания пользователя: ${authError.message}`);
        }

        if (!authData.user) {
          throw new Error('Не удалось создать пользователя в системе аутентификации');
        }

        console.log('✅ Auth пользователь создан, создаем профиль...');

        // Создаем запись в таблице users (или проверяем, что она уже создана триггером)
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .upsert([
            {
              id: authData.user.id,
              email: emailToCheck,
              name: userData.name.trim(),
              role: userData.role,
              created_by_id: userData.created_by_id,
              created_by_name: userData.created_by_name,
              is_protected: userData.role === 'teamlead' ? true : false,
              created_at: new Date().toISOString()
            }
          ], {
            onConflict: 'id', // При конфликте по ID - обновляем данные
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (profileError) {
          console.error('❌ Ошибка создания/обновления профиля:', profileError);
          
          // Проверяем, может профиль уже существует и нужно просто его получить
          const { data: existingProfile, error: getProfileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          if (!getProfileError && existingProfile) {
            console.log('✅ Профиль уже существует, используем существующий');
            
            // КРИТИЧЕСКИ ВАЖНО: Восстанавливаем сессию тим лида
            if (currentSession) {
              console.log('🔄 Восстанавливаем сессию тим лида...');
              await supabase.auth.setSession(currentSession);
              console.log('✅ Сессия тим лида восстановлена');
            }

            console.log('✅ Пользователь успешно создан (профиль был создан автоматически)');
            return { user: authData.user, profile: existingProfile };
          }
          
          // Если всё равно не удалось, очищаем auth пользователя
          try {
            await adminClient.auth.admin.deleteUser(authData.user.id);
            console.log('🧹 Auth пользователь удален после ошибки профиля');
          } catch (cleanupError) {
            console.error('⚠️ Ошибка очистки auth пользователя:', cleanupError);
          }
          
          throw new Error(`Ошибка создания профиля: ${profileError.message}`);
        }

        // КРИТИЧЕСКИ ВАЖНО: Восстанавливаем сессию тим лида
        if (currentSession) {
          console.log('🔄 Восстанавливаем сессию тим лида...');
          await supabase.auth.setSession(currentSession);
          console.log('✅ Сессия тим лида восстановлена');
        }

        console.log('✅ Пользователь успешно создан через админ API:', profileData);
        return { user: authData.user, profile: profileData };
      }

      // Метод 2: Обычная регистрация (НЕ рекомендуется, так как меняет сессию)
      console.log('🔧 Используем обычный клиент (внимание: может изменить текущую сессию)...');
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            role: userData.role
          },
          emailRedirectTo: undefined
        }
      });

      if (authError) {
        console.error('❌ Ошибка signUp:', authError);

        if (authError.message?.includes('User already registered')) {
          throw new Error(`Пользователь с email "${userData.email}" уже зарегистрирован в системе.`);
        }
        
        if (authError.message?.includes('signup is disabled')) {
          throw new Error('Регистрация новых пользователей отключена. Обратитесь к администратору системы.');
        }

        throw new Error(`Ошибка создания аккаунта: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Пользователь не был создан. Возможно, требуется подтверждение email.');
      }

      // Создаем запись в таблице users (или проверяем, что она уже создана триггером)
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .upsert([
          {
            id: authData.user.id,
            email: emailToCheck,
            name: userData.name.trim(),
            role: userData.role,
            created_by_id: userData.created_by_id,
            created_by_name: userData.created_by_name,
            is_protected: userData.role === 'teamlead' ? true : false,
            created_at: new Date().toISOString()
          }
        ], {
          onConflict: 'id', // При конфликте по ID - обновляем данные
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (profileError) {
        console.error('❌ Ошибка создания/обновления профиля:', profileError);
        
        // Проверяем, может профиль уже существует и нужно просто его получить
        const { data: existingProfile, error: getProfileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (!getProfileError && existingProfile) {
          console.log('✅ Профиль уже существует, используем существующий');
          
          // КРИТИЧЕСКИ ВАЖНО: Восстанавливаем сессию тим лида
          if (currentSession) {
            console.log('🔄 Восстанавливаем сессию тим лида...');
            await supabase.auth.setSession(currentSession);
            console.log('✅ Сессия тим лида восстановлена');
          }

          console.log('✅ Пользователь создан через обычный клиент (профиль был создан автоматически)');
          return { user: authData.user, profile: existingProfile };
        }
        
        throw new Error(`Ошибка создания профиля пользователя: ${profileError.message}`);
      }

      // КРИТИЧЕСКИ ВАЖНО: Восстанавливаем сессию тим лида
      if (currentSession) {
        console.log('🔄 Восстанавливаем сессию тим лида...');
        await supabase.auth.setSession(currentSession);
        console.log('✅ Сессия тим лида восстановлена');
      }

      console.log('✅ Пользователь создан через обычный клиент:', profileData);
      return { user: authData.user, profile: profileData };

    } catch (error) {
      console.error('💥 Критическая ошибка создания пользователя:', error);
      throw error;
    }
  },

  // Метод для проверки настроек Supabase (БЕЗ реального создания пользователей)
  async checkSupabaseConfig() {
    try {
      console.log('🔍 Проверка конфигурации Supabase...');
      
      // Просто проверяем доступность админ API и базовых настроек
      const config = {
        signUpEnabled: true, // Предполагаем что включено, если админ API доступен
        emailConfirmationRequired: false,
        adminApiAvailable: !!adminClient,
        error: undefined
      };

      // Если есть админ клиент, проверяем его работу БЕЗ создания пользователей
      if (adminClient) {
        try {
          // Просто пробуем получить список пользователей (безопасная операция)
          const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({
            page: 1,
            perPage: 1 // Берем только 1 пользователя для теста
          });

          if (listError) {
            config.adminApiAvailable = false;
            config.error = `Admin API недоступен: ${listError.message}`;
          } else {
            config.adminApiAvailable = true;
            console.log('✅ Admin API работает корректно');
          }
        } catch (adminTestError) {
          config.adminApiAvailable = false;
          config.error = `Ошибка тестирования Admin API: ${adminTestError.message}`;
        }
      } else {
        // Если нет админ клиента, просто проверяем базовые настройки
        config.adminApiAvailable = false;
        config.error = 'Service Role Key не настроен';
      }

      return config;

    } catch (error) {
      console.error('❌ Ошибка проверки конфигурации:', error);
      return {
        signUpEnabled: false,
        emailConfirmationRequired: false,
        adminApiAvailable: false,
        error: error.message
      };
    }
  },

  // Удалить пользователя
  async deleteUser(userId) {
    try {
      console.log('🗑️ Удаление пользователя:', userId);

      // Удаляем связанные данные
      await supabase.from('tables').delete().eq('user_id', userId);
      await supabase.from('creatives').delete().eq('user_id', userId);
      
      // Удаляем профиль
      const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (profileError) {
        console.error('❌ Ошибка удаления профиля:', profileError);
      }

      // Попытка удалить auth пользователя через админ API
      if (adminClient) {
        try {
          const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
          if (authError) {
            console.error('⚠️ Ошибка удаления auth записи:', authError);
          }
        } catch (authDeleteError) {
          console.error('⚠️ Не удалось удалить auth запись:', authDeleteError);
        }
      }

      console.log('✅ Пользователь удален');
      
    } catch (error) {
      console.error('❌ Ошибка удаления пользователя:', error);
      throw error;
    }
  },

  // Обновить пользователя
  async updateUser(userData) {
    try {
      console.log('📝 Обновление пользователя:', userData);

      const { id, password, ...profileUpdates } = userData;

      if (!id) {
        throw new Error('ID пользователя обязателен для обновления');
      }

      // Проверяем, не защищен ли пользователь
      const { data: currentUser, error: checkError } = await supabase
        .from('users')
        .select('is_protected')
        .eq('id', id)
        .single();

      if (checkError) {
        throw new Error(`Ошибка проверки пользователя: ${checkError.message}`);
      }

      if (currentUser.is_protected) {
        throw new Error('Данный пользователь защищен от изменений');
      }

      // Обновляем пароль в auth если он указан
      if (password && password.trim()) {
        if (adminClient) {
          console.log('🔧 Обновление пароля через админ API...');
          
          const { error: passwordError } = await adminClient.auth.admin.updateUserById(id, {
            password: password.trim()
          });

          if (passwordError) {
            console.error('❌ Ошибка обновления пароля:', passwordError);
            throw new Error(`Ошибка обновления пароля: ${passwordError.message}`);
          }
          
          console.log('✅ Пароль успешно обновлен');
        } else {
          console.warn('⚠️ Admin API недоступен, пароль не может быть обновлен');
          throw new Error('Для обновления пароля требуется Service Role Key');
        }
      }

      // Обновляем email в auth если он изменился
      if (profileUpdates.email) {
        const emailToUpdate = profileUpdates.email.trim().toLowerCase();
        
        if (adminClient) {
          console.log('📧 Обновление email через админ API...');
          
          const { error: emailError } = await adminClient.auth.admin.updateUserById(id, {
            email: emailToUpdate,
            email_confirm: true // Автоматически подтверждаем новый email
          });

          if (emailError) {
            console.error('❌ Ошибка обновления email:', emailError);
            
            if (emailError.message?.includes('already registered') || 
                emailError.message?.includes('already exists')) {
              throw new Error(`Email "${profileUpdates.email}" уже используется другим пользователем`);
            }
            
            throw new Error(`Ошибка обновления email: ${emailError.message}`);
          }
          
          console.log('✅ Email успешно обновлен в auth');
        }
        
        // Обновляем email в профиле
        profileUpdates.email = emailToUpdate;
      }

      // Обновляем профиль в таблице users
      console.log('👤 Обновление профиля пользователя...');
      
      const { data: updatedProfile, error: profileError } = await supabase
        .from('users')
        .update({
          ...profileUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (profileError) {
        console.error('❌ Ошибка обновления профиля:', profileError);
        
        if (profileError.code === '23505') {
          throw new Error(`Пользователь с такими данными уже существует`);
        }
        
        throw new Error(`Ошибка обновления профиля: ${profileError.message}`);
      }

      console.log('✅ Пользователь успешно обновлен:', updatedProfile);
      return updatedProfile;

    } catch (error) {
      console.error('❌ Ошибка обновления пользователя:', error);
      throw error;
    }
  },
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

  // Получить всех медиа байеров
  async getAllBuyers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'buyer')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Получить пользователей по роли
  async getUsersByRole(role) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', role)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Получить всех пользователей определенных ролей
  async getUsersByRoles(roles) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('role', roles)
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

// Остальные сервисы остаются без изменений
export const tableService = {
  // ... (существующий код без изменений)
  async getUserTable(userId) {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createTableFromCSV(userId, csvContent) {
    try {
      const parsedData = Papa.parse(csvContent, {
        header: false,
        skipEmptyLines: true,
        delimiter: ';'
      });

      if (!parsedData.data || parsedData.data.length === 0) {
        throw new Error('CSV файл пуст или содержит ошибки');
      }

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

      const { error: deleteError } = await supabase
        .from('cells')
        .delete()
        .eq('table_id', tableData.id);

      if (deleteError) throw deleteError;

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

  async getAllTables() {
    const { data, error } = await supabase
      .from('tables')
      .select(`
        *,
        users!tables_user_id_fkey(name, email)
      `)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
};

export const cellService = {
  // ... (существующий код остается без изменений)
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

  async getTableDataForGrid(tableId) {
    const cells = await this.getTableCells(tableId);
    
    if (cells.length === 0) {
      return { columnDefs: [], rowData: [] };
    }

    const maxRow = Math.max(...cells.map(cell => cell.row_index));
    const maxCol = Math.max(...cells.map(cell => cell.column_index));

    const grid = Array(maxRow + 1).fill(null).map(() => Array(maxCol + 1).fill(''));

    cells.forEach(cell => {
      grid[cell.row_index][cell.column_index] = cell.value;
    });

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

  async updateCell(tableId, rowIndex, columnIndex, value) {
    try {
      const { data: existingCell, error: selectError } = await supabase
        .from('cells')
        .select('id')
        .eq('table_id', tableId)
        .eq('row_index', rowIndex)
        .eq('column_index', columnIndex)
        .single();

      if (existingCell) {
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

  async updateCellByField(tableId, rowIndex, field, value) {
    const columnIndex = parseInt(field.replace('col_', ''));
    return this.updateCell(tableId, rowIndex, columnIndex, value);
  },

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

  async exportTableToCSV(tableId) {
    const cells = await this.getTableCells(tableId);
    
    if (cells.length === 0) {
      return '';
    }

    const maxRow = Math.max(...cells.map(cell => cell.row_index));
    const maxCol = Math.max(...cells.map(cell => cell.column_index));

    const grid = Array(maxRow + 1).fill(null).map(() => Array(maxCol + 1).fill(''));

    cells.forEach(cell => {
      grid[cell.row_index][cell.column_index] = cell.value;
    });

    return Papa.unparse(grid, {
      delimiter: ';',
      skipEmptyLines: false
    });
  }
};

// Остальные сервисы (creativeService, metricsAnalyticsService) остаются без изменений

// Сервис для работы с лендингами
export const landingService = {
  // Создать лендинг
  async createLanding(landingData) {
    console.log('📝 Создание лендинга с данными:', {
      article: landingData.article,
      template: landingData.template,
      tagsCount: landingData.tags?.length || 0,
      hasComment: !!landingData.comment,
      is_poland: landingData.is_poland,
      trello_link: landingData.trello_link,
      designer_id: landingData.designer_id,
      buyer_id: landingData.buyer_id,
      searcher_id: landingData.searcher_id
    });

    const { data, error } = await supabase
      .from('landings')
      .insert([
        {
          user_id: landingData.user_id,
          content_manager_name: landingData.content_manager_name,
          article: landingData.article,
          template: landingData.template,
          tags: landingData.tags || [],
          comment: landingData.comment || null,
          is_poland: landingData.is_poland || false,
          trello_link: landingData.trello_link || null,
          designer_id: landingData.designer_id || null,
          buyer_id: landingData.buyer_id || null,
          searcher_id: landingData.searcher_id || null,
          designer: landingData.designer || null,
          buyer: landingData.buyer || null,
          searcher: landingData.searcher || null,
          created_at: getKyivTime()
        }
      ])
      .select();

    if (error) {
      console.error('❌ Ошибка создания лендинга:', error);
      throw error;
    }

    const landing = data[0];
    console.log('✅ Лендинг создан успешно:', landing);

    return landing;
  },

  // Получить лендинги пользователя
  async getUserLandings(userId) {
    try {
      console.log('📡 Запрос лендингов пользователя:', userId);
      
      const { data, error } = await supabase
        .from('landings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Ошибка в getUserLandings:', error);
        throw error;
      }
      
      const result = data || [];
      console.log('✅ getUserLandings завершен, получено лендингов:', result.length);
      
      return result;
      
    } catch (error) {
      console.error('💥 Критическая ошибка в getUserLandings:', error);
      return [];
    }
  },

  // Получить все лендинги
  async getAllLandings() {
    try {
      console.log('📡 Запрос к таблице landings...');
      
      const { data, error } = await supabase
        .from('landings')
        .select(`
          *,
          users!landings_user_id_fkey(name, email)
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Ошибка в getAllLandings:', error);
        throw error;
      }
      
      const result = data || [];
      console.log('✅ getAllLandings завершен успешно, получено записей:', result.length);
      
      return result;
      
    } catch (error) {
      console.error('💥 Критическая ошибка в getAllLandings:', error);
      return [];
    }
  },

  // Обновить лендинг
  async updateLanding(landingId, updates) {
    console.log('📝 Обновление лендинга:', landingId, updates);

    const { data, error } = await supabase
      .from('landings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', landingId)
      .select();

    if (error) {
      console.error('❌ Ошибка обновления лендинга:', error);
      throw error;
    }

    console.log('✅ Лендинг обновлен:', data[0]);
    return data[0];
  },

  // Удалить лендинг
  async deleteLanding(landingId) {
    try {
      console.log('🗑️ Начинаем удаление лендинга:', landingId);

      // Проверяем, существует ли лендинг
      const { data: checkData, error: checkError } = await supabase
        .from('landings')
        .select('id, article')
        .eq('id', landingId)
        .single();

      if (checkError) {
        console.error('❌ Лендинг не найден:', checkError);
        throw new Error(`Лендинг не найден: ${checkError.message}`);
      }

      console.log('✅ Лендинг найден:', checkData);

      // Удаляем историю изменений лендинга
      console.log('📜 Удаление истории лендинга...');
      const { error: historyError } = await supabase
        .from('landing_history')
        .delete()
        .eq('landing_id', landingId);
      
      if (historyError) {
        console.error('⚠️ Ошибка удаления истории лендинга:', historyError);
      }

      // Удаляем сам лендинг
      console.log('🌐 Удаление лендинга из таблицы landings...');
      const { data: deletedData, error: landingError } = await supabase
        .from('landings')
        .delete()
        .eq('id', landingId)
        .select();
      
      if (landingError) {
        console.error('❌ ОШИБКА удаления лендинга:', landingError);
        throw new Error(`Не удалось удалить лендинг: ${landingError.message}`);
      }

      if (!deletedData || deletedData.length === 0) {
        throw new Error('Лендинг не был удален. Возможно, недостаточно прав доступа.');
      }

      console.log('✅ Лендинг полностью удален из системы');
      return { success: true };

    } catch (error) {
      console.error('❌ Критическая ошибка удаления лендинга:', error);
      throw error;
    }
  },

  // Подписка на изменения лендингов пользователя
  subscribeToUserLandings(userId, callback) {
    return supabase
      .channel(`user_landings_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'landings',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }
};

// Сервис для работы с историей лендингов
export const landingHistoryService = {
  // Создать запись в истории
  async createHistoryEntry(historyData) {
    try {
      console.log('📝 Создание записи истории лендинга:', historyData.landing_id);
      
      const dataToInsert = {
        ...historyData,
        changed_at: historyData.changed_at || getKyivTime(),
        created_at: getKyivTime()
      };
      
      const { data, error } = await supabase
        .from('landing_history')
        .insert([dataToInsert])
        .select();

      if (error) {
        console.error('❌ Ошибка создания записи истории:', error);
        throw error;
      }

      console.log('✅ Запись истории создана с киевским временем');
      return data[0];
    } catch (error) {
      console.error('💥 Критическая ошибка создания записи истории:', error);
      throw error;
    }
  },

  // Получить всю историю для лендинга
  async getLandingHistory(landingId) {
    try {
      console.log('📡 Запрос истории лендинга:', landingId);
      
      const { data, error } = await supabase
        .from('landing_history')
        .select('*')
        .eq('landing_id', landingId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('❌ Ошибка получения истории:', error);
        throw error;
      }

      console.log(`✅ Получено ${data?.length || 0} записей истории`);
      return data || [];
    } catch (error) {
      console.error('💥 Критическая ошибка получения истории:', error);
      return [];
    }
  },

  // Проверить, есть ли история у лендинга
  async hasHistory(landingId) {
    try {
      const { count, error } = await supabase
        .from('landing_history')
        .select('*', { count: 'exact', head: true })
        .eq('landing_id', landingId);

      if (error) throw error;

      return count > 0;
    } catch (error) {
      console.error('Ошибка проверки наличия истории:', error);
      return false;
    }
  }
};

// Сервис для работы с историей креативов
export const creativeHistoryService = {
  // Создать запись в истории
  async createHistoryEntry(historyData) {
    try {
      console.log('📝 Создание записи истории креатива:', historyData.creative_id);
      
      // Устанавливаем киевское время, если не передано
      const dataToInsert = {
        ...historyData,
        changed_at: historyData.changed_at || getKyivTime(),
        created_at: getKyivTime() // Всегда используем киевское время для created_at
      };
      
      const { data, error } = await supabase
        .from('creative_history')
        .insert([dataToInsert])
        .select();

      if (error) {
        console.error('❌ Ошибка создания записи истории:', error);
        throw error;
      }

      console.log('✅ Запись истории создана с киевским временем');
      return data[0];
    } catch (error) {
      console.error('💥 Критическая ошибка создания записи истории:', error);
      throw error;
    }
  },

  // Получить всю историю для креатива
  async getCreativeHistory(creativeId) {
    try {
      console.log('📡 Запрос истории креатива:', creativeId);
      
      const { data, error } = await supabase
        .from('creative_history')
        .select('*')
        .eq('creative_id', creativeId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('❌ Ошибка получения истории:', error);
        throw error;
      }

      console.log(`✅ Получено ${data?.length || 0} записей истории`);
      return data || [];
    } catch (error) {
      console.error('💥 Критическая ошибка получения истории:', error);
      return [];
    }
  },

  // Получить последнюю запись истории для креатива
  async getLastHistoryEntry(creativeId) {
    try {
      const { data, error } = await supabase
        .from('creative_history')
        .select('*')
        .eq('creative_id', creativeId)
        .order('changed_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Ошибка получения последней записи истории:', error);
      return null;
    }
  },

  // Проверить, есть ли история у креатива
  async hasHistory(creativeId) {
    try {
      const { count, error } = await supabase
        .from('creative_history')
        .select('*', { count: 'exact', head: true })
        .eq('creative_id', creativeId);

      if (error) throw error;

      return count > 0;
    } catch (error) {
      console.error('Ошибка проверки наличия истории:', error);
      return false;
    }
  }
};

export const creativeService = {
  async createCreative(creativeData) {
    console.log('📝 Создание креатива с данными:', {
      article: creativeData.article,
      linksCount: creativeData.links?.length || 0,
      workTypesCount: creativeData.work_types?.length || 0,
      hasComment: !!creativeData.comment,
      cof_rating: creativeData.cof_rating,
      is_poland: creativeData.is_poland,
      trello_link: creativeData.trello_link,
      buyer_id: creativeData.buyer_id,
      searcher_id: creativeData.searcher_id
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
          comment: creativeData.comment || null,
          is_poland: creativeData.is_poland || false,
          trello_link: creativeData.trello_link || null,
          buyer_id: creativeData.buyer_id || null,
          searcher_id: creativeData.searcher_id || null,
          buyer: creativeData.buyer || null,
          searcher: creativeData.searcher || null,
          created_at: getKyivTime() // 🕐 Киевское время
        }
      ])
      .select();

    if (error) {
      console.error('❌ Ошибка создания креатива:', error);
      throw error;
    }

    const creative = data[0];
    console.log('✅ Креатив создан успешно:', creative);

    // 🚀 АВТОМАТИЧЕСКАЯ синхронизация статуса Trello - ТЕПЕРЬ НЕ НУЖНА
    // Синхронизация будет выполнена через Netlify Function на фронтенде
    console.log('✅ Креатив создан, синхронизация Trello будет выполнена на клиенте');

    return creative;
  },

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
      
      const withComments = result.filter(c => c.comment && c.comment.trim());
      console.log('💬 Креативов с комментариями:', withComments.length);
      
      return result;
      
    } catch (error) {
      console.error('💥 Критическая ошибка в getUserCreatives:', error);
      return [];
    }
  },

  async getCreativesByBuyerId(buyerId) {
    try {
      console.log('📡 Запрос креативов для байера:', buyerId);
      
      const { data, error } = await supabase
        .from('creatives')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Ошибка в getCreativesByBuyerId:', error);
        throw error;
      }
      
      const result = data || [];
      console.log('✅ getCreativesByBuyerId завершен, получено креативов:', result.length);
      
      const withComments = result.filter(c => c.comment && c.comment.trim());
      console.log('💬 Креативов с комментариями:', withComments.length);
      
      return result;
      
    } catch (error) {
      console.error('💥 Критическая ошибка в getCreativesByBuyerId:', error);
      return [];
    }
  },

  async getAllCreatives() {
    try {
      console.log('📡 Запрос к таблице creatives...');
      
      const { data, error } = await supabase
        .from('creatives')
        .select(`
          *,
          users!creatives_user_id_fkey(name, email)
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
      
      const withComments = result.filter(c => c.comment && c.comment.trim());
      console.log('💬 Креативов с комментариями:', withComments.length);
      
      return result;
      
    } catch (error) {
      console.error('💥 Критическая ошибка в getAllCreatives:', error);
      return [];
    }
  },

  async updateCreative(creativeId, updates) {
    console.log('📝 Обновление креатива:', creativeId, updates);

    const { data, error } = await supabase
      .from('creatives')
      .update(updates)
      .eq('id', creativeId)
      .select();

    if (error) {
      console.error('❌ Ошибка обновления креатива:', error);
      throw error;
    }

    console.log('✅ Креатив обновлен:', data[0]);
    return data[0];
  },

  async updateCreativeComment(creativeId, comment) {
    return this.updateCreative(creativeId, { 
      comment: comment && comment.trim() ? comment.trim() : null 
    });
  },

  async deleteCreative(creativeId) {
    try {
      console.log('🗑️ Начинаем удаление креатива:', creativeId);

      // Сначала проверяем, существует ли креатив
      const { data: checkData, error: checkError } = await supabase
        .from('creatives')
        .select('id, article')
        .eq('id', creativeId)
        .single();

      if (checkError) {
        console.error('❌ Креатив не найден:', checkError);
        throw new Error(`Креатив не найден: ${checkError.message}`);
      }

      console.log('✅ Креатив найден:', checkData);

      // Шаг 1: Удаляем историю изменений креатива
      console.log('📜 Удаление истории креатива...');
      const { data: historyData, error: historyError, count: historyCount } = await supabase
        .from('creative_history')
        .delete()
        .eq('creative_id', creativeId)
        .select();
      
      if (historyError) {
        console.error('⚠️ Ошибка удаления истории креатива:', historyError);
      } else {
        console.log(`✅ История креатива удалена: ${historyData?.length || 0} записей`);
      }

      // Шаг 2: Удаляем кэш метрик креатива
      console.log('💾 Удаление кэша метрик...');
      const { data: cacheData, error: cacheError, count: cacheCount } = await supabase
        .from('metrics_cache')
        .delete()
        .eq('creative_id', creativeId)
        .select();
      
      if (cacheError) {
        console.error('⚠️ Ошибка удаления кэша метрик:', cacheError);
      } else {
        console.log(`✅ Кэш метрик удален: ${cacheData?.length || 0} записей`);
      }

      // Шаг 3: Удаляем сам креатив
      console.log('🎬 Удаление креатива из таблицы creatives...');
      const { data: deletedData, error: creativeError, count: deleteCount } = await supabase
        .from('creatives')
        .delete()
        .eq('id', creativeId)
        .select();
      
      if (creativeError) {
        console.error('❌ ОШИБКА удаления креатива:', {
          error: creativeError,
          message: creativeError.message,
          details: creativeError.details,
          hint: creativeError.hint,
          code: creativeError.code
        });
        throw new Error(`Не удалось удалить креатив: ${creativeError.message}`);
      }

      console.log('📊 Результат удаления креатива:', {
        deletedData: deletedData,
        deletedCount: deletedData?.length || 0
      });

      if (!deletedData || deletedData.length === 0) {
        console.error('⚠️ ВНИМАНИЕ: Запрос выполнен, но ничего не удалено! Проверьте RLS политики!');
        throw new Error('Креатив не был удален. Возможно, недостаточно прав доступа.');
      }

      // Проверяем, что креатив действительно удален
      const { data: verifyData, error: verifyError } = await supabase
        .from('creatives')
        .select('id')
        .eq('id', creativeId)
        .single();

      if (verifyData) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Креатив все еще существует после удаления!');
        throw new Error('Креатив не был удален из базы данных. Проверьте права доступа.');
      }

      console.log('✅ Креатив полностью удален из системы и проверка подтвердила удаление');
      return { success: true };

    } catch (error) {
      console.error('❌ Критическая ошибка удаления креатива:', error);
      throw error;
    }
  },

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

  async getCreativesWithMetrics(userId = null) {
    try {
      let query = supabase
        .from('creatives')
        .select(`
          *,
          users!creatives_user_id_fkey(name, email)
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

// Сервис для работы со статусами карточек Trello
export const trelloService = {
  // Получить статус карточки для креатива
  async getCardStatus(creativeId) {
    try {
      const { data, error } = await supabase
        .from('trello_card_statuses')
        .select('*')
        .eq('creative_id', creativeId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Ошибка получения статуса Trello карточки:', error);
      return null;
    }
  },

  // Получить статусы для нескольких креативов
  async getBatchCardStatuses(creativeIds) {
    try {
      console.log('🔵 getBatchCardStatuses вызван с', creativeIds.length, 'ID');
      
      const { data, error } = await supabase
        .from('trello_card_statuses')
        .select('*')
        .in('creative_id', creativeIds);

      if (error) {
        console.error('❌ Ошибка запроса к trello_card_statuses:', error);
        throw error;
      }
      
      console.log('📦 Получено из БД:', data?.length || 0, 'статусов');
      if (data && data.length > 0) {
        console.log('📋 Первый статус:', data[0]);
      }
      
      // Преобразуем в Map для быстрого доступа
      const statusMap = new Map();
      (data || []).forEach(status => {
        statusMap.set(status.creative_id, status);
      });
      
      console.log('✅ Map создан, размер:', statusMap.size);
      console.log('🗺️ Ключи Map (первые 5):', Array.from(statusMap.keys()).slice(0, 5));
      
      return statusMap;
    } catch (error) {
      console.error('❌ Ошибка получения батча статусов Trello:', error);
      return new Map();
    }
  },

  // Получить все списки (колонки) доски
  async getAllLists() {
    try {
      const { data, error } = await supabase
        .from('trello_lists')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Ошибка получения списков Trello:', error);
      return [];
    }
  },

  // Массовая синхронизация статусов
  async syncMultipleCreatives(creatives) {
    console.log(`🔄 Массовая синхронизация ${creatives.length} креативов...`);
    
    const results = {
      success: [],
      errors: []
    };
    
    for (const creative of creatives) {
      try {
        console.log(`📋 Синхронизация ${creative.article}...`);
        
        const result = await this.syncSingleCreative(creative.id, creative.trello_link);
        
        results.success.push({
          creativeId: creative.id,
          article: creative.article,
          listName: result.listName
        });
        
        console.log(`✅ ${creative.article}: ${result.listName}`);
        
        // Задержка между запросами (300ms)
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`❌ Ошибка синхронизации ${creative.article}:`, error.message);
        
        results.errors.push({
          creativeId: creative.id,
          article: creative.article,
          error: error.message
        });
      }
    }
    
    console.log(`🎉 Массовая синхронизация завершена: ${results.success.length} успешно, ${results.errors.length} ошибок`);
    
    return results;
  },

  subscribeToCardStatuses(callback) {

    return supabase
      .channel('trello_card_statuses_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trello_card_statuses'
        },
        callback
      )
      .subscribe();
  },

  // Вызов функции настройки Trello webhook
  async setupTrelloWebhook() {
    try {
      const response = await fetch('/.netlify/functions/trello-setup', {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Setup failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Ошибка настройки Trello webhook:', error);
      throw error;
    }
  },

  // Ручная синхронизация статуса для одного креатива через Netlify Function
  async syncSingleCreative(creativeId, trelloLink) {
    try {
      console.log('🔄 syncSingleCreative через Netlify Function:', { creativeId, trelloLink });
      
      if (!trelloLink) {
        throw new Error('Нет ссылки на Trello');
      }

      // Вызываем СЕРВЕРНУЮ Netlify Function
      const response = await fetch('/.netlify/functions/trello-sync-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          creativeId: creativeId,
          trelloLink: trelloLink
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Ошибка Netlify Function:', response.status, errorText);
        throw new Error(`Ошибка синхронизации: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Результат синхронизации:', result);

      return result;
      
    } catch (error) {
      console.error('❌ syncSingleCreative ERROR:', error);
      throw error;
    }
  }
};

export const metricsAnalyticsService = {
  async uploadMetrics(metricsData) {
    try {
      console.log('📊 Загружаем метрики аналитики:', metricsData.length, 'записей');

      const { error: deleteError } = await supabase
        .from('metrics_analytics')
        .delete()
        .neq('id', 0);

      if (deleteError) {
        console.error('Ошибка очистки старых метрик:', deleteError);
      }

      const batchSize = 50;
      let successfullyInserted = 0;
      
      for (let i = 0; i < metricsData.length; i += batchSize) {
        const batch = metricsData.slice(i, i + batchSize);
        console.log(`📤 Загрузка батча ${Math.floor(i/batchSize) + 1}/${Math.ceil(metricsData.length/batchSize)} (записи ${i + 1}-${Math.min(i + batchSize, metricsData.length)})`);
        
        const { data, error: insertError } = await supabase
          .from('metrics_analytics')
          .insert(batch)
          .select('id');

        if (insertError) {
          console.error(`❌ Ошибка вставки батча ${i + 1}-${i + batchSize}:`, {
            error: insertError,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code,
            sampleData: batch[0]
          });
          continue;
        }
        
        successfullyInserted += data?.length || batch.length;
        console.log(`✅ Батч успешно загружен, всего записей: ${successfullyInserted}`);
      }

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

  async getAllMetrics() {
    try {
      console.log('📡 Запрос метрик аналитики...');

      const { count, error: countError } = await supabase
        .from('metrics_analytics')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('Ошибка подсчета записей:', countError);
      }

      console.log(`📊 Всего записей в базе: ${count}`);

      const { data: metrics, error: metricsError } = await supabase
        .from('metrics_analytics')
        .select('*')
        .order('id', { ascending: true })
        .limit(10000);

      if (metricsError) {
        console.error('Ошибка получения метрик:', metricsError);
        throw metricsError;
      }

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
        
        if (page > 50) {
          console.warn('⚠️ Достигнут лимит страниц (50), прерываем загрузку');
          break;
        }
      }

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

  async getMetricsStats() {
    try {
      const { data, error } = await supabase
        .from('metrics_analytics')
        .select('offer_zone, actual_roi_percent, actual_lead')
        .not('actual_lead', 'eq', 'нет данных')
        .limit(10000);

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

  async getZoneDataByArticle(article) {
    try {
      if (!article || !article.trim()) {
        return null;
      }

      console.log(`🎯 Поиск зональных данных для артикула: ${article}`);

      const { data, error } = await supabase
        .from('metrics_analytics')
        .select('article, red_zone_price, pink_zone_price, gold_zone_price, green_zone_price, offer_zone')
        .eq('article', article.trim())
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`❌ Зональные данные не найдены для артикула: ${article}`);
          return null;
        }
        throw error;
      }

      if (data) {
        console.log(`✅ Найдены зональные данные для артикула ${article}:`, {
          red: data.red_zone_price,
          pink: data.pink_zone_price,
          gold: data.gold_zone_price,
          green: data.green_zone_price,
          current_zone: data.offer_zone
        });
      }

      return data;

    } catch (error) {
      console.error(`❌ Ошибка получения зональных данных для артикула ${article}:`, error);
      return null;
    }
  },

  // Сервис для кэширования метрик
  async saveMetricsCache(creativeId, article, videoIndex, videoTitle, metricsData, period = 'all') {
    try {
      // Извлекаем только базовые метрики из metricsData
      const rawMetrics = metricsData.raw || metricsData;
      
      // 🔥 ДИАГНОСТИКА: Проверяем rawMetrics перед сохранением
      console.log('🔥 rawMetrics ПЕРЕД СОХРАНЕНИЕМ В SUPABASE:', {
        creative_id: creativeId,
        video_title: videoTitle,
        period: period,
        cost_from_sources: rawMetrics.cost_from_sources,
        clicks_on_link: rawMetrics.clicks_on_link,
        allKeys: Object.keys(rawMetrics)
      });
      
      const dataToSave = {
        creative_id: creativeId,
        article: article,
        video_index: videoIndex,
        video_title: videoTitle,
        period: period,
        // Базовые метрики в отдельных колонках
        leads: rawMetrics.leads || 0,
        cost: rawMetrics.cost || 0,
        clicks: rawMetrics.clicks || 0,
        impressions: rawMetrics.impressions || 0,
        avg_duration: rawMetrics.avg_duration || 0,
        days_count: rawMetrics.days_count || 0,
        cost_from_sources: rawMetrics.cost_from_sources || 0,
        clicks_on_link: rawMetrics.clicks_on_link || 0,
        cached_at: new Date().toISOString()
      };
      
      console.log('🔥 dataToSave ПЕРЕД UPSERT:', {
        cost_from_sources: dataToSave.cost_from_sources,
        clicks_on_link: dataToSave.clicks_on_link
      });
      
      const { data, error } = await supabase
        .from('metrics_cache')
        .upsert([dataToSave], {
          onConflict: 'creative_id,video_index,period'
        })
        .select();

      if (error) throw error;
      
      console.log('🔥 РЕЗУЛЬТАТ ПОСЛЕ СОХРАНЕНИЯ В SUPABASE:', data);
      return data[0];
    } catch (error) {
      console.error('Ошибка сохранения кэша метрик:', error);
      return null;
    }
  },

  // ⚡ НОВАЯ ФУНКЦИЯ: Батчевое сохранение метрик в кэш
  async saveBatchMetricsCache(metricsArray) {
    try {
      console.log('🔵 saveBatchMetricsCache ВЫЗВАНА');
      console.log('📦 Входные данные:', {
        isArray: Array.isArray(metricsArray),
        length: metricsArray?.length,
        firstItem: metricsArray?.[0]
      });

      if (!metricsArray || metricsArray.length === 0) {
        console.log('⚠️ Пустой массив, выход');
        return { success: true, count: 0 };
      }

      console.log(`💾 Батчевое сохранение ${metricsArray.length} метрик в кэш...`);

      // Подготавливаем данные для вставки
      const dataToInsert = [];
      
      metricsArray.forEach((m, index) => {
        console.log(`🔍 Обработка метрики ${index + 1}:`, {
          creativeId: m.creativeId,
          videoIndex: m.videoIndex,
          period: m.period,
          hasData: m.hasData,
          hasMetricsData: !!m.metricsData,
          hasRaw: !!m.metricsData?.raw
        });

        // Проверяем наличие данных
        const hasData = m.hasData !== false && m.metricsData?.raw;
        
        if (hasData) {
          console.log(`✅ Метрика ${index + 1} С ДАННЫМИ`);
          // Метрики с данными
          const rawMetrics = m.metricsData.raw;
          
          // КРИТИЧНО: Извлекаем дополнительные поля с fallback
          const cost_from_sources = Number(
            rawMetrics.cost_from_sources || 
            rawMetrics['cost_from_sources'] || 
            0
          );
          const clicks_on_link = Number(
            rawMetrics.clicks_on_link || 
            rawMetrics['clicks_on_link'] || 
            0
          );
          
          console.log(`🔥🔥🔥 Метрика ${index + 1} ПОЛНАЯ ДИАГНОСТИКА:`, {
            'cost_from_sources (переменная)': cost_from_sources,
            'clicks_on_link (переменная)': clicks_on_link,
            'rawMetrics.cost_from_sources': rawMetrics.cost_from_sources,
            'rawMetrics.clicks_on_link': rawMetrics.clicks_on_link,
            'rawMetrics["cost_from_sources"]': rawMetrics['cost_from_sources'],
            'rawMetrics["clicks_on_link"]': rawMetrics['clicks_on_link'],
            'typeof cost_from_sources': typeof cost_from_sources,
            'typeof clicks_on_link': typeof clicks_on_link,
            'ВСЕ КЛЮЧИ rawMetrics': Object.keys(rawMetrics),
            'ВЕСЬ rawMetrics': rawMetrics
          });
          
          dataToInsert.push({
            creative_id: m.creativeId,
            article: m.article,
            video_index: m.videoIndex,
            video_title: m.videoTitle,
            period: m.period || 'all',
            leads: rawMetrics.leads || 0,
            cost: rawMetrics.cost || 0,
            clicks: rawMetrics.clicks || 0,
            impressions: rawMetrics.impressions || 0,
            avg_duration: rawMetrics.avg_duration || 0,
            days_count: rawMetrics.days_count || 0,
            cost_from_sources: cost_from_sources,
            clicks_on_link: clicks_on_link,
            cached_at: new Date().toISOString()
          });
        } else {
          console.log(`⚪ Метрика ${index + 1} БЕЗ ДАННЫХ (NULL)`);
          // Метрики БЕЗ данных - все поля NULL
          dataToInsert.push({
            creative_id: m.creativeId,
            article: m.article,
            video_index: m.videoIndex,
            video_title: m.videoTitle,
            period: m.period || 'all',
            leads: null,
            cost: null,
            clicks: null,
            impressions: null,
            avg_duration: null,
            days_count: null,
            cost_from_sources: null,
            clicks_on_link: null,
            cached_at: new Date().toISOString()
          });
        }
      });

      console.log(`📊 Подготовлено к вставке: ${dataToInsert.length} записей`);
      console.log('📋 Первая запись для вставки:', dataToInsert[0]);

      if (dataToInsert.length === 0) {
        console.log('⚠️ Нет данных для сохранения после подготовки');
        return { success: true, count: 0 };
      }

      // Сохраняем батчем (максимум 100 за раз)
      const BATCH_SIZE = 100;
      let totalSaved = 0;
      let totalErrors = 0;

      for (let i = 0; i < dataToInsert.length; i += BATCH_SIZE) {
        const batch = dataToInsert.slice(i, i + BATCH_SIZE);
        
        console.log(`🚀 Отправка батча ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(dataToInsert.length/BATCH_SIZE)}: ${batch.length} записей`);
        console.log('🔥🔥🔥 ПЕРВАЯ ЗАПИСЬ БАТЧА ПЕРЕД UPSERT:', {
          'batch[0]': batch[0],
          'batch[0].cost_from_sources': batch[0]?.cost_from_sources,
          'batch[0].clicks_on_link': batch[0]?.clicks_on_link,
          'typeof cost_from_sources': typeof batch[0]?.cost_from_sources,
          'typeof clicks_on_link': typeof batch[0]?.clicks_on_link
        });
        
        const { data, error } = await supabase
          .from('metrics_cache')
          .upsert(batch, {
            onConflict: 'creative_id,video_index,period'
          })
          .select();

        if (error) {
          console.error(`❌ ОШИБКА сохранения батча ${i}-${i + batch.length}:`, {
            error: error,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          totalErrors += batch.length;
          continue;
        }

        console.log(`✅ Батч ${Math.floor(i/BATCH_SIZE) + 1} сохранен успешно:`, {
          inserted: data?.length || batch.length,
          dataReturned: !!data
        });

        totalSaved += batch.length;
      }

      console.log(`🎉 ИТОГО: Сохранено ${totalSaved} из ${dataToInsert.length}, ошибок: ${totalErrors}`);
      return { success: true, count: totalSaved, errors: totalErrors };

    } catch (error) {
      console.error('💥 КРИТИЧЕСКАЯ ОШИБКА батчевого сохранения:', {
        error: error,
        message: error.message,
        stack: error.stack
      });
      return { success: false, count: 0, error: error.message };
    }
  },

  async getMetricsCache(creativeId, videoIndex, period = 'all') {
    try {
      const { data, error } = await supabase
        .from('metrics_cache')
        .select('creative_id, article, video_index, video_title, period, leads, cost, clicks, impressions, avg_duration, days_count, cost_from_sources, clicks_on_link, cached_at')
        .eq('creative_id', creativeId)
        .eq('video_index', videoIndex)
        .eq('period', period) // Загружаем для ЗАПРОШЕННОГО периода
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      // Преобразуем данные из колонок в формат с вычисленными метриками
      if (data) {
        const reconstructed = this.reconstructMetricsFromCache(data);
        // Возвращаем только поле data из reconstructed для совместимости
        return reconstructed;
      }
      
      return null;
    } catch (error) {
      console.error('Ошибка получения кэша метрик:', error);
      return null;
    }
  },

  async getBatchMetricsCache(creativeIds, period = 'all') {
    try {
      console.log('🔍 БАТЧЕВЫЙ запрос кэша метрик:', {
        creativeIdsCount: creativeIds?.length,
        period
      });

      // КРИТИЧНО: НЕ используем select('*') из-за JSONB поля metrics_data
      const { data, error } = await supabase
        .from('metrics_cache')
        .select('creative_id, article, video_index, video_title, period, leads, cost, clicks, impressions, avg_duration, days_count, cost_from_sources, clicks_on_link, cached_at')
        .in('creative_id', creativeIds)
        .eq('period', period); // Загружаем для ЗАПРОШЕННОГО периода

      if (error) {
        console.error('❌ Ошибка батчевого запроса к metrics_cache:', error);
        throw error;
      }
      
      console.log('📦 Получены данные из metrics_cache:', {
        isArray: Array.isArray(data),
        count: data?.length || 0,
        firstItemKeys: data?.[0] ? Object.keys(data[0]) : [],
        firstItem: data?.[0]
      });
      
      // Преобразуем каждую запись из колонок в формат с вычисленными метриками
      if (data && data.length > 0) {
        console.log(`🔄 Преобразуем ${data.length} записей кэша через reconstructMetricsFromCache...`);
        
        const reconstructed = data.map((cache, index) => {
          console.log(`📋 Преобразование записи ${index + 1}:`, {
            creative_id: cache.creative_id,
            video_index: cache.video_index,
            leads: cache.leads,
            cost: cache.cost
          });
          
          const result = this.reconstructMetricsFromCache(cache);
          
          console.log(`✅ Результат преобразования ${index + 1}:`, {
            found: result?.found,
            hasData: !!result?.data,
            leads: result?.data?.formatted?.leads
          });
          
          return result;
        });
        
        console.log(`✅ Батч преобразован: ${reconstructed.length} записей`);
        return reconstructed;
      }
      
      console.log('⚠️ Нет данных в кэше для преобразования');
      return [];
    } catch (error) {
      console.error('❌ Критическая ошибка получения батча кэша метрик:', error);
      return [];
    }
  },

  // Восстановление метрик из кэша с вычислением производных метрик
  reconstructMetricsFromCache(cacheData) {
    if (!cacheData) {
      console.log('⚠️ reconstructMetricsFromCache: cacheData is null');
      return null;
    }

    console.log('📦 Восстановление метрик из кэша:', {
      creative_id: cacheData.creative_id,
      video_index: cacheData.video_index,
      hasLeads: 'leads' in cacheData,
      leads: cacheData.leads,
      article: cacheData.article
    });

    // КРИТИЧНО: Проверяем, все ли поля NULL (нет данных)
    const isAllNull = cacheData.leads === null && 
                      cacheData.cost === null && 
                      cacheData.clicks === null && 
                      cacheData.impressions === null;

    if (isAllNull) {
      console.log('⚪ Все метрики NULL - возвращаем found: false');
      // Возвращаем found: false для отображения "—"
      return {
        creative_id: cacheData.creative_id,
        creativeId: cacheData.creative_id,
        article: cacheData.article,
        video_index: cacheData.video_index,
        videoIndex: cacheData.video_index,
        video_title: cacheData.video_title,
        period: cacheData.period,
        cached_at: cacheData.cached_at,
        found: false,
        data: null,
        error: 'Нет данных',
        videoName: cacheData.video_title,
        fromCache: true
      };
    }

    // Базовые метрики из отдельных колонок
    const leads = Number(cacheData.leads) || 0;
    const cost = Number(cacheData.cost) || 0;
    const clicks = Number(cacheData.clicks) || 0;
    const impressions = Number(cacheData.impressions) || 0;
    const avg_duration = Number(cacheData.avg_duration) || 0;
    const days_count = Number(cacheData.days_count) || 0;
    const cost_from_sources = Number(cacheData.cost_from_sources) || 0;
    const clicks_on_link = Number(cacheData.clicks_on_link) || 0;

    console.log('📦 Используем НОВЫЙ формат кэша (отдельные колонки):', {
      leads, cost, clicks, impressions, avg_duration, days_count, cost_from_sources, clicks_on_link
    });

    // Вычисляем производные метрики на клиенте
    const cpl = leads > 0 ? cost / leads : 0;
    const ctr_percent = impressions > 0 ? (clicks_on_link / impressions) * 100 : 0;
    const cpc = clicks > 0 ? cost / clicks : 0;
    const cpm = impressions > 0 ? (cost_from_sources / impressions) * 1000 : 0;

    // Форматируем метрики
    const formatInt = (n) => String(Math.round(Number(n) || 0));
    const formatMoney = (n) => (Number(n) || 0).toFixed(2) + "$";
    const formatPercent = (n) => (Number(n) || 0).toFixed(2) + "%";
    const formatDuration = (n) => (Number(n) || 0).toFixed(1) + "с";

    // Возвращаем в формате, совместимом с rawMetricsMap
    return {
      creative_id: cacheData.creative_id,
      creativeId: cacheData.creative_id,
      article: cacheData.article,
      video_index: cacheData.video_index,
      videoIndex: cacheData.video_index,
      video_title: cacheData.video_title,
      period: cacheData.period,
      cached_at: cacheData.cached_at,
      // Данные метрик в правильном формате
      found: true,
      data: {
        raw: {
          leads,
          cost: Number(cost.toFixed(2)),
          clicks,
          impressions,
          avg_duration: Number(avg_duration.toFixed(2)),
          days_count,
          cost_from_sources,
          clicks_on_link,
          cpl: Number(cpl.toFixed(2)),
          ctr_percent: Number(ctr_percent.toFixed(2)),
          cpc: Number(cpc.toFixed(2)),
          cpm: Number(cpm.toFixed(2))
        },
        formatted: {
          leads: formatInt(leads),
          cpl: formatMoney(cpl),
          cost: formatMoney(cost),
          ctr: formatPercent(ctr_percent),
          cpc: formatMoney(cpc),
          cpm: formatMoney(cpm),
          clicks: formatInt(clicks),
          impressions: formatInt(impressions),
          avg_duration: formatDuration(avg_duration),
          days: formatInt(days_count) + " дн."
        },
        videoName: cacheData.video_title,
        period: cacheData.period,
        fromCache: true,
        cachedAt: cacheData.cached_at
      },
      error: null,
      videoName: cacheData.video_title
    };
  },

  async updateMetricsLastUpdate() {
    try {
      const { data, error } = await supabase
        .from('metrics_last_update')
        .upsert([
          {
            id: 1,
            last_updated: new Date().toISOString()
          }
        ], {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка обновления времени последнего обновления метрик:', error);
      return null;
    }
  },

  async getMetricsLastUpdate() {
    try {
      const { data, error } = await supabase
        .from('metrics_last_update')
        .select('last_updated')
        .eq('id', 1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.last_updated || null;
    } catch (error) {
      console.error('Ошибка получения времени последнего обновления метрик:', error);
      return null;
    }
  },

  async getZoneDataByArticles(articles) {
    try {
      if (!articles || articles.length === 0) {
        return new Map();
      }

      const cleanArticles = articles
        .filter(article => article && article.trim())
        .map(article => article.trim());

      if (cleanArticles.length === 0) {
        return new Map();
      }

      console.log(`🎯 Батчевый поиск зональных данных для ${cleanArticles.length} артикулов`);
      console.log('📋 Искомые артикулы:', cleanArticles);

      const { data, error } = await supabase
        .from('metrics_analytics')
        .select('article, red_zone_price, pink_zone_price, gold_zone_price, green_zone_price, offer_zone')
        .in('article', cleanArticles);

      if (error) {
        console.error('❌ Ошибка батчевого запроса зональных данных:', error);
        return new Map();
      }

      console.log('📦 Ответ от базы данных:', {
        dataExists: !!data,
        dataLength: data?.length || 0,
        firstItem: data?.[0]
      });

      // 🔍 ДИАГНОСТИКА: Проверяем общее количество записей в таблице
      const { count, error: countError } = await supabase
        .from('metrics_analytics')
        .select('*', { count: 'exact', head: true });
      
      if (!countError) {
        console.log(`📊 Всего записей в metrics_analytics: ${count}`);
      }

      // 🔍 ДИАГНОСТИКА: Пробуем найти похожие артикулы
      if ((!data || data.length === 0) && cleanArticles.length > 0) {
        const searchPattern = cleanArticles[0];
        console.log(`🔍 Ищем похожие артикулы для: "${searchPattern}"`);
        
        const { data: similarData, error: similarError } = await supabase
          .from('metrics_analytics')
          .select('article')
          .ilike('article', `%${searchPattern.substring(0, 3)}%`)
          .limit(10);
        
        if (!similarError && similarData) {
          console.log('🔍 Найдены похожие артикулы:', similarData.map(d => d.article));
        }
      }

      const zoneDataMap = new Map();
      
      if (data && data.length > 0) {
        data.forEach(item => {
          console.log(`✅ Найдены зоны для "${item.article}":`, {
            red: item.red_zone_price,
            pink: item.pink_zone_price,
            gold: item.gold_zone_price,
            green: item.green_zone_price
          });
          
          zoneDataMap.set(item.article, {
            red_zone_price: item.red_zone_price,
            pink_zone_price: item.pink_zone_price,
            gold_zone_price: item.gold_zone_price,
            green_zone_price: item.green_zone_price,
            offer_zone: item.offer_zone
          });
        });

        console.log(`✅ Найдены зональные данные для ${data.length} из ${cleanArticles.length} артикулов`);
      } else {
        console.log(`❌ Зональные данные не найдены ни для одного из ${cleanArticles.length} артикулов`);
      }

      return zoneDataMap;

    } catch (error) {
      console.error('❌ Ошибка батчевого получения зональных данных:', error);
      return new Map();
    }
  },

  formatZoneData(zoneData) {
    if (!zoneData) {
      return null;
    }

    const formatPrice = (price) => {
      if (price === null || price === undefined) return '—';
      return `$${Number(price).toFixed(2)}`;
    };

    return {
      red: formatPrice(zoneData.red_zone_price),
      pink: formatPrice(zoneData.pink_zone_price),
      gold: formatPrice(zoneData.gold_zone_price),
      green: formatPrice(zoneData.green_zone_price),
      currentZone: zoneData.offer_zone || '—'
    };
  },

  async clearAllMetrics() {
    try {
      const { error: deleteError } = await supabase
        .from('metrics_analytics')
        .delete()
        .neq('id', 0);

      if (deleteError) throw deleteError;

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
