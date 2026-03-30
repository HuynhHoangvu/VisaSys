import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Spinner } from "flowbite-react";
import type {
  BoardData,
  AuthUser,
  Notification,
  Task,
  Column,
  Employee,
} from "../../types";
import { io } from "socket.io-client";
import SearchFilterBar from "../filter/SearchFilterBar";

interface KanbanBoardProps {
  onOpenActivityList: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
  onDeleteCustomer: (taskId: string) => Promise<void>;
  onToggleActivity: (taskId: string, activityId: string) => Promise<void>;
  onOpenAddCustomer: () => void;
  onOpenAttachments: (taskId: string) => void;
  currentUser: AuthUser | null;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const socket = io(API_URL);

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  onOpenActivityList,
  onOpenDetail,
  onDeleteCustomer,
  onToggleActivity,
  onOpenAddCustomer,
  onOpenAttachments,
  currentUser,
}) => {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [staffList, setStaffList] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);
  const [isShowReport, setIsShowReport] = useState(false);

  const [viewMode, setViewMode] = useState<"board" | "table">("board");
  const [visibleLimits, setVisibleLimits] = useState<Record<string, number>>(
    {},
  );
  const DEFAULT_LIMIT = 20;

  // Lọc
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSale, setFilterSale] = useState("all");
  const [filterVisa, setFilterVisa] = useState("all");
  const [filterColumn, setFilterColumn] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");

  // Phân quyền
  const userRole = currentUser?.role?.trim().toLowerCase() || "";
  const isBoss = userRole.includes("giám đốc") || currentUser?.id === "admin";
  const isManager =
    userRole === "quản lý" ||
    userRole === "trưởng phòng" ||
    userRole === "admin";
  const isMarketingDept =
    currentUser?.department?.toLowerCase().includes("marketing") || false;

  const isProcessingDept = ["xử lý hồ sơ", "hồ sơ", "trợ lý giám đốc"].some(
    (d) => currentUser?.department?.toLowerCase().includes(d),
  );

  const canSeeAll = isBoss || isManager || isProcessingDept || isMarketingDept;

  useEffect(() => {
    const fetchStaffList = async () => {
      try {
        const response = await fetch(`${API_URL}/api/hr/employees`);
        if (response.ok) {
          const data: Employee[] = await response.json();
          setStaffList(data);
        }
      } catch (error) {
        console.error("Lỗi tải danh sách nhân viên:", error);
      }
    };
    fetchStaffList();
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!currentUser?.name) return;
      try {
        const res = await fetch(
          `${API_URL}/api/notifications/${currentUser.name}`,
        );
        if (!res.ok) return;
        const notifs: Notification[] = await res.json();
        setActiveAlerts(
          notifs
            .filter((n) => !n.isRead && n.taskId)
            .map((n) => n.taskId as string),
        );
      } catch (error) {
        console.error("Lỗi khi lấy thông báo khẩn:", error);
      }
    };
    fetchAlerts();
    socket.on("data_changed", fetchAlerts);
    return () => {
      socket.off("data_changed", fetchAlerts);
    };
  }, [currentUser]);

  const fetchBoardData = useCallback(
    async (showSpinner = true) => {
      try {
        if (showSpinner) setIsLoading(true);
        const response = await fetch(`${API_URL}/api/board`);
        if (!response.ok) throw new Error("Không thể tải dữ liệu");
        const rawData: BoardData = await response.json();
        let processedData = { ...rawData };

        if (!canSeeAll && currentUser?.name) {
          const filteredTasks: Record<string, Task> = {};
          const allowedTaskIds = new Set<string>();
          const currentUserName = currentUser.name.trim();

          Object.values(rawData.tasks).forEach((task) => {
            if (task.assignedTo?.trim() === currentUserName) {
              filteredTasks[task.id] = task;
              allowedTaskIds.add(task.id);
            }
          });

          const filteredColumns: Record<string, Column> = {};
          Object.keys(rawData.columns).forEach((colId) => {
            filteredColumns[colId] = {
              ...rawData.columns[colId],
              taskIds: rawData.columns[colId].taskIds.filter((id: string) =>
                allowedTaskIds.has(id),
              ),
            };
          });

          processedData = {
            ...processedData,
            tasks: filteredTasks,
            columns: filteredColumns,
          };
        }

        setBoardData(processedData);
        setError(null);
      } catch (err) {
        setError("Lỗi kết nối đến server: " + err);
      } finally {
        if (showSpinner) setIsLoading(false);
      }
    },
    [canSeeAll, currentUser],
  );

  useEffect(() => {
    fetchBoardData(true);
    const handleDataChange = () => fetchBoardData(false);
    socket.on("data_changed", handleDataChange);
    window.addEventListener("refreshBoard", handleDataChange);
    return () => {
      socket.off("data_changed", handleDataChange);
      window.removeEventListener("refreshBoard", handleDataChange);
    };
  }, [fetchBoardData]);

  const filterOptions = useMemo(() => {
    if (!boardData) return { sales: [], visaTypes: [], columns: [] };
    const allTasks = Object.values(boardData.tasks);

    let sales = [];
    if (staffList.length > 0) {
      sales = staffList
        .map((emp) => ({ value: emp.name, label: emp.name }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } else {
      sales = [...new Set(allTasks.map((t) => t.assignedTo).filter(Boolean))]
        .sort()
        .map((name) => ({ value: name, label: name }));
    }

    const visaTypes = [
      ...new Set(
        allTasks
          .map((t) => t.visaType)
          .filter((val) => val && val.trim() !== ""),
      ),
    ]
      .sort()
      .map((v) => ({ value: v!, label: v! }));

    const columns = boardData.columnOrder
      .map((colId) => boardData.columns[colId])
      .filter(Boolean)
      .map((col) => ({ value: col.id, label: col.title }));

    return { sales, visaTypes, columns };
  }, [boardData, staffList]);

  const getFilteredTaskIds = useCallback(
    (columnId: string): string[] => {
      if (!boardData) return [];
      const column = boardData.columns[columnId];
      if (!column) return [];
      if (filterColumn !== "all" && filterColumn !== columnId) return [];

      const now = new Date();

      return column.taskIds.filter((taskId) => {
        const task = boardData.tasks[taskId];
        if (!task) return false;

        if (searchQuery) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = task.content?.toLowerCase().includes(q);
          const matchPhone = task.phone?.toLowerCase().includes(q);
          if (!matchName && !matchPhone) return false;
        }

        if (filterSale !== "all" && task.assignedTo !== filterSale)
          return false;
        if (filterVisa !== "all" && task.visaType !== filterVisa) return false;

        if (filterSource !== "all") {
          if (!task.source) return false;
          const s = task.source;
          const f = filterSource;
          const isMatch =
            s === f ||
            (f === "Facebook Ads" && s === "Facebook") ||
            (f === "Tiktok Ads" && s === "TikTok") ||
            (f === "Facebook cá nhân" && s === "Cá Nhân");
          if (!isMatch) return false;
        }

        if (filterDateRange !== "all") {
          if (!task.createdAt) return false;
          const taskDate = new Date(task.createdAt);
          if (isNaN(taskDate.getTime())) return false;
          const diffTime = Math.abs(now.getTime() - taskDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (filterDateRange === "7days" && diffDays > 7) return false;
          if (filterDateRange === "30days" && diffDays > 30) return false;
        }
        return true;
      });
    },
    [
      boardData,
      searchQuery,
      filterSale,
      filterVisa,
      filterColumn,
      filterSource,
      filterDateRange,
    ],
  );

  const filteredTotal = useMemo(() => {
    if (!boardData) return 0;
    return boardData.columnOrder.reduce(
      (sum, colId) => sum + getFilteredTaskIds(colId).length,
      0,
    );
  }, [boardData, getFilteredTaskIds]);

  const totalTasks = useMemo(() => {
    if (!boardData) return 0;
    return Object.keys(boardData.tasks).length;
  }, [boardData]);

  const hasActiveFilter = useMemo(() => {
    return (
      searchQuery !== "" ||
      filterSale !== "all" ||
      filterVisa !== "all" ||
      filterColumn !== "all" ||
      filterSource !== "all" ||
      filterDateRange !== "all"
    );
  }, [
    searchQuery,
    filterSale,
    filterVisa,
    filterColumn,
    filterSource,
    filterDateRange,
  ]);

  const handleResetFilter = useCallback(() => {
    setSearchQuery("");
    setFilterSale("all");
    setFilterVisa("all");
    setFilterColumn("all");
    setFilterSource("all");
    setFilterDateRange("all");
  }, []);

  const handleLoadMore = (columnId: string) => {
    setVisibleLimits((prev) => ({
      ...prev,
      [columnId]: (prev[columnId] || DEFAULT_LIMIT) + 20,
    }));
  };

  const flatTableData = useMemo(() => {
    if (!boardData) return [];
    let flatList: (Task & { columnTitle: string; columnId: string })[] = [];
    boardData.columnOrder.forEach((colId) => {
      const colTitle = boardData.columns[colId].title;
      const tasksInCol = getFilteredTaskIds(colId).map((taskId) => ({
        ...boardData.tasks[taskId],
        columnTitle: colTitle,
        columnId: colId,
      }));
      flatList = [...flatList, ...tasksInCol];
    });
    return flatList;
  }, [boardData, getFilteredTaskIds]);

  const handleStatusChange = async (
    taskId: string,
    currentColumnId: string,
    newColumnId: string,
  ) => {
    if (!boardData || currentColumnId === newColumnId) return;

    setBoardData((prev) => {
      if (!prev) return prev;
      const sourceCol = prev.columns[currentColumnId];
      const destCol = prev.columns[newColumnId];

      const sourceTaskIds = Array.from(sourceCol.taskIds);
      sourceTaskIds.splice(sourceTaskIds.indexOf(taskId), 1);

      const destTaskIds = Array.from(destCol.taskIds);
      destTaskIds.push(taskId);

      return {
        ...prev,
        columns: {
          ...prev.columns,
          [sourceCol.id]: { ...sourceCol, taskIds: sourceTaskIds },
          [destCol.id]: { ...destCol, taskIds: destTaskIds },
        },
      };
    });

    try {
      await fetch(`${API_URL}/api/tasks/${taskId}/move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId: newColumnId }),
      });
    } catch (error) {
      console.error("Lỗi khi chuyển cột:", error);
      fetchBoardData(false);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || !boardData) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    const startCol = boardData.columns[source.droppableId];
    const finishCol = boardData.columns[destination.droppableId];

    if (startCol === finishCol) {
      const newTaskIds = Array.from(startCol.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);
      setBoardData({
        ...boardData,
        columns: {
          ...boardData.columns,
          [startCol.id]: { ...startCol, taskIds: newTaskIds },
        },
      });
    } else {
      const startTaskIds = Array.from(startCol.taskIds);
      startTaskIds.splice(source.index, 1);
      const finishTaskIds = Array.from(finishCol.taskIds);
      finishTaskIds.splice(destination.index, 0, draggableId);
      setBoardData({
        ...boardData,
        columns: {
          ...boardData.columns,
          [startCol.id]: { ...startCol, taskIds: startTaskIds },
          [finishCol.id]: { ...finishCol, taskIds: finishTaskIds },
        },
      });
    }

    try {
      await fetch(`${API_URL}/api/tasks/${draggableId}/move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId: destination.droppableId }),
      });
    } catch (error) {
      fetchBoardData(false);
      console.error("Lỗi khi cập nhật vị trí thẻ:", error);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    onDeleteCustomer(taskId);
  };

  const handleActivityClick = (
    e: React.MouseEvent,
    taskId: string,
    activityId: string,
  ) => {
    e.stopPropagation();
    onToggleActivity(taskId, activityId);
  };

  const getActivityConfig = (type: string, completed?: boolean) => {
    if (completed)
      return { icon: "✅", color: "bg-green-50", border: "border-green-200" };
    switch (type) {
      case "Gọi":
        return { icon: "📞", color: "bg-blue-50", border: "border-blue-200" };
      case "Email":
        return {
          icon: "✉️",
          color: "bg-purple-50",
          border: "border-purple-200",
        };
      case "Cuộc họp":
        return {
          icon: "🤝",
          color: "bg-orange-50",
          border: "border-orange-200",
        };
      default:
        return { icon: "📄", color: "bg-gray-50", border: "border-gray-200" };
    }
  };

  const getCardStyle = (
    columnId: string,
    isDragging: boolean,
    isAlerted: boolean,
  ) => {
    let baseClass =
      "bg-white border shadow-sm hover:shadow transition-colors duration-200 rounded-lg";
    if (isAlerted)
      return "bg-red-50 border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse rounded-lg";
    if (isDragging)
      return "bg-white ring-2 ring-blue-400 shadow-xl z-[9999] scale-[1.02] rounded-lg";
    switch (columnId) {
      case "col-1":
        baseClass += " border-l-4 border-l-gray-400";
        break;
      case "col-2":
        baseClass += " border-l-4 border-l-blue-500";
        break;
      case "col-3":
        baseClass += " border-l-4 border-l-yellow-400";
        break;
      case "col-4":
        baseClass += " border-l-4 border-l-green-500";
        break;
      default:
        baseClass += " border-l-4 border-l-indigo-500";
        break;
    }
    return baseClass;
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="xl" />
      </div>
    );
  if (error || !boardData)
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-500">{error || "Không có dữ liệu"}</p>
        <button
          onClick={() => fetchBoardData(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Thử lại
        </button>
      </div>
    );

  return (
    <div
      className="flex flex-col h-full w-full bg-[#f8f9fa] p-3 sm:p-6 overflow-hidden"
      style={{ transform: "none" }}
    >
      <style>{`
        @keyframes custom-pop-in {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-custom-pop {
          animation: custom-pop-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 shrink-0 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
            Quản lý Khách hàng
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            {canSeeAll
              ? "Đang xem toàn bộ hệ thống"
              : `Danh sách khách hàng của ${currentUser?.name}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <button
            onClick={() =>
              setViewMode(viewMode === "board" ? "table" : "board")
            }
            className="flex-1 md:flex-none justify-center bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-sm font-semibold px-3 py-2 sm:px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2"
          >
            {viewMode === "board" ? (
              <>
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
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                <span className="hidden sm:inline">Xem dạng Bảng</span>
              </>
            ) : (
              <>
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
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                  />
                </svg>
                <span className="hidden sm:inline">Xem dạng Cột</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenAddCustomer}
            className="flex-1 md:flex-none justify-center bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 sm:px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="hidden sm:inline">Thêm Khách Hàng</span>
            <span className="sm:hidden">Thêm Mới</span>
          </button>

          {isMarketingDept && (
            <button
              onClick={() => setIsShowReport(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-95"
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Thống kê nhanh
            </button>
          )}
        </div>
      </div>

      {/* SEARCH + FILTER */}
      <div className="shrink-0 mb-2">
        <SearchFilterBar
          searchPlaceholder="Tìm tên, SĐT, nhân viên..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            ...(canSeeAll
              ? [
                  {
                    key: "sale",
                    placeholder: "👤 Nhân viên",
                    value: filterSale,
                    options: filterOptions.sales,
                    onChange: setFilterSale,
                  },
                ]
              : []),
            {
              key: "source",
              placeholder: "🌐 Nguồn khách",
              value: filterSource,
              options: [
                { value: "Facebook Ads", label: "Facebook Ads" },
                { value: "Facebook cá nhân", label: "Facebook cá nhân" },
                { value: "Tiktok Ads", label: "Tiktok Ads" },
                { value: "Tiktok cá nhân", label: "Tiktok cá nhân" },
                { value: "Zalo", label: "Zalo" },
                { value: "Website", label: "Website" },
                { value: "Giới thiệu", label: "Giới thiệu" },
                { value: "Hotline", label: "Hotline" },
              ],
              onChange: setFilterSource,
            },
            {
              key: "dateRange",
              placeholder: "📅 Thời gian",
              value: filterDateRange,
              options: [
                { value: "7days", label: "7 ngày qua" },
                { value: "30days", label: "30 ngày qua" },
                { value: "all", label: "Tất cả thời gian" },
              ],
              onChange: setFilterDateRange,
            },
            {
              key: "visa",
              placeholder: "🛂 Loại visa",
              value: filterVisa,
              options: filterOptions.visaTypes,
              onChange: setFilterVisa,
            },
            {
              key: "column",
              placeholder: "📋 Trạng thái",
              value: filterColumn,
              options: filterOptions.columns,
              onChange: setFilterColumn,
            },
          ]}
          resultCount={filteredTotal}
          totalCount={totalTasks}
          onReset={handleResetFilter}
          hasActiveFilter={hasActiveFilter}
        />

        {isMarketingDept && (
          <div className="flex items-center gap-3 mt-3 mb-1 px-2">
            <div className="flex items-center gap-2 py-1.5 px-4 bg-orange-50 border border-orange-100 rounded-lg shadow-sm">
              <div className="flex -space-x-1">
                <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                <span className="w-2 h-2 rounded-full bg-orange-300 animate-pulse"></span>
              </div>
              <p className="text-xs font-semibold text-orange-800">
                Marketing Report:{" "}
                <span className="text-sm font-bold text-orange-600">
                  {filteredTotal}
                </span>{" "}
                khách hàng
                {filterSource !== "all" && ` từ ${filterSource}`}
                {filterDateRange !== "all" &&
                  ` trong ${filterDateRange === "7days" ? "7 ngày qua" : "30 ngày qua"}`}
              </p>
            </div>
            {filteredTotal > 0 && filterSource !== "all" && (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-md font-bold uppercase">
                Đang đo lường hiệu quả
              </span>
            )}
          </div>
        )}
      </div>

      {/* KANBAN BOARD */}
      {viewMode === "board" && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 min-h-0 w-full flex space-x-4 overflow-x-auto pb-2 items-start custom-scrollbar">
            {boardData.columnOrder.map((columnId) => {
              const column = boardData.columns[columnId];
              const filteredTaskIds = getFilteredTaskIds(columnId);
              const allTasksInCol = column.taskIds
                .map((id) => boardData.tasks[id])
                .filter(Boolean);

              if (filterColumn !== "all" && filterColumn !== columnId)
                return null;

              const limit = visibleLimits[columnId] || DEFAULT_LIMIT;
              const hasMore = column.taskIds.length > limit;
              const tasksToRender = hasActiveFilter ? column.taskIds : column.taskIds.slice(0, limit);

              return (
                <div
                  key={column.id}
                  className="flex flex-col bg-gray-100/50 rounded-xl w-[85vw] sm:w-52 min-w-[13rem] h-full shrink-0"
                >
                  <div className="px-3 py-3 flex justify-between items-center shrink-0 border-b border-gray-200/50">
                    <h3 className="font-bold text-gray-600 uppercase text-[11px] tracking-wider">
                      {column.title}
                    </h3>
                    <div className="flex items-center gap-1">
                      {hasActiveFilter &&
                        filteredTaskIds.length !== allTasksInCol.length && (
                          <span className="text-orange-500 text-2xs font-bold">
                            {filteredTaskIds.length}
                          </span>
                        )}
                      <span className="bg-gray-200 text-gray-600 text-2xs font-bold px-2 py-0.5 rounded-full">
                        {allTasksInCol.length}
                      </span>
                    </div>
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto custom-scrollbar px-2 pt-2 pb-4 space-y-2 transition-colors duration-200 rounded-b-xl ${
                          snapshot.isDraggingOver ? "bg-gray-200/50" : ""
                        }`}
                      >
                        {tasksToRender
                          .map((taskId) => boardData.tasks[taskId])
                          .filter(Boolean)
                          .filter(
                            (task) =>
                              !hasActiveFilter ||
                              filteredTaskIds.includes(task.id),
                          )
                          .map((task, index) => {
                            const isAlerted = activeAlerts.includes(task.id);

                            return (
                              <Draggable
                                key={task.id}
                                draggableId={task.id}
                                index={index}
                                isDragDisabled={
                                  hasActiveFilter || isMarketingDept
                                }
                              >
                                {(provided, snapshot) => {
                                  const card = (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => onOpenDetail(task.id)}
                                    className={`p-2 relative group select-none transition-colors duration-200 rounded-lg ${getCardStyle(
                                      column.id,
                                      snapshot.isDragging,
                                      isAlerted,
                                    )}`}
                                    style={{ ...provided.draggableProps.style }}
                                  >
                                    {/* Alert badge */}
                                    {isAlerted && (
                                      <div className="absolute -top-2 -left-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white z-10 animate-bounce">
                                        <svg
                                          className="w-3 h-3"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      </div>
                                    )}

                                    {/* Delete button */}
                                    {!isMarketingDept && (
                                      <button
                                        onClick={(e) =>
                                          handleDeleteClick(e, task.id)
                                        }
                                        className="absolute top-1 right-1 lg:opacity-0 lg:group-hover:opacity-100 opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
                                            d="M6 18L18 6M6 6l12 12"
                                          />
                                        </svg>
                                      </button>
                                    )}

                                    {/* Row 1: Tên + NV */}
                                    <div className="flex justify-between items-start mb-1 pr-4 gap-1">
                                      <h4 className="font-bold text-gray-800 text-xs leading-tight min-w-0 flex-1">
                                        {task.content.split(" - ")[0]}
                                      </h4>
                                      {task.assignedTo && (
                                        <div className="flex items-center gap-1 shrink-0 ml-1">
                                          <div className="w-3.5 h-3.5 rounded-full bg-indigo-50 flex items-center justify-center text-[7px] font-bold text-indigo-600 border border-indigo-100 shrink-0">
                                            {task.assignedTo
                                              .trim()
                                              .split(" ")
                                              .pop()
                                              ?.charAt(0)
                                              .toUpperCase()}
                                          </div>
                                          <span className="text-[9px] text-gray-500 whitespace-nowrap">
                                            {task.assignedTo
                                              .trim()
                                              .split(" ")
                                              .pop()}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Row 2: SĐT + Visa tag + Job tag */}
                                    <div className="flex flex-wrap items-center gap-1 mb-2">
                                      <span className="text-[11px] font-bold text-gray-700 w-full">
                                        {task.phone}
                                      </span>
                                      {task.visaType && (
                                        <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded font-semibold max-w-[90px] truncate">
                                          {task.visaType}
                                        </span>
                                      )}
                                      {task.jobType && (
                                        <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded font-semibold max-w-[90px] truncate">
                                          {task.jobType}
                                        </span>
                                      )}
                                    </div>

                                    {/* Row 3: Activities + Select cột + Icons */}
                                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-100 gap-1">
                                      {/* Activities: tối đa 1 + badge +N */}
                                      <div className="flex gap-1 items-center shrink-0">
                                        {task.activities &&
                                        task.activities.length > 0 ? (
                                          <>
                                            {task.activities
                                              .slice(0, 1)
                                              .map((act) => {
                                                const config =
                                                  getActivityConfig(
                                                    act.type,
                                                    act.completed,
                                                  );
                                                return (
                                                  <div
                                                    key={act.id}
                                                    title={act.summary}
                                                    onClick={(e) =>
                                                      handleActivityClick(
                                                        e,
                                                        task.id,
                                                        act.id,
                                                      )
                                                    }
                                                    className={`w-5 h-5 rounded-full border ${config.border} ${config.color} flex items-center justify-center text-[9px] cursor-pointer hover:scale-110 transition-transform shrink-0`}
                                                  >
                                                    {config.icon}
                                                  </div>
                                                );
                                              })}
                                            {task.activities.length > 1 && (
                                              <div className="w-5 h-5 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500 shrink-0">
                                                +{task.activities.length - 1}
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-[9px] text-gray-300 italic">
                                            Trống
                                          </span>
                                        )}
                                      </div>

                                      {/* Select + Icons */}
                                      <div className="flex items-center gap-0.5 min-w-0">
                                        <select
                                          value={column.id}
                                          onMouseDown={(e) =>
                                            e.stopPropagation()
                                          }
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) =>
                                            handleStatusChange(
                                              task.id,
                                              column.id,
                                              e.target.value,
                                            )
                                          }
                                          disabled={isMarketingDept}
                                          className="w-16 appearance-none bg-gray-50 border border-gray-200 text-gray-600 text-[9px] font-medium py-0.5 px-1 rounded cursor-pointer outline-none truncate disabled:opacity-50"
                                        >
                                          {boardData.columnOrder.map(
                                            (colId) => (
                                              <option
                                                key={colId}
                                                value={colId}
                                                className="text-left"
                                              >
                                                {boardData.columns[colId].title}
                                              </option>
                                            ),
                                          )}
                                        </select>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenAttachments(task.id);
                                          }}
                                          className="w-6 h-6 flex items-center justify-center rounded text-green-600 hover:bg-green-50 transition-colors shrink-0"
                                          title="Tệp đính kèm"
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
                                              strokeWidth={2.5}
                                              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                            />
                                          </svg>
                                        </button>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenActivityList(task.id);
                                          }}
                                          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
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
                                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
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

                        {hasMore && !hasActiveFilter && (
                          <button
                            onClick={() => handleLoadMore(column.id)}
                            className="w-full mt-2 py-3 sm:py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold text-sm sm:text-xs rounded-lg transition-colors border border-blue-200 border-dashed"
                          >
                            Tải thêm ({column.taskIds.length - limit}) ↓
                          </button>
                        )}
                        {hasActiveFilter &&
                          filteredTaskIds.length === 0 &&
                          allTasksInCol.length > 0 && (
                            <div className="text-center py-4 text-gray-400 text-xs italic">
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

      {/* TABLE VIEW */}
      {viewMode === "table" && (
        <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="overflow-auto custom-scrollbar flex-1 w-full">
            <table className="w-full min-w-[800px] text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">STT</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Số Điện Thoại</th>
                  <th className="px-4 py-3">Visa Quan Tâm</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Phụ trách</th>
                  <th className="px-4 py-3 text-right">Chi phí</th>
                  <th className="px-4 py-3 text-center w-16">Hồ sơ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {flatTableData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-10 text-gray-400 italic"
                    >
                      Không có khách hàng nào khớp với tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  flatTableData.map((task, index) => (
                    <tr
                      key={task.id}
                      onClick={() => onOpenDetail(task.id)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-center text-gray-400 font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-800">
                        <div className="flex items-center gap-2">
                          {activeAlerts.includes(task.id) && (
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                          )}
                          {task.content}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-600">
                        {task.phone}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
                            {task.visaType || "Chưa rõ"}
                          </span>
                          {task.jobType && (
                            <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap">
                              {task.jobType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={task.columnId}
                          onChange={(e) =>
                            handleStatusChange(
                              task.id,
                              task.columnId,
                              e.target.value,
                            )
                          }
                          disabled={isMarketingDept}
                          className="bg-gray-50 border border-gray-300 text-gray-900 text-xs font-bold rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 cursor-pointer hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                          {boardData.columnOrder.map((colId) => (
                            <option key={colId} value={colId}>
                              {boardData.columns[colId].title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {task.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                              {task.assignedTo
                                .trim()
                                .split(" ")
                                .pop()
                                ?.charAt(0)
                                .toUpperCase()}
                            </div>
                            <span className="text-sm">
                              {task.assignedTo.trim().split(" ").pop()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">
                            Chưa giao
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">
                        {task.price}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAttachments(task.id);
                            }}
                            className="w-10 h-10 flex items-center justify-center rounded-lg text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors shadow-sm"
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
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
            <span>
              Tổng số:{" "}
              <strong className="text-gray-800">{flatTableData.length}</strong>{" "}
              khách hàng
            </span>
            <span className="hidden sm:inline">
              Bấm vào dòng để xem chi tiết
            </span>
          </div>
        </div>
      )}

      {/* POPUP MARKETING REPORT */}
      {isShowReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-custom-pop">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <div>
                <h3 className="text-lg font-bold text-indigo-900">
                  Báo cáo hiệu quả Marketing
                </h3>
                <p className="text-xs text-indigo-600 font-medium">
                  {filterDateRange !== "all"
                    ? `Dữ liệu lọc trong ${filterDateRange === "7days" ? "7 ngày qua" : "30 ngày qua"}`
                    : "Toàn bộ thời gian"}
                </p>
              </div>
              <button
                onClick={() => setIsShowReport(false)}
                className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-red-500 transition-colors outline-none"
              >
                <svg
                  className="w-6 h-6"
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

            <div className="p-6">
              <div className="px-6 pb-4 flex justify-center gap-2">
                {[
                  { id: "all", label: "Tất cả" },
                  { id: "7days", label: "7 ngày qua" },
                  { id: "30days", label: "30 ngày qua" },
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setFilterDateRange(range.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      filterDateRange === range.id
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-white text-gray-500 border border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                  <p className="text-[10px] uppercase font-bold text-blue-500 mb-1">
                    Khách hàng thu về
                  </p>
                  <span className="text-3xl font-black text-blue-700">
                    {filteredTotal}
                  </span>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
                  <p className="text-[10px] uppercase font-bold text-green-500 mb-1">
                    Đã chốt hợp đồng
                  </p>
                  <span className="text-3xl font-black text-green-700">
                    {flatTableData.filter((t) => t.columnId === "col-4").length}
                  </span>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-center">
                  <p className="text-[10px] uppercase font-bold text-purple-500 mb-1">
                    Tỷ lệ chuyển đổi
                  </p>
                  <span className="text-3xl font-black text-purple-700">
                    {filteredTotal > 0
                      ? (
                          (flatTableData.filter((t) => t.columnId === "col-4")
                            .length /
                            filteredTotal) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3 text-left">Nguồn khách hàng</th>
                      <th className="px-4 py-3 text-center">Số lượng</th>
                      <th className="px-4 py-3 text-right">Tỷ trọng (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      "Facebook Ads",
                      "Facebook cá nhân",
                      "Tiktok Ads",
                      "Tiktok cá nhân",
                      "Zalo",
                      "Website",
                      "Hotline",
                      "Giới thiệu",
                    ].map((src) => {
                      const count = flatTableData.filter(
                        (t) => t.source === src,
                      ).length;
                      const percent =
                        filteredTotal > 0
                          ? ((count / filteredTotal) * 100).toFixed(1)
                          : 0;
                      return (
                        <tr
                          key={src}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 font-semibold text-gray-700">
                            {src}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-900">
                            {count}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-gray-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium w-12 text-right text-gray-600">
                                {percent}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                In báo cáo (PDF)
              </button>
              <button
                onClick={() => setIsShowReport(false)}
                className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-black transition-all shadow-md active:scale-95"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;
