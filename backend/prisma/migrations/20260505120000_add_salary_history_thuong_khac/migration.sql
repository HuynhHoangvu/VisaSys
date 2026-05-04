-- Tách thưởng thủ công: hoa hồng / thưởng KPI vs thưởng khác (điều chỉnh)
ALTER TABLE "SalaryHistory" ADD COLUMN "thuongKhac" DOUBLE PRECISION NOT NULL DEFAULT 0;
