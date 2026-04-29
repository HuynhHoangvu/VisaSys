import { z } from "zod";

// ==========================================
// AUTH
// ==========================================
export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Mật khẩu không được để trống")
});

// ==========================================
// EMPLOYEE / HR
// ==========================================
export const createEmployeeSchema = z.object({
  name: z.string().min(2, "Tên phải có ít nhất 2 ký tự"),
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().optional().or(z.literal("")),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự").optional(),
  department: z.string().min(1, "Phải chọn phòng ban"),
  role: z.string().min(1, "Phải chọn chức vụ"),
  baseSalary: z.union([z.string(), z.number()]).optional()
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(2, "Tên phải có ít nhất 2 ký tự"),
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().optional().or(z.literal("")),
  password: z.string().min(6).optional().or(z.literal("")),
  department: z.string().optional(),
  role: z.string().min(1, "Phải chọn chức vụ"),
  baseSalary: z.union([z.string(), z.number()]).optional()
});

export const manualBonusSchema = z.object({
  customer: z.string().min(1, "Tên khách hàng không được để trống"),
  service: z.string().min(1, "Loại dịch vụ không được để trống"),
  profit: z.union([z.string(), z.number()]).refine(v => !isNaN(Number(v)), "Số tiền không hợp lệ"),
  note: z.string().optional()
});

export const finalizeMonthSchema = z.object({
  monthYear: z.string().regex(/^\d{2}\/\d{4}$/, "Định dạng phải là MM/YYYY (VD: 02/2026)")
});

export const leaveRequestSchema = z.object({
  type: z.enum(["Xin phép nghỉ", "Nửa ngày", "Nghỉ ốm", "Nghỉ việc riêng", "Vô trễ", "Về sớm"], {
    error: "Loại đơn không hợp lệ"
  }),
  startDate: z.string().min(1, "Ngày bắt đầu không được để trống"),
  endDate: z.string().min(1, "Ngày kết thúc không được để trống"),
  reason: z.string().min(5, "Lý do phải có ít nhất 5 ký tự")
});

export const updateLeaveStatusSchema = z.object({
  status: z.enum(["Đã duyệt", "Từ chối", "Chờ duyệt", "Duyệt", "Không duyệt", "Đã hủy"], {
    error: "Trạng thái không hợp lệ"
  })
});

// ==========================================
// TASK / KANBAN
// ==========================================
export const createTaskSchema = z.object({
  content: z.string().min(1, "Tên khách hàng không được để trống"),
  price: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  description: z.string().optional(),
  source: z.string().optional(),
  assignedTo: z.string().min(1, "Phải chọn nhân viên phụ trách"),
  visaType: z.string().optional(),
  jobType: z.string().optional()
});

// ==========================================
// NOTIFICATION
// ==========================================
export const sendNotificationSchema = z.object({
  sender: z.string().min(1),
  message: z.string().min(1, "Nội dung thông báo không được để trống"),
  receiver: z.union([z.string(), z.array(z.string())]),
  taskId: z.string().optional()
});

export const examSubmittedNotificationSchema = z.object({
  studentName: z.string().min(1, "Tên học viên không được để trống"),
  examName: z.string().optional(),
  score: z.union([z.string(), z.number()]).optional(),
  submittedAt: z.string().optional(),
  sender: z.string().optional()
});
