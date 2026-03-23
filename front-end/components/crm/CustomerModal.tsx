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
  onAddCustomer: (customer: Partial<Task>) => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Định nghĩa form data chấp nhận chuỗi rỗng để không bị lỗi Type
interface CustomerFormData {
  name: string;
  service: string;
  price: string;
  phone: string;
  email: string;
  description: string;
  source: Task["source"] | ""; // Chấp nhận kiểu của Task HOẶC chuỗi rỗng
  assignedTo: string;
}

const initialFormState: CustomerFormData = {
  name: "",
  service: "",
  price: "",
  phone: "",
  email: "",
  description: "",
  source: "",
  assignedTo: "",
};

const CustomerModal: React.FC<CustomerModalProps> = ({
  show,
  onClose,
  onAddCustomer,
}) => {
  const [salesStaff, setSalesStaff] = useState<Employee[]>([]);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormState);

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
          const response = await fetch(`${API_URL}/api/hr/employees`);
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
      // Ép kiểu về đúng định dạng mong đợi của Task
      source: source === "" ? undefined : (source as Task["source"]),
      assignedTo,
      activities: [],
      visaType: service,
      checklistType: autoChecklistType,
      createdAt: new Date().toISOString(),
    });
    handleClose();
  };

  const handleClose = () => {
    setFormData(initialFormState);
    onClose();
  };

  return (
    <Modal show={show} onClose={handleClose} size="lg" className="md:p-4">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800">
          Thêm Khách Hàng Mới
        </h3>
      </div>
      {/* CUỘN ĐƯỢC TRÊN MOBILE */}
      <div className="p-4 sm:p-6 max-h-[70vh] overflow-y-auto">
        <form
          id="add-customer-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="text-xs sm:text-sm">
                Họ và Tên (*)
              </Label>
              <TextInput
                id="name"
                required
                value={formData.name}
                onChange={handleChange}
                sizing="sm"
              />
            </div>
            <div>
              <Label htmlFor="service" className="text-xs sm:text-sm">
                Diện Visa (*)
              </Label>
              <Select
                id="service"
                required
                value={formData.service}
                onChange={handleChange}
                sizing="sm"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone" className="text-xs sm:text-sm">
                Số điện thoại (*)
              </Label>
              <TextInput
                id="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                sizing="sm"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-xs sm:text-sm">
                Email
              </Label>
              <TextInput
                id="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                sizing="sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="source" className="text-xs sm:text-sm">
                Nguồn khách
              </Label>
              <Select
                id="source"
                value={formData.source}
                onChange={handleChange}
                sizing="sm"
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
              <Label htmlFor="assignedTo" className="text-xs sm:text-sm">
                Sale phụ trách
              </Label>
              <Select
                id="assignedTo"
                value={formData.assignedTo}
                onChange={handleChange}
                sizing="sm"
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
            <Label htmlFor="price" className="text-xs sm:text-sm">
              Doanh thu dự kiến
            </Label>
            <TextInput
              id="price"
              placeholder="Ví dụ: 50000000"
              value={formData.price}
              onChange={handleChange}
              sizing="sm"
            />
          </div>
          <div>
            <Label htmlFor="description" className="text-xs sm:text-sm">
              Mô tả
            </Label>
            <Textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
            />
          </div>
        </form>
      </div>
      <div className="p-4 sm:p-6 border-t border-gray-200 flex justify-end gap-2">
        <Button color="gray" onClick={handleClose} size="sm">
          Hủy
        </Button>
        <Button
          type="submit"
          form="add-customer-form"
          className="bg-orange-500 hover:bg-orange-600"
          size="sm"
        >
          Lưu
        </Button>
      </div>
    </Modal>
  );
};

export default CustomerModal;
