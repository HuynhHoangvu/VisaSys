// frontend/src/types/index.ts

// ==========================================
// 1. CRM & KANBAN TYPES (Khách hàng & Bảng)
// ==========================================
export type ActivityType = "Việc cần làm" | "Email" | "Gọi" | "Cuộc họp" | "Tài liệu" | "Ghi chú";
export type ActivityStatus = "Hôm nay" | "Đã lên kế hoạch" | "Quá hạn" | "Hoàn thành";

export interface Activity {
  id: string;
  taskId: string;
  type: ActivityType;
  summary: string;
  assignee: string;
  status: ActivityStatus;
  completed: boolean;
  fileName?: string;
  fileUrl?: string;
  dueText: string;
  createdAt: string;
}

export interface Task {
  id: string;
  content: string;
  price: string;
  phone: string;
  email?: string;
  description?: string;
  source?: string;
  assignedTo: string;
  activities?: Activity[];
  visaType?: string;
  checklistType?: string;
  passportNumber?: string;
  maritalStatus?: string;
  dependents?: number | string;
  priorityDate?: string;
  educationLevel?: string;
  englishScore?: string;
  workExperience?: string;
  documents?: { [key: string]: { name: string; url: string }[] };
  processingColId?: string; // Vị trí cột của phòng BO
  createdAt?: string;
  jobType?: string;
  
}

export interface Column {
  id: string;
  title: string;
  taskIds: string[];
}

export interface BoardData {
  tasks: Record<string, Task>;
  columns: Record<string, Column>;
  columnOrder: string[];
}


// ==========================================
// 2. HR & NHÂN SỰ TYPES
// ==========================================
export interface Department {
  id: string;
  name: string;
}

export type AttendanceStatus = "Đúng giờ" | "Đi muộn" | "Vắng không phép" | "Chưa Check-in" | "Về sớm" | "Đi muộn + Về Sớm" | "Quên checkout";

export interface AttendanceRecord {
  id?: string;
  date: string;
  inTime: string;
  outTime: string;
  status: AttendanceStatus;
  fine: number;
}

export interface SalesRecord {
  id: string;
  customer: string;
  service: string;
  profit: number;
  date: string;
  note?: string; 
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string; // Bắt buộc có email
  department: string;
  role: string;
  password?: string;
  baseSalary: number;
  commissionRate: number;
  todayStatus: AttendanceStatus;
  attendanceRecords: AttendanceRecord[];
  salesRecords: SalesRecord[];
}

export interface NewEmployeeData {
  name: string;
  email: string;
  password?: string;
  department: string;
  role: string;
  baseSalary: number;
}

export type LeaveType = "Nghỉ ốm" | "Nghỉ phép năm" | "Việc cá nhân" | "Nghỉ không lương" | "Nghỉ thai sản";

export interface LeaveRequestData {
  type: LeaveType | string;
  startDate: string;
  endDate: string;
  reason: string;
}
export interface LeaveRequest extends LeaveRequestData {
  id: string;
  status: "Chờ duyệt" | "Đã duyệt" | "Từ chối";
  employeeId: string;
  createdAt: string;
  employee?: {
    name: string;
    department: string;
  };
}

// ==========================================
// 3. AUTH & NOTIFICATION TYPES (Hệ thống)
// ==========================================
export interface LoginCredentials {
  employeeCode: string; 
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: string;
  department: string;
  employeeCode: string;
}

export interface Notification {
  id: string;
  sender: string;
  message: string;
  receiver: string;
  isRead: boolean;
  createdAt: string;
  taskId?: string;
}
export interface DocFolder {
  id: string;
  name: string;
  parentId: string | null; // null nghĩa là nằm ở thư mục gốc (ngoài cùng)
  createdAt?: string;
}

export interface DocFile {
  id: string;
  name: string;
  size: string; // VD: "2.4 MB" hoặc "800 KB"
  fileUrl?: string; // Đường dẫn thực tế để download file từ Server
  uploadedBy: string; // Lưu tên người tải lên
  createdAt: string;
  folderId: string | null; // Thuộc thư mục nào (null = gốc)
}

// Interface dùng để gửi data khi tạo thư mục mới lên API
export interface CreateFolderData {
  name: string;
  parentId: string | null;
}

export interface SalaryHistory {
  id: string;
  monthYear: string;
  baseSalary: number;
  totalBonus: number;
  totalDeduction: number;
  finalSalary: number;
  employee?: {
    id: string;
    name: string;
    employeeCode: string;
    department: string;
  };
  createdAt: string;
}
export interface CustomerDetailModalProps {
  show: boolean;
  onClose: () => void;
  task: Task | null;
  onUpdateCustomer?: (updatedTask: Task) => void;
  currentUser?: AuthUser | null;
}
export interface KPITask {
  id: string;
  name: string;
  target: string;
  actual: string;
  unit?: string;
  assignee?: string;
}

export interface DepartmentTemplate {
  id: string;
  name: string;
  goal: string;
  color: string;
  accent: string;
  tasks: KPITask[];
  weeklyReport?: string[];
}
export interface Requirement {
  id: string;
  section: string;
  name: string;
  note: string;
  required: boolean;
  templateUrl?: string; // <--- THÊM DÒNG NÀY (Dấu ? nghĩa là có thể có hoặc không)
}
export interface AttendanceRecord {
  date: string;
  inTime: string;
  outTime: string;
  status: AttendanceStatus;
  fine: number;
  halfDayDeduction?: number;  // ← thêm
}