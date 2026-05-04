-- Chỉ dùng khi `prisma migrate resolve` không chạy được.
-- Xóa bản ghi failed để lần `migrate deploy` sau chạy lại migration đó.
-- Chạy trên Railway Postgres → Query.

DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260429163000_add_employee_phone';

-- Sau đó (máy có DATABASE_URL Railway):
--   cd backend && npx prisma migrate deploy
