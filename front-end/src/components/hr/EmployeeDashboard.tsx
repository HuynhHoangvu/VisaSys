import React, { useState, useEffect, useCallback } from "react";
import { Card, Badge, Button } from "flowbite-react";
import EmployeeModal from "./EmployeeModal";
import { FaceAvatar } from "../ui/FaceAvatar";
import EmployeeDetail from "./EmployeeDetail";
import DepartmentModal from "./DepartmentModal";
import SalaryHistoryModal from "./SalaryHistoryModal";
import FinalizeSalaryModal from "./FinalizeSalaryModal";
import LeaveManagerModal from "./LeaveManagerModal";
import {
  type Employee,
  type Department,
  type AttendanceStatus,
  type NewEmployeeData,
  type AttendanceRecord,
  type AuthUser,
  type SalaryHistory,
  type LeaveRequest,
} from "../../types";
import {
  getVNWallClockMinutes,
  HALF_DAY_SPLIT_MINUTES,
} from "../../utils/payroll";
import socket from "../../services/socket";
import { hasPermission, P } from "../../utils/access";
import { canManageOthersAttendanceByRole, isAdminLikeForHr } from "../../utils/hrRoles";
import {
  mergeCatalogWithInUseNames,
  normalizeDeptKey,
  isInferredDepartmentId,
} from "../../utils/hrDepartments";
import { API_URL } from "../../constants/config";

const hrFetch = (input: string, init?: RequestInit) =>
  fetch(input, { credentials: "include", ...init });

const getStatusColor = (status: AttendanceStatus): string => {
  switch (status) {
    case "Đúng giờ":
      return "success";
    case "Đi muộn":
      return "warning";
    case "Vắng không phép":
      return "failure";
    case "Nửa ngày chiều":
    case "Nửa ngày sáng":
      return "indigo";
    default:
      return "gray";
  }
};

interface EmployeeDashboardProps {
  currentUser: AuthUser | null;
}




