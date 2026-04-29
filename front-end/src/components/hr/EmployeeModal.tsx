// frontend/components/hr/EmployeeModal.tsx
import React, { useState } from "react";
import { Modal, Button, Label, TextInput, Select } from "flowbite-react";
import type { Department, NewEmployeeData, Employee } from "../../types";

interface EmployeeModalProps {
  show: boolean;
  onClose: () => void;
  departments: Department[];
  onSubmitEmployee: (employeeData: NewEmployeeData) => void;
  employeeToEdit?: Employee | null;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({
  show,
  onClose,
  departments,
  onSubmitEmployee,
  employeeToEdit,
}) => {
  const isEditMode = !!employeeToEdit;

  // Lấy giá trị trực tiếp từ employeeToEdit (nếu có), nếu không thì để rỗng
  const [name, setName] = useState(employeeToEdit?.name || "");
  const [email, setEmail] = useState(employeeToEdit?.email || "");
  const [phone, setPhone] = useState(employeeToEdit?.phone || "");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState(
    employeeToEdit?.department || "",
  );
  const [role, setRole] = useState(employeeToEdit?.role || "");
  const [baseSalary, setBaseSalary] = useState<number>(
    employeeToEdit?.baseSalary || 6000000,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || (!password && !isEditMode) || !department || !role)
      return;

    onSubmitEmployee({
      name,
      email,
      phone,
      password,
      department,
      role,
      baseSalary,
    });
  };
  return (
    <Modal show={show} onClose={onClose} size="lg">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-800">
          {isEditMode ? "Cập Nhật Nhân Sự" : "Thêm Nhân Sự Mới"}
        </h3>
      </div>

      <div className="p-6">
        <form id="employee-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Họ và Tên (*)</Label>
              <TextInput
                id="empName"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>Email (*)</Label>
              <TextInput
                id="empEmail"
                type="email"
                placeholder="example@flyvisa.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Số điện thoại (tùy chọn)</Label>
            <TextInput
              id="empPhone"
              type="tel"
              placeholder="VD: 0901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>
                Mật khẩu {isEditMode ? "(Để trống nếu không đổi)" : "(*)"}
              </Label>
              <TextInput
                id="empPassword"
                type="password"
                required={!isEditMode}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label>Bộ phận (*)</Label>
              <Select
                id="empDept"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">-- Chọn bộ phận --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>Vai trò (*)</Label>
            <Select
              id="empRole"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">-- Chọn vai trò --</option>
              <option value="Trưởng phòng">Trưởng phòng</option>
              <option value="Nhân viên">Nhân viên</option>
              <option value="Giám đốc">Giám đốc</option>
              <option value="Phó giám đốc">Phó giám đốc</option>
            </Select>
          </div>
          <div>
            <Label>Mức lương cơ bản (VNĐ)</Label>
            <TextInput
              type="number"
              required
              value={baseSalary}
              onChange={(e) => setBaseSalary(Number(e.target.value))}
              placeholder="VD: 5000000"
            />
          </div>
        </form>
      </div>

      <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
        <Button color="gray" onClick={onClose}>
          Hủy
        </Button>
        <Button
          type="submit"
          form="employee-form"
          style={{ backgroundColor: "#1d4ed8" }}
        >
          {isEditMode ? "Cập Nhật" : "Lưu Nhân Viên"}
        </Button>
      </div>
    </Modal>
  );
};

export default EmployeeModal;
