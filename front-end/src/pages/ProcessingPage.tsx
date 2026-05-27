import React, { useState, useEffect } from "react";
import api from "../services/api";
import socket from "../services/socket";
import ProcessingBoard from "../components/processing/ProcessingBoard";
import CustomerDetailModal from "../components/crm/CustomerDetailModal";
import DocumentModal from "../components/crm/DocumentModal";
import type { BoardData, AuthUser, Employee, Task } from "../types";
import toast from "react-hot-toast";
import { API_URL } from "../constants/config";

const ProcessingPage: React.FC = () => {
  const currentUser: AuthUser = JSON.parse(localStorage.getItem("flyvisa_user")!);
  const emptyBoard: BoardData = { tasks: {}, columns: {}, columnOrder: [] };
  const [boardData, setBoardData] = useState<BoardData>(emptyBoard);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [staffList, setStaffList] = useState<Employee[]>([]);

  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        const { data } = await api.get<BoardData>("/api/board");
        setBoardData(data);
      } catch (error) {
        console.error("Lỗi:", error);
      }
    };

    const fetchStaffList = async () => {
      try {
        const { data } = await api.get<Employee[]>("/api/employees");
        setStaffList(data);
      } catch (error) {
        console.error("Lỗi tải danh sách nhân viên:", error);
      }
    };

    void fetchBoardData();
    void fetchStaffList();
    socket.on("data_changed", fetchBoardData);
    return () => { socket.off("data_changed", fetchBoardData); };
  }, []);

  const handlePingSale = async (task: Task) => {
    if (!task.assignedTo) {
      toast.error("Khách hàng chưa có Sale phụ trách!");
      return;
    }

    try {
      // Tạo activity thông báo
      const activityData = {
        taskId: task.id,
        type: "Yêu cầu",
        summary: `📢 Yêu cầu bổ sung hồ sơ từ phòng Xử lý (${currentUser.name})`,
        assignee: currentUser.name,
        status: "Chờ xử lý",
        completed: false,
      };

      const response = await fetch(`${API_URL}/api/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityData),
      });

      if (!response.ok) throw new Error("Lỗi gửi yêu cầu");

      toast.success(`Đã gửi yêu cầu bổ sung hồ sơ cho Sale: ${task.assignedTo}`);
      socket.emit("data_changed");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi gửi yêu cầu!");
    }
  };

  return (
    <>
      <div className="flex-1 overflow-hidden">
        <ProcessingBoard
          onOpenDetail={(taskId) => { setActiveTaskId(taskId); setIsDetailOpen(true); }}
          onOpenAttachments={(taskId) => { setActiveTaskId(taskId); setIsDocumentModalOpen(true); }}
          currentUser={currentUser}
        />
      </div>

      <CustomerDetailModal
        key={`detail-${activeTaskId || "none"}`}
        show={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        task={activeTaskId ? boardData.tasks[activeTaskId] : null}
        currentUser={currentUser}
        staffList={staffList}
        onPingSale={handlePingSale}
        onUpdateCustomer={(updated) => {
          setBoardData((prev) => ({
            ...prev,
            tasks: { ...prev.tasks, [updated.id]: updated },
          }));
        }}
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

export default ProcessingPage;
