import React from "react";
import EmployeeDashboard from "../components/hr/EmployeeDashboard";
import type { AuthUser } from "../types";

const HrPage: React.FC = () => {
  const currentUser: AuthUser = JSON.parse(localStorage.getItem("flyvisa_user")!);
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <EmployeeDashboard currentUser={currentUser} />
    </div>
  );
};

export default HrPage;
