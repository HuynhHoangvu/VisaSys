import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Progress, Spinner } from "flowbite-react";
import type { AuthUser, BoardData, Column, Task } from "../../types";
import { io } from "socket.io-client";
import SearchFilterBar from "../filter/SearchFilterBar";

import {
  getRequirementsList,
  getLaborRequirements,
  getStudyAbroadRequirements,
} from "../../utils/constants";

interface ProcessingBoardProps {
  onOpenDetail: (taskId: string) => void;
  onOpenAttachments: (taskId: string) => void;
  currentUser: AuthUser;
}

const PROCESSING_COLUMNS = {
  "proc-col-1": {
    id: "proc-col-1",
    title: "Thu thập giấy tờ",
    taskIds: [] as string[],
  },
  "proc-col-2": {
    id: "proc-col-2",
    title: "Đang xử lý",
    taskIds: [] as string[],
  },
  "proc-col-3": {
    id: "proc-col-3",
    title: "Đã nộp LSQ / Chờ sinh trắc",
    taskIds: [] as string[],
  },
  "proc-col-4": {
    id: "proc-col-4",
    title: "Đợi trả kết quả",
    taskIds: [] as string[],
  },
  "proc-col-5": {
    id: "proc-col-5",
    title: "Rớt visa",
    taskIds: [] as string[],
  },
  "proc-col-6": {
    id: "proc-col-6",
    title: "Đậu visa",
    taskIds: [] as string[],
  },
};

const PROCESSING_COLUMN_ORDER = [
  "proc-col-1",
  "proc-col-2",
  "proc-col-3",
  "proc-col-4",
  "proc-col-5",
  "proc-col-6",
];

