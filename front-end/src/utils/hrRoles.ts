import type { AuthUser } from "../types";
import { hasPermission, P } from "./access";

function norm(s: string | undefined | null): string {
  return (s || "").trim().toLowerCase();
}

/**
 * Giám đốc / Phó / tài khoản admin — không gộp nhầm “Trợ lý Giám đốc” (chức danh đó có chữ “giám đốc”
 * nhưng không quản trị toàn công ty).
 */
export function isAdminLikeForHr(user: AuthUser | null): boolean {
  if (!user) return false;
  const r = norm(user.role);
  if (user.id === "admin") return true;
  if (r.includes("admin")) return true;
  if (r.includes("phó giám đốc")) return true;
  if (r.includes("giám đốc") && !r.includes("trợ lý")) return true;
  return false;
}

export function isManagerLikeForHr(user: AuthUser | null): boolean {
  if (!user) return false;
  const r = norm(user.role);
  return r.includes("trưởng phòng") || r.includes("quản lý");
}

/** Chấm công / checkout thay người khác + xem danh sách HR đầy đủ (theo chức danh). */
export function canManageOthersAttendanceByRole(user: AuthUser | null): boolean {
  if (!user) return false;
  return isAdminLikeForHr(user) || isManagerLikeForHr(user);
}

/**
 * Miễn trừ nửa ngày / hoàn tác trừ chấm công: cần `hr.registry.write` và (chốt lương HOẶC lãnh đạo theo vai trò).
 */
export function canAdjustAttendanceRecords(user: AuthUser | null): boolean {
  if (!user) return false;
  if (!hasPermission(user, P.hrWrite)) return false;
  return (
    hasPermission(user, P.hrPayrollFinalize) ||
    isAdminLikeForHr(user) ||
    isManagerLikeForHr(user)
  );
}

/**
 * Thưởng/Phạt CRM thủ công, xóa hoa hồng: Giám đốc/Phó/admin hoặc chốt lương, hoặc Trưởng phòng/Quản lý **cùng phòng** với NV.
 */
export function canAdjustPayrollManualBonus(
  user: AuthUser | null,
  employeeDepartment: string,
): boolean {
  if (!user) return false;
  if (!hasPermission(user, P.hrWrite)) return false;
  const r = norm(user.role);
  const leaderSameDept =
    (r.includes("trưởng phòng") || r.includes("quản lý")) &&
    norm(user.department) === norm(employeeDepartment);
  return hasPermission(user, P.hrPayrollFinalize) || isAdminLikeForHr(user) || leaderSameDept;
}
