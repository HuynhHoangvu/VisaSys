/**
 * System-wide roles.
 */
export const ROLES = {
  ADMIN: "Admin",
  DIRECTOR: "Giám đốc",
  DEPUTY_DIRECTOR: "Phó Giám đốc",
  MANAGER: "Quản lý",
  HEAD_OF_DEPARTMENT: "Trưởng phòng",
  SALE: "Sale",
  TEACHER: "Giáo viên",
  DOCUMENT_PROCESSOR: "Nhân viên hồ sơ",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

/**
 * System-wide departments.
 */
export const DEPARTMENTS = {
  DIRECTORATE: "Ban Giám đốc",
  SALE: "Phòng Sale",
  PROCESSING: "Phòng Xử lý hồ sơ",
  TEACHER: "Phòng Giáo viên",
  ACCOUNTING: "Phòng Kế toán",
} as const;

export type Department = typeof DEPARTMENTS[keyof typeof DEPARTMENTS];

/**
 * Permissions keys for granular access control.
 */
export const PERMISSIONS = {
  HR_VIEW: "hr:view",
  HR_MANAGE: "hr:manage",
  SALARY_VIEW: "salary:view",
  SALARY_MANAGE: "salary:manage",
  TASK_VIEW: "task:view",
  TASK_MANAGE: "task:manage",
  DOCS_VIEW: "docs:view",
  DOCS_MANAGE: "docs:manage",
  BOSS_VIEW: "boss:view",
  KPI_VIEW: "kpi:view",
  KPI_MANAGE: "kpi:manage",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

interface AuthUserLike {
  id?: string;
  name?: string;
  role?: string;
  department?: string;
}

/**
 * Helper to check if a user belongs to Boss/Manager group.
 * Accepts AuthUser object or string role.
 */
export const isBossOrManager = (userOrRole: AuthUserLike | string | null | undefined): boolean => {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role || "";
  const bossRoles: string[] = [
    ROLES.ADMIN,
    ROLES.DIRECTOR,
    ROLES.DEPUTY_DIRECTOR,
    ROLES.MANAGER,
    ROLES.HEAD_OF_DEPARTMENT,
  ];
  return bossRoles.includes(role) || role.includes("Trưởng phòng");
};

/**
 * Helper to check if user is in Processing department.
 * Accepts AuthUser object or string department.
 */
export const isProcessingDept = (userOrDept: AuthUserLike | string | null | undefined): boolean => {
  const department = typeof userOrDept === "string" ? userOrDept : userOrDept?.department || "";
  return department?.toLowerCase().includes("xử lý") || false;
};

/**
 * Helper to check if user is a Teacher.
 * Accepts AuthUser object or string role.
 */
export const isTeacherDeptUser = (userOrRole: AuthUserLike | string | null | undefined): boolean => {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role || "";
  return role === ROLES.TEACHER || role?.includes("Giáo viên");
};

/**
 * Helper to check if a role has a specific permission.
 */
export const hasPermission = (role: string | undefined, permission: Permission): boolean => {
  if (!role) return false;
  
  const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    [ROLES.ADMIN]: Object.values(PERMISSIONS),
    [ROLES.DIRECTOR]: Object.values(PERMISSIONS),
    [ROLES.DEPUTY_DIRECTOR]: Object.values(PERMISSIONS),
    [ROLES.MANAGER]: [
      PERMISSIONS.HR_VIEW,
      PERMISSIONS.SALARY_VIEW,
      PERMISSIONS.TASK_VIEW,
      PERMISSIONS.TASK_MANAGE,
      PERMISSIONS.DOCS_VIEW,
      PERMISSIONS.DOCS_MANAGE,
      PERMISSIONS.KPI_VIEW,
    ],
    [ROLES.HEAD_OF_DEPARTMENT]: [
      PERMISSIONS.HR_VIEW,
      PERMISSIONS.TASK_VIEW,
      PERMISSIONS.TASK_MANAGE,
      PERMISSIONS.DOCS_VIEW,
      PERMISSIONS.KPI_VIEW,
    ],
    [ROLES.SALE]: [
      PERMISSIONS.TASK_VIEW,
      PERMISSIONS.TASK_MANAGE,
      PERMISSIONS.DOCS_VIEW,
    ],
    [ROLES.TEACHER]: [PERMISSIONS.HR_VIEW],
    [ROLES.DOCUMENT_PROCESSOR]: [
      PERMISSIONS.TASK_VIEW,
      PERMISSIONS.DOCS_VIEW,
      PERMISSIONS.DOCS_MANAGE,
    ],
  };

  // Check exact match first, then check if role contains the key
  const matchingKey = Object.keys(ROLE_PERMISSIONS).find(key => role.includes(key));
  const perms = ROLE_PERMISSIONS[role] || (matchingKey ? ROLE_PERMISSIONS[matchingKey] : []);
  return perms.includes(permission);
};
