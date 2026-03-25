import React, { useState, useEffect } from "react";
import api from "../services/api";
import socket from "../services/socket";
import ProcessingBoard from "../components/processing/ProcessingBoard";
import CustomerDetailModal from "../components/crm/CustomerDetailModal";
import DocumentModal from "../components/crm/DocumentModal";
import type { BoardData, AuthUser } from "../types";

const ProcessingPage: React.FC = () => {
  const currentUser: AuthUser = JSON.parse(localStorage.getItem("flyvisa_user")!);
  const emptyBoard: BoardData = { tasks: {}, columns: {}, columnOrder: [] };
  const [boardData, setBoardData] = useState<BoardData>(emptyBoard);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);

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
      <div className="flex-1 p-3 md:p-6 overflow-hidden">
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
