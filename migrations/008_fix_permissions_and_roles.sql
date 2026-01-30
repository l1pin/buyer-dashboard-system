-- ============================================
-- Миграция 008: Исправление прав и ролей
-- Дата: 2026-01-30
-- ============================================
-- Исправляет отсутствующие права и настраивает роли корректно
-- ============================================

-- ============================================
-- 1. ДОБАВЛЯЕМ ВСЕ НЕОБХОДИМЫЕ PERMISSIONS
-- ============================================

INSERT INTO permissions (code, name, description, category, sort_order) VALUES
  -- Раздел: Офферы
  ('section.offers_management', 'Управление офферами', 'Панель управления офферами (Team Lead)', 'sections', 101),
  ('section.offers_buyer', 'Мои офферы (капы)', 'Капы и офферы байера (Media Buyer)', 'sections', 102),

  -- Раздел: Отчеты
  ('section.reports_management', 'Отчеты по байерам (управление)', 'Просмотр отчетов всех байеров (Team Lead)', 'sections', 201),
  ('section.reports_buyer', 'Отчеты по действиям (создание)', 'Создание отчетов по своим действиям (Media Buyer)', 'sections', 202),

  -- Раздел: Лендинги
  ('section.landings_management', 'Лендинги (управление)', 'Управление всеми лендингами (Team Lead)', 'sections', 301),
  ('section.landings_create', 'Лендинги (создание)', 'Создание лендингов (Content Manager)', 'sections', 302),
  ('section.landings_edit', 'Лендинги (редактирование)', 'Редактирование лендингов (Proofreader)', 'sections', 303),
  ('section.landings_analytics', 'Аналитика лендингов', 'Аналитика по лендингам (Team Lead)', 'sections', 304),

  -- Раздел: Аналитика
  ('section.metrics_analytics', 'Метрики аналитика', 'Аналитика метрик (Team Lead)', 'sections', 401),

  -- Раздел: Администрирование
  ('section.users', 'Пользователи', 'Управление пользователями (Team Lead)', 'sections', 501),

  -- Раздел: Контент
  ('section.creatives_create', 'Креативы (создание)', 'Создание креативов (Video Designer)', 'sections', 601),
  ('section.creatives_view', 'Мои креативы (просмотр)', 'Просмотр своих креативов (Media Buyer, Search Manager)', 'sections', 602),
  ('section.creatives_analytics', 'Аналитика креативов', 'Аналитика креативов (Team Lead)', 'sections', 603),

  -- Действия с пользователями
  ('users.view.own_department', 'Просмотр пользователей своего отдела', 'Видеть пользователей своего отдела', 'users', 701),
  ('users.view.all', 'Просмотр всех пользователей', 'Видеть всех пользователей', 'users', 702),
  ('users.edit.subordinates', 'Редактирование подчинённых', 'Редактировать только подчинённых', 'users', 703),
  ('users.edit.own_department', 'Редактирование своего отдела', 'Редактировать пользователей своего отдела', 'users', 704),
  ('users.edit.all', 'Редактирование всех пользователей', 'Редактировать любых пользователей', 'users', 705),
  ('users.create', 'Создание пользователей', 'Создавать новых пользователей', 'users', 706),
  ('users.delete', 'Архивирование пользователей', 'Архивировать пользователей', 'users', 707),
  ('users.manage_roles', 'Управление ролями', 'Управлять ролями', 'users', 708),
  ('users.manage_departments', 'Управление отделами', 'Управлять отделами', 'users', 709),

  -- Настройки (доступны всем)
  ('section.settings', 'Настройки', 'Доступ к настройкам', 'sections', 999)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- 2. СОЗДАЕМ ФУНКЦИЮ ДЛЯ ДОБАВЛЕНИЯ ПРАВ (если не существует)
-- ============================================

CREATE OR REPLACE FUNCTION add_role_permission_safe(p_role_code TEXT, p_permission_code TEXT)
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

