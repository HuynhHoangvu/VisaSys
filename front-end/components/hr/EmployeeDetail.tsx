import React, { useState } from "react";
import { Card, Avatar, Button, Modal, TextInput, Select } from "flowbite-react";
import {
  type Employee,
  type AuthUser,
  type LeaveRequestData,
} from "../../types";
import LeaveRequestModal from "./LeaveRequestModal";

interface EmployeeDetailProps {
  employee: Employee;
  currentUser: AuthUser | null;
  onBack: () => void;
  onCheckIn: (id: string) => void;
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

  const hasCheckedInToday = safeAttendanceRecords.some(
    (r) => r.date === todayStr,
  );

  // ==========================================
  // THUẬT TOÁN TÍNH LƯƠNG
  // ==========================================
  let totalBonusAndCommission = 0;
  let manualFines = 0;
  let salaryAdvances = 0;

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
      // Chỗ này gọi lại fetchData() để cập nhật lại giao diện nếu cần
    } catch (error) {
      alert("Có lỗi xảy ra khi gửi đơn!" + error);
    }
  };
  // Chạy qua từng dòng giao dịch để phân loại chính xác
  safeSalesRecords.forEach((record) => {
    const amount = Number(record.profit) || 0; // Lấy số tiền
    const type = record.service; // "Thưởng", "Phạt", "Tạm ứng" hoặc "Tên visa..."

    if (type === "Phạt") {
      // Phạt thì nhét vào quỹ Phạt (Lấy trị tuyệt đối để luôn là số dương để dễ tính)
      manualFines += Math.abs(amount);
    } else if (type === "Tạm ứng") {
      // Tạm ứng thì nhét vào quỹ Tạm ứng
      salaryAdvances += Math.abs(amount);
    } else {
      // Còn lại (Hoa hồng, Thưởng) thì cộng dồn vào quỹ Thưởng
      // (Nếu vô tình data cũ lưu số âm thì nó sẽ tự kéo tiền xuống)
      totalBonusAndCommission += amount;
    }
  });

  // Tính phạt chấm công
  const attendanceFines = safeAttendanceRecords.reduce(
    (sum, r) => sum + (r.fine || 0),
    0,
  );

  // GỘP CÁC QUỸ LẠI ĐỂ RA SỐ CUỐI CÙNG
  const totalFines = manualFines + attendanceFines;

  const originalBaseSalary = employee.baseSalary || 0;
  const currentBaseSalary = originalBaseSalary - salaryAdvances; // Lương cơ bản sau khi trừ tạm ứng

  const finalSalary = currentBaseSalary + totalBonusAndCommission - totalFines;

  // ==========================================
  // XỬ LÝ SẾP THÊM KHOẢN THỦ CÔNG (API)
  // ==========================================
  const handleAddManualBonus = async () => {
    if (!bonusAmount || !bonusNote) return alert("Vui lòng nhập đủ thông tin!");

    let amount = Number(bonusAmount.replace(/\D/g, ""));
    if (bonusType === "Phạt" || bonusType === "Tạm ứng") {
      amount = -amount; // Phạt / Tạm ứng thì lưu xuống DB với số Âm
    }

    try {
      await fetch(
        `${API_URL}/api/hr/employees/${employee.id}/bonus`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: "Điều chỉnh thủ công",
            service: bonusType,
            profit: amount,
            note: bonusNote,
          }),
        },
      );

      setIsBonusModalOpen(false);
      setBonusAmount("");
      setBonusNote("");
      window.dispatchEvent(new Event("refreshBoard"));
      alert("Đã cập nhật điều chỉnh thành công!");
    } catch (error) {
      alert("Lỗi khi cập nhật! " + error);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-gray-50 h-full relative">
      <div
        className="flex items-center gap-2 text-gray-500 hover:text-orange-500 cursor-pointer font-medium w-fit transition-colors"
        onClick={onBack}
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
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Quản lý nhân sự
      </div>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            size="lg"
            rounded
            placeholderInitials={employee.name.charAt(0)}
            className="bg-orange-400 text-white"
          />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {employee.name}
            </h2>
            <div className="text-gray-500 font-medium mt-1 flex items-center gap-2">
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs uppercase tracking-wide font-bold">
                {employee.role}
              </span>
              <span>
                • Lương cơ bản:{" "}
                <strong className="text-gray-800">
                  {formatVND(originalBaseSalary)}
                </strong>
              </span>
              {salaryAdvances > 0 && (
                <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100">
                  Đã tạm ứng: -{formatVND(salaryAdvances)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          {isDirector && (
            <Button
              color="light"
              onClick={() => setIsBonusModalOpen(true)}
              className="border-gray-200 text-indigo-600 font-bold focus:ring-0 shadow-sm hover:bg-indigo-50"
            >
              ✨ Điều chỉnh Thưởng/Phạt
            </Button>
          )}
          <Button
            color="light"
            onClick={() => setIsLeaveModalOpen(true)}
            className="border-gray-200 text-gray-600 focus:ring-0 shadow-sm hover:bg-gray-50"
          >
            Nghỉ phép
          </Button>
          {hasCheckedInToday ? (
            <Button
              color="success"
              disabled
              className="focus:ring-0 cursor-not-allowed opacity-80"
            >
              ✅ Đã Check-in
            </Button>
          ) : (
            <Button
              className="bg-orange-400 hover:bg-orange-500 focus:ring-0 text-white shadow-md border-none"
              onClick={() => onCheckIn(employee.id)}
            >
              Check-in Hôm Nay
            </Button>
          )}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-l-[5px] border-l-blue-500 shadow-sm border-y-0 border-r-0 rounded-xl hover:shadow-md transition-shadow">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Lương Thực Nhận (Dự kiến)
          </p>
          <h4 className="text-2xl font-black text-blue-600 mt-1">
            {formatVND(finalSalary)}
          </h4>
          <p className="text-xs font-medium text-gray-400 mt-1">
            (Đã trừ tiền tạm ứng)
          </p>
        </Card>

        <Card className="border-l-[5px] border-l-green-500 shadow-sm border-y-0 border-r-0 rounded-xl hover:shadow-md transition-shadow">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Tổng Hoa Hồng & Thưởng
          </p>
          <h4 className="text-2xl font-black text-green-500 mt-1">
            +{formatVND(totalBonusAndCommission)}
          </h4>
        </Card>

        <Card className="border-l-[5px] border-l-red-500 shadow-sm border-y-0 border-r-0 rounded-xl hover:shadow-md transition-shadow relative">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Tổng Phạt & Khấu trừ
          </p>
          <h4 className="text-2xl font-black text-red-500 mt-1">
            -{formatVND(totalFines)}
          </h4>
          <div className="absolute bottom-2 right-4 flex flex-col items-end text-[11px] font-medium text-gray-400">
            <span>Đi muộn: -{formatVND(attendanceFines)}</span>
            <span>Phạt khác: -{formatVND(manualFines)}</span>
          </div>
        </Card>
      </div>

      {/* BẢNG CHI TIẾT */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* BẢNG LỊCH SỬ CHẤM CÔNG */}
        <Card className="shadow-sm border border-gray-200 rounded-xl p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50">
            <h5 className="text-lg font-bold text-gray-800">
              Lịch sử Chấm công
            </h5>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase border-b border-gray-200 bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-bold">Ngày</th>
                  <th className="px-4 py-3 font-bold">Giờ vào</th>
                  <th className="px-4 py-3 font-bold">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-bold">Phạt</th>
                </tr>
              </thead>
              <tbody>
                {safeAttendanceRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-gray-400 italic"
                    >
                      Chưa có dữ liệu chấm công.
                    </td>
                  </tr>
                ) : (
                  safeAttendanceRecords.map((record, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="px-4 py-4 font-bold text-gray-800">
                        {record.date}
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-600">
                        {record.inTime}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-wider ${record.status === "Đúng giờ" ? "bg-green-100 text-green-700" : record.status === "Đi muộn" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-4 text-right font-bold ${record.fine > 0 ? "text-red-500" : "text-gray-400"}`}
                      >
                        {record.fine > 0 ? `-${formatVND(record.fine)}` : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* BẢNG BIẾN ĐỘNG THU NHẬP */}
        <Card className="shadow-sm border border-gray-200 rounded-xl p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <h5 className="text-lg font-bold text-gray-800">
              Biến động thu nhập
            </h5>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase border-b border-gray-200 bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-bold">Nguồn / Dịch vụ</th>
                  <th className="px-4 py-3 font-bold w-1/3">Ghi chú</th>
                  <th className="px-4 py-3 text-right font-bold">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {safeSalesRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-gray-400 italic"
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
                      <td className="px-4 py-4">
                        <p className="font-bold text-gray-900">
                          {sale.customer}
                        </p>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">
                          {sale.service === "Tạm ứng" ? (
                            <span className="text-red-500 bg-red-50 px-1 py-0.5 rounded border border-red-100">
                              Tạm ứng lương
                            </span>
                          ) : (
                            sale.service
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-xs italic text-gray-600">
                        {sale.note || "Hệ thống tự động ghi nhận"}
                      </td>
                      <td
                        className={`px-4 py-4 text-right font-bold ${sale.profit < 0 ? "text-red-500" : "text-green-600"}`}
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

      {/* MODAL */}
      <Modal
        show={isBonusModalOpen}
        onClose={() => setIsBonusModalOpen(false)}
        size="md"
      >
        <div className="p-5 border-b border-gray-200 bg-indigo-50 rounded-t-lg">
          <h3 className="text-lg font-bold text-indigo-800">
            Điều chỉnh lương/thưởng thủ công
          </h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="font-bold text-sm text-gray-700">
              Loại điều chỉnh
            </label>
            <Select
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
            <label className="font-bold text-sm text-gray-700">
              Số tiền (VNĐ)
            </label>
            <TextInput
              type="text"
              placeholder="Ví dụ: 500000"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
              className="mt-1 font-bold"
            />
          </div>
          <div>
            <label className="font-bold text-sm text-gray-700">
              Lý do / Ghi chú
            </label>
            <TextInput
              placeholder="Ví dụ: Thưởng nóng chốt deal lớn..."
              value={bonusNote}
              onChange={(e) => setBonusNote(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div className="p-5 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
          <Button color="gray" onClick={() => setIsBonusModalOpen(false)}>
            Hủy
          </Button>
          <Button
            style={{ backgroundColor: "#4f46e5" }}
            onClick={handleAddManualBonus}
          >
            Lưu điều chỉnh
          </Button>
        </div>
      </Modal>

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
