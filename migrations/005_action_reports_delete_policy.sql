-- Миграция: Добавление политики DELETE для таблицы action_reports
-- Дата: 2026-01-30
-- Описание: Разрешает авторизованным пользователям удалять отчеты по действиям

-- Проверяем, включён ли RLS на таблице (если нет - включаем)
ALTER TABLE IF EXISTS action_reports ENABLE ROW LEVEL SECURITY;

-- Удаляем старую политику DELETE если существует
DROP POLICY IF EXISTS "Allow authenticated users to delete action_reports" ON action_reports;

-- Создаём политику DELETE для авторизованных пользователей
CREATE POLICY "Allow authenticated users to delete action_reports"
ON action_reports
FOR DELETE
TO authenticated
USING (true);

-- Альтернативно: политика только для создателя отчёта или team lead
-- CREATE POLICY "Allow delete own or teamlead action_reports"
-- ON action_reports
-- FOR DELETE
-- TO authenticated
-- USING (
--   created_by = auth.uid()
--   OR EXISTS (
--     SELECT 1 FROM users
--     WHERE users.id = auth.uid()
--     AND users.role = 'teamlead'
--   )
-- );
