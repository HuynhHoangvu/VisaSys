import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import JSZip from "jszip";
import { type AuthUser, type DocFolder, type DocFile } from "../../types";
import { formatFileSize, formatUploadTime } from "../../utils/helpers";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const socket = io(API_URL);

interface ProcessedDocDashboardProps {
  currentUser: AuthUser | null;
}

const ProcessedDocDashboard: React.FC<ProcessedDocDashboardProps> = ({
  currentUser,
}) => {
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [files, setFiles] = useState<DocFile[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isAddFolderModalOpen, setIsAddFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [downloadingFolderId, setDownloadingFolderId] = useState<string | null>(
    null,
  );
  const [isUploadingFolder, setIsUploadingFolder] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });

  // State kéo thả tải file từ ngoài vào
  const [isDragging, setIsDragging] = useState(false);

  // ==========================================
  // BỔ SUNG: STATE KÉO THẢ DI CHUYỂN FILE/FOLDER
  // ==========================================
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [draggedDocFileId, setDraggedDocFileId] = useState<string | null>(null);

  // Đổi tên file
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editFileName, setEditFileName] = useState("");

  // Đổi tên thư mục
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [foldersRes, filesRes] = await Promise.all([
        fetch(`${API_URL}/api/processed-docs/folders`),
        fetch(`${API_URL}/api/processed-docs/files`),
      ]);
      if (foldersRes.ok) setFolders(await foldersRes.json());
      if (filesRes.ok) setFiles(await filesRes.json());
    } catch (error) {
      console.error("Lỗi lấy dữ liệu hồ sơ đã xử lý:", error);
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => await fetchData();
    loadInitialData();
    socket.on("docs_changed", fetchData);
    return () => {
      socket.off("docs_changed", fetchData);
    };
  }, [fetchData]);

  const displayFolders = useMemo(() => {
    if (!searchQuery)
      return folders.filter((f) => f.parentId === currentFolderId);
    return folders.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [folders, currentFolderId, searchQuery]);

  const displayFiles = useMemo(() => {
    if (!searchQuery)
      return files.filter((f) => f.folderId === currentFolderId);
    return files.filter(
      (f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.uploadedBy?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [files, currentFolderId, searchQuery]);

  const totalDisplay = displayFolders.length + displayFiles.length;

  const totalItemsInFolder =
    folders.filter((f) => f.parentId === currentFolderId).length +
    files.filter((f) => f.folderId === currentFolderId).length;

  const getFolderPath = (
    folderId: string | null,
  ): { id: string; name: string }[] => {
    const path: { id: string; name: string }[] = [];
    let current = folderId;
    while (current) {
      const folder = folders.find((f) => f.id === current);
      if (!folder) break;
      path.unshift({ id: folder.id, name: folder.name });
      current = (folder.parentId as string | null) || null;
    }
    return path;
  };

  const handleGoBack = () => {
    if (!currentFolderId) return;
    const currentFolder = folders.find((f) => f.id === currentFolderId);
    setCurrentFolderId(currentFolder?.parentId || null);
    setSearchQuery("");
  };

  const handleEnterFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    setSearchQuery("");
  };

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error);
    } catch {
      return "Lỗi không xác định";
    }
  };

  // ==========================================
  // API GỌI THÊM: MOVE FOLDER / FILE
  // ==========================================
  const handleMoveFolder = async (targetFolderId: string) => {
    if (!draggedFolderId || draggedFolderId === targetFolderId) return;
    try {
      const response = await fetch(
        `${API_URL}/api/processed-docs/folders/${draggedFolderId}/move`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: targetFolderId }),
        },
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Không thể di chuyển thư mục");
      }
      setDraggedFolderId(null);
      fetchData();
    } catch (error) {
      alert(`Lỗi khi di chuyển thư mục:\n${getErrorMessage(error)}`);
    }
  };

  const handleMoveFile = async (targetFolderId: string) => {
    if (!draggedDocFileId) return;
    try {
      const response = await fetch(
        `${API_URL}/api/processed-docs/files/${draggedDocFileId}/move`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: targetFolderId }),
        },
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Không thể di chuyển file");
      }
      setDraggedDocFileId(null);
      fetchData();
    } catch (error) {
      alert(`Lỗi khi di chuyển file:\n${getErrorMessage(error)}`);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await fetch(`${API_URL}/api/processed-docs/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: currentFolderId,
        }),
      });
      setNewFolderName("");
      setIsAddFolderModalOpen(false);
      fetchData();
    } catch (error) {
      alert(`Lỗi khi tạo thư mục:\n${getErrorMessage(error)}`);
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (
      window.confirm(
        "Bạn có chắc muốn xóa thư mục này? Các file bên trong cũng sẽ bị mất.",
      )
    ) {
      try {
        await fetch(`${API_URL}/api/processed-docs/folders/${id}`, {
          method: "DELETE",
        });
      } catch (error) {
        alert(`Lỗi khi xóa thư mục:\n${getErrorMessage(error)}`);
      }
    }
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editFolderName.trim()) return;
    try {
      const response = await fetch(
        `${API_URL}/api/processed-docs/folders/${id}/rename`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editFolderName.trim() }),
        },
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Không thể đổi tên thư mục");
      }
      setEditingFolderId(null);
    } catch (error) {
      alert(`Lỗi đổi tên thư mục:\n${getErrorMessage(error)}`);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa file này?")) {
      try {
        await fetch(`${API_URL}/api/processed-docs/files/${id}`, {
          method: "DELETE",
        });
      } catch (error) {
        alert(`Lỗi khi xóa file:\n${getErrorMessage(error)}`);
      }
    }
  };

  const processUploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uploadedBy", currentUser?.name || "Admin");
    formData.append("size", formatFileSize(file.size));
    if (currentFolderId) formData.append("folderId", currentFolderId);
    try {
      await fetch(`${API_URL}/api/processed-docs/files/upload`, {
        method: "POST",
        body: formData,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      alert(`Lỗi upload file "${file.name}":\n${getErrorMessage(error)}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesToUpload = Array.from(e.target.files);
      for (const file of filesToUpload) await processUploadFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ==========================================
  // TẢI XUỐNG TOÀN BỘ THƯ MỤC (ZIP)
  // ==========================================
  const collectFilesInFolder = useCallback(
    (
      folderId: string,
      allFolders: DocFolder[],
      allFiles: DocFile[],
      pathPrefix = "",
    ): { file: DocFile; path: string }[] => {
      const result: { file: DocFile; path: string }[] = [];
      allFiles
        .filter((f) => f.folderId === folderId)
        .forEach((f) => result.push({ file: f, path: pathPrefix }));
      allFolders
        .filter((f) => f.parentId === folderId)
        .forEach((sub) => {
          const subPath = pathPrefix ? `${pathPrefix}/${sub.name}` : sub.name;
          result.push(
            ...collectFilesInFolder(sub.id, allFolders, allFiles, subPath),
          );
        });
      return result;
    },
    [],
  );

  const handleDownloadFolder = async (folderId: string, folderName: string) => {
    const items = collectFilesInFolder(folderId, folders, files);
    if (items.length === 0)
      return alert("Thư mục này không có file nào để tải xuống!");
    setDownloadingFolderId(folderId);
    try {
      const zip = new JSZip();
      await Promise.all(
        items.map(async ({ file, path }) => {
          if (!file.fileUrl) return;
          try {
            const url = file.fileUrl.startsWith("http")
              ? file.fileUrl
              : `${API_URL}${file.fileUrl}`;
            const res = await fetch(url);
            if (!res.ok) return;
            const blob = await res.blob();
            const filePath = path ? `${path}/${file.name}` : file.name;
            zip.file(filePath, blob);
          } catch (error) {
            console.error(`Lỗi khi tải file ${file.name}:`, error);
          }
        }),
      );
      const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${folderName}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      alert(`Lỗi khi tạo file ZIP:\n${getErrorMessage(error)}`);
    } finally {
      setDownloadingFolderId(null);
    }
  };

  // ==========================================
  // TẢI LÊN TOÀN BỘ THƯ MỤC
  // ==========================================
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingFolder(true);
    const uploadFiles = Array.from(e.target.files);
    const folderIdMap = new Map<string, string>();

    const dirPaths = [
      ...new Set(
        uploadFiles.map((f) =>
          (f as File & { webkitRelativePath: string }).webkitRelativePath
            .split("/")
            .slice(0, -1)
            .join("/"),
        ),
      ),
    ]
      .filter(Boolean)
      .sort((a, b) => a.split("/").length - b.split("/").length);

    for (const dirPath of dirPaths) {
      const parts = dirPath.split("/");
      for (let depth = 1; depth <= parts.length; depth++) {
        const pathKey = parts.slice(0, depth).join("/");
        if (folderIdMap.has(pathKey)) continue;
        const folderName = parts[depth - 1];
        const parentId =
          depth === 1
            ? currentFolderId
            : (folderIdMap.get(parts.slice(0, depth - 1).join("/")) ?? null);
        try {
          const res = await fetch(`${API_URL}/api/processed-docs/folders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: folderName, parentId }),
          });
          const newFolder = await res.json();
          folderIdMap.set(pathKey, newFolder.id);
        } catch (error) {
          console.error(`Lỗi khi tạo thư mục "${folderName}":`, error);
        }
      }
    }

    // Upload tuần tự theo batch (3 file mỗi lần) để tránh ERR_ACCESS_DENIED khi quá nhiều request đồng thời
    const BATCH_SIZE = 3;
    setUploadProgress({ current: 0, total: uploadFiles.length });

    for (let i = 0; i < uploadFiles.length; i += BATCH_SIZE) {
      const batch = uploadFiles.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (file) => {
          const relPath = (file as File & { webkitRelativePath: string })
            .webkitRelativePath;
          const dirPath = relPath.split("/").slice(0, -1).join("/");
          const targetFolderId = folderIdMap.get(dirPath) ?? currentFolderId;
          const formData = new FormData();
          formData.append("file", file);
          formData.append("uploadedBy", currentUser?.name || "Admin");
          formData.append("size", formatFileSize(file.size));
          if (targetFolderId) formData.append("folderId", targetFolderId);
          try {
            await fetch(`${API_URL}/api/processed-docs/files/upload`, {
              method: "POST",
              body: formData,
            });
          } catch (error) {
            console.error(`Lỗi khi tải file ${file.name}:`, error);
          }
        }),
      );
      setUploadProgress({
        current: Math.min(i + BATCH_SIZE, uploadFiles.length),
        total: uploadFiles.length,
      });
    }

    setIsUploadingFolder(false);
    setUploadProgress({ current: 0, total: 0 });
    if (folderInputRef.current) folderInputRef.current.value = "";
    fetchData();
  };

  // Logic kéo thả TẢI FILE TỪ NGOÀI
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedFolderId || draggedDocFileId) return; // Không hiển thị màn overlay nếu đang kéo thả file nội bộ
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (draggedFolderId || draggedDocFileId) return;
    if (!e.dataTransfer.items || e.dataTransfer.items.length === 0) return;

    const items = Array.from(e.dataTransfer.items);

    const readEntryFile = (entry: FileSystemFileEntry): Promise<File> =>
      new Promise((resolve, reject) => entry.file(resolve, reject));

    const readAllEntries = (
      reader: FileSystemDirectoryReader,
    ): Promise<FileSystemEntry[]> =>
      new Promise((resolve, reject) => {
        const allEntries: FileSystemEntry[] = [];
        const readBatch = () => {
          reader.readEntries((batch) => {
            if (batch.length === 0) return resolve(allEntries);
            allEntries.push(...batch);
            readBatch();
          }, reject);
        };
        readBatch();
      });

    const collectedFiles: { file: File; folderId: string | null }[] = [];
    const traverseEntry = async (
      entry: FileSystemEntry,
      parentServerId: string | null,
    ) => {
      if (entry.isFile) {
        const file = await readEntryFile(entry as FileSystemFileEntry);
        collectedFiles.push({ file, folderId: parentServerId });
      } else if (entry.isDirectory) {
        let newFolderId: string | null = parentServerId;
        try {
          const res = await fetch(`${API_URL}/api/processed-docs/folders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: entry.name,
              parentId: parentServerId,
            }),
          });
          const newFolder = await res.json();
          newFolderId = newFolder.id;
        } catch (err) {
          console.error(`Lỗi tạo thư mục "${entry.name}":`, err);
        }
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const children = await readAllEntries(reader);
        for (const child of children) await traverseEntry(child, newFolderId);
      }
    };

    const entries = items
      .map((item) => item.webkitGetAsEntry?.())
      .filter(Boolean) as FileSystemEntry[];

    const hasFolder = entries.some((entry) => entry.isDirectory);

    if (hasFolder) {
      setIsUploadingFolder(true);
      for (const entry of entries) await traverseEntry(entry, currentFolderId);

      const BATCH_SIZE = 3;
      setUploadProgress({ current: 0, total: collectedFiles.length });
      for (let i = 0; i < collectedFiles.length; i += BATCH_SIZE) {
        const batch = collectedFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async ({ file, folderId }) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("uploadedBy", currentUser?.name || "Admin");
            formData.append("size", formatFileSize(file.size));
            if (folderId) formData.append("folderId", folderId);
            try {
              await fetch(`${API_URL}/api/processed-docs/files/upload`, {
                method: "POST",
                body: formData,
              });
            } catch (err) {
              console.error(`Lỗi upload "${file.name}":`, err);
            }
          }),
        );
        setUploadProgress({
          current: Math.min(i + BATCH_SIZE, collectedFiles.length),
          total: collectedFiles.length,
        });
      }
      setIsUploadingFolder(false);
      setUploadProgress({ current: 0, total: 0 });
      fetchData();
    } else {
      for (const entry of entries) {
        if (entry.isFile) {
          const file = await readEntryFile(entry as FileSystemFileEntry);
          await processUploadFile(file);
        }
      }
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editFileName.trim()) return;
    try {
      await fetch(`${API_URL}/api/processed-docs/files/${id}/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editFileName.trim() }),
      });
      setEditingFileId(null);
    } catch (error) {
      alert(`Lỗi đổi tên file:\n${getErrorMessage(error)}`);
    }
  };

  const handleDownload = async (
    fileUrl: string | undefined,
    fileName: string,
  ) => {
    if (!fileUrl) return alert("File không có đường dẫn!");
    try {
      const fullUrl = fileUrl.startsWith("http")
        ? fileUrl
        : `${API_URL}${fileUrl}`;
      const response = await fetch(`${fullUrl}?t=${new Date().getTime()}`, {
        mode: "cors",
      });
      if (!response.ok) throw new Error(`HTTP lỗi: ${response.status}`);
      const blob = await response.blob();
      const localUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = localUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(localUrl);
    } catch (error) {
      alert(`Đã xảy ra lỗi khi tải file xuống:\n${getErrorMessage(error)}`);
    }
  };

  // BỔ SUNG: Preview File
  const handlePreview = (fileUrl: string | undefined) => {
    if (!fileUrl) return alert("File không có đường dẫn!");
    let fullUrl = fileUrl.startsWith("http") ? fileUrl : `${API_URL}${fileUrl}`;
    if (fullUrl.includes("/fl_attachment/"))
      fullUrl = fullUrl.replace("/fl_attachment/", "/");
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  };

  const highlight = (text: string) => {
    if (!searchQuery) return text;
    return text.split(new RegExp(`(${searchQuery})`, "gi")).map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  return (
    <div
      className={`flex-1 p-6 overflow-y-auto bg-gray-50 h-full relative transition-colors ${isDragging ? "bg-blue-50 border-2 border-dashed border-blue-400" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* OVERLAY KÉO THẢ TẢI FILE */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-50 bg-opacity-90 pointer-events-none rounded-xl">
          <div className="text-center text-blue-600">
            <svg
              className="w-16 h-16 mx-auto mb-4 animate-bounce"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <h2 className="text-2xl font-bold">Thả file vào đây để tải lên</h2>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Hồ sơ Đã xử lý</h2>
          <p className="text-gray-500 text-sm mt-1">
            Không gian lưu trữ tài liệu riêng biệt của Phòng Xử lý hồ sơ
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsAddFolderModalOpen(true)}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              />
            </svg>
            Tạo thư mục
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={isUploadingFolder}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            {isUploadingFolder ? (
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
            ) : (
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
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                />
              </svg>
            )}
            {isUploadingFolder && uploadProgress.total > 0
              ? `${uploadProgress.current}/${uploadProgress.total} file...`
              : isUploadingFolder
                ? "Đang tải..."
                : "Upload thư mục"}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Tải file lên
          </button>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            onChange={handleFolderUpload}
            {...({
              webkitdirectory: "",
              directory: "",
              multiple: true,
            } as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        </div>
      </div>

      {/* BREADCRUMB (Kèm kéo thả ra ngoài Folder gốc) */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <button
          onClick={() => {
            setCurrentFolderId(null);
            setSearchQuery("");
          }}
          className={`font-semibold hover:underline ${!currentFolderId ? "text-gray-800" : "text-blue-600"}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (draggedFolderId) handleMoveFolder("null");
            if (draggedDocFileId) handleMoveFile("null");
          }}
        >
          Hồ sơ Đã xử lý
        </button>
        {currentFolderId && (
          <>
            {getFolderPath(currentFolderId).map((folder, index, arr) => (
              <React.Fragment key={folder.id}>
                <span className="text-gray-400">/</span>
                {index < arr.length - 1 ? (
                  <button
                    onClick={() => {
                      setCurrentFolderId(folder.id);
                      setSearchQuery("");
                    }}
                    className="text-blue-600 font-semibold hover:underline"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedFolderId) handleMoveFolder(folder.id);
                      if (draggedDocFileId) handleMoveFile(folder.id);
                    }}
                  >
                    {folder.name}
                  </button>
                ) : (
                  <span className="text-gray-800 font-semibold">
                    {folder.name}
                  </span>
                )}
              </React.Fragment>
            ))}
            <button
              onClick={handleGoBack}
              className="ml-auto flex items-center gap-1 text-gray-500 hover:text-gray-800 font-medium bg-gray-200 px-3 py-1 rounded-full transition-colors"
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
                  strokeWidth="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Quay lại
            </button>
          </>
        )}
      </div>

      {/* SEARCH BAR */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên file, thư mục, người tải lên..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        <span className="text-xs text-gray-400 font-medium">
          {searchQuery ? (
            <>
              <span className="text-blue-600 font-bold">{totalDisplay}</span> /{" "}
              {totalItemsInFolder} mục
            </>
          ) : (
            <>
              <span className="font-bold text-gray-600">{totalDisplay}</span>{" "}
              mục
            </>
          )}
        </span>
      </div>

      {/* CONTENT */}
      {displayFolders.length === 0 && displayFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          {searchQuery ? (
            <>
              <svg
                className="w-12 h-12 text-gray-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p className="text-gray-500 font-medium">
                Không tìm thấy kết quả
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Thử từ khóa khác hoặc{" "}
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-blue-500 underline"
                >
                  xóa bộ lọc
                </button>
              </p>
            </>
          ) : (
            <>
              <svg
                className="w-16 h-16 text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1"
                  d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-gray-500 font-medium">
                Thư mục này đang trống
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Tạo thư mục mới hoặc tải tài liệu lên.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* FOLDERS KÈM SỰ KIỆN DRAG & DROP */}
          {displayFolders.map((folder) => (
            <div
              key={folder.id}
              onClick={() => handleEnterFolder(folder.id)}
              draggable
              onDragStart={(e) => {
                setDraggedFolderId(folder.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDraggedFolderId(null)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedFolderId || draggedDocFileId)
                  e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedFolderId) handleMoveFolder(folder.id);
                if (draggedDocFileId) handleMoveFile(folder.id);
              }}
              className={`relative bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all group flex items-center justify-between gap-2
                ${draggedFolderId === folder.id ? "opacity-50 grayscale" : ""}
              `}
            >
              <div className="flex items-center gap-3 overflow-hidden pointer-events-none">
                <svg
                  className="w-10 h-10 text-yellow-400 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <div className="overflow-hidden">
                  {editingFolderId === folder.id ? (
                    <form
                      onSubmit={(e) => handleRenameFolderSubmit(e, folder.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 pointer-events-auto"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingFolderId(null);
                        }}
                        className="text-sm font-bold text-gray-800 border-2 border-blue-400 rounded-md px-2 py-0.5 outline-none bg-white shadow-inner w-full"
                      />
                    </form>
                  ) : (
                    <h4 className="font-bold text-gray-800 wrap-break-word whitespace-normal group-hover:text-blue-600 transition-colors">
                      {highlight(folder.name)}
                    </h4>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">Thư mục</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatUploadTime(folder.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadFolder(folder.id, folder.name);
                  }}
                  disabled={downloadingFolderId === folder.id}
                  className="text-gray-400 hover:text-green-600 hover:bg-green-50 p-2 rounded-lg transition-all disabled:opacity-50"
                  title="Tải xuống toàn bộ thư mục (ZIP)"
                >
                  {downloadingFolderId === folder.id ? (
                    <svg
                      className="w-5 h-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                  ) : (
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
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingFolderId(folder.id);
                    setEditFolderName(folder.name);
                  }}
                  className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-all"
                  title="Đổi tên thư mục"
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              </div>
              <button
                onClick={(e) => handleDeleteFolder(e, folder.id)}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-all"
                title="Xóa thư mục"
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
                    strokeWidth="2.5"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}

          {/* FILES KÈM SỰ KIỆN DRAG */}
          {displayFiles.map((file) => (
            <div
              key={file.id}
              draggable
              onDragStart={(e) => {
                setDraggedDocFileId(file.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDraggedDocFileId(null)}
              className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col cursor-grab active:cursor-grabbing
                ${draggedDocFileId === file.id ? "opacity-50 grayscale" : ""}
              `}
            >
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingFileId(file.id);
                    setEditFileName(file.name);
                  }}
                  className="text-gray-400 hover:text-blue-500 bg-white hover:bg-blue-50 p-1.5 rounded-lg border border-transparent hover:border-blue-200 shadow-sm"
                  title="Đổi tên"
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
                      strokeWidth="2"
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.id);
                  }}
                  className="text-gray-400 hover:text-red-500 bg-white hover:bg-red-50 p-1.5 rounded-lg border border-transparent hover:border-red-200 shadow-sm"
                  title="Xóa"
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
                      strokeWidth="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex items-start gap-3 mb-3 pr-16 pointer-events-none">
                <svg
                  className="w-8 h-8 text-blue-500 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <div className="overflow-hidden w-full pointer-events-auto">
                  {editingFileId === file.id ? (
                    <form
                      onSubmit={(e) => handleRenameSubmit(e, file.id)}
                      className="flex items-center gap-1 mt-0.5"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editFileName}
                        onChange={(e) => setEditFileName(e.target.value)}
                        className="w-full text-sm font-bold text-gray-800 border-2 border-blue-400 rounded-md px-2 py-1 outline-none bg-white shadow-inner"
                      />
                      <button
                        type="submit"
                        className="text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 rounded-md p-1.5 transition-colors"
                        title="Lưu"
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
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFileId(null)}
                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md p-1.5 transition-colors"
                        title="Hủy"
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
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </form>
                  ) : (
                    <h4 className="font-bold text-gray-800 text-sm wrap-break-word whitespace-normal leading-snug">
                      {highlight(file.name)}
                    </h4>
                  )}
                  <p className="text-xs text-gray-500 mt-1.5">
                    {file.size} • {file.uploadedBy}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatUploadTime(file.createdAt)}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex justify-between items-center pt-3 border-t border-gray-100 pointer-events-none">
                <span className="text-xs text-gray-400">
                  {new Date(file.createdAt).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="flex gap-1.5 pointer-events-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(file.fileUrl);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-md transition-colors cursor-pointer"
                    title="Xem trước file"
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
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(file.fileUrl, file.name);
                    }}
                    className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-md transition-colors cursor-pointer"
                    title="Tải xuống"
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
                        strokeWidth="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL TẠO THƯ MỤC */}
      {isAddFolderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                Tạo Thư Mục Mới
              </h3>
              <button
                onClick={() => setIsAddFolderModalOpen(false)}
                className="text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 p-1.5 rounded-md transition-colors"
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
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="p-5">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Tên thư mục
              </label>
              <input
                type="text"
                autoFocus
                placeholder="VD: Hồ sơ khách hàng A..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddFolderModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                >
                  Tạo thư mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
        .animate-scale-in { animation: scaleIn 0.2s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default ProcessedDocDashboard;
