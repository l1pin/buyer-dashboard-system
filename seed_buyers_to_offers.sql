-- =====================================================
-- SEED SCRIPT: Привязка 5 рандомных байеров к каждому офферу
-- Источник: facebook
-- =====================================================
-- ВНИМАНИЕ: Запускать только ОДИН раз для тестовых данных!
-- Выполнять в Supabase SQL Editor
-- =====================================================

-- Удаляем существующие привязки для facebook (опционально - раскомментировать если нужно очистить)
-- DELETE FROM offer_buyers WHERE source = 'Facebook';

-- Основной INSERT
WITH
-- Все офферы
offers AS (
  SELECT id as offer_id FROM metrics_analytics
),

-- Все байеры с их facebook source_ids из таблицы buyer_source
buyers_with_fb AS (
  SELECT
    bs.buyer_id,
    bs.buyer_name,
    bs.source_ids as fb_source_ids
  FROM buyer_source bs
  WHERE bs.source_ids IS NOT NULL
    AND jsonb_array_length(bs.source_ids) > 0
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
  'Facebook' as source,
  t.fb_source_ids as source_ids
FROM top5_per_offer t
WHERE NOT EXISTS (
  SELECT 1 FROM offer_buyers ob
  WHERE ob.offer_id = t.offer_id
    AND ob.buyer_id = t.buyer_id
    AND ob.source = 'Facebook'
);

-- =====================================================
-- СТАТИСТИКА (выполнить после INSERT)
-- =====================================================

-- Сколько добавлено привязок
SELECT 'Всего привязок Facebook' as metric, COUNT(*) as value
FROM offer_buyers WHERE source = 'Facebook';

-- Сколько офферов с привязками
SELECT 'Офферов с байерами' as metric, COUNT(DISTINCT offer_id) as value
FROM offer_buyers WHERE source = 'Facebook';

-- Сколько уникальных байеров привязано
SELECT 'Уникальных байеров' as metric, COUNT(DISTINCT buyer_id) as value
FROM offer_buyers WHERE source = 'Facebook';

-- Пример привязок (первые 10)
SELECT
  ob.offer_id,
  m.article as offer_article,
  ob.buyer_name,
  ob.source_ids,
  jsonb_array_length(ob.source_ids) as source_ids_count
FROM offer_buyers ob
LEFT JOIN metrics_analytics m ON m.id = ob.offer_id
WHERE ob.source = 'Facebook'
ORDER BY ob.offer_id
LIMIT 10;
