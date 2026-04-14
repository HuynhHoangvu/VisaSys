import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { DATABASE_URL } from "../config/env.js";
import bcrypt from "bcryptjs";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables.");
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Bắt đầu seed...");

  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();

  await prisma.department.createMany({
    data: [
      { id: "dept-1", name: "Ban Giám đốc" },
      { id: "dept-2", name: "Sale" },
      { id: "dept-3", name: "Xử lý hồ sơ" },
      { id: "dept-4", name: "Kế toán" },
    ],
  });

  const hashAdmin = await bcrypt.hash("admin123", 10);
  const hash123456 = await bcrypt.hash("123456", 10);

  await prisma.employee.createMany({
    data: [
      {
        id: "emp-1",
        employeeCode: "NV001",
        email: "admin@flyvisa.com",
        name: "Admin",
        password: hashAdmin,
        role: "Giám đốc",
        baseSalary: 20000000,
        commissionRate: 0,
        departmentId: "dept-1",
      },
      {
        id: "emp-2",
        employeeCode: "NV002",
        email: "sale1@flyvisa.com",
        name: "Nguyễn Văn A",
        password: hash123456,
        role: "Nhân viên",
        baseSalary: 8000000,
        commissionRate: 5,
        departmentId: "dept-2",
      },
      {
        id: "emp-3",
        employeeCode: "NV003",
        email: "sale2@flyvisa.com",
        name: "Trần Thị B",
        password: hash123456,
        role: "Nhân viên",
        baseSalary: 8000000,
        commissionRate: 5,
        departmentId: "dept-2",
      },
      {
        id: "emp-4",
        employeeCode: "NV004",
        email: "xulyhs@flyvisa.com",
        name: "Lê Văn C",
        password: hash123456,
        role: "Nhân viên",
        baseSalary: 9000000,
        commissionRate: 0,
        departmentId: "dept-3",
      },
    ],
  });

  console.log("✅ Seed hoàn tất!");
  console.log("   admin@flyvisa.com  / admin123");
  console.log("   sale1@flyvisa.com  / 123456");
  console.log("   sale2@flyvisa.com  / 123456");
  console.log("   xulyhs@flyvisa.com / 123456");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
