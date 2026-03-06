// backend/prisma/seed.ts
import {prisma} from "../lib/prisma";

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu...');

  // 1. Tạo Departments
  const depts = await Promise.all([
    prisma.department.upsert({
      where: { name: 'Ban Giám Đốc' },
      update: {},
      create: { name: 'Ban Giám Đốc' }
    }),
    prisma.department.upsert({
      where: { name: 'Sale' },
      update: {},
      create: { name: 'Sale' }
    }),
    prisma.department.upsert({
      where: { name: 'Xử lý hồ sơ' },
      update: {},
      create: { name: 'Xử lý hồ sơ' }
    }),
    prisma.department.upsert({
      where: { name: 'Kế toán' },
      update: {},
      create: { name: 'Kế toán' }
    })
  ]);

  console.log('✅ Đã tạo departments:', depts.map(d => d.name));

  // 2. Tạo Employees
  const employees = await Promise.all([
    // Admin
    prisma.employee.upsert({
      where: { email: 'admin@flyvisa.com' },
      update: {},
      create: {
        employeeCode: 'AD001',
        email: 'admin@flyvisa.com',
        name: 'Admin',
        password: 'admin123',
        role: 'Giám đốc',
        departmentId: depts.find(d => d.name === 'Ban Giám Đốc')?.id,
        baseSalary: 20000000,
        commissionRate: 0.1
      }
    }),
    // Sale 1
    prisma.employee.upsert({
      where: { email: 'sale1@flyvisa.com' },
      update: {},
      create: {
        employeeCode: 'NV001',
        email: 'sale1@flyvisa.com',
        name: 'Nguyễn Văn A',
        password: 'sale123',
        role: 'Nhân viên',
        departmentId: depts.find(d => d.name === 'Sale')?.id,
        baseSalary: 8000000,
        commissionRate: 0.05
      }
    }),
    // Sale 2
    prisma.employee.upsert({
      where: { email: 'sale2@flyvisa.com' },
      update: {},
      create: {
        employeeCode: 'NV002',
        email: 'sale2@flyvisa.com',
        name: 'Trần Thị B',
        password: 'sale123',
        role: 'Nhân viên',
        departmentId: depts.find(d => d.name === 'Sale')?.id,
        baseSalary: 8000000,
        commissionRate: 0.05
      }
    }),
    // Xử lý hồ sơ
    prisma.employee.upsert({
      where: { email: 'processor@flyvisa.com' },
      update: {},
      create: {
        employeeCode: 'NV003',
        email: 'processor@flyvisa.com',
        name: 'Lê Văn C',
        password: 'process123',
        role: 'Nhân viên',
        departmentId: depts.find(d => d.name === 'Xử lý hồ sơ')?.id,
        baseSalary: 10000000,
        commissionRate: 0.02
      }
    })
  ]);

  console.log('✅ Đã tạo employees:', employees.map(e => `${e.name} (${e.email})`));

  // 3. Tạo Columns cho Kanban (nếu chưa có)
  const columns = await Promise.all([
    prisma.column.upsert({
      where: { id: 'col-1' },
      update: {},
      create: { id: 'col-1', title: 'Khách hàng mới', order: 1 }
    }),
    prisma.column.upsert({
      where: { id: 'col-2' },
      update: {},
      create: { id: 'col-2', title: 'Đang Tư Vấn', order: 2 }
    }),
    prisma.column.upsert({
      where: { id: 'col-3' },
      update: {},
      create: { id: 'col-3', title: 'Đã ký hợp đồng', order: 3 }
    }),
    prisma.column.upsert({
      where: { id: 'col-4' },
      update: {},
      create: { id: 'col-4', title: 'Đang thu hồ sơ', order: 4 }
    })
  ]);

  console.log('✅ Đã tạo columns:', columns.map(c => c.title));

  // 4. Tạo vài Task mẫu
  const sale1 = employees.find(e => e.email === 'sale1@flyvisa.com');
  const sale2 = employees.find(e => e.email === 'sale2@flyvisa.com');
  const col1 = columns.find(c => c.id === 'col-1');
  const col2 = columns.find(c => c.id === 'col-2');

  if (sale1 && sale2 && col1 && col2) {
    const tasks = await Promise.all([
      prisma.task.create({
        data: {
          id: `task-${Date.now()}-1`,
          content: 'Nguyễn Văn A - Visa Úc',
          price: '20.000.000đ',
          phone: '0123456789',
          email: 'nguyenvana@gmail.com',
          description: 'Khách hàng quan tâm đến dịch vụ visa Úc diện tay nghề',
          source: 'Website',
          assignedTo: sale1.name,
          columnId: col1.id,
          visaType: 'Skilled Worker (Úc)',
          passportNumber: 'C1234567',
          maritalStatus: 'Đã kết hôn',
          dependents: 2,
          educationLevel: 'Đại học',
          englishScore: 'IELTS 6.5',
          workExperience: '5 năm - Kỹ sư phần mềm'
        }
      }),
      prisma.task.create({
        data: {
          id: `task-${Date.now()}-2`,
          content: 'Trần Thị B - Du học Canada',
          price: '50.000.000đ',
          phone: '0987654321',
          email: 'tranthib@gmail.com',
          description: 'Đang tư vấn lộ trình du học sau đó xin định cư',
          source: 'Facebook',
          assignedTo: sale2.name,
          columnId: col2.id,
          visaType: 'AIP (Canada)',
          maritalStatus: 'Độc thân',
          educationLevel: 'Cấp 3',
          englishScore: 'IELTS 5.5'
        }
      })
    ]);

    console.log('✅ Đã tạo tasks mẫu');

    // 5. Tạo Activities mẫu
    if (tasks.length > 0) {
      await prisma.activity.createMany({
        data: [
          {
            id: `act-${Date.now()}-1`,
            taskId: tasks[0].id,
            type: 'Gọi',
            summary: 'Gọi tư vấn lần 1',
            assignee: sale1.name,
            status: 'Hoàn thành',
            completed: true,
            dueText: 'Đã hoàn thành',
            createdAt: new Date().toISOString()
          },
          {
            id: `act-${Date.now()}-2`,
            taskId: tasks[0].id,
            type: 'Email',
            summary: 'Gửi bảng báo giá',
            assignee: sale1.name,
            status: 'Hôm nay',
            completed: false,
            dueText: 'Hôm nay',
            createdAt: new Date().toISOString()
          },
          {
            id: `act-${Date.now()}-3`,
            taskId: tasks[1].id,
            type: 'Cuộc họp',
            summary: 'Họp tư vấn lộ trình',
            assignee: sale2.name,
            status: 'Đã lên kế hoạch',
            completed: false,
            dueText: 'Ngày mai',
            createdAt: new Date().toISOString()
          }
        ]
      });
      console.log('✅ Đã tạo activities mẫu');
    }
  }

  console.log('🎉 Seed dữ liệu hoàn tất!');
  console.log('📧 Tài khoản đăng nhập:');
  console.log('   - Admin: admin@flyvisa.com / admin123');
  console.log('   - Sale 1: sale1@flyvisa.com / sale123');
  console.log('   - Sale 2: sale2@flyvisa.com / sale123');
  console.log('   - Processor: processor@flyvisa.com / process123');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });