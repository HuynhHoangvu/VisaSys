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
import type { Task, CustomerDetailModalProps } from "../../types";
import { VISA_SERVICES, CUSTOMER_SOURCES } from "../../utils/constants";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  show,
  onClose,
  task,
  onUpdateCustomer,
  currentUser,
}) => {
  const [formData, setFormData] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // State cho phần Ghi chú & Upload
  const [newNote, setNewNote] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      if (field === "visaType") {
        const namePart = prev.content.split(" - ")[0];
        updatedData.content = `${namePart} - ${value}`;

        const lowerValue = value.toLowerCase();
        if (
          lowerValue.includes("lao động") ||
          lowerValue.includes("tay nghề") ||
          lowerValue.includes("việc làm")
        ) {
          updatedData.checklistType = "labor";
        } else if (
          lowerValue.includes("du học") ||
          lowerValue.includes("student")
        ) {
          updatedData.checklistType = "study";
        } else {
          updatedData.checklistType = "tourism";
        }
      }

      return updatedData;
    });
  };

  // Xử lý chọn file
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

  // Hủy chọn file
  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ==========================================
  // HÀM GỬI GHI CHÚ / FILE LÊN BACKEND THẬT
  // ==========================================
  const handleSendUpdate = async () => {
    if (!newNote.trim() && !selectedFile) return;

    setIsSubmittingNote(true);

    try {
      // 1. Tạo biến chứa dữ liệu cần gửi
      const activityData = {
        taskId: formData.id,
        type: selectedFile ? "Tài liệu" : "Ghi chú",
        summary:
          newNote ||
          (selectedFile ? `Đã tải lên tài liệu: ${selectedFile.name}` : ""),
        assignee: currentUser?.name || formData.assignedTo || "Hệ thống",
        status: "Hoàn thành",
        completed: true,
        // (Nếu sau này bạn có API up file thật ở đây thì xử lý up file lấy link trước,
        // ở code hiện tại ta tạm mô phỏng tên file)
        fileName: selectedFile?.name || undefined,
        fileUrl:
          previewUrl ||
          (selectedFile && !previewUrl ? "document-icon" : undefined),
      };

      // 2. Bắn lên Backend để lưu vào DB
      const response = await fetch(`${API_URL}/api/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityData),
      });

      if (!response.ok) throw new Error("Lỗi lưu ghi chú");

      const savedActivity = await response.json();

      // 3. Cập nhật lại UI ngay lập tức
      setFormData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          activities: [savedActivity, ...(prev.activities || [])],
        };
      });

      // 4. Xóa trắng form nhập
      setNewNote("");
      clearFile();

      // 5. Báo cho Board ngoài kia biết để re-render
      window.dispatchEvent(new Event("refreshBoard"));
    } catch (error) {
      console.error(error);
      alert("Đã xảy ra lỗi khi gửi cập nhật!");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleSave = async () => {
    if (!onUpdateCustomer || !formData) return;
    setIsSaving(true);

    try {
     await fetch(`${API_URL}/api/tasks/${formData.id}`, {
       method: "PUT",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(formData),
     });

      onUpdateCustomer(formData);
      setSaved(true);
      window.dispatchEvent(new Event("refreshBoard"));
      setTimeout(() => setSaved(false), 6000);
    } catch (err) {
      alert("Lỗi lưu thông tin khách hàng" + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
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
          <div className="p-4 border-b border-gray-200 bg-white shadow-sm z-10">
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">
              Ghi chú mới
            </p>

            <Textarea
              placeholder="Nhập ghi chú nhanh hoặc báo cáo tiến độ..."
              rows={3}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="bg-gray-50 border-none focus:ring-1 focus:ring-orange-500 shadow-inner mb-3 text-sm"
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
                    <span className="truncate max-w-[200px] font-medium">
                      {selectedFile.name}
                    </span>
                  </div>
                )}
                <button
                  onClick={clearFile}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 shadow-sm"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex justify-between items-center">
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
                  className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-orange-600 transition-colors bg-gray-100 hover:bg-orange-50 px-3 py-1.5 rounded-lg"
                  title="Đính kèm tài liệu/hình ảnh"
                >
                  <svg
                    className="w-4 h-4"
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
                  Đính kèm
                </button>
              </div>

              <Button
                size="sm"
                color="warning"
                onClick={handleSendUpdate}
                disabled={
                  (!newNote.trim() && !selectedFile) || isSubmittingNote
                }
                className="font-bold shadow-sm"
              >
                {isSubmittingNote ? (
                  <Spinner size="sm" className="mr-2" />
                ) : null}
                {isSubmittingNote ? "Đang gửi..." : "Gửi ghi chú"}
              </Button>
            </div>
          </div>

          {/* LIST TIMELINE */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar bg-gray-50">
            {formData.activities && formData.activities.length > 0 ? (
              formData.activities.map((act) => (
                <div
                  key={act.id}
                  className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center text-xs text-white font-bold uppercase shadow-sm">
                        {act.assignee?.charAt(0) || "S"}
                      </div>
                      <span className="text-sm font-bold text-gray-800">
                        {act.assignee}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                      {new Date(act.createdAt).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 whitespace-pre-wrap ml-9">
                    {act.summary}
                  </p>

                  {act.fileUrl && act.fileUrl !== "document-icon" && (
                    <div className="mt-3 ml-9">
                      <img
                        src={act.fileUrl}
                        alt={act.fileName}
                        className="rounded-lg border border-gray-200 max-h-48 object-contain cursor-pointer hover:opacity-90 shadow-sm"
                      />
                    </div>
                  )}
                  {act.fileName && act.fileUrl === "document-icon" && (
                    <div className="mt-2 ml-9 flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100 text-sm w-fit">
                      <span className="text-lg">📄</span>
                      <span className="text-blue-700 font-medium truncate max-w-[200px]">
                        {act.fileName}
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3 opacity-60 mt-10">
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-sm italic font-medium">
                  Chưa có ghi chú nào
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CustomerDetailModal;
