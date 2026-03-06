import React, { useState, useEffect } from "react";
import { io } from "socket.io-client"; // IMPORT SOCKET.IO

import Sidebar from "../components/layout/Sidebar.tsx";
import Header from "../components/layout/Header.tsx";
import CustomerModal from "../components/crm/CustomerModal.tsx";
import KanbanBoard from "../components/crm/KanbanBoard.tsx";
import ScheduleActivityModal from "../components/crm/ScheduleActivityModal.tsx";
import CustomerDetailModal from "../components/crm/CustomerDetailModal.tsx";
import ActivityListModal from "../components/crm/ActivityListModal.tsx";
import EmployeeDashboard from "../components/hr/EmployeeDashboard.tsx";
import ProcessingBoard from "../components/processing/ProcessingBoard.tsx";
import BossDashboard from "../components/hr/BossDashboard.tsx";
import Login from "../components/auth/Login.tsx";
import DocumentModal from "../components/crm/DocumentModal.tsx";
import DocumentDashboard from "../components/documents/DocumentDashboard.tsx";
import type { Task, Activity, BoardData, AuthUser } from "../types";

// KHỞI TẠO SOCKET BÊN NGOÀI ĐỂ KHÔNG BỊ RERENDER
const socket = io("http://localhost:3001", {
  withCredentials: true,
});

