import React, { useState, useEffect } from "react";
import { Modal, Button, Select, Badge, Spinner } from "flowbite-react";
import type { Task } from "../../types";
import {
  getRequirementsList,
  getLaborRequirements,
  getStudyAbroadRequirements,
} from "../../utils/constants";

interface DocumentModalProps {
  show: boolean;
  onClose: () => void;
  taskId: string | null;
  task: Task | null;
}

// Định nghĩa kiểu dữ liệu cho file được lưu
interface SavedFile {
  name: string;
  url: string;
}

const DocumentModal: React.FC<DocumentModalProps> = ({
  show,
  onClose,
  taskId,
  task,
}) => {
  const [visaType, setVisaType] = useState<string>("Du lịch visa 600 (Úc)");
  const [jobType, setJobType] = useState("Nhân viên");
  const [checklistType, setChecklistType] = useState("tourism");

  // State lưu trữ tên và URL của file đã upload
  const [uploadedFiles, setUploadedFiles] = useState<{
    [key: string]: SavedFile[];
  }>({});

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (show && taskId) {
      const fetchLatestData = async () => {
        try {
          const res = await fetch(`http://localhost:3001/api/board`);
          const data = await res.json();
          const currentTask = data.tasks[taskId];
          if (currentTask) {
            setVisaType(currentTask.visaType || "Du lịch visa 600 (Úc)");
            setJobType(currentTask.jobType || "Nhân viên");
            setChecklistType(currentTask.checklistType || "tourism");
            setUploadedFiles(currentTask.documents || {});
          }
        } catch (error) {
          console.error("Lỗi đồng bộ dữ liệu hồ sơ:", error);
        }
      };
      fetchLatestData();
    } else if (!show) {
      setUploadedFiles({});
      setJobType("Nhân viên");
      setChecklistType("tourism");
    }
  }, [show, taskId]);

  // ==========================================
  // XỬ LÝ UPLOAD FILE THẬT
  // ==========================================
  const handleFileUpload = async (
    reqId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsUploading(true);
    const files = Array.from(e.target.files);
    const successfullyUploaded: SavedFile[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("http://localhost:3001/api/tasks/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          successfullyUploaded.push(data);
        } else {
          console.error("Lỗi khi tải lên file:", file.name);
        }
      } catch (error) {
        console.error("Lỗi mạng khi tải lên:", error);
      }
    }

    if (successfullyUploaded.length > 0) {
      setUploadedFiles((prev) => ({
        ...prev,
        [reqId]: [...(prev[reqId] || []), ...successfullyUploaded],
      }));
    }

    setIsUploading(false);
    e.target.value = ""; // Reset input
  };

  // ==========================================
  // XÓA VÀ TẢI FILE ĐÃ UPLOAD
  // ==========================================
  const handleRemoveFile = (reqId: string, indexToRemove: number) => {
    setUploadedFiles((prev) => {
      const updatedFiles = prev[reqId].filter(
        (_, index) => index !== indexToRemove,
      );
      return { ...prev, [reqId]: updatedFiles };
    });
  };

  const handleDownloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(`http://localhost:3001${fileUrl}`);
      if (!response.ok) throw new Error("Không thể tải file");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Đã xảy ra lỗi khi tải file xuống!");
    }
  };

  // ==========================================
  // LƯU DB
  // ==========================================
  const handleSaveToBackend = async () => {
    if (!taskId) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/tasks/${taskId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documents: uploadedFiles,
            jobType: jobType,
            checklistType: checklistType,
          }),
        },
      );

      if (!response.ok) throw new Error("Lỗi khi lưu tài liệu");

      window.dispatchEvent(new Event("refreshBoard"));
      alert("Lưu hồ sơ thành công!");
      onClose();
    } catch (error) {
      console.error(error);
      alert("Lỗi khi lưu hồ sơ!");
    } finally {
      setIsSaving(false);
    }
  };

  // Lấy danh sách checklist
  let requirements: any[] = [];
  if (checklistType === "tourism") {
    requirements = getRequirementsList(jobType);
  } else if (checklistType === "labor") {
    requirements = getLaborRequirements();
  } else if (checklistType === "study") {
    requirements = getStudyAbroadRequirements();
  }

  const sections = Array.from(new Set(requirements.map((r) => r.section)));

  return (
    <Modal show={show} onClose={onClose} size="5xl">
      <div className="p-5 border-b border-gray-200 bg-blue-50/50 rounded-t-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-blue-800 flex items-center gap-2">
            Thu thập hồ sơ:{" "}
            <span className="text-gray-800">
              {task?.content.split(" - ")[0]}
            </span>
          </h3>
          <p className="text-xs text-blue-600 mt-1 font-bold">
            Diện dự kiến: {visaType}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <Select
            sizing="sm"
            value={checklistType}
            onChange={(e) => setChecklistType(e.target.value)}
            className="w-48 font-bold text-blue-700"
          >
            <option value="tourism">✈️ Visa Du Lịch/Thăm Thân</option>
            <option value="labor">👷‍♂️ Visa Lao Động Quốc Tế</option>
            <option value="study">🎓 Visa Du Học</option>
          </Select>

          {checklistType === "tourism" && (
            <Select
              sizing="sm"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              className="w-40"
            >
              <option value="Nhân viên">Nhân viên</option>
              <option value="Chủ doanh nghiệp">Chủ doanh nghiệp</option>
            </Select>
          )}
        </div>
      </div>

      <div className="p-0 overflow-y-auto max-h-[65vh]">
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 w-12 text-center">STT</th>
              <th className="px-4 py-3 w-1/3">Giấy tờ yêu cầu</th>
              <th className="px-4 py-3 w-1/4">Ghi chú</th>
              <th className="px-4 py-3 w-16 text-center">Bắt buộc</th>
              <th className="px-4 py-3 text-right min-w-50">
                Tài liệu đính kèm
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sections.map((sectionName) => (
              <React.Fragment key={sectionName}>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <td
                    colSpan={5}
                    className="px-4 py-2 font-bold text-gray-800 text-left pl-6 uppercase text-[11px] tracking-widest bg-blue-50/30"
                  >
                    {sectionName}
                  </td>
                </tr>
                {requirements
                  .filter((r) => r.section === sectionName)
                  .map((req, idx) => {
                    const files = uploadedFiles[req.id] || [];
                    return (
                      <tr
                        key={req.id}
                        className={`hover:bg-blue-50/20 transition-colors ${files.length > 0 ? "bg-green-50/10" : ""}`}
                      >
                        <td className="px-4 py-3 text-center font-medium text-gray-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          {/* NÂNG CẤP: GẮN NÚT TẢI FORM MẪU VÀO ĐÂY */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-700">
                                {req.name}
                              </span>
                              {req.templateUrl && (
                                <a
                                  href={req.templateUrl}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200 transition-colors shadow-sm"
                                  title="Tải form mẫu về máy"
                                >
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    ></path>
                                  </svg>
                                  Tải Form
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 italic">
                          {req.note}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {req.required ? (
                            <span className="text-red-500 font-bold text-lg">
                              *
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5 items-end">
                            {files.map((file, index) => (
                              <Badge
                                key={index}
                                color="success"
                                className="w-fit flex items-center gap-1 group pl-2 pr-1"
                              >
                                ✅{" "}
                                <span
                                  title={file.name}
                                  className="truncate max-w-25 mr-1"
                                >
                                  {file.name}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDownloadFile(file.url, file.name);
                                  }}
                                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded opacity-60 group-hover:opacity-100 transition-all"
                                  title="Tải file về máy"
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
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() =>
                                    handleRemoveFile(req.id, index)
                                  }
                                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded opacity-60 group-hover:opacity-100 transition-all font-bold"
                                  title="Xóa file này"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                            <label className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 px-3 py-1 rounded text-[11px] font-medium transition-colors shadow-sm mt-1 inline-flex items-center gap-1">
                              {isUploading ? (
                                <Spinner size="sm" />
                              ) : files.length > 0 ? (
                                "Thêm file"
                              ) : (
                                "Tải file lên"
                              )}
                              <input
                                type="file"
                                multiple
                                className="hidden"
                                disabled={isUploading}
                                onChange={(e) => handleFileUpload(req.id, e)}
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
        <Button color="gray" onClick={onClose}>
          Đóng
        </Button>
        <Button
          color="blue"
          onClick={handleSaveToBackend}
          disabled={isSaving || isUploading}
        >
          {isSaving ? "Đang lưu..." : "Lưu Hồ Sơ"}
        </Button>
      </div>
    </Modal>
  );
};

export default DocumentModal;
