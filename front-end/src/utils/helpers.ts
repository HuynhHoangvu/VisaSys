import { calculateLateFineForNextCheckIn } from "./payroll";

/** @deprecated import calculateLateFineForNextCheckIn from utils/payroll */
export const calculateLateFine = calculateLateFineForNextCheckIn;

/** Converts a byte count to a human-readable string (e.g. "2.4 MB"). */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k     = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/** Returns a 0–100 progress percentage given an actual value and a target string. */
export const getProgress = (actual: string, target: string): number => {
  const a      = parseFloat(actual.replace(/[^\d.]/g, "")) || 0;
  const tMatch = target.match(/(\d+)/);
  const t      = tMatch ? parseFloat(tMatch[1]) : 0;
  if (t === 0) return actual ? 100 : 0;
  return Math.min(Math.round((a / t) * 100), 100);
};

/** Formats an ISO date string as a relative time label (e.g. "5 phút trước"). */
export const formatUploadTime = (dateString: string): string => {
  const date      = new Date(dateString);
  const now       = new Date();
  const diffMs    = now.getTime() - date.getTime();
  const diffMins  = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays  = Math.floor(diffMs / 86_400_000);

  if (diffMins  < 1)  return "Vừa xong";
  if (diffMins  < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays  < 7)  return `${diffDays} ngày trước`;

  return (
    date.toLocaleDateString("vi-VN", { year: "numeric", month: "2-digit", day: "2-digit" }) +
    " " +
    date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  );
};
