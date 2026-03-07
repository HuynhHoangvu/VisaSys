// backend/prisma/seed.ts
import { prisma } from "../lib/prisma";
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
    ]);
}
main()
    .catch((e) => {
    console.error('❌ Lỗi seed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