const API_BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api`;
const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const socket = io(SOCKET_URL);

const ProcessingBoard: React.FC<ProcessingBoardProps> = ({
  onOpenDetail,
  onOpenAttachments,
  currentUser,
}) => {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [procColumns, setProcColumns] = useState(PROCESSING_COLUMNS);
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================
  // VIEW MODE (KANBAN / TABLE)
  // ==========================================
  const [activeTab, setActiveTab] = useState<"kanban" | "table">("kanban");

  // ==========================================
  // SEARCH & FILTER STATE
  // ==========================================
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSale, setFilterSale] = useState("all");
  const [filterVisa, setFilterVisa] = useState("all");
  const [filterProgress, setFilterProgress] = useState("all"); // all | missing | done

  // ==========================================
  // TÍNH TỔNG SỐ HỒ SƠ YÊU CẦU
  // ==========================================
  const getTotalRequiredDocs = (task: Task) => {
    const checklistType = task.checklistType || "tourism";
    const jobType = task.jobType || "Nhân viên";
    let requirements: unknown[] = [];
    if (checklistType === "tourism")
      requirements = getRequirementsList(jobType);
    else if (checklistType === "labor") requirements = getLaborRequirements();
    else if (checklistType === "study")
      requirements = getStudyAbroadRequirements();
    return requirements.length > 0 ? requirements.length : 1;
  };

  // ==========================================
  // FETCH DỮ LIỆU
  // ==========================================
  const fetchBoardData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/board`);
      if (!response.ok) throw new Error("Không thể tải dữ liệu");
      const data: BoardData = await response.json();
      setBoardData(data);

      const processingColumn = Object.values(data.columns).find(
        (col: Column) =>
          col.title?.toLowerCase().includes("đang xử lý") || col.id === "col-5",
      );
      const salesHandoverTaskIds = processingColumn?.taskIds || [];

      const newCols = {
        "proc-col-1": {
          ...PROCESSING_COLUMNS["proc-col-1"],
          taskIds: [] as string[],
        },
        "proc-col-2": {
          ...PROCESSING_COLUMNS["proc-col-2"],
          taskIds: [] as string[],
        },
        "proc-col-3": {
          ...PROCESSING_COLUMNS["proc-col-3"],
          taskIds: [] as string[],
        },
        "proc-col-4": {
          ...PROCESSING_COLUMNS["proc-col-4"],
          taskIds: [] as string[],
        },
        "proc-col-5": {
          ...PROCESSING_COLUMNS["proc-col-5"],
          taskIds: [] as string[],
        },
        "proc-col-6": {
          ...PROCESSING_COLUMNS["proc-col-6"],
          taskIds: [] as string[],
        },
      };

      salesHandoverTaskIds.forEach((taskId) => {
        const task = data.tasks[taskId];
        if (task) {
          const targetCol = task.processingColId || "proc-col-1";
          if (newCols[targetCol as keyof typeof newCols]) {
            newCols[targetCol as keyof typeof newCols].taskIds.push(taskId);
          }
        }
      });

      setProcColumns(newCols);
    } catch (err) {
      console.error(err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoardData(true);
    socket.on("data_changed", () => fetchBoardData(false));
    const handleInstantRefresh = () => fetchBoardData(false);
    window.addEventListener("refreshBoard", handleInstantRefresh);
    return () => {
      socket.off("data_changed");
      window.removeEventListener("refreshBoard", handleInstantRefresh);
    };
  }, [fetchBoardData]);

  // ==========================================
  // BUILD FILTER OPTIONS
  // ==========================================
  const filterOptions = useMemo(() => {
    if (!boardData) return { sales: [], visaTypes: [] };

    const allTaskIds = Object.values(procColumns).flatMap((c) => c.taskIds);
    const allTasks = allTaskIds
      .map((id) => boardData.tasks[id])
      .filter(Boolean);

    const sales = [
      ...new Set(allTasks.map((t) => t.assignedTo).filter(Boolean)),
    ]
      .sort()
      .map((name) => ({ value: name, label: name }));

    const visaTypes = [
      ...new Set(allTasks.map((t) => t.visaType).filter(Boolean)),
    ]
      .sort()
      .map((v) => ({ value: v!, label: v! }));

    return { sales, visaTypes };
  }, [boardData, procColumns]);

  // ==========================================
  // HÀM LỌC TASK CHO TỪNG CỘT
  // ==========================================
  const isTaskVisible = useCallback(
    (task: Task): boolean => {
      if (!task) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = task.content?.toLowerCase().includes(q);
        const matchSale = task.assignedTo?.toLowerCase().includes(q);
        const matchVisa = task.visaType?.toLowerCase().includes(q);
        if (!matchName && !matchSale && !matchVisa) return false;
      }

      if (filterSale !== "all" && task.assignedTo !== filterSale) return false;
      if (filterVisa !== "all" && task.visaType !== filterVisa) return false;

      if (filterProgress !== "all") {
        const totalCount = getTotalRequiredDocs(task);
        const doneCount = task.documents
          ? Object.keys(task.documents).length
          : 0;
        const percent = Math.min(
          Math.round((doneCount / totalCount) * 100),
          100,
        );
        if (filterProgress === "missing" && percent >= 100) return false;
        if (filterProgress === "done" && percent < 100) return false;
      }

      return true;
    },
    [searchQuery, filterSale, filterVisa, filterProgress],
  );

  const hasActiveFilter =
    searchQuery !== "" ||
    filterSale !== "all" ||
    filterVisa !== "all" ||
    filterProgress !== "all";

  const handleResetFilter = () => {
    setSearchQuery("");
    setFilterSale("all");
    setFilterVisa("all");
    setFilterProgress("all");
  };

  // ==========================================
  // TÍNH TOÁN DỮ LIỆU ĐỂ HIỂN THỊ TRONG BẢNG
  // ==========================================
  const filteredTasks = useMemo(() => {
    if (!boardData) return [];
    return Object.values(procColumns)
      .flatMap((col) => col.taskIds)
      .map((id) => boardData.tasks[id])
      .filter(Boolean)
      .filter((task) => isTaskVisible(task));
  }, [boardData, procColumns, isTaskVisible]);

  const filteredTotal = filteredTasks.length;
  const totalTasks = Object.values(procColumns).flatMap(
    (c) => c.taskIds,
  ).length;

  // ==========================================
  // KÉO THẢ (DÀNH CHO KANBAN VIEW)
  // ==========================================
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    const startCol =
      procColumns[source.droppableId as keyof typeof PROCESSING_COLUMNS];
    const finishCol =
      procColumns[destination.droppableId as keyof typeof PROCESSING_COLUMNS];

    if (startCol === finishCol) {
      const newTaskIds = Array.from(startCol.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);
      setProcColumns({
        ...procColumns,
        [startCol.id]: { ...startCol, taskIds: newTaskIds },
      });
    } else {
      const startTaskIds = Array.from(startCol.taskIds);
      startTaskIds.splice(source.index, 1);
      const finishTaskIds = Array.from(finishCol.taskIds);
      finishTaskIds.splice(destination.index, 0, draggableId);
      setProcColumns({
        ...procColumns,
        [startCol.id]: { ...startCol, taskIds: startTaskIds },
        [finishCol.id]: { ...finishCol, taskIds: finishTaskIds },
      });
    }

    try {
      await fetch(`${API_BASE_URL}/tasks/${draggableId}/processing-move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processingColId: destination.droppableId }),
      });
    } catch (error) {
      fetchBoardData(false);
      alert("Lỗi khi chuyển cột xử lý!" + error);
    }
  };

  // ==========================================
  // BÁO THIẾU HỒ SƠ
  // ==========================================
  const handlePingSale = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.assignedTo) return alert("Hồ sơ này chưa có Sale phụ trách!");
    const reason = window.prompt(
      `Nhập loại giấy tờ còn thiếu để báo cho [${task.assignedTo}] bổ sung ngay:`,
    );
    if (reason) {
      try {
        await fetch(`${API_BASE_URL}/notifications/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: task.content.split(" - ")[0],
            saleName: task.assignedTo,
            sender: currentUser.name,
            customMessage: `⚠️ GẤP! Khách hàng ${task.content.split(" - ")[0]} đang thiếu: ${reason}. Vui lòng bổ sung ngay!`,
            taskId: task.id,
          }),
        });
        alert(`Đã gửi lệnh yêu cầu bổ sung cho Sale: ${task.assignedTo}`);
      } catch (error) {
        alert("Lỗi gửi thông báo!" + error);
      }
    }
  };

  if (isLoading || !boardData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full p-4 sm:p-6 bg-[#f8f9fa]">
      {/* HEADER */}
      <div className="mb-4 flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Tiến độ Xử lý Hồ sơ
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý hồ sơ đã được Sale bàn giao
          </p>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex gap-1 mb-4 shrink-0 bg-gray-200/60 p-1 rounded-lg w-fit">
        {[
          { key: "kanban", label: "🗂 Kanban" },
          { key: "table", label: "📊 Table" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as "kanban" | "table")}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SEARCH + FILTER */}
      <SearchFilterBar
        searchPlaceholder="Tìm tên khách, loại visa, sale..."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        filters={[
          {
            key: "sale",
            placeholder: "👤 Tất cả Sale",
            value: filterSale,
            options: filterOptions.sales,
            onChange: setFilterSale,
          },
          {
            key: "visa",
            placeholder: "🛂 Loại visa",
            value: filterVisa,
            options: filterOptions.visaTypes,
            onChange: setFilterVisa,
          },
          {
            key: "progress",
            placeholder: "📁 Tiến độ hồ sơ",
            value: filterProgress,
            options: [
              { value: "missing", label: "⚠️ Còn thiếu hồ sơ" },
              { value: "done", label: "✅ Đã đủ hồ sơ" },
            ],
            onChange: setFilterProgress,
          },
        ]}
        resultCount={filteredTotal}
        totalCount={totalTasks}
        onReset={handleResetFilter}
        hasActiveFilter={hasActiveFilter}
      />

      {/* ==================== KANBAN VIEW ==================== */}
      {activeTab === "kanban" && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full w-full space-x-4 overflow-x-auto pb-6 items-start">
            {PROCESSING_COLUMN_ORDER.map((columnId) => {
              const column =
                procColumns[columnId as keyof typeof PROCESSING_COLUMNS];
              const allTasks = column.taskIds
                .map((taskId) => boardData.tasks[taskId])
                .filter(Boolean);
              const visibleTasks = allTasks.filter((task) =>
                isTaskVisible(task),
              );

              return (
                <div
                  key={column.id}
                  className="flex flex-col bg-gray-200/60 rounded-xl w-56 min-w-[14rem] max-h-full shrink-0 border border-gray-300 shadow-sm"
                >
                  <div className="p-3 flex justify-between items-center bg-gray-100 rounded-t-xl border-b border-gray-300">
                    <h3 className="font-bold text-gray-700 uppercase text-[12px] tracking-wide">
                      {column.title}
                    </h3>
                    <div className="flex items-center gap-1">
                      {hasActiveFilter &&
                        visibleTasks.length !== allTasks.length && (
                          <span className="text-orange-500 text-xs font-bold">
                            {visibleTasks.length}/
                          </span>
                        )}
                      <span className="bg-gray-300 text-gray-800 text-xs font-bold px-2 py-0.5 rounded-full">
                        {allTasks.length}
                      </span>
                    </div>
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 p-3 space-y-3 overflow-y-auto rounded-b-xl transition-colors duration-200 ${snapshot.isDraggingOver ? "bg-gray-300/50" : ""}`}
                        style={{ minHeight: "150px" }}
                      >
                        {allTasks.map((task, index) => {
                          const totalCount = getTotalRequiredDocs(task);
                          const doneCount = task.documents
                            ? Object.keys(task.documents).length
                            : 0;
                          const percent = Math.min(
                            Math.round((doneCount / totalCount) * 100),
                            100,
                          );
                          const isMissing =
                            percent < 100 && columnId === "proc-col-1";
                          const isHidden =
                            hasActiveFilter && !isTaskVisible(task);

                          return (
                            <Draggable
                              key={task.id}
                              draggableId={task.id}
                              index={index}
                            >
                              {(provided, snapshot) => {
                                const card = (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() =>
                                      !isHidden && onOpenDetail(task.id)
                                    }
                                    className={`bg-white p-3 rounded-xl shadow-sm border-l-[4px] cursor-grab active:cursor-grabbing relative group transition-all
                                    ${isMissing ? "border-l-red-500 bg-red-50" : "border-l-indigo-500 hover:shadow-md"}
                                    ${snapshot.isDragging ? "shadow-2xl z-9999" : ""}
                                    ${isHidden ? "opacity-20 pointer-events-none scale-95" : ""}
                                  `}
                                    style={{ ...provided.draggableProps.style }}
                                  >
                                    {isMissing && !isHidden && (
                                      <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span
                                          className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"
                                          title="Chưa đủ hồ sơ"
                                        ></span>
                                      </span>
                                    )}

                                    <h4 className="font-bold text-gray-800 text-xs pr-4 truncate mb-1">
                                      {task.content.split(" - ")[0]}
                                    </h4>
                                    <div className="flex flex-nowrap gap-1 mb-2 overflow-hidden">
                                      {(task.visaType ||
                                        task.content.split(" - ")[1]) && (
                                        <p className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 truncate max-w-[90px] shrink-0">
                                          {task.visaType ||
                                            task.content.split(" - ")[1]}
                                        </p>
                                      )}
                                      {task.jobType && (
                                        <p className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 truncate max-w-[80px] shrink-0">
                                          {task.jobType}
                                        </p>
                                      )}
                                    </div>

                                    <div className="mb-2">
                                      <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                                        <span>Giấy tờ:</span>
                                        <span
                                          className={
                                            percent === 100
                                              ? "text-green-500"
                                              : "text-red-500"
                                          }
                                        >
                                          {doneCount}/{totalCount}
                                        </span>
                                      </div>
                                      <Progress
                                        progress={percent}
                                        color={
                                          percent === 100 ? "green" : "indigo"
                                        }
                                        size="sm"
                                      />
                                    </div>

                                    {/* --- PHẦN BOTTOM: SALE + DROPDOWN CỘT + NÚT BẤM (GOM TRÊN 1 DÒNG) --- */}
                                    <div className="flex items-center justify-between border-t border-gray-100 pt-2 gap-1 mt-1">
                                      {/* 1. Tên Sale */}
                                      <span
                                        className="text-[9px] font-bold text-gray-700 bg-gray-50 px-1.5 py-1 rounded border border-gray-200 truncate max-w-[45px] shrink-0 text-center"
                                        title={task.assignedTo || "Trống"}
                                      >
                                        {task.assignedTo
                                          ? task.assignedTo.split(" ").pop()
                                          : "Trống"}
                                      </span>

                                      {/* 2. Dropdown chuyển cột */}
                                      <div
                                        className="flex-1 min-w-0"
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                      >
                                        <select
                                          value={columnId}
                                          onChange={async (e) => {
                                            const newColId = e.target.value;
                                            try {
                                              await fetch(
                                                `${API_BASE_URL}/tasks/${task.id}/processing-move`,
                                                {
                                                  method: "PUT",
                                                  headers: {
                                                    "Content-Type":
                                                      "application/json",
                                                  },
                                                  body: JSON.stringify({
                                                    processingColId: newColId,
                                                  }),
                                                },
                                              );
                                              fetchBoardData(false);
                                            } catch (error) {
                                              alert(
                                                "Lỗi khi chuyển cột xử lý!" +
                                                  error,
                                              );
                                            }
                                          }}
                                          className="text-[9px] font-medium px-1 py-1 rounded border border-gray-200 bg-white outline-none cursor-pointer w-full text-gray-700 hover:border-indigo-300 transition-colors"
                                        >
                                          {PROCESSING_COLUMN_ORDER.map(
                                            (cId) => (
                                              <option key={cId} value={cId}>
                                                {
                                                  PROCESSING_COLUMNS[
                                                    cId as keyof typeof PROCESSING_COLUMNS
                                                  ].title
                                                }
                                              </option>
                                            ),
                                          )}
                                        </select>
                                      </div>

                                      {/* 3. Nút bấm */}
                                      <div className="flex gap-1 shrink-0 items-center">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenAttachments(task.id);
                                          }}
                                          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-green-600 bg-gray-50 hover:bg-green-50 rounded border border-gray-200 transition-colors"
                                          title="Xem danh sách tài liệu"
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
                                              strokeWidth={2}
                                              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                            />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={(e) =>
                                            handlePingSale(task, e)
                                          }
                                          className={`text-[9px] font-bold px-1.5 py-1 rounded transition-colors ${
                                            isMissing
                                              ? "text-white bg-red-500 hover:bg-red-600"
                                              : "text-orange-600 bg-orange-100 hover:bg-orange-200"
                                          }`}
                                        >
                                          {isMissing ? "Đòi HS" : "Báo sale"}
                                        </button>
                                      </div>
                                    </div>
                                    {/* --- KẾT THÚC PHẦN BOTTOM --- */}
                                  </div>
                                );
                                return snapshot.isDragging
                                  ? createPortal(card, document.body)
                                  : card;
                              }}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        {hasActiveFilter &&
                          visibleTasks.length === 0 &&
                          allTasks.length > 0 && (
                            <div className="text-center py-4 text-gray-300 text-xs italic">
                              Không khớp bộ lọc
                            </div>
                          )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* ==================== TABLE VIEW ==================== */}
      {activeTab === "table" && (
        <div className="flex-1 overflow-y-auto pb-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Khách hàng
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Sale
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Loại Visa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide min-w-37.5">
                    Tiến độ giấy tờ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Trạng thái (Cột)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide w-48">
                    Chuyển cột
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-gray-400 italic text-sm"
                    >
                      Không tìm thấy hồ sơ phù hợp
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task, i) => {
                    const totalCount = getTotalRequiredDocs(task);
                    const doneCount = task.documents
                      ? Object.keys(task.documents).length
                      : 0;
                    const percent = Math.min(
                      Math.round((doneCount / totalCount) * 100),
                      100,
                    );
                    const isMissing = percent < 100;

                    const currentTargetCol =
                      task.processingColId || "proc-col-1";
                    const columnInfo =
                      PROCESSING_COLUMNS[
                        currentTargetCol as keyof typeof PROCESSING_COLUMNS
                      ];

                    return (
                      <tr
                        key={task.id}
                        className={`transition-colors hover:bg-indigo-50/30 cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                        onClick={() => onOpenDetail(task.id)}
                      >
                        {/* Tên khách & SĐT */}
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-800">
                            {task.content.split(" - ")[0]}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 font-medium">
                            {task.phone}
                          </p>
                        </td>

                        {/* Sale */}
                        <td className="px-4 py-3 font-medium text-gray-700">
                          {task.assignedTo
                            ? task.assignedTo.split(" ").pop()
                            : "Trống"}
                        </td>

                        {/* Loại Visa */}
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-indigo-50 text-indigo-600 border-indigo-100">
                            {task.visaType ||
                              task.content.split(" - ")[1] ||
                              "—"}
                          </span>
                        </td>

                        {/* Tiến độ giấy tờ */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-25">
                              <Progress
                                progress={percent}
                                color={percent === 100 ? "green" : "indigo"}
                                size="sm"
                              />
                            </div>
                            <span
                              className={`text-xs font-bold ${percent === 100 ? "text-green-600" : "text-gray-500"}`}
                            >
                              {doneCount}/{totalCount}
                            </span>
                          </div>
                        </td>

                        {/* Trạng thái hiện tại */}
                        <td className="px-4 py-3">
                          <span
                            className={`text-[11px] font-bold px-2 py-1 rounded-full ${isMissing && currentTargetCol === "proc-col-1" ? "bg-red-50 text-red-600 border border-red-200" : "bg-gray-100 text-gray-700"}`}
                          >
                            {columnInfo?.title || "Không rõ"}
                          </span>
                        </td>

                        {/* Action: Chuyển cột */}
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={currentTargetCol}
                            onChange={async (e) => {
                              const newColId = e.target.value;
                              try {
                                await fetch(
                                  `${API_BASE_URL}/tasks/${task.id}/processing-move`,
                                  {
                                    method: "PUT",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      processingColId: newColId,
                                    }),
                                  },
                                );
                                fetchBoardData(false);
                              } catch (error) {
                                alert("Lỗi khi chuyển cột xử lý!" + error);
                              }
                            }}
                            className="text-xs font-medium px-2 py-1.5 rounded border border-gray-200 bg-white outline-none cursor-pointer w-full text-gray-700 hover:border-indigo-300 transition-colors"
                          >
                            {PROCESSING_COLUMN_ORDER.map((colId) => (
                              <option key={colId} value={colId}>
                                {
                                  PROCESSING_COLUMNS[
                                    colId as keyof typeof PROCESSING_COLUMNS
                                  ].title
                                }
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingBoard;
