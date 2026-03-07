// backend/src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Tìm employee theo email
    const employee = await prisma.employee.findUnique({
      where: { email },
      include: { department: true }
    });

    if (!employee) {
      return res.status(401).json({ error: "Email không tồn tại!" });
    }

    // Kiểm tra password (trong thực tế nên dùng bcrypt)
    if (employee.password !== password) {
      return res.status(401).json({ error: "Mật khẩu không chính xác!" });
    }

    // Tạo session (có thể dùng JWT)
    const userData = {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      department: employee.department?.name || "Khác",
      employeeCode: employee.employeeCode,
      email: employee.email
    };

    // Lưu session (nếu dùng express-session)
    // @ts-ignore
    req.session.user = userData;

    res.json(userData);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
};

export const logout = async (req: Request, res: Response) => {
  // @ts-ignore
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Không thể đăng xuất" });
    }
    res.clearCookie('connect.sid');
    res.json({ message: "Đăng xuất thành công" });
  });
};

export const getCurrentUser = async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.session.user;
  if (!user) {
    return res.status(401).json({ error: "Chưa đăng nhập" });
  }
  res.json(user);
};