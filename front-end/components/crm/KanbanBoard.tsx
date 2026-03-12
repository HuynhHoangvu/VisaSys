import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Tooltip, Spinner } from "flowbite-react";
import type {
  BoardData,
  AuthUser,
  Notification,
  Task,
  Column,
} from "../../types";
import { io } from "socket.io-client";
import SearchFilterBar from "../Filter/SearchFilterBar";

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);

  // ==========================================
  // SEARCH & FILTER STATE
  // ==========================================
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSale, setFilterSale] = useState("all");
  const [filterVisa, setFilterVisa] = useState("all");
  const [filterColumn, setFilterColumn] = useState("all");

  // ==========================================
  // PHÂN QUYỀN
  // ==========================================
  const userRole = currentUser?.role?.trim().toLowerCase() || "";
  const isBoss = userRole.includes("giám đốc") || currentUser?.id === "admin";
  const isManager =
    userRole === "quản lý" ||
    userRole === "trưởng phòng" ||
    userRole === "admin";
  const canSeeAll = isBoss || isManager;

  // ==========================================
  // FETCH THÔNG BÁO KHẨN
  // ==========================================
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

  // ==========================================
  // FETCH DỮ LIỆU
  // ==========================================
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
        setError("Lỗi kết nối đến server" + err);
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

  // ==========================================
  // BUILD FILTER OPTIONS TỪ DỮ LIỆU THỰC TẾ
  // ==========================================
  const filterOptions = useMemo(() => {
    if (!boardData) return { sales: [], visaTypes: [], columns: [] };

    const allTasks = Object.values(boardData.tasks);

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

    const columns = boardData.columnOrder
      .map((colId) => boardData.columns[colId])
      .filter(Boolean)
      .map((col) => ({ value: col.id, label: col.title }));

    return { sales, visaTypes, columns };
  }, [boardData]);

  // ==========================================
  // LỌC TASKS THEO SEARCH + FILTER
  // ==========================================
  const getFilteredTaskIds = useCallback(
    (columnId: string): string[] => {
      if (!boardData) return [];

      const column = boardData.columns[columnId];
      if (!column) return [];

      // Nếu filter theo cột cụ thể và không phải cột này → ẩn hết
      if (filterColumn !== "all" && filterColumn !== columnId) return [];

      return column.taskIds.filter((taskId) => {
        const task = boardData.tasks[taskId];
        if (!task) return false;

        // Search: tìm theo tên, SĐT, sale
        if (searchQuery) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = task.content?.toLowerCase().includes(q);
          const matchPhone = task.phone?.toLowerCase().includes(q);
          const matchSale = task.assignedTo?.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchSale) return false;
        }

        // Filter theo sale
        if (filterSale !== "all" && task.assignedTo !== filterSale)
          return false;

        // Filter theo loại visa
        if (filterVisa !== "all" && task.visaType !== filterVisa) return false;

        return true;
      });
    },
    [boardData, searchQuery, filterSale, filterVisa, filterColumn],
  );

  // Tổng số kết quả sau filter
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

  const hasActiveFilter =
    searchQuery !== "" ||
    filterSale !== "all" ||
    filterVisa !== "all" ||
    filterColumn !== "all";

  const handleResetFilter = () => {
    setSearchQuery("");
    setFilterSale("all");
    setFilterVisa("all");
    setFilterColumn("all");
  };

  // ==========================================
  // KÉO THẢ
  // ==========================================
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
      "bg-white border shadow-sm hover:shadow transition-all rounded-lg";
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
    <div className="flex flex-col h-full w-full bg-[#f8f9fa] p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Quản lý Khách hàng
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {canSeeAll
              ? "Đang xem toàn bộ hệ thống"
              : `Danh sách khách hàng của ${currentUser?.name}`}
          </p>
        </div>
        <button
          onClick={onOpenAddCustomer}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-2"
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
          Thêm Khách Hàng
        </button>
      </div>

      {/* SEARCH + FILTER — chỉ hiện cho canSeeAll (sếp/trưởng phòng) */}
      {canSeeAll && (
        <SearchFilterBar
          searchPlaceholder="Tìm tên khách, số điện thoại, sale..."
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
              key: "column",
              placeholder: "📋 Tất cả trạng thái",
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
      )}

      {/* KANBAN BOARD */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex h-full w-full space-x-4 overflow-x-auto pb-6 items-start">
          {boardData.columnOrder.map((columnId) => {
            const column = boardData.columns[columnId];
            const filteredTaskIds = getFilteredTaskIds(columnId);
            const allTasksInCol = column.taskIds
              .map((id) => boardData.tasks[id])
              .filter(Boolean);

            // Ẩn cột nếu filter theo cột khác
            if (filterColumn !== "all" && filterColumn !== columnId)
              return null;

            return (
              
              <div
                key={column.id}
                className="flex flex-col bg-gray-100/50 rounded-xl w-52 min-w-52 max-h-full shrink-0"
              >
                <div className="px-3 py-3 flex justify-between items-center">
                  <h3 className="font-bold text-gray-600 uppercase text-[11px] tracking-wider">
                    {column.title}
                  </h3>
                  <div className="flex items-center gap-1">
                    {hasActiveFilter &&
                      filteredTaskIds.length !== allTasksInCol.length && (
                        <span className="text-orange-500 text-2xs font-bold">
                          {filteredTaskIds.length}/
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
                      className={`flex-1 px-2 pb-2 space-y-2 min-h-37.5 transition-colors duration-200 rounded-b-xl ${snapshot.isDraggingOver ? "bg-gray-200/50" : ""}`}
                    >
                      {/* Hiện tasks đã lọc */}
                      {column.taskIds
                        .map((taskId) => boardData.tasks[taskId])
                        .filter(Boolean)
                        .map((task, index) => {
                          const isFiltered = !filteredTaskIds.includes(task.id);
                          const isAlerted = activeAlerts.includes(task.id);

                          return (
                            <Draggable
                              key={task.id}
                              draggableId={task.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() =>
                                    !isFiltered && onOpenDetail(task.id)
                                  }
                                  className={`p-3 relative group select-none transition-all ${getCardStyle(column.id, snapshot.isDragging, isAlerted)} ${
                                    isFiltered
                                      ? "opacity-20 pointer-events-none scale-95"
                                      : ""
                                  }`}
                                  style={{ ...provided.draggableProps.style }}
                                >
                                  {isAlerted && !isFiltered && (
                                    <div className="absolute -top-2 -left-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white z-10 animate-bounce">
                                      <svg
                                        className="w-4 h-4"
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

                                  {canSeeAll && (
                                    <button
                                      onClick={(e) =>
                                        handleDeleteClick(e, task.id)
                                      }
                                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
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

                                  <h4 className="font-bold text-gray-800 text-sm leading-tight pr-5 mb-2">
                                    {task.content}
                                  </h4>
                                  <div className="flex justify-between items-end mb-3">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-sm font-bold text-gray-700">
                                        {task.phone}
                                      </span>
                                      {task.assignedTo && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <div className="w-4 h-4 rounded-full bg-indigo-50 flex items-center justify-center text-[8px] font-bold text-indigo-600 border border-indigo-100">
                                            {task.assignedTo.charAt(0)}
                                          </div>
                                          <span className="text-2xs text-gray-500 font-medium">
                                            Sale:{" "}
                                            {task.assignedTo.split(" ")[0]}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50/50 border border-blue-100/50 px-1.5 py-0.5 rounded uppercase">
                                      {task.price}
                                    </span>
                                  </div>

                                  <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                                    <div className="flex flex-wrap gap-1">
                                      {task.activities &&
                                      task.activities.length > 0 ? (
                                        task.activities.map((act) => {
                                          const config = getActivityConfig(
                                            act.type,
                                            act.completed,
                                          );
                                          return (
                                            <Tooltip
                                              key={act.id}
                                              content={act.summary}
                                              placement="top"
                                            >
                                              <div
                                                onClick={(e) =>
                                                  handleActivityClick(
                                                    e,
                                                    task.id,
                                                    act.id,
                                                  )
                                                }
                                                className={`w-6 h-6 rounded-full border ${config.border} ${config.color} flex items-center justify-center text-2xs shadow-sm cursor-pointer hover:scale-110 transition-all`}
                                              >
                                                {config.icon}
                                              </div>
                                            </Tooltip>
                                          );
                                        })
                                      ) : (
                                        <span className="text-2xs text-gray-300 italic">
                                          Trống
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenAttachments(task.id);
                                        }}
                                        className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all"
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
                                            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                          />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenActivityList(task.id);
                                        }}
                                        className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
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
                                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                          />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                      {provided.placeholder}

                      {/* Empty state khi filter không có kết quả */}
                      {hasActiveFilter &&
                        filteredTaskIds.length === 0 &&
                        allTasksInCol.length > 0 && (
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
    </div>
  );
};

export default KanbanBoard;
