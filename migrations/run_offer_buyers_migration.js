// Скрипт для выполнения миграции offer_buyers через Supabase
// Использование: node migrations/run_offer_buyers_migration.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Загружаем переменные окружения
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Ошибка: REACT_APP_SUPABASE_URL или REACT_APP_SUPABASE_SERVICE_ROLE_KEY не установлены');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Начинаем миграцию offer_buyers...');

    // Читаем SQL файл
    const sqlPath = path.join(__dirname, 'add_offer_buyers.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 SQL миграция загружена');
    console.log('⚙️ Выполняем SQL запросы...\n');

    // Разбиваем SQL на отдельные команды
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('COMMENT'));

    for (const command of commands) {
      if (command.includes('COMMENT ON')) {
        // Пропускаем COMMENT команды
        continue;
      }

      console.log(`Выполняем: ${command.substring(0, 60)}...`);

      const { error } = await supabase.rpc('exec_sql', {
        sql_query: command + ';'
      });

      if (error) {
        // Если функция exec_sql не существует, пытаемся через REST API
        console.log('⚠️ Функция exec_sql не найдена, используем прямой подход...');

        // Для создания таблицы мы можем использовать Supabase REST API
        // Но проще всего выполнить через SQL Editor в Supabase Dashboard
        console.log('\n⚠️ ВНИМАНИЕ: Автоматическое выполнение SQL невозможно.');
        console.log('📋 Пожалуйста, выполните следующий SQL вручную в Supabase Dashboard:');
        console.log('   1. Откройте https://supabase.com/dashboard');
        console.log('   2. Выберите ваш проект');
        console.log('   3. Перейдите в SQL Editor');
        console.log('   4. Скопируйте и выполните содержимое файла migrations/add_offer_buyers.sql\n');

        console.log('📄 Содержимое миграции:');
        console.log('═'.repeat(80));
        console.log(sql);
        console.log('═'.repeat(80));

        process.exit(0);
      }
    }

    console.log('\n✅ Миграция успешно выполнена!');
    console.log('📊 Таблица offer_buyers создана');
    console.log('🔗 Связи и индексы настроены');

  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
