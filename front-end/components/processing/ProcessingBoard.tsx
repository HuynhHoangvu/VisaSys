import React, { useState, useEffect, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Progress, Spinner } from "flowbite-react";
import type { AuthUser, BoardData, Task } from "../../types";
import { io } from "socket.io-client";

// Import hàm lấy Checklist y hệt bên DocumentModal
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
    title: "Đang xử lý (Dịch thuật/Form)",
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
};
const PROCESSING_COLUMN_ORDER = [
  "proc-col-1",
  "proc-col-2",
  "proc-col-3",
  "proc-col-4",
];

const API_BASE_URL = "http://localhost:3001/api";
const socket = io("http://localhost:3001");

const ProcessingBoard: React.FC<ProcessingBoardProps> = ({
  onOpenDetail,
  onOpenAttachments,
  currentUser,
}) => {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [procColumns, setProcColumns] = useState(PROCESSING_COLUMNS);
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================
  // HÀM TÍNH TỔNG SỐ HỒ SƠ YÊU CẦU ĐỘNG
  // ==========================================
  const getTotalRequiredDocs = (task: Task) => {
    const checklistType = task.checklistType || "tourism";
    const jobType = task.jobType || "Nhân viên";

    let requirements: unknown[] = [];
    if (checklistType === "tourism") {
      requirements = getRequirementsList(jobType);
    } else if (checklistType === "labor") {
      requirements = getLaborRequirements();
    } else if (checklistType === "study") {
      requirements = getStudyAbroadRequirements();
    }

    // Đếm số lượng giấy tờ BẮT BUỘC (hoặc toàn bộ tùy bạn)
    // Ở đây mình đếm toàn bộ list yêu cầu cho dễ hiểu
    return requirements.length > 0 ? requirements.length : 1;
  };

  // ==========================================
  // LẤY DỮ LIỆU
  // ==========================================
  const fetchBoardData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/board`);
      if (!response.ok) throw new Error("Không thể tải dữ liệu");
      const data: BoardData = await response.json();

      setBoardData(data);

      // CHỈ LẤY NHỮNG KHÁCH MÀ SALE ĐÃ KÉO SANG CỘT "BÀN GIAO HỒ SƠ" (col-4)
      const salesHandoverTaskIds = data.columns["col-4"]?.taskIds || [];

      const newCols = {
        "proc-col-1": { ...PROCESSING_COLUMNS["proc-col-1"], taskIds: [] },
        "proc-col-2": { ...PROCESSING_COLUMNS["proc-col-2"], taskIds: [] },
        "proc-col-3": { ...PROCESSING_COLUMNS["proc-col-3"], taskIds: [] },
        "proc-col-4": { ...PROCESSING_COLUMNS["proc-col-4"], taskIds: [] },
      };

      // Phân bổ hồ sơ dựa vào trường processingColId lưu trong Database
      salesHandoverTaskIds.forEach((taskId) => {
        const task = data.tasks[taskId];
        if (task) {
          const targetCol = task.processingColId || "proc-col-1";
          if (newCols[targetCol as keyof typeof newCols]) {
            newCols[targetCol as keyof typeof newCols].taskIds.push(taskId);
          }
        }
      });

      // Cập nhật State 1 lần duy nhất
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
  // XỬ LÝ KÉO THẢ TRONG NỘI BỘ PHÒNG BO
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

    // Cập nhật UI ngay lập tức
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

    // GỌI API CHUYỂN CỘT BO
    try {
      await fetch(`${API_BASE_URL}/tasks/${draggableId}/processing-move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processingColId: destination.droppableId }),
      });
    } catch (error) {
      console.error("Lỗi khi chuyển cột BO:", error);
      fetchBoardData(false);
    }
  };

  // ==========================================
  // BÁO THIẾU HỒ SƠ CHO SALE
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
          // GỌI ĐÚNG API VỪA TẠO
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: task.content.split(" - ")[0],
            saleName: task.assignedTo, // Tên Sale để Backend biết gửi cho ai
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
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Tiến độ Xử lý Hồ sơ
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý hồ sơ đã được Sale bàn giao
          </p>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex h-full w-full space-x-4 overflow-x-auto pb-6 items-start ">
          {PROCESSING_COLUMN_ORDER.map((columnId) => {
            const column =
              procColumns[columnId as keyof typeof PROCESSING_COLUMNS];
            const tasks = column.taskIds
              .map((taskId) => boardData.tasks[taskId])
              .filter(Boolean);

            return (
              <div
                key={column.id}
                className="flex flex-col bg-gray-200/60 rounded-xl w-75 min-w-75 max-h-full shrink-0 border border-gray-300 shadow-sm"
              >
                <div className="p-3 flex justify-between items-center bg-gray-100 rounded-t-xl border-b border-gray-300">
                  <h3 className="font-bold text-gray-700 uppercase text-[12px] tracking-wide">
                    {column.title}
                  </h3>
                  <span className="bg-gray-300 text-gray-800 text-xs font-bold px-2 py-0.5 rounded-full">
                    {tasks.length}
                  </span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-3 space-y-3 overflow-y-auto rounded-b-xl transition-colors duration-200 ${snapshot.isDraggingOver ? "bg-gray-300/50" : ""}`}
                      style={{ minHeight: "150px" }}
                    >
                      {tasks.map((task, index) => {
                        // TÍNH TOÁN TIẾN ĐỘ ĐỘNG THEO LOẠI VISA
                        const totalCount = getTotalRequiredDocs(task);
                        const doneCount = task.documents
                          ? Object.keys(task.documents).length
                          : 0;
                        const percent = Math.min(
                          Math.round((doneCount / totalCount) * 100),
                          100,
                        );

                        // Thiếu hồ sơ nếu nằm ở cột 1 và chưa đủ 100%
                        const isMissing =
                          percent < 100 && columnId === "proc-col-1";

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
                                onClick={() => onOpenDetail(task.id)}
                                className={`bg-white p-4 rounded-xl shadow-sm border-l-[5px] cursor-grab active:cursor-grabbing relative group
                                  ${isMissing ? "border-l-red-500 bg-red-50" : "border-l-indigo-500 hover:shadow-md"}
                                  ${snapshot.isDragging ? "shadow-2xl rotate-2 z-9999" : ""}
                                `}
                              >
                                {isMissing && (
                                  <span className="absolute top-2.5 right-2.5 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span
                                      className="relative inline-flex rounded-full h-3 w-3 bg-red-500"
                                      title="Chưa đủ hồ sơ"
                                    ></span>
                                  </span>
                                )}

                                <h4 className="font-bold text-gray-800 text-[15px] pr-5 truncate">
                                  {task.content.split(" - ")[0]}
                                </h4>
                                <p className="text-[11px] font-bold text-indigo-600 mb-3 bg-indigo-50 px-2 py-0.5 rounded w-fit mt-1 border border-indigo-100">
                                  {task.visaType ||
                                    task.content.split(" - ")[1]}
                                </p>

                                <div className="mb-3">
                                  <div className="flex justify-between text-[11px] font-bold text-gray-500 mb-1">
                                    <span>Tiến độ giấy tờ:</span>
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
                                    color={percent === 100 ? "green" : "indigo"}
                                    size="sm"
                                  />
                                </div>

                                <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-2">
                                  <span className="text-[11px] text-gray-600 bg-gray-50 px-2 py-1 rounded font-medium border border-gray-200 truncate max-w-[100px]">
                                    Sale:{" "}
                                    <span className="font-bold text-gray-800">
                                      {task.assignedTo?.split(" ")[0] ||
                                        "Trống"}
                                    </span>
                                  </span>

                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenAttachments(task.id);
                                      }}
                                      className="flex items-center justify-center p-1.5 text-gray-500 hover:text-green-600 bg-gray-50 hover:bg-green-50 rounded border border-gray-200 transition-colors"
                                      title="Xem danh sách tài liệu"
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
                                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                        />
                                      </svg>
                                    </button>

                                    <button
                                      onClick={(e) => handlePingSale(task, e)}
                                      className={`text-[11px] font-bold px-2 py-1 rounded transition-colors shadow-sm ${
                                        isMissing
                                          ? "text-white bg-red-500 hover:bg-red-600"
                                          : "text-orange-600 bg-orange-100 hover:bg-orange-200"
                                      }`}
                                    >
                                      {isMissing ? "Đòi hồ sơ" : "Báo sale"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
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

export default ProcessingBoard;
