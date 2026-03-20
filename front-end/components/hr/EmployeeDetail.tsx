import React, { useState } from "react";
import { Card, Avatar, Button, Modal, TextInput, Select } from "flowbite-react";
import {
  type Employee,
  type AuthUser,
  type LeaveRequestData,
} from "../../types";
import LeaveRequestModal from "./LeaveRequestModal";

// TODO: Đảm bảo bạn đã tạo file socket.ts và import đúng đường dẫn.
// Nếu bạn chưa dùng thư viện socket.io-client ở Frontend, bạn có thể comment dòng này lại.
import  socket  from "../../services/socket";

interface EmployeeDetailProps {
  employee: Employee;
  currentUser: AuthUser | null;
  onBack: () => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const formatVND = (amount: number): string => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

const EmployeeDetail: React.FC<EmployeeDetailProps> = ({
  employee,
  onBack,
  onCheckIn,
  onCheckOut,
  currentUser,
}) => {
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);

  const isDirector =
    currentUser?.role.toLowerCase().includes("giám đốc") ||
    currentUser?.role.toLowerCase().includes("admin") ||
    currentUser?.role.toLowerCase().includes("phó giám đốc");

  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusNote, setBonusNote] = useState("");
  const [bonusType, setBonusType] = useState("Thưởng");

  const todayStr = new Date().toLocaleDateString("vi-VN");
  const safeAttendanceRecords = employee.attendanceRecords || [];
  const safeSalesRecords = employee.salesRecords || [];

  const todayRecord = safeAttendanceRecords.find((r) => r.date === todayStr);
  const hasCheckedInToday = !!todayRecord;
  const hasCheckedOutToday =
    !!todayRecord?.outTime && todayRecord.outTime !== "-";

  // ==========================================
  // THUẬT TOÁN TÍNH LƯƠNG
  // ==========================================
  let totalBonusAndCommission = 0;
  let manualFines = 0;
  let salaryAdvances = 0;

  safeSalesRecords.forEach((record) => {
    const amount = Number(record.profit) || 0;
    const type = record.service;

    if (type === "Phạt") {
      manualFines += Math.abs(amount);
    } else if (type === "Tạm ứng") {
      salaryAdvances += Math.abs(amount);
    } else {
      totalBonusAndCommission += amount;
    }
  });

  const attendanceFines = safeAttendanceRecords.reduce(
    (sum, r) => sum + (r.fine || 0),
    0,
  );

  const halfDayDeductions = safeAttendanceRecords.reduce(
    (sum, r) => sum + (r.halfDayDeduction || 0),
    0,
  );

  const totalFines = manualFines + attendanceFines + halfDayDeductions;

  const originalBaseSalary = employee.baseSalary || 0;
  const currentBaseSalary = originalBaseSalary - salaryAdvances;
  const finalSalary = currentBaseSalary + totalBonusAndCommission - totalFines;

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleSubmitLeaveRequest = async (data: LeaveRequestData) => {
    try {
      const response = await fetch(
        `${API_URL}/api/hr/employees/${employee.id}/leave`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) throw new Error("Lỗi gửi đơn");

      alert("Đã gửi đơn xin nghỉ phép thành công! Vui lòng chờ Quản lý duyệt.");

      // 1. Đóng Modal sau khi gửi thành công
      setIsLeaveModalOpen(false);

      // 2. Kích hoạt Event cục bộ để Component Cha (nếu có) tự reload dữ liệu
      window.dispatchEvent(new Event("refreshBoard"));

      // 3. Kích hoạt Socket để bắn thông báo sang màn hình của Trưởng phòng/Admin (Nếu dùng Socket Frontend)
      if (socket) {
        socket.emit("data_changed");
      }
    } catch (error) {
      alert("Có lỗi xảy ra khi gửi đơn! " + error);
    }
  };

  const handleAddManualBonus = async () => {
    if (!bonusAmount || !bonusNote) return alert("Vui lòng nhập đủ thông tin!");

    let amount = Number(bonusAmount.replace(/\D/g, ""));
    if (bonusType === "Phạt" || bonusType === "Tạm ứng") {
      amount = -amount;
    }

    try {
      await fetch(`${API_URL}/api/hr/employees/${employee.id}/bonus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: "Điều chỉnh thủ công",
          service: bonusType,
          profit: amount,
          note: bonusNote,
        }),
      });

      setIsBonusModalOpen(false);
      setBonusAmount("");
      setBonusNote("");

      // Load lại giao diện
      window.dispatchEvent(new Event("refreshBoard"));
      if (socket) socket.emit("data_changed");

      alert("Đã cập nhật điều chỉnh thành công!");
    } catch (error) {
      alert("Lỗi khi cập nhật! " + error);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 bg-gray-50 h-full relative">
      <div
        className="flex items-center gap-1.5 sm:gap-2 text-gray-500 hover:text-orange-500 cursor-pointer font-medium w-fit transition-colors text-sm sm:text-base"
        onClick={onBack}
      >
        <svg
          className="w-4 h-4 sm:w-5 sm:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Quản lý nhân sự
      </div>

      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full xl:w-auto">
          <Avatar
            size="lg"
            rounded
            placeholderInitials={employee.name.charAt(0)}
            className="bg-orange-400 text-white shrink-0 hidden sm:block"
          />
          <Avatar
            size="md"
            rounded
            placeholderInitials={employee.name.charAt(0)}
            className="bg-orange-400 text-white shrink-0 sm:hidden"
          />
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">
              {employee.name}
            </h2>
            <div className="text-gray-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] sm:text-xs uppercase tracking-wide font-bold">
                {employee.role}
              </span>
              <span className="text-xs sm:text-sm whitespace-nowrap">
                • Lương CB:{" "}
                <strong className="text-gray-800">
                  {formatVND(originalBaseSalary)}
                </strong>
              </span>
              {salaryAdvances > 0 && (
                <span className="text-[10px] sm:text-xs text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100 whitespace-nowrap">
                  Tạm ứng: -{formatVND(salaryAdvances)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 w-full xl:w-auto flex-wrap sm:flex-nowrap">
          {isDirector && (
            <Button
              color="light"
              size="sm"
              onClick={() => setIsBonusModalOpen(true)}
              className="flex-1 sm:flex-none border-gray-200 text-indigo-600 font-bold focus:ring-0 shadow-sm hover:bg-indigo-50 whitespace-nowrap"
            >
              ✨ Thưởng/Phạt
            </Button>
          )}
          <Button
            color="light"
            size="sm"
            onClick={() => setIsLeaveModalOpen(true)}
            className="flex-1 sm:flex-none border-gray-200 text-gray-600 focus:ring-0 shadow-sm hover:bg-gray-50 whitespace-nowrap"
          >
            Nghỉ phép
          </Button>

          {/* NÚT CHECK-IN / CHECK-OUT */}
          {!hasCheckedInToday ? (
            <Button
              size="sm"
              className="w-full sm:w-auto bg-orange-400 hover:bg-orange-500 focus:ring-0 text-white shadow-md border-none"
              onClick={() => onCheckIn(employee.id)}
            >
              Check-in
            </Button>
          ) : !hasCheckedOutToday ? (
            <Button
              size="sm"
              className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 focus:ring-0 text-white shadow-md border-none"
              onClick={() => onCheckOut(employee.id)}
            >
              🕔 Check-out
            </Button>
          ) : (
            <Button
              color="success"
              size="sm"
              disabled
              className="w-full sm:w-auto focus:ring-0 cursor-not-allowed opacity-80 whitespace-nowrap"
            >
              ✅ Check-out {todayRecord?.outTime}
            </Button>
          )}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-l-[5px] border-l-blue-500 shadow-sm border-y-0 border-r-0 rounded-xl hover:shadow-md transition-shadow">
          <p className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wide">
            Lương Thực Nhận (Dự kiến)
          </p>
          <h4 className="text-xl sm:text-2xl font-black text-blue-600 mt-1">
            {formatVND(finalSalary)}
          </h4>
          <p className="text-[10px] sm:text-xs font-medium text-gray-400 mt-1">
            (Đã trừ tạm ứng + phạt)
          </p>
        </Card>

        <Card className="border-l-[5px] border-l-green-500 shadow-sm border-y-0 border-r-0 rounded-xl hover:shadow-md transition-shadow">
          <p className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wide">
            Tổng Hoa Hồng & Thưởng
          </p>
          <h4 className="text-xl sm:text-2xl font-black text-green-500 mt-1">
            +{formatVND(totalBonusAndCommission)}
          </h4>
        </Card>

        <Card className="border-l-[5px] border-l-red-500 shadow-sm border-y-0 border-r-0 rounded-xl hover:shadow-md transition-shadow relative pb-10 sm:pb-4">
          <p className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wide">
            Tổng Phạt & Khấu trừ
          </p>
          <h4 className="text-xl sm:text-2xl font-black text-red-500 mt-1">
            -{formatVND(totalFines)}
          </h4>
          <div className="absolute bottom-2 right-4 flex flex-col items-end text-[10px] sm:text-[11px] font-medium text-gray-400">
            <span>Đi muộn: -{formatVND(attendanceFines)}</span>
            <span>Về sớm/Quên CO: -{formatVND(halfDayDeductions)}</span>
            <span>Phạt khác: -{formatVND(manualFines)}</span>
          </div>
        </Card>
      </div>

      {/* BẢNG CHI TIẾT */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* BẢNG LỊCH SỬ CHẤM CÔNG */}
        <Card className="shadow-sm border border-gray-200 rounded-xl p-0 overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50/50">
            <h5 className="text-base sm:text-lg font-bold text-gray-800">
              Lịch sử Chấm công
            </h5>
          </div>
          <div className="overflow-x-auto max-h-[400px] custom-scrollbar w-full">
            <table className="w-full min-w-[600px] text-sm text-left text-gray-500">
              <thead className="text-[10px] sm:text-xs text-gray-700 uppercase border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 font-bold">Ngày</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 font-bold">
                    Giờ vào
                  </th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 font-bold">
                    Giờ ra
                  </th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 font-bold">
                    Trạng thái
                  </th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right font-bold">
                    Phạt CI
                  </th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right font-bold">
                    Trừ CO
                  </th>
                </tr>
              </thead>
              <tbody>
                {safeAttendanceRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-400 italic text-xs sm:text-sm"
                    >
                      Chưa có dữ liệu chấm công.
                    </td>
                  </tr>
                ) : (
                  safeAttendanceRecords.map((record, index) => {
                    const statusColor =
                      record.status === "Đúng giờ"
                        ? "bg-green-100 text-green-700"
                        : record.status === "Đi muộn"
                          ? "bg-yellow-100 text-yellow-700"
                          : record.status?.includes("Về sớm")
                            ? "bg-orange-100 text-orange-700"
                            : record.status === "Quên checkout"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600";

                    return (
                      <tr
                        key={index}
                        className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="px-3 sm:px-4 py-3 sm:py-4 font-bold text-gray-800 text-xs sm:text-sm">
                          {record.date}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 font-medium text-gray-600 text-xs sm:text-sm">
                          {record.inTime}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 font-medium text-gray-600 text-xs sm:text-sm">
                          {record.outTime && record.outTime !== "-"
                            ? record.outTime
                            : "—"}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4">
                          <span
                            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${statusColor}`}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td
                          className={`px-3 sm:px-4 py-3 sm:py-4 text-right font-bold text-xs sm:text-sm ${record.fine > 0 ? "text-red-500" : "text-gray-300"}`}
                        >
                          {record.fine > 0 ? `-${formatVND(record.fine)}` : "—"}
                        </td>
                        <td
                          className={`px-3 sm:px-4 py-3 sm:py-4 text-right font-bold text-xs sm:text-sm ${(record.halfDayDeduction || 0) > 0 ? "text-orange-500" : "text-gray-300"}`}
                        >
                          {(record.halfDayDeduction || 0) > 0
                            ? `-${formatVND(record.halfDayDeduction!)}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* BẢNG BIẾN ĐỘNG THU NHẬP */}
        <Card className="shadow-sm border border-gray-200 rounded-xl p-0 overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <h5 className="text-base sm:text-lg font-bold text-gray-800">
              Biến động thu nhập
            </h5>
          </div>
          <div className="overflow-x-auto max-h-[400px] custom-scrollbar w-full">
            <table className="w-full min-w-[500px] text-sm text-left text-gray-500">
              <thead className="text-[10px] sm:text-xs text-gray-700 uppercase border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 font-bold w-1/3">
                    Nguồn / Dịch vụ
                  </th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 font-bold w-1/3">
                    Ghi chú
                  </th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right font-bold">
                    Số tiền
                  </th>
                </tr>
              </thead>
              <tbody>
                {safeSalesRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-gray-400 italic text-xs sm:text-sm"
                    >
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                ) : (
                  safeSalesRecords.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <p className="font-bold text-gray-900 text-xs sm:text-sm">
                          {sale.customer}
                        </p>
                        <p className="text-[10px] sm:text-xs font-medium text-gray-500 mt-0.5">
                          {sale.service === "Tạm ứng" ? (
                            <span className="text-red-500 bg-red-50 px-1 py-0.5 rounded border border-red-100">
                              Tạm ứng lương
                            </span>
                          ) : (
                            sale.service
                          )}
                        </p>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 text-[10px] sm:text-xs italic text-gray-600">
                        {sale.note || "Hệ thống tự động ghi nhận"}
                      </td>
                      <td
                        className={`px-3 sm:px-4 py-3 sm:py-4 text-right font-bold text-xs sm:text-sm whitespace-nowrap ${sale.profit < 0 ? "text-red-500" : "text-green-600"}`}
                      >
                        {sale.profit > 0 ? "+" : "-"}
                        {formatVND(Math.abs(sale.profit))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* MODAL THƯỞNG/PHẠT */}
      <Modal
        show={isBonusModalOpen}
        onClose={() => setIsBonusModalOpen(false)}
        size="md"
        className="md:p-4"
      >
        <div className="p-4 sm:p-5 border-b border-gray-200 bg-indigo-50 rounded-t-lg">
          <h3 className="text-base sm:text-lg font-bold text-indigo-800">
            Điều chỉnh lương/thưởng thủ công
          </h3>
        </div>
        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
          <div>
            <label className="font-bold text-xs sm:text-sm text-gray-700">
              Loại điều chỉnh
            </label>
            <Select
              sizing="sm"
              value={bonusType}
              onChange={(e) => setBonusType(e.target.value)}
              className="mt-1 font-medium"
            >
              <option value="Thưởng">✨ Thưởng thêm</option>
              <option value="Phạt">📉 Trừ/Phạt tiền</option>
              <option value="Tạm ứng">💸 Tạm ứng lương</option>
            </Select>
          </div>
          <div>
            <label className="font-bold text-xs sm:text-sm text-gray-700">
              Số tiền (VNĐ)
            </label>
            <TextInput
              sizing="sm"
              type="text"
              placeholder="Ví dụ: 500000"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
              className="mt-1 font-bold"
            />
          </div>
          <div>
            <label className="font-bold text-xs sm:text-sm text-gray-700">
              Lý do / Ghi chú
            </label>
            <TextInput
              sizing="sm"
              placeholder="Ví dụ: Thưởng nóng..."
              value={bonusNote}
              onChange={(e) => setBonusNote(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div className="p-4 sm:p-5 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
          <Button
            size="sm"
            color="gray"
            onClick={() => setIsBonusModalOpen(false)}
          >
            Hủy
          </Button>
          <Button
            size="sm"
            style={{ backgroundColor: "#4f46e5" }}
            onClick={handleAddManualBonus}
          >
            Lưu điều chỉnh
          </Button>
        </div>
      </Modal>

      {/* MODAL NGHỈ PHÉP */}
      <LeaveRequestModal
        show={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        employeeName={employee.name}
        onSubmit={handleSubmitLeaveRequest}
      />
    </div>
  );
};

export default EmployeeDetail;
