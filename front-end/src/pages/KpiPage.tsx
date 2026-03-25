import React from "react";
import WeeklyTaskAssignment from "../components/kpi/WeeklyTaskAssignment";
import type { AuthUser } from "../types";

const KpiPage: React.FC = () => {
  const currentUser: AuthUser = JSON.parse(localStorage.getItem("flyvisa_user")!);
  return (
    <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
      <WeeklyTaskAssignment currentUser={currentUser} />
    </div>
  );
};

export default KpiPage;
