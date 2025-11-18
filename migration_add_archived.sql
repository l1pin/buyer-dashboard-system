-- Миграция для добавления мягкого удаления (soft delete) пользователей
-- Дата создания: 2025-11-18

-- Добавляем поле archived для мягкого удаления
ALTER TABLE users
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Добавляем поле archived_at для отслеживания времени архивирования
ALTER TABLE users
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Создаем индекс для быстрой фильтрации неархивированных пользователей
CREATE INDEX IF NOT EXISTS idx_users_archived ON users(archived) WHERE archived = FALSE;

-- Добавляем комментарии
COMMENT ON COLUMN users.archived IS 'Флаг архивирования пользователя (мягкое удаление)';
COMMENT ON COLUMN users.archived_at IS 'Дата и время архивирования пользователя';

-- Информационное сообщение
DO $$
BEGIN
  RAISE NOTICE 'Миграция завершена успешно!';
  RAISE NOTICE 'Добавлено поле archived для мягкого удаления пользователей';
  RAISE NOTICE 'Теперь при "удалении" пользователь будет архивироваться, а не удаляться физически';
  RAISE NOTICE 'Все связанные лендинги и креативы останутся в системе';
END $$;
