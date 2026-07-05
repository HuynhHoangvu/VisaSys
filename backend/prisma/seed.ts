import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { DATABASE_URL } from "../config/env.js";
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables.");
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ SEED BỊ CHẶN: Không được chạy seed trên production!");
    process.exit(1);
  }

  console.log("🌱 Bắt đầu seed...");

  await prisma.employeePermissionOverride.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.departmentPermission.deleteMany();
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

  console.log("🌱 Seeding default Kanban columns...");
  await prisma.column.createMany({
    data: [
      { id: "col-1", title: "Khách hàng mới", order: 1 },
      { id: "col-2", title: "Đang Tư Vấn", order: 2 },
      { id: "col-3", title: "Đã ký hợp đồng", order: 3 },
      { id: "col-4", title: "Đang thu hồ sơ", order: 4 },
    ],
    skipDuplicates: true,
  });

  console.log("🌱 Seeding sample customers...");
  const now = new Date();
  const m = (offset: number) => new Date(now.getFullYear(), now.getMonth() - offset, Math.floor(Math.random() * 25) + 1);

  const customers = [
    { id: "task-1", content: "Nguyễn Thị Mai", phone: "0901234567", price: "25000000", assignedTo: "Nguyễn Văn A", visaType: "Du lịch", source: "Facebook Ads", columnId: "col-2", createdAt: m(0) },
    { id: "task-2", content: "Trần Văn Hùng", phone: "0912345678", price: "45000000", assignedTo: "Trần Thị B", visaType: "Định cư", source: "Giới thiệu", columnId: "col-3", createdAt: m(0) },
    { id: "task-3", content: "Lê Hoàng Nam", phone: "0923456789", price: "30000000", assignedTo: "Nguyễn Văn A", visaType: "Du học", source: "Zalo", columnId: "col-1", createdAt: m(0) },
    { id: "task-4", content: "Phạm Thị Lan", phone: "0934567890", price: "55000000", assignedTo: "Trần Thị B", visaType: "Lao động", source: "Website", columnId: "col-4", createdAt: m(0) },
    { id: "task-5", content: "Hoàng Minh Tuấn", phone: "0945678901", price: "20000000", assignedTo: "Nguyễn Văn A", visaType: "Du lịch", source: "Tiktok Ads", columnId: "col-2", createdAt: m(0) },
    { id: "task-6", content: "Võ Thị Hoa", phone: "0956789012", price: "40000000", assignedTo: "Trưởng phòng Sale", visaType: "Định cư", source: "Giới thiệu", columnId: "col-3", createdAt: m(0) },
    { id: "task-7", content: "Đặng Văn Long", phone: "0967890123", price: "35000000", assignedTo: "Trần Thị B", visaType: "Du học", source: "Facebook Ads", columnId: "col-1", createdAt: m(1) },
    { id: "task-8", content: "Bùi Thị Thu", phone: "0978901234", price: "60000000", assignedTo: "Nguyễn Văn A", visaType: "Lao động", source: "Giới thiệu", columnId: "col-3", createdAt: m(1) },
    { id: "task-9", content: "Ngô Văn Phúc", phone: "0989012345", price: "28000000", assignedTo: "Trưởng phòng Sale", visaType: "Du lịch", source: "Zalo", columnId: "col-2", createdAt: m(1) },
    { id: "task-10", content: "Dương Thị Nga", phone: "0990123456", price: "50000000", assignedTo: "Trần Thị B", visaType: "Định cư", source: "Website", columnId: "col-4", createdAt: m(1) },
    { id: "task-11", content: "Trịnh Văn Khoa", phone: "0901122334", price: "22000000", assignedTo: "Nguyễn Văn A", visaType: "Du học", source: "Facebook Ads", columnId: "col-1", createdAt: m(2) },
    { id: "task-12", content: "Lý Thị Kim", phone: "0912233445", price: "48000000", assignedTo: "Trần Thị B", visaType: "Lao động", source: "Giới thiệu", columnId: "col-3", createdAt: m(2) },
  ];

  for (const c of customers) {
    await prisma.task.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        content: c.content,
        phone: c.phone,
        price: c.price,
        assignedTo: c.assignedTo,
        visaType: c.visaType,
        source: c.source,
        columnId: c.columnId,
        createdAt: c.createdAt,
        processingColId: "proc-col-1",
      },
    });
  }

  console.log("🌱 Seeding sales records for revenue chart...");
  // Tạo SalesRecord cho các nhân viên sale qua 6 tháng
  const salesData = [
    // Tháng này
    { employeeId: "emp-7", profit: 12500000, customer: "Nguyễn Thị Mai", service: "Visa Du lịch", createdAt: m(0) },
    { employeeId: "emp-8", profit: 22500000, customer: "Trần Văn Hùng", service: "Visa Định cư", createdAt: m(0) },
    { employeeId: "emp-7", profit: 15000000, customer: "Lê Hoàng Nam", service: "Visa Du học", createdAt: m(0) },
    { employeeId: "emp-8", profit: 27500000, customer: "Phạm Thị Lan", service: "Visa Lao động", createdAt: m(0) },
    { employeeId: "emp-6", profit: 20000000, customer: "Võ Thị Hoa", service: "Visa Định cư", createdAt: m(0) },
    // Tháng trước
    { employeeId: "emp-7", profit: 17500000, customer: "Đặng Văn Long", service: "Visa Du học", createdAt: m(1) },
    { employeeId: "emp-8", profit: 30000000, customer: "Bùi Thị Thu", service: "Visa Lao động", createdAt: m(1) },
    { employeeId: "emp-6", profit: 14000000, customer: "Ngô Văn Phúc", service: "Visa Du lịch", createdAt: m(1) },
    { employeeId: "emp-8", profit: 25000000, customer: "Dương Thị Nga", service: "Visa Định cư", createdAt: m(1) },
    // 2 tháng trước
    { employeeId: "emp-7", profit: 11000000, customer: "Trịnh Văn Khoa", service: "Visa Du học", createdAt: m(2) },
    { employeeId: "emp-8", profit: 24000000, customer: "Lý Thị Kim", service: "Visa Lao động", createdAt: m(2) },
    { employeeId: "emp-6", profit: 18000000, customer: "Khách mẫu 3", service: "Visa Định cư", createdAt: m(2) },
    // 3 tháng trước
    { employeeId: "emp-7", profit: 9500000, customer: "Khách mẫu 4A", service: "Visa Du lịch", createdAt: m(3) },
    { employeeId: "emp-8", profit: 19000000, customer: "Khách mẫu 4B", service: "Visa Định cư", createdAt: m(3) },
    { employeeId: "emp-6", profit: 22000000, customer: "Khách mẫu 4C", service: "Visa Lao động", createdAt: m(3) },
    // 4 tháng trước
    { employeeId: "emp-7", profit: 13000000, customer: "Khách mẫu 5A", service: "Visa Du học", createdAt: m(4) },
    { employeeId: "emp-8", profit: 21000000, customer: "Khách mẫu 5B", service: "Visa Định cư", createdAt: m(4) },
    // 5 tháng trước
    { employeeId: "emp-7", profit: 8000000, customer: "Khách mẫu 6A", service: "Visa Du lịch", createdAt: m(5) },
    { employeeId: "emp-6", profit: 16000000, customer: "Khách mẫu 6B", service: "Visa Lao động", createdAt: m(5) },
  ];

  for (const s of salesData) {
    await prisma.salesRecord.create({
      data: {
        customer: s.customer,
        service: s.service,
        profit: s.profit,
        employeeId: s.employeeId,
        createdAt: s.createdAt,
      },
    });
  }

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
