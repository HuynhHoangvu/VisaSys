-- Railway: gỡ trùng trước khi thêm unique (employeeId, monthYear).
-- Giữ nguyên cột workDates — không DROP để không mất dữ liệu snapshot.

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

CREATE UNIQUE INDEX IF NOT EXISTS "SalaryHistory_employeeId_monthYear_key" ON "SalaryHistory" ("employeeId", "monthYear");
