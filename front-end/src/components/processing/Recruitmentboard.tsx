import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Spinner } from "flowbite-react";
import type { BoardData, Task } from "../../types";
import { io } from "socket.io-client";
import SearchFilterBar from "../filter/SearchFilterBar";

interface RecruitmentBoardProps {
  onOpenDetail: (taskId: string) => void;
}

// ==========================================
// CÁC BƯỚC TUYỂN DỤNG
// ==========================================
const RECRUITMENT_STEPS = [
  {
    id: "rec-1",
    title: "Đã ký HĐ",
    color: "#6b7280",
    accent: "#f3f4f6",
    emoji: "📝",
    isFail: false,
  },
  {
    id: "rec-2",
    title: "Tìm chủ",
    color: "#8b5cf6",
    accent: "#ede9fe",
    emoji: "🔍",
    isFail: false,
  },
  {
    id: "rec-3",
    title: "Nộp CV",
    color: "#0284c7",
    accent: "#e0f2fe",
    emoji: "📄",
    isFail: false,
  },
  {
    id: "rec-4",
    title: "Rớt CV",
    color: "#dc2626",
    accent: "#fef2f2",
    emoji: "❌",
    isFail: true,
  },
  {
    id: "rec-5",
    title: "Đậu CV",
    color: "#16a34a",
    accent: "#f0fdf4",
    emoji: "✅",
    isFail: false,
  },
  {
    id: "rec-6",
    title: "Phỏng vấn",
    color: "#d97706",
    accent: "#fffbeb",
    emoji: "🎤",
    isFail: false,
  },
  {
    id: "rec-7",
    title: "Rớt PV",
    color: "#dc2626",
    accent: "#fef2f2",
    emoji: "❌",
    isFail: true,
  },
  {
    id: "rec-8",
    title: "Đậu PV",
    color: "#16a34a",
    accent: "#f0fdf4",
    emoji: "🎉",
    isFail: false,
  },
  {
    id: "rec-9",
    title: "Job Offered",
    color: "#0d9488",
    accent: "#ccfbf1",
    emoji: "💼",
    isFail: false,
  },
  {
    id: "rec-10",
    title: "Approved Nomination",
    color: "#7c3aed",
    accent: "#ede9fe",
    emoji: "✔️",
    isFail: false,
  },
  {
    id: "rec-11",
    title: "Apply Visa",
    color: "#2563eb",
    accent: "#eff6ff",
    emoji: "🛂",
    isFail: false,
  },
  {
    id: "rec-12",
    title: "Rớt Visa",
    color: "#dc2626",
    accent: "#fef2f2",
    emoji: "❌",
    isFail: true,
  },
  {
    id: "rec-13",
    title: "Visa Granted",
    color: "#16a34a",
    accent: "#dcfce7",
    emoji: "🎊",
    isFail: false,
  },
] as const;

type StepId = (typeof RECRUITMENT_STEPS)[number]["id"];

const STEP_MAP = Object.fromEntries(RECRUITMENT_STEPS.map((s) => [s.id, s]));

