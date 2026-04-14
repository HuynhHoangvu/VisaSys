import React, { useState } from "react";
import {
  Modal,
  Button,
  Label,
  TextInput,
  Select,
  Textarea,
} from "flowbite-react";
import { type LeaveRequestData } from "../../types";

interface LeaveRequestModalProps {
  show: boolean;
  onClose: () => void;
  employeeName: string;
  onSubmit: (data: LeaveRequestData) => void;
}

const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({
  show,
  onClose,
  employeeName,
  onSubmit,
}) => {
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !startDate || !endDate || !reason) {
      alert("Vui lòng điền đầy đủ thông tin nghỉ phép!");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      alert("Ngày kết thúc không được nhỏ hơn ngày bắt đầu!");
      return;
    }

    onSubmit({ type, startDate, endDate, reason });
    handleClose();
  };

  const handleClose = () => {
    setType("");
    setStartDate("");
    setEndDate("");
    setReason("");
    onClose();
  };

  return (
    <Modal show={show} onClose={handleClose} size="md" className="md:p-4">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
            Đơn Xin Phép
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Nhân viên: <strong className="text-blue-600">{employeeName}</strong>
          </p>
        </div>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-900 bg-gray-200 hover:bg-gray-300 rounded-full p-1.5 transition-colors"
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

      {/* Body Form - Cuộn được trên mobile */}
      <div className="p-4 sm:p-6 overflow-y-auto max-h-[65vh]">
        <form
          id="leave-request-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="leaveType" className="text-xs sm:text-sm">
              Loại nghỉ phép (*)
            </Label>
            <Select
              id="leaveType"
              required
              sizing="sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">-- Chọn loại --</option>
              <option value="Vô trễ">Vô trễ (Đi muộn)</option>
              <option value="Về sớm">Về Sớm</option>
              <option value="Nửa ngày">Nửa ngày (0.5 ngày)</option>
              <option value="Xin phép nghỉ">Xin phép nghỉ (nguyên ngày)</option>
              <option value="Nghỉ ốm">Nghỉ ốm (Đau ốm/Khám bệnh)</option>
              <option value="Nghỉ việc riêng">Việc riêng (Hiếu hỷ/Khác)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate" className="text-xs sm:text-sm">
                Từ ngày (*)
              </Label>
              <TextInput
                type="date"
                id="startDate"
                required
                sizing="sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-xs sm:text-sm">
                Đến ngày (*)
              </Label>
              <TextInput
                type="date"
                id="endDate"
                required
                sizing="sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reason" className="text-xs sm:text-sm">
              Lý do cụ thể (*)
            </Label>
            <Textarea
              id="reason"
              rows={3}
              required
              placeholder="Ghi rõ lý do..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-sm"
            />
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="p-4 sm:p-5 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
        <Button color="gray" size="sm" onClick={handleClose}>
          Hủy
        </Button>
        <Button
          type="submit"
          form="leave-request-form"
          color="failure"
          size="sm"
        >
          Gửi Đơn Xin Phép
        </Button>
      </div>
    </Modal>
  );
};

export default LeaveRequestModal;
