-- Revert optional gross snapshot column (avoid drift vs simpler SalaryHistory shape).
ALTER TABLE "SalaryHistory" DROP COLUMN IF EXISTS "grossBaseSalary";
