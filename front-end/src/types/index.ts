// --- CRM & Kanban ---

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
  phone: string;
  email?: string;
  passportNumber?: string;
  assignedTo: string;
  columnId: string;
  processingColId?: string;
  source?:
    | "Facebook Ads" | "Facebook cá nhân"
    | "Tiktok Ads"   | "Tiktok cá nhân"
    | "Zalo" | "Website" | "Giới thiệu"
    | "Facebook" | "TikTok" | "Cá Nhân"; // legacy values kept for compatibility
  adCampaign?: string;
  createdAt: string;
  updatedAt?: string;
  price: string;
  visaType?: string;
  jobType?: string;
  description?: string;
  maritalStatus?: string;
  dependents?: number | string;
  priorityDate?: string;
  educationLevel?: string;
  englishScore?: string;
  workExperience?: string;
  activities?: Activity[];
  checklistType?: string;
  documents?: {
    [category: string]: { name: string; url: string; uploadedAt: string }[];
  };
  isUrgent?: boolean;
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

// --- HR ---

export interface Department {
  id: string;
  name: string;
}

export type AttendanceStatus =
  | "Đúng giờ" | "Đi muộn" | "Vắng không phép"
  | "Chưa Check-in" | "Về sớm" | "Đi muộn + Về Sớm" | "Quên checkout";

export interface AttendanceRecord {
  id?: string;
  date: string;
  inTime: string;
  outTime: string;
  status: AttendanceStatus;
  fine: number;
  halfDayDeduction?: number;
}

export interface SalesRecord {
  id: string;
  customer: string;
  service: string;
  profit: number;
  date: string;
  note?: string;
  createdAt?: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone?: string | null;
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
  phone?: string;
  password?: string;
  department: string;
  role: string;
  baseSalary: number;
}

export type LeaveType = "Xin phép nghỉ" | "Nửa ngày" | "Vô trễ" | "Về sớm" | "Nghỉ ốm" | "Nghỉ việc riêng";

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
  employee?: { name: string; department: string };
}

export interface SalaryHistory {
  id: string;
  monthYear: string;
  baseSalary: number;
  totalBonus: number;
  totalDeduction: number;
  finalSalary: number;
  hoaHong?: number;
  thuongKhac?: number;
  workDays?: number;
  workDates?: string[];
  employee?: { id: string; name: string; employeeCode: string; department: string };
  createdAt: string;
}

// --- Auth & Notifications ---

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

// --- Documents ---

export interface DocFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface DocFile {
  id: string;
  name: string;
  size: string;
  fileUrl?: string;
  cloudinaryPublicId?: string;
  uploadedBy: string;
  createdAt: string;
  folderId: string | null;
}

export interface CreateFolderData {
  name: string;
  parentId: string | null;
}

// --- KPI ---

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
  templateUrl?: string;
}

// --- UI / Layout ---

export interface CustomerDetailModalProps {
  show: boolean;
  onClose: () => void;
  task: Task | null;
  onUpdateCustomer?: (updatedTask: Task) => void;
  currentUser?: AuthUser | null;
}

export interface SidebarProps {
  currentUser: AuthUser;
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface Workspace {
  id: string;
  name: string;
  url?: string;
}
