-- ============================================
-- Миграция 003: Granular User Permissions
-- ============================================
-- Эта миграция добавляет гранулярные права на управление пользователями
-- вместо использования access_level (admin, head, teamlead, member)
-- ============================================

-- Добавляем новые гранулярные права для управления пользователями
INSERT INTO permissions (code, name, description, category, sort_order) VALUES
  -- Просмотр пользователей
  ('users.view.own_department', 'Просмотр своего отдела', 'Видеть пользователей только своего отдела', 'users', 10),
  ('users.view.all', 'Просмотр всех пользователей', 'Видеть всех пользователей системы', 'users', 11),

  -- Редактирование пользователей
  ('users.edit.subordinates', 'Редактирование подчинённых', 'Редактировать только тех, где вы указаны как Team Lead', 'users', 20),
  ('users.edit.own_department', 'Редактирование своего отдела', 'Редактировать пользователей своего отдела', 'users', 21),
  ('users.edit.all', 'Редактирование всех', 'Редактировать любых пользователей', 'users', 22)
ON CONFLICT (code) DO NOTHING;

-- Обновляем существующие права users.view и users.edit если они есть
-- (старые права сохраняются для обратной совместимости)

-- Назначаем новые права для роли teamlead (полный доступ)
DO $$
DECLARE
  teamlead_role_id UUID;
  perm_record RECORD;
BEGIN
  -- Находим роль teamlead
  SELECT id INTO teamlead_role_id FROM roles WHERE code = 'teamlead';

  IF teamlead_role_id IS NOT NULL THEN
    -- Добавляем все новые права для teamlead
    FOR perm_record IN
      SELECT id FROM permissions
      WHERE code IN (
        'users.view.all',
        'users.edit.all',
        'users.create',
        'users.delete',
        'users.manage_roles',
        'users.manage_departments'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (teamlead_role_id, perm_record.id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Примечание: access_level поле в таблице users сохраняется для обратной совместимости
-- но больше не используется для определения прав доступа.
-- Права теперь определяются через:
-- 1. role_permissions (права роли)
-- 2. custom_permissions (индивидуальные права пользователя)
-- 3. is_protected (защищённые пользователи имеют все права)

COMMENT ON COLUMN users.access_level IS 'DEPRECATED: Используйте role_permissions и custom_permissions вместо этого поля';
