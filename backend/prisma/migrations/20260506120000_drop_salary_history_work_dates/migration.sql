-- Bỏ danh sách ngày đi làm (PostgreSQL TEXT[]); giữ workDays.
-- Trước đó: gỡ trùng (employeeId, monthYear) để tạo unique an toàn trên Railway.

DELETE FROM "SalaryHistory" sh
WHERE sh.id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY "employeeId", "monthYear"
        ORDER BY "createdAt" DESC
      ) AS rn
    FROM "SalaryHistory"
  ) sub
  WHERE sub.rn > 1
);

ALTER TABLE "SalaryHistory" DROP COLUMN IF EXISTS "workDates";

CREATE UNIQUE INDEX IF NOT EXISTS "SalaryHistory_employeeId_monthYear_key" ON "SalaryHistory" ("employeeId", "monthYear");
