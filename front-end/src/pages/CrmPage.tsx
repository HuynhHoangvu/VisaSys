import React, { useState, useEffect } from "react";
import api from "../services/api";
import socket from "../services/socket";
import KanbanBoard from "../components/crm/KanbanBoard";
import CustomerModal from "../components/crm/CustomerModal";
import CustomerDetailModal from "../components/crm/CustomerDetailModal";
import ActivityListModal from "../components/crm/ActivityListModal";
import ScheduleActivityModal from "../components/crm/ScheduleActivityModal";
import DocumentModal from "../components/crm/DocumentModal";
import type { Task, Activity, BoardData, AuthUser } from "../types";

const CrmPage: React.FC = () => {
  const currentUser: AuthUser = JSON.parse(localStorage.getItem("flyvisa_user")!);
  const emptyBoard: BoardData = { tasks: {}, columns: {}, columnOrder: [] };
  const [boardData, setBoardData] = useState<BoardData>(emptyBoard);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isActivityListOpen, setIsActivityListOpen] = useState(false);
  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);

  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        const { data } = await api.get<BoardData>("/api/board");
        setBoardData(data);
      } catch (error) {
        console.error("Lỗi:", error);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchBoardData();
    socket.on("data_changed", fetchBoardData);
    const handleInstantRefresh = () => { void fetchBoardData(); };
    window.addEventListener("refreshBoard", handleInstantRefresh);
    return () => {
      socket.off("data_changed", fetchBoardData);
      window.removeEventListener("refreshBoard", handleInstantRefresh);
    };
  }, []);

  const handleAddCustomer = async (newCustomerData: Partial<Task>) => {
    try {
      const { data: createdTask } = await api.post("/api/tasks", newCustomerData);
      setBoardData((prev) => {
        const startCol = prev.columns["col-1"];
        return {
          ...prev,
          tasks: { ...prev.tasks, [createdTask.id]: { ...createdTask, activities: [] } },
          columns: { ...prev.columns, "col-1": { ...startCol, taskIds: [createdTask.id, ...startCol.taskIds] } },
        };
      });
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi thêm khách hàng.");
    }
  };

  const handleUpdateCustomer = async (updatedTask: Task) => {
    try {
      setBoardData((prev) => ({ ...prev, tasks: { ...prev.tasks, [updatedTask.id]: updatedTask } }));
      await api.put(`/api/tasks/${updatedTask.id}`, updatedTask);
    } catch (error) {
      console.error("Lỗi khi cập nhật:", error);
    }
  };

  const handleDeleteCustomer = async (taskId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa khách hàng này không?")) return;
    try {
      setBoardData((prev) => {
        const newTasks = { ...prev.tasks };
        delete newTasks[taskId];
        const newColumns = { ...prev.columns };
        Object.keys(newColumns).forEach((colId) => {
          newColumns[colId].taskIds = newColumns[colId].taskIds.filter((id) => id !== taskId);
        });
        return { ...prev, tasks: newTasks, columns: newColumns };
      });
      await api.delete(`/api/tasks/${taskId}`);
    } catch (error) {
      console.error("Lỗi khi xóa:", error);
    }
  };

  const handleAddActivity = async (newActivityData: Omit<Activity, "id" | "taskId">) => {
    if (!activeTaskId) return;
    const activityPayload = { ...newActivityData, taskId: activeTaskId, completed: false };
    try {
      const { data: savedActivity } = await api.post("/api/activities", activityPayload);
      setBoardData((prev) => {
        const task = prev.tasks[activeTaskId];
        return {
          ...prev,
          tasks: { ...prev.tasks, [activeTaskId]: { ...task, activities: [savedActivity, ...(task.activities || [])] } },
        };
      });
      setIsScheduleFormOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleActivity = async (taskId: string, activityId: string) => {
    try {
      const task = boardData.tasks[taskId];
      const activity = task.activities?.find((a) => a.id === activityId);
      if (!activity) return;
      const newCompletedStatus = !activity.completed;
      setBoardData((prev) => {
        const t = prev.tasks[taskId];
        return {
          ...prev,
          tasks: {
            ...prev.tasks,
            [taskId]: { ...t, activities: t.activities?.map((act) => act.id === activityId ? { ...act, completed: newCompletedStatus } : act) },
          },
        };
      });
      await api.put(`/api/activities/${activityId}`, { completed: newCompletedStatus });
    } catch (error) {
      console.error("Lỗi khi cập nhật:", error);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!activeTaskId) return;
    try {
      setBoardData((prev) => {
        const task = prev.tasks[activeTaskId];
        return {
          ...prev,
          tasks: { ...prev.tasks, [activeTaskId]: { ...task, activities: task.activities?.filter((act) => act.id !== activityId) } },
        };
      });
      await api.delete(`/api/activities/${activityId}`);
    } catch (error) {
      console.error("Lỗi xóa hoạt động:", error);
    }
  };

  const handleEditScheduleForm = (actId: string) => {
    if (!activeTaskId) return;
    const task = boardData.tasks[activeTaskId];
    const actToEdit = task.activities?.find((a) => a.id === actId);
    if (actToEdit) {
      setActivityToEdit(actToEdit);
      setIsScheduleFormOpen(true);
    }
  };

  const handleEditActivity = async (updatedActivity: Activity) => {
    if (!activeTaskId) return;
    try {
      setBoardData((prev) => {
        const task = prev.tasks[activeTaskId];
        return {
          ...prev,
          tasks: { ...prev.tasks, [activeTaskId]: { ...task, activities: task.activities?.map((a) => a.id === updatedActivity.id ? updatedActivity : a) } },
        };
      });
      await api.put(`/api/activities/${updatedActivity.id}`, updatedActivity);
      setIsScheduleFormOpen(false);
      setActivityToEdit(null);
    } catch (error) {
      console.error("Lỗi cập nhật hoạt động:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium text-gray-500 animate-pulse">Đang tải dữ liệu hệ thống...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 h-full w-full overflow-hidden bg-gray-50/50">
        <KanbanBoard
          currentUser={currentUser}
          onOpenActivityList={(taskId) => { setActiveTaskId(taskId); setIsActivityListOpen(true); }}
          onOpenDetail={(taskId) => { setActiveTaskId(taskId); setIsDetailOpen(true); }}
          onDeleteCustomer={handleDeleteCustomer}
          onToggleActivity={handleToggleActivity}
          onOpenAddCustomer={() => setIsModalOpen(true)}
          onOpenAttachments={(taskId) => { setActiveTaskId(taskId); setIsDocumentModalOpen(true); }}
        />
      </div>

      <CustomerModal show={isModalOpen} onClose={() => setIsModalOpen(false)} onAddCustomer={handleAddCustomer} />
      <CustomerDetailModal
        key={`detail-${activeTaskId || "none"}`}
        show={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        task={activeTaskId ? boardData.tasks[activeTaskId] : null}
        onUpdateCustomer={handleUpdateCustomer}
        currentUser={currentUser}
      />
      <ActivityListModal
        show={isActivityListOpen}
        onClose={() => setIsActivityListOpen(false)}
        onOpenScheduleForm={() => { setActivityToEdit(null); setIsScheduleFormOpen(true); }}
        activities={activeTaskId ? boardData.tasks[activeTaskId]?.activities || [] : []}
        onCompleteActivity={(actId) => activeTaskId && handleToggleActivity(activeTaskId, actId)}
        onEditActivity={handleEditScheduleForm}
        onDeleteActivity={handleDeleteActivity}
      />
      <ScheduleActivityModal
        show={isScheduleFormOpen}
        onClose={() => setIsScheduleFormOpen(false)}
        taskId={activeTaskId}
        onAddActivity={handleAddActivity}
        activityToEdit={activityToEdit}
        onEditActivity={handleEditActivity}
      />
      <DocumentModal
        show={isDocumentModalOpen}
        onClose={() => setIsDocumentModalOpen(false)}
        taskId={activeTaskId}
        task={activeTaskId ? boardData.tasks[activeTaskId] : null}
      />
    </>
  );
};

export default CrmPage;
