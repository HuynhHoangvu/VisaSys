// --- Salary thresholds & allowances ---

/** Gross salary threshold above which insurance deduction and allowances apply (VND). */
export const SALARY_THRESHOLD = 8_000_000;

/**
 * Employee social/health/unemployment insurance contribution rates.
 * Applied to the insurance base salary (gross minus 2M if above threshold).
 */
export const BHXH_NLD_RATE = 0.08;  // Social insurance (BHXH)
export const BHYT_NLD_RATE = 0.015; // Health insurance (BHYT)
export const BHTN_NLD_RATE = 0.01;  // Unemployment insurance (BHTN)

/** Fixed monthly allowances granted to employees earning above SALARY_THRESHOLD. */
export const BONUS_CHUYÊN_CẦN  = 1_000_000; // Attendance bonus
export const BONUS_ĂN_TRƯA     =   500_000; // Lunch allowance
export const BONUS_HỖ_TRỢ_KHÁC =   500_000; // Miscellaneous support

/** Standard working days per month used to prorate daily wages on approved leave. */
export const STANDARD_WORK_DAYS = 22;

// --- Commission rates by role ---
export const COMMISSION_RATE_MANAGER = 0.15;
export const COMMISSION_RATE_SALE    = 0.1;
export const COMMISSION_RATE_DEFAULT = 0;

// --- Attendance ---

/** Employees who check out before this hour (24h) are considered leaving early. */
export const CHECKOUT_HOUR = 17;

// --- Kanban board ---
export const DEFAULT_COLUMN_ID = "col-1"; // Default column for new tasks
export const SIGNED_COLUMN_ID  = "col-4"; // "Đã ký" column

// --- Misc ---
export const EMPLOYEE_CODE_PREFIX = "NV";

/** Identifies automatically generated penalty/deduction records in sales history. */
export const SYSTEM_ACTOR = "Hệ thống tự động";
