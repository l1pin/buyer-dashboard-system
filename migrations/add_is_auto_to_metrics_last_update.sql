-- Миграция: Добавление поля is_auto в таблицу metrics_last_update
-- Это поле позволяет различать ручное и автоматическое обновление метрик

-- Добавляем колонку is_auto (по умолчанию false - ручное обновление)
ALTER TABLE metrics_last_update
ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT false;

-- Добавляем колонку videos_updated для отслеживания количества обновленных видео
ALTER TABLE metrics_last_update
ADD COLUMN IF NOT EXISTS videos_updated INTEGER DEFAULT 0;

-- Добавляем колонку status для отслеживания статуса обновления
ALTER TABLE metrics_last_update
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'idle';

-- Комментарии к колонкам
COMMENT ON COLUMN metrics_last_update.is_auto IS 'true = автоматическое обновление (cron), false = ручное обновление';
COMMENT ON COLUMN metrics_last_update.videos_updated IS 'Количество обновленных видео в последнем обновлении';
COMMENT ON COLUMN metrics_last_update.status IS 'Статус: idle, running, completed, failed';

-- Включаем Realtime для таблицы metrics_last_update
-- (нужно выполнить в Supabase Dashboard -> Database -> Replication)
-- ALTER PUBLICATION supabase_realtime ADD TABLE metrics_last_update;

-- Проверка структуры таблицы
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'metrics_last_update';