-- ============================================
-- 3. ОЧИЩАЕМ СТАРЫЕ ПРАВА РОЛЕЙ (чтобы избежать дублей)
-- ============================================

-- Team Lead
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'teamlead');

-- Media Buyer
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'buyer');

-- Video Designer
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'editor');

-- Content Manager
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'content_manager');

-- Proofreader
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'proofreader');

-- Search Manager
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'search_manager');

-- Designer
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'designer');

-- Product Manager
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'product_manager');

-- GIF Creator
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'gif_creator');

-- ============================================
-- 4. НАЗНАЧАЕМ ПРАВА ДЛЯ TEAM LEAD
-- ============================================

SELECT add_role_permission_safe('teamlead', 'section.offers_management');
SELECT add_role_permission_safe('teamlead', 'section.reports_management');
SELECT add_role_permission_safe('teamlead', 'section.landings_management');
SELECT add_role_permission_safe('teamlead', 'section.landings_analytics');
SELECT add_role_permission_safe('teamlead', 'section.creatives_analytics');
SELECT add_role_permission_safe('teamlead', 'section.metrics_analytics');
SELECT add_role_permission_safe('teamlead', 'section.users');
SELECT add_role_permission_safe('teamlead', 'section.settings');
-- Действия с пользователями
SELECT add_role_permission_safe('teamlead', 'users.view.all');
SELECT add_role_permission_safe('teamlead', 'users.edit.all');
SELECT add_role_permission_safe('teamlead', 'users.create');
SELECT add_role_permission_safe('teamlead', 'users.delete');
SELECT add_role_permission_safe('teamlead', 'users.manage_roles');
SELECT add_role_permission_safe('teamlead', 'users.manage_departments');

-- ============================================
-- 5. НАЗНАЧАЕМ ПРАВА ДЛЯ MEDIA BUYER
-- ============================================

SELECT add_role_permission_safe('buyer', 'section.offers_buyer');
SELECT add_role_permission_safe('buyer', 'section.reports_buyer');
SELECT add_role_permission_safe('buyer', 'section.creatives_view');
SELECT add_role_permission_safe('buyer', 'section.settings');

-- ============================================
-- 6. НАЗНАЧАЕМ ПРАВА ДЛЯ VIDEO DESIGNER (editor)
-- ============================================

SELECT add_role_permission_safe('editor', 'section.creatives_create');
SELECT add_role_permission_safe('editor', 'section.settings');

-- ============================================
-- 7. НАЗНАЧАЕМ ПРАВА ДЛЯ CONTENT MANAGER
-- ============================================

SELECT add_role_permission_safe('content_manager', 'section.landings_create');
SELECT add_role_permission_safe('content_manager', 'section.settings');

-- ============================================
-- 8. НАЗНАЧАЕМ ПРАВА ДЛЯ PROOFREADER
-- ============================================

SELECT add_role_permission_safe('proofreader', 'section.landings_edit');
SELECT add_role_permission_safe('proofreader', 'section.settings');

-- ============================================
-- 9. НАЗНАЧАЕМ ПРАВА ДЛЯ SEARCH MANAGER
-- ============================================

SELECT add_role_permission_safe('search_manager', 'section.creatives_view');
SELECT add_role_permission_safe('search_manager', 'section.settings');

-- ============================================
-- 10. НАЗНАЧАЕМ ПРАВА ДЛЯ DESIGNER
-- ============================================

SELECT add_role_permission_safe('designer', 'section.settings');

-- ============================================
-- 11. НАЗНАЧАЕМ ПРАВА ДЛЯ PRODUCT MANAGER
-- ============================================

SELECT add_role_permission_safe('product_manager', 'section.settings');

-- ============================================
-- 12. НАЗНАЧАЕМ ПРАВА ДЛЯ GIF CREATOR
-- ============================================

SELECT add_role_permission_safe('gif_creator', 'section.settings');

-- ============================================
-- 13. ГОТОВО!
-- ============================================
