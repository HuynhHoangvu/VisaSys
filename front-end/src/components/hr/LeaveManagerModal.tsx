import React from "react";
import { Modal, Badge } from "flowbite-react";
import type { LeaveRequest } from "../../types";

interface LeaveManagerModalProps {
  show: boolean;
  onClose: () => void;
  leaveRequests: LeaveRequest[];
  leaveMonthFilter: string;
  setLeaveMonthFilter: (v: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
}

const LeaveManagerModal: React.FC<LeaveManagerModalProps> = ({
  show,
  onClose,
  leaveRequests,
  leaveMonthFilter,
  setLeaveMonthFilter,
  onUpdateStatus,
}) => {
  const filtered = leaveMonthFilter
    ? leaveRequests.filter((r) => {
        const d = new Date(r.createdAt);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return ym === leaveMonthFilter;
      })
    : leaveRequests;

  return (
    <Modal show={show} onClose={onClose} size="6xl" className="md:p-4">
      <div className="p-4 sm:p-6 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3 bg-gray-50 rounded-t-lg">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
          📋 Danh sách Đơn xin nghỉ phép
        </h3>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
            Lọc tháng:
          </label>
          <input
            type="month"
            value={leaveMonthFilter}
            onChange={(e) => setLeaveMonthFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {leaveMonthFilter && (
            <button
              onClick={() => setLeaveMonthFilter("")}
              className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              Tất cả
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-900 bg-white hover:bg-gray-200 rounded-full p-1.5 transition-colors border"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-0 overflow-x-auto overflow-y-auto max-h-[70vh] custom-scrollbar w-full">
        <table className="w-full min-w-[900px] text-sm text-left text-gray-600">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 shadow-sm z-10">
            <tr>
              <th className="px-4 py-3 sm:py-4 font-bold whitespace-nowrap">Ngày nộp</th>
              <th className="px-4 py-3 sm:py-4 font-bold whitespace-nowrap">Nhân viên</th>
              <th className="px-4 py-3 sm:py-4 font-bold whitespace-nowrap">Loại phép</th>
              <th className="px-4 py-3 sm:py-4 font-bold whitespace-nowrap">Thời gian</th>
              <th className="px-4 py-3 sm:py-4 font-bold w-1/4">Lý do</th>
              <th className="px-4 py-3 sm:py-4 font-bold text-center whitespace-nowrap">Trạng thái</th>
              <th className="px-4 py-3 sm:py-4 font-bold text-right whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center italic text-gray-400">
                  {leaveMonthFilter
                    ? "Không có đơn nào trong tháng này."
                    : "Không có đơn xin nghỉ phép nào."}
                </td>
              </tr>
            ) : (
              filtered.map((req) => (
                <tr key={req.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 sm:py-4 font-medium text-gray-500 whitespace-nowrap">
                    {new Date(req.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 sm:py-4">
                    <p className="font-bold text-gray-900 whitespace-nowrap">{req.employee?.name}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">
                      {typeof req.employee?.department === "object"
                        ? (req.employee?.department as { name: string }).name
                        : req.employee?.department}
                    </p>
                  </td>
                  <td className="px-4 py-3 sm:py-4 font-bold text-blue-700 whitespace-nowrap">
                    {req.type}
                  </td>
                  <td className="px-4 py-3 sm:py-4 font-medium whitespace-nowrap">
                    <div className="text-gray-800 text-xs sm:text-sm">
                      Từ: {new Date(req.startDate).toLocaleDateString("vi-VN")}
                    </div>
                    <div className="text-gray-500 text-xs sm:text-sm">
                      Đến: {new Date(req.endDate).toLocaleDateString("vi-VN")}
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:py-4 text-[10px] sm:text-xs italic text-gray-600 min-w-[150px]">
                    {req.reason}
                  </td>
                  <td className="px-4 py-3 sm:py-4 text-center">
                    <Badge
                      color={
                        req.status === "Chờ duyệt"
                          ? "warning"
                          : req.status === "Đã duyệt"
                            ? "success"
                            : "failure"
                      }
                      className="mx-auto w-fit whitespace-nowrap px-2 py-0.5"
                    >
                      {req.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 sm:py-4 text-right">
                    {req.status === "Chờ duyệt" ? (
                      <div className="flex justify-end gap-1 sm:gap-2">
                        <button
                          onClick={() => onUpdateStatus(req.id, "Đã duyệt")}
                          className="px-2 py-1 sm:px-3 sm:py-1.5 bg-green-100 text-green-700 hover:bg-green-200 font-bold rounded-lg transition-colors text-[10px] sm:text-xs whitespace-nowrap"
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => onUpdateStatus(req.id, "Từ chối")}
                          className="px-2 py-1 sm:px-3 sm:py-1.5 bg-red-100 text-red-700 hover:bg-red-200 font-bold rounded-lg transition-colors text-[10px] sm:text-xs whitespace-nowrap"
                        >
                          Từ chối
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] sm:text-xs text-gray-400 font-medium whitespace-nowrap">
                        Đã xử lý
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};

export default LeaveManagerModal;
