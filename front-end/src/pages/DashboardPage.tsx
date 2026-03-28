import React from "react";
import Dashboard from "../components/dashboard/Dashboard";
import type { AuthUser } from "../types";

const DashboardPage: React.FC = () => {
  const currentUser: AuthUser = JSON.parse(localStorage.getItem("flyvisa_user")!);
  return <Dashboard currentUser={currentUser} />;
};

export default DashboardPage;
