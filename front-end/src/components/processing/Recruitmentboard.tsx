import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Spinner } from "flowbite-react";
import type { BoardData, Task } from "../../types";
import socket from "../../services/socket";
import SearchFilterBar from "../filter/SearchFilterBar";

interface RecruitmentBoardProps {
  onOpenDetail: (taskId: string) => void;
}

// ==========================================
// CÁC BƯỚC TUYỂN DỤNG ĐÃ ĐƯỢC RÚT GỌN (7 BƯỚC)
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
    id: "rec-3",
    title: "Tìm Job / Nộp CV",
    color: "#0284c7",
    accent: "#e0f2fe",
    emoji: "🔍",
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
    id: "rec-10",
    title: "Nomination / Job Offer",
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
    id: "rec-13",
    title: "Visa Granted",
    color: "#16a34a",
    accent: "#dcfce7",
    emoji: "🎊",
    isFail: false,
  },
  {
    id: "rec-fail",
    title: "Rớt / Hủy",
    color: "#dc2626",
    accent: "#fef2f2",
    emoji: "❌",
    isFail: true,
  },
] as const;

type StepId = (typeof RECRUITMENT_STEPS)[number]["id"];
const STEP_MAP = Object.fromEntries(RECRUITMENT_STEPS.map((s) => [s.id, s]));

