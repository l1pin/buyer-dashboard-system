-- ============================================
-- МИГРАЦИЯ: Система ролей и прав доступа
-- Версия: 1.0
-- Дата: 2025-01-XX
-- ============================================
-- ВАЖНО: Эта миграция НЕ удаляет старые поля!
-- Старый код продолжит работать.
-- ============================================

-- ============================================
-- 1. ТАБЛИЦА ОТДЕЛОВ (departments)
-- ============================================

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Индекс для быстрого поиска по имени
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);

-- Триггер для updated_at
CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_departments_updated_at ON departments;
CREATE TRIGGER trigger_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_departments_updated_at();


-- ============================================
-- 2. ТАБЛИЦА РОЛЕЙ (roles)
-- ============================================
-- code — неизменяемый идентификатор (используется в коде)
-- name — отображаемое имя (можно менять в UI)
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,           -- 'buyer', 'editor' — НЕ менять!
  name TEXT NOT NULL,                   -- 'Media Buyer' — можно менять
  description TEXT,
  icon TEXT,                            -- 'Video', 'Palette' — иконка Lucide
  color TEXT,                           -- 'blue', 'purple' — цвет для UI
  is_system BOOLEAN DEFAULT false,      -- системная роль (нельзя удалить)
  sort_order INT DEFAULT 0,             -- порядок сортировки
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);
CREATE INDEX IF NOT EXISTS idx_roles_sort_order ON roles(sort_order);

-- Триггер для updated_at
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_roles_updated_at ON roles;
CREATE TRIGGER trigger_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_roles_updated_at();


-- ============================================
-- 3. ТАБЛИЦА ПРАВ (permissions)
-- ============================================

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,           -- 'section.creatives', 'users.edit'
  name TEXT NOT NULL,                   -- 'Креативы', 'Редактирование пользователей'
  description TEXT,
  category TEXT NOT NULL,               -- 'sections', 'users', 'offers', 'landings'
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);


-- ============================================
-- 4. СВЯЗЬ РОЛЬ → ПРАВА (role_permissions)
-- ============================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);


-- ============================================
-- 5. ДОБАВЛЯЕМ НОВЫЕ ПОЛЯ В USERS
-- ============================================
-- Старые поля (role, department, team_lead_id) ОСТАЮТСЯ!
-- ============================================

-- Уровень доступа (иерархия управления)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'access_level') THEN
    ALTER TABLE users ADD COLUMN access_level TEXT DEFAULT 'member';
  END IF;
END $$;

-- Ссылка на новую таблицу ролей
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'role_id') THEN
    ALTER TABLE users ADD COLUMN role_id UUID REFERENCES roles(id);
  END IF;
END $$;

-- Ссылка на отдел
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'department_id') THEN
    ALTER TABLE users ADD COLUMN department_id UUID REFERENCES departments(id);
  END IF;
END $$;

-- Индивидуальные права (сверх роли)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'custom_permissions') THEN
    ALTER TABLE users ADD COLUMN custom_permissions TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_users_access_level ON users(access_level);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);


-- ============================================
-- 6. ЗАПОЛНЯЕМ РОЛИ (из текущих 9 ролей)
-- ============================================

INSERT INTO roles (code, name, description, icon, color, is_system, sort_order) VALUES
  ('teamlead', 'Team Lead', 'Руководитель команды', 'Shield', 'green', true, 1),
  ('buyer', 'Media Buyer', 'Медиа-байер, работает с офферами и каналами', 'Megaphone', 'blue', true, 2),
  ('editor', 'Video Designer', 'Дизайнер видео, работает с видеоконтентом', 'Video', 'purple', true, 3),
  ('designer', 'Designer', 'Графический дизайнер', 'Palette', 'pink', true, 4),
  ('search_manager', 'Search Manager', 'Менеджер поиска', 'Search', 'orange', true, 5),
  ('content_manager', 'Content Manager', 'Менеджер контента, работает с лендингами', 'Code2', 'indigo', true, 6),
  ('product_manager', 'Product Manager', 'Менеджер продукта', 'Package', 'yellow', true, 7),
  ('proofreader', 'Editor', 'Редактор, проверяет контент', 'Pencil', 'teal', true, 8),
  ('gif_creator', 'GIF Creator', 'Создатель GIF-файлов', 'Image', 'cyan', true, 9)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;


-- ============================================
-- 7. ЗАПОЛНЯЕМ ПРАВА (permissions)
-- ============================================