const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({
  currentUser,
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [newDeptName, setNewDeptName] = useState("");
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");

  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeMonth, setFinalizeMonth] = useState(() => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const m = String(lastMonth.getMonth() + 1).padStart(2, "0");
    return `${m}/${lastMonth.getFullYear()}`;
  });

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [salaryHistories, setSalaryHistories] = useState<SalaryHistory[]>([]);

  const [showLeaveManagerModal, setShowLeaveManagerModal] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveMonthFilter, setLeaveMonthFilter] = useState<string>(() =>
    new Date().toISOString().slice(0, 7),
  );

  // Bulk leave modal state
  const [showBulkLeaveModal, setShowBulkLeaveModal] = useState(false);
  const [bulkLeaveType, setBulkLeaveType] = useState<"Nghỉ không lương" | "Nghỉ có lương">("Nghỉ có lương");
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkEndDate, setBulkEndDate] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [isSubmittingBulkLeave, setIsSubmittingBulkLeave] = useState(false);

  // Fetch leave requests
  const fetchLeaveRequests = useCallback(async () => {
    try {
      const res = await hrFetch(`${API_URL}/api/hr/leave-requests`);
      const data = await res.json();
      setLeaveRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lỗi khi tải đơn nghỉ phép:", error);
    }
  }, []);

  // Handle bulk leave submit
  const handleBulkLeaveSubmit = async () => {
    if (!bulkStartDate || !bulkEndDate || !bulkReason) {
      return alert("Vui lòng điền đầy đủ thông tin!");
    }
    if (new Date(bulkEndDate) < new Date(bulkStartDate)) {
      return alert("Ngày kết thúc không được nhỏ hơn ngày bắt đầu!");
    }
    if (!window.confirm(`Bạn có chắc muốn tạo đơn nghỉ đồng loạt cho TẤT CẢ nhân viên từ ${bulkStartDate} đến ${bulkEndDate}?`)) {
      return;
    }
    setIsSubmittingBulkLeave(true);
    try {
      const res = await hrFetch(`${API_URL}/api/hr/leave-requests/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: bulkLeaveType,
          startDate: bulkStartDate,
          endDate: bulkEndDate,
          reason: bulkReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi không xác định");
      alert(data.message || "Tạo đơn nghỉ đồng loạt thành công!");
      setShowBulkLeaveModal(false);
      setBulkStartDate("");
      setBulkEndDate("");
      setBulkReason("");
      fetchData();
    } catch (error) {
      alert("Lỗi: " + error);
    } finally {
      setIsSubmittingBulkLeave(false);
    }
  };

  // Handle update leave status
  const handleUpdateLeaveStatus = async (id: string, status: string) => {
    try {
      const res = await hrFetch(`${API_URL}/api/hr/leave-requests/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Lỗi khi cập nhật trạng thái");
      }
      fetchLeaveRequests();
    } catch (error) {
      alert("Lỗi: " + error);
    }
  };

  const isBoss = isAdminLikeForHr(currentUser);
  const isAdmin = isBoss;
  const isManager =
    !!currentUser &&
    (currentUser.role?.toLowerCase().includes("quản lý") ||
      currentUser.role?.toLowerCase().includes("trưởng phòng"));

  /** Giám đốc / Phó / admin + Trưởng phòng / Quản lý — chấm công thay người khác & xem cả danh sách. */
  const canManageOthersAttendance = canManageOthersAttendanceByRole(currentUser);

  const canAddPersonnel =
    !!currentUser &&
    (hasPermission(currentUser, P.hrWrite) ||
      isAdmin ||
      isManager ||
      isBoss);
  const canDeletePersonnel =
    !!currentUser &&
    (hasPermission(currentUser, P.hrDeleteEmployee) || isAdmin || isBoss);

  const fetchData = useCallback(async () => {
    try {
      const [empRes, deptRes] = await Promise.all([
        hrFetch(`${API_URL}/api/hr/employees`),
        hrFetch(`${API_URL}/api/hr/departments`),
      ]);
      const empJson: unknown = await empRes.json();
      const deptJson: unknown = await deptRes.json();
      if (!empRes.ok) {
        console.error("GET /api/hr/employees:", empRes.status, empJson);
      }
      if (!deptRes.ok) {
        console.error("GET /api/hr/departments:", deptRes.status, deptJson);
      }
      setEmployees(Array.isArray(empJson) ? empJson : []);
      setDepartments(Array.isArray(deptJson) ? deptJson : []);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    socket.on("data_changed", fetchData);
    window.addEventListener("refreshBoard", fetchData);
    return () => {
      socket.off("data_changed", fetchData);
      window.removeEventListener("refreshBoard", fetchData);
    };
  }, [fetchData]);

  const handleSubmitEmployee = async (empData: NewEmployeeData) => {
    if (!canAddPersonnel)
      return alert("Bạn không có quyền thực hiện thao tác này!");
    try {
      const url = employeeToEdit
        ? `${API_URL}/api/hr/employees/${employeeToEdit.id}`
        : `${API_URL}/api/hr/employees`;
      const method = employeeToEdit ? "PUT" : "POST";
      const response = await hrFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Email có thể đã bị trùng!");
      }
      fetchData();
      setIsAddEmpModalOpen(false);
      setEmployeeToEdit(null);
      alert(
        employeeToEdit
          ? "Cập nhật nhân sự thành công!"
          : "Thêm nhân sự thành công!",
      );
    } catch (error) {
      alert("Lỗi! " + error);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!canDeletePersonnel)
      return alert("Chỉ Giám đốc/Admin mới có quyền xóa nhân sự!");
    if (window.confirm("Bạn có chắc chắn muốn xóa nhân viên này?")) {
      try {
        await hrFetch(`${API_URL}/api/hr/employees/${id}`, { method: "DELETE" });
        fetchData();
      } catch (error) {
        alert("Lỗi khi xóa nhân viên!" + error);
      }
    }
  };

  const handleCheckIn = async (empId: string) => {
    if (!canManageOthersAttendance && currentUser?.id !== empId) {
      return alert("Bạn chỉ có thể tự chấm công cho chính mình!");
    }
    const targetEmployee = employees.find((e) => e.id === empId);
    if (!targetEmployee) return;
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const todayStr = now.toLocaleDateString("vi-VN");
    if (targetEmployee.attendanceRecords.some((r) => r.date === todayStr)) {
      alert("Hôm nay nhân viên này đã check-in rồi!");
      return;
    }
    const vnMins = getVNWallClockMinutes(now);

    let status: AttendanceStatus;
    const fine = 0;
    const halfDayDeduction = 0;

    if (vnMins > HALF_DAY_SPLIT_MINUTES) {
      status = "Nửa ngày chiều";
    } else {
      const isLate = vnMins > 520;
      status = isLate ? "Đi muộn" : "Đúng giờ";
    }

    const newRecord = {
      date: todayStr,
      inTime: currentTimeStr,
      outTime: "-",
      status,
      fine,
      halfDayDeduction,
    };
    try {
      const res = await hrFetch(`${API_URL}/api/hr/employees/${empId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord),
      });
      const saved = (await res.json().catch(() => ({}))) as AttendanceRecord & { error?: string };
      if (!res.ok) {
        return alert(saved.error || "Lỗi lưu chấm công!");
      }

      if ((saved.halfDayDeduction || 0) > 0) {
        alert(
          `Check-in sau 12h trưa — làm nửa buổi chiều.\nGiờ vào: ${saved.inTime || currentTimeStr}\nTrừ nửa ngày lương: ${new Intl.NumberFormat("vi-VN").format(saved.halfDayDeduction || 0)}đ`,
        );
      } else if ((saved.fine || 0) > 0) {
        alert(
          `Đã đi muộn!\nGiờ check-in: ${saved.inTime || currentTimeStr}\nBị phạt: ${new Intl.NumberFormat("vi-VN").format(saved.fine || 0)}đ`,
        );
      } else if (String(saved.status || "").includes("(có phép)")) {
        alert(
          `Check-in thành công lúc ${saved.inTime || currentTimeStr}.\nĐơn ${String(saved.status || "").includes("Vô trễ") ? "Vô trễ" : "xin phép"} đã duyệt nên không bị trừ tiền.`,
        );
      } else {
        alert(`Check-in thành công!\nGiờ Check-in: ${saved.inTime || currentTimeStr}`);
      }
      fetchData();
    } catch (error) {
      console.error("Lỗi lưu chấm công:", error);
    }
  };

  const handleCheckOut = async (empId: string) => {
    if (!canManageOthersAttendance && currentUser?.id !== empId) {
      return alert("Bạn chỉ có thể tự check-out cho chính mình!");
    }
    const targetEmployee = employees.find((e) => e.id === empId);
    if (!targetEmployee) return;
    const todayStr = new Date().toLocaleDateString("vi-VN");
    const todayRecord = targetEmployee.attendanceRecords.find(
      (r) => r.date === todayStr,
    );
    if (!todayRecord) return alert("Chưa check-in hôm nay!");
    if (todayRecord.outTime && todayRecord.outTime !== "-")
      return alert("Đã check-out rồi!");

    const confirmed = window.confirm(
      `Xác nhận check-out cho ${targetEmployee.name}?\n\nThao tác này không thể hoàn tác.`,
    );
    if (!confirmed) return;

    try {
      const res = await hrFetch(`${API_URL}/api/hr/employees/${empId}/checkout`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error);
      if (data.isEarlyLeave) {
        if (data.hasLeaveApproval) {
          alert(
            `Check-out lúc ${data.outTime} (về sớm có phép).\nĐơn Về sớm đã duyệt nên không bị trừ tiền.`,
          );
        } else if (data.additionalHalfDayApplied) {
          alert(
            `Check-out lúc ${data.outTime}.\nKhấu trừ thêm nửa ngày lương: ${new Intl.NumberFormat("vi-VN").format(data.halfDayDeduction)}đ`,
          );
        } else {
          alert(
            `Check-out lúc ${data.outTime} (về sớm).\nKhông trừ thêm nửa ngày — đã có khấu trừ nửa ngày khi vào làm sau 12h trưa, hoặc đã ghi nhận trước đó.`,
          );
        }
      } else {
        alert(`Check-out thành công lúc ${data.outTime} ✅`);
      }
      fetchData();
    } catch (error) {
      alert("Lỗi check-out: " + error);
    }
  };

  const handleAddDepartment = async () => {
    if (!canAddPersonnel || !newDeptName.trim()) return;
    try {
      await hrFetch(`${API_URL}/api/hr/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeptName.trim() }),
      });
      setNewDeptName("");
      fetchData();
    } catch (error) {
      alert("Lỗi khi thêm bộ phận!" + error);
    }
  };

  const handleUpdateDepartment = async (id: string) => {
    if (isInferredDepartmentId(id)) {
      alert(
        "Tên này chỉ xuất hiện trên hồ sơ nhân viên (chưa có bản ghi trong danh mục). Hãy bấm «Thêm» để tạo bộ phận cùng tên, hoặc «Sửa» nhân viên để gán đúng bộ phận trong danh mục.",
      );
      return;
    }
    if (!canAddPersonnel || !editDeptName.trim()) return;
    try {
      await hrFetch(`${API_URL}/api/hr/departments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editDeptName.trim() }),
      });
      setEditingDeptId(null);
      fetchData();
    } catch (error) {
      alert("Lỗi khi cập nhật bộ phận!" + error);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (isInferredDepartmentId(id)) {
      alert(
        "Không thể xóa dòng này — đó là tên đang gán trên nhân viên nhưng chưa có trong danh mục bộ phận. Thêm bộ phận trùng tên hoặc sửa nhân viên để gán lại.",
      );
      return;
    }
    if (!canDeletePersonnel)
      return alert("Chỉ Giám đốc mới có quyền xóa phòng ban!");
    if (
      window.confirm(
        "Xóa bộ phận này? Các nhân viên thuộc bộ phận này sẽ chuyển sang Chưa phân bổ.",
      )
    ) {
      try {
        await hrFetch(`${API_URL}/api/hr/departments/${id}`, {
          method: "DELETE",
        });
        fetchData();
      } catch (error) {
        alert("Lỗi khi xóa bộ phận!" + error);
      }
    }
  };

  const fetchSalaryHistory = async () => {
    try {
      const res = await hrFetch(`${API_URL}/api/hr/salary/history`);
      if (res.ok) setSalaryHistories(await res.json());
    } catch (error) {
      console.error("Lỗi lấy lịch sử lương", error);
    }
  };

  const handleFinalizeSalary = async () => {
    if (!finalizeMonth.trim()) return alert("Vui lòng nhập tháng chốt lương!");
    setIsFinalizing(true);
    try {
      const response = await hrFetch(`${API_URL}/api/hr/salary/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthYear: finalizeMonth }),
      });
      if (!response.ok) throw new Error("Lỗi khi chốt lương");
      alert(`Đã chốt lương tháng ${finalizeMonth} thành công!`);
      setShowFinalizeModal(false);
      fetchData();
      await fetchSalaryHistory();
      setShowHistoryModal(true);
    } catch (error) {
      alert("Đã xảy ra lỗi hệ thống khi chốt lương!" + error);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDownloadSlip = async (
    employeeId: string,
    monthYear: string,
    employeeName: string,
  ) => {
    try {
      const res = await hrFetch(
        `${API_URL}/api/hr/salary/slip/${employeeId}/${encodeURIComponent(monthYear)}`,
      );
      if (!res.ok) throw new Error("Lỗi tải phiếu lương");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `PhieuLuong_${employeeName}_${monthYear.replace("/", "_")}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      alert("Lỗi tải phiếu lương: " + error);
    }
  };

  const handleDownloadSummaryExcel = async (monthYear: string) => {
    try {
      const res = await hrFetch(
        `${API_URL}/api/hr/salary/summary-excel/${encodeURIComponent(monthYear)}`,
      );
      if (!res.ok) throw new Error("Lỗi tải bảng lương tổng Excel");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `BangLuong_${monthYear.replace("/", "_")}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      alert("Lỗi tải bảng lương tổng Excel: " + error);
    }
  };

  if (selectedEmpId) {
    const employee = employees.find((e) => e.id === selectedEmpId);
    if (!employee) return null;
    return (
      <EmployeeDetail
        employee={employee}
        onBack={() => setSelectedEmpId(null)}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        currentUser={currentUser}
      />
    );
  }

  const departmentBoard = mergeCatalogWithInUseNames(departments, employees);

  let filteredDepartments = departmentBoard;
  let filteredEmployees = employees;

  const canViewAll = hasPermission(currentUser, P.hrRead);

  if (!canViewAll && currentUser) {
    filteredEmployees = employees.filter((e) => e.id === currentUser.id);
    filteredDepartments = departmentBoard.filter(
      (d) =>
        normalizeDeptKey(d.name) ===
        normalizeDeptKey(currentUser.department ?? ""),
    );
  }

  const groupedEmployees = filteredDepartments
    .map((dept) => ({
      departmentName: dept.name,
      employees: filteredEmployees.filter(
        (emp) =>
          normalizeDeptKey(emp.department) === normalizeDeptKey(dept.name),
      ),
    }))
    .filter((group) => group.employees.length > 0);

  const unassignedEmployees = filteredEmployees.filter(
    (emp) =>
      !filteredDepartments.some(
        (d) =>
          normalizeDeptKey(d.name) === normalizeDeptKey(emp.department),
      ),
  );
  if (
    unassignedEmployees.length > 0 &&
    (canViewAll ||
      unassignedEmployees.some((e) => e.id === currentUser?.id))
  ) {
    groupedEmployees.push({
      departmentName: "Chưa phân bổ / Khác",
      employees: unassignedEmployees,
    });
  }

  return (
    <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-gray-100 h-full relative">
      <Card className="w-full h-full shadow-sm border-none rounded-xl">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 sm:mb-6 border-b border-gray-200 pb-4 gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
              Quản lý Nhân sự
            </h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Danh sách nhân viên, bộ phận và phân quyền
            </p>
            <p className="text-gray-400 text-[11px] sm:text-xs mt-1 max-w-2xl">
              Trong Cài đặt › Phân quyền (RBAC), ma trận quyền gắn theo{" "}
              <span className="text-gray-500">bộ phận</span>; cột «Chức vụ» trên bảng là{" "}
              <span className="text-gray-500">vai trò HR</span> (tách khỏi quyền truy cập). Danh mục bộ phận quản tại
              «Quản lý bộ phận».
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentUser &&
              hasPermission(currentUser, P.hrPayrollFinalize) && (
              <button
                onClick={() => setShowFinalizeModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-sm"
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
                    strokeWidth="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="hidden sm:inline">Chốt Lương & Reset</span>
                <span className="sm:hidden">Chốt Lương</span>
              </button>
            )}
            {currentUser &&
              hasPermission(currentUser, P.hrRead) && (
              <button
                onClick={() => {
                  fetchSalaryHistory();
                  setShowHistoryModal(true);
                }}
                className="flex items-center gap-1.5 sm:gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-sm"
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
                    strokeWidth="2"
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="hidden sm:inline">Lịch sử lương</span>
                <span className="sm:hidden">Lịch sử</span>
              </button>
            )}
            {canAddPersonnel && (
              <>
                <Button
                  color="light"
                  size="sm"
                  onClick={() => setIsDeptModalOpen(true)}
                  className="focus:ring-0 border-gray-200 text-gray-700"
                >
                  ⚙️{" "}
                  <span className="hidden sm:inline ml-1">Quản lý Bộ phận</span>
                </Button>
                <Button
                  style={{ backgroundColor: "#1d4ed8" }}
                  size="sm"
                  onClick={() => setIsAddEmpModalOpen(true)}
                  className="focus:ring-0"
                >
                  + Thêm <span className="hidden sm:inline ml-1">nhân sự</span>
                </Button>
              </>
            )}
            {currentUser && hasPermission(currentUser, P.hrLeaveApprove) && (
              <button
                onClick={() => {
                  fetchLeaveRequests();
                  setShowLeaveManagerModal(true);
                }}
                className="flex items-center gap-1.5 sm:gap-2 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-sm"
              >
                📋 <span className="hidden sm:inline">Duyệt Nghỉ Phép</span>
                <Badge
                  color="failure"
                  className="px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs"
                >
                  {leaveRequests.filter((r) => r.status === "Chờ duyệt")
                    .length || ""}
                </Badge>
              </button>
            )}
            {isBoss && (
              <button
                onClick={() => setShowBulkLeaveModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-sm"
              >
                🏖️ <span className="hidden sm:inline">Nghỉ Đồng Loạt</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar w-full">
          <table className="w-full min-w-[800px] text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold w-20 sm:w-24">
                  Mã NV
                </th>
                <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold">
                  Nhân viên
                </th>
                <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold">Email</th>
                <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold">Bộ phận</th>
                <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold">Chức vụ</th>
                <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold">
                  Tình trạng
                </th>
                <th className="px-3 sm:px-4 py-3 sm:py-4 text-right font-bold">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groupedEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center italic text-gray-400"
                  >
                    Chưa có nhân viên nào.
                  </td>
                </tr>
              ) : (
                groupedEmployees.map((group) => (
                  <React.Fragment key={group.departmentName}>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td
                        colSpan={7}
                        className="px-3 sm:px-4 py-2 sm:py-3 font-bold text-gray-800"
                      >
                        <span className="mr-2">📁</span>
                        Bộ phận:{" "}
                        <span className="text-blue-700 ml-1 text-xs sm:text-sm font-semibold tracking-tight">
                          {group.departmentName}
                        </span>
                        <span className="ml-3 text-[10px] sm:text-xs font-semibold text-gray-500 bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-gray-200 shadow-sm">
                          {group.employees.length} nhân sự
                        </span>
                      </td>
                    </tr>
                    {group.employees.map((emp) => (
                      <tr
                        key={emp.id}
                        className="bg-white hover:bg-blue-50 transition-colors duration-150"
                      >
                        <td className="px-3 sm:px-4 py-3 sm:py-4 font-bold text-gray-900 text-xs sm:text-sm">
                          {emp.employeeCode}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <FaceAvatar
                              name={emp.name || emp.employeeCode || "user"}
                              size={32}
                              showInitial={true}
                              className="rounded-full shrink-0"
                            />
                            <span className="font-bold text-gray-800 truncate max-w-[120px] sm:max-w-full text-xs sm:text-sm">
                              {emp.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 text-blue-600 font-medium text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">
                          {emp.email || "Chưa cập nhật"}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 font-medium text-gray-600 text-xs sm:text-sm">
                          {emp.department}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 text-gray-600 text-xs sm:text-sm">
                          {emp.role}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4">
                          <Badge
                            color={getStatusColor(emp.todayStatus)}
                            className="w-fit font-semibold px-2 py-0.5 text-[10px] sm:text-xs"
                          >
                            {emp.todayStatus}
                          </Badge>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 text-right">
                          <div className="flex justify-end gap-2 sm:gap-3">
                            <button
                              onClick={() => setSelectedEmpId(emp.id)}
                              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-xs sm:text-sm"
                            >
                              Chi tiết
                            </button>
                            {canAddPersonnel && (
                              <button
                                onClick={() => {
                                  setEmployeeToEdit(emp);
                                  setIsAddEmpModalOpen(true);
                                }}
                                className="font-semibold text-orange-500 hover:text-orange-700 hover:underline text-xs sm:text-sm"
                              >
                                Sửa
                              </button>
                            )}
                            {canDeletePersonnel && (
                              <button
                                onClick={() => handleDeleteEmployee(emp.id)}
                                className="font-semibold text-red-500 hover:text-red-700 hover:underline text-xs sm:text-sm"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <EmployeeModal
        key={employeeToEdit?.id || "new"}
        show={isAddEmpModalOpen}
        onClose={() => {
          setIsAddEmpModalOpen(false);
          setEmployeeToEdit(null);
        }}
        departments={departmentBoard}
        onSubmitEmployee={handleSubmitEmployee}
        employeeToEdit={employeeToEdit}
      />

      <DepartmentModal
        show={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        departments={departmentBoard}
        canAddPersonnel={!!canAddPersonnel}
        canDeletePersonnel={!!canDeletePersonnel}
        newDeptName={newDeptName}
        setNewDeptName={setNewDeptName}
        editingDeptId={editingDeptId}
        setEditingDeptId={setEditingDeptId}
        editDeptName={editDeptName}
        setEditDeptName={setEditDeptName}
        onAdd={handleAddDepartment}
        onUpdate={handleUpdateDepartment}
        onDelete={handleDeleteDepartment}
      />

      <SalaryHistoryModal
        show={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        salaryHistories={salaryHistories}
        onDownloadSlip={handleDownloadSlip}
        onDownloadExcel={handleDownloadSummaryExcel}
      />

      <FinalizeSalaryModal
        show={showFinalizeModal}
        onClose={() => setShowFinalizeModal(false)}
        finalizeMonth={finalizeMonth}
        setFinalizeMonth={setFinalizeMonth}
        isFinalizing={isFinalizing}
        onConfirm={handleFinalizeSalary}
      />

      <LeaveManagerModal
        show={showLeaveManagerModal}
        onClose={() => setShowLeaveManagerModal(false)}
        leaveRequests={leaveRequests}
        leaveMonthFilter={leaveMonthFilter}
        setLeaveMonthFilter={setLeaveMonthFilter}
        onUpdateStatus={handleUpdateLeaveStatus}
      />

      {/* Bulk Leave Modal */}
      {showBulkLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">🏖️ Tạo Nghỉ Đồng Loạt</h3>
              <button
                onClick={() => setShowBulkLeaveModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại nghỉ</label>
                <select
                  value={bulkLeaveType}
                  onChange={(e) => setBulkLeaveType(e.target.value as "Nghỉ không lương" | "Nghỉ có lương")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="Nghỉ có lương">Nghỉ có lương (Không trừ lương)</option>
                  <option value="Nghỉ không lương">Nghỉ không lương (Trừ ngày công)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
                  <input
                    type="date"
                    value={bulkStartDate}
                    onChange={(e) => setBulkStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={bulkEndDate}
                    onChange={(e) => setBulkEndDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lý do</label>
                <textarea
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="VD: Công ty nghỉ Tết, Nghỉ lễ..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowBulkLeaveModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                onClick={handleBulkLeaveSubmit}
                disabled={isSubmittingBulkLeave}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {isSubmittingBulkLeave ? "Đang tạo..." : "Tạo đơn cho tất cả"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
