-- Миграция: добавление колонки like_searched в metrics_cache
-- Для отслеживания прогресса LIKE поиска между запусками scheduled function

-- Добавляем колонку like_searched (по умолчанию false)
ALTER TABLE metrics_cache ADD COLUMN IF NOT EXISTS like_searched BOOLEAN DEFAULT false;

-- Создаём индекс для быстрого поиска непроверенных видео
CREATE INDEX IF NOT EXISTS idx_metrics_cache_like_searched
ON metrics_cache(like_searched)
WHERE like_searched = false AND leads IS NULL;

-- Помечаем все существующие записи с данными как уже проверенные
-- (они либо найдены точным совпадением, либо уже через LIKE)
UPDATE metrics_cache SET like_searched = true WHERE leads IS NOT NULL;

-- Записи с NULL остаются like_searched = false, их нужно будет проверить через LIKE
