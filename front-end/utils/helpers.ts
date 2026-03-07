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