-- CreateTable
CREATE TABLE "RolePermission" (
    "role" TEXT NOT NULL,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE "EmployeePermissionOverride" (
    "employeeId" TEXT NOT NULL,
    "granted" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "revoked" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "EmployeePermissionOverride_pkey" PRIMARY KEY ("employeeId")
);

-- AddForeignKey
ALTER TABLE "EmployeePermissionOverride" ADD CONSTRAINT "EmployeePermissionOverride_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
