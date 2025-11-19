-- Таблица для привязки байеров к офферам по источникам трафика
CREATE TABLE IF NOT EXISTS offer_buyers (
  id BIGSERIAL PRIMARY KEY,
  offer_id INTEGER NOT NULL,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('Facebook', 'Google', 'TikTok')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(offer_id, buyer_id, source)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_offer_buyers_offer_id ON offer_buyers(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_buyers_buyer_id ON offer_buyers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_offer_buyers_source ON offer_buyers(source);

COMMENT ON TABLE offer_buyers IS 'Связь между офферами и байерами по источникам трафика';
COMMENT ON COLUMN offer_buyers.offer_id IS 'ID оффера из metrics_analytics';
COMMENT ON COLUMN offer_buyers.buyer_id IS 'ID байера (пользователя с ролью buyer)';
COMMENT ON COLUMN offer_buyers.source IS 'Источник трафика: Facebook, Google, TikTok';
