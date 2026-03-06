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

    // Kiểm tra ngày hợp lệ (Ngày kết thúc không được nhỏ hơn ngày bắt đầu)
    if (new Date(endDate) < new Date(startDate)) {
      alert("Ngày kết thúc không hợp lệ!");
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
    <Modal show={show} onClose={handleClose} size="md">
      {/* Header */}
      <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Đơn Xin Nghỉ Phép</h3>
          <p className="text-sm text-gray-500 mt-1">
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

      {/* Body Form */}
      <div className="p-6">
        <form
          id="leave-request-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="leaveType">Loại nghỉ phép (*)</Label>
            <Select
              id="leaveType"
              required
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">-- Chọn loại --</option>
              <option value="Nghỉ ốm">Nghỉ ốm</option>
              <option value="Nghỉ phép năm">Nghỉ phép năm</option>
              <option value="Việc cá nhân">Việc cá nhân</option>
              <option value="Nghỉ thai sản">Nghỉ thai sản</option>
              <option value="Nghỉ không lương">Nghỉ không lương</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Từ ngày (*)</Label>
              <TextInput
                type="date"
                id="startDate"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Đến ngày (*)</Label>
              <TextInput
                type="date"
                id="endDate"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reason">Lý do nghỉ (*)</Label>
            <Textarea
              id="reason"
              rows={3}
              required
              placeholder="Ghi rõ lý do xin nghỉ..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
        <Button color="gray" onClick={handleClose}>
          Hủy
        </Button>
        <Button type="submit" form="leave-request-form" color="failure">
          Gửi Đơn Xin Nghỉ
        </Button>
      </div>
    </Modal>
  );
};

export default LeaveRequestModal;
