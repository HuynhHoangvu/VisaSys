import React, { useState, useEffect } from "react";
import api from "../services/api";
import socket from "../services/socket";
import RecruitmentBoard from "../components/processing/Recruitmentboard";
import CustomerDetailModal from "../components/crm/CustomerDetailModal";
import type { BoardData, AuthUser } from "../types";

const RecruitmentPage: React.FC = () => {
  const currentUser: AuthUser = JSON.parse(localStorage.getItem("flyvisa_user")!);
  const emptyBoard: BoardData = { tasks: {}, columns: {}, columnOrder: [] };
  const [boardData, setBoardData] = useState<BoardData>(emptyBoard);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        const { data } = await api.get<BoardData>("/api/board");
        setBoardData(data);
      } catch (error) {
        console.error("Lỗi:", error);
      }
    };
    void fetchBoardData();
    socket.on("data_changed", fetchBoardData);
    return () => { socket.off("data_changed", fetchBoardData); };
  }, []);

  return (
    <>
      <div className="flex-1 overflow-x-hidden overflow-y-auto flex flex-col custom-scrollbar">
        <RecruitmentBoard
          onOpenDetail={(taskId) => { setActiveTaskId(taskId); setIsDetailOpen(true); }}
        />
      </div>

      <CustomerDetailModal
        key={`detail-${activeTaskId || "none"}`}
        show={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        task={activeTaskId ? boardData.tasks[activeTaskId] : null}
        currentUser={currentUser}
      />
    </>
  );
};

export default RecruitmentPage;
