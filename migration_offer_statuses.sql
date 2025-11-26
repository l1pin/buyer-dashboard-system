-- Миграция для добавления системы управления статусами офферов
-- Дата создания: 2025-11-20
-- Описание: Создание таблицы для хранения статусов офферов с полной историей изменений

-- Создаем таблицу для статусов офферов
CREATE TABLE IF NOT EXISTS offer_statuses (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER NOT NULL,
  article VARCHAR(255),
  offer_name TEXT,
  current_status VARCHAR(50) NOT NULL DEFAULT 'Активный',
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создаем индекс для быстрого поиска по offer_id
CREATE INDEX IF NOT EXISTS idx_offer_statuses_offer_id ON offer_statuses(offer_id);

-- Создаем индекс для быстрого поиска по артикулу
CREATE INDEX IF NOT EXISTS idx_offer_statuses_article ON offer_statuses(article);

-- Создаем индекс для фильтрации по текущему статусу
CREATE INDEX IF NOT EXISTS idx_offer_statuses_current_status ON offer_statuses(current_status);

-- Создаем индекс для истории (GIN индекс для JSONB)
CREATE INDEX IF NOT EXISTS idx_offer_statuses_history ON offer_statuses USING gin(status_history);

-- Добавляем комментарии к таблице и полям
COMMENT ON TABLE offer_statuses IS 'Таблица для хранения текущих статусов офферов и их истории';
COMMENT ON COLUMN offer_statuses.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN offer_statuses.offer_id IS 'ID оффера из metrics_analytics (без foreign key для независимости)';
COMMENT ON COLUMN offer_statuses.article IS 'Артикул оффера для удобства';
COMMENT ON COLUMN offer_statuses.offer_name IS 'Название оффера для удобства';
COMMENT ON COLUMN offer_statuses.current_status IS 'Текущий статус: Активный, Пауза, Закончился, Отлежка, Передел, КЦ';
COMMENT ON COLUMN offer_statuses.status_history IS 'История изменений статусов в формате JSONB [{status: string, changed_at: timestamp, changed_by: string (имя пользователя), changed_by_id: string (UUID пользователя), comment: string}]';
COMMENT ON COLUMN offer_statuses.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN offer_statuses.updated_at IS 'Дата и время последнего обновления';

-- Создаем функцию для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_offer_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_offer_statuses_timestamp ON offer_statuses;
CREATE TRIGGER trigger_update_offer_statuses_timestamp
  BEFORE UPDATE ON offer_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_statuses_updated_at();

-- Функция для добавления записи в историю статусов
CREATE OR REPLACE FUNCTION add_status_history_entry(
  p_offer_id INTEGER,
  p_new_status VARCHAR(50),
  p_changed_by VARCHAR(255),
  p_comment TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_current_history JSONB;
  v_new_entry JSONB;
BEGIN
  -- Получаем текущую историю
  SELECT status_history INTO v_current_history
  FROM offer_statuses
  WHERE offer_id = p_offer_id;

  -- Создаем новую запись в истории
  v_new_entry := jsonb_build_object(
    'status', p_new_status,
    'changed_at', NOW(),
    'changed_by', p_changed_by,
    'comment', p_comment
  );

  -- Добавляем новую запись в начало истории (последние изменения сверху)
  UPDATE offer_statuses
  SET
    current_status = p_new_status,
    status_history = v_new_entry || COALESCE(v_current_history, '[]'::jsonb)
  WHERE offer_id = p_offer_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения истории статусов в удобном формате
CREATE OR REPLACE FUNCTION get_status_history(p_offer_id INTEGER)
RETURNS TABLE (
  status VARCHAR(50),
  changed_at TIMESTAMP WITH TIME ZONE,
  changed_by VARCHAR(255),
  comment TEXT,
  days_in_status INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH history AS (
    SELECT
      jsonb_array_elements(s.status_history) AS entry
    FROM offer_statuses s
    WHERE s.offer_id = p_offer_id
  ),
  parsed_history AS (
    SELECT
      (entry->>'status')::VARCHAR(50) AS status,
      (entry->>'changed_at')::TIMESTAMP WITH TIME ZONE AS changed_at,
      (entry->>'changed_by')::VARCHAR(255) AS changed_by,
      (entry->>'comment')::TEXT AS comment,
      ROW_NUMBER() OVER (ORDER BY (entry->>'changed_at')::TIMESTAMP WITH TIME ZONE DESC) AS rn
    FROM history
  )
  SELECT
    ph.status,
    ph.changed_at,
    ph.changed_by,
    ph.comment,
    CASE
      WHEN ph.rn = 1 THEN EXTRACT(day FROM NOW() - ph.changed_at)::INTEGER
      ELSE EXTRACT(day FROM LEAD(ph.changed_at) OVER (ORDER BY ph.changed_at DESC) - ph.changed_at)::INTEGER
    END AS days_in_status
  FROM parsed_history ph
  ORDER BY ph.changed_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Информационное сообщение
DO $$
BEGIN
  RAISE NOTICE '✅ Миграция завершена успешно!';
  RAISE NOTICE '📋 Создана таблица offer_statuses для управления статусами офферов';
  RAISE NOTICE '🔧 Добавлены функции для работы с историей статусов';
  RAISE NOTICE '📊 Доступные статусы: Активный, Пауза, Закончился, Отлежка, Передел, КЦ';
  RAISE NOTICE '🎨 Цветовая схема: Активный (🟢), Пауза (🟡), Закончился (🔴), Отлежка (🟣), Передел (🔵), КЦ (🟢🔵)';
END $$;
