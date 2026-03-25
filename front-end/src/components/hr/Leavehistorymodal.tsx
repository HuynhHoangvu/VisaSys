import React, { useEffect, useState, useCallback } from "react";
import { Modal, Badge } from "flowbite-react";

interface LeaveRecord {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "Chờ duyệt" | "Đã duyệt" | "Từ chối";
}

interface LeaveHistoryModalProps {
  show: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const statusConfig: Record<
  LeaveRecord["status"],
  { color: "warning" | "success" | "failure" | "gray"; label: string; icon: string }
> = {
  "Chờ duyệt": { color: "warning", label: "Chờ duyệt", icon: "🕐" },
  "Đã duyệt": { color: "success", label: "Đã duyệt", icon: "✅" },
  "Từ chối": { color: "failure", label: "Từ chối", icon: "❌" },
};

const LeaveHistoryModal: React.FC<LeaveHistoryModalProps> = ({
  show,
  onClose,
  employeeId,
  employeeName,
}) => {
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Tách logic fetch thành async function riêng, gọi trong useEffect
  const fetchLeaveHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/hr/employees/${employeeId}/leave`,
      );
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (!show) return;
    // Gọi async function bên trong effect, không gọi setState trực tiếp
    fetchLeaveHistory();
  }, [show, fetchLeaveHistory]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("vi-VN");
  };

  return (
    <Modal show={show} onClose={onClose} size="4xl" className="md:p-4">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-200 flex justify-between items-center bg-blue-50 rounded-t-lg">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-blue-900">
            📋 Lịch sử xin phép
          </h3>
          <p className="text-xs sm:text-sm text-blue-600 mt-0.5">
            Nhân viên: <strong>{employeeName}</strong>
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-900 bg-gray-200 hover:bg-gray-300 rounded-full p-1.5 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5 overflow-y-auto max-h-[65vh]">
        {loading ? (
          <div className="flex justify-center items-center py-16 text-gray-400">
            <svg
              className="animate-spin w-6 h-6 mr-2"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            Đang tải dữ liệu...
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-5xl mb-3">📭</span>
            <p className="text-sm font-medium">Chưa có đơn xin phép nào.</p>
          </div>
        ) : (
          <>
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(
                ["Chờ duyệt", "Đã duyệt", "Từ chối"] as LeaveRecord["status"][]
              ).map((s) => {
                const count = records.filter((r) => r.status === s).length;
                if (count === 0) return null;
                const cfg = statusConfig[s];
                return (
                  <Badge
                    key={s}
                    color={cfg.color}
                    className="text-xs font-bold px-2 py-1"
                  >
                    {cfg.icon} {cfg.label}: {count}
                  </Badge>
                );
              })}
              <Badge
                color="indigo"
                className="text-xs font-bold px-2 py-1 ml-auto"
              >
                Tổng: {records.length} đơn
              </Badge>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-155 text-sm text-left text-gray-600">
                <thead className="text-2xs sm:text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 font-bold w-8 text-center">#</th>
                    <th className="px-4 py-3 font-bold">Loại nghỉ phép</th>
                    <th className="px-4 py-3 font-bold">Từ ngày</th>
                    <th className="px-4 py-3 font-bold">Đến ngày</th>
                    <th className="px-4 py-3 font-bold">Lý do</th>
                    <th className="px-4 py-3 font-bold text-center">
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => {
                    const cfg = statusConfig[record.status] ?? {
                      color: "gray" as const,
                      label: record.status,
                      icon: "❓",
                    };
                    return (
                      <tr
                        key={record.id ?? index}
                        className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-center text-gray-400 font-medium text-xs">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-800 text-xs sm:text-sm">
                          {record.type}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700 text-xs sm:text-sm whitespace-nowrap">
                          {formatDate(record.startDate)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700 text-xs sm:text-sm whitespace-nowrap">
                          {formatDate(record.endDate)}
                        </td>
                        <td className="px-4 py-3 text-xs sm:text-sm text-gray-600 max-w-55">
                          <p className="line-clamp-2 italic">{record.reason}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            color={cfg.color}
                            className="inline-flex items-center gap-1 text-2xs sm:text-xs font-bold px-2 py-1 whitespace-nowrap"
                          >
                            {cfg.icon} {cfg.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 flex justify-end bg-gray-50 rounded-b-lg">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Đóng
        </button>
      </div>
    </Modal>
  );
};

export default LeaveHistoryModal;
