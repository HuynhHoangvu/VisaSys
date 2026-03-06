import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  Button,
  TextInput,
  Textarea,
  Select,
  Label,
  Spinner,
} from "flowbite-react";
// ĐẢM BẢO IMPORT VISA_SERVICES VÀ CUSTOMER_SOURCES
import type { Task, Activity } from "../../types";
import { VISA_SERVICES, CUSTOMER_SOURCES } from "../../utils/constants";

interface CustomerDetailModalProps {
  show: boolean;
  onClose: () => void;
  task: Task | null;
  onUpdateCustomer?: (updatedTask: Task) => void;
}

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  show,
  onClose,
  task,
  onUpdateCustomer,
}) => {
  const [formData, setFormData] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newNote, setNewNote] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Đảm bảo formData luôn đồng bộ khi prop task thay đổi
  useEffect(() => {
    setFormData(task);
  }, [task]);

  if (!task || !formData) return null;

  // LÀM MƯỢT LOGIC: Khi đổi Visa Type, tự động đổi luôn Tiêu đề hiển thị
const handleChange = (field: keyof Task, value: string) => {
    setSaved(false);
    setFormData((prev) => {
      if (!prev) return null;

      const updatedData = { ...prev, [field]: value };

      // KHI THAY ĐỔI DIỆN VISA
      if (field === "visaType") {
        // 1. Đổi đuôi Tiêu đề
        const namePart = prev.content.split(" - ")[0]; 
        updatedData.content = `${namePart} - ${value}`; 

        // 2. TỰ ĐỘNG ĐỒNG BỘ CHECKLIST TYPE
        const lowerValue = value.toLowerCase();
        if (lowerValue.includes("lao động") || lowerValue.includes("tay nghề") || lowerValue.includes("việc làm")) {
          updatedData.checklistType = "labor";
        } else if (lowerValue.includes("du học") || lowerValue.includes("student")) {
          updatedData.checklistType = "study";
        } else {
          updatedData.checklistType = "tourism"; // Mặc định là Du lịch
        }
      }

      return updatedData;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendActivity = () => {
    if (!newNote.trim() && !selectedFile) return;

    const activity: Activity = {
      id: `act-${Date.now()}`,
      taskId: formData.id,
      type: selectedFile ? "Tài liệu" : "Ghi chú",
      summary:
        newNote ||
        (selectedFile ? `Đã tải lên tài liệu: ${selectedFile.name}` : ""),
      assignee: formData.assignedTo || "System", // Nên thay bằng User hiện tại nếu có
      status: "Hoàn thành",
      completed: true,
      dueText: "Vừa xong",
      createdAt: new Date().toISOString(),
      fileName: selectedFile?.name,
      fileUrl:
        previewUrl ||
        (selectedFile && !previewUrl ? "document-icon" : undefined),
    };

    const updatedActivities = [activity, ...(formData.activities || [])];
    const updatedData = { ...formData, activities: updatedActivities };

    setFormData(updatedData);
    setNewNote("");
    clearFile();

    // Tự động lưu ngay khi gửi Ghi chú cho an toàn
    if (onUpdateCustomer) {
      onUpdateCustomer(updatedData);
    }
  };

  const handleSave = async () => {
    if (!onUpdateCustomer || !formData) return;
    setIsSaving(true);
    // Giả lập thời gian lưu để hiện Spinner cho đẹp
    await new Promise((resolve) => setTimeout(resolve, 400));
    onUpdateCustomer(formData);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 6000); // Tắt chữ "Đã lưu" sau 6 giây
  };

  return (
    <Modal show={show} onClose={onClose} size="6xl">
      <div className="flex items-start justify-between rounded-t border-b border-gray-200 p-5 bg-gray-50">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-orange-400 text-white rounded-lg flex items-center justify-center text-2xl font-bold shadow-sm">
            {formData.content?.charAt(0) || "K"}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">
              {formData.content}
            </h3>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-1">
              <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                <span>Doanh thu/Phí:</span>
                <input
                  type="text"
                  value={formData.price || ""}
                  onChange={(e) => handleChange("price", e.target.value)}
                  className="border-b border-dashed border-gray-300 bg-transparent p-0 font-bold text-gray-800 focus:ring-0 focus:border-orange-500 w-32"
                  placeholder="Ví dụ: 50.000.000 đ"
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                <span className="text-orange-600 font-bold">👤 Sale:</span>
                <span>{formData.assignedTo || "Chưa phân công"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-green-600 text-sm font-medium animate-pulse">
              ✓ Đã lưu
            </span>
          )}
          <Button
            color={saved ? "gray" : "success"}
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Spinner size="sm" className="mr-2" /> : null}
            {isSaving ? "Đang lưu..." : saved ? "Đã lưu" : "Lưu thay đổi"}
          </Button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* SỬA LỖI CSS TẠI ĐÂY: Dùng h-[70vh] thay cho h-162.5 */}
      <div className="p-0 flex flex-col md:flex-row h-[70vh]">
        <div className="w-full md:w-[60%] p-6 border-r border-gray-200 overflow-y-auto bg-white custom-scrollbar">
          <h4 className="font-semibold text-orange-600 mb-3 border-b pb-1 text-sm uppercase">
            Thông tin Liên hệ
          </h4>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <Label className="text-xs uppercase text-gray-400">
                Số điện thoại
              </Label>
              <TextInput
                sizing="sm"
                value={formData.phone || ""}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase text-gray-400">Email</Label>
              <TextInput
                sizing="sm"
                value={formData.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs uppercase text-gray-400">
                Diện Visa Quan Tâm
              </Label>
              <Select
                sizing="sm"
                value={formData.visaType || ""}
                onChange={(e) => handleChange("visaType", e.target.value)}
                className="mt-1"
              >
                <option value="">-- Chọn diện Visa --</option>
                {VISA_SERVICES.map((visa) => (
                  <option key={visa.id} value={visa.name}>
                    {visa.flag} {visa.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label className="text-xs uppercase text-gray-400">
                Nguồn khách
              </Label>
              <Select
                sizing="sm"
                value={formData.source || ""}
                onChange={(e) => handleChange("source", e.target.value)}
                className="mt-1"
              >
                <option value="">-- Chọn nguồn --</option>
                {CUSTOMER_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <h4 className="font-semibold text-orange-600 mb-3 border-b pb-1 text-sm uppercase">
            Hồ sơ Pháp lý & Di trú
          </h4>
          <div className="grid grid-cols-2 gap-4 mb-6">
            
            <div>
              <Label className="text-xs uppercase text-gray-400">
                Tình trạng hôn nhân
              </Label>
              <Select
                sizing="sm"
                value={formData.maritalStatus || ""}
                onChange={(e) => handleChange("maritalStatus", e.target.value)}
                className="mt-1"
              >
                <option value="">-- Chọn --</option>
                <option value="Độc thân">Độc thân</option>
                <option value="Đã kết hôn">Đã kết hôn</option>
                <option value="Đã ly hôn">Đã ly hôn</option>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-gray-400">
                Số người phụ thuộc (Vợ/Con)
              </Label>
              <TextInput
                type="number"
                sizing="sm"
                value={formData.dependents || 0}
                onChange={(e) => handleChange("dependents", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase text-gray-400">
                Ngày ưu tiên 
              </Label>
              <TextInput
                type="date"
                sizing="sm"
                value={formData.priorityDate || ""}
                onChange={(e) => handleChange("priorityDate", e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <h4 className="font-semibold text-orange-600 mb-3 border-b pb-1 text-sm uppercase">
            Đánh giá Năng lực 
          </h4>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <Label className="text-xs uppercase text-gray-400">
                Bằng cấp cao nhất
              </Label>
              <Select
                sizing="sm"
                value={formData.educationLevel || ""}
                onChange={(e) => handleChange("educationLevel", e.target.value)}
                className="mt-1"
              >
                <option value="">-- Chọn --</option>
                <option value="Cấp 3">Cấp 3 (THPT)</option>
                <option value="Trung cấp/Cao đẳng">Trung cấp / Cao đẳng</option>
                <option value="Đại học">Đại học</option>
                <option value="Thạc sĩ trở lên">Thạc sĩ trở lên</option>
                <option value="Không bằng cấp">Không bằng cấp</option>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-gray-400">
                Điểm IELTS/PTE
              </Label>
              <TextInput
                sizing="sm"
                value={formData.englishScore || ""}
                onChange={(e) => handleChange("englishScore", e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs uppercase text-gray-400">
                Kinh nghiệm làm việc
              </Label>
              <TextInput
                sizing="sm"
                value={formData.workExperience || ""}
                onChange={(e) => handleChange("workExperience", e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <h4 className="font-semibold text-orange-600 mb-3 border-b pb-1 text-sm uppercase">
            Đánh giá chi tiết / Lộ trình
          </h4>
          <div>
            <Textarea
              rows={4}
              value={formData.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>
        </div>

        {/* CỘT PHẢI - NHẬT KÝ TƯƠNG TÁC & UPLOAD */}
        <div className="w-full md:w-[40%] bg-gray-50 flex flex-col border-l border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-white">
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">
              Ghi chú & Tải tài liệu
            </p>

            <Textarea
              placeholder="Nhập ghi chú hoặc tải lên biên lai, hồ sơ..."
              rows={3}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="bg-gray-50 border-none focus:ring-1 focus:ring-orange-500 shadow-inner mb-2"
            />

            {selectedFile && (
              <div className="mb-3 relative inline-block">
                {previewUrl ? (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-300 shadow-sm">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 text-blue-700 rounded text-sm border border-blue-200">
                    📄{" "}
                    <span className="truncate max-w-37.5 font-medium">
                      {selectedFile.name}
                    </span>
                  </div>
                )}
                <button
                  onClick={clearFile}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex justify-between items-center mt-2">
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600 transition-colors"
                  title="Đính kèm tài liệu/hình ảnh"
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
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  <span className="font-medium">Đính kèm</span>
                </button>
              </div>

              <Button
                size="xs"
                color="warning"
                onClick={handleSendActivity}
                disabled={!newNote.trim() && !selectedFile}
              >
                Gửi cập nhật
              </Button>
            </div>
          </div>

          {/* LIST TIMELINE */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar">
            {formData.activities && formData.activities.length > 0 ? (
              formData.activities.map((act) => (
                <div
                  key={act.id}
                  className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-2xs text-white font-bold uppercase">
                        {act.assignee?.charAt(0) || "S"}
                      </div>
                      <span className="text-xs font-bold text-gray-700">
                        {act.assignee}
                      </span>
                    </div>
                    <span className="text-2xs text-gray-400">
                      {new Date(act.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {act.summary}
                  </p>

                  {act.fileUrl && act.fileUrl !== "document-icon" && (
                    <div className="mt-3">
                      <img
                        src={act.fileUrl}
                        alt={act.fileName}
                        className="rounded-lg border border-gray-200 max-h-48 object-contain cursor-pointer hover:opacity-90"
                      />
                    </div>
                  )}
                  {act.fileName && act.fileUrl === "document-icon" && (
                    <div className="mt-3 flex items-center gap-2 p-2 bg-gray-50 rounded-md border border-gray-200 text-sm">
                      <span className="text-xl">📄</span>
                      <a
                        href="#"
                        className="text-blue-600 hover:underline truncate max-w-full"
                        onClick={(e) => e.preventDefault()}
                      >
                        {act.fileName}
                      </a>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 text-sm mt-10 italic">
                Chưa có lịch sử hoạt động mới
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CustomerDetailModal;
