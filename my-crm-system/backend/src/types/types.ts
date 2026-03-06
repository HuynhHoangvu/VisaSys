// frontend/src/types/index.ts
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
  passportNumber?: string;
  maritalStatus?: string;
  dependents?: number;
  priorityDate?: string;
  educationLevel?: string;
  englishScore?: string;
  workExperience?: string;
  createdAt?: string;
  jobType?: string;
  checklistType?: string;
  documents?: { [key: string]: string[] };
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

// HR Types
export type AttendanceStatus = "Đúng giờ" | "Đi muộn" | "Vắng không phép" | "Chưa Check-in";

export interface AttendanceRecord {
  id?: string;
  date: string;
  inTime: string;
  outTime: string;
  status: AttendanceStatus;
  fine: number;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  role: string;
  baseSalary: number;
  commissionRate: number;
  todayStatus: AttendanceStatus;
  attendanceRecords: AttendanceRecord[];
}

// Auth Types
export interface AuthUser {
  id: string;
  name: string;
  role: string;
  department: string;
  employeeCode: string;
}

// Notification Types
export interface Notification {
  id: string;
  sender: string;
  message: string;
  receiver: string;
  isRead: boolean;
  createdAt: string;
}