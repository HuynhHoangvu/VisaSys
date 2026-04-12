import React, { useState } from "react";
import { Modal, Badge } from "flowbite-react";
import type { SalaryHistory } from "../../types";

export type EmployeeBreakdown = {
  name: string;
  employeeCode: string;
  role: string;
  hoaHong: number;
  tamUng: number;
  manualFines: number;
  attendanceFines: number;
  halfDayDeduction: number;
  fullDayAbsenceDeduction: number;
  totalBonus: number;
  finalSalary: number;
  workDays: number;
  workDates: string[];
};

interface SalaryHistoryModalProps {
  show: boolean;
  onClose: () => void;
  salaryHistories: SalaryHistory[];
  onDownloadSlip: (employeeId: string, monthYear: string, employeeName: string) => void;
  onDownloadExcel: (monthYear: string) => void;
}

const SalaryHistoryModal: React.FC<SalaryHistoryModalProps> = ({
  show,
  onClose,
  salaryHistories,
  onDownloadSlip,
  onDownloadExcel,
}) => {
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [breakdownData, setBreakdownData] = useState<Record<string, EmployeeBreakdown[]>>({});
  const [loadingBreakdown, setLoadingBreakdown] = useState<string | null>(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState<string | null>(null);
  const [expandedWorkDates, setExpandedWorkDates] = useState<Set<string>>(new Set());

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const toggleMonth = (monthYear: string) => {
    setExpandedMonths((prev) =>
      prev.includes(monthYear) ? prev.filter((m) => m !== monthYear) : [...prev, monthYear],
    );
  };

  const toggleWorkDates = (key: string) => {
    setExpandedWorkDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fetchBreakdown = async (monthYear: string) => {
    if (breakdownData[monthYear]) {
      setExpandedBreakdown(monthYear);
      return;
    }
    setLoadingBreakdown(monthYear);
    try {
      const res = await fetch(
        `${API_URL}/api/hr/salary/breakdown/${encodeURIComponent(monthYear)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setBreakdownData((prev) => ({ ...prev, [monthYear]: data }));
        setExpandedBreakdown(monthYear);
      }
    } catch (e) {
      console.error("Lỗi lấy breakdown:", e);
    } finally {
      setLoadingBreakdown(null);
    }
  };

  const grouped = salaryHistories.reduce(
    (acc, record) => {
      if (!acc[record.monthYear]) acc[record.monthYear] = [];
      acc[record.monthYear].push(record);
      return acc;
    },
    {} as Record<string, SalaryHistory[]>,
  );

  return (
    <Modal show={show} onClose={onClose} size="7xl" className="md:p-4">
      <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
          📊 Lịch sử chốt lương các tháng
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-900 bg-white hover:bg-gray-200 rounded-full p-1.5 transition-colors border"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-3 sm:p-6 bg-gray-100 overflow-y-auto max-h-[75vh]">
        {salaryHistories.length === 0 ? (
          <p className="text-center italic text-gray-400 py-8 bg-white rounded-lg shadow-sm text-sm">
            Chưa có dữ liệu chốt lương nào.
          </p>
        ) : (
          Object.entries(grouped).map(([monthYear, records]) => {
            const isExpanded = expandedMonths.includes(monthYear);
            return (
              <div
                key={monthYear}
                className="mb-3 sm:mb-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
              >
                <div
                  className="w-full flex justify-between items-center p-4 sm:p-5 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                  onClick={() => toggleMonth(monthYear)}
                >
                  <div className="font-bold text-base sm:text-lg text-blue-800 flex items-center gap-2">
                    📅 Lương Tháng {monthYear}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <Badge color="info" className="px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-semibold shadow-sm">
                      {records.length} nhân sự
                    </Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadExcel(monthYear);
                      }}
                      className="inline-flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                      title="Tải bảng lương tổng Excel"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Excel
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchBreakdown(monthYear);
                      }}
                      className="inline-flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                      title="Xem chi tiết thưởng/phạt"
                    >
                      {loadingBreakdown === monthYear ? "..." : "Chi tiết"}
                    </button>
                    <svg
                      className={`w-4 h-4 sm:w-5 sm:h-5 text-blue-600 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {expandedBreakdown === monthYear && breakdownData[monthYear] && (
                  <div className="overflow-x-auto custom-scrollbar border-t-2 border-purple-200 w-full bg-purple-50">
                    <div className="px-4 py-2 text-xs font-bold text-purple-700 uppercase tracking-wide">
                      Chi tiết thưởng / phạt tháng {monthYear}
                    </div>
                    <table className="w-full min-w-[900px] text-xs text-left text-gray-600">
                      <thead className="bg-purple-100 text-purple-800 uppercase">
                        <tr>
                          <th className="px-3 py-2 font-bold">Nhân viên</th>
                          <th className="px-3 py-2 font-bold text-center">Ngày đi làm</th>
                          <th className="px-3 py-2 font-bold text-green-700 text-right">Hoa hồng</th>
                          <th className="px-3 py-2 font-bold text-red-600 text-right">Tạm ứng</th>
                          <th className="px-3 py-2 font-bold text-red-600 text-right">Phạt (đơn nghỉ)</th>
                          <th className="px-3 py-2 font-bold text-red-600 text-right">Phạt đi trễ</th>
                          <th className="px-3 py-2 font-bold text-red-600 text-right">Nửa ngày</th>
                          <th className="px-3 py-2 font-bold text-red-600 text-right">Vắng cả ngày</th>
                          <th className="px-3 py-2 font-bold text-blue-700 text-right">Thực nhận</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100">
                        {breakdownData[monthYear].map((emp, i) => {
                          const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
                          const dateKey = `${monthYear}-${emp.employeeCode}`;
                          const showDates = expandedWorkDates.has(dateKey);
                          return (
                            <React.Fragment key={i}>
                              <tr className={i % 2 === 0 ? "bg-white" : "bg-purple-50"}>
                                <td className="px-3 py-2 font-medium">{emp.name}</td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => toggleWorkDates(dateKey)}
                                    className="text-xs font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2 py-0.5 rounded-full transition-colors shadow-sm"
                                  >
                                    {emp.workDays || 0} ngày {showDates ? "▲" : "▼"}
                                  </button>
                                </td>
                                <td className="px-3 py-2 text-right text-green-700">
                                  {emp.hoaHong ? `+${fmt(emp.hoaHong)}` : "-"}
                                </td>
                                <td className="px-3 py-2 text-right text-red-600">
                                  {emp.tamUng ? `-${fmt(emp.tamUng)}` : "-"}
                                </td>
                                <td className="px-3 py-2 text-right text-red-600">
                                  {emp.manualFines ? `-${fmt(emp.manualFines)}` : "-"}
                                </td>
                                <td className="px-3 py-2 text-right text-red-600">
                                  {emp.attendanceFines ? `-${fmt(emp.attendanceFines)}` : "-"}
                                </td>
                                <td className="px-3 py-2 text-right text-red-600">
                                  {emp.halfDayDeduction ? `-${fmt(emp.halfDayDeduction)}` : "-"}
                                </td>
                                <td className="px-3 py-2 text-right text-red-600">
                                  {emp.fullDayAbsenceDeduction ? `-${fmt(emp.fullDayAbsenceDeduction)}` : "-"}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-blue-700">
                                  {fmt(emp.finalSalary)}đ
                                </td>
                              </tr>
                              {showDates && emp.workDates?.length > 0 && (
                                <tr className="bg-purple-50/50">
                                  <td colSpan={9} className="px-4 py-2 border-b border-purple-100">
                                    <div className="flex flex-wrap gap-1.5">
                                      <span className="text-xs font-semibold text-gray-500 mr-2 flex items-center">
                                        Lịch sử Check-out:
                                      </span>
                                      {emp.workDates.map((d, di) => (
                                        <span
                                          key={di}
                                          className="text-xs font-medium bg-white border border-purple-200 text-purple-700 px-2 py-0.5 rounded shadow-sm"
                                        >
                                          {d}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {isExpanded && (
                  <div className="overflow-x-auto custom-scrollbar border-t border-blue-100 w-full">
                    <table className="w-full min-w-[700px] text-sm text-left text-gray-600">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold w-20">Mã NV</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold">Nhân viên</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-right">Lương CB</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-right text-green-600">Thưởng / HH</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-right text-red-600">Phạt / Trừ</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-right text-blue-700">Thực nhận</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-center w-24">Phiếu lương</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {records.map((record, idx) => (
                          <tr key={idx} className="bg-white hover:bg-gray-50 transition-colors">
                            <td className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-gray-900">
                              {record.employee?.employeeCode}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-gray-800">
                              {record.employee?.name || "Đã xóa NV"}
                              <p className="text-xs font-normal text-gray-500 mt-0.5">
                                {typeof record.employee?.department === "object"
                                  ? (record.employee?.department as { name: string }).name
                                  : record.employee?.department}
                              </p>
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-medium">
                              {new Intl.NumberFormat("vi-VN").format(record.baseSalary)}đ
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-right text-green-600 font-bold">
                              +{new Intl.NumberFormat("vi-VN").format(record.totalBonus)}đ
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-right text-red-600 font-bold">
                              -{new Intl.NumberFormat("vi-VN").format(record.totalDeduction)}đ
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-blue-700 text-sm sm:text-base">
                              {new Intl.NumberFormat("vi-VN").format(record.finalSalary)}đ
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-center">
                              <button
                                onClick={() =>
                                  onDownloadSlip(
                                    record.employee?.id ?? "",
                                    record.monthYear,
                                    record.employee?.name ?? "NhanVien",
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors border border-blue-200"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                        <tr>
                          <td colSpan={5} className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-gray-700 uppercase tracking-wide text-xs sm:text-sm">
                            TỔNG LƯƠNG TRẢ TRONG THÁNG:
                          </td>
                          <td colSpan={2} className="px-4 sm:px-6 py-3 sm:py-4 text-left font-black text-blue-800 text-base sm:text-lg">
                            {new Intl.NumberFormat("vi-VN").format(
                              records.reduce((sum, r) => sum + r.finalSalary, 0),
                            )}đ
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
};

export default SalaryHistoryModal;
