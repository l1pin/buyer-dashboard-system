-- Миграция для создания таблицы article_offer_mapping
-- Хранит соответствие между артикулами и Offer ID для миграции данных

-- Создание таблицы article_offer_mapping
CREATE TABLE IF NOT EXISTS article_offer_mapping (
  article VARCHAR(100) PRIMARY KEY,           -- Артикул (уникальный)
  offer_id VARCHAR(255) NOT NULL,             -- Offer ID из внешней системы
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_article_offer_mapping_article ON article_offer_mapping(article);
CREATE INDEX IF NOT EXISTS idx_article_offer_mapping_offer_id ON article_offer_mapping(offer_id);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_article_offer_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_article_offer_mapping_updated_at ON article_offer_mapping;
CREATE TRIGGER trigger_update_article_offer_mapping_updated_at
  BEFORE UPDATE ON article_offer_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_article_offer_mapping_updated_at();

-- RLS (Row Level Security) политики
ALTER TABLE article_offer_mapping ENABLE ROW LEVEL SECURITY;

-- Политика: все авторизованные пользователи могут читать
DROP POLICY IF EXISTS "Allow authenticated users to read article_offer_mapping" ON article_offer_mapping;
CREATE POLICY "Allow authenticated users to read article_offer_mapping"
  ON article_offer_mapping
  FOR SELECT
  TO authenticated
  USING (true);

-- Политика: все авторизованные пользователи могут вставлять
DROP POLICY IF EXISTS "Allow authenticated users to insert article_offer_mapping" ON article_offer_mapping;
CREATE POLICY "Allow authenticated users to insert article_offer_mapping"
  ON article_offer_mapping
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Политика: все авторизованные пользователи могут обновлять
DROP POLICY IF EXISTS "Allow authenticated users to update article_offer_mapping" ON article_offer_mapping;
CREATE POLICY "Allow authenticated users to update article_offer_mapping"
  ON article_offer_mapping
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Политика: все авторизованные пользователи могут удалять
DROP POLICY IF EXISTS "Allow authenticated users to delete article_offer_mapping" ON article_offer_mapping;
CREATE POLICY "Allow authenticated users to delete article_offer_mapping"
  ON article_offer_mapping
  FOR DELETE
  TO authenticated
  USING (true);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE article_offer_mapping IS 'Соответствие между артикулами и Offer ID для миграции данных';
COMMENT ON COLUMN article_offer_mapping.article IS 'Артикул товара (уникальный ключ)';
COMMENT ON COLUMN article_offer_mapping.offer_id IS 'Offer ID из внешней системы';
