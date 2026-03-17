import React, { useState, useEffect, useCallback } from "react";
import { Card, Badge, Avatar, Button, Modal, TextInput } from "flowbite-react";
import EmployeeModal from "./EmployeeModal";
import EmployeeDetail from "./EmployeeDetail";
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
import { calculateLateFine } from "../../utils/helpers";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const socket = io(API_URL);

const getStatusColor = (status: AttendanceStatus): string => {
  switch (status) {
    case "Đúng giờ":
      return "success";
    case "Đi muộn":
      return "warning";
    case "Vắng không phép":
      return "failure";
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

  // --- STATE CHỐT LƯƠNG ---
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [finalizeMonth, setFinalizeMonth] = useState(() => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const m = String(lastMonth.getMonth() + 1).padStart(2, "0");
    const y = lastMonth.getFullYear();
    return `${m}/${y}`;
  });

  // QUYỀN TRUY CẬP
  const isAdmin =
    currentUser?.role.toLowerCase().includes("admin") ||
    currentUser?.role.toLowerCase().includes("giám đốc");
  const isManager =
    currentUser?.role.toLowerCase().includes("quản lý") ||
    currentUser?.role.toLowerCase().includes("trưởng phòng");
  const isBoss =
    currentUser?.role.toLowerCase().includes("giám đốc") ||
    currentUser?.id === "admin" ||
    currentUser?.role.toLowerCase().includes("phó giám đốc");

  const canAddPersonnel = isAdmin || isManager || isBoss;
  const canDeletePersonnel = isAdmin || isBoss;

  // LẤY DỮ LIỆU
  const fetchData = useCallback(async () => {
    try {
      const [empRes, deptRes] = await Promise.all([
        fetch(`${API_URL}/api/hr/employees`),
        fetch(`${API_URL}/api/hr/departments`),
      ]);
      const empData = await empRes.json();
      const deptData = await deptRes.json();
      setEmployees(empData);
      setDepartments(deptData);
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
      const response = await fetch(url, {
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
        await fetch(`${API_URL}/api/hr/employees/${id}`, { method: "DELETE" });
        fetchData();
      } catch (error) {
        alert("Lỗi khi xóa nhân viên!" + error);
      }
    }
  };

  // CHẤM CÔNG
  const handleCheckIn = async (empId: string) => {
    if (!isAdmin && !isManager && currentUser?.id !== empId) {
      return alert("Bạn chỉ có thể tự chấm công cho chính mình!");
    }
    const targetEmployee = employees.find((e) => e.id === empId);
    if (!targetEmployee) return;
    const now = new Date();
    const todayStr = now.toLocaleDateString("vi-VN");
    if (targetEmployee.attendanceRecords.some((r) => r.date === todayStr)) {
      alert("Hôm nay nhân viên này đã check-in rồi!");
      return;
    }
    const currentTimeStr = now.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const isLate = now.getHours() * 60 + now.getMinutes() > 520;
    const status: AttendanceStatus = isLate ? "Đi muộn" : "Đúng giờ";
    const fine = isLate
      ? calculateLateFine(targetEmployee.attendanceRecords, now)
      : 0;
    if (isLate) {
      alert(
        `Đã đi muộn!\nGiờ Check-in: ${currentTimeStr}\nBị phạt: ${new Intl.NumberFormat("vi-VN").format(fine)}đ`,
      );
    } else {
      alert(`Check-in thành công!\nGiờ Check-in: ${currentTimeStr}`);
    }
    const newRecord = {
      date: todayStr,
      inTime: currentTimeStr,
      outTime: "-",
      status,
      fine,
    };
    setEmployees((prevEmps) =>
      prevEmps.map((emp) => {
        if (emp.id !== empId) return emp;
        return {
          ...emp,
          todayStatus: status,
          attendanceRecords: [
            newRecord,
            ...emp.attendanceRecords,
          ] as AttendanceRecord[],
        };
      }),
    );
    try {
      await fetch(`${API_URL}/api/hr/employees/${empId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord),
      });
    } catch (error) {
      console.error("Lỗi lưu chấm công:", error);
    }
  };

  const handleCheckOut = async (empId: string) => {
    if (!isAdmin && !isManager && currentUser?.id !== empId) {
      return alert("Bạn chỉ có thể tự check-out cho chính mình!");
    }
    const targetEmployee = employees.find((e) => e.id === empId);
    if (!targetEmployee) return;
    const todayStr = new Date().toLocaleDateString("vi-VN");
    const todayRecord = targetEmployee.attendanceRecords.find(
      (r) => r.date === todayStr,
    );
    if (!todayRecord) return alert("Chưa check-in hôm nay!");
    if (todayRecord.outTime && todayRecord.outTime !== "-") {
      return alert("Đã check-out rồi!");
    }
    try {
      const res = await fetch(`${API_URL}/api/hr/employees/${empId}/checkout`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error);
      if (data.isEarlyLeave) {
        alert(
          `Check-out lúc ${data.outTime} — VỀ SỚM!\n` +
            `Bị trừ nửa ngày công: -${new Intl.NumberFormat("vi-VN").format(data.halfDayDeduction)}đ\n` +
            `(Nếu có đơn xin phép được duyệt sẽ không bị trừ)`,
        );
      } else {
        alert(`Check-out thành công lúc ${data.outTime} ✅`);
      }
      fetchData();
    } catch (error) {
      alert("Lỗi check-out: " + error);
    }
  };

  // XỬ LÝ BỘ PHẬN
  const handleAddDepartment = async () => {
    if (!canAddPersonnel) return;
    if (!newDeptName.trim()) return;
    try {
      await fetch(`${API_URL}/api/hr/departments`, {
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
    if (!canAddPersonnel) return;
    if (!editDeptName.trim()) return;
    try {
      await fetch(`${API_URL}/api/hr/departments/${id}`, {
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
    if (!canDeletePersonnel)
      return alert("Chỉ Giám đốc mới có quyền xóa phòng ban!");
    if (
      window.confirm(
        "Xóa bộ phận này? Các nhân viên thuộc bộ phận này sẽ chuyển sang Chưa phân bổ.",
      )
    ) {
      try {
        await fetch(`${API_URL}/api/hr/departments/${id}`, {
          method: "DELETE",
        });
        fetchData();
      } catch (error) {
        alert("Lỗi khi xóa bộ phận!" + error);
      }
    }
  };

  // --- STATE LỊCH SỬ LƯƠNG ---
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [salaryHistories, setSalaryHistories] = useState<SalaryHistory[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);

  const toggleMonth = (monthYear: string) => {
    setExpandedMonths((prev) =>
      prev.includes(monthYear)
        ? prev.filter((m) => m !== monthYear)
        : [...prev, monthYear],
    );
  };

  const fetchSalaryHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/hr/salary/history`);
      if (res.ok) setSalaryHistories(await res.json());
    } catch (error) {
      console.error("Lỗi lấy lịch sử lương", error);
    }
  };

  const handleOpenHistory = () => {
    fetchSalaryHistory();
    setShowHistoryModal(true);
  };

  // --- HÀM GỌI API CHỐT LƯƠNG ---
  const handleFinalizeSalary = async () => {
    if (!finalizeMonth.trim()) return alert("Vui lòng nhập tháng chốt lương!");
    setIsFinalizing(true);
    try {
      const response = await fetch(`${API_URL}/api/hr/salary/finalize`, {
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

  // --- TẢI PHIẾU LƯƠNG PDF ---
  const handleDownloadSlip = async (
    employeeId: string,
    monthYear: string,
    employeeName: string,
  ) => {
    try {
      const url = `${API_URL}/api/hr/salary/slip/${employeeId}/${encodeURIComponent(monthYear)}`;
      const res = await fetch(url);
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

  // --- STATE QUẢN LÝ NGHỈ PHÉP ---
  const [showLeaveManagerModal, setShowLeaveManagerModal] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  const fetchLeaveRequests = async () => {
    try {
      const res = await fetch(`${API_URL}/api/hr/leave-requests`);
      if (res.ok) setLeaveRequests(await res.json());
    } catch (error) {
      console.error("Lỗi lấy danh sách phép:", error);
    }
  };

  const handleOpenLeaveManager = () => {
    fetchLeaveRequests();
    setShowLeaveManagerModal(true);
  };

  const handleUpdateLeaveStatus = async (id: string, newStatus: string) => {
    if (
      !window.confirm(`Bạn chắc chắn muốn ${newStatus.toUpperCase()} đơn này?`)
    )
      return;
    try {
      const res = await fetch(`${API_URL}/api/hr/leave-requests/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchLeaveRequests();
        fetchData();
      }
    } catch (error) {
      alert("Lỗi cập nhật trạng thái!" + error);
    }
  };

  // CHI TIẾT NHÂN VIÊN
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

  let filteredDepartments = departments;
  let filteredEmployees = employees;

  if (!isAdmin && !isManager && currentUser) {
    filteredEmployees = employees.filter((e) => e.id === currentUser.id);
    filteredDepartments = departments.filter(
      (d) => d.name === currentUser.department,
    );
  }

  const groupedEmployees = filteredDepartments
    .map((dept) => ({
      departmentName: dept.name,
      employees: filteredEmployees.filter(
        (emp) => emp.department === dept.name,
      ),
    }))
    .filter((group) => group.employees.length > 0);

  const unassignedEmployees = filteredEmployees.filter(
    (emp) => !departments.some((d) => d.name === emp.department),
  );
  if (
    unassignedEmployees.length > 0 &&
    (isAdmin ||
      isManager ||
      unassignedEmployees.some((e) => e.id === currentUser?.id))
  ) {
    groupedEmployees.push({
      departmentName: "Chưa phân bổ / Khác",
      employees: unassignedEmployees,
    });
  }

  return (
    // Tối ưu Padding mobile
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isBoss && (
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
            {isBoss && (
              <button
                onClick={handleOpenHistory}
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
                <button
                  onClick={handleOpenLeaveManager}
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
              </>
            )}
          </div>
        </div>

        {/* Tối ưu cuộn ngang cho Bảng */}
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
                        <span className="text-blue-700 uppercase tracking-wide ml-1 text-xs sm:text-sm">
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
                            <Avatar
                              size="sm"
                              rounded
                              placeholderInitials={emp.name.charAt(0)}
                              className="bg-orange-400 text-white shrink-0"
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

      {/* ── EMPLOYEE MODAL ── */}
      <EmployeeModal
        show={isAddEmpModalOpen}
        onClose={() => {
          setIsAddEmpModalOpen(false);
          setEmployeeToEdit(null);
        }}
        departments={departments}
        onSubmitEmployee={handleSubmitEmployee}
        employeeToEdit={employeeToEdit}
      />

      {/* ── MODAL QUẢN LÝ BỘ PHẬN ── */}
      <Modal
        show={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        size="lg"
        className="md:p-4"
      >
        <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
            Quản lý Bộ Phận
          </h3>
          <button
            onClick={() => setIsDeptModalOpen(false)}
            className="text-gray-400 hover:text-gray-900 bg-white hover:bg-gray-200 rounded-full p-1.5 transition-colors border"
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
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
            <TextInput
              className="flex-1 shadow-sm"
              placeholder="Nhập tên bộ phận mới..."
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
            />
            <Button
              color="success"
              onClick={handleAddDepartment}
              className="shadow-sm whitespace-nowrap"
            >
              Thêm
            </Button>
          </div>
          <div className="max-h-[50vh] sm:max-h-80 overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg shadow-sm custom-scrollbar w-full">
            <table className="w-full min-w-[400px] text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-4 sm:px-6 py-3 font-bold">Tên bộ phận</th>
                  <th className="px-4 sm:px-6 py-3 text-right font-bold">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {departments.map((dept) => (
                  <tr
                    key={dept.id}
                    className="bg-white hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-gray-900">
                      {editingDeptId === dept.id ? (
                        <TextInput
                          sizing="sm"
                          value={editDeptName}
                          onChange={(e) => setEditDeptName(e.target.value)}
                        />
                      ) : (
                        dept.name
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-right">
                      {editingDeptId === dept.id ? (
                        <div className="flex justify-end gap-2 sm:gap-3">
                          <button
                            className="text-green-600 hover:underline font-semibold"
                            onClick={() => handleUpdateDepartment(dept.id)}
                          >
                            Lưu
                          </button>
                          <button
                            className="text-gray-500 hover:underline font-semibold"
                            onClick={() => setEditingDeptId(null)}
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-3 sm:gap-4">
                          {canAddPersonnel && (
                            <button
                              onClick={() => {
                                setEditingDeptId(dept.id);
                                setEditDeptName(dept.name);
                              }}
                              className="font-semibold text-orange-500 hover:text-orange-700 hover:underline"
                            >
                              Sửa
                            </button>
                          )}
                          {canDeletePersonnel && (
                            <button
                              className="text-red-500 hover:underline font-semibold"
                              onClick={() => handleDeleteDepartment(dept.id)}
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* ── MODAL LỊCH SỬ LƯƠNG ── */}
      <Modal
        show={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        size="7xl"
        className="md:p-4"
      >
        <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            📊 Lịch sử chốt lương các tháng
          </h3>
          <button
            onClick={() => setShowHistoryModal(false)}
            className="text-gray-400 hover:text-gray-900 bg-white hover:bg-gray-200 rounded-full p-1.5 transition-colors border"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-3 sm:p-6 bg-gray-100 overflow-y-auto max-h-[75vh]">
          {salaryHistories.length === 0 ? (
            <p className="text-center italic text-gray-400 py-8 bg-white rounded-lg shadow-sm text-sm">
              Chưa có dữ liệu chốt lương nào.
            </p>
          ) : (
            Object.entries(
              salaryHistories.reduce(
                (acc, record) => {
                  if (!acc[record.monthYear]) acc[record.monthYear] = [];
                  acc[record.monthYear].push(record);
                  return acc;
                },
                {} as Record<string, SalaryHistory[]>,
              ),
            ).map(([monthYear, records]) => {
              const isExpanded = expandedMonths.includes(monthYear);
              return (
                <div
                  key={monthYear}
                  className="mb-3 sm:mb-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => toggleMonth(monthYear)}
                    className="w-full flex justify-between items-center p-4 sm:p-5 bg-blue-50 hover:bg-blue-100 transition-colors focus:outline-none"
                  >
                    <div className="font-bold text-base sm:text-lg text-blue-800 flex items-center gap-2">
                      📅 Lương Tháng {monthYear}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <Badge
                        color="info"
                        className="px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-semibold shadow-sm"
                      >
                        {records.length} nhân sự
                      </Badge>
                      <svg
                        className={`w-4 h-4 sm:w-5 sm:h-5 text-blue-600 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="overflow-x-auto custom-scrollbar border-t border-blue-100 w-full">
                      <table className="w-full min-w-[700px] text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold w-20">
                              Mã NV
                            </th>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold">
                              Nhân viên
                            </th>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-right">
                              Lương CB
                            </th>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-right text-green-600">
                              Thưởng / HH
                            </th>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-right text-red-600">
                              Phạt / Trừ
                            </th>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-right text-blue-700">
                              Thực nhận
                            </th>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-center w-24">
                              Phiếu lương
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {records.map((record, idx) => (
                            <tr
                              key={idx}
                              className="bg-white hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-gray-900">
                                {record.employee?.employeeCode}
                              </td>
                              <td className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-gray-800">
                                {record.employee?.name || "Đã xóa NV"}
                                <p className="text-xs font-normal text-gray-500 mt-0.5">
                                  {typeof record.employee?.department ===
                                  "object"
                                    ? (
                                        record.employee?.department as {
                                          name: string;
                                        }
                                      ).name
                                    : record.employee?.department}
                                </p>
                              </td>
                              <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-medium">
                                {new Intl.NumberFormat("vi-VN").format(
                                  record.baseSalary,
                                )}
                                đ
                              </td>
                              <td className="px-4 sm:px-6 py-3 sm:py-4 text-right text-green-600 font-bold">
                                +
                                {new Intl.NumberFormat("vi-VN").format(
                                  record.totalBonus,
                                )}
                                đ
                              </td>
                              <td className="px-4 sm:px-6 py-3 sm:py-4 text-right text-red-600 font-bold">
                                -
                                {new Intl.NumberFormat("vi-VN").format(
                                  record.totalDeduction,
                                )}
                                đ
                              </td>
                              <td className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-blue-700 text-sm sm:text-base">
                                {new Intl.NumberFormat("vi-VN").format(
                                  record.finalSalary,
                                )}
                                đ
                              </td>
                              <td className="px-4 sm:px-6 py-3 sm:py-4 text-center">
                                <button
                                  onClick={() =>
                                    handleDownloadSlip(
                                      record.employee?.id ?? "",
                                      record.monthYear,
                                      record.employee?.name ?? "NhanVien",
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors border border-blue-200"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                  </svg>
                                  PDF
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 sm:px-6 py-3 sm:py-4 text-right font-bold text-gray-700 uppercase tracking-wide text-xs sm:text-sm"
                            >
                              TỔNG LƯƠNG TRẢ TRONG THÁNG:
                            </td>
                            <td
                              colSpan={2}
                              className="px-4 sm:px-6 py-3 sm:py-4 text-left font-black text-blue-800 text-base sm:text-lg"
                            >
                              {new Intl.NumberFormat("vi-VN").format(
                                records.reduce(
                                  (sum, r) => sum + r.finalSalary,
                                  0,
                                ),
                              )}
                              đ
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

      {/* ── MODAL CHỐT LƯƠNG ── */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-200 bg-red-50">
              <h3 className="text-base sm:text-lg font-bold text-red-700 flex items-center gap-2">
                ⚠️ Cảnh báo: Chốt Lương Cuối Tháng
              </h3>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-xs sm:text-sm text-gray-600 mb-4">
                Hành động này sẽ tính toán tổng lương hiện tại, lưu vào{" "}
                <strong>Lịch sử lương</strong>, và{" "}
                <span className="text-red-600 font-bold">XÓA TOÀN BỘ</span> dữ
                liệu Chấm công, Thưởng/Phạt và Đơn nghỉ phép của tháng cũ.
              </p>
              <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">
                Nhập tháng chốt (VD: 02/2026)
              </label>
              <input
                type="text"
                value={finalizeMonth}
                onChange={(e) => setFinalizeMonth(e.target.value)}
                placeholder="MM/YYYY"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-bold text-center text-base sm:text-lg tracking-widest"
              />
            </div>
            <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 bg-gray-50">
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm sm:text-base"
                disabled={isFinalizing}
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleFinalizeSalary}
                disabled={isFinalizing}
                className="w-full sm:w-auto px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
              >
                {isFinalizing ? "Đang xử lý..." : "Xác nhận Chốt & Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DUYỆT NGHỈ PHÉP ── */}
      <Modal
        show={showLeaveManagerModal}
        onClose={() => setShowLeaveManagerModal(false)}
        size="6xl"
        className="md:p-4"
      >
        <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            📋 Danh sách Đơn xin nghỉ phép
          </h3>
          <button
            onClick={() => setShowLeaveManagerModal(false)}
            className="text-gray-400 hover:text-gray-900 bg-white hover:bg-gray-200 rounded-full p-1.5 transition-colors border"
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
        <div className="p-0 overflow-x-auto overflow-y-auto max-h-[70vh] custom-scrollbar w-full">
          <table className="w-full min-w-[900px] text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-4 py-3 sm:py-4 font-bold whitespace-nowrap">
                  Ngày nộp
                </th>
                <th className="px-4 py-3 sm:py-4 font-bold whitespace-nowrap">
                  Nhân viên
                </th>
                <th className="px-4 py-3 sm:py-4 font-bold whitespace-nowrap">
                  Loại phép
                </th>
                <th className="px-4 py-3 sm:py-4 font-bold whitespace-nowrap">
                  Thời gian
                </th>
                <th className="px-4 py-3 sm:py-4 font-bold w-1/4">Lý do</th>
                <th className="px-4 py-3 sm:py-4 font-bold text-center whitespace-nowrap">
                  Trạng thái
                </th>
                <th className="px-4 py-3 sm:py-4 font-bold text-right whitespace-nowrap">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leaveRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center italic text-gray-400"
                  >
                    Không có đơn xin nghỉ phép nào.
                  </td>
                </tr>
              ) : (
                leaveRequests.map((req) => (
                  <tr key={req.id} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 sm:py-4 font-medium text-gray-500 whitespace-nowrap">
                      {new Date(req.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 sm:py-4">
                      <p className="font-bold text-gray-900 whitespace-nowrap">
                        {req.employee?.name}
                      </p>
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
                        Từ:{" "}
                        {new Date(req.startDate).toLocaleDateString("vi-VN")}
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
                            onClick={() =>
                              handleUpdateLeaveStatus(req.id, "Đã duyệt")
                            }
                            className="px-2 py-1 sm:px-3 sm:py-1.5 bg-green-100 text-green-700 hover:bg-green-200 font-bold rounded-lg transition-colors text-[10px] sm:text-xs whitespace-nowrap"
                          >
                            Duyệt
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateLeaveStatus(req.id, "Từ chối")
                            }
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
    </div>
  );
};

export default EmployeeDashboard;
