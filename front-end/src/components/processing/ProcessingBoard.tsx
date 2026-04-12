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
import socket from "../../services/socket";
import SearchFilterBar from "../filter/SearchFilterBar";
import {
  getRequirementsList,
  getLaborRequirements,
  getStudyAbroadRequirements,
} from "../../utils/constants";

// ==========================================
// CONSTANTS
// ==========================================
const API_BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api`;

const PROC_COLUMNS = [
  { id: "proc-col-1", title: "Thu thập giấy tờ" },
  { id: "proc-col-2", title: "Đang xử lý" },
  { id: "proc-col-3", title: "Đã nộp LSQ / Chờ sinh trắc" },
  { id: "proc-col-4", title: "Đợi trả kết quả" },
  { id: "proc-col-5", title: "Rớt visa" },
  { id: "proc-col-6", title: "Đậu visa" },
] as const;

type ProcColId = (typeof PROC_COLUMNS)[number]["id"];

const PROC_COL_MAP = Object.fromEntries(
  PROC_COLUMNS.map((c) => [c.id, c]),
) as Record<ProcColId, { id: ProcColId; title: string }>;

type ProcColumnsState = Record<ProcColId, { id: ProcColId; title: string; taskIds: string[] }>;

const buildEmptyColumns = (): ProcColumnsState =>
  PROC_COLUMNS.reduce<ProcColumnsState>(
    (acc, c) => { acc[c.id] = { id: c.id, title: c.title, taskIds: [] }; return acc; },
    {} as ProcColumnsState,
  );

// ==========================================
// HELPERS
// ==========================================
function getDocProgress(task: Task) {
  const checklistType = task.checklistType || "tourism";
  const jobType = task.jobType || "Nhân viên";

  let requirements: unknown[] = [];
  if (checklistType === "tourism") requirements = getRequirementsList(jobType);
  else if (checklistType === "labor") requirements = getLaborRequirements();
  else if (checklistType === "study") requirements = getStudyAbroadRequirements();

  const totalCount = requirements.length || 1;
  const doneCount = task.documents ? Object.keys(task.documents).length : 0;
  const percent = Math.min(Math.round((doneCount / totalCount) * 100), 100);
  return { totalCount, doneCount, percent };
}

async function moveTaskToColumn(taskId: string, colId: string) {
  await fetch(`${API_BASE_URL}/tasks/${taskId}/processing-move`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ processingColId: colId }),
  });
}

// ==========================================
// SUB-COMPONENTS
// ==========================================
interface ColumnSelectProps {
  taskId: string;
  currentColId: string;
  onMoved: () => void;
  className?: string;
}

const ColumnSelect: React.FC<ColumnSelectProps> = ({
  taskId,
  currentColId,
  onMoved,
  className,
}) => (
  <select
    value={currentColId}
    onChange={async (e) => {
      try {
        await moveTaskToColumn(taskId, e.target.value);
        onMoved();
      } catch {
        alert("Lỗi khi chuyển cột xử lý!");
      }
    }}
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
    className={className}
  >
    {PROC_COLUMNS.map((c) => (
      <option key={c.id} value={c.id}>
        {c.title}
      </option>
    ))}
  </select>
);

// ==========================================
// MAIN COMPONENT
// ==========================================
interface ProcessingBoardProps {
  onOpenDetail: (taskId: string) => void;
  onOpenAttachments: (taskId: string) => void;
  currentUser: AuthUser;
}

const ProcessingBoard: React.FC<ProcessingBoardProps> = ({
  onOpenDetail,
  onOpenAttachments,
  currentUser,
}) => {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [procColumns, setProcColumns] = useState<ProcColumnsState>(buildEmptyColumns);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"kanban" | "table">("kanban");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSale, setFilterSale] = useState("all");
  const [filterVisa, setFilterVisa] = useState("all");
  const [filterProgress, setFilterProgress] = useState("all");

  // ==========================================
  // DATA FETCH
  // ==========================================
  const fetchBoardData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/board`);
      if (!res.ok) throw new Error("Không thể tải dữ liệu");
      const data: BoardData = await res.json();
      setBoardData(data);

      const processingCol = Object.values(data.columns).find(
        (col: Column) => col.title?.toLowerCase().includes("đang xử lý") || col.id === "col-5",
      );

      const newCols = buildEmptyColumns();
      (processingCol?.taskIds || []).forEach((taskId) => {
        const task = data.tasks[taskId];
        if (!task) return;
        const colId = (task.processingColId || "proc-col-1") as ProcColId;
        if (newCols[colId]) newCols[colId].taskIds.push(taskId);
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
    const refresh = () => fetchBoardData(false);
    socket.on("data_changed", refresh);
    window.addEventListener("refreshBoard", refresh);
    return () => {
      socket.off("data_changed", refresh);
      window.removeEventListener("refreshBoard", refresh);
    };
  }, [fetchBoardData]);

  // ==========================================
  // FILTER
  // ==========================================
  const filterOptions = useMemo(() => {
    if (!boardData) return { sales: [], visaTypes: [] };
    const allTasks = Object.values(procColumns)
      .flatMap((c) => c.taskIds)
      .map((id) => boardData.tasks[id])
      .filter(Boolean);

    const sales = [...new Set(allTasks.map((t) => t.assignedTo).filter(Boolean))]
      .sort()
      .map((name) => ({ value: name, label: name }));

    const visaTypes = [...new Set(allTasks.map((t) => t.visaType).filter(Boolean))]
      .sort()
      .map((v) => ({ value: v!, label: v! }));

    return { sales, visaTypes };
  }, [boardData, procColumns]);

  const isTaskVisible = useCallback(
    (task: Task): boolean => {
      if (!task) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        if (
          !task.content?.toLowerCase().includes(q) &&
          !task.assignedTo?.toLowerCase().includes(q) &&
          !task.visaType?.toLowerCase().includes(q)
        )
          return false;
      }

      if (filterSale !== "all" && task.assignedTo !== filterSale) return false;
      if (filterVisa !== "all" && task.visaType !== filterVisa) return false;

      if (filterProgress !== "all") {
        const { percent } = getDocProgress(task);
        if (filterProgress === "missing" && percent >= 100) return false;
        if (filterProgress === "done" && percent < 100) return false;
      }

      return true;
    },
    [searchQuery, filterSale, filterVisa, filterProgress],
  );

  const hasActiveFilter = useMemo(
    () =>
      searchQuery !== "" ||
      filterSale !== "all" ||
      filterVisa !== "all" ||
      filterProgress !== "all",
    [searchQuery, filterSale, filterVisa, filterProgress],
  );

  const handleResetFilter = useCallback(() => {
    setSearchQuery("");
    setFilterSale("all");
    setFilterVisa("all");
    setFilterProgress("all");
  }, []);

  // ==========================================
  // COUNTS
  // ==========================================
  const { filteredTotal, totalTasks } = useMemo(() => {
    if (!boardData) return { filteredTotal: 0, totalTasks: 0 };
    const all = Object.values(procColumns).flatMap((c) => c.taskIds);
    const filtered = all.filter((id) => boardData.tasks[id] && isTaskVisible(boardData.tasks[id]));
    return { filteredTotal: filtered.length, totalTasks: all.length };
  }, [boardData, procColumns, isTaskVisible]);

  const filteredTasks = useMemo(() => {
    if (!boardData) return [];
    return Object.values(procColumns)
      .flatMap((c) => c.taskIds)
      .map((id) => boardData.tasks[id])
      .filter(Boolean)
      .filter(isTaskVisible);
  }, [boardData, procColumns, isTaskVisible]);

  // ==========================================
  // DRAG & DROP
  // ==========================================
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const startCol = procColumns[source.droppableId as ProcColId];
    const finishCol = procColumns[destination.droppableId as ProcColId];
    if (!startCol || !finishCol) return;

    if (startCol.id === finishCol.id && destination.index === source.index) return;

    if (startCol.id === finishCol.id) {
      // Same column: reorder
      const newTaskIds = [...startCol.taskIds];
      newTaskIds.splice(newTaskIds.indexOf(draggableId), 1);
      newTaskIds.splice(destination.index, 0, draggableId);
      setProcColumns({ ...procColumns, [startCol.id]: { ...startCol, taskIds: newTaskIds } });
    } else {
      // Cross-column: move
      const startTaskIds = startCol.taskIds.filter((id) => id !== draggableId);
      const finishTaskIds = [...finishCol.taskIds, draggableId];
      setProcColumns({
        ...procColumns,
        [startCol.id]: { ...startCol, taskIds: startTaskIds },
        [finishCol.id]: { ...finishCol, taskIds: finishTaskIds },
      });
    }

    try {
      await moveTaskToColumn(draggableId, destination.droppableId);
    } catch {
      fetchBoardData(false);
      alert("Lỗi khi chuyển cột xử lý!");
    }
  };

  // ==========================================
  // PING SALE
  // ==========================================
  const handlePingSale = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.assignedTo) return alert("Hồ sơ này chưa có Sale phụ trách!");

    const customerName = task.content.split(" - ")[0];
    const reason = window.prompt(
      `Nhập loại giấy tờ còn thiếu để báo cho [${task.assignedTo}] bổ sung:`,
    );
    if (!reason) return;

    try {
      await fetch(`${API_BASE_URL}/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          saleName: task.assignedTo,
          sender: currentUser.name,
          customMessage: `⚠️ GẤP! Khách hàng ${customerName} đang thiếu: ${reason}. Vui lòng bổ sung ngay!`,
          taskId: task.id,
        }),
      });
      alert(`Đã gửi yêu cầu bổ sung cho Sale: ${task.assignedTo}`);
    } catch {
      alert("Lỗi gửi thông báo!");
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
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
          <h2 className="text-2xl font-bold text-gray-800">Tiến độ Xử lý Hồ sơ</h2>
          <p className="text-sm text-gray-500 mt-1">Quản lý hồ sơ đã được Sale bàn giao</p>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex gap-1 mb-4 shrink-0 bg-gray-200/60 p-1 rounded-lg w-fit">
        {(["kanban", "table"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              activeTab === tab
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "kanban" ? "🗂 Kanban" : "📊 Table"}
          </button>
        ))}
      </div>

      {/* FILTER BAR */}
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

      {/* KANBAN VIEW */}
      {activeTab === "kanban" && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full w-full space-x-4 overflow-x-auto pb-6 items-start">
            {PROC_COLUMNS.map(({ id: columnId }) => {
              const column = procColumns[columnId];
              const allTasks = column.taskIds
                .map((id) => boardData.tasks[id])
                .filter(Boolean);
              const visibleCount = hasActiveFilter
                ? allTasks.filter(isTaskVisible).length
                : allTasks.length;

              return (
                <div
                  key={columnId}
                  className="flex flex-col bg-gray-200/60 rounded-xl w-56 min-w-[14rem] max-h-full shrink-0 border border-gray-300 shadow-sm"
                >
                  {/* Column header */}
                  <div className="p-3 flex justify-between items-center bg-gray-100 rounded-t-xl border-b border-gray-300">
                    <h3 className="font-bold text-gray-700 uppercase text-[12px] tracking-wide">
                      {PROC_COL_MAP[columnId].title}
                    </h3>
                    <div className="flex items-center gap-1">
                      {hasActiveFilter && visibleCount !== allTasks.length && (
                        <span className="text-orange-500 text-xs font-bold">
                          {visibleCount}/
                        </span>
                      )}
                      <span className="bg-gray-300 text-gray-800 text-xs font-bold px-2 py-0.5 rounded-full">
                        {allTasks.length}
                      </span>
                    </div>
                  </div>

                  {/* Droppable zone */}
                  <Droppable droppableId={columnId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 p-3 space-y-3 overflow-y-auto rounded-b-xl transition-colors duration-200 ${
                          snapshot.isDraggingOver ? "bg-gray-300/50" : ""
                        }`}
                        style={{ minHeight: "150px" }}
                      >
                        {/*
                         * Render TẤT CẢ tasks (không filter ra) để DnD giữ
                         * index nhất quán. Task bị filter sẽ collapse height:0.
                         * isDragDisabled cho task ẩn → chỉ task visible mới kéo được.
                         */}
                        {allTasks.map((task, index) => {
                          const isHidden = hasActiveFilter && !isTaskVisible(task);
                          const { totalCount, doneCount, percent } = getDocProgress(task);
                          const isMissing = percent < 100 && columnId === "proc-col-1";

                          return (
                            <Draggable
                              key={task.id}
                              draggableId={task.id}
                              index={index}
                              isDragDisabled={isHidden}
                            >
                              {(provided, snapshot) => {
                                const card = (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => !isHidden && onOpenDetail(task.id)}
                                    style={{
                                      ...provided.draggableProps.style,
                                      // Collapse filtered-out tasks: không chiếm space,
                                      // vẫn ở trong DOM để DnD tracking đúng index
                                      ...(isHidden && !snapshot.isDragging
                                        ? { height: 0, overflow: "hidden", margin: 0, padding: 0 }
                                        : {}),
                                    }}
                                    className={[
                                      "bg-white p-3 rounded-xl shadow-sm border-l-[4px] cursor-grab active:cursor-grabbing relative group transition-all",
                                      isMissing
                                        ? "border-l-red-500 bg-red-50"
                                        : "border-l-indigo-500 hover:shadow-md",
                                      snapshot.isDragging ? "shadow-2xl z-[9999]" : "",
                                      isHidden ? "pointer-events-none" : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  >
                                    {!isHidden && (
                                      <>
                                        {isMissing && (
                                          <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                            <span
                                              className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"
                                              title="Chưa đủ hồ sơ"
                                            />
                                          </span>
                                        )}

                                        <h4 className="font-bold text-gray-800 text-xs pr-4 truncate mb-1">
                                          {task.content.split(" - ")[0]}
                                        </h4>

                                        <div className="flex flex-nowrap gap-1 mb-2 overflow-hidden">
                                          {(task.visaType || task.content.split(" - ")[1]) && (
                                            <p className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 truncate max-w-22.5 shrink-0">
                                              {task.visaType || task.content.split(" - ")[1]}
                                            </p>
                                          )}
                                          {task.jobType && (
                                            <p className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 truncate max-w-20 shrink-0">
                                              {task.jobType}
                                            </p>
                                          )}
                                        </div>

                                        <div className="mb-2">
                                          <div className="flex justify-between text-2xs font-bold text-gray-500 mb-1">
                                            <span>Giấy tờ:</span>
                                            <span className={percent === 100 ? "text-green-500" : "text-red-500"}>
                                              {doneCount}/{totalCount}
                                            </span>
                                          </div>
                                          <Progress
                                            progress={percent}
                                            color={percent === 100 ? "green" : "indigo"}
                                            size="sm"
                                          />
                                        </div>

                                        <div className="flex items-center justify-between border-t border-gray-100 pt-2 gap-1 mt-1">
                                          <span
                                            className="text-[9px] font-bold text-gray-700 bg-gray-50 px-1.5 py-1 rounded border border-gray-200 truncate max-w-11.25 shrink-0 text-center"
                                            title={task.assignedTo || "Trống"}
                                          >
                                            {task.assignedTo?.split(" ").pop() ?? "Trống"}
                                          </span>

                                          <div className="flex-1 min-w-0">
                                            <ColumnSelect
                                              taskId={task.id}
                                              currentColId={columnId}
                                              onMoved={() => fetchBoardData(false)}
                                              className="text-[9px] font-medium px-1 py-1 rounded border border-gray-200 bg-white outline-none cursor-pointer w-full text-gray-700 hover:border-indigo-300 transition-colors"
                                            />
                                          </div>

                                          <div className="flex gap-1 shrink-0 items-center">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenAttachments(task.id);
                                              }}
                                              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-green-600 bg-gray-50 hover:bg-green-50 rounded border border-gray-200 transition-colors"
                                              title="Xem danh sách tài liệu"
                                            >
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                              </svg>
                                            </button>
                                            <button
                                              onClick={(e) => handlePingSale(task, e)}
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
                                      </>
                                    )}
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

                        {hasActiveFilter && visibleCount === 0 && allTasks.length > 0 && (
                          <p className="text-center py-4 text-gray-300 text-xs italic">
                            Không khớp bộ lọc
                          </p>
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

      {/* TABLE VIEW */}
      {activeTab === "table" && (
        <div className="flex-1 overflow-y-auto pb-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Khách hàng", "Sale", "Loại Visa", "Tiến độ giấy tờ", "Trạng thái (Cột)", "Chuyển cột"].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide"
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400 italic text-sm">
                      Không tìm thấy hồ sơ phù hợp
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task, i) => {
                    const { totalCount, doneCount, percent } = getDocProgress(task);
                    const currentColId = (task.processingColId || "proc-col-1") as ProcColId;
                    const columnInfo = PROC_COL_MAP[currentColId];
                    const isMissing = percent < 100;

                    return (
                      <tr
                        key={task.id}
                        onClick={() => onOpenDetail(task.id)}
                        className={`cursor-pointer transition-colors hover:bg-indigo-50/30 ${
                          i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-800">{task.content.split(" - ")[0]}</p>
                          <p className="text-xs text-gray-500 mt-0.5 font-medium">{task.phone}</p>
                        </td>

                        <td className="px-4 py-3 font-medium text-gray-700">
                          {task.assignedTo?.split(" ").pop() ?? "Trống"}
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-indigo-50 text-indigo-600 border-indigo-100">
                            {task.visaType || task.content.split(" - ")[1] || "—"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-25">
                              <Progress
                                progress={percent}
                                color={percent === 100 ? "green" : "indigo"}
                                size="sm"
                              />
                            </div>
                            <span className={`text-xs font-bold ${percent === 100 ? "text-green-600" : "text-gray-500"}`}>
                              {doneCount}/{totalCount}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                              isMissing && currentColId === "proc-col-1"
                                ? "bg-red-50 text-red-600 border border-red-200"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {columnInfo?.title ?? "Không rõ"}
                          </span>
                        </td>

                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <ColumnSelect
                            taskId={task.id}
                            currentColId={currentColId}
                            onMoved={() => fetchBoardData(false)}
                            className="text-xs font-medium px-2 py-1.5 rounded border border-gray-200 bg-white outline-none cursor-pointer w-full text-gray-700 hover:border-indigo-300 transition-colors"
                          />
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
