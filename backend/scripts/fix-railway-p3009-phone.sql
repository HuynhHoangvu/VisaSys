-- Chạy một lần trên PostgreSQL Railway (Query / psql) TRƯỚC khi `migrate resolve`.
-- Đảm bảo cột phone tồn tại dù migration cũ báo failed.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Sau đó trên máy có DATABASE_URL Railway:
--   cd backend && npx prisma migrate resolve --applied 20260429163000_add_employee_phone
--   npx prisma migrate deploy
