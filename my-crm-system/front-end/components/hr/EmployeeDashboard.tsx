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
} from "../../types";
import { calculateLateFine } from "../../utils/helpers";
import { io } from "socket.io-client";
const socket = io("http://localhost:3001");
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

// THÊM PROPS currentUser ĐỂ PHÂN QUYỀN
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

  const [newDeptName, setNewDeptName] = useState("");
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");

  // ==========================================
  // LOGIC PHÂN QUYỀN (RBAC)
  // ==========================================
  const isAdmin =
    currentUser?.role.toLowerCase().includes("admin") ||
    currentUser?.role.toLowerCase().includes("giám đốc");
  const isManager =
    currentUser?.role.toLowerCase().includes("quản lý") ||
    currentUser?.role.toLowerCase().includes("trưởng phòng");

  // Quyền thêm nhân sự & bộ phận: Chỉ Admin và Quản lý mới được làm
  const canAddPersonnel = isAdmin || isManager;

  // Quyền xóa: CHỈ ADMIN được xóa
  const canDeletePersonnel = isAdmin;

  // LẤY DỮ LIỆU
  const fetchData = useCallback(async () => {
    try {
      const [empRes, deptRes] = await Promise.all([
        fetch("http://localhost:3001/api/hr/employees"),
        fetch("http://localhost:3001/api/hr/departments"),
      ]);
      const empData = await empRes.json();
      const deptData = await deptRes.json();
      setEmployees(empData);
      setDepartments(deptData);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error);
    }
  }, []);

  // ĐÃ SỬA ĐOẠN NÀY: Thêm lắng nghe Socket và Event
  useEffect(() => {
    fetchData();

    // Tự động load lại dữ liệu khi Sếp lưu thưởng phạt (hoặc có bất kỳ thay đổi nào)
    socket.on("data_changed", fetchData);
    window.addEventListener("refreshBoard", fetchData);

    return () => {
      socket.off("data_changed", fetchData);
      window.removeEventListener("refreshBoard", fetchData);
    };
  }, [fetchData]);

  // HÀM XỬ LÝ NHÂN VIÊN
  const handleAddEmployee = async (empData: NewEmployeeData) => {
    if (!canAddPersonnel)
      return alert("Bạn không có quyền thực hiện thao tác này!");
    try {
      const response = await fetch("http://localhost:3001/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Bắn lỗi từ backend ra màn hình (VD: "Email đã tồn tại")
        throw new Error(errorData.error || "Email có thể đã bị trùng!");
      }

      fetchData();
      setIsAddEmpModalOpen(false); // Đóng modal nếu thêm thành công
      alert("Thêm nhân sự thành công!");
    } catch (error) {
      alert("Lỗi khi thêm nhân viên!" + error);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!canDeletePersonnel)
      return alert("Chỉ Giám đốc/Admin mới có quyền xóa nhân sự!");
    if (window.confirm("Bạn có chắc chắn muốn xóa nhân viên này?")) {
      try {
        await fetch(`http://localhost:3001/api/hr/employees/${id}`, {
          method: "DELETE",
        });
        fetchData();
      } catch (error) {
        alert("Lỗi khi xóa nhân viên!" + error);
      }
    }
  };

  // CHẤM CÔNG
  const handleCheckIn = async (empId: string) => {
    // Nếu là nhân viên, họ chỉ được phép check-in cho CHÍNH HỌ (hoặc Quản lý check-in dùm)
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
    const isLate = now.getHours() >= 9 && now.getMinutes() > 0;
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
      status: status,
      fine: fine,
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
      await fetch(`http://localhost:3001/api/hr/employees/${empId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord),
      });
    } catch (error) {
      console.error("Lỗi lưu chấm công:", error);
    }
  };

  // XỬ LÝ BỘ PHẬN
  const handleAddDepartment = async () => {
    if (!canAddPersonnel) return;
    if (!newDeptName.trim()) return;
    try {
      await fetch("http://localhost:3001/api/hr/departments", {
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
      await fetch(`http://localhost:3001/api/hr/departments/${id}`, {
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
        await fetch(`http://localhost:3001/api/hr/departments/${id}`, {
          method: "DELETE",
        });
        fetchData();
      } catch (error) {
        alert("Lỗi khi xóa bộ phận!" + error);
      }
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
        currentUser={currentUser}
      />
    );
  }

  let filteredDepartments = departments;
  let filteredEmployees = employees;

  // Nếu KHÔNG phải là Admin và KHÔNG phải là Trưởng phòng/Quản lý
  // -> Tức là nhân viên bình thường -> CHỈ ĐƯỢC XEM CHÍNH MÌNH
  if (!isAdmin && !isManager && currentUser) {
    // Chỉ giữ lại data của đúng người đang đăng nhập
    filteredEmployees = employees.filter((e) => e.id === currentUser.id);
    filteredDepartments = departments.filter(
      (d) => d.name === currentUser.department,
    );
  }

  const groupedEmployees = filteredDepartments
    .map((dept) => {
      return {
        departmentName: dept.name,
        employees: filteredEmployees.filter(
          (emp) => emp.department === dept.name,
        ),
      };
    })
    .filter((group) => group.employees.length > 0);

  const unassignedEmployees = filteredEmployees.filter(
    (emp) => !departments.some((d) => d.name === emp.department),
  );

  // Xử lý trường hợp nhân viên nằm trong nhóm chưa phân bổ
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
    <div className="flex-1 p-6 overflow-y-auto bg-gray-100 h-full">
      <Card className="w-full h-full shadow-sm border-none rounded-xl">
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Quản lý Nhân sự
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Danh sách nhân viên, bộ phận và phân quyền
            </p>
          </div>

          {/* CHỈ HIỆN NÚT THÊM NẾU LÀ ADMIN HOẶC QUẢN LÝ */}
          {canAddPersonnel && (
            <div className="flex gap-2">
              <Button
                color="light"
                onClick={() => setIsDeptModalOpen(true)}
                className="focus:ring-0 border-gray-200 text-gray-700"
              >
                ⚙️ Quản lý Bộ phận
              </Button>
              <Button
                style={{ backgroundColor: "#1d4ed8" }}
                onClick={() => setIsAddEmpModalOpen(true)}
                className="focus:ring-0"
              >
                + Thêm nhân sự
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 font-bold w-24">Mã NV</th>
                <th className="px-4 py-4 font-bold">Nhân viên</th>
                <th className="px-4 py-4 font-bold">Email</th>
                <th className="px-4 py-4 font-bold">Bộ phận</th>
                <th className="px-4 py-4 font-bold">Chức vụ</th>

                <th className="px-4 py-4 font-bold">Tình trạng</th>
                <th className="px-4 py-4 text-right font-bold">Hành động</th>
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
                        className="px-4 py-3 font-bold text-gray-800"
                      >
                        <span className="mr-2">📁</span>
                        Bộ phận:{" "}
                        <span className="text-blue-700 uppercase tracking-wide ml-1">
                          {group.departmentName}
                        </span>
                        <span className="ml-3 text-xs font-semibold text-gray-500 bg-white px-2.5 py-1 rounded-full border border-gray-200 shadow-sm">
                          {group.employees.length} nhân sự
                        </span>
                      </td>
                    </tr>
                    {group.employees.map((emp) => (
                      <tr
                        key={emp.id}
                        className="bg-white hover:bg-blue-50 transition-colors duration-150"
                      >
                        <td className="px-4 py-4 font-bold text-gray-900">
                          {emp.employeeCode}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              size="sm"
                              rounded
                              placeholderInitials={emp.name.charAt(0)}
                              className="bg-orange-400 text-white"
                            />
                            <span className="font-bold text-gray-800">
                              {emp.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-blue-600 font-medium">
                          {emp.email || "Chưa cập nhật"}
                        </td>
                        <td className="px-4 py-4 font-medium text-gray-600">
                          {emp.department}
                        </td>
                        <td className="px-4 py-4 text-gray-600">{emp.role}</td>
                        <td className="px-4 py-4">
                          <Badge
                            color={getStatusColor(emp.todayStatus)}
                            className="w-fit font-semibold px-2.5 py-0.5"
                          >
                            {emp.todayStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => setSelectedEmpId(emp.id)}
                              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            >
                              Chi tiết
                            </button>
                            {/* CHỈ ADMIN MỚI NHÌN THẤY NÚT XÓA */}
                            {canDeletePersonnel && (
                              <button
                                onClick={() => handleDeleteEmployee(emp.id)}
                                className="font-semibold text-red-500 hover:text-red-700 hover:underline transition-colors"
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
        show={isAddEmpModalOpen}
        onClose={() => setIsAddEmpModalOpen(false)}
        departments={departments}
        onAddEmployee={handleAddEmployee}
      />

      <Modal
        show={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        size="lg"
      >
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="text-xl font-bold text-gray-800">Quản lý Bộ Phận</h3>
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
              ></path>
            </svg>
          </button>
        </div>
        <div className="p-6">
          <div className="flex gap-2 mb-6">
            <TextInput
              className="flex-1 shadow-sm"
              placeholder="Nhập tên bộ phận mới..."
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
            />
            <Button
              color="success"
              onClick={handleAddDepartment}
              className="shadow-sm"
            >
              Thêm
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg shadow-sm">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 font-bold">Tên bộ phận</th>
                  <th className="px-6 py-3 text-right font-bold">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {departments.map((dept) => (
                  <tr
                    key={dept.id}
                    className="bg-white hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
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
                    <td className="px-6 py-4 text-right">
                      {editingDeptId === dept.id ? (
                        <div className="flex justify-end gap-3">
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
                        <div className="flex justify-end gap-4">
                          <button
                            className="text-blue-600 hover:underline font-semibold"
                            onClick={() => {
                              setEditingDeptId(dept.id);
                              setEditDeptName(dept.name);
                            }}
                          >
                            Sửa
                          </button>
                          {/* CHỈ ADMIN MỚI XÓA ĐƯỢC PHÒNG BAN */}
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
    </div>
  );
};

export default EmployeeDashboard;