const API_BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api`;
const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const socket = io(SOCKET_URL);

const AVATAR_COLORS = [
  "#f97316",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f43f5e",
  "#3b82f6",
];
const getAvatarColor = (n: string) =>
  AVATAR_COLORS[(n?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const getInitials = (n: string) =>
  (n || "?")
    .split(" ")
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// ==========================================
// MAIN COMPONENT
// ==========================================
const RecruitmentBoard: React.FC<RecruitmentBoardProps> = ({
  onOpenDetail,

}) => {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [taskStepMap, setTaskStepMap] = useState<Record<string, StepId>>({});
  const [activeTab, setActiveTab] = useState<"kanban" | "table">("kanban");

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSale, setFilterSale] = useState("all");
  const [filterStep, setFilterStep] = useState("all");

  // ==========================================
  // FETCH
  // ==========================================
  const fetchBoardData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/board`);
      if (!res.ok) throw new Error();
      const data: BoardData = await res.json();
      setBoardData(data);

      const stepMap: Record<string, StepId> = {};
      Object.values(data.tasks).forEach((task) => {
        const step = (task as Task & { recruitmentStep?: string })
          .recruitmentStep;
        if (step) stepMap[task.id] = step as StepId;
      });
      setTaskStepMap(stepMap);
    } catch {
      console.error("Lỗi fetch board");
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoardData(true);
    socket.on("data_changed", () => fetchBoardData(false));
    const handler = () => fetchBoardData(false);
    window.addEventListener("refreshBoard", handler);
    return () => {
      socket.off("data_changed");
      window.removeEventListener("refreshBoard", handler);
    };
  }, [fetchBoardData]);

  // ==========================================
  // TASKS TỪ col-5
  // ==========================================
  const col5Tasks = useMemo(() => {
    if (!boardData) return [];
    const col = boardData.columns["col-5"];
    if (!col) return [];
    return col.taskIds.map((id) => boardData.tasks[id]).filter(Boolean);
  }, [boardData]);

  // ==========================================
  // FILTER OPTIONS
  // ==========================================
  const filterOptions = useMemo(() => {
    const sales = [
      ...new Set(col5Tasks.map((t) => t.assignedTo).filter(Boolean)),
    ]
      .sort()
      .map((n) => ({ value: n, label: n }));
    const steps = RECRUITMENT_STEPS.map((s) => ({
      value: s.id,
      label: `${s.emoji} ${s.title}`,
    }));
    return { sales, steps };
  }, [col5Tasks]);

  const isTaskVisible = useCallback(
    (task: Task) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !task.content?.toLowerCase().includes(q) &&
          !task.phone?.toLowerCase().includes(q) &&
          !task.assignedTo?.toLowerCase().includes(q)
        )
          return false;
      }
      if (filterSale !== "all" && task.assignedTo !== filterSale) return false;
      if (
        filterStep !== "all" &&
        (taskStepMap[task.id] || "rec-1") !== filterStep
      )
        return false;
      return true;
    },
    [searchQuery, filterSale, filterStep, taskStepMap],
  );

  const hasActiveFilter =
    searchQuery !== "" || filterSale !== "all" || filterStep !== "all";
  const handleReset = () => {
    setSearchQuery("");
    setFilterSale("all");
    setFilterStep("all");
  };
  const filteredTasks = useMemo(
    () => col5Tasks.filter(isTaskVisible),
    [col5Tasks, isTaskVisible],
  );

  // Gom tasks vào cột kanban
  const columnTaskIds = useMemo(() => {
    const map: Record<string, string[]> = {};
    RECRUITMENT_STEPS.forEach((s) => {
      map[s.id] = [];
    });
    col5Tasks.forEach((task) => {
      const step = taskStepMap[task.id] || "rec-1";
      if (map[step]) map[step].push(task.id);
    });
    return map;
  }, [col5Tasks, taskStepMap]);

  // Stats
  const stats = useMemo(
    () => ({
      total: col5Tasks.length,
      granted: col5Tasks.filter(
        (t) => (taskStepMap[t.id] || "rec-1") === "rec-13",
      ).length,
      processing: col5Tasks.filter(
        (t) =>
          !["rec-4", "rec-7", "rec-12", "rec-13"].includes(
            taskStepMap[t.id] || "rec-1",
          ),
      ).length,
      failed: col5Tasks.filter((t) =>
        ["rec-4", "rec-7", "rec-12"].includes(taskStepMap[t.id] || ""),
      ).length,
    }),
    [col5Tasks, taskStepMap],
  );

  // ==========================================
  // KÉO THẢ
  // ==========================================
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const newStep = destination.droppableId as StepId;
    setTaskStepMap((prev) => ({ ...prev, [draggableId]: newStep }));
    try {
      await fetch(`${API_BASE_URL}/tasks/${draggableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruitmentStep: newStep }),
      });
    } catch {
      setTaskStepMap((prev) => ({
        ...prev,
        [draggableId]: source.droppableId as StepId,
      }));
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="xl" />
      </div>
    );

  return (
    <div className="flex flex-col h-full w-full bg-[#f8f9fa] p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex justify-between items-start mb-4 shrink-0 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Tiến độ Tuyển dụng
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Theo dõi hành trình từ ký HĐ đến Visa Granted
          </p>
        </div>

        {/* STATS */}
        <div className="flex gap-2 flex-wrap">
          {[
            {
              label: "Tổng hồ sơ",
              value: stats.total,
              cls: "bg-gray-100 text-gray-700",
            },
            {
              label: "Đang xử lý",
              value: stats.processing,
              cls: "bg-blue-100 text-blue-700",
            },
            {
              label: "Rớt/Cần xử lý",
              value: stats.failed,
              cls: "bg-red-100 text-red-700",
            },
            {
              label: "Visa Granted",
              value: stats.granted,
              cls: "bg-green-100 text-green-700",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${s.cls}`}
            >
              <span className="text-lg font-black">{s.value}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex gap-1 mb-4 shrink-0 bg-gray-200/60 p-1 rounded-lg w-fit">
        {[
          { key: "kanban", label: "🗂 Kanban", desc: "Kéo thả" },
          { key: "table", label: "📊 Table", desc: "Tổng quan" },
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
            key: "step",
            placeholder: "📍 Tất cả bước",
            value: filterStep,
            options: filterOptions.steps,
            onChange: setFilterStep,
          },
        ]}
        resultCount={filteredTasks.length}
        totalCount={col5Tasks.length}
        onReset={handleReset}
        hasActiveFilter={hasActiveFilter}
      />

      {/* EMPTY STATE */}
      {col5Tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
          <div className="text-5xl">👷</div>
          <p className="text-lg font-semibold">Chưa có hồ sơ nào</p>
          <p className="text-sm text-center max-w-sm">
            Khi Sale kéo khách hàng sang cột "Đang xử lý hồ sơ", họ sẽ xuất hiện
            ở đây.
          </p>
        </div>
      )}

      {/* ==================== KANBAN VIEW ==================== */}
      {activeTab === "kanban" && col5Tasks.length > 0 && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex flex-1 w-full space-x-3 overflow-x-auto pb-4 items-start">
            {RECRUITMENT_STEPS.map((step) => {
              const taskIds = columnTaskIds[step.id] || [];
              const tasks = taskIds
                .map((id) => boardData!.tasks[id])
                .filter(Boolean);
              const visibleCount = tasks.filter(isTaskVisible).length;

              return (
                <div
                  key={step.id}
                  className="flex flex-col rounded-xl shrink-0"
                  style={{
                    width: "210px",
                    minWidth: "210px",
                    background: step.accent,
                    border: `1px solid ${step.color}25`,
                    maxHeight: "100%",
                  }}
                >
                  {/* Column header */}
                  <div
                    className="px-3 py-2.5 flex justify-between items-center rounded-t-xl"
                    style={{
                      borderBottom: `2px solid ${step.color}35`,
                      background: "white",
                    }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0">{step.emoji}</span>
                      <h3
                        className="font-bold text-[11px] uppercase tracking-wide truncate"
                        style={{ color: step.color }}
                      >
                        {step.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {hasActiveFilter && visibleCount !== tasks.length && (
                        <span className="text-orange-500 text-2xs font-bold">
                          {visibleCount}/
                        </span>
                      )}
                      <span
                        className="text-2xs font-black px-1.5 py-0.5 rounded-full"
                        style={{
                          background: step.color + "20",
                          color: step.color,
                        }}
                      >
                        {tasks.length}
                      </span>
                    </div>
                  </div>

                  <Droppable droppableId={step.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 overflow-y-auto p-2 space-y-2 rounded-b-xl transition-colors"
                        style={{
                          minHeight: "100px",
                          background: snapshot.isDraggingOver
                            ? step.color + "15"
                            : "transparent",
                        }}
                      >
                        {tasks.map((task, index) => {
                          const hidden =
                            hasActiveFilter && !isTaskVisible(task);
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
                                    !hidden && onOpenDetail(task.id)
                                  }
                                  className={`bg-white rounded-xl p-3 shadow-sm cursor-grab active:cursor-grabbing transition-all select-none
                                    ${snapshot.isDragging ? "shadow-xl rotate-1 z-50" : "hover:shadow-md"}
                                    ${hidden ? "opacity-20 pointer-events-none scale-95" : ""}
                                    ${step.isFail ? "border-l-4 border-red-400" : ""}
                                  `}
                                  style={{ ...provided.draggableProps.style }}
                                >
                                  <p className="font-bold text-gray-800 text-[13px] leading-tight truncate mb-1">
                                    {task.content.split(" - ")[0]}
                                  </p>
                                  {task.visaType && (
                                    <p
                                      className="text-2xs font-bold px-1.5 py-0.5 rounded w-fit mb-1.5"
                                      style={{
                                        background: step.accent,
                                        color: step.color,
                                      }}
                                    >
                                      {task.visaType}
                                    </p>
                                  )}
                                  <p className="text-[11px] text-gray-400 mb-2">
                                    {task.phone}
                                  </p>
                                  {task.assignedTo && (
                                    <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                                      <div
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0"
                                        style={{
                                          background: getAvatarColor(
                                            task.assignedTo,
                                          ),
                                        }}
                                      >
                                        {getInitials(task.assignedTo)}
                                      </div>
                                      <span className="text-2xs text-gray-500 font-medium truncate">
                                        {
                                          task.assignedTo
                                            .split(" ")
                                            .slice(-1)[0]
                                        }
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        {tasks.length === 0 && (
                          <div
                            className="text-center py-5 text-[11px] italic"
                            style={{ color: step.color + "60" }}
                          >
                            Chưa có hồ sơ
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
      {activeTab === "table" && col5Tasks.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Khách hàng
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                    SĐT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Loại Visa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Sale
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Bước hiện tại
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide w-52">
                    Cập nhật bước
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
                    const stepId = taskStepMap[task.id] || "rec-1";
                    const step = STEP_MAP[stepId];
                    return (
                      <tr
                        key={task.id}
                        className={`transition-colors hover:bg-orange-50/30 cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                        onClick={() => onOpenDetail(task.id)}
                      >
                        {/* Tên khách */}
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-800">
                            {task.content.split(" - ")[0]}
                          </p>
                          {task.content.split(" - ")[1] && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {task.content.split(" - ")[1]}
                            </p>
                          )}
                        </td>

                        {/* SĐT */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-gray-600">
                            {task.phone}
                          </span>
                        </td>

                        {/* Visa */}
                        <td className="px-4 py-3">
                          {task.visaType ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                              {task.visaType}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Sale */}
                        <td className="px-4 py-3">
                          {task.assignedTo ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
                                style={{
                                  background: getAvatarColor(task.assignedTo),
                                }}
                              >
                                {getInitials(task.assignedTo)}
                              </div>
                              <span className="text-sm font-medium text-gray-700">
                                {task.assignedTo}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Bước hiện tại */}
                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{
                              background: step.accent,
                              color: step.color,
                            }}
                          >
                            {step.emoji} {step.title}
                          </span>
                        </td>

                        {/* Dropdown cập nhật bước */}
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={stepId}
                            onChange={async (e) => {
                              const newStep = e.target.value as StepId;
                              setTaskStepMap((prev) => ({
                                ...prev,
                                [task.id]: newStep,
                              }));
                              try {
                                await fetch(
                                  `${API_BASE_URL}/tasks/${task.id}`,
                                  {
                                    method: "PUT",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      recruitmentStep: newStep,
                                    }),
                                  },
                                );
                              } catch {
                                setTaskStepMap((prev) => ({
                                  ...prev,
                                  [task.id]: stepId,
                                }));
                              }
                            }}
                            className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none cursor-pointer w-full"
                            style={{ color: step.color }}
                          >
                            {RECRUITMENT_STEPS.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.emoji} {s.title}
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

            {/* Table footer */}
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="text-xs text-gray-400 font-medium">
                Hiển thị{" "}
                <span className="font-bold text-gray-600">
                  {filteredTasks.length}
                </span>{" "}
                / {col5Tasks.length} hồ sơ
              </span>
              {/* Mini progress bar */}
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="text-green-600">
                  ✅ {stats.granted} Visa Granted
                </span>
                <span className="text-red-500">
                  ❌ {stats.failed} Cần xử lý
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruitmentBoard;
