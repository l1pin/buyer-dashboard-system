-- ============================================
-- Миграция 007: Добавление excluded_permissions
-- ============================================
-- Позволяет исключать права роли для конкретного пользователя
--
-- Логика итоговых прав пользователя:
-- final_permissions = (role_permissions - excluded_permissions) + custom_permissions
-- ============================================

-- Добавляем колонку excluded_permissions в таблицу users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS excluded_permissions TEXT[] DEFAULT '{}';

-- Комментарий к колонке
COMMENT ON COLUMN users.excluded_permissions IS 'Массив кодов прав, исключённых из прав роли для этого пользователя';
