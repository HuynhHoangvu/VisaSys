import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import * as dotenv from "dotenv";
dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Bắt đầu seed dữ liệu...");

  // Xóa dữ liệu cũ theo đúng thứ tự (tránh lỗi foreign key)
  console.log("🗑️  Xóa dữ liệu cũ...");
  await prisma.activity.deleteMany();
  await prisma.salesRecord.deleteMany();
  await prisma.salaryHistory.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.docFile.deleteMany();
  await prisma.docFolder.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.task.deleteMany();
  await prisma.column.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  console.log("✅ Đã xóa dữ liệu cũ");

  // ==========================================
  // 1. COLUMNS (Kanban Board)
  // ==========================================
  await prisma.column.createMany({
    data: [
      { id: "col-1", title: "Khách hàng mới", order: 1 },
      { id: "col-2", title: "Đang tư vấn", order: 2 },
      { id: "col-3", title: "Đã chốt hợp đồng", order: 3 },
      { id: "col-4", title: "Đang xử lý hồ sơ", order: 4 },
      { id: "col-5", title: "Hoàn thành", order: 5 },
    ],
  });
  console.log("✅ Đã tạo Columns");

  // ==========================================
  // 2. DEPARTMENTS
  // ==========================================
  await prisma.department.createMany({
    data: [
      { id: "dept-1", name: "Ban Giám đốc" },
      { id: "dept-2", name: "Sale" },
      { id: "dept-3", name: "Xử lý hồ sơ" },
      { id: "dept-4", name: "Kế toán" },
    ],
  });
  console.log("✅ Đã tạo Departments");

  // ==========================================
  // 3. EMPLOYEES
  // ==========================================
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
        departmentId: "dept-1",
      },
      {
        id: "emp-2",
        employeeCode: "NV002",
        email: "sale1@flyvisa.com",
        name: "Nguyễn Văn A",
        password: "123456",
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
        password: "123456",
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
        password: "123456",
        role: "Nhân viên",
        baseSalary: 9000000,
        commissionRate: 0,
        departmentId: "dept-3",
      },
    ],
  });
  console.log("✅ Đã tạo Employees");

  // ==========================================
  // 4. TASKS (Khách hàng mẫu)
  // ==========================================
  await prisma.task.createMany({
    data: [
      {
        id: "task-1",
        content: "Nguyễn Văn Hùng",
        price: "15,000,000",
        phone: "0901234567",
        email: "hung@gmail.com",
        description: "Khách hàng muốn làm visa du lịch Mỹ",
        source: "Facebook",
        assignedTo: "Nguyễn Văn A",
        visaType: "Du lịch",
        columnId: "col-1",
        processingColId: "proc-col-1",
      },
      {
        id: "task-2",
        content: "Trần Thị Lan",
        price: "25,000,000",
        phone: "0912345678",
        email: "lan@gmail.com",
        description: "Visa định cư Úc diện tay nghề",
        source: "Zalo",
        assignedTo: "Trần Thị B",
        visaType: "Định cư",
        columnId: "col-2",
        processingColId: "proc-col-1",
      },
      {
        id: "task-3",
        content: "Lê Minh Khoa",
        price: "8,000,000",
        phone: "0923456789",
        email: "khoa@gmail.com",
        description: "Visa du học Canada",
        source: "Website",
        assignedTo: "Nguyễn Văn A",
        visaType: "Du học",
        columnId: "col-3",
        processingColId: "proc-col-1",
      },
    ],
  });
  console.log("✅ Đã tạo Tasks (Khách hàng mẫu)");

  // ==========================================
  // 5. DOC FOLDERS
  // ==========================================
  await prisma.docFolder.createMany({
    data: [
      { id: "folder-1", name: "Hồ sơ khách hàng", parentId: null },
      { id: "folder-2", name: "Hợp đồng", parentId: null },
      { id: "folder-3", name: "Biểu mẫu", parentId: null },
    ],
  });
  console.log("✅ Đã tạo DocFolders");

  console.log("\n🎉 Seed hoàn tất!");
  console.log("📧 Tài khoản đăng nhập:");
  console.log("   Admin:  admin@flyvisa.com / admin123");
  console.log("   Sale 1: sale1@flyvisa.com / 123456");
  console.log("   Sale 2: sale2@flyvisa.com / 123456");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });