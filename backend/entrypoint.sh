#!/bin/sh
set -e

echo "[docker] Starting migrations..."

# Thử chạy migrate deploy trước
if ! npx prisma migrate deploy 2>&1; then
  echo "[docker] Migration failed, attempting baseline..."
  
  # Baseline tất cả migrations
  npx prisma migrate resolve --applied 20260302143605_init || true
  npx prisma migrate resolve --applied 20260429163000_add_employee_phone || true
  npx prisma migrate resolve --applied 20260504120000_salary_history_one_row_per_employee_month || true
  npx prisma migrate resolve --applied 20260505120000_add_salary_history_thuong_khac || true
  npx prisma migrate resolve --applied 20260506120000_drop_salary_history_work_dates || true
  npx prisma migrate resolve --applied 20260506140000_salary_history_gross_base || true
  npx prisma migrate resolve --applied 20260507120000_remove_employee_phone || true
  npx prisma migrate resolve --applied 20260508140000_drop_salary_history_gross_base || true
  npx prisma migrate resolve --applied 20260511120000_rbac_role_and_employee_override || true
  npx prisma migrate resolve --applied 20260511200000_department_permission || true
  npx prisma migrate resolve --applied 20260520000000_add_session_table || true
  
  echo "[docker] Baseline complete, retrying migrate deploy..."
  npx prisma migrate deploy
fi

echo "[docker] Migrations complete."

echo "[docker] Starting server..."
npm start
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "[docker] Server exited with code $EXIT_CODE" >&2
  exit $EXIT_CODE
fi
