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
import type { Task, CustomerDetailModalProps, Employee } from "../../types";
import { VISA_SERVICES, CUSTOMER_SOURCES } from "../../utils/constants";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const JOB_TYPES = [
  "Nông nghiệp",
  "Nhà hàng",
  "Y tế",
  "Nail",
  "Kỹ thuật",
  "Công nghệ thông tin",
  "Xây dựng",
  "Làm đẹp",
  "Chăm sóc khách hàng",
  "Khác",
];

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
  const [staffList, setStaffList] = useState<Employee[]>([]);

  const [newNote, setNewNote] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData(task);
  }, [task]);

  useEffect(() => {
    if (show) {
      fetch(`${API_URL}/api/hr/employees`)
        .then((r) => r.json())
        .then((data: Employee[]) => setStaffList(data))
        .catch(console.error);
    }
  }, [show]);

  if (!task || !formData) return null;

  const handleChange = (field: keyof Task, value: string) => {
    setSaved(false);
    setFormData((prev) => {
      if (!prev) return null;
      const updatedData = { ...prev, [field]: value };

      // Nếu đổi Visa Type thì cập nhật lại Tên Khách Hàng (content) và Tự động gợi ý Nhóm Hồ Sơ
      if (field === "visaType") {
        // Không cập nhật content khi đang ở trạng thái tạm "Khác" (chưa nhập xong)
        if (value !== "Khác") {
          const namePart = prev.content.split(" - ")[0];
          updatedData.content = `${namePart} - ${value}`;
        }

        // Không tự động thay đổi checklistType khi chọn "Khác" — giữ nguyên để user tự chọn
        if (value !== "Khác") {
          const lowerValue = value.toLowerCase();
          if (
            lowerValue.includes("lao động") ||
            lowerValue.includes("tay nghề") ||
            lowerValue.includes("việc làm") ||
            lowerValue.includes("work")
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

  const handleSendUpdate = async () => {
    if (!newNote.trim() && !selectedFile) return;
    setIsSubmittingNote(true);

    try {
      const activityData = {
        taskId: formData.id,
        type: selectedFile ? "Tài liệu" : "Ghi chú",
        summary:
          newNote ||
          (selectedFile ? `Đã tải lên tài liệu: ${selectedFile.name}` : ""),
        assignee: currentUser?.name || formData.assignedTo || "Hệ thống",
        status: "Hoàn thành",
        completed: true,
        fileName: selectedFile?.name || undefined,
        fileUrl:
          previewUrl ||
          (selectedFile && !previewUrl ? "document-icon" : undefined),
      };

      const response = await fetch(`${API_URL}/api/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityData),
      });

      if (!response.ok) throw new Error("Lỗi lưu ghi chú");

      const savedActivity = await response.json();

      setFormData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          activities: [savedActivity, ...(prev.activities || [])],
        };
      });

      setNewNote("");
      clearFile();
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

  // Logic kiểm tra xem Ngành nghề đang lưu có phải là Custom (tự nhập) không
  const currentJobType = formData.jobType || "";
  const isCustomJob =
    currentJobType !== "" &&
    !JOB_TYPES.includes(currentJobType) &&
    currentJobType !== "Khác";

  // Logic kiểm tra xem Visa Type đang lưu có phải là Custom (tự nhập) không
  const currentVisaType = formData.visaType || "";
  const isCustomVisa =
    currentVisaType !== "" &&
    !VISA_SERVICES.some((v) => v.name === currentVisaType) &&
    currentVisaType !== "Khác";

  return (
    <Modal
      show={show}
      onClose={onClose}
      size="6xl"
      className="md:p-4"
      dismissible
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-t border-b border-gray-200 p-4 sm:p-5 bg-gray-50 gap-3">
        <div className="flex items-center gap-3 w-full">
          <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-orange-400 text-white rounded-lg flex items-center justify-center text-xl sm:text-2xl font-bold shadow-sm">
            {formData.content?.charAt(0) || "K"}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-2xl font-bold text-gray-800 truncate">
              {formData.content}
            </h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1 mt-1">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 font-medium">
                <span className="shrink-0">Phí:</span>
                <input
                  type="text"
                  value={formData.price || ""}
                  onChange={(e) => handleChange("price", e.target.value)}
                  className="border-b border-dashed border-gray-300 bg-transparent p-0 font-bold text-gray-800 focus:ring-0 focus:border-orange-500 w-full sm:w-32 max-w-[150px]"
                  placeholder="Ví dụ: 50.000.000 đ"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 font-medium mt-1 sm:mt-0">
                <span className="text-orange-600 font-bold shrink-0">👤 Sale:</span>
                <select
                  value={formData.assignedTo || ""}
                  onChange={(e) => handleChange("assignedTo", e.target.value)}
                  className="border-b border-dashed border-gray-300 bg-transparent p-0 font-semibold text-gray-800 focus:ring-0 focus:border-orange-500 outline-none cursor-pointer text-xs sm:text-sm"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.name}>
                      {staff.name} - {staff.employeeCode}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end w-full sm:w-auto gap-2 mt-2 sm:mt-0">
          {saved && (
            <span className="text-green-600 text-xs sm:text-sm font-medium animate-pulse hidden sm:inline">
              ✓ Đã lưu
            </span>
          )}
          <Button
            color={saved ? "gray" : "success"}
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="whitespace-nowrap"
          >
            {isSaving ? <Spinner size="sm" className="mr-2" /> : null}
            {isSaving ? "Đang lưu..." : saved ? "Đã lưu" : "Lưu thay đổi"}
          </Button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors bg-gray-200 sm:bg-transparent"
          >
            <svg
              className="h-5 w-5 sm:h-6 sm:w-6"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-0 flex flex-col md:flex-row max-h-[75vh] md:h-[70vh] overflow-hidden">
        {/* CỘT TRÁI - THÔNG TIN CHI TIẾT */}
        <div className="w-full md:w-[60%] p-4 sm:p-6 border-b md:border-b-0 md:border-r border-gray-200 overflow-y-auto bg-white custom-scrollbar h-[50vh] md:h-full">
          <h4 className="font-semibold text-orange-600 mb-3 border-b pb-1 text-xs sm:text-sm uppercase">
            Thông tin Liên hệ
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div>
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
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
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
                Email
              </Label>
              <TextInput
                sizing="sm"
                value={formData.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Diện Visa có hỗ trợ tự nhập */}
            <div>
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
                Diện Visa Quan Tâm
              </Label>
              <Select
                sizing="sm"
                value={isCustomVisa ? "Khác" : currentVisaType}
                // SỬA Ở ĐÂY: Lưu trực tiếp giá trị e.target.value (kể cả là chữ "Khác")
                onChange={(e) => handleChange("visaType", e.target.value)}
                className="mt-1"
              >
                <option value="">-- Chọn diện Visa --</option>
                {VISA_SERVICES.map((visa) => (
                  <option key={visa.id} value={visa.name}>
                    {visa.flag} {visa.name}
                  </option>
                ))}
                <option value="Khác">✏️ Khác (Tự nhập...)</option>
              </Select>

              {(currentVisaType === "Khác" || isCustomVisa) && (
                <TextInput
                  sizing="sm"
                  placeholder="Nhập tên diện Visa..."
                  value={currentVisaType === "Khác" ? "" : currentVisaType}
                  // SỬA Ở ĐÂY: Nếu người dùng xoá hết text, gán lại thành "Khác" để giữ ô input không bị biến mất
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange("visaType", val === "" ? "Khác" : val);
                  }}
                  className="mt-2"
                  autoFocus
                />
              )}
            </div>

            {/* BỔ SUNG: Cho phép chủ động chọn Nhóm bộ hồ sơ */}
            <div>
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
                Nhóm bộ hồ sơ
              </Label>
              <Select
                sizing="sm"
                value={formData.checklistType || "tourism"}
                onChange={(e) => handleChange("checklistType", e.target.value)}
                className="mt-1 font-bold text-blue-700"
              >
                <option value="tourism">✈️ Du lịch / Thăm thân</option>
                <option value="study">🎓 Du học</option>
                <option value="labor">👷‍♂️ Lao động / Việc làm</option>
              </Select>
            </div>

            {/* CHỌN VÀ NHẬP NGÀNH NGHỀ CHI TIẾT */}
            <div>
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
                Ngành nghề / Diện đi
              </Label>
              <Select
                sizing="sm"
                value={isCustomJob ? "Khác" : currentJobType}
                onChange={(e) => handleChange("jobType", e.target.value)}
                className="mt-1"
              >
                <option value="">-- Chọn ngành --</option>
                {JOB_TYPES.map((job) => (
                  <option key={job} value={job}>
                    {job}
                  </option>
                ))}
                <option value="Khác">✏️ Khác (Tự nhập...)</option>
              </Select>

              {/* Box hiện thêm nếu là Khác hoặc tự gõ */}
              {(currentJobType === "Khác" || isCustomJob) && (
                <TextInput
                  sizing="sm"
                  placeholder="Nhập ngành nghề khác..."
                  value={currentJobType === "Khác" ? "" : currentJobType}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange("jobType", val === "" ? "Khác" : val);
                  }}
                  className="mt-2"
                  autoFocus
                />
              )}
            </div>

            <div>
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
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

          <h4 className="font-semibold text-orange-600 mb-3 border-b pb-1 text-xs sm:text-sm uppercase">
            Hồ sơ Pháp lý & Di trú
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div>
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
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
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
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
            <div className="sm:col-span-2">
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
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

          <h4 className="font-semibold text-orange-600 mb-3 border-b pb-1 text-xs sm:text-sm uppercase">
            Đánh giá Năng lực
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div>
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
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
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
                Điểm IELTS/PTE
              </Label>
              <TextInput
                sizing="sm"
                value={formData.englishScore || ""}
                onChange={(e) => handleChange("englishScore", e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[10px] sm:text-xs uppercase text-gray-400">
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

          <h4 className="font-semibold text-orange-600 mb-3 border-b pb-1 text-xs sm:text-sm uppercase">
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
        <div className="w-full md:w-[40%] bg-gray-50 flex flex-col md:border-l border-gray-200 h-[50vh] md:h-full">
          <div className="p-3 sm:p-4 border-b border-gray-200 bg-white shadow-sm z-10 shrink-0">
            <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase mb-2">
              Ghi chú mới
            </p>

            <Textarea
              placeholder="Nhập ghi chú nhanh..."
              rows={2}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="bg-gray-50 border-none focus:ring-1 focus:ring-orange-500 shadow-inner mb-2 text-xs sm:text-sm"
            />

            {selectedFile && (
              <div className="mb-2 relative inline-block">
                {previewUrl ? (
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-gray-300 shadow-sm">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 p-1.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200 max-w-[200px]">
                    📄{" "}
                    <span className="truncate font-medium">
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

            <div className="flex justify-between items-center mt-1">
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
                  className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-gray-500 hover:text-orange-600 transition-colors bg-gray-100 hover:bg-orange-50 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-lg"
                >
                  <svg
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4"
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
                  <Spinner size="sm" className="mr-1" />
                ) : null}
                {isSubmittingNote ? "Gửi..." : "Gửi"}
              </Button>
            </div>
          </div>

          {/* LIST TIMELINE */}
          <div className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-3 custom-scrollbar bg-gray-50 pb-10">
            {formData.activities && formData.activities.length > 0 ? (
              formData.activities.map((act) => (
                <div
                  key={act.id}
                  className="bg-white p-2.5 sm:p-3 rounded-lg border border-gray-200 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 bg-indigo-500 rounded-full flex items-center justify-center text-[10px] sm:text-xs text-white font-bold uppercase shadow-sm">
                        {act.assignee?.charAt(0) || "S"}
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-gray-800">
                        {act.assignee}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[11px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {new Date(act.createdAt).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap ml-7 sm:ml-9">
                    {act.summary}
                  </p>

                  {act.fileUrl && act.fileUrl !== "document-icon" && (
                    <div className="mt-2 ml-7 sm:ml-9">
                      <img
                        src={act.fileUrl}
                        alt={act.fileName}
                        className="rounded-lg border border-gray-200 max-h-32 sm:max-h-48 object-contain cursor-pointer hover:opacity-90 shadow-sm"
                      />
                    </div>
                  )}
                  {act.fileName && act.fileUrl === "document-icon" && (
                    <div className="mt-1.5 sm:mt-2 ml-7 sm:ml-9 flex items-center gap-1.5 p-1.5 sm:p-2 bg-blue-50 rounded-lg border border-blue-100 text-xs sm:text-sm w-fit">
                      <span className="text-sm sm:text-lg">📄</span>
                      <span className="text-blue-700 font-medium truncate max-w-[150px] sm:max-w-[200px]">
                        {act.fileName}
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2 opacity-60 mt-6 sm:mt-10 pb-6">
                <svg
                  className="w-8 h-8 sm:w-12 sm:h-12"
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
                <p className="text-xs sm:text-sm italic font-medium">
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
