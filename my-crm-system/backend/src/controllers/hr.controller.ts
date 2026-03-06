import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";

// ==========================================
// 1. QUẢN LÝ BỘ PHẬN (DEPARTMENT)
// ==========================================
export const getDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany();
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy danh sách phòng ban" });
  }
};

export const createDepartment = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const newDept = await prisma.department.create({ data: { name } });
    getIO().emit("data_changed");
    res.status(201).json(newDept);
  } catch (error) {
    res.status(500).json({ error: "Lỗi tạo phòng ban" });
  }
};

export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedDept = await prisma.department.update({
      where: { id: id as string },
      data: { name }
    });
    res.json(updatedDept);
  } catch (error) {
    res.status(500).json({ error: "Lỗi cập nhật phòng ban" });
  }
};

export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({ where: { id: id as string } });
    res.json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa phòng ban" });
  }
};

// ==========================================
// 2. QUẢN LÝ NHÂN VIÊN (EMPLOYEE)
// ==========================================
export const getEmployees = async (req: Request, res: Response) => {
  try {
    const employees = await prisma.employee.findMany({
      include: { 
        department: true,
        attendanceRecords: { orderBy: { createdAt: 'desc' } },
        salesRecords: { orderBy: { createdAt: 'desc' } }
      }
    });
    
    const todayStr = new Date().toLocaleDateString("vi-VN");

    const formattedEmployees = employees.map(emp => {
      const todayRecord = emp.attendanceRecords.find(r => r.date === todayStr);
      
      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        name: emp.name,
        email: emp.email, // THÊM DÒNG NÀY ĐỂ HIỂN THỊ EMAIL RA BẢNG
        role: emp.role,
        baseSalary: emp.baseSalary,
        commissionRate: emp.commissionRate,
        department: emp.department?.name || "Chưa phân bổ / Khác",
        todayStatus: todayRecord ? todayRecord.status : "Chưa Check-in",
        attendanceRecords: emp.attendanceRecords,
        salesRecords:emp.salesRecords
      };
    });

    res.json(formattedEmployees);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy danh sách nhân viên" });
  }
};

export const createEmployee = async (req: Request, res: Response) => {
  try {
    const { name, email, password, department, role, baseSalary } = req.body;

    // 1. Kiểm tra Email trùng
    const existingEmployee = await prisma.employee.findUnique({
      where: { email },
    });
    if (existingEmployee) {
      return res.status(400).json({ error: "Email này đã tồn tại trong hệ thống!" });
    }

    // 2. Lấy phòng ban
    const dept = await prisma.department.findFirst({ where: { name: department } });

    // ==========================================
    // 3. LOGIC TẠO MÃ NHÂN VIÊN MỚI (CHỐNG TRÙNG)
    // ==========================================
    let nextNumber = 1;
    
    // Tìm nhân viên có mã NV lớn nhất hiện tại
    const lastEmployee = await prisma.employee.findFirst({
      orderBy: { createdAt: 'desc' }, // Hoặc có thể order theo employeeCode
    });

    if (lastEmployee && lastEmployee.employeeCode.startsWith('NV')) {
      // Lấy phần số của mã NV cũ nhất (Ví dụ từ "NV003" -> lấy "003" -> chuyển thành số 3)
      const lastNumberStr = lastEmployee.employeeCode.replace('NV', '');
      const lastNumber = parseInt(lastNumberStr, 10);
      
      // Nếu parseInt thành công, ta cộng thêm 1
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      } else {
        // Fallback an toàn nếu có ông nào mã lạ (VD: NVA, NVB)
        const count = await prisma.employee.count();
        nextNumber = count + 1;
      }
    }

    // Ghép chữ "NV" với số mới (có độ dài tối thiểu 3 số)
    const employeeCode = `NV${String(nextNumber).padStart(3, '0')}`;
    // ==========================================

    // 4. Tạo nhân viên
    const newEmployee = await prisma.employee.create({
      data: {
        employeeCode,
        name,
        email,
        password: password || "123456", 
        role,
        departmentId: dept?.id || null, 
        baseSalary: baseSalary ? parseFloat(baseSalary) : 5000000,
        commissionRate: role === "Trưởng phòng" ? 0.15 : (role.includes("Sale") ? 0.1 : 0)
      },
      include: {
        department: true 
      }
    });

    res.status(201).json({
      ...newEmployee,
      department: newEmployee.department?.name || "Chưa phân bổ"
    });
  } catch (error) {
    console.error("Lỗi tạo nhân viên:", error);
    res.status(500).json({ error: "Lỗi Server khi tạo nhân viên" });
  }
};

export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.employee.delete({ where: { id: id as string } });
    getIO().emit("data_changed");
    res.json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa nhân viên" });
  }
};

export const checkInEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; 
    const { date, inTime, outTime, status, fine } = req.body;

    const newRecord = await prisma.attendanceRecord.create({
      data: {
        date,
        inTime,
        outTime,
        status,
        fine,
        employeeId: id as string
      }
    });
    getIO().emit("data_changed");
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lưu chấm công vào Database" });
  }
};
export const addManualBonus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // id của employee
    const { customer, service, profit, note } = req.body;

    const newRecord = await prisma.salesRecord.create({
      data: {
        employeeId: id as string,
        customer,
        service,
        profit: Number(profit),
        note,
      }
    });

    getIO().emit("data_changed"); // Phát tín hiệu real-time
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lưu thưởng phạt" });
  }
};