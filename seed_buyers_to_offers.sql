-- =====================================================
-- SEED SCRIPT: Привязка 5 рандомных байеров к каждому офферу
-- Источник: facebook
-- =====================================================
-- ВНИМАНИЕ: Запускать только ОДИН раз для тестовых данных!
-- Выполнять в Supabase SQL Editor
-- =====================================================

-- Удаляем существующие привязки для facebook (опционально - раскомментировать если нужно очистить)
-- DELETE FROM offer_buyers WHERE source = 'facebook';

-- Основной INSERT
WITH
-- Все офферы
offers AS (
  SELECT id as offer_id FROM metrics
),

-- Все байеры с их facebook source_ids
buyers_with_fb AS (
  SELECT
    u.id as buyer_id,
    u.name as buyer_name,
    -- Извлекаем все channel_id где source = 'facebook'
    COALESCE(
      (
        SELECT jsonb_agg(ch->>'channel_id')
        FROM jsonb_array_elements(
          CASE
            WHEN u.buyer_settings->'traffic_channels' IS NOT NULL
            THEN u.buyer_settings->'traffic_channels'
            ELSE '[]'::jsonb
          END
        ) ch
        WHERE ch->>'source' = 'facebook'
          AND ch->>'channel_id' IS NOT NULL
          AND ch->>'channel_id' != ''
      ),
      '[]'::jsonb
    ) as fb_source_ids
  FROM users u
  WHERE u.role = 'buyer'
),

-- Рандомизируем байеров для каждого оффера
randomized AS (
  SELECT
    o.offer_id,
    b.buyer_id,
    b.buyer_name,
    b.fb_source_ids,
    -- Для каждого оффера свой рандомный порядок
    ROW_NUMBER() OVER (
      PARTITION BY o.offer_id
      ORDER BY random()
    ) as rn
  FROM offers o
  CROSS JOIN buyers_with_fb b
),

-- Берём только первые 5 для каждого оффера
top5_per_offer AS (
  SELECT
    offer_id,
    buyer_id,
    buyer_name,
    fb_source_ids
  FROM randomized
  WHERE rn <= 5
)

-- Вставляем, исключая дубликаты
INSERT INTO offer_buyers (offer_id, buyer_id, buyer_name, source, source_ids)
SELECT
  t.offer_id,
  t.buyer_id,
  t.buyer_name,
  'facebook' as source,
  t.fb_source_ids as source_ids
FROM top5_per_offer t
WHERE NOT EXISTS (
  SELECT 1 FROM offer_buyers ob
  WHERE ob.offer_id = t.offer_id
    AND ob.buyer_id = t.buyer_id
    AND ob.source = 'facebook'
);

-- =====================================================
-- СТАТИСТИКА (выполнить после INSERT)
-- =====================================================

-- Сколько добавлено привязок
SELECT 'Всего привязок facebook' as metric, COUNT(*) as value
FROM offer_buyers WHERE source = 'facebook';

-- Сколько офферов с привязками
SELECT 'Офферов с байерами' as metric, COUNT(DISTINCT offer_id) as value
FROM offer_buyers WHERE source = 'facebook';

-- Сколько уникальных байеров привязано
SELECT 'Уникальных байеров' as metric, COUNT(DISTINCT buyer_id) as value
FROM offer_buyers WHERE source = 'facebook';

-- Пример привязок (первые 10)
SELECT
  ob.offer_id,
  m.name as offer_name,
  ob.buyer_name,
  jsonb_array_length(ob.source_ids) as source_ids_count
FROM offer_buyers ob
LEFT JOIN metrics m ON m.id = ob.offer_id
WHERE ob.source = 'facebook'
ORDER BY ob.offer_id
LIMIT 10;
