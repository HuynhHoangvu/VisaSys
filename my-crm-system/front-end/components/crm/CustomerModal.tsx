import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Label,
  TextInput,
  Select,
  Textarea,
} from "flowbite-react";
import { type Task, type Employee } from "../../types";
import { VISA_SERVICES, CUSTOMER_SOURCES } from "../../utils/constants";

interface CustomerModalProps {
  show: boolean;
  onClose: () => void;
  // Dùng Partial<Task> vì khi tạo mới, ta không cần gửi lên 'id'
  onAddCustomer: (customer: Partial<Task>) => void;
}

const CustomerModal: React.FC<CustomerModalProps> = ({
  show,
  onClose,
  onAddCustomer,
}) => {
  // GỘP STATE: Dùng 1 object duy nhất để quản lý form
  const initialFormState = {
    name: "",
    service: "",
    price: "",
    phone: "",
    email: "",
    description: "",
    source: "",
    assignedTo: "",
  };
  const [formData, setFormData] = useState(initialFormState);
  const [salesStaff, setSalesStaff] = useState<Employee[]>([]);

  // HÀM XỬ LÝ CHUNG KHI NHẬP LIỆU
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  useEffect(() => {
    if (show) {
      const fetchSalesStaff = async () => {
        try {
          const response = await fetch(
            "http://localhost:3001/api/hr/employees",
          );
          const allEmployees: Employee[] = await response.json();
          const filteredSales = allEmployees.filter(
            (emp) =>
              emp.department.toLowerCase().includes("sale") ||
              emp.role.toLowerCase().includes("sale"),
          );
          setSalesStaff(filteredSales);
        } catch (error) {
          console.error("Lỗi khi tải danh sách nhân viên Sale:", error);
        }
      };
      fetchSalesStaff();
    }
  }, [show]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const {
      name,
      service,
      price,
      phone,
      email,
      description,
      source,
      assignedTo,
    } = formData;

    if (!name || !service || !phone) return;

    // Format giá tiền (Thêm dấu chấm phân cách hàng nghìn nếu người dùng nhập số)
    const formattedPrice = price
      ? new Intl.NumberFormat("vi-VN").format(
          Number(price.replace(/\D/g, "")),
        ) + " đ"
      : "Chưa báo giá";
        let autoChecklistType = "tourism";
        const lowerService = service.toLowerCase();
        if (
          lowerService.includes("lao động") ||
          lowerService.includes("tay nghề")
        ) {
          autoChecklistType = "labor";
        } else if (lowerService.includes("du học")) {
          autoChecklistType = "study";
        }
    onAddCustomer({
      content: `${name} - ${service}`,
      price: formattedPrice,
      phone,
      email,
      description,
      source,
      assignedTo,
      activities: [],
      visaType: service,
      checklistType: autoChecklistType,
      createdAt: new Date().toISOString(),
    });

    handleClose();
  };

  const handleClose = () => {
    setFormData(initialFormState); // Reset toàn bộ form chỉ với 1 dòng
    onClose();
  };

  return (
    <Modal show={show} onClose={handleClose} size="lg">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-800">Thêm Khách Hàng Mới</h3>
      </div>

      <div className="p-6">
        <form
          id="add-customer-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Họ và Tên (*)</Label>
              <TextInput
                id="name"
                required
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            <div>
              <Label htmlFor="service">Diện Visa quan tâm (*)</Label>
              <Select
                id="service"
                required
                value={formData.service}
                onChange={handleChange}
              >
                <option value="">-- Chọn diện Visa --</option>
                {VISA_SERVICES.map((visa) => (
                  <option key={visa.id} value={visa.name}>
                    {visa.flag} {visa.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Số điện thoại (*)</Label>
              <TextInput
                id="phone"
                required
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <TextInput
                id="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="source">Nguồn khách</Label>
              <Select
                id="source"
                value={formData.source}
                onChange={handleChange}
              >
                <option value="">-- Chọn nguồn --</option>
                {CUSTOMER_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="assignedTo">Sale phụ trách</Label>
              <Select
                id="assignedTo"
                value={formData.assignedTo}
                onChange={handleChange}
              >
                <option value="">-- Chọn nhân viên --</option>
                {salesStaff.map((staff) => (
                  <option key={staff.id} value={staff.name}>
                    {staff.name} - {staff.employeeCode}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="price">Doanh thu dự kiến</Label>
            <TextInput
              id="price"
              placeholder="Ví dụ: 50000000"
              value={formData.price}
              onChange={handleChange}
            />
          </div>
          <div>
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
            />
          </div>
        </form>
      </div>

      <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
        <Button color="gray" onClick={handleClose}>
          Hủy
        </Button>
        <Button
          type="submit"
          form="add-customer-form"
          className="bg-orange-500 hover:bg-orange-600"
        >
          Lưu
        </Button>
      </div>
    </Modal>
  );
};

export default CustomerModal;
