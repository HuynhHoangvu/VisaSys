import { prisma } from "./lib/prisma.js";

async function check() {
  const kq = await prisma.employee.findFirst({
    where: { name: { contains: "Quang" } },
    include: { department: true }
  });
  console.log("Khắc Quang:", JSON.stringify(kq, null, 2));

  if (kq) {
    // Get department permissions
    const deptPerm = await prisma.departmentPermission.findFirst({
      where: { departmentId: kq.departmentId }
    });
    console.log("Department Permissions:", JSON.stringify(deptPerm, null, 2));
  }
}

check().catch(console.error);
