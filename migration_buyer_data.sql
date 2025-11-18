-- Миграция для переноса данных из buyer_source в users
-- Дата создания: 2025-11-18

-- Шаг 1: Добавляем новое JSONB поле в таблицу users для хранения данных Media Buyer
ALTER TABLE users
ADD COLUMN IF NOT EXISTS buyer_settings JSONB DEFAULT '{
  "traffic_channel_ids": [],
  "currency": "USD",
  "access_granted": "2020-01-01",
  "access_limited": null
}'::jsonb;

-- Шаг 2: Переносим данные из buyer_source в users
-- Для каждого байера из buyer_source находим соответствующую запись в users и обновляем buyer_settings
UPDATE users u
SET buyer_settings = jsonb_build_object(
  'traffic_channel_ids', COALESCE(bs.source_ids, ARRAY[]::text[]),
  'currency', 'USD',
  'access_granted', '2020-01-01',
  'access_limited', NULL
)
FROM buyer_source bs
WHERE u.id = bs.buyer_id
  AND u.role = 'buyer';

-- Шаг 3: Создаем индекс для быстрого поиска по buyer_settings
CREATE INDEX IF NOT EXISTS idx_users_buyer_settings
ON users USING GIN (buyer_settings);

-- Шаг 4: Добавляем комментарии для документации
COMMENT ON COLUMN users.buyer_settings IS 'Настройки для Media Buyer: traffic_channel_ids (массив ID каналов), currency (валюта), access_granted (дата предоставления доступа), access_limited (дата ограничения доступа)';

-- ВАЖНО: НЕ удаляем таблицу buyer_source для безопасности и возможности отката
-- Вместо этого можно переименовать её или оставить как есть для истории
-- Если нужно удалить после проверки работоспособности, раскомментируйте:
-- DROP TABLE IF EXISTS buyer_source;

-- Информационное сообщение
DO $$
BEGIN
  RAISE NOTICE 'Миграция завершена успешно!';
  RAISE NOTICE 'Данные из buyer_source перенесены в users.buyer_settings';
  RAISE NOTICE 'Таблица buyer_source сохранена для безопасности';
END $$;
