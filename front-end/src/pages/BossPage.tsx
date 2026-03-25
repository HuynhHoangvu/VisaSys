import React from "react";
import BossDashboard from "../components/hr/BossDashboard";
import type { AuthUser } from "../types";

const BossPage: React.FC = () => {
  const currentUser: AuthUser = JSON.parse(localStorage.getItem("flyvisa_user")!);
  return <BossDashboard currentUser={currentUser} />;
};

export default BossPage;
