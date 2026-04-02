import type { AttendanceRecord } from "../types";
export const calculateLateFine = (
  attendanceRecords: AttendanceRecord[],
  currentDate: Date,
): number => {
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Lọc ra các lần đi muộn trong THÁNG HIỆN TẠI
  const lateRecordsThisMonth = attendanceRecords.filter((record) => {
    // Tách chuỗi "dd/mm/yyyy" thành mảng [dd, mm, yyyy]
    const parts = record.date.split("/");
    if (parts.length !== 3) return false;

    const recordMonth = parseInt(parts[1]) - 1; // Tháng trong JS bắt đầu từ 0
    const recordYear = parseInt(parts[2]);

    return (
      record.status === "Đi muộn" &&
      recordMonth === currentMonth &&
      recordYear === currentYear
    );
  });

  const lateCount = lateRecordsThisMonth.length + 1; 

  if (lateCount === 1) return 50000;
  if (lateCount === 2) return 100000;
  return 300000; 
};
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  // Tìm lũy thừa của 1024 để biết là KB, MB hay GB
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // Format lấy 2 số thập phân
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
export const getProgress = (actual: string, target: string): number => {
  const a = parseFloat(actual.replace(/[^\d.]/g, "")) || 0;
  const tMatch = target.match(/(\d+)/);
  const t = tMatch ? parseFloat(tMatch[1]) : 0;
  if (t === 0) return actual ? 100 : 0;
  return Math.min(Math.round((a / t) * 100), 100);
};

export const formatUploadTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  
  return date.toLocaleDateString("vi-VN", { 
    year: "numeric", 
    month: "2-digit", 
    day: "2-digit" 
  }) + " " + date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
};