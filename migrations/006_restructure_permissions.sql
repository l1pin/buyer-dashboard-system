-- ============================================
-- Миграция 006: Реструктуризация системы доступов
-- Дата: 2026-01-30
-- ============================================
-- Изменения:
-- 1. Новая структура разделов (sections) с понятными кодами
-- 2. Раздел "Отчеты" (reports) - новый
-- 3. Разделение креативов на создание/просмотр
-- 4. Обновление role_permissions для всех ролей
-- ============================================

-- ============================================
-- 1. ДОБАВЛЯЕМ НОВЫЕ PERMISSIONS
-- ============================================

INSERT INTO permissions (code, name, description, category, sort_order) VALUES
  -- Раздел: Офферы
  ('section.offers_management', 'Управление офферами', 'Доступ к панели управления офферами (Team Lead)', 'sections', 101),

  -- Раздел: Отчеты (НОВЫЙ)
  ('section.reports_management', 'Отчеты по байерам (управление)', 'Доступ к отчетам всех байеров (Team Lead)', 'sections', 201),
  ('section.reports_buyer', 'Отчеты по действиям (создание)', 'Доступ к созданию отчетов по своим действиям (Media Buyer)', 'sections', 202),

  -- Раздел: Лендинги
  ('section.landings_management', 'Лендинги (управление)', 'Доступ к управлению всеми лендингами (Team Lead)', 'sections', 301),
  ('section.landings_create', 'Лендинги (создание)', 'Доступ к созданию лендингов (Content Manager)', 'sections', 302),
  ('section.landings_edit', 'Лендинги (редактирование)', 'Доступ к редактированию лендингов (Proofreader)', 'sections', 303),
  ('section.landings_analytics', 'Аналитика лендингов', 'Доступ к аналитике лендингов (Team Lead)', 'sections', 304),

  -- Раздел: Контент
  ('section.creatives_create', 'Креативы (создание)', 'Доступ к созданию креативов (Video Designer)', 'sections', 401),
  ('section.creatives_view', 'Мои креативы (просмотр)', 'Доступ к просмотру своих креативов (Media Buyer, Search Manager)', 'sections', 402),
  ('section.creatives_analytics', 'Аналитика креативов', 'Доступ к аналитике креативов (Team Lead)', 'sections', 403)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- 2. СОЗДАЕМ АЛИАСЫ (для обратной совместимости)
-- ============================================
-- Старые коды будут работать через триггер или просто оставим их

-- Обновляем описания старых permissions
UPDATE permissions SET
  description = 'LEGACY: используйте section.offers_management'
WHERE code = 'section.offers_tl';

UPDATE permissions SET
  description = 'LEGACY: используйте section.landings_management'
WHERE code = 'section.landing_teamlead';

UPDATE permissions SET
  description = 'LEGACY: используйте section.landings_analytics'
WHERE code = 'section.landing_analytics';

UPDATE permissions SET
  description = 'LEGACY: используйте section.creatives_analytics'
WHERE code = 'section.analytics';

UPDATE permissions SET
  description = 'LEGACY: используйте section.landings_create'
WHERE code = 'section.landings';

UPDATE permissions SET
  description = 'LEGACY: используйте section.landings_edit'
WHERE code = 'section.landing_editor';

UPDATE permissions SET
  description = 'LEGACY: используйте section.creatives_create'
WHERE code = 'section.creatives';

-- ============================================
-- 3. ФУНКЦИЯ ДЛЯ ДОБАВЛЕНИЯ ПРАВА РОЛИ
-- ============================================

CREATE OR REPLACE FUNCTION add_role_permission(p_role_code TEXT, p_permission_code TEXT)
RETURNS VOID AS $$
DECLARE
  v_role_id UUID;
  v_permission_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE code = p_role_code;
  SELECT id INTO v_permission_id FROM permissions WHERE code = p_permission_code;

  IF v_role_id IS NOT NULL AND v_permission_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_role_id, v_permission_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Функция для удаления права роли
