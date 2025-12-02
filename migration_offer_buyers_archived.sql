-- Миграция: Добавление колонки archived в таблицу offer_buyers
-- Для архивации байеров у которых был расход (cost > 0)

-- Добавляем колонку archived (по умолчанию false)
ALTER TABLE offer_buyers
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Добавляем колонку archived_at для отслеживания даты архивации
ALTER TABLE offer_buyers
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Создаем индекс для быстрой фильтрации архивированных записей
CREATE INDEX IF NOT EXISTS idx_offer_buyers_archived ON offer_buyers(archived);

-- Комментарий к колонке
COMMENT ON COLUMN offer_buyers.archived IS 'Флаг архивации байера (true = неактивный, был расход)';
COMMENT ON COLUMN offer_buyers.archived_at IS 'Дата и время архивации';
