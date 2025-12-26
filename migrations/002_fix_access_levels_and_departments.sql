-- ============================================
-- Миграция 002: Исправление access_level и добавление отделов
-- ============================================

-- ============================================
-- 1. СБРОС access_level для всех кроме явного админа
-- ============================================

-- Сначала сбрасываем всех на member
UPDATE users SET access_level = 'member' WHERE access_level != 'admin';

-- Устанавливаем teamlead access_level только для тех, у кого role='teamlead'
UPDATE users
SET access_level = 'teamlead'
WHERE role = 'teamlead' AND access_level = 'member';

-- ВАЖНО: admin access_level должен быть установлен вручную!
-- Только один пользователь должен быть admin

-- ============================================
-- 2. СОЗДАЁМ ДЕФОЛТНЫЕ ОТДЕЛЫ
-- ============================================

INSERT INTO departments (name, description) VALUES
  ('Креативщики', 'Отдел креативов: монтажёры, дизайнеры, GIF-мейкеры')
ON CONFLICT DO NOTHING;

INSERT INTO departments (name, description) VALUES
  ('Media Buying', 'Отдел закупки трафика: байеры, аналитики')
ON CONFLICT DO NOTHING;

INSERT INTO departments (name, description) VALUES
  ('Контент', 'Отдел контента: редакторы, копирайтеры')
ON CONFLICT DO NOTHING;

INSERT INTO departments (name, description) VALUES
  ('Продукт', 'Отдел продукта: продакт-менеджеры, поиск')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. ПРОВЕРКА: показать текущее состояние
-- ============================================

-- Эти запросы можно выполнить для проверки:
-- SELECT id, name, email, role, access_level, department_id FROM users ORDER BY access_level, role;
-- SELECT * FROM departments;
