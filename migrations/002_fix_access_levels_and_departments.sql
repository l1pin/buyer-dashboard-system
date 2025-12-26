-- ============================================
-- Миграция 002: Исправление access_level
-- ============================================

-- Сначала сбрасываем всех на member (кроме явного админа)
UPDATE users SET access_level = 'member' WHERE access_level IS NULL OR access_level = '';

-- Устанавливаем access_level='teamlead' только для тех, у кого role='teamlead'
UPDATE users
SET access_level = 'teamlead'
WHERE role = 'teamlead' AND (access_level IS NULL OR access_level = 'member' OR access_level = '');

-- ВАЖНО: admin access_level должен быть установлен ВРУЧНУЮ!
-- Выполните после миграции:
-- UPDATE users SET access_level = 'admin' WHERE email = 'ваш@email.com';

-- ============================================
-- Отделы и роли создаются через UI админом!
-- Никаких дефолтных значений здесь нет.
-- ============================================
