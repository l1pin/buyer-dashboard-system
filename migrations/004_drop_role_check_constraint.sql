-- ============================================
-- МИГРАЦИЯ: Удаление CHECK constraint для role
-- Версия: 4.0
-- Дата: 2025-12-26
-- ============================================
-- Теперь роли управляются через таблицу roles,
-- поэтому старый CHECK constraint не нужен
-- ============================================

-- Удаляем CHECK constraint на колонке role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Также удаляем возможные другие варианты названия
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role;
ALTER TABLE users DROP CONSTRAINT IF EXISTS role_check;

-- Готово!
-- После выполнения этой миграции можно использовать
-- любые коды ролей из таблицы roles
