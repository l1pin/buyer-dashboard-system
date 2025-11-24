-- Миграция для создания таблицы offer_buyers
-- Хранит привязки байеров к офферам с информацией об источнике трафика

-- Удаляем старую таблицу если существует (для чистой миграции)
-- DROP TABLE IF EXISTS offer_buyers CASCADE;

-- Создание таблицы offer_buyers
CREATE TABLE IF NOT EXISTS offer_buyers (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER NOT NULL,                    -- ID оффера
  buyer_id UUID NOT NULL REFERENCES users(id),  -- ID байера (ссылка на таблицу users)
  buyer_name VARCHAR(255) NOT NULL,             -- Имя байера
  source VARCHAR(50) NOT NULL,                  -- Источник трафика: 'Facebook', 'Google', 'TikTok'
  source_ids JSONB DEFAULT '[]'::jsonb,         -- МАССИВ всех source_id байера для данного источника
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Уникальный индекс: один байер может быть привязан к офферу только один раз на каждый источник
  CONSTRAINT unique_offer_buyer_source UNIQUE (offer_id, buyer_id, source)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_offer_buyers_offer_id ON offer_buyers(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_buyers_buyer_id ON offer_buyers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_offer_buyers_source ON offer_buyers(source);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_offer_buyers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_offer_buyers_updated_at ON offer_buyers;
CREATE TRIGGER trigger_update_offer_buyers_updated_at
  BEFORE UPDATE ON offer_buyers
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_buyers_updated_at();

-- RLS (Row Level Security) политики
ALTER TABLE offer_buyers ENABLE ROW LEVEL SECURITY;

-- Политика: все авторизованные пользователи могут читать
DROP POLICY IF EXISTS "Allow authenticated users to read offer_buyers" ON offer_buyers;
CREATE POLICY "Allow authenticated users to read offer_buyers"
  ON offer_buyers
  FOR SELECT
  TO authenticated
  USING (true);

-- Политика: все авторизованные пользователи могут вставлять
DROP POLICY IF EXISTS "Allow authenticated users to insert offer_buyers" ON offer_buyers;
CREATE POLICY "Allow authenticated users to insert offer_buyers"
  ON offer_buyers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Политика: все авторизованные пользователи могут обновлять
DROP POLICY IF EXISTS "Allow authenticated users to update offer_buyers" ON offer_buyers;
CREATE POLICY "Allow authenticated users to update offer_buyers"
  ON offer_buyers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Политика: все авторизованные пользователи могут удалять
DROP POLICY IF EXISTS "Allow authenticated users to delete offer_buyers" ON offer_buyers;
CREATE POLICY "Allow authenticated users to delete offer_buyers"
  ON offer_buyers
  FOR DELETE
  TO authenticated
  USING (true);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE offer_buyers IS 'Привязки байеров к офферам с информацией об источнике трафика';
COMMENT ON COLUMN offer_buyers.offer_id IS 'ID оффера из системы метрик';
COMMENT ON COLUMN offer_buyers.buyer_id IS 'UUID байера из таблицы users';
COMMENT ON COLUMN offer_buyers.buyer_name IS 'Имя байера для быстрого отображения';
COMMENT ON COLUMN offer_buyers.source IS 'Источник трафика: Facebook, Google или TikTok';
COMMENT ON COLUMN offer_buyers.source_ids IS 'Массив всех channel_id байера для данного источника (JSONB array)';

-- ============================================
-- МИГРАЦИЯ ДЛЯ СУЩЕСТВУЮЩЕЙ ТАБЛИЦЫ
-- Если таблица уже существует с полем source_id,
-- выполните эти команды для миграции:
-- ============================================

-- ALTER TABLE offer_buyers ADD COLUMN IF NOT EXISTS source_ids JSONB DEFAULT '[]'::jsonb;
-- UPDATE offer_buyers SET source_ids = jsonb_build_array(source_id) WHERE source_id IS NOT NULL AND source_ids = '[]'::jsonb;
-- ALTER TABLE offer_buyers DROP COLUMN IF EXISTS source_id;