INSERT INTO permissions (code, name, category, sort_order) VALUES
  -- Вкладки (sections)
  ('section.offers_tl', 'Офферы (управление)', 'sections', 1),
  ('section.offers_buyer', 'Мои офферы', 'sections', 2),
  ('section.landing_teamlead', 'Лендинги (управление)', 'sections', 3),
  ('section.landing_analytics', 'Аналитика лендингов', 'sections', 4),
  ('section.analytics', 'Аналитика креативов', 'sections', 5),
  ('section.metrics_analytics', 'Метрики аналитика', 'sections', 6),
  ('section.users', 'Пользователи', 'sections', 7),
  ('section.creatives', 'Креативы', 'sections', 8),
  ('section.landings', 'Лендинги (просмотр)', 'sections', 9),
  ('section.landing_editor', 'Лендинги (редактор)', 'sections', 10),
  ('section.settings', 'Настройки', 'sections', 11),

  -- Управление пользователями
  ('users.view', 'Просмотр пользователей', 'users', 1),
  ('users.create', 'Создание пользователей', 'users', 2),
  ('users.edit', 'Редактирование пользователей', 'users', 3),
  ('users.delete', 'Архивирование пользователей', 'users', 4),
  ('users.manage_roles', 'Управление ролями', 'users', 5),
  ('users.manage_departments', 'Управление отделами', 'users', 6),

  -- Офферы
  ('offers.view', 'Просмотр офферов', 'offers', 1),
  ('offers.create', 'Создание офферов', 'offers', 2),
  ('offers.edit', 'Редактирование офферов', 'offers', 3),
  ('offers.assign', 'Назначение офферов', 'offers', 4),

  -- Лендинги
  ('landings.view', 'Просмотр лендингов', 'landings', 1),
  ('landings.create', 'Создание лендингов', 'landings', 2),
  ('landings.edit', 'Редактирование лендингов', 'landings', 3),
  ('landings.delete', 'Удаление лендингов', 'landings', 4),

  -- Креативы
  ('creatives.view', 'Просмотр креативов', 'creatives', 1),
  ('creatives.create', 'Создание креативов', 'creatives', 2),
  ('creatives.edit', 'Редактирование креативов', 'creatives', 3),

  -- Аналитика
  ('analytics.view', 'Просмотр аналитики', 'analytics', 1),
  ('analytics.export', 'Экспорт аналитики', 'analytics', 2)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;


-- ============================================
-- 8. СВЯЗЫВАЕМ РОЛИ С ПРАВАМИ (текущая логика)
-- ============================================

-- Функция для добавления права роли
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

-- Team Lead — все права на вкладки (кроме offers_buyer, он для buyer)
SELECT add_role_permission('teamlead', 'section.offers_tl');
SELECT add_role_permission('teamlead', 'section.landing_teamlead');
SELECT add_role_permission('teamlead', 'section.landing_analytics');
SELECT add_role_permission('teamlead', 'section.analytics');
SELECT add_role_permission('teamlead', 'section.metrics_analytics');
SELECT add_role_permission('teamlead', 'section.users');
SELECT add_role_permission('teamlead', 'section.settings');
-- Team Lead — все права на действия
SELECT add_role_permission('teamlead', 'users.view');
SELECT add_role_permission('teamlead', 'users.create');
SELECT add_role_permission('teamlead', 'users.edit');
SELECT add_role_permission('teamlead', 'users.delete');
SELECT add_role_permission('teamlead', 'users.manage_roles');
SELECT add_role_permission('teamlead', 'users.manage_departments');
SELECT add_role_permission('teamlead', 'offers.view');
SELECT add_role_permission('teamlead', 'offers.create');
SELECT add_role_permission('teamlead', 'offers.edit');
SELECT add_role_permission('teamlead', 'offers.assign');
SELECT add_role_permission('teamlead', 'landings.view');
SELECT add_role_permission('teamlead', 'landings.create');
SELECT add_role_permission('teamlead', 'landings.edit');
SELECT add_role_permission('teamlead', 'landings.delete');
SELECT add_role_permission('teamlead', 'creatives.view');
SELECT add_role_permission('teamlead', 'creatives.create');
SELECT add_role_permission('teamlead', 'creatives.edit');
SELECT add_role_permission('teamlead', 'analytics.view');
SELECT add_role_permission('teamlead', 'analytics.export');

-- Media Buyer
SELECT add_role_permission('buyer', 'section.creatives');
SELECT add_role_permission('buyer', 'section.offers_buyer');
SELECT add_role_permission('buyer', 'section.settings');
SELECT add_role_permission('buyer', 'creatives.view');
SELECT add_role_permission('buyer', 'offers.view');

-- Video Designer (editor)
SELECT add_role_permission('editor', 'section.creatives');
SELECT add_role_permission('editor', 'section.settings');
SELECT add_role_permission('editor', 'creatives.view');
SELECT add_role_permission('editor', 'creatives.create');
SELECT add_role_permission('editor', 'creatives.edit');

-- Designer
SELECT add_role_permission('designer', 'section.settings');

-- Search Manager
SELECT add_role_permission('search_manager', 'section.creatives');
SELECT add_role_permission('search_manager', 'section.settings');
SELECT add_role_permission('search_manager', 'creatives.view');

