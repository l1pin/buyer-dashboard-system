-- Миграция: создание таблицы для хранения сезонов офферов
-- Сезоны хранятся как массив эмодзи: ['☀️', '🍁', '❄️', '🌱']
-- ☀️ - лето, 🍁 - осень, ❄️ - зима, 🌱 - весна

-- Создаем таблицу offer_seasons
CREATE TABLE IF NOT EXISTS offer_seasons (
    id SERIAL PRIMARY KEY,
    article VARCHAR(255) NOT NULL UNIQUE,
    seasons TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по артикулу
CREATE INDEX IF NOT EXISTS idx_offer_seasons_article ON offer_seasons(article);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_offer_seasons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_offer_seasons_updated_at ON offer_seasons;
CREATE TRIGGER trigger_update_offer_seasons_updated_at
    BEFORE UPDATE ON offer_seasons
    FOR EACH ROW
    EXECUTE FUNCTION update_offer_seasons_updated_at();

-- Включаем RLS (Row Level Security)
ALTER TABLE offer_seasons ENABLE ROW LEVEL SECURITY;

-- Политика для чтения (все authenticated пользователи)
CREATE POLICY "Allow read for authenticated users" ON offer_seasons
    FOR SELECT
    TO authenticated
    USING (true);

-- Политика для вставки (все authenticated пользователи)
CREATE POLICY "Allow insert for authenticated users" ON offer_seasons
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Политика для обновления (все authenticated пользователи)
CREATE POLICY "Allow update for authenticated users" ON offer_seasons
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Политика для удаления (все authenticated пользователи)
CREATE POLICY "Allow delete for authenticated users" ON offer_seasons
    FOR DELETE
    TO authenticated
    USING (true);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE offer_seasons IS 'Таблица сезонов офферов';
COMMENT ON COLUMN offer_seasons.article IS 'Артикул оффера';
COMMENT ON COLUMN offer_seasons.seasons IS 'Массив сезонов в виде эмодзи: ☀️ - лето, 🍁 - осень, ❄️ - зима, 🌱 - весна';
