-- Giữ 1 bản ghi mới nhất (createdAt) cho mỗi (employeeId, monthYear)
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

DROP INDEX IF EXISTS "SalaryHistory_employeeId_monthYear_idx";

CREATE UNIQUE INDEX "SalaryHistory_employeeId_monthYear_key" ON "SalaryHistory" ("employeeId", "monthYear");
