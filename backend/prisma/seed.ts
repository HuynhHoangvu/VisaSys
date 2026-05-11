import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { DATABASE_URL } from "../config/env.js";
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables.");
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Bắt đầu seed...");

  await prisma.employeePermissionOverride.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();

  await prisma.department.createMany({
    data: [
      { id: "dept-ban-gd", name: "Ban Giám đốc" },
      /** Tên chứa "trợ lý giám đốc" → logic legacy xử lý hồ sơ (accessResolution) áp dụng giống phòng xử lý. */
      { id: "dept-tro-ly-gd", name: "Phòng Trợ lý Giám đốc" },
      { id: "dept-marketing", name: "Phòng Marketing" },
      { id: "dept-sale", name: "Phòng Sale" },
      { id: "dept-xu-ly-hs", name: "Phòng Xử lý hồ sơ" },
      { id: "dept-ke-toan", name: "Phòng Kế toán" },
      { id: "dept-giao-vien", name: "Khối Giáo viên" },
    ],
  });

  await prisma.employee.createMany({
    data: [
      {
        id: "emp-1",
        employeeCode: "NV001",
        email: "admin@flyvisa.com",
        name: "Admin",
        password: "admin123",
        role: "Giám đốc",
        baseSalary: 20000000,
        commissionRate: 0,
        departmentId: "dept-ban-gd",
      },
      {
        id: "emp-2",
        employeeCode: "NV002",
        email: "pho.gd@flyvisa.com",
        name: "Phó Giám đốc mẫu",
        password: "123456",
        role: "Phó Giám đốc",
        baseSalary: 15000000,
        commissionRate: 0,
        departmentId: "dept-ban-gd",
      },
      {
        id: "emp-3",
        employeeCode: "NV003",
        email: "troly.gd@flyvisa.com",
        name: "Trợ lý Giám đốc",
        password: "123456",
        role: "Trợ lý Giám đốc",
        baseSalary: 12000000,
        commissionRate: 0,
        departmentId: "dept-tro-ly-gd",
      },
      {
        id: "emp-4",
        employeeCode: "NV004",
        email: "tp.marketing@flyvisa.com",
        name: "Trưởng phòng Marketing",
        password: "123456",
        role: "Trưởng phòng Marketing",
        baseSalary: 14000000,
        commissionRate: 0,
        departmentId: "dept-marketing",
      },
      {
        id: "emp-5",
        employeeCode: "NV005",
        email: "marketing1@flyvisa.com",
        name: "Nhân viên Marketing",
        password: "123456",
        role: "Nhân viên Marketing",
        baseSalary: 9000000,
        commissionRate: 0,
        departmentId: "dept-marketing",
      },
      {
        id: "emp-6",
        employeeCode: "NV006",
        email: "tp.sale@flyvisa.com",
        name: "Trưởng phòng Sale",
        password: "123456",
        role: "Trưởng phòng Sale",
        baseSalary: 14000000,
        commissionRate: 2,
        departmentId: "dept-sale",
      },
      {
        id: "emp-7",
        employeeCode: "NV007",
        email: "sale1@flyvisa.com",
        name: "Nguyễn Văn A",
        password: "123456",
        role: "Nhân viên Sale",
        baseSalary: 8000000,
        commissionRate: 5,
        departmentId: "dept-sale",
      },
      {
        id: "emp-8",
        employeeCode: "NV008",
        email: "sale2@flyvisa.com",
        name: "Trần Thị B",
        password: "123456",
        role: "Nhân viên Sale",
        baseSalary: 8000000,
        commissionRate: 5,
        departmentId: "dept-sale",
      },
      {
        id: "emp-9",
        employeeCode: "NV009",
        email: "xulyhs@flyvisa.com",
        name: "Lê Văn C",
        password: "123456",
        role: "Nhân viên Xử lý hồ sơ",
        baseSalary: 9000000,
        commissionRate: 0,
        departmentId: "dept-xu-ly-hs",
      },
      {
        id: "emp-10",
        employeeCode: "NV010",
        email: "ketoan@flyvisa.com",
        name: "Nhân viên Kế toán",
        password: "123456",
        role: "Nhân viên Kế toán",
        baseSalary: 8500000,
        commissionRate: 0,
        departmentId: "dept-ke-toan",
      },
      {
        id: "emp-11",
        employeeCode: "NV011",
        email: "giaovien@flyvisa.com",
        name: "Giáo viên mẫu",
        password: "123456",
        role: "Giáo viên",
        baseSalary: 7000000,
        commissionRate: 0,
        departmentId: "dept-giao-vien",
      },
    ],
  });

  console.log("✅ Seed hoàn tất!");
  console.log("   admin@flyvisa.com       / admin123   (Giám đốc)");
  console.log("   pho.gd@flyvisa.com      / 123456     (Phó Giám đốc)");
  console.log("   troly.gd@flyvisa.com    / 123456     (Trợ lý Giám đốc)");
  console.log("   tp.marketing@flyvisa.com / 123456    (Trưởng phòng Marketing)");
  console.log("   marketing1@flyvisa.com  / 123456     (NV Marketing)");
  console.log("   tp.sale@flyvisa.com     / 123456     (Trưởng phòng Sale)");
  console.log("   sale1@flyvisa.com       / 123456     (NV Sale)");
  console.log("   sale2@flyvisa.com       / 123456     (NV Sale)");
  console.log("   xulyhs@flyvisa.com      / 123456     (NV Xử lý hồ sơ)");
  console.log("   ketoan@flyvisa.com      / 123456     (NV Kế toán)");
  console.log("   giaovien@flyvisa.com    / 123456     (Giáo viên)");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