const App: React.FC = () => {
  const emptyBoard: BoardData = { tasks: {}, columns: {}, columnOrder: [] };
  const [boardData, setBoardData] = useState<BoardData>(emptyBoard);
  const [isLoading, setIsLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const savedUser = localStorage.getItem("flyvisa_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [currentView, setCurrentView] = useState("crm");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isActivityListOpen, setIsActivityListOpen] = useState(false);
  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);

  const fetchBoardData = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/board");
      if (!response.ok) throw new Error("Lỗi khi lấy dữ liệu từ Backend");

      const data: BoardData = await response.json();
      setBoardData(data);
    } catch (error) {
      console.error("Lỗi:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // REAL-TIME EFFECT (THAY THẾ INTERVAL)
  // ==========================================
  useEffect(() => {
    fetchBoardData(); // Load lần đầu

    socket.on("data_changed", () => {
      console.log("♻️ Dữ liệu thay đổi từ Server. Đang cập nhật lại Board...");
      fetchBoardData();
    });

    // Custom event cho các component con muốn ép load lại ngay
    const handleInstantRefresh = () => fetchBoardData();
    window.addEventListener("refreshBoard", handleInstantRefresh);

    return () => {
      socket.off("data_changed");
      window.removeEventListener("refreshBoard", handleInstantRefresh);
    };
  }, []);

  const handleAddCustomer = async (newCustomerData: Partial<Task>) => {
    try {
      const response = await fetch("http://localhost:3001/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomerData),
      });

      if (!response.ok) throw new Error("Lỗi khi lưu khách hàng vào Database");

      // Lạc quan cập nhật UI (Socket sẽ lo phần báo cho máy khác)
      const createdTask = await response.json();
      setBoardData((prev) => {
        const startCol = prev.columns["col-1"];
        const newTaskIds = [createdTask.id, ...startCol.taskIds];

        return {
          ...prev,
          tasks: {
            ...prev.tasks,
            [createdTask.id]: { ...createdTask, activities: [] },
          },
          columns: {
            ...prev.columns,
            "col-1": { ...startCol, taskIds: newTaskIds },
          },
        };
      });
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi thêm khách hàng.");
    }
  };

  const handleUpdateCustomer = async (updatedTask: Task) => {
    try {
      setBoardData((prev) => ({
        ...prev,
        tasks: { ...prev.tasks, [updatedTask.id]: updatedTask },
      }));

      await fetch(`http://localhost:3001/api/tasks/${updatedTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTask),
      });
    } catch (error) {
      console.error("Lỗi khi cập nhật:", error);
    }
  };

  const handleDeleteCustomer = async (taskId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa khách hàng này không?"))
      return;

    try {
      setBoardData((prev) => {
        const newTasks = { ...prev.tasks };
        delete newTasks[taskId];
        const newColumns = { ...prev.columns };
        Object.keys(newColumns).forEach((colId) => {
          newColumns[colId].taskIds = newColumns[colId].taskIds.filter(
            (id) => id !== taskId,
          );
        });
        return { ...prev, tasks: newTasks, columns: newColumns };
      });

      await fetch(`http://localhost:3001/api/tasks/${taskId}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Lỗi khi xóa:", error);
    }
  };

  const handleAddActivity = async (
    newActivityData: Omit<Activity, "id" | "taskId">,
  ) => {
    if (!activeTaskId) return;

    const activityPayload = {
      ...newActivityData,
      taskId: activeTaskId,
      completed: false,
    };

    try {
      const response = await fetch("http://localhost:3001/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityPayload),
      });

      if (!response.ok) throw new Error("Lỗi khi tạo hoạt động");

      const savedActivity = await response.json();
      setBoardData((prev) => {
        const task = prev.tasks[activeTaskId];
        return {
          ...prev,
          tasks: {
            ...prev.tasks,
            [activeTaskId]: {
              ...task,
              activities: [savedActivity, ...(task.activities || [])],
            },
          },
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
        const updatedActivities = t.activities?.map((act) =>
          act.id === activityId
            ? { ...act, completed: newCompletedStatus }
            : act,
        );
        return {
          ...prev,
          tasks: {
            ...prev.tasks,
            [taskId]: { ...t, activities: updatedActivities },
          },
        };
      });

      await fetch(`http://localhost:3001/api/activities/${activityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: newCompletedStatus }),
      });
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
          tasks: {
            ...prev.tasks,
            [activeTaskId]: {
              ...task,
              activities: task.activities?.filter(
                (act) => act.id !== activityId,
              ),
            },
          },
        };
      });
      await fetch(`http://localhost:3001/api/activities/${activityId}`, {
        method: "DELETE",
      });
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
          tasks: {
            ...prev.tasks,
            [activeTaskId]: {
              ...task,
              activities: task.activities?.map((a) =>
                a.id === updatedActivity.id ? updatedActivity : a,
              ),
            },
          },
        };
      });

      await fetch(
        `http://localhost:3001/api/activities/${updatedActivity.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedActivity),
        },
      );

      setIsScheduleFormOpen(false);
      setActivityToEdit(null);
    } catch (error) {
      console.error("Lỗi cập nhật hoạt động:", error);
    }
  };

  const handleOpenDocumentModal = (taskId: string) => {
    setActiveTaskId(taskId);
    setIsDocumentModalOpen(true);
  };

  const handleOpenDetail = (taskId: string) => {
    setActiveTaskId(taskId);
    setIsDetailOpen(true);
  };

  const handleOpenActivityList = (taskId: string) => {
    setActiveTaskId(taskId);
    setIsActivityListOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full bg-gray-100 items-center justify-center font-sans text-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium text-gray-500 animate-pulse">
            Đang tải dữ liệu hệ thống...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="flex h-screen w-full bg-gray-100 font-sans text-gray-900">
      <Sidebar
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header currentUser={currentUser} />
        <div className="flex-1 overflow-hidden flex flex-col">
          {currentView === "boss" && (
            <BossDashboard currentUser={currentUser} />
          )}
          {currentView === "crm" && (
            <div className="flex-1 h-full w-full overflow-hidden bg-gray-50/50">
              <KanbanBoard
                currentUser={currentUser}
                onOpenActivityList={handleOpenActivityList}
                onOpenDetail={handleOpenDetail}
                onDeleteCustomer={handleDeleteCustomer}
                onToggleActivity={handleToggleActivity}
                onOpenAddCustomer={() => setIsModalOpen(true)}
                onOpenAttachments={handleOpenDocumentModal}
              />
            </div>
          )}
          {currentView === "processing" && (
            <div className="flex-1 p-6 overflow-hidden">
              <ProcessingBoard
                onOpenDetail={handleOpenDetail}
                onOpenAttachments={handleOpenDocumentModal}
                currentUser={currentUser}
              />
            </div>
          )}
          {currentView === "documents" && (
            <DocumentDashboard currentUser={currentUser} />
          )}
          {currentView === "hr" && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <EmployeeDashboard currentUser={currentUser} />
            </div>
          )}
        </div>
      </main>

      <CustomerModal
        show={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddCustomer={handleAddCustomer}
      />
      <CustomerDetailModal
        key={`detail-${activeTaskId || "none"}`}
        show={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        task={activeTaskId ? boardData.tasks[activeTaskId] : null}
        onUpdateCustomer={handleUpdateCustomer}
      />
      <ActivityListModal
        show={isActivityListOpen}
        onClose={() => setIsActivityListOpen(false)}
        onOpenScheduleForm={() => {
          setActivityToEdit(null);
          setIsScheduleFormOpen(true);
        }}
        activities={
          activeTaskId ? boardData.tasks[activeTaskId]?.activities || [] : []
        }
        onCompleteActivity={(actId) =>
          activeTaskId && handleToggleActivity(activeTaskId, actId)
        }
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
    </div>
  );
};

export default App;