-- Content Manager
SELECT add_role_permission('content_manager', 'section.landings');
SELECT add_role_permission('content_manager', 'section.settings');
SELECT add_role_permission('content_manager', 'landings.view');

-- Product Manager
SELECT add_role_permission('product_manager', 'section.settings');

-- Proofreader (Editor)
SELECT add_role_permission('proofreader', 'section.landing_editor');
SELECT add_role_permission('proofreader', 'section.settings');
SELECT add_role_permission('proofreader', 'landings.view');
SELECT add_role_permission('proofreader', 'landings.edit');

-- GIF Creator
SELECT add_role_permission('gif_creator', 'section.settings');

-- Удаляем временную функцию
DROP FUNCTION IF EXISTS add_role_permission(TEXT, TEXT);


-- ============================================
-- 9. МИГРАЦИЯ ДАННЫХ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================

-- Создаём отделы из существующих уникальных значений
INSERT INTO departments (name)
SELECT DISTINCT department
FROM users
WHERE department IS NOT NULL
  AND department != ''
  AND department NOT IN (SELECT name FROM departments)
ON CONFLICT (name) DO NOTHING;

-- Заполняем department_id на основе текстового поля department
UPDATE users u
SET department_id = d.id
FROM departments d
WHERE u.department = d.name
  AND u.department_id IS NULL;

-- Заполняем role_id на основе текстового поля role
UPDATE users u
SET role_id = r.id
FROM roles r
WHERE u.role = r.code
  AND u.role_id IS NULL;

-- Устанавливаем access_level
-- Первый пользователь (is_protected + teamlead) становится admin
-- Остальные teamlead становятся teamlead
-- Все остальные — member
UPDATE users
SET access_level = CASE
  WHEN role = 'teamlead' AND is_protected = true THEN 'admin'
  WHEN role = 'teamlead' THEN 'teamlead'
  ELSE 'member'
END
WHERE access_level IS NULL OR access_level = 'member';


-- ============================================
-- 10. RLS ПОЛИТИКИ (Row Level Security)
-- ============================================

-- Включаем RLS для новых таблиц
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Политики для departments (чтение всем аутентифицированным)
DROP POLICY IF EXISTS "departments_select_policy" ON departments;
CREATE POLICY "departments_select_policy" ON departments
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "departments_all_policy" ON departments;
CREATE POLICY "departments_all_policy" ON departments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.access_level IN ('admin', 'head')
    )
  );

-- Политики для roles (чтение всем аутентифицированным)
DROP POLICY IF EXISTS "roles_select_policy" ON roles;
CREATE POLICY "roles_select_policy" ON roles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "roles_all_policy" ON roles;
CREATE POLICY "roles_all_policy" ON roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.access_level = 'admin'
    )
  );

-- Политики для permissions (только чтение)
DROP POLICY IF EXISTS "permissions_select_policy" ON permissions;
CREATE POLICY "permissions_select_policy" ON permissions
  FOR SELECT TO authenticated
  USING (true);

-- Политики для role_permissions
DROP POLICY IF EXISTS "role_permissions_select_policy" ON role_permissions;
CREATE POLICY "role_permissions_select_policy" ON role_permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "role_permissions_all_policy" ON role_permissions;
CREATE POLICY "role_permissions_all_policy" ON role_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.access_level = 'admin'
    )
  );


-- ============================================
-- 11. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
-- ============================================

-- Функция для получения всех прав пользователя
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  v_permissions TEXT[];
  v_user RECORD;
BEGIN
  -- Получаем данные пользователя
  SELECT * INTO v_user FROM users WHERE id = p_user_id;

  IF v_user IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  -- Если admin — возвращаем все права
  IF v_user.access_level = 'admin' THEN
    SELECT ARRAY_AGG(code) INTO v_permissions FROM permissions;
    RETURN v_permissions;
  END IF;

  -- Собираем права от роли
  SELECT ARRAY_AGG(DISTINCT p.code) INTO v_permissions
  FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE rp.role_id = v_user.role_id;

  -- Добавляем индивидуальные права
  IF v_user.custom_permissions IS NOT NULL THEN
    v_permissions := v_permissions || v_user.custom_permissions;
  END IF;

  -- Добавляем права по access_level
  IF v_user.access_level IN ('head', 'teamlead') THEN
    v_permissions := v_permissions || ARRAY['users.view'];
  END IF;

  IF v_user.access_level = 'head' THEN
    v_permissions := v_permissions || ARRAY['users.create', 'users.edit', 'users.delete'];
  END IF;

  RETURN COALESCE(v_permissions, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Функция для проверки права
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission_code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_permission_code = ANY(get_user_permissions(p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- ГОТОВО!
-- ============================================
-- После выполнения этой миграции:
-- 1. Все старые данные сохранены
-- 2. Новые таблицы созданы и заполнены
-- 3. Пользователи связаны с новыми ролями
-- 4. Старый код продолжает работать
-- ============================================
