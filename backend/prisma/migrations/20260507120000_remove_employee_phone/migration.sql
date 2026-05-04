-- Bỏ cột SĐT nhân viên (làm sau); không ảnh hưởng Task.phone (CRM).
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "phone";