const API_BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api`;

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
  const [activeTab, setActiveTab] = useState<"kanban" | "list">("kanban");

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSale, setFilterSale] = useState("all");
  const [filterStep, setFilterStep] = useState("all");

  const fetchBoardData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/board`);
      if (!res.ok) throw new Error();
      const data: BoardData = await res.json();
      setBoardData(data);

      const stepMap: Record<string, StepId> = {};
      Object.values(data.tasks).forEach((task) => {
        let step = (task as Task & { recruitmentStep?: string })
          .recruitmentStep;

        // --- AUTO MIGRATION ---
        if (step === "rec-2") step = "rec-3";
        if (step === "rec-5") step = "rec-6";
        if (step === "rec-8" || step === "rec-9") step = "rec-10";
        if (["rec-4", "rec-7", "rec-12"].includes(step || ""))
          step = "rec-fail";

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

  const col5Tasks = useMemo(() => {
    if (!boardData) return [];
    const col = boardData.columns["col-5"];
    if (!col) return [];
    return col.taskIds.map((id) => boardData.tasks[id]).filter(Boolean);
  }, [boardData]);

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

  const stats = useMemo(
    () => ({
      total: col5Tasks.length,
      granted: col5Tasks.filter(
        (t) => (taskStepMap[t.id] || "rec-1") === "rec-13",
      ).length,
      processing: col5Tasks.filter(
        (t) => !["rec-fail", "rec-13"].includes(taskStepMap[t.id] || "rec-1"),
      ).length,
      failed: col5Tasks.filter((t) => (taskStepMap[t.id] || "") === "rec-fail")
        .length,
    }),
    [col5Tasks, taskStepMap],
  );

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
        <div className="flex gap-2 flex-wrap">
          {[
            {
              label: "Tổng",
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

      {/* CONTROLS AREA */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 shrink-0 bg-white p-3 rounded-xl shadow-sm border border-gray-200">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("kanban")}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === "kanban" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            🗂 Kanban Board
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === "list" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            📄 Danh sách
          </button>
        </div>
      </div>

      <div className="mb-4">
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
      </div>

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
          <div className="flex flex-1 w-full space-x-4 overflow-x-auto pb-4 items-start snap-x">
            {RECRUITMENT_STEPS.map((step) => {
              const taskIds = columnTaskIds[step.id] || [];
              const tasks = taskIds
                .map((id) => boardData!.tasks[id])
                .filter(Boolean);
              const visibleCount = tasks.filter(isTaskVisible).length;

              return (
                <div
                  key={step.id}
                  className="flex flex-col rounded-xl shrink-0 snap-center shadow-sm"
                  style={{
                    width: "240px",
                    background: step.accent,
                    border: `1px solid ${step.color}30`,
                    maxHeight: "100%",
                  }}
                >
                  <div
                    className="px-3 py-3 flex justify-between items-center rounded-t-xl bg-white/60 backdrop-blur-sm border-b"
                    style={{ borderColor: `${step.color}20` }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{step.emoji}</span>
                      <h3
                        className="font-bold text-xs uppercase tracking-wide truncate"
                        style={{ color: step.color }}
                      >
                        {step.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {hasActiveFilter && visibleCount !== tasks.length && (
                        <span className="text-orange-500 text-xs font-bold">
                          {visibleCount}/
                        </span>
                      )}
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: step.color + "15",
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
                        className="flex-1 overflow-y-auto p-2.5 space-y-3 rounded-b-xl transition-colors"
                        style={{
                          minHeight: "150px",
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
                              {(provided, snapshot) => {
                                const card = (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() =>
                                      !hidden && onOpenDetail(task.id)
                                    }
                                    className={`bg-white rounded-lg p-3.5 border border-gray-100 cursor-grab active:cursor-grabbing transition-all select-none
                                      ${snapshot.isDragging ? "shadow-2xl rotate-2 z-50 ring-2 ring-blue-400 scale-105" : "shadow-sm hover:shadow-md hover:border-gray-200"}
                                      ${hidden ? "hidden" : "flex flex-col"} 
                                      ${step.isFail ? "border-l-4 border-l-red-500" : "border-l-4 border-l-transparent hover:border-l-blue-400"}
                                    `}
                                    style={{ ...provided.draggableProps.style }}
                                  >
                                    <p
                                      className="font-bold text-gray-800 text-sm leading-tight truncate mb-1.5"
                                      title={task.content}
                                    >
                                      {task.content.split(" - ")[0]}
                                    </p>

                                    <div className="flex flex-col gap-1.5 mb-3">
                                      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                        <span>📞</span>{" "}
                                        <span>
                                          {task.phone || "Chưa có SĐT"}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {task.visaType && (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                            {task.visaType}
                                          </span>
                                        )}
                                        {task.jobType && (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 truncate max-w-[120px]">
                                            {task.jobType}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {task.assignedTo && (
                                      <div className="flex items-center gap-2 pt-2 border-t border-gray-50 mb-2">
                                        <div
                                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-sm"
                                          style={{
                                            background: getAvatarColor(
                                              task.assignedTo,
                                            ),
                                          }}
                                        >
                                          {getInitials(task.assignedTo)}
                                        </div>
                                        <span className="text-xs text-gray-600 font-semibold truncate">
                                          {task.assignedTo}
                                        </span>
                                      </div>
                                    )}

                                    {/* NÚT SELECT CHUYỂN CỘT THẲNG TRONG CARD */}
                                    <div
                                      className="mt-auto pt-2 border-t border-gray-100"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <select
                                        value={step.id}
                                        onChange={async (e) => {
                                          const newStep = e.target
                                            .value as StepId;
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
                                                  "Content-Type":
                                                    "application/json",
                                                },
                                                body: JSON.stringify({
                                                  recruitmentStep: newStep,
                                                }),
                                              },
                                            );
                                          } catch {
                                            setTaskStepMap((prev) => ({
                                              ...prev,
                                              [task.id]: step.id,
                                            }));
                                          }
                                        }}
                                        className="text-xs font-semibold px-2 py-1.5 rounded border border-gray-200 bg-gray-50/50 outline-none cursor-pointer w-full hover:border-blue-300 transition-colors focus:ring-2 focus:ring-blue-100"
                                        style={{ color: step.color }}
                                      >
                                        {RECRUITMENT_STEPS.map((s) => (
                                          <option key={s.id} value={s.id}>
                                            {s.emoji} {s.title}
                                          </option>
                                        ))}
                                      </select>
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
                        {tasks.filter(isTaskVisible).length === 0 && (
                          <div
                            className="text-center py-6 text-xs font-medium"
                            style={{ color: step.color + "60" }}
                          >
                            Trống
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

      {/* ==================== LIST VIEW (Flex Layout - Không Dùng Table) ==================== */}
      {activeTab === "list" && col5Tasks.length > 0 && (
        <div className="flex flex-col flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wide">
            <div className="w-1/4 pr-4">Khách hàng</div>
            <div className="w-1/6 pr-4">SĐT</div>
            <div className="w-1/4 pr-4">Loại Visa & Ngành</div>
            <div className="w-1/6 pr-4">Phụ trách</div>
            <div className="w-1/6 pr-4">Trạng thái</div>
            <div className="w-32 text-right">Thao tác</div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredTasks.length === 0 ? (
              <div className="px-4 py-10 text-center text-gray-400 italic text-sm">
                Không tìm thấy hồ sơ phù hợp
              </div>
            ) : (
              filteredTasks.map((task) => {
                const stepId = taskStepMap[task.id] || "rec-1";
                const step = STEP_MAP[stepId];
                return (
                  <div
                    key={task.id}
                    className="flex items-center px-4 py-3 hover:bg-orange-50/40 cursor-pointer transition-colors"
                    onClick={() => onOpenDetail(task.id)}
                  >
                    <div className="w-1/4 pr-4 flex flex-col">
                      <span className="font-bold text-gray-800 text-sm">
                        {task.content.split(" - ")[0]}
                      </span>
                      {task.content.split(" - ")[1] && (
                        <span className="text-xs text-gray-400 mt-0.5 truncate">
                          {task.content.split(" - ")[1]}
                        </span>
                      )}
                    </div>

                    <div className="w-1/6 pr-4">
                      <span className="text-sm font-semibold text-gray-600">
                        {task.phone || "—"}
                      </span>
                    </div>

                    <div className="w-1/4 pr-4 flex flex-wrap gap-1.5 items-center">
                      {task.visaType && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                          {task.visaType}
                        </span>
                      )}
                      {task.jobType && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 truncate max-w-[120px]">
                          {task.jobType}
                        </span>
                      )}
                      {!task.visaType && !task.jobType && (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>

                    <div className="w-1/6 pr-4">
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
                          <span className="text-sm font-medium text-gray-700 truncate">
                            {task.assignedTo}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>

                    <div className="w-1/6 pr-4 flex items-center">
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full border"
                        style={{
                          background: step.accent,
                          color: step.color,
                          borderColor: `${step.color}30`,
                        }}
                      >
                        {step.emoji} {step.title}
                      </span>
                    </div>

                    <div
                      className="w-32 text-right"
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
                            await fetch(`${API_BASE_URL}/tasks/${task.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                recruitmentStep: newStep,
                              }),
                            });
                          } catch {
                            setTaskStepMap((prev) => ({
                              ...prev,
                              [task.id]: stepId,
                            }));
                          }
                        }}
                        className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none cursor-pointer w-full focus:ring-2 focus:ring-blue-100"
                        style={{ color: step.color }}
                      >
                        {RECRUITMENT_STEPS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.emoji} {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs">
            <span className="text-gray-500 font-medium">
              Hiển thị{" "}
              <span className="font-bold text-gray-700">
                {filteredTasks.length}
              </span>{" "}
              / {col5Tasks.length} hồ sơ
            </span>
            <div className="flex items-center gap-4 font-bold">
              <span className="text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>{" "}
                {stats.granted} Hoàn thành
              </span>
              <span className="text-red-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>{" "}
                {stats.failed} Rớt
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruitmentBoard;
