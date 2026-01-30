-- Миграция: добавление права на просмотр архивных пользователей
-- Дата: 2026-01-30

-- 1. Добавляем право users.view.archived если его нет
INSERT INTO permissions (code, name, description, category)
VALUES (
  'users.view.archived',
  'Просмотр архивных пользователей',
  'Доступ к вкладке "Архивные" и просмотр архивных пользователей',
  'users'
)
ON CONFLICT (code) DO NOTHING;

-- 2. Привязываем право к роли Team Lead
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'teamlead' AND p.code = 'users.view.archived'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Комментарий: право по умолчанию активно для Team Lead
