import React, { useState, useEffect, useMemo } from "react";
import { Modal, Button, Select, Badge, Spinner } from "flowbite-react";
import type { Task, Requirement } from "../../types";
import {
  getRequirementsList,
  getLaborRequirements,
  getStudyAbroadRequirements,
} from "../../utils/constants";
import DocumentFilterBar from "../Filter/DocumentFilterBar"; // <-- IMPORT TỪ FILE MỚI VỪA TẠO

interface DocumentModalProps {
  show: boolean;
  onClose: () => void;
  taskId: string | null;
  task: Task | null;
}

interface SavedFile {
  name: string;
  url: string;
}
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const DocumentModal: React.FC<DocumentModalProps> = ({
  show,
  onClose,
  taskId,
  task,
}) => {
  const [visaType, setVisaType] = useState<string>("Du lịch visa 600 (Úc)");
  const [jobType, setJobType] = useState("Nhân viên");
  const [checklistType, setChecklistType] = useState("tourism");

  const [uploadedFiles, setUploadedFiles] = useState<{
    [key: string]: SavedFile[];
  }>({});

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // ==========================================
  // STATE TÌM KIẾM & FILTER CHO TÀI LIỆU
  // ==========================================
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (show && taskId) {
      const fetchLatestData = async () => {
        try {
          const res = await fetch(`${API_URL}/api/board`);
          const data = await res.json();
          const currentTask = data.tasks[taskId];
          if (currentTask) {
            const vt = currentTask.visaType || "Du lịch visa 600 (Úc)";
            setVisaType(vt);
            setJobType(currentTask.jobType || "Nhân viên");
            setUploadedFiles(currentTask.documents || {});

            if (currentTask.checklistType) {
              setChecklistType(currentTask.checklistType);
            } else {
              const vtLower = vt.toLowerCase();
              if (
                vtLower.includes("lao động") ||
                vtLower.includes("work permit") ||
                vtLower.includes("việc làm")
              ) {
                setChecklistType("labor");
              } else if (
                vtLower.includes("du học") ||
                vtLower.includes("student") ||
                vtLower.includes("học")
              ) {
                setChecklistType("study");
              } else {
                setChecklistType("tourism");
              }
            }
          }
        } catch (error) {
          console.error("Lỗi đồng bộ dữ liệu hồ sơ:", error);
        }
      };
      fetchLatestData();
    } else if (!show) {
      // Reset toàn bộ khi đóng Modal
      setUploadedFiles({});
      setJobType("Nhân viên");
      setChecklistType("tourism");
      setSearchQuery("");
      setFilterStatus("all");
    }
  }, [show, taskId]);

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
        const res = await fetch(`${API_URL}/api/tasks/upload`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          successfullyUploaded.push(data);
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
    e.target.value = "";
  };

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
      const fullUrl = fileUrl.startsWith("http")
        ? fileUrl
        : `${API_URL}${fileUrl}`;
      const response = await fetch(fullUrl);
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
      alert("Đã xảy ra lỗi khi tải file xuống!" + error);
    }
  };

  const handleSaveToBackend = async () => {
    if (!taskId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: uploadedFiles,
          jobType: jobType,
          checklistType: checklistType,
        }),
      });

      if (!response.ok) throw new Error("Lỗi khi lưu tài liệu");
      window.dispatchEvent(new Event("refreshBoard"));
      alert("Lưu hồ sơ thành công!");
      onClose();
    } catch (error) {
      alert("Lỗi khi lưu hồ sơ!" + error);
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // LOGIC LỌC TÀI LIỆU
  // ==========================================
  const baseRequirements = useMemo((): Requirement[] => {
    // <-- Thêm kiểu Requirement[] ở đây
    if (checklistType === "tourism") return getRequirementsList(jobType);
    if (checklistType === "labor") return getLaborRequirements();
    if (checklistType === "study") return getStudyAbroadRequirements();
    return [];
  }, [checklistType, jobType]);

  const filteredRequirements = useMemo(() => {
    return baseRequirements.filter((req) => {
      // Lọc theo từ khóa
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !req.name?.toLowerCase().includes(q) &&
          !req.note?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      // Lọc theo trạng thái
      if (filterStatus !== "all") {
        const isUploaded =
          uploadedFiles[req.id] && uploadedFiles[req.id].length > 0;
        if (filterStatus === "uploaded" && !isUploaded) return false;
        if (filterStatus === "missing" && isUploaded) return false;
      }
      return true;
    });
  }, [baseRequirements, searchQuery, filterStatus, uploadedFiles]);

  const sections = Array.from(
    new Set(filteredRequirements.map((r) => r.section)),
  );

  return (
    <Modal show={show} onClose={onClose} size="6xl">
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

      {/* ✅ GỌI COMPONENT LỌC GIẤY TỜ VỪA TẠO VÀO ĐÂY */}
      
      <DocumentFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        filteredCount={filteredRequirements.length}
        totalCount={baseRequirements.length}
        onReset={() => {
          setSearchQuery("");
          setFilterStatus("all");
        }}
      />

      <div className="p-0 overflow-y-auto max-h-[50vh]">
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10 shadow-sm border-b border-gray-200">
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
            {sections.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-10 text-gray-400 italic"
                >
                  Không tìm thấy giấy tờ nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              sections.map((sectionName) => {
                const extraId = `extra_${sectionName.replace(/\s/g, "_")}`;
                const extraFiles = uploadedFiles[extraId] || [];

                return (
                  <React.Fragment key={sectionName}>
                    {/* TIÊU ĐỀ SECTION */}
                    <tr className="bg-gray-50 border-y border-gray-200">
                      <td
                        colSpan={5}
                        className="px-4 py-2 font-bold text-gray-800 text-left pl-6 uppercase text-[11px] tracking-widest bg-blue-50/30"
                      >
                        {sectionName}
                      </td>
                    </tr>

                    {/* CÁC HÀNG HỒ SƠ */}
                    {filteredRequirements
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
                                      className="flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 px-2 py-0.5 rounded text-2xs font-bold border border-indigo-200 transition-colors shadow-sm"
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
                                    className="w-fit flex items-center gap-1 group pl-2 pr-1 shadow-sm"
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
                                <label className="cursor-pointer bg-white border border-blue-200 hover:bg-blue-50 text-blue-600 px-3 py-1 rounded text-[11px] font-semibold transition-colors shadow-sm mt-1 inline-flex items-center gap-1">
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
                                    onChange={(e) =>
                                      handleFileUpload(req.id, e)
                                    }
                                  />
                                </label>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                    {/* HÀNG HỒ SƠ KHÁC */}
                    <tr className="hover:bg-yellow-50/30 transition-colors bg-yellow-50/10 border-t border-dashed border-yellow-200">
                      <td className="px-4 py-3 text-center font-bold text-yellow-400">
                        +
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-yellow-700 italic text-sm">
                          📎 Hồ sơ khác (nếu có)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 italic">
                        Tài liệu bổ sung thêm
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-300 text-xs">-</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 items-end">
                          {extraFiles.map((file, index) => (
                            <Badge
                              key={index}
                              color="warning"
                              className="w-fit flex items-center gap-1 group pl-2 pr-1 shadow-sm"
                            >
                              📎{" "}
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
                                onClick={() => handleRemoveFile(extraId, index)}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded opacity-60 group-hover:opacity-100 transition-all font-bold"
                                title="Xóa file này"
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                          <label className="cursor-pointer bg-yellow-50 border border-yellow-300 hover:bg-yellow-100 text-yellow-700 px-3 py-1 rounded text-[11px] font-medium transition-colors shadow-sm mt-1 inline-flex items-center gap-1">
                            {isUploading ? (
                              <Spinner size="sm" />
                            ) : extraFiles.length > 0 ? (
                              "Thêm file"
                            ) : (
                              "Tải file lên"
                            )}
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              disabled={isUploading}
                              onChange={(e) => handleFileUpload(extraId, e)}
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
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
