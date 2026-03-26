import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Modal, Button, Select, Spinner } from "flowbite-react";
import type { Task, Requirement } from "../../types";
import {
  getRequirementsList,
  getLaborRequirements,
  getStudyAbroadRequirements,
} from "../../utils/constants";
import DocumentFilterBar from "../filter/DocumentFilterBar";

interface DocumentModalProps {
  show: boolean;
  onClose: () => void;
  taskId: string | null;
  task: Task | null;
}

interface SavedFile {
  name: string;
  url: string;
  publicId?: string;
}

interface UploadPanel {
  rowId: string;
  rowName: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ──────────────────────────────────────────────
// Helpers: file type detection & icons
// ──────────────────────────────────────────────
const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
const PDF_EXTS = ["pdf"];
const WORD_EXTS = ["doc", "docx"];
const EXCEL_EXTS = ["xls", "xlsx"];

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isImage(name: string) {
  return IMAGE_EXTS.includes(getExt(name));
}

function FileTypeIcon({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  const ext = getExt(name);
  if (IMAGE_EXTS.includes(ext))
    return (
      <svg className={`${className} text-pink-400`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    );
  if (PDF_EXTS.includes(ext))
    return <span className={`font-black text-red-500 text-[10px] leading-none`}>PDF</span>;
  if (WORD_EXTS.includes(ext))
    return <span className={`font-black text-blue-600 text-[10px] leading-none`}>DOC</span>;
  if (EXCEL_EXTS.includes(ext))
    return <span className={`font-black text-green-600 text-[10px] leading-none`}>XLS</span>;
  return (
    <svg className={`${className} text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

// Badge with hover image preview
function FileBadge({
  file,
  color,
  onDownload,
  onRemove,
}: {
  file: SavedFile;
  color: "success" | "warning";
  onDownload: () => void;
  onRemove: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const colorCls =
    color === "success"
      ? "bg-green-100 text-green-800 border border-green-200"
      : "bg-yellow-100 text-yellow-800 border border-yellow-200";

  return (
    <div className="relative group/badge">
      <span
        className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded text-xs font-medium shadow-sm ${colorCls}`}
      >
        <FileTypeIcon name={file.name} className="w-3.5 h-3.5 shrink-0" />
        <span title={file.name} className="truncate max-w-[90px]">
          {file.name}
        </span>
        <button
          onClick={(e) => { e.preventDefault(); onDownload(); }}
          className="p-0.5 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded opacity-0 group-hover/badge:opacity-100 transition-all"
          title="Tải về"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        <button
          onClick={onRemove}
          className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded opacity-0 group-hover/badge:opacity-100 transition-all font-bold leading-none"
          title="Xóa"
        >
          ×
        </button>
      </span>

      {/* Hover image preview */}
      {isImage(file.name) && !imgErr && (
        <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/badge:flex z-50 pointer-events-none">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-1.5">
            <img
              src={file.url}
              alt={file.name}
              className="w-40 h-40 object-contain rounded-lg"
              onError={() => setImgErr(true)}
            />
            <p className="text-[10px] text-center text-gray-400 mt-1 truncate max-w-[160px]">{file.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Upload Panel (drag-and-drop overlay)
// ──────────────────────────────────────────────
function UploadPanelOverlay({
  panel,
  isUploading,
  onClose,
  onFiles,
}: {
  panel: UploadPanel;
  isUploading: boolean;
  onClose: () => void;
  onFiles: (rowId: string, files: FileList | File[]) => Promise<void>;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setPendingFiles(files);
    }
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPendingFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (pendingFiles.length > 0) {
      await onFiles(panel.rowId, pendingFiles);
      setPendingFiles([]);
      onClose();
    }
  };

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-[2px] rounded-b-lg"
      onClick={(e) => { if (e.target === e.currentTarget && !isUploading) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Tải tài liệu lên</p>
            <p className="text-sm font-bold text-blue-800 mt-0.5 truncate max-w-[300px]">{panel.rowName}</p>
          </div>
          {!isUploading && (
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-5">
          {isUploading ? (
            /* Uploading state */
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner size="xl" />
              <p className="text-sm font-semibold text-blue-600">Đang tải {pendingFiles.length} tệp lên...</p>
              <div className="w-full space-y-1.5 max-h-40 overflow-y-auto">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                    <FileTypeIcon name={f.name} className="w-4 h-4 shrink-0" />
                    <span className="text-xs text-gray-600 truncate flex-1">{f.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{formatSize(f.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : pendingFiles.length > 0 ? (
            /* Files selected – confirm upload */
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {pendingFiles.length} tệp đã chọn
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg">
                    <FileTypeIcon name={f.name} className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{f.name}</p>
                      <p className="text-[10px] text-gray-400">{formatSize(f.size)}</p>
                    </div>
                    <button
                      onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 p-0.5 rounded"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setPendingFiles([]); if (inputRef.current) inputRef.current.value = ""; }}
                  className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Chọn lại
                </button>
                <button
                  onClick={handleUpload}
                  className="flex-1 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                  Tải lên ngay
                </button>
              </div>
            </div>
          ) : (
            /* Drop zone */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none ${
                dragActive
                  ? "border-blue-500 bg-blue-50 scale-[1.02]"
                  : "border-gray-200 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/60"
              }`}
            >
              <div className={`text-4xl mb-3 transition-transform ${dragActive ? "scale-125" : ""}`}>
                {dragActive ? "📥" : "📂"}
              </div>
              <p className="text-sm font-bold text-gray-700">
                {dragActive ? "Thả tệp vào đây!" : "Kéo & thả tệp vào đây"}
              </p>
              <p className="text-xs text-gray-400 mt-1 mb-4">hoặc</p>
              <span className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Chọn tệp từ máy
              </span>
              <p className="text-[11px] text-gray-400 mt-3">PDF, Word, Excel, Ảnh · Tối đa 50MB/tệp</p>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
const DocumentModal: React.FC<DocumentModalProps> = ({ show, onClose, taskId, task }) => {
  const [visaType, setVisaType] = useState<string>("Du lịch visa 600 (Úc)");
  const [jobType, setJobType] = useState("Nhân viên");
  const [checklistType, setChecklistType] = useState("tourism");

  const [uploadedFiles, setUploadedFiles] = useState<{ [key: string]: SavedFile[] }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingRows, setUploadingRows] = useState<Set<string>>(new Set());
  const [uploadPanel, setUploadPanel] = useState<UploadPanel | null>(null);

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
              if (vtLower.includes("lao động") || vtLower.includes("work permit") || vtLower.includes("việc làm")) {
                setChecklistType("labor");
              } else if (vtLower.includes("du học") || vtLower.includes("student") || vtLower.includes("học")) {
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
      setUploadedFiles({});
      setJobType("Nhân viên");
      setChecklistType("tourism");
      setSearchQuery("");
      setFilterStatus("all");
      setUploadPanel(null);
    }
  }, [show, taskId]);

  const handleFileUpload = useCallback(async (reqId: string, fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploadingRows((prev) => new Set(prev).add(reqId));

    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`${API_URL}/api/tasks/upload`, { method: "POST", body: formData });
        if (res.ok) return (await res.json()) as SavedFile;
      } catch (error) {
        console.error("Lỗi mạng khi tải lên:", error);
      }
      return null;
    });

    const results = await Promise.all(uploadPromises);
    const uploaded = results.filter(Boolean) as SavedFile[];

    if (uploaded.length > 0) {
      setUploadedFiles((prev) => ({
        ...prev,
        [reqId]: [...(prev[reqId] || []), ...uploaded],
      }));
    }
    setUploadingRows((prev) => {
      const next = new Set(prev);
      next.delete(reqId);
      return next;
    });
  }, []);

  const handleRemoveFile = async (reqId: string, indexToRemove: number) => {
    const fileToRemove = uploadedFiles[reqId][indexToRemove];
    setUploadedFiles((prev) => ({
      ...prev,
      [reqId]: prev[reqId].filter((_, i) => i !== indexToRemove),
    }));
    if (fileToRemove.publicId) {
      try {
        await fetch(`${API_URL}/api/tasks/remove-cloud-file`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicId: fileToRemove.publicId }),
        });
      } catch (error) {
        console.error("Lỗi khi xoá file:", error);
      }
    }
  };

  const handleDownloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const fullUrl = fileUrl.startsWith("http") ? fileUrl : `${API_URL}${fileUrl}`;
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
      alert("Đã xảy ra lỗi khi tải file xuống! " + error);
    }
  };

  const handleSaveToBackend = async () => {
    if (!taskId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: uploadedFiles, jobType, checklistType }),
      });
      if (!response.ok) throw new Error("Lỗi khi lưu tài liệu");
      window.dispatchEvent(new Event("refreshBoard"));
      alert("Lưu hồ sơ thành công!");
      onClose();
    } catch (error) {
      alert("Lỗi khi lưu hồ sơ! " + error);
    } finally {
      setIsSaving(false);
    }
  };

  const baseRequirements = useMemo((): Requirement[] => {
    if (checklistType === "tourism") return getRequirementsList(jobType);
    if (checklistType === "labor") return getLaborRequirements();
    if (checklistType === "study") return getStudyAbroadRequirements();
    return [];
  }, [checklistType, jobType]);

  const filteredRequirements = useMemo(() => {
    return baseRequirements.filter((req) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!req.name?.toLowerCase().includes(q) && !req.note?.toLowerCase().includes(q)) return false;
      }
      if (filterStatus !== "all") {
        const hasFiles = uploadedFiles[req.id]?.length > 0;
        if (filterStatus === "uploaded" && !hasFiles) return false;
        if (filterStatus === "missing" && hasFiles) return false;
      }
      return true;
    });
  }, [baseRequirements, searchQuery, filterStatus, uploadedFiles]);

  const sections = Array.from(new Set(filteredRequirements.map((r) => r.section)));

  return (
    <Modal show={show} onClose={onClose} size="6xl" dismissible>
      {/* ── Header ── */}
      <div className="p-5 border-b border-gray-200 bg-blue-50/50 rounded-t-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-blue-800 flex items-center gap-2">
            Thu thập hồ sơ:{" "}
            <span className="text-gray-800">{task?.content.split(" - ")[0]}</span>
          </h3>
          <p className="text-xs text-blue-600 mt-1 font-bold">Diện dự kiến: {visaType}</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <Select sizing="sm" value={checklistType} onChange={(e) => setChecklistType(e.target.value)} className="w-48 font-bold text-blue-700">
            <option value="tourism">✈️ Visa Du Lịch/Thăm Thân</option>
            <option value="labor">👷‍♂️ Visa Lao Động Quốc Tế</option>
            <option value="study">🎓 Visa Du Học</option>
          </Select>
          {checklistType === "tourism" && (
            <Select sizing="sm" value={jobType} onChange={(e) => setJobType(e.target.value)} className="w-40">
              <option value="Nhân viên">Nhân viên</option>
              <option value="Chủ doanh nghiệp">Chủ doanh nghiệp</option>
            </Select>
          )}
        </div>
      </div>

      <DocumentFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        filteredCount={filteredRequirements.length}
        totalCount={baseRequirements.length}
        onReset={() => { setSearchQuery(""); setFilterStatus("all"); }}
      />

      {/* ── Table + Upload panel overlay ── */}
      <div className="relative p-0 overflow-y-auto max-h-[50vh]">
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10 shadow-sm border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-12 text-center">STT</th>
              <th className="px-4 py-3 w-1/3">Giấy tờ yêu cầu</th>
              <th className="px-4 py-3 w-1/4">Ghi chú</th>
              <th className="px-4 py-3 w-16 text-center">Bắt buộc</th>
              <th className="px-4 py-3 text-right min-w-50">Tài liệu đính kèm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sections.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400 italic">
                  Không tìm thấy giấy tờ nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              sections.map((sectionName) => {
                const extraId = `extra_${sectionName.replace(/\s/g, "_")}`;
                const extraFiles = uploadedFiles[extraId] || [];
                return (
                  <React.Fragment key={sectionName}>
                    {/* Section header */}
                    <tr className="bg-gray-50 border-y border-gray-200">
                      <td colSpan={5} className="px-4 py-2 font-bold text-gray-800 pl-6 uppercase text-[11px] tracking-widest bg-blue-50/30">
                        {sectionName}
                      </td>
                    </tr>

                    {/* Requirement rows */}
                    {filteredRequirements
                      .filter((r) => r.section === sectionName)
                      .map((req, idx) => {
                        const files = uploadedFiles[req.id] || [];
                        return (
                          <tr key={req.id} className={`hover:bg-blue-50/20 transition-colors ${files.length > 0 ? "bg-green-50/10" : ""}`}>
                            <td className="px-4 py-3 text-center font-medium text-gray-400">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-700">{req.name}</span>
                                {req.templateUrl && (
                                  <a href={req.templateUrl} download target="_blank" rel="noreferrer"
                                    className="flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200 transition-colors">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Tải Form
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 italic">{req.note}</td>
                            <td className="px-4 py-3 text-center">
                              {req.required
                                ? <span className="text-red-500 font-bold text-lg">*</span>
                                : <span className="text-gray-400 text-xs">-</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1.5 items-end">
                                {files.map((file, index) => (
                                  <FileBadge
                                    key={index}
                                    file={file}
                                    color="success"
                                    onDownload={() => handleDownloadFile(file.url, file.name)}
                                    onRemove={() => handleRemoveFile(req.id, index)}
                                  />
                                ))}
                                <button
                                  onClick={() => setUploadPanel({ rowId: req.id, rowName: req.name })}
                                  disabled={uploadingRows.has(req.id)}
                                  className="mt-1 inline-flex items-center gap-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-600 px-3 py-1 rounded text-[11px] font-semibold transition-colors shadow-sm disabled:opacity-50"
                                >
                                  {uploadingRows.has(req.id) ? (
                                    <><Spinner size="xs" /> Đang tải...</>
                                  ) : (
                                    <>
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                      </svg>
                                      {files.length > 0 ? "Thêm file" : "Tải file lên"}
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                    {/* Extra files row */}
                    <tr className="hover:bg-yellow-50/30 transition-colors bg-yellow-50/10 border-t border-dashed border-yellow-200">
                      <td className="px-4 py-3 text-center font-bold text-yellow-400">+</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-yellow-700 italic text-sm">📎 Hồ sơ khác (nếu có)</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 italic">Tài liệu bổ sung thêm</td>
                      <td className="px-4 py-3 text-center"><span className="text-gray-300 text-xs">-</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 items-end">
                          {extraFiles.map((file, index) => (
                            <FileBadge
                              key={index}
                              file={file}
                              color="warning"
                              onDownload={() => handleDownloadFile(file.url, file.name)}
                              onRemove={() => handleRemoveFile(extraId, index)}
                            />
                          ))}
                          <button
                            onClick={() => setUploadPanel({ rowId: extraId, rowName: "Hồ sơ khác" })}
                            disabled={uploadingRows.has(extraId)}
                            className="mt-1 inline-flex items-center gap-1.5 bg-yellow-50 border border-yellow-300 hover:bg-yellow-100 text-yellow-700 px-3 py-1 rounded text-[11px] font-medium transition-colors shadow-sm disabled:opacity-50"
                          >
                            {uploadingRows.has(extraId) ? (
                              <><Spinner size="xs" /> Đang tải...</>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                {extraFiles.length > 0 ? "Thêm file" : "Tải file lên"}
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>

        {/* Upload panel overlay */}
        {uploadPanel && (
          <UploadPanelOverlay
            panel={uploadPanel}
            isUploading={uploadingRows.has(uploadPanel.rowId)}
            onClose={() => setUploadPanel(null)}
            onFiles={handleFileUpload}
          />
        )}
      </div>

      {/* ── Footer ── */}
      <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
        <Button color="gray" onClick={onClose}>Đóng</Button>
        <Button color="blue" onClick={handleSaveToBackend} disabled={isSaving || uploadingRows.size > 0}>
          {isSaving ? "Đang lưu..." : "Lưu Hồ Sơ"}
        </Button>
      </div>
    </Modal>
  );
};

export default DocumentModal;