CREATE OR REPLACE FUNCTION remove_role_permission(p_role_code TEXT, p_permission_code TEXT)
RETURNS VOID AS $$
DECLARE
  v_role_id UUID;
  v_permission_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE code = p_role_code;
  SELECT id INTO v_permission_id FROM permissions WHERE code = p_permission_code;

  IF v_role_id IS NOT NULL AND v_permission_id IS NOT NULL THEN
    DELETE FROM role_permissions
    WHERE role_id = v_role_id AND permission_id = v_permission_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. НАЗНАЧАЕМ ПРАВА ДЛЯ TEAM LEAD
-- ============================================

-- Разделы
SELECT add_role_permission('teamlead', 'section.offers_management');
SELECT add_role_permission('teamlead', 'section.reports_management');
SELECT add_role_permission('teamlead', 'section.landings_management');
SELECT add_role_permission('teamlead', 'section.landings_analytics');
SELECT add_role_permission('teamlead', 'section.creatives_analytics');
SELECT add_role_permission('teamlead', 'section.metrics_analytics');
SELECT add_role_permission('teamlead', 'section.users');
SELECT add_role_permission('teamlead', 'section.settings');

-- Действия с пользователями (гранулярные)
SELECT add_role_permission('teamlead', 'users.view.all');
SELECT add_role_permission('teamlead', 'users.edit.all');
SELECT add_role_permission('teamlead', 'users.create');
SELECT add_role_permission('teamlead', 'users.delete');
SELECT add_role_permission('teamlead', 'users.manage_roles');
SELECT add_role_permission('teamlead', 'users.manage_departments');

-- ============================================
-- 5. НАЗНАЧАЕМ ПРАВА ДЛЯ MEDIA BUYER
-- ============================================

SELECT add_role_permission('buyer', 'section.offers_buyer');
SELECT add_role_permission('buyer', 'section.reports_buyer');
SELECT add_role_permission('buyer', 'section.creatives_view');
SELECT add_role_permission('buyer', 'section.settings');

-- ============================================
-- 6. НАЗНАЧАЕМ ПРАВА ДЛЯ VIDEO DESIGNER (editor)
-- ============================================

SELECT add_role_permission('editor', 'section.creatives_create');
SELECT add_role_permission('editor', 'section.settings');

-- ============================================
-- 7. НАЗНАЧАЕМ ПРАВА ДЛЯ CONTENT MANAGER
-- ============================================

SELECT add_role_permission('content_manager', 'section.landings_create');
SELECT add_role_permission('content_manager', 'section.settings');

-- ============================================
-- 8. НАЗНАЧАЕМ ПРАВА ДЛЯ PROOFREADER (Editor)
-- ============================================

SELECT add_role_permission('proofreader', 'section.landings_edit');
SELECT add_role_permission('proofreader', 'section.settings');

-- ============================================
-- 9. НАЗНАЧАЕМ ПРАВА ДЛЯ SEARCH MANAGER
-- ============================================

SELECT add_role_permission('search_manager', 'section.creatives_view');
SELECT add_role_permission('search_manager', 'section.settings');

-- ============================================
-- 10. НАЗНАЧАЕМ ПРАВА ДЛЯ DESIGNER
-- ============================================

SELECT add_role_permission('designer', 'section.settings');

-- ============================================
-- 11. НАЗНАЧАЕМ ПРАВА ДЛЯ PRODUCT MANAGER
-- ============================================

SELECT add_role_permission('product_manager', 'section.settings');

-- ============================================
-- 12. НАЗНАЧАЕМ ПРАВА ДЛЯ GIF CREATOR
-- ============================================

SELECT add_role_permission('gif_creator', 'section.settings');

-- ============================================
-- 13. ОЧИСТКА: Удаляем функции после использования
-- ============================================

-- Оставляем функции для возможного использования в будущем
-- DROP FUNCTION IF EXISTS add_role_permission(TEXT, TEXT);
-- DROP FUNCTION IF EXISTS remove_role_permission(TEXT, TEXT);

-- ============================================
-- ГОТОВО!
-- ============================================
