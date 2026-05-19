-- Ma trận RBAC theo bộ phận (Department), tách khỏi Employee.role.
CREATE TABLE "DepartmentPermission" (
    "departmentId" TEXT NOT NULL,
    "permissions" TEXT[],

    CONSTRAINT "DepartmentPermission_pkey" PRIMARY KEY ("departmentId")
);

ALTER TABLE "DepartmentPermission" ADD CONSTRAINT "DepartmentPermission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
